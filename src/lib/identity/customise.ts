/**
 * Customise's rules (wave 2, session A2), apart from the screen so a check can prove them: what a player owns, what
 * each slot lists, and the line under a locked item saying where it comes from (from the catalogue).
 */
import type { CatalogueItem, Rarity } from "./backend";
import { JOULZ_CHAMPIONSHIP_ENABLED } from "@/config/tournamentEventsConfig";
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
      return item.id === CHAMPIONSHIP_FRAME && JOULZ_CHAMPIONSHIP_ENABLED ? "Joulz Championship winners" : null;
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
