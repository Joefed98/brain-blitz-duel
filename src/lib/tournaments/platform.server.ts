/**
 * What the Category Cup and the Joulz Championship take from other sessions (wave 4, W4c; docs/tournaments/events.md
 * "Wiring"), in one place:
 *
 * - `scoreAttackTop`: the month's Score Attack standings, best first, from W4b's stored daily results
 *   (`tournament_results` of the month's finished Score Attacks; `monthStandings` in eventRules.ts).
 * - `awardJoules`: D2's Joules for finishing (`creditTournamentJoules`, kind `finished`: 150, once per event and account).
 *
 * Reminders are W4b's: every entry (a qualifier's too) is reminded by W4b's tick through B2's notification.
 *
 * Checks stand in with `setTournamentPlatform` (server code only, no phone reaches it); it does nothing in a
 * production build (`import.meta.env.PROD`).
 */
import type { Db } from "@/lib/data/db.server";

import { monthStandings } from "./eventRules";

export interface TournamentPlatform {
  /** The month's ("YYYY-MM") top `limit` Score Attack players, best first (account ids). */
  scoreAttackTop(client: Db, month: string, limit: number): Promise<string[]>;
  /** Joules for finishing the event, once per account and event. */
  awardJoules(client: Db, input: { userId: string; eventId: string; atMs: number }): Promise<void>;
}

const WIRED: TournamentPlatform = {
  async scoreAttackTop(client, month, limit) {
    const { readMonthScoreAttackResults } = await import("@/lib/data/tournamentEvents.server");
    const { data } = await readMonthScoreAttackResults(client, month);
    return monthStandings(data).slice(0, limit);
  },
  async awardJoules(client, input) {
    const { creditTournamentJoules } = await import("@/lib/pass/pass.server");
    await creditTournamentJoules(client, { userId: input.userId, eventId: input.eventId, kind: "finished", atMs: input.atMs });
  },
};

let current: TournamentPlatform = WIRED;

export function tournamentPlatform(): TournamentPlatform {
  return current;
}

/** Checks stand in for a part (null: back to the wired platform). Does nothing in a production build. */
export function setTournamentPlatform(next: Partial<TournamentPlatform> | null): void {
  if (import.meta.env.PROD) return;
  current = next ? { ...WIRED, ...next } : WIRED;
}
