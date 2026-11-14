/**
 * Tournaments' server functions (wave 4, W4b; docs/tournaments/interface.md section 3). A thin shell over
 * tournaments.server.ts on the service-role client; every one takes the signed-in caller. The phone never sends a
 * score, a place or a prize: entry is checked and paid on the server, every result is the rooms' (or the Daily's async
 * rooms') own grading, and places and prizes are worked out from what the server stored.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bool, record, text } from "@/lib/validate";

import type { ArenaBoard, ArenaPoll, EnterOutcome, ScoreAttackBoard, TournamentEventView, TournamentHub, TrophyView } from "./types";

async function setup(userId: string, poll: boolean) {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const server = await import("./tournaments.server");
  const { withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  const allowed = poll ? await withinRateLimit(client, userId, server.TOURNAMENT_POLL_LIMIT) : true;
  return { client, allowed, server };
}

const eventIdOf = (value: unknown): string => {
  const id = String(value ?? "");
  return id.length <= 64 && /^[a-z_]+:[0-9-]+(:[0-9]{4})?$/.test(id) ? id : "";
};

/**
 * An event id as short text (Security C2, 14 Nov 2026): eventIdOf still answers a malformed one softly (null, or the
 * handler's own refusal), so only the type and size are refused here.
 */
function eventIdText(value: unknown): string {
  return text(value, EVENT_ID_MAX, "eventId");
}
const EVENT_ID_MAX = 128;

export const tournamentHubFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TournamentHub | { busy: true }> => {
    const { client, allowed, server } = await setup(context.userId, true);
    if (!allowed) return { busy: true };
    return server.tournamentHub(client, context.userId, Date.now());
  });

export const tournamentEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: eventIdText(record(input)["eventId"]) }))
  .handler(async ({ data, context }): Promise<TournamentEventView | null> => {
    const id = eventIdOf(data.eventId);
    if (!id) return null;
    const { client, server } = await setup(context.userId, false);
    return server.eventFor(client, context.userId, id, Date.now());
  });

export const tournamentEnterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; entry: string }) => {
    const body = record(input);
    return { eventId: eventIdText(body["eventId"]), entry: text(body["entry"], 32, "entry") };
  })
  .handler(async ({ data, context }): Promise<EnterOutcome> => {
    const { client, server } = await setup(context.userId, false);
    return server.enterEvent(client, context.userId, { eventId: eventIdOf(data.eventId), entry: data.entry }, Date.now());
  });

export const tournamentRemindFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; on: boolean }) => {
    const body = record(input);
    return { eventId: eventIdText(body["eventId"]), on: bool(body["on"], "on") };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; reminded: boolean }> => {
    const { client, server } = await setup(context.userId, false);
    return server.setReminder(client, context.userId, eventIdOf(data.eventId), data.on === true, Date.now());
  });

export const arenaReadyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: eventIdText(record(input)["eventId"]) }))
  .handler(async ({ data, context }): Promise<ArenaPoll> => {
    const { client, server } = await setup(context.userId, false);
    return server.arenaReady(client, context.userId, eventIdOf(data.eventId), Date.now());
  });

export const arenaPollFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: eventIdText(record(input)["eventId"]) }))
  .handler(async ({ data, context }): Promise<ArenaPoll | { busy: true }> => {
    const { client, allowed, server } = await setup(context.userId, true);
    if (!allowed) return { busy: true };
    return server.arenaPoll(client, context.userId, eventIdOf(data.eventId), Date.now());
  });

export const arenaLeaveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: eventIdText(record(input)["eventId"]) }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { client, server } = await setup(context.userId, false);
    await server.arenaLeave(client, context.userId, eventIdOf(data.eventId));
    return { ok: true };
  });

export const arenaBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: eventIdText(record(input)["eventId"]) }))
  .handler(async ({ data, context }): Promise<ArenaBoard | null | { busy: true }> => {
    const { client, allowed, server } = await setup(context.userId, true);
    if (!allowed) return { busy: true };
    return server.arenaBoard(client, context.userId, eventIdOf(data.eventId), Date.now());
  });

export const scoreAttackStartFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: eventIdText(record(input)["eventId"]) }))
  .handler(async ({ data, context }): Promise<{ ok: true; roomId: string } | { ok: false; message: string }> => {
    const { client, server } = await setup(context.userId, false);
    return server.scoreAttackStart(client, context.userId, eventIdOf(data.eventId), Date.now());
  });

export const scoreAttackBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: eventIdText(record(input)["eventId"]) }))
  .handler(async ({ data, context }): Promise<ScoreAttackBoard | null | { busy: true }> => {
    const { client, allowed, server } = await setup(context.userId, true);
    if (!allowed) return { busy: true };
    return server.scoreAttackBoard(client, context.userId, eventIdOf(data.eventId), Date.now());
  });

/** The caller's trophies for Profile's cabinet (real ones only; a guest has none). */
export const myTrophiesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrophyView[]> => {
    const { client, server } = await setup(context.userId, false);
    return server.trophiesFor(client, context.userId);
  });
