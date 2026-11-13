/**
 * Customise's rules (wave 2, session A2), apart from the screen so a check can prove them: what a player owns, what
 * each slot lists, and the line under a locked item saying where it comes from (from the catalogue).
 */
import { CARD_BACK_IDS, GAME_SKIN_IDS, SKIN_GAME_NAMES, WORLD_THEME_IDS, type SkinnableGame } from "@/lib/arcade/skins/look";

import type { CatalogueItem, Rarity } from "./backend";
import { TOURNAMENT_KINDS_ON } from "@/config/tournamentConfig";
import { CHAMPIONSHIP_FRAME } from "@/lib/tournaments/eventRules";

/** Free for everyone (the 8 card arts and the Plain frame): owned whatever the inventory says. */
export function ownsItem(item: CatalogueItem, owned: ReadonlySet<string>): boolean {
  return owned.has(item.id) || item.source === "free-starter";
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  elite: "Elite",
  legendary: "Legendary",
};

/** Where a locked item comes from, or null when it isn't shown (a shop item while the Shop is off). */
export function sourceLine(item: CatalogueItem, shopOn: boolean): string | null {
  switch (item.source) {
    case "shop":
      return shopOn ? "Shop" : null;
    case "pass-free":
      return item.passLevel ? `Season 1 pass, level ${item.passLevel}` : "Season 1 pass";
    case "pass-premium":
      return item.passLevel ? `Season 1 premium pass, level ${item.passLevel}` : "Season 1 premium pass";
    case "earned-season-peak-tier":
      return "Reach this tier in a season";
    case "earned-founding-player":
      return "Founding Players";
    case "earned-top-500":
      return "Top 500 players";
    case "tournament":
      // The Championship frame (W4c): shown once the Joulz Championship is on.
      return item.id === CHAMPIONSHIP_FRAME && TOURNAMENT_KINDS_ON.championship ? "Joulz Championship winners" : null;
    case "free-starter":
      return null;
    default:
      return null;
  }
}

/** One slot's list for the Card tab: owned first (catalogue order), then locked ones that may be shown. */
export function slotItems(
  catalogue: readonly CatalogueItem[],
  kind: string,
  owned: ReadonlySet<string>,
  shopOn: boolean,
): { item: CatalogueItem; owned: boolean; from: string | null }[] {
  const ofKind = catalogue.filter((i) => i.kind === kind);
  const mine = ofKind.filter((i) => ownsItem(i, owned)).map((item) => ({ item, owned: true, from: null }));
  const locked = ofKind
    .filter((i) => !ownsItem(i, owned))
    .map((item) => ({ item, owned: false, from: sourceLine(item, shopOn) }))
    .filter((row) => row.from !== null);
  return [...mine, ...locked];
}

/** The owned items of an avatar slot (finishes, accessory, special edition): only owned ones are listed. */
export function ownedOfKind(catalogue: readonly CatalogueItem[], kind: string, owned: ReadonlySet<string>): CatalogueItem[] {
  return catalogue.filter((i) => i.kind === kind && ownsItem(i, owned));
}

/* --------------------------------------------------------------------------- the Games tab (12 Nov 2026) */

/** One game's rows on the Games tab: its owned skins and, where it has any, its owned world themes. */
export interface GameLookRows {
  /** The game's PuzzleType id. */
  game: SkinnableGame;
  /** The game's shown name (gameNames.ts). */
  name: string;
  skins: CatalogueItem[];
  worlds: CatalogueItem[];
  /** Whether the catalogue has world themes for this game at all (a World row is drawn only then). */
  hasWorlds: boolean;
}

/**
 * The Games tab: the owned card backs (the account's one back, drawn on every card game with a face-down deck), then
 * each skinnable game in the catalogue's order with its owned skins and world themes. Owned only: nothing locked is
 * listed here (the shop shows what can be bought). A game the player owns nothing for is left out; the default is
 * always there in the game's rows, and a game with no row has nothing to choose.
 */
export function gameLookRows(
  catalogue: readonly CatalogueItem[],
  owned: ReadonlySet<string>,
  names: Readonly<Record<string, string>>,
): { cardBacks: CatalogueItem[]; games: GameLookRows[] } {
  const mine = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const item = catalogue.find((i) => i.id === id);
      return item && ownsItem(item, owned) ? [item] : [];
    });
  const games = (Object.keys(SKIN_GAME_NAMES) as SkinnableGame[])
    .map((game) => ({
      game,
      name: names[game] ?? game,
      skins: mine(GAME_SKIN_IDS[game]),
      worlds: mine(WORLD_THEME_IDS[game]),
      hasWorlds: WORLD_THEME_IDS[game].length > 0,
    }))
    .filter((g) => g.skins.length > 0 || g.worlds.length > 0);
  return { cardBacks: mine(CARD_BACK_IDS), games };
}

/** An item's name under its game's heading: world themes are named "Cue Ball: Neon Table" in the catalogue; the game's own section drops the "Cue Ball: ". */
export function lookItemName(item: CatalogueItem, gameName: string): string {
  const prefix = `${gameName}: `;
  return item.name.startsWith(prefix) ? item.name.slice(prefix.length) : item.name;
}
