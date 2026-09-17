/**
 * Server-only Ice Slide generation. Every layout is proved reachable by
 * breadth-first search over ball positions, and the minimum slide count and
 * one shortest route are stored in the private half of the puzzle.
 */

import { shortestSlideRoute, slideDistance } from "./slide";
import { shuffled } from "./random";
import {
  SLIDE_CELLS,
  SLIDE_COLS as N,
  SLIDE_MAX_MOVES,
  SLIDE_MAX_WALLS,
  SLIDE_MIN_MOVES,
  SLIDE_MIN_WALLS,
  type SlidePuzzleData,
} from "./types";

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function border(cell: number): boolean {
  const row = Math.floor(cell / N);
  const col = cell % N;
  return row === 0 || col === 0 || row === N - 1 || col === N - 1;
}

/** The layout must actually need its walls: one of them changes the minimum. */
function wallsMatter(walls: number[], start: number, exit: number, min: number): boolean {
  for (const wall of walls) {
    const without = walls.filter((cell) => cell !== wall);
    if (slideDistance(without, start, exit) !== min) return true;
  }
  return false;
}

export function generateIceSlide(): SlidePuzzleData {
  for (let attempt = 0; attempt < 4_000; attempt++) {
    const cells = shuffled(Array.from({ length: SLIDE_CELLS }, (_, i) => i));
    const exit = cells.find(border)!;
    const wallCount = SLIDE_MIN_WALLS + randomInt(SLIDE_MAX_WALLS - SLIDE_MIN_WALLS + 1);
    const walls = cells.filter((cell) => cell !== exit).slice(0, wallCount);
    const start = cells.find((cell) => cell !== exit && !walls.includes(cell));
    if (start === undefined) continue;

    const min = slideDistance(walls, start, exit);
    if (min === null || min < SLIDE_MIN_MOVES || min > SLIDE_MAX_MOVES) continue;
    if (!wallsMatter(walls, start, exit, min)) continue;

    const route = shortestSlideRoute(walls, start, exit);
    if (route.length !== min) continue;

    return {
      type: "iceslide",
      walls: [...walls].sort((a, b) => a - b),
      start,
      exit,
      minMoves: min,
      solution: route.join(""),
    };
  }
  throw new Error("Ice Slide generator could not build a reachable layout");
}
