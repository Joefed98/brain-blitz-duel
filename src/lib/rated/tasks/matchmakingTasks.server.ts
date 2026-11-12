/**
 * Matchmaking's Cron Trigger (wave 3, W3b): the 15-day purge of mm_practice_deals (Practice plays' deals kept as
 * recorded-run fallbacks), run by the Worker itself so it happens whether or not the database has pg_cron (the
 * migration also schedules it there where it can; the purge is idempotent, so both running is harmless). A nitro
 * scheduled task as W3a's standings and B2's push tasks are: vite.config.ts MATCHMAKING_TASKS writes the schedule into
 * the generated wrangler.json's triggers.crons. UTC, kept in step with MATCHMAKING_CRONS (rated-matchmaking-check).
 */
import { adminDb } from "@/lib/data/db.server";

/** Daily at 04:37 UTC (a minute no other task uses). */
export const MATCHMAKING_CRONS = { "rated:practice-deals-purge": "37 4 * * *" } as const;

export async function runPracticeDealsPurge(): Promise<{ result: { removed: number | null } }> {
  const { purgePracticeDeals } = await import("@/lib/data/rated.server");
  const { data, error } = await purgePracticeDeals(await adminDb());
  if (error) console.error(`[rated] practice deals purge failed: ${error.message}`);
  else console.log(`[rated] practice deals purge: ${data} removed`);
  return { result: { removed: error ? null : data } };
}
