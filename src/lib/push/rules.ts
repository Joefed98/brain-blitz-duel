/**
 * Phone notifications' rules (wave 2 train B, session B2; docs/push-notifications.md), shared by the phone and the
 * server. Pure: no I/O, no clock of its own (every function takes the time it judges).
 *
 * The six events of the master plan, each with its own switch under the player's master switch:
 *  - friend_request, friend_accepted, friend_challenge: from B1's recorded friend events (notify.server.ts
 *    dispatchFriendEvents);
 *  - room_invite: a friend inviting you to their room, also from B1's events (exempt from the daily cap, and from quiet
 *    hours while fresh);
 *  - tournament_starting: the type exists so the setting can be shown; nothing sends it until wave 4;
 *  - daily_streak: the evening reminder (UK time), only to a player with a live streak (train C's, on the account) who
 *    hasn't played today's Daily.
 *
 * Limits: at most DAILY_CAP a day (the player's own day) apart from room invites; nothing between QUIET_FROM_HOUR and
 * QUIET_TO_HOUR in the player's time zone except a room invite a friend has just sent (within INVITE_FRESH_MS).
 * A notification held back by the cap or quiet hours is dropped, never queued for later (never nagging).
 */

export const PUSH_EVENTS = [
  "friend_request",
  "friend_accepted",
  "friend_challenge",
  "room_invite",
  "tournament_starting",
  "daily_streak",
] as const;
export type PushEvent = (typeof PUSH_EVENTS)[number];

export function isPushEvent(value: unknown): value is PushEvent {
  return typeof value === "string" && (PUSH_EVENTS as readonly string[]).includes(value);
}

/** Each event's switch as the settings screen names it, in the order shown. */
export const PUSH_EVENT_LABELS: Record<PushEvent, { title: string; sub: string }> = {
  friend_request: { title: "Friend requests", sub: "Someone wants to be your friend" },
  friend_accepted: { title: "Friend accepted", sub: "A friend request you sent was accepted" },
  friend_challenge: { title: "Challenges from friends", sub: "A friend challenges you" },
  room_invite: { title: "Room invites", sub: "A friend invites you to their room" },
  tournament_starting: { title: "Tournaments", sub: "One you entered or asked about is starting" },
  daily_streak: { title: "Daily streak reminder", sub: "An evening nudge if today’s Daily isn’t played" },
};

/** The settings' columns (public.notification_settings): the master switch, then one per event. */
export interface PushSettings {
  enabled: boolean;
  friend_request: boolean;
  friend_accepted: boolean;
  friend_challenge: boolean;
  room_invite: boolean;
  tournament_starting: boolean;
  daily_streak: boolean;
}

/** A player with no settings row yet: everything on (they chose to allow notifications). */
export const DEFAULT_PUSH_SETTINGS: PushSettings = {
  enabled: true,
  friend_request: true,
  friend_accepted: true,
  friend_challenge: true,
  room_invite: true,
  tournament_starting: true,
  daily_streak: true,
};

/** The most notifications a player gets in one of their days, room invites apart. */
export const DAILY_CAP = 3;
/** Quiet hours, in the player's time zone: from 22:00 to 08:00. */
export const QUIET_FROM_HOUR = 22;
export const QUIET_TO_HOUR = 8;
/** A room invite counts as "just sent" for this long after the friend sent it (quiet hours only). */
export const INVITE_FRESH_MS = 2 * 60_000;
/** After the player declines, the phone doesn't ask again for this long. */
export const ASK_AGAIN_AFTER_MS = 30 * 24 * 60 * 60_000;
/** The time zone used when a device sent none (or one Intl doesn't know). */
export const FALLBACK_TIME_ZONE = "Europe/London";
/** The Daily reminder's window, UK time: it is sent from 19:00 until 20:59 (the scheduler fires twice; see the doc). */
export const STREAK_REMINDER_UK_HOURS: readonly number[] = [19, 20];

/** Whether an event is counted against the daily cap. */
export function countsAgainstCap(event: PushEvent): boolean {
  return event !== "room_invite";
}

/** A known IANA time zone, or the fallback. */
export function safeTimeZone(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return FALLBACK_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value }).format(0);
    return value;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formats = new Map<string, Intl.DateTimeFormat>();
