/**
 * Server-only Flow generation. The grid is partitioned into five non-branching
 * paths by cutting a random Hamiltonian path into segments, so every layout is
 * solvable by construction and the solution is exactly those segments.
 */

import { flowCol, flowNeighbours, flowRow, verifyFlow } from "./flow";
import { shuffled } from "./random";
import {
  FLOW_CELLS,
  FLOW_MIN_PATH,
  FLOW_PAIRS,
  type FlowPair,
  type FlowPuzzleData,
  type StroopColour,
} from "./types";

const COLOURS: StroopColour[] = ["RED", "BLUE", "GREEN", "PURPLE", "PINK"];

/** A random Hamiltonian path over the grid, found by randomised backtracking. */
function hamiltonianPath(): number[] | null {
  const start = Math.floor(Math.random() * FLOW_CELLS);
  const path: number[] = [start];
  const visited = new Array<boolean>(FLOW_CELLS).fill(false);
  visited[start] = true;
  let steps = 0;

  const search = (): boolean => {
    if (path.length === FLOW_CELLS) return true;
    if (steps++ > 400_000) return false;
    const cell = path[path.length - 1]!;
    // Warnsdorff-ish: try the most constrained neighbour first.
    const options = shuffled(flowNeighbours(cell).filter((next) => !visited[next])).sort(
      (a, b) =>
        flowNeighbours(a).filter((n) => !visited[n]).length -
        flowNeighbours(b).filter((n) => !visited[n]).length,
    );
    for (const next of options) {
      visited[next] = true;
      path.push(next);
      if (search()) return true;
      path.pop();
      visited[next] = false;
    }
    return false;
  };

  return search() ? path : null;
}

/** Random segment lengths that sum to 36, each at least the minimum. */
function segmentLengths(): number[] {
  const lengths = new Array<number>(FLOW_PAIRS).fill(FLOW_MIN_PATH);
  let spare = FLOW_CELLS - FLOW_MIN_PATH * FLOW_PAIRS;
  while (spare > 0) {
    const index = Math.floor(Math.random() * FLOW_PAIRS);
    const take = Math.min(spare, 1 + Math.floor(Math.random() * 3));
    lengths[index]! += take;
    spare -= take;
  }
  return lengths;
}

/** A path is straight when every cell shares a row or every cell shares a column. */
function straight(path: number[]): boolean {
  const rows = new Set(path.map(flowRow));
  const cols = new Set(path.map(flowCol));
  return rows.size === 1 || cols.size === 1;
}

function acceptable(paths: number[][]): boolean {
  for (const path of paths) {
    if (path.length < FLOW_MIN_PATH) return false;
    if (straight(path)) return false;
    const a = path[0]!;
    const b = path[path.length - 1]!;
    // Dots side by side make the pair trivial.
    if (flowNeighbours(a).includes(b)) return false;
  }
  return true;
}

export function generateFlow(): FlowPuzzleData {
  for (let attempt = 0; attempt < 400; attempt++) {
    const hamiltonian = hamiltonianPath();
    if (!hamiltonian) continue;

    for (let cut = 0; cut < 30; cut++) {
      const lengths = segmentLengths();
      const paths: number[][] = [];
      let at = 0;
      for (const length of lengths) {
        paths.push(hamiltonian.slice(at, at + length));
        at += length;
      }
      if (!acceptable(paths)) continue;

      const colours = shuffled(COLOURS);
      const pairs: FlowPair[] = paths.map((path, index) => ({
        colour: colours[index]!,
        a: path[0]!,
        b: path[path.length - 1]!,
      }));

      // Never ship a layout the stored paths do not actually solve.
      if (!verifyFlow(pairs, paths).solved) continue;

      return { type: "flow", pairs, solution: paths };
    }
  }
  throw new Error("Flow generator could not build a proven-solvable board");
}

/** Server-side check of a Flow submission against the rules themselves. */
export function gradeFlowPaths(
  pairs: FlowPair[],
  paths: number[][],
): { solved: boolean; pairsJoined: number; filled: number } {
  const verdict = verifyFlow(pairs, paths);
  return { solved: verdict.solved, pairsJoined: verdict.pairsJoined, filled: verdict.filled };
}
