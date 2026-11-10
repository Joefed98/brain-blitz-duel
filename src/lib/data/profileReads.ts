/**
 * The phone's own profile calls (10 Nov 2026, accounts), through the browser client with row level security: a
 * signed-in player reads only their own row and may change only its colour and country
 * (supabase/migrations/20261110120000_accounts_profiles.sql); other players' public fields come from
 * public_profiles. Everything else about an account goes through the server (src/lib/account/account.functions.ts).
 */

import type { Tables } from "@/integrations/supabase/types";

import type { Db } from "./db";

interface Read<T> {
  data: T;
  error: { code?: string; message: string } | null;
}

export type OwnProfile = Tables<"profiles">;

/** This device's own profile (RLS returns only its row), or null for a guest. */
export async function readOwnProfile(client: Db, userId: string): Promise<Read<OwnProfile | null>> {
  const { data, error } = await client.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return { data: (data as OwnProfile | null) ?? null, error };
}

/** Changes this player's colour (0–31) and/or country (an ISO 3166-1 alpha-2 code, or null). */
export async function updateOwnProfileSettings(
  client: Db,
  userId: string,
  changes: { colour?: number; country?: string | null },
): Promise<Read<null>> {
  const patch: { colour?: number; country?: string | null } = {};
  if (changes.colour !== undefined) patch.colour = changes.colour;
  if (changes.country !== undefined) patch.country = changes.country;
  if (!Object.keys(patch).length) return { data: null, error: null };
  const { error } = await client.from("profiles").update(patch).eq("user_id", userId);
  return { data: null, error };
}

export interface PublicProfileRead {
  user_id: string;
  username: string;
  colour: number | null;
  player_number: number | null;
  founding: boolean;
}

/** Other players' public fields (username, colour, player number, founding), up to 100. */
export async function readPublicProfiles(client: Db, userIds: readonly string[]): Promise<Read<PublicProfileRead[]>> {
  const { data, error } = await client.rpc("public_profiles", { p_user_ids: [...userIds].slice(0, 100) });
  return { data: (data as PublicProfileRead[] | null) ?? [], error };
}
