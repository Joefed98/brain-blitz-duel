import { gameDisplayName } from "./gameNames";
/**
 * Server-only Ice Slide generation. Every layout is proved solvable by
 * breadth-first search over (ball cell, broken thin-ice mask); the minimum must
 * land in the band, and the stored shortest route must use a portal and cross
 * thin ice at least once.
 */

import { replaySlide, slideBoard, slideDims, slideOutcome, slideSearch, slideStep } from "./slide";
import type { IceSlideLevelSettings } from "@/lib/levels/pattern/iceslide.levels";
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

/* ------------------------------------------------------------------ Difficulty levels (16 Nov 2026) */

/** Moves one piece of a level board per climb step. */
const LEVEL_CLIMB_STEPS = 1500;
/** Fresh boards a level deal tries before it gives up (each climbed LEVEL_CLIMB_STEPS steps). */
export const SLIDE_LEVEL_MAX_ATTEMPTS = 400;

interface LevelLayout {
  walls: number[];
  holes: number[];
  arrows: SlideArrow[];
  portals: [number, number][];
  thin: number[];
  start: number;
  exit: number;
}

/**
 * A level's board (src/lib/levels/pattern/iceslide.levels.ts). Normal never comes here (it deals `generateIceSlide`'s
 * bank exactly as before). Random boards at the level's counts almost never need 24+ slides (about 1 in 100,000 on
 * Hard), so a level board is climbed: a random board at the level's counts, then one piece at a time moved to a free
 * square (a rock, a hole, a chevron or its heading, a portal end, thin ice, the start), keeping a move only while the
 * breadth-first minimum doesn't fall (nor passes the band's top), until the minimum is in the band (and, where the level
 * asks, the shortest route goes through a portal and over thin ice). Only `Math.random` (seeded by the bank) drives it.
 * The counts never change while climbing, so every board keeps the level's numbers. Dims are stored only when the board
 * isn't 12 × 12, so a 12 × 12 level board reads as every other board.
 */
export function generateIceSlideLevel(s: IceSlideLevelSettings, maxAttempts = SLIDE_LEVEL_MAX_ATTEMPTS): SlidePuzzleData {
  const cells = s.cols * s.rows;
  const edge = (cell: number) => {
    const row = Math.floor(cell / s.cols);
    const col = cell % s.cols;
    return row === 0 || col === 0 || row === s.rows - 1 || col === s.cols - 1;
  };
  const dims = s.cols === N && s.rows === N ? {} : { cols: s.cols, rows: s.rows };
  const [lo, hi] = s.minMoves;
  const arrowsOk = (layout: LevelLayout) => {
    const wallSet = new Set(layout.walls);
    return layout.arrows.every((arrow) => {
      const next = slideStep(arrow.cell, arrow.dir, s.cols, s.rows);
      return next !== null && !wallSet.has(next);
    });
  };
  /** The board's fewest slides (-1: no way out within the band's top) and whether it is a finished level board. */
  let target = lo;
  const judge = (layout: LevelLayout): { min: number; route: SlideDir[] | null; done: boolean } => {
    const found = slideSearch(slideBoard({ ...layout, ...dims }), undefined, hi);
    if (!found) return { min: -1, route: null, done: false };
    if (found.min < target) return { min: found.min, route: found.route, done: false };
    if (!s.routeUsesHazards) return { min: found.min, route: found.route, done: true };
    const uses = routeUsesFeatures({ ...layout, ...dims }, found.route);
    return { min: found.min, route: found.route, done: uses.portal && uses.cracked };
  };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const order = shuffled(Array.from({ length: cells }, (_, i) => i));
    const exit = order.find(edge)!;
    const pool = order.filter((cell) => cell !== exit);
    let at = 0;
    const take = (count: number) => pool.slice(at, (at += count));
    const walls = take(randInt(s.walls[0], s.walls[1]));
    const start = take(1)[0]!;
    const holes = take(randInt(s.holes[0], s.holes[1]));
    const arrows: SlideArrow[] = take(randInt(s.arrows[0], s.arrows[1])).map((cell) => ({ cell, dir: shuffled(DIRS)[0]! }));
    const portalCells = take(2 * randInt(s.portals[0], s.portals[1]));
    const portals: [number, number][] = [];
    for (let i = 0; i < portalCells.length; i += 2) portals.push([portalCells[i]!, portalCells[i + 1]!]);
    const thin = take(randInt(s.thin[0], s.thin[1]));
    // Each board climbs to its own seeded target in the band (so the band is spread, not bunched at its foot).
    target = randInt(lo, hi);
    let layout: LevelLayout = { walls, holes, arrows, portals, thin, start, exit };
    if (!arrowsOk(layout)) continue;
    let now = judge(layout);
    for (let step = 0; step < LEVEL_CLIMB_STEPS && !now.done; step++) {
      const used = new Set([...layout.walls, ...layout.holes, ...layout.arrows.map((a) => a.cell), ...layout.portals.flat(), ...layout.thin, layout.start, layout.exit]);
      const free = Array.from({ length: cells }, (_, i) => i).filter((c) => !used.has(c));
      if (!free.length) break;
      const to = free[randInt(0, free.length - 1)]!;
      const kinds = [
        ...(layout.walls.length ? ["wall", "wall", "wall"] : []),
        ...(layout.holes.length ? ["hole"] : []),
        ...(layout.arrows.length ? ["arrow", "turn"] : []),
        ...(layout.portals.length ? ["portal"] : []),
        ...(layout.thin.length ? ["thin"] : []),
        "start",
      ];
      const kind = kinds[randInt(0, kinds.length - 1)]!;
      const moveIn = (list: number[]) => {
        const i = randInt(0, list.length - 1);
        return list.map((c, j) => (j === i ? to : c));
      };
      let next: LevelLayout;
      if (kind === "wall") next = { ...layout, walls: moveIn(layout.walls) };
      else if (kind === "hole") next = { ...layout, holes: moveIn(layout.holes) };
      else if (kind === "thin") next = { ...layout, thin: moveIn(layout.thin) };
      else if (kind === "start") next = { ...layout, start: to };
      else if (kind === "arrow" || kind === "turn") {
        const i = randInt(0, layout.arrows.length - 1);
        next = { ...layout, arrows: layout.arrows.map((a, j) => (j !== i ? a : kind === "arrow" ? { ...a, cell: to } : { ...a, dir: DIRS[randInt(0, 3)]! })) };
      } else {
        const i = randInt(0, layout.portals.length - 1);
        const end = randInt(0, 1);
        next = { ...layout, portals: layout.portals.map((p, j) => (j !== i ? p : end === 0 ? [to, p[1]] : [p[0], to])) as [number, number][] };
      }
      if (!arrowsOk(next)) continue;
      const after = judge(next);
      // Keep the move unless it shortens the way out or shuts it (a board with no way out yet takes any move).
      if (now.min === -1 ? true : after.min >= now.min) {
        layout = next;
        now = after;
      }
    }
    if (!now.done || !now.route) continue;
    return {
      type: "iceslide",
      ...dims,
      walls: [...layout.walls].sort((x, y) => x - y),
      holes: [...layout.holes].sort((x, y) => x - y),
      arrows: layout.arrows,
      portals: layout.portals,
      thin: layout.thin,
      start: layout.start,
      exit: layout.exit,
      minMoves: now.min,
      stats: { walls: layout.walls.length, holes: layout.holes.length, arrows: layout.arrows.length, minMoves: now.min, easyExit: now.min <= SLIDE_EASY_MOVES, stoppers: 0, attempts: attempt },
      solution: now.route.join(""),
    };
  }
  throw new Error(`${gameDisplayName("iceslide")} level generator could not build a layout`);
}

