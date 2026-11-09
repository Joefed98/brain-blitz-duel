/**
 * Room round results (`round_results`): every read and write of a stored result. Server only; each function issues
 * exactly the query its caller made before the data layer (architecture audit B2). Grading stays in
 * roomGrade.server.ts: only the I/O is here.
 */

import type { RoundResultRow } from "@/lib/duel/types";

import type { Db, Tables, TablesInsert } from "./db.server";
import type { Result } from "./rooms.server";

/** Every stored result in a room. */
export async function readRoomResults(client: Db, roomId: string): Promise<Result<RoundResultRow[] | null>> {
  const { data, error } = await client.from("round_results").select("*").eq("duel_id", roomId);
  return { data: data as RoundResultRow[] | null, error };
}

/** One round's results in slot order. */
export async function readRoundResults(
  client: Db,
  roomId: string,
  round: number,
): Promise<Result<RoundResultRow[] | null>> {
  const { data, error } = await client
    .from("round_results")
    .select("*")
    .eq("duel_id", roomId)
    .eq("round_number", round)
    .order("player_slot");
  return { data: data as RoundResultRow[] | null, error };
}

/** The results of the given rounds (replays). */
export async function readResultsOfRounds(
  client: Db,
  roomId: string,
  rounds: number[],
): Promise<Result<RoundResultRow[] | null>> {
  const { data, error } = await client
    .from("round_results")
    .select("*")
    .eq("duel_id", roomId)
    .in("round_number", rounds);
  return { data: data as RoundResultRow[] | null, error };
}

/** The slots that answered a round. */
export async function readAnsweredSlots(
  client: Db,
  roomId: string,
  round: number,
): Promise<Result<{ player_slot: number }[] | null>> {
  const { data, error } = await client
    .from("round_results")
    .select("player_slot")
    .eq("duel_id", roomId)
    .eq("round_number", round);
  return { data, error };
}

/** The id of a slot's stored result for a round, if any. */
export async function readStoredResultId(
  client: Db,
  roomId: string,
  slot: number,
  round: number,
): Promise<Result<{ id: string } | null>> {
  const { data, error } = await client
    .from("round_results")
    .select("id")
    .eq("duel_id", roomId)
    .eq("player_slot", slot)
    .eq("round_number", round)
    .maybeSingle();
  return { data, error };
}

/** Stores a graded result (a second one for the slot and round is the error's 23505). */
export async function insertRoundResult(client: Db, row: TablesInsert<"round_results">): Promise<Result<null>> {
  const { error } = await client.from("round_results").insert(row);
  return { data: null, error };
}

/** A results table that stores how each result was played. */
export type InputTypeTable = "round_results" | "async_results";

/**
 * Stores `input_type` on the result rows matching every `match` column (one `eq` each, in the order given), then
 * selects their ids. Never graded. A stand-in client that answers nothing reads as no data and no error.
 */
export async function writeInputType(
  client: Db,
  table: InputTypeTable,
  match: Record<string, string | number>,
  inputType: string,
): Promise<Result<{ id: string }[] | null>> {
  const entries = Object.entries(match);
  if (table === "round_results") {
    let query = client.from("round_results").update({ input_type: inputType });
    for (const [key, v] of entries) query = query.eq(key as string & keyof Tables<"round_results">, v as never);
    const { data, error } = (await query.select("id")) ?? {};
    return { data: data ?? null, error: error ?? null };
  }
  let query = client.from("async_results").update({ input_type: inputType });
  for (const [key, v] of entries) query = query.eq(key as string & keyof Tables<"async_results">, v as never);
  const { data, error } = (await query.select("id")) ?? {};
  return { data: data ?? null, error: error ?? null };
}
