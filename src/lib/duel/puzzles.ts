import { pick, shuffled } from "./random";
import { puzzleDef, puzzleCategories, typesInCategory } from "./registry";
import { TOTAL_ROUNDS, type PuzzleData, type PuzzleType } from "./types";

export function checkAnswer(puzzle: PuzzleData, answer: string): boolean {
  return puzzleDef(puzzle.type).check(answer, puzzle);
}

/**
 * Generated ONCE when a room starts and stored in the database so every player
 * receives identical puzzles in an identical order.
 *
 * One type is picked at random from each category, then the categories are
 * shuffled — so a room never repeats a category or a type.
 */
export function buildRoomPuzzles(rounds: number = TOTAL_ROUNDS): {
  roundOrder: PuzzleType[];
  puzzles: PuzzleData[];
} {
  const categories = shuffled(puzzleCategories()).slice(0, rounds);
  const roundOrder = shuffled(categories.map((category) => pick(typesInCategory(category))));
  return {
    roundOrder,
    puzzles: roundOrder.map((type) => puzzleDef(type).generate()),
  };
}

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += pick(CODE_LETTERS.split(""));
  return code;
}
