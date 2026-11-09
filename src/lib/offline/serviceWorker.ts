/**
 * The offline service worker's page side (offline practice, 31 Oct 2026): registers /sw.js (written per
 * build by swPlugin.ts; production only, the dev server has none) and hands over to a new build's worker
 * cleanly. A new worker installs in the background and waits; it is told to take over only while no round
 * is on screen (the app updater's gate is "now": the Practice list, the tab pages), so a run in progress is
 * never interrupted. If the page itself is an older build than the worker that took over, it reloads at
 * that same safe moment.
 *
 * What it downloads (8 Nov 2026, the performance audit's item 2): a device registers "/sw.js?fill=later", whose
 * install downloads nothing, unless offline practice may download now (`fillNow`: a finished practice round, a
 * connection that isn't Save-Data, metered or 2G-class, no Battery saver, no room on screen); a device that
 * already has a worker keeps its own address. The download comes later through `requestWorkerFill`, only what
 * changed since the last one (sw.template.js).
 */
import { appUpdater } from "@/lib/appUpdate";
import { APP_BUILD_ID } from "@/lib/appVersion";

export const SW_URL = "/sw.js";
/** The worker whose install waits for the page's FILL (sw.template.js fillDeferred). */
export const SW_LATER_URL = "/sw.js?fill=later";

/** Whether a worker's script address is ours (either form). */
export function isOfflineWorkerUrl(scriptURL: string | null | undefined): boolean {
  if (!scriptURL) return false;
  try {
    return new URL(scriptURL, "https://joulz.invalid").pathname === SW_URL;
  } catch {
    return false;
  }
}

/**
 * The address to register: an existing worker's own (never switched: a device with the download keeps it, and
 * one without gets it through FILL), else the full worker when it may download now, else the deferred one.
 */
export function registrationUrl(existingScriptURL: string | null | undefined, fillNow: boolean): string {
  if (isOfflineWorkerUrl(existingScriptURL)) {
    const url = new URL(existingScriptURL!, "https://joulz.invalid");
    return `${url.pathname}${url.search}`;
  }
  return fillNow ? SW_URL : SW_LATER_URL;
}
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
export function installOfflineWorker(fillNow: () => boolean = () => true): () => void {
  const api = workerApi();
  if (!api || !import.meta.env.PROD) return () => {};
  let stopped = false;
  let reloadWanted = false;
  // A controller change whose worker hasn't told us its build yet (it can be slow to answer while it activates):
  // asked again on each handover tick until it answers, so the page still reloads onto a newer build.
  let versionUnknown = false;
  void (async () => {
    const existing = await api.getRegistration().catch(() => undefined);
    const script = (existing?.active ?? existing?.waiting ?? existing?.installing)?.scriptURL;
    await api.register(registrationUrl(script, fillNow()), { scope: "/", updateViaCache: "none" });
  })().catch(() => {
    /* no worker: the app works online as before */
  });
  const askVersion = async () => {
    const version = await workerVersion(api.controller);
    versionUnknown = version === null && !!api.controller;
    if (version && version !== APP_BUILD_ID) reloadWanted = true;
  };
  const onControllerChange = () => void askVersion();
  api.addEventListener("controllerchange", onControllerChange);
  const tick = async () => {
    if (stopped) return;
    try {
      const reg = await api.getRegistration();
      if (reg?.waiting && safeNow()) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      if (versionUnknown) await askVersion();
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
  await Promise.all(regs.filter((r) => !isOfflineWorkerUrl((r.active ?? r.waiting ?? r.installing)?.scriptURL)).map((r) => r.unregister()));
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

/**
 * Asks the worker in control for this build's download (only what changed; nothing when it already has it).
 * Resolves true when everything is stored, false when something failed (asked again next time), null with no
 * worker in control or no answer within `timeoutMs`.
 *
 * Never while a newer build's worker is installing or waiting (resolves null; the next sync asks the worker that
 * took over): the old worker would download its own, outgoing build over the new one's record, and while its FILL
 * runs (an extended message event) Chromium holds the waiting worker's activation, so a handover asked for at
 * the same safe moment (the first finished round's sync on the Practice list) waited out the whole download
 * (offline-check, "the new worker takes over on the list", about one run in two; 9 Nov 2026).
 */
export async function requestWorkerFill(timeoutMs = 120_000): Promise<boolean | null> {
  const api = workerApi();
  if (!api?.controller) return null;
  const reg = await api.getRegistration().catch(() => undefined);
  if (reg?.installing || reg?.waiting) return null;
  const worker = api.controller;
  if (!worker) return null;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data?.type === "FILLED" ? event.data.complete === true : null);
    };
    try {
      worker.postMessage({ type: "FILL" }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}
