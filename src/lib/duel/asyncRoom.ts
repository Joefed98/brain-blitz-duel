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
import type { RoundWindow } from "@/lib/round/window";

/** The round engine's window (src/lib/round/window.ts), under the async room's names. */
export type AsyncRoundWindow = RoundWindow;
export { roundWindow as asyncRoundWindow, windowReceipt as asyncReceipt } from "@/lib/round/window";

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

/* ------------------------------------------------------- the locked solution ---- */

/**
 * A daily's or a challenge's solutions stay on the server until the room's window closes (the daily at UK midnight, a
 * challenge at its window's end), the same for every player. Until then a round's reveal carries the public half only,
 * with this lock; the player still gets their own score, answer and result at once. Arcade rounds and the other games
 * with nothing private are never locked.
 */
export interface SolutionLock {
  kind: "daily" | "challenge";
  /** The room's close (ISO): when the solution opens. */
  unlocksAt: string;
}

/**
 * The Daily archive (wave 2 E2, Joulz Plus; src/lib/plus/archive.server.ts): a past Daily replayed in an async room of
 * its own, unrated. Never on a board, never in the streak, never a badge, never Joules; its day closed long ago, so
 * its solutions are never locked.
 */
export const DAILY_ARCHIVE_KIND = "daily_archive";
export function isArchiveKind(roomKind: string): boolean {
  return roomKind === DAILY_ARCHIVE_KIND;
}

/** Which room a lock belongs to, from the room's kind (`daily_puzzle`, `daily_arcade`, `challenge`). */
export function solutionLockKind(roomKind: string): SolutionLock["kind"] {
  return roomKind === "challenge" ? "challenge" : "daily";
}

/** The line the reveal shows in place of the solution. */
export function solutionLockText(lock: SolutionLock): string {
  return lock.kind === "challenge" ? "Solution unlocks when the challenge closes" : "Solution unlocks at midnight";
}
