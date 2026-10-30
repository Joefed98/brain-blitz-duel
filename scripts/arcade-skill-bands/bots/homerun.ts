/**
 * Home Run Derby: a batter swiping at ten seeded pitches.
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
 */
import { homerunPlan, HOMERUN_INPUT_SWING, HOMERUN_SWING_TICKS, PITCH_CHANGEUP, PITCH_CURVE, PITCH_DROP } from "../../../src/lib/arcade/homerun";
import { recordInput, type ArcadeInputEvent } from "../../../src/lib/arcade/engine";
import { oracleRun, homerunAngleFor } from "../../homerun-oracle";
import type { SkillBot } from "../bot";

const READ: Record<number, number> = { 0: 1.5, [PITCH_CURVE]: 2, [PITCH_DROP]: 1.8, [PITCH_CHANGEUP]: 2.2 };

export const bot: SkillBot = ({ game, seed, human }) => {
  if (human.level === "perfect") return { events: oracleRun(seed) };
  const plan = homerunPlan(seed);
  const events: ArcadeInputEvent[] = [];
  const signsLeft = plan.signs.map((_, i) => i);
  const aimsForSigns = human.level === "great" || human.level === "near" || human.level === "elite" ? 1 : human.level === "good" ? 0.5 : 0;
  const judgement = ({ weak: 0.5, average: 0.35, good: 0.2, great: 0.1, near: 0.04, elite: 0.025, perfect: 0 } as const)[human.level];
  for (const p of plan.pitches) {
    let start = p.arrive - HOMERUN_SWING_TICKS + human.timingTicks(READ[p.kind] ?? 1.5);
    if (human.slip()) start += (human.chance(0.5) ? -1 : 1) * human.int(6, 10);
    start = Math.max(start, p.release + human.reactTicks() - 6);
    const height = Math.round(p.plateY - p.breakY * judgement * 0.8 + human.aim(1, 1.2));
    let target = 0;
    if (signsLeft.length > 0 && human.chance(aimsForSigns)) {
      const i = signsLeft[0]!;
      target = plan.signs[i]!.angle;
    } else target = human.int(-120, 120);
    const angle = Math.round(homerunAngleFor(target) + human.aim(9, 1));
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

/** Swipes at random moments with random heights and angles (no aim). */
export const randomBot: SkillBot = ({ game, seed, human }) => {
  const events: ArcadeInputEvent[] = [];
  for (const p of homerunPlan(seed).pitches)
    recordInput(events, { t: p.release + human.int(0, 70), k: HOMERUN_INPUT_SWING, a: human.int(300, 700), b: human.int(-900, 900), c: 0, d: 0 }, game.inputRanges ?? []);
  return { events };
};
