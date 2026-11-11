/**
 * The rated match screens' one way to the server (wave 3, session W3c). Every rated screen (Home's rank panel and
 * Play card, the picker, searching, VS, the live header, the result, placement, the reveal, the tier ladder, Profile's
 * rating panels) reads through here and nowhere else, so the ratings work's and matchmaking's exact shapes are fitted
 * in one place.
 *
 * PROVISIONAL CONTRACT. The ratings session (W3a, docs/rated/ratings-interface.md) and the matchmaking session (W3b,
 * docs/rated/matchmaking-interface.md) own the real interfaces; neither had opened its PR when this was written. These
 * types are what the screens need, drawn from the approved mockups (docs/mockups/wave-3/). When those PRs land, a
 * binding module (`w3Binding.ts`, beside this file, as A2's a1Binding.ts does for A1) adapts their functions to
 * `RatedBackend`; until then `ratedBackend()` answers null, so rated play stays hidden for everyone and Home is today's.
 *
 * Checks stand in for the server with `setRatedBackend(fake)` (scripts/rated-screens-check.tsx).
 */
import type { ReactNode } from "react";

import type { CardLook } from "@/design/identity";
import type { PuzzleType } from "@/lib/duel/types";

import type { RankView } from "./tiers";

/* ------------------------------------------------------------------ what can be picked */

/**
 * A pick: Mixed, All puzzles, All arcade, or one category / arcade group as `cat:<id>` (a puzzle category id or an
 * arcade group id). Which are offered is matchmaking's switches (W3b); the picker draws only those.
 */
export type RatedPick = "mixed" | "puzzles" | "arcade" | `cat:${string}`;
export type BestOf = 3 | 5 | 7;
export type MatchSize = 2 | 4 | 8;

/** What is switched on (W3b). Launch: Mixed, All puzzles and All arcade, best of 3, 1v1. */
export interface RatedOptions {
  picks: readonly RatedPick[];
  bestOf: readonly BestOf[];
  sizes: readonly MatchSize[];
}

/* ------------------------------------------------------------------ the player's standing */

export type PlacementResult = "won" | "lost";

/** One side's (Puzzles' or Arcade's) rating; null while hidden (placement) or before a match of that side. */
export interface SideRating {
  rating: number | null;
  matches: number;
}

/** One category's or arcade group's rating (Profile's strongest categories, the picker's figures). */
export interface CategoryRating {
  pick: `cat:${string}`;
  rating: number;
  matches: number;
}

export type RatedStanding =
  | {
      state: "placement";
      /** The placement matches played so far, in order (0 to 4 of them). */
      results: readonly PlacementResult[];
      puzzles: SideRating;
      arcade: SideRating;
    }
  | {
      state: "placed";
      rank: RankView;
      puzzles: SideRating;
      arcade: SideRating;
      categories: readonly CategoryRating[];
      won: number;
      lost: number;
    };

export interface RatedStatus {
  /** Whether rated play is open to this player (W3b's switch, testers only at first). */
  open: boolean;
  /** The player's own card as rated screens draw it (rank null during placement). */
  me: RatedPlayer;
  options: RatedOptions;
  /** The current season, when there is one. */
  season: { name: string; daysLeft: number } | null;
  standing: RatedStanding;
  /** The pick the player last played (the Play card's default), when it's still switched on. */
  lastPick: RatedPick | null;
}

/* ------------------------------------------------------------------ a match */

export interface RatedPlayer {
  username: string;
  playerNumber: number;
  look: CardLook;
  /** The equipped title (C2), or null. */
  title: string | null;
  /** Null while the player is in placement. */
  rank: RankView | null;
}

/** Live: both playing now. Recorded: a real player's stored run, always labelled, with its real age. */
export type OpponentSource = { kind: "live" } | { kind: "recorded"; recordedAt: string };

export interface RatedMatch {
  id: string;
  pick: RatedPick;
  bestOf: BestOf;
  me: RatedPlayer;
  them: RatedPlayer;
  source: OpponentSource;
  /** The two players' record against each other before this match. */
  headToHead: { won: number; lost: number };
  /** 1 to 5 during placement, else null. */
  placement: number | null;
}

