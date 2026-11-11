/**
 * The tournaments' Cron Trigger work (wave 4, W4b; docs/tournaments/README.md): every 5 minutes (at :02, :07, …),
 * store the coming day's events, move every open event on by the clock (start, call off and refund, finish and pay)
 * and send due reminders. Every read of an event also moves it on, so this is the safety net that pays an event
 * nobody looks at and sends reminders on time. A plain function, so a check can run it without the Worker.
 */
import { adminDb } from "@/lib/data/db.server";
import { flushAnalytics } from "@/lib/data/events.server";

/** The schedule (UTC), as nitro writes it into wrangler.json (vite.config.ts; tournaments-check compares them). */
export const TOURNAMENT_CRON = "2-59/5 * * * *";

export async function runTournamentsTickTask(): Promise<{ result: unknown }> {
  const { runTournamentTick } = await import("../tournaments.server");
  const result = await runTournamentTick(await adminDb(), Date.now());
  await flushAnalytics();
  if (result.advanced || result.reminded) console.log(`[tournaments] tick: ${JSON.stringify(result)}`);
  return { result };
}
