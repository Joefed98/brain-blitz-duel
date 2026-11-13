/**
 * Seasons: the pure rules (wave 4, session W4d; docs/seasons/README.md), shared by the phone and the server. The
 * database holds the same rules (supabase/migrations/20261115400000_seasons.sql: public.season_reset_rating,
 * pass.season_close_run); seasons-check proves they agree.
 *
 * Nothing here is read by scoring, grading, replay, matchmaking or timing code.
 */
import type { TierId } from "@/lib/data/ratings";

/* ------------------------------------------------------------------ the reset */

/**
 * At a season's end every rating (Puzzles, Arcade and each category) moves `pull` of the way back towards the average
 * of rated players, and its uncertainty widens `pull` of the way back towards the starting `startRd` (never narrower
 * than it was). The Joulz Rating is then worked out again from the pools.
 */
export const SEASON_RESET = { pull: 1 / 3, startRd: 350 } as const;

export interface RatingPoint {
  rating: number;
  rd: number;
}

/** One rating after the reset (public.season_reset_rating). */
export function seasonResetRating(point: RatingPoint, average: number): RatingPoint {
  const rating = point.rating + (average - point.rating) * SEASON_RESET.pull;
  const widened = point.rd + (SEASON_RESET.startRd - point.rd) * SEASON_RESET.pull;
  return { rating, rd: Math.min(SEASON_RESET.startRd, Math.max(point.rd, widened)) };
}

/** The average the reset pulls towards: the mean of the rated players' ratings (null when nobody is rated). */
export function ratedAverage(ratings: readonly number[]): number | null {
  if (!ratings.length) return null;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}

/* ------------------------------------------------------------------ placement */

/** A player's first placement. */
export const FIRST_PLACEMENT_MATCHES = 5;
/** Each new season after a reset. */
export const SEASON_PLACEMENT_MATCHES = 3;

/** "Placement 2 of 3" (the next match to play), or null once done. */
export function placementLabel(played: number, of: number): string | null {
  if (played >= of) return null;
  return `Placement ${Math.max(0, played) + 1} of ${of}`;
}

/** The reveal at the end of placement: the full first one, or the smaller one after a season reset (W3c's screens). */
export function placementReveal(of: number): "full" | "small" {
  return of < FIRST_PLACEMENT_MATCHES ? "small" : "full";
}

/* ------------------------------------------------------------------ rewards */

export const SEASON_TIERS = ["spark", "charge", "volt", "surge", "storm", "lightning", "top500"] as const satisfies readonly TierId[];

export const SEASON_TIER_NAMES: Record<TierId, string> = {
  spark: "Spark",
  charge: "Charge",
  volt: "Volt",
  surge: "Surge",
  storm: "Storm",
  lightning: "Lightning",
  top500: "Top 500",
};

/** The fewest rated matches in a season for its reward (placement finished as well). */
export const REWARD_MIN_RATED_MATCHES = 10;

export function tierRank(tier: TierId): number {
  return SEASON_TIERS.indexOf(tier);
}

/** The peak tier actually held: the highest shown tier (a cap-held "Storm-rated" player shows Surge, so it is Surge). */
export function peakTier(held: readonly (TierId | null)[]): TierId | null {
  let best: TierId | null = null;
  for (const t of held) if (t && (best === null || tierRank(t) > tierRank(best))) best = t;
  return best;
}

export interface SeasonStanding {
  placementDone: boolean;
  ratedMatches: number;
  peak: TierId | null;
}

/** Earned by every player who finished placement and played at least 10 rated matches that season. */
export function eligibleForReward(s: SeasonStanding): boolean {
  return s.placementDone && s.ratedMatches >= REWARD_MIN_RATED_MATCHES && s.peak !== null;
}

const SUFFIX = (tier: TierId) => (tier === "top500" ? "top-500" : tier);

/** Animated Season 1 frames (catalogue.json). */
export const ANIMATED_SEASON_TIERS: readonly TierId[] = ["storm", "lightning", "top500"];

export interface SeasonReward {
  tier: TierId;
  /** The emblem: the approved tier emblem with the season's mark ("S1"). */
  emblem: { tier: TierId; mark: string };
  /** The catalogue's frame (frame.s1-storm). */
  frame: string;
  /** The tier's card art (card-art.tier.storm; Joe, 11 Nov 2026), kept forever once owned. */
  cardArt: string;
  /** public.titles id and name ("s1-storm", "S1 Storm"). */
  title: { id: string; name: string };
}

/** Season 1's reward for a peak tier (the testers' season pays the same). */
export function season1Reward(tier: TierId): SeasonReward {
  return {
    tier,
    emblem: { tier, mark: "S1" },
    frame: `frame.s1-${SUFFIX(tier)}`,
    cardArt: `card-art.tier.${SUFFIX(tier)}`,
    title: { id: `s1-${SUFFIX(tier)}`, name: `S1 ${SEASON_TIER_NAMES[tier]}` },
  };
}

/** The seven Season 1 titles, in tier order (public.titles kind 'season'). */
export const SEASON_1_TITLES: readonly { id: string; name: string }[] = SEASON_TIERS.map((t) => season1Reward(t).title);

/** The seven Season 1 frames, in tier order. */
export const SEASON_1_FRAMES: readonly string[] = SEASON_TIERS.map((t) => season1Reward(t).frame);
