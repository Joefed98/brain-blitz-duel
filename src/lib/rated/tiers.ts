/**
 * Tiers (wave 3, session W3a; the master plan's thresholds, as drawn on the approved tier ladder,
 * docs/mockups/wave-3/14-tier-ladder.html). Pure; shared by the phone and the server.
 *
 * Six tiers of three divisions (III up to I) from the Joulz Rating, then Top 500, numbered. Two caps, counted only
 * once there are CAPS_FROM_PLAYERS rated players (before that, tiers go by rating alone and there is no Top 500):
 * Storm (and above) needs 1,900+ and the top 3%; Top 500 needs Lightning and a top-500 rank. Dropping out of a capped
 * share keeps the tier for CAP_GRACE_DAYS; the standings job works that out (`stormOk` / `top500Ok`). A player held
 * back sees "Storm-rated, top 4%".
 *
 * Tier decisions read the rating as shown (rounded to a whole number), so a shown 1,900 is never Surge by rating.
 */

import type { Division, TierId, TierLadderRung, TierView } from "@/lib/data/ratings";

export const CAPS_FROM_PLAYERS = 1000;
export const STORM_TOP_SHARE = 0.03;
export const TOP_500 = 500;
export const CAP_GRACE_DAYS = 3;

interface TierDef {
  tier: Exclude<TierId, "top500">;
  name: string;
  /** Divisions III, II, I. */
  at: readonly [number, number, number];
}

export const TIER_DEFS: readonly TierDef[] = [
  { tier: "spark", name: "Spark", at: [100, 300, 500] },
  { tier: "charge", name: "Charge", at: [700, 850, 1000] },
  { tier: "volt", name: "Volt", at: [1100, 1250, 1400] },
  { tier: "surge", name: "Surge", at: [1500, 1650, 1800] },
  { tier: "storm", name: "Storm", at: [1900, 2050, 2200] },
  { tier: "lightning", name: "Lightning", at: [2400, 2550, 2700] },
];

const DIVISIONS: readonly Division[] = ["III", "II", "I"];

export const TIER_NAME: Record<TierId, string> = {
  spark: "Spark",
  charge: "Charge",
  volt: "Volt",
  surge: "Surge",
  storm: "Storm",
  lightning: "Lightning",
  top500: "Top 500",
};

/** A tier's order (spark 0 … lightning 5, top500 6), for "reached at least". */
export function tierRank(tier: TierId): number {
  return tier === "top500" ? TIER_DEFS.length : TIER_DEFS.findIndex((d) => d.tier === tier);
}

/** What the player's place in the standings allows (the standings job's answer; see ratings-check). */
export interface TierStanding {
  /** CAPS_FROM_PLAYERS or more rated players: the caps count. */
  capsActive: boolean;
  /** In the top 3% (or within the 3-day grace after dropping out). */
  stormOk: boolean;
  /** In the top 500 with Lightning (or within the grace). */
  top500Ok: boolean;
  /** Rank by Joulz Rating, 1 = top (null before the standings have counted this player). */
  rank: number | null;
  /** rank ÷ rated players (null as rank). */
  share: number | null;
}

/** The tier and division from the rating alone (no caps, no Top 500). */
export function tierFromRating(rating: number): { tier: Exclude<TierId, "top500">; division: Division } {
  const r = Math.round(rating);
  let found: TierDef = TIER_DEFS[0]!;
  for (const def of TIER_DEFS) if (r >= def.at[0]) found = def;
  let d = 0;
  for (let i = 0; i < 3; i++) if (r >= found.at[i]!) d = i;
  return { tier: found.tier, division: DIVISIONS[d]! };
}

function nextStep(rating: number): TierView["next"] {
  const r = Math.round(rating);
  for (const def of TIER_DEFS)
    for (let i = 0; i < 3; i++) {
      const at = def.at[i]!;
      if (at > r) return { label: `${def.name} ${DIVISIONS[i]!}`, at, pointsToGo: at - r };
    }
  return null;
}

/** "top 4%": the share rounded up to a whole percent (never "top 0%"). */
export function topShareLabel(share: number): string {
  return `top ${Math.max(1, Math.ceil(share * 100 - 1e-9))}%`;
}

/**
 * The tier a Joulz Rating shows. Without a standing (or with the caps not yet active) it goes by rating alone.
 */
