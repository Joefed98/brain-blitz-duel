/**
 * The Monday bundle (wave 2, session D1; docs/economy/bundles-season-1.md): one themed bundle a week, changing on
 * Monday (UK), cycling small, medium and large, always 20–30 % off the items' separate prices. The week's items can
 * also be bought one by one that week at full price.
 *
 * THE SCHEDULE IS DATA: Joe's changes are an edit here (names, items, prices, order). shop-check proves every entry
 * keeps the rules (shop items only, the size's price band, 20–30 % off). Week 1 is the Monday BUNDLE_SCHEDULE_START;
 * set it to Season 1's first Monday at launch. After the last entry the list starts again.
 */
import { addDays, daysBetween, mondayOf, type ShopDate } from "./days";

export type BundleSize = "small" | "medium" | "large";

export interface BundleDef {
  /** Stable id (stored with the week and on the ledger lines). */
  id: string;
  name: string;
  size: BundleSize;
  /** Catalogue ids, centrepiece first. */
  items: readonly string[];
  /** The bundle's price in coins. */
  price: number;
  /** One line under the title. */
  blurb: string;
}

/**
 * Week 1's Monday. Testers see the schedule from here; at launch set it to Season 1's first Monday (a Monday:
 * shop-check refuses anything else).
 */
export const BUNDLE_SCHEDULE_START: ShopDate = "2026-11-09";

/** Sizes by price, the bands the checks hold every bundle to. */
export const BUNDLE_SIZES: Readonly<Record<BundleSize, { min: number; max: number }>> = {
  small: { min: 2_800, max: 3_600 },
  medium: { min: 5_000, max: 6_000 },
  large: { min: 10_000, max: 10_000 },
};
/** Every bundle is at least this share off… */
export const BUNDLE_MIN_OFF = 0.2;
/** …and at most this. */
export const BUNDLE_MAX_OFF = 0.3;

/**
 * Season 1's first eight weeks, approved by Joe on 11 Nov 2026: small, medium, large, then round again. Week 2's two
 * Free Cell card backs may move with E1's decision; if so, week 2 changes here.
 */
export const BUNDLES: readonly BundleDef[] = [
  {
    id: "frozen-lake",
    name: "Frozen Lake",
    size: "small",
    items: ["game-skin.curl-champ.glacier", "game-skin.curl-champ.aurora", "card-art.frost"],
    price: 3_200,
    blurb: "Curl Champ Glacier stones (Epic) and Aurora stones (Elite), and the Frost card art (Elite).",
  },
  {
    id: "card-table",
    name: "Card Table",
    size: "medium",
    items: [
      "game-skin.free-cell.holo-foil",
      "game-skin.free-cell.royal-damask",
      "game-skin.full-house.midnight-felt",
      "game-skin.full-house.crimson-velvet",
      "card-art.royal",
      "card-art.crimson",
      "card-art.emerald",
    ],
    price: 5_500,
    blurb: "Free Cell and Full House skins (Epic and Elite) with three jewel card arts (Epic).",
  },
  {
    id: "black-and-gold",
    name: "Black and Gold",
    size: "large",
    items: [
      "celebration.gold-rush",
      "card-art.gold-circuit",
      "frame.obsidian",
      "tile-style.obsidian-glass",
      "celebration.fireworks",
      "celebration.shockwave",
      "frame.gold",
      "name-colour.gold-leaf",
      "tile-style.brushed-gold",
    ],
    price: 10_000,
    blurb: "The Gold Rush celebration (Legendary) with a full black-and-gold set: card art, frames, tiles, name colour.",
  },
  {
    id: "retro-arcade",
    name: "Retro Arcade",
    size: "small",
    items: ["reaction.retro-arcade", "tile-style.blueprint", "name-colour.sapphire", "avatar-finish.comic-ink"],
    price: 3_100,
    blurb: "Four matching Epics: 8-bit reactions, Blueprint tiles, Sapphire name colour and the Comic Ink finish.",
  },
  {
    id: "sports-day",
    name: "Sports Day",
    size: "medium",
    items: [
      "game-skin.cue-ball.galaxy-set",
      "game-skin.cue-ball.pixel-pool",
      "game-skin.crazy-golf.watermelon",
      "game-skin.crazy-golf.disco",
      "game-skin.top-bins.comet",
      "game-skin.top-bins.retro-leather",
      "game-skin.apex.racing-stripes",
    ],
    price: 5_500,
    blurb: "Seven skins for Cue Ball, Crazy Golf, Top Bins and Apex (Epic and Elite).",
  },
  {
    id: "hologram",
    name: "Hologram",
    size: "large",
    items: [
      "frame.diamond",
      "name-colour.prism",
      "avatar-finish.holographic",
      "avatar-finish.wireframe",
      "reaction.holo-stickers",
      "name-colour.amethyst",
      "name-colour.chrome",
      "avatar-finish.carbon",
    ],
    price: 10_000,
    blurb: "The Diamond frame and Prism name colour (Legendary) with holographic finishes, stickers and colours.",
  },
  {
    id: "big-night",
    name: "Big Night",
    size: "small",
    items: ["celebration.confetti-pop", "celebration.spotlight", "reaction.banter", "reaction.captains-calls"],
    price: 3_100,
    blurb: "Four matching Epics: Confetti Pop, Spotlight, and the Banter and Captain’s Calls reactions.",
  },
  {
    id: "city-lights",
    name: "City Lights",
    size: "medium",
    items: [
      "card-art.neon-city",
      "name-colour.emerald-glow",
      "card-art.sunset",
      "card-art.galaxy",
      "card-art.lava",
      "avatar-finish.chrome",
    ],
    price: 5_500,
    blurb: "Neon City card art and Emerald Glow (Elite) with Sunset, Galaxy, Lava and the Chrome finish (Epic).",
  },
];

