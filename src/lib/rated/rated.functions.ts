/**
 * Rated play's server functions (wave 3, W3b; docs/rated/matchmaking-interface.md section 3). A thin shell over
 * rated.server.ts on the service-role client; every one takes the signed-in caller. The phone never sends a score that
 * counts: `ratedProgressFn`'s live score is display only, and every result is the room's own grading.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { num, oneOf, record, text, uuid } from "@/lib/validate";

import type { Stakes } from "./stakes.server";
import { RATED_CHOICES_ON, RATED_FORMATS_ON } from "@/config/matchmakingConfig";
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

/**
 * An id as short text (Security C2, 14 Nov 2026): the handler's own idOf still answers a malformed one softly (null,
 * "missing", "closed", an empty record), so only the type and size are refused here.
 */
function idText(value: unknown, field: string): string {
  return text(value, 64, field);
}

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
  .inputValidator((input: { matchId: string }) => ({ matchId: idText(record(input)["matchId"], "matchId") }))
  .handler(async ({ data, context }): Promise<RatedMatchView | null> => {
    const id = idOf(data.matchId);
    if (!id) return null;
    const { client, rated } = await setup(context.userId, false);
    return rated.matchView(client, id, context.userId, Date.now());
  });

export const ratedOpponentScoreFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string }) => ({ matchId: idText(record(input)["matchId"], "matchId") }))
  .handler(async ({ data, context }): Promise<OpponentScore | null | { busy: true }> => {
    const id = idOf(data.matchId);
    if (!id) return null;
    const { client, allowed, rated } = await setup(context.userId, true);
    if (!allowed) return { busy: true };
    return rated.opponentScore(client, context.userId, id, Date.now());
  });

export const ratedProgressFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string; round: number; score: number }) => {
    const body = record(input);
    return { matchId: idText(body["matchId"], "matchId"), round: num(body["round"], "round"), score: num(body["score"], "score") };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const id = idOf(data.matchId);
    if (!id) return { ok: false };
    const { client, allowed, rated } = await setup(context.userId, true);
    if (!allowed) return { ok: false };
    return { ok: await rated.reportProgress(client, context.userId, { matchId: id, round: Number(data.round), score: Number(data.score) }) };
  });

export const ratedSettleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string }) => ({ matchId: idText(record(input)["matchId"], "matchId") }))
  .handler(async ({ data, context }): Promise<PublicSettleOutcome> => {
    const id = idOf(data.matchId);
    if (!id) return { state: "missing" };
    const { client, rated } = await setup(context.userId, false);
    const view = await rated.matchView(client, id, context.userId, Date.now());
    if (!view) return { state: "missing" };
    // The phone never gets the stored grades the ratings engine was handed.
    return rated.publicSettleOutcome(client, await rated.settleMatch(client, id, Date.now()));
  });

export const ratedRematchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string }) => ({ matchId: idText(record(input)["matchId"], "matchId") }))
  .handler(async ({ data, context }): Promise<RematchOutcome> => {
    const id = idOf(data.matchId);
    if (!id) return { state: "closed" };
    const { client, rated } = await setup(context.userId, false);
    return rated.requestRematch(client, context.userId, id, Date.now());
  });

/** W3c's VS screen: the caller's rated record against an opponent, by public id (live rated matches only, recorded runs excluded). */
export const ratedHeadToHeadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { opponentId: string }) => ({ opponentId: idText(record(input)["opponentId"], "opponentId") }))
  .handler(async ({ data, context }): Promise<HeadToHead> => {
    const id = idOf(data.opponentId);
    if (!id) return { wins: 0, losses: 0, draws: 0, played: 0 };
    const { client, rated } = await setup(context.userId, false);
    // Security C3: `opponentId` is a public id; one that names nobody (an account id among them) has no record.
    const { accountOf } = await import("@/lib/identity/publicIds.server");
    const opponent = await accountOf(client, id);
    return opponent ? rated.headToHead(client, context.userId, opponent) : { wins: 0, losses: 0, draws: 0, played: 0 };
  });

/** W3c's room screen: is this room a rated match (for one of its players)? null when not, or not the caller's. */
export const ratedRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => ({ roomId: idText(record(input)["roomId"], "roomId") }))
  .handler(async ({ data, context }): Promise<RatedRoomInfo | null> => {
    const id = idOf(data.roomId);
    if (!id) return null;
    const { client, rated } = await setup(context.userId, false);
    return rated.ratedRoomInfo(client, id, context.userId);
  });

/**
 * The stakes of a matched rated 1v1 for the caller, "Win +N · Lose −N" (phase 2 step 3, Joe 14 Nov 2026; VS and the
 * match header): exact for this opponent and format, worked out by the ratings engine (stakes.server.ts). Read-only;
 * the answer holds no ids. Null for a player in placement (the line is hidden), or not in the match.
 */
export const ratedStakesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string }) => ({ matchId: uuid(record(input)["matchId"], "matchId") }))
  .handler(async ({ data, context }): Promise<Stakes | null> => {
    const { client } = await setup(context.userId, false);
    const { matchStakes } = await import("./stakes.server");
    return matchStakes(client, data.matchId, context.userId, Date.now());
  });

/**
 * Before matching (the Play page): the caller's stakes against an opponent rated exactly as they are, for a format
 * and choice. Read-only, no ids. Null for a player in placement, a format or choice the ratings don't take, or anyone
 * rated play isn't open to.
 */
export const ratedStakesEstimateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { format: string; choice: string }) => {
    const body = record(input);
    return { format: oneOf(body["format"], Object.keys(RATED_FORMATS_ON) as (keyof typeof RATED_FORMATS_ON)[], "format"), choice: oneOf(body["choice"], Object.keys(RATED_CHOICES_ON) as (keyof typeof RATED_CHOICES_ON)[], "choice") };
  })
  .handler(async ({ data, context }): Promise<Stakes | null> => {
    const { client, rated } = await setup(context.userId, false);
    if (!(await rated.ratedStatus(client, context.userId)).open) return null;
    const { estimateStakes } = await import("./stakes.server");
    return estimateStakes(client, context.userId, data.format, data.choice, Date.now());
  });
