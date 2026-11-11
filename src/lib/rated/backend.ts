/**
 * The rated match screens' one way to the server (wave 3, session W3c). Every rated screen (Home's rank panel and Play
 * card, the picker, searching, VS, the live header in the room, the result, placement, the reveal, the tier ladder,
 * Profile's rating panels) reads through here, so W3a's and W3b's shapes are fitted in one place: `w3Binding.ts` turns
 * their server functions into this interface.
 *
 * - W3a (docs/rated/ratings-interface.md): getMyRatingsFn, getRatingsForFn, getTierLadderFn; each match's
 *   `RatedPlayerChange` (on W3b's settlement) for the rating moved, why it didn't (`frozen`), placement and Joules.
 * - W3b (docs/rated/matchmaking-interface.md): ratedStatusFn, ratedQueueJoinFn / PollFn / LeaveFn, ratedMatchFn,
 *   ratedOpponentScoreFn, ratedProgressFn, ratedSettleFn, ratedRematchFn. A match is an ordinary room on the existing
 *   room route.
 * - The cards: A2's getPublicCard (look), C2's getCardBadges (badges, title).
 *
 * Checks stand in for the server with `setRatedBackend(fake)` (scripts/rated-screens-check.tsx).
 */
import { checkOverride } from "@/lib/checkOverride";
import type { CardLook } from "@/design/identity";
import type { RatingKey, TierLadderRung } from "@/lib/data/ratings";
import type { RatedChoice, RatedFormat } from "@/lib/rated/matchmaking";

import type { RankView } from "./tierDisplay";

/* ------------------------------------------------------------------ what can be picked */

/** A pick is W3b's choice id: mixed, puzzles, arcade, or one category / arcade group. */
export type RatedPick = RatedChoice;
export type BestOf = 3 | 5 | 7;
export type MatchSize = 2 | 4 | 8;

/** What is switched on (W3b's `openOptions`). Launch: Mixed, All puzzles and All arcade, best of 3. */
export interface RatedOptions {
  picks: readonly RatedPick[];
  /** W3b's switched-on formats (bo3, bo5, bo7, ffa4, ffa8); `bestOf` and `sizes` are read from them. */
  formats: readonly RatedFormat[];
  bestOf: readonly BestOf[];
  sizes: readonly MatchSize[];
}

export function formatOf(bestOf: BestOf): RatedFormat {
  return bestOf === 3 ? "bo3" : bestOf === 5 ? "bo5" : "bo7";
}

/* ------------------------------------------------------------------ the player's standing */

/** A placement match's result (W3a's placement results, the same on every device). */
export type PlacementResult = "won" | "lost" | "drawn";

/** One side's (Puzzles' or Arcade's) rating; null while hidden (placement) or never played. */
export interface SideRating {
  rating: number | null;
  matches: number;
}

/** One category's or arcade group's rating (Profile's strongest categories, the picker's figures). */
export interface CategoryRating {
  pick: RatedPick;
  rating: number;
  matches: number;
}

export type RatedStanding =
  | {
      state: "placement";
      /** One entry per placement match played (0 to 4), in order. */
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
    };

export interface RatedStatus {
  /** Whether rated play is open to this player (W3b: testers only, or everyone once RATED_PLAY_FOR_EVERYONE is on). */
  open: boolean;
  /** No account: the player plays under their generated energy name with a Guest tag. */
  guest: boolean;
  /** The player's own card as rated screens draw it (rank null during placement). */
  me: RatedPlayer;
  options: RatedOptions;
  /** The current season (D2's pass), when there is one. */
  season: { name: string; daysLeft: number } | null;
  standing: RatedStanding;
  /** A match this player is in (W3b's activeMatchId), to go back to. */
  activeMatchId: string | null;
}

/* ------------------------------------------------------------------ a match */

export interface RatedPlayer {
  /** The auth user id (null for a run's owner whose account is gone). */
  userId: string | null;
  /** The username, a guest's energy name, or "Deleted player". */
  username: string;
  playerNumber: number | null;
  look: CardLook;
  /** The equipped title's name (C2), or null. */
  title: string | null;
  /** The card's badges (C2's slugs, up to 3). */
  badges: readonly string[];
  /** Null while in placement (or no rating to show). */
  rank: RankView | null;
  guest: boolean;
  deleted: boolean;
}

/** Live: both playing now. Recorded: a real player's stored run, always labelled, with its real age. */
export type OpponentSource = { kind: "live" } | { kind: "recorded"; label: string };

export interface RatedMatch {
  id: string;
  pick: RatedPick;
  /** W3b's format (the route picks its screens by it: formatScreens.tsx). */
  format: RatedFormat;
  bestOf: BestOf;
  roomCode: string | null;
  me: RatedPlayer;
  them: RatedPlayer;
  source: OpponentSource;
  /** The two players' record against each other before this match (W3b's ratedHeadToHeadFn; null: not shown). */
  headToHead: { won: number; lost: number; drawn?: number } | null;
  /** The placement match this is (1 to 5), else null. */
  placement: number | null;
}

