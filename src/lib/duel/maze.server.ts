/**
 * Server-only Maze Dash generation: a perfect maze grown by the growing-tree
 * method, biased towards branching so the run is full of forks, and kept only
 * when its single route is long enough, twisty enough, forked enough and hung
 * with enough long false trails to punish a careless run — and only when the
 * exit cannot be spotted down a straight corridor near the end.
 */

import {
  MAZE_E,
  MAZE_N,
  MAZE_S,
  MAZE_W,
  mazeCol,
  mazeCorridorNeighbours,
  mazeOpen,
  mazeRoute,
  mazeRow,
  mazeSideBetween,
  mazeTurns,
} from "./maze";
import { shuffled } from "./random";
import {
  LAB_COLS,
  LAB_ROUTE_MAX,
  LAB_ROWS,
  LAB_STARS,
  LAB_STAR_DEPTH_MAX,
  LAB_STAR_DEPTH_MIN,
  MAZE_REV_DEPTH,
} from "./depth/labyrinth";
import {
  MAZE_BLIND_TAIL,
  MAZE_CELLS,
  MAZE_COLS as N,
  MAZE_DEAD_END_LENGTH,
  MAZE_LONG_DEAD_END_LENGTH,
  MAZE_MIN_DEAD_ENDS,
  MAZE_MIN_JUNCTIONS,
  MAZE_MIN_LONG_DEAD_ENDS,
  MAZE_MIN_PATH,
  MAZE_MIN_TURNS,
  type MazePuzzleData,
} from "./types";

function neighbours(cell: number, cols = N, rows = N): number[] {
  const out: number[] = [];
  if (mazeRow(cell, cols) > 0) out.push(cell - cols);
  if (mazeRow(cell, cols) < rows - 1) out.push(cell + cols);
  if (mazeCol(cell, cols) > 0) out.push(cell - 1);
  if (mazeCol(cell, cols) < cols - 1) out.push(cell + 1);
  return out;
}

/**
 * Growing-tree carving: the next cell to grow from is usually the newest one,
 * and a random one in the active list some of the time. The random picks spread
 * the tree sideways, which is what makes forks and dead ends instead of one
 * long forced corridor.
 */
