/**
 * The one place W3b calls W3a (docs/rated/matchmaking-interface.md section 6; W3a's side: docs/rated/ratings-interface.md).
 * Server only.
 *
 * Until W3a's ratings are merged in, nothing is bound: `matchRating` answers null, so the queue refuses with
 * "Rated play isn't ready yet" and no match is ever made or settled. The merge binds W3a's functions here with
 * `setRatingsBackend` (one line in `bindRatings` below); checks bind their own stand-in the same way.
 */
import type { RatedChoice, RatedFormat, RatedGameMode, RecordedSource, Side } from "./matchmaking";

export interface MatchRating {
  /** The rating the match will move (a single-category choice blends that category's in, on W3a's side). */
  rating: number;
  /** Still in placement: plays recorded runs from beginners first. */
  placement: boolean;
}

/** One player's side of a settled match. */
export interface RatedResultPlayer {
  userId: string;
  slot: number;
  ratingBefore: number;
  placement: boolean;
  /** The server's stored score in each game, in order (0 for a game with no stored answer). */
  scores: number[];
  /** Time used in each game (the room tie-break's, roundTimeUsedMs). */
  timesMs: number[];
  gamesWon: number;
  total: number;
}

/** The server's result of one match, handed to recordRatedMatch exactly once. */
export interface RatedMatchResult {
  matchId: string;
  format: RatedFormat;
  choice: RatedChoice;
  gameMode: RatedGameMode;
  kind: "live" | "recorded";
  /** The match this is a rematch of (W3a counts it towards the 4-a-day rule like any other). */
  rematchOf: string | null;
  finishedAt: string;
  players: RatedResultPlayer[];
  /** Each game: its type and its winner (a: slot 1, b: slot 2 or the recorded run). */
  games: { type: string; winner: Side }[];
  winner: Side;
  /** A recorded match: the run played against. Its owner's rating never moves. */
  recorded: {
    ownerId: string;
    key: string;
    source: RecordedSource;
    fallback: boolean;
    scores: number[];
    timesMs: number[];
    ownerMoves: false;
  } | null;
}

export interface RatingsBackend {
  matchRating(userId: string, option: { format: RatedFormat; choice: RatedChoice }): Promise<MatchRating | null>;
  /** Must be idempotent on result.matchId (a retry after a failure may call it again). */
  recordRatedMatch(result: RatedMatchResult): Promise<void>;
  /** An unrated recorded owner counts as this when choosing a run (W3a's starting rating). */
  startingRating: number;
  /** Placement opponents: recorded runs whose owner rating is at most this, or unrated. */
  beginnerMax: number;
}

/** Nothing bound: no ratings, so no rated play. */
export const UNBOUND_RATINGS: RatingsBackend = {
  matchRating: async () => null,
  recordRatedMatch: async () => {
    throw new Error("Ratings aren’t bound (W3a).");
  },
  startingRating: 1000,
  beginnerMax: 1000,
};

let backend: RatingsBackend = UNBOUND_RATINGS;

export function setRatingsBackend(next: RatingsBackend | null): void {
  backend = next ?? UNBOUND_RATINGS;
}

export function ratings(): RatingsBackend {
  return backend;
}
