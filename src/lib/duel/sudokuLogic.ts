/**
 * Box Six's logic grader (the Logic overhaul's levels, 15 Nov 2026): solves a 6 × 6 board the way a person does, one
 * deducible step at a time, never a guess, and says which steps it needed. The levels deal from it (logicLevels.ts):
 *
 *  - "singles": naked singles (a square with one digit left) and hidden singles (a digit with one place left in a row,
 *    column or box) are enough;
 *  - "advanced": the board also needs at least one of a naked pair (two squares of a unit holding the same two digits),
 *    pointing (a digit confined to one row or column inside a box) or box-line reduction (a digit confined to one box
 *    inside a row or column). Each removes candidates, after which singles carry on.
 *
 * A board this solver can't finish is never dealt at any level: every level's board is humanly solvable by logic.
 * Shared and pure (the checks run it too).
 */
import { SUDOKU_BOX_COLS, SUDOKU_BOX_ROWS, SUDOKU_CELLS, SUDOKU_COLS } from "./types";

const N = SUDOKU_COLS;
const ALL = (1 << N) - 1;

/** The 18 units: six rows, six columns, six 2 × 3 boxes. */
export const SUDOKU_UNITS: readonly (readonly number[])[] = (() => {
  const units: number[][] = [];
  for (let r = 0; r < N; r++) units.push(Array.from({ length: N }, (_, c) => r * N + c));
  for (let c = 0; c < N; c++) units.push(Array.from({ length: N }, (_, r) => r * N + c));
  for (let br = 0; br < N / SUDOKU_BOX_ROWS; br++)
    for (let bc = 0; bc < N / SUDOKU_BOX_COLS; bc++) {
      const box: number[] = [];
      for (let r = 0; r < SUDOKU_BOX_ROWS; r++)
        for (let c = 0; c < SUDOKU_BOX_COLS; c++) box.push((br * SUDOKU_BOX_ROWS + r) * N + bc * SUDOKU_BOX_COLS + c);
      units.push(box);
    }
  return units;
})();

const PEERS: readonly (readonly number[])[] = Array.from({ length: SUDOKU_CELLS }, (_, cell) => {
  const set = new Set<number>();
  for (const unit of SUDOKU_UNITS) if (unit.includes(cell)) for (const c of unit) if (c !== cell) set.add(c);
  return [...set];
});

const bitCount = (m: number) => {
  let n = 0;
  for (let x = m; x; x &= x - 1) n++;
  return n;
};
const onlyDigit = (m: number) => 31 - Math.clz32(m) + 1;

export type SudokuStepKind = "naked" | "hidden" | "pair" | "pointing" | "boxline";

export interface SudokuLogicResult {
  /** True when the steps filled every square. */
  solved: boolean;
  /** Each step in order (singles place a digit; the rest remove candidates). */
  steps: SudokuStepKind[];
  /** Advanced steps used (pairs, pointing, box-line). */
  advanced: number;
  /** The grid reached. */
  grid: number[];
}

/** Solves `givens` (0 = blank) by human steps only. With `singlesOnly`, never uses an advanced step. */
export function sudokuLogicSolve(givens: readonly number[], singlesOnly = false): SudokuLogicResult {
  const grid = [...givens];
  const cand = new Array<number>(SUDOKU_CELLS).fill(ALL);
  const steps: SudokuStepKind[] = [];
  let advanced = 0;
  const place = (cell: number, digit: number) => {
    grid[cell] = digit;
    cand[cell] = 0;
    for (const p of PEERS[cell]!) cand[p] = cand[p]! & ~(1 << (digit - 1));
  };
  for (let cell = 0; cell < SUDOKU_CELLS; cell++) if (grid[cell]) {
    const d = grid[cell]!;
    cand[cell] = 0;
    for (const p of PEERS[cell]!) cand[p] = cand[p]! & ~(1 << (d - 1));
  }
  for (let guard = 0; guard < 400; guard++) {
    if (grid.every(Boolean)) break;
    // A square with no digit left: the givens contradict (never on a dealt board).
    if (grid.some((v, c) => !v && cand[c] === 0)) break;
    let progress = false;
    for (let cell = 0; cell < SUDOKU_CELLS && !progress; cell++) {
      if (!grid[cell] && bitCount(cand[cell]!) === 1) {
        place(cell, onlyDigit(cand[cell]!));
        steps.push("naked");
        progress = true;
      }
    }
    if (progress) continue;
    for (const unit of SUDOKU_UNITS) {
      for (let d = 0; d < N && !progress; d++) {
        if (unit.some((c) => grid[c] === d + 1)) continue;
        const spots = unit.filter((c) => !grid[c] && cand[c]! & (1 << d));
        if (spots.length === 1) {
          place(spots[0]!, d + 1);
          steps.push("hidden");
          progress = true;
        }
      }
      if (progress) break;
    }
    if (progress) continue;
    if (singlesOnly) break;
    const kind = advancedStep(grid, cand);
    if (!kind) break;
    steps.push(kind);
    advanced += 1;
  }
  return { solved: grid.every(Boolean), steps, advanced, grid };
}

/** One advanced elimination (the first that removes something), or null. */
function advancedStep(grid: readonly number[], cand: number[]): SudokuStepKind | null {
  // Naked pairs.
  for (const unit of SUDOKU_UNITS) {
    const open = unit.filter((c) => !grid[c]);
    for (let i = 0; i < open.length; i++) {
      const m = cand[open[i]!]!;
      if (bitCount(m) !== 2) continue;
      for (let j = i + 1; j < open.length; j++) {
        if (cand[open[j]!] !== m) continue;
        let removed = false;
        for (const c of open) {
          if (c === open[i] || c === open[j]) continue;
          if (cand[c]! & m) {
            cand[c]! &= ~m;
            removed = true;
          }
        }
        if (removed) return "pair";
      }
    }
  }
  const boxes = SUDOKU_UNITS.slice(2 * N);
  const lines = SUDOKU_UNITS.slice(0, 2 * N);
  for (let d = 0; d < N; d++) {
    const bitD = 1 << d;
    // Pointing: inside a box, the digit only in one row or column → off the rest of that line.
    for (const box of boxes) {
      if (box.some((c) => grid[c] === d + 1)) continue;
      const spots = box.filter((c) => !grid[c] && cand[c]! & bitD);
      if (spots.length < 2) continue;
      for (const line of lines) {
        if (!spots.every((c) => line.includes(c))) continue;
        let removed = false;
        for (const c of line) if (!box.includes(c) && !grid[c] && cand[c]! & bitD) {
          cand[c]! &= ~bitD;
          removed = true;
        }
        if (removed) return "pointing";
      }
    }
    // Box-line: inside a row or column, the digit only in one box → off the rest of that box.
    for (const line of lines) {
      if (line.some((c) => grid[c] === d + 1)) continue;
      const spots = line.filter((c) => !grid[c] && cand[c]! & bitD);
      if (spots.length < 2) continue;
      for (const box of boxes) {
        if (!spots.every((c) => box.includes(c))) continue;
        let removed = false;
        for (const c of box) if (!line.includes(c) && !grid[c] && cand[c]! & bitD) {
          cand[c]! &= ~bitD;
          removed = true;
        }
        if (removed) return "boxline";
      }
    }
  }
  return null;
}

/** The deduction a board needs: "singles", "advanced" (solved only with an advanced step) or null (not by logic). */
export function sudokuLogicGrade(givens: readonly number[]): "singles" | "advanced" | null {
  if (sudokuLogicSolve(givens, true).solved) return "singles";
  return sudokuLogicSolve(givens).solved ? "advanced" : null;
}
