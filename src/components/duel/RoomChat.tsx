import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, MessageCircle, Minimize2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fx } from "@/lib/fx";
import { buzz } from "@/lib/motion";
import { playBlip } from "@/lib/sound";

import {
  MESSAGE_MAX_LENGTH,
  ROOM_EMOJI,
  type RoomMessageRow,
} from "@/lib/duel/chatConstants";
import { CHAT_TOAST_BUZZ_MS, CHAT_TOAST_MS, chatToastText, shouldToast } from "@/lib/duel/chatNotice";
import { chatToastBottom } from "@/lib/duel/chatToastPlace";
import type { RoomChatState } from "@/lib/duel/useRoomChat";
import { PLAYER_COLOURS, type PlayerLook, type PlayerLooks } from "@/lib/duel/playerLook";
import type { DuelPlayerRow } from "@/lib/duel/types";

import { PlayerBadge } from "./PlayerBadge";
import { RoomChatButton, RoomChatSlot, RoomFooter } from "./RoomFooter";

interface RoomChatProps {
  chat: RoomChatState;
  myUserId: string;
  /** The room's players and their colours: each message's sender gets their badge. */
  players?: DuelPlayerRow[];
  looks?: PlayerLooks;
  available?: boolean;
  screenLabel?: string;
  /**
   * Draw the chat button's own footer row (a screen without a footer). The room route passes false and
   * hands the button to each screen's RoomFooter instead (RoomChatSlot), beside its main action.
   */
  bar?: boolean;
}

/** The sender's colour for the toast's rim (the border colour when they have none). */
function playerColourHex(look: PlayerLook | undefined): string {
  return look ? PLAYER_COLOURS[look.colour]?.hex ?? "var(--border)" : "var(--border)";
}

/**
 * During a round: a small gold dot over the corner of the room's score header while chat messages
 * are unread (chatNotice.ts). No toast, sound or haptic, nothing to tap; display only.
 */
export function RoundChatDot({ unread }: { unread: number }) {
  if (unread <= 0) return null;
  return (
    <span
      data-round-chat-dot={unread}
      role="status"
      className="pointer-events-none absolute -top-0.5 right-0 z-10 block h-2 w-2 rounded-full bg-primary ring-2 ring-background"
    >
      <span className="sr-only">{unread === 1 ? "1 unread message" : `${unread} unread messages`}</span>
    </span>
  );
}

/** Floating reaction bubbles, bottom-right, fading upward over 1.5s. */
export function ReactionLayer({ chat }: { chat: RoomChatState }) {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const reaction of chat.reactions) {
      if (!seen.current.has(reaction.id)) {
        seen.current.add(reaction.id);
        fx.onReaction(reaction.emoji);
      }
    }
    if (seen.current.size > 100) seen.current = new Set(chat.reactions.map((r) => r.id));
  }, [chat.reactions]);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-20 right-3 z-40 flex flex-col items-end gap-1"
    >
      {chat.reactions.map((reaction) => (
        <div key={reaction.id} className="animate-reaction-float flex items-center gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {reaction.name}
          </span>
          <span className="text-3xl leading-none">{reaction.emoji}</span>
        </div>
      ))}
    </div>
  );
}

function MessageRow({
  message,
  mine,
  look,
  onLongPress,
}: {
  message: RoomMessageRow;
  mine: boolean;
  look?: PlayerLook | undefined;
  onLongPress: () => void;
}) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const start = (event: React.PointerEvent) => {
    stop();
    origin.current = { x: event.clientX, y: event.clientY };
    timer.current = window.setTimeout(onLongPress, 500);
  };
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return (
    <li
      onPointerDown={start}
      onPointerMove={(event) => {
        const from = origin.current;
        if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > 8) stop();
      }}
      onPointerCancel={stop}
      onPointerUp={stop}
      onPointerLeave={stop}
      onContextMenu={(event) => {
        event.preventDefault();
        onLongPress();
      }}
      className="px-1 py-1 text-left text-sm leading-snug"
    >
      <PlayerBadge look={look} name={message.sender_name} size={16} className="mr-1.5 align-[-3px]" />
      <span className={mine ? "font-semibold text-primary" : "font-semibold text-foreground"}>
        {message.sender_name}:
      </span>{" "}
      <span className={mine ? "text-primary" : "text-muted-foreground"}>{message.text}</span>
    </li>
  );
}

