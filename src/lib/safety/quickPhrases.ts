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
  // Joe's list (10 Nov 2026), in his order. Apostrophes are the house’s typographic ’ (DESIGN.md copy rules).
  { id: "gg", text: "Good game!" },
  { id: "rematch", text: "Rematch?" },
  { id: "nice", text: "Nice one!" },
  { id: "unlucky", text: "Unlucky!" },
  { id: "jeeez", text: "Jeeez!" },
  { id: "how", text: "How?!" },
  { id: "so-close", text: "So close!" },
  { id: "sheesh", text: "Sheesh!" },
  { id: "clutch", text: "That was clutch!" },
  { id: "thumbs", text: "My thumbs slipped" },
  { id: "too-fast", text: "Too fast for me!" },
  { id: "next-time", text: "I’ll get you next time!" },
  { id: "one-more", text: "One more?" },
  { id: "good-luck", text: "Good luck!" },
  { id: "lets-go", text: "Let’s go!" },
  { id: "well-played", text: "Well played!" },
  { id: "brain-hurts", text: "Brain hurts" },
  { id: "oops", text: "Oops!" },
  { id: "hello", text: "Hello!" },
  { id: "bye", text: "Bye!" },
] as const;

export type QuickPhraseId = (typeof QUICK_PHRASES)[number]["id"];

/** The reactions quick-phrase chat also offers: the room's own. */
export const QUICK_REACTIONS = ROOM_EMOJI;

/** The phrase for an id, or null (the server takes ids only). */
export function quickPhraseText(id: unknown): string | null {
  return QUICK_PHRASES.find((p) => p.id === id)?.text ?? null;
}
