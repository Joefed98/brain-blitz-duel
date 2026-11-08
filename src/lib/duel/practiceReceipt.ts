/**
 * Practice's receipt bound (7 Nov 2026, scoring audit issue 16e): the phone's time claim in practice is held to the
 * server's own receipt, as rooms' is (roomGrade.server.ts, trustedMsRemaining with its 1.5 s network allowance).
 *
 * Rooms know when the round started (the puzzle phase's stamp). Practice has no room, so the server keeps its own
 * figures in the deal's sealed half and a sealed start token:
 *
 *  - `dealtAt`: the server's time when it sealed the deal (practiceGenerateFn);
 *  - `startAt`: the server's time when the phone said the round's clock started (practiceStartFn), sent back with the
 *    answer. It is held to `dealtAt + INTRO_MS + PRACTICE_START_SLACK_MS` at the latest: the intro starts the round by
 *    itself after INTRO_MS, so a start asked for much later (to shrink the time the server sees as used) counts from
 *    that latest honest start instead.
 *  - With no start token (a phone on an older build, or the start call lost), the round counts from
 *    `dealtAt + INTRO_MS`, the moment the intro starts it by itself: an honest run that waited for the intro passes
 *    within the allowance, and one that tapped Ready earlier claims less time left than that, so it is never cut.
 *    That is the bound a modified phone faces (it can leave the token out): it can claim no more time than a round
 *    started when the intro ended would have left.
 *  - A deal sealed before this (no `dealtAt`) keeps the old rule: the claim held to the round's length only.
 *
 * The time left the server allows is then `limit − (receipt − start − prep)`, exactly the room's formula, and the
 * same honest run grades the same in practice and in a room. Queued offline runs (practiceGradeQueuedFn: pack deals, and
 * live deals whose answer could not be sent) reach the server long after they were played, so they keep the length
 * clamp: offline play is timed by the phone alone (docs/offline-practice.md).
 */
import { trustedMsRemaining } from "./grade";
import { puzzlePrepMs, puzzleTimeLimitMs } from "./catalogue";
import { INTRO_MS, type PuzzleData } from "./types";

/**
 * How long after the intro's own start a start token is still taken at face value (the deal's download and the
 * intro's first paint). A phone can always leave the token out, so the bound without one (`dealtAt + INTRO_MS`) is
 * the real limit; the token only spares an honest run on a slow connection, and this slack is all it can add.
 */
export const PRACTICE_START_SLACK_MS = 5_000;

export interface PracticeReceipt {
  /** Server ms when the deal was sealed; undefined for a deal sealed before the bound. */
  dealtAt?: number | undefined;
  /** Server ms from a valid start token for this deal; undefined with none. */
  startAt?: number | undefined;
  /** Server ms when the answer arrived. */
  nowMs: number;
}

/** The server's start for the round's clock (before prep), or undefined when the deal carries no `dealtAt`. */
export function practiceStartMs(receipt: PracticeReceipt): number | undefined {
  const { dealtAt, startAt } = receipt;
  if (dealtAt === undefined || !Number.isFinite(dealtAt)) return undefined;
  const latest = dealtAt + INTRO_MS + PRACTICE_START_SLACK_MS;
  if (startAt !== undefined && Number.isFinite(startAt) && startAt >= dealtAt) return Math.min(startAt, latest);
  return dealtAt + INTRO_MS;
}

/** The server's own time left when the answer arrived (the room's receiptMsRemaining), or undefined with no bound. */
export function practiceReceiptMsRemaining(puzzle: PuzzleData, receipt: PracticeReceipt): number | undefined {
  const start = practiceStartMs(receipt);
  if (start === undefined) return undefined;
  return puzzleTimeLimitMs(puzzle) - (receipt.nowMs - start - puzzlePrepMs(puzzle));
}

/**
 * The time left practice grades with: the claim held to the receipt as in a room (trustedMsRemaining, the same
 * allowance) when the deal carries the server's figures, else the claim as it is (gradeAnswer holds it to the round's
 * length, as before). `received` is passed on to gradeAnswer, which holds tap and action logs to it as a room's are.
 */
export function practiceTrustedMs(puzzle: PuzzleData, claimedMs: number, received: number | undefined): { ms: number; clamped: boolean; received: number | undefined } {
  if (received === undefined) return { ms: claimedMs, clamped: false, received: undefined };
  const { ms, clamped } = trustedMsRemaining(claimedMs, received, puzzleTimeLimitMs(puzzle));
  return { ms, clamped, received };
}
