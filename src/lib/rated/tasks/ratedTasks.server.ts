/**
 * Rated play's Cron Trigger (wave 3, session W3a; docs/rated/README.md "The standings job"). The schedule is UTC, as
 * nitro writes it into the generated wrangler.json's triggers.crons (vite.config.ts, RATED_TASKS); ratings-check
 * compares the two.
 */
import { adminDb } from "@/lib/data/db.server";
import { flushAnalytics } from "@/lib/data/events.server";

import { runStandingsAndBadges } from "../rewards.server";

/** Hourly at :23 (a minute no other task uses). */
export const RATED_CRONS = { "rated:standings": "23 * * * *" } as const;

export async function runStandingsTask(): Promise<{ result: unknown }> {
  const result = await runStandingsAndBadges(await adminDb());
  await flushAnalytics();
  console.log(`[rated] standings: ${result.ratedPlayers} rated players, caps ${result.capsActive ? "on" : "off"}, ${result.changed.length} tiers changed`);
  return { result: { ratedPlayers: result.ratedPlayers, capsActive: result.capsActive, changed: result.changed.length } };
}
