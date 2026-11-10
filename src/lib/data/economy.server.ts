/**
 * Coins and items' data (wave 2 A1; docs/economy/README.md): the catalogue, wallets, ledgers, consumables, inventory
 * and loadouts (supabase/migrations/20261110160000_economy.sql) and their service-role functions. Server only; each
 * function issues exactly one call. Every write is one of the public.economy_* functions: no table here is writable
 * by any API role, the service role included.
 */

import type { Db, Tables } from "./db.server";
import type { Result } from "./rooms.server";

export type CatalogueRow = Tables<"catalogue_items">;
export type CoinLedgerRow = Tables<"coin_ledger">;
export type InventoryRow = Tables<"inventory_items">;
export type LoadoutRow = Tables<"loadouts">;
export type LoadoutSlotRow = Tables<"loadout_slots">;
export type ConsumableBalanceRow = Tables<"consumable_balances">;

/** What the coin functions answer (public.economy_credit / _spend / _refund / _purchase_item). */
export interface CoinOutcome {
  status:
    | "credited"
    | "spent"
    | "refunded"
    | "purchased"
    | "duplicate"
    | "insufficient"
    | "no_account"
    | "bad_reason"
    | "not_a_spend"
    | "not_for_sale"
    | "owned";
  line_id?: number;
  balance?: number;
  amount?: number;
  price?: number;
  item_removed?: string | null;
}

/** What the consumable functions answer. */
export interface ConsumableOutcome {
  status: "granted" | "used" | "duplicate" | "insufficient" | "no_account" | "bad_kind" | "bad_reason";
  line_id?: number;
  count?: number;
  amount?: number;
}

export type GrantItemStatus = "granted" | "owned" | "no_account" | "unknown_item" | "bad_how";
export type EquipStatus = "equipped" | "unequipped" | "no_account" | "unknown_item" | "wrong_slot" | "not_owned";
export type SetAvatarStatus = "set" | "no_account" | "bad_avatar" | "bad_colour" | "bad_option" | "gem_locked";
export type AvatarOptionRow = Tables<"avatar_options">;

export interface PublicCardRow {
  user_id: string;
  username: string;
  colour: number;
  player_number: number;
  founding: boolean;
  avatar_id: string;
  accent: string | null;
  feature: string | null;
  accessory: string | null;
  background: string | null;
  gem: string | null;
  card_art: string | null;
  frame: string | null;
  name_colour: string | null;
}

export interface LedgerRef {
  kind?: string | null;
  id?: string | null;
}

/* ------------------------------------------------------------------ reads */

/** Every catalogue item, in the catalogue file's order. */
export async function readCatalogue(client: Db): Promise<Result<CatalogueRow[]>> {
  const { data, error } = await client.from("catalogue_items").select("*").order("sort_order");
  return { data: (data as CatalogueRow[] | null) ?? [], error };
}

/** The shop query: shop items that aren't exclusive (public.catalogue_shop). */
export async function readShopItems(client: Db): Promise<Result<CatalogueRow[]>> {
  const { data, error } = await client.from("catalogue_shop").select("*").order("sort_order");
  return { data: (data as CatalogueRow[] | null) ?? [], error };
}

/** An account's cached balance (null: no wallet, a guest). */
export async function readCoinBalance(client: Db, userId: string): Promise<Result<number | null>> {
  const { data, error } = await client.from("coin_wallets").select("balance").eq("user_id", userId).maybeSingle();
  return { data: (data as { balance: number } | null)?.balance ?? null, error };
}

/** Every avatar's builder options (accent, feature, accessory, background). */
export async function readAvatarOptions(client: Db): Promise<Result<AvatarOptionRow[]>> {
  const { data, error } = await client.from("avatar_options").select("*").order("sort_order");
  return { data: (data as AvatarOptionRow[] | null) ?? [], error };
}

/** An account's latest coin lines, newest first. */
export async function readCoinLines(client: Db, userId: string, limit: number): Promise<Result<CoinLedgerRow[]>> {
  const { data, error } = await client
    .from("coin_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("id", { ascending: false })
    .limit(limit);
  return { data: (data as CoinLedgerRow[] | null) ?? [], error };
}

/** An account's consumable counts (kinds never granted have no row). */
export async function readConsumables(client: Db, userId: string): Promise<Result<ConsumableBalanceRow[]>> {
  const { data, error } = await client.from("consumable_balances").select("*").eq("user_id", userId);
  return { data: (data as ConsumableBalanceRow[] | null) ?? [], error };
}

/** What an account owns. */
export async function readInventory(client: Db, userId: string): Promise<Result<InventoryRow[]>> {
  const { data, error } = await client.from("inventory_items").select("*").eq("user_id", userId).order("acquired_at");
  return { data: (data as InventoryRow[] | null) ?? [], error };
}

/** An account's avatar and gem (null: no loadout row yet). */
export async function readLoadoutRow(client: Db, userId: string): Promise<Result<LoadoutRow | null>> {
  const { data, error } = await client.from("loadouts").select("*").eq("user_id", userId).maybeSingle();
  return { data: (data as LoadoutRow | null) ?? null, error };
}

/** An account's equipped slots. */
export async function readLoadoutSlots(client: Db, userId: string): Promise<Result<LoadoutSlotRow[]>> {
  const { data, error } = await client.from("loadout_slots").select("*").eq("user_id", userId);
  return { data: (data as LoadoutSlotRow[] | null) ?? [], error };
}

/** The gem colours an account has unlocked. */
export async function readGemUnlocks(client: Db, userId: string): Promise<Result<string[]>> {
  const { data, error } = await client.from("gem_unlocks").select("gem").eq("user_id", userId);
  return { data: ((data as { gem: string }[] | null) ?? []).map((r) => r.gem), error };
}

/** Public cards for up to 100 accounts (guests and accounts waiting for deletion are left out). */
export async function readPublicCards(client: Db, userIds: readonly string[]): Promise<Result<PublicCardRow[]>> {
  const { data, error } = await client.rpc("economy_public_cards", { p_user_ids: [...userIds].slice(0, 100) });
  return { data: (data as PublicCardRow[] | null) ?? [], error };
}

/* ------------------------------------------------------------------ writes (the database's own functions) */

/** Credits `amount` (> 0) coins, once per idempotency key. */
export async function creditCoinsRpc(
  client: Db,
  input: { userId: string; amount: number; reason: string; ref?: LedgerRef; key: string },
): Promise<Result<CoinOutcome | null>> {
  const { data, error } = await client.rpc("economy_credit", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_reason: input.reason,
    p_ref_kind: input.ref?.kind ?? null,
    p_ref_id: input.ref?.id ?? null,
    p_key: input.key,
  });
  return { data: (data as unknown as CoinOutcome | null) ?? null, error };
}

