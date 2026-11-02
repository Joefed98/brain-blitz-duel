/**
 * Script helpers for the four grid puzzles born on the scoring standard (1 Nov 2026): Fences, Fillomino, Bridges and
 * Kakuro. A seeded room deal of each and the answer a phone sends for its finished board (built from the stored
 * solution), for checks and tools that need a solved round. Script-only.
 */
import { encodeFences, fencesEdgeCount, FENCES_LINE, FENCES_EMPTY } from "../src/lib/duel/fences";
import { encodeFillomino } from "../src/lib/duel/fillomino";
import { encodeBridges } from "../src/lib/duel/bridges";
import { encodeKakuro } from "../src/lib/duel/kakuro";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

export const GRID_GAMES = ["fences", "fillomino", "bridges", "kakuro"] as const satisfies readonly PuzzleType[];
export type GridGame = (typeof GRID_GAMES)[number];

/** The room deal of `type` on room seed `seed` (generatePuzzle with the seed, as buildRoomPuzzles deals it). */
export function gridRoomPuzzle(type: GridGame, seed: number): PuzzleData {
  return generatePuzzle(type, { bankSeed: seed });
}

/** The answer of the finished board (the stored solution, encoded as the phone sends it). */
export function gridSolvedAnswer(puzzle: PuzzleData): string {
  switch (puzzle.type) {
    case "fences": {
      const sol = new Set(puzzle.solution ?? []);
      return encodeFences(Array.from({ length: fencesEdgeCount(puzzle.size) }, (_, e) => (sol.has(e) ? FENCES_LINE : FENCES_EMPTY)));
    }
    case "fillomino":
      return encodeFillomino((puzzle.solution ?? []).map((v, i) => ((puzzle.givens[i] ?? 0) > 0 ? 0 : v)));
    case "bridges":
      return encodeBridges(puzzle.solution ?? []);
    case "kakuro":
      return encodeKakuro(puzzle.solution ?? []);
    default:
      throw new Error(`${puzzle.type} is not a grid puzzle`);
  }
}
