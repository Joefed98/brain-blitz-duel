/**
 * Server-only Shikaku generator: a random partition into 9–11 rectangles
 * (areas 2–9, at most one 1×1), one clue per rectangle, and the solver must
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

function tryPartition(): ShikakuRect[] | null {
  const size = SHIKAKU_SIZE;
  const used = new Array<boolean>(size * size).fill(false);
  const rects: ShikakuRect[] = [];
  let ones = 0;
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
        if (area <= 9 && (area >= 2 || ones === 0)) options.push(rect);
      }
      if (maxC < c0) break;
    }
    if (!options.length) return null;
    // Favour bigger pieces so the count lands in 9–11.
    const big = options.filter((rect) => rectArea(rect) >= 4);
    const rect = big.length && randInt(0, 3) > 0 ? pick(big) : pick(options);
    if (rectArea(rect) === 1) ones += 1;
    for (const cell of rectCells(rect)) used[cell] = true;
    rects.push(rect);
  }
  return rects;
}

export function generateShikaku(): ShikakuPuzzleData {
  for (let attempt = 0; attempt < 20000; attempt++) {
    const rects = tryPartition();
    if (!rects || rects.length < 9 || rects.length > 11) continue;
    const clues: ShikakuClue[] = rects.map((rect) => ({ cell: pick(rectCells(rect)), n: rectArea(rect) }));
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
