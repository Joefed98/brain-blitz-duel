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
 * Off (returns "disabled", sends nothing) until both VAPID keys are set: PUSH_PUBLIC_KEY (src/config/pushConfig.ts) and
 * the Worker secret VAPID_PRIVATE_KEY.
 */

import type { Db } from "@/lib/data/db.server";
import { recordEvents } from "@/lib/data/events.server";
import {
  deleteGoneSubscription,
  readNotificationSettings,
  readPlayedDaily,
  readPushSubscriptions,
  readStreakCandidates,
  reserveNotification,
} from "@/lib/data/push.server";
import { ukDayKey } from "@/lib/duel/daily";

import { messageFor, type MessageInput } from "./messages";
import {
  countsAgainstCap,
  DAILY_CAP,
  decideSend,
  inQuietHours,
  localDayStartMs,
  localHour,
  normaliseSettings,
  safeTimeZone,
  STREAK_REMINDER_UK_HOURS,
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

/* ------------------------------------------------------------------ the evening reminder */

export interface ReminderRun {
  day: string;
  /** False outside the evening window (nothing looked at). */
  inWindow: boolean;
  candidates: number;
  outcomes: Partial<Record<NotifyOutcome, number>>;
}

/**
 * The Daily streak reminder for today (UK): run by the scheduler (the /api/push/daily-reminder route) in the evening.
 * Only inside STREAK_REMINDER_UK_HOURS; once per player per UK day (the log's key); only to players with a live
 * streak who haven't started today's Daily (checked again right before each send); quiet hours on their own clock.
 */
export async function runDailyStreakReminders(client: Db, opts: NotifyOptions & { limit?: number } = {}): Promise<ReminderRun> {
  const nowMs = opts.nowMs ?? Date.now();
  const day = ukDayKey(nowMs);
  const run: ReminderRun = { day, inWindow: false, candidates: 0, outcomes: {} };
  if (!STREAK_REMINDER_UK_HOURS.includes(localHour(nowMs, "Europe/London"))) return run;
  run.inWindow = true;
  const keys = opts.keys === undefined ? vapidKeys() : opts.keys;
  if (!keys) {
    run.outcomes.disabled = 1;
    return run;
  }
  const list = await readStreakCandidates(client, day);
  if (list.error) {
    warn(`daily_streak: candidates: ${list.error.message}`);
    run.outcomes.failed = 1;
    return run;
  }
  const people = list.data.slice(0, opts.limit ?? 5000);
  run.candidates = people.length;
  for (const person of people) {
    let outcome: NotifyOutcome;
    if (inQuietHours(nowMs, safeTimeZone(person.time_zone))) outcome = "quiet";
    else {
      const played = await readPlayedDaily(client, person.user_id, day);
      if (played.data !== false) outcome = played.error ? "failed" : "off";
      else outcome = await notify(client, person.user_id, "daily_streak", {}, { ...opts, keys, nowMs, dedupeKey: `daily_streak:${day}` });
    }
    run.outcomes[outcome] = (run.outcomes[outcome] ?? 0) + 1;
  }
  return run;
}
