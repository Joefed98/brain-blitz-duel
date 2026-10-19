/**
 * "At the buzzer" (18 Oct 2026, presentation only; nothing here grades or scores anything).
 *
 * A round's own clock is what its timer shows: an arcade run's length (the time limit less the
 * phase slack, puzzleRunMs) or the puzzle's time limit. An answer's time left (ms_remaining, or the
 * server's trusted figure) is measured against the time limit, so arcade figures carry the slack.
 *
 *  - Live "finished" pings (finishedPing.server.ts) go only to players who finished before the
 *    buzzer: received in the puzzle phase with at least BUZZER_MARGIN_MS left on the round's own
 *    clock. A time-out's draft (sent with 0 ms left), an answer that lands in the reveal, and an
 *    arcade run that played to the end of its clock never ping.
 *  - The round results' time column shows the round's full clock in whole seconds ("90s", not
 *    "89.4s") for anyone who reached the buzzer (less than BUZZER_MARGIN_MS left, or no answer).
 *
 * scripts/round-time-check.ts and scripts/finished-pings-check.ts prove both.
 */
import { puzzleRunMs, puzzleTimeLimitMs } from "./registry";
import type { DuelPhase, PuzzleData } from "./types";

/** Less than this left on the round's own clock counts as reaching the buzzer. */
export const BUZZER_MARGIN_MS = 1000;

/** The round's own clock, ms: what its timer counts down from. */
export function roundClockMs(puzzle: PuzzleData | undefined): number {
  return puzzleRunMs(puzzle) ?? puzzleTimeLimitMs(puzzle);
}

/** Time left on the round's own clock for a time-left figure measured against the time limit. */
export function clockLeftMs(puzzle: PuzzleData | undefined, msRemaining: number): number {
  return msRemaining - (puzzleTimeLimitMs(puzzle) - roundClockMs(puzzle));
}

/** Whether an answer received in `phase` with `msRemaining` left was finished before the buzzer. */
export function finishedBeforeBuzzer(
  puzzle: PuzzleData | undefined,
  phase: DuelPhase | string,
  msRemaining: number,
): boolean {
  return phase === "puzzle" && Number.isFinite(msRemaining) && clockLeftMs(puzzle, msRemaining) >= BUZZER_MARGIN_MS;
}
