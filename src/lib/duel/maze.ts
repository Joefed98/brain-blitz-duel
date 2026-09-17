/**
 * Maze Dash rules. The corridor test and the route check are shared by the
 * phone (to snap the drawn line to the corridors) and by the server (to check
 * the route a phone sends).
 */

import { MAZE_CELLS, MAZE_COLS as N } from "./types";

/** Open-side bits. */
export const MAZE_N = 1;
export const MAZE_E = 2;
export const MAZE_S = 4;
export const MAZE_W = 8;

export function mazeRow(cell: number): number {
  return Math.floor(cell / N);
}

export function mazeCol(cell: number): number {
  return cell % N;
}

/** The side of `from` that faces `to`, or 0 when they are not neighbours. */
export function mazeSideBetween(from: number, to: number): number {
  if (to === from - N && mazeRow(from) > 0) return MAZE_N;
  if (to === from + N && mazeRow(from) < N - 1) return MAZE_S;
  if (to === from - 1 && mazeCol(from) > 0) return MAZE_W;
  if (to === from + 1 && mazeCol(from) < N - 1) return MAZE_E;
  return 0;
}

/** True when a corridor joins the two cells (both walls are open). */
export function mazeOpen(cells: number[], from: number, to: number): boolean {
  const side = mazeSideBetween(from, to);
  if (!side) return false;
  const back = mazeSideBetween(to, from);
  return Boolean((cells[from] ?? 0) & side) && Boolean((cells[to] ?? 0) & back);
}

export function mazeCorridorNeighbours(cells: number[], cell: number): number[] {
  return [cell - N, cell + N, cell - 1, cell + 1].filter(
    (next) => next >= 0 && next < MAZE_CELLS && mazeOpen(cells, cell, next),
  );
}

/** The one route between two cells in a perfect maze. */
export function mazeRoute(cells: number[], start: number, exit: number): number[] {
  const from = new Map<number, number>([[start, -1]]);
  const queue = [start];
  while (queue.length) {
    const cell = queue.shift()!;
    if (cell === exit) break;
    for (const next of mazeCorridorNeighbours(cells, cell)) {
      if (from.has(next)) continue;
      from.set(next, cell);
      queue.push(next);
    }
  }
  if (!from.has(exit)) return [];
  const route: number[] = [];
  let cell = exit;
  while (cell !== -1) {
    route.unshift(cell);
    cell = from.get(cell)!;
  }
  return route;
}

/** How many times a route changes direction. */
export function mazeTurns(route: number[]): number {
  let turns = 0;
  for (let index = 2; index < route.length; index++) {
    const first = route[index - 1]! - route[index - 2]!;
    const second = route[index]! - route[index - 1]!;
    if (first !== second) turns += 1;
  }
  return turns;
}

export function encodeMazePath(path: number[]): string {
  return path.join(",");
}

export function decodeMazePath(raw: string): number[] {
  return String(raw ?? "")
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < MAZE_CELLS)
    .slice(0, MAZE_CELLS * 4);
}

export interface MazeVerdict {
  solved: boolean;
  /** Cells of the drawn route that were legal corridor steps. */
  walked: number;
  /** Wasted cells: steps that were not on the solution route. */
  wasted: number;
  /** Furthest solution cell reached, as a fraction of the route length. */
  progress: number;
}

/**
 * Re-walks the drawn path from the start. A step that is not a corridor step
 * ends the walk, so nothing beyond an impossible move ever counts.
 */
export function verifyMazePath(
  cells: number[],
  start: number,
  exit: number,
  solution: number[],
  path: number[],
): MazeVerdict {
  const walk: number[] = [];
  if (path[0] === start) {
    walk.push(start);
    for (let index = 1; index < path.length; index++) {
      const cell = path[index]!;
      const previous = walk[walk.length - 1]!;
      if (cell === previous) continue;
      if (!mazeOpen(cells, previous, cell)) break;
      walk.push(cell);
      if (cell === exit) break;
    }
  }

  const routeIndex = new Map<number, number>();
  solution.forEach((cell, index) => routeIndex.set(cell, index));
  let furthest = 0;
  for (const cell of walk) {
    const index = routeIndex.get(cell);
    if (index !== undefined && index > furthest) furthest = index;
  }

  const onRoute = walk.filter((cell) => routeIndex.has(cell)).length;
  const length = Math.max(1, solution.length);
  return {
    solved: walk[walk.length - 1] === exit,
    walked: walk.length,
    wasted: Math.max(0, walk.length - onRoute),
    progress: Math.min(1, (furthest + 1) / length),
  };
}