export function tierFor(rating: number, standing?: TierStanding | null): TierView {
  const base = tierFromRating(rating);
  const name = (t: TierId) => TIER_NAME[t];
  const plain = (): TierView => ({
    tier: base.tier,
    division: base.division,
    label: `${name(base.tier)} ${base.division}`,
    rank: null,
    next: nextStep(rating),
    heldBack: null,
    floorGrace: null,
  });
  if (!standing || !standing.capsActive || tierRank(base.tier) < tierRank("storm")) return plain();
  if (!standing.stormOk) {
    // Held back: Surge I, with what the rating alone reaches.
    const share = standing.share === null ? "" : `, ${topShareLabel(standing.share)}`;
    return {
      tier: "surge",
      division: "I",
      label: "Surge I",
      rank: null,
      next: null,
      heldBack: { ratedTier: base.tier, label: `${name(base.tier)}-rated${share}` },
      floorGrace: null,
    };
  }
  if (base.tier === "lightning" && standing.top500Ok && standing.rank !== null)
    return { tier: "top500", division: null, label: `Top 500 #${standing.rank}`, rank: standing.rank, next: null, heldBack: null, floorGrace: null };
  return plain();
}

/* ------------------------------------------------------------------ the tier floor grace */

/**
 * The tier floor grace (the approved tier ladder: "Three matches of grace at every tier's floor"; Joe, 11 Nov 2026).
 * When the rating falls below the floor of the tier shown, the player keeps that tier (at its III division) through
 * FLOOR_GRACE_MATCHES more rated matches; still below after the last of them, the tier drops to what the rating gives.
 * Back at or above the floor, the grace ends. Only matches that counted advance it (a match frozen by the 4th-match
 * rule doesn't); the standings job can start it (a 90-day window moving) but never advances it. A drop by a cap
 * (Storm's top 3%, Top 500's rank) isn't a floor: the cap's own 3-day grace applies. Top 500 falling below 2,400 holds
 * Lightning.
 */
export const FLOOR_GRACE_MATCHES = 3;

/** The tier shown last and the grace's count (matches played below the floor since the fall; null when not in it). */
export interface ShownTierState {
  tier: TierId | null;
  floorGrace: number | null;
}

export function shownTierFor(
  prev: ShownTierState,
  rating: number,
  standing: TierStanding | null | undefined,
  /** This is a counted rated match (it advances the grace). */
  advance: boolean,
): { view: TierView; floorGrace: number | null } {
  const view = tierFor(rating, standing);
  if (!prev.tier || view.heldBack) return { view, floorGrace: null };
  const kept: Exclude<TierId, "top500"> = prev.tier === "top500" ? "lightning" : prev.tier;
  if (tierRank(tierFromRating(rating).tier) >= tierRank(kept)) return { view, floorGrace: null };
  const g = prev.floorGrace === null ? 0 : prev.floorGrace + (advance ? 1 : 0);
  if (g >= FLOOR_GRACE_MATCHES) return { view, floorGrace: null };
  const floor = TIER_DEFS.find((d) => d.tier === kept)!.at[0];
  return {
    view: {
      tier: kept,
      division: "III",
      label: `${TIER_NAME[kept]} III`,
      rank: null,
      next: { label: `${TIER_NAME[kept]} III`, at: floor, pointsToGo: Math.max(0, floor - Math.round(rating)) },
      heldBack: null,
      floorGrace: { matchesLeft: FLOOR_GRACE_MATCHES - g },
    },
    floorGrace: g,
  };
}

/** The ladder's rungs, top first (shares filled in by the server from the standings). */
export function tierLadder(shares: Partial<Record<TierId, number>> = {}): TierLadderRung[] {
  const rungs: TierLadderRung[] = [
    {
      tier: "top500",
      name: TIER_NAME.top500,
      from: TIER_DEFS[5]!.at[0],
      to: null,
      divisions: [],
      cap: "Lightning, and ranked 1 to 500",
      share: shares.top500 ?? null,
    },
  ];
  for (let i = TIER_DEFS.length - 1; i >= 0; i--) {
    const def = TIER_DEFS[i]!;
    const up = TIER_DEFS[i + 1];
    rungs.push({
      tier: def.tier,
      name: def.name,
      from: def.at[0],
      to: up ? up.at[0] - 1 : null,
      divisions: DIVISIONS.map((division, k) => ({ division, at: def.at[k]! })),
      cap: def.tier === "storm" ? "and top 3%" : null,
      share: shares[def.tier] ?? null,
    });
  }
  return rungs;
}
