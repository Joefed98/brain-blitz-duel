/**
 * Public ids at the server's edge (Security C3, 14 Nov 2026; supabase/migrations/20261117600000_public_ids_beyond_rooms.sql).
 *
 * Every answer a phone gets about other players (friends lists, player cards, tournament rows, rated match views) names
 * them by their public id (public.player_public_ids, Security C1b: one per account, for life), never their account id.
 * The tables and stored rows keep account ids: the server converts on the way out (`toPublic`) and back on the way in
 * (`fromPublic`). An account id sent in, or any id that isn't someone's public id, names nobody, so a function answers
 * it as it answers an unknown player.
 */
import type { Db } from "@/lib/data/db.server";
import { readUsersOfPublicIds } from "@/lib/data/players.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Each account's public id, in one call (made on first use). An id with no account behind it (a deleted player's
 * stand-in) gets a fresh id that is kept nowhere, so it names nobody.
 */
export async function toPublic(client: Db, accountIds: readonly (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = [...new Set(accountIds.filter((id): id is string => !!id && UUID.test(id)))];
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data, error } = await client.rpc("public_ids_of" as never, { p_user_ids: ids } as never);
  if (error) throw new Error(`public ids: ${(error as { message: string }).message}`);
  for (const row of (data ?? []) as { user_id: string; public_id: string }[]) out.set(row.user_id, row.public_id);
  return out;
}

/** One account's public id (null for none). */
export async function publicIdOf(client: Db, accountId: string | null | undefined): Promise<string | null> {
  if (!accountId) return null;
  return (await toPublic(client, [accountId])).get(accountId) ?? null;
}

/** The accounts behind these public ids (an account id, or an unknown id, names nobody and is left out). */
export async function fromPublic(client: Db, publicIds: readonly (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = publicIds.filter((id): id is string => typeof id === "string" && UUID.test(id));
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data, error } = await readUsersOfPublicIds(client, ids);
  if (error) throw new Error(`public ids: ${error.message}`);
  for (const row of data ?? []) out.set(row.public_id.toLowerCase(), row.user_id);
  return new Map(ids.map((id) => [id, out.get(id.toLowerCase())]).filter((e): e is [string, string] => !!e[1]));
}

/** The account behind one public id (null when it names nobody). */
export async function accountOf(client: Db, publicId: unknown): Promise<string | null> {
  if (typeof publicId !== "string") return null;
  return (await fromPublic(client, [publicId])).get(publicId) ?? null;
}
