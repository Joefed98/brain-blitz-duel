/**
 * Room chat and reactions. Every write goes through here: clients can read
 * their room's messages but never insert them.
 */

import { CHAT_MAX, COUNT_MAX, ID_MAX, SHORT_MAX } from "./inputLimits";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/data/db.server";
import { bool, compact, optional, record, text, uuid, whole } from "@/lib/validate";

import {
  MESSAGE_MAX_LENGTH,
  MESSAGE_MAX_PER_PLAYER,
  MESSAGE_MIN_GAP_MS,
  REACTION_MIN_GAP_MS,
  ROOM_EMOJI,
} from "./chatConstants";

/** The longest reaction code a phone may send (an emoji, or a reaction pack's emote code such as `reaction.banter#2`). */
const REACTION_CODE_MAX = 64;

interface Sender {
  id: string;
  display_name: string;
  status: string;
  muted_by_host: boolean;
  last_reaction_at: string | null;
  public_id?: string | null;
}

/**
 * The caller's player row, or null when they are not in the room. Read with the service role (Security C1b: phones,
 * and so the caller's own client, can't read or filter on account ids); it is the caller's own row, the one their row
 * level security read answered.
 */
async function senderRow(_client: Db, roomId: string, userId: string): Promise<Sender | null> {
  const { readChatSender } = await import("@/lib/data/players.server");
  const { data } = await readChatSender(await admin(), roomId, userId);
  return data ?? null;
}

/** The service-role client for the writes (src/lib/data/db.server.ts). */
async function admin(): Promise<Db> {
  const { adminDb } = await import("@/lib/data/db.server");
  return adminDb();
}

export const sendRoomMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; text: string }) => {
    const b = record(input);
    return { roomId: text(b["roomId"], ID_MAX, "roomId"), text: text(b["text"], CHAT_MAX, "text") };
  })
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

    // The names' character strip (no control, bidi or zero-width characters), cut by code point.
    const { cleanChatText, censorChat } = await import("./displayName.server");
    let text = cleanChatText(data.text, MESSAGE_MAX_LENGTH);
    if (!text) return { ok: false as const, message: "Type a message first." };
    // Rated rooms (wave 3, W3b): strangers meet, so wave 1's stranger rules apply (ratedChat.server.ts); null for
    // every ordinary room, which sends exactly as before.
    const { ratedChatText } = await import("@/lib/rated/ratedChat.server");
    const rated = await ratedChatText(await admin(), data.roomId, context.userId, text, Date.now());
    if (rated && !rated.ok) return { ok: false as const, message: rated.message };
    if (rated) text = rated.text;
    // Tournament rooms (wave 4, W4b: an Arena duel): the same stranger rules (tournamentChat.server.ts); null elsewhere.
    const { tournamentChatText } = await import("@/lib/tournaments/tournamentChat.server");
    const tournament = await tournamentChatText(await admin(), data.roomId, context.userId, text, Date.now());
    if (tournament && !tournament.ok) return { ok: false as const, message: tournament.message };
    if (tournament) text = tournament.text;

    const { insertRoomMessage, readOwnRecentMessages } = await import("@/lib/data/chat.server");
    // The caller's own messages (the service role, as senderRow; a player still in the room reads their room's chat).
    const { data: mine } = await readOwnRecentMessages(await admin(), data.roomId, context.userId, MESSAGE_MAX_PER_PLAYER);
    const sent = mine ?? [];

    if (sent.length >= MESSAGE_MAX_PER_PLAYER) {
      return { ok: false as const, message: "You’ve hit the message limit for this room." };
    }
    const last = sent[0]?.created_at;
    if (last && Date.now() - new Date(last).getTime() < MESSAGE_MIN_GAP_MS) {
      return { ok: false as const, message: "Slow down a moment." };
    }

    const supabaseAdmin = await admin();
    // The gap and cap above, counted again in atomic buckets (rateLimit.server.ts).
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

type ReactionSender = Sender & { player_slot: number };

/**
 * The checks every reaction passes (the room's emoji or an equipped emote, in the room, not muted by the host or by
 * reports, not banned, one a second), then the reaction's time stored. Answers the sender's row, or the refusal.
 */
async function approveReaction(
  client: Db,
  roomId: string,
  userId: string,
  emoji: string,
): Promise<{ ok: true; sender: ReactionSender } | { ok: false; message: string }> {
  // The room's emoji, or (wave 2 E2) an emote from a reaction pack the caller has equipped in a reaction slot.
  let pack: string | null = null;
  if (!ROOM_EMOJI.includes(emoji as (typeof ROOM_EMOJI)[number])) {
    const { emoteOf } = await import("@/design/identity/cosmetics");
    const emote = emoteOf(emoji);
    if (!emote) return { ok: false, message: "That reaction doesn’t exist." };
    pack = emote.pack;
  }
  const sender = (await senderRow(client, roomId, userId)) as ReactionSender | null;
  if (!sender || sender.status === "left") {
    return { ok: false, message: "You’re not in this room." };
  }
  if (sender.muted_by_host) {
    return { ok: false, message: "The host has muted you in this room." };
  }
  const { chatRefusal } = await import("@/lib/safety/moderation.server");
  const refusedChat = await chatRefusal(await admin(), userId);
  if (refusedChat) return { ok: false, message: refusedChat };
  if (
    sender.last_reaction_at &&
    Date.now() - new Date(sender.last_reaction_at).getTime() < REACTION_MIN_GAP_MS
  ) {
    return { ok: false, message: "One reaction a second." };
  }
  if (pack) {
    const { canSendPack } = await import("@/lib/cosmetics/cosmetics.server");
    if (!(await canSendPack(await admin(), userId, pack).catch(() => false)))
      return { ok: false, message: "Equip that reaction in Customise first." };
  }

  const { updatePlayer } = await import("@/lib/data/players.server");
  await updatePlayer(await admin(), sender.id, { last_reaction_at: new Date().toISOString() });
  return { ok: true, sender };
}

