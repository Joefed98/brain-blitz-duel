/**
 * Server-only Light Up generator: 10–14 walls, a random valid bulb layout,
 * wall numbers derived from it, then numbers removed while the solver still
 * finds exactly one layout. Boards that are not unique even fully numbered
 * are re-rolled.
 */

import { randInt, shuffled } from "./random";
import {
  countLightUpSolutions,
  LIGHTUP_SIZE,
  orth,
  sightLine,
  type LightUpBoard,
} from "./lightUp";
import type { LightUpPuzzleData } from "./types";

export function generateLightUp(): LightUpPuzzleData {
  const size = LIGHTUP_SIZE;
  for (let attempt = 0; attempt < 5000; attempt++) {
    const walls = shuffled([...Array(size * size).keys()]).slice(0, randInt(10, 14));
    const wallSet = new Set(walls);
    const lit = new Set<number>();
    const bulbs: number[] = [];
    for (const cell of shuffled([...Array(size * size).keys()])) {
      if (wallSet.has(cell) || lit.has(cell)) continue;
      bulbs.push(cell);
      for (const other of sightLine(cell, size, wallSet)) lit.add(other);
    }
    const bulbSet = new Set(bulbs);
    const full = walls.map((wall) => orth(wall, size).filter((cell) => bulbSet.has(cell)).length);
    const board: LightUpBoard = { size, walls, wallNumbers: full };
    if (countLightUpSolutions(board, 2) !== 1) continue;
    // Drop numbers while the answer stays unique.
    const numbers = [...full];
    for (const i of shuffled([...walls.keys()])) {
      const saved = numbers[i]!;
      numbers[i] = -1;
      if (countLightUpSolutions({ size, walls, wallNumbers: numbers }, 2) !== 1) numbers[i] = saved;
    }
    const sorted = walls.map((wall, i) => ({ wall, n: numbers[i]! })).sort((a, b) => a.wall - b.wall);
    return {
      type: "lightup",
      size,
      walls: sorted.map((w) => w.wall),
      wallNumbers: sorted.map((w) => w.n),
      solution: [...bulbs].sort((a, b) => a - b),
    };
  }
  throw new Error("Light Up generation failed");
}
