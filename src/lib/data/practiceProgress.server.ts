/**
 * Practice progress on the account (wave 2 train C, C1a; supabase/migrations/20261111101500_practice_progress.sql):
 * the practice_plays row the grading writes (with its stored breakdown and level), counting it towards progress, and
 * the player's stars, bests and one-time note. Server only. No table here is writable by any API role, the service
 * role included, except practice_plays (the beta recording's own insert): progress changes only through
 * public.practice_record_play and the note through public.practice_mark_refresh_note_seen.
 */

import { asJson, type Db, type Tables, type TablesInsert } from "./db.server";
import { syncRetirement } from "./retirement.server";
import type { Result } from "./rooms.server";

export type PracticeProgressRow = Tables<"practice_progress">;

/** What public.practice_record_play answers. */
export interface PracticeRecordOutcome {
  counted: boolean;
  reason?: "not_found_or_counted" | "no_player" | "example" | "flagged" | "before_fresh_start";
  game?: string;
  level?: string;
  score?: number;
  previous_best?: number | null;
  best?: number;
  best_set?: boolean;
  improved?: boolean;
  star?: boolean;
  star_earned?: boolean;
  star_score?: number | null;
  star_total?: number;
  gems_unlocked?: string[];
}

/**
 * The practice_plays row with the server's breakdown and level, answering its id (the beta columns exactly as
 * insertPracticePlay writes them; practice.server.ts).
 */
export async function insertPracticePlayWithBreakdown(
  client: Db,
  row: Omit<TablesInsert<"practice_plays">, "revision" | "breakdown"> & { revision: unknown; breakdown: unknown },
): Promise<Result<number | null>> {
  const { data, error } = await client
    .from("practice_plays")
    .insert({ ...row, revision: asJson(row.revision), breakdown: row.breakdown == null ? null : asJson(row.breakdown) })
    .select("id")
    .single();
  return { data: (data as { id: number } | null)?.id ?? null, error };
}

/** Counts one stored play towards its player's progress (once; see the migration for what never counts). */
export async function countPracticePlay(client: Db, playId: number): Promise<Result<PracticeRecordOutcome | null>> {
  // The star total and gems read the retired-games mirror (retirement.server.ts).
  await syncRetirement(client);
  const { data, error } = await client.rpc("practice_record_play", { p_play_id: playId });
  return { data: (data as unknown as PracticeRecordOutcome | null) ?? null, error };
}

/** Every progress row of one player (bests and stars per game and level). */
export async function readPracticeProgress(client: Db, userId: string): Promise<Result<PracticeProgressRow[]>> {
  const { data, error } = await client
    .from("practice_progress")
    .select("user_id, game_id, level, best_score, best_play_id, best_at, star_at, star_score")
    .eq("user_id", userId);
  return { data: (data as PracticeProgressRow[] | null) ?? [], error };
}

/** Whether the note is due: the player existed before the fresh start and hasn't seen it. */
export async function readRefreshNoteDue(client: Db, userId: string): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("practice_refresh_note_due", { p_user_id: userId });
  return { data: data === true, error };
}

/** Records that the player has seen the note (true when this call recorded it). */
export async function markRefreshNoteSeen(client: Db, userId: string): Promise<Result<boolean>> {
  const { data, error } = await client.rpc("practice_mark_refresh_note_seen", { p_user_id: userId });
  return { data: data === true, error };
}

/** The stored breakdown of one play (checks and C1b read it this way). */
export async function readPracticePlayBreakdown(
  client: Db,
  playId: number,
): Promise<Result<Pick<Tables<"practice_plays">, "id" | "user_id" | "game_id" | "level" | "score" | "breakdown"> | null>> {
  const { data, error } = await client
    .from("practice_plays")
    .select("id, user_id, game_id, level, score, breakdown")
    .eq("id", playId)
    .maybeSingle();
  return { data: data ?? null, error };
}

/** The fresh start's moment (ISO), or null on a database without it. */
export async function readFreshStartAt(client: Db): Promise<Result<string | null>> {
  const { data, error } = await client.from("practice_progress_start").select("fresh_start_at").maybeSingle();
  return { data: data?.fresh_start_at ?? null, error };
}
