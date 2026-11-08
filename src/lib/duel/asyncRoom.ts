/**
 * Async rooms (21 Oct 2026): rounds dealt once on the server and stored, played by each player at
 * their own time on their own clock (the daily challenge now; friend challenges later). Shared by
 * the phone and the server, pure: the caller passes "now".
 *
 * A player's round starts when the server stores its start (startAsyncRound): that stamp is the
 * round's own puzzle phase, exactly as a room's phase_started_at is for everyone in a room, so the
 * same timings apply from it (roomClose.ts):
 *
 *   start ── prep ── clock ── roomTimeoutMs ── roomPuzzleCloseMs ── + the reveal's length
 *            (the phone sends its draft)  (late from here: 0 ms left)  (no answer: missed, 0)
 *
 * An answer received before roomPuzzleCloseMs is graded as a room's puzzle-phase answer; after it,
 * as a room's reveal-phase (late) answer, with 0 ms left; once the room's reveal would have ended
 * the round takes no answer and scores 0 ("missed"), as a player with no answer in a room does.
 */
import { puzzleRevealMs } from "./catalogue";
import { roomPuzzleCloseMs, roomTimeoutMs } from "./roomClose";
import type { PuzzleData } from "./types";

export interface AsyncRoundWindow {
  /** The phone sends its draft from here (ms, same clock as `startedAt`). */
  timeoutAt: number;
  /** Answers from here on are late (graded with 0 ms left). */
  lateFrom: number;
  /** The round takes no answer from here on. */
  closesAt: number;
}

export function asyncRoundWindow(
  puzzle: PuzzleData | undefined,
  startedAt: number,
): AsyncRoundWindow {
  const lateFrom = startedAt + roomPuzzleCloseMs(puzzle);
  return {
    timeoutAt: startedAt + roomTimeoutMs(puzzle),
    lateFrom,
    closesAt: lateFrom + puzzleRevealMs(puzzle),
  };
}

/** Whether an answer received at `nowMs` is in time, late, or past the round's close. */
export function asyncReceipt(
  puzzle: PuzzleData | undefined,
  startedAt: number,
  nowMs: number,
): "puzzle" | "late" | "closed" {
  const window = asyncRoundWindow(puzzle, startedAt);
  if (nowMs >= window.closesAt) return "closed";
  return nowMs >= window.lateFrom ? "late" : "puzzle";
}

/** One round as its player sees it (never another player's). */
export interface AsyncRoundView {
  round: number;
  type: string;
  /** Server ms the round started, or null before it has. */
  startedAt: number | null;
  /** The stored score once graded (or 0 when missed); null before. */
  score: number | null;
  missed: boolean;
}

export interface AsyncAttemptView {
  roomId: string;
  attemptId: string;
  roundCount: number;
  rounds: AsyncRoundView[];
  finished: boolean;
  total: number;
  /** When the room stops starting rounds (server ms). */
  closesAt: number;
}

/** The round a player is on: the first with no stored score, or null when every round is done. */
export function currentAsyncRound(view: Pick<AsyncAttemptView, "rounds">): AsyncRoundView | null {
  return view.rounds.find((round) => round.score === null) ?? null;
}

/* ------------------------------------------------- the locked solution (H2) ---- */

/**
 * Security fix H2 (Nov 2026 audit): a daily's or a challenge's solutions stay on the server until the room's window
 * closes (the daily at UK midnight, a challenge at its window's end), so a throwaway attempt can't collect them for
 * another. Until then a round's reveal carries the public half only, with this lock; the player still gets their own
 * score, answer and result at once. Arcade rounds and the other games with nothing private are never locked.
 */
export interface SolutionLock {
  kind: "daily" | "challenge";
  /** The room's close (ISO): when the solution opens. */
  unlocksAt: string;
}

/** Which room a lock belongs to, from the room's kind (`daily_puzzle`, `daily_arcade`, `challenge`). */
export function solutionLockKind(roomKind: string): SolutionLock["kind"] {
  return roomKind === "challenge" ? "challenge" : "daily";
}

/** The line the reveal shows in place of the solution. */
export function solutionLockText(lock: SolutionLock): string {
  return lock.kind === "challenge" ? "Solution unlocks when the challenge closes" : "Solution unlocks at midnight";
}
