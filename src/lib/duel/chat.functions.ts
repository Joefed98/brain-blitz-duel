/**
 * Room chat and reactions. Every write goes through here: clients can read
 * their room's messages but never insert them.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/data/db.server";

import {
  MESSAGE_MAX_LENGTH,
  MESSAGE_MAX_PER_PLAYER,
  MESSAGE_MIN_GAP_MS,
  REACTION_MIN_GAP_MS,
  ROOM_EMOJI,
} from "./chatConstants";

interface Sender {
  id: string;
  display_name: string;
  status: string;
  muted_by_host: boolean;
  last_reaction_at: string | null;
}

/** The caller's player row, or null when they are not in the room. */
async function senderRow(client: Db, roomId: string, userId: string): Promise<Sender | null> {
  const { readChatSender } = await import("@/lib/data/players.server");
  const { data } = await readChatSender(client, roomId, userId);
  return data ?? null;
}

/** The service-role client for the writes (src/lib/data/db.server.ts). */
async function admin(): Promise<Db> {
  const { adminDb } = await import("@/lib/data/db.server");
  return adminDb();
}

export const sendRoomMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; text: string }) => input)
  .handler(async ({ data, context }) => {
    const client = context.supabase;
    const sender = await senderRow(client, data.roomId, context.userId);
    if (!sender || sender.status === "left") {
      return { ok: false as const, message: "You’re not in this room." };
    }
    if (sender.muted_by_host) {
      return { ok: false as const, message: "The host has muted you in this room." };
    }

    // M2: the names' character strip (no control, bidi or zero-width characters), cut by code point.
    const { cleanChatText, censorChat } = await import("./displayName.server");
    const text = cleanChatText(data.text, MESSAGE_MAX_LENGTH);
    if (!text) return { ok: false as const, message: "Type a message first." };

    const { insertRoomMessage, readOwnRecentMessages } = await import("@/lib/data/chat.server");
    const { data: mine } = await readOwnRecentMessages(client, data.roomId, context.userId, MESSAGE_MAX_PER_PLAYER);
    const sent = mine ?? [];

    if (sent.length >= MESSAGE_MAX_PER_PLAYER) {
      return { ok: false as const, message: "You’ve hit the message limit for this room." };
    }
    const last = sent[0]?.created_at;
    if (last && Date.now() - new Date(last).getTime() < MESSAGE_MIN_GAP_MS) {
      return { ok: false as const, message: "Slow down a moment." };
    }

    const supabaseAdmin = await admin();
    // L3: the gap and cap above are read-then-insert, so parallel sends got past both; this bucket is atomic.
    const { chatGapLimit, chatRoomLimit, withinRateLimit } = await import("./rateLimit.server");
    if (!(await withinRateLimit(supabaseAdmin, context.userId, chatGapLimit(MESSAGE_MIN_GAP_MS)))) {
      return { ok: false as const, message: "Slow down a moment." };
    }
    if (!(await withinRateLimit(supabaseAdmin, context.userId, chatRoomLimit(data.roomId, MESSAGE_MAX_PER_PLAYER)))) {
      return { ok: false as const, message: "You’ve hit the message limit for this room." };
    }
    const { error } = await insertRoomMessage(supabaseAdmin, {
      duel_id: data.roomId,
      sender_user_id: context.userId,
      sender_name: sender.display_name,
      text: censorChat(text),
    });
    if (error) return { ok: false as const, message: "Message didn’t send. Try again." };
    return { ok: true as const };
  });

/** Checks the reaction is allowed before the client broadcasts it. */
export const allowReactionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; emoji: string }) => input)
  .handler(async ({ data, context }) => {
    if (!ROOM_EMOJI.includes(data.emoji as (typeof ROOM_EMOJI)[number])) {
      return { ok: false as const, message: "That reaction doesn’t exist." };
    }
    const sender = await senderRow(context.supabase, data.roomId, context.userId);
    if (!sender || sender.status === "left") {
      return { ok: false as const, message: "You’re not in this room." };
    }
    if (sender.muted_by_host) {
      return { ok: false as const, message: "The host has muted you in this room." };
    }
    if (
      sender.last_reaction_at &&
      Date.now() - new Date(sender.last_reaction_at).getTime() < REACTION_MIN_GAP_MS
    ) {
      return { ok: false as const, message: "One reaction a second." };
    }

    const { updatePlayer } = await import("@/lib/data/players.server");
    await updatePlayer(await admin(), sender.id, { last_reaction_at: new Date().toISOString() });
    return { ok: true as const, name: sender.display_name };
  });

/** Files a report against one message. No moderation UI beyond a thank-you. */
export const reportMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; messageId: string }) => input)
  .handler(async ({ data, context }) => {
    const sender = await senderRow(context.supabase, data.roomId, context.userId);
    if (!sender) return { ok: false as const, message: "You’re not in this room." };
    const supabaseAdmin = await admin();
    const { insertRoomReport, readRoomMessageId } = await import("@/lib/data/chat.server");
    // The reported message must be one of this room's (read through the caller's RLS).
    const { data: message } = await readRoomMessageId(context.supabase, data.roomId, String(data.messageId ?? ""));
    if (!message) return { ok: false as const, message: "That message isn’t in this room." };
    const { REPORT_LIMIT, withinRateLimit } = await import("./rateLimit.server");
    if (!(await withinRateLimit(supabaseAdmin, context.userId, REPORT_LIMIT)))
      return { ok: false as const, message: "Thanks, we’ve got your reports." };
    await insertRoomReport(supabaseAdmin, {
      duel_id: data.roomId,
      message_id: data.messageId,
      reporter_user_id: context.userId,
    });
    return { ok: true as const };
  });

/** Host only: mutes or unmutes one player's chat and reactions for everyone. */
export const setPlayerMutedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; slot: number; muted: boolean }) => input)
  .handler(async ({ data, context }) => {
    const client = context.supabase;
    const { readRoomHost } = await import("@/lib/data/rooms.server");
    const { data: room } = await readRoomHost(client, data.roomId);
    if (!room) return { ok: false as const, message: "Room not found." };
    if (room.host_user_id !== context.userId) {
      return { ok: false as const, message: "Only the host can do that." };
    }
    const { updatePlayerAtSlot } = await import("@/lib/data/players.server");
    await updatePlayerAtSlot(await admin(), data.roomId, data.slot, { muted_by_host: data.muted === true });
    return { ok: true as const };
  });
