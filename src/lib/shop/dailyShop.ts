/**
 * The daily shop's picks (wave 2, session D1; docs/economy/shop.md): four items a day, the same for everyone,
 * chosen once by the server at midnight UK time and recorded (public.shop_days), so any day can be checked later.
 * Pure: the same pool and history give the same day on every server.
 *
 * - Slots 1 and 2 Epic, slot 3 Elite, slot 4 Epic, Elite or Legendary: a Legendary on two days of every week (one of
 *   Monday–Wednesday, then one three or four days later), otherwise Epic or Elite by the day's seed.
 * - Nothing shown in the 7 days before is shown again. Within a rarity the items not shown for longest come first
 *   (a seeded pick among the three oldest Epics or Elites; the oldest Legendary exactly), so every item comes round
 *   and each Legendary returns every 22–27 days (seven Legendaries, two Legendary days a week).
 * - Only the shop query's items (source shop, not exclusive, priced): pass, free and earned items never appear.
 * - A player who owns one of the four sees the day's next eligible item of that rarity in its place (the recorded
 *   backups, in order), or, when they own all of those too, the item marked Owned (`viewForPlayer`).
 */
import { addDays, daysBetween, hash32, mondayOf, type ShopDate, weekdayOf } from "./days";

export type ShopRarity = "epic" | "elite" | "legendary";
export const SHOP_RARITIES: readonly ShopRarity[] = ["epic", "elite", "legendary"];

/** One sellable item as the picker needs it. */
export interface ShopPoolItem {
  id: string;
  rarity: ShopRarity;
}

/** One recorded day. */
export interface ShopDay {
  day: ShopDate;
  /** The four, slot order. */
  items: [string, string, string, string];
  rarities: [ShopRarity, ShopRarity, ShopRarity, ShopRarity];
  /** Per rarity, the day's next eligible items in order (what an owner of a pick sees instead). */
  backups: Record<ShopRarity, string[]>;
}

/** An item shown on a day is not shown again for this many days after it (next at the earliest 8 days later). */
export const NO_REPEAT_DAYS = 7;
/** How many recorded days before a day the picker reads (the oldest-first order needs about a month). */
export const HISTORY_DAYS = 42;
/** How many backups per rarity a day records. */
export const BACKUPS_PER_RARITY = 8;
/** Epics and Elites: a seeded choice among this many of the longest unseen. */
const OLDEST_CHOICE = 3;

/**
 * The two Legendary days of a week (0 Monday … 6 Sunday): the first Monday–Wednesday, the second three or four days
 * after it, so a Legendary returns 22–27 days after it was last shown.
 */
export function legendaryWeekdays(monday: ShopDate): [number, number] {
  const h = hash32(`shop-legendary:${monday}`);
  const first = h % 3;
  const second = first + 3 + ((h >>> 8) % 2);
  return [first, second];
}

export function isLegendaryDay(day: ShopDate): boolean {
  const [a, b] = legendaryWeekdays(mondayOf(day));
  const w = weekdayOf(day);
  return w === a || w === b;
}

/** The four slots' rarities for a day. */
export function slotRarities(day: ShopDate): [ShopRarity, ShopRarity, ShopRarity, ShopRarity] {
  const fourth: ShopRarity = isLegendaryDay(day) ? "legendary" : hash32(`shop-slot4:${day}`) % 2 === 0 ? "epic" : "elite";
  return ["epic", "epic", "elite", fourth];
}

/**
 * Whether a catalogue item may ever be sold in the daily shop or a bundle: the shop query's rule (source shop, not
 * exclusive, priced) and a sellable rarity. Pass, free and earned items never pass.
 */
export function sellable(item: { source: string; exclusive: boolean; priceCoins: number | null; rarity: string | null }): boolean {
  return item.source === "shop" && !item.exclusive && item.priceCoins !== null && SHOP_RARITIES.includes(item.rarity as ShopRarity);
}

