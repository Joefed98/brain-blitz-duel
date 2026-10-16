/**
 * First-time intro (16 Oct 2026, presentation only): the three panels a brand-new
 * device sees once, on a plain visit to home. A device that arrives through a room
 * link (src/routes/duel.$code.tsx) is marked as having seen it, so it never shows later
 * either: those players learn by playing. "How it works" on home reopens it at any time.
 *
 * The flag lives in localStorage; if that fails (private browsing, blocked storage) it
 * falls back to sessionStorage, then to memory, so the intro shows at most once a session.
 * scripts/onboarding-check.ts proves it.
 */
export const ONBOARDING_KEY = "duelz_onboarding_seen";

let seenInMemory = false;

function read(storage: () => Storage): boolean {
  try {
    return storage().getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

function write(storage: () => Storage): boolean {
  try {
    storage().setItem(ONBOARDING_KEY, "1");
    return storage().getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

/** Has this device (or, when storage fails, this session) seen the intro? */
export function onboardingSeen(): boolean {
  if (typeof window === "undefined") return true;
  return seenInMemory || read(() => window.localStorage) || read(() => window.sessionStorage);
}

/** Never show the intro again on this device (or this session, if storage fails). */
export function markOnboardingSeen(): void {
  seenInMemory = true;
  if (typeof window === "undefined") return;
  if (!write(() => window.localStorage)) write(() => window.sessionStorage);
}
