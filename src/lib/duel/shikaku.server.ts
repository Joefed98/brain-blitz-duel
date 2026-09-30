/**
 * Server-only Shikaku generator: a 9×9 partition into 15–18 rectangles (at
 * most one 1×1, at most two of area 2, at least four of area 6+ whose number
 * sits away from the centre), with repeated adjacent areas, and the solver must
 * find exactly one partition — otherwise the board is re-rolled.
 */

import { pick, randInt } from "./random";
import {
  countShikakuSolutions,
  rectArea,
  rectCells,
  SHIKAKU_SIZE,
  type ShikakuClue,
  type ShikakuRect,
} from "./shikaku";
import type { ShikakuPuzzleData } from "./types";

const MAX_AREA = 12;

function adjacent(a: ShikakuRect, b: ShikakuRect): boolean {
  const vertical = (a.r1 + 1 === b.r0 || b.r1 + 1 === a.r0) && Math.max(a.c0, b.c0) <= Math.min(a.c1, b.c1);
  const horizontal = (a.c1 + 1 === b.c0 || b.c1 + 1 === a.c0) && Math.max(a.r0, b.r0) <= Math.min(a.r1, b.r1);
  return vertical || horizontal;
}

export function shikakuEqualAdjacentPairs(rects: readonly ShikakuRect[]): number {
  let pairs = 0;
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    if (rectArea(rects[i]!) === rectArea(rects[j]!) && adjacent(rects[i]!, rects[j]!)) pairs += 1;
  }
  return pairs;
}

function tryPartition(): ShikakuRect[] | null {
  const size = SHIKAKU_SIZE;
  const used = new Array<boolean>(size * size).fill(false);
  const rects: ShikakuRect[] = [];
  let ones = 0;
  let twos = 0;
  for (;;) {
    const first = used.indexOf(false);
    if (first < 0) break;
    const r0 = Math.floor(first / size);
    const c0 = first % size;
    const options: ShikakuRect[] = [];
    let maxC = size - 1;
    for (let r1 = r0; r1 < size; r1++) {
      for (let c1 = c0; c1 <= maxC; c1++) {
        if (used[r1 * size + c1]) {
          maxC = c1 - 1;
          break;
        }
        const rect = { r0, c0, r1, c1 };
        const area = rectArea(rect);
        if (area > MAX_AREA) continue;
        if (area === 1 && ones >= 1) continue;
        if (area === 2 && twos >= 2) continue;
        options.push(rect);
      }
      if (maxC < c0) break;
    }
    if (!options.length) return null;
    const big = options.filter((rect) => rectArea(rect) >= 4);
    const rect = big.length && randInt(0, 3) > 0 ? pick(big) : pick(options);
    if (rectArea(rect) === 1) ones += 1;
    if (rectArea(rect) === 2) twos += 1;
    for (const cell of rectCells(rect)) used[cell] = true;
    rects.push(rect);
  }
  return rects;
}

/** Clue cell: for area 6+, any cell except the central one(s). */
function clueCell(rect: ShikakuRect): number {
  const cells = rectCells(rect);
  if (rectArea(rect) < 6) return pick(cells);
  const cr = (rect.r0 + rect.r1) / 2;
  const cc = (rect.c0 + rect.c1) / 2;
  const away = cells.filter((cell) => {
    const r = Math.floor(cell / SHIKAKU_SIZE);
    const c = cell % SHIKAKU_SIZE;
    return Math.abs(r - cr) + Math.abs(c - cc) > 1;
  });
  return pick(away.length ? away : cells);
}

export function generateShikaku(): ShikakuPuzzleData {
  for (let attempt = 0; attempt < 50000; attempt++) {
    const rects = tryPartition();
    if (!rects || rects.length < 15 || rects.length > 18) continue;
    if (rects.filter((rect) => rectArea(rect) >= 6).length < 4) continue;
    if (shikakuEqualAdjacentPairs(rects) < 3) continue;
    const clues: ShikakuClue[] = rects.map((rect) => ({ cell: clueCell(rect), n: rectArea(rect) }));
    if (countShikakuSolutions(clues, 2) !== 1) continue;
    return {
      type: "shikaku",
      size: SHIKAKU_SIZE,
      clues: [...clues].sort((a, b) => a.cell - b.cell),
      solution: rects,
    };
  }
  throw new Error("Shikaku generation failed");
}
