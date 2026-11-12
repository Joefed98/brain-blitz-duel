/**
 * Which reactions a room shows (wave 2 E2): the fixed emoji set for everyone (chatConstants.ts ROOM_EMOJI), and the
 * emotes of the reaction packs a player has equipped (their four reaction slots), only from that player. The send
 * still goes through allowReactionFn, so the one-a-second limit, host mutes and moderation stay exactly as they are.
 */
import { emoteOf } from "@/design/identity/cosmetics";
import { mayUsePack } from "@/lib/cosmetics/cosmeticsStore";

import { ROOM_EMOJI, type RoomEmoji } from "./chatConstants";

/** Whether a reaction from `userId` may be shown: a room emoji, or an emote of a pack they have equipped. */
export function isRoomReaction(code: string, userId: string): boolean {
  if (ROOM_EMOJI.includes(code as RoomEmoji)) return true;
  const emote = emoteOf(code);
  return !!emote && mayUsePack(userId, emote.pack);
}
