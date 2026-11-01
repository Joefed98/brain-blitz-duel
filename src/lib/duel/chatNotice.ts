/**
 * Room chat notices (18 Oct 2026, presentation only): how a new message is made obvious.
 *
 *  - Between rounds (lobby, round results, standings, final screens): the chat button carries a
 *    gold unread count, and a message from another player that arrives live shows a short toast
 *    (their colour and icon, name and the first words) with the soft chat blip and a light haptic
 *    (lib/haptics.ts `tick`, behind the Settings switch) where the device has one.
 *  - During a round (intro countdown, live round, reveal): never a toast, sound or haptic; the
 *    play header shows only a small gold dot while anything is unread.
 *
 * Your own messages never count as unread and never toast. scripts/chat-notice-check.ts proves it.
 */
import type { RoomMessageRow } from "./chatConstants";

/** How long a toast stays up, ms. */
export const CHAT_TOAST_MS = 3500;
/** The toast quotes at most this many words of the message… */
export const CHAT_TOAST_WORDS = 8;
/** …and at most this many characters. */
export const CHAT_TOAST_CHARS = 48;

/** The first words of a message for its toast, with "…" when anything was left off. */
export function chatToastText(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let out = words.slice(0, CHAT_TOAST_WORDS).join(" ");
  let cut = words.length > CHAT_TOAST_WORDS;
  if (out.length > CHAT_TOAST_CHARS) {
    const head = out.slice(0, CHAT_TOAST_CHARS);
    const space = head.lastIndexOf(" ");
    out = (space >= CHAT_TOAST_CHARS / 2 ? head.slice(0, space) : head).trimEnd();
    cut = true;
  }
  return cut ? `${out}…` : out;
}

/** Messages from other players that the viewer has not seen in the open sheet. */
export function unreadCount(
  messages: readonly Pick<RoomMessageRow, "id" | "sender_user_id">[],
  myUserId: string | null,
  seen: ReadonlySet<string>,
): number {
  return messages.filter((m) => m.sender_user_id !== myUserId && !seen.has(m.id)).length;
}

/**
 * Whether a newly arrived message gets a toast (with its sound and haptic): only between rounds
 * (`chatAvailable`), with the sheet closed, and never for your own message.
 */
export function shouldToast(
  message: Pick<RoomMessageRow, "sender_user_id">,
  { myUserId, chatAvailable, sheetOpen }: { myUserId: string; chatAvailable: boolean; sheetOpen: boolean },
): boolean {
  return chatAvailable && !sheetOpen && message.sender_user_id !== myUserId;
}

/** The in-round unread dot: shown only during a round, and only while something is unread. */
export function showRoundChatDot(unread: number, chatAvailable: boolean): boolean {
  return !chatAvailable && unread > 0;
}
