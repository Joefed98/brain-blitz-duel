/**
 * What rated 4- and 8-player matches need from W3a (ratings) and W3b (matchmaking), as typed ports
 * (docs/rated/multiplayer.md "Contracts"). W3a's docs/rated/ratings-interface.md and W3b's
 * docs/rated/matchmaking-interface.md were not on any branch when this was built (11 Nov 2026), so this module names
 * the calls this session makes; the binding to their real functions is one file, `bindRatedMulti` at the end of the
 * train (the identity screens' backend.ts pattern). Until something is bound, `ratedMultiBackend()` is null and every
 * server call refuses with "not ready" (the switches are off at launch, so no player can reach them anyway).
 *
 * Server only in practice (the server functions call it); kept free of server imports so checks can stand it in.
 */
import type { MultiSeat, MultiSize, RatedPair, RecordedCandidate } from "./rules";

/** One player's rating change, as W3a returns it (the overall rating and, if it keeps them, the category parts). */
export interface RatingChange {
  playerId: string;
  before: number;
  after: number;
  /** after − before. */
  change: number;
  /** Optional parts (mockup 10: "Puzzles 1,302 +6 · Arcade 1,236 +5"). */
  parts?: readonly { label: string; rating: number; change: number }[];
}

/** What this session passes to W3a's recordRatedMatch for a 4- or 8-player match. */
export interface MultiRatedMatch {
  matchId: string;
  size: MultiSize;
  /** Every seat with its final place; recorded seats are opponents, never rated. */
  placings: readonly { seat: MultiSeat; place: number }[];
  /** Each pair once: the better place a win, a shared place a draw, every pair weighted 1 / (size − 1). */
  pairs: readonly RatedPair[];
  /** The deals' categories, for ratings kept by category (W3a decides). */
  categories: readonly string[];
}

export interface QueueTicket {
  ticketId: string;
}

export interface RatedMultiBackend {
  /** W3b: join the queue for a size and picks (Mixed / All puzzles / All arcade). */
  enqueue(input: { playerId: string; size: MultiSize; picks: string }): Promise<QueueTicket>;
  /** W3b: recorded runs for this match's deals, best first in its widening order. */
  recordedCandidates(input: { size: MultiSize; picks: string; dealKeys: readonly string[]; exclude: readonly string[] }): Promise<RecordedCandidate[]>;
  /** W3a: record the match and return every live player's change. */
  recordRatedMatch(match: MultiRatedMatch): Promise<RatingChange[]>;
  /** The pass's Joules credit (idempotent on `key`). */
  creditJoules(entries: readonly { playerId: string; amount: number; reason: "rated_multi"; key: string }[]): Promise<void>;
}

let bound: RatedMultiBackend | null = null;

/** The binding (one call, at the end of the wave 3 train); checks stand a backend in the same way. */
export function bindRatedMulti(backend: RatedMultiBackend | null): void {
  bound = backend;
}

export function ratedMultiBackend(): RatedMultiBackend | null {
  return bound;
}
