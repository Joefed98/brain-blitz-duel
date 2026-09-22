import { useEffect, useRef, useState } from "react";

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
}

/** Floating reaction bubbles, bottom-right, fading upward over 1.5s. */
export function ReactionLayer({ chat }: { chat: RoomChatState }) {
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
  const start = () => {
    timer.current = window.setTimeout(onLongPress, 500);
  };
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <li
      onPointerDown={start}
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

/**
 * The pinned chat bar plus its message sheet. Sits in the page flow so every
 * screen shrinks around it; the sheet floats above without covering the
 * screen's own buttons.
 */
export function RoomChat({ chat, myUserId }: RoomChatProps) {
  const [text, setText] = useState("");
  const [menuFor, setMenuFor] = useState<RoomMessageRow | null>(null);
  const listEnd = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (chat.sheetOpen) listEnd.current?.scrollIntoView({ block: "end" });
  }, [chat.messages.length, chat.sheetOpen]);

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    void chat.send(value);
  };

  return (
    <>
      <ReactionLayer chat={chat} />

      {chat.sheetOpen && (
        <>
          {/* Tapping anywhere outside the panel closes it. */}
          <button
            type="button"
            aria-label="Close messages"
            onClick={() => chat.setSheetOpen(false)}
            className="fixed inset-0 z-40 bg-background/40"
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[430px] flex-col"
            style={{ height: "60dvh" }}
            onTouchStart={(event) => {
              sheetTouchY.current = event.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={(event) => {
              const start = sheetTouchY.current;
              const end = event.changedTouches[0]?.clientY ?? null;
              if (start !== null && end !== null && end - start > 40) chat.setSheetOpen(false);
              sheetTouchY.current = null;
            }}
          >
            <div className="mx-2 flex min-h-0 flex-1 flex-col rounded-t-2xl border border-border bg-card/95 p-3 backdrop-blur">
              <div className="mb-2 flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => chat.setSheetOpen(false)}
                  className="press h-8 flex-1 rounded-full"
                  aria-label="Close messages"
                >
                  <span className="mx-auto block h-1.5 w-12 rounded-full bg-muted" />
                </button>
                <button
                  type="button"
                  onClick={() => chat.setSheetOpen(false)}
                  aria-label="Close messages"
                  className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border font-display text-base font-bold text-muted-foreground"
                >
                  ✕
                </button>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {chat.messages.length === 0 && (
                  <li className="py-6 text-center text-xs text-muted-foreground">
                    No messages yet.
                  </li>
                )}
                {chat.messages.map((message) => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    mine={message.sender_user_id === myUserId}
                    onLongPress={() => setMenuFor(message)}
                  />
                ))}
                <div ref={listEnd} />
              </ul>
              {chat.notice && (
                <p className="pt-1 text-center text-[11px] text-muted-foreground">{chat.notice}</p>
              )}
            </div>
          </div>
        </>
      )}


      {menuFor && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/70 p-4">
          <div className="w-full max-w-[400px] rounded-2xl border border-border bg-card p-2">
            <p className="px-3 py-2 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {menuFor.sender_name}
            </p>
            <button
              type="button"
              onClick={() => {
                chat.toggleLocalMute(menuFor.sender_user_id);
                setMenuFor(null);
              }}
              className="press tap-target w-full rounded-xl px-4 text-left font-display text-sm text-foreground"
            >
              {chat.mutedUserIds.includes(menuFor.sender_user_id)
                ? `Unmute ${menuFor.sender_name}`
                : `Mute ${menuFor.sender_name}`}
            </button>
            <button
              type="button"
              onClick={() => {
                void chat.report(menuFor.id);
                setMenuFor(null);
              }}
              className="press tap-target w-full rounded-xl px-4 text-left font-display text-sm text-warn"
            >
              Report
            </button>
            <button
              type="button"
              onClick={() => setMenuFor(null)}
              className="press tap-target w-full rounded-xl px-4 text-left font-display text-sm text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div
        className="mt-2 flex shrink-0 items-center gap-1.5"
        style={{ height: CHAT_BAR_HEIGHT }}
        onTouchStart={(event) => {
          touchStartY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartY.current;
          const end = event.changedTouches[0]?.clientY ?? null;
          if (start !== null && end !== null && start - end > 30) chat.setSheetOpen(true);
          touchStartY.current = null;
        }}
      >
        <button
          type="button"
          onClick={() => chat.setSheetOpen(!chat.sheetOpen)}
          aria-label="Messages"
          className="press relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card font-mono text-xs text-muted-foreground"
        >
          {chat.messages.length}
          {chat.unread > 0 && !chat.sheetOpen && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
              {chat.unread}
            </span>
          )}
        </button>

        <input
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder="Say something"
          aria-label="Message"
          className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />

        <button
          type="button"
          onClick={submit}
          disabled={chat.sending || text.trim().length === 0}
          className="press h-11 shrink-0 rounded-xl bg-primary px-3 font-display text-xs font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
        >
          Send
        </button>

        <div className="flex shrink-0 items-center">
          {ROOM_EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React ${emoji}`}
              onClick={() => void chat.react(emoji)}
              className="press flex h-11 w-7 items-center justify-center text-lg leading-none"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      {chat.error && <p className="shrink-0 text-center text-[11px] text-warn">{chat.error}</p>}
    </>
  );
}
