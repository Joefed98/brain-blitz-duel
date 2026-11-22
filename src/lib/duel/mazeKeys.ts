/**
 * Labyrinth's gold keys (D3, 22 Nov 2026; levelRev 2's Hard and Expert, attentionLevels.data.ts MazeLevel `keys`): keys
 * at the tips of dead ends, every one fetched (in any order) before the exit opens. Shared by the stage and the server,
 * pure. A puzzle without `keys` (every Normal and Easy maze, and every maze dealt before D3) plays exactly as before.
 *
 * The maze is perfect (one route between any two cells), so the shortest walk from the start through every key to the
 * exit is exact: twice the corridors of the smallest tree joining them all, less the start-to-exit route (that one is
 * walked once). That walk is the par.
 */
import { mazeCorridorNeighbours, mazeOpen } from "./maze";
import type { MazePuzzleData } from "./types";

/** The stored keys' cells (none for a maze without keys). */
export function mazeKeysOf(puzzle: Pick<MazePuzzleData, "type"> | null | undefined): number[] {
  const keys = (puzzle as { keys?: unknown } | null)?.keys;
  return Array.isArray(keys) ? keys.filter((k): k is number => typeof k === "number" && Number.isInteger(k)) : [];
}

/**
 * A keyed maze's walk: the trail's legal steps (a step through a wall ends it), backtracks included, ending at the exit
 * only once every key has been walked over (before that the exit is a cell like any other).
 */
export function mazeKeysWalk(cells: number[], start: number, exit: number, trail: readonly number[], cols: number, keys: readonly number[]): number[] {
  const walk: number[] = [];
  if (trail[0] !== start) return walk;
  walk.push(start);
  const left = new Set(keys);
  left.delete(start);
  for (let i = 1; i < trail.length; i++) {
    const cell = trail[i]!;
    const previous = walk[walk.length - 1]!;
    if (cell === previous) continue;
    if (!mazeOpen(cells, previous, cell, cols)) break;
    walk.push(cell);
    left.delete(cell);
    if (cell === exit && left.size === 0) break;
  }
  return walk;
}

/** The keys (indices into `keys`) the walk has taken. */
export function mazeKeysTaken(walk: readonly number[], keys: readonly number[]): number[] {
  const seen = new Set(walk);
  return keys.map((k, i) => (seen.has(k) ? i : -1)).filter((i) => i >= 0);
}

/** Breadth-first parents from `from` over the maze's corridors (a tree: one parent a cell). */
function parentsFrom(cells: number[], from: number, cols: number): Int32Array {
  const parent = new Int32Array(cells.length).fill(-2);
  parent[from] = -1;
  const queue = [from];
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!;
    for (const n of mazeCorridorNeighbours(cells, c, cols)) if (parent[n] === -2) (parent[n] = c, queue.push(n));
  }
  return parent;
}

/**
 * The shortest walk (steps) from `from` through every cell of `visit` (any order) to `to`: twice the corridors of the
 * tree joining them, less the `from`–`to` route walked once.
 */
export function mazeTourSteps(cells: number[], cols: number, from: number, visit: readonly number[], to: number): number {
  const parent = parentsFrom(cells, from, cols);
  const inTree = new Uint8Array(cells.length);
  inTree[from] = 1;
  let edges = 0;
  for (const target of [...visit, to]) {
    let c = target;
    while (c >= 0 && !inTree[c]) {
      inTree[c] = 1;
      edges++;
      c = parent[c]!;
    }
  }
  let route = 0;
  for (let c = to; c !== from && c >= 0; c = parent[c]!) route++;
  return 2 * edges - route;
}

/** The cells of the route between two cells (both included). */
export function mazePathBetween(cells: number[], cols: number, from: number, to: number): number[] {
  const parent = parentsFrom(cells, from, cols);
  const out: number[] = [];
  for (let c = to; c >= 0; c = parent[c]!) {
    out.push(c);
    if (c === from) break;
  }
  return out.reverse();
}

/**
 * The order to fetch the keys in (from `from`, ending at `to`) that walks the fewest steps: tried over every order
 * (at most four keys: 24 orders), ties to the first. With the tree's exact distances.
 */
export function mazeBestKeyOrder(cells: number[], cols: number, from: number, keys: readonly number[], to: number): number[] {
  const dist = (a: number, b: number) => mazePathBetween(cells, cols, a, b).length - 1;
  let best: number[] = [...keys];
  let bestLen = Number.POSITIVE_INFINITY;
  const permute = (rest: number[], done: number[]) => {
    if (!rest.length) {
      let at = from;
      let len = 0;
      for (const k of done) (len += dist(at, k), (at = k));
      len += dist(at, to);
      if (len < bestLen) (bestLen = len, (best = [...done]));
      return;
    }
    rest.forEach((k, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...done, k]));
  };
  permute([...keys], []);
  return best;
}
