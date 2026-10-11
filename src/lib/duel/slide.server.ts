import { gameDisplayName } from "./gameNames";
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

/** The live generator's own attempt cap. */
export const SLIDE_MAX_ATTEMPTS = 500_000;

export function generateIceSlide(maxAttempts = SLIDE_MAX_ATTEMPTS): SlidePuzzleData {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
  throw new Error(`${gameDisplayName("iceslide")} generator could not build a reachable layout`);
}

/**
 * Re-checks a stored layout as `generateIceSlide` accepts one: feature counts
 * in range on distinct cells, the exit on the border, and a fresh search over
 * (cell, broken-ice mask) giving the same minimum and route, inside the band,
 * through a portal and over thin ice.
 */
export function verifyIceSlidePuzzle(puzzle: SlidePuzzleData): string | null {
  if (puzzle.type !== "iceslide") return "wrong type";
  const arrows = puzzle.arrows ?? [];
  const portals = puzzle.portals ?? [];
  const thin = puzzle.thin ?? [];
  const { walls, holes, start, exit } = puzzle;
  if (walls.length < SLIDE_MIN_WALLS || walls.length > SLIDE_MAX_WALLS) return "wall count";
  if (holes.length < SLIDE_MIN_HOLES || holes.length > SLIDE_MAX_HOLES) return "hole count";
  if (arrows.length < SLIDE_MIN_ARROWS || arrows.length > SLIDE_MAX_ARROWS) return "arrow count";
  if (portals.length < SLIDE_MIN_PORTALS || portals.length > SLIDE_MAX_PORTALS) return "portal count";
  if (thin.length < SLIDE_MIN_THIN || thin.length > SLIDE_MAX_THIN) return "thin-ice count";
  if (!border(exit)) return "exit not on the border";
  const cells = [...walls, ...holes, ...arrows.map((a) => a.cell), ...portals.flat(), ...thin, start, exit];
  if (new Set(cells).size !== cells.length || cells.some((c) => !Number.isInteger(c) || c < 0 || c >= SLIDE_CELLS))
    return "cells overlap or out of range";
  const wallSet = new Set(walls);
  for (const arrow of arrows) {
    if (!DIRS.includes(arrow.dir)) return "arrow direction";
    const next = slideStep(arrow.cell, arrow.dir);
    if (next === null || wallSet.has(next)) return "arrow into a wall";
  }
  const found = slideSearch(slideBoard(puzzle), undefined, SLIDE_MAX_MOVES);
  if (!found) return "exit not reachable within the cap";
  if (found.min < SLIDE_MIN_MOVES || found.min > SLIDE_MAX_MOVES) return "minimum outside the band";
  if (found.min !== puzzle.minMoves) return "stored minimum";
  if (found.route.join("") !== puzzle.solution) return "stored route";
  const uses = routeUsesFeatures(puzzle, found.route);
  if (!uses.portal || !uses.cracked) return "route misses a portal or thin ice";
  return null;
}
