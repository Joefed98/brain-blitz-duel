/**
 * Leaderboards' data (wave 4, session W4a; docs/leaderboards.md): the service-role functions of
 * supabase/migrations/20261115100000_leaderboards.sql, one call each. Server only. Boards are read from the stored
 * snapshot pg_cron refreshes every few minutes (public.leaderboard_refresh), never worked out per request; privacy (who
 * shows as "Hidden player") is applied in the SQL for the viewer named here.
 */

import type {
  BoardVisibility,
  DailyBoardPage,
  DailyBoardScope,
  BoardPeriod,
  BoardScope,
  RatingBoard,
  RatingBoardPage,
} from "@/lib/leaderboards/boards";

import type { Db, Json } from "./db.server";
import type { Result } from "./rooms.server";

/** A jsonb answer read as the shape the SQL builds (the SQL is the one place that shape is made). */
function jsonAs<T>(value: Json | null | undefined): T | null {
  return value === null || value === undefined ? null : (value as unknown as T);
}

export async function readRatingBoard(
  client: Db,
  input: { viewer: string; board: RatingBoard; period: BoardPeriod; scope: BoardScope; offset: number; limit: number },
): Promise<Result<RatingBoardPage | null>> {
  const { data, error } = await client.rpc("leaderboard_page", {
    p_viewer: input.viewer,
    p_board: input.board,
    p_period: input.period,
    p_scope: input.scope,
    p_offset: input.offset,
    p_limit: input.limit,
  });
  return { data: jsonAs<RatingBoardPage>(data), error };
}

export async function readDailyBoard(
  client: Db,
  input: { viewer: string; kind: "daily_puzzle" | "daily_arcade"; day: string; scope: DailyBoardScope },
): Promise<Result<DailyBoardPage | null>> {
  const { data, error } = await client.rpc("daily_board_page", {
    p_viewer: input.viewer,
    p_kind: input.kind,
    p_day: input.day,
    p_scope: input.scope,
  });
  return { data: jsonAs<DailyBoardPage>(data), error };
}

/** Daily Champion and Daily Top 100's counts for a player (final boards of at least the given field sizes). */
export async function readDailyBoardBadgeFacts(
  client: Db,
  input: { userId: string; championField: number; top100Field: number },
): Promise<Result<{ wins: number; top100: number } | null>> {
  const { data, error } = await client.rpc("daily_board_badge_facts", {
    p_user: input.userId,
    p_champion_field: input.championField,
    p_top100_field: input.top100Field,
  });
  return { data: jsonAs<{ wins: number; top100: number }>(data), error };
}

export async function readBoardVisibility(client: Db, userId: string): Promise<Result<BoardVisibility | null>> {
  const { data, error } = await client.rpc("leaderboard_visibility", { p_user: userId });
  return { data: jsonAs<BoardVisibility>(data), error };
}

export async function writeBoardVisibility(client: Db, userId: string, show: boolean | null): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("leaderboard_set_visibility", { p_user: userId, p_show: show });
  return { data: data === true, error };
}

/** The refresh pg_cron runs (checks and a manual run only; the app never calls it per request). */
export async function refreshBoards(client: Db): Promise<Result<Json | null>> {
  const { data, error } = await client.rpc("leaderboard_refresh", {});
  return { data: data ?? null, error };
}
