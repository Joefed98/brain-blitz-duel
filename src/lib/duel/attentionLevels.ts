/**
 * The Attention games' levels (the Attention overhaul, stage 3, 15 Nov 2026): what a dealt puzzle's level means to its
 * stage and grader, read from the stored puzzle only (its `level`, absent at Normal; its board; its `timeLimitMs`).
 * The levers themselves are plain data in src/lib/levels/attentionLevels.data.ts. Shared and pure.
 *
 * Every puzzle without a level reads exactly as before: each helper gives today's figure for it.
 */
import { NORMAL, puzzleLevel, type Level } from "@/lib/levels/levels";
import { MAZE_LEVELS, PAIR_LEVELS, SCAN_LEVELS, SPOT_LEVELS, TALLY_LEVELS, BOMB_LEVELS, type BombLevel, type MazeLevel, type PairLevel, type ScanLevel, type SpotLevel, type TallyLevel } from "@/lib/levels/attentionLevels.data";
import { PAIR_CARDS, PAIR_FLIP_BACK_MS, PAIR_PAIRS, SPOT_COLS, SPOT_DIFFERENCES, SPOT_ROWS, type BombPuzzleData, type CountUpPuzzleData, type MazePuzzleData, type PairPuzzleData, type SpotPuzzleData } from "./types";

/** True when the puzzle was dealt at a level other than Normal. */
export const leveled = (puzzle: unknown): boolean => puzzleLevel(puzzle) !== NORMAL;

/* ------------------------------------------------------------------ Matchmaker */

/** The puzzle's Matchmaker level row (Normal's for every puzzle without a level). */
export function pairLevel(puzzle: PairPuzzleData | null | undefined): PairLevel {
  return PAIR_LEVELS[puzzleLevel(puzzle)];
}

/** Pairs a board needs for a finish: a level's board holds its own count; every other board needs today's fifteen. */
export function pairsOf(puzzle: PairPuzzleData | null | undefined): number {
  return puzzle && leveled(puzzle) ? Math.floor(puzzle.cards.length / 2) : PAIR_PAIRS;
}

/** Card indices a board accepts in an answer: a level's own board, else today's thirty (every older answer reads as before). */
export function pairCardsOf(puzzle: PairPuzzleData | null | undefined): number {
  return puzzle && leveled(puzzle) ? puzzle.cards.length : PAIR_CARDS;
}

/** How long a miss stays face up. */
export function pairFlipBackMs(puzzle: PairPuzzleData | null | undefined): number {
  return puzzle && leveled(puzzle) ? pairLevel(puzzle).flipBackMs : PAIR_FLIP_BACK_MS;
}

/** The board's columns at a level (null: the board keeps today's layout). */
export function pairLevelCols(puzzle: PairPuzzleData | null | undefined): number | null {
  return puzzle && leveled(puzzle) ? pairLevel(puzzle).cols : null;
}

export type { Level };

/** The share of a finish's extras a level keeps for `misses` mismatched tries (1 on Easy, Normal and older boards). */
export function pairExtrasShare(puzzle: PairPuzzleData | null | undefined, misses: number): number {
  if (!puzzle || !leveled(puzzle)) return 1;
  const { extrasFullAt: full, extrasZeroAt: zero } = pairLevel(puzzle);
  if (full === null || zero === null || zero <= full) return 1;
  return Math.max(0, Math.min(1, (zero - misses) / (zero - full)));
}

/* ------------------------------------------------------------------ Labyrinth */

/** The puzzle's Labyrinth level row (Normal's for every puzzle without a level). */
export function mazeLevel(puzzle: MazePuzzleData | null | undefined): MazeLevel {
  return MAZE_LEVELS[puzzleLevel(puzzle)];
}

/** Expert: the exit stays hidden until the trail's head is this close (cells, along rows and columns); null: always shown. */
export function mazeExitRevealCells(puzzle: MazePuzzleData | null | undefined): number | null {
  if (!puzzle || !leveled(puzzle)) return null;
  const row = mazeLevel(puzzle);
  return row.exitHidden ? row.exitRevealCells : null;
}

/** Whether the exit is drawn with the trail's head at `head` (always, but on Expert until it is within reach). */
export function mazeExitShown(puzzle: MazePuzzleData, head: number, cols: number): boolean {
  const reach = mazeExitRevealCells(puzzle);
  if (reach === null) return true;
  const d = Math.abs((head % cols) - (puzzle.exit % cols)) + Math.abs(Math.floor(head / cols) - Math.floor(puzzle.exit / cols));
  return d <= reach;
}

/* ------------------------------------------------------------------ Double Take */

export function spotLevel(puzzle: SpotPuzzleData | null | undefined): SpotLevel {
  return SPOT_LEVELS[puzzleLevel(puzzle)];
}

