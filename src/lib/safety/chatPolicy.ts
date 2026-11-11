/**
 * Who may type in chat (safety, 10 Nov 2026; docs/moderation.md "Chat rules"): the one place that decides, from the
 * context and the player, whether a player types freely or picks from the quick phrases (quickPhrases.ts).
 *
 * - Rooms count as friends: everyone in a room types (guests and under-18s included), through the server's word
 *   filter (chat.functions.ts `censorChat`), as today.
 * - Where strangers meet (rated matches, wave 3; tournaments, wave 4): under-18s and guests get quick phrases only;
 *   adults with an account type.
 *
 * - Friends (wave 2 B1, docs/friends.md): friends type to each other wherever they meet, under-18s included, as rooms
 *   already do. The caller says so with `{ friends: true }` after asking the server whether every other player in the
 *   chat is the player's friend (src/lib/friends/friends.server.ts `areFriends`); the "friends" context is a chat of
 *   friends only. Strangers' contexts are unchanged.
 *
 * Rooms call nothing new today (they always type). Waves 3 and 4 call `chatPolicy` with their context. The server
 * must enforce the answer (a phone only shows it).
 */

/** Where the chat is. */
export type ChatContext = "room" | "rated" | "tournament" | "friends";

/** What the policy needs to know about the player (from accountAgeFlags / the profile on the server). */
export interface ChatPlayer {
  /** No account (a Supabase anonymous user with no profile). */
  isGuest: boolean;
  /** An account whose holder is 13–17 (accounts' isUnder18). Unknown: treat as under 18. */
  isUnder18: boolean | null;
}

export type ChatMode = "type" | "quick_phrases";

/** Contexts where everyone has chosen to play together (friends): free typing for all. */
export const FRIEND_CONTEXTS: readonly ChatContext[] = ["room", "friends"];

/** What the caller knows about who the player is chatting with. */
export interface ChatCompany {
  /** Everyone else in this chat is the player's friend (the server checked; a block ends a friendship). */
  friends?: boolean;
}

/** Whether `player` types freely or picks quick phrases in `context`. */
export function chatPolicy(context: ChatContext, player: ChatPlayer, company: ChatCompany = {}): ChatMode {
  if (FRIEND_CONTEXTS.includes(context)) return "type";
  // Guests have no friends (accounts only), so a guest never types here on the strength of this.
  if (company.friends === true && !player.isGuest) return "type";
  if (player.isGuest) return "quick_phrases";
  if (player.isUnder18 !== false) return "quick_phrases";
  return "type";
}

/** The policy for every player of a match at once (a stranger's context gives each their own answer). */
export function chatPolicies(context: ChatContext, players: readonly ChatPlayer[]): ChatMode[] {
  return players.map((player) => chatPolicy(context, player));
}
