/**
 * Sending phone notifications (wave 2 train B, session B2; docs/push-notifications.md). Server only. The ONE place a
 * notification is decided and sent: the player's switches, quiet hours and the daily cap (rules.ts), the log's atomic
 * reservation (push_reserve), then one encrypted push per device (webPush.server.ts); a device the push service says has
 * gone is removed. Every send records `notification_sent`.
 *
 * Never throws and never holds up the request it rides on for long: callers (B1's friend calls, a room invite, the
 * reminder) may await it or not; a failure is logged as `[push] …` and dropped. Nothing here touches play, scoring,
 * stamps, timings or the room flow.
 *
 * The evening Daily reminder lives in streakReminder.server.ts (it reads train C's Daily streak), so B1's friend
 * calls, which load this module, reach no Daily or ranking code.
 *
 * Off (returns "disabled", sends nothing) until both VAPID keys are set: PUSH_PUBLIC_KEY (src/config/pushConfig.ts) and
 * the Worker secret VAPID_PRIVATE_KEY.
 */

import type { Db } from "@/lib/data/db.server";
import { recordEvents } from "@/lib/data/events.server";
import { readPublicProfiles } from "@/lib/data/profiles.server";
import {
  claimFriendEvents,
  deleteGoneSubscription,
  readNotificationSettings,
  readPushSubscriptions,
  reserveNotification,
  type FriendEventRow,
} from "@/lib/data/push.server";

import { messageFor, type MessageInput } from "./messages";
import {
  countsAgainstCap,
  DAILY_CAP,
  decideSend,
  localDayStartMs,
  normaliseSettings,
  safeTimeZone,
  type PushEvent,
} from "./rules";
import { sendPush, vapidKeys, type PushOutcome, type PushTarget } from "./webPush.server";

export type NotifyOutcome = "sent" | "disabled" | "no_device" | "off" | "quiet" | "capped" | "duplicate" | "failed";

export interface NotifyOptions {
  /** When the friend did what this is about (a room invite: quiet hours let a fresh one through). */
  causedAtMs?: number | null;
  /** Once-only key (the reminder's "daily_streak:<day>"). */
  dedupeKey?: string | null;
  nowMs?: number;
  /** Checks only: the keys and the push service. */
  keys?: { publicKey: string; privateKey: string } | null;
  fetchImpl?: typeof fetch | undefined;
}

/** How long a push service may hold each event for a phone that's offline (seconds). */
const TTL_SECONDS: Record<PushEvent, number> = {
  friend_request: 24 * 3600,
  friend_accepted: 24 * 3600,
  friend_challenge: 24 * 3600,
  room_invite: 10 * 60,
  tournament_starting: 15 * 60,
  daily_streak: 3 * 3600,
};

function warn(message: string): void {
  console.warn(`[push] ${message}`);
}

