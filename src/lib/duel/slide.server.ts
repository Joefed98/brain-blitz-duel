/**
 * Server-only Ice Slide generation. Every layout is proved reachable by
 * breadth-first search over ball positions — with holes treated as a reset to
 * the start and arrow cells turning the ball mid-slide — and the minimum slide
 * count, the checks behind it and one shortest route are stored with the puzzle.
 */

import { shortestSlideRoute, slideDistance, slideRouteAvoidsHoles } from "./slide";
import { shuffled } from "./random";
import {
  SLIDE_CELLS,
  SLIDE_COLS as N,
  SLIDE_EASY_MOVES,
  SLIDE_MAX_ARROWS,
  SLIDE_MAX_HOLES,
  SLIDE_MAX_MOVES,
  SLIDE_MAX_WALLS,
  SLIDE_MIN_ARROWS,
  SLIDE_MIN_HOLES,
  SLIDE_MIN_MOVES,
  SLIDE_MIN_STOPPERS,
  SLIDE_MIN_WALLS,
  type SlideArrow,
  type SlideDir,
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

const DIRS: SlideDir[] = ["U", "D", "L", "R"];

/**
 * How many walls the shortest route actually depends on: take one away and the
 * minimum changes. A layout needs at least four such stoppers.
 */
function stoppers(
  walls: number[],
  holes: number[],
  arrows: SlideArrow[],
  start: number,
  exit: number,
  min: number,
): number {
  let count = 0;
  for (const wall of walls) {
    const without = walls.filter((cell) => cell !== wall);
    if (slideDistance(without, holes, start, exit, start, arrows) !== min) count += 1;
  }
  return count;
}

export function generateIceSlide(): SlidePuzzleData {
  for (let attempt = 1; attempt <= 40_000; attempt++) {
    const cells = shuffled(Array.from({ length: SLIDE_CELLS }, (_, i) => i));
    const exit = cells.find(border)!;
    const wallCount = SLIDE_MIN_WALLS + randomInt(SLIDE_MAX_WALLS - SLIDE_MIN_WALLS + 1);
    const walls = cells.filter((cell) => cell !== exit).slice(0, wallCount);
    const rest = cells.filter((cell) => cell !== exit && !walls.includes(cell));
    const start = rest[0];
    if (start === undefined) continue;

    const holeCount = SLIDE_MIN_HOLES + randomInt(SLIDE_MAX_HOLES - SLIDE_MIN_HOLES + 1);
    const holes = rest.slice(1, 1 + holeCount);
    if (holes.length !== holeCount) continue;

    const arrowCount = SLIDE_MIN_ARROWS + randomInt(SLIDE_MAX_ARROWS - SLIDE_MIN_ARROWS + 1);
    const arrowCells = rest.slice(1 + holeCount, 1 + holeCount + arrowCount);
    if (arrowCells.length !== arrowCount) continue;
    const arrows: SlideArrow[] = arrowCells.map((cell) => ({
      cell,
      dir: shuffled(DIRS)[0]!,
    }));

    const min = slideDistance(walls, holes, start, exit, start, arrows);
    // At least eleven slides, so the exit is never six moves or fewer away.
    if (min === null || min < SLIDE_MIN_MOVES || min > SLIDE_MAX_MOVES) continue;
    // And at least four walls the shortest route genuinely depends on.
    const stopperCount = stoppers(walls, holes, arrows, start, exit, min);
    if (stopperCount < SLIDE_MIN_STOPPERS) continue;

    const route = shortestSlideRoute(walls, holes, start, exit, arrows);
    if (route.length !== min) continue;
    // The stored route must never slide over a hole.
    if (!slideRouteAvoidsHoles(walls, holes, start, exit, route, arrows)) continue;

    console.log(`[iceslide] layout accepted after ${attempt} attempt(s), minimum ${min}`);
    return {
      type: "iceslide",
      walls: [...walls].sort((a, b) => a - b),
      holes: [...holes].sort((a, b) => a - b),
      arrows,
      start,
      exit,
      minMoves: min,
      stats: {
        walls: walls.length,
        holes: holes.length,
        arrows: arrows.length,
        minMoves: min,
        easyExit: min <= SLIDE_EASY_MOVES,
        stoppers: stopperCount,
        attempts: attempt,
      },
      solution: route.join(""),
    };
  }
  throw new Error("Ice Slide generator could not build a reachable layout");
}
