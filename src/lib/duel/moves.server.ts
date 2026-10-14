import type { MovesView } from "./moves";
import { MOVES_MAX_CHARS } from "./moves";
import type { PuzzleData } from "./types";

/** Replays one player's moves against the full stored puzzle; null for other types. */
export async function checkPuzzleMoves(puzzle: PuzzleData, rawMoves: unknown): Promise<MovesView | null> {
  const moves = typeof rawMoves === "string" ? rawMoves.slice(0, MOVES_MAX_CHARS) : "";
  if (puzzle.type === "strikeout") {
    const { checkStrikeoutMoves } = await import("./strikeout.server");
    return { type: "strikeout", ...checkStrikeoutMoves(puzzle, moves) };
  }
  if (puzzle.type === "codeword") {
    const { checkCodewordMoves } = await import("./codeword.server");
    return { type: "codeword", ...checkCodewordMoves(puzzle, moves) };
  }
  if (puzzle.type === "swapword") {
    const { checkSwapwordMoves } = await import("./swapword.server");
    return { type: "swapword", ...checkSwapwordMoves(puzzle, moves) };
  }
  return null;
}
