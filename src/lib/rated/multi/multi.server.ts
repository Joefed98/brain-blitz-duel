/**
 * Rated 4- and 8-player matches on the server (wave 3, session W3d; docs/rated/multiplayer.md). Server only.
 *
 * - `joinMultiQueue`: refused while the size's switch is off (src/config/ratedMultiConfig.ts), then through W3b's queue.
 * - `fillMatch`: after FILL_WAIT_MS, recorded runs in every empty seat (rules.ts `fillPlan`); records
 *   `multiplayer_match_started` once the match is full.
 * - `finishMultiMatch`: the final placings from the stored game scores, W3a's recordRatedMatch with the pairwise rule,
 *   the Joules (1.5 times best of 3) for live players, and `multiplayer_match_finished` for each live player.
 *
 * No game's deal, timing, grading or score is touched: the games are dealt and graded by the round engine
 * (src/lib/round/) as every other mode; this module only reads the stored scores.
 */
import { RATED_MULTI_SWITCHES, type RatedMultiSwitches } from "@/config/ratedMultiConfig";
import type { AnalyticsEvent } from "@/lib/data/events.server";

import { ratedMultiBackend, type RatedMultiBackend, type RatingChange } from "./contracts";
import {
  fillPlan,
  finalPlacings,
  isMultiSize,
  multiJoules,
  ratingPairs,
  type FillPlan,
  type GameScore,
  type MultiSeat,
  type MultiSize,
  type StandingRow,
} from "./rules";

export const RATED_MULTI_OFF_MESSAGE = "4- and 8-player matches aren’t open yet.";
export const RATED_MULTI_NOT_READY_MESSAGE = "Rated matches aren’t ready yet.";

export class RatedMultiOffError extends Error {
  readonly reason = "off" as const;
  constructor() {
    super(RATED_MULTI_OFF_MESSAGE);
  }
}

/** Whether a size is switched on. */
export function multiSizeOn(size: unknown, switches: RatedMultiSwitches = RATED_MULTI_SWITCHES): size is MultiSize {
  if (size === 4) return switches.four;
  if (size === 8) return switches.eight;
  return false;
}

/** The sizes the picker may show (only what is switched on). */
export function multiSizesOn(switches: RatedMultiSwitches = RATED_MULTI_SWITCHES): MultiSize[] {
  return ([4, 8] as const).filter((s) => multiSizeOn(s, switches));
}

type RecordFn = (events: AnalyticsEvent | readonly AnalyticsEvent[]) => void;

export interface MultiDeps {
  switches?: RatedMultiSwitches;
  backend?: RatedMultiBackend | null;
  record?: RecordFn;
}

async function defaultRecord(): Promise<RecordFn> {
  const { recordEvents } = await import("@/lib/data/events.server");
  return recordEvents;
}

export type JoinResult =
  | { ok: true; ticketId: string }
  | { ok: false; reason: "off" | "bad_size" | "not_ready"; message: string };

/** A player asks to queue for a 4- or 8-player match. Refused while that size is off. */
export async function joinMultiQueue(
  input: { playerId: string; size: unknown; picks: unknown },
  deps: MultiDeps = {},
): Promise<JoinResult> {
  if (!isMultiSize(input.size)) return { ok: false, reason: "bad_size", message: "Choose 4 or 8 players." };
  if (!multiSizeOn(input.size, deps.switches)) return { ok: false, reason: "off", message: RATED_MULTI_OFF_MESSAGE };
  const backend = deps.backend === undefined ? ratedMultiBackend() : deps.backend;
  if (!backend) return { ok: false, reason: "not_ready", message: RATED_MULTI_NOT_READY_MESSAGE };
  const picks = typeof input.picks === "string" ? input.picks.slice(0, 32) : "mixed";
  const ticket = await backend.enqueue({ playerId: input.playerId, size: input.size, picks });
  return { ok: true, ticketId: ticket.ticketId };
}

/** Throws RatedMultiOffError while the size is off (every later call in a match goes through it too). */
export function assertMultiOn(size: unknown, switches?: RatedMultiSwitches): asserts size is MultiSize {
  if (!multiSizeOn(size, switches)) throw new RatedMultiOffError();
}

/**
 * One step of filling a match: the live players so far and how long the first has waited. Before 15 s it waits; after
 * it W3b's recorded runs fill the empty seats. A full match records `multiplayer_match_started`.
 */
export async function fillMatch(
  input: {
    matchId: string;
    size: MultiSize;
    picks: string;
    live: readonly { playerId: string; name: string }[];
    waitedMs: number;
    dealKeys: readonly string[];
  },
  deps: MultiDeps = {},
): Promise<FillPlan> {
  assertMultiOn(input.size, deps.switches);
  const backend = deps.backend === undefined ? ratedMultiBackend() : deps.backend;
  let plan = fillPlan({ ...input, candidates: [] });
  if (plan.kind === "short") {
    if (!backend) throw new Error(RATED_MULTI_NOT_READY_MESSAGE);
    const candidates = await backend.recordedCandidates({
      size: input.size,
      picks: input.picks,
      dealKeys: input.dealKeys,
      exclude: input.live.map((p) => p.playerId),
    });
    plan = fillPlan({ ...input, candidates });
  }
  if (plan.kind === "full" || plan.kind === "filled") {
    const record = deps.record ?? (await defaultRecord());
    const recorded = plan.seats.filter((s) => s.recorded).length;
    record({
      event: "multiplayer_match_started",
      props: { size: input.size, live_seats: plan.seats.length - recorded, recorded_seats: recorded },
    });
  }
  return plan;
}

export interface MultiFinish {
  placings: StandingRow[];
  ratings: RatingChange[];
  joules: { playerId: string; amount: number }[];
}

/**
 * The end of a match: placings from the stored scores of every game, ratings through W3a (live players only, the
 * pairwise rule), Joules for live players, and one `multiplayer_match_finished` each.
 */
export async function finishMultiMatch(
  input: {
    matchId: string;
    size: MultiSize;
    seats: readonly MultiSeat[];
    games: readonly (readonly GameScore[])[];
    categories: readonly string[];
  },
  deps: MultiDeps = {},
): Promise<MultiFinish> {
  assertMultiOn(input.size, deps.switches);
  const backend = deps.backend === undefined ? ratedMultiBackend() : deps.backend;
  if (!backend) throw new Error(RATED_MULTI_NOT_READY_MESSAGE);
  const seatIds = input.seats.map((s) => s.seatId);
  const placings = finalPlacings(input.size, seatIds, input.games);
  const bySeat = new Map(input.seats.map((s) => [s.seatId, s]));
  const placed = placings.map((p) => ({ seat: bySeat.get(p.seatId)!, place: p.place }));
  const ratings = await backend.recordRatedMatch({
    matchId: input.matchId,
    size: input.size,
    placings: placed,
    pairs: ratingPairs(placings, input.size),
    categories: input.categories,
  });
  const joules = placed
    .filter((p) => !p.seat.recorded)
    .map((p) => ({ playerId: p.seat.playerId, amount: multiJoules(input.size, p.place) }));
  await backend.creditJoules(
    joules.map((j) => ({ ...j, reason: "rated_multi" as const, key: `rated_multi:${input.matchId}:${j.playerId}` })),
  );
  const record = deps.record ?? (await defaultRecord());
  record(
    placed
      .filter((p) => !p.seat.recorded)
      .map((p) => ({
        event: "multiplayer_match_finished" as const,
        playerId: p.seat.playerId,
        props: { size: input.size, placing: p.place },
      })),
  );
  return { placings, ratings, joules };
}
