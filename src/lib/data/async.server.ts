/**
 * Async rooms (the daily and friend challenges): `async_rooms`, `async_room_secrets`, `async_attempts` and
 * `async_results`. Server only; the engine's rules stay in src/lib/duel/asyncRoom.server.ts, and each function here
 * issues exactly the query it made before the data layer (architecture audit B2).
 */

import type { AsyncAttemptRow, AsyncResultRow, AsyncRoomRow } from "@/lib/duel/asyncRoom.server";

import { asJson, type Db, type Json, type TablesUpdate } from "./db.server";
import type { Result } from "./rooms.server";

/* ------------------------------------------------------------------ rooms */

export async function readAsyncRoomByKey(client: Db, key: string): Promise<Result<AsyncRoomRow | null>> {
  const { data, error } = await client.from("async_rooms").select("*").eq("room_key", key).maybeSingle();
  return { data: data as unknown as AsyncRoomRow | null, error };
}

export async function readAsyncRoomById(client: Db, id: string): Promise<Result<AsyncRoomRow | null>> {
  const { data, error } = await client.from("async_rooms").select("*").eq("id", id).maybeSingle();
  return { data: data as unknown as AsyncRoomRow | null, error };
}

/** Whether today's daily room is readable at all (any error: the tables are missing). */
export async function probeAsyncRoomKey(client: Db, key: string): Promise<Result<{ id: string } | null>> {
  const { data, error } = await client.from("async_rooms").select("id").eq("room_key", key).maybeSingle();
  return { data, error };
}

/** A newly dealt room (its key may already be taken: the error is 23505). */
export async function insertAsyncRoom(
  client: Db,
  row: Omit<AsyncRoomRow, "puzzles_public" | "created_at"> & { puzzles_public: Json },
): Promise<Result<null>> {
  const { error } = await client.from("async_rooms").insert({ ...row, round_order: asJson(row.round_order) });
  return { data: null, error };
}

/** The room's private halves, stored once after the room row. */
export async function insertAsyncRoomSecrets(
  client: Db,
  roomId: string,
  puzzlesPrivate: Json,
): Promise<Result<null>> {
  const { error } = await client.from("async_room_secrets").insert({ room_id: roomId, puzzles_private: puzzlesPrivate });
  return { data: null, error };
}

/** The room's private halves in round order, or null when none are stored. */
export async function readAsyncPrivate(client: Db, roomId: string): Promise<Result<Record<string, unknown>[] | null>> {
  const { data, error } = await client
    .from("async_room_secrets")
    .select("puzzles_private")
    .eq("room_id", roomId)
    .maybeSingle();
  return { data: (data?.puzzles_private ?? null) as Record<string, unknown>[] | null, error };
}

/* --------------------------------------------------------------- attempts */

export async function readAttempt(
  client: Db,
  roomId: string,
  userId: string,
): Promise<Result<AsyncAttemptRow | null>> {
  const { data, error } = await client
    .from("async_attempts")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return { data: data as unknown as AsyncAttemptRow | null, error };
}

export async function readAttempts(client: Db, roomId: string): Promise<Result<AsyncAttemptRow[] | null>> {
  const { data, error } = await client.from("async_attempts").select("*").eq("room_id", roomId);
  return { data: data as unknown as AsyncAttemptRow[] | null, error };
}

/** One device's attempt (a second for the room is 23505; a colour past the old range is 23514). */
export async function insertAttempt(client: Db, row: AsyncAttemptRow): Promise<Result<null>> {
  const { error } = await client.from("async_attempts").insert({ ...row, round_scores: asJson(row.round_scores) });
  return { data: null, error };
}

/** The attempt's board columns, keyed on the attempt and its own device. */
export async function updateAttempt(
  client: Db,
  attemptId: string,
  userId: string,
  values: Omit<TablesUpdate<"async_attempts">, "round_scores"> & { round_scores?: (number | null)[] },
): Promise<Result<null>> {
  const { error } = await client
    .from("async_attempts")
    .update(values as TablesUpdate<"async_attempts">)
    .eq("id", attemptId)
    .eq("user_id", userId);
  return { data: null, error };
}

/* ---------------------------------------------------------------- results */

export async function readAttemptResults(client: Db, attemptId: string): Promise<Result<AsyncResultRow[] | null>> {
  const { data, error } = await client.from("async_results").select("*").eq("attempt_id", attemptId);
  return { data: data as unknown as AsyncResultRow[] | null, error };
}

/** Every attempt's results in a room. */
export async function readAsyncRoomResults(client: Db, roomId: string): Promise<Result<AsyncResultRow[] | null>> {
  const { data, error } = await client.from("async_results").select("*").eq("room_id", roomId);
  return { data: data as unknown as AsyncResultRow[] | null, error };
}

/** Every attempt's result for one round of a room. */
export async function readAsyncRoundResults(
  client: Db,
  roomId: string,
  round: number,
): Promise<Result<AsyncResultRow[] | null>> {
  const { data, error } = await client
    .from("async_results")
    .select("*")
    .eq("room_id", roomId)
    .eq("round_number", round);
  return { data: data as unknown as AsyncResultRow[] | null, error };
}

/** A round's start row, or a finished attempt's rows (a clash on attempt and round is 23505). */
export async function insertAsyncResults(
  client: Db,
  rows: AsyncResultRow | AsyncResultRow[],
): Promise<Result<null>> {
  const toRow = (row: AsyncResultRow) => ({ ...row, extra: asJson(row.extra) });
  const { error } = await client
    .from("async_results")
    .insert(Array.isArray(rows) ? rows.map(toRow) : toRow(rows));
  return { data: null, error };
}

/**
 * Writes a round still open (neither answered nor missed): the answer, or the miss. The updated row, or null when
 * the round had already closed (another call got there first).
 */
export async function updateOpenAsyncResult(
  client: Db,
  attemptId: string,
  round: number,
  values: Omit<TablesUpdate<"async_results">, "extra"> & { extra?: unknown },
): Promise<Result<AsyncResultRow | null>> {
  const { data, error } = await client
    .from("async_results")
    // The extra (the app's own shape) is stored as it is; the other fields are the table's own.
    .update(values as TablesUpdate<"async_results">)
    .eq("attempt_id", attemptId)
    .eq("round_number", round)
    .eq("answered", false)
    .eq("missed", false)
    .select()
    .maybeSingle();
  return { data: data as unknown as AsyncResultRow | null, error };
}
