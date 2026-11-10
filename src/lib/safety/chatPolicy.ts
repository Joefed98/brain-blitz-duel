/**
 * Who may type in chat (safety, 10 Nov 2026; docs/moderation.md "Chat rules"): the one place that decides, from the
 * context and the player, whether a player types freely or picks from the quick phrases (quickPhrases.ts).
 *
 * - Rooms count as friends: everyone in a room types (guests and under-18s included), through the server's word
 *   filter (chat.functions.ts `censorChat`), as today.
 * - Where strangers meet (rated matches, wave 3; tournaments, wave 4): under-18s and guests get quick phrases only;
 *   adults with an account type.
 *
 * Rooms call nothing new today (they always type). Waves 3 and 4 call `chatPolicy` with their context. The server
 * must enforce the answer (a phone only shows it).
 */

/** Where the chat is. */
export type ChatContext = "room" | "rated" | "tournament";

/** What the policy needs to know about the player (from accountAgeFlags / the profile on the server). */
export interface ChatPlayer {
  /** No account (a Supabase anonymous user with no profile). */
  isGuest: boolean;
  /** An account whose holder is 13–17 (accounts' isUnder18). Unknown: treat as under 18. */
  isUnder18: boolean | null;
}

export type ChatMode = "type" | "quick_phrases";

/** Contexts where everyone has chosen to play together (friends): free typing for all. */
export const FRIEND_CONTEXTS: readonly ChatContext[] = ["room"];

/** Whether `player` types freely or picks quick phrases in `context`. */
export function chatPolicy(context: ChatContext, player: ChatPlayer): ChatMode {
  if (FRIEND_CONTEXTS.includes(context)) return "type";
  if (player.isGuest) return "quick_phrases";
  if (player.isUnder18 !== false) return "quick_phrases";
  return "type";
}

/** The policy for every player of a match at once (a stranger's context gives each their own answer). */
export function chatPolicies(context: ChatContext, players: readonly ChatPlayer[]): ChatMode[] {
  return players.map((player) => chatPolicy(context, player));
}
