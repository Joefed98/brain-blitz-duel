/**
 * What the shop's server functions answer (wave 2, session D1). Shared by the phone and the server; types only, plus
 * the item labels.
 */
import type { PackId } from "./packs";
import type { ShopRarity } from "./dailyShop";

export interface ShopCard {
  id: string;
  name: string;
  /** "Card art", "Top Bins skin"… */
  label: string;
  rarity: ShopRarity;
  /** Coins, full price. */
  price: number;
  animated: boolean;
  owned: boolean;
  wished: boolean;
}

export interface ShopBundleView {
  id: string;
  name: string;
  blurb: string;
  size: "small" | "medium" | "large";
  weekStart: string;
  items: ShopCard[];
  /** What this player pays (the unowned part, the same share off); null when they own every item. */
  price: number | null;
  /** The separate prices of what they'd get. */
  full: number;
}

export interface ShopView {
  open: true;
  day: string;
  balance: number;
  tester: boolean;
  /** Coin packs: allowed for this account (18+ on the web). */
  packsAllowed: boolean;
  today: ShopCard[];
  bundle: ShopBundleView | null;
  /** Every wishlisted item id (shop items only). */
  wishlist: string[];
}

export type ShopClosed = { open: false; reason: "guest" | "not_tester" | "busy" };

export type BuyRefusal =
  | "guest"
  | "not_tester"
  | "not_today"
  | "owned"
  | "insufficient"
  | "busy"
  | "under_age"
  | "bad_request"
  | "error";

export type BuyResult =
  | { ok: true; status: "purchased" | "duplicate" | "credited"; balance: number | null }
  | { ok: false; reason: BuyRefusal; message: string; balance?: number | null };

export interface ShopStatus {
  /** Whether this account sees the shop (a tester, or the switch on for everyone). */
  open: boolean;
  tester: boolean;
  /** Wishlisted items back in the shop today (today's four or this week's bundle), not owned. */
  back: { id: string; name: string }[];
  day: string | null;
}

export type { PackId };

const KIND_LABELS: Readonly<Record<string, string>> = {
  "card-art": "Card art",
  frame: "Frame",
  "name-colour": "Name colour",
  "avatar-finish": "Avatar finish",
  "avatar-accessory": "Avatar accessory",
  "avatar-special-edition": "Avatar",
  reaction: "Reaction pack",
  celebration: "Celebration",
  "tile-style": "Tile style",
  "world-theme": "World theme",
};

/** "Card art", "Top Bins skin", "Card art, animated". */
export function itemLabel(item: { kind: string; game: string | null; animated: boolean }): string {
  const base = item.kind === "game-skin" ? `${item.game ?? "Game"} skin` : (KIND_LABELS[item.kind] ?? "Item");
  return item.animated ? `${base}, animated` : base;
}

export const BUY_MESSAGES: Readonly<Record<BuyRefusal, string>> = {
  guest: "Make an account to buy items.",
  not_tester: "The shop isn’t open yet.",
  not_today: "That item isn’t in the shop today.",
  owned: "You already own that.",
  insufficient: "Not enough coins.",
  busy: "That’s a lot of taps. Give it a minute.",
  under_age: "Coin packs are for players 18 and over.",
  bad_request: "Something went wrong. Try again.",
  error: "Something went wrong. Try again.",
};
