/**
 * Room chat (`room_messages`, `room_reports`): the server's reads and writes. Server only (architecture audit B2).
 * The caller picks the client: a server function's user client keeps RLS (the room's own messages only), the
 * service-role client writes. The phone's own reads are in chatReads.ts.
 */

import type { ReportReason } from "@/lib/safety/reports";

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

/** A message by id, only if it is this room's, with what a report keeps of it (its sender and text). */
export async function readRoomMessageForReport(
  client: Db,
  roomId: string,
  messageId: string,
): Promise<Result<{ id: string; sender_user_id: string; sender_name: string; text: string } | null>> {
  const { data, error } = await client
    .from("room_messages")
    .select("id, sender_user_id, sender_name, text")
    .eq("id", messageId)
    .eq("duel_id", roomId)
    .maybeSingle();
  return { data, error };
}

export type { ReportReason };

/** What filing a report answers: whether it counts towards the automatic mute, and whether it started one. */
export interface ReportFiled {
  counts: boolean;
  muted: boolean;
}

/**
 * Files a report (a message's, or a player's name from any room screen; safety, 10 Nov 2026, docs/moderation.md)
 * through `file_room_report`, which stores the context, decides whether it counts (one report per reporter per
 * reported player per UK day) and applies the automatic mute. The original shape (room, message, reporter) still
 * works. On a database without the moderation migration the row is inserted as before and nothing counts.
 */
export async function insertRoomReport(
  client: Db,
  row: {
    duel_id: string;
    message_id: string | null;
    reporter_user_id: string;
    reported_user_id?: string | null;
    reason?: ReportReason;
    message_text?: string | null;
    reported_name?: string | null;
  },
): Promise<Result<ReportFiled | null>> {
  const { data, error } = await client.rpc("file_room_report", {
    p_duel_id: row.duel_id,
    p_message_id: row.message_id,
    p_reporter_user_id: row.reporter_user_id,
    p_reported_user_id: row.reported_user_id ?? null,
    p_reason: row.reason ?? "abusive_chat",
    p_message_text: row.message_text ?? null,
    p_reported_name: row.reported_name ?? null,
  });
  if (error && missingFunction(error)) {
    const plain = await client
      .from("room_reports")
      .insert({ duel_id: row.duel_id, message_id: row.message_id, reporter_user_id: row.reporter_user_id });
    return { data: plain.error ? null : { counts: false, muted: false }, error: plain.error };
  }
  if (error || !data || typeof data !== "object") return { data: null, error };
  const filed = data as { counts?: unknown; muted?: unknown };
  return { data: { counts: filed.counts === true, muted: filed.muted === true }, error: null };
}

/** A function the database doesn't have yet (its migration not applied): PostgREST's PGRST202, Postgres' 42883. */
export function missingFunction(error: { code?: unknown; message?: unknown } | null | undefined): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  return code === "PGRST202" || code === "42883" || /could not find the function/i.test(String(error.message ?? ""));
}
