/**
 * The arcade run clock. Arcade screens report the sim tick they have reached
 * each frame; the round's timer ring reads it so the clock shows the RUN
 * (sim ticks ÷ 60) and reads 0.0 exactly when the sim ends. The phase's extra
 * slack stays invisible to the player. Render-only — never feeds the sim.
 */

import { TICK_MS } from "./engine";

let tick = 0;
let ended = false;

export function reportArcadeTick(current: number, over = false): void {
  tick = current;
  ended = over;
}

export function resetArcadeClock(): void {
  tick = 0;
  ended = false;
}

/** Remaining run time in ms for a run of `runMs`, from the last reported tick. */
export function arcadeMsRemaining(runMs: number): number {
  if (ended) return 0;
  return Math.max(0, runMs - tick * TICK_MS);
}
