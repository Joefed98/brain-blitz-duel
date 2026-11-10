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
/** How long a waiting worker may stay waiting after the page asked it to take over before the page reloads. */
const HANDOVER_STALL_MS = 4000;
/** sessionStorage: the builds this tab has already reloaded for (one reload per build, never a loop). */
const STALL_RELOAD_KEY = "joulz-sw-stall-reload";

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

/**
 * Tells a waiting worker to take over, with the outgoing worker awake first. Chromium asks the outgoing worker
 * to stop as soon as it is idle only when it is running at the moment skipWaiting() is handled (the registration's
 * ActivateWaitingVersionWhenReady: TriggerIdleTerminationAsap for a running active version), and only on the
 * first skipWaiting() (later calls join the pending one). An outgoing worker that had idled out during a round
 * and was being started again by the page's own requests just then (a sound, a chunk, a message on the list)
 * kept its ordinary 30 s idle delay, so anything the page sent it held the takeover off, often for well over
 * 30 s, and the app's reload onto the new build came long after the list opened (offline-check, "the new worker
 * takes over on the list", 9 Nov 2026). Waiting for the controller to answer VERSION means it is running when
 * SKIP_WAITING lands; with no controller there is nothing to wake.
 */
async function askToTakeOver(api: ServiceWorkerContainer, waiting: ServiceWorker): Promise<void> {
  if (api.controller && api.controller !== waiting) await workerVersion(api.controller);
  waiting.postMessage({ type: "SKIP_WAITING" });
}

/**
 * Reloads the page once for a waiting worker whose takeover stalled (see `installOfflineWorker`), the first time
 * for its build in this tab. False when this tab has already reloaded for it: the outgoing worker then stops on its
 * own idle timeout and the handover completes then.
 */
async function reloadForStalledHandover(waiting: ServiceWorker): Promise<boolean> {
  const build = (await workerVersion(waiting)) ?? waiting.scriptURL;
  try {
    const done = (window.sessionStorage.getItem(STALL_RELOAD_KEY) ?? "").split(" ");
    if (done.includes(build)) return false;
    window.sessionStorage.setItem(STALL_RELOAD_KEY, [...done.slice(-3), build].join(" ").trim());
  } catch {
    // No storage, so a reload couldn't be remembered: don't risk a loop.
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * Registers the worker and keeps watch for a new build's waiting worker. Production only.
 *
 * At the first safe moment a waiting worker is asked once to take over (`askToTakeOver`). Chromium then stops the
 * outgoing worker as soon as it is idle, and activates the new one once it has stopped. That fast stop is asked for
 * once only. If a request from the page reaches the outgoing worker in the instant it is stopping (the Practice list
 * loading its tiles and sounds just after a round), Chromium starts it again to answer, and the restarted worker is
 * back on its ordinary 30 s idle timeout. The handover then waited until the page had been quiet for 30 s. The
 * page's own 2 s pings, which asked again on every tick, kept it awake, so the new build never took over while the
 * page stayed open (offline-check, "the new worker takes over on the list", about one run in thirty on 9–10 Nov 2026;
 * the DevTools protocol shows the outgoing worker stopped, then starting again in the same millisecond).
 * So the page asks once per waiting worker, and when that worker is still waiting `HANDOVER_STALL_MS` later at a safe
 * moment it reloads, once per build in this tab: a navigation makes Chromium ask for the fast stop again, and the
 * reloaded page comes up on the new worker. A takeover ends in a reload onto the new build at this same safe moment
 * anyway (`reloadWanted`), so nothing reloads that wouldn't have.
 */
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
  // The waiting worker this page has asked to take over, and when.
  let asked: ServiceWorker | null = null;
  let askedAt = 0;
  const tick = async () => {
    if (stopped) return;
    try {
      const reg = await api.getRegistration();
      if (reg?.waiting && safeNow()) {
        if (asked !== reg.waiting) {
          asked = reg.waiting;
          askedAt = Date.now();
          await askToTakeOver(api, reg.waiting);
        } else if (Date.now() - askedAt >= HANDOVER_STALL_MS && (await reloadForStalledHandover(reg.waiting))) {
          return;
        }
      }
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
  await askToTakeOver(api, waiting);
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
