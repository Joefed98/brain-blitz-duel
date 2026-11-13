/**
 * Seasons: the server functions the phone calls (wave 4, session W4d; docs/seasons/README.md). Read only, apart from
 * marking the reward notice seen. Nothing here can end a season, reset a rating or grant a reward: those are Joe's
 * database functions (pass.close_season, pass.close_test_season), which no API role can run.
 *
 *   getMySeasonsFn()                         MySeasons: the season now (peak so far) and the season history
 *   seasonRewardSeenFn({ data: { season } }) the reward notice shown
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { MySeasons } from "./types";

async function setup(userId: string) {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const { ECONOMY_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  const allowed = await withinRateLimit(client, userId, ECONOMY_LIMIT);
  return { client, allowed, seasons: await import("./seasons.server") };
}

export const getMySeasonsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MySeasons | { busy: true }> => {
    const { client, allowed, seasons } = await setup(context.userId);
    if (!allowed) return { busy: true };
    return seasons.mySeasons(client, context.userId);
  });

export const seasonRewardSeenFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { season: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { client, allowed, seasons } = await setup(context.userId);
    if (!allowed) return { ok: false };
    return seasons.seasonRewardSeen(client, context.userId, data?.season);
  });
