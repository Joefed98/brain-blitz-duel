/**
 * Chat in rated rooms (wave 3, W3b): strangers meet there, so wave 1's rules apply (src/lib/safety/chatPolicy.ts,
 * context "rated"): guests and under-18s send quick phrases only, adults with an account type through the room's
 * filter as everywhere. Enforced by the server's chat function (chat.functions.ts sendRoomMessageFn); ordinary rooms
 * are unchanged (this answers null for them).
 */
import { chatPolicy, type ChatMode } from "@/lib/safety/chatPolicy";
import { QUICK_PHRASES, quickPhraseText } from "@/lib/safety/quickPhrases";
import type { Db } from "@/lib/data/db.server";

export type RatedChatAnswer = { ok: true; text: string } | { ok: false; message: string };

export const QUICK_PHRASES_ONLY_MESSAGE = "In rated matches, pick one of the quick phrases.";

/** What a message becomes under a chat mode: free text as typed, or a quick phrase (by id or its exact text). */
export function ratedChatMessage(mode: ChatMode, text: string): RatedChatAnswer {
  if (mode === "type") return { ok: true, text };
  const byId = quickPhraseText(text.trim());
  if (byId) return { ok: true, text: byId };
  const exact = QUICK_PHRASES.find((p) => p.text === text.trim());
  return exact ? { ok: true, text: exact.text } : { ok: false, message: QUICK_PHRASES_ONLY_MESSAGE };
}

/** Null for an ordinary room; for a rated room, the message the sender may send (or the refusal). */
export async function ratedChatText(client: Db, roomId: string, userId: string, text: string, nowMs: number): Promise<RatedChatAnswer | null> {
  const { readMatchByRoom } = await import("@/lib/data/rated.server");
  let rated = false;
  try {
    const { data: match } = await readMatchByRoom(client, roomId);
    rated = match !== null && match !== undefined;
  } catch {
    rated = false; // a database without the rated tables: no rated rooms
  }
  if (!rated) return null;
  const { accountAgeFlags } = await import("@/lib/account/account.server");
  const flags = await accountAgeFlags(client, userId, nowMs);
  return ratedChatMessage(chatPolicy("rated", { isGuest: !flags.account, isUnder18: flags.isUnder18 }), text);
}
