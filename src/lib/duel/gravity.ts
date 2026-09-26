/**
 * Gravity Maze rules. One tilt moves BOTH balls, so the same function runs on
 * the phone (to animate a tilt) and on the server (to replay the tilt list a
 * phone sends). Balls block each other: a ball stops when the next square holds
 * a wall, the edge, or the other ball.
 */

import { GRAV_COLS as N, type GravityDir } from "./types";

export const GRAVITY_DIRS: GravityDir[] = ["U", "D", "L", "R"];

export interface GravityBalls {
  a: number;
  b: number;
}

export function gravityStep(cell: number, dir: GravityDir): number | null {
  const row = Math.floor(cell / N);
  const col = cell % N;
  if (dir === "U") return row > 0 ? cell - N : null;
  if (dir === "D") return row < N - 1 ? cell + N : null;
  if (dir === "L") return col > 0 ? cell - 1 : null;
  return col < N - 1 ? cell + 1 : null;
}

export interface TiltOutcome {
  balls: GravityBalls;
  /** Squares each ball travelled, for the animation length. */
  distA: number;
  distB: number;
  /** True when one ball came to rest against the other — the whole point. */
  blockedByOther: boolean;
}

/**
 * One tilt. Both balls step forward, one square at a time, until neither can
 * move: a ball penned in behind the other simply waits, and rolls on once the
 * leader has moved away.
 */
export function tilt(walls: Set<number>, balls: GravityBalls, dir: GravityDir): TiltOutcome {
  let { a, b } = balls;
  let distA = 0;
  let distB = 0;

  for (let guard = 0; guard < N * N * 2; guard++) {
    let moved = false;
    const nextA = gravityStep(a, dir);
    if (nextA !== null && !walls.has(nextA) && nextA !== b) {
      a = nextA;
      distA++;
      moved = true;
    }
    const nextB = gravityStep(b, dir);
    if (nextB !== null && !walls.has(nextB) && nextB !== a) {
      b = nextB;
      distB++;
      moved = true;
    }
    if (!moved) break;
  }

  const aheadA = gravityStep(a, dir);
  const aheadB = gravityStep(b, dir);
  const blockedByOther = aheadA === b || aheadB === a;
  return { balls: { a, b }, distA, distB, blockedByOther };
}

export function gravitySolved(balls: GravityBalls, targetA: number, targetB: number): boolean {
  return balls.a === targetA && balls.b === targetB;
}

export function gravityOnTarget(balls: GravityBalls, targetA: number, targetB: number): number {
  return (balls.a === targetA ? 1 : 0) + (balls.b === targetB ? 1 : 0);
}

export function encodeGravityTilts(tilts: GravityDir[]): string {
  return tilts.join("");
}

export function decodeGravityTilts(raw: string): GravityDir[] {
  return String(raw ?? "")
    .toUpperCase()
    .split("")
    .filter((char): char is GravityDir => (GRAVITY_DIRS as string[]).includes(char) || char === "X" || char === "Y")
    .slice(0, 200);
}

export interface GravityReplay {
  balls: GravityBalls;
  tilts: number;
  solved: boolean;
  onTarget: number;
  /** True for at least one tilt where a ball was stopped by the other. */
  usedBlock: boolean;
  /** Every joint position the balls passed through, the start included. */
  states: GravityBalls[];
}

/** The one place a tilt list is turned into an outcome. */
export function replayGravity(
  walls: number[] | Set<number>,
  start: GravityBalls,
  targetA: number,
  targetB: number,
  tilts: GravityDir[],
): GravityReplay {
  const wallSet = walls instanceof Set ? walls : new Set(walls);
  let balls: GravityBalls = { ...start };
  let count = 0;
  let usedBlock = false;
  const states: GravityBalls[] = [{ ...balls }];

  for (const dir of tilts) {
    if (dir === "X") { if (states.length > 1) states.pop(); balls = { ...states[states.length - 1]! }; continue; }
    if (dir === "Y") { states.length = 1; balls = { ...start }; continue; }
    if (gravitySolved(balls, targetA, targetB)) break;
    const outcome = tilt(wallSet, balls, dir);
    count++;
    if (outcome.blockedByOther) usedBlock = true;
    balls = outcome.balls;
    states.push({ ...balls });
  }
  return {
    balls,
    tilts: count,
    solved: gravitySolved(balls, targetA, targetB),
    onTarget: gravityOnTarget(balls, targetA, targetB),
    usedBlock,
    states,
  };
}
