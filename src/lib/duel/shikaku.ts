import { finishParts, partialParts, scoreRev1 } from "./puzzleScoreRev";
import { speedBonusCurve } from "./speedPar";
/**
 * Shikaku rules, shared by the phone (live checks, auto-lock) and the server
 * (grading, generation). A rectangle is valid when it holds exactly one clue
 * and that clue equals its area; the puzzle is solved when valid,
 * non-overlapping rectangles cover every cell.
 */

export const SHIKAKU_SIZE = 10;
export const SHIKAKU_CELLS = SHIKAKU_SIZE * SHIKAKU_SIZE;

export interface ShikakuClue {
  cell: number;
  n: number;
}

export interface ShikakuRect {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export function rectFrom(a: number, b: number, size = SHIKAKU_SIZE): ShikakuRect {
  const ar = Math.floor(a / size);
  const ac = a % size;
  const br = Math.floor(b / size);
  const bc = b % size;
  return { r0: Math.min(ar, br), c0: Math.min(ac, bc), r1: Math.max(ar, br), c1: Math.max(ac, bc) };
}

export function rectArea(r: ShikakuRect): number {
  return (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1);
}

export function rectCells(r: ShikakuRect, size = SHIKAKU_SIZE): number[] {
  const out: number[] = [];
  for (let row = r.r0; row <= r.r1; row++) for (let col = r.c0; col <= r.c1; col++) out.push(row * size + col);
  return out;
}

export function rectHas(r: ShikakuRect, cell: number, size = SHIKAKU_SIZE): boolean {
  const row = Math.floor(cell / size);
  const col = cell % size;
  return row >= r.r0 && row <= r.r1 && col >= r.c0 && col <= r.c1;
}

export function rectsOverlap(a: ShikakuRect, b: ShikakuRect): boolean {
  return a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;
}

export function rectValid(r: ShikakuRect, clues: readonly ShikakuClue[], size = SHIKAKU_SIZE): boolean {
  const inside = clues.filter((clue) => rectHas(r, clue.cell, size));
  return inside.length === 1 && inside[0]!.n === rectArea(r);
}

export function encodeShikaku(rects: readonly ShikakuRect[]): string {
  return rects.map((r) => `${r.r0}${r.c0}${r.r1}${r.c1}`).join(",");
}

export function decodeShikaku(raw: string, size = SHIKAKU_SIZE): ShikakuRect[] {
  return String(raw ?? "")
    .split(",")
    .slice(0, SHIKAKU_CELLS)
    .filter((part) => /^\d{4}$/.test(part))
    .map((part) => {
      const [r0, c0, r1, c1] = part.split("").map(Number) as [number, number, number, number];
      return { r0, c0, r1, c1 };
    })
    .filter((r) => r.r0 <= r.r1 && r.c0 <= r.c1 && r.r1 < size && r.c1 < size);
}

/** Valid rectangles in order, dropping any that overlaps an earlier one. */
export function acceptedRects(rects: readonly ShikakuRect[], clues: readonly ShikakuClue[], size = SHIKAKU_SIZE): ShikakuRect[] {
  const out: ShikakuRect[] = [];
  for (const r of rects) {
    if (!rectValid(r, clues, size)) continue;
    if (out.some((other) => rectsOverlap(other, r))) continue;
    out.push(r);
  }
  return out;
}

export function shikakuCovered(rects: readonly ShikakuRect[], clues: readonly ShikakuClue[], size = SHIKAKU_SIZE): number {
  return acceptedRects(rects, clues, size).reduce((sum, r) => sum + rectArea(r), 0);
}

export function shikakuSolved(rects: readonly ShikakuRect[], clues: readonly ShikakuClue[], size = SHIKAKU_SIZE): boolean {
  return shikakuCovered(rects, clues, size) === size * size;
}

/** Counts partitions up to `limit`: the first free cell is always a rectangle's top-left. */
export function countShikakuSolutions(clues: readonly ShikakuClue[], limit = 2, size = SHIKAKU_SIZE): number {
  const used = new Array<boolean>(size * size).fill(false);
  let found = 0;
  const walk = (): void => {
    if (found >= limit) return;
    const first = used.indexOf(false);
    if (first < 0) {
      found += 1;
      return;
    }
    const r0 = Math.floor(first / size);
    const c0 = first % size;
    let maxC = size - 1;
    for (let r1 = r0; r1 < size; r1++) {
      for (let c1 = c0; c1 <= maxC; c1++) {
        if (used[r1 * size + c1]) {
          maxC = c1 - 1;
          break;
        }
        const rect = { r0, c0, r1, c1 };
        if (!rectValid(rect, clues, size)) continue;
        const cells = rectCells(rect, size);
        for (const cell of cells) used[cell] = true;
        walk();
        for (const cell of cells) used[cell] = false;
        if (found >= limit) return;
      }
      if (maxC < c0) break;
    }
  };
  walk();
  return found;
}

/** Solved = 100 + time bonus; otherwise 70 × covered ÷ board cells. */
export function scoreShikaku(solved: boolean, msRemaining: number, timeLimitMs: number, covered: number): number {
  if (scoreRev1()) {
    if (solved) return finishParts(speedBonusCurve(30, msRemaining, timeLimitMs));
    return partialParts((110 * covered) / SHIKAKU_CELLS);
  }
  if (solved) return Math.min(150, 130 + speedBonusCurve(20, msRemaining, timeLimitMs));
  return Math.max(0, Math.round((110 * covered) / SHIKAKU_CELLS));
}
