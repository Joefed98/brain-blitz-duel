/**
 * Server-only Colour Connect generation. The grid is partitioned into eight non-branching
 * paths by cutting a random Hamiltonian path into segments, so every layout is
 * solvable by construction and the solution is exactly those segments.
 */

import { flowCol, flowNeighbours, flowRow, verifyFlow } from "./flow";
import { shuffled } from "./random";
import {
  FLOW_CELLS,
  FLOW_COLS,
  FLOW_MIN_PATH,
  FLOW_PAIRS,
  type FlowPair,
  type FlowPuzzleData,
  type StroopColour,
} from "./types";

/** Colour Connect alone shares Colour Clash's eight-colour palette. */
const COLOURS: StroopColour[] = [
  "RED",
  "BLUE",
  "GREEN",
  "PURPLE",
  "PINK",
  "ORANGE",
  "BROWN",
  "YELLOW",
];

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

/** Random segment lengths that sum to the whole grid, each at least the minimum. */
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

/** How many times a path changes direction. */
export function flowBends(path: number[]): number {
  let bends = 0;
  for (let index = 2; index < path.length; index++) {
    const first = path[index - 1]! - path[index - 2]!;
    const second = path[index]! - path[index - 1]!;
    if (first !== second) bends += 1;
  }
  return bends;
}

/** A path is straight when every cell shares a row or every cell shares a column. */
function straight(path: number[]): boolean {
  const rows = new Set(path.map(flowRow));
  const cols = new Set(path.map(flowCol));
  return rows.size === 1 || cols.size === 1;
}

/** The cells of an L route between two dots, turning at the given corner. */
function elbow(a: number, b: number, corner: "row" | "col"): number[] {
  const [ra, ca, rb, cb] = [flowRow(a), flowCol(a), flowRow(b), flowCol(b)];
  const cells: number[] = [];
  const step = (from: number, to: number) => (from <= to ? 1 : -1);
  if (corner === "row") {
    for (let c = ca; ; c += step(ca, cb)) {
      cells.push(ra * FLOW_COLS + c);
      if (c === cb) break;
    }
    for (let r = ra + step(ra, rb); ; r += step(ra, rb)) {
      cells.push(r * FLOW_COLS + cb);
      if (r === rb) break;
      if (ra === rb) break;
    }
  } else {
    for (let r = ra; ; r += step(ra, rb)) {
      cells.push(r * FLOW_COLS + ca);
      if (r === rb) break;
    }
    for (let c = ca + step(ca, cb); ; c += step(ca, cb)) {
      cells.push(rb * FLOW_COLS + c);
      if (c === cb) break;
      if (ca === cb) break;
    }
  }
  return cells;
}

/**
 * True when the pair could be joined by a straight line or a single bend that
 * misses every other dot — an obvious route we never want to ship.
 */
function joinableTooEasily(a: number, b: number, dots: Set<number>): boolean {
  if (flowRow(a) === flowRow(b) || flowCol(a) === flowCol(b)) return true;
  // Both single-bend routes must be blocked by another dot, or the pair reads as obvious.
  return (["row", "col"] as const).every((corner) =>
    elbow(a, b, corner).every((cell) => cell === a || cell === b || !dots.has(cell)),
  );
}

function acceptable(paths: number[][]): boolean {
  const dots = new Set(paths.flatMap((path) => [path[0]!, path[path.length - 1]!]));
  for (const path of paths) {
    if (path.length < FLOW_MIN_PATH) return false;
    if (straight(path)) return false;
    // A straight run or a single L is too easy to see: every pair needs two bends.
    if (flowBends(path) < 2) return false;
    const a = path[0]!;
    const b = path[path.length - 1]!;
    // Dots side by side make the pair trivial.
    if (flowNeighbours(a).includes(b)) return false;
    // No pair may be joinable by a straight or single-bend route either.
    if (joinableTooEasily(a, b, dots)) return false;
  }
  return true;
}

export function generateFlow(): FlowPuzzleData {
  for (let attempt = 0; attempt < 400; attempt++) {
    const hamiltonian = hamiltonianPath();
    if (!hamiltonian) continue;

    for (let cut = 0; cut < 3000; cut++) {
      const lengths = segmentLengths();
      const paths: number[][] = [];
      let at = 0;
      for (const length of lengths) {
        paths.push(hamiltonian.slice(at, at + length));
        at += length;
      }
      if (!acceptable(paths)) continue;

      const colours = shuffled(COLOURS).slice(0, FLOW_PAIRS);
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
  throw new Error("Colour Connect generator could not build a proven-solvable board");
}

/** Server-side check of a Colour Connect submission against the rules themselves. */
export function gradeFlowPaths(
  pairs: FlowPair[],
  paths: number[][],
): { solved: boolean; pairsJoined: number; filled: number } {
  const verdict = verifyFlow(pairs, paths);
  return { solved: verdict.solved, pairsJoined: verdict.pairsJoined, filled: verdict.filled };
}
