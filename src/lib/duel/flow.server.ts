import { gameDisplayName } from "./gameNames";
/**
 * Server-only Colour Connect generation. Two to four wall cells are placed,
 * a random Hamiltonian path over the remaining cells is cut into 10–12
 * segments (solvable by construction), and an exhaustive solver then proves
 * the dot layout has exactly one solution before it is used.
 */

import { FLOW_GRID_NORMAL, flowCol, flowNeighbours, flowRow, verifyFlow, type FlowGrid } from "./flow";
import { random, randomBelow, shuffled } from "./random";
import {
  FLOW_MAX_PAIRS,
  FLOW_MAX_WALLS,
  FLOW_MIN_PAIRS,
  FLOW_MIN_PATH,
  FLOW_MIN_WALLS,
  type FlowColour,
  type FlowPair,
  type FlowPuzzleData,
} from "./types";

const COLOURS: FlowColour[] = [
  "RED", "BLUE", "GREEN", "PURPLE", "PINK", "ORANGE",
  "BROWN", "YELLOW", "TEAL", "WHITE", "LIME", "SILVER",
];
/** Expert's palette (levels, 15 Nov 2026): the twelve and two more, for up to fourteen pairs. */
const COLOURS_14: FlowColour[] = [...COLOURS, "CYAN", "TAN"];

/**
 * One level's board rules (levels, 15 Nov 2026; the data lives in src/lib/levels/pattern/flow.levels.ts). Normal is
 * FLOW_NORMAL_RULES, exactly the generator before levels.
 */
export interface FlowRules {
  cols: number;
  rows: number;
  minPairs: number;
  maxPairs: number;
  minWalls: number;
  maxWalls: number;
  /** The longest a solution path may be (squares). */
  maxPath: number;
  /** The shortest a solution path may be (squares). */
  minPath: number;
  /** The board's average path length must reach this (Hard's longer paths; 0 = no floor). */
  minAvgPath: number;
  /** The uniqueness solver's node budget (a board it can't settle within it is never used). */
  budget: number;
  /**
   * How lines are joined: Normal merges towards one drawn pair count and gives up after 4,000 stuck tries; a level
   * merges towards its fewest pairs, stops after `stuckLimit` stuck tries and takes any count in its range.
   */
  stuckLimit: number;
  anyCount: boolean;
}

export const FLOW_NORMAL_RULES: FlowRules = {
  cols: 9,
  rows: 9,
  minPairs: FLOW_MIN_PAIRS,
  maxPairs: FLOW_MAX_PAIRS,
  minWalls: FLOW_MIN_WALLS,
  maxWalls: FLOW_MAX_WALLS,
  maxPath: 16,
  minPath: FLOW_MIN_PATH,
  minAvgPath: 0,
  budget: 60_000,
  stuckLimit: 4000,
  anyCount: false,
};

const neighbourCache = new Map<string, number[][]>();
function neighboursOf(grid: FlowGrid): number[][] {
  const key = `${grid.cols}x${grid.rows}`;
  let table = neighbourCache.get(key);
  if (!table) {
    table = Array.from({ length: grid.cols * grid.rows }, (_, c) => flowNeighbours(c, { cols: grid.cols, rows: grid.rows }));
    neighbourCache.set(key, table);
  }
  return table;
}

/** Every draw goes through ./random, so `withSeededRandom` reproduces a board exactly. */
function randomInt(n: number): number {
  return randomBelow(n);
}

/** Wall cells, never touching each other and never on a corner. */
function pickWalls(rules: FlowRules = FLOW_NORMAL_RULES): number[] {
  const nb = neighboursOf(rules);
  const cols = rules.cols;
  const count = rules.minWalls + randomInt(rules.maxWalls - rules.minWalls + 1);
  const walls: number[] = [];
  for (const cell of shuffled(Array.from({ length: rules.cols * rules.rows }, (_, i) => i))) {
    if (walls.length >= count) break;
    if (nb[cell]!.length < 3) continue;
    if (walls.some((w) => nb[w]!.includes(cell) || Math.abs(flowRow(w, cols) - flowRow(cell, cols)) + Math.abs(flowCol(w, cols) - flowCol(cell, cols)) < 3)) continue;
    walls.push(cell);
  }
  return walls;
}

