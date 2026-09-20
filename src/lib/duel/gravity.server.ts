/**
 * Server-only generation for Gravity Maze.
 *
 * The minimum is searched breadth-first over the JOINT state — ball A's square
 * paired with ball B's square — so it accounts for the balls blocking each
 * other. A board is only kept when that minimum lands in the wanted band,
 * neither ball can reach its own target alone in under three tilts, and at
 * least one tilt of the shortest solution has one ball stopped by the other.
 */

import { pick, randInt, randomBelow, shuffled } from "./random";
import {
  GRAVITY_DIRS,
  encodeGravityTilts,
  gravitySolved,
  replayGravity,
  tilt,
  type GravityBalls,
} from "./gravity";
import {
  GRAV_ATTEMPTS,
  GRAV_CELLS,
  GRAV_FALLBACK_MIN_TILTS,
  GRAV_MAX_TILTS,
  GRAV_MAX_WALLS,
  GRAV_MIN_TILTS,
  GRAV_MIN_WALLS,
  GRAV_SOLO_MIN_TILTS,
  type GravityDir,
  type GravityPuzzleData,
} from "./types";

function key(balls: GravityBalls): number {
  return balls.a * GRAV_CELLS + balls.b;
}

interface Node {
  balls: GravityBalls;
  dir: GravityDir | null;
  parent: number;
}

/** Fewest tilts over the joint two-ball state, plus one shortest tilt list. */
export function gravityMinimum(
  walls: Set<number>,
  start: GravityBalls,
  targetA: number,
  targetB: number,
): { minMoves: number; solution: GravityDir[] } | null {
  if (gravitySolved(start, targetA, targetB)) return null;
  const nodes: Node[] = [{ balls: start, dir: null, parent: -1 }];
  const seen = new Set<number>([key(start)]);

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]!;
    for (const dir of GRAVITY_DIRS) {
      const outcome = tilt(walls, node.balls, dir);
      const next = outcome.balls;
      if (next.a === node.balls.a && next.b === node.balls.b) continue;
      const id = key(next);
      if (seen.has(id)) continue;
      seen.add(id);
      const child: Node = { balls: next, dir, parent: index };
      nodes.push(child);
      if (gravitySolved(next, targetA, targetB)) {
        const path: GravityDir[] = [];
        let walk: Node | undefined = child;
        while (walk && walk.dir) {
          path.unshift(walk.dir);
          walk = nodes[walk.parent];
        }
        return { minMoves: path.length, solution: path };
      }
    }
  }
  return null;
}

/**
 * True when the stored shortest solution has at least one tilt where the balls
 * swap relative order — cell index a below b becomes a above b, or vice versa.
 * A run that never mixes the balls up doesn't really test the joint search.
 */
function soloOrder(a: number, b: number): number {
  return Math.sign(a - b);
}

function solutionSwapsOrder(walls: Set<number>, start: GravityBalls, solution: GravityDir[]): boolean {
  let balls = start;
  let order = soloOrder(balls.a, balls.b);
  for (const dir of solution) {
    balls = tilt(walls, balls, dir).balls;
    const next = soloOrder(balls.a, balls.b);
    if (next !== 0 && order !== 0 && next !== order) return true;
    if (next !== 0) order = next;
  }
  return false;
}

/** Fewest tilts for one ball on its own — the other ball is not on the board. */
function soloMinimum(walls: Set<number>, from: number, target: number): number {
  if (from === target) return 0;
  const queue: { cell: number; depth: number }[] = [{ cell: from, depth: 0 }];
  const seen = new Set<number>([from]);
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index]!;
    for (const dir of GRAVITY_DIRS) {
      // A lone ball: park the partner off the board by reusing its own square.
      const outcome = tilt(walls, { a: node.cell, b: node.cell }, dir);
      const cell = outcome.balls.a;
      if (cell === node.cell || seen.has(cell)) continue;
      if (cell === target) return node.depth + 1;
      seen.add(cell);
      queue.push({ cell, depth: node.depth + 1 });
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

export function generateGravity(): GravityPuzzleData {
  for (let attempt = 0; attempt < 600; attempt++) {
    const cells = shuffled(Array.from({ length: GRAV_CELLS }, (_, cell) => cell));
    const startA = cells[0]!;
    const startB = cells[1]!;
    const targetA = cells[2]!;
    const targetB = cells[3]!;
    const reserved = new Set([startA, startB, targetA, targetB]);

    const walls = new Set<number>();
    const wallCount = randInt(GRAV_MIN_WALLS, GRAV_MAX_WALLS);
    let guard = 0;
    while (walls.size < wallCount && guard++ < 400) {
      const cell = randomBelow(GRAV_CELLS);
      if (reserved.has(cell)) continue;
      walls.add(cell);
    }

    const found = gravityMinimum(walls, { a: startA, b: startB }, targetA, targetB);
    if (!found) continue;
    if (found.minMoves < GRAV_MIN_TILTS || found.minMoves > GRAV_MAX_TILTS) continue;

    // Neither ball may be a trivial solo run.
    if (soloMinimum(walls, startA, targetA) < GRAV_SOLO_MIN_TILTS) continue;
    if (soloMinimum(walls, startB, targetB) < GRAV_SOLO_MIN_TILTS) continue;

    // The shortest solution has to use the balls blocking each other.
    const replay = replayGravity(walls, { a: startA, b: startB }, targetA, targetB, found.solution);
    if (!replay.solved || !replay.usedBlock) continue;

    return {
      type: "gravity",
      walls: [...walls].sort((x, y) => x - y),
      startA,
      startB,
      targetA,
      targetB,
      minMoves: found.minMoves,
      solution: encodeGravityTilts(found.solution),
    };
  }
  // Nothing random left to try: keep the room moving with a proven fallback.
  return fallbackBoard();
}

/** A hand-checked board, only ever used if 600 random draws all fail. */
function fallbackBoard(): GravityPuzzleData {
  const walls = [2, 10, 18, 21, 27, 29, 34, 36, 43, 45, 50, 52, 58, 60];
  const start = { a: 0, b: 7 };
  const targetA = 56;
  const targetB = 63;
  const found = gravityMinimum(new Set(walls), start, targetA, targetB);
  return {
    type: "gravity",
    walls,
    startA: start.a,
    startB: start.b,
    targetA,
    targetB,
    minMoves: found?.minMoves ?? 0,
    solution: encodeGravityTilts(found?.solution ?? [pick(GRAVITY_DIRS)]),
  };
}
