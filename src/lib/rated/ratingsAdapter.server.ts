/**
 * The one place W3b calls W3a's ratings (docs/rated/matchmaking-interface.md section 6; W3a's contract:
 * docs/rated/ratings-interface.md). Server only.
 *
 * W3b settles a match into a `RatedSettlement` (its own shape, with time used and the shown result) and hands W3a its
 * `RatedMatchResult` (src/lib/data/ratings.ts), built by `toRatingsResult`. The queue's rating comes from W3a's
 * `getMyRatings` (`matchRatingFrom`).
 *
 * Binding: `ratingsReady()` binds W3a's src/lib/rated/ratings.server.ts (getMyRatings, recordRatedMatch) on the
 * service-role client the first time rated play needs it (`bindW3aRatings`, W3a's START_RATING as the starting
 * rating and the beginners' bound); checks bind their own stand-in first with `setRatingsBackend`, which wins.
 */
import type { PlayerRatings, RatedGame, RatedMatchOutcome, RatedMatchResult, RatedPool } from "@/lib/data/ratings";
import { RATED_CATEGORIES, type RatedCategory } from "@/lib/data/ratings";
import { arcadeGroupOf, isRegisteredType } from "@/lib/duel/arcadeGroups";
import { puzzleDef } from "@/lib/duel/catalogue";
import type { Db } from "@/lib/data/db.server";
import type { PuzzleType } from "@/lib/duel/types";

import { FORMAT_GAMES, singlePickOf, type RatedChoice, type RatedFormat, type RatedGameMode, type RecordedSource, type Side } from "./matchmaking";

export interface MatchRating {
  /** The rating the match will move (a single-category choice blends that category's in). */
  rating: number;
  /** Still in placement: plays recorded runs from beginners first. */
  placement: boolean;
}

/** One player's side of a settled match. */
export interface SettledPlayer {
  userId: string;
  slot: number;
  ratingBefore: number;
  placement: boolean;
  /** The server's stored score in each game, in order (0 for a game with no stored answer). */
  scores: number[];
  /** Time used in each game (the room tie-break's, roundTimeUsedMs). */
  timesMs: number[];
  /** The server's stored grade `extra` in each game (null for no stored result): W3a's gradeExtras. */
  extras: (Record<string, unknown> | null)[];
  gamesWon: number;
  total: number;
}

/** W3b's settled match: what the result screens show and what W3a's result is built from. */
export interface RatedSettlement {
  matchId: string;
  format: RatedFormat;
  choice: RatedChoice;
  gameMode: RatedGameMode;
  kind: "live" | "recorded";
  rematchOf: string | null;
  finishedAt: string;
  players: SettledPlayer[];
  /** Each game: its type, its dealt version (gameVersionOf) and its winner (a: slot 1; b: slot 2 or the recorded run). */
  games: { type: string; signature: string; winner: Side }[];
  winner: Side;
  /** A recorded match: the run played against. */
  recorded: {
    ownerId: string;
    key: string;
    source: RecordedSource;
    fallback: boolean;
    scores: number[];
    timesMs: number[];
    /** The run's stored grade `extra` in each game. */
    extras: (Record<string, unknown> | null)[];
  } | null;
  /** 4 and 8 players: each player's final place (1 = first; leavers below everyone who stayed); null for a 1v1. */
  placings?: Record<string, number> | null;
  /**
   * How it ended when not by its games (Joe, 12 Nov 2026): a forfeit, and who left (in the order they went). The
   * screens say so; W3a gets it as the result's `forfeit`. Null (or missing) for an ordinary finish.
   */
  ending?: { kind: "forfeit"; leavers: string[] } | null;
  /** W3a's answer (null when nothing was bound to record it). */
  ratings: RatedMatchOutcome | null;
}

export interface RatingsBackend {
  matchRating(userId: string, option: { format: RatedFormat; choice: RatedChoice }): Promise<MatchRating | null>;
  /** Idempotent on the match id (W3a's "duplicate"). Throws on a passing failure (busy, error), so the settle retries. */
  recordRatedMatch(result: RatedMatchResult): Promise<RatedMatchOutcome>;
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
  startingRating: 1500,
  beginnerMax: 1500,
};

