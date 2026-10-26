/**
 * Swapword rules, shared by the phone (board, reveal) and the server (live
 * checks, grading, generation).
 *
 * Board (swapwordRev 1): a 6 × 6 "figure eight" of 21 tiles: two 4 × 4 word
 * loops sharing the centre crossing — six words, two of six letters crossing
 * in the middle and four of four letters.
 *
 *     0 1 2 3 4 5
 *   0 A A A A . .     across: row 0 cols 0–3, row 3 cols 0–5, row 5 cols 2–5
 *   1 A . . A . .     down:   col 0 rows 0–3, col 3 rows 0–5, col 5 rows 2–5
 *   2 A . . A . A
 *   3 A A A A A A
 *   4 . . . A . A
 *   5 . . A A A A
 *
 * The answer is the swap list "i-j,…" (tile indices in reading order). Only the
 * letters move; the phone always knows the board, while the in-place /
 * needed-elsewhere marks come from the server, which holds the solution.
 */

import { finishParts, partialParts, scoreRev1, PUZZLE_SPEED_POINTS } from "./puzzleScoreRev";
import { movesPoints, speedPoints } from "./scoring";
import type { ParBonusCurve } from "./parBonus";

/**
 * Rev 1: budget minimum + 5. Rev 2 (14 Oct 2026): budget max(16, minimum + 5); same boards.
 * Rev 3 (19 Oct 2026): budget minimum + 8 (17–20 on the 9–12 minimum boards); same boards.
 */
export const SWAPWORD_REV = 4;
export const SWAPWORD_REV2 = 2;
export const SWAPWORD_REV3 = 3;
/**
 * Par swaps (25 Oct 2026, word depth d1; parBonus.ts): rev 3's rules and boards, scoring up to 200, the extra 50
 * only for a finish in the board's proven fewest swaps (`minSwaps`, the par).
 */
export const SWAPWORD_REV_PAR = 4;
export const SWAP_PAR_BONUS: ParBonusCurve = { base: 6, fast: 0.75, elite: 0.89, power: 2 };
/**
 * The puzzle top-up (26 Oct 2026, swapwordRev 5; docs/depth/topup-oct-2026.md): rev 4's boards, budget and par;
 * making par pays a little more at any pace, so today's near-perfect player lands about 165–175.
 */
export const SWAPWORD_REV_TOPUP = 5;
export const SWAP_PAR_BONUS_TOPUP: ParBonusCurve = { base: 15, fast: 0.75, elite: 0.89, power: 2 };
/** The par bonus a stored round's stamp scores on. */
export function swapParBonusFor(rev: number): ParBonusCurve {
  return rev >= SWAPWORD_REV_TOPUP ? SWAP_PAR_BONUS_TOPUP : SWAP_PAR_BONUS;
}
export const SW_COLS = 6;
export const SW_ROWS = 6;
/** Grid cell (row × 6 + col) of each tile, in reading order. */
export const SW_TILE_CELLS: readonly number[] = [0, 1, 2, 3, 6, 9, 12, 15, 17, 18, 19, 20, 21, 22, 23, 27, 29, 32, 33, 34, 35];
export const SW_TILES = SW_TILE_CELLS.length;
/** Extra swaps on top of the proven minimum. */
export const SW_SPARE_SWAPS = 5;
/** Rev 2: the budget never drops below this. */
export const SW_MIN_BUDGET = 16;
/** Rev 3: extra swaps on top of the proven minimum. */
export const SW3_SPARE_SWAPS = 8;

/** Swap budget for a board of this revision (stored on the puzzle as maxSwaps; the grader reads the stored value). */
export function swapwordBudget(minSwaps: number, rev: number): number {
  if (rev >= SWAPWORD_REV3) return minSwaps + SW3_SPARE_SWAPS;
  return rev >= SWAPWORD_REV2 ? Math.max(SW_MIN_BUDGET, minSwaps + SW_SPARE_SWAPS) : minSwaps + SW_SPARE_SWAPS;
}
export const SW_MAX_ACTIONS = 60;

export interface SwSlot {
  row: number;
  col: number;
  across: boolean;
  len: number;
}

/** The six words: across first (top to bottom), then down (left to right). */
export const SW_SLOTS: readonly SwSlot[] = [
  { row: 0, col: 0, across: true, len: 4 },
  { row: 3, col: 0, across: true, len: 6 },
  { row: 5, col: 2, across: true, len: 4 },
  { row: 0, col: 0, across: false, len: 4 },
  { row: 0, col: 3, across: false, len: 6 },
  { row: 2, col: 5, across: false, len: 4 },
];

const TILE_OF_CELL = new Map(SW_TILE_CELLS.map((cell, tile) => [cell, tile]));