/** A picture's grid: a level's own, else today's 8 × 6. */
export function spotGridOf(puzzle: SpotPuzzleData | null | undefined): { cols: number; rows: number } {
  if (!puzzle || !leveled(puzzle)) return { cols: SPOT_COLS, rows: SPOT_ROWS };
  const row = spotLevel(puzzle);
  return { cols: row.cols, rows: row.rows };
}

/** Differences in each picture: a level's own count, else today's six. */
export function spotPerPicture(puzzle: SpotPuzzleData | null | undefined): number {
  return puzzle && leveled(puzzle) ? spotLevel(puzzle).differences : SPOT_DIFFERENCES;
}

/* ------------------------------------------------------------------ Eagle Eye */

export function scanLevel(puzzle: unknown): ScanLevel {
  return SCAN_LEVELS[puzzleLevel(puzzle)];
}

/* ------------------------------------------------------------------ Tally */

export function tallyLevel(puzzle: CountUpPuzzleData | null | undefined): TallyLevel {
  return TALLY_LEVELS[puzzleLevel(puzzle)];
}

/** Trays a finish needs: a level's own count (Easy three), else today's four. */
export function tallyTrays(puzzle: CountUpPuzzleData | null | undefined): number {
  return puzzle && leveled(puzzle) ? puzzle.stages.length : 4;
}

/** Whether shapes can be tapped to mark them as counted (off on Expert; on for every other round that has marks). */
export function tallyMarks(puzzle: CountUpPuzzleData | null | undefined): boolean {
  return !puzzle || !leveled(puzzle) || tallyLevel(puzzle).marks;
}

/* ------------------------------------------------------------------ Bomb Defusal */

export function bombLevel(puzzle: BombPuzzleData | null | undefined): BombLevel {
  return BOMB_LEVELS[puzzleLevel(puzzle)];
}

/* ------------------------------------------------------------------ The levels in the help */

const secs = (ms: number) => `${Math.round(ms / 1000)} s`;
const grids = (g: readonly number[]) => g.map((n) => `${n}×${n}`).join(", ");

/**
 * Each game's levels in one plain help line, from the level data itself (so the help can never drift from the deal).
 * Normal is today's game; Rated play and the Daily are always Normal.
 */
export const ATTENTION_LEVEL_HELP: Readonly<Record<"symscan" | "spotdiff" | "countup" | "maze" | "bomb" | "pairmatch", string>> = {
  symscan: `Easy ${grids(SCAN_LEVELS.easy.grids)}, fewer look-alikes; Hard ${grids(SCAN_LEVELS.hard.grids)}, two targets from grid 2; Expert three ${SCAN_LEVELS.expert.grids[0]}×${SCAN_LEVELS.expert.grids[0]} grids, two targets on every grid. Every level 60 s.`,
  spotdiff: `Easy ${SPOT_LEVELS.easy.cols}×${SPOT_LEVELS.easy.rows}, ${SPOT_LEVELS.easy.differences} colour or shape changes a picture; Hard ${SPOT_LEVELS.hard.differences} a picture, subtler colours; Expert ${SPOT_LEVELS.expert.cols}×${SPOT_LEVELS.expert.rows}, ${SPOT_LEVELS.expert.differences} a picture, more turns, ${secs(SPOT_LEVELS.expert.timeLimitMs)}.`,
  countup: `Easy three smaller trays; Hard three near-miss groups and a closer comparison; Expert bigger trays, two-colour questions, no marks, ${secs(TALLY_LEVELS.expert.timeLimitMs)}.`,
  maze: `Easy ${MAZE_LEVELS.easy.cols}×${MAZE_LEVELS.easy.rows}; Hard ${MAZE_LEVELS.hard.cols}×${MAZE_LEVELS.hard.rows}, a longer route, ${secs(MAZE_LEVELS.hard.timeLimitMs)}; Expert the same size, the exit hidden until you’re near, ${secs(MAZE_LEVELS.expert.timeLimitMs)}.`,
  bomb: `Easy ${BOMB_LEVELS.easy.wires} wires, ${BOMB_LEVELS.easy.steps} steps; Hard ${BOMB_LEVELS.hard.wires} wires, ${BOMB_LEVELS.hard.steps} steps; Expert ${BOMB_LEVELS.expert.wires} wires, ${BOMB_LEVELS.expert.steps} steps, ${secs(BOMB_LEVELS.expert.timeLimitMs)}, and a wrong step sets it off at once (no Reset).`,
  pairmatch: `Easy ${PAIR_LEVELS.easy.pairs} pairs; Hard ${PAIR_LEVELS.hard.pairs} pairs, quicker flip-back, more shared shapes; Expert ${PAIR_LEVELS.expert.pairs} pairs, ${secs(PAIR_LEVELS.expert.timeLimitMs)}. Fewer misses keep more of the bonuses on Hard and Expert.`,
};
