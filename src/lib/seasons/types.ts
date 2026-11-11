/**
 * Seasons as the phone sees them (wave 4, session W4d; docs/seasons/README.md). Types only.
 */
import type { TierId } from "@/lib/data/ratings";

/** The season the player is in now, from their stored rated matches (real data only). */
export interface CurrentSeason {
  season: string;
  name: string;
  /** The testers' season. */
  test: boolean;
  /** The emblem's mark ("S1"). */
  mark: string;
  ratedMatches: number;
  placementDone: boolean;
  /** The peak tier actually held so far, and its label ("Storm II"); null before any tier is held. */
  peak: TierId | null;
  peakLabel: string | null;
}

/** A season reward granted at a season's end. */
export interface SeasonHistoryEntry {
  season: string;
  name: string;
  test: boolean;
  mark: string;
  tier: TierId;
  peakLabel: string;
  ratedMatches: number;
  frame: string | null;
  title: string | null;
  grantedAt: string;
  /** The in-app notice has been shown. */
  seen: boolean;
}

export type MySeasons =
  | { account: true; current: CurrentSeason | null; history: SeasonHistoryEntry[] }
  | { account: false };
