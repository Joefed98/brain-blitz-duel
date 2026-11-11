/**
 * Rated 4- and 8-player matches on the server (wave 3, session W3d; docs/rated/multiplayer.md). Server only.
 *
 * - The switches are W3b's: `RATED_FORMATS_ON.ffa4` / `.ffa8` in src/config/matchmakingConfig.ts, off at launch. While a
 *   size is off, `joinMultiQueue`, `fillMatch` and `finishMultiMatch` refuse it whatever a phone sends.
 * - `fillMatch`: after FILL_WAIT_MS, recorded runs in every empty seat (rules.ts `fillPlan`); records
 *   `multiplayer_match_started` once the match is full.
 * - `finishMultiMatch`: the final placings from the stored game scores, handed to W3a's recordRatedMatch as a
 *   `placings` match (W3a applies the pairwise rule, pays Joules through D2 and awards badges), and
 *   `multiplayer_match_finished` for each live player.
 *
 * No game's deal, timing, grading or score is touched: the games are W3b's rated room (dealt and graded by the round
 * engine as every room); this module only reads the stored scores.
 */
import { RATED_FORMATS_ON } from "@/config/matchmakingConfig";
import type { RatedCategory, RatedChoice, RatedGame, RatedMatchOutcome, RatedMatchPlayer, RatedMatchResult, RatedPool } from "@/lib/data/ratings";
import type { AnalyticsEvent } from "@/lib/data/events.server";

import { ratedMultiBackend, type RatedMultiBackend } from "./contracts";
import { fillPlan, finalPlacings, isMultiSize, type FillPlan, type MultiSeat, type MultiSize, type StandingRow } from "./rules";

export const RATED_MULTI_OFF_MESSAGE = "4- and 8-player matches aren’t open yet.";
export const RATED_MULTI_NOT_READY_MESSAGE = "Rated matches aren’t ready yet.";

export class RatedMultiOffError extends Error {
  readonly reason = "off" as const;
  constructor() {
    super(RATED_MULTI_OFF_MESSAGE);
  }
}

/** W3b's two switches for this session's formats. */
export interface MultiSwitches {
  ffa4: boolean;
  ffa8: boolean;
}

/** Whether a size is switched on (W3b's `RATED_FORMATS_ON.ffa4` / `.ffa8`). */
export function multiSizeOn(size: unknown, switches: MultiSwitches = RATED_FORMATS_ON): size is MultiSize {
  if (size === 4) return switches.ffa4;
  if (size === 8) return switches.ffa8;
  return false;
}

/** The sizes the picker may show (only what is switched on). */
export function multiSizesOn(switches: MultiSwitches = RATED_FORMATS_ON): MultiSize[] {
  return ([4, 8] as const).filter((s) => multiSizeOn(s, switches));
}

type RecordFn = (events: AnalyticsEvent | readonly AnalyticsEvent[]) => void;

export interface MultiDeps {
  switches?: MultiSwitches;
  backend?: RatedMultiBackend | null;
  record?: RecordFn;
}

async function defaultRecord(): Promise<RecordFn> {
  const { recordEvents } = await import("@/lib/data/events.server");
  return recordEvents;
}

const CHOICES: readonly RatedChoice[] = ["mixed", "puzzles", "arcade"];

export type JoinResult =
  | { ok: true; joinedAtMs: number }
  | { ok: false; reason: "off" | "bad_size" | "bad_choice" | "not_ready"; message: string };

/** A player asks to queue for a 4- or 8-player match. Refused while that size is off. */
export async function joinMultiQueue(
  input: { playerId: string; size: unknown; choice: unknown },
  deps: MultiDeps = {},
): Promise<JoinResult> {
  if (!isMultiSize(input.size)) return { ok: false, reason: "bad_size", message: "Choose 4 or 8 players." };
  if (!multiSizeOn(input.size, deps.switches)) return { ok: false, reason: "off", message: RATED_MULTI_OFF_MESSAGE };
  const choice = input.choice ?? "mixed";
  if (!CHOICES.includes(choice as RatedChoice)) return { ok: false, reason: "bad_choice", message: "Choose Mixed, All puzzles or All arcade." };
  const backend = deps.backend === undefined ? ratedMultiBackend() : deps.backend;
  if (!backend) return { ok: false, reason: "not_ready", message: RATED_MULTI_NOT_READY_MESSAGE };
  const ticket = await backend.enqueue({ playerId: input.playerId, size: input.size, choice: choice as RatedChoice });
  return { ok: true, joinedAtMs: ticket.joinedAtMs };
}

