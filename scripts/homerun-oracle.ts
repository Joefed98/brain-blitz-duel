/**
 * Home Run Derby's oracle (a flawless batter): for every pitch it starts the swing so the bat meets the ball on the
 * tick it reaches the plate, at the ball's own height, and aims four of the ten at the four signs (the rest straight
 * away). Every swing carries 470 ft, so every pitch is a home run past 450 ft: 200 on any seed whose plan allows it.
 * Used by homerun-deal.ts (the proved deal), homerun-check and the skill-band tool's flawless level.
 */
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { homerunGame, homerunPlan, HOMERUN_INPUT_RANGES, HOMERUN_INPUT_SWING, HOMERUN_SWING_TICKS } from "../src/lib/arcade/homerun";

/** The swipe angle (tenths of a degree) whose spray is `spray` (the sim takes three quarters of the swipe). */
export const homerunAngleFor = (spray: number) => Math.round((spray * 4) / 3);

export function oracleRun(seed: number): ArcadeInputEvent[] {
  const plan = homerunPlan(seed);
  const events: ArcadeInputEvent[] = [];
  plan.pitches.forEach((p, i) => {
    const sign = plan.signs[i];
    const b = sign ? homerunAngleFor(sign.angle) : 0;
    recordInput(events, { t: p.arrive - HOMERUN_SWING_TICKS, k: HOMERUN_INPUT_SWING, a: p.plateY, b, c: 0, d: 0 }, HOMERUN_INPUT_RANGES);
  });
  return events;
}

/** Plays a log through the sim (as the phone does) and returns the final state. */
export function playLog(seed: number, events: ArcadeInputEvent[]) {
  const at = new Map(events.map((e) => [e.t, e]));
  let s = homerunGame.init(seed);
  while (!homerunGame.isOver(s)) s = homerunGame.step(s, at.get(s.tick + 1) ?? null);
  return s;
}
