/**
 * The phone's side of our analytics (9 Nov 2026; docs/analytics.md): the five moments only the phone sees
 * (CLIENT_EVENTS) are queued in device storage with the time they happened and sent in the background through
 * recordClientEventsFn. Offline, they wait (keeping their time) and go once the phone is back online. The queue holds
 * at most CLIENT_QUEUE_MAX events (the oldest dropped first). Never throws and nothing on screen waits for it.
 *
 * A browser under automation (navigator.webdriver: the repo's browser checks) queues but never sends unless the page
 * sets `window.__DUELZ_ALLOW_ANALYTICS__`, as offline packs do, so no check sees an extra request.
 */
import {
  CLIENT_BATCH_MAX,
  CLIENT_QUEUE_MAX,
  type ClientEventInput,
  type ClientEventName,
} from "./events";

const QUEUE_KEY = "duelz-analytics-queue:v1";
/** How long after the last queued event the batch goes (so a burst is one call). */
const SEND_DELAY_MS = 3_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;
let installed = false;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Memory copy for devices whose storage is blocked. */
let memoryQueue: ClientEventInput[] = [];

function readQueue(): ClientEventInput[] {
  const store = storage();
  if (!store) return memoryQueue;
  try {
    const raw = JSON.parse(store.getItem(QUEUE_KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? (raw as ClientEventInput[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: ClientEventInput[]): void {
  const kept = queue.slice(-CLIENT_QUEUE_MAX);
  memoryQueue = kept;
  try {
    storage()?.setItem(QUEUE_KEY, JSON.stringify(kept));
  } catch {
    /* memory only */
  }
}

function automated(): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      navigator.webdriver === true &&
      (window as { __DUELZ_ALLOW_ANALYTICS__?: boolean }).__DUELZ_ALLOW_ANALYTICS__ !== true
    );
  } catch {
    return false;
  }
}

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function schedule(delay = SEND_DELAY_MS): void {
  if (typeof window === "undefined" || timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushClientEvents();
  }, delay);
}

/** Queues one phone-side event; it is sent shortly after, or once the phone is back online. */
export function trackClientEvent(
  event: ClientEventName,
  extra: { game?: string; props?: ClientEventInput["props"] } = {},
): void {
  try {
    if (typeof window === "undefined") return;
    install();
    const item: ClientEventInput = { event, at: Date.now() };
    if (extra.game) item.game = extra.game;
    if (extra.props && Object.keys(extra.props).length) item.props = extra.props;
    writeQueue([...readQueue(), item]);
    schedule();
  } catch {
    /* analytics never gets in the way */
  }
}

/** Sends what is queued, a batch at a time; anything not confirmed stays queued for the next try. */
export async function flushClientEvents(): Promise<void> {
  if (sending || automated() || !online()) return;
  sending = true;
  try {
    const { ensureSession } = await import("@/lib/duel/session");
    await ensureSession();
    const { recordClientEventsFn } = await import("./analytics.functions");
    for (let guard = 0; guard < 10; guard++) {
      const queue = readQueue();
      if (!queue.length) break;
      const batch = queue.slice(0, CLIENT_BATCH_MAX);
      const reply = await recordClientEventsFn({ data: { events: batch } });
      // Rate limited: keep them for a later visit. A refused batch or refused events are dropped (never retried).
      if (!reply.ok && reply.reason === "rate_limited") break;
      writeQueue(readQueue().slice(batch.length));
    }
  } catch {
    /* offline or signed out: kept for the next try */
  } finally {
    sending = false;
  }
}

/** Sends the queue when the phone comes back online. */
function install(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  try {
    window.addEventListener("online", () => schedule(1_000));
  } catch {
    /* no listener: the next event sends */
  }
}
