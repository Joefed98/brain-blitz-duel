/**
 * Server-only generation for Gravity Maze (four balls, locking targets).
 *
 * The minimum is found by breadth-first search over the joint state (all four
 * ball squares; a ball's locked flag is implied by it resting on its target),
 * capped at GRAV_NODE_CAP states — a board that hits the cap is re-rolled.
 * Breadth-first rather than A* with the summed per-ball heuristic: one tilt
 * moves every ball, so that sum over-estimates and could not prove a minimum.
 */

import { randInt, shuffled } from "./random";
import {
  GRAVITY_DIRS,
  encodeGravityTilts,
  gravityKey,
  gravitySolved,
  tilt,
  type GravityBalls,
} from "./gravity";
import {
  GRAV_BALLS,
  GRAV_CELLS,
  GRAV_MAX_TILTS,
  GRAV_MAX_WALLS,
  GRAV_MIN_TILTS,
  GRAV_MIN_WALLS,
  GRAV_NODE_CAP,
  type GravityDir,
  type GravityPuzzleData,
} from "./types";

/** Fewest tilts to lock every ball, plus one shortest list; null if unsolvable or capped. */
export function gravityMinimum(
  walls: Set<number>,
  start: GravityBalls,
  targets: number[],
  maxDepth = Number.MAX_SAFE_INTEGER,
): { minMoves: number; solution: GravityDir[] } | null {
  if (gravitySolved(start, targets)) return null;
  const states: GravityBalls[] = [start];
  const parent: number[] = [-1];
  const via: GravityDir[] = ["X"];
  const depth: number[] = [0];
  const seen = new Set<number>([gravityKey(start)]);
  for (let index = 0; index < states.length; index++) {
    if (states.length > GRAV_NODE_CAP) return null;
    if (depth[index]! >= maxDepth) return null;
    for (const dir of GRAVITY_DIRS) {
      const out = tilt(walls, states[index]!, targets, dir);
      if (!out.moved.some(Boolean)) continue;
      const id = gravityKey(out.balls);
      if (seen.has(id)) continue;
      seen.add(id);
      states.push(out.balls);
      parent.push(index);
      via.push(dir);
      depth.push(depth[index]! + 1);
      if (gravitySolved(out.balls, targets)) {
        const path: GravityDir[] = [];
        for (let walk = states.length - 1; walk > 0; walk = parent[walk]!) path.unshift(via[walk]!);
        return { minMoves: path.length, solution: path };
      }
    }
  }
  return null;
}

/** Balls (other than the one locking) that moved on a tilt where another ball locked. */
export function lockInteractions(
  walls: Set<number>,
  start: GravityBalls,
  targets: number[],
  solution: GravityDir[],
): number {
  const movers = new Set<number>();
  let balls = start;
  for (const dir of solution) {
    const out = tilt(walls, balls, targets, dir);
    if (out.locked.length) {
      out.moved.forEach((did, i) => {
        if (did && !(out.locked.length === 1 && out.locked[0] === i)) movers.add(i);
      });
    }
    balls = out.balls;
  }
  return movers.size;
}

function attempt(): GravityPuzzleData | null {
  const cells = shuffled(Array.from({ length: GRAV_CELLS }, (_, cell) => cell));
  const starts = cells.slice(0, GRAV_BALLS);
  const targets = cells.slice(GRAV_BALLS, GRAV_BALLS * 2);
  const wallCount = randInt(GRAV_MIN_WALLS, GRAV_MAX_WALLS);
  const walls = new Set(cells.slice(GRAV_BALLS * 2, GRAV_BALLS * 2 + wallCount));

  // No ball may lock on the very first tilt.
  for (const dir of GRAVITY_DIRS) {
    if (tilt(walls, starts, targets, dir).locked.length) return null;
  }
  const found = gravityMinimum(walls, starts, targets, GRAV_MAX_TILTS);
  if (!found || found.minMoves < GRAV_MIN_TILTS || found.minMoves > GRAV_MAX_TILTS) return null;
  if (lockInteractions(walls, starts, targets, found.solution) < 2) return null;
  return {
    type: "gravity",
    walls: [...walls].sort((x, y) => x - y),
    starts,
    targets,
    minMoves: found.minMoves,
    solution: encodeGravityTilts(found.solution),
  };
}

/** Unlimited unless a cap is given (the bank build and the live fallback pass one). */
export function generateGravity(maxTries = Number.POSITIVE_INFINITY): GravityPuzzleData {
  for (let tries = 1; tries <= maxTries; tries++) {
    const puzzle = attempt();
    if (puzzle) return puzzle;
    if (tries % 2000 === 0) console.warn(`[gravity] ${tries} boards rejected so far`);
  }
  throw new Error(`Gravity generator found no board in ${maxTries} tries`);
}

/**
 * Re-checks a stored board as `generateGravity` accepts one: four balls and
 * targets on distinct open squares, a wall count in range, no lock on the
 * first tilt, and a fresh joint breadth-first search giving the same minimum
 * and tilt list, inside the band, with at least two lock interactions.
 */
export function verifyGravityPuzzle(puzzle: GravityPuzzleData): string | null {
  if (puzzle.type !== "gravity") return "wrong type";
  const { starts, targets } = puzzle;
  const walls = new Set(puzzle.walls);
  if (puzzle.walls.length < GRAV_MIN_WALLS || puzzle.walls.length > GRAV_MAX_WALLS) return "wall count";
  if (puzzle.walls.some((c, i) => i > 0 && c <= puzzle.walls[i - 1]!)) return "walls not sorted";
  if (starts.length !== GRAV_BALLS || targets.length !== GRAV_BALLS) return "ball count";
  const all = [...puzzle.walls, ...starts, ...targets];
  if (new Set(all).size !== all.length || all.some((c) => !Number.isInteger(c) || c < 0 || c >= GRAV_CELLS))
    return "cells overlap or out of range";
  for (const dir of GRAVITY_DIRS) {
    if (tilt(walls, starts, targets, dir).locked.length) return "locks on the first tilt";
  }
  const found = gravityMinimum(walls, starts, targets, GRAV_MAX_TILTS);
  if (!found) return "no solution within the cap";
  if (found.minMoves < GRAV_MIN_TILTS || found.minMoves > GRAV_MAX_TILTS) return "minimum outside the band";
  if (found.minMoves !== puzzle.minMoves) return "stored minimum";
  if (encodeGravityTilts(found.solution) !== puzzle.solution) return "stored solution";
  if (lockInteractions(walls, starts, targets, found.solution) < 2) return "too few lock interactions";
  return null;
}