/** A reaction's input: the room and the reaction's code (an emoji or an emote code). */
function reactionInput(input: unknown): { roomId: string; emoji: string } {
  const body = record(input);
  return { roomId: uuid(body["roomId"], "roomId"), emoji: text(body["emoji"], REACTION_CODE_MAX, "emoji") };
}

/** Checks a reaction against the room's rules (it sends nothing; sendReactionFn sends). */
export const allowReactionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(reactionInput)
  .handler(async ({ data, context }) => {
    const approved = await approveReaction(context.supabase, data.roomId, context.userId, data.emoji);
    if (!approved.ok) return approved;
    return { ok: true as const, name: approved.sender.display_name };
  });

/**
 * Sends a reaction to the room (13 Nov 2026): the same checks, then the server broadcasts it on the room's private
 * chat topic with the sender's public id (`playerId`, Security C1b: never the account id), slot and name from the
 * server's own player row. The phone only listens.
 */
export const sendReactionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(reactionInput)
  .handler(async ({ data, context }) => {
    const approved = await approveReaction(context.supabase, data.roomId, context.userId, data.emoji);
    if (!approved.ok) return approved;
    const { broadcastRoomReaction } = await import("@/lib/data/chat.server");
    const { error } = await broadcastRoomReaction(await admin(), data.roomId, {
      emoji: data.emoji,
      playerId: approved.sender.public_id ?? null,
      name: approved.sender.display_name,
      slot: approved.sender.player_slot,
    });
    if (error) return { ok: false as const, message: "That reaction didn’t send." };
    return { ok: true as const };
  });

/**
 * Files a report against one message (safety, 10 Nov 2026: with a reason, default abusive chat; docs/moderation.md).
 * The report keeps the message's text and its sender's name as they were. The reported player is never told who
 * reported them, or that they were reported.
 */
export const reportMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; messageId: string; reason?: string }) => {
    const b = record(input);
    return compact({ roomId: text(b["roomId"], ID_MAX, "roomId"), messageId: text(b["messageId"], ID_MAX, "messageId"), reason: optional(b["reason"], (x) => text(x, SHORT_MAX, "reason")) });  })
  .handler(async ({ data, context }) => {
    const sender = await senderRow(context.supabase, data.roomId, context.userId);
    if (!sender) return { ok: false as const, message: "You’re not in this room." };
    const { isReportReason, REPORT_THANKS } = await import("@/lib/safety/reports");
    const reason = data.reason === undefined ? "abusive_chat" : data.reason;
    if (!isReportReason(reason)) return { ok: false as const, message: "Pick a reason." };
    const supabaseAdmin = await admin();
    const { insertRoomReport, readRoomMessageForReport } = await import("@/lib/data/chat.server");
    // The reported message must be one of this room's, readable by the caller: a player still in the room reads its
    // chat (public.can_read_room_chat). Read with the service role (Security C1b), the caller's reading rule checked here.
    const { data: message } =
      sender.status === "left" ? { data: null } : await readRoomMessageForReport(supabaseAdmin, data.roomId, String(data.messageId ?? ""));
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
  .inputValidator((input: { roomId: string; slot: number; reason: string }) => {
    const b = record(input);
    return { roomId: text(b["roomId"], ID_MAX, "roomId"), slot: whole(b["slot"], -COUNT_MAX, COUNT_MAX, "slot"), reason: text(b["reason"], SHORT_MAX, "reason") };
  })
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
  .inputValidator((input: { roomId: string; slot: number; muted: boolean }) => {
    const b = record(input);
    return { roomId: text(b["roomId"], ID_MAX, "roomId"), slot: whole(b["slot"], -COUNT_MAX, COUNT_MAX, "slot"), muted: bool(b["muted"], "muted") };
  })
  .handler(async ({ data, context }) => {
    // A room's players read its row (public.is_duel_participant: any seat); read with the service role (Security C1b).
    const seat = await senderRow(context.supabase, data.roomId, context.userId);
    const { readRoomHost } = await import("@/lib/data/rooms.server");
    const { data: room } = seat ? await readRoomHost(await admin(), data.roomId) : { data: null };
    if (!room) return { ok: false as const, message: "Room not found." };
    if (room.host_user_id !== context.userId) {
      return { ok: false as const, message: "Only the host can do that." };
    }
    const { updatePlayerAtSlot } = await import("@/lib/data/players.server");
    await updatePlayerAtSlot(await admin(), data.roomId, data.slot, { muted_by_host: data.muted === true });
    return { ok: true as const };
  });
