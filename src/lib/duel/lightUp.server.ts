import { gameDisplayName } from "./gameNames";
/**
 * Server-only Light Up generator: a 9×9 board with 18–23 walls, a random
 * valid bulb layout, and roughly half of walls numbered. Boards the solver does
 * not find exactly one layout for are re-rolled.
 */

import { randInt, shuffled } from "./random";
import {
  countLightUpSolutions,
  lightUpValid,
  LIGHTUP_SIZE,
  orth,
  sightLine,
  type LightUpBoard,
} from "./lightUp";
import type { LightUpPuzzleData } from "./types";

export const LIGHTUP_MIN_WALLS = 18;
export const LIGHTUP_MAX_WALLS = 23;
/** The live generator's own attempt cap. */
export const LIGHTUP_MAX_ATTEMPTS = 100_000;

export function generateLightUp(maxAttempts = LIGHTUP_MAX_ATTEMPTS): LightUpPuzzleData {
  const size = LIGHTUP_SIZE;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const walls = shuffled([...Array(size * size).keys()]).slice(0, randInt(LIGHTUP_MIN_WALLS, LIGHTUP_MAX_WALLS));
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
    const zeroes = full.flatMap((n, i) => n === 0 ? [i] : []);
    const threes = full.flatMap((n, i) => n === 3 ? [i] : []);
    if (zeroes.length < 2 || threes.length < 1) continue;
    const numberCount = Math.round(walls.length * 0.5);
    const required = new Set<number>([...shuffled(zeroes).slice(0, 2), shuffled(threes)[0]!]);
    const remaining = shuffled([...walls.keys()].filter((i) => !required.has(i)));
    const numbered = new Set([...required, ...remaining.slice(0, numberCount - required.size)]);
    const numbers = full.map((n, i) => numbered.has(i) ? n : -1);
    const board: LightUpBoard = { size, walls, wallNumbers: numbers };
    if (countLightUpSolutions(board, 2) !== 1) continue;
    const sorted = walls.map((wall, i) => ({ wall, n: numbers[i]! })).sort((a, b) => a.wall - b.wall);
    return {
      type: "lightup",
      size,
      walls: sorted.map((w) => w.wall),
      wallNumbers: sorted.map((w) => w.n),
      solution: [...bulbs].sort((a, b) => a - b),
    };
  }
  throw new Error(`${gameDisplayName("lightup")} generation failed`);
}

/**
 * Re-checks a stored board as `generateLightUp` accepts one: 18–23 sorted
 * walls, half of them numbered (at least two 0s and one 3), a valid stored
 * bulb layout, and an exhaustive count of exactly one solution.
 */
export function verifyLightUpPuzzle(puzzle: LightUpPuzzleData): string | null {
  const { size, walls, wallNumbers, solution } = puzzle;
  if (puzzle.type !== "lightup") return "wrong type";
  if (size !== LIGHTUP_SIZE) return "size";
  if (walls.length < LIGHTUP_MIN_WALLS || walls.length > LIGHTUP_MAX_WALLS) return "wall count";
  if (walls.some((c, i) => !Number.isInteger(c) || c < 0 || c >= size * size || (i > 0 && c <= walls[i - 1]!)))
    return "walls not distinct and sorted";
  if (wallNumbers.length !== walls.length) return "wall numbers";
  const numbered = wallNumbers.filter((n) => n >= 0);
  if (numbered.length !== Math.round(walls.length * 0.5)) return "numbered wall count";
  if (numbered.filter((n) => n === 0).length < 2 || !numbered.includes(3)) return "needs two 0s and a 3";
  const board: LightUpBoard = { size, walls, wallNumbers };
  if (!solution || !lightUpValid(board, solution)) return "solution does not solve";
  if (countLightUpSolutions(board, 2) !== 1) return "not proven unique";
  return null;
}
