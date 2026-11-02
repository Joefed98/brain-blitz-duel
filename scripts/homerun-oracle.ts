/**
 * Home Run's oracle (a flawless batter): for every pitch it starts the swing so the bat meets the ball on the
 * tick it reaches the plate, at the ball's own height, and aims four of the ten at the four signs (the rest straight
 * away). Every swing carries 470 ft, so every pitch is a home run past 450 ft: 200 on any seed whose plan allows it.
 * Used by homerun-deal.ts (the proved deal), homerun-check and the skill-band tool's flawless level.
 *
 * homerunRev 3: it picks Power once (on tick 1; the choice carries from pitch to pitch) and meets each pitch on its
 * kind's perfect tick (homerunPerfectOffset), so every swing carries 480 ft (the core counts 460).
 */
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  homerunGameFor,
  homerunPerfectOffset,
  homerunPlan,
  HOMERUN_INPUT_MODE,
  HOMERUN_INPUT_RANGES,
  HOMERUN_INPUT_RANGES_V3,
  HOMERUN_INPUT_SWING,
  HOMERUN_MODE_POWER,
  HOMERUN_REV_2,
  HOMERUN_REV_3,
  HOMERUN_SWING_TICKS,
} from "../src/lib/arcade/homerun";

/** The swipe angle (tenths of a degree) whose spray is `spray` (rev 1 takes three quarters of the swipe, rev 2 9/16). */
export const homerunAngleFor = (spray: number, rev = 1) => (rev >= HOMERUN_REV_2 ? Math.round((spray * 16) / 9) : Math.round((spray * 4) / 3));

/** The flawless batter's log on `seed` for revision `rev` (default 1; the plan is the same on every revision). */
export function oracleRun(seed: number, rev = 1): ArcadeInputEvent[] {
  const plan = homerunPlan(seed);
  const events: ArcadeInputEvent[] = [];
  const v3 = rev >= HOMERUN_REV_3;
  const ranges = v3 ? HOMERUN_INPUT_RANGES_V3 : HOMERUN_INPUT_RANGES;
  if (v3) recordInput(events, { t: 1, k: HOMERUN_INPUT_MODE, a: HOMERUN_MODE_POWER, b: 0, c: 0, d: 0 }, ranges);
  plan.pitches.forEach((p, i) => {
    const sign = plan.signs[i];
    const b = sign ? homerunAngleFor(sign.angle, rev) : 0;
    const t = p.arrive + homerunPerfectOffset(p.kind, rev) - HOMERUN_SWING_TICKS;
    recordInput(events, { t, k: HOMERUN_INPUT_SWING, a: p.plateY, b, c: 0, d: 0 }, ranges);
  });
  return events;
}

/** Plays a log through the sim on revision `rev` (as the phone does) and returns the final state. */
export function playLog(seed: number, events: ArcadeInputEvent[], rev = 1) {
  const game = homerunGameFor(rev);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  while (!game.isOver(s)) s = game.step(s, at.get(s.tick + 1) ?? null);
  return s;
}
