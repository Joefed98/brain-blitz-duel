/**
 * The push work the Worker's Cron Triggers run (wave 2 B2; docs/push-notifications.md). Plain functions, so a check can
 * run them without the Worker; the nitro task files beside this one call them.
 *
 *  - every 5 minutes: B1's friend events not yet sent (the request's own dispatch normally sends them at once);
 *  - every hour at :41: the Daily streak reminder, which acts only from 19:00 to 20:59 UK time.
 *
 * Both do nothing while the push keys aren't set. The analytics writes are waited for before the task ends (a scheduled
 * run has no request to carry them).
 */
import { adminDb } from "@/lib/data/db.server";
import { flushAnalytics } from "@/lib/data/events.server";

import { dispatchFriendEvents } from "../notify.server";
import { runDailyStreakReminders } from "../streakReminder.server";

/** The Cron Triggers' schedules (UTC), as nitro writes them into wrangler.json (vite.config.ts). */
export const PUSH_CRONS = {
  friendSweep: "*/5 * * * *",
  dailyReminder: "41 * * * *",
} as const;

export async function runFriendSweepTask(): Promise<{ result: unknown }> {
  const result = await dispatchFriendEvents(await adminDb());
  await flushAnalytics();
  return { result };
}

export async function runDailyReminderTask(): Promise<{ result: unknown }> {
  const result = await runDailyStreakReminders(await adminDb());
  await flushAnalytics();
  if (result.inWindow) console.log(`[push] daily reminder ${result.day}: ${JSON.stringify(result.outcomes)}`);
  return { result };
}