/** Where a search has got to (mockup 03: the clock and the range, "±60"). */
export interface SearchProgress {
  elapsedMs: number;
  range: number;
  /** When a recorded run takes over (mockup 03: 8 s). */
  recordedAfterMs: number;
}

export interface RatedGame {
  type: PuzzleType;
  myScore: number;
  theirScore: number;
}

export interface RatingMove {
  rating: number;
  change: number;
}

export interface RatedResult {
  match: RatedMatch;
  games: readonly RatedGame[];
  /** Games won by each side (a level game counts for neither). */
  myGames: number;
  theirGames: number;
  won: boolean;
  /** Null during placement (the rating is hidden until the reveal). */
  rating: { after: RankView; change: number; puzzles: RatingMove | null; arcade: RatingMove | null } | null;
  /** Placement's results so far including this match, while in placement. */
  placementResults: readonly PlacementResult[] | null;
  /** After the 5th placement match: the reveal. */
  reveal: {
    rank: RankView;
    /** "Better than N% of players" from the ladder's real counts; null when the server has too few players to say. */
    betterThan: number | null;
    puzzles: SideRating;
    arcade: SideRating;
    won: number;
    lost: number;
  } | null;
  /** Joules earned for the season pass (D2), with the pass level reached, or null. */
  joules: { amount: number; passLevel: number | null } | null;
  /** A practice star earned in this match (C1a: 175+ in a game), or null. */
  star: { type: PuzzleType } | null;
  /** The game closest to the player's best, when within reach (DESIGN.md: "12 off your best on Chroma Lines"). */
  nearMiss: { type: PuzzleType; offBest: number } | null;
  /** Whether the opponent is the player's friend (Challenge shows only then). */
  friend: boolean;
  /** Until when a rematch can be offered (8 s after the result), or null when it can't (a recorded run). */
  rematchUntil: string | null;
}

/** Each tier's share of placed players and the Top 500's count, from the server's real counts. */
export interface LadderCounts {
  /** Percent of placed players in each tier (null when too few to say). */
  shares: Partial<Record<RankView["tier"], number>> | null;
  /** Players holding a Top 500 place (up to 500). */
  top500: number;
}

export type Refused = { ok: false; message: string };

/** The rated server, as the screens use it. */
export interface RatedBackend {
  status(): Promise<RatedStatus | null>;
  /** Searches; `progress` is called as the range widens; resolves with the match, or null when cancelled. */
  search(pick: RatedPick, bestOf: BestOf, progress: (p: SearchProgress) => void, signal: AbortSignal): Promise<RatedMatch | Refused | null>;
  result(matchId: string): Promise<RatedResult | null>;
  rematch(matchId: string): Promise<RatedMatch | Refused | null>;
  /** The existing friend challenge flow, from this match's games: a challenge code to share. */
  challenge(matchId: string): Promise<{ ok: true; code: string } | Refused>;
  ladder(): Promise<LadderCounts | null>;
  /**
   * The live games of a match (mockups 05 and 06): the round runner the ratings work binds (the shared round engine's
   * rated mode), with RatedFrameScore (src/components/rated/RatedFrameScore.tsx) as each game's header score and no
   * other layout change. `done` is called when the last game's result is in.
   */
  renderGame(match: RatedMatch, done: () => void): ReactNode;
}

let override: RatedBackend | null | undefined;

/** Checks only: stands in for the rated server (null: none). */
export function setRatedBackend(backend: RatedBackend | null | undefined): void {
  override = backend;
}

/**
 * The rated server, or null. Null until the W3a / W3b binding lands (see the header): every rated screen then stays
 * hidden and Home, Profile and the card are exactly as before.
 */
export function ratedBackend(): Promise<RatedBackend | null> {
  if (override !== undefined) return Promise.resolve(override);
  return Promise.resolve(null);
}
