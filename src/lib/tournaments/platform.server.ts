/**
 * What the two big events need from sessions not merged yet (wave 4, W4c; docs/tournaments/events.md "Adapters"):
 * the one place the Category Cup and the Joulz Championship call them, so wiring each in is one change here.
 *
 * - `scoreAttackTop`: W4b's monthly Score Attack standings (docs/tournaments/interface.md, W4b's contract): the
 *   month's best players, best first, as account ids. Until W4b is merged in nobody qualifies, so a Championship
 *   started now is cancelled (no_qualifiers) and pays nothing.
 * - `awardJoules`: D2's Joules (the Season pass): 150 for finishing an event, once per key. Until D2 is merged in,
 *   nothing is paid; the payout row is still written once, so wiring it in later never pays twice for the same event.
 * - `remind`: one reminder to each entrant 15 minutes before the start (W4b's reminders, B2's phone notifications).
 *   Until then the event notes the reminder as sent and nothing goes out.
 *
 * Checks stand in with `setTournamentPlatform` (server code only; no phone reaches it, and it is ignored in a
 * production build).
 */
import type { Db } from "@/lib/data/db.server";

export interface TournamentPlatform {
  /** The month's ("YYYY-MM") top `limit` Score Attack players as at `asOfMs`, best first (account ids). */
  scoreAttackTop(client: Db, month: string, limit: number, asOfMs: number): Promise<string[]>;
  /** Joules for finishing, once per `key`. */
  awardJoules(client: Db, input: { userId: string; amount: number; key: string }): Promise<void>;
  /** A reminder to each entrant that `eventName` starts at `startsAtMs`. */
  remind(client: Db, input: { userIds: readonly string[]; eventName: string; startsAtMs: number }): Promise<void>;
}

const UNWIRED: TournamentPlatform = {
  async scoreAttackTop() {
    return [];
  },
  async awardJoules() {},
  async remind() {},
};

let current: TournamentPlatform = UNWIRED;

export function tournamentPlatform(): TournamentPlatform {
  return current;
}

/** Checks (and W4b / D2 when wired) set the platform; a production build keeps the wired one. */
export function setTournamentPlatform(next: Partial<TournamentPlatform> | null): void {
  if (import.meta.env.PROD) return;
  current = next ? { ...UNWIRED, ...next } : UNWIRED;
}
