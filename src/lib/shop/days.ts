/**
 * Shop calendar days (wave 2, session D1). The shop turns over at midnight UK time: a shop day is the UK calendar
 * date (YYYY-MM-DD, `ukToday`), and the week's bundle changes on the Monday of that calendar. Calendar arithmetic is
 * done on the date itself (UTC noon), so a day is always 24 hours of the calendar whatever the clocks do.
 */
import { ukToday } from "@/lib/account/age";

export type ShopDate = string;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isShopDate(value: unknown): value is ShopDate {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Today's shop day (the UK date). */
export function shopToday(nowMs: number): ShopDate {
  return ukToday(nowMs);
}

export function addDays(day: ShopDate, n: number): ShopDate {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b − a). */
export function daysBetween(a: ShopDate, b: ShopDate): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/** 0 Monday … 6 Sunday. */
export function weekdayOf(day: ShopDate): number {
  return (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** The Monday of the day's week (the day the bundle, like the weekly challenges, changes). */
export function mondayOf(day: ShopDate): ShopDate {
  return addDays(day, -weekdayOf(day));
}

/** A small stable hash (FNV-1a, 32 bit) for the seeded choices: the same answer on every server. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