/** Tile indices of each slot, in reading order. */
export const SW_SLOT_TILES: readonly (readonly number[])[] = SW_SLOTS.map((s) =>
  Array.from({ length: s.len }, (_, i) => {
    const cell = s.across ? s.row * SW_COLS + s.col + i : (s.row + i) * SW_COLS + s.col;
    const tile = TILE_OF_CELL.get(cell);
    if (tile === undefined) throw new Error(`Swapword layout: cell ${cell} is not a tile`);
    return tile;
  }),
);

/** Slots through each tile. */
export const SW_TILE_SLOTS: readonly (readonly number[])[] = Array.from({ length: SW_TILES }, (_, t) =>
  SW_SLOT_TILES.flatMap((tiles, s) => (tiles.includes(t) ? [s] : [])),
);

export type SwSwap = [number, number];

export function decodeSwapword(answer: string): SwSwap[] {
  const out: SwSwap[] = [];
  for (const raw of String(answer ?? "").split(",").slice(0, SW_MAX_ACTIONS)) {
    const m = /^(\d{1,2})-(\d{1,2})$/.exec(raw.trim());
    if (!m) continue;
    const a = Number(m[1]), b = Number(m[2]);
    if (a === b || a >= SW_TILES || b >= SW_TILES) continue;
    out.push([a, b]);
  }
  return out;
}

export function encodeSwapword(swaps: readonly SwSwap[]): string {
  return swaps.map(([a, b]) => `${a}-${b}`).join(",");
}

export interface SwReplay {
  board: string;
  /** Swaps that counted (stops at the budget or once solved). */
  swaps: number;
  solved: boolean;
  /** Out of swaps and not solved. */
  over: boolean;
}

/** Applies the swaps in order; swaps after the board is solved or the budget is spent are ignored. */
export function replaySwapword(
  start: string,
  swaps: readonly SwSwap[],
  maxSwaps: number,
  solution?: string,
): SwReplay {
  const board = [...start];
  let used = 0;
  let solved = solution !== undefined && board.join("") === solution;
  for (const [a, b] of swaps) {
    if (solved || used >= maxSwaps) break;
    [board[a], board[b]] = [board[b]!, board[a]!];
    used++;
    if (solution !== undefined && board.join("") === solution) solved = true;
  }
  return { board: board.join(""), swaps: used, solved, over: !solved && used >= maxSwaps };
}

/** Tile marks: 2 = in place, 1 = needed elsewhere in a word through this tile, 0 = neither. */
export type SwMark = 0 | 1 | 2;

/**
 * Marks for a board. A tile not in place is "needed elsewhere" when a word
 * through it still needs its letter at another tile. Duplicates are counted per
 * word: a word that still needs k copies of a letter marks only its first k
 * misplaced tiles holding that letter (reading order).
 */
export function swapwordMarks(board: string, solution: string): SwMark[] {
  const marks: SwMark[] = Array.from({ length: SW_TILES }, (_, t) => (board[t] === solution[t] ? 2 : 0));
  for (const tiles of SW_SLOT_TILES) {
    const needed = new Map<string, number>();
    for (const t of tiles) if (marks[t] !== 2) needed.set(solution[t]!, (needed.get(solution[t]!) ?? 0) + 1);
    for (const t of tiles) {
      if (marks[t] === 2) continue;
      const letter = board[t]!;
      const left = needed.get(letter) ?? 0;
      if (left <= 0) continue;
      needed.set(letter, left - 1);
      marks[t] = 1;
    }
  }
  return marks;
}

/** Tiles in place now that were not in place at the start. */
export function swapwordPlaced(start: string, board: string, solution: string): number {
  let placed = 0;
  for (let t = 0; t < SW_TILES; t++) if (board[t] === solution[t] && start[t] !== solution[t]) placed++;
  return placed;
}

/**
 * Solved: 100 + MOVES(25, swaps, minimum) + SPEED(25) (Shape B), cap 150.
 * Otherwise 5 per tile the player put in place, cap 100.
 */
export function scoreSwapword(
  solved: boolean,
  swaps: number,
  minSwaps: number,
  placed: number,
  msRemaining: number,
  timeLimitMs: number,
  toPlace = 0,
): number {
  if (scoreRev1()) {
    // Rev 1: 120 + MOVES(15) + PAR(15); unfinished 110 × tiles placed ÷ (tiles to place − 2), as the last swap places two;
    // the grader passes placed less the tiles that started in place and were moved out, so random swaps earn about 0.
    if (solved) return finishParts(speedPoints(PUZZLE_SPEED_POINTS, msRemaining, timeLimitMs), movesPoints(15, swaps, minSwaps), "swaps");
    return partialParts((110 * Math.max(0, placed)) / Math.max(1, toPlace - 2));
  }
  if (solved) {
    return Math.min(150, 100 + movesPoints(25, swaps, minSwaps) + speedPoints(25, msRemaining, timeLimitMs));
  }
  return Math.min(100, 5 * Math.max(0, placed));
}

/** What the phone sees after a swap: the marks and the swap count, never the solution. */
export interface SwView {
  marks: SwMark[];
  swaps: number;
  solved: boolean;
  over: boolean;
  count: number;
}
