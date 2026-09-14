import { pick, shuffled } from "./random";
import { puzzleDef, puzzleCategories, typesInCategory } from "./registry";
import { TOTAL_ROUNDS, type PuzzleData, type PuzzleType } from "./types";

export function checkAnswer(puzzle: PuzzleData, answer: string): boolean {
  return puzzleDef(puzzle.type).check(answer, puzzle);
}

/**
 * Generated ONCE when a duel is created and stored in the database so both
 * players receive identical puzzles in an identical order.
 *
 * Rounds come from three different categories, one type picked at random from
 * each — so a duel never repeats a category or a type.
 */
export function buildDuelPuzzles(): { roundOrder: PuzzleType[]; puzzles: PuzzleData[] } {
  const categories = shuffled(puzzleCategories()).slice(0, TOTAL_ROUNDS);
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
