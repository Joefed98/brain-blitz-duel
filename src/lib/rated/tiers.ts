/**
 * The tier ladder as the rated screens draw it (wave 3, session W3c; mockups 01, 07, 13 and 14 in
 * docs/mockups/wave-3/). Pure: no React, no server.
 *
 * PROVISIONAL CONTRACT: the floors below are the approved mockup's (14-tier-ladder). The ratings work (W3a,
 * docs/rated/ratings-interface.md) owns the real table; when it lands, `TIER_FLOORS` is replaced by its export and
 * nothing else here changes. Which tier and division a player *is in* is never worked out here: the server's
 * `RankView` says (it alone knows the Storm and Top 500 caps). This module only draws the bar to the next division
 * from the rating and the ladder.
 */
import type { Tier } from "@/design/art/markup";

export type Division = 1 | 2 | 3;

/** Bottom to top. */
export const TIERS: readonly Tier[] = ["spark", "charge", "volt", "surge", "storm", "lightning"];

export const TIER_NAMES: Record<Tier, string> = {
  spark: "Spark",
  charge: "Charge",
  volt: "Volt",
  surge: "Surge",
  storm: "Storm",
  lightning: "Lightning",
};

const ROMAN: Record<Division, string> = { 1: "I", 2: "II", 3: "III" };

/** Each tier's division floors: III, II, I (mockup 14). */
export const TIER_FLOORS: Record<Tier, readonly [number, number, number]> = {
  spark: [100, 300, 500],
  charge: [700, 850, 1000],
  volt: [1100, 1250, 1400],
  surge: [1500, 1650, 1800],
  storm: [1900, 2050, 2200],
  lightning: [2400, 2550, 2700],
};

/** The tiers that must be held (mockup 14: "drop out of the top 3 % or the top 500 for 3 days and you move down"). */
export const STORM_TOP_SHARE = 3;
export const TOP_COUNT = 500;
export const CAP_DAYS = 3;
export const GRACE_MATCHES = 3;
export const PLACEMENT_MATCHES = 5;

/** Where a player stands, as the server reports it. */
export interface RankView {
  tier: Tier;
  /** III = 3 up to I = 1. */
  division: Division;
  rating: number;
  /** Top 500's number (1 to 500) when the player holds a Top 500 place, else null. */
  top500: number | null;
  /**
   * Set when the rating reaches a capped tier the player doesn't hold the place for: "storm" (rating 1,900+ outside
   * the top 3 %) or "top500" (Lightning outside the top 500). The tier shown is the one held.
   */
  heldBack: "storm" | "top500" | null;
}

/** "Volt II", "Top 500 #37". */
export function rankLabel(rank: Pick<RankView, "tier" | "division" | "top500">): string {
  if (rank.top500 !== null && rank.top500 > 0) return `Top 500 #${rank.top500}`;
  return divisionLabel(rank.tier, rank.division);
}

export function divisionLabel(tier: Tier, division: Division): string {
  return `${TIER_NAMES[tier]} ${ROMAN[division]}`;
}

export function romanOf(d: Division): string {
  return ROMAN[d];
}

/** "1,278": even-width digits are the CSS's job (tabular-nums); this is the grouping. */
export function ratingText(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}

/** "+7", "−12", "0". */
export function changeText(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

/** The floor of a division. */
export function floorOf(tier: Tier, division: Division): number {
  return TIER_FLOORS[tier][3 - division]!;
}

/** The next division up from (tier, division), or null at Lightning I. */
export function nextDivision(tier: Tier, division: Division): { tier: Tier; division: Division } | null {
  if (division > 1) return { tier, division: (division - 1) as Division };
  const i = TIERS.indexOf(tier);
  const up = TIERS[i + 1];
  return up ? { tier: up, division: 3 } : null;
}

export interface DivisionBar {
  /** 0 to 1 across the current division. */
  fraction: number;
  /** "Volt II". */
  here: string;
  /** "122 to Volt I", "Storm needs the top 3%", "Top division". */
  next: string;
  /** The points to the next division (null at the top or when a cap holds the player). */
  toNext: number | null;
}

/** The bar to the next division (mockups 01, 07, 13, 14). */
export function divisionBar(rank: RankView): DivisionBar {
  const here = rankLabel(rank);
  if (rank.heldBack === "storm")
    return { fraction: 1, here, next: `Storm needs the top ${STORM_TOP_SHARE}%`, toNext: null };
  if (rank.heldBack === "top500") return { fraction: 1, here, next: `Top 500 needs a top ${TOP_COUNT} place`, toNext: null };
  const up = nextDivision(rank.tier, rank.division);
  const floor = floorOf(rank.tier, rank.division);
  if (!up) return { fraction: 1, here, next: "Top division", toNext: null };
  const target = floorOf(up.tier, up.division);
  const span = Math.max(1, target - floor);
  const fraction = Math.max(0, Math.min(1, (rank.rating - floor) / span));
  const toNext = Math.max(0, target - Math.round(rank.rating));
  return { fraction, here, next: `${ratingText(toNext)} to ${divisionLabel(up.tier, up.division)}`, toNext };
}

/** A tier's rating range as the ladder writes it: "1,100 to 1,499", "2,400 and up". */
export function tierRange(tier: Tier): string {
  const i = TIERS.indexOf(tier);
  const up = TIERS[i + 1];
  const from = ratingText(TIER_FLOORS[tier][0]);
  return up ? `${from} to ${ratingText(TIER_FLOORS[up][0] - 1)}` : `${from} and up`;
}

/** "III 1,100, II 1,250, I 1,400" (DESIGN.md: commas, never " · "). */
export function tierFloorsText(tier: Tier): string {
  const [a, b, c] = TIER_FLOORS[tier];
  return `III ${ratingText(a)}, II ${ratingText(b)}, I ${ratingText(c)}`;
}

/** The CSS colour of a tier's name (tokens.css `--jz-tier-*`). */
export function tierColour(tier: Tier): string {
  return `var(--jz-tier-${tier})`;
}
