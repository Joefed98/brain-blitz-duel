/**
 * Accounts' data (10 Nov 2026; docs/accounts/README.md): the profiles table and its service-role functions
 * (supabase/migrations/20261110120000_accounts_profiles.sql), and the two Supabase Auth admin calls the account flow
 * needs (a user's record, signing a user out everywhere). Server only; each function issues exactly one call.
 */

import type { User } from "@supabase/supabase-js";

import type { Db, DbError, Tables } from "./db.server";
import type { Result } from "./rooms.server";

export type ProfileRow = Tables<"profiles">;

/** Answers of public.create_profile. */
export type CreateProfileStatus = "created" | "exists" | "guest" | "taken" | "held";
/** Answers of public.rename_profile. */
export type RenameStatus = "renamed" | "missing" | "stale" | "taken" | "held";
export type RenameKind = "free" | "limited" | "forced";

export interface PublicProfile {
  user_id: string;
  username: string;
  colour: number | null;
  player_number: number | null;
  founding: boolean;
}

export interface GuestProgress {
  rooms: number;
  dailies: number;
  challenges: number;
  practice: number;
  account: boolean;
}

/** One player's profile row (every column), or null for a guest. */
export async function readProfile(client: Db, userId: string): Promise<Result<ProfileRow | null>> {
  const { data, error } = await client.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return { data: (data as ProfileRow | null) ?? null, error };
}

/** Creates a profile through the database's own checks (permanent user, no profile yet, name free and not held). */
export async function createProfile(
  client: Db,
  input: { userId: string; username: string; colour: number; dateOfBirth: string; country: string | null },
): Promise<Result<CreateProfileStatus | null>> {
  const { data, error } = await client.rpc("create_profile", {
    p_user_id: input.userId,
    p_username: input.username,
    p_colour: input.colour,
    p_date_of_birth: input.dateOfBirth,
    p_country: input.country,
  });
  return { data: (data as CreateProfileStatus | null) ?? null, error };
}

/** Renames a profile (the old name held 30 days); `expectedChangedAt` is the value the caller's rule read. */
export async function renameProfile(
  client: Db,
  input: { userId: string; username: string; kind: RenameKind; expectedChangedAt: string | null; note?: string | null },
): Promise<Result<RenameStatus | null>> {
  const { data, error } = await client.rpc("rename_profile", {
    p_user_id: input.userId,
    p_username: input.username,
    p_kind: input.kind,
    p_expected_changed_at: input.expectedChangedAt,
    p_note: input.note ?? null,
  });
  return { data: (data as RenameStatus | null) ?? null, error };
}

export type UsernameStatus = "free" | "taken" | "held";

/** Whether `username` could be taken by `userId` now: free, taken (another account's) or held (released by another). */
export async function readUsernameStatus(client: Db, username: string, userId: string): Promise<Result<UsernameStatus | null>> {
  const { data, error } = await client.rpc("username_status", { p_username: username, p_user_id: userId });
  return { data: data === "free" || data === "taken" || data === "held" ? data : null, error };
}

/** What a user id holds (rooms, dailies, challenges, practice plays) and whether it has an account. */
export async function readGuestProgress(client: Db, userId: string): Promise<Result<GuestProgress | null>> {
  const { data, error } = await client.rpc("guest_progress", { p_user_id: userId });
  return { data: (data as unknown as GuestProgress | null) ?? null, error };
}

/** Marks a deletion request (only when none is pending): the profile is hidden from other players at once. */
export async function markDeletionRequested(client: Db, userId: string, atIso: string): Promise<Result<ProfileRow[]>> {
  const { data, error } = await client
    .from("profiles")
    .update({ deletion_requested_at: atIso })
    .eq("user_id", userId)
    .is("deletion_requested_at", null)
    .select("*");
  return { data: (data as ProfileRow[] | null) ?? [], error };
}

/** Cancels a pending deletion request. */
export async function clearDeletionRequested(client: Db, userId: string): Promise<Result<ProfileRow[]>> {
  const { data, error } = await client
    .from("profiles")
    .update({ deletion_requested_at: null })
    .eq("user_id", userId)
    .not("deletion_requested_at", "is", null)
    .select("*");
  return { data: (data as ProfileRow[] | null) ?? [], error };
}

/** Other players' public fields (username, colour, player number, founding), up to 100 at a time. */
export async function readPublicProfiles(client: Db, userIds: readonly string[]): Promise<Result<PublicProfile[]>> {
  const { data, error } = await client.rpc("public_profiles", { p_user_ids: [...userIds].slice(0, 100) });
  return { data: (data as PublicProfile[] | null) ?? [], error };
}

/** A user's date of birth (server-side age rules only; never sent to another player). */
export async function readDateOfBirth(client: Db, userId: string): Promise<Result<string | null>> {
  const { data, error } = await client.from("profiles").select("date_of_birth").eq("user_id", userId).maybeSingle();
  return { data: (data as { date_of_birth: string } | null)?.date_of_birth ?? null, error };
}

/* ------------------------------------------------------------------ Supabase Auth (admin API) */

/** The auth user's own record (is it anonymous, which identities): the server's truth, never the token's claims. */
export async function readAuthUser(client: Db, userId: string): Promise<{ data: User | null; error: DbError | null }> {
  const { data, error } = await client.auth.admin.getUserById(userId);
  return { data: data?.user ?? null, error: error ? { message: error.message, ...(error.code ? { code: error.code } : {}) } : null };
}

/** Signs a user out on every device: every refresh token of theirs revoked (an access token lapses within the hour). */
export async function signOutEverywhere(client: Db, accessToken: string): Promise<{ error: DbError | null }> {
  const { error } = await client.auth.admin.signOut(accessToken, "global");
  return { error: error ? { message: error.message, ...(error.code ? { code: error.code } : {}) } : null };
}
