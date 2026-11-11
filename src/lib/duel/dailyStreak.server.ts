/**
 * The Daily record on the account (wave 2, train C, session C2; Joe's decision, 10 Nov 2026): the streak, the days
 * played and the best totals, worked out by the server from the Daily starts it stores (public.daily_history), so it
 * shows the same on every device. The phone's own record (dailyRecord.ts) only fills in while this hasn't answered;
 * where they disagree the server wins. Guests get theirs the same way (their own auth user; a second device's guest
 * is a different user and stays separate).
 *
 * Streak freezes are used automatically for missed days (dailyStreak.ts has the rule); a guest holds none. The
 * evening reminder (B2) and the streak badges read `dailyRecordFor` / `dailyStreakFor`.
 */

import { readDailyHistory, readStreakFreezeDays, useStreakFreezeRpc } from "@/lib/data/badges.server";
import type { Db } from "@/lib/data/db.server";
import { readConsumables } from "@/lib/data/economy.server";
import type { DailyAccountRecord } from "@/lib/badges/types";

import { ukDayKey } from "./daily";
import { dailyBests, dailyStreakWithFreezes } from "./dailyStreak";

/** The player's Daily record now (using any freezes a missed day needs, once each). */
export async function dailyRecordFor(client: Db, userId: string, nowMs: number = Date.now()): Promise<DailyAccountRecord> {
  const today = ukDayKey(nowMs);
  const [history, frozenRead, consumables] = await Promise.all([
    readDailyHistory(client, userId),
    readStreakFreezeDays(client, userId),
    readConsumables(client, userId),
  ]);
  const err = history.error ?? frozenRead.error ?? consumables.error;
  if (err) throw new Error(`daily record: ${err.message}`);
  const played = [...new Set(history.data.map((r) => r.day))];
  const freezes = consumables.data.find((c) => c.kind === "streak_freeze")?.count ?? 0;
  let frozen = frozenRead.data;
  let answer = dailyStreakWithFreezes({ played, frozen, today, freezes });
  const freezesUsed: string[] = [];
  if (answer.freezeDays.length) {
    for (const day of answer.freezeDays) {
      const { data } = await useStreakFreezeRpc(client, userId, day);
      if (data?.status === "used" || data?.status === "duplicate") freezesUsed.push(day);
      else break;
    }
    frozen = [...frozen, ...freezesUsed];
    answer = dailyStreakWithFreezes({ played, frozen, today, freezes: 0 });
  }
  const totals: DailyAccountRecord["totals"] = {};
  for (const r of history.data) {
    if (!r.finished) continue;
    const kind = r.kind === "daily_puzzle" ? "puzzle" : r.kind === "daily_arcade" ? "arcade" : null;
    if (kind) totals[r.day] = { ...totals[r.day], [kind]: r.total };
  }
  return {
    today,
    days: played.sort().slice(-366),
    frozenDays: [...new Set(frozen)].sort(),
    best: dailyBests(history.data),
    totals,
    streak: answer.streak,
    playedToday: answer.playedToday,
    freezesUsed,
  };
}

/** The streak and whether today's Daily has been played (for B2's evening reminder and the streak badges). */
export async function dailyStreakFor(client: Db, userId: string, nowMs: number = Date.now()): Promise<{ streak: number; playedToday: boolean }> {
  const r = await dailyRecordFor(client, userId, nowMs);
  return { streak: r.streak, playedToday: r.playedToday };
}
