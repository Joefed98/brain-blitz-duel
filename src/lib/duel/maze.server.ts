/**
 * Server-only Maze Dash generation: a perfect maze grown by the growing-tree
 * method, biased towards branching so the run is full of forks, and kept only
 * when its single route is long enough, twisty enough, forked enough and hung
 * with enough long false trails to punish a careless run.
 */

import {
  MAZE_E,
  MAZE_N,
  MAZE_S,
  MAZE_W,
  mazeCol,
  mazeCorridorNeighbours,
  mazeRoute,
  mazeRow,
  mazeSideBetween,
  mazeTurns,
} from "./maze";
import { shuffled } from "./random";
import {
  MAZE_CELLS,
  MAZE_COLS as N,
  MAZE_DEAD_END_LENGTH,
  MAZE_MIN_DEAD_ENDS,
  MAZE_MIN_JUNCTIONS,
  MAZE_MIN_PATH,
  MAZE_MIN_TURNS,
  type MazePuzzleData,
} from "./types";

function neighbours(cell: number): number[] {
  const out: number[] = [];
  if (mazeRow(cell) > 0) out.push(cell - N);
  if (mazeRow(cell) < N - 1) out.push(cell + N);
  if (mazeCol(cell) > 0) out.push(cell - 1);
  if (mazeCol(cell) < N - 1) out.push(cell + 1);
  return out;
}

/**
 * Growing-tree carving: the next cell to grow from is a random one in the
 * active list 60% of the time and the newest one otherwise. Picking at random
 * spreads the tree sideways, which is what makes forks instead of one long
 * forced corridor.
 */
function carve(): number[] {
  const cells = new Array<number>(MAZE_CELLS).fill(0);
  const seen = new Set<number>([0]);
  const active = [0];

  while (active.length) {
    const pick = Math.random() < 0.6 ? Math.floor(Math.random() * active.length) : active.length - 1;
    const cell = active[pick]!;
    const next = shuffled(neighbours(cell)).find((option) => !seen.has(option));
    if (next === undefined) {
      active.splice(pick, 1);
      continue;
    }
    cells[cell] = (cells[cell] ?? 0) | mazeSideBetween(cell, next);
    cells[next] = (cells[next] ?? 0) | mazeSideBetween(next, cell);
    seen.add(next);
    active.push(next);
  }

  // Every side bit is one of the four we defined; nothing else is ever set.
  for (const mask of cells) {
    if (mask & ~(MAZE_N | MAZE_E | MAZE_S | MAZE_W)) throw new Error("Maze carved a bad wall mask");
  }
  return cells;
}

/** A fork: three or more corridors meet here. */
function isJunction(cells: number[], cell: number): boolean {
  return mazeCorridorNeighbours(cells, cell).length >= 3;
}

/** Forks on the solution route, or one cell off it — the choices the player faces. */
export function mazeJunctions(cells: number[], route: number[]): number {
  const onRoute = new Set(route);
  const near = new Set<number>();
  for (const cell of route) {
    near.add(cell);
    for (const next of mazeCorridorNeighbours(cells, cell)) near.add(next);
  }
  let count = 0;
  for (const cell of near) {
    if (isJunction(cells, cell) && (onRoute.has(cell) || true)) count += 1;
  }
  return count;
}

/**
 * False trails: branches that leave the solution route at a fork and run at
 * least the required number of cells before dying. Counted per branch.
 */
export function mazeFalseTrails(cells: number[], route: number[], minLength: number): number {
  const onRoute = new Set(route);
  let trails = 0;

  for (const cell of route) {
    // Only a fork offers a wrong turn; a plain corridor cell cannot.
    if (!isJunction(cells, cell)) continue;
    for (const first of mazeCorridorNeighbours(cells, cell)) {
      if (onRoute.has(first)) continue;
      // Walk the whole branch subtree and take its longest run.
      let longest = 0;
      const stack: { cell: number; depth: number }[] = [{ cell: first, depth: 1 }];
      const seen = new Set<number>([cell, first]);
      while (stack.length) {
        const node = stack.pop()!;
        if (node.depth > longest) longest = node.depth;
        for (const next of mazeCorridorNeighbours(cells, node.cell)) {
          if (seen.has(next) || onRoute.has(next)) continue;
          seen.add(next);
          stack.push({ cell: next, depth: node.depth + 1 });
        }
      }
      if (longest >= minLength) trails += 1;
    }
  }
  return trails;
}

export function generateMaze(): MazePuzzleData {
  const start = 0;
  const exit = MAZE_CELLS - 1;
  // Fifty attempts per seed, then a fresh seed — the shape of the search changes
  // completely with each carve, so retrying is always worth it.
  for (let round = 0; round < 400; round++) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const cells = carve();
      const route = mazeRoute(cells, start, exit);
      if (route.length < MAZE_MIN_PATH) continue;
      if (mazeTurns(route) < MAZE_MIN_TURNS) continue;
      if (mazeJunctions(cells, route) < MAZE_MIN_JUNCTIONS) continue;
      if (mazeFalseTrails(cells, route, MAZE_DEAD_END_LENGTH) < MAZE_MIN_DEAD_ENDS) continue;
      return { type: "maze", cells, start, exit, solution: route };
    }
  }
  throw new Error("Maze generator could not build a long enough route");
}
