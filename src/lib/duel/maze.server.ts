/**
 * Server-only Maze Dash generation: a perfect maze by randomised depth-first
 * search, kept only when its single route is long enough, twisty enough, and
 * hung with enough long false trails to punish a careless run.
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

/** Carves a perfect maze: every cell reachable, exactly one route between any two. */
function carve(): number[] {
  const cells = new Array<number>(MAZE_CELLS).fill(0);
  const seen = new Set<number>([0]);
  const stack = [0];

  while (stack.length) {
    const cell = stack[stack.length - 1]!;
    const options = shuffled(neighbours(cell)).filter((next) => !seen.has(next));
    const next = options[0];
    if (next === undefined) {
      stack.pop();
      continue;
    }
    cells[cell] = (cells[cell] ?? 0) | mazeSideBetween(cell, next);
    cells[next] = (cells[next] ?? 0) | mazeSideBetween(next, cell);
    seen.add(next);
    stack.push(next);
  }

  // Every side bit is one of the four we defined; nothing else is ever set.
  for (const mask of cells) {
    if (mask & ~(MAZE_N | MAZE_E | MAZE_S | MAZE_W)) throw new Error("Maze carved a bad wall mask");
  }
  return cells;
}

/**
 * False trails: branches that leave the solution route and run at least the
 * required number of cells before dying. Counted per branch, not per cell.
 */
export function mazeFalseTrails(cells: number[], route: number[], minLength: number): number {
  const onRoute = new Set(route);
  let trails = 0;

  for (const cell of route) {
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
  for (let round = 0; round < 200; round++) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const cells = carve();
      const route = mazeRoute(cells, start, exit);
      if (route.length < MAZE_MIN_PATH) continue;
      if (mazeTurns(route) < MAZE_MIN_TURNS) continue;
      if (mazeFalseTrails(cells, route, MAZE_DEAD_END_LENGTH) < MAZE_MIN_DEAD_ENDS) continue;
      return { type: "maze", cells, start, exit, solution: route };
    }
  }
  throw new Error("Maze generator could not build a long enough route");
}
