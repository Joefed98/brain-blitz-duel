/**
 * One rated match, worked out from what the server stores (wave 3, session W3a; docs/rated/README.md). Pure: given
 * each player's state before the match, it answers every rating's new value, the placement, the Joulz Rating, the
 * tier, the competitive badges' facts and the Joules. ratings.server.ts reads the state and stores the answer in one
 * transaction (src/lib/data/ratings.server.ts); ratings-check runs this module on simulated players.
 *
 * Nothing here reads a rating, a result or a change from the phone: the match result comes from the match engine on
 * the server, and every pool and category is the server's own (`gamePool` / `gameCategory`).
 */

import type {
  FrozenReason,
  PlacementStatus,
  RatedCategory,
  RatedChoice,
  RatedFormat,
  RatedGame,
  RatedMatchPlayer,
  RatedMatchResult,
  RatedPlayerChange,
  RatedPool,
  RatedRefusal,
  RatingChange,
  RatingKey,
  TierId,
  TierView,
} from "@/lib/data/ratings";
import { RATED_CATEGORIES, RATED_CHOICES, RATED_POOLS, RATED_VERSIONS, RATING_KEYS, RUN_SOURCES } from "@/lib/data/ratings";
import { arcadeGroupOf } from "@/lib/duel/arcadeGroups";
import { ARCADE_CATEGORY, isLiveType, isRetired, puzzleInfo } from "@/lib/duel/catalogue";
import { ukDayKey } from "@/lib/duel/daily";

import {
  GAME_WEIGHT,
  JOULZ_WINDOW_DAYS,
  MIXED_POOL_FACTOR,
  PLACEMENT_MATCHES,
  PROVISIONAL_MATCHES,
  RECORDED_OWNER_FACTOR,
  RUN_USES_PER_DAY,
  SAME_OPPONENT_FREEZE_FROM,
  START_RATING,
  START_RD,
} from "./glicko.config";
import { glickoUpdate, idleDays, newGlickoState, rdAfterIdle, type GlickoResult, type GlickoState } from "./glicko2";
import { ratedMatchJoules } from "./joules";
import { tierFor, tierRank, type TierStanding } from "./tiers";

/* ------------------------------------------------------------------ the server's pool and category for a game */

/** Puzzles or Arcade, from the game's own category. */
export function gamePool(type: string): RatedPool | null {
  if (!isLiveType(type)) return null;
  return puzzleInfo(type).category === ARCADE_CATEGORY ? "arcade" : "puzzles";
}

/** The game's category rating: its puzzle category, or its arcade group (main category only). */
export function gameCategory(type: string): RatedCategory | null {
  if (!isLiveType(type)) return null;
  const cat = puzzleInfo(type).category;
  const key = cat === ARCADE_CATEGORY ? arcadeGroupOf(type) : cat;
  return key && (RATED_CATEGORIES as readonly string[]).includes(key) ? (key as RatedCategory) : null;
}

