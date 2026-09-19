/**
 * Room chat and reactions. Every write goes through here: clients can read
 * their room's messages but never insert them.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
async function senderRow(client: any, roomId: string, userId: string): Promise<Sender | null> {
  const { data } = await client
    .from("duel_players")
    .select("id, display_name, status, muted_by_host, last_reaction_at")
    .eq("duel_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Sender | null) ?? null;
}

export const sendRoomMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; text: string }) => input)
  .handler(async ({ data, context }) => {
    const client = context.supabase;
    const sender = await senderRow(client, data.roomId, context.userId);
    if (!sender || sender.status === "left") {
      return { ok: false as const, message: "You're not in this room." };
    }
    if (sender.muted_by_host) {
      return { ok: false as const, message: "The host has muted you in this room." };
    }

    const text = (data.text ?? "").replace(/\s+/g, " ").trim().slice(0, MESSAGE_MAX_LENGTH);
    if (!text) return { ok: false as const, message: "Type a message first." };

    const { data: mine } = await client
      .from("room_messages")
      .select("created_at")
      .eq("duel_id", data.roomId)
      .eq("sender_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_MAX_PER_PLAYER);
    const sent = (mine ?? []) as { created_at: string }[];

    if (sent.length >= MESSAGE_MAX_PER_PLAYER) {
      return { ok: false as const, message: "You've hit the message limit for this room." };
    }
    const last = sent[0]?.created_at;
    if (last && Date.now() - new Date(last).getTime() < MESSAGE_MIN_GAP_MS) {
      return { ok: false as const, message: "Slow down a moment." };
    }

    const { censor } = await import("./profanity.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("room_messages").insert({
      duel_id: data.roomId,
      sender_user_id: context.userId,
      sender_name: sender.display_name,
      text: censor(text),
    });
    if (error) return { ok: false as const, message: "Message didn't send. Try again." };
    return { ok: true as const };
  });

/** Checks the reaction is allowed before the client broadcasts it. */
export const allowReactionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; emoji: string }) => input)
  .handler(async ({ data, context }) => {
    if (!ROOM_EMOJI.includes(data.emoji as (typeof ROOM_EMOJI)[number])) {
      return { ok: false as const, message: "Unknown reaction." };
    }
    const sender = await senderRow(context.supabase, data.roomId, context.userId);
    if (!sender || sender.status === "left") {
      return { ok: false as const, message: "You're not in this room." };
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("duel_players")
      .update({ last_reaction_at: new Date().toISOString() })
      .eq("id", sender.id);
    return { ok: true as const, name: sender.display_name };
  });

/** Files a report against one message. No moderation UI beyond a thank-you. */
export const reportMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; messageId: string }) => input)
  .handler(async ({ data, context }) => {
    const sender = await senderRow(context.supabase, data.roomId, context.userId);
    if (!sender) return { ok: false as const, message: "You're not in this room." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("room_reports").insert({
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
    const { data: room } = await client
      .from("duels")
      .select("id, host_user_id")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) return { ok: false as const, message: "Room not found." };
    if ((room as { host_user_id: string | null }).host_user_id !== context.userId) {
      return { ok: false as const, message: "Only the host can do that." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("duel_players")
      .update({ muted_by_host: data.muted === true })
      .eq("duel_id", data.roomId)
      .eq("player_slot", data.slot);
    return { ok: true as const };
  });
