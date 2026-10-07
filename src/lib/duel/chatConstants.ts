/** Shared chat limits and the fixed emoji set. Client- and server-safe. */

export const MESSAGE_MAX_LENGTH = 120;
/** One message every two seconds per player. */
export const MESSAGE_MIN_GAP_MS = 2_000;
/** A player can send at most this many messages in one room. */
export const MESSAGE_MAX_PER_PLAYER = 30;
/** One reaction a second per player. */
export const REACTION_MIN_GAP_MS = 1_000;
/** Only the last hundred messages of a room are ever loaded. */
/** Whole-room history (per-player caps keep rooms far below this). */
export const MESSAGE_HISTORY_LIMIT = 1000;
/** How long a reaction bubble stays on screen. */
export const REACTION_LIFETIME_MS = 1_500;

export const ROOM_EMOJI = ["👍", "😂", "😮", "🔥", "😭", "🎉"] as const;
export type RoomEmoji = (typeof ROOM_EMOJI)[number];

export const CHAT_BAR_HEIGHT = 56;

export interface RoomMessageRow {
  id: string;
  duel_id: string;
  sender_user_id: string;
  sender_name: string;
  text: string;
  created_at: string;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  name: string;
  userId: string;
  at: number;
}
