/**
 * Nonogram rules, shared by the phone and the server. The picture itself lives
 * in the private secrets row; the clues are public, and the server regrades
 * every submitted grid through this code rather than trusting a client verdict.
 */

import { NONO_SIZE } from "./types";

/** The run lengths of filled cells in one line, in order. */
export function lineClue(cells: boolean[]): number[] {
  const runs: number[] = [];
  let run = 0;
  for (const cell of cells) {
    if (cell) run += 1;
    else if (run > 0) {
      runs.push(run);
      run = 0;
    }
  }
  if (run > 0) runs.push(run);
  return runs;
}

export function rowCells(pattern: boolean[], row: number): boolean[] {
  return Array.from({ length: NONO_SIZE }, (_, col) => pattern[row * NONO_SIZE + col] === true);
}

export function colCells(pattern: boolean[], col: number): boolean[] {
  return Array.from({ length: NONO_SIZE }, (_, row) => pattern[row * NONO_SIZE + col] === true);
}

export function cluesFor(pattern: boolean[]): { rows: number[][]; cols: number[][] } {
  return {
    rows: Array.from({ length: NONO_SIZE }, (_, row) => lineClue(rowCells(pattern, row))),
    cols: Array.from({ length: NONO_SIZE }, (_, col) => lineClue(colCells(pattern, col))),
  };
}

export function sameClue(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Live feedback: is this row or column already matching its numbers? */
export function lineSatisfied(clue: number[], cells: boolean[]): boolean {
  return sameClue(clue, lineClue(cells));
}

/** Every arrangement of one line that matches its clue, as boolean rows. */
export function lineCandidates(clue: number[]): boolean[][] {
  const out: boolean[][] = [];
  for (let mask = 0; mask < 1 << NONO_SIZE; mask++) {
    const cells = Array.from({ length: NONO_SIZE }, (_, index) => (mask & (1 << index)) !== 0);
    if (sameClue(clue, lineClue(cells))) out.push(cells);
  }
  return out;
}

/**
 * How many pictures fit these clues, stopping at `cap`. Generation only keeps
 * clue sets with exactly one, so the player always has a single right answer.
 */
export function countNonoSolutions(rows: number[][], cols: number[][], cap = 2): number {
  const candidates = rows.map(lineCandidates);
  let found = 0;
  const grid: boolean[][] = [];

  const columnStillPossible = (): boolean => {
    for (let col = 0; col < NONO_SIZE; col++) {
      const filledSoFar = grid.reduce((sum, row) => sum + (row[col] ? 1 : 0), 0);
      const wanted = (cols[col] ?? []).reduce((sum, run) => sum + run, 0);
      if (filledSoFar > wanted) return false;
      if (wanted - filledSoFar > NONO_SIZE - grid.length) return false;
    }
    return true;
  };

  const walk = (row: number): void => {
    if (found >= cap) return;
    if (row === NONO_SIZE) {
      for (let col = 0; col < NONO_SIZE; col++) {
        const cells = grid.map((line) => line[col] === true);
        if (!sameClue(cols[col] ?? [], lineClue(cells))) return;
      }
      found += 1;
      return;
    }
    for (const candidate of candidates[row] ?? []) {
      grid.push(candidate);
      if (columnStillPossible()) walk(row + 1);
      grid.pop();
      if (found >= cap) return;
    }
  };

  walk(0);
  return found;
}

/** Filled cell indices, ascending. Pencil marks are never submitted. */
export function encodeNonoCells(marks: NonoMarks): string {
  return marks
    .map((mark, index) => (mark === 1 ? index : -1))
    .filter((index) => index >= 0)
    .join(",");
}

export type NonoMarks = (0 | 1 | 2)[];

export function decodeNonoCells(raw: string): number[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isInteger(value) && value >= 0 && value < NONO_SIZE * NONO_SIZE)
    .filter((value, index, list) => list.indexOf(value) === index)
    .sort((a, b) => a - b);
}

export interface NonoReplay {
  solved: boolean;
  /** Cells filled that belong to the picture. */
  correct: number;
  /** Cells filled that do not. */
  wrong: number;
  total: number;
  filled: number[];
}

/** The one place a submitted grid is graded against the stored picture. */
export function replayNonogram(pattern: boolean[], filled: number[]): NonoReplay {
  const total = pattern.filter(Boolean).length;
  let correct = 0;
  let wrong = 0;
  for (const cell of filled) {
    if (pattern[cell]) correct += 1;
    else wrong += 1;
  }
  return { solved: wrong === 0 && correct === total && total > 0, correct, wrong, total, filled };
}
