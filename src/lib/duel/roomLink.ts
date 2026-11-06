import { APP_NAME } from "@/lib/brand";

import { ROOM_CODE_LENGTH, roomCodeChars } from "./roomCode";

/** Room codes are four characters (roomCode.ts). */
export { ROOM_CODE_LENGTH };

/** The invitation every Copy and Share sends: the full room link plus the code. */
export function roomInvite(roomCode: string, origin: string): { link: string; text: string } {
  const link = `${origin}/duel/${roomCode}`;
  return { link, text: `Join my ${APP_NAME} room: ${link} (code ${roomCode})` };
}

/**
 * The room code from whatever was typed or pasted into the code boxes: a
 * pasted room link gives the code after /duel/; anything else keeps its
 * letters and digits only (new codes have digits, 7 Nov 2026).
 */
export function codeFromInput(value: string): string {
  const fromLink = /\/duel\/([a-zA-Z0-9]+)/.exec(value)?.[1];
  return roomCodeChars(fromLink ?? value).slice(0, ROOM_CODE_LENGTH);
}

/** What a room link can offer someone who isn't in the room yet. */
export type LinkRoomState = "lobby" | "playing" | "finished" | "disbanded";

export function linkRoomState(room: { status: string; disbanded_at: string | null }): LinkRoomState {
  if (room.disbanded_at) return "disbanded";
  if (room.status === "waiting") return "lobby";
  return room.status === "finished" ? "finished" : "playing";
}
