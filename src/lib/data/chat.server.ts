/**
 * Room chat (`room_messages`, `room_reports`): the server's reads and writes. Server only (architecture audit B2).
 * The caller picks the client: a server function's user client keeps RLS (the room's own messages only), the
 * service-role client writes. The phone's own reads are in chat.client.ts.
 */

import type { Db } from "./db.server";
import type { Result } from "./rooms.server";

/** The caller's latest `limit` messages in a room, newest first (the per-player cap and gap). */
export async function readOwnRecentMessages(
  client: Db,
  roomId: string,
  userId: string,
  limit: number,
): Promise<Result<{ created_at: string }[] | null>> {
  const { data, error } = await client
    .from("room_messages")
    .select("created_at")
    .eq("duel_id", roomId)
    .eq("sender_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data, error };
}

/** A message by id, only if it is this room's. */
export async function readRoomMessageId(
  client: Db,
  roomId: string,
  messageId: string,
): Promise<Result<{ id: string } | null>> {
  const { data, error } = await client
    .from("room_messages")
    .select("id")
    .eq("id", messageId)
    .eq("duel_id", roomId)
    .maybeSingle();
  return { data, error };
}

/** Stores a chat message (the text already cleaned and censored). */
export async function insertRoomMessage(
  client: Db,
  row: { duel_id: string; sender_user_id: string; sender_name: string; text: string },
): Promise<Result<null>> {
  const { error } = await client.from("room_messages").insert(row);
  return { data: null, error };
}

/** Files a report against a message. */
export async function insertRoomReport(
  client: Db,
  row: { duel_id: string; message_id: string; reporter_user_id: string },
): Promise<Result<null>> {
  const { error } = await client.from("room_reports").insert(row);
  return { data: null, error };
}
