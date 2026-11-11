import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { readRoomMessages } from "@/lib/data/chatReads";
import {
  allowReactionFn,
  reportMessageFn,
  reportPlayerFn,
  sendRoomMessageFn,
  setPlayerMutedFn,
} from "./chat.functions";
import {
  MESSAGE_HISTORY_LIMIT,
  REACTION_LIFETIME_MS,
  REACTION_MIN_GAP_MS,
  type FloatingReaction,
  type RoomMessageRow,
} from "./chatConstants";
import { unreadCount } from "./chatNotice";
import type { ReportReason } from "@/lib/safety/reports";
import { GUEST_NAME_MAX } from "@/lib/names/username";
import { isRoomReaction } from "./roomReactions";

const MUTED_KEY = "duelz_muted_players";

function loadMuted(roomId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(`${MUTED_KEY}_${roomId}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveMuted(roomId: string, ids: string[]): void {
  try {
    window.sessionStorage.setItem(`${MUTED_KEY}_${roomId}`, JSON.stringify(ids));
  } catch {
    /* storage is a nicety */
  }
}

export interface RoomChatState {
  messages: RoomMessageRow[];
  reactions: FloatingReaction[];
  /** Messages from other players not yet seen in the open sheet (your own never count). */
  unread: number;
  /**
   * The latest message from another (unmuted) player that arrived live while the sheet was closed,
   * for RoomChat's toast; history loads never set it. RoomChat decides whether to show it (never
   * during a round).
   */
  incoming: RoomMessageRow | null;
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  sending: boolean;
  error: string | null;
  notice: string | null;
  send: (text: string) => Promise<void>;
  react: (emoji: string) => Promise<void>;
  /**
   * Reports a message with a reason (safety, 10 Nov 2026; default abusive chat). Answers the server's message (the
   * thank-you, or why it couldn't be filed); rejects when it couldn't be sent. The menu shows the answer.
   */
  report: (messageId: string, reason?: ReportReason) => Promise<string | void>;
  mutedUserIds: string[];
  toggleLocalMute: (userId: string) => void;
}

/**
 * Room chat: the last hundred messages, live updates, ephemeral reactions and
 * this device's own mute list. Nothing is sent or received while `active` is
 * false — that is the puzzle phase.
 */
export function useRoomChat(
  roomId: string | null,
  myUserId: string | null,
  active: boolean,
): RoomChatState {
  const [messages, setMessages] = useState<RoomMessageRow[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Ids of messages seen in the open sheet; unread counts the others' messages not in it.
  const seenIds = useRef<Set<string>>(new Set());
  const [seenVersion, setSeenVersion] = useState(0);
  const [incoming, setIncoming] = useState<RoomMessageRow | null>(null);
  const [mutedUserIds, setMutedUserIds] = useState<string[]>(() =>
    roomId ? loadMuted(roomId) : [],
  );
  const lastReactionAt = useRef<Map<string, number>>(new Map());
  const knownIds = useRef<Set<string>>(new Set());
  const sheetOpenRef = useRef(sheetOpen);
  sheetOpenRef.current = sheetOpen;

  useEffect(() => {
    if (roomId) setMutedUserIds(loadMuted(roomId));
  }, [roomId]);

  const load = useCallback(async () => {
    if (!roomId) return;
    const { data } = await readRoomMessages(supabase, roomId, MESSAGE_HISTORY_LIMIT);
    const rows = (data ?? []).slice().reverse();
    for (const row of rows) knownIds.current.add(row.id);
    setMessages(rows);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    void load();
  }, [load, roomId]);

  // Live messages and ephemeral reactions for this room.
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room-chat-${roomId}`, { config: { broadcast: { self: true } } })
      .on(
        "postgres_changes",
        // This room's messages only (Speed fix 3 / security audit L6): Realtime checks no other room's chat for this phone.
        { event: "INSERT", schema: "public", table: "room_messages", filter: `duel_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as RoomMessageRow | undefined;
          if (!row || row.duel_id !== roomId || knownIds.current.has(row.id)) return;
          knownIds.current.add(row.id);
          setMessages((prev) => [...prev, row]);
          // The toast, sound and haptic are RoomChat's (never during a round); here only the row.
          if (row.sender_user_id !== myUserId && !sheetOpenRef.current) setIncoming(row);
        },
      )
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        const data = payload as { emoji?: string; name?: string; userId?: string } | undefined;
        if (!data?.emoji || !data.userId) return;
        // The channel is public to anyone holding the room id: show only the fixed emoji set, or (wave 2 E2) an emote
        // from a reaction pack its sender is known to have equipped.
        if (!isRoomReaction(data.emoji, data.userId)) return;
        // Every phone enforces the one-a-second limit, whoever sent it.
        const previous = lastReactionAt.current.get(data.userId) ?? 0;
        const now = Date.now();
        if (now - previous < REACTION_MIN_GAP_MS) return;
        lastReactionAt.current.set(data.userId, now);
        const bubble: FloatingReaction = {
          id: `${data.userId}-${now}-${Math.random().toString(36).slice(2, 7)}`,
          emoji: data.emoji,
          name: String(data.name ?? "Player").slice(0, GUEST_NAME_MAX),
          userId: data.userId,
          at: now,
        };
        setReactions((prev) => [...prev.slice(-11), bubble]);
        window.setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== bubble.id));
        }, REACTION_LIFETIME_MS);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myUserId, roomId]);

  // Refresh on returning from the puzzle phase, so nothing is missed.
  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  useEffect(() => {
    if (!sheetOpen) return;
    let added = false;
    for (const m of messages) {
      if (!seenIds.current.has(m.id)) {
        seenIds.current.add(m.id);
        added = true;
      }
    }
    if (added) setSeenVersion((v) => v + 1);
  }, [messages, sheetOpen]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !mutedUserIds.includes(m.sender_user_id)),
    [messages, mutedUserIds],
  );

  const visibleReactions = useMemo(
    () => reactions.filter((r) => !mutedUserIds.includes(r.userId)),
    [mutedUserIds, reactions],
  );

  const unread = useMemo(
    () => unreadCount(visibleMessages, myUserId, seenIds.current),
    // seenVersion: the seen set grew.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleMessages, myUserId, seenVersion],
  );

  const send = useCallback(
    async (text: string) => {
      if (!roomId || !text.trim()) return;
      setSending(true);
      setError(null);
      try {
        const result = await sendRoomMessageFn({ data: { roomId, text } });
        if (!result.ok) setError(result.message);
      } catch {
        setError("Message didn’t send. Try again.");
      } finally {
        setSending(false);
      }
    },
    [roomId],
  );

  const react = useCallback(
    async (emoji: string) => {
      if (!roomId || !myUserId) return;
      const previous = lastReactionAt.current.get(myUserId) ?? 0;
      if (Date.now() - previous < REACTION_MIN_GAP_MS) return;
      try {
        const result = await allowReactionFn({ data: { roomId, emoji } });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        const channel = supabase.channel(`room-chat-${roomId}`);
        await channel.send({
          type: "broadcast",
          event: "reaction",
          payload: { emoji, name: result.name, userId: myUserId },
        });
      } catch {
        /* a dropped reaction is not worth an error */
      }
    },
    [myUserId, roomId],
  );

  const report = useCallback(
    async (messageId: string, reason: ReportReason = "abusive_chat") => {
      if (!roomId) return;
      const result = (await reportMessageFn({ data: { roomId, messageId, reason } })) as { message?: unknown } | null;
      return typeof result?.message === "string" ? result.message : undefined;
    },
    [roomId],
  );

  const toggleLocalMute = useCallback(
    (userId: string) => {
      setMutedUserIds((prev) => {
        const next = prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId];
        if (roomId) saveMuted(roomId, next);
        return next;
      });
    },
    [roomId],
  );

  return {
    messages: visibleMessages,
    reactions: visibleReactions,
    unread,
    incoming: incoming && !mutedUserIds.includes(incoming.sender_user_id) ? incoming : null,
    sheetOpen,
    setSheetOpen,
    sending,
    error,
    notice,
    send,
    react,
    report,
    mutedUserIds,
    toggleLocalMute,
  };
}

/** Host control, used from the lobby player cards. */
export async function setPlayerMuted(roomId: string, slot: number, muted: boolean): Promise<void> {
  await setPlayerMutedFn({ data: { roomId, slot, muted } });
}

/**
 * Reports a player by their name (safety, 10 Nov 2026; the lobby's name tap, then a reason). Answers the message to
 * show (the same thank-you whatever happened).
 */
export async function reportPlayer(roomId: string, slot: number, reason: ReportReason): Promise<string> {
  const result = await reportPlayerFn({ data: { roomId, slot, reason } });
  return result.message;
}
