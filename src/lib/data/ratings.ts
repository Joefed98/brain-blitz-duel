/**
 * Rated play: the shared types (wave 3, session W3a, the ratings engine; docs/rated/ratings-interface.md). Types only,
 * so a phone module can name them without reaching server code. The server's functions are in
 * src/lib/rated/ratings.server.ts (recordRatedMatch, getMyRatings, getRatingsFor, placementStatus), the pure rules in
 * src/lib/rated/ (glicko2.ts, match.ts, tiers.ts), the database calls in src/lib/data/ratings.server.ts.
 *
 * Nothing here is read by scoring, grading, replay or timing code. Every rating is the server's: the phone never
 * sends a rating, a result or a change.
 */

/** The two main pools. Each game moves one of them, by its kind (puzzle or arcade). */
export const RATED_POOLS = ["puzzles", "arcade"] as const;
export type RatedPool = (typeof RATED_POOLS)[number];

/** The 11 category ratings: the six puzzle categories and the five arcade groups. */
export const RATED_CATEGORIES = [
  "word",
  "number",
  "speed",
  "attention",
  "pattern",
  "logic",
  "retro",
  "sports",
  "cards",
  "action",
  "strategy",
] as const;
export type RatedCategory = (typeof RATED_CATEGORIES)[number];

/** Every rating a player has: the two pools and the 11 categories (the Joulz Rating is worked out from the pools). */
export type RatingKey = RatedPool | RatedCategory;
export const RATING_KEYS: readonly RatingKey[] = [...RATED_POOLS, ...RATED_CATEGORIES];

/** What the players chose to play: Mixed, All puzzles or All arcade. */
export const RATED_CHOICES = ["mixed", "puzzles", "arcade"] as const;
export type RatedChoice = (typeof RATED_CHOICES)[number];

/** A 1v1 best of 3, 5 or 7, or a 4- or 8-player match decided by placings. */
export type RatedFormat = { kind: "duel"; bestOf: 3 | 5 | 7 } | { kind: "placings"; players: 4 | 8 };

/** Where a recorded run came from. Only a run from a rated game moves its owner. */
export const RUN_SOURCES = ["rated", "room", "daily", "practice"] as const;
export type RunSource = (typeof RUN_SOURCES)[number];

/** The difficulty a rated game was dealt at. Difficulty by tier waits for wave 3.5: every rated game deals Classic. */
export const RATED_VERSIONS = ["classic"] as const;
export type RatedVersion = (typeof RATED_VERSIONS)[number];

/** One player in a finished match: playing live, or a recorded run standing in for its owner. */
export type RatedMatchPlayer =
  | { playerId: string; side: "live" }
  | {
      /** The run's owner (whose rating may move, at most half as much as live, only for a rated run). */
      playerId: string;
      side: "recorded";
      /**
       * `flagged`: the run's stored grade was flagged by the server (a backstop: W3b never records a flagged run). The
       * match then moves nobody's rating, as for any flag in `gradeExtras`.
       */
      run: { runId: string; ownerId: string; source: RunSource; flagged?: boolean };
    };

/** One game of the match, as the match engine stored it. */
export interface RatedGame {
  /** The game's id (a PuzzleType). The server works out its pool and category from it. */
  type: string;
  /** The pool and category the match engine says it moves; must agree with the server's own (else refused). */
  pool: RatedPool;
  category: RatedCategory;
  version: RatedVersion;
  /** The dealt signature of the puzzle every player played (dealtSignature / stampSignature). */
  signature: string;
  /** Each player's stored score for this game (the server's grade), keyed by playerId. */
  scores: Record<string, number>;
  /**
   * Each player's stored grade `extra` for this game, exactly as the server's grading stored it (keyed by playerId;
   * null or missing for none). The ratings engine reads the server's own flag from it (`extra.flagged === true`, set by
   * the server replay and anti-cheat, never by anything the phone sends): a flagged run anywhere in the match moves
   * nobody's rating.
   */
  gradeExtras?: Record<string, Record<string, unknown> | null>;
}

/** A finished rated match, from the match engine (W3b) on the server. */
export interface RatedMatchResult {
  /** The match's id (a uuid). recordRatedMatch is idempotent on it. */
  matchId: string;
  format: RatedFormat;
  choice: RatedChoice;
  players: RatedMatchPlayer[];
  /** In the order played. */
  games: RatedGame[];
  /** 4- and 8-player matches only: each player's final place, 1 = first; level players share a place. */
  placings?: Record<string, number>;
  /** A rematch: the match it follows (Revenge). */
  rematchOf?: string | null;
  /** When it finished (ISO); the server's time now when left out. */
  finishedAt?: string;
  /**
   * A forfeit (W3b, Joe 12 Nov 2026): the live players who were away for more than 20 s before the match was decided.
   * Each leaver takes a full loss and every player who stayed a full win, at the normal weight, whatever the games'
   * scores; it counts as a placement match and for streaks and badges like any result, and a leaver earns no Joules. A
   * 1v1 carrying a forfeit may end undecided (1–0, 1–1). In a 4- or 8-player match the leavers are placed below every
   * player who stayed. A flagged run still comes first (nobody moves). Left out (or empty) for an ordinary result.
   */
  forfeit?: { leavers: string[] };
}

