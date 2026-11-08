/**
 * Offline practice's background work (31 Oct 2026), started once by the root route: the <html data-offline>
 * marker, the service worker, and, whenever there is a connection (a few seconds after opening, on
 * reconnecting, on returning to the app and every few minutes), the queued runs sent for grading and then the
 * practice packs topped up.
 *
 * 8 Nov 2026 (the performance audit's item 2): the worker's own download (the app files, sounds and tiles, about
 * 30 MB) follows the packs' rules: nothing before this device's first finished practice round, nothing on
 * Save-Data, a metered or 2G-class connection or with Battery saver, nothing while a room, daily or challenge is
 * on screen (packs.ts offlineDownloadAllowed); and after a new build only the files that changed.
 */
import { installOnlineMarker } from "./online";
import { offlineDownloadAllowed, readPacks, topUpPacks } from "./packs";
import { practiceStarted } from "./packGrowth";
import { flushQueue } from "./queue";
import { installOfflineWorker, requestWorkerFill } from "./serviceWorker";

const FIRST_SYNC_MS = 3000;
const PERIODIC_SYNC_MS = 5 * 60_000;

/** Whether the worker's install may download now: as the packs, from the first finished practice round. */
function fillAtInstall(): boolean {
  return offlineDownloadAllowed() && practiceStarted();
}

/** The worker's download, when allowed: from the first finished round (or packs kept from before that rule). */
async function fillWorker(): Promise<void> {
  if (!offlineDownloadAllowed()) return;
  if (!practiceStarted() && (await readPacks()).length === 0) return;
  await requestWorkerFill();
}

/** Sends the queue, then the worker's download and the packs (each does nothing without a connection). */
export function syncOffline(): Promise<void> {
  return flushQueue()
    .then(() => fillWorker().catch(() => {}))
    .then(() => topUpPacks());
}

export function installOfflinePractice(): () => void {
  const stopMarker = installOnlineMarker();
  const stopWorker = installOfflineWorker(fillAtInstall);
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
