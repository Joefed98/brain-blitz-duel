/**
 * Membership months (wave 2 E2): month 0 starts when Plus starts, month n at the same day and time n calendar months
 * later (UTC), clamped to the month's last day (a 31 January start has its month 1 on 28 or 29 February). Each month's
 * perks are granted once, keyed by the month's index, however often the server is asked.
 */

/** The start of month `n` of a membership started at `startMs`. */
export function monthStartMs(startMs: number, n: number): number {
  const d = new Date(startMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const targetY = y + Math.floor(m / 12);
  const targetM = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  return Date.UTC(targetY, targetM, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
}

/** The membership months begun by `nowMs` (0 … the current one); none before the start. */
export function monthsBegun(startMs: number, nowMs: number): number[] {
  if (!(nowMs >= startMs)) return [];
  let n = 0;
  // A rough guess first, then the exact boundary (never more than 1,200 months).
  const guess = Math.max(0, Math.floor((nowMs - startMs) / (31 * 86_400_000)));
  n = guess;
  while (n < 1200 && monthStartMs(startMs, n + 1) <= nowMs) n++;
  while (n > 0 && monthStartMs(startMs, n) > nowMs) n--;
  return Array.from({ length: n + 1 }, (_, i) => i);
}
