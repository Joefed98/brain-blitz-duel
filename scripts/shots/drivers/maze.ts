import type { Driver } from "../driver";
import { arrow } from "../driver";
import { mazeCorridorNeighbours } from "../../../src/lib/duel/maze";

/*
 * Labyrinth mazeRev 1 (depth to 200): the trail is seeded through the stage state ("mazeTrail"), taking the
 * detour stars on the way; the solve presses the last arrow into the exit.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Maze = Record<string, any>;

/** The branch from the route out to a star (route cell first, star last). */
function branchTo(m: Maze, star: number): number[] {
  const cols: number = m.cols ?? 19;
  const onRoute = new Set<number>(m.solution);
  const from = new Map<number, number>([[star, -1]]);
  const queue = [star];
  while (queue.length) {
    const cell = queue.shift()!;
    if (onRoute.has(cell)) {
      const out: number[] = [];
      for (let c = cell; c !== -1; c = from.get(c)!) out.push(c);
      return out;
    }
    for (const n of mazeCorridorNeighbours(m.cells, cell, cols)) if (!from.has(n)) (from.set(n, cell), queue.push(n));
  }
  return [];
}

/** The trail along the route to step `upTo`, taking the stars listed in `take` on the way. */
function trail(m: Maze, upTo: number, take: number[]): number[] {
  const route: number[] = m.solution;
  const branches = take.map((i) => branchTo(m, m.stars[i]));
  const out = [route[0]!];
  for (let i = 1; i <= upTo; i++) {
    for (const b of branches) if (b[0] === route[i - 1]) out.push(...b.slice(1), ...b.slice(0, -1).reverse());
    out.push(route[i]!);
  }
  for (const b of branches) if (b[0] === route[upTo]) out.push(...b.slice(1), ...b.slice(0, -1).reverse());
  return out;
}

export const driver: Driver = {
  board: "[data-maze-board]",
  seedMid: (m) => ({ mazeTrail: trail(m, Math.floor(m.solution.length * 0.55), [0, 1]) }),
  seedNearSolved: (m) => ({ mazeTrail: trail(m, m.solution.length - 2, [0, 1, 2]) }),
  solve: async ({ page, puzzle }) => {
    const cols: number = puzzle.cols ?? 19;
    const [a, b] = puzzle.solution.slice(-2) as number[];
    const d = b! - a!;
    await arrow(page, d === -cols ? "U" : d === cols ? "D" : d === -1 ? "L" : "R");
  },
  solveShotsMs: [300, 900],
};