/** The pool in a fixed order (by id), only the three sellable rarities. */
export function normalisePool(pool: readonly ShopPoolItem[]): ShopPoolItem[] {
  return pool
    .filter((p) => SHOP_RARITIES.includes(p.rarity))
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The picks for `day` from the pool and the recorded days before it (any order; days on or after `day` and older
 * than HISTORY_DAYS are ignored).
 */
export function pickShopDay(day: ShopDate, pool: readonly ShopPoolItem[], history: readonly ShopDay[]): ShopDay {
  const items = normalisePool(pool);
  const past = history.filter((h) => {
    const back = daysBetween(h.day, day);
    return back >= 1 && back <= HISTORY_DAYS;
  });
  const recent = new Set<string>();
  const lastShown = new Map<string, ShopDate>();
  for (const h of past) {
    const back = daysBetween(h.day, day);
    for (const id of h.items) {
      if (back <= NO_REPEAT_DAYS) recent.add(id);
      const prev = lastShown.get(id);
      if (!prev || prev < h.day) lastShown.set(id, h.day);
    }
  }
  const rarities = slotRarities(day);
  const chosen: string[] = [];
  const order = (rarity: ShopRarity, allowRecent: boolean): string[] =>
    items
      .filter((p) => p.rarity === rarity && !chosen.includes(p.id) && (allowRecent || !recent.has(p.id)))
      .sort((a, b) => {
        const la = lastShown.get(a.id) ?? "";
        const lb = lastShown.get(b.id) ?? "";
        if (la !== lb) return la < lb ? -1 : 1;
        return hash32(`shop-tie:${day}:${a.id}`) - hash32(`shop-tie:${day}:${b.id}`);
      })
      .map((p) => p.id);
  rarities.forEach((rarity, slot) => {
    let list = order(rarity, false);
    // Only if the pool is too small for the 7-day rule (never with today's catalogue): the oldest shown item.
    if (!list.length) list = order(rarity, true);
    if (!list.length) throw new Error(`daily shop: no ${rarity} item for ${day}`);
    const span = rarity === "legendary" ? 1 : Math.min(OLDEST_CHOICE, list.length);
    chosen.push(list[hash32(`shop-pick:${day}:${slot}`) % span]!);
  });
  const backups = Object.fromEntries(
    SHOP_RARITIES.map((r) => [r, order(r, false).slice(0, BACKUPS_PER_RARITY)]),
  ) as Record<ShopRarity, string[]>;
  return { day, items: chosen as ShopDay["items"], rarities, backups };
}

/**
 * Days from `from` to `to` inclusive, each picked on the history so far (the recorded days given, then the ones just
 * picked). The server fills any day nobody opened the shop on this way, so the 7-day rule always sees every day.
 */
export function pickShopDays(
  from: ShopDate,
  to: ShopDate,
  pool: readonly ShopPoolItem[],
  history: readonly ShopDay[],
): ShopDay[] {
  const out: ShopDay[] = [];
  const known = [...history];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const picked = pickShopDay(d, pool, known);
    out.push(picked);
    known.push(picked);
  }
  return out;
}

/** One slot as a player sees it. */
export interface ShopSlotView {
  slot: number;
  itemId: string;
  rarity: ShopRarity;
  /** True only when the player owns the slot's pick and every backup of its rarity. */
  owned: boolean;
  /** The day's pick this slot replaced for this player (they own it), or null. */
  replaced: string | null;
}

/** The day's four for one player: owned picks swapped for the day's next unowned backups where possible. */
export function viewForPlayer(day: ShopDay, owned: ReadonlySet<string>): ShopSlotView[] {
  const used = new Set<string>(day.items.filter((id) => !owned.has(id)));
  return day.items.map((id, slot) => {
    const rarity = day.rarities[slot]!;
    if (!owned.has(id)) return { slot, itemId: id, rarity, owned: false, replaced: null };
    const sub = (day.backups[rarity] ?? []).find((b) => !owned.has(b) && !used.has(b) && !day.items.includes(b));
    if (sub) {
      used.add(sub);
      return { slot, itemId: sub, rarity, owned: false, replaced: id };
    }
    return { slot, itemId: id, rarity, owned: true, replaced: null };
  });
}
