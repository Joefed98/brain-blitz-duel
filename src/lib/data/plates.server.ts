/**
 * The nameplates' reads (src/lib/identity/plates.server.ts): the public cards come from A1's economy_public_cards and
 * C2's badge_public_cards through their own data modules; this module holds the age read the plates need.
 */
import type { Db } from "./db.server";
import type { Result } from "./rooms.server";

/**
 * The dates of birth of up to 100 accounts, for the nameplates only (an under-18 is drawn as "Hidden player" to
 * everyone else; src/lib/identity/plates.server.ts). Never sent to a phone. Guests have no profile and no row.
 */
export async function readDatesOfBirth(client: Db, userIds: readonly string[]): Promise<Result<{ user_id: string; date_of_birth: string }[]>> {
  if (!userIds.length) return { data: [], error: null };
  const { data, error } = await client.from("profiles").select("user_id, date_of_birth").in("user_id", [...userIds].slice(0, 100));
  return { data: (data as { user_id: string; date_of_birth: string }[] | null) ?? [], error };
}
