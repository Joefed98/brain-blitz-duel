/**
 * Ratings: the server functions the phone calls (wave 3, session W3a; docs/rated/ratings-interface.md). Reads only:
 * every rating, placement and tier is worked out on the server; the phone sends nothing that moves one.
 *
 *   getMyRatingsFn()                       the signed-in device's PlayerRatings (hidden in placement)
 *   getRatingsForFn({ data: { playerId }}) another player's PlayerRatings (the same hiding)
 *   placementStatusFn()                    { played, of: 5, done, label: "Placement 1 of 5" }
 *   getTierLadderFn()                      the ladder with each tier's share of rated players
 *
 * Recording a match is deliberately not here (src/lib/rated/ratings.server.ts): only the match engine on the server
 * records one.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlacementStatus, PlayerRatings, TierLadderRung } from "@/lib/data/ratings";

async function setup(userId: string) {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const { RATINGS_READ_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  const allowed = await withinRateLimit(client, userId, RATINGS_READ_LIMIT);
  return { client, allowed, ratings: await import("./ratings.server") };
}

export const getMyRatingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlayerRatings | { busy: true }> => {
    const { client, allowed, ratings } = await setup(context.userId);
    if (!allowed) return { busy: true };
    return ratings.getMyRatings(client, context.userId);
  });

export const getRatingsForFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playerId?: unknown }) => ({ playerId: input?.playerId }))
  .handler(async ({ context, data }): Promise<PlayerRatings | null | { busy: true }> => {
    const { client, allowed, ratings } = await setup(context.userId);
    if (!allowed) return { busy: true };
    return ratings.getRatingsFor(client, data.playerId);
  });

export const placementStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlacementStatus | { busy: true }> => {
    const { client, allowed, ratings } = await setup(context.userId);
    if (!allowed) return { busy: true };
    return ratings.placementStatus(client, context.userId);
  });

export const getTierLadderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TierLadderRung[] | { busy: true }> => {
    const { client, allowed, ratings } = await setup(context.userId);
    if (!allowed) return { busy: true };
    return ratings.getTierLadder(client);
  });
