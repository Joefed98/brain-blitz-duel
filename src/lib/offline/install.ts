/**
 * Offline practice's background work (31 Oct 2026), started once by the root route: the <html data-offline>
 * marker, the service worker, and, whenever there is a connection (a few seconds after opening, on
 * reconnecting, on returning to the app and every few minutes), the queued runs sent for grading and then the
 * practice packs topped up.
 */
import { installOnlineMarker } from "./online";
import { topUpPacks } from "./packs";
import { flushQueue } from "./queue";
import { installOfflineWorker } from "./serviceWorker";

const FIRST_SYNC_MS = 3000;
const PERIODIC_SYNC_MS = 5 * 60_000;

/** Sends the queue, then tops up the packs (each does nothing without a connection). */
export function syncOffline(): Promise<void> {
  return flushQueue().then(() => topUpPacks());
}

export function installOfflinePractice(): () => void {
  const stopMarker = installOnlineMarker();
  const stopWorker = installOfflineWorker();
  const kick = () => void syncOffline().catch(() => {});
  const first = window.setTimeout(kick, FIRST_SYNC_MS);
  const periodic = window.setInterval(() => {
    if (document.visibilityState !== "hidden") kick();
  }, PERIODIC_SYNC_MS);
  const onVisible = () => {
    if (document.visibilityState === "visible") kick();
  };
  window.addEventListener("online", kick);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    stopMarker();
    stopWorker();
    window.clearTimeout(first);
    window.clearInterval(periodic);
    window.removeEventListener("online", kick);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
