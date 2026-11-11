/**
 * Room reactions arrive on the room's broadcast channel. A receiving phone shows one only when it comes from a
 * player in its own room list who is still in the game and not muted by the host, and names it from that list
 * (never from the message). Before the list has loaded, the message's own name is shown, cut to a guest name's
 * length. Display only: nothing here is stored or graded.
 */
import { ROOM_EMOJI, type RoomEmoji } from "./chatConstants";
import { GUEST_NAME_MAX } from "@/lib/names/username";

export interface ReactionRosterRow {
  user_id: string;
  display_name: string;
  status: string;
  muted_by_host?: boolean | null;
}

export interface AcceptedReaction {
  emoji: RoomEmoji;
  userId: string;
  name: string;
}

export function acceptReaction(payload: unknown, roster: readonly ReactionRosterRow[] | null | undefined): AcceptedReaction | null {
  const data = payload as { emoji?: unknown; name?: unknown; userId?: unknown } | null | undefined;
  if (!data || typeof data.emoji !== "string" || typeof data.userId !== "string" || !data.userId) return null;
  if (!ROOM_EMOJI.includes(data.emoji as RoomEmoji)) return null;
  const emoji = data.emoji as RoomEmoji;
  if (roster && roster.length) {
    const player = roster.find((p) => p.user_id === data.userId);
    if (!player || player.status === "left" || player.muted_by_host) return null;
    return { emoji, userId: data.userId, name: String(player.display_name ?? "Player").slice(0, GUEST_NAME_MAX) };
  }
  return { emoji, userId: data.userId, name: String(data.name ?? "Player").slice(0, GUEST_NAME_MAX) };
}
