/**
 * You's "Rated wins" gauge (P3, 22 Nov 2026; Joe: from the server's rated match history, read only). The signed-in
 * player's counted live rated matches and the wins among them (rated_win_count). Nothing is sent but the session.
 *
 *   ratedWinCountFn()  { played, wins } | null (no session answer, or the read failed)
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface RatedWinCountAnswer {
  played: number;
  wins: number;
}

export const ratedWinCountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RatedWinCountAnswer | null> => {
    const { adminDb } = await import("@/lib/data/db.server");
    const client = await adminDb();
    const { RATINGS_READ_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, RATINGS_READ_LIMIT))) return null;
    const { readRatedWinCount } = await import("@/lib/data/ratings.server");
    const { data, error } = await readRatedWinCount(client, context.userId);
    if (error || !data) return null;
    return { played: data.played, wins: data.wins };
  });
