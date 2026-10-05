/** Shared Colour Flood bank checks: quick tests for every board, and the exhaustive par proof. */
import { floodMinMoves } from "../src/lib/duel/flood.server";
import { encodeFloodMoves, replayFlood } from "../src/lib/duel/flood";
import { gradeSubmission } from "../src/lib/duel/grade";
import { scoreFlood } from "../src/lib/duel/scoring";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { FLOOD_CELLS, FLOOD_SIZE, FLOOD_MIN_PAR, FLOOD_MAX_PAR, type FloodPuzzleData } from "../src/lib/duel/types";

export type Check = (label: string, ok: boolean) => void;

/** Cheap per-board tests: size, par range, stored route floods in par, server grading matches. */
export function quickFloodChecks(boards: FloodPuzzleData[], check: Check): void {
  for (const puzzle of boards) {
    const solution = puzzle.solution ?? [];
    const limit = puzzleTimeLimitMs(puzzle);
    check("14×14 board", FLOOD_SIZE === 14 && puzzle.grid.length === FLOOD_CELLS);
    check("par in range", puzzle.par >= FLOOD_MIN_PAR && puzzle.par <= FLOOD_MAX_PAR);
    const replay = replayFlood(puzzle.grid, solution);
    check("stored route floods the board in par", replay.solved && replay.moves === puzzle.par && replay.region === FLOOD_CELLS);
    for (const ms of [0, limit / 2, limit]) {
      const grade = gradeSubmission(puzzle, encodeFloodMoves(solution), ms);
      check("server grading matches replay", grade.isCorrect && grade.correctCount === replay.region && grade.score === scoreFlood(true, replay.moves, puzzle.par, replay.region, ms, limit));
    }
    const partial = replayFlood(puzzle.grid, solution.slice(0, 2));
    const grade = gradeSubmission(puzzle, encodeFloodMoves(solution.slice(0, 2)), 0);
    check("partial server replay", !grade.isCorrect && grade.score === scoreFlood(false, partial.moves, puzzle.par, partial.region, 0, limit));
  }
}

/** Exhaustive proof: a par-move solution exists and none one move shorter. Slow. */
export function floodParProof(boards: FloodPuzzleData[], check: Check): void {
  for (const puzzle of boards) {
    check("par reachable", floodMinMoves(puzzle.grid, puzzle.par)?.par === puzzle.par);
    check("no shorter solution", floodMinMoves(puzzle.grid, puzzle.par - 1) === null);
  }
}

/** Deterministic sample of `count` boards (seeded shuffle), so every run proves the same ones. */
export function seededSample<T>(items: T[], count: number, seed = 20261005): T[] {
  let s = seed >>> 0;
  const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, count);
}