export function flowBends(path: number[]): number {
  let bends = 0;
  for (let index = 2; index < path.length; index++) {
    if (path[index - 1]! - path[index - 2]! !== path[index]! - path[index - 1]!) bends += 1;
  }
  return bends;
}

/**
 * Counts solutions (stopping at `limit`) by extending one path head at a
 * time, always the most constrained one, with dead-cell and connectivity
 * pruning. Returns -1 when the node budget runs out (treated as "not proven").
 */
export function countFlowSolutions(
  pairs: FlowPair[],
  walls: readonly number[],
  limit = 2,
  budget = 60_000,
  grid: FlowGrid = FLOW_GRID_NORMAL,
): number {
  const NEIGHBOURS = neighboursOf(grid);
  const FLOW_CELLS = grid.cols * grid.rows;
  const P = pairs.length;
  // owner: -2 wall, -1 empty, else pair index.
  const owner = new Int8Array(FLOW_CELLS).fill(-1);
  for (const w of walls) owner[w] = -2;
  const head = new Int16Array(P);
  const target = new Int16Array(P);
  const done = new Uint8Array(P);
  pairs.forEach((p, i) => {
    owner[p.a] = i;
    owner[p.b] = i;
    head[i] = p.a;
    target[i] = p.b;
  });
  let found = 0;
  let nodes = 0;
  let empty = FLOW_CELLS - walls.length - 2 * P;

  const seen = new Int32Array(FLOW_CELLS);
  let stamp = 0;
  const queue = new Int16Array(FLOW_CELLS);

  const feasible = (): boolean => {
    // Every empty cell needs two usable neighbours (empty, or an open end).
    for (let c = 0; c < FLOW_CELLS; c++) {
      if (owner[c] !== -1) continue;
      let ok = 0;
      for (const n of NEIGHBOURS[c]!) {
        const o = owner[n]!;
        if (o === -1) ok++;
        else if (o >= 0 && !done[o] && (head[o] === n || target[o] === n)) ok++;
      }
      if (ok < 2) return false;
    }
    // Each open pair's head must reach its target through empty cells.
    for (let i = 0; i < P; i++) {
      if (done[i]) continue;
      stamp++;
      let qh = 0;
      let qt = 0;
      queue[qt++] = head[i]!;
      seen[head[i]!] = stamp;
      let reached = false;
      while (qh < qt && !reached) {
        const c = queue[qh++]!;
        for (const n of NEIGHBOURS[c]!) {
          if (n === target[i]) { reached = true; break; }
          if (owner[n] === -1 && seen[n] !== stamp) { seen[n] = stamp; queue[qt++] = n; }
        }
      }
      if (!reached) return false;
    }
    // Each empty region must be touched by both ends of some open pair.
    stamp++;
    const regionStamp = stamp;
    for (let c = 0; c < FLOW_CELLS; c++) {
      if (owner[c] !== -1 || seen[c] === regionStamp) continue;
      let qh = 0;
      let qt = 0;
      queue[qt++] = c;
      seen[c] = regionStamp;
      const touchH = new Set<number>();
      const touchT = new Set<number>();
      while (qh < qt) {
        const x = queue[qh++]!;
        for (const n of NEIGHBOURS[x]!) {
          const o = owner[n]!;
          if (o === -1) {
            if (seen[n] !== regionStamp) { seen[n] = regionStamp; queue[qt++] = n; }
          } else if (o >= 0 && !done[o]) {
            if (head[o] === n) touchH.add(o);
            if (target[o] === n) touchT.add(o);
          }
        }
      }
      let any = false;
      for (const o of touchH) if (touchT.has(o)) { any = true; break; }
      if (!any) return false;
    }
    return true;
  };

  const search = (): void => {
    if (found >= limit || found < 0) return;
    if (++nodes > budget) { found = -1; return; }
    // Pick the open pair with the fewest moves.
    let best = -1;
    let bestMoves: number[] = [];
    let open = 0;
    for (let i = 0; i < P; i++) {
      if (done[i]) continue;
      open++;
      const moves: number[] = [];
      for (const n of NEIGHBOURS[head[i]!]!) {
        if (owner[n] === -1 || n === target[i]) moves.push(n);
      }
      if (moves.length === 0) return;
      if (best === -1 || moves.length < bestMoves.length) { best = i; bestMoves = moves; }
      if (moves.length === 1) break;
    }
    if (open === 0) {
      if (empty === 0) found++;
      return;
    }
    const i = best;
    const prev = head[i]!;
    for (const n of bestMoves) {
      if (n === target[i]) {
        done[i] = 1;
        if (feasible() || (empty === 0 && done.every(Boolean))) search();
        done[i] = 0;
      } else {
        owner[n] = i;
        head[i] = n;
        empty--;
        if (feasible()) search();
        empty++;
        head[i] = prev;
        owner[n] = -1;
      }
      if (found >= limit || found < 0) return;
    }
  };

  if (feasible()) search();
  return found;
}

