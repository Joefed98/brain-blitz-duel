/**
 * Nonogram rules, shared by the phone and the server. The picture itself lives
 * in the private secrets row; the clues are public, and the server regrades
 * every submitted grid through this code rather than trusting a client verdict.
 */

import { NONO_SIZE, type NonoPuzzleData } from "./types";

/** The depth revision's bigger pictures (depthRev 1, 25 Oct 2026): 8 × 8, 22–36 filled (a little under the 7 × 7 band's share, so the clock still fits a good solve). */
export const NONO_DEPTH_SIZE = 8;
export const NONO_DEPTH_MIN_FILLED = 22;
export const NONO_DEPTH_MAX_FILLED = 36;

/** A stored puzzle's side: its clue count (7 on every puzzle dealt before the depth revision). */
export function nonoSizeOf(puzzle: Pick<NonoPuzzleData, "rows"> | null | undefined): number {
  const n = puzzle?.rows?.length ?? 0;
  return n >= 2 && n <= 12 ? n : NONO_SIZE;
}

/**
 * A board's columns and rows. Today's boards are square (the clue count both ways); a level's board (the Logic
 * overhaul's levels) is grown downwards, so it has more rows than columns.
 */
export function nonoDimsOf(puzzle: Pick<NonoPuzzleData, "rows" | "cols"> | null | undefined): { w: number; h: number } {
  const h = puzzle?.rows?.length ?? 0;
  const w = puzzle?.cols?.length ?? 0;
  if (w >= 2 && h >= 2 && w !== h && w <= 12 && h <= 16) return { w, h };
  const n = nonoSizeOf(puzzle);
  return { w: n, h: n };
}

/** The squares on a board (the bound a submitted cell index must sit under). */
export function nonoCellsOf(puzzle: Pick<NonoPuzzleData, "rows" | "cols"> | null | undefined): number {
  const { w, h } = nonoDimsOf(puzzle);
  return w * h;
}

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

export function rowCells(pattern: boolean[], row: number, size = NONO_SIZE): boolean[] {
  return Array.from({ length: size }, (_, col) => pattern[row * size + col] === true);
}

export function colCells(pattern: boolean[], col: number, size = NONO_SIZE): boolean[] {
  return Array.from({ length: size }, (_, row) => pattern[row * size + col] === true);
}

export function cluesFor(pattern: boolean[], size = NONO_SIZE): { rows: number[][]; cols: number[][] } {
  return {
    rows: Array.from({ length: size }, (_, row) => lineClue(rowCells(pattern, row, size))),
    cols: Array.from({ length: size }, (_, col) => lineClue(colCells(pattern, col, size))),
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
export function lineCandidates(clue: number[], size = NONO_SIZE): boolean[][] {
  const out: boolean[][] = [];
  for (let mask = 0; mask < 1 << size; mask++) {
    const cells = Array.from({ length: size }, (_, index) => (mask & (1 << index)) !== 0);
    if (sameClue(clue, lineClue(cells))) out.push(cells);
  }
  return out;
}

/**
 * How many pictures fit these clues, stopping at `cap`. Generation only keeps
 * clue sets with exactly one, so the player always has a single right answer.
 */
export function countNonoSolutions(rows: number[][], cols: number[][], cap = 2): number {
  // The side is the clue count (7 before the depth revision, 8 on it); a level's board has its own width.
  const NONO_SIZE = rows.length;
  const WIDTH = cols.length || NONO_SIZE;
  const candidates = rows.map((clue) => lineCandidates(clue, WIDTH));
  let found = 0;
  const grid: boolean[][] = [];

  const columnStillPossible = (): boolean => {
    for (let col = 0; col < WIDTH; col++) {
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
      for (let col = 0; col < WIDTH; col++) {
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

export function decodeNonoCells(raw: string, size = NONO_SIZE, cells = size * size): number[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isInteger(value) && value >= 0 && value < cells)
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

/* ------------------------------------------------------------------ the logic grader (levels) */

/** A rectangular picture's clues (`w` columns, `h` rows). */
export function cluesForRect(pattern: boolean[], w: number, h: number): { rows: number[][]; cols: number[][] } {
  return {
    rows: Array.from({ length: h }, (_, r) => lineClue(Array.from({ length: w }, (_, c) => pattern[r * w + c] === true))),
    cols: Array.from({ length: w }, (_, c) => lineClue(Array.from({ length: h }, (_, r) => pattern[r * w + c] === true))),
  };
}

/** Every arrangement of a line matching its clue, by placing the runs (no 2^n sweep, so 14-long columns stay quick). */
function linePlacements(clue: readonly number[], n: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  const line = new Uint8Array(n);
  const place = (k: number, from: number) => {
    if (k === clue.length) {
      out.push(line.slice());
      return;
    }
    const run = clue[k]!;
    const rest = clue.slice(k + 1).reduce((a, b) => a + b + 1, 0);
    for (let at = from; at + run + rest <= n; at++) {
      for (let i = 0; i < run; i++) line[at + i] = 1;
      place(k + 1, at + run + 1);
      for (let i = 0; i < run; i++) line[at + i] = 0;
    }
  };
  place(0, 0);
  return out;
}

/**
 * Solves a board the way a person does: each line on its own, from its clue and the squares already known (a square
 * every arrangement agrees on is settled), over and over. With `probe`, when that sticks it may suppose one square and
 * follow the lines until they contradict (two or more lines together), settling the square the other way. Returns
 * whether every square was settled and how many probes it took. Known: 1 filled, 2 empty, 0 unknown.
 */
export function nonoLogicSolve(rows: number[][], cols: number[][], probe = false): { solved: boolean; probes: number } {
  const h = rows.length;
  const w = cols.length;
  const rowP = rows.map((c) => linePlacements(c, w));
  const colP = cols.map((c) => linePlacements(c, h));
  const settle = (known: Uint8Array): boolean => {
    // Line passes until nothing changes; false on a contradiction.
    for (let changed = true; changed; ) {
      changed = false;
      for (let line = 0; line < h + w; line++) {
        const isRow = line < h;
        const idx = isRow ? line : line - h;
        const n = isRow ? w : h;
        const at = (i: number) => (isRow ? idx * w + i : i * w + idx);
        const fits = (isRow ? rowP[idx]! : colP[idx]!).filter((p) => {
          for (let i = 0; i < n; i++) {
            const k = known[at(i)]!;
            if (k === 1 && !p[i]) return false;
            if (k === 2 && p[i]) return false;
          }
          return true;
        });
        if (!fits.length) return false;
        for (let i = 0; i < n; i++) {
          if (known[at(i)]) continue;
          const first = fits[0]![i]!;
          if (fits.every((p) => p[i] === first)) {
            known[at(i)] = first ? 1 : 2;
            changed = true;
          }
        }
      }
    }
    return true;
  };
  const known = new Uint8Array(w * h);
  if (!settle(known)) return { solved: false, probes: 0 };
  let probes = 0;
  while (probe && known.includes(0)) {
    let moved = false;
    for (let cell = 0; cell < known.length && !moved; cell++) {
      if (known[cell]) continue;
      for (const guess of [1, 2] as const) {
        const trial = known.slice();
        trial[cell] = guess;
        if (!settle(trial)) {
          known[cell] = guess === 1 ? 2 : 1;
          probes++;
          moved = true;
          if (!settle(known)) return { solved: false, probes };
          break;
        }
      }
    }
    if (!moved) break;
  }
  return { solved: !known.includes(0), probes };
}
