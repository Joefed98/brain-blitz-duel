/**
 * Exact's targets in a row (D2, 22 Nov 2026; docs/polish-plan-final/difficulty-spec.md "Exact", the spec's new mechanic):
 * Hard plays 2 targets and Expert 3, each on its own rack of six numbers, announced as "Target 1 of 2" with the Number
 * family's stage pips. Stamped `targetRev 1` (TARGET_REV_ROUNDS) on the level deal only; every puzzle without it is one
 * target and plays, grades and draws exactly as before.
 *
 * The stored puzzle keeps the first target in today's fields (`tiles`, `target`, `solution`) and lists every target's
 * rack in `targets` (public) and every target's stored route in `solutions` (private, secrets.ts). The answer is each
 * target's steps (target.ts encodeSteps) joined by "/" in play order; a target not reached yet is empty. Hitting a
 * target exactly moves the round on to the next one. Shared by phone and server, pure.
 */
import { decodeSteps, replayTargetSteps } from "./target";
import type { TargetNumberPuzzleData } from "./types";

/** The stamp: a round of targets in a row (Hard and Expert since D2). */
export const TARGET_REV_ROUNDS = 1;
/** Between two targets' steps in the answer ("a|op|b;a|op|b/a|op|b"): no step or number uses it. */
export const TARGET_ROUND_SEP = "/";

/** One target of a round: its rack and the number to make. */
export interface TargetRound {
  tiles: number[];
  target: number;
}

/** True for a stored Exact round of targets in a row. */
export function usesTargetRounds(puzzle: unknown): puzzle is TargetNumberPuzzleData & { targets: TargetRound[] } {
  const p = puzzle as Partial<TargetNumberPuzzleData> | null;
  return !!p && p.type === "target" && (p.targetRev ?? 0) >= TARGET_REV_ROUNDS && Array.isArray(p.targets) && p.targets.length > 1;
}

/** The round's targets: `targets` on a round of targets, else the one target. */
export function targetRoundsOf(puzzle: Pick<TargetNumberPuzzleData, "tiles" | "target"> & { targets?: TargetRound[] | undefined; targetRev?: number | undefined; type?: string }): TargetRound[] {
  return usesTargetRounds(puzzle) ? puzzle.targets : [{ tiles: puzzle.tiles, target: puzzle.target }];
}

/** The answer's part for each target (n parts, "" where none). */
export function splitTargetRounds(answer: string | null | undefined, n: number): string[] {
  const parts = String(answer ?? "").split(TARGET_ROUND_SEP);
  return Array.from({ length: n }, (_, i) => parts[i] ?? "");
}

/** The answer for each target's steps, in play order. */
export function joinTargetRounds(parts: readonly string[]): string {
  return parts.join(TARGET_ROUND_SEP);
}

/** How many targets in a row the answer has hit exactly (a later target counts only after the ones before it). */
export function targetRoundsDone(puzzle: TargetNumberPuzzleData, answer: string | null | undefined): number {
  const rounds = targetRoundsOf(puzzle);
  const parts = splitTargetRounds(answer, rounds.length);
  let done = 0;
  for (const [i, r] of rounds.entries()) {
    if (replayTargetSteps(r.tiles, r.target, decodeSteps(parts[i] ?? "")).distance !== 0) break;
    done++;
  }
  return done;
}

/** The first target as its own one-target puzzle, and so on: target `i` of a round as today's puzzle shape. */
export function targetRoundPuzzle(puzzle: TargetNumberPuzzleData, i: number): TargetNumberPuzzleData {
  const rounds = targetRoundsOf(puzzle);
  const r = rounds[Math.min(Math.max(0, i), rounds.length - 1)]!;
  const solution = usesTargetRounds(puzzle) ? (puzzle.solutions?.[i] ?? []) : puzzle.solution;
  return { type: "target", tiles: r.tiles, target: r.target, solution, ...(puzzle.depthRev !== undefined ? { depthRev: puzzle.depthRev } : {}) };
}
