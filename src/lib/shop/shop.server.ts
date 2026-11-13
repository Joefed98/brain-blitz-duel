/**
 * The shop's rules on the server (wave 2, session D1; docs/economy/shop.md). Server only; the phone reaches it through
 * shop.functions.ts. Every database access is a typed function in src/lib/data (shop.server.ts, economy.server.ts,
 * profiles.server.ts); coins move only through A1's ledger functions and the shop's own (a bundle, a test pack).
 *
 * Who: the shop is open to tester accounts (shop.testers, Joe's list) while SHOP_TAB_ENABLED is off, and to every
 * account once it is on; a guest sees it only with the switch on and can't buy. Test purchases are testers only,
 * always. Nothing here is read by scoring, grading, replay, matchmaking or timing (economy-neutral-check).
 */
import { SHOP_TAB_ENABLED } from "@/config/shopConfig";
import { ageOn } from "@/lib/account/age";
import type { Db } from "@/lib/data/db.server";
import type { CatalogueItem } from "@/lib/data/economy";
import { readCoinBalance, readInventory } from "@/lib/data/economy.server";
import { recordEvents } from "@/lib/data/events.server";
import { readDateOfBirth, readProfile } from "@/lib/data/profiles.server";
import {
  purchaseBundleRpc,
  readIsTester,
  readShopDays,
  readShopWeek,
  readWishlist,
  recordShopDays,
  recordShopWeek,
  setWishlist,
  testPackRpc,
  type ShopDayRow,
  type ShopWeekRow,
} from "@/lib/data/shop.server";
import { catalogue, purchaseItem } from "@/lib/economy/economy.server";
import { forRetiredGame } from "@/lib/economy/retiredLooks";

import { BUNDLES, bundleForDay, bundlePriceFor, splitBundlePrice, type BundleDef } from "./bundles";
import { pickShopDays, sellable, viewForPlayer, type ShopDay, type ShopPoolItem, type ShopRarity } from "./dailyShop";
import { addDays, isShopDate, mondayOf, shopToday } from "./days";
import { packAllowed, packById, PACK_PLATFORM } from "./packs";
import {
  BUY_MESSAGES,
  itemLabel,
  type BuyRefusal,
  type BuyResult,
  type ShopBundleView,
  type ShopCard,
  type ShopClosed,
  type ShopStatus,
  type ShopView,
} from "./types";

/** At most this many days back are filled in when nobody opened the shop for a while. */
export const FILL_DAYS = 14;

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

function refuse(reason: BuyRefusal, balance?: number | null): BuyResult {
  return { ok: false, reason, message: BUY_MESSAGES[reason], ...(balance !== undefined ? { balance } : {}) };
}

/* ------------------------------------------------------------------ who may use it */

export interface ShopAccess {
  account: boolean;
  tester: boolean;
  /** Sees the shop. */
  open: boolean;
}

/** The switch (src/config/shopConfig.ts) and the tester list decide; `enabled` is for checks. */
export async function shopAccess(client: Db, userId: string, enabled: boolean = SHOP_TAB_ENABLED): Promise<ShopAccess> {
  const profile = await readProfile(client, userId);
  if (profile.error) throw new Error(`shop: ${profile.error.message}`);
  const account = profile.data !== null && profile.data.deletion_requested_at === null;
  if (!account) return { account: false, tester: false, open: enabled };
  const tester = await readIsTester(client, userId);
  if (tester.error) throw new Error(`shop: ${tester.error.message}`);
  return { account, tester: tester.data, open: enabled || tester.data };
}

/* ------------------------------------------------------------------ the catalogue's shop items */

export async function shopItems(client: Db): Promise<CatalogueItem[]> {
  return (await catalogue(client)).filter(sellable);
}

export function poolOf(items: readonly CatalogueItem[]): ShopPoolItem[] {
  return items.map((i) => ({ id: i.id, rarity: i.rarity as ShopRarity }));
}

function toShopDay(row: ShopDayRow): ShopDay {
  const b = (row.backups ?? {}) as Record<string, unknown>;
  const list = (r: ShopRarity) => (Array.isArray(b[r]) ? (b[r] as unknown[]).filter((x): x is string => typeof x === "string") : []);
  return {
    day: row.day,
    items: row.items as ShopDay["items"],
    rarities: row.rarities as ShopDay["rarities"],
    backups: { epic: list("epic"), elite: list("elite"), legendary: list("legendary") },
  };
}

