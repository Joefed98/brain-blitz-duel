/**
 * Quick phrases (safety, 10 Nov 2026; docs/moderation.md "Chat rules"): what under-18s and guests send where strangers
 * meet (rated matches in wave 3, tournaments in wave 4; chatPolicy.ts), with the room's existing reactions. **For Joe
 * to review.** Not shown in rooms (rooms type freely).
 *
 * Rules for the list: short, friendly, nothing a stranger could use to ask for contact, a place or a picture; ids
 * never change once shipped (the server will store and send the id, never free text).
 */

import { ROOM_EMOJI } from "@/lib/duel/chatConstants";

export const QUICK_PHRASES = [
  { id: "gg", text: "Good game!" },
  { id: "nice", text: "Nice one!" },
  { id: "rematch", text: "Rematch?" },
  { id: "good-luck", text: "Good luck!" },
  { id: "well-played", text: "Well played!" },
  { id: "so-close", text: "So close!" },
  { id: "great-round", text: "Great round!" },
  { id: "wow", text: "Wow!" },
  { id: "thanks", text: "Thanks!" },
  { id: "fun", text: "That was fun!" },
  { id: "one-more", text: "One more?" },
  { id: "ready", text: "Ready!" },
  { id: "lets-go", text: "Let’s go!" },
  { id: "close-one", text: "That was a close one!" },
  { id: "tough", text: "That one was tough!" },
  { id: "speedy", text: "So fast!" },
  { id: "next-time", text: "Next time!" },
  { id: "hello", text: "Hello!" },
  { id: "bye", text: "Bye!" },
  { id: "oops", text: "Oops!" },
] as const;

export type QuickPhraseId = (typeof QUICK_PHRASES)[number]["id"];

/** The reactions quick-phrase chat also offers: the room's own. */
export const QUICK_REACTIONS = ROOM_EMOJI;

/** The phrase for an id, or null (the server takes ids only). */
export function quickPhraseText(id: unknown): string | null {
  return QUICK_PHRASES.find((p) => p.id === id)?.text ?? null;
}
