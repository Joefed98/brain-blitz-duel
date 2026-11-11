/**
 * The fresh start on the device (wave 2 C1a, Joe's decision of 10 Nov 2026): practice stars and bests are the
 * account's now (progress.ts), so the device's old copies are cleared once, and never read or shown again, so a stale
 * star can't reappear. Cleared: every practice best this app ever kept (`duelz-practice-best:`, its v2 and v3
 * prefixes included) and the goals record (`duelz-practice-goals:v1`: the retired 120 / 160 / 190 stars and the
 * challenge ticks; the challenge code, which C1b replaces, starts its ticks again from zero). Once per device:
 * `duelz-practice-fresh:v1` marks it done. Device storage only; nothing on the server is touched.
 */

export const DEVICE_FRESH_START_KEY = "duelz-practice-fresh:v1";
/** Every key prefix the device kept practice bests under (practiceBest.ts and its retired prefixes). */
export const CLEARED_PRACTICE_BEST_PREFIX = "duelz-practice-best:";
/** The device's goals record (practiceGoals.ts PRACTICE_GOALS_KEY). */
export const CLEARED_PRACTICE_GOALS_KEY = "duelz-practice-goals:v1";

let doneThisVisit = false;

/** Clears the device's practice progress once (true when this call cleared it). Never throws. */
export function clearDeviceProgressOnce(): boolean {
  if (doneThisVisit) return false;
  doneThisVisit = true;
  try {
    const store = window.localStorage;
    if (store.getItem(DEVICE_FRESH_START_KEY)) return false;
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && (key.startsWith(CLEARED_PRACTICE_BEST_PREFIX) || key === CLEARED_PRACTICE_GOALS_KEY)) doomed.push(key);
    }
    for (const key of doomed) store.removeItem(key);
    store.setItem(DEVICE_FRESH_START_KEY, new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}

/** Checks only: forget this visit's run. */
export function resetDeviceFreshStartForChecks(): void {
  doneThisVisit = false;
}
