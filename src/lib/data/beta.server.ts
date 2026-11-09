/**
 * Beta recording tables (docs/beta-sql.md): append-only event rows. Server only. The recording rules (what is
 * written, best effort, timeouts) stay in src/lib/duel/betaRecord.server.ts; only the inserts are here
 * (architecture audit B2). Each returns supabase-js's `{ error }`, which the recorder logs.
 */

import type { Db, Json, TablesInsert } from "./db.server";
import type { Result } from "./rooms.server";

export async function insertRoomEvent(client: Db, row: TablesInsert<"room_events">): Promise<Result<null>> {
  const { error } = await client.from("room_events").insert(row);
  return { data: null, error };
}

export async function insertRoomJoin(client: Db, row: TablesInsert<"room_joins">): Promise<Result<null>> {
  const { error } = await client.from("room_joins").insert(row);
  return { data: null, error };
}

export async function insertAsyncEvent(client: Db, row: TablesInsert<"async_events">): Promise<Result<null>> {
  const { error } = await client.from("async_events").insert(row);
  return { data: null, error };
}

export async function insertShareEvent(client: Db, row: TablesInsert<"share_events">): Promise<Result<null>> {
  const { error } = await client.from("share_events").insert(row);
  return { data: null, error };
}

export async function insertChallengeEvent(
  client: Db,
  row: TablesInsert<"challenge_events">,
): Promise<Result<null>> {
  const { error } = await client.from("challenge_events").insert(row);
  return { data: null, error };
}

export async function insertTermsEvent(client: Db, row: TablesInsert<"terms_events">): Promise<Result<null>> {
  const { error } = await client.from("terms_events").insert(row);
  return { data: null, error };
}

/** An async room's per-round records (async_room_secrets.round_records). */
export async function writeAsyncRoundRecords(client: Db, roomId: string, rounds: Json): Promise<Result<null>> {
  const { error } = await client
    .from("async_room_secrets")
    .update({ round_records: rounds })
    .eq("room_id", roomId);
  return { data: null, error };
}
