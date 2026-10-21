/**
 * This device's own daily record (21 Oct 2026, device storage only, like deviceHistory.ts): the UK
 * days it played a daily on and its finished totals, for Profile's Daily row. The streak is the
 * run of consecutive UK days with a daily played (started), ending today or yesterday (so it
 * survives until the day after a missed one ends). Bests are finished totals only. Nothing here
 * is sent anywhere or read by any score.
 */
import { shiftDayKey, type DailyKind } from "./daily";

export const DAILY_RECORD_KEY = "duelz.dailyRecord.v1";

export interface DailyRecord {
  /** UK day keys a daily was played on (either kind). */
  days: string[];
  /** Best finished totals per daily. */
  best: Partial<Record<DailyKind, number>>;
  /** Finished totals by day and kind (the latest only). */
  totals: Record<string, Partial<Record<DailyKind, number>>>;
}

const EMPTY: DailyRecord = { days: [], best: {}, totals: {} };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readDailyRecord(store: Pick<Storage, "getItem"> | null = storage()): DailyRecord {
  try {
    const raw = store?.getItem(DAILY_RECORD_KEY);
    if (!raw) return { ...EMPTY, days: [], best: {}, totals: {} };
    const parsed = JSON.parse(raw) as Partial<DailyRecord>;
    return {
      days: Array.isArray(parsed.days) ? parsed.days.filter((d) => typeof d === "string") : [],
      best: parsed.best && typeof parsed.best === "object" ? parsed.best : {},
      totals: parsed.totals && typeof parsed.totals === "object" ? parsed.totals : {},
    };
  } catch {
    return { days: [], best: {}, totals: {} };
  }
}

function write(record: DailyRecord, store: Pick<Storage, "setItem"> | null = storage()) {
  try {
    // A year of days is plenty for a streak.
    const days = [...new Set(record.days)].sort().slice(-366);
    const keep = new Set(days);
    const totals = Object.fromEntries(
      Object.entries(record.totals).filter(([day]) => keep.has(day)),
    );
    store?.setItem(DAILY_RECORD_KEY, JSON.stringify({ ...record, days, totals }));
  } catch {
    /* storage full or blocked: the record is a convenience */
  }
}

/** A daily was started (or continued) on this UK day. */
export function noteDailyPlayed(
  day: string,
  store?: Pick<Storage, "getItem" | "setItem"> | null,
): void {
  const record = readDailyRecord(store === undefined ? storage() : store);
  if (record.days.includes(day)) return;
  write({ ...record, days: [...record.days, day] }, store === undefined ? storage() : store);
}

/** A daily was finished with this total. */
export function noteDailyFinished(
  day: string,
  kind: DailyKind,
  total: number,
  store?: Pick<Storage, "getItem" | "setItem"> | null,
): void {
  const s = store === undefined ? storage() : store;
  const record = readDailyRecord(s);
  const best = Math.max(record.best[kind] ?? 0, total);
  write(
    {
      days: record.days.includes(day) ? record.days : [...record.days, day],
      best: { ...record.best, [kind]: best },
      totals: { ...record.totals, [day]: { ...record.totals[day], [kind]: total } },
    },
    s,
  );
}

/** Consecutive UK days played, ending today (or yesterday, while today is still open to play). */
export function dailyStreak(days: readonly string[], today: string): number {
  const played = new Set(days);
  let day = played.has(today) ? today : shiftDayKey(today, -1);
  let streak = 0;
  while (played.has(day)) {
    streak++;
    day = shiftDayKey(day, -1);
  }
  return streak;
}
