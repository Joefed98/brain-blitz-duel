/**
 * Ratings' data (wave 3, session W3a; supabase/migrations/20261114100000_ratings.sql; docs/rated/README.md). Server
 * only, always the service-role client: anon and authenticated have no right on any rated table or function. Each
 * function issues exactly one call; every write is one of the database's own functions (rated_apply_match,
 * rated_set_tiers, rated_recompute_standings).
 */

import type { Json } from "@/integrations/supabase/types";
import type { RatingKey, TierId } from "@/lib/data/ratings";

import type { Db, DbError } from "./db.server";
import type { Result } from "./rooms.server";

/** A rated_profiles row as rated_state answers it. */
export interface RatedProfileRow {
  player_id: string;
  version: number;
  placement_played: number;
  /** Where this placement started (0; 2 after a season reset, so 3 matches remain; wave 4 W4d). */
  placement_from?: number | null;
  matches: number;
  wins: number;
  win_streak: number;
  best_win_streak: number;
  comebacks: number;
  clean_sweeps: number;
  podiums: number;
  giant_slayers: number;
  revenges: number;
  photo_finishes: number;
  joulz: number | null;
  shown_tier: TierId | null;
  /** The tier floor grace's count (null when not in it). */
  floor_grace: number | null;
  peak_tier: TierId | null;
  top500_ever: boolean;
  last_match_ms: number | null;
}

export interface RatedRatingRow {
  player_id: string;
  key: RatingKey;
  rating: number;
  rd: number;
  volatility: number;
  matches: number;
  last_ms: number;
  version: number;
}

export interface RatedStandingRow {
  player_id: string;
  joulz: number;
  rank: number;
  share: number;
  storm_ok: boolean;
  top500_ok: boolean;
}

export interface RatedStandingsMeta {
  rated_players: number;
  caps_active: boolean;
  computed_at: string;
}

/** What rated_state answers. */
export interface RatedStateRows {
  /** The stored outcome when the match was already recorded. */
  outcome: Json | null;
  profiles: RatedProfileRow[];
  ratings: RatedRatingRow[];
  pairs: { a: string; b: string; matches: number }[];
  recent: { player_id: string; puzzles: number; arcade: number }[];
  runs: { run_id: string; uses: number }[];
  meta: RatedStandingsMeta | null;
  standings: RatedStandingRow[];
  rematch: { player_id: string; side: "live" | "recorded"; result: "win" | "loss" | "draw" }[];
  /** Each player's stored placement matches (placement_no 1–5). */
  placements: { player_id: string; n: number; match_id: string; result: "win" | "loss" | "draw"; finished_ms: number }[];
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function parseRatedState(data: unknown): RatedStateRows {
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return {
    outcome: (o["outcome"] as Json | undefined) ?? null,
    profiles: arr<RatedProfileRow>(o["profiles"]),
    ratings: arr<RatedRatingRow>(o["ratings"]),
    pairs: arr(o["pairs"]),
    recent: arr(o["recent"]),
    runs: arr(o["runs"]),
    meta: (o["meta"] as RatedStandingsMeta | null | undefined) ?? null,
    standings: arr<RatedStandingRow>(o["standings"]),
    rematch: arr(o["rematch"]),
    placements: arr(o["placements"]),
  };
}

export interface RatedStateQuery {
  matchId: string | null;
  players: readonly string[];
  /** The UK day, YYYY-MM-DD. */
  day: string;
  /** ISO time: live games from here on count for the Joulz Rating's shares. */
  since: string;
  runIds: readonly string[];
  rematchOf: string | null;
}

export async function readRatedState(client: Db, q: RatedStateQuery): Promise<Result<RatedStateRows | null>> {
  const { data, error } = await client.rpc("rated_state", {
    p_match_id: q.matchId,
    p_players: [...q.players],
    p_day: q.day,
    p_since: q.since,
    p_run_ids: [...q.runIds],
    p_rematch_of: q.rematchOf,
  });
  return { data: error ? null : parseRatedState(data), error };
}

export type ApplyStatus = { status: "recorded" } | { status: "duplicate"; outcome: Json } | { status: "stale" };

/** Stores one worked-out match (all or nothing). The payload's shape is rated_apply_match's comment. */
export async function applyRatedMatch(client: Db, payload: Json): Promise<Result<ApplyStatus | null>> {
  const { data, error } = await client.rpc("rated_apply_match", { p: payload });
  return { data: error ? null : ((data as ApplyStatus | null) ?? null), error };
}

/** The competitive badges' counts (rated_badge_facts). */
export interface RatedBadgeFactsRow {
  wins: number;
  winStreak: number;
  bestWinStreak: number;
  placementPlayed: number;
  comebacks: number;
  cleanSweeps: number;
  podiums: number;
  giantSlayers: number;
  revenges: number;
  photoFinishes: number;
  peakTier: TierId | null;
  top500Ever: boolean;
}

export async function readRatedBadgeFacts(client: Db, userId: string): Promise<Result<RatedBadgeFactsRow | null>> {
  const { data, error } = await client.rpc("rated_badge_facts", { p_user_id: userId });
  return { data: error ? null : ((data as RatedBadgeFactsRow | null) ?? null), error };
}

export async function readRatedTierCounts(client: Db): Promise<Result<Partial<Record<TierId, number>>>> {
  const { data, error } = await client.rpc("rated_tier_counts");
  return { data: (data as Partial<Record<TierId, number>> | null) ?? {}, error };
}

export interface StandingsRun {
  rated_players: number;
  caps_active: boolean;
  players: (RatedStandingRow & { shown_tier: TierId | null; floor_grace: number | null })[];
}

export async function recomputeRatedStandings(client: Db, nowIso: string): Promise<Result<StandingsRun | null>> {
  const { data, error } = await client.rpc("rated_recompute_standings", { p_now: nowIso });
  return { data: error ? null : ((data as StandingsRun | null) ?? null), error };
}

export interface TierWrite {
  player_id: string;
  shown_tier: TierId;
  floor_grace: number | null;
  peak_tier: TierId | null;
  top500_ever: boolean;
}

export async function setRatedTiers(client: Db, rows: readonly TierWrite[]): Promise<Result<number>> {
  const { data, error } = await client.rpc("rated_set_tiers", { p: rows as unknown as Json });
  return { data: typeof data === "number" ? data : 0, error: error as DbError | null };
}

/** One rated match that counted for a player (rated_week_matches; the weekly R challenges). */
export interface RatedWeekMatchRow {
  result: "win" | "loss" | "draw";
  bestOf: number | null;
  games: { category: string | null; won: boolean }[];
}

/** A player's counted rated matches finished in [from, to), in the order finished. */
export async function readRatedWeekMatches(client: Db, userId: string, fromIso: string, toIso: string): Promise<Result<RatedWeekMatchRow[]>> {
  const { data, error } = await client.rpc("rated_week_matches", { p_user_id: userId, p_from: fromIso, p_to: toIso });
  return { data: Array.isArray(data) ? (data as unknown as RatedWeekMatchRow[]) : [], error };
}
