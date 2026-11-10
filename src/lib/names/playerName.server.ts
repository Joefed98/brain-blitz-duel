/**
 * The name a player's rooms, boards and chat show (10 Nov 2026, the sign-up screens): a signed-in player's username
 * (their profile's, unless the account is waiting for deletion), else the name the guest typed. The one place room
 * create and join, the Daily and challenges ask; everything that reads the stored name (lobby, standings, results,
 * chat, share cards, the room-to-challenge copy) then shows the username with nothing else changed.
 */
import type { Db } from "@/lib/data/db.server";
import { readProfile } from "@/lib/data/profiles.server";

/** The caller's username when they have an account, else null (a guest, or a database without profiles). */
export async function accountNameOf(client: Db, userId: string): Promise<string | null> {
  try {
    const { data, error } = await readProfile(client, userId);
    if (error || !data || data.deletion_requested_at) return null;
    return data.username || null;
  } catch {
    return null;
  }
}
