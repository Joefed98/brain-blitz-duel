/**
 * Coins and items: the server functions the screens call (wave 2 A1; docs/economy/README.md, "Interface"). A thin
 * shell over economy.server.ts on the service-role client. None of them credits, spends or grants anything: the
 * phone can read its own wallet, inventory and loadout, equip what it owns and change its avatar, nothing more.
 *
 *   getCatalogue()                              every item (the same for everyone; no sign-in needed)
 *   getMyWallet()                               balance, consumables and the latest coin lines; a guest gets none
 *   getMyInventory()                            owned items with their catalogue fields
 *   getMyLoadout()                              the equipped look (null for a guest)
 *   equip({ data: { slot, itemId } })          itemId null empties the slot; the new loadout or a refusal
 *   getAvatarOptions()                          every avatar's accent, feature, accessory and background options
 *   setAvatar({ data: { avatarId, colour, accent, feature, accessory, background, gem } })   options null: default
 *   getPublicCard({ data: { playerId } })       any player's card (a guest: the default card)
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { nullable, num, optional, record, text } from "@/lib/validate";

/*
 * Input checks (Security C2, 14 Nov 2026; src/lib/validate.ts): type and size only. economy.server.ts still judges
 * every slot, item, avatar, colour, choice and id (a bad one gets its own refusal, a bad card id null).
 */
const WORD_MAX = 96;
import type {
  AvatarOptions,
  CatalogueItem,
  InventoryItem,
  Loadout,
  LoadoutResult,
  PublicCard,
  Wallet,
} from "@/lib/data/economy";

async function setup(userId: string, limit: "economy" | "card") {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const { ECONOMY_LIMIT, PUBLIC_CARD_LIMIT, withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  const allowed = await withinRateLimit(client, userId, limit === "economy" ? ECONOMY_LIMIT : PUBLIC_CARD_LIMIT);
  return { client, allowed, economy: await import("./economy.server") };
}

/** Every catalogue item, in the catalogue's order. Cacheable: the same for everyone. */
export const getCatalogue = createServerFn({ method: "GET" }).handler(async (): Promise<CatalogueItem[]> => {
  const { adminDb } = await import("@/lib/data/db.server");
  const { catalogue } = await import("./economy.server");
  return catalogue(await adminDb());
});

/** Every avatar's builder options (the same for everyone; no sign-in needed). */
export const getAvatarOptions = createServerFn({ method: "GET" }).handler(async (): Promise<AvatarOptions> => {
  const { adminDb } = await import("@/lib/data/db.server");
  const { avatarOptions } = await import("./economy.server");
  return avatarOptions(await adminDb());
});

/** The signed-in account's coins and consumables; a guest gets none. */
export const getMyWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Wallet | { busy: true }> => {
    const { client, allowed, economy } = await setup(context.userId, "economy");
    if (!allowed) return { busy: true };
    return economy.walletFor(client, context.userId);
  });

/** What the signed-in account owns (a guest: nothing). */
export const getMyInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InventoryItem[] | { busy: true }> => {
    const { client, allowed, economy } = await setup(context.userId, "economy");
    if (!allowed) return { busy: true };
    return economy.inventoryFor(client, context.userId);
  });

/** The signed-in account's look (null for a guest). */
export const getMyLoadout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Loadout | null | { busy: true }> => {
    const { client, allowed, economy } = await setup(context.userId, "economy");
    if (!allowed) return { busy: true };
    return economy.loadoutFor(client, context.userId);
  });

/** Equips an owned item in a slot (src/lib/economy/slots.ts LOADOUT_SLOTS), or with itemId null returns it to its default. */
export const equip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slot: string; itemId: string | null }) => {
    const body = record(input);
    return {
      slot: text(body["slot"], WORD_MAX, "slot"),
      itemId: optional(body["itemId"], (v) => nullable(v, (id) => text(id, WORD_MAX, "itemId"))),
    };
  })
  .handler(async ({ data, context }): Promise<LoadoutResult> => {
    const { client, allowed, economy } = await setup(context.userId, "economy");
    if (!allowed) return economy.refusal("busy");
    return economy.equipItem(client, context.userId, data?.slot, data?.itemId ?? null);
  });

/**
 * Sets the avatar (one of the 32 game avatars), its main colour (one of the 32), its accent, feature, accessory and
 * background (null or left out: the avatar's default; otherwise one of that avatar's options) and the gem (null, or an
 * unlocked one).
 */
export const setAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      avatarId: string;
      colour: number;
      accent?: string | null;
      feature?: string | null;
      accessory?: string | null;
      background?: string | null;
      gem: string | null;
    }) => {
      const body = record(input);
      const choice = (field: string) => optional(body[field], (v) => nullable(v, (c) => text(c, WORD_MAX, field)));
      return {
        avatarId: text(body["avatarId"], WORD_MAX, "avatarId"),
        colour: num(body["colour"], "colour"),
        accent: choice("accent"),
        feature: choice("feature"),
        accessory: choice("accessory"),
        background: choice("background"),
        gem: choice("gem"),
      };
    },
  )
  .handler(async ({ data, context }): Promise<LoadoutResult> => {
    const { client, allowed, economy } = await setup(context.userId, "economy");
    if (!allowed) return economy.refusal("busy");
    return economy.setAvatar(client, context.userId, data ?? {});
  });

/** Any player's public card by public id, read-only. A guest (or an id naming nobody) gets the default card; a bad id null. */
export const getPublicCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playerId: string }) => ({ playerId: text(record(input)["playerId"], WORD_MAX, "playerId") }))
  .handler(async ({ data, context }): Promise<PublicCard | null | { busy: true }> => {
    const { client, allowed, economy } = await setup(context.userId, "card");
    if (!allowed) return { busy: true };
    // Security C3: `playerId` is a public id; one that names nobody (an account id among them) reads as an unknown
    // player's default card. The answer names the player by the public id it was asked for.
    const asked = data?.playerId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(asked ?? "")) return null;
    const { accountOf } = await import("@/lib/identity/publicIds.server");
    const card = await economy.publicCardFor(client, (await accountOf(client, asked)) ?? "00000000-0000-0000-0000-000000000000");
    return card ? { ...card, playerId: asked } : null;
  });
