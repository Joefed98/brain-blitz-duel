/**
 * How the rated screens draw a tier (wave 3, session W3c), on W3a's tiers (src/lib/rated/tiers.ts, `TierView` from
 * src/lib/data/ratings.ts). Pure; nothing here decides a tier: the server's `TierView` says which tier and division a
 * player shows, the next step up and the points to it, a cap holding them back and the floor grace. This module only
 * turns that into the bar, the words and the emblem's props.
 */
import type { Tier } from "@/design/art/markup";
import type { Division as W3aDivision, TierId, TierLadderRung, TierView } from "@/lib/data/ratings";

import { TIER_DEFS } from "./tiers";

/** A standing as the screens draw it: W3a's tier view and the Joulz Rating it comes from. */
export type RankView = TierView & { rating: number };

/** The emblem's division (III = 3 … I = 1). */
export type Division = 1 | 2 | 3;
const DIV: Record<W3aDivision, Division> = { III: 3, II: 2, I: 1 };

/** The art's tier for a W3a tier (Top 500 wears Lightning's shield with its number). */
export function emblemTier(tier: TierId): Tier {
  return tier === "top500" ? "lightning" : tier;
}

export function emblemDivision(view: Pick<TierView, "division">): Division | undefined {
  return view.division ? DIV[view.division] : undefined;
}

/** "1,278": the grouping (even-width digits are the CSS's job). */
export function ratingText(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}

/** "+7", "−12", "0". */
export function changeText(n: number): string {
  const r = Math.round(n);
  if (r > 0) return `+${r}`;
  if (r < 0) return `−${Math.abs(r)}`;
  return "0";
}

export interface DivisionBar {
  /** 0 to 1 across the current division. */
  fraction: number;
  /** "Volt II". */
  here: string;
  /** "122 to Volt I", "Storm-rated, top 4%", "Kept for 2 more matches", "Top division". */
  next: string;
}

/** The floor of the division a view shows (Top 500: Lightning's top division). */
function divisionFloor(view: TierView): number | null {
  const def = TIER_DEFS.find((d) => d.tier === emblemTier(view.tier));
  if (!def) return null;
  const i = view.division ? ({ III: 0, II: 1, I: 2 } as const)[view.division] : 2;
  return def.at[i] ?? null;
}

/** The bar to the next division (mockups 01, 07, 13, 14), from the server's `next`. */
export function divisionBar(rank: RankView): DivisionBar {
  const here = rank.label;
  if (rank.heldBack) return { fraction: 1, here, next: rank.heldBack.label };
  if (rank.floorGrace) {
    const n = rank.floorGrace.matchesLeft;
    return { fraction: 0, here, next: `Kept for ${n} more ${n === 1 ? "match" : "matches"}` };
  }
  if (!rank.next) return { fraction: 1, here, next: "Top division" };
  const floor = divisionFloor(rank);
  const span = floor !== null ? rank.next.at - floor : 0;
  const fraction = span > 0 ? Math.max(0, Math.min(1, (Math.round(rank.rating) - floor!) / span)) : 0;
  return { fraction, here, next: `${ratingText(rank.next.pointsToGo)} to ${rank.next.label}` };
}

/** A rung's range: "1,100 to 1,499", "2,400 and up". */
export function rungRange(r: TierLadderRung): string {
  return r.to === null ? `${ratingText(r.from)} and up` : `${ratingText(r.from)} to ${ratingText(r.to)}`;
}

/** "III 1,100, II 1,250, I 1,400" (DESIGN.md: commas, never " · "). */
export function rungFloors(r: TierLadderRung): string {
  return r.divisions.map((d) => `${d.division} ${ratingText(d.at)}`).join(", ");
}

/** A share of players as the ladder writes it: "34%", "0.5%" (W3a gives 0–1). */
export function shareText(share: number): string {
  const pct = share * 100;
  if (pct > 0 && pct < 1) return `${Math.round(pct * 10) / 10}%`;
  return `${Math.round(pct)}%`;
}

/**
 * "Better than N% of players" from the ladder's real shares: the share of rated players in tiers below this one
 * (whole tiers only, never a guess inside a tier). Null without shares.
 */
export function betterThan(tier: TierId, rungs: readonly TierLadderRung[]): number | null {
  const order: TierId[] = ["spark", "charge", "volt", "surge", "storm", "lightning", "top500"];
  const at = order.indexOf(tier);
  const below = rungs.filter((r) => order.indexOf(r.tier) < at && r.tier !== "top500");
  if (!rungs.some((r) => r.share !== null)) return null;
  const sum = below.reduce((s, r) => s + (r.share ?? 0), 0);
  return Math.max(0, Math.min(99, Math.floor(sum * 100)));
}

/** The CSS colour of a tier's name (tokens.css `--jz-tier-*`). */
export function tierColour(tier: TierId): string {
  return `var(--jz-tier-${emblemTier(tier)})`;
}

export const PLACEMENT_MATCHES = 5;
