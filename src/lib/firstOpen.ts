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
import { checkOverride } from "@/lib/checkOverride";

export const FIRST_OPEN_KEY = "duelz-first-open:v1";

/** The tab pages a first open can land on to see it. */
const TAB_PATHS = new Set(["/", "/practice", "/tournaments", "/profile", "/more"]);

let seenInMemory = false;

/** Is the onboarding switched on (the config, or a check's own page)? */
export function firstOpenOn(): boolean {
  const override = checkOverride("__DUELZ_FIRST_OPEN__");
  if (typeof override === "boolean") return override;
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

/* ------------------------------------------------------------------ the first game (P2, 22 Nov 2026) */
/*
 * The polish plan's section 3.4 (Joe's decision 4, 20 Nov 2026): a new phone opens straight into its first game,
 * Ascend on Easy, with one coach line over the board; then a win screen, then Home. Behind FIRST_GAME_ON_OPEN
 * (src/config/betaConfig.ts), off until Joe has played it; it takes the place of the three-screen onboarding above
 * (FIRST_OPEN_ONBOARDING, off) once it is on. Rules:
 *
 * - only on a device with no play history (no first-time intro flag, onboarding.ts, and no practice played) that opens
 *   the app online on a tab page with no link: never a room, Daily, challenge, `?game=`, `?page=` or `?ref=` link
 *   (those go where they point, and that device has had its first open);
 * - never under automation (`navigator.webdriver`), unless a check's page sets `window.__DUELZ_FIRST_GAME__ = true`;
 * - no terms, name or account on this path (practice needs none);
 * - decided once, remembered on the device (`duelz-first-game:v1`).
 */
import { FIRST_GAME_ON_OPEN } from "@/config/betaConfig";
import { recentPracticeTypes } from "@/lib/duel/practiceRecent";

export const FIRST_GAME_KEY = "duelz-first-game:v1";
/** The first game and its level (Joe's pick of three, 20 Nov 2026). */
export const FIRST_GAME = { type: "numhunt", level: "easy" } as const;
/** The coach line drawn over the board for the first game. */
export const FIRST_GAME_COACH = "Tap the numbers from lowest to highest, as fast as you can.";

let firstGameInMemory = false;

/** Is the first game switched on (the config, or a check's own page)? */
export function firstGameOn(): boolean {
  const override = checkOverride("__DUELZ_FIRST_GAME__");
  if (typeof override === "boolean") return override;
  return FIRST_GAME_ON_OPEN;
}

function readKey(storage: () => Storage): boolean {
  try {
    return storage().getItem(FIRST_GAME_KEY) === "1";
  } catch {
    return false;
  }
}

/** Has this device had its first open under the first-game rule? */
export function firstGameSeen(): boolean {
  if (typeof window === "undefined") return true;
  return firstGameInMemory || readKey(() => window.localStorage) || readKey(() => window.sessionStorage);
}

/** Never again on this device (or this session, if storage fails). */
export function markFirstGameSeen(): void {
  firstGameInMemory = true;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FIRST_GAME_KEY, "1");
  } catch {
    try {
      window.sessionStorage.setItem(FIRST_GAME_KEY, "1");
    } catch {
      /* memory only */
    }
  }
}

/**
 * Decides, once, on the app's first render in the browser, whether this open goes straight into the first game. Off:
 * false, nothing read or written. A first open that can't take it (a link, offline, history) is marked seen.
 */
export function decideFirstGame(location: { pathname: string; search: string }): boolean {
  if (typeof window === "undefined" || !firstGameOn()) return false;
  if (firstGameSeen()) return false;
  const override = checkOverride("__DUELZ_FIRST_GAME__");
  if (override !== true && typeof navigator !== "undefined" && navigator.webdriver) return false;
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(location.search);
  const linked = ["ref", "game", "page", "code", "room", "kind"].some((k) => params.has(k));
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  const history = onboardingSeen() || recentPracticeTypes().length > 0;
  markFirstGameSeen();
  return TAB_PATHS.has(path) && !linked && online && !history;
}