/** Sends one notification to every device of `userId`, if the rules allow it. */
export async function notify(
  client: Db,
  userId: string,
  event: PushEvent,
  input: MessageInput = {},
  opts: NotifyOptions = {},
): Promise<NotifyOutcome> {
  try {
    const keys = opts.keys === undefined ? vapidKeys() : opts.keys;
    if (!keys) return "disabled";
    const nowMs = opts.nowMs ?? Date.now();
    const devices = await readPushSubscriptions(client, userId);
    if (devices.error) {
      warn(`${event}: devices: ${devices.error.message}`);
      return "failed";
    }
    if (devices.data.length === 0) return "no_device";
    const settingsRow = await readNotificationSettings(client, userId);
    if (settingsRow.error) {
      warn(`${event}: settings: ${settingsRow.error.message}`);
      return "failed";
    }
    const settings = normaliseSettings(settingsRow.data);
    const timeZone = safeTimeZone(devices.data[0]!.time_zone);
    // The cap is counted by the log's reservation (atomic); here only the switches and quiet hours.
    const decision = decideSend({ event, settings, sentToday: 0, nowMs, timeZone, causedAtMs: opts.causedAtMs ?? null });
    if (decision !== "send") return decision;
    const reserved = await reserveNotification(client, {
      userId,
      event,
      countsCap: countsAgainstCap(event),
      sinceIso: new Date(localDayStartMs(nowMs, timeZone)).toISOString(),
      cap: DAILY_CAP,
      dedupeKey: opts.dedupeKey ?? null,
    });
    if (reserved.error || !reserved.data) {
      warn(`${event}: reserve: ${reserved.error?.message ?? "no answer"}`);
      return "failed";
    }
    if (reserved.data !== "ok") return reserved.data;
    const payload = messageFor(event, input);
    let sent = 0;
    for (const device of devices.data) {
      const target: PushTarget = { endpoint: device.endpoint, p256dh: device.p256dh, auth: device.auth };
      const { outcome } = await sendPush(target, payload, {
        keys,
        nowMs,
        ttlSeconds: TTL_SECONDS[event],
        urgency: event === "room_invite" ? "high" : "normal",
        topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32),
        fetchImpl: opts.fetchImpl,
      });
      if (outcome === "sent") sent++;
      if (outcome === "gone") await removeGone(client, device.id, event);
    }
    if (sent === 0) return "failed";
    recordEvents({ event: "notification_sent", playerId: userId, props: { event, devices: sent } });
    return "sent";
  } catch (err) {
    warn(`${event}: ${err instanceof Error ? err.message : String(err)}`);
    return "failed";
  }
}

async function removeGone(client: Db, id: string, event: PushEvent): Promise<PushOutcome> {
  const out = await deleteGoneSubscription(client, id);
  if (out.error) warn(`${event}: removing a gone device: ${out.error.message}`);
  return "gone";
}

/* ------------------------------------------------------------------ the events, by name (B1, wave 4) */

/** B1 (friends): `toUserId` received a friend request from `fromName`. */
export const notifyFriendRequest = (client: Db, toUserId: string, fromName: string, opts?: NotifyOptions) =>
  notify(client, toUserId, "friend_request", { from: fromName }, opts);

/** B1 (friends): `toUserId`'s request was accepted by `byName`. */
export const notifyFriendAccepted = (client: Db, toUserId: string, byName: string, opts?: NotifyOptions) =>
  notify(client, toUserId, "friend_accepted", { from: byName }, opts);

/** B1 (friends): `fromName` challenged `toUserId` to the friend challenge `code`. */
export const notifyFriendChallenge = (client: Db, toUserId: string, fromName: string, code: string, opts?: NotifyOptions) =>
  notify(client, toUserId, "friend_challenge", { from: fromName, code }, opts);

/** B1 (friends): `fromName` invited `toUserId` to room `code` just now (exempt from the cap; quiet hours while fresh). */
export const notifyRoomInvite = (client: Db, toUserId: string, fromName: string, code: string, opts: NotifyOptions = {}) =>
  notify(client, toUserId, "room_invite", { from: fromName, code }, { causedAtMs: opts.causedAtMs ?? opts.nowMs ?? Date.now(), ...opts });

/** Wave 4: a tournament `toUserId` entered or asked to be reminded of is starting. Nothing calls this yet. */
export const notifyTournamentStarting = (client: Db, toUserId: string, title: string, tournamentId: string, opts?: NotifyOptions) =>
  notify(client, toUserId, "tournament_starting", { title }, { dedupeKey: `tournament:${tournamentId.slice(0, 64)}`, ...opts });

/* ------------------------------------------------------------------ B1's friend events */

/** How far back a dispatch looks for unsent friend events, and how long a room invite stays worth sending. */
export const FRIEND_EVENT_LOOKBACK_MS = 60 * 60_000;
export const ROOM_INVITE_SEND_WITHIN_MS = 10 * 60_000;

const FRIEND_EVENT_TO_PUSH: Record<string, PushEvent> = {
  friend_request_received: "friend_request",
  friend_request_accepted: "friend_accepted",
  friend_challenge_received: "friend_challenge",
  room_invite_received: "room_invite",
};

