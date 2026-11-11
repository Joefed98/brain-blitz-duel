/**
 * Who the server lets save a subscription and sends to (pushConfig.ts: the testers while PUSH_FOR_EVERYONE is false),
 * read from the player's own profile row, never from anything the phone sends. Server only.
 *
 * Checks only: `setPushAudienceForChecks` stands in another audience for the database checks (as
 * `setPushFetchForChecks` stands in the push service); nothing in the app calls it, and push-notifications-check fails
 * if anything under src/ does.
 */
import { pushForPlayer, type PushAudience } from "@/config/pushConfig";
import type { Db } from "@/lib/data/db.server";
import { readProfilePlayerNumber } from "@/lib/data/push.server";

let forChecks: PushAudience | null = null;

/** Checks only: another audience (null puts back the one in pushConfig.ts). */
export function setPushAudienceForChecks(audience: PushAudience | null): void {
  forChecks = audience;
}

/** Whether this user gets notifications: an account (a profile row) whose player number is in the audience. */
export async function serverPushAllowed(client: Db, userId: string): Promise<boolean | "error"> {
  const row = await readProfilePlayerNumber(client, userId);
  if (row.error) return "error";
  return pushForPlayer(row.data, forChecks ?? undefined);
}
