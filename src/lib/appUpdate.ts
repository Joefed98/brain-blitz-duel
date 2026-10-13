/**
 * Stale-version updates. The phone asks the server which build it runs (on open,
 * on return to the foreground, every few minutes while visible, and as a room
 * reaches a between-round screen) and, when its own build differs, reloads itself
 * onto the new one, but only where a reload is safe:
 *
 * - "now": no round anywhere on screen (home, practice list, a room link that is
 *   not ours): reload straight away.
 * - "between": a room's lobby, results, standings or final screen: show
 *   "Updating…" briefly, then reload; the room page reloads onto the same room
 *   at the point the server holds.
 * - "hold": a round is in play (or about to start, or still loading): wait.
 *
 * An answer still on its way to the server holds the reload too, so a round is
 * only ever left after its answer is in and the round has closed. Presentation
 * only: nothing here touches grading, scoring or what a round contains.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";

import { APP_BUILD_ID, isStaleVersion, reloadUrl, withoutVersionParam } from "./appVersion";
import type { DuelPhase, DuelRow } from "./duel/types";

export type UpdateGate = "now" | "between" | "hold";
export type UpdateStatus = "current" | "stale" | "updating";

/** How long "Updating…" shows before a between-round reload. */
export const UPDATING_MS = 1200;
/** Checks closer together than this are skipped unless forced. */
export const MIN_CHECK_GAP_MS = 15_000;
/** While visible, the app re-checks this often. */
export const PERIODIC_CHECK_MS = 5 * 60_000;
/** A reload that landed on the same old build is not retried for this long (no loops). */
export const RETRY_SAME_TARGET_MS = 2 * 60_000;

const ATTEMPT_KEY = "duelz_update_attempt";

export interface UpdaterDeps {
  clientVersion: string;
  fetchServerVersion: () => Promise<string | null>;
  /** The hard reload: a fresh document request for this address. */
  navigate: (url: string) => void;
  href: () => string;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (id: unknown) => void;
  /** sessionStorage: remembers the last reload attempt across the reload. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  /** Drops any service worker and Cache Storage before reloading. */
  clearCaches?: () => Promise<void>;
}

export interface Updater {
  check: (opts?: { force?: boolean }) => Promise<void>;
  /** Claims the gate for one screen; the newest claim wins until released. */
  claimGate: (gate: UpdateGate) => { set: (gate: UpdateGate) => void; release: () => void };
  trackSubmission: <T>(work: Promise<T>) => Promise<T>;
  status: () => UpdateStatus;
  serverVersion: () => string | null;
  gate: () => UpdateGate;
  subscribe: (listener: () => void) => () => void;
}

