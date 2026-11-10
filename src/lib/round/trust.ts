/**
 * The round engine's trust rule (B6, docs/round-engine/plan.md): the time left a grade uses, the phone's claim held to
 * the server's receipt (receipt.ts) with the 1.5 s network allowance (grade.ts trustedMsRemaining).
 *
 * Two named rules, kept apart on purpose (Joe, 9 Nov 2026): with no receipt bound,
 *  - `room` (rooms, async rounds; later rated matches) holds the claim to the round's limit;
 *  - `practice` passes the claim through as it is (gradeAnswer holds it to the round's length itself). Queued offline
 *    runs and deals sealed before the bound reach here with no bound.
 * With a bound both are the same. Server-side (grade.ts imports server modules).
 */
import { trustedMsRemaining } from "@/lib/duel/grade";
import { puzzleTimeLimitMs } from "@/lib/duel/catalogue";
import type { PuzzleData } from "@/lib/duel/types";

export type TrustRule = "room" | "practice";

export function trustedClaim(
  puzzle: PuzzleData,
  claimedMs: number,
  received: number | undefined,
  rule: TrustRule,
): { ms: number; clamped: boolean } {
  if (received === undefined && rule === "practice") return { ms: claimedMs, clamped: false };
  const limitMs = puzzleTimeLimitMs(puzzle);
  return trustedMsRemaining(claimedMs, received ?? limitMs, limitMs);
}