function localParts(ms: number, timeZone: string): LocalParts {
  const tz = safeTimeZone(timeZone);
  let format = formats.get(tz);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formats.set(tz, format);
  }
  const parts: Record<string, number> = {};
  for (const p of format.formatToParts(new Date(ms))) if (p.type !== "literal") parts[p.type] = Number(p.value);
  return {
    year: parts["year"] ?? 1970,
    month: parts["month"] ?? 1,
    day: parts["day"] ?? 1,
    hour: (parts["hour"] ?? 0) % 24,
    minute: parts["minute"] ?? 0,
    second: parts["second"] ?? 0,
  };
}

/** The hour (0–23) on the player's clock. */
export function localHour(ms: number, timeZone: string): number {
  return localParts(ms, timeZone).hour;
}

/** The player's calendar day ("2026-11-11"). */
export function localDayKey(ms: number, timeZone: string): string {
  const p = localParts(ms, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** When the player's current day began (UTC ms): their local midnight. */
export function localDayStartMs(ms: number, timeZone: string): number {
  const p = localParts(ms, timeZone);
  // The offset now (local wall time as UTC less the instant); midnight is that many hours, minutes and seconds back.
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offset = wallAsUtc - Math.floor(ms / 1000) * 1000;
  const midnight = Date.UTC(p.year, p.month - 1, p.day) - offset;
  // A clock change between midnight and now: the day began where the local clock read 00:00 (never after now).
  return Math.min(midnight, ms);
}

/** Inside the player's quiet hours (22:00–08:00 their time). */
export function inQuietHours(ms: number, timeZone: string): boolean {
  const hour = localHour(ms, timeZone);
  return hour >= QUIET_FROM_HOUR || hour < QUIET_TO_HOUR;
}

export type SendDecision = "send" | "off" | "capped" | "quiet";

/**
 * Whether one notification goes out: the player's master switch and the event's switch, then quiet hours (a fresh
 * room invite excepted), then the daily cap (room invites excepted).
 */
export function decideSend(input: {
  event: PushEvent;
  settings: PushSettings;
  /** Notifications already sent to this player today (their day), room invites not counted. */
  sentToday: number;
  nowMs: number;
  timeZone: string;
  /** When the friend did what this notification is about (a room invite's send); null: not a fresh invite. */
  causedAtMs?: number | null;
}): SendDecision {
  const { event, settings } = input;
  if (!settings.enabled || !settings[event]) return "off";
  const fresh =
    event === "room_invite" &&
    typeof input.causedAtMs === "number" &&
    input.nowMs - input.causedAtMs >= 0 &&
    input.nowMs - input.causedAtMs <= INVITE_FRESH_MS;
  if (!fresh && inQuietHours(input.nowMs, input.timeZone)) return "quiet";
  if (countsAgainstCap(event) && input.sentToday >= DAILY_CAP) return "capped";
  return "send";
}

/** Whether the phone may ask now, given the last decline (ISO or ms) and when it last asked. */
export function mayAskAgain(declinedAt: string | number | null | undefined, nowMs: number): boolean {
  if (declinedAt === null || declinedAt === undefined || declinedAt === "") return true;
  const at = typeof declinedAt === "number" ? declinedAt : Date.parse(declinedAt);
  if (!Number.isFinite(at)) return true;
  return nowMs - at >= ASK_AGAIN_AFTER_MS;
}

/** The settings with unknown or missing fields read as the defaults; only booleans are taken. */
export function normaliseSettings(raw: unknown): PushSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_PUSH_SETTINGS };
  if (typeof r["enabled"] === "boolean") out.enabled = r["enabled"];
  for (const event of PUSH_EVENTS) if (typeof r[event] === "boolean") out[event] = r[event] as boolean;
  return out;
}

/** The moments the phone may ask at (never on first open): friends (B1) and a first finished Daily. */
export const ASK_MOMENTS = ["friend_request_sent", "friend_request_received", "daily_finished", "challenge_received"] as const;
export type AskMoment = (typeof ASK_MOMENTS)[number];

/** notification_opened's `?notif=` marker on a notification's link. */
export const OPENED_PARAM = "notif";