export function carve(cols = N, rows = N, randomPick = 0.15): number[] {
  const cells = new Array<number>(cols * rows).fill(0);
  const seen = new Set<number>([0]);
  const active = [0];

  while (active.length) {
    // A mostly-newest choice keeps the solution long; the random pick sprays
    // side branches off it, which is where the forks and dead ends come from.
    const pick =
      Math.random() < randomPick ? Math.floor(Math.random() * active.length) : active.length - 1;
    const cell = active[pick]!;
    const next = shuffled(neighbours(cell, cols, rows)).find((option) => !seen.has(option));
    if (next === undefined) {
      active.splice(pick, 1);
      continue;
    }
    cells[cell] = (cells[cell] ?? 0) | mazeSideBetween(cell, next, cols, rows);
    cells[next] = (cells[next] ?? 0) | mazeSideBetween(next, cell, cols, rows);
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
function isJunction(cells: number[], cell: number, cols = N): boolean {
  return mazeCorridorNeighbours(cells, cell, cols).length >= 3;
}

/** Forks on the solution route, or one cell off it — the choices the player faces. */
export function mazeJunctions(cells: number[], route: number[], cols = N): number {
  const near = new Set<number>();
  for (const cell of route) {
    near.add(cell);
    for (const next of mazeCorridorNeighbours(cells, cell, cols)) near.add(next);
  }
  let count = 0;
  for (const cell of near) {
    if (isJunction(cells, cell, cols)) count += 1;
  }
  return count;
}

/**
 * False trails: branches that leave the solution route at a fork. Returns the
 * longest run of each branch, so both the count and the really long ones can be
 * checked.
 */
export function mazeFalseTrailLengths(cells: number[], route: number[], cols = N): number[] {
  const onRoute = new Set(route);
  const lengths: number[] = [];

  for (const cell of route) {
    // Only a fork offers a wrong turn; a plain corridor cell cannot.
    if (!isJunction(cells, cell, cols)) continue;
    for (const first of mazeCorridorNeighbours(cells, cell, cols)) {
      if (onRoute.has(first)) continue;
      // Walk the whole branch subtree and take its longest run.
      let longest = 0;
      const stack: { cell: number; depth: number }[] = [{ cell: first, depth: 1 }];
      const seen = new Set<number>([cell, first]);
      while (stack.length) {
        const node = stack.pop()!;
        if (node.depth > longest) longest = node.depth;
        for (const next of mazeCorridorNeighbours(cells, node.cell, cols)) {
          if (seen.has(next) || onRoute.has(next)) continue;
          seen.add(next);
          stack.push({ cell: next, depth: node.depth + 1 });
        }
      }
      lengths.push(longest);
    }
  }
  return lengths;
}

/**
 * True when the exit can be seen straight down a corridor from the closing
 * stretch of the route. The last two cells are left out — the final step into
 * the exit is always in view, and that is the point of it.
 */
export function mazeExitInSight(cells: number[], route: number[], exit: number, cols = N): boolean {
  const tail = route.slice(Math.max(0, route.length - MAZE_BLIND_TAIL), route.length - 2);
  const size = cols === N ? MAZE_CELLS : cells.length;
  for (const from of tail) {
    for (const first of [-cols, cols, -1, 1]) {
      let cell = from;
      while (true) {
        const next = cell + first;
        if (next < 0 || next >= size) break;
        if (!mazeOpen(cells, cell, next, cols)) break;
        cell = next;
        if (cell === exit) return true;
      }
    }
  }
  return false;
}

/**
 * mazeRev 1 detour stars: for each third of the route, a cell LAB_STAR_DEPTH_MIN–MAX steps into a side branch that
 * leaves the route in that third (one star per branch). Null when a third has no branch that deep.
 */
export function placeMazeStars(cells: number[], route: number[], cols: number): number[] | null {
  const onRoute = new Map<number, number>();
  route.forEach((cell, i) => onRoute.set(cell, i));
  const thirds: number[][][] = [[], [], []];
  for (let i = 1; i < route.length - 1; i++) {
    const root = route[i]!;
    for (const first of mazeCorridorNeighbours(cells, root, cols)) {
      if (onRoute.has(first)) continue;
      // Breadth-first through the branch: cells at each depth from the route.
      const options: number[] = [];
      const seen = new Set<number>([root, first]);
      let ring = [first];
      for (let depth = 1; depth <= LAB_STAR_DEPTH_MAX && ring.length; depth++) {
        if (depth >= LAB_STAR_DEPTH_MIN) options.push(...ring);
        const next: number[] = [];
        for (const cell of ring)
          for (const n of mazeCorridorNeighbours(cells, cell, cols)) {
            if (seen.has(n) || onRoute.has(n)) continue;
            seen.add(n);
            next.push(n);
          }
        ring = next;
      }
      if (options.length) thirds[Math.min(2, Math.floor((3 * i) / route.length))]!.push(options);
    }
  }
  const stars: number[] = [];
  for (const branches of thirds) {
    if (!branches.length) return null;
    const branch = branches[Math.floor(Math.random() * branches.length)]!;
    stars.push(branch[Math.floor(Math.random() * branch.length)]!);
  }
  return stars.length === LAB_STARS ? stars : null;
}

/**
 * mazeRev 1 (depth to 200): the same carving and the same tests on a 19 × 23 board, the route no longer than
 * LAB_ROUTE_MAX (so the run takes the time it did and the extra corridors are side branches), and three detour stars.
 */
export function generateMazeDepth(): MazePuzzleData {
  const cols = LAB_COLS;
  const rows = LAB_ROWS;
  const start = 0;
  const exit = cols * rows - 1;
  for (let attempt = 0; attempt < 40_000; attempt++) {
    const cells = carve(cols, rows);
    const route = mazeRoute(cells, start, exit, cols);
    if (route.length < MAZE_MIN_PATH || route.length > LAB_ROUTE_MAX) continue;
    if (mazeTurns(route) < MAZE_MIN_TURNS) continue;
    if (mazeJunctions(cells, route, cols) < MAZE_MIN_JUNCTIONS) continue;
    const trails = mazeFalseTrailLengths(cells, route, cols);
    if (trails.filter((length) => length >= MAZE_DEAD_END_LENGTH).length < MAZE_MIN_DEAD_ENDS) continue;
    if (trails.filter((length) => length >= MAZE_LONG_DEAD_END_LENGTH).length < MAZE_MIN_LONG_DEAD_ENDS) continue;
    if (mazeExitInSight(cells, route, exit, cols)) continue;
    const stars = placeMazeStars(cells, route, cols);
    if (!stars) continue;
    return { type: "maze", cells, start, exit, solution: route, mazeRev: MAZE_REV_DEPTH, cols, rows, stars };
  }
  throw new Error("Maze generator could not build a long enough route");
}

/** The maze rooms, practice and the daily deal today: mazeRev 1 (generateMazeClassic is the 19 × 19 builder before it). */
export function generateMaze(): MazePuzzleData {
  return generateMazeDepth();
}

/** The 19 × 19 maze dealt before mazeRev 1 (kept for laser-tower-maze-check and depth-labyrinth-check). */
export function generateMazeClassic(): MazePuzzleData {
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

      const trails = mazeFalseTrailLengths(cells, route);
      if (trails.filter((length) => length >= MAZE_DEAD_END_LENGTH).length < MAZE_MIN_DEAD_ENDS)
        continue;
      if (
        trails.filter((length) => length >= MAZE_LONG_DEAD_END_LENGTH).length <
        MAZE_MIN_LONG_DEAD_ENDS
      )
        continue;
      if (mazeExitInSight(cells, route, exit)) continue;

      return { type: "maze", cells, start, exit, solution: route };
    }
  }
  throw new Error("Maze generator could not build a long enough route");
}