/** True when a path runs beside itself — such boards almost always have a reroute. */
function selfTouching(path: number[], NEIGHBOURS: number[][] = neighboursOf(FLOW_GRID_NORMAL)): boolean {
  const index = new Map(path.map((c, i) => [c, i]));
  for (let i = 0; i < path.length; i++) {
    for (const n of NEIGHBOURS[path[i]!]!) {
      const j = index.get(n);
      if (j !== undefined && Math.abs(j - i) > 1) return true;
    }
  }
  return false;
}

export interface FlowGenStats {
  attempts: number;
  /** Tools only: attempts that got as far as a laid-out board (level tuning). */
  laidOut?: number;
}

/**
 * Partitions the free cells into non-self-touching paths by repeatedly
 * joining two neighbouring path ends, until the target pair count is reached.
 */
/** A random line among the shortest (up to the third shortest length). */
function shortestPick(paths: number[][]): number {
  const lengths = [...new Set(paths.map((p) => p.length))].sort((x, y) => x - y);
  const cap = lengths[Math.min(2, lengths.length - 1)]!;
  const pool: number[] = [];
  paths.forEach((p, k) => {
    if (p.length <= cap) pool.push(k);
  });
  return pool[randomInt(pool.length)]!;
}

function mergedPaths(blocked: Set<number>, pairCount: number, rules: FlowRules = FLOW_NORMAL_RULES): number[][] | null {
  const NEIGHBOURS = neighboursOf(rules);
  const FLOW_CELLS = rules.cols * rules.rows;
  let paths: number[][] = [];
  for (let c = 0; c < FLOW_CELLS; c++) if (!blocked.has(c)) paths.push([c]);
  const pathOf = new Int16Array(FLOW_CELLS).fill(-1);
  const reindex = () => paths.forEach((path, i) => path.forEach((c) => (pathOf[c] = i)));
  reindex();
  let stuck = 0;
  const floor = rules.anyCount ? rules.minPairs : pairCount;
  while (paths.length > floor && stuck < rules.stuckLimit) {
    // A level grows its shortest lines first (a random one of the shortest few), so the board reaches its few long
    // lines without stranding single squares; Normal picks any line, as before.
    const i = rules.anyCount ? shortestPick(paths) : randomInt(paths.length);
    const path = paths[i]!;
    const fromEnd = random() < 0.5 ? path[0]! : path[path.length - 1]!;
    const options = shuffled(NEIGHBOURS[fromEnd]!).filter((n) => {
      const j = pathOf[n]!;
      if (j < 0 || j === i) return false;
      const other = paths[j]!;
      return other[0] === n || other[other.length - 1] === n;
    });
    let merged = false;
    for (const n of options) {
      const j = pathOf[n]!;
      const other = paths[j]!;
      const left = fromEnd === path[path.length - 1] ? path : [...path].reverse();
      const right = other[0] === n ? other : [...other].reverse();
      const joined = [...left, ...right];
      // Short paths are always welcome; long ones only up to a cap.
      if (joined.length > rules.maxPath || selfTouching(joined, NEIGHBOURS)) continue;
      paths = paths.filter((_, k) => k !== i && k !== j);
      paths.push(joined);
      pathOf.fill(-1);
      reindex();
      merged = true;
      break;
    }
    // A level, when no join fits: the line takes one square off a neighbouring line's end instead (that line one
    // shorter), so trapped single squares get freed and the next joins can fit. Normal never does this.
    if (!merged && rules.anyCount) {
      for (const n of options) {
        const j = pathOf[n]!;
        const other = paths[j]!;
        if (other.length < 2) continue;
        const left = fromEnd === path[path.length - 1] ? path : [...path].reverse();
        const grown = [...left, n];
        if (grown.length > rules.maxPath || selfTouching(grown, NEIGHBOURS)) continue;
        const shrunk = other[0] === n ? other.slice(1) : other.slice(0, -1);
        paths = paths.map((p, k) => (k === i ? grown : k === j ? shrunk : p));
        pathOf.fill(-1);
        reindex();
        break;
      }
    }
    stuck = merged ? 0 : stuck + 1;
  }
  if (rules.anyCount ? paths.length < rules.minPairs || paths.length > rules.maxPairs : paths.length !== pairCount) return null;
  if (paths.some((path) => path.length < rules.minPath)) return null;
  return paths;
}

