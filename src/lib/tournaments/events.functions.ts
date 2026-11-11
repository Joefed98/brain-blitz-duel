/**
 * The Category Cup and the Joulz Championship's server functions (wave 4, W4c; docs/tournaments/events.md). A thin
 * shell over eventsFlow.server.ts on the service-role client; each takes the signed-in caller and reads the switches
 * from src/config/tournamentEventsConfig.ts on every call, so a switched-off event is refused whatever a phone sends.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { EntryOutcome, EventView, HallOfFameEntry } from "./eventsFlow.server";
import { isEventKind } from "./eventRules";

/** The event page's poll: about one every 3 s per phone. */
export const EVENT_POLL_LIMIT = { bucket: "tournament-event-poll", max: 400, windowSeconds: 600 } as const;
/** Entering and leaving. */
export const EVENT_ENTRY_LIMIT = { bucket: "tournament-event-entry", max: 20, windowSeconds: 600 } as const;

async function setup(userId: string, limit: { bucket: string; max: number; windowSeconds: number }) {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const { withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  const allowed = await withinRateLimit(client, userId, limit);
  return { client, allowed, flow: await import("./eventsFlow.server") };
}

const BUSY: EntryOutcome = { ok: false, reason: "closed", message: "Slow down a moment, then try again." };

export const tournamentEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string }) => input)
  .handler(async ({ data, context }): Promise<{ off: string } | { busy: true } | { view: EventView }> => {
    if (!isEventKind(data.kind)) return { off: "That event doesn’t exist." };
    const { client, allowed, flow } = await setup(context.userId, EVENT_POLL_LIMIT);
    const off = flow.eventRefusal(data.kind);
    if (off) return { off };
    if (!allowed) return { busy: true };
    const view = await flow.eventView(client, data.kind, context.userId, Date.now());
    return view ? { view } : { off: flow.EVENT_OFF_MESSAGE[data.kind] };
  });

export const enterTournamentEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string; payWith: string }) => input)
  .handler(async ({ data, context }): Promise<EntryOutcome> => {
    const { client, allowed, flow } = await setup(context.userId, EVENT_ENTRY_LIMIT);
    if (data.kind === "championship") {
      const off = flow.eventRefusal("championship");
      if (off) return { ok: false, reason: "off", message: off };
      return { ok: false, reason: "qualify", message: "The Championship can’t be entered: the month’s top 64 Score Attack players qualify." };
    }
    if (data.kind !== "category_cup") return { ok: false, reason: "closed", message: "That event doesn’t exist." };
    const off = flow.eventRefusal("category_cup");
    if (off) return { ok: false, reason: "off", message: off };
    if (!allowed) return BUSY;
    return flow.enterCup(client, context.userId, data.payWith === "ticket" ? "ticket" : "coins", Date.now());
  });

export const leaveTournamentEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string }) => input)
  .handler(async ({ data, context }): Promise<EntryOutcome> => {
    const { client, allowed, flow } = await setup(context.userId, EVENT_ENTRY_LIMIT);
    if (data.kind !== "category_cup") return { ok: false, reason: "not_entered", message: "You’re not entered." };
    const off = flow.eventRefusal("category_cup");
    if (off) return { ok: false, reason: "off", message: off };
    if (!allowed) return BUSY;
    return flow.leaveCup(client, context.userId, Date.now());
  });

export const hallOfFameFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<HallOfFameEntry[]> => {
    const { adminDb } = await import("@/lib/data/db.server");
    const { hallOfFame } = await import("./eventsFlow.server");
    return hallOfFame(await adminDb());
  });