/* ------------------------------------------------------------------ checking the match */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export type Checked = { ok: true; match: RatedMatchResult; finishedMs: number } | { ok: false; reason: RatedRefusal };

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Checks a match result's shape and that every game's pool and category are the server's own. */
export function checkMatch(input: unknown, nowMs: number): Checked {
  if (!input || typeof input !== "object") return { ok: false, reason: "bad_match" };
  const m = input as Partial<RatedMatchResult>;
  if (!isUuid(m.matchId)) return { ok: false, reason: "bad_match" };
  if (!(RATED_CHOICES as readonly string[]).includes(m.choice as string)) return { ok: false, reason: "bad_match" };
  const f = m.format as RatedFormat | undefined;
  const fmtOk =
    !!f &&
    ((f.kind === "duel" && [3, 5, 7].includes(f.bestOf)) || (f.kind === "placings" && [4, 8].includes(f.players)));
  if (!fmtOk) return { ok: false, reason: "bad_format" };
  const players = m.players;
  const want = f.kind === "duel" ? 2 : f.players;
  if (!Array.isArray(players) || players.length !== want) return { ok: false, reason: "bad_players" };
  const ids = new Set<string>();
  for (const p of players as RatedMatchPlayer[]) {
    if (!p || !isUuid(p.playerId) || ids.has(p.playerId)) return { ok: false, reason: "bad_players" };
    ids.add(p.playerId);
    if (p.side === "recorded") {
      const r = p.run;
      if (!r || typeof r.runId !== "string" || !r.runId || r.runId.length > 80 || r.ownerId !== p.playerId) return { ok: false, reason: "bad_players" };
      if (!(RUN_SOURCES as readonly string[]).includes(r.source)) return { ok: false, reason: "bad_players" };
    } else if (p.side !== "live") return { ok: false, reason: "bad_players" };
  }
  if (!players.some((p) => p.side === "live")) return { ok: false, reason: "bad_players" };
  const games = m.games;
  const maxGames = f.kind === "duel" ? f.bestOf : 12;
  if (!Array.isArray(games) || games.length < 1 || games.length > maxGames) return { ok: false, reason: "bad_games" };
  for (const g of games as RatedGame[]) {
    if (!g || typeof g.type !== "string" || isRetired(g.type as never) || !isLiveType(g.type)) return { ok: false, reason: "bad_games" };
    if (!(RATED_POOLS as readonly string[]).includes(g.pool) || !(RATED_CATEGORIES as readonly string[]).includes(g.category))
      return { ok: false, reason: "bad_games" };
    if (!(RATED_VERSIONS as readonly string[]).includes(g.version)) return { ok: false, reason: "bad_games" };
    if (typeof g.signature !== "string" || g.signature.length > 400) return { ok: false, reason: "bad_games" };
    if (!g.scores || typeof g.scores !== "object") return { ok: false, reason: "bad_games" };
    for (const id of ids) if (!finite(g.scores[id])) return { ok: false, reason: "bad_games" };
    if (Object.keys(g.scores).some((k) => !ids.has(k))) return { ok: false, reason: "bad_games" };
    if (gamePool(g.type) !== g.pool || gameCategory(g.type) !== g.category) return { ok: false, reason: "pool_mismatch" };
    if (m.choice === "puzzles" && g.pool !== "puzzles") return { ok: false, reason: "pool_mismatch" };
    if (m.choice === "arcade" && g.pool !== "arcade") return { ok: false, reason: "pool_mismatch" };
  }
  if (f.kind === "placings") {
    const pl = m.placings;
    if (!pl || typeof pl !== "object") return { ok: false, reason: "bad_placings" };
    if (Object.keys(pl).length !== ids.size || [...ids].some((id) => !Number.isInteger(pl[id]) || pl[id]! < 1 || pl[id]! > ids.size))
      return { ok: false, reason: "bad_placings" };
    // A place is the number of players strictly ahead plus one (1, 2, 2, 4).
    const vals = [...ids].map((id) => pl[id]!);
    if (vals.some((v) => v !== vals.filter((w) => w < v).length + 1)) return { ok: false, reason: "bad_placings" };
  } else if (m.placings !== undefined && m.placings !== null) return { ok: false, reason: "bad_placings" };
  if (m.rematchOf !== undefined && m.rematchOf !== null && !isUuid(m.rematchOf)) return { ok: false, reason: "bad_match" };
  let finishedMs = nowMs;
  if (m.finishedAt !== undefined) {
    const t = Date.parse(String(m.finishedAt));
    // The match engine's own time, held near the server's (never in the future, never more than a day old).
    if (!Number.isFinite(t) || t > nowMs + 60_000 || t < nowMs - 86_400_000) return { ok: false, reason: "bad_match" };
    finishedMs = Math.min(t, nowMs);
  }
  return { ok: true, match: m as RatedMatchResult, finishedMs };
}

/* ------------------------------------------------------------------ state before and after */

/** A player's overall rated record (one row, public.rated_profiles). */
export interface RatedProfileState {
  /** Placement matches played (counts to PLACEMENT_MATCHES). */
  placementPlayed: number;
  /** Live rated matches that counted (not frozen against everyone). */
  matches: number;
  wins: number;
  winStreak: number;
  bestWinStreak: number;
  comebacks: number;
  cleanSweeps: number;
  podiums: number;
  giantSlayers: number;
  revenges: number;
  photoFinishes: number;
  /** The Joulz Rating (null until placement is done). */
  joulz: number | null;
  shownTier: TierId | null;
  peakTier: TierId | null;
  top500Ever: boolean;
}

export function newProfileState(): RatedProfileState {
  return {
    placementPlayed: 0,
    matches: 0,
    wins: 0,
    winStreak: 0,
    bestWinStreak: 0,
    comebacks: 0,
    cleanSweeps: 0,
    podiums: 0,
    giantSlayers: 0,
    revenges: 0,
    photoFinishes: 0,
    joulz: null,
    shownTier: null,
    peakTier: null,
    top500Ever: false,
  };
}

