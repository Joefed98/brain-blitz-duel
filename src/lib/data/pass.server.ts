/**
 * The Season pass's data (wave 2, session D2; docs/economy/pass.md; supabase/migrations/20261113100000_season_pass.sql):
 * seasons, Joules lines, claims, the premium track, pass titles, the weekly draws, and the stored results the pass
 * reads. Server only; each function issues exactly one call. Coins, items and consumables are paid through A1's
 * functions (economy.server.ts), the tester list read through D1's (shop.server.ts).
 */

import { asJson, type Db, type Tables } from "./db.server";
import type { Result } from "./rooms.server";

export type PassSeasonRow = Tables<"pass_seasons">;
export type PassWeekRow = Tables<"pass_weeks">;

/** One source event to credit. */
export interface JoulesRow {
  key: string;
  kind: string;
  base: number;
  /** ISO time of the source event. */
  at: string;
}

export interface JoulesOutcome {
  key: string;
  status: "credited" | "duplicate" | "limit";
  amount: number;
}

/** One stored source event (public.pass_activity). */
export interface ActivityRow {
  k: string;
  key: string;
  at: string;
  game: string | null;
  score: number | null;
  day: string | null;
}

export interface PassStateRow {
  joules: number;
  claims: { track: "free" | "premium"; level: number }[];
  premium: { source: "test" | "purchase" | "plus"; grantedAt: string } | null;
  levelReached: number;
  levelSeen: number;
  weekly: string[];
}

export type GrantPremiumStatus = "granted" | "already" | "no_account" | "unknown_season" | "not_tester" | "bad_source";

export async function readSeasons(client: Db): Promise<Result<PassSeasonRow[]>> {
  const { data, error } = await client.from("pass_seasons").select("*").order("id");
  return { data: (data as PassSeasonRow[] | null) ?? [], error };
}

export async function readMemberReset(client: Db, userId: string, seasonId: string): Promise<Result<string | null>> {
  const { data, error } = await client.rpc("pass_member_reset", { p_user_id: userId, p_season: seasonId });
  return { data: typeof data === "string" ? data : null, error };
}

export async function readPassState(client: Db, userId: string, seasonId: string, epoch: number): Promise<Result<PassStateRow | null>> {
  const { data, error } = await client.rpc("pass_state", { p_user_id: userId, p_season: seasonId, p_epoch: epoch });
  return { data: (data as unknown as PassStateRow | null) ?? null, error };
}

export async function creditJoulesRpc(
  client: Db,
  input: { userId: string; seasonId: string; epoch: number; rows: readonly JoulesRow[] },
): Promise<Result<JoulesOutcome[] | null>> {
  const { data, error } = await client.rpc("pass_credit_joules", {
    p_user_id: input.userId,
    p_season: input.seasonId,
    p_epoch: input.epoch,
    p_rows: asJson(input.rows),
  });
  return { data: (data as unknown as JoulesOutcome[] | null) ?? null, error };
}

export async function readJoulesSince(
  client: Db,
  input: { userId: string; seasonId: string; epoch: number; sinceIso: string },
): Promise<Result<number>> {
  const { data, error } = await client.rpc("pass_joules_since", {
    p_user_id: input.userId,
    p_season: input.seasonId,
    p_epoch: input.epoch,
    p_since: input.sinceIso,
  });
  return { data: typeof data === "number" ? data : 0, error };
}

export async function noteLevelRpc(
  client: Db,
  input: { userId: string; seasonId: string; epoch: number; level: number; seen: boolean },
): Promise<Result<number | null>> {
  const { data, error } = await client.rpc("pass_note_level", {
    p_user_id: input.userId,
    p_season: input.seasonId,
    p_epoch: input.epoch,
    p_level: input.level,
    p_seen: input.seen,
  });
  return { data: typeof data === "number" ? data : null, error };
}

export async function recordClaimRpc(
  client: Db,
  input: { userId: string; seasonId: string; epoch: number; track: string; level: number; reward: unknown },
): Promise<Result<"claimed" | "duplicate" | "no_account" | null>> {
  const { data, error } = await client.rpc("pass_record_claim", {
    p_user_id: input.userId,
    p_season: input.seasonId,
    p_epoch: input.epoch,
    p_track: input.track,
    p_level: input.level,
    p_reward: asJson(input.reward),
  });
  return { data: (data as "claimed" | "duplicate" | "no_account" | null) ?? null, error };
}

export async function grantPremiumRpc(
  client: Db,
  input: { userId: string; seasonId: string; source: "test" | "purchase" | "plus"; key: string },
): Promise<Result<GrantPremiumStatus | null>> {
  const { data, error } = await client.rpc("pass_grant_premium", {
    p_user_id: input.userId,
    p_season: input.seasonId,
    p_source: input.source,
    p_key: input.key,
  });
  return { data: (data as GrantPremiumStatus | null) ?? null, error };
}

export async function unlockTitleRpc(
  client: Db,
  input: { userId: string; title: string; seasonId: string },
): Promise<Result<"unlocked" | "already" | "no_account" | "unknown_title" | null>> {
  const { data, error } = await client.rpc("pass_unlock_title", { p_user_id: input.userId, p_title: input.title, p_season: input.seasonId });
  return { data: (data as "unlocked" | "already" | "no_account" | "unknown_title" | null) ?? null, error };
}

export async function readPassTitles(client: Db, userId: string): Promise<Result<string[]>> {
  const { data, error } = await client.rpc("pass_titles_of", { p_user_id: userId });
  return { data: Array.isArray(data) ? (data as string[]) : [], error };
}

export async function readPassWeek(client: Db, weekStart: string): Promise<Result<PassWeekRow | null>> {
  const { data, error } = await client.from("pass_weeks").select("*").eq("week_start", weekStart).maybeSingle();
  return { data: (data as PassWeekRow | null) ?? null, error };
}

export async function recordPassWeek(
  client: Db,
  input: { weekStart: string; easy: string; medium: string; hard: string },
): Promise<Result<null>> {
  const { error } = await client.rpc("pass_record_week", {
    p_week: input.weekStart,
    p_easy: input.easy,
    p_medium: input.medium,
    p_hard: input.hard,
  });
  return { data: null, error };
}

export async function readActivity(
  client: Db,
  input: { userId: string; fromIso: string; toIso: string },
): Promise<Result<ActivityRow[]>> {
  const { data, error } = await client.rpc("pass_activity", { p_user_id: input.userId, p_from: input.fromIso, p_to: input.toIso });
  return { data: (data as unknown as ActivityRow[] | null) ?? [], error };
}

export async function readGamesBefore(client: Db, userId: string, beforeIso: string): Promise<Result<string[]>> {
  const { data, error } = await client.rpc("pass_games_before", { p_user_id: userId, p_before: beforeIso });
  return { data: Array.isArray(data) ? (data as string[]) : [], error };
}
