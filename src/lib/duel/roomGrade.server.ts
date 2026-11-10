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
import { gradeAnswer } from "./gradeAnswer.server";
import type { SubmitExtra } from "./grade";
import { puzzleTimeLimitMs } from "./catalogue";
import type { PuzzleData } from "./types";
import { receiptMsRemaining, type PhaseReceipt, type RoundReceipt } from "@/lib/round/receipt";
import { trustedClaim, type TrustRule } from "@/lib/round/trust";

/** A room's receipt (the round engine's `phase` receipt, src/lib/round/receipt.ts). */
export type RoomReceipt = PhaseReceipt;

/** The server's own figure for the time left when the answer arrived; undefined with no stamp. */
export function roomReceiptMsRemaining(puzzle: PuzzleData, receipt: RoomReceipt): number | undefined {
  return receiptMsRemaining(puzzle, { mode: "phase", ...receipt });
}

/**
 * The round engine's grade (B6, docs/round-engine/plan.md): the receipt (src/lib/round/receipt.ts) bounds the claim
 * under the mode's trust rule (src/lib/round/trust.ts), then the one grader. Rooms and async rounds grade here through
 * gradeRoomAnswer; practice grades with the same receipt and its own trust rule through generate.server's gradeAnswer
 * (practice.functions.ts).
 */
export function gradeRound(
  puzzle: PuzzleData,
  receipt: RoundReceipt,
  answer: string,
  msRemaining: number,
  extra?: SubmitExtra,
  rule: TrustRule = "room",
) {
  const limitMs = puzzleTimeLimitMs(puzzle);
  const received = receiptMsRemaining(puzzle, receipt);
  // The player's own measurement stands unless it is impossible for the clock.
  const { ms, clamped } = trustedClaim(puzzle, msRemaining, received, rule);
  // msLeft: the time left the grade used (display and pings only: buzzer.ts).
  return { graded: gradeAnswer(puzzle, answer, ms, extra, received), clamped, serverMs: received ?? limitMs, msLeft: ms };
}

export function gradeRoomAnswer(
  puzzle: PuzzleData,
  receipt: RoomReceipt,
  answer: string,
  msRemaining: number,
  extra?: SubmitExtra,
) {
  return gradeRound(puzzle, { mode: "phase", phase: receipt.phase, phaseStartedAt: receipt.phaseStartedAt, nowMs: receipt.nowMs }, answer, msRemaining, extra);
}