/**
 * The day's four, recorded: read if recorded, else chosen now on the recorded days before it (filling any day since
 * the last recorded one, at most FILL_DAYS back) and recorded. Two servers at once record the same picks (the choice
 * is pure); whichever writes first is kept and both answer the stored row.
 */
export async function ensureShopDay(client: Db, day: string): Promise<ShopDay> {
  const history = await readShopDays(client, addDays(day, -42), day);
  if (history.error) throw new Error(`shop: ${history.error.message}`);
  const recorded = history.data.map(toShopDay);
  const found = recorded.find((d) => d.day === day);
  if (found) return found;
  const before = recorded.filter((d) => d.day < day);
  const latest = before.length ? before[before.length - 1]!.day : null;
  const earliest = addDays(day, -FILL_DAYS);
  const from = latest && addDays(latest, 1) > earliest ? addDays(latest, 1) : latest ? earliest : day;
  // Never a retired game's skin or theme in a day still to be chosen (retiredLooks.ts); recorded days stay as recorded.
  const picked = pickShopDays(from, day, poolOf((await shopItems(client)).filter((i) => !forRetiredGame(i))), before);
  const wrote = await recordShopDays(client, picked);
  if (wrote.error) throw new Error(`shop: ${wrote.error.message}`);
  const again = await readShopDays(client, day, day);
  if (again.error || !again.data[0]) throw new Error(`shop: ${again.error?.message ?? "day not recorded"}`);
  return toShopDay(again.data[0]);
}

/**
 * The week's bundle as recorded (recorded from the schedule on first sight); null before the schedule starts, and
 * null (no bundle that week, nothing recorded) while any of its items is withdrawn (13 Nov 2026, docs/cosmetics-review:
 * a bundle is all or nothing, so it isn't sold short; it returns, at its own price, once Joe restores the item).
 */
export async function ensureShopWeek(client: Db, day: string, schedule: readonly BundleDef[] = BUNDLES): Promise<{ week: ShopWeekRow; def: BundleDef } | null> {
  const def = bundleForDay(day, schedule);
  if (!def) return null;
  const weekStart = mondayOf(day);
  let row = await readShopWeek(client, weekStart);
  if (row.error) throw new Error(`shop: ${row.error.message}`);
  const onSale = new Set((await shopItems(client)).map((i) => i.id));
  if (!(row.data ? row.data.items : def.items).every((id) => onSale.has(id))) return null;
  if (!row.data) {
    const wrote = await recordShopWeek(client, { weekStart, bundleId: def.id, name: def.name, items: def.items, price: def.price });
    if (wrote.error) throw new Error(`shop: ${wrote.error.message}`);
    row = await readShopWeek(client, weekStart);
    if (row.error || !row.data) throw new Error(`shop: ${row.error?.message ?? "week not recorded"}`);
  }
  // The recorded week is the truth (a schedule edited mid-week never changes a week already on sale).
  const stored = schedule.find((b) => b.id === row.data!.bundle_id);
  const asDef: BundleDef = {
    id: row.data.bundle_id,
    name: row.data.name,
    size: stored?.size ?? def.size,
    items: row.data.items,
    price: row.data.price,
    blurb: stored?.blurb ?? "",
  };
  return { week: row.data, def: asDef };
}

/* ------------------------------------------------------------------ one player's shop */

/**
 * What an account owns, and what the daily view skips for it: everything owned except what it bought from the shop
 * today (so an item bought this morning stays in its slot, marked Owned, rather than turning into another).
 */
async function ownership(client: Db, userId: string, nowMs: number): Promise<{ all: Set<string>; skip: Set<string> }> {
  const inv = await readInventory(client, userId);
  if (inv.error) throw new Error(`shop: ${inv.error.message}`);
  const today = shopToday(nowMs);
  const all = new Set(inv.data.map((r) => r.item_id));
  const skip = new Set(
    inv.data.filter((r) => !(r.how === "shop" && shopToday(Date.parse(r.acquired_at)) === today)).map((r) => r.item_id),
  );
  return { all, skip };
}

/**
 * The day's items a player is never shown: a retired game's skins and themes (retiredLooks.ts) are skipped as if owned,
 * so a recorded day holding one shows its backup instead.
 */
