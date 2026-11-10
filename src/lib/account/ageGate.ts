/**
 * The phone's memory of an under-13 refusal (10 Nov 2026, accounts): once the server refuses a date of birth as under
 * 13, the device remembers it for AGE_REFUSAL_HOLD_MS so a different date can't be tried straight away. Only the time
 * of the refusal is kept (never the date that was typed). The screens check `ageRefusalActive()` before showing the
 * date-of-birth step again. Device storage only; the server's own refusal stands whatever the phone holds.
 */

export const AGE_REFUSAL_KEY = "duelz-age-refused:v1";
/** How long a refusal holds on the device: 7 days. */
export const AGE_REFUSAL_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Remembers an under-13 refusal now. */
export function rememberAgeRefusal(nowMs: number = Date.now()): void {
  try {
    store()?.setItem(AGE_REFUSAL_KEY, JSON.stringify({ at: nowMs }));
  } catch {
    /* storage full or blocked: the server still refuses */
  }
}

/** When the device's refusal ends (ms since the epoch), or null when there is none in force. */
export function ageRefusalUntil(nowMs: number = Date.now()): number | null {
  try {
    const raw = store()?.getItem(AGE_REFUSAL_KEY);
    if (!raw) return null;
    const at = Number((JSON.parse(raw) as { at?: unknown }).at);
    if (!Number.isFinite(at) || at > nowMs + 60_000) return nowMs + AGE_REFUSAL_HOLD_MS;
    const until = at + AGE_REFUSAL_HOLD_MS;
    return until > nowMs ? until : null;
  } catch {
    return null;
  }
}

/** True while an under-13 refusal is in force on this device. */
export function ageRefusalActive(nowMs: number = Date.now()): boolean {
  return ageRefusalUntil(nowMs) !== null;
}
