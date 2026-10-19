/**
 * Server-only generation for Sliding Tiles. The frame starts solved and is
 * scrambled with legal slides (so it is always solvable), then IDA* with the
 * Manhattan heuristic finds the exact minimum. The minimum and one shortest
 * route stay private until the reveal.
 *
 * New rounds (tilesRev 1, 14 Oct 2026) play the 3×3 grid plus one extra cell on
 * a random side (tiles.ts); only boards needing TILES_EXTRA_MIN_MOVES –
 * TILES_EXTRA_MAX_MOVES slides are kept. Stored rounds keep their classic 3×3
 * frame (10–16 slides), which `generateClassicTiles` still reproduces.
 */

import { pick, randomBelow } from "./random";
import {
  CLASSIC_TILES_LAYOUT,
  extraLayout,
  solvedFrame,
  TILES_REV_CLOCK,
  TILES_REV2_TIME_MS,
  tilesMovable,
  tilesSlide,
  tilesSolved,
  type TilesLayout,
} from "./tiles";
import {
  TILES_ATTEMPTS,
  TILES_EXTRA_MAX_MOVES,
  TILES_EXTRA_MIN_MOVES,
  TILES_MAX_MOVES,
  TILES_MIN_MOVES,
  type TilesExtra,
  type TilesPuzzleData,
} from "./types";

/** Sum of each tile's grid distance from home — never overestimates the true cost on any board shape. */
function manhattan(frame: number[], layout: TilesLayout): number {
  let total = 0;
  for (let index = 0; index < frame.length; index++) {
    const value = frame[index]!;
    if (value === 0) continue;
    const here = layout.cells[index]!;
    const home = layout.cells[layout.goal.indexOf(value)]!;
    total += Math.abs(here.r - home.r) + Math.abs(here.c - home.c);
  }
  return total;
}

/** Exact shortest slide order, found by iterative-deepening A*. */
export function tilesMinMoves(
  start: number[],
  layout: TilesLayout = CLASSIC_TILES_LAYOUT,
): { min: number; solution: number[] } | null {
  if (tilesSolved(start, layout)) return { min: 0, solution: [] };
  let bound = manhattan(start, layout);

  const search = (
    frame: number[],
    depth: number,
    last: number,
    route: number[],
  ): { found: number[] } | number => {
    const estimate = depth + manhattan(frame, layout);
    if (estimate > bound) return estimate;
    if (tilesSolved(frame, layout)) return { found: route };
    let best = Number.POSITIVE_INFINITY;
    for (const tile of tilesMovable(frame, layout)) {
      if (tile === last) continue;
      const next = tilesSlide(frame, tile, layout);
      if (!next) continue;
      route.push(tile);
      const result = search(next, depth + 1, tile, route);
      if (typeof result !== "number") return result;
      route.pop();
      if (result < best) best = result;
    }
    return best;
  };

  for (let round = 0; round < 80; round += 1) {
    const result = search([...start], 0, -1, []);
    if (typeof result !== "number") return { min: result.found.length, solution: result.found };
    if (!Number.isFinite(result)) return null;
    bound = result;
  }
  return null;
}

/** A random walk of legal slides from the finished frame (never straight back). */
function scramble(steps: number, layout: TilesLayout): number[] {
  let frame = solvedFrame(layout);
  let last = -1;
  for (let step = 0; step < steps; step += 1) {
    const options = tilesMovable(frame, layout).filter((tile) => tile !== last);
    const tile = options.length ? pick(options) : pick(tilesMovable(frame, layout));
    const next = tilesSlide(frame, tile, layout);
    if (!next) continue;
    frame = next;
    last = tile;
  }
  return frame;
}

/** Stored rounds' classic 3×3 generator, unchanged (10–16 slides). */
export function generateClassicTiles(): TilesPuzzleData {
  const layout = CLASSIC_TILES_LAYOUT;
  for (let attempt = 0; attempt < TILES_ATTEMPTS; attempt += 1) {
    const frame = scramble(TILES_MIN_MOVES + randomBelow(TILES_MAX_MOVES + 8), layout);
    const solved = tilesMinMoves(frame, layout);
    if (!solved) continue;
    if (solved.min < TILES_MIN_MOVES || solved.min > TILES_MAX_MOVES) continue;
    return { type: "tiles", frame, minMoves: solved.min, solution: solved.solution };
  }
  // Never reached in practice: keep whatever the last scramble produced.
  const frame = scramble(TILES_MIN_MOVES, layout);
  const solved = tilesMinMoves(frame, layout);
  return {
    type: "tiles",
    frame,
    ...(solved ? { minMoves: solved.min, solution: solved.solution } : {}),
  };
}

const SIDES: TilesExtra["side"][] = ["top", "bottom", "left", "right"];

/**
 * tilesRev 1 (now dealt as tilesRev 2, the same board on a 90 s clock): the extra cell goes on a random side and position, the solved
 * board is scrambled by a long random walk (so it is always solvable), and the
 * board is kept when its exact minimum lands in the band.
 */
export function generateTiles(): TilesPuzzleData {
  const extra: TilesExtra = { side: pick(SIDES), index: randomBelow(3) };
  const layout = extraLayout(extra);
  let fallback: TilesPuzzleData | null = null;
  for (let attempt = 0; attempt < TILES_ATTEMPTS; attempt += 1) {
    const frame = scramble(TILES_EXTRA_MAX_MOVES * 3 + randomBelow(40), layout);
    const solved = tilesMinMoves(frame, layout);
    if (!solved) continue;
    const puzzle: TilesPuzzleData = {
      type: "tiles",
      tilesRev: TILES_REV_CLOCK,
      timeLimitMs: TILES_REV2_TIME_MS,
      extra,
      frame,
      minMoves: solved.min,
      solution: solved.solution,
    };
    if (solved.min >= TILES_EXTRA_MIN_MOVES && solved.min <= TILES_EXTRA_MAX_MOVES) return puzzle;
    if (solved.min >= TILES_EXTRA_MIN_MOVES - 4 && (!fallback || solved.min < fallback.minMoves!)) fallback = puzzle;
  }
  // Never reached in practice: the closest board found.
  if (fallback) return fallback;
  const frame = scramble(TILES_EXTRA_MAX_MOVES * 3, layout);
  const solved = tilesMinMoves(frame, layout);
  return {
    type: "tiles",
    tilesRev: TILES_REV_CLOCK,
    timeLimitMs: TILES_REV2_TIME_MS,
    extra,
    frame,
    ...(solved ? { minMoves: solved.min, solution: solved.solution } : {}),
  };
}
