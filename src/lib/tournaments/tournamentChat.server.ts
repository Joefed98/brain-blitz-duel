/**
 * Chat in tournament rooms (wave 4, W4b): strangers meet in an Arena duel, so wave 1's rules apply
 * (src/lib/safety/chatPolicy.ts, context "tournament"): guests and under-18s send quick phrases only, adults with an
 * account type through the room's filter as everywhere. Enforced by the server's chat function (chat.functions.ts
 * sendRoomMessageFn); every other room is unchanged (this answers null for it).
 */
import { chatPolicy } from "@/lib/safety/chatPolicy";
import type { Db } from "@/lib/data/db.server";
import { ratedChatMessage, type RatedChatAnswer } from "@/lib/rated/ratedChat.server";

export const TOURNAMENT_QUICK_PHRASES_MESSAGE = "In tournaments, pick one of the quick phrases.";

/** Null for any room that isn't a tournament's; for one, the message the sender may send (or the refusal). */
export async function tournamentChatText(client: Db, roomId: string, userId: string, text: string, nowMs: number): Promise<RatedChatAnswer | null> {
  const { isTournamentRoom } = await import("./tournaments.server");
  if (!(await isTournamentRoom(client, roomId))) return null;
  const { accountAgeFlags } = await import("@/lib/account/account.server");
  const flags = await accountAgeFlags(client, userId, nowMs);
  const answer = ratedChatMessage(chatPolicy("tournament", { isGuest: !flags.account, isUnder18: flags.isUnder18 }), text);
  return answer.ok ? answer : { ok: false, message: TOURNAMENT_QUICK_PHRASES_MESSAGE };
}
