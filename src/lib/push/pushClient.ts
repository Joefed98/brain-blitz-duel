/**
 * Phone notifications, the phone's half (wave 2 train B, session B2; docs/push-notifications.md). Accounts only, and
 * nothing at all while the switch is off (PUSH_PUBLIC_KEY empty, src/config/pushConfig.ts): no ask, no subscription,
 * no settings panel, no server call.
 *
 *  - Asking: never on first open. A useful moment (`notePushMoment`: a first friend request sent or received, B1; a
 *    challenge from a friend; a first finished Daily) marks the ask as due on this device; the next tab page shows it
 *    (NotificationAskSlot). A decline holds every ask off for 30 days (on the device and on the server).
 *  - On iPhone, web push works only in the app added to the Home Screen: in Safari the ask is a short how-to instead.
 *  - The subscription lives in the browser's PushManager on the offline worker's registration (the same /sw.js, whose
 *    offline update is unchanged); the server keeps one row per account and device. Sign-out removes this device's row
 *    and unsubscribes (`forgetPushOnSignOut`); each open refreshes it (time zone, a renewed endpoint).
 */

import { pushForPlayer, pushPublicKey } from "@/config/pushConfig";
import { iphoneSafari } from "@/lib/iphoneSafari";

import {
  forgetPushOnSignOut,
  pushOn,
  pushSupported,
  readRecord,
  registration,
  unsubscribeDevice,
  writeRecord,
  type PushDeviceRecord,
} from "./pushDevice";
import { mayAskAgain, OPENED_PARAM, isPushEvent, type AskMoment } from "./rules";

export { forgetPushOnSignOut, pushOn, pushSupported, unsubscribeDevice };

/** An iPhone in Safari (not the Home Screen app): web push needs the app added to the Home Screen first. */
export function needsHomeScreen(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true || (window.matchMedia?.("(display-mode: standalone)").matches ?? false);
  return iphoneSafari({ ua: nav.userAgent, standalone });
}

export type AskKind = "ask" | "home-screen" | null;

/** What the ask would show on this device: the opt-in, the iPhone how-to, or nothing. */
export function askKind(): AskKind {
  if (!pushOn()) return null;
  if (needsHomeScreen()) return "home-screen";
  if (!pushSupported()) return null;
  if (Notification.permission === "denied") return null;
  return "ask";
}

/** Whether this device may ask now (never declined, or 30+ days ago; permission not already granted and in use). */
export function mayAskOnDevice(nowMs: number = Date.now()): boolean {
  const record = readRecord();
  if (!mayAskAgain(record.declinedAt ?? null, nowMs)) return false;
  if (pushSupported() && Notification.permission === "granted" && record.subscribed) return false;
  return true;
}

/**
 * A useful moment for the ask happened (B1's friend calls, a finished Daily): marks it due for the next tab page.
 * Does nothing with the switch off, for a guest or an account outside the audience (`playerNumber` null or not a tester
 * while notifications are for testers only, pushConfig.ts), on a device that can't receive, or inside the 30 days
 * after a decline.
 */
export function notePushMoment(moment: AskMoment, playerNumber: number | null): void {
  if (!pushForPlayer(playerNumber) || askKind() === null || !mayAskOnDevice()) return;
  const record = readRecord();
  if (record.pending) return;
  writeRecord({ ...record, pending: moment });
}

/** The due ask's moment, if any (the slot reads it on a tab page). */
export function pendingAsk(): AskMoment | null {
  if (askKind() === null || !mayAskOnDevice()) return null;
  return readRecord().pending ?? null;
}

function clearPending(extra: Partial<PushDeviceRecord> = {}): void {
  writeRecord({ ...readRecord(), pending: null, ...extra });
}

function keyBytes(key: string): Uint8Array {
  const s = key.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London";
  } catch {
    return "Europe/London";
  }
}

async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;
  const { savePushSubscriptionFn } = await import("./push.functions");
  const answer = (await savePushSubscriptionFn({
    data: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, timeZone: timeZone() },
  })) as { ok: boolean };
  return answer?.ok === true;
}

/** Subscribes this device (permission already granted) and saves it on the server. */
async function subscribe(): Promise<boolean> {
  const reg = await registration();
  if (!reg) return false;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(pushPublicKey()).slice().buffer as ArrayBuffer }));
  const saved = await saveSubscription(sub);
  if (saved) writeRecord({ ...readRecord(), subscribed: true });
  return saved;
}

async function noteAnswer(answer: "accepted" | "declined", moment: AskMoment | "settings"): Promise<void> {
  try {
    const { notePushAnswerFn } = await import("./push.functions");
    await notePushAnswerFn({ data: { answer, moment } });
  } catch {
    /* best effort */
  }
}

export type EnableOutcome = "subscribed" | "denied" | "unsupported" | "failed";

/** The player said yes (the ask, or the settings' switch): the browser's permission, then the subscription. */
export async function enableNotifications(moment: AskMoment | "settings"): Promise<EnableOutcome> {
  if (!pushOn() || !pushSupported() || needsHomeScreen()) return "unsupported";
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return "failed";
  }
  if (permission !== "granted") {
    clearPending({ declinedAt: Date.now() });
    await noteAnswer("declined", moment);
    return "denied";
  }
  clearPending({ declinedAt: null });
  await noteAnswer("accepted", moment);
  try {
    return (await subscribe()) ? "subscribed" : "failed";
  } catch {
    return "failed";
  }
}

/** The player said not now: no ask for 30 days. */
export async function declineNotifications(moment: AskMoment): Promise<void> {
  clearPending({ declinedAt: Date.now() });
  await noteAnswer("declined", moment);
}

/** The iPhone how-to was closed: treated as "not now" on this device only (the server isn't told: nothing was asked). */
export function dismissHomeScreenHowTo(): void {
  clearPending({ declinedAt: Date.now() });
}

/** Whether this device is receiving (permission granted and a subscription in the browser). */
export async function deviceSubscribed(): Promise<boolean> {
  if (!pushOn() || !pushSupported() || Notification.permission !== "granted") return false;
  const reg = await registration();
  return !!(await reg?.pushManager.getSubscription().catch(() => null));
}

/**
 * Each open, for an account in the audience (pushConfig.ts): keeps this device's row fresh (time zone, a renewed
 * endpoint), renews a subscription the browser lost while permission is still granted, and records a tap that opened
 * the app (?notif=<event>).
 */
export async function syncPushOnOpen(playerNumber: number | null): Promise<void> {
  if (!pushOn() || !pushForPlayer(playerNumber)) return;
  await noteOpenedFromUrl();
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  try {
    if (sub) await saveSubscription(sub);
    else if (readRecord().subscribed) await subscribe();
  } catch {
    /* next open */
  }
}

/** notification_opened: the page was opened from a notification (?notif=<event>); the marker is then removed. */
async function noteOpenedFromUrl(): Promise<void> {
  try {
    const url = new URL(window.location.href);
    const event = url.searchParams.get(OPENED_PARAM);
    if (!event) return;
    url.searchParams.delete(OPENED_PARAM);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    if (!isPushEvent(event)) return;
    const { notePushOpenedFn } = await import("./push.functions");
    await notePushOpenedFn({ data: { event } });
  } catch {
    /* best effort */
  }
}