let backend: RatingsBackend | null = null;

export function setRatingsBackend(next: RatingsBackend | null): void {
  backend = next;
}

/** The bound backend, or UNBOUND_RATINGS before `ratingsReady()` has bound one. */
export function ratings(): RatingsBackend {
  return backend ?? UNBOUND_RATINGS;
}

/** The backend, binding W3a's ratings on first use (a stand-in set by a check is kept). */
export async function ratingsReady(): Promise<RatingsBackend> {
  if (backend) return backend;
  try {
    // getMyRatings from W3a's ratings, and finishRatedMatch from its rewards: recordRatedMatch, then the Joules through
    // D2's hook and C2's badges (W3a's interface: the match engine calls finishRatedMatch).
    const { getMyRatings } = await import("./ratings.server");
    const { finishRatedMatch } = await import("./rewards.server");
    const w3a: W3aRatings = { getMyRatings, recordRatedMatch: finishRatedMatch };
    const { START_RATING } = await import("./glicko.config");
    const { adminDb } = await import("@/lib/data/db.server");
    backend ??= bindW3aRatings(w3a, adminDb, START_RATING);
  } catch (error) {
    console.error("[rated] W3a's ratings couldn't be bound", error instanceof Error ? error.message : error);
    return UNBOUND_RATINGS;
  }
  return backend;
}

/* ------------------------------------------------------------------ W3a's shapes */

/** A game's pool and category as W3a works them out (pool by kind; category the puzzle category or arcade group). */
export function poolAndCategory(type: string): { pool: RatedPool; category: RatedCategory } | null {
  if (!isRegisteredType(type)) return null;
  let def;
  try {
    def = puzzleDef(type as PuzzleType);
  } catch {
    return null;
  }
  const category = def.category === "arcade" ? arcadeGroupOf(type as PuzzleType) : def.category;
  if (!category || !(RATED_CATEGORIES as readonly string[]).includes(category)) return null;
  return { pool: def.category === "arcade" ? "arcade" : "puzzles", category: category as RatedCategory };
}

/** W3a's format for ours. */
export function ratingsFormat(format: RatedFormat): RatedMatchResult["format"] {
  if (format === "ffa4") return { kind: "placings", players: 4 };
  if (format === "ffa8") return { kind: "placings", players: 8 };
  return { kind: "duel", bestOf: FORMAT_GAMES[format] as 3 | 5 | 7 };
}

