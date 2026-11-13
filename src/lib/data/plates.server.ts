/**
 * The tournament nameplates' own read (src/lib/identity/plates.server.ts): the cards, badges and titles come from the
 * shared `nameplatesFor` (docs/nameplate.md); this module holds the profile read the plates need on top of it, the
 * username, player number and date of birth.
 */
import type { Db } from "./db.server";
import type { Result } from "./rooms.server";

export interface PlateProfileRow {
  user_id: string;
  username: string;
  player_number: number;
  date_of_birth: string;
}

/**
 * Up to 100 accounts' username, player number and date of birth, for the nameplates only (an under-18 is drawn as
 * "Hidden player" to everyone else; src/lib/identity/plates.server.ts). The date of birth is never sent to a phone.
 * Guests have no profile and no row.
 */
export async function readPlateProfiles(client: Db, userIds: readonly string[]): Promise<Result<PlateProfileRow[]>> {
  if (!userIds.length) return { data: [], error: null };
  const { data, error } = await client
    .from("profiles")
    .select("user_id, username, player_number, date_of_birth")
    .in("user_id", [...userIds].slice(0, 100));
  return { data: (data as PlateProfileRow[] | null) ?? [], error };
}

/**
 * Which of up to 100 accounts read "Hidden player" on anything that leaves their room (the share card's image): the
 * leaderboards' own rule (public.players_hidden_outside, 20261116800000): under-18s by default, adults who opted out,
 * accounts waiting for deletion. Guests are never in it.
 */
export async function readHiddenOutside(client: Db, userIds: readonly string[]): Promise<Result<string[]>> {
  if (!userIds.length) return { data: [], error: null };
  const { data, error } = await client.rpc("players_hidden_outside", { p_user_ids: [...userIds].slice(0, 100) });
  return { data: (data as string[] | null) ?? [], error };
}
