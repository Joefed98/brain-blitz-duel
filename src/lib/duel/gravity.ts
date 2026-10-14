/**
 * Gravity Maze rules. One tilt moves EVERY unlocked ball, so the same function
 * runs on the phone (to animate a tilt) and on the server (to replay the tilt
 * list a phone sends). A ball stops at a wall, the edge or another ball; a ball
 * that comes to rest on its own target locks and never moves again.
 */

import { GRAV_BALLS, GRAV_COLS as N, type GravityDir } from "./types";

export const GRAVITY_DIRS: GravityDir[] = ["U", "D", "L", "R"];

/** Ball squares, in the fixed order gold, teal, purple, pink. */
export type GravityBalls = number[];

export function gravityStep(cell: number, dir: GravityDir): number | null {
  if (dir === "X" || dir === "Y") return null;
  const row = Math.floor(cell / N);
  const col = cell % N;
  if (dir === "U") return row > 0 ? cell - N : null;
  if (dir === "D") return row < N - 1 ? cell + N : null;
  if (dir === "L") return col > 0 ? cell - 1 : null;
  return col < N - 1 ? cell + 1 : null;
}

/** A ball sitting on its own target is locked. */
export function gravityLocked(balls: GravityBalls, targets: number[]): boolean[] {
  return balls.map((cell, index) => cell === targets[index]);
}

export interface TiltOutcome {
  balls: GravityBalls;
  /** Balls that moved at least one square. */
  moved: boolean[];
  /** Balls that locked on this tilt. */
  locked: number[];
}

/** One tilt: every unlocked ball steps forward until nothing can move. */
export function tilt(
  walls: Set<number>,
  balls: GravityBalls,
  targets: number[],
  dir: GravityDir,
): TiltOutcome {
  const pos = [...balls];
  const frozen = gravityLocked(balls, targets);
  const moved = pos.map(() => false);
  for (let guard = 0; guard < N * N * 2; guard++) {
    let any = false;
    for (let i = 0; i < pos.length; i++) {
      if (frozen[i]) continue;
      const next = gravityStep(pos[i]!, dir);
      if (next === null || walls.has(next) || pos.includes(next)) continue;
      pos[i] = next;
      moved[i] = true;
      any = true;
    }
    if (!any) break;
  }
  const locked: number[] = [];
  pos.forEach((cell, i) => {
    if (!frozen[i] && cell === targets[i]) locked.push(i);
  });
  return { balls: pos, moved, locked };
}

export function gravitySolved(balls: GravityBalls, targets: number[]): boolean {
  return balls.every((cell, index) => cell === targets[index]);
}

export function gravityLockCount(balls: GravityBalls, targets: number[]): number {
  return gravityLocked(balls, targets).filter(Boolean).length;
}

export function gravityKey(balls: GravityBalls): number {
  let key = 0;
  for (let i = 0; i < GRAV_BALLS; i++) key = key * N * N + (balls[i] ?? 0);
  return key;
}

export function encodeGravityTilts(tilts: GravityDir[]): string {
  return tilts.join("");
}

export function decodeGravityTilts(raw: string): GravityDir[] {
  return String(raw ?? "")
    .toUpperCase()
    .split("")
    .filter(
      (char): char is GravityDir =>
        (GRAVITY_DIRS as string[]).includes(char) || char === "X" || char === "Y",
    )
    .slice(0, 300);
}

export interface GravityReplay {
  balls: GravityBalls;
  tilts: number;
  solved: boolean;
  locked: number;
  /** True when the tilt limit (gravityRev 1) is used up without a solve: the board has ended unfinished. */
  outOfTilts: boolean;
}

/**
 * The one place a tilt list is turned into an outcome. X = undo, Y = reset.
 * With a tilt limit (gravityRev 1, moveLimits.ts) nothing after the limit-th
 * tilt counts; Undo and Reset never give a tilt back.
 */
export function replayGravity(
  walls: number[] | Set<number>,
  starts: GravityBalls,
  targets: number[],
  tilts: GravityDir[],
  limit: number | null = null,
): GravityReplay {
  const wallSet = walls instanceof Set ? walls : new Set(walls);
  let balls = [...starts];
  let count = 0;
  const history: GravityBalls[] = [[...balls]];
  for (const dir of tilts) {
    if (limit !== null && count >= limit) break;
    if (dir === "X") {
      if (history.length > 1) history.pop();
      balls = [...history[history.length - 1]!];
      continue;
    }
    if (dir === "Y") {
      history.length = 1;
      balls = [...starts];
      continue;
    }
    if (gravitySolved(balls, targets)) break;
    const outcome = tilt(wallSet, balls, targets, dir);
    if (!outcome.moved.some(Boolean)) continue;
    count++;
    balls = outcome.balls;
    history.push([...balls]);
  }
  return {
    balls,
    tilts: count,
    solved: gravitySolved(balls, targets),
    locked: gravityLockCount(balls, targets),
    outOfTilts: limit !== null && count >= limit && !gravitySolved(balls, targets),
  };
}
