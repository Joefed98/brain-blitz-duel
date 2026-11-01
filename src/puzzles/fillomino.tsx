/** STUB (skeleton): replaced by the real stage, reveal and intro example. */
import { gameDisplayName } from "@/lib/duel/gameNames";
import { FILLOMINO_TIME_MS, FILLOMINO_SIZE } from "@/lib/duel/types";
import { fillominoSolved } from "@/lib/duel/fillomino";
import type { PuzzleDefinition } from "./types";

export const fillominoPuzzle: PuzzleDefinition = {
  key: "fillomino",
  name: gameDisplayName("fillomino"),
  category: "logic",
  timeLimitMs: FILLOMINO_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "fillomino", fillominoRev: 1, size: FILLOMINO_SIZE, givens: new Array(FILLOMINO_SIZE * FILLOMINO_SIZE).fill(0), solution: [] }),
  check: (answer, puzzle) => puzzle.type === "fillomino" && fillominoSolved(puzzle, answer),
  revealHeading: "The solution",
  IntroExample: () => null,
  Stage: () => null,
  Reveal: () => null,
};