export interface FriendDispatch {
  claimed: number;
  outcomes: Partial<Record<NotifyOutcome | "stale" | "unknown", number>>;
}

/**
 * Turns B1's recorded friend events (public.friend_events: friend_request_received, friend_request_accepted,
 * friend_challenge_received, room_invite_received) into notifications. Each event is claimed once
 * (push_claim_friend_events), so the request's own dispatch (friends.server.ts, right after the change) and the
 * five-minute sweep (the Cron Trigger) never both send it. The friend's username comes from public_profiles. A room
 * invite older than ROOM_INVITE_SEND_WITHIN_MS isn't sent (the lobby has likely moved on). Never throws.
 */
export async function dispatchFriendEvents(client: Db, opts: NotifyOptions & { limit?: number } = {}): Promise<FriendDispatch> {
  const out: FriendDispatch = { claimed: 0, outcomes: {} };
  try {
    const keys = opts.keys === undefined ? vapidKeys() : opts.keys;
    // Off: nothing is claimed, so the events stay for when it comes on (the lookback then bounds what is sent).
    if (!keys) {
      out.outcomes.disabled = 1;
      return out;
    }
    const nowMs = opts.nowMs ?? Date.now();
    const claimed = await claimFriendEvents(client, new Date(nowMs - FRIEND_EVENT_LOOKBACK_MS).toISOString(), opts.limit ?? 200);
    if (claimed.error) {
      warn(`friend events: ${claimed.error.message}`);
      out.outcomes.failed = 1;
      return out;
    }
    out.claimed = claimed.data.length;
    if (!claimed.data.length) return out;
    const names = await readPublicProfiles(client, [...new Set(claimed.data.map((e) => e.actor_id))]);
    const nameOf = new Map((names.data ?? []).map((p) => [p.user_id, p.username]));
    for (const event of claimed.data) {
      const outcome = await sendFriendEvent(client, event, nameOf.get(event.actor_id) ?? null, { ...opts, keys, nowMs });
      out.outcomes[outcome] = (out.outcomes[outcome] ?? 0) + 1;
    }
  } catch (err) {
    warn(`friend events: ${err instanceof Error ? err.message : String(err)}`);
    out.outcomes.failed = (out.outcomes.failed ?? 0) + 1;
  }
  return out;
}

async function sendFriendEvent(
  client: Db,
  event: FriendEventRow,
  actorName: string | null,
  opts: NotifyOptions & { nowMs: number },
): Promise<NotifyOutcome | "stale" | "unknown"> {
  const push = FRIEND_EVENT_TO_PUSH[event.kind];
  if (!push) return "unknown";
  const from = actorName ?? "A friend";
  const code = typeof event.payload?.code === "string" ? event.payload.code : "";
  const at = Date.parse(event.created_at);
  switch (push) {
    case "friend_request":
      return notifyFriendRequest(client, event.recipient_id, from, opts);
    case "friend_accepted":
      return notifyFriendAccepted(client, event.recipient_id, from, opts);
    case "friend_challenge":
      return code ? notifyFriendChallenge(client, event.recipient_id, from, code, opts) : "unknown";
    case "room_invite":
      if (!code) return "unknown";
      if (!Number.isFinite(at) || opts.nowMs - at > ROOM_INVITE_SEND_WITHIN_MS) return "stale";
      return notifyRoomInvite(client, event.recipient_id, from, code, { ...opts, causedAtMs: at });
    default:
      return "unknown";
  }
}

/**
 * The request's own dispatch, after a B1 change that may have recorded a friend event: in the background (Cloudflare's
 * waitUntil where there is one), never awaited by the response, never throwing. Does nothing while the keys aren't set.
 */
export function dispatchFriendEventsSoon(client: Db): void {
  if (!vapidKeys()) return;
  const task = dispatchFriendEvents(client).then(
    () => undefined,
    () => undefined,
  );
  void (async () => {
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const request = getRequest() as (Request & { waitUntil?: (p: Promise<unknown>) => void }) | undefined;
      request?.waitUntil?.(task);
    } catch {
      /* no request context: the task still runs */
    }
  })();
}
