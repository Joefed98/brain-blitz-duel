/**
 * The phone's own chat read (architecture audit B2): the room's latest messages, under RLS (the room's players
 * only). The caller passes the browser client. Realtime subscriptions stay in useRoomChat.ts.
 */

import type { RoomMessageRow } from "@/lib/duel/chatConstants";

import type { Db } from "./db";

/** The chat columns a phone reads (Security C1b: every column but the sender's account id). */
export const PHONE_MESSAGE_COLUMNS = "id, duel_id, sender_name, text, created_at, sender_public_id";

/** The room's latest `limit` messages, newest first. */
export async function readRoomMessages(
  client: Db,
  roomId: string,
  limit: number,
): Promise<{ data: RoomMessageRow[] | null; error: { message: string } | null }> {
  const { data, error } = await client
    .from("room_messages")
    .select(PHONE_MESSAGE_COLUMNS)
    .eq("duel_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data: data as unknown as RoomMessageRow[] | null, error };
}
