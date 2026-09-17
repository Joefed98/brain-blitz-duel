import { pick } from "./random";
import { puzzleDef } from "./registry";
import { type PuzzleData } from "./types";

export function checkAnswer(puzzle: PuzzleData, answer: string): boolean {
  return puzzleDef(puzzle.type).check(answer, puzzle);
}


const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += pick(CODE_LETTERS.split(""));
  return code;
}
