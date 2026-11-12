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
    // Safety (10 Nov 2026, docs/moderation.md): a banned player can't chat; a player muted by reports sees why.
    const { chatRefusal } = await import("@/lib/safety/moderation.server");
    const refusedChat = await chatRefusal(await admin(), context.userId);
    if (refusedChat) return { ok: false as const, message: refusedChat, muted: true as const };

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
    // The room's emoji, or (wave 2 E2) an emote from a reaction pack the caller has equipped in a reaction slot.
    let pack: string | null = null;
    if (!ROOM_EMOJI.includes(data.emoji as (typeof ROOM_EMOJI)[number])) {
      const { emoteOf } = await import("@/design/identity/cosmetics");
      const emote = emoteOf(String(data.emoji ?? ""));
      if (!emote) return { ok: false as const, message: "That reaction doesn’t exist." };
      pack = emote.pack;
    }
    const sender = await senderRow(context.supabase, data.roomId, context.userId);
    if (!sender || sender.status === "left") {
      return { ok: false as const, message: "You’re not in this room." };
    }
    if (sender.muted_by_host) {
      return { ok: false as const, message: "The host has muted you in this room." };
    }
    const { chatRefusal } = await import("@/lib/safety/moderation.server");
    const refusedChat = await chatRefusal(await admin(), context.userId);
    if (refusedChat) return { ok: false as const, message: refusedChat };
    if (
      sender.last_reaction_at &&
      Date.now() - new Date(sender.last_reaction_at).getTime() < REACTION_MIN_GAP_MS
    ) {
      return { ok: false as const, message: "One reaction a second." };
    }
    if (pack) {
      const { canSendPack } = await import("@/lib/cosmetics/cosmetics.server");
      if (!(await canSendPack(await admin(), context.userId, pack).catch(() => false)))
        return { ok: false as const, message: "Equip that reaction in Customise first." };
    }

    const { updatePlayer } = await import("@/lib/data/players.server");
    await updatePlayer(await admin(), sender.id, { last_reaction_at: new Date().toISOString() });
    return { ok: true as const, name: sender.display_name };
  });

/**
 * Files a report against one message (safety, 10 Nov 2026: with a reason, default abusive chat; docs/moderation.md).
 * The report keeps the message's text and its sender's name as they were. The reported player is never told who
 * reported them, or that they were reported.
 */
export const reportMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; messageId: string; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    const sender = await senderRow(context.supabase, data.roomId, context.userId);
    if (!sender) return { ok: false as const, message: "You’re not in this room." };
    const { isReportReason, REPORT_THANKS } = await import("@/lib/safety/reports");
    const reason = data.reason === undefined ? "abusive_chat" : data.reason;
    if (!isReportReason(reason)) return { ok: false as const, message: "Pick a reason." };
    const supabaseAdmin = await admin();
    const { insertRoomReport, readRoomMessageForReport } = await import("@/lib/data/chat.server");
    // The reported message must be one of this room's (read through the caller's RLS).
    const { data: message } = await readRoomMessageForReport(context.supabase, data.roomId, String(data.messageId ?? ""));
    if (!message) return { ok: false as const, message: "That message isn’t in this room." };
    const { REPORT_LIMIT, withinRateLimit } = await import("./rateLimit.server");
    if (!(await withinRateLimit(supabaseAdmin, context.userId, REPORT_LIMIT)))
      return { ok: false as const, message: REPORT_THANKS };
    const { data: filed } = await insertRoomReport(supabaseAdmin, {
      duel_id: data.roomId,
      message_id: message.id,
      reporter_user_id: context.userId,
      reported_user_id: message.sender_user_id,
      reason,
      message_text: message.text,
      reported_name: message.sender_name,
    });
    await noteReport(data.roomId, context.userId, message.sender_user_id, reason, filed?.muted === true);
    return { ok: true as const, message: REPORT_THANKS };
  });

/**
 * Files a report against a player in the room by their name (lobby, results, chat), with a reason. The report keeps
 * the name they had when reported. A player can't report themselves.
 */
export const reportPlayerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; slot: number; reason: string }) => input)
  .handler(async ({ data, context }) => {
    const reporter = await senderRow(context.supabase, data.roomId, context.userId);
    if (!reporter) return { ok: false as const, message: "You’re not in this room." };
    const { isReportReason, REPORT_THANKS } = await import("@/lib/safety/reports");
    if (!isReportReason(data.reason)) return { ok: false as const, message: "Pick a reason." };
    const supabaseAdmin = await admin();
    const { readPlayers } = await import("@/lib/data/players.server");
    const { data: players } = await readPlayers(supabaseAdmin, data.roomId);
    const reported = (players ?? []).find((p) => p.player_slot === Number(data.slot));
    if (!reported) return { ok: false as const, message: "That player isn’t in this room." };
    if (reported.user_id === context.userId) return { ok: false as const, message: "You can’t report yourself." };
    const { REPORT_LIMIT, withinRateLimit } = await import("./rateLimit.server");
    if (!(await withinRateLimit(supabaseAdmin, context.userId, REPORT_LIMIT)))
      return { ok: false as const, message: REPORT_THANKS };
    const { insertRoomReport } = await import("@/lib/data/chat.server");
    const { data: filed } = await insertRoomReport(supabaseAdmin, {
      duel_id: data.roomId,
      message_id: null,
      reporter_user_id: context.userId,
      reported_user_id: reported.user_id,
      reason: data.reason,
      reported_name: reported.display_name,
    });
    await noteReport(data.roomId, context.userId, reported.user_id, data.reason, filed?.muted === true);
    return { ok: true as const, message: REPORT_THANKS };
  });

/** The analytics for a report: report_sent (the reason only, never the message) and, when it started one, chat_muted. */
async function noteReport(roomId: string, reporterId: string, reportedId: string, reason: string, muted: boolean): Promise<void> {
  const { recordEvents } = await import("@/lib/data/events.server");
  recordEvents({ event: "report_sent", playerId: reporterId, mode: "room", roomId, props: { reason } });
  if (muted) recordEvents({ event: "chat_muted", playerId: reportedId, mode: "room", roomId });
}

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
