/**
 * Rated play's server functions (wave 3, W3b; docs/rated/matchmaking-interface.md section 3). A thin shell over
 * rated.server.ts on the service-role client; every one takes the signed-in caller. The phone never sends a score that
 * counts: `ratedProgressFn`'s live score is display only, and every result is the room's own grading.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { record, text } from "@/lib/validate";

import type { HeadToHead, RatedRoomInfo, OpponentScore, QueuePoll, RatedMatchView, RatedStatus, RematchOutcome, JoinOutcome, PublicSettleOutcome } from "./rated.server";

async function setup(userId: string, poll: boolean) {
  const { adminDb } = await import("@/lib/data/db.server");
  const client = await adminDb();
  const { withinRateLimit } = await import("@/lib/duel/rateLimit.server");
  const { RATED_POLL_LIMIT } = await import("./matchmaking");
  const allowed = poll ? await withinRateLimit(client, userId, RATED_POLL_LIMIT) : true;
  return { client, allowed, rated: await import("./rated.server") };
}

const idOf = (value: unknown): string => {
  const id = String(value ?? "");
  return /^[0-9a-f-]{36}$/i.test(id) ? id : "";
};

export const ratedStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RatedStatus> => {
    const { client, rated } = await setup(context.userId, false);
    return rated.ratedStatus(client, context.userId);
  });

export const ratedQueueJoinFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { format: string; choice: string }) => {
    const body = record(input);
    // Any short string: joinQueue answers an unknown format or choice with its own refusal.
    return { format: text(body["format"], 16, "format"), choice: text(body["choice"], 32, "choice") };
  })
  .handler(async ({ data, context }): Promise<JoinOutcome> => {
    const { client, rated } = await setup(context.userId, false);
    // A guest never sends a name: rated play seats them under their generated energy name (guestName.server.ts).
    return rated.joinQueue(client, context.userId, { format: data.format, choice: data.choice }, Date.now());
  });

export const ratedQueuePollFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QueuePoll | { busy: true }> => {
    const { client, allowed, rated } = await setup(context.userId, true);
    if (!allowed) return { busy: true };
    return rated.pollQueue(client, context.userId, Date.now());
  });

export const ratedQueueLeaveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { client, rated } = await setup(context.userId, false);
    await rated.leaveQueue(client, context.userId);
    return { ok: true };
  });

export const ratedMatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string }) => input)
  .handler(async ({ data, context }): Promise<RatedMatchView | null> => {
    const id = idOf(data.matchId);
    if (!id) return null;
    const { client, rated } = await setup(context.userId, false);
    return rated.matchView(client, id, context.userId, Date.now());
  });

export const ratedOpponentScoreFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string }) => input)
  .handler(async ({ data, context }): Promise<OpponentScore | null | { busy: true }> => {
    const id = idOf(data.matchId);
    if (!id) return null;
    const { client, allowed, rated } = await setup(context.userId, true);
    if (!allowed) return { busy: true };
    return rated.opponentScore(client, context.userId, id, Date.now());
  });

export const ratedProgressFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string; round: number; score: number }) => input)
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const id = idOf(data.matchId);
    if (!id) return { ok: false };
    const { client, allowed, rated } = await setup(context.userId, true);
    if (!allowed) return { ok: false };
    return { ok: await rated.reportProgress(client, context.userId, { matchId: id, round: Number(data.round), score: Number(data.score) }) };
  });

export const ratedSettleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string }) => input)
  .handler(async ({ data, context }): Promise<PublicSettleOutcome> => {
    const id = idOf(data.matchId);
    if (!id) return { state: "missing" };
    const { client, rated } = await setup(context.userId, false);
    const view = await rated.matchView(client, id, context.userId, Date.now());
    if (!view) return { state: "missing" };
    // The phone never gets the stored grades the ratings engine was handed.
    return rated.publicSettleOutcome(await rated.settleMatch(client, id, Date.now()));
  });

export const ratedRematchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string }) => input)
  .handler(async ({ data, context }): Promise<RematchOutcome> => {
    const id = idOf(data.matchId);
    if (!id) return { state: "closed" };
    const { client, rated } = await setup(context.userId, false);
    return rated.requestRematch(client, context.userId, id, Date.now());
  });

/** W3c's VS screen: the caller's rated record against an opponent (live rated matches only, recorded runs excluded). */
export const ratedHeadToHeadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { opponentId: string }) => input)
  .handler(async ({ data, context }): Promise<HeadToHead> => {
    const id = idOf(data.opponentId);
    if (!id) return { wins: 0, losses: 0, draws: 0, played: 0 };
    const { client, rated } = await setup(context.userId, false);
    return rated.headToHead(client, context.userId, id);
  });

/** W3c's room screen: is this room a rated match (for one of its players)? null when not, or not the caller's. */
export const ratedRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }): Promise<RatedRoomInfo | null> => {
    const id = idOf(data.roomId);
    if (!id) return null;
    const { client, rated } = await setup(context.userId, false);
    return rated.ratedRoomInfo(client, id, context.userId);
  });
