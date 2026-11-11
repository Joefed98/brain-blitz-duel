/**
 * What rated 4- and 8-player matches need from W3a (ratings) and W3b (matchmaking): typed ports on their published
 * contracts (docs/rated/ratings-interface.md, docs/rated/matchmaking-interface.md). The result and outcome types are
 * W3a's own (`src/lib/data/ratings.ts`). Their server functions (W3a's `recordRatedMatch(client, result)` in
 * src/lib/rated/ratings.server.ts; W3b's queue in src/lib/rated/rated.server.ts) were not on their draft branches
 * yet (11 Nov 2026), so the binding is one call, `bindRatedMulti`, made when they land; until then every call is
 * "not ready" (and the server refuses both sizes anyway while W3b's ffa4 / ffa8 switches are off).
 *
 * Kept free of server imports so checks can stand a backend in.
 */
import type { RatedMatchOutcome, RatedMatchResult } from "@/lib/data/ratings";

import type { MultiSize, RecordedCandidate } from "./rules";

export interface QueueTicket {
  joinedAtMs: number;
}

export interface RatedMultiBackend {
  /** W3b's ratedQueueJoin for format ffa4 / ffa8 and a choice (Mixed / All puzzles / All arcade). */
  enqueue(input: { playerId: string; size: MultiSize; choice: string }): Promise<QueueTicket>;
  /** W3b: recorded runs for this match's deals, best first in its widening order (fromW3bCandidate). */
  recordedCandidates(input: { size: MultiSize; choice: string; dealKeys: readonly string[]; exclude: readonly string[] }): Promise<RecordedCandidate[]>;
  /** W3a's recordRatedMatch (the service-role client bound in): idempotent on matchId. */
  recordRatedMatch(result: RatedMatchResult): Promise<RatedMatchOutcome>;
}

let bound: RatedMultiBackend | null = null;

/** The binding (one call, once W3a's and W3b's server functions are merged); checks stand a backend in the same way. */
export function bindRatedMulti(backend: RatedMultiBackend | null): void {
  bound = backend;
}

export function ratedMultiBackend(): RatedMultiBackend | null {
  return bound;
}
