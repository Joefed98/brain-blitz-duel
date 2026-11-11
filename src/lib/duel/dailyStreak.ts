/**
 * The Daily streak on the account (wave 2, train C, session C2; Joe's decision, 10 Nov 2026). The server works it out
 * from the Daily starts it already stores (public.daily_history) with the rule dailyRecord.ts kept on the phone, so it
 * reads the same on every device:
 *
 *   - a UK day counts once a Daily (either kind) was started that day;
 *   - the streak is the run of consecutive counted UK days ending today, or yesterday while today is still open to
 *     play (so it survives until the day after a missed one ends).
 *
 * Streak freezes (A1's consumables; nobody has any until the pass and Plus): a missed UK day that has closed is
 * covered by one freeze, used automatically, when it sits between counted days of a streak (or between the streak and
 * today's open day) and the account has enough freezes for every missed day of that gap; a covered day keeps the
 * streak alive but doesn't add to it. A gap longer than the freezes held breaks the streak and uses none. Each use is
 * recorded (public.daily_streak_freezes, the consumable ledger), once per day.
 *
 * Pure (no storage, no clock): the phone's device record (dailyRecord.ts) and the server share it.
 */
import { shiftDayKey } from "./daily";

export interface StreakInput {
  /** UK day keys with a Daily started (either kind). */
  played: readonly string[];
  /** UK day keys a freeze already covered. */
  frozen: readonly string[];
  /** Today's UK day key. */
  today: string;
  /** Freezes the account holds now (0 for guests). */
  freezes: number;
}

export interface StreakAnswer {
  streak: number;
  /** Closed, missed days a freeze should cover now (oldest first); empty without freezes. */
  freezeDays: string[];
  playedToday: boolean;
}

/** The streak and which missed days to cover with the freezes held. With no freezes, exactly dailyRecord's dailyStreak. */
export function dailyStreakWithFreezes(input: StreakInput): StreakAnswer {
  const played = new Set(input.played);
  const frozen = new Set(input.frozen);
  const playedToday = played.has(input.today);
  const earliest = [...played].sort()[0];
  let left = Math.max(0, Math.floor(input.freezes));
  const freezeDays: string[] = [];
  let streak = 0;
  let day = playedToday ? input.today : shiftDayKey(input.today, -1);
  if (earliest === undefined) return { streak: 0, freezeDays, playedToday };
  while (day >= earliest) {
    if (played.has(day)) {
      streak++;
      day = shiftDayKey(day, -1);
      continue;
    }
    if (frozen.has(day)) {
      day = shiftDayKey(day, -1);
      continue;
    }
    // A missed, closed day: cover the whole gap back to the next counted (or covered) day, or stop.
    const gap: string[] = [];
    let back = day;
    while (back >= earliest && !played.has(back) && !frozen.has(back)) {
      gap.push(back);
      back = shiftDayKey(back, -1);
    }
    if (back < earliest || gap.length > left) break;
    // Only worth a freeze when it saves a streak: there must be a counted day behind the gap.
    left -= gap.length;
    freezeDays.push(...gap);
    day = back;
  }
  return { streak, freezeDays: freezeDays.sort(), playedToday };
}

/**
 * The longest run of consecutive counted UK days ever (the streak badges: "play the Daily 7 days in a row"). A day a
 * freeze covered keeps a run going without adding to it, exactly as in the current streak.
 */
export function longestDailyStreak(played: readonly string[], frozen: readonly string[] = []): number {
  const counted = new Set(played);
  const covered = new Set(frozen);
  let best = 0;
  for (const start of new Set([...counted, ...covered])) {
    // Only count from a run's first day (counted or covered): the day before is neither.
    const before = shiftDayKey(start, -1);
    if (counted.has(before) || covered.has(before)) continue;
    let run = 0;
    let day = start;
    while (counted.has(day) || covered.has(day)) {
      if (counted.has(day)) run++;
      day = shiftDayKey(day, 1);
    }
    best = Math.max(best, run);
  }
  return best;
}

/** Best finished totals per kind from the server's Daily history (dailyRecord's `best`). */
export function dailyBests(rows: readonly { kind: string; finished: boolean; total: number }[]): Partial<Record<"puzzle" | "arcade", number>> {
  const best: Partial<Record<"puzzle" | "arcade", number>> = {};
  for (const r of rows) {
    if (!r.finished) continue;
    const kind = r.kind === "daily_puzzle" ? "puzzle" : r.kind === "daily_arcade" ? "arcade" : null;
    if (!kind) continue;
    best[kind] = Math.max(best[kind] ?? 0, r.total);
  }
  return best;
}
