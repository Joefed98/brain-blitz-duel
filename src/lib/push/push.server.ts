/**
 * Phone notifications' account side (wave 2 train B, session B2): saving and removing a device's subscription, the
 * player's switches and the ask's answer. Server only; push.functions.ts is its shell. Accounts only: a guest is
 * refused ("no_account") and nothing is stored.
 */

import type { Db } from "@/lib/data/db.server";
import { recordEvents, platformOf } from "@/lib/data/events.server";
import {
  deleteAllPushSubscriptions,
  deletePushSubscription,
  readHasProfile,
  readNotificationSettings,
  upsertAskAnswer,
  upsertNotificationSettings,
  upsertPushSubscription,
} from "@/lib/data/push.server";

import { serverPushAllowed } from "./audience.server";
import { ASK_MOMENTS, isPushEvent, mayAskAgain, normaliseSettings, safeTimeZone, type PushSettings } from "./rules";
import { b64urlDecode, isPushEndpoint, vapidKeys } from "./webPush.server";

export type PushRefusal = { ok: false; reason: "disabled" | "no_account" | "not_in_audience" | "bad_subscription" | "error" };

const refuse = (reason: PushRefusal["reason"]): PushRefusal => ({ ok: false, reason });

export interface SubscriptionInput {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown } | null;
  timeZone?: unknown;
}

function validKey(value: unknown, bytes: number): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    return b64urlDecode(value).length === bytes;
  } catch {
    return false;
  }
}

/** Saves this device's subscription for an account (the switch must be on: both VAPID keys set). */
export async function saveSubscription(
  client: Db,
  userId: string,
  input: SubscriptionInput,
  userAgent: string | null,
  nowMs: number,
): Promise<{ ok: true } | PushRefusal> {
  if (!vapidKeys()) return refuse("disabled");
  const endpoint = input?.endpoint;
  const p256dh = input?.keys?.p256dh;
  const auth = input?.keys?.auth;
  if (!isPushEndpoint(endpoint) || !validKey(p256dh, 65) || !validKey(auth, 16)) return refuse("bad_subscription");
  const account = await readHasProfile(client, userId);
  if (account.error) return refuse("error");
  if (!account.data) return refuse("no_account");
  // Testers only while PUSH_FOR_EVERYONE is false (pushConfig.ts): nobody else's device is ever stored.
  const allowed = await serverPushAllowed(client, userId);
  if (allowed === "error") return refuse("error");
  if (!allowed) return refuse("not_in_audience");
  const saved = await upsertPushSubscription(client, {
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    time_zone: safeTimeZone(input.timeZone),
    platform: platformOf(userAgent),
    last_seen_at: new Date(nowMs).toISOString(),
  });
  return saved.error ? refuse("error") : { ok: true };
}

/** Removes this device's subscription (sign-out, or the player turning notifications off on this phone). */
export async function removeSubscription(client: Db, userId: string, endpoint: unknown): Promise<{ ok: true; removed: number } | PushRefusal> {
  if (typeof endpoint !== "string" || endpoint.length > 1024) return refuse("bad_subscription");
  const out = await deletePushSubscription(client, userId, endpoint);
  return out.error ? refuse("error") : { ok: true, removed: out.data.length };
}

/** Every device of a user (an account deletion request signs out everywhere). */
export async function removeAllSubscriptions(client: Db, userId: string): Promise<number> {
  try {
    const out = await deleteAllPushSubscriptions(client, userId);
    if (out.error) console.warn(`[push] removing devices: ${out.error.message}`);
    return out.data.length;
  } catch (err) {
    console.warn(`[push] removing devices: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }
}

export interface PushSettingsView {
  ok: true;
  settings: PushSettings;
  /** The phone may ask (never declined, or declined 30+ days ago). */
  mayAsk: boolean;
}

/** The player's switches and whether the phone may ask now. */
export async function readSettings(client: Db, userId: string, nowMs: number): Promise<PushSettingsView | PushRefusal> {
  const account = await readHasProfile(client, userId);
  if (account.error) return refuse("error");
  if (!account.data) return refuse("no_account");
  const row = await readNotificationSettings(client, userId);
  if (row.error) return refuse("error");
  return { ok: true, settings: normaliseSettings(row.data), mayAsk: mayAskAgain(row.data?.declined_at ?? null, nowMs) };
}

/** Writes the player's switches (only booleans for known fields are taken; the rest keep their stored value). */
export async function writeSettings(client: Db, userId: string, raw: unknown, nowMs: number): Promise<PushSettingsView | PushRefusal> {
  const current = await readSettings(client, userId, nowMs);
  if (!current.ok) return current;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const next: PushSettings = { ...current.settings };
  if (typeof r["enabled"] === "boolean") next.enabled = r["enabled"];
  for (const key of Object.keys(r)) if (isPushEvent(key) && typeof r[key] === "boolean") next[key] = r[key] as boolean;
  const out = await upsertNotificationSettings(client, userId, next, new Date(nowMs).toISOString());
  if (out.error) return refuse("error");
  return { ok: true, settings: next, mayAsk: current.mayAsk };
}

/** The ask's answer: stored (a decline holds the ask off 30 days) and recorded as notification_opt_in. */
export async function noteAskAnswer(
  client: Db,
  userId: string,
  answer: unknown,
  moment: unknown,
  nowMs: number,
): Promise<{ ok: true } | PushRefusal> {
  if (answer !== "accepted" && answer !== "declined") return refuse("bad_subscription");
  const account = await readHasProfile(client, userId);
  if (account.error) return refuse("error");
  if (!account.data) return refuse("no_account");
  const out = await upsertAskAnswer(client, userId, answer, new Date(nowMs).toISOString());
  if (out.error) return refuse("error");
  const m = (ASK_MOMENTS as readonly string[]).includes(moment as string) ? (moment as string) : "settings";
  recordEvents({ event: "notification_opt_in", playerId: userId, props: { answer, moment: m } });
  return { ok: true };
}

/** A notification was tapped (the page opened with ?notif=<event>). */
export function noteOpened(userId: string, event: unknown): { ok: boolean } {
  if (!isPushEvent(event)) return { ok: false };
  recordEvents({ event: "notification_opened", playerId: userId, props: { event } });
  return { ok: true };
}
