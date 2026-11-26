/**
 * Home's player banner: "+22 this week" (P1, 21 Nov 2026; Joe: from the server's rated match history, so it is the
 * same on every device). The signed-in player's Joulz Rating change over the rated matches they finished since Monday
 * 00:00 UK time (rated_week_change: each stored match's before and after). Read only; nothing is sent but the session.
 *
 *   ratedWeekChangeFn()  { week: "2026-11-16", matches, change } | null (no session answer, or the read failed)
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface RatedWeekChangeAnswer {
  /** Monday's UK day key: the week the change is for. */
  week: string;
  matches: number;
  /** Rounded to whole points. */
  change: number;
}

export const ratedWeekChangeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RatedWeekChangeAnswer | null> => {
    const { adminDb } = await import("@/lib/data/db.server");
    const client = await adminDb();
    const { RATINGS_READ_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, RATINGS_READ_LIMIT))) return null;
    const { ukDay, ukMidnight } = await import("@/lib/pass/ukDays");
    const { weekStartOf } = await import("@/lib/pass/weekly");
    const week = weekStartOf(ukDay(Date.now()));
    const { readRatedWeekChange } = await import("@/lib/data/ratings.server");
    const { data, error } = await readRatedWeekChange(client, context.userId, new Date(ukMidnight(week)).toISOString());
    if (error || !data) return null;
    return { week, matches: data.matches, change: Math.round(data.change) };
  });
