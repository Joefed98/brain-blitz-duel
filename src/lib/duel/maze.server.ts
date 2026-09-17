/**
 * Server-only Maze Dash generation: a perfect maze by randomised depth-first
 * search, kept only when its single route is long enough and twisty enough.
 */

import {
  MAZE_E,
  MAZE_N,
  MAZE_S,
  MAZE_W,
  mazeCol,
  mazeRoute,
  mazeRow,
  mazeSideBetween,
  mazeTurns,
} from "./maze";
import { shuffled } from "./random";
import { MAZE_CELLS, MAZE_COLS as N, MAZE_MIN_PATH, MAZE_MIN_TURNS, type MazePuzzleData } from "./types";

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

export function generateMaze(): MazePuzzleData {
  const start = 0;
  const exit = MAZE_CELLS - 1;
  for (let attempt = 0; attempt < 2_000; attempt++) {
    const cells = carve();
    const route = mazeRoute(cells, start, exit);
    if (route.length < MAZE_MIN_PATH) continue;
    if (mazeTurns(route) < MAZE_MIN_TURNS) continue;
    return { type: "maze", cells, start, exit, solution: route };
  }
  throw new Error("Maze generator could not build a long enough route");
}
