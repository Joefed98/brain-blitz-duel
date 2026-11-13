/**
 * Phone notifications, the device side that sign-out needs (wave 2 B2; docs/push-notifications.md): the switch, this
 * browser's support, the device record (`duelz-push:v1`), the worker's registration and removing this device's
 * subscription. Split out of pushClient.ts so that accountApi.ts (sign-out) reaches no game code: this module imports
 * only the push setting, the shared rules' types and, when it removes a subscription, push.functions. pushClient.ts
 * (the ask, subscribing, each open) builds on it and re-exports what it always exported.
 */

import { pushPublicKey } from "@/config/pushConfig";

import type { AskMoment } from "./rules";

const STORE_KEY = "duelz-push:v1";

export interface PushDeviceRecord {
  /** The ask is due (the moment that made it so). */
  pending?: AskMoment | null;
  /** When the player last declined on this device (ms). */
  declinedAt?: number | null;
  /** This device subscribed (so a lost subscription is renewed while permission stays granted). */
  subscribed?: boolean;
}

export function readRecord(): PushDeviceRecord {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const value = raw ? (JSON.parse(raw) as unknown) : null;
    return value && typeof value === "object" ? (value as PushDeviceRecord) : {};
  } catch {
    return {};
  }
}

export function writeRecord(next: PushDeviceRecord): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* storage is a nicety */
  }
}

/** The switch: the public key is set. */
export function pushOn(): boolean {
  return typeof window !== "undefined" && pushPublicKey().length > 0;
}

/** This browser can do web push (the service worker, PushManager and notifications). */
export function pushSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return "serviceWorker" in window.navigator && "PushManager" in window && "Notification" in window;
  } catch {
    return false;
  }
}

/** This app's service worker registration (the offline worker, /sw.js), or null. */
export async function registration(): Promise<ServiceWorkerRegistration | null> {
  try {
    const reg = await window.navigator.serviceWorker.getRegistration("/");
    if (reg) return reg;
    return await Promise.race([
      window.navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
  } catch {
    return null;
  }
}

/** Stops notifications on this device: the server's row, then the browser's subscription. */
export async function unsubscribeDevice(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (!sub) return;
  try {
    const { removePushSubscriptionFn } = await import("./push.functions");
    await removePushSubscriptionFn({ data: { endpoint: sub.endpoint } });
  } catch {
    /* the server forgets it when the push service next says it has gone */
  }
  await sub.unsubscribe().catch(() => false);
  writeRecord({ ...readRecord(), subscribed: false });
}

/** Sign-out: this device's subscription goes (called while the session is still signed in). */
export async function forgetPushOnSignOut(): Promise<void> {
  if (!pushOn()) return;
  try {
    await unsubscribeDevice();
  } catch {
    /* best effort */
  }
}
