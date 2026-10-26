import { gameDisplayName } from "./gameNames";
/**
 * Server-only Light Up generator: a 9×10 board with 20–25 walls (9×9 and 18–23 before the depth revision), a random
 * valid bulb layout, and roughly half of walls numbered. Boards the solver does
 * not find exactly one layout for are re-rolled.
 */

import { randInt, shuffled } from "./random";
import {
  countLightUpSolutions,
  lightUpHeightOf,
  lightUpValid,
  LIGHTUP_DEPTH_HEIGHT,
  LIGHTUP_SIZE,
  orth,
  sightLine,
  type LightUpBoard,
} from "./lightUp";
import type { LightUpPuzzleData } from "./types";

export const LIGHTUP_MIN_WALLS = 18;
export const LIGHTUP_MAX_WALLS = 23;
/** The depth revision's 9 × 10 grid: the 9 × 9 board's wall density (20–25 walls). */
export const LIGHTUP_DEPTH_MIN_WALLS = 20;
export const LIGHTUP_DEPTH_MAX_WALLS = 25;

function wallBand(height: number): [number, number] {
  return height === LIGHTUP_SIZE ? [LIGHTUP_MIN_WALLS, LIGHTUP_MAX_WALLS] : [LIGHTUP_DEPTH_MIN_WALLS, LIGHTUP_DEPTH_MAX_WALLS];
}
/** The live generator's own attempt cap. */
export const LIGHTUP_MAX_ATTEMPTS = 100_000;

/**
 * The live generator: the depth revision's 9 × 10 grid (depthRev 1, 25 Oct 2026) unless `height` asks for the 9 × 9
 * board rooms dealt before it (the calibration and checks).
 */
export function generateLightUp(maxAttempts = LIGHTUP_MAX_ATTEMPTS, height = LIGHTUP_DEPTH_HEIGHT): LightUpPuzzleData {
  const size = LIGHTUP_SIZE;
  const tall = height !== size;
  const [minWalls, maxWalls] = wallBand(height);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const walls = shuffled([...Array(size * height).keys()]).slice(0, randInt(minWalls, maxWalls));
    const wallSet = new Set(walls);
    const lit = new Set<number>();
    const bulbs: number[] = [];
    for (const cell of shuffled([...Array(size * height).keys()])) {
      if (wallSet.has(cell) || lit.has(cell)) continue;
      bulbs.push(cell);
      for (const other of sightLine(cell, size, wallSet, height)) lit.add(other);
    }
    const bulbSet = new Set(bulbs);
    const full = walls.map((wall) => orth(wall, size, height).filter((cell) => bulbSet.has(cell)).length);
    const zeroes = full.flatMap((n, i) => n === 0 ? [i] : []);
    const threes = full.flatMap((n, i) => n === 3 ? [i] : []);
    if (zeroes.length < 2 || threes.length < 1) continue;
    const numberCount = Math.round(walls.length * 0.5);
    const required = new Set<number>([...shuffled(zeroes).slice(0, 2), shuffled(threes)[0]!]);
    const remaining = shuffled([...walls.keys()].filter((i) => !required.has(i)));
    const numbered = new Set([...required, ...remaining.slice(0, numberCount - required.size)]);
    const numbers = full.map((n, i) => numbered.has(i) ? n : -1);
    const board: LightUpBoard = { size, ...(tall ? { height } : {}), walls, wallNumbers: numbers };
    if (countLightUpSolutions(board, 2) !== 1) continue;
    const sorted = walls.map((wall, i) => ({ wall, n: numbers[i]! })).sort((a, b) => a.wall - b.wall);
    return {
      type: "lightup",
      size,
      ...(tall ? { height } : {}),
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
  const height = lightUpHeightOf(puzzle);
  if (height !== LIGHTUP_SIZE && height !== LIGHTUP_DEPTH_HEIGHT) return "height";
  const [minWalls, maxWalls] = wallBand(height);
  if (walls.length < minWalls || walls.length > maxWalls) return "wall count";
  if (walls.some((c, i) => !Number.isInteger(c) || c < 0 || c >= size * height || (i > 0 && c <= walls[i - 1]!)))
    return "walls not distinct and sorted";
  if (wallNumbers.length !== walls.length) return "wall numbers";
  const numbered = wallNumbers.filter((n) => n >= 0);
  if (numbered.length !== Math.round(walls.length * 0.5)) return "numbered wall count";
  if (numbered.filter((n) => n === 0).length < 2 || !numbered.includes(3)) return "needs two 0s and a 3";
  const board: LightUpBoard = { size, ...(height !== size ? { height } : {}), walls, wallNumbers };
  if (!solution || !lightUpValid(board, solution)) return "solution does not solve";
  if (countLightUpSolutions(board, 2) !== 1) return "not proven unique";
  return null;
}