async function withRetiredSkipped(client: Db, skip: Set<string>): Promise<Set<string>> {
  for (const item of await catalogue(client)) if (forRetiredGame(item)) skip.add(item.id);
  return skip;
}

async function ageOf(client: Db, userId: string, nowMs: number): Promise<number | null> {
  const dob = await readDateOfBirth(client, userId);
  if (dob.error) throw new Error(`shop: ${dob.error.message}`);
  return dob.data ? ageOn(dob.data, shopToday(nowMs)) : null;
}

function card(item: CatalogueItem, owned: ReadonlySet<string>, wished: ReadonlySet<string>): ShopCard {
  return {
    id: item.id,
    name: item.name,
    label: itemLabel(item),
    rarity: item.rarity as ShopRarity,
    price: item.priceCoins ?? 0,
    animated: item.animated,
    owned: owned.has(item.id),
    wished: wished.has(item.id),
  };
}

/** What a player can buy today: their view of the four and the week's bundle items. */
export interface Offer {
  day: ShopDay;
  week: { week: ShopWeekRow; def: BundleDef } | null;
  todayIds: string[];
}

export async function offerFor(client: Db, skip: ReadonlySet<string>, nowMs: number): Promise<Offer> {
  const today = shopToday(nowMs);
  const day = await ensureShopDay(client, today);
  const week = await ensureShopWeek(client, today);
  const onSale = new Map((await shopItems(client)).map((i) => [i.id, i]));
  return { day, week, todayIds: viewForPlayer(day, skipping(skip, day, onSale)).map((s) => s.itemId).filter((id) => onSale.has(id)) };
}

/**
 * The view's skip set with the day's withdrawn picks added (13 Nov 2026): a day recorded before an item was withdrawn
 * shows the day's next backup in its place, as for an owned pick.
 */
function skipping(skip: ReadonlySet<string>, day: ShopDay, onSale: ReadonlyMap<string, unknown>): ReadonlySet<string> {
  const gone = [...day.items, ...Object.values(day.backups).flat()].filter((id) => !onSale.has(id));
  return gone.length ? new Set([...skip, ...gone]) : skip;
}

/** The whole shop for one account. */
export async function shopViewFor(client: Db, userId: string, nowMs: number, section?: string): Promise<ShopView | ShopClosed> {
  const access = await shopAccess(client, userId);
  if (!access.open) return { open: false, reason: "not_tester" };
  if (!access.account) return { open: false, reason: "guest" };
  const [{ all: owned, skip }, items, wishlist, balance, age] = await Promise.all([
    ownership(client, userId, nowMs),
    shopItems(client),
    readWishlist(client, userId),
    readCoinBalance(client, userId),
    ageOf(client, userId, nowMs),
  ]);
  if (wishlist.error) throw new Error(`shop: ${wishlist.error.message}`);
  if (balance.error) throw new Error(`shop: ${balance.error.message}`);
  const byId = new Map(items.map((i) => [i.id, i]));
  const wished = new Set(wishlist.data.map((w) => w.itemId).filter((id) => byId.has(id)));
  await withRetiredSkipped(client, skip);
  const offer = await offerFor(client, skip, nowMs);
  // A slot left holding a retired game's item (no backup to swap in) is not shown at all.
  const view = viewForPlayer(offer.day, skipping(skip, offer.day, byId)).filter((s) => !forRetiredGame(byId.get(s.itemId) ?? {}));
  // A slot whose pick (and every backup) was withdrawn after the day was recorded is left out.
  const today = view.flatMap((s) => {
    const item = byId.get(s.itemId);
    return item ? [card(item, owned, wished)] : [];
  });
  let bundle: ShopBundleView | null = null;
  if (offer.week) {
    const def = offer.week.def;
    const priceOf = (id: string) => byId.get(id)?.priceCoins ?? null;
    const price = bundlePriceFor(def, owned, priceOf);
    bundle = {
      id: def.id,
      name: def.name,
      blurb: def.blurb,
      size: def.size,
      weekStart: offer.week.week.week_start,
      items: def.items.map((id) => byId.get(id)).filter((i): i is CatalogueItem => !!i).map((i) => card(i, owned, wished)),
      price: price?.price ?? null,
      full: price?.full ?? offer.week.week.full_price,
    };
  }
  if (section === "featured" || section === "daily" || section === "coins")
    recordEvents({ event: "shop_viewed", playerId: userId, props: { section } });
  return {
    open: true,
    day: offer.day.day,
    balance: balance.data ?? 0,
    tester: access.tester,
    packsAllowed: packAllowed(age, PACK_PLATFORM),
    today,
    bundle,
    wishlist: [...wished],
  };
}

