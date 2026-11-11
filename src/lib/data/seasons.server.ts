/**
 * Seasons' data (wave 4, session W4d; docs/seasons/README.md; supabase/migrations/20261115400000_seasons.sql): a
 * player's season standing and rewards, the rated matches the season counts, the notice and the season titles. Server
 * only; each function issues exactly one call. Closing a season and granting its rewards is Joe's alone (pass.* in
 * the database); nothing here can do it.
 */

import type { TierId } from "./ratings";
import type { Db, Json } from "./db.server";
import type { Result } from "./rooms.server";

export type NoteRatedMatchStatus = "noted" | "duplicate" | "no_season" | "no_account" | "bad_tier";

/**
 * Records one live player's rated match in the season they are in (public.season_note_rated_match). For the ratings
 * engine (W3a's recordRatedMatch), once per live player per match; idempotent on the match id.
 */
export async function noteSeasonRatedMatch(
  client: Db,
  input: { userId: string; matchId: string; at: string; tier: TierId | null; tierLabel: string | null; placementDone: boolean },
): Promise<Result<NoteRatedMatchStatus | null>> {
  const { data, error } = await client.rpc("season_note_rated_match", {
    p_user_id: input.userId,
    p_match_id: input.matchId,
    p_at: input.at,
    p_tier: input.tier,
    p_tier_label: input.tierLabel,
    p_placement_done: input.placementDone,
  });
  return { data: (data as NoteRatedMatchStatus | null) ?? null, error };
}

/** The season view as the database answers it (public.season_view); shaped by seasons.server.ts. */
export async function readSeasonView(client: Db, userId: string, nowIso: string): Promise<Result<Json | null>> {
  const { data, error } = await client.rpc("season_view", { p_user_id: userId, p_now: nowIso });
  return { data: data ?? null, error };
}

/** Marks a season's reward notice seen: seen | already | none. */
export async function markSeasonRewardSeen(client: Db, userId: string, seasonId: string): Promise<Result<string | null>> {
  const { data, error } = await client.rpc("season_reward_seen", { p_user_id: userId, p_season: seasonId });
  return { data: data ?? null, error };
}

/** The season titles an account holds (s1-storm …). */
export async function readSeasonTitles(client: Db, userId: string): Promise<Result<string[]>> {
  const { data, error } = await client.rpc("season_titles_of", { p_user_id: userId });
  return { data: Array.isArray(data) ? (data as string[]) : [], error };
}

/** How many placement matches the player has and from when they count ({of, since, season}). */
export async function readSeasonPlacement(client: Db, userId: string): Promise<Result<Json | null>> {
  const { data, error } = await client.rpc("season_placement_for", { p_user_id: userId });
  return { data: data ?? null, error };
}
