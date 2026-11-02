/**
 * Fillomino rules (1 Nov 2026), shared by the phone, the server and the reveal. Split the grid into regions; each
 * region of N cells is filled with the number N, and two regions of the same size never touch side by side (so every
 * group of touching equal numbers is one region of exactly that size). Some numbers are given.
 *
 * The answer is one character per cell, row by row: "1"…"9", or "0" for a blank. Given cells always read as their
 * given number, whatever the answer says. Pure; integers only.
 */
import type { FillominoPuzzleData } from "./types";

/** The largest region the generator deals and the pad offers. */
export const FILLOMINO_MAX_N = 9;

/** Every cell's number (givens win; 0 = blank). */
export function decodeFillomino(answer: string, puzzle: Pick<FillominoPuzzleData, "size" | "givens">): number[] {
  const n = puzzle.size * puzzle.size;
  const raw = String(answer ?? "");
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const given = puzzle.givens[i] ?? 0;
    if (given > 0) {
      out[i] = given;
      continue;
    }
    const ch = raw.charCodeAt(i) - 48;
    out[i] = ch >= 1 && ch <= FILLOMINO_MAX_N ? ch : 0;
  }
  return out;
}

export function encodeFillomino(values: readonly number[]): string {
  return values.map((v) => (v >= 1 && v <= FILLOMINO_MAX_N ? String(v) : "0")).join("");
}

/** The cell's orthogonal neighbours. */
export function fillominoNeighbours(size: number, cell: number): number[] {
  const r = Math.floor(cell / size);
  const c = cell % size;
  const out: number[] = [];
  if (r > 0) out.push(cell - size);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  if (c < size - 1) out.push(cell + 1);
  return out;
}

/**
 * Groups of touching cells holding the same (non-zero) number: `group[cell]` (−1 on blanks) and each group's cells.
 */
export function fillominoGroups(size: number, values: readonly number[]): { group: number[]; cells: number[][] } {
  const group = new Array<number>(size * size).fill(-1);
  const cells: number[][] = [];
  for (let start = 0; start < size * size; start++) {
    if (!values[start] || group[start] !== -1) continue;
    const id = cells.length;
    const members: number[] = [start];
    group[start] = id;
    for (let i = 0; i < members.length; i++) {
      for (const nb of fillominoNeighbours(size, members[i]!)) {
        if (group[nb] === -1 && values[nb] === values[start]) {
          group[nb] = id;
          members.push(nb);
        }
      }
    }
    cells.push(members);
  }
  return { group, cells };
}

/** Cells in a group larger than its number (a mistake the phone can show without the solution). */
export function fillominoOversized(size: number, values: readonly number[]): Set<number> {
  const out = new Set<number>();
  for (const members of fillominoGroups(size, values).cells) {
    const n = values[members[0]!]!;
    if (members.length > n) for (const c of members) out.add(c);
  }
  return out;
}

/** Cells in a group of exactly its number (a finished region). */
export function fillominoComplete(size: number, values: readonly number[]): Set<number> {
  const out = new Set<number>();
  for (const members of fillominoGroups(size, values).cells) {
    if (members.length === values[members[0]!]) for (const c of members) out.add(c);
  }
  return out;
}

/** Solved by the rules alone (the board's solution is unique, so this is the solution). */
export function fillominoSolvedGrid(size: number, values: readonly number[]): boolean {
  if (values.length < size * size || values.some((v) => !v)) return false;
  return fillominoGroups(size, values).cells.every((members) => members.length === values[members[0]!]);
}

export function fillominoSolved(puzzle: Pick<FillominoPuzzleData, "size" | "givens">, answer: string): boolean {
  return fillominoSolvedGrid(puzzle.size, decodeFillomino(answer, puzzle));
}

/** Progress toward the solution over the blank cells: right numbers, wrong numbers, blanks to fill. */
export function fillominoProgress(puzzle: FillominoPuzzleData, answer: string): { right: number; wrong: number; total: number } {
  const values = decodeFillomino(answer, puzzle);
  const sol = puzzle.solution ?? [];
  let right = 0;
  let wrong = 0;
  let total = 0;
  for (let i = 0; i < puzzle.size * puzzle.size; i++) {
    if ((puzzle.givens[i] ?? 0) > 0) continue;
    total++;
    if (!values[i]) continue;
    if (values[i] === sol[i]) right++;
    else wrong++;
  }
  return { right, wrong, total };
}

/** The wrong numbers an answer holds, as stable keys ("cell:number") for the clean bonus. */
export function fillominoWrongKeys(puzzle: FillominoPuzzleData, answer: string): string[] {
  const values = decodeFillomino(answer, puzzle);
  const sol = puzzle.solution ?? [];
  const out: string[] = [];
  for (let i = 0; i < puzzle.size * puzzle.size; i++) {
    if ((puzzle.givens[i] ?? 0) > 0 || !values[i]) continue;
    if (values[i] !== sol[i]) out.push(`${i}:${values[i]}`);
  }
  return out;
}
