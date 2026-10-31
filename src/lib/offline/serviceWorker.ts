/**
 * The offline service worker's page side (offline practice, 31 Oct 2026): registers /sw.js (written per
 * build by swPlugin.ts; production only, the dev server has none) and hands over to a new build's worker
 * cleanly. A new worker installs in the background and waits; it is told to take over only while no round
 * is on screen (the app updater's gate is "now": the Practice list, the tab pages), so a run in progress is
 * never interrupted. If the page itself is an older build than the worker that took over, it reloads at
 * that same safe moment.
 */
import { appUpdater } from "@/lib/appUpdate";
import { APP_BUILD_ID } from "@/lib/appVersion";

export const SW_URL = "/sw.js";
const HANDOVER_POLL_MS = 2000;

function workerApi(): ServiceWorkerContainer | null {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
    return navigator.serviceWorker;
  } catch {
    return null;
  }
}

/** The build id of a worker (it answers a VERSION message), or null. */
export function workerVersion(worker: ServiceWorker | null | undefined, timeoutMs = 1500): Promise<string | null> {
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(typeof event.data?.version === "string" ? event.data.version : null);
    };
    worker.postMessage({ type: "VERSION" }, [channel.port2]);
  });
}

const safeNow = () => (appUpdater()?.gate() ?? "now") === "now";

/** Registers the worker and keeps watch for a new build's waiting worker. Production only. */
export function installOfflineWorker(): () => void {
  const api = workerApi();
  if (!api || !import.meta.env.PROD) return () => {};
  let stopped = false;
  let reloadWanted = false;
  void api.register(SW_URL, { scope: "/", updateViaCache: "none" }).catch(() => {
    /* no worker: the app works online as before */
  });
  const onControllerChange = async () => {
    const version = await workerVersion(api.controller);
    if (version && version !== APP_BUILD_ID) reloadWanted = true;
  };
  api.addEventListener("controllerchange", onControllerChange);
  const tick = async () => {
    if (stopped) return;
    try {
      const reg = await api.getRegistration();
      if (reg?.waiting && safeNow()) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      if (reloadWanted && safeNow()) {
        reloadWanted = false;
        window.location.reload();
      }
    } catch {
      /* next tick */
    }
  };
  const timer = window.setInterval(() => void tick(), HANDOVER_POLL_MS);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    api.removeEventListener("controllerchange", onControllerChange);
  };
}

/**
 * The app updater's step before its reload onto a new build: fetch the new worker and let it take over
 * (the updater only reloads where that is safe). Nothing kept for offline play is deleted; only caches and
 * workers from before offline practice are cleared.
 */
export async function handOverToNewWorker(waitMs = 8000): Promise<void> {
  const api = workerApi();
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith("joulz-")).map((k) => caches.delete(k)));
  }
  if (!api) return;
  const regs = await api.getRegistrations();
  await Promise.all(regs.filter((r) => !(r.active ?? r.waiting ?? r.installing)?.scriptURL.endsWith(SW_URL)).map((r) => r.unregister()));
  const reg = await api.getRegistration();
  if (!reg) return;
  await reg.update().catch(() => {});
  const deadline = Date.now() + waitMs;
  while (reg.installing && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
  const waiting = reg.waiting;
  if (!waiting) return;
  const changed = new Promise<void>((resolve) => {
    api.addEventListener("controllerchange", () => resolve(), { once: true });
    setTimeout(resolve, 3000);
  });
  waiting.postMessage({ type: "SKIP_WAITING" });
  await changed;
}
