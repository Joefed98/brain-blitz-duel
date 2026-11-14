/**
 * The equipped cosmetics others see (wave 2 E2): getPublicCosmeticsFn({ userIds }) answers each account's finish,
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
  // Type and size only (Security C2): publicCosmeticsFor keeps the first 100 real ids and drops the rest.
  .inputValidator((input: { userIds: string[] }) => ({
    userIds: listOf(record(input)["userIds"], ID_LIST_MAX, (v, field) => text(v, 64, field), "userIds"),
  }))
  .handler(async ({ data, context }): Promise<PublicCosmetics[]> => {
    const { adminDb } = await import("@/lib/data/db.server");
    const client = await adminDb();
    const { PUBLIC_CARD_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, PUBLIC_CARD_LIMIT))) return [];
    const { publicCosmeticsFor } = await import("./cosmetics.server");
    try {
      return await publicCosmeticsFor(client, Array.isArray(data?.userIds) ? data.userIds : []);
    } catch {
      // Before the migration, or a failed read: nobody's cosmetics show (every screen exactly as before).
      return [];
    }
  });
