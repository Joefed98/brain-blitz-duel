/**
 * The room's grading of one answer (submitAnswerFn), kept apart so room-practice-grade-check can
 * run exactly what a room runs against what practice runs (practice.functions.ts). The grader is
 * the same (gradeAnswer); the only room-only input is the server's receipt time, which bounds the
 * phone's time claim and its tap and action logs (trustedMsRemaining, latestTapMs).
 *
 * Fixed 18 Oct 2026: the receipt time was measured from `phase_started_at` in every phase, but the
 * reveal phase rewrites that stamp, so an answer that reached the server just after the room left
 * the puzzle phase (a time-out sent at the buzzer on a slow uplink) was read as received about 1.5 s
 * into the round: every later tap or action was dropped and Flash, Bang On, Ascend and Lightbender
 * scored 0 or close to it where practice gave the same play its points. An answer received in the
 * reveal phase arrived after the clock: 0 ms left. No game's scoring changes.
 */
import { gradeAnswer } from "./generate.server";
import { trustedMsRemaining, type SubmitExtra } from "./grade";
import { puzzlePrepMs, puzzleTimeLimitMs } from "./registry";
import type { DuelPhase, PuzzleData } from "./types";

export interface RoomReceipt {
  /** The room's phase when the answer arrived ("puzzle", or "reveal" for a late one). */
  phase: DuelPhase;
  /** The room's phase_started_at (round_started_at when missing). */
  phaseStartedAt: string | null;
  /** Server time the answer arrived (ms). */
  nowMs: number;
}

/** The server's own figure for the time left when the answer arrived; undefined with no stamp. */
export function roomReceiptMsRemaining(puzzle: PuzzleData, receipt: RoomReceipt): number | undefined {
  const limitMs = puzzleTimeLimitMs(puzzle);
  if (receipt.phase !== "puzzle") return 0;
  const startedAt = Date.parse(receipt.phaseStartedAt ?? "");
  if (!Number.isFinite(startedAt)) return undefined;
  return limitMs - (receipt.nowMs - startedAt - puzzlePrepMs(puzzle));
}

export function gradeRoomAnswer(
  puzzle: PuzzleData,
  receipt: RoomReceipt,
  answer: string,
  msRemaining: number,
  extra?: SubmitExtra,
) {
  const limitMs = puzzleTimeLimitMs(puzzle);
  const received = roomReceiptMsRemaining(puzzle, receipt);
  // The player's own measurement stands unless it is impossible for the clock.
  const { ms, clamped } = trustedMsRemaining(msRemaining, received ?? limitMs, limitMs);
  return { graded: gradeAnswer(puzzle, answer, ms, extra, received), clamped, serverMs: received ?? limitMs };
}
