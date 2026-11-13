/**
 * The arcade wall-clock trial's phone-side timing (13 Nov 2026, log only; docs/security/arcade-wall-clock.md): for a
 * played run, how long it took on the phone's clock, how much of that the app was hidden (the sim waits while hidden),
 * the run's ticks, and the ticks the sim fell behind the visible wall time (frames slower than the catch-up limit).
 * Sent once a run as the client event `arcade_run_timed`; never a score, never read by grading. Pure.
 */
import { TICK_MS } from "./engine";

export interface ArcadeRunTiming {
  wall_ms: number;
  hidden_ms: number;
  dropped_ticks: number;
  run_ticks: number;
}

/** The event's props from the run's measures (whole numbers, never negative). */
export function arcadeRunTiming(input: { wallMs: number; hiddenMs: number; runTicks: number }): ArcadeRunTiming {
  const wall = Math.max(0, Math.round(input.wallMs));
  const hidden = Math.min(wall, Math.max(0, Math.round(input.hiddenMs)));
  const ticks = Math.max(0, Math.round(input.runTicks));
  const expected = Math.round((wall - hidden) / TICK_MS);
  return { wall_ms: wall, hidden_ms: hidden, dropped_ticks: Math.max(0, expected - ticks), run_ticks: ticks };
}