export interface PlayerPre {
  profile: RatedProfileState;
  ratings: Partial<Record<RatingKey, GlickoState>>;
  /** Live rated games in the last JOULZ_WINDOW_DAYS before this match, by pool. */
  recentGames: Record<RatedPool, number>;
  standing: TierStanding | null;
}

export interface MatchContext {
  nowMs: number;
  /** Rated matches between two live players today before this one, by pairKey. */
  pairCounts: Record<string, number>;
  /** Uses of each recorded run today before this one. */
  runUsesToday: Record<string, number>;
  /** For a rematch: who beat whom in the match it follows (loser → the winners), from stored history. */
  rematchLosses: Record<string, string[]>;
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export interface PlayerAfter {
  playerId: string;
  profile: RatedProfileState;
  ratings: Partial<Record<RatingKey, GlickoState>>;
  /** The ratings that moved (written back). */
  moved: RatingKey[];
  change: RatedPlayerChange;
  /** Live games this match counted, by pool (the Joulz Rating's 90-day shares). */
  games: Record<RatedPool, number>;
  /** Whether the match counted for this player (live and not frozen against everyone). */
  counted: boolean;
}

export interface MatchAfter {
  ukDay: string;
  players: PlayerAfter[];
  /** Pairs of live players whose count goes up (every pair of live players, frozen or not). */
  pairs: string[];
  /** Recorded runs used, and whether each moved its owner. */
  runUses: { runId: string; ownerId: string; moved: boolean }[];
}

/* ------------------------------------------------------------------ the Joulz Rating */

/**
 * Puzzles and Arcade weighted by the share of rated games in each over the last 90 days; equal weight with no recent
 * play. A pool never played never counts (it has no rating). Null with neither.
 */
export function joulzRating(
  pools: Partial<Record<RatedPool, { rating: number } | undefined>>,
  recent: Record<RatedPool, number>,
): number | null {
  const played = RATED_POOLS.filter((p) => pools[p]);
  if (!played.length) return null;
  const n = played.reduce((s, p) => s + Math.max(0, recent[p] ?? 0), 0);
  if (n <= 0) return played.reduce((s, p) => s + pools[p]!.rating, 0) / played.length;
  return played.reduce((s, p) => s + pools[p]!.rating * Math.max(0, recent[p] ?? 0), 0) / n;
}

export const JOULZ_WINDOW_MS = JOULZ_WINDOW_DAYS * 86_400_000;

/* ------------------------------------------------------------------ placement */

export function placementOf(played: number): PlacementStatus {
  const p = Math.min(PLACEMENT_MATCHES, Math.max(0, played));
  const done = p >= PLACEMENT_MATCHES;
  return { played: p, of: PLACEMENT_MATCHES, done, label: done ? null : `Placement ${p + 1} of ${PLACEMENT_MATCHES}` };
}

export function isProvisional(state: GlickoState): boolean {
  return state.matches < PROVISIONAL_MATCHES;
}

/* ------------------------------------------------------------------ the match */

interface Side {
  p: RatedMatchPlayer;
  live: boolean;
  /** How much this player's own ratings may move: 1 live, ½ a rated run's owner, 0 otherwise. */
  factor: number;
  frozenWhy: FrozenReason | null;
}

/** A game's result for a against b: 1, ½ or 0 from the stored scores. */
const gameScore = (g: RatedGame, a: string, b: string) => (g.scores[a]! > g.scores[b]! ? 1 : g.scores[a]! < g.scores[b]! ? 0 : 0.5);

/** Works out the whole match (see the file's comment). `checked` comes from checkMatch. */
export function applyMatch(match: RatedMatchResult, finishedMs: number, pre: Record<string, PlayerPre>, ctx: MatchContext): MatchAfter {
  const ukDay = ukDayKey(finishedMs);
  const ids = match.players.map((p) => p.playerId);
  const duel = match.format.kind === "duel";
  const sides: Record<string, Side> = {};
  const runUses: MatchAfter["runUses"] = [];
  for (const p of match.players) {
    if (p.side === "live") sides[p.playerId] = { p, live: true, factor: 1, frozenWhy: null };
    else {
      const used = ctx.runUsesToday[p.run.runId] ?? 0;
      const why: FrozenReason | null =
        p.run.source !== "rated" ? "recorded_unrated_source" : used >= RUN_USES_PER_DAY ? "recorded_daily_limit" : null;
      sides[p.playerId] = { p, live: false, factor: why ? 0 : RECORDED_OWNER_FACTOR, frozenWhy: why };
      runUses.push({ runId: p.run.runId, ownerId: p.playerId, moved: !why });
    }
  }
  // Pairs of live players: frozen from the 4th match today.
  const pairs: string[] = [];
  const frozenPair = new Set<string>();
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]!;
      const b = ids[j]!;
      if (!sides[a]!.live || !sides[b]!.live) continue;
      const k = pairKey(a, b);
      pairs.push(k);
      if ((ctx.pairCounts[k] ?? 0) + 1 >= SAME_OPPONENT_FREEZE_FROM) frozenPair.add(k);
    }
  const comparable = (a: string, b: string) => (sides[a]!.live || sides[b]!.live) && !frozenPair.has(pairKey(a, b));

  // Results.
  const gameWins: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  if (duel)
    for (const g of match.games) {
      const [a, b] = ids as [string, string];
      const s = gameScore(g, a, b);
      if (s === 1) gameWins[a]!++;
      else if (s === 0) gameWins[b]!++;
    }
  const resultOf = (id: string): "win" | "loss" | "draw" => {
    if (!duel) return match.placings![id] === 1 ? "win" : "loss";
    const other = ids.find((x) => x !== id)!;
    return gameWins[id]! > gameWins[other]! ? "win" : gameWins[id]! < gameWins[other]! ? "loss" : "draw";
  };

  // Each rating's results for each player, against opponents' pre-match ratings.
  const stateOf = (id: string, key: RatingKey) => pre[id]!.ratings[key] ?? newGlickoState();
  const oppView = (id: string, key: RatingKey) => {
    const s = pre[id]!.ratings[key];
    if (!s) return { rating: START_RATING, rd: START_RD };
    return { rating: s.rating, rd: rdAfterIdle(s.rd, idleDays(s.lastAt, finishedMs)) };
  };
  const results: Record<string, Partial<Record<RatingKey, GlickoResult[]>>> = Object.fromEntries(ids.map((id) => [id, {}]));
  const push = (id: string, key: RatingKey, opp: string, score: number, weight: number) => {
    const o = oppView(opp, key);
    (results[id]![key] ??= []).push({ opponentRating: o.rating, opponentRd: o.rd, score, weight });
  };
  const poolWeight = (choice: RatedChoice) => GAME_WEIGHT * (choice === "mixed" ? MIXED_POOL_FACTOR : 1);
  const games: Record<RatedPool, number> = { puzzles: 0, arcade: 0 };
  for (const g of match.games) {
    games[g.pool]++;
    for (const a of ids)
      for (const b of ids) {
        if (a === b || !comparable(a, b)) continue;
        const score = duel ? gameScore(g, a, b) : match.placings![a]! < match.placings![b]! ? 1 : match.placings![a]! > match.placings![b]! ? 0 : 0.5;
        const spread = duel ? 1 : 1 / (ids.length - 1);
        push(a, g.pool, b, score, poolWeight(match.choice) * spread);
        push(a, g.category, b, score, GAME_WEIGHT * spread);
      }
  }

  // Total score across the match (Photo Finish in 4 and 8 players).
  const totals: Record<string, number> = Object.fromEntries(ids.map((id) => [id, match.games.reduce((s, g) => s + g.scores[id]!, 0)]));

  const players: PlayerAfter[] = ids.map((id) => {
    const side = sides[id]!;
    const before = pre[id]!;
    const ratings: Partial<Record<RatingKey, GlickoState>> = { ...before.ratings };
    const changes: RatingChange[] = [];
    const moved: RatingKey[] = [];
    for (const key of RATING_KEYS) {
      const rs = results[id]![key];
      if (!rs?.length || side.factor <= 0) continue;
      const s0 = stateOf(id, key);
      const s1 = glickoUpdate(s0, rs, finishedMs, side.factor);
      if (s1 === s0) continue;
      ratings[key] = s1;
      moved.push(key);
      changes.push({ key, before: s0.rating, after: s1.rating, delta: s1.rating - s0.rating, rdBefore: s0.rd, rdAfter: s1.rd });
    }
    const opponents = ids.filter((x) => x !== id);
    const frozenAll = side.live && opponents.every((o) => !comparable(id, o));
    const counted = side.live && !frozenAll;
    const result = resultOf(id);
    const place = duel ? null : match.placings![id]!;

    const p0 = before.profile;
    const p1: RatedProfileState = { ...p0 };
    const placedBefore = placementOf(p0.placementPlayed).done;
    if (counted) {
      p1.matches++;
      p1.placementPlayed = Math.min(PLACEMENT_MATCHES, p0.placementPlayed + 1);
      const won = result === "win";
      p1.wins += won ? 1 : 0;
      p1.winStreak = won ? p0.winStreak + 1 : 0;
      p1.bestWinStreak = Math.max(p0.bestWinStreak, p1.winStreak);
      if (duel && won) {
        const other = opponents[0]!;
        const first = match.games[0]!;
        if ((match.format as { bestOf: number }).bestOf <= 5 && gameScore(first, id, other) === 0) p1.comebacks++;
        if ((match.format as { bestOf: number }).bestOf === 5 && match.games.every((g) => gameScore(g, id, other) === 1)) p1.cleanSweeps++;
        const last = match.games[match.games.length - 1]!;
        const margin = last.scores[id]! - last.scores[other]!;
        if (margin > 0 && margin <= 1) p1.photoFinishes++;
        if ((ctx.rematchLosses[id] ?? []).includes(other) && sides[other]!.live) p1.revenges++;
      }
      if (!duel) {
        if (place! <= 3) p1.podiums++;
        if (won) {
          const second = Math.max(...opponents.map((o) => totals[o]!));
          const margin = totals[id]! - second;
          if (ids.filter((x) => match.placings![x] === 1).length === 1 && margin > 0 && margin <= 1) p1.photoFinishes++;
        }
      }
      // Giant Slayer: beat someone rated (Joulz Rating, both placed, before the match) at least 300 above you.
      const beaten = opponents.filter((o) => (duel ? result === "win" : match.placings![o]! > place!));
      const mine = p0.joulz;
      if (mine !== null && beaten.some((o) => pre[o]!.profile.joulz !== null && pre[o]!.profile.joulz! - mine >= 300)) p1.giantSlayers++;
    }
    // The Joulz Rating and the tier.
    const recent: Record<RatedPool, number> = {
      puzzles: before.recentGames.puzzles + (counted ? games.puzzles : 0),
      arcade: before.recentGames.arcade + (counted ? games.arcade : 0),
    };
    const placedAfter = placementOf(p1.placementPlayed).done;
    // Before: the Joulz Rating as last stored (what the player was shown); after: worked out from the new ratings.
    const joulzBefore = placedBefore ? (p0.joulz ?? joulzRating({ puzzles: before.ratings.puzzles, arcade: before.ratings.arcade }, before.recentGames)) : null;
    const joulzAfter = placedAfter ? joulzRating({ puzzles: ratings.puzzles, arcade: ratings.arcade }, recent) : null;
    p1.joulz = joulzAfter;
    const tierBefore: TierView | null = joulzBefore === null ? null : tierFor(joulzBefore, before.standing);
    const tierAfter: TierView | null = joulzAfter === null ? null : tierFor(joulzAfter, before.standing);
    if (tierAfter) {
      p1.shownTier = tierAfter.tier;
      if (!p0.peakTier || tierRank(tierAfter.tier) > tierRank(p0.peakTier)) p1.peakTier = tierAfter.tier;
      if (tierAfter.tier === "top500") p1.top500Ever = true;
    }
    const change: RatedPlayerChange = {
      playerId: id,
      side: side.live ? "live" : "recorded",
      moved: changes.length > 0,
      frozen: side.frozenWhy ?? (frozenAll ? "same_opponent_today" : null),
      changes,
      joulz: { before: joulzBefore, after: joulzAfter },
      placement: { ...placementOf(p1.placementPlayed), justFinished: !placedBefore && placedAfter },
      tier: { before: tierBefore, after: tierAfter },
      result,
      place,
      joules: side.live ? ratedMatchJoules(match.format, result) : 0,
      badges: [],
    };
    return { playerId: id, profile: p1, ratings, moved, change, games: counted ? { ...games } : { puzzles: 0, arcade: 0 }, counted };
  });
  return { ukDay, players, pairs, runUses };
}
