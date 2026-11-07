import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import type { RoomChatState } from "@/lib/duel/useRoomChat";
import { Icon } from "@/design/components";

/**
 * The room footer (Polish batch R, 25 Oct 2026, presentation only): one 68 px row on every room screen,
 * the 52 px chat button and then the screen's main action (and Share where there is one). The room route
 * hands the chat button down through RoomChatSlot, so each screen's own footer (the lobby's Start, the
 * results' Continue, the podium's Play again, the intro's Ready) draws it beside its action; a screen
 * without a footer gets RoomChat's own row with just the button.
 */
export const RoomChatSlot = createContext<ReactNode>(null);

export function RoomFooter({ children, className = "" }: { children?: ReactNode; className?: string }) {
  const chatButton = useContext(RoomChatSlot);
  return (
    <div data-chat-bar data-room-footer className={`room-chat-bar room-footer ${className}`}>
      {chatButton}
      <div className="room-footer-main">{children}</div>
    </div>
  );
}

/** The chat button: opens the messages (reactions are in the sheet). Unread messages from others ride on it. */
export function RoomChatButton({ chat, available = true }: { chat: RoomChatState; available?: boolean }) {
  const unread = available ? chat.unread : 0;
  return (
    <button
      type="button"
      data-room-chat-button
      onClick={() => chat.setSheetOpen(!chat.sheetOpen)}
      disabled={!available}
      aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}
      // Holds its place while chat is off (the intro's last seconds), so the action beside it never moves.
      style={available ? undefined : { visibility: "hidden" }}
      className="rs-chat-btn press"
    >
      <Icon name="chat" size={22} />
      {unread > 0 ? (
        <span data-chat-unread={unread} className="rs-chat-unread">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}

export interface RoomMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

/** The header's "⋯" menu: Disband room, Leave and the other rarely used room actions. */
export function RoomMenu({ items, label = "Room options" }: { items: RoomMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  useOutsideClose(open, [button, menu], () => setOpen(false));
  if (!items.length) return null;
  return (
    <span className="relative inline-flex">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-room-menu
        onClick={() => setOpen((v) => !v)}
        className="rs-menu-btn press"
      >
        <Icon name="more" size={20} />
      </button>
      {open ? (
        <div ref={menu} role="menu" className="rs-menu right-0 top-full mt-1">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              data-danger={item.danger ? "" : undefined}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

export function useOutsideClose(open: boolean, refs: RefObject<HTMLElement | null>[], close: () => void) {
  useEffect(() => {
    if (!open) return;
    const down = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (refs.some((ref) => ref.current?.contains(target ?? null))) return;
      close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A list that can still scroll (under the footer, a big room): data-more is set while there is more below,
 * so the list fades at its bottom (room-screens.css .rs-scroll). Display only.
 */
export function useScrollMore<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      const more = el.scrollHeight - el.scrollTop - el.clientHeight > 2;
      if (more) el.dataset["more"] = "";
      else delete el.dataset["more"];
    };
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro?.disconnect();
    };
  }, []);
  return ref;
}
