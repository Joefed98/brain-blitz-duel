/**
 * Server-only generation for Sliding Tiles. The frame starts solved and is
 * scrambled with legal slides (so it is always solvable), then A* with the
 * Manhattan heuristic finds the exact minimum. Only frames needing 10–16 slides
 * are kept; the minimum and one shortest route stay private until the reveal.
 */

import { pick, randomBelow } from "./random";
import { solvedFrame, tilesMovable, tilesSlide, tilesSolved } from "./tiles";
import {
  TILES_ATTEMPTS,
  TILES_MAX_MOVES,
  TILES_MIN_MOVES,
  TILES_SIZE,
  type TilesPuzzleData,
} from "./types";

const GOAL = solvedFrame();

/** Sum of each tile's distance from home — never overestimates the true cost. */
function manhattan(frame: number[]): number {
  let total = 0;
  frame.forEach((value, index) => {
    if (value === 0) return;
    const home = GOAL.indexOf(value);
    total +=
      Math.abs(Math.floor(index / TILES_SIZE) - Math.floor(home / TILES_SIZE)) +
      Math.abs((index % TILES_SIZE) - (home % TILES_SIZE));
  });
  return total;
}

/** Exact shortest slide order, found by iterative-deepening A*. */
export function tilesMinMoves(start: number[]): { min: number; solution: number[] } | null {
  if (tilesSolved(start)) return { min: 0, solution: [] };
  let bound = manhattan(start);

  const search = (
    frame: number[],
    depth: number,
    last: number,
    route: number[],
  ): { found: number[] } | number => {
    const estimate = depth + manhattan(frame);
    if (estimate > bound) return estimate;
    if (tilesSolved(frame)) return { found: route };
    let best = Number.POSITIVE_INFINITY;
    for (const tile of tilesMovable(frame)) {
      if (tile === last) continue;
      const next = tilesSlide(frame, tile);
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

function scramble(steps: number): number[] {
  let frame = [...GOAL];
  let last = -1;
  for (let step = 0; step < steps; step += 1) {
    const options = tilesMovable(frame).filter((tile) => tile !== last);
    const tile = options.length ? pick(options) : pick(tilesMovable(frame));
    const next = tilesSlide(frame, tile);
    if (!next) continue;
    frame = next;
    last = tile;
  }
  return frame;
}

export function generateTiles(): TilesPuzzleData {
  for (let attempt = 0; attempt < TILES_ATTEMPTS; attempt += 1) {
    const frame = scramble(TILES_MIN_MOVES + randomBelow(TILES_MAX_MOVES + 8));
    const solved = tilesMinMoves(frame);
    if (!solved) continue;
    if (solved.min < TILES_MIN_MOVES || solved.min > TILES_MAX_MOVES) continue;
    return { type: "tiles", frame, minMoves: solved.min, solution: solved.solution };
  }
  // Never reached in practice: keep whatever the last scramble produced.
  const frame = scramble(TILES_MIN_MOVES);
  const solved = tilesMinMoves(frame);
  return {
    type: "tiles",
    frame,
    ...(solved ? { minMoves: solved.min, solution: solved.solution } : {}),
  };
}
