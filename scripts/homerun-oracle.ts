/**
 * Home Run's oracle (a flawless batter): for every pitch it starts the swing so the bat meets the ball on the
 * tick it reaches the plate, at the ball's own height, and aims four of the ten at the four signs (the rest straight
 * away). Every swing carries 470 ft, so every pitch is a home run past 450 ft: 200 on any seed whose plan allows it.
 * Used by homerun-deal.ts (the proved deal), homerun-check and the skill-band tool's flawless level.
 */
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { homerunGameFor, homerunPlan, HOMERUN_INPUT_RANGES, HOMERUN_INPUT_SWING, HOMERUN_REV_2, HOMERUN_SWING_TICKS } from "../src/lib/arcade/homerun";

/** The swipe angle (tenths of a degree) whose spray is `spray` (rev 1 takes three quarters of the swipe, rev 2 9/16). */
export const homerunAngleFor = (spray: number, rev = 1) => (rev >= HOMERUN_REV_2 ? Math.round((spray * 16) / 9) : Math.round((spray * 4) / 3));

/** The flawless batter's log on `seed` for revision `rev` (default 1; the plan is the same on both). */
export function oracleRun(seed: number, rev = 1): ArcadeInputEvent[] {
  const plan = homerunPlan(seed);
  const events: ArcadeInputEvent[] = [];
  plan.pitches.forEach((p, i) => {
    const sign = plan.signs[i];
    const b = sign ? homerunAngleFor(sign.angle, rev) : 0;
    recordInput(events, { t: p.arrive - HOMERUN_SWING_TICKS, k: HOMERUN_INPUT_SWING, a: p.plateY, b, c: 0, d: 0 }, HOMERUN_INPUT_RANGES);
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
