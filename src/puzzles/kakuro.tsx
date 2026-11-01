/** STUB (skeleton): replaced by the real stage, reveal and intro example. */
import { gameDisplayName } from "@/lib/duel/gameNames";
import { KAKURO_TIME_MS, KAKURO_SIZE } from "@/lib/duel/types";
import { kakuroSolved } from "@/lib/duel/kakuro";
import type { PuzzleDefinition } from "./types";

export const kakuroPuzzle: PuzzleDefinition = {
  key: "kakuro",
  name: gameDisplayName("kakuro"),
  category: "number",
  timeLimitMs: KAKURO_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "kakuro", kakuroRev: 1, size: KAKURO_SIZE, white: [], clues: [], solution: [] }),
  check: (answer, puzzle) => puzzle.type === "kakuro" && kakuroSolved(puzzle, answer),
  revealHeading: "The solution",
  IntroExample: () => null,
  Stage: () => null,
  Reveal: () => null,
};
