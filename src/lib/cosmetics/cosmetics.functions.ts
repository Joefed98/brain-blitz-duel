/**
 * The equipped cosmetics others see (wave 2 E2): getPublicCosmeticsFn({ playerIds }) answers each player's finish,
 * accessory, special edition, win celebration, podium entrance, reactions and PLUS chip (guests: none). Read-only,
 * limited as A1's public card is.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { listOf, record, text } from "@/lib/validate";

const ID_LIST_MAX = 200;

import type { PublicCosmetics } from "./types";

export const getPublicCosmeticsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Type and size only (Security C2): the handler keeps the first 100 and asks only for real public ids (Security C1b).
  .inputValidator((input: { playerIds: string[] }) => ({
    playerIds: listOf(record(input)["playerIds"], ID_LIST_MAX, (v, field) => text(v, 64, field), "playerIds"),
  }))
  .handler(async ({ data, context }): Promise<PublicCosmetics[]> => {
    const { adminDb } = await import("@/lib/data/db.server");
    const client = await adminDb();
    const { PUBLIC_CARD_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, PUBLIC_CARD_LIMIT))) return [];
    const { publicCosmeticsFor } = await import("./cosmetics.server");
    try {
      // Players are asked for by public id (Security C1b: a phone holds no account ids); an account id names nobody.
      // Each answer carries the public id it was asked for.
      const { readUsersOfPublicIds } = await import("@/lib/data/players.server");
      const asked = (Array.isArray(data?.playerIds) ? data.playerIds : []).filter((id): id is string => typeof id === "string").slice(0, 100);
      const { data: owners } = await readUsersOfPublicIds(client, asked);
      const publicOf = new Map((owners ?? []).map((o) => [o.user_id, o.public_id]));
      const rows = await publicCosmeticsFor(client, [...publicOf.keys()]);
      return rows.flatMap((r) => {
        const playerId = publicOf.get(r.userId);
        return playerId ? [{ ...r, userId: playerId }] : [];
      });
    } catch {
      // Before the migration, or a failed read: nobody's cosmetics show (every screen exactly as before).
      return [];
    }
  });