/** The schedule's index for a week (null before week 1). */
export function bundleIndexFor(day: ShopDate, schedule: readonly BundleDef[] = BUNDLES, start: ShopDate = BUNDLE_SCHEDULE_START): number | null {
  if (!schedule.length) return null;
  const weeks = Math.floor(daysBetween(start, mondayOf(day)) / 7);
  if (weeks < 0) return null;
  return weeks % schedule.length;
}

/** The week's bundle (null before week 1). */
export function bundleForDay(day: ShopDate, schedule: readonly BundleDef[] = BUNDLES, start: ShopDate = BUNDLE_SCHEDULE_START): BundleDef | null {
  const i = bundleIndexFor(day, schedule, start);
  return i === null ? null : schedule[i]!;
}

/** The Monday the week's bundle ends after (the next Monday). */
export function bundleEnds(day: ShopDate): ShopDate {
  return addDays(mondayOf(day), 7);
}

/** The items' separate prices together. */
export function fullPrice(items: readonly string[], priceOf: (id: string) => number | null): number {
  return items.reduce((sum, id) => sum + (priceOf(id) ?? 0), 0);
}

/**
 * What a player pays for the bundle: the bundle's price for the items they don't own yet, in proportion to those
 * items' separate prices (the same share off), rounded down to 10 coins. Null when they own every item.
 */
export function bundlePriceFor(
  bundle: BundleDef,
  owned: ReadonlySet<string>,
  priceOf: (id: string) => number | null,
): { price: number; items: string[]; full: number } | null {
  const items = bundle.items.filter((id) => !owned.has(id));
  if (!items.length) return null;
  const all = fullPrice(bundle.items, priceOf);
  const left = fullPrice(items, priceOf);
  if (items.length === bundle.items.length) return { price: bundle.price, items, full: all };
  const price = Math.max(10, Math.floor((bundle.price * left) / all / 10) * 10);
  return { price, items, full: left };
}

/**
 * The bundle's price split over its items (each item is bought on its own ledger line, so a refund of one gives back
 * its share): in proportion to the separate prices, the remainder on the first item. Sums to `price` exactly.
 */
export function splitBundlePrice(items: readonly string[], price: number, priceOf: (id: string) => number | null): number[] {
  const full = fullPrice(items, priceOf);
  const parts = items.map((id) => Math.floor((price * (priceOf(id) ?? 0)) / Math.max(1, full)));
  parts[0] = parts[0]! + (price - parts.reduce((a, b) => a + b, 0));
  return parts;
}