/**
 * Re-checks a stored level board as `generateIceSlideLevel` accepts one: its size, feature counts in range on distinct
 * squares, the exit on the border, and a fresh breadth-first search over (square, broken ice) giving the same minimum
 * and route, inside the level's band (through a portal and over thin ice where the level asks). Null when it passes.
 */
export function verifyIceSlideLevelPuzzle(puzzle: SlidePuzzleData, s: IceSlideLevelSettings): string | null {
  if (puzzle.type !== "iceslide") return "wrong type";
  const { cols, rows, cells } = slideDims(puzzle);
  if (cols !== s.cols || rows !== s.rows) return "board size";
  if ((s.cols === N && s.rows === N) !== (puzzle.cols === undefined && puzzle.rows === undefined)) return "board size stamp";
  const arrows = puzzle.arrows ?? [];
  const portals = puzzle.portals ?? [];
  const thin = puzzle.thin ?? [];
  const { walls, holes, start, exit } = puzzle;
  const within = (n: number, [lo, hi]: [number, number]) => n >= lo && n <= hi;
  if (!within(walls.length, s.walls)) return "wall count";
  if (!within(holes.length, s.holes)) return "hole count";
  if (!within(arrows.length, s.arrows)) return "arrow count";
  if (!within(portals.length, s.portals)) return "portal count";
  if (!within(thin.length, s.thin)) return "thin-ice count";
  const row = Math.floor(exit / cols);
  const col = exit % cols;
  if (!(row === 0 || col === 0 || row === rows - 1 || col === cols - 1)) return "exit not on the border";
  const all = [...walls, ...holes, ...arrows.map((a) => a.cell), ...portals.flat(), ...thin, start, exit];
  if (new Set(all).size !== all.length || all.some((c) => !Number.isInteger(c) || c < 0 || c >= cells)) return "cells overlap or out of range";
  const wallSet = new Set(walls);
  for (const arrow of arrows) {
    if (!DIRS.includes(arrow.dir)) return "arrow direction";
    const next = slideStep(arrow.cell, arrow.dir, cols, rows);
    if (next === null || wallSet.has(next)) return "arrow into a wall";
  }
  const board = slideBoard(puzzle);
  const found = slideSearch(board, undefined, s.minMoves[1]);
  if (!found) return "exit not reachable within the band";
  if (found.min < s.minMoves[0] || found.min > s.minMoves[1]) return "minimum outside the band";
  if (found.min !== puzzle.minMoves) return "stored minimum";
  if (found.route.join("") !== puzzle.solution) return "stored route";
  const replay = replaySlide(board, found.route);
  if (!replay.solved || replay.moves !== found.min) return "stored route doesn't reach the exit";
  if (s.routeUsesHazards) {
    const uses = routeUsesFeatures(puzzle, found.route);
    if (!uses.portal || !uses.cracked) return "route misses a portal or thin ice";
  }
  return null;
}
