/**
 * Phone notifications' data (wave 2 train B, session B2; docs/push-notifications.md): push subscriptions, the
 * notification settings, the send log and the reminder's candidates (supabase/migrations/20261112060000_push_notifications.sql).
 * Server only; each function issues exactly one call, on the client it is given (the service role from push.server.ts).
 */

import type { PushSettings } from "@/lib/push/rules";

import type { Db, Tables } from "./db.server";
import type { Result } from "./rooms.server";

export type PushSubscriptionRow = Tables<"push_subscriptions">;
export type NotificationSettingsRow = Tables<"notification_settings">;

export type ReserveStatus = "ok" | "capped" | "duplicate";

/** Whether a user id has an account (a profile row): subscriptions and settings are for accounts only. */
export async function readHasProfile(client: Db, userId: string): Promise<Result<boolean>> {
  const { data, error } = await client.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
  return { data: !!data, error };
}

/** A user's player number from their profile (null: no profile, so a guest, or no number). */
export async function readProfilePlayerNumber(client: Db, userId: string): Promise<Result<number | null>> {
  const { data, error } = await client.from("profiles").select("player_number").eq("user_id", userId).maybeSingle();
  const n = (data as { player_number?: unknown } | null)?.player_number;
  return { data: typeof n === "number" ? n : null, error };
}

/**
 * Saves a device's subscription for `userId`: the endpoint is unique, so a device that was another account's (signed
 * out without the phone's clean-up) moves to this one.
 */
export async function upsertPushSubscription(
  client: Db,
  row: { user_id: string; endpoint: string; p256dh: string; auth: string; time_zone: string; platform: string | null; last_seen_at: string },
): Promise<Result<PushSubscriptionRow[]>> {
  const { data, error } = await client
    .from("push_subscriptions")
    .upsert(row, { onConflict: "endpoint" })
    .select("*");
  return { data: (data as PushSubscriptionRow[] | null) ?? [], error };
}

/** Removes one device's subscription, only when it is this user's. */
export async function deletePushSubscription(client: Db, userId: string, endpoint: string): Promise<Result<PushSubscriptionRow[]>> {
  const { data, error } = await client
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .select("*");
  return { data: (data as PushSubscriptionRow[] | null) ?? [], error };
}

/** Removes every device of a user (an account deletion request). */
export async function deleteAllPushSubscriptions(client: Db, userId: string): Promise<Result<PushSubscriptionRow[]>> {
  const { data, error } = await client.from("push_subscriptions").delete().eq("user_id", userId).select("*");
  return { data: (data as PushSubscriptionRow[] | null) ?? [], error };
}

/** Removes a subscription the push service says has gone (404 / 410), whoever's it is. */
export async function deleteGoneSubscription(client: Db, id: string): Promise<Result<PushSubscriptionRow[]>> {
  const { data, error } = await client.from("push_subscriptions").delete().eq("id", id).select("*");
  return { data: (data as PushSubscriptionRow[] | null) ?? [], error };
}

/** A user's devices, newest first. */
export async function readPushSubscriptions(client: Db, userId: string): Promise<Result<PushSubscriptionRow[]>> {
  const { data, error } = await client
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .limit(10);
  return { data: (data as PushSubscriptionRow[] | null) ?? [], error };
}

/** A user's settings row, or null when they have none yet (the defaults). */
export async function readNotificationSettings(client: Db, userId: string): Promise<Result<NotificationSettingsRow | null>> {
  const { data, error } = await client.from("notification_settings").select("*").eq("user_id", userId).maybeSingle();
  return { data: (data as NotificationSettingsRow | null) ?? null, error };
}

/** Writes a user's switches (the row made on first write). */
export async function upsertNotificationSettings(
  client: Db,
  userId: string,
  settings: PushSettings,
  nowIso: string,
): Promise<Result<NotificationSettingsRow[]>> {
  const { data, error } = await client
    .from("notification_settings")
    .upsert({ user_id: userId, ...settings, updated_at: nowIso }, { onConflict: "user_id" })
    .select("*");
  return { data: (data as NotificationSettingsRow[] | null) ?? [], error };
}

/** Records the phone's ask and the player's answer: declined_at set on a decline, cleared on an accept. */
export async function upsertAskAnswer(
  client: Db,
  userId: string,
  answer: "accepted" | "declined",
  nowIso: string,
): Promise<Result<NotificationSettingsRow[]>> {
  const { data, error } = await client
    .from("notification_settings")
    .upsert(
      { user_id: userId, asked_at: nowIso, declined_at: answer === "declined" ? nowIso : null, updated_at: nowIso },
      { onConflict: "user_id" },
    )
    .select("*");
  return { data: (data as NotificationSettingsRow[] | null) ?? [], error };
}

/** Takes one notification's place in the log (public.push_reserve): the cap and the once-only keys, atomically. */
export async function reserveNotification(
  client: Db,
  input: { userId: string; event: string; countsCap: boolean; sinceIso: string; cap: number; dedupeKey: string | null },
): Promise<Result<ReserveStatus | null>> {
  const { data, error } = await client.rpc("push_reserve", {
    p_user_id: input.userId,
    p_event: input.event,
    p_counts_cap: input.countsCap,
    p_since: input.sinceIso,
    p_cap: input.cap,
    p_dedupe_key: input.dedupeKey,
  });
  return { data: data === "ok" || data === "capped" || data === "duplicate" ? data : null, error };
}

/** The Daily streak reminder's candidates for a UK day ("2026-11-11"). */
export async function readStreakCandidates(client: Db, day: string): Promise<Result<{ user_id: string; time_zone: string | null }[]>> {
  const { data, error } = await client.rpc("push_streak_candidates", { p_day: day });
  return { data: (data as { user_id: string; time_zone: string | null }[] | null) ?? [], error };
}

/** One of B1's friend events (public.friend_events), claimed for a notification. */
export interface FriendEventRow {
  id: number;
  recipient_id: string;
  actor_id: string;
  kind: string;
  payload: { code?: unknown; roomId?: unknown; requestId?: unknown } | null;
  created_at: string;
}

/** Claims the friend events made since `sinceIso` that no dispatch has taken yet (each is returned once, ever). */
export async function claimFriendEvents(client: Db, sinceIso: string, limit: number): Promise<Result<FriendEventRow[]>> {
  const { data, error } = await client.rpc("push_claim_friend_events", { p_since: sinceIso, p_limit: limit });
  return { data: (data as FriendEventRow[] | null) ?? [], error };
}
