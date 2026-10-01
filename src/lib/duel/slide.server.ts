/**
 * Server-only Ice Slide generation. Every layout is proved solvable by
 * breadth-first search over (ball cell, broken thin-ice mask); the minimum must
 * land in the band, and the stored shortest route must use a portal and cross
 * thin ice at least once.
 */

import { slideBoard, slideOutcome, slideSearch, slideStep } from "./slide";
import { randInt, shuffled } from "./random";
import {
  SLIDE_CELLS,
  SLIDE_COLS as N,
  SLIDE_EASY_MOVES,
  SLIDE_MAX_ARROWS,
  SLIDE_MAX_HOLES,
  SLIDE_MAX_MOVES,
  SLIDE_MAX_PORTALS,
  SLIDE_MAX_THIN,
  SLIDE_MAX_WALLS,
  SLIDE_MIN_ARROWS,
  SLIDE_MIN_HOLES,
  SLIDE_MIN_MOVES,
  SLIDE_MIN_PORTALS,
  SLIDE_MIN_THIN,
  SLIDE_MIN_WALLS,
  type SlideArrow,
  type SlideDir,
  type SlidePuzzleData,
} from "./types";

function border(cell: number): boolean {
  const row = Math.floor(cell / N);
  const col = cell % N;
  return row === 0 || col === 0 || row === N - 1 || col === N - 1;
}

const DIRS: SlideDir[] = ["U", "D", "L", "R"];

/** True when the route goes through a portal and over thin ice at least once. */
export function routeUsesFeatures(
  puzzle: Pick<SlidePuzzleData, "walls" | "holes" | "arrows" | "portals" | "thin" | "start" | "exit">,
  route: SlideDir[],
): { portal: boolean; cracked: boolean } {
  const board = slideBoard(puzzle);
  let cell = board.start;
  let mask = 0;
  let portal = false;
  let cracked = false;
  for (const dir of route) {
    const out = slideOutcome(board, cell, mask, dir);
    portal ||= out.portal;
    cracked ||= out.cracked;
    cell = out.cell;
    mask = out.mask;
  }
  return { portal, cracked };
}

export function generateIceSlide(): SlidePuzzleData {
  for (let attempt = 1; attempt <= 500_000; attempt++) {
    const cells = shuffled(Array.from({ length: SLIDE_CELLS }, (_, i) => i));
    const exit = cells.find(border)!;
    const pool = cells.filter((cell) => cell !== exit);
    let at = 0;
    const take = (count: number) => pool.slice(at, (at += count));
    const walls = take(randInt(SLIDE_MIN_WALLS, SLIDE_MAX_WALLS));
    const start = take(1)[0]!;
    const holes = take(randInt(SLIDE_MIN_HOLES, SLIDE_MAX_HOLES));
    const wallSet = new Set(walls);
    const arrows: SlideArrow[] = take(randInt(SLIDE_MIN_ARROWS, SLIDE_MAX_ARROWS))
      .map((cell) => ({ cell, dir: shuffled(DIRS)[0]! }))
      .filter((arrow) => {
        const next = slideStep(arrow.cell, arrow.dir);
        return next !== null && !wallSet.has(next);
      });
    if (!arrows.length) continue;
    const portalCells = take(2 * randInt(SLIDE_MIN_PORTALS, SLIDE_MAX_PORTALS));
    const portals: [number, number][] = [];
    for (let i = 0; i < portalCells.length; i += 2) portals.push([portalCells[i]!, portalCells[i + 1]!]);
    const thin = take(randInt(SLIDE_MIN_THIN, SLIDE_MAX_THIN));

    const puzzle = { walls, holes, arrows, portals, thin, start, exit };
    const found = slideSearch(slideBoard(puzzle), undefined, SLIDE_MAX_MOVES);
    if (!found || found.min < SLIDE_MIN_MOVES || found.min > SLIDE_MAX_MOVES) continue;
    const uses = routeUsesFeatures(puzzle, found.route);
    if (!uses.portal || !uses.cracked) continue;

    return {
      type: "iceslide",
      walls: [...walls].sort((a, b) => a - b),
      holes: [...holes].sort((a, b) => a - b),
      arrows,
      portals,
      thin,
      start,
      exit,
      minMoves: found.min,
      stats: {
        walls: walls.length,
        holes: holes.length,
        arrows: arrows.length,
        minMoves: found.min,
        easyExit: found.min <= SLIDE_EASY_MOVES,
        stoppers: 0,
        attempts: attempt,
      },
      solution: found.route.join(""),
    };
  }
  throw new Error("Ice Slide generator could not build a reachable layout");
}