/** For the app's notice and the Shop tab's dot: wishlisted items back today, not owned. */
export async function shopStatusFor(client: Db, userId: string, nowMs: number): Promise<ShopStatus> {
  const access = await shopAccess(client, userId);
  if (!access.open || !access.account) return { open: access.open, tester: access.tester, back: [], day: null };
  const wishlist = await readWishlist(client, userId);
  if (wishlist.error) throw new Error(`shop: ${wishlist.error.message}`);
  if (!wishlist.data.length) return { open: true, tester: access.tester, back: [], day: shopToday(nowMs) };
  const { all: owned, skip } = await ownership(client, userId, nowMs);
  await withRetiredSkipped(client, skip);
  const offer = await offerFor(client, skip, nowMs);
  const onSale = new Set([...offer.todayIds, ...(offer.week?.def.items ?? [])]);
  const items = new Map((await shopItems(client)).map((i) => [i.id, i]));
  // "Back": hearted on an earlier day (an item hearted today while on sale hasn't come back), on sale today, not owned.
  const today = offer.day.day;
  const back = wishlist.data
    .filter((w) => shopToday(Date.parse(w.createdAt)) < today)
    .map((w) => w.itemId)
    .filter((id) => onSale.has(id) && !owned.has(id) && items.has(id))
    .map((id) => ({ id, name: items.get(id)!.name }));
  return { open: true, tester: access.tester, back, day: offer.day.day };
}

/* ------------------------------------------------------------------ buying */

async function canBuy(client: Db, userId: string): Promise<BuyRefusal | null> {
  const access = await shopAccess(client, userId);
  if (!access.account) return access.open ? "guest" : "not_tester";
  if (!access.open) return "not_tester";
  return null;
}

/** Buys one item on sale today (the player's four or the week's bundle items), once per request id. */
export async function buyItem(client: Db, userId: string, itemId: unknown, requestId: unknown, nowMs: number): Promise<BuyResult> {
  if (typeof itemId !== "string" || typeof requestId !== "string" || !REQUEST_ID.test(requestId)) return refuse("bad_request");
  const blocked = await canBuy(client, userId);
  if (blocked) return refuse(blocked);
  const { all: owned, skip } = await ownership(client, userId, nowMs);
  const key = `shop:${itemId}:${requestId}`;
  await withRetiredSkipped(client, skip);
  const offer = await offerFor(client, skip, nowMs);
  // A retired game's item is never sold alone (it may still sit in a bundle, the Cosmetics session's to change).
  const onSale = (offer.todayIds.includes(itemId) && !skip.has(itemId)) || (offer.week?.def.items ?? []).includes(itemId);
  if (!onSale && !owned.has(itemId)) return refuse("not_today");
  const out = await purchaseItem(client, { userId, itemId, key });
  switch (out.status) {
    case "purchased": {
      const item = (await shopItems(client)).find((i) => i.id === itemId);
      recordEvents({
        event: "item_bought",
        playerId: userId,
        props: { coins: out.price ?? item?.priceCoins ?? null, item: itemId, rarity: item?.rarity ?? null },
      });
      return { ok: true, status: "purchased", balance: out.balance ?? null };
    }
    case "duplicate":
      return { ok: true, status: "duplicate", balance: out.balance ?? null };
    case "owned":
      return refuse("owned");
    case "insufficient":
      return refuse("insufficient", out.balance ?? null);
    case "not_for_sale":
      return refuse("not_today");
    case "no_account":
      return refuse("guest");
    default:
      return refuse("error");
  }
}

