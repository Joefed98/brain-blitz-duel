/**
 * Which saved intro demos still play for the Logic overhaul's seven games (session 1, 15 Nov 2026). Shared and pure;
 * getIntroDemoFn (introDemo.functions.ts) asks it before serving a demo, so an old demo stops where the game changed.
 *
 *  - Minefield (an engine game): only a run recorded on minesRev 3, today's Normal, plays. The Hard level is minesRev 2,
 *    but intros are Normal's, so a minesRev 2 demo (the old 20-mine Normal) shows the still until one is recorded.
 *  - The six puzzle games (coordinate demos): their boards moved with the new look and levels, so their demos are held
 *    to the new presentation (wordInput.ts LOGIC_OVERHAUL1_PRESENTATION); a demo of a level other than Normal never plays.
 */
import { MINES_REV_NORMAL } from "@/lib/arcade/minesweeper";
import { puzzleLevel } from "@/lib/levels/levels";

import type { PuzzleData } from "./types";

export const LOGIC_OVERHAUL1_GAMES = ["sudoku", "tubes", "tower", "safe", "nonogram", "flood", "minesweeper"] as const;

export function logicDemoPlays(type: string, puzzle: PuzzleData | null | undefined): boolean {
  if (!(LOGIC_OVERHAUL1_GAMES as readonly string[]).includes(type)) return true;
  if (!puzzle || puzzleLevel(puzzle) !== "normal") return false;
  if (type === "minesweeper") return puzzle.type === "minesweeper" && puzzle.minesRev === MINES_REV_NORMAL;
  return true;
}