/** Where a search has got to (mockup 03: the clock and the range, "±60"). */
export interface SearchProgress {
  elapsedMs: number;
  range: number;
  /** When a recorded run takes over (W3b's RECORDED_AFTER_MS, 8 s). */
  recordedAfterMs: number;
}

export interface RatedGame {
  type: string;
  myScore: number;
  theirScore: number;
}

export interface RatingMove {
  rating: number;
  change: number;
}

/** Why a match moved no ratings (W3a's `frozen`), as the result says it. */
export type FrozenLine = "under_review" | "same_opponent_today";

export interface RatedResult {
  match: RatedMatch;
  games: readonly RatedGame[];
  /** Games won by each side (a level game counts for neither). */
  myGames: number;
  theirGames: number;
  outcome: "won" | "lost" | "drawn";
  /** Null during placement (the rating is hidden until the reveal) and when nothing moved. */
  rating: { after: RankView; change: number; puzzles: RatingMove | null; arcade: RatingMove | null } | null;
  /** Why no rating moved, from W3a's answer. */
  frozen: FrozenLine | null;
  /** Placement's results including this match, while in placement. */
  placementResults: readonly PlacementResult[] | null;
  /** After the 5th placement match: the reveal. */
  reveal: {
    rank: RankView;
    /** "Better than N% of players" from the ladder's real shares; null when there are none yet. */
    betterThan: number | null;
    puzzles: SideRating;
    arcade: SideRating;
    won: number | null;
    lost: number | null;
  } | null;
  /** Joules this match paid (W3a's amount, credited by D2), with the pass level when known. */
  joules: { amount: number; passLevel: number | null } | null;
  /** A practice star earned in this match (C1a: only Practice runs earn one today), or null. */
  star: { type: string } | null;
  /** The game closest to the player's practice best, when within reach. */
  nearMiss: { type: string; offBest: number } | null;
  /** Whether the opponent is the player's friend (Challenge shows only then). */
  friend: boolean;
  /** Until when a rematch can be asked for (live matches, 8 s from the end), or null. */
  rematchUntil: string | null;
  /** Rating keys that moved, for checks and the reveal. */
  moved: readonly RatingKey[];
}

export type Refused = { ok: false; message: string };
export type RematchAnswer = { state: "waiting" } | { state: "agreed"; match: RatedMatch } | { state: "closed" };

/** The live header's opponent score (W3b's ratedOpponentScoreFn). */
export interface OpponentScoreView {
  round: number;
  score: number | null;
  hidden: boolean;
  finished: boolean;
}

/** The rated server, as the screens use it. */
export interface RatedBackend {
  status(): Promise<RatedStatus | null>;
  /** Searches; `progress` is called as the range widens; resolves with the match, a refusal, or null when cancelled. */
  search(pick: RatedPick, format: RatedFormat, progress: (p: SearchProgress) => void, signal: AbortSignal): Promise<RatedMatch | Refused | null>;
  /** A match by id (the room route's rated header and result). */
  match(matchId: string): Promise<RatedMatch | null>;
  /** The result once settled; null while the match is still playing. */
  result(matchId: string): Promise<RatedResult | null>;
  rematch(matchId: string): Promise<RematchAnswer>;
  /** The existing friend challenge flow, from this match's games: a challenge code to share. */
  challenge(matchId: string): Promise<{ ok: true; code: string } | Refused>;
  ladder(): Promise<TierLadderRung[] | null>;
  /** The rated match a room is (W3b's ratedRoomFn), for one of its players; null for an ordinary room. */
  roomMatch(roomId: string): Promise<{ matchId: string; format: RatedFormat } | null>;
  opponentScore(matchId: string): Promise<OpponentScoreView | null>;
  /** Display only: this player's live score in the current game, shown to a live opponent. */
  progress(matchId: string, round: number, score: number): Promise<void>;
}

let override: RatedBackend | null | undefined;

/** Checks only: stands in for the rated server (null: none; undefined: the real binding). */
export function setRatedBackend(backend: RatedBackend | null | undefined): void {
  override = backend;
}

let bound: Promise<RatedBackend | null> | null = null;

/**
 * Under automation (navigator.webdriver: the browser and happy-dom checks) the real binding stays off unless the page
 * allows it (`window.__DUELZ_ALLOW_RATED__`), as offline packs and safety notices do, so no existing check gains a
 * rated server call; a check stands in with setRatedBackend or the page override instead.
 */
function automatedWithoutRated(): boolean {
  if (typeof navigator === "undefined" || !navigator.webdriver) return false;
  // The check-only allow switch is ignored in a production build (Vite replaces PROD with true; checkOverride too).
  if (import.meta.env.PROD) return true;
  return checkOverride<boolean>("__DUELZ_ALLOW_RATED__") !== true;
}

/** The rated server: W3a's and W3b's functions through w3Binding.ts (null if they can't load). */
export function ratedBackend(): Promise<RatedBackend | null> {
  if (override !== undefined) return Promise.resolve(override);
  if (automatedWithoutRated()) return Promise.resolve(null);
  bound ??= import("./w3Binding").then((m) => m.bindW3()).catch(() => null);
  return bound;
}
