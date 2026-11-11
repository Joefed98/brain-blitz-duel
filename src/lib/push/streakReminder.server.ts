/**
 * The Daily streak reminder (wave 2 B2; docs/push-notifications.md), run by the Worker's hourly Cron Trigger
 * (src/lib/push/tasks/). Its own module because it reads train C's Daily streak (dailyStreak.server.ts, the Daily's
 * history): notify.server.ts, which B1's friend calls load, stays clear of the Daily and ranking code. Server only.
 */

import type { Db } from "@/lib/data/db.server";
import { readStreakCandidates } from "@/lib/data/push.server";
import { ukDayKey } from "@/lib/duel/daily";
import { dailyStreakFor } from "@/lib/duel/dailyStreak.server";

import { notify, type NotifyOptions, type NotifyOutcome } from "./notify.server";
import { inQuietHours, localHour, safeTimeZone, STREAK_REMINDER_UK_HOURS } from "./rules";
import { vapidKeys } from "./webPush.server";

function warn(message: string): void {
  console.warn(`[push] ${message}`);
}

export interface ReminderRun {
  day: string;
  /** False outside the evening window (nothing looked at). */
  inWindow: boolean;
  candidates: number;
  outcomes: Partial<Record<NotifyOutcome, number>>;
}

/**
 * The Daily streak reminder for today (UK): run by the Worker's Cron Trigger every hour (the push task in
 * src/lib/push/tasks/), so it acts only inside STREAK_REMINDER_UK_HOURS (19:00–20:59 UK, GMT or BST). Once per player per
 * UK day (the log's key). push_streak_candidates narrows to accounts with a device and the reminder on who started a
 * Daily in the last 60 days and none today; then train C's own streak (dailyStreakFor, the account's Daily history
 * with streak freezes) decides: only a live streak (1 or more) with today's Daily not played is reminded. Quiet hours
 * on the player's own clock.
 */
export async function runDailyStreakReminders(
  client: Db,
  opts: NotifyOptions & { limit?: number; streakOf?: typeof dailyStreakFor } = {},
): Promise<ReminderRun> {
  const nowMs = opts.nowMs ?? Date.now();
  const day = ukDayKey(nowMs);
  const run: ReminderRun = { day, inWindow: false, candidates: 0, outcomes: {} };
  if (!STREAK_REMINDER_UK_HOURS.includes(localHour(nowMs, "Europe/London"))) return run;
  run.inWindow = true;
  const keys = opts.keys === undefined ? vapidKeys() : opts.keys;
  if (!keys) {
    run.outcomes.disabled = 1;
    return run;
  }
  const list = await readStreakCandidates(client, day);
  if (list.error) {
    warn(`daily_streak: candidates: ${list.error.message}`);
    run.outcomes.failed = 1;
    return run;
  }
  const people = list.data.slice(0, opts.limit ?? 5000);
  run.candidates = people.length;
  const streakOf = opts.streakOf ?? dailyStreakFor;
  for (const person of people) {
    let outcome: NotifyOutcome;
    if (inQuietHours(nowMs, safeTimeZone(person.time_zone))) outcome = "quiet";
    else {
      let facts: { streak: number; playedToday: boolean } | null = null;
      try {
        facts = await streakOf(client, person.user_id, nowMs);
      } catch (err) {
        warn(`daily_streak: streak: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (!facts) outcome = "failed";
      else if (facts.playedToday || facts.streak < 1) outcome = "off";
      else
        outcome = await notify(client, person.user_id, "daily_streak", { streak: facts.streak }, { ...opts, keys, nowMs, dedupeKey: `daily_streak:${day}` });
    }
    run.outcomes[outcome] = (run.outcomes[outcome] ?? 0) + 1;
  }
  return run;
}

