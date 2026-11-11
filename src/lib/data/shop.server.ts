/**
 * The shop's data (wave 2, session D1; docs/economy/shop.md; supabase/migrations/20261111120000_shop.sql): the
 * recorded days and weeks, the wishlist, testers, and the shop's own database functions (a bundle's purchase, a
 * tester's test pack). Server only; each function issues exactly one call. A single item is bought through A1's
 * economy_purchase_item (economy.server.ts).
 */

import type { Database } from "@/integrations/supabase/types";

import { asJson, type Db, type Tables } from "./db.server";
import type { Result } from "./rooms.server";

export type ShopDayRow = Tables<"shop_days">;
export type ShopWeekRow = Tables<"shop_weeks">;

export interface BundleOutcome {
  status: "purchased" | "duplicate" | "owned" | "insufficient" | "not_for_sale" | "no_account" | "bad_price";
  balance?: number;
  price?: number;
  line_ids?: number[];
}

export interface TestPackOutcome {
  status: "credited" | "duplicate" | "not_tester" | "under_age" | "bad_pack" | "no_account" | "bad_reason";
  line_id?: number;
  balance?: number;
  coins?: number;
}

export type WishlistStatus = "added" | "removed" | "unchanged" | "no_account" | "not_for_sale";

/** Recorded days from `from` to `to` inclusive (YYYY-MM-DD). */
export async function readShopDays(client: Db, from: string, to: string): Promise<Result<ShopDayRow[]>> {
  const { data, error } = await client.from("shop_days").select("*").gte("day", from).lte("day", to).order("day");
  return { data: (data as ShopDayRow[] | null) ?? [], error };
}

/** Records days (a day already recorded keeps what it had). Answers how many were new. */
export async function recordShopDays(
  client: Db,
  days: readonly { day: string; items: readonly string[]; rarities: readonly string[]; backups: Record<string, string[]> }[],
): Promise<Result<number | null>> {
  const { data, error } = await client.rpc("shop_record_days", { p_days: asJson(days) });
  return { data: (data as number | null) ?? null, error };
}

/** A week's recorded bundle (null: not recorded yet). */
export async function readShopWeek(client: Db, weekStart: string): Promise<Result<ShopWeekRow | null>> {
  const { data, error } = await client.from("shop_weeks").select("*").eq("week_start", weekStart).maybeSingle();
  return { data: (data as ShopWeekRow | null) ?? null, error };
}

/** Records a week's bundle (kept as first recorded). */
export async function recordShopWeek(
  client: Db,
  input: { weekStart: string; bundleId: string; name: string; items: readonly string[]; price: number },
): Promise<Result<null>> {
  const args: Database["public"]["Functions"]["shop_record_week"]["Args"] = {
    p_week: input.weekStart,
    p_bundle_id: input.bundleId,
    p_name: input.name,
    p_items: [...input.items],
    p_price: input.price,
  };
  const { error } = await client.rpc("shop_record_week", args);
  return { data: null, error };
}

/** Whether an account is a shop tester (shop.testers; never a guest or an account waiting for deletion). */
export async function readIsTester(client: Db, userId: string): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("shop_is_tester", { p_user_id: userId });
  return { data: data === true, error };
}

/** An account's wishlisted item ids, with when each was hearted. */
export async function readWishlist(client: Db, userId: string): Promise<Result<{ itemId: string; createdAt: string }[]>> {
  const { data, error } = await client.from("shop_wishlist").select("item_id, created_at").eq("user_id", userId);
  return {
    data: ((data as { item_id: string; created_at: string }[] | null) ?? []).map((r) => ({ itemId: r.item_id, createdAt: r.created_at })),
    error,
  };
}

/** Hearts or un-hearts a shop item. */
export async function setWishlist(
  client: Db,
  input: { userId: string; itemId: string; on: boolean },
): Promise<Result<WishlistStatus | null>> {
  const { data, error } = await client.rpc("shop_wishlist_set", {
    p_user_id: input.userId,
    p_item_id: input.itemId,
    p_on: input.on,
  });
  return { data: (data as WishlistStatus | null) ?? null, error };
}

/** Buys a bundle's items for the given split prices in one transaction. */
export async function purchaseBundleRpc(
  client: Db,
  input: { userId: string; weekStart: string; bundleId: string; items: readonly string[]; prices: readonly number[]; key: string },
): Promise<Result<BundleOutcome | null>> {
  const { data, error } = await client.rpc("shop_purchase_bundle", {
    p_user_id: input.userId,
    p_week: input.weekStart,
    p_bundle_id: input.bundleId,
    p_items: [...input.items],
    p_prices: [...input.prices],
    p_key: input.key,
  });
  return { data: (data as unknown as BundleOutcome | null) ?? null, error };
}

/** A tester's coin pack with no payment. */
export async function testPackRpc(
  client: Db,
  input: { userId: string; pack: string; key: string },
): Promise<Result<TestPackOutcome | null>> {
  const { data, error } = await client.rpc("shop_test_pack", { p_user_id: input.userId, p_pack: input.pack, p_key: input.key });
  return { data: (data as unknown as TestPackOutcome | null) ?? null, error };
}
