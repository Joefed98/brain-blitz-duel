/**
 * The shop's server functions (wave 2, session D1; docs/economy/shop.md). A thin shell over shop.server.ts on the
 * service-role client, rate limited per user (SHOP_LIMIT, fail closed). Every one refuses an account that isn't a
 * tester while the shop is closed to everyone (shop.server.ts `shopAccess`); test purchases are testers only, always.
 *
 *   getShopFn({ data: { section } })               the whole shop for this account (records shop_viewed)
 *   shopStatusFn()                                  open or not, and wishlisted items back today (notice and tab dot)
 *   buyItemFn({ data: { itemId, requestId } })     one item on sale today, once per request id
 *   buyBundleFn({ data: { requestId } })           this week's bundle, all or nothing, once per request id
 *   testPackFn({ data: { pack, requestId } })      a tester's coin pack with no payment (18+)
 *   wishlistFn({ data: { itemId, on } })           the heart
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bool, optional, record, text } from "@/lib/validate";

/*
 * Input checks (Security C2, 14 Nov 2026; src/lib/validate.ts): type and size only. shop.server.ts still judges each
 * section, item, pack and request id (an unknown or short one gets its own answer).
 */
const WORD_MAX = 96;
import type { RateLimit } from "@/lib/duel/rateLimit.server";

import type { BuyResult, ShopClosed, ShopStatus, ShopView } from "./types";

/** Shop calls per account: reads and purchases together. */
export const SHOP_LIMIT: RateLimit = { bucket: "shop", max: 120, windowSeconds: 600, failClosed: true };

async function setup(userId: string) {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const { withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  const allowed = await withinRateLimit(client, userId, SHOP_LIMIT);
  return { client, allowed, shop: await import("./shop.server") };
}

const BUSY: BuyResult = { ok: false, reason: "busy", message: "That’s a lot of taps. Give it a minute." };

export const getShopFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Nothing sent is an empty input (the whole shop).
  .inputValidator((input: { section?: string } | undefined) =>
    input === undefined ? {} : { section: optional(record(input)["section"], (v) => text(v, WORD_MAX, "section")) },
  )
  .handler(async ({ data, context }): Promise<ShopView | ShopClosed> => {
    const { client, allowed, shop } = await setup(context.userId);
    if (!allowed) return { open: false, reason: "busy" };
    return shop.shopViewFor(client, context.userId, Date.now(), typeof data?.section === "string" ? data.section : undefined);
  });

export const shopStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ShopStatus> => {
    const { client, allowed, shop } = await setup(context.userId);
    if (!allowed) return { open: false, tester: false, back: [], day: null };
    return shop.shopStatusFor(client, context.userId, Date.now());
  });

export const buyItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; requestId: string }) => {
    const body = record(input);
    return { itemId: text(body["itemId"], WORD_MAX, "itemId"), requestId: text(body["requestId"], WORD_MAX, "requestId") };
  })
  .handler(async ({ data, context }): Promise<BuyResult> => {
    const { client, allowed, shop } = await setup(context.userId);
    if (!allowed) return BUSY;
    return shop.buyItem(client, context.userId, data?.itemId, data?.requestId, Date.now());
  });

export const buyBundleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string }) => ({ requestId: text(record(input)["requestId"], WORD_MAX, "requestId") }))
  .handler(async ({ data, context }): Promise<BuyResult> => {
    const { client, allowed, shop } = await setup(context.userId);
    if (!allowed) return BUSY;
    return shop.buyBundle(client, context.userId, data?.requestId, Date.now());
  });

export const testPackFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pack: string; requestId: string }) => {
    const body = record(input);
    return { pack: text(body["pack"], WORD_MAX, "pack"), requestId: text(body["requestId"], WORD_MAX, "requestId") };
  })
  .handler(async ({ data, context }): Promise<BuyResult> => {
    const { client, allowed, shop } = await setup(context.userId);
    if (!allowed) return BUSY;
    return shop.buyTestPack(client, context.userId, data?.pack, data?.requestId, Date.now());
  });

export const wishlistFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; on: boolean }) => {
    const body = record(input);
    return { itemId: text(body["itemId"], WORD_MAX, "itemId"), on: bool(body["on"], "on") };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; wished: boolean }> => {
    const { client, allowed, shop } = await setup(context.userId);
    if (!allowed) return { ok: false, wished: false };
    return shop.setWish(client, context.userId, data?.itemId, data?.on);
  });