/** The live generator's own attempt cap. */
export const FLOW_MAX_ATTEMPTS = 3000;

/**
 * `rules` (levels, 15 Nov 2026): a level's board; Normal (the default) is exactly the generator before levels, draw
 * for draw. `accept` lets a level's bank add its own test (the human-style solver must finish the board).
 */
export function generateFlow(
  stats?: FlowGenStats,
  maxAttempts = FLOW_MAX_ATTEMPTS,
  rules: FlowRules = FLOW_NORMAL_RULES,
  accept?: (puzzle: FlowPuzzleData) => boolean,
): FlowPuzzleData {
  const NEIGHBOURS = neighboursOf(rules);
  const grid: FlowGrid = { cols: rules.cols, rows: rules.rows };
  let attempts = 0;
  for (let outer = 0; outer < maxAttempts; outer++) {
    attempts++;
    const walls = pickWalls(rules);
    const pairCount = rules.minPairs + randomInt(rules.maxPairs - rules.minPairs + 1);
    const paths = mergedPaths(new Set(walls), pairCount, rules);
    if (!paths) continue;
    if (stats) stats.laidOut = (stats.laidOut ?? 0) + 1;
    // Every path bends at least once, and no two dots sit side by side.
    if (paths.some((path) => flowBends(path) < 1 || NEIGHBOURS[path[0]!]!.includes(path[path.length - 1]!))) continue;
    if (rules.minAvgPath > 0 && paths.reduce((sum, path) => sum + path.length, 0) / paths.length < rules.minAvgPath) continue;
    const colours = shuffled(paths.length > COLOURS.length ? COLOURS_14 : COLOURS).slice(0, paths.length);
    const pairs: FlowPair[] = paths.map((path, index) => ({
      colour: colours[index]!,
      a: path[0]!,
      b: path[path.length - 1]!,
    }));
    if (!verifyFlow(pairs, paths, walls, grid).solved) continue;
    const made: FlowPuzzleData = rules.cols === 9 && rules.rows === 9
      ? { type: "flow", pairs, walls, solution: paths }
      : { type: "flow", cols: rules.cols, rows: rules.rows, pairs, walls, solution: paths };
    // A level's own test runs first: it is cheap, and it turns most boards away before the exhaustive proof.
    if (accept && !accept(made)) continue;
    if (countFlowSolutions(pairs, walls, 2, rules.budget, grid) !== 1) continue;
    if (stats) stats.attempts = attempts;
    return made;
  }
  throw new Error(`${gameDisplayName("flow")} generator could not build a unique board`);
}

