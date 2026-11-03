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
 *
 * homerunRev 4 (3 Nov 2026, botV4): before each pitch the hitter taps a spot (with the level's pointing error, V4_SPOT
 * the strategy by level: weaker hitters a gap in the outfield, stronger ones over the fence and the lit sign when they
 * trust their timing for it) and then taps as the ring closes: the moment is anticipated from the ring with the level's
 * timing spread, a little wider for curveballs and wider again for the slow changeup (V4_READ); slips mistime a tap by
 * 6–10 ticks. Gaps are judged from the fielders shown with the level's judgement blur.
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
import {
  homerunFence,
  homerunGroundY,
  homerunV4XOf,
  homerunWallTopY,
  HOMERUN_INPUT_SPOT,
  HOMERUN_INPUT_TAP,
  HOMERUN_REV_4,
  HOMERUN_V4_SIGNS,
  HOMERUN_V4_SPOT_Y0,
  type HomerunFielder,
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
  if ((rev ?? 1) >= HOMERUN_REV_4) return botV4({ game, seed, rev, human });
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
export const randomBot: SkillBot = ({ game, seed, rev, human }) => {
  const events: ArcadeInputEvent[] = [];
  if ((rev ?? 1) >= HOMERUN_REV_4) {
    // Taps at random: a spot anywhere on the screen now and then, and a tap somewhere in each pitch's flight.
    for (const p of homerunPlan(seed, HOMERUN_REV_4).pitches) {
      if (human.chance(0.5)) recordInput(events, { t: Math.max(1, p.release - human.int(20, 200)), k: HOMERUN_INPUT_SPOT, a: human.int(0, 390), b: human.int(0, 720), c: 0, d: 0 }, game.inputRanges ?? []);
      recordInput(events, { t: p.release + human.int(0, 70), k: HOMERUN_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 }, game.inputRanges ?? []);
    }
    return { events };
  }
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

/* ------------------------------------------------------------------ homerunRev 4 */

/** homerunRev 4: the timing spread by kind (the ring makes the moment plain; a curve's bend and a changeup's float less so). */
const V4_READ: Record<number, number> = { 0: 1, [PITCH_CURVE]: 1.15, [PITCH_CHANGEUP]: 1.3 };
/**
 * homerunRev 4's spot strategy by level: the chance of going for the lit sign (only if its tolerance is at least
 * `signTol`), else of a home-run spot just over the wall in a gap, else a gap in the outfield at `gapFeet`.
 */
const V4_PLAN = {
  weak: { sign: 0, signTol: 9, homer: 0, gapFeet: [170, 230] },
  average: { sign: 0, signTol: 9, homer: 0.45, gapFeet: [230, 290] },
  good: { sign: 0.5, signTol: 2, homer: 0.8, gapFeet: [240, 290] },
  great: { sign: 0.9, signTol: 1, homer: 0.9, gapFeet: [230, 280] },
  near: { sign: 1, signTol: 0, homer: 1, gapFeet: [240, 280] },
  elite: { sign: 1, signTol: 0, homer: 1, gapFeet: [240, 280] },
  perfect: { sign: 1, signTol: 0, homer: 1, gapFeet: [240, 280] },
} as const;

/** The spray (tenths of a degree) in the widest gap between the fielders (and the foul lines), seen with a judgement blur. */
function gapSpray(fielders: readonly HomerunFielder[], minFeet: number, human: { normal(): number; p?: unknown }, blur: number): number {
  const edges = [-440, ...fielders.filter((f) => f.feet + f.depth >= minFeet).map((f) => f.spray), 440].sort((a, b) => a - b);
  let best = 0;
  let bestW = -1;
  for (let i = 0; i + 1 < edges.length; i++) {
    const w = edges[i + 1]! - edges[i]! + blur * human.normal();
    if (w > bestW) {
      bestW = w;
      best = Math.round((edges[i]! + edges[i + 1]!) / 2);
    }
  }
  return best;
}

const botV4: SkillBot = ({ game, seed, human }) => {
  if (human.level === "perfect") return { events: oracleRun(seed, HOMERUN_REV_4) };
  const plan = homerunPlan(seed, HOMERUN_REV_4);
  const events: ArcadeInputEvent[] = [];
  const ranges = game.inputRanges ?? [];
  const strat = V4_PLAN[human.level];
  const blur = ({ weak: 260, average: 180, good: 110, great: 60, near: 25, elite: 15, perfect: 0 } as const)[human.level];
  plan.pitches.forEach((p, i) => {
    const lit = HOMERUN_V4_SIGNS[plan.lit![i]!]!;
    let x: number;
    let y: number;
    if (lit.tol >= strat.signTol && human.chance(strat.sign)) {
      x = lit.x + lit.w / 2;
      y = lit.y + lit.h / 2;
    } else if (human.chance(strat.homer)) {
      const spray = gapSpray(plan.fielders![i]!, 200, human, blur);
      x = homerunV4XOf(spray);
      y = homerunWallTopY(spray) - 14;
    } else {
      const [lo, hi] = strat.gapFeet;
      const feet = human.int(lo, hi);
      const spray = gapSpray(plan.fielders![i]!, feet - 60, human, blur);
      x = homerunV4XOf(spray);
      y = homerunGroundY(Math.min(feet, homerunFence(spray) - 20));
    }
    x = Math.round(x + human.aim(1));
    y = Math.round(Math.max(HOMERUN_V4_SPOT_Y0, y + human.aim(1)));
    recordInput(events, { t: Math.max(1, p.release - 30 - human.int(0, 80)), k: HOMERUN_INPUT_SPOT, a: x, b: y, c: 0, d: 0 }, ranges);
    let t = p.arrive - HOMERUN_SWING_TICKS + human.timingTicks(V4_READ[p.kind] ?? 1);
    if (human.slip()) t += (human.chance(0.5) ? -1 : 1) * human.int(6, 10);
    t = Math.max(t, p.release + human.reactTicks() - 6);
    recordInput(events, { t, k: HOMERUN_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 }, ranges);
  });
  return { events };
};
