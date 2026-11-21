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
/**
 * Joe's phone-test notes (27 Oct 2026, swapwordRev 6; docs/phone-notes-oct-2026.md): rev 5's boards, par and
 * scoring with 4 more swaps (budget minimum + 12).
 */
export const SWAPWORD_REV_NOTES = 6;
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
/** Rev 6: extra swaps on top of the proven minimum (rev 3's 8 plus 4). */
export const SW6_SPARE_SWAPS = 12;

/** Swap budget for a board of this revision (stored on the puzzle as maxSwaps; the grader reads the stored value). */
export function swapwordBudget(minSwaps: number, rev: number): number {
  if (rev >= SWAPWORD_REV_NOTES) return minSwaps + SW6_SPARE_SWAPS;
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

/* ------------------------------------------------------------------------------------------------ lattices (rev 8) */

/**
 * Swapword's lattices (D1, 21 Nov 2026; swapwordRev 8 on Hard and Expert deals only): a board is a lattice of tile
 * squares and word slots, stored on the puzzle (`lattice`) so a stored round keeps its board. Every puzzle without one is
 * on today's 21-tile figure eight (Easy, Normal and every round before), whose numbers above are unchanged.
 */
export const SWAPWORD_REV_LATTICE = 8;

export interface SwLattice {
  cols: number;
  rows: number;
  /** Grid cell (row × cols + col) of each tile, in reading order. */
  cells: readonly number[];
  /** The words: across first (top to bottom), then down (left to right). */
  slots: readonly SwSlot[];
}

/** Today's figure eight (Easy, Normal and every round dealt before the lattices). */
export const SW_NORMAL_LATTICE: SwLattice = { cols: SW_COLS, rows: SW_ROWS, cells: SW_TILE_CELLS, slots: SW_SLOTS };

/** The lattice from its slots: every slot's squares are tiles, in reading order. */
export function swLatticeFromSlots(cols: number, rows: number, slots: readonly SwSlot[]): SwLattice {
  const cells = new Set<number>();
  for (const s of slots) for (let i = 0; i < s.len; i++) cells.add(s.across ? s.row * cols + s.col + i : (s.row + i) * cols + s.col);
  return { cols, rows, cells: [...cells].sort((a, b) => a - b), slots: [...slots] };
}

/**
 * Hard's three loops (8 × 8, 30 tiles, 8 words): four 6-letter words make the middle loop (across rows 2 and 5, down
 * columns 2 and 5), and four 4-letter words close a loop at the top left and one at the bottom right.
 *
 *     0 1 2 3 4 5 6 7
 *   0 A A A A . . . .
 *   1 A . A . . . . .
 *   2 A A A A A A . .
 *   3 A . A . . A . .
 *   4 . . A . . A . A
 *   5 . . A A A A A A
 *   6 . . . . . A . A
 *   7 . . . . A A A A
 */
export const SW_HARD_LATTICE: SwLattice = swLatticeFromSlots(8, 8, [
  { row: 0, col: 0, across: true, len: 4 },
  { row: 2, col: 0, across: true, len: 6 },
  { row: 5, col: 2, across: true, len: 6 },
  { row: 7, col: 4, across: true, len: 4 },
  { row: 0, col: 0, across: false, len: 4 },
  { row: 0, col: 2, across: false, len: 6 },
  { row: 2, col: 5, across: false, len: 6 },
  { row: 4, col: 7, across: false, len: 4 },
]);

/** Expert's four-loop window (7 × 7, 33 tiles): six 7-letter words on rows and columns 1, 4 and 7. */
export const SW_EXPERT_LATTICE: SwLattice = swLatticeFromSlots(7, 7, [
  { row: 0, col: 0, across: true, len: 7 },
  { row: 3, col: 0, across: true, len: 7 },
  { row: 6, col: 0, across: true, len: 7 },
  { row: 0, col: 0, across: false, len: 7 },
  { row: 0, col: 3, across: false, len: 7 },
  { row: 0, col: 6, across: false, len: 7 },
]);

export interface SwGeometry {
  tiles: number;
  slotTiles: readonly (readonly number[])[];
  tileSlots: readonly (readonly number[])[];
  /** Tile index of each grid cell (−1 for a gap). */
  tileOfCell: readonly number[];
}

const geometries = new Map<string, SwGeometry>();

/** A lattice's tiles, slots and cells (cached per lattice). */
export function swGeometry(lattice: SwLattice = SW_NORMAL_LATTICE): SwGeometry {
  if (lattice === SW_NORMAL_LATTICE) return NORMAL_GEOMETRY;
  const key = `${lattice.cols}x${lattice.rows}:${lattice.cells.join(".")}:${lattice.slots.map((s) => `${s.row},${s.col},${s.across ? 1 : 0},${s.len}`).join(";")}`;
  const known = geometries.get(key);
  if (known) return known;
  const made = buildGeometry(lattice);
  geometries.set(key, made);
  return made;
}

function buildGeometry(lattice: SwLattice): SwGeometry {
  const tileOfCell = Array.from({ length: lattice.cols * lattice.rows }, () => -1);
  lattice.cells.forEach((cell, t) => (tileOfCell[cell] = t));
  const slotTiles = lattice.slots.map((s) =>
    Array.from({ length: s.len }, (_, i) => {
      const cell = s.across ? s.row * lattice.cols + s.col + i : (s.row + i) * lattice.cols + s.col;
      const tile = tileOfCell[cell] ?? -1;
      if (tile < 0) throw new Error(`Swapword lattice: cell ${cell} is not a tile`);
      return tile;
    }),
  );
  const tileSlots = Array.from({ length: lattice.cells.length }, (_, t) => slotTiles.flatMap((tiles, s) => (tiles.includes(t) ? [s] : [])));
  return { tiles: lattice.cells.length, slotTiles, tileSlots, tileOfCell };
}

const NORMAL_GEOMETRY: SwGeometry = { tiles: SW_TILES, slotTiles: SW_SLOT_TILES, tileSlots: SW_TILE_SLOTS, tileOfCell: Array.from({ length: SW_COLS * SW_ROWS }, (_, cell) => TILE_OF_CELL.get(cell) ?? -1) };

/** The lattice a stored puzzle is on: its own (rev 8 level deals), else today's figure eight. */
export function swLatticeOf(puzzle: { lattice?: SwLattice } | null | undefined): SwLattice {
  return puzzle?.lattice ?? SW_NORMAL_LATTICE;
}

export type SwSwap = [number, number];

/** The swap list a phone sent, read for a board of `tiles` tiles (today's 21 unless the puzzle's lattice says). */
export function decodeSwapword(answer: string, tiles: number = SW_TILES): SwSwap[] {
  const out: SwSwap[] = [];
  for (const raw of String(answer ?? "").split(",").slice(0, SW_MAX_ACTIONS)) {
    const m = /^(\d{1,2})-(\d{1,2})$/.exec(raw.trim());
    if (!m) continue;
    const a = Number(m[1]), b = Number(m[2]);
    if (a === b || a >= tiles || b >= tiles) continue;
    out.push([a, b]);
  }
  return out;
}

/** The swap list a phone sent for a stored puzzle, on its own lattice's tiles (rev 8) or today's 21. */
export function decodeSwapwordFor(puzzle: { lattice?: SwLattice } | null | undefined, answer: string): SwSwap[] {
  return decodeSwapword(answer, swGeometry(swLatticeOf(puzzle)).tiles);
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
export function swapwordMarks(board: string, solution: string, lattice: SwLattice = SW_NORMAL_LATTICE): SwMark[] {
  const g = swGeometry(lattice);
  const marks: SwMark[] = Array.from({ length: g.tiles }, (_, t) => (board[t] === solution[t] ? 2 : 0));
  for (const tiles of g.slotTiles) {
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
  // Every tile of the board (today's 21, or a lattice's own: the strings are the board's length).
  for (let t = 0; t < Math.max(SW_TILES, start.length); t++) if (board[t] === solution[t] && start[t] !== solution[t]) placed++;
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