/** W3a's result for a settled 1v1 (null when W3a can't take it: a single-category choice, or an unknown game). */
export function toRatingsResult(s: RatedSettlement): RatedMatchResult | null {
  if (s.choice !== "mixed" && s.choice !== "puzzles" && s.choice !== "arcade") return null;
  const forfeit = s.ending?.kind === "forfeit" && s.ending.leavers.length > 0 ? { forfeit: { leavers: [...s.ending.leavers] } } : {};
  // 4 and 8 players: every player live, decided by placings (leavers below everyone who stayed).
  if (!s.recorded && s.players.length > 2) {
    if (!s.placings) return null;
    const games: RatedGame[] = [];
    for (let i = 0; i < s.games.length; i++) {
      const g = s.games[i]!;
      const pc = poolAndCategory(g.type);
      if (!pc) return null;
      games.push({
        type: g.type,
        pool: pc.pool,
        category: pc.category,
        version: "classic",
        signature: g.signature,
        scores: Object.fromEntries(s.players.map((p) => [p.userId, p.scores[i] ?? 0])),
        gradeExtras: Object.fromEntries(s.players.map((p) => [p.userId, p.extras?.[i] ?? null])),
      });
    }
    return {
      matchId: s.matchId,
      format: ratingsFormat(s.format),
      choice: s.choice,
      players: s.players.map((p) => ({ playerId: p.userId, side: "live" as const })),
      games,
      placings: { ...s.placings },
      rematchOf: s.rematchOf,
      finishedAt: s.finishedAt,
      ...forfeit,
    };
  }
  const live = s.players[0];
  if (!live) return null;
  const other = s.recorded
    ? { playerId: s.recorded.ownerId, scores: s.recorded.scores, extras: s.recorded.extras }
    : s.players[1]
      ? { playerId: s.players[1].userId, scores: s.players[1].scores, extras: s.players[1].extras }
      : null;
  if (!other) return null;
  const games: RatedGame[] = [];
  for (let i = 0; i < s.games.length; i++) {
    const g = s.games[i]!;
    const pc = poolAndCategory(g.type);
    if (!pc) return null;
    games.push({
      type: g.type,
      pool: pc.pool,
      category: pc.category,
      version: "classic",
      signature: g.signature,
      scores: { [live.userId]: live.scores[i] ?? 0, [other.playerId]: other.scores[i] ?? 0 },
      // Each player's stored server grade for the game, as stored (W3a reads the server's flag from it).
      gradeExtras: { [live.userId]: live.extras?.[i] ?? null, [other.playerId]: other.extras?.[i] ?? null },
    });
  }
  return {
    matchId: s.matchId,
    format: ratingsFormat(s.format),
    choice: s.choice,
    players: [
      { playerId: live.userId, side: "live" },
      s.recorded
        ? { playerId: s.recorded.ownerId, side: "recorded", run: { runId: s.recorded.key, ownerId: s.recorded.ownerId, source: s.recorded.source } }
        : { playerId: other.playerId, side: "live" },
    ],
    games,
    rematchOf: s.rematchOf,
    finishedAt: s.finishedAt,
    ...forfeit,
  };
}

/** The rating a match will move, from W3a's ratings (unrated pools count as the starting rating). */
export function matchRatingFrom(r: PlayerRatings, choice: RatedChoice, startingRating: number): MatchRating {
  const placement = !r.placement.done;
  const pool = (key: RatedPool) => {
    const v = r.pools?.[key];
    return v && v.status === "rated" ? v.rating : startingRating;
  };
  let rating: number;
  if (choice === "puzzles") rating = pool("puzzles");
  else if (choice === "arcade") rating = pool("arcade");
  else if (choice === "mixed") rating = r.joulz ?? (pool("puzzles") + pool("arcade")) / 2;
  else {
    // A single category: that category's rating blended half and half with its pool's.
    const pick = singlePickOf(choice)!;
    const cat = r.categories?.[pick as RatedCategory];
    const catRating = cat && cat.status === "rated" ? cat.rating : null;
    const poolKey: RatedPool = (["retro", "sports", "cards", "action", "strategy"] as string[]).includes(pick) ? "arcade" : "puzzles";
    rating = catRating === null ? pool(poolKey) : (catRating + pool(poolKey)) / 2;
  }
  return { rating: Math.round(rating), placement };
}

/** What W3a's module gives (src/lib/rated/ratings.server.ts, its interface section "Server only"). */
export interface W3aRatings {
  getMyRatings(client: Db, userId: string): Promise<PlayerRatings>;
  recordRatedMatch(client: Db, result: RatedMatchResult): Promise<RatedMatchOutcome>;
}

/** A backend on W3a's functions and the service-role client. */
export function bindW3aRatings(api: W3aRatings, client: () => Promise<Db>, startingRating: number, beginnerMax = startingRating): RatingsBackend {
  return {
    startingRating,
    beginnerMax,
    matchRating: async (userId, option) => {
      try {
        return matchRatingFrom(await api.getMyRatings(await client(), userId), option.choice, startingRating);
      } catch {
        return null;
      }
    },
    recordRatedMatch: async (result) => {
      const outcome = await api.recordRatedMatch(await client(), result);
      if (!outcome.ok && (outcome.reason === "busy" || outcome.reason === "error")) throw new Error(`ratings: ${outcome.reason}`);
      return outcome;
    },
  };
}
