/**
 * Age rules (10 Nov 2026, accounts), shared by the phone and the server; the server decides. The full date of birth
 * is stored on the profile (never for an under-13, who gets no account) and the age is worked out when needed, on the
 * UK calendar day, so it rises on the birthday itself (a 29 February birthday counts from 1 March in other years).
 */

/** Under this age no account is created and no date of birth is stored. */
export const MIN_ACCOUNT_AGE = 13;
/** From this age the under-18 rules (chat with strangers, purchases) no longer apply. */
export const ADULT_AGE = 18;

/** Today's date in the UK, as YYYY-MM-DD. */
export function ukToday(nowMs: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** A date of birth as YYYY-MM-DD when it is a real calendar date from 1900 up to today (UK), else null. */
export function parseDateOfBirth(raw: unknown, nowMs: number): string | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  if (y < 1900 || iso > ukToday(nowMs)) return null;
  return iso;
}

/** Whole years from a date of birth to a UK day (both YYYY-MM-DD). */
export function ageOn(dateOfBirth: string, todayIso: string): number {
  const years = Number(todayIso.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  return todayIso.slice(5) >= dateOfBirth.slice(5) ? years : years - 1;
}

export type AgeBand = "under13" | "teen" | "adult";

/** Under 13 (no account), 13–17 (the under-18 rules) or 18 and over. */
export function ageBand(dateOfBirth: string, nowMs: number): AgeBand {
  const age = ageOn(dateOfBirth, ukToday(nowMs));
  if (age < MIN_ACCOUNT_AGE) return "under13";
  return age < ADULT_AGE ? "teen" : "adult";
}

/** True while the player is under 18; false from their 18th birthday on. */
export function isUnder18(dateOfBirth: string, nowMs: number): boolean {
  return ageOn(dateOfBirth, ukToday(nowMs)) < ADULT_AGE;
}

/** The refusal the screens show to an under-13 (kindly; nothing was stored). */
export const UNDER_13_MESSAGE = "You need to be 13 or over to make an account. You can keep playing as a guest.";