/** Server-side check of a Colour Connect submission against the rules themselves. */
export function gradeFlowPaths(
  pairs: FlowPair[],
  paths: number[][],
  walls: readonly number[] = [],
  grid: FlowGrid = FLOW_GRID_NORMAL,
): { solved: boolean; pairsJoined: number; filled: number } {
  const verdict = verifyFlow(pairs, paths, walls, grid);
  return { solved: verdict.solved, pairsJoined: verdict.pairsJoined, filled: verdict.filled };
}

/**
 * Re-checks a stored board against every rule `generateFlow` applies before it
 * accepts one: wall placement, pair count and colours, path shape, the
 * solution itself, and the exhaustive uniqueness proof. Null when it passes.
 */
export function verifyFlowPuzzle(puzzle: FlowPuzzleData, rules: FlowRules = FLOW_NORMAL_RULES): string | null {
  const walls = puzzle.walls ?? [];
  const paths = puzzle.solution;
  const grid: FlowGrid = { cols: rules.cols, rows: rules.rows };
  const NEIGHBOURS = neighboursOf(grid);
  const cells = grid.cols * grid.rows;
  if (puzzle.type !== "flow") return "wrong type";
  const sized = rules.cols === 9 && rules.rows === 9 ? puzzle.cols === undefined && puzzle.rows === undefined : puzzle.cols === rules.cols && puzzle.rows === rules.rows;
  if (!sized) return "grid size";
  if (walls.length < rules.minWalls || walls.length > rules.maxWalls) return "wall count";
  for (const [i, w] of walls.entries()) {
    if (!Number.isInteger(w) || w < 0 || w >= cells) return "wall cell";
    if (NEIGHBOURS[w]!.length < 3) return "wall on a corner";
    for (const other of walls.slice(0, i)) {
      if (Math.abs(flowRow(w, grid.cols) - flowRow(other, grid.cols)) + Math.abs(flowCol(w, grid.cols) - flowCol(other, grid.cols)) < 3) return "walls too close";
    }
  }
  const P = puzzle.pairs.length;
  if (P < rules.minPairs || P > rules.maxPairs) return "pair count";
  const colours = puzzle.pairs.map((pair) => pair.colour);
  const palette = P > COLOURS.length ? COLOURS_14 : COLOURS;
  if (new Set(colours).size !== P || colours.some((c) => !palette.includes(c))) return "colours";
  if (!paths || paths.length !== P) return "solution paths";
  for (const [index, path] of paths.entries()) {
    const pair = puzzle.pairs[index]!;
    if (path[0] !== pair.a || path[path.length - 1] !== pair.b) return "path ends";
    if (path.length < rules.minPath || path.length > rules.maxPath) return "path length";
    if (selfTouching(path, NEIGHBOURS)) return "self-touching path";
    if (flowBends(path) < 1) return "straight path";
    if (NEIGHBOURS[pair.a]!.includes(pair.b)) return "dots side by side";
  }
  if (rules.minAvgPath > 0 && paths.reduce((sum, path) => sum + path.length, 0) / P < rules.minAvgPath) return "paths too short";
  if (!verifyFlow(puzzle.pairs, paths, walls, grid).solved) return "solution does not solve";
  if (countFlowSolutions(puzzle.pairs, walls, 2, rules.budget, grid) !== 1) return "not proven unique";
  return null;
}