/** Throws RatedMultiOffError while the size is off (every later call in a match goes through it too). */
export function assertMultiOn(size: unknown, switches?: MultiSwitches): asserts size is MultiSize {
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
    choice: RatedChoice;
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
      choice: input.choice,
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

/** One game of the match as the room stored it: what W3a needs (its pool and category from the type, server side). */
export interface MultiGame {
  type: string;
  pool: RatedPool;
  category: RatedCategory;
  signature: string;
  /** Each seat's stored score (a seat with no result: 0). */
  scores: readonly { seatId: string; score: number }[];
  /**
   * Each seat's stored grade `extra` for this game, exactly as the server's grading stored it. W3a reads the server's own
   * flag from it (`extra.flagged === true`, set by the replay and anti-cheat, never by the phone): a flagged run anywhere
   * in the match moves nobody's rating, counts for nobody's placement, streaks or badges, pays the flagged player no
   * Joules and is logged for review (moderation.rated_flags).
   */
  extras?: readonly { seatId: string; extra: Record<string, unknown> | null }[];
}

/** The result W3a's recordRatedMatch takes for a 4- or 8-player match. */
export function multiRatedResult(input: {
  matchId: string;
  size: MultiSize;
  choice: RatedChoice;
  seats: readonly MultiSeat[];
  games: readonly MultiGame[];
  placings: readonly StandingRow[];
  finishedAt?: string;
}): RatedMatchResult {
  const bySeat = new Map(input.seats.map((s) => [s.seatId, s]));
  const players: RatedMatchPlayer[] = input.seats.map((s) =>
    s.recorded && s.run
      ? { playerId: s.playerId, side: "recorded", run: { runId: s.run.runId, ownerId: s.playerId, source: s.run.source } }
      : { playerId: s.playerId, side: "live" },
  );
  return {
    matchId: input.matchId,
    format: { kind: "placings", players: input.size },
    choice: input.choice,
    players,
    games: input.games.map((g) => {
      const scores: Record<string, number> = {};
      for (const s of input.seats) scores[s.playerId] = 0;
      for (const r of g.scores) {
        const seat = bySeat.get(r.seatId);
        if (seat) scores[seat.playerId] = Math.max(0, Math.round(r.score));
      }
      const game: RatedGame = { type: g.type, pool: g.pool, category: g.category, version: "classic" as const, signature: g.signature, scores };
      if (g.extras?.length) {
        const gradeExtras: Record<string, Record<string, unknown> | null> = {};
        for (const s of input.seats) gradeExtras[s.playerId] = null;
        for (const e of g.extras) {
          const seat = bySeat.get(e.seatId);
          if (seat) gradeExtras[seat.playerId] = e.extra && typeof e.extra === "object" && !Array.isArray(e.extra) ? e.extra : null;
        }
        game.gradeExtras = gradeExtras;
      }
      return game;
    }),
    placings: Object.fromEntries(input.placings.map((p) => [bySeat.get(p.seatId)!.playerId, p.place])),
    ...(input.finishedAt ? { finishedAt: input.finishedAt } : {}),
  };
}

export interface MultiFinish {
  placings: StandingRow[];
  outcome: RatedMatchOutcome;
}

/**
 * The end of a match: placings from the stored scores of every game, W3a's recordRatedMatch (ratings, Joules, badges,
 * all W3a's), and one `multiplayer_match_finished` per live player.
 */
export async function finishMultiMatch(
  input: {
    matchId: string;
    size: MultiSize;
    choice: RatedChoice;
    seats: readonly MultiSeat[];
    games: readonly MultiGame[];
    finishedAt?: string;
  },
  deps: MultiDeps = {},
): Promise<MultiFinish> {
  assertMultiOn(input.size, deps.switches);
  const backend = deps.backend === undefined ? ratedMultiBackend() : deps.backend;
  if (!backend) throw new Error(RATED_MULTI_NOT_READY_MESSAGE);
  const seatIds = input.seats.map((s) => s.seatId);
  const placings = finalPlacings(input.size, seatIds, input.games.map((g) => g.scores));
  const outcome = await backend.recordRatedMatch(multiRatedResult({ ...input, placings }));
  if (outcome.ok && outcome.status === "recorded") {
    const record = deps.record ?? (await defaultRecord());
    const bySeat = new Map(input.seats.map((s) => [s.seatId, s]));
    record(
      placings
        .map((p) => ({ seat: bySeat.get(p.seatId)!, place: p.place }))
        .filter((p) => !p.seat.recorded)
        .map((p) => ({
          event: "multiplayer_match_finished" as const,
          playerId: p.seat.playerId,
          props: { size: input.size, placing: p.place },
        })),
    );
  }
  return { placings, outcome };
}