/** A rating as shown. */
export interface RatingView {
  rating: number;
  /** Rating deviation (Glicko-2's RD, in rating points). */
  rd: number;
  /** Matches that moved this rating. */
  matches: number;
  /** A small provisional mark (the pool's first few matches). */
  provisional: boolean;
}

/** A pool or category: never played ("Not played yet", never counted against you) or rated. */
export type PoolView = { status: "not_played" } | ({ status: "rated" } & RatingView);

export const TIERS = ["spark", "charge", "volt", "surge", "storm", "lightning", "top500"] as const;
export type TierId = (typeof TIERS)[number];
export type Division = "III" | "II" | "I";

/** A tier as shown. */
export interface TierView {
  tier: TierId;
  /** null for Top 500 (numbered instead). */
  division: Division | null;
  /** "Volt II", "Top 500 #37". */
  label: string;
  /** Top 500's number. */
  rank: number | null;
  /** The next division or tier up and the points to it (null at the top, or when the next step is a capped one). */
  next: { label: string; at: number; pointsToGo: number } | null;
  /** Held back by a cap: what the rating alone reaches, e.g. "Storm-rated, top 4%". */
  heldBack: { ratedTier: TierId; label: string } | null;
  /**
   * The tier floor grace: the rating is below this tier's floor and the tier is kept for `matchesLeft` more rated
   * matches (shown at the tier's III division) before dropping; null when not in it.
   */
  floorGrace: { matchesLeft: number } | null;
}

export interface PlacementStatus {
  /** Placement matches played in this placement (0–5; 0–3 after a season reset). */
  played: number;
  /** 5 the first time; 3 in each new season after a season reset (wave 4 W4d, docs/seasons/README.md). */
  of: 5 | 3;
  done: boolean;
  /** "Placement 1 of 5" / "Placement 2 of 3" (the next one to play), or null once done. */
  label: string | null;
  /** Each placement match played so far, in order (1 first): the five placement boxes' tick or cross. */
  results: PlacementResult[];
}

/** One placement match, as stored when it was recorded (rated_match_players.placement_no). */
export interface PlacementResult {
  /** 1–5. */
  n: number;
  matchId: string;
  result: "win" | "loss" | "draw";
  /** When it finished (ISO). */
  at: string;
}

/** A player's ratings as the phone sees them. During placement every rating is hidden (null / not shown). */
export interface PlayerRatings {
  playerId: string;
  placement: PlacementStatus;
  /** The Joulz Rating; null until placement is done. */
  joulz: number | null;
  /** The tier; null until placement is done. */
  tier: TierView | null;
  /** null while in placement. */
  pools: Record<RatedPool, PoolView> | null;
  categories: Record<RatedCategory, PoolView> | null;
}

export type RatedRefusal =
  | "bad_match"
  | "bad_format"
  | "bad_players"
  | "bad_games"
  | "bad_placings"
  | "pool_mismatch"
  | "busy"
  | "error";

/** Why a player's ratings didn't move. `flagged_run`: a run in the match (anyone's) was flagged by the server. */
export type FrozenReason = "same_opponent_today" | "recorded_unrated_source" | "recorded_daily_limit" | "flagged_run";

export interface RatingChange {
  key: RatingKey;
  before: number;
  after: number;
  delta: number;
  rdBefore: number;
  rdAfter: number;
}

export interface RatedPlayerChange {
  playerId: string;
  side: "live" | "recorded";
  /** false when nothing moved (see `frozen`). */
  moved: boolean;
  frozen: FrozenReason | null;
  /** Each rating that moved. */
  changes: RatingChange[];
  joulz: { before: number | null; after: number | null };
  placement: PlacementStatus & { justFinished: boolean };
  tier: { before: TierView | null; after: TierView | null };
  /** "win" | "loss" | "draw" for a 1v1; the place for 4 and 8 players ("win" for first). */
  result: "win" | "loss" | "draw";
  place: number | null;
  /** Joules this match pays (live players only, never a flagged player; credited by D2's pass under ratedJoulesKey). */
  joules: number;
  /** This player's run was flagged by the server in this match (the match logged for review). */
  flagged: boolean;
  /** Competitive badges newly awarded. */
  badges: string[];
}

export type RatedMatchOutcome =
  | { ok: true; status: "recorded" | "duplicate"; matchId: string; players: RatedPlayerChange[] }
  | { ok: false; reason: RatedRefusal; message: string };

/** One rung of the tier ladder. */
export interface TierLadderRung {
  tier: TierId;
  name: string;
  /** Rating range (Top 500: Lightning's, and a rank of 1–500). */
  from: number;
  to: number | null;
  divisions: { division: Division; at: number }[];
  /** The cap's words ("and top 3%"), or null. */
  cap: string | null;
  /** The share of rated players in it (null until the standings have run). */
  share: number | null;
}