/** Message sheets are portalled outside screen touch/overflow ancestry. */
export function RoomChat({
  chat,
  myUserId,
  players = [],
  looks,
  available = true,
  screenLabel = "Lobby",
  bar = true,
}: RoomChatProps) {
  const lookOf = (userId: string) => {
    const slot = players.find((p) => p.user_id === userId)?.player_slot;
    return slot === undefined ? undefined : looks?.get(slot);
  };
  const [text, setText] = useState("");
  const [menuFor, setMenuFor] = useState<RoomMessageRow | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [viewport, setViewport] = useState<{ height: number; bottom: number } | null>(null);
  const syncViewport = useRef<() => void>(() => {});
  const list = useRef<HTMLUListElement | null>(null);
  const atBottom = useRef(true);
  const [newBelow, setNewBelow] = useState(false);
  const seenCount = useRef(chat.messages.length);
  const focusScroll = useRef<{ x: number; y: number } | null>(null);
  const headerTouch = useRef<{ x: number; y: number } | null>(null);
  const savedListTop = useRef(0);
  const open = available && chat.sheetOpen;
  const setSheetOpen = chat.setSheetOpen;
  // The new-message toast (chatNotice.ts): only messages that land while this screen is up and the
  // chat is available; one that arrived during a round never toasts afterwards.
  const [toast, setToast] = useState<RoomMessageRow | null>(null);
  const toastSeen = useRef<string | null>(chat.incoming?.id ?? null);
  const toastTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const message = chat.incoming;
    if (!message || message.id === toastSeen.current) return;
    toastSeen.current = message.id;
    if (!shouldToast(message, { myUserId, chatAvailable: available, sheetOpen: open })) return;
    setToast(message);
    playBlip();
    buzz(CHAT_TOAST_BUZZ_MS);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), CHAT_TOAST_MS);
  }, [chat.incoming, available, open, myUserId]);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (open || !available) setToast(null);
  }, [open, available]);
  // At the bottom, above the home bar and every control pinned there (chatToastPlace.ts).
  const toastRef = useRef<HTMLButtonElement | null>(null);
  const [toastBottom, setToastBottom] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!toast) return setToastBottom(null);
    const place = () => setToastBottom(chatToastBottom(document, window, toastRef.current));
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [toast]);

  useEffect(() => {
    setMounted(true);
    // Only this sheet follows the keyboard viewport; never resize/reset the page.
    const visual = window.visualViewport;
    const sync = () => {
      const chatInputFocused = document.activeElement?.hasAttribute("data-room-chat-input");
      // Browser chrome/zoom must not leave a keyboard-sized gap below the sheet.
      const keyboardOpen = chatInputFocused && visual && visual.scale <= 1.05 &&
        window.innerHeight - visual.height > 120;
      setViewport(keyboardOpen ? {
        height: visual.height,
        bottom: Math.max(0, window.innerHeight - visual.height - visual.offsetTop),
      } : null);
    };
    syncViewport.current = sync;
    sync();
    visual?.addEventListener("resize", sync);
    visual?.addEventListener("scroll", sync);
    return () => {
      visual?.removeEventListener("resize", sync);
      visual?.removeEventListener("scroll", sync);
    };
  }, []);
  useEffect(() => {
    if (!available) {
      setSheetOpen(false);
      setMenuFor(null);
      setExpanded(false);
    }
  }, [available, setSheetOpen]);

  const toBottom = () => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottom.current = true;
    setNewBelow(false);
  };
  useEffect(() => {
    if (!open) return;
    const el = list.current;
    if (atBottom.current) toBottom();
    else if (el) el.scrollTop = savedListTop.current;
  }, [open, expanded, viewport?.height]);
  useEffect(() => {
    const grew = chat.messages.length > seenCount.current;
    seenCount.current = chat.messages.length;
    if (!grew) return;
    if (open && atBottom.current) toBottom();
    else if (!atBottom.current) setNewBelow(true);
  }, [chat.messages.length, open]);
  const close = () => {
    savedListTop.current = list.current?.scrollTop ?? savedListTop.current;
    chat.setSheetOpen(false);
    setExpanded(false);
  };
  const submit = () => {
    const value = text.trim();
    if (!value || chat.sending) return;
    setText("");
    void chat.send(value);
  };
  // The composer lives in the sheet (Polish batch R): the input, Send and, under them, the reactions.
  const composer = (
    <div className="flex min-w-0 shrink-0 flex-col gap-1.5">
      <div className="flex h-11 min-w-0 items-center gap-2">
        <input
          data-room-chat-input
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) submit();
          }}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder="Chat…"
          aria-label="Message"
          onFocus={() => {
            focusScroll.current = { x: window.scrollX, y: window.scrollY };
            syncViewport.current();
          }}
          onBlur={() => {
            setViewport(null);
            const saved = focusScroll.current;
            focusScroll.current = null;
            if (!saved) return;
            window.setTimeout(() => {
              if (window.scrollX !== saved.x || window.scrollY !== saved.y)
                window.scrollTo(saved.x, saved.y);
            }, 50);
          }}
          className="ap-input h-11 min-w-0 flex-1 px-3 text-[16px]"
        />
        {/* Neutral: sending a message is not a play action (the gold rule). */}
        <button
          type="button"
          onClick={submit}
          disabled={chat.sending || !text.trim()}
          aria-label="Send message"
          title="Send message"
          className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ap-text)] text-[var(--ap-bg)] disabled:opacity-40"
        >
          <Send aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <div className="flex shrink-0 items-center justify-between" data-chat-reactions>
        {ROOM_EMOJI.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`React ${emoji}`}
            onClick={() => void chat.react(emoji)}
            className="press flex h-11 w-11 items-center justify-center rounded-xl text-xl leading-none"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
  if (!available) return null;
  const sheet = open ? (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label="Close messages"
        onClick={close}
        className="fixed inset-0 z-40 h-full w-full rounded-none bg-background/40 p-0"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Room messages"
        data-room-chat-sheet
        data-expanded={expanded}
        data-skin="room"
        className="th-sheet fixed inset-x-0 z-50 mx-auto flex min-h-0 w-full max-w-[430px] flex-col overflow-hidden rounded-t-2xl border border-border bg-card"
        style={{
          height: viewport
            ? viewport.height * (expanded ? 0.85 : 0.6)
            : expanded
              ? "85dvh"
              : "60dvh",
          bottom: viewport?.bottom ?? 0,
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      >
        <header
          className="flex h-12 min-h-0 shrink-0 items-center gap-2 border-b border-border px-3"
          onTouchStart={(event) => {
            const touch = event.touches[0];
            headerTouch.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
          }}
          onTouchEnd={(event) => {
            const start = headerTouch.current;
            const end = event.changedTouches[0];
            if (start && end && end.clientY - start.y > 40 && Math.abs(end.clientX - start.x) < 40)
              close();
            headerTouch.current = null;
          }}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={() => (expanded ? close() : setExpanded(true))}
            className="h-11 min-w-0 flex-1 justify-between px-0"
            aria-label={expanded ? "Collapse messages" : "Expand messages"}
          >
            <span className="truncate font-display font-bold">Messages</span>
            <span className="font-mono text-xs text-muted-foreground">{screenLabel}</span>
            {expanded ? <Minimize2 /> : <Maximize2 />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label="Close messages"
            className="h-11 w-11 shrink-0"
          >
            <X />
          </Button>
        </header>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <ul
            ref={list}
            data-scrollable
            onScroll={() => {
              const el = list.current;
              if (!el) return;
              savedListTop.current = el.scrollTop;
              atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
              if (atBottom.current) setNewBelow(false);
            }}
            className="chat-scroll h-0 min-h-0 flex-1 px-3 py-2"
          >
            {!chat.messages.length && (
              <li className="py-6 text-center text-xs text-muted-foreground">No messages yet.</li>
            )}
            {chat.messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                mine={message.sender_user_id === myUserId}
                look={lookOf(message.sender_user_id)}
                onLongPress={() => setMenuFor(message)}
              />
            ))}
          </ul>
          {newBelow && (
            <Button
              type="button"
              onClick={toBottom}
              className="absolute bottom-2 left-1/2 h-8 -translate-x-1/2 px-3 font-mono text-[11px]"
            >
              New messages ↓
            </Button>
          )}
        </div>
        <footer className="min-h-0 shrink-0 border-t border-border bg-card px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">
          {composer}
          {(chat.notice || chat.error) && (
            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              {chat.error ?? chat.notice}
            </p>
          )}
        </footer>
      </section>
    </>
  ) : null;
  const menu = menuFor ? (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-background/70 p-4"
      onClick={() => setMenuFor(null)}
    >
      <div
        className="w-full max-w-[400px] rounded-md border border-border bg-card p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="px-3 py-2 text-center font-mono text-[11px] uppercase text-muted-foreground">
          {menuFor.sender_name}
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            chat.toggleLocalMute(menuFor.sender_user_id);
            setMenuFor(null);
          }}
          className="tap-target w-full justify-start"
        >
          {chat.mutedUserIds.includes(menuFor.sender_user_id)
            ? `Unmute ${menuFor.sender_name}`
            : `Mute ${menuFor.sender_name}`}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            void chat.report(menuFor.id);
            setMenuFor(null);
          }}
          className="tap-target w-full justify-start text-warn"
        >
          Report
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setMenuFor(null)}
          className="tap-target w-full justify-start text-muted-foreground"
        >
          Cancel
        </Button>
      </div>
    </div>
  ) : null;
  const toastCard = toast && !open ? (
    <button
      type="button"
      key={toast.id}
      ref={toastRef}
      data-chat-toast={toast.id}
      data-skin="room"
      aria-label={`New message from ${toast.sender_name}: ${toast.text}. Open messages`}
      onClick={() => {
        setToast(null);
        setSheetOpen(true);
      }}
      className="th-sheet fixed inset-x-0 z-[58] mx-auto flex h-12 w-[calc(100%-32px)] max-w-[398px] items-center gap-2 rounded-full border bg-card px-3 text-left shadow-lg chat-toast-up"
      style={{
        bottom: toastBottom === null ? "calc(env(safe-area-inset-bottom, 0px) + 8px)" : `${toastBottom}px`,
        visibility: toastBottom === null ? "hidden" : undefined,
        borderColor: playerColourHex(lookOf(toast.sender_user_id)),
      }}
    >
      <PlayerBadge look={lookOf(toast.sender_user_id)} name={toast.sender_name} size={24} />
      <span className="min-w-0 flex-1 truncate text-sm leading-tight">
        <span className="font-display font-semibold text-foreground">{toast.sender_name}</span>{" "}
        <span className="text-muted-foreground">{chatToastText(toast.text)}</span>
      </span>
      <MessageCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
    </button>
  ) : null;
  return (
    <>
      <ReactionLayer chat={chat} />
      {bar ? (
        <RoomChatSlot.Provider value={<RoomChatButton chat={chat} available />}>
          <RoomFooter className={open ? "invisible pointer-events-none" : ""} />
        </RoomChatSlot.Provider>
      ) : null}
      {!open && chat.error && (
        <p className="shrink-0 text-center text-[11px] text-warn">{chat.error}</p>
      )}
      {mounted &&
        createPortal(
          <>
            {toastCard}
            {sheet}
            {menu}
          </>,
          document.body,
        )}
    </>
  );
}
