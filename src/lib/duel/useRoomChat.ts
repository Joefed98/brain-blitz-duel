import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  allowReactionFn,
  reportMessageFn,
  sendRoomMessageFn,
  setPlayerMutedFn,
} from "./chat.functions";
import {
  MESSAGE_HISTORY_LIMIT,
  REACTION_LIFETIME_MS,
  REACTION_MIN_GAP_MS,
  ROOM_EMOJI,
  type FloatingReaction,
  type RoomEmoji,
  type RoomMessageRow,
} from "./chatConstants";
import { unreadCount } from "./chatNotice";

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
  report: (messageId: string) => Promise<void>;
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
    const { data } = await supabase
      .from("room_messages")
      .select("*")
      .eq("duel_id", roomId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_HISTORY_LIMIT);
    const rows = ((data ?? []) as RoomMessageRow[]).slice().reverse();
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
        { event: "INSERT", schema: "public", table: "room_messages" },
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
        // The channel is public to anyone holding the room id: show only the fixed emoji set.
        if (!ROOM_EMOJI.includes(data.emoji as RoomEmoji)) return;
        // Every phone enforces the one-a-second limit, whoever sent it.
        const previous = lastReactionAt.current.get(data.userId) ?? 0;
        const now = Date.now();
        if (now - previous < REACTION_MIN_GAP_MS) return;
        lastReactionAt.current.set(data.userId, now);
        const bubble: FloatingReaction = {
          id: `${data.userId}-${now}-${Math.random().toString(36).slice(2, 7)}`,
          emoji: data.emoji,
          name: String(data.name ?? "Player").slice(0, 14),
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
    async (messageId: string) => {
      if (!roomId) return;
      try {
        await reportMessageFn({ data: { roomId, messageId } });
        setNotice("Thanks — that message has been reported.");
        window.setTimeout(() => setNotice(null), 2500);
      } catch {
        setNotice("Couldn’t send that report.");
        window.setTimeout(() => setNotice(null), 2500);
      }
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
