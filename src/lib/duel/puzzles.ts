import { pick, shuffled } from "./random";
import { puzzleDef, puzzleCategories, typesInCategory } from "./registry";
import { TOTAL_ROUNDS, type PuzzleData, type PuzzleType } from "./types";

export function checkAnswer(puzzle: PuzzleData, answer: string): boolean {
  return puzzleDef(puzzle.type).check(answer, puzzle);
}

/**
 * One type is picked at random from each category, then the categories are
 * shuffled — so a room never repeats a category or a type.
 */
export function pickRoundOrder(rounds: number = TOTAL_ROUNDS): PuzzleType[] {
  const categories = shuffled(puzzleCategories()).slice(0, rounds);
  return shuffled(categories.map((category) => pick(typesInCategory(category))));
}

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += pick(CODE_LETTERS.split(""));
  return code;
}
