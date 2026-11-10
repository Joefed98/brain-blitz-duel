/**
 * The round engine's window (B6, docs/round-engine/plan.md): when a round started at `startedAt` stops waiting for a
 * draft, starts counting answers as late, and closes. Every mode reads the same figures from roomClose.ts: a room's
 * puzzle phase (from its phase start), an async round (from the player's own stored start) and, later, a rated
 * match's recorded run. Moved here unchanged from asyncRoom.ts (asyncRoundWindow / asyncReceipt), which re-exports
 * them under their old names. Pure; phone and server.
 *
 *   start ── prep ── clock ── roomTimeoutMs ── roomPuzzleCloseMs ── + the reveal's length
 *            (the phone sends its draft)  (late from here: 0 ms left)  (no answer: missed, 0)
 */
import { puzzleRevealMs } from "@/lib/duel/catalogue";
import { roomPuzzleCloseMs, roomTimeoutMs } from "@/lib/duel/roomClose";
import type { PuzzleData } from "@/lib/duel/types";

export interface RoundWindow {
  /** The phone sends its draft from here (ms, same clock as `startedAt`). */
  timeoutAt: number;
  /** Answers from here on are late (graded with 0 ms left). */
  lateFrom: number;
  /** The round takes no answer from here on. */
  closesAt: number;
}

export function roundWindow(puzzle: PuzzleData | undefined, startedAt: number): RoundWindow {
  const lateFrom = startedAt + roomPuzzleCloseMs(puzzle);
  return {
    timeoutAt: startedAt + roomTimeoutMs(puzzle),
    lateFrom,
    closesAt: lateFrom + puzzleRevealMs(puzzle),
  };
}

/** Whether an answer received at `nowMs` is in time, late, or past the round's close. */
export function windowReceipt(
  puzzle: PuzzleData | undefined,
  startedAt: number,
  nowMs: number,
): "puzzle" | "late" | "closed" {
  const window = roundWindow(puzzle, startedAt);
  if (nowMs >= window.closesAt) return "closed";
  return nowMs >= window.lateFrom ? "late" : "puzzle";
}
