/** STUB (skeleton): replaced by the real stage, reveal and intro example. */
import { gameDisplayName } from "@/lib/duel/gameNames";
import { FENCES_TIME_MS, FENCES_SIZE } from "@/lib/duel/types";
import { fencesSolved } from "@/lib/duel/fences";
import type { PuzzleDefinition } from "./types";

export const fencesPuzzle: PuzzleDefinition = {
  key: "fences",
  name: gameDisplayName("fences"),
  category: "logic",
  timeLimitMs: FENCES_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "fences", fencesRev: 1, size: FENCES_SIZE, clues: new Array(FENCES_SIZE * FENCES_SIZE).fill(-1), solution: [] }),
  check: (answer, puzzle) => puzzle.type === "fences" && fencesSolved(puzzle, answer),
  revealHeading: "The solution",
  IntroExample: () => null,
  Stage: () => null,
  Reveal: () => null,
};
