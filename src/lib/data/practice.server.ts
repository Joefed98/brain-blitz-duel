/**
 * Practice's tables: the Gridlock layout bank (`unblock_bank`), saved intro demos (`intro_demos`) and the beta
 * recording of practice runs (`practice_plays`). Server only; each function issues exactly the query its caller
 * made before the data layer (architecture audit B2).
 */

import { asJson, type Db, type Json, type TablesInsert } from "./db.server";
import type { Result } from "./rooms.server";

/** A Gridlock bank row as the deal reads it. */
export interface UnblockBankDbRow {
  id: number;
  layout: string;
  min_moves: number;
  solution: string | null;
}

/** The `limit` least recently used bank layouts (never used first). */
export async function readLeastUsedUnblockRows(
  client: Db,
  limit: number,
): Promise<Result<UnblockBankDbRow[] | null>> {
  const { data, error } = await client
    .from("unblock_bank")
    .select("id, layout, min_moves, solution")
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  return { data: data as UnblockBankDbRow[] | null, error };
}

/** The bank's first layout (the fixed intro example; not marked used). */
export async function readFirstUnblockRows(client: Db): Promise<Result<UnblockBankDbRow[] | null>> {
  const { data, error } = await client
    .from("unblock_bank")
    .select("id, layout, min_moves, solution")
    .order("id", { ascending: true })
    .limit(1);
  return { data: data as UnblockBankDbRow[] | null, error };
}

/** Stamps a drawn layout as used. */
export async function markUnblockUsed(client: Db, id: number, at: string): Promise<Result<null>> {
  const { error } = await client.from("unblock_bank").update({ last_used_at: at }).eq("id", id);
  return { data: null, error };
}

/** A saved intro demo's stored columns. */
export interface IntroDemoDbRow {
  game_type: string;
  seed: number;
  puzzle: Json;
  input_log: Json;
  start_tick: number;
  length_ticks: number;
  example_id: string | null;
}

/** One game's saved intro demo (a public read: the anon client, under RLS). */
export async function readIntroDemo(client: Db, gameType: string): Promise<Result<IntroDemoDbRow | null>> {
  const { data, error } = await client
    .from("intro_demos")
    .select("game_type, seed, puzzle, input_log, start_tick, length_ticks, example_id")
    .eq("game_type", gameType)
    .maybeSingle();
  return { data, error };
}

/** Saves (or replaces) a game's intro demo. */
export async function upsertIntroDemo(
  client: Db,
  row: Omit<TablesInsert<"intro_demos">, "puzzle" | "input_log"> & { puzzle: unknown; input_log: unknown },
): Promise<Result<null>> {
  const { error } = await client
    .from("intro_demos")
    .upsert(
      { ...row, puzzle: asJson(row.puzzle), input_log: asJson(row.input_log) },
      { onConflict: "game_type" },
    );
  return { data: null, error };
}

/** The beta recording of one practice run (the error names `input_type` before its migration). */
export async function insertPracticePlay(
  client: Db,
  row: Omit<TablesInsert<"practice_plays">, "revision"> & { revision: unknown },
): Promise<Result<null>> {
  const { error } = await client.from("practice_plays").insert({ ...row, revision: asJson(row.revision) });
  return { data: null, error };
}
