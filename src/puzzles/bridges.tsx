/** STUB (skeleton): replaced by the real stage, reveal and intro example. */
import { gameDisplayName } from "@/lib/duel/gameNames";
import { BRIDGES_TIME_MS, BRIDGES_SIZE } from "@/lib/duel/types";
import { bridgesSolved } from "@/lib/duel/bridges";
import type { PuzzleDefinition } from "./types";

export const bridgesPuzzle: PuzzleDefinition = {
  key: "bridges",
  name: gameDisplayName("bridges"),
  category: "logic",
  timeLimitMs: BRIDGES_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "bridges", bridgesRev: 1, size: BRIDGES_SIZE, islands: [], solution: [] }),
  check: (answer, puzzle) => puzzle.type === "bridges" && bridgesSolved(puzzle, answer),
  revealHeading: "The solution",
  IntroExample: () => null,
  Stage: () => null,
  Reveal: () => null,
};
