import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fx } from "@/lib/fx";

import {
  CHAT_BAR_HEIGHT,
  MESSAGE_MAX_LENGTH,
  ROOM_EMOJI,
  type RoomMessageRow,
} from "@/lib/duel/chatConstants";
import type { RoomChatState } from "@/lib/duel/useRoomChat";

interface RoomChatProps {
  chat: RoomChatState;
  myUserId: string;
  available?: boolean;
  screenLabel?: string;
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
  onLongPress,
}: {
  message: RoomMessageRow;
  mine: boolean;
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
  available = true,
  screenLabel = "Lobby",
}: RoomChatProps) {
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
  const barTouchY = useRef<number | null>(null);
  const savedListTop = useRef(0);
  const open = available && chat.sheetOpen;
  const setSheetOpen = chat.setSheetOpen;

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
  const composer = (
    <div className={`flex h-11 min-w-0 shrink-0 items-center gap-1.5 ${open ? "bg-card" : "bg-background"}`}>
      <Button
        type="button"
        variant="outline"
        onClick={() => (open ? close() : chat.setSheetOpen(true))}
        aria-label="Messages"
        className="relative h-11 w-11 shrink-0 p-0 font-mono text-xs text-muted-foreground"
      >
        {chat.messages.length}
        {chat.unread > 0 && !open && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
            {chat.unread}
          </span>
        )}
      </Button>
      <input
        data-room-chat-input
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) submit();
        }}
        maxLength={MESSAGE_MAX_LENGTH}
        placeholder="Say something"
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
        className="h-11 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
      />
      <Button
        type="button"
        onClick={submit}
        disabled={chat.sending || !text.trim()}
        aria-label="Send message"
        title="Send message"
        className="h-11 w-11 shrink-0 p-0"
      >
        <Send />
      </Button>
      <div className="flex shrink-0 items-center">
        {ROOM_EMOJI.map((emoji) => (
          <Button
            key={emoji}
            type="button"
            variant="ghost"
            aria-label={`React ${emoji}`}
            onClick={() => void chat.react(emoji)}
            className="h-11 w-7 p-0 text-lg leading-none"
          >
            {emoji}
          </Button>
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
        className="fixed inset-x-0 z-50 mx-auto flex min-h-0 w-full max-w-[430px] flex-col overflow-hidden rounded-t-lg border border-border bg-card"
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
  return (
    <>
      <ReactionLayer chat={chat} />
      <div
        data-chat-bar
        aria-hidden={open || undefined}
        className={`sticky z-[55] mt-2 shrink-0 bg-background ${open ? "invisible pointer-events-none" : ""}`}
        style={{ height: CHAT_BAR_HEIGHT, bottom: "env(safe-area-inset-bottom, 0px)" }}
        onTouchStart={(event) => {
          barTouchY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          const start = barTouchY.current;
          const end = event.changedTouches[0]?.clientY;
          if (start !== null && end !== undefined && start - end > 30) setSheetOpen(true);
          barTouchY.current = null;
        }}
      >
        {!open && composer}
      </div>
      {!open && chat.error && (
        <p className="shrink-0 text-center text-[11px] text-warn">{chat.error}</p>
      )}
      {mounted &&
        createPortal(
          <>
            {sheet}
            {menu}
          </>,
          document.body,
        )}
    </>
  );
}
