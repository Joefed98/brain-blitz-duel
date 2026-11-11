/**
 * The Category Cup and the Joulz Championship's own server functions (wave 4, W4c; docs/tournaments/events.md): the
 * live part of their event page (the round, the caller's match, the Swiss standings or the bracket) and the hall of
 * fame. Entry, the event's header, prizes and reminders are W4b's (tournaments.functions.ts). Both read W4b's switches
 * (TOURNAMENT_KINDS_ON) and tester rule on every call: `eventFor` answers null for a kind that is off, for an id that
 * isn't on the schedule, and for an account tournaments aren't open to, so nothing here answers then.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { BigEventView, HallOfFameEntry } from "./eventsFlow.server";

export const bigEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data, context }): Promise<BigEventView | null | { busy: true }> => {
    const { adminDb } = await import("@/lib/data/db.server");
    const client = await adminDb();
    const { withinRateLimit } = await import("@/lib/duel/rateLimit.server");
    const { TOURNAMENT_POLL_LIMIT, eventFor } = await import("./tournaments.server");
    if (!(await withinRateLimit(client, context.userId, TOURNAMENT_POLL_LIMIT))) return { busy: true };
    const eventId = String(data.eventId ?? "");
    const { parseBigEventId } = await import("./eventRules");
    if (!parseBigEventId(eventId)) return null;
    // W4b's read: the switches and the tester rule, and the event moved on by the clock first.
    const ev = await eventFor(client, context.userId, eventId, Date.now());
    if (!ev) return null;
    const { bigEventView } = await import("./eventsFlow.server");
    return bigEventView(client, eventId, context.userId);
  });

export const hallOfFameFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<HallOfFameEntry[]> => {
    const { TOURNAMENT_SWITCHES } = await import("./rules");
    if (!TOURNAMENT_SWITCHES.kinds.championship) return [];
    const { adminDb } = await import("@/lib/data/db.server");
    const { hallOfFame } = await import("./eventsFlow.server");
    return hallOfFame(await adminDb());
  });
