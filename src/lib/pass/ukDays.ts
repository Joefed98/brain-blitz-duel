/**
 * UK calendar days for the pass (wave 2, session D2): Joules' day limits, the soft cap and the weekly challenges all
 * turn at midnight in London. Kept here so the pass imports nothing from the Daily's board or ranking code.
 */
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The UK date ("2026-11-16") an instant falls on. */
export function ukDay(ms: number): string {
  return dayKeyFormat.format(new Date(ms));
}

/** The calendar day `by` days after (or before) a day. */
export function shiftDay(day: string, by: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + by)).toISOString().slice(0, 10);
}

/** A UK day's midnight (UTC ms): the UTC midnight, an hour earlier in British Summer Time. */
export function ukMidnight(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const utc = Date.UTC(y, m - 1, d);
  return ukDay(utc - 3_600_000) === day ? utc - 3_600_000 : utc;
}