/** Buys this week's bundle (its unowned part, the same share off), all or nothing, once per request id. */
export async function buyBundle(client: Db, userId: string, requestId: unknown, nowMs: number): Promise<BuyResult> {
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId)) return refuse("bad_request");
  const blocked = await canBuy(client, userId);
  if (blocked) return refuse(blocked);
  const { all: owned, skip } = await ownership(client, userId, nowMs);
  const offer = await offerFor(client, skip, nowMs);
  if (!offer.week) return refuse("not_today");
  const items = await shopItems(client);
  const priceOf = (id: string) => items.find((i) => i.id === id)?.priceCoins ?? null;
  const key = `bundle:${offer.week.def.id}:${offer.week.week.week_start}:${requestId}`;
  const price = bundlePriceFor(offer.week.def, owned, priceOf);
  if (!price) {
    // Everything owned: a repeat of a purchase that went through answers as before.
    return refuse("owned");
  }
  const prices = splitBundlePrice(price.items, price.price, priceOf);
  const { data, error } = await purchaseBundleRpc(client, {
    userId,
    weekStart: offer.week.week.week_start,
    bundleId: offer.week.def.id,
    items: price.items,
    prices,
    key,
  });
  if (error || !data) return refuse("error");
  switch (data.status) {
    case "purchased":
      recordEvents([
        { event: "bundle_bought", playerId: userId, props: { bundle: offer.week.def.id, coins: price.price, items: price.items.length } },
        { event: "coins_spent", playerId: userId, props: { reason: "bundle_purchase", amount: price.price } },
        ...price.items.map((id) => {
          const item = items.find((i) => i.id === id);
          return {
            event: "item_granted" as const,
            playerId: userId,
            props: { kind: item?.kind ?? null, rarity: item?.rarity ?? null, source: item?.source ?? null },
          };
        }),
      ]);
      return { ok: true, status: "purchased", balance: data.balance ?? null };
    case "duplicate":
      return { ok: true, status: "duplicate", balance: data.balance ?? null };
    case "owned":
      return refuse("owned");
    case "insufficient":
      return refuse("insufficient", data.balance ?? null);
    case "no_account":
      return refuse("guest");
    case "not_for_sale":
      return refuse("not_today");
    default:
      return refuse("error");
  }
}

/** A tester's coin pack with no payment (a ledger line marked test_purchase). 18+ only, as every pack on the web. */
export async function buyTestPack(client: Db, userId: string, packId: unknown, requestId: unknown, nowMs: number): Promise<BuyResult> {
  const pack = packById(packId);
  if (!pack || typeof requestId !== "string" || !REQUEST_ID.test(requestId)) return refuse("bad_request");
  const access = await shopAccess(client, userId);
  if (!access.account) return refuse("guest");
  if (!access.tester) return refuse("not_tester");
  if (!packAllowed(await ageOf(client, userId, nowMs), PACK_PLATFORM)) return refuse("under_age");
  const { data, error } = await testPackRpc(client, { userId, pack: pack.id, key: `test_pack:${requestId}` });
  if (error || !data) return refuse("error");
  if (data.status === "credited") {
    recordEvents([
      { event: "pack_bought", playerId: userId, props: { pack: pack.id, coins: pack.coins, test: true } },
      { event: "coins_credited", playerId: userId, props: { reason: "test_purchase", amount: pack.coins } },
    ]);
    return { ok: true, status: "credited", balance: data.balance ?? null };
  }
  if (data.status === "duplicate") return { ok: true, status: "duplicate", balance: data.balance ?? null };
  if (data.status === "under_age") return refuse("under_age");
  if (data.status === "not_tester") return refuse("not_tester");
  if (data.status === "no_account") return refuse("guest");
  return refuse("error");
}

/** Hearts or un-hearts a shop item. */
export async function setWish(client: Db, userId: string, itemId: unknown, on: unknown): Promise<{ ok: boolean; wished: boolean }> {
  if (typeof itemId !== "string" || typeof on !== "boolean") return { ok: false, wished: false };
  const access = await shopAccess(client, userId);
  if (!access.open || !access.account) return { ok: false, wished: false };
  const { data, error } = await setWishlist(client, { userId, itemId, on });
  if (error || !data || data === "no_account" || data === "not_for_sale") return { ok: false, wished: false };
  if (data === "added") recordEvents({ event: "wishlist_added", playerId: userId, props: { item: itemId } });
  return { ok: true, wished: on };
}

/** Checks: a day's recorded picks (or null). */
export async function recordedDay(client: Db, day: string): Promise<ShopDay | null> {
  if (!isShopDate(day)) return null;
  const rows = await readShopDays(client, day, day);
  if (rows.error) throw new Error(`shop: ${rows.error.message}`);
  return rows.data[0] ? toShopDay(rows.data[0]) : null;
}
