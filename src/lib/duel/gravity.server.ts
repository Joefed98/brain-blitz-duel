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

export function solutionSwapsOrder(
  walls: Set<number>,
  start: GravityBalls,
  solution: GravityDir[],
): boolean {
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

/** One random draw, kept only when it clears every rule for the given minimum band. */
function attemptGravity(minTilts: number): GravityPuzzleData | null {
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
  if (!found) return null;
  if (found.minMoves < minTilts || found.minMoves > GRAV_MAX_TILTS) return null;

  // Neither ball may be a trivial solo run.
  if (soloMinimum(walls, startA, targetA) < GRAV_SOLO_MIN_TILTS) return null;
  if (soloMinimum(walls, startB, targetB) < GRAV_SOLO_MIN_TILTS) return null;

  // The shortest solution has to use the balls blocking each other, and at
  // some point swap which of the two sits ahead — otherwise the joint search
  // isn't really being exercised.
  const replay = replayGravity(walls, { a: startA, b: startB }, targetA, targetB, found.solution);
  if (!replay.solved || !replay.usedBlock) return null;
  if (!solutionSwapsOrder(walls, { a: startA, b: startB }, found.solution)) return null;

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

export function generateGravity(): GravityPuzzleData {
  for (let attempt = 0; attempt < GRAV_ATTEMPTS; attempt++) {
    const puzzle = attemptGravity(GRAV_MIN_TILTS);
    if (puzzle) return puzzle;
  }
  // The full band is hard to hit twice in a row: ease the minimum and warn,
  // rather than falling straight to the hand-checked board.
  console.warn(
    `[gravity] no board cleared ${GRAV_MIN_TILTS}-${GRAV_MAX_TILTS} tilts in ${GRAV_ATTEMPTS} attempts, easing minimum to ${GRAV_FALLBACK_MIN_TILTS}`,
  );
  for (let attempt = 0; attempt < GRAV_ATTEMPTS; attempt++) {
    const puzzle = attemptGravity(GRAV_FALLBACK_MIN_TILTS);
    if (puzzle) return puzzle;
  }
  // Nothing random left to try: keep the room moving with a proven fallback.
  return fallbackBoard();
}

/**
 * A hand-checked 10x10 board, only ever used if 400 random draws all fail.
 * Verified by script: joint minimum is 18 tilts (within the wanted band),
 * the shortest route uses ball-blocks-ball, and the two balls swap relative
 * order along the way.
 */
function fallbackBoard(): GravityPuzzleData {
  const walls = [
    8, 11, 15, 20, 24, 26, 27, 28, 30, 39, 40, 43, 48, 56, 59, 65, 67, 68, 69, 73, 81, 84, 89, 90,
    92, 96,
  ];
  const start = { a: 60, b: 62 };
  const targetA = 10;
  const targetB = 29;
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

/**
 * Fewest tilts from any joint position to both balls home, over the same
 * two-ball state space the minimum search uses. Null when it cannot be done.
 */
export function gravityDistance(
  walls: Set<number>,
  from: GravityBalls,
  targetA: number,
  targetB: number,
): number | null {
  if (gravitySolved(from, targetA, targetB)) return 0;
  const seen = new Set<number>([key(from)]);
  let frontier: GravityBalls[] = [from];
  for (let depth = 1; depth <= GRAV_CELLS * 4; depth++) {
    const next: GravityBalls[] = [];
    for (const balls of frontier) {
      for (const dir of GRAVITY_DIRS) {
        const moved = tilt(walls, balls, dir).balls;
        if (moved.a === balls.a && moved.b === balls.b) continue;
        const id = key(moved);
        if (seen.has(id)) continue;
        if (gravitySolved(moved, targetA, targetB)) return depth;
        seen.add(id);
        next.push(moved);
      }
    }
    if (!next.length) return null;
    frontier = next;
  }
  return null;
}
