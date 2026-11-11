/**
 * The ports a 4- or 8-player match still needs from W3b's queue that W3b doesn't offer yet: a join for ffa4 / ffa8 by
 * this module's own call, and recorded runs on one match's deals (parked until 4 and 8 players are switched on; Joe
 * will ask W3b to support several recorded seats then). Ratings are never reached from here: every match, 1v1 or
 * 4 and 8 players, settles through W3b's settleMatch and W3a's finishRatedMatch (ratingsAdapter.server.ts
 * `ratingsReady()`). Until bound, every call is "not ready" (and the server refuses both sizes anyway while W3b's
 * ffa4 / ffa8 switches are off).
 *
 * Kept free of server imports so checks can stand a backend in.
 */
import type { MultiSize, RecordedCandidate } from "./rules";

export interface QueueTicket {
  joinedAtMs: number;
}

export interface RatedMultiBackend {
  /** W3b's ratedQueueJoin for format ffa4 / ffa8 and a choice (Mixed / All puzzles / All arcade). */
  enqueue(input: { playerId: string; size: MultiSize; choice: string }): Promise<QueueTicket>;
  /** W3b: recorded runs for this match's deals, best first in its widening order (fromW3bCandidate). */
  recordedCandidates(input: { size: MultiSize; choice: string; dealKeys: readonly string[]; exclude: readonly string[] }): Promise<RecordedCandidate[]>;
}

let bound: RatedMultiBackend | null = null;

/** The binding (one call, once W3a's and W3b's server functions are merged); checks stand a backend in the same way. */
export function bindRatedMulti(backend: RatedMultiBackend | null): void {
  bound = backend;
}

export function ratedMultiBackend(): RatedMultiBackend | null {
  return bound;
}
