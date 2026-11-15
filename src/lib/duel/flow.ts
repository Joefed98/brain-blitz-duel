/**
 * Colour Connect rules. Shared by the phone (to draw and edit paths live) and by the
 * server (to re-check every path a phone sends). Pure logic, no generator and
 * no stored answers.
 */

import { prePatternNov15Pinned, usesPatternNov15 } from "./patternNov15";
import { FLOW_CELLS, FLOW_COLS as N, type FlowColour, type FlowPair } from "./types";

/**
 * flowRev 3 (the Pattern overhaul, 15 Nov 2026): drawing over another colour's line cuts that line back to the
 * square before the crossing, and a still tap on a dot no longer clears its line (only a drag restarts it). Older
 * stamps keep the old rule: another colour's line refuses the step, and a still tap on a dot clears its line.
 */
export function flowCutsLines(puzzle: unknown): boolean {
  return usesPatternNov15(puzzle, "flow");
}

/** A still tap on a dot clears its line only before flowRev 3 (from it a stray touch leaves a finished pair alone). */
export function flowTapClears(puzzle: unknown): boolean {
  return !flowCutsLines(puzzle);
}

/** Whether today's deal is on flowRev 3 (help and intro texts; checks pinning the stamps before read the old rule). */
export function flowCutsDealt(): boolean {
  return !prePatternNov15Pinned();
}

/** Twelve distinct path colours, so up to twelve pairs never share a hue. */
export const FLOW_COLOUR_HEX: Record<FlowColour, string> = {
  RED: "#FF4D4D",
  BLUE: "#4D8CFF",
  GREEN: "#3DDC84",
  PURPLE: "#B26BFF",
  PINK: "#FF6BD6",
  ORANGE: "#FF8A3D",
  BROWN: "#A86B32",
  YELLOW: "#FFE600",
  TEAL: "#19C9C0",
  WHITE: "#F2F2F2",
  LIME: "#A8F03A",
  SILVER: "#8E98AE",
};

export function flowRow(cell: number): number {
  return Math.floor(cell / N);
}

export function flowCol(cell: number): number {
  return cell % N;
}

/** The orthogonal neighbours of a cell, inside the grid. */
export function flowNeighbours(cell: number): number[] {
  const out: number[] = [];
  const row = flowRow(cell);
  const col = flowCol(cell);
  if (row > 0) out.push(cell - N);
  if (row < N - 1) out.push(cell + N);
  if (col > 0) out.push(cell - 1);
  if (col < N - 1) out.push(cell + 1);
  return out;
}

export function flowAdjacent(a: number, b: number): boolean {
  return flowNeighbours(a).includes(b);
}

/** "0,1,2|7,8,9" — one cell list per pair, in pair order. */
export function encodeFlowPaths(paths: number[][]): string {
  return paths.map((path) => path.join(",")).join("|");
}

export function decodeFlowPaths(raw: string, pairs: number): number[][] {
  const parts = String(raw ?? "")
    .split("|")
    .slice(0, pairs);
  const out: number[][] = [];
  for (let index = 0; index < pairs; index++) {
    out.push(
      (parts[index] ?? "")
        .split(",")
        .map((value) => Number.parseInt(value, 10))
        .filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < FLOW_CELLS)
        .slice(0, FLOW_CELLS),
    );
  }
  return out;
}

export interface FlowVerdict {
  /** True for each pair whose path legally joins its two dots. */
  joined: boolean[];
  /** How many pairs are joined by legal, non-overlapping paths. */
  pairsJoined: number;
  /** How many cells those paths cover. */
  filled: number;
  solved: boolean;
}

/**
 * Checks every path itself: contiguous single steps, no repeats, the right two
 * dots at the ends, and no cell shared with another pair. Paths that break a
 * rule simply do not count — they never invalidate the rest of the board.
 */