export function createUpdater(deps: UpdaterDeps): Updater {
  let status: UpdateStatus = "current";
  let target: string | null = null;
  let lastCheck = -Infinity;
  let checking: Promise<void> | null = null;
  let inFlight = 0;
  let timer: unknown = null;
  let reloading = false;
  let claimSeq = 0;
  const claims: { id: number; gate: UpdateGate }[] = [];
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());
  const setStatus = (next: UpdateStatus) => {
    if (status === next) return;
    status = next;
    emit();
  };
  const gate = (): UpdateGate => claims[claims.length - 1]?.gate ?? "now";

  const readAttempt = (): { to: string; at: number } | null => {
    try {
      const raw = deps.storage?.getItem(ATTEMPT_KEY);
      return raw ? (JSON.parse(raw) as { to: string; at: number }) : null;
    } catch {
      return null;
    }
  };
  const recentlyTried = (to: string) => {
    const last = readAttempt();
    return !!last && last.to === to && deps.now() - last.at < RETRY_SAME_TARGET_MS;
  };

  const cancelUpdating = () => {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
    if (status === "updating" && !reloading) setStatus("stale");
  };

  const safeNow = () => gate() !== "hold" && inFlight === 0;

  const reload = async () => {
    if (!target || reloading) return;
    reloading = true;
    setStatus("updating");
    try {
      deps.storage?.setItem(ATTEMPT_KEY, JSON.stringify({ to: target, at: deps.now() }));
    } catch {
      /* private mode: the reload still happens, only the loop guard is lost */
    }
    try {
      await deps.clearCaches?.();
    } catch {
      /* nothing cached to drop */
    }
    // A round may have opened while caches were cleared.
    if (!safeNow()) {
      reloading = false;
      setStatus("stale");
      return;
    }
    deps.navigate(reloadUrl(deps.href(), target));
  };

  const evaluate = () => {
    if (status === "current" || !target || reloading) return;
    if (!safeNow()) {
      cancelUpdating();
      return;
    }
    if (recentlyTried(target)) return;
    if (gate() === "now") {
      cancelUpdating();
      void reload();
      return;
    }
    if (timer !== null) return;
    setStatus("updating");
    timer = deps.setTimer(() => {
      timer = null;
      if (safeNow()) void reload();
      else setStatus("stale");
    }, UPDATING_MS);
  };

  const check = (opts: { force?: boolean } = {}): Promise<void> => {
    if (checking) return checking;
    if (!opts.force && deps.now() - lastCheck < MIN_CHECK_GAP_MS) return Promise.resolve();
    lastCheck = deps.now();
    checking = (async () => {
      try {
        const server = await deps.fetchServerVersion();
        if (isStaleVersion(deps.clientVersion, server)) {
          target = server;
          if (status === "current") setStatus("stale");
          evaluate();
        } else if (server) {
          target = null;
          cancelUpdating();
          setStatus("current");
        }
      } catch {
        /* offline or the server is busy: the next trigger asks again */
      } finally {
        checking = null;
      }
    })();
    return checking;
  };

  const claimGate = (initial: UpdateGate) => {
    const claim = { id: ++claimSeq, gate: initial };
    let previous = gate();
    claims.push(claim);
    const changed = () => {
      const now = gate();
      // Reaching a between-round screen is one of the moments to ask the server.
      if (now === "between" && previous !== "between") void check();
      previous = now;
      evaluate();
    };
    changed();
    return {
      set(next: UpdateGate) {
        if (claim.gate === next) return;
        claim.gate = next;
        changed();
      },
      release() {
        const i = claims.findIndex((c) => c.id === claim.id);
        if (i >= 0) claims.splice(i, 1);
        changed();
      },
    };
  };

  const trackSubmission = <T>(work: Promise<T>): Promise<T> => {
    inFlight += 1;
    cancelUpdating();
    const done = () => {
      inFlight -= 1;
      evaluate();
    };
    work.then(done, done);
    return work;
  };

  return {
    check,
    claimGate,
    trackSubmission,
    status: () => status,
    serverVersion: () => target,
    gate,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * When a room screen may reload. Lobby, results, standings and the final screen
 * are between rounds; everything from the countdown to the reveal, and the
 * shared-clock winner reveal, holds. A page not (yet) in the room is outside it.
 */
export function roomUpdateGate(room: {
  loading: boolean;
  notFound: boolean;
  member: boolean;
  status: DuelRow["status"] | undefined;
  phase: DuelPhase | undefined;
}): UpdateGate {
  if (room.loading) return "hold";
  if (room.notFound || !room.status) return "now";
  if (!room.member) return "now";
  if (room.status === "waiting" || room.status === "finished") return "between";
  if (room.status !== "in_progress") return "hold";
  return room.phase === "result" || room.phase === "standings" ? "between" : "hold";
}

/** Practice is outside any room: reload only on the list, never mid-run. */
export function practiceUpdateGate(stage: string): UpdateGate {
  return stage === "list" ? "now" : "hold";
}

/* -------------------------------------------------------------------------- */
/*  The app's one updater                                                       */
/* -------------------------------------------------------------------------- */

let shared: Updater | null = null;

async function clearBrowserCaches(): Promise<void> {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function appUpdater(): Updater | null {
  if (typeof window === "undefined") return null;
  shared ??= createUpdater({
    clientVersion: APP_BUILD_ID,
    fetchServerVersion: async () => {
      const { appVersionFn } = await import("./appVersion.functions");
      return (await appVersionFn()).version;
    },
    navigate: (url) => window.location.replace(url),
    href: () => window.location.href,
    now: () => Date.now(),
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (id) => window.clearTimeout(id as number),
    storage: sessionStore(),
    clearCaches: clearBrowserCaches,
  });
  return shared;
}

/** Wraps an answer submission so no reload starts while it is on its way. */
export function trackSubmission<T>(work: Promise<T>): Promise<T> {
  return appUpdater()?.trackSubmission(work) ?? work;
}

interface TriggerHost {
  doc: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">;
  win: Pick<Window, "addEventListener" | "removeEventListener">;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
}

/** Open, foreground, back-forward restore, reconnect and a slow periodic check. */
export function attachUpdateTriggers(updater: Updater, host: TriggerHost): () => void {
  const visible = () => host.doc.visibilityState !== "hidden";
  const onVisibility = () => {
    if (visible()) void updater.check({ force: true });
  };
  const onPageShow = (event: Event) => {
    if ((event as PageTransitionEvent).persisted) void updater.check({ force: true });
  };
  const onOnline = () => void updater.check();
  host.doc.addEventListener("visibilitychange", onVisibility);
  host.win.addEventListener("pageshow", onPageShow);
  host.win.addEventListener("online", onOnline);
  const id = host.setInterval(() => {
    if (visible()) void updater.check();
  }, PERIODIC_CHECK_MS);
  void updater.check({ force: true });
  return () => {
    host.doc.removeEventListener("visibilitychange", onVisibility);
    host.win.removeEventListener("pageshow", onPageShow);
    host.win.removeEventListener("online", onOnline);
    host.clearInterval(id);
  };
}

/**
 * Root-shell install: removes the reload marker from the address (through the
 * router so it stays in step) and starts the checks.
 */
export function installAppUpdater(replaceAddress: (path: string) => void): () => void {
  const updater = appUpdater();
  if (!updater) return () => {};
  const cleaned = withoutVersionParam(window.location.href);
  if (cleaned !== null) replaceAddress(cleaned);
  return attachUpdateTriggers(updater, {
    doc: document,
    win: window,
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (id) => window.clearInterval(id as number),
  });
}

/** A screen's say on when a reload may happen; released when the screen goes. */
export function useUpdateGate(gate: UpdateGate): void {
  const claim = useRef<ReturnType<Updater["claimGate"]> | null>(null);
  useEffect(() => {
    const updater = appUpdater();
    if (!updater) return;
    claim.current = updater.claimGate(gate);
    return () => {
      claim.current?.release();
      claim.current = null;
    };
    // The claim lives as long as the screen; changes go through set() below.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    claim.current?.set(gate);
  }, [gate]);
}

const noopSubscribe = () => () => {};

export function useAppUpdateStatus(): UpdateStatus {
  const updater = typeof window === "undefined" ? null : appUpdater();
  return useSyncExternalStore(
    updater ? updater.subscribe : noopSubscribe,
    () => updater?.status() ?? "current",
    () => "current",
  );
}
