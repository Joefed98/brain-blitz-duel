/**
 * Fences rules (1 Nov 2026), shared by the phone (live checks, auto-lock), the server (grading, generation) and the
 * reveal. Draw one single closed loop along the grid lines; each number says how many of its four sides the loop uses.
 *
 * Geometry on a size × size grid: (size + 1)² dots, dot = r × (size + 1) + c. Edge ids: the horizontal edges first,
 * h(r, c) = r × size + c (r 0…size, c 0…size − 1), then the vertical ones, v(r, c) = size × (size + 1) + r × (size + 1) + c
 * (r 0…size − 1, c 0…size).
 *
 * The answer is one character per edge: "0" empty, "1" a line, "x" marked as no line (the cross is the player's note
 * and never counts). Pure; integers only.
 */
import type { FencesPuzzleData } from "./types";

export const FENCES_EMPTY = 0;
export const FENCES_LINE = 1;
export const FENCES_CROSS = 2;

export function fencesEdgeCount(size: number): number {
  return 2 * size * (size + 1);
}

export function fencesHorizontalCount(size: number): number {
  return size * (size + 1);
}

export function hEdge(size: number, r: number, c: number): number {
  return r * size + c;
}

export function vEdge(size: number, r: number, c: number): number {
  return fencesHorizontalCount(size) + r * (size + 1) + c;
}

export function isHorizontal(size: number, edge: number): boolean {
  return edge < fencesHorizontalCount(size);
}

/** The edge's two dots (dot = r × (size + 1) + c), lower id first. */
export function edgeDots(size: number, edge: number): [number, number] {
  const w = size + 1;
  if (isHorizontal(size, edge)) {
    const r = Math.floor(edge / size);
    const c = edge % size;
    return [r * w + c, r * w + c + 1];
  }
  const e = edge - fencesHorizontalCount(size);
  const r = Math.floor(e / w);
  const c = e % w;
  return [r * w + c, (r + 1) * w + c];
}

/** The edge joining two neighbouring dots, or null when they are not neighbours. */
export function edgeBetween(size: number, a: number, b: number): number | null {
  const w = size + 1;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const r = Math.floor(lo / w);
  const c = lo % w;
  if (hi === lo + 1 && c < size) return hEdge(size, r, c);
  if (hi === lo + w && r < size) return vEdge(size, r, c);
  return null;
}

/** The edges at a dot (2 to 4). */
export function dotEdges(size: number, dot: number): number[] {
  const w = size + 1;
  const r = Math.floor(dot / w);
  const c = dot % w;
  const out: number[] = [];
  if (c > 0) out.push(hEdge(size, r, c - 1));
  if (c < size) out.push(hEdge(size, r, c));
  if (r > 0) out.push(vEdge(size, r - 1, c));
  if (r < size) out.push(vEdge(size, r, c));
  return out;
}

/** A cell's four sides: top, bottom, left, right. */
export function cellEdges(size: number, cell: number): [number, number, number, number] {
  const r = Math.floor(cell / size);
  const c = cell % size;
  return [hEdge(size, r, c), hEdge(size, r + 1, c), vEdge(size, r, c), vEdge(size, r, c + 1)];
}

/** One state per edge (FENCES_EMPTY / LINE / CROSS); anything unreadable is empty. */
export function decodeFences(answer: string, size: number): number[] {
  const n = fencesEdgeCount(size);
  const raw = String(answer ?? "");
  const out = new Array<number>(n).fill(FENCES_EMPTY);
  for (let i = 0; i < n && i < raw.length; i++) {
    const ch = raw[i];
    out[i] = ch === "1" ? FENCES_LINE : ch === "x" ? FENCES_CROSS : FENCES_EMPTY;
  }
  return out;
}

export function encodeFences(states: readonly number[]): string {
  return states.map((s) => (s === FENCES_LINE ? "1" : s === FENCES_CROSS ? "x" : "0")).join("");
}

/** The line edges of an answer, ascending. */
export function fencesLines(answer: string, size: number): number[] {
  const out: number[] = [];
  decodeFences(answer, size).forEach((s, e) => {
    if (s === FENCES_LINE) out.push(e);
  });
  return out;
}

/** How many of a cell's sides are lines. */
export function cellLineCount(size: number, cell: number, lines: ReadonlySet<number>): number {
  let n = 0;
  for (const e of cellEdges(size, cell)) if (lines.has(e)) n++;
  return n;
}

/** True when the lines are exactly one closed loop: every dot used twice or not at all, all joined. */
export function isSingleLoop(size: number, lines: readonly number[]): boolean {
  if (lines.length < 4) return false;
  const set = new Set(lines);
  const dots = (size + 1) * (size + 1);
  for (let d = 0; d < dots; d++) {
    let deg = 0;
    for (const e of dotEdges(size, d)) if (set.has(e)) deg++;
    if (deg !== 0 && deg !== 2) return false;
  }
  // Walk the loop from the first line: it must visit every line.
  const start = lines[0]!;
  const seen = new Set<number>([start]);
  const stack = [start];
  while (stack.length) {
    const e = stack.pop()!;
    for (const d of edgeDots(size, e))
      for (const f of dotEdges(size, d))
        if (set.has(f) && !seen.has(f)) {
          seen.add(f);
          stack.push(f);
        }
  }
  return seen.size === set.size;
}

/** Every numbered cell has exactly its number of sides on the lines. */
export function fencesCluesMet(size: number, clues: readonly number[], lines: ReadonlySet<number>): boolean {
  for (let cell = 0; cell < size * size; cell++) {
    const n = clues[cell] ?? -1;
    if (n >= 0 && cellLineCount(size, cell, lines) !== n) return false;
  }
  return true;
}

/** Solved by the rules alone (the phone has no solution; the board's loop is unique, so this is the solution). */
export function fencesSolved(puzzle: Pick<FencesPuzzleData, "size" | "clues">, answer: string): boolean {
  const lines = fencesLines(answer, puzzle.size);
  return isSingleLoop(puzzle.size, lines) && fencesCluesMet(puzzle.size, puzzle.clues, new Set(lines));
}

/** Progress toward the solution: loop edges drawn (right), other lines drawn (wrong), the loop's length (total). */
export function fencesProgress(puzzle: FencesPuzzleData, answer: string): { right: number; wrong: number; total: number } {
  const sol = new Set(puzzle.solution ?? []);
  let right = 0;
  let wrong = 0;
  for (const e of fencesLines(answer, puzzle.size)) {
    if (sol.has(e)) right++;
    else wrong++;
  }
  return { right, wrong, total: sol.size };
}

/** The wrong items an answer holds (lines off the loop), as stable keys for the clean bonus. */
export function fencesWrongKeys(puzzle: FencesPuzzleData, answer: string): string[] {
  const sol = new Set(puzzle.solution ?? []);
  return fencesLines(answer, puzzle.size).filter((e) => !sol.has(e)).map(String);
}