export function verifyFlow(
  pairs: FlowPair[],
  paths: number[][],
  walls: readonly number[] = [],
): FlowVerdict {
  const wallSet = new Set(walls);
  const used = new Set<number>();
  const joined: boolean[] = [];

  const legal = pairs.map((pair, index) => {
    const path = paths[index] ?? [];
    if (path.length < 2) return null;
    const seen = new Set<number>();
    for (let i = 0; i < path.length; i++) {
      const cell = path[i]!;
      if (seen.has(cell) || wallSet.has(cell)) return null;
      seen.add(cell);
      if (i > 0 && !flowAdjacent(path[i - 1]!, cell)) return null;
    }
    const first = path[0]!;
    const last = path[path.length - 1]!;
    const ends = (first === pair.a && last === pair.b) || (first === pair.b && last === pair.a);
    if (!ends) return null;
    // A path may not run through another pair's dot.
    for (const other of pairs) {
      if (other === pair) continue;
      if (seen.has(other.a) || seen.has(other.b)) return null;
    }
    return path;
  });

  for (const path of legal) {
    if (!path) {
      joined.push(false);
      continue;
    }
    if (path.some((cell) => used.has(cell))) {
      joined.push(false);
      continue;
    }
    for (const cell of path) used.add(cell);
    joined.push(true);
  }

  const pairsJoined = joined.filter(Boolean).length;
  return {
    joined,
    pairsJoined,
    filled: used.size,
    solved: pairsJoined === pairs.length && used.size === FLOW_CELLS - wallSet.size,
  };
}

/** How many cells the player's own paths currently cover, legal or not. */
export function flowFilledCells(paths: number[][]): number {
  const cells = new Set<number>();
  for (const path of paths) for (const cell of path) cells.add(cell);
  return cells.size;
}

/** What one cell under a drawing finger does to the paths (the phone's drawing rule, shared for checks). */
export interface FlowDrawStep {
  /** The paths after the step (the same array when nothing changed). */
  paths: number[][];
  /** The path grew or was rubbed out behind the finger. */
  moved: boolean;
  /** The step reached the path's partner dot. */
  completed: boolean;
  /** The step was refused (not a neighbour, a wall, its own path, another colour). */
  rejected: boolean;
  /** flowRev 3: the pair whose line the step cut back (null when none). */
  cut: number | null;
}

/** `path` cut back to the squares before `cell` (empty when only its dot would be left). */
export function flowCutBack(path: readonly number[], cell: number): number[] {
  const at = path.indexOf(cell);
  if (at < 0) return [...path];
  return at <= 1 ? [] : path.slice(0, at);
}

/**
 * One step of a drag on pair `active` onto `cell`. `restartFrom` is the dot a drag began on (pattern review fixes,
 * 15 Nov 2026): touching a dot no longer wipes its path at once, so a stray touch on a finished pair leaves it
 * alone; the path restarts from that dot only on the drag's first real step off it. With `cut` (flowRev 3,
 * `flowCutsLines`) a step onto another colour's line cuts that line back to the square before the crossing (a dot is
 * still refused); without it the step is refused, as before.
 */
export function flowDrawStep(
  current: number[][],
  active: number,
  cell: number,
  pairs: { a: number; b: number }[],
  walls: number[],
  restartFrom: number | null = null,
  cut = false,
): FlowDrawStep {
  const same = { paths: current, moved: false, completed: false, rejected: false, cut: null };
  const path = restartFrom !== null ? [restartFrom] : (current[active] ?? []);
  const last = path[path.length - 1];
  if (last === undefined || cell === last) return same;
  // Backing up over the previous cell rubs the path out behind the finger.
  if (path.length > 1 && cell === path[path.length - 2]) {
    return { ...same, paths: current.map((value, index) => (index === active ? path.slice(0, -1) : value)), moved: true };
  }
  const reject = { ...same, rejected: true };
  if (!flowAdjacent(last, cell)) return reject;
  if (path.includes(cell) || walls.includes(cell)) return reject;
  const pair = pairs[active]!;
  // Its own partner dot is welcome; any other colour's dot is refused.
  const ends = cell === pair.a || cell === pair.b;
  if (pairs.some((other, index) => index !== active && (other.a === cell || other.b === cell))) return reject;
  // Another colour's path: refused before flowRev 3; from it, that line is cut back to the square before the crossing.
  const crossed = current.findIndex((value, index) => index !== active && value.includes(cell));
  if (crossed !== -1 && !cut) return reject;
  const next = [...current];
  if (crossed !== -1) next[crossed] = flowCutBack(current[crossed]!, cell);
  next[active] = [...path, cell];
  return { paths: next, moved: true, completed: ends, rejected: false, cut: crossed === -1 ? null : crossed };
}
