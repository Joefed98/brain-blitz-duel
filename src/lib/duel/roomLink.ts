import { APP_NAME } from "@/lib/brand";

/** Room codes are four letters. */
export const ROOM_CODE_LENGTH = 4;

/** The invitation every Copy and Share sends: the full room link plus the code. */
export function roomInvite(roomCode: string, origin: string): { link: string; text: string } {
  const link = `${origin}/duel/${roomCode}`;
  return { link, text: `Join my ${APP_NAME} room: ${link} (code ${roomCode})` };
}

/**
 * The room code from whatever was typed or pasted into the code boxes: a
 * pasted room link gives the letters after /duel/; anything else keeps its
 * letters only.
 */
export function codeFromInput(value: string): string {
  const fromLink = /\/duel\/([a-zA-Z]+)/.exec(value)?.[1];
  return (fromLink ?? value.replace(/[^a-zA-Z]/g, "")).toUpperCase().slice(0, ROOM_CODE_LENGTH);
}
