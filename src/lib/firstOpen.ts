/**
 * The first-open onboarding's rules (wave 1, first impressions, 10 Nov 2026; docs/mockups/wave-1/O1–O3;
 * the screens are src/components/app/FirstOpen.tsx). Presentation and device storage only.
 *
 * - Off until wave 3 (`FIRST_OPEN_ONBOARDING` in src/config/betaConfig.ts): the screens describe the rated
 *   match, which doesn't exist yet. Off, nothing here reads or writes anything and nothing is loaded.
 * - On: shown once, on a phone's very first open, and only when that open lands on a tab page (Play,
 *   Practice, Tournaments, Profile) with no shared link (`?ref=`). A first open through a room, challenge or
 *   daily link is never held up: that phone is marked as having had its first open and never sees it.
 * - A phone that opened the app before the switch went on (it has the first-time intro's flag,
 *   src/lib/onboarding.ts, set on its first visit) has had its first open too: it never sees it.
 * - Remembered on the phone after Skip or finishing; never asks for an account or any personal detail.
 *   If storage is blocked, it falls back to the session, then to memory: at most once a session.
 *
 * A check can switch it on for its own page with `window.__DUELZ_FIRST_OPEN__ = true` (set before the app
 * loads); the app never sets it. first-impressions-check proves the rules.
 */
import { FIRST_OPEN_ONBOARDING } from "@/config/betaConfig";
import { onboardingSeen } from "@/lib/onboarding";

export const FIRST_OPEN_KEY = "duelz-first-open:v1";

/** The tab pages a first open can land on to see it. */
const TAB_PATHS = new Set(["/", "/practice", "/tournaments", "/profile"]);

let seenInMemory = false;

/** Is the onboarding switched on (the config, or a check's own page)? */
export function firstOpenOn(): boolean {
  if (typeof window !== "undefined") {
    const override = (window as unknown as { __DUELZ_FIRST_OPEN__?: unknown }).__DUELZ_FIRST_OPEN__;
    if (typeof override === "boolean") return override;
  }
  return FIRST_OPEN_ONBOARDING;
}

function read(storage: () => Storage): boolean {
  try {
    return storage().getItem(FIRST_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function write(storage: () => Storage): boolean {
  try {
    storage().setItem(FIRST_OPEN_KEY, "1");
    return storage().getItem(FIRST_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Has this phone (or, with storage blocked, this session) had its first open? */
export function firstOpenSeen(): boolean {
  if (typeof window === "undefined") return true;
  return seenInMemory || read(() => window.localStorage) || read(() => window.sessionStorage);
}

/** Never show it again on this phone (or this session, if storage fails). */
export function markFirstOpenSeen(): void {
  seenInMemory = true;
  if (typeof window === "undefined") return;
  if (!write(() => window.localStorage)) write(() => window.sessionStorage);
}

/**
 * Decides, once, on the app's first render in the browser (before any page marks the first-time intro
 * seen), whether this open shows the onboarding. Off: false, with nothing read or written. A first open
 * that can't show it (a link) is marked seen here.
 */
export function decideFirstOpen(location: { pathname: string; search: string }): boolean {
  if (typeof window === "undefined" || !firstOpenOn()) return false;
  if (firstOpenSeen()) return false;
  if (onboardingSeen()) {
    // Opened before the switch went on: not a first open.
    markFirstOpenSeen();
    return false;
  }
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const linked = new URLSearchParams(location.search).has("ref");
  if (!TAB_PATHS.has(path) || linked) {
    markFirstOpenSeen();
    return false;
  }
  return true;
}
