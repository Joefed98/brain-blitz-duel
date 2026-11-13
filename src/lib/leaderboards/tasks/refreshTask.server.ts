/**
 * The leaderboards' Cron Trigger (wave 4, session W4a; docs/leaderboards.md "How boards refresh"): every 5 minutes the
 * Worker runs the same refresh as pg_cron's `leaderboards-refresh` job, so the boards refresh where pg_cron isn't
 * available. Running it twice does no harm: the database function takes an advisory lock (a run that finds it taken does
 * nothing) and each run writes the same boards from the same stored data (a new rating generation replacing the last,
 * the Daily boards not yet final recomputed, final ones left alone). The schedule is UTC, as nitro writes it into the
 * generated wrangler.json's triggers.crons (vite.config.ts, LEADERBOARD_TASKS); leaderboards-check compares the two.
 */
import { adminDb } from "@/lib/data/db.server";
import { refreshBoards } from "@/lib/data/leaderboards.server";

/** Every 5 minutes. */
export const LEADERBOARD_CRONS = { "leaderboards:refresh": "*/5 * * * *" } as const;

export async function runLeaderboardRefreshTask(): Promise<{ result: unknown }> {
  const { data, error } = await refreshBoards(await adminDb());
  if (error) {
    console.warn(`[leaderboards] refresh: ${error.message}`);
    return { result: { ok: false } };
  }
  console.log(`[leaderboards] refresh: ${JSON.stringify(data)}`);
  return { result: { ok: true, refresh: data } };
}