/** Spends `amount` (> 0) coins against the balance, once per idempotency key. */
export async function spendCoinsRpc(
  client: Db,
  input: { userId: string; amount: number; reason: string; ref?: LedgerRef; key: string },
): Promise<Result<CoinOutcome | null>> {
  const { data, error } = await client.rpc("economy_spend", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_reason: input.reason,
    p_ref_kind: input.ref?.kind ?? null,
    p_ref_id: input.ref?.id ?? null,
    p_key: input.key,
  });
  return { data: (data as unknown as CoinOutcome | null) ?? null, error };
}

/** Gives back one spend line (once); an item it bought leaves the inventory. */
export async function refundCoinsRpc(client: Db, userId: string, lineId: number): Promise<Result<CoinOutcome | null>> {
  const { data, error } = await client.rpc("economy_refund", { p_user_id: userId, p_line_id: lineId });
  return { data: (data as unknown as CoinOutcome | null) ?? null, error };
}

/** Buys a shop item at its catalogue price (the spend and the item in one transaction). */
export async function purchaseItemRpc(
  client: Db,
  input: { userId: string; itemId: string; key: string },
): Promise<Result<CoinOutcome | null>> {
  const { data, error } = await client.rpc("economy_purchase_item", {
    p_user_id: input.userId,
    p_item_id: input.itemId,
    p_key: input.key,
  });
  return { data: (data as unknown as CoinOutcome | null) ?? null, error };
}

/** Grants an item without coins (pass, earned, grant, starter). */
export async function grantItemRpc(
  client: Db,
  input: { userId: string; itemId: string; how: "starter" | "pass" | "earned" | "grant" },
): Promise<Result<GrantItemStatus | null>> {
  const { data, error } = await client.rpc("economy_grant_item", {
    p_user_id: input.userId,
    p_item_id: input.itemId,
    p_how: input.how,
  });
  return { data: (data as GrantItemStatus | null) ?? null, error };
}

/** Grants (`use: false`) or uses (`use: true`) `amount` (> 0) of one consumable, once per idempotency key. */
export async function postConsumableRpc(
  client: Db,
  input: { userId: string; kind: string; amount: number; reason: string; ref?: LedgerRef; key: string; use: boolean },
): Promise<Result<ConsumableOutcome | null>> {
  const { data, error } = await client.rpc(input.use ? "economy_use_consumable" : "economy_grant_consumable", {
    p_user_id: input.userId,
    p_kind: input.kind,
    p_amount: input.amount,
    p_reason: input.reason,
    p_ref_kind: input.ref?.kind ?? null,
    p_ref_id: input.ref?.id ?? null,
    p_key: input.key,
  });
  return { data: (data as unknown as ConsumableOutcome | null) ?? null, error };
}

/** Equips an owned item in a slot, or (itemId null) returns the slot to its default. */
export async function equipRpc(
  client: Db,
  input: { userId: string; slot: string; itemId: string | null },
): Promise<Result<EquipStatus | null>> {
  const { data, error } = await client.rpc("economy_equip", {
    p_user_id: input.userId,
    p_slot: input.slot,
    p_item_id: input.itemId,
  });
  return { data: (data as EquipStatus | null) ?? null, error };
}

/** Sets the avatar, its main colour (the profile's), its options (null: the avatar's default) and the gem. */
export async function setAvatarRpc(
  client: Db,
  input: {
    userId: string;
    avatarId: string;
    colour: number;
    accent?: string | null;
    feature?: string | null;
    accessory?: string | null;
    background?: string | null;
    gem: string | null;
  },
): Promise<Result<SetAvatarStatus | null>> {
  const { data, error } = await client.rpc("economy_set_avatar", {
    p_user_id: input.userId,
    p_avatar_id: input.avatarId,
    p_colour: input.colour,
    p_accent: input.accent ?? null,
    p_feature: input.feature ?? null,
    p_accessory: input.accessory ?? null,
    p_background: input.background ?? null,
    p_gem: input.gem,
  });
  return { data: (data as SetAvatarStatus | null) ?? null, error };
}
