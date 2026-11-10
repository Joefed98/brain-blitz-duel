/**
 * The server's moderation rules (safety, 10 Nov 2026; docs/moderation.md): whether a player may use rooms and chat.
 * Banned players can't make or join rooms or chat; muted players can't chat. Solo play (Practice, offline) never asks.
 *
 * Fails open: a database error (or a database without the moderation migration) lets the call through with a
 * warning logged, as the rate limits do, so a moderation outage never blocks play.
 */

import type { Db } from "@/lib/data/db.server";
import { CLEAR_STATUS, readModerationStatus, type ModerationStatus } from "@/lib/data/moderation.server";

import { BANNED_MESSAGE, CHAT_MUTED_MESSAGE } from "./reports";

/** A player's moderation state, or nothing on record when it can't be read. */
export async function playerSafety(client: Db, userId: string): Promise<ModerationStatus> {
  try {
    const { data, error } = await readModerationStatus(client, userId);
    if (error || !data) {
      if (error) console.warn(`[moderation] status: ${error.message} (allowed)`);
      return CLEAR_STATUS;
    }
    return data;
  } catch (err) {
    console.warn(`[moderation] status: ${err instanceof Error ? err.message : String(err)} (allowed)`);
    return CLEAR_STATUS;
  }
}

/** Why a player can't make or join a room, or null. */
export async function roomRefusal(client: Db, userId: string): Promise<string | null> {
  const status = await playerSafety(client, userId);
  return status.banned ? BANNED_MESSAGE : null;
}

/** Why a player can't send a chat message or a reaction, or null. */
export async function chatRefusal(client: Db, userId: string): Promise<string | null> {
  const status = await playerSafety(client, userId);
  if (status.banned) return BANNED_MESSAGE;
  if (status.mutedUntil) return CHAT_MUTED_MESSAGE;
  return null;
}
