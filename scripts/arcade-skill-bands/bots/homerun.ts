/**
 * Home Run: a batter swiping at ten seeded pitches.
 *
 * The human watches the pitcher's release and reads the pitch (the chip names it, the speed shows in its flight), then
 * starts the swipe so the bat meets the plate as the ball arrives. Their errors:
 *   - timing: an anticipated moment with the level's timing sd, widened for pitches that are harder to read
 *     (fastball 1.5×, drop 1.8×, curve 2×, changeup 2.2×); a swing can never start before the release plus a reaction;
 *   - height: the swipe starts at the ball's plate height plus the level's pointing error, and a weaker player reads
 *     only part of a curve's or drop's late break (the level's judgement);
 *   - angle: the swipe's angle with an error of about 0.9° per pixel of pointing sd (a 60 px swipe);
 *   - slips: a mistimed swing (6–10 ticks early or late).
 * Weak and average hitters aim straight away; good ones go for a sign on half their pitches; great and better aim for
 * each sign still standing on their first pitches. The perfect level is the oracle (scripts/homerun-oracle.ts).
 *
 * homerunRev 2 (31 Oct 2026): nothing names the pitch before it is thrown (the radar board shows it afterwards), so it
 * is read from the hand and the flight alone: the timing spread widens a further fifth on every kind and a weaker
 * hitter reads a little less of the late break; the swipe angle maps to the spray at 9/16 (rev 1 three quarters), with
 * the same pointing error in degrees of swipe (the longer 18 px chord does not make the hand steadier in the model).
 *
 * homerunRev 3 (1 Nov 2026): the pitcher's tell shows the pitch for the last 0.4 s of the wind-up, and each kind has
 * its own perfect contact tick. A hitter reads the tell with a level's chance (V3_TELL); read, they time the pitch's
 * own perfect tick with the timing spread V3_READ (fastball tightest) and judge a little more of its break; misread,
 * they time it from the flight alone (rev 2's spread) without the kind's offset. Before each pitch they choose the
 * swing: weaker hitters mostly Contact (the wide window), stronger ones Power (V3_POWER, the chance per pitch), and a
 * sign is only aimed at with Power (Contact never carries to one).
 */
import {
  homerunPerfectOffset,
  homerunPlan,
  HOMERUN_INPUT_MODE,
  HOMERUN_INPUT_SWING,
  HOMERUN_MODE_CONTACT,
  HOMERUN_MODE_POWER,
  HOMERUN_REV_2,
  HOMERUN_REV_3,
  HOMERUN_SWING_TICKS,
  PITCH_CHANGEUP,
  PITCH_CURVE,
  PITCH_DROP,
} from "../../../src/lib/arcade/homerun";
import { recordInput, type ArcadeInputEvent } from "../../../src/lib/arcade/engine";
import { oracleRun, homerunAngleFor } from "../../homerun-oracle";
import type { SkillBot } from "../bot";

const READ: Record<number, number> = { 0: 1.5, [PITCH_CURVE]: 2, [PITCH_DROP]: 1.8, [PITCH_CHANGEUP]: 2.2 };
/** homerunRev 3: the timing spread with the tell read, by kind. */
const V3_READ: Record<number, number> = { 0: 1, [PITCH_CURVE]: 1.15, [PITCH_DROP]: 1.1, [PITCH_CHANGEUP]: 1.2 };
/** homerunRev 3: the chance of reading the tell, and of choosing Power for a pitch, by level. */
const V3_TELL = { weak: 0.55, average: 0.7, good: 0.85, great: 0.93, near: 0.97, elite: 0.99, perfect: 1 } as const;
const V3_POWER = { weak: 0, average: 0.1, good: 0.3, great: 0.85, near: 1, elite: 1, perfect: 1 } as const;

export const bot: SkillBot = ({ game, seed, rev, human }) => {
  const v2 = (rev ?? 1) >= HOMERUN_REV_2;
  if ((rev ?? 1) >= HOMERUN_REV_3) return botV3({ game, seed, rev, human });
  if (human.level === "perfect") return { events: oracleRun(seed, v2 ? HOMERUN_REV_2 : 1) };
  const plan = homerunPlan(seed);
  const events: ArcadeInputEvent[] = [];
  const signsLeft = plan.signs.map((_, i) => i);
  const aimsForSigns = human.level === "great" || human.level === "near" || human.level === "elite" ? 1 : human.level === "good" ? 0.5 : 0;
  const judgement = ({ weak: 0.5, average: 0.35, good: 0.2, great: 0.1, near: 0.04, elite: 0.025, perfect: 0 } as const)[human.level] * (v2 ? 1.2 : 1);
  const unseen = v2 ? 1.2 : 1;
  for (const p of plan.pitches) {
    let start = p.arrive - HOMERUN_SWING_TICKS + human.timingTicks((READ[p.kind] ?? 1.5) * unseen);
    if (human.slip()) start += (human.chance(0.5) ? -1 : 1) * human.int(6, 10);
    start = Math.max(start, p.release + human.reactTicks() - 6);
    const height = Math.round(p.plateY - p.breakY * judgement * 0.8 + human.aim(1, 1.2));
    let target = 0;
    if (signsLeft.length > 0 && human.chance(aimsForSigns)) {
      const i = signsLeft[0]!;
      target = plan.signs[i]!.angle;
    } else target = human.int(-120, 120);
    const angle = Math.round(homerunAngleFor(target, v2 ? HOMERUN_REV_2 : 1) + human.aim(9, 1));
    const ev = recordInput(events, { t: start, k: HOMERUN_INPUT_SWING, a: height, b: Math.max(-900, Math.min(900, angle)), c: 0, d: 0 }, game.inputRanges ?? []);
    // The hitter sees the sign struck and moves on to the next one.
    if (ev) {
      const at = new Map(events.map((e) => [e.t, e]));
      let s = game.init(seed);
      while (!game.isOver(s) && s.tick < p.arrive + 10) s = game.step(s, at.get(s.tick + 1) ?? null);
      const last = s.hits[s.hits.length - 1];
      if (last && last.sign >= 0) {
        const k = signsLeft.indexOf(last.sign);
        if (k >= 0) signsLeft.splice(k, 1);
      }
    }
  }
  return { events };
};

/** Swipes at random moments with random heights and angles (no aim; rev 3: the swing left at Contact). */
export const randomBot: SkillBot = ({ game, seed, human }) => {
  const events: ArcadeInputEvent[] = [];
  for (const p of homerunPlan(seed).pitches)
    recordInput(events, { t: p.release + human.int(0, 70), k: HOMERUN_INPUT_SWING, a: human.int(300, 700), b: human.int(-900, 900), c: 0, d: 0 }, game.inputRanges ?? []);
  return { events };
};

/** homerunRev 3's hitter: reads the tell, picks the swing, times the pitch's own perfect tick. */
const botV3: SkillBot = ({ game, seed, rev, human }) => {
  if (human.level === "perfect") return { events: oracleRun(seed, HOMERUN_REV_3) };
  const plan = homerunPlan(seed);
  const events: ArcadeInputEvent[] = [];
  const ranges = game.inputRanges ?? [];
  const signsLeft = plan.signs.map((_, i) => i);
  const aimsForSigns = human.level === "great" || human.level === "near" || human.level === "elite" ? 1 : human.level === "good" ? 0.5 : 0;
  const judgement = ({ weak: 0.5, average: 0.35, good: 0.2, great: 0.1, near: 0.04, elite: 0.025, perfect: 0 } as const)[human.level] * 1.2;
  let mode: number = HOMERUN_MODE_CONTACT;
  for (const p of plan.pitches) {
    const want = human.chance(V3_POWER[human.level]) ? HOMERUN_MODE_POWER : HOMERUN_MODE_CONTACT;
    if (want !== mode) {
      recordInput(events, { t: p.release - 30 - human.int(0, 60), k: HOMERUN_INPUT_MODE, a: want, b: 0, c: 0, d: 0 }, ranges);
      mode = want;
    }
    const read = human.chance(V3_TELL[human.level]);
    const target = read ? p.arrive + homerunPerfectOffset(p.kind, rev) : p.arrive;
    let start = target - HOMERUN_SWING_TICKS + human.timingTicks(read ? (V3_READ[p.kind] ?? 1.3) : (READ[p.kind] ?? 1.5) * 1.2);
    if (human.slip()) start += (human.chance(0.5) ? -1 : 1) * human.int(6, 10);
    start = Math.max(start, p.release + human.reactTicks() - 6);
    const height = Math.round(p.plateY - p.breakY * judgement * (read ? 0.6 : 0.8) + human.aim(1, 1.2));
    let aim = 0;
    if (mode === HOMERUN_MODE_POWER && signsLeft.length > 0 && human.chance(aimsForSigns)) aim = plan.signs[signsLeft[0]!]!.angle;
    // A Contact hitter who knows the park pulls it down a line, where the fence is shortest.
    else if (mode === HOMERUN_MODE_CONTACT && aimsForSigns > 0) aim = (human.chance(0.5) ? 1 : -1) * human.int(250, 350);
    else aim = human.int(-120, 120);
    const angle = Math.round(homerunAngleFor(aim, HOMERUN_REV_2) + human.aim(9, 1));
    const ev = recordInput(events, { t: start, k: HOMERUN_INPUT_SWING, a: height, b: Math.max(-900, Math.min(900, angle)), c: 0, d: 0 }, ranges);
    if (ev) {
      const at = new Map(events.map((e) => [e.t, e]));
      let s = game.init(seed);
      while (!game.isOver(s) && s.tick < p.arrive + 10) s = game.step(s, at.get(s.tick + 1) ?? null);
      const last = s.hits[s.hits.length - 1];
      if (last && last.sign >= 0) {
        const k = signsLeft.indexOf(last.sign);
        if (k >= 0) signsLeft.splice(k, 1);
      }
    }
  }
  return { events };
};
