/**
 * Ice Slide rules. The same slide function runs on the phone (to animate the
 * ball) and on the server (to replay the moves a phone sends). The ball keeps
 * sliding until a wall or the edge stops it. A hole swallows it and drops it
 * back on the start (the move still counts); an arrow turns it; a portal sends
 * it out of its twin with the same heading; thin ice it crosses turns into a
 * hole for every later slide. The board state is (cell, broken-ice bitmask).
 */

import {
  SLIDE_CELLS,
  SLIDE_COLS as N,
  type SlideArrow,
  type SlideDir,
  type SlidePuzzleData,
} from "./types";

export const SLIDE_DIRS: SlideDir[] = ["U", "D", "L", "R"];

export function slideStep(cell: number, dir: SlideDir): number | null {
  if (dir === "X" || dir === "Y") return null;
  const row = Math.floor(cell / N);
  const col = cell % N;
  if (dir === "U") return row > 0 ? cell - N : null;
  if (dir === "D") return row < N - 1 ? cell + N : null;
  if (dir === "L") return col > 0 ? cell - 1 : null;
  return col < N - 1 ? cell + 1 : null;
}

export interface SlideBoard {
  walls: Set<number>;
  holes: Set<number>;
  arrows: Map<number, SlideDir>;
  portals: Map<number, number>;
  /** Thin-ice cell → its bit in the broken mask. */
  thin: Map<number, number>;
  start: number;
  exit: number;
}

export function slideBoard(
  puzzle: Pick<SlidePuzzleData, "walls" | "holes" | "arrows" | "portals" | "thin" | "start" | "exit">,
): SlideBoard {
  const portals = new Map<number, number>();
  for (const [a, b] of puzzle.portals ?? []) {
    portals.set(a, b);
    portals.set(b, a);
  }
  return {
    walls: new Set(puzzle.walls),
    holes: new Set(puzzle.holes ?? []),
    arrows: new Map((puzzle.arrows ?? []).map((arrow: SlideArrow) => [arrow.cell, arrow.dir])),
    portals,
    thin: new Map((puzzle.thin ?? []).map((cell, bit) => [cell, bit])),
    start: puzzle.start,
    exit: puzzle.exit,
  };
}

export interface SlideOutcome {
  /** Cells the ball travels over, in order (a portal jump lists both ends). */
  path: number[];
  /** Where it comes to rest — the start again when it fell in a hole. */
  cell: number;
  /** Broken-ice mask after the slide. */
  mask: number;
  fell: boolean;
  /** True when the slide went through a portal. */
  portal: boolean;
  /** True when the slide crossed (and broke) thin ice. */
  cracked: boolean;
}

export function slideOutcome(board: SlideBoard, from: number, mask: number, dir: SlideDir): SlideOutcome {
  const path: number[] = [];
  const seen = new Set<string>();
  let cell = from;
  let heading = dir;
  let broke = 0;
  let portal = false;
  for (let guard = 0; guard < SLIDE_CELLS * 4; guard++) {
    const next = slideStep(cell, heading);
    if (next === null || board.walls.has(next)) break;
    cell = next;
    path.push(cell);
    const bit = board.thin.get(cell);
    if (board.holes.has(cell) || (bit !== undefined && mask & (1 << bit))) {
      return { path, cell: board.start, mask: mask | broke, fell: true, portal, cracked: broke !== 0 };
    }
    if (bit !== undefined) broke |= 1 << bit;
    if (cell === board.exit) break;
    const id = `${cell}:${heading}`;
    // A loop of arrows or portals would spin forever: the ball simply stops.
    if (seen.has(id)) break;
    seen.add(id);
    const twin = board.portals.get(cell);
    if (twin !== undefined) {
      portal = true;
      cell = twin;
      path.push(cell);
      continue;
    }
    const turn = board.arrows.get(cell);
    if (turn) heading = turn;
  }
  return {
    path,
    cell: path.length ? cell : from,
    mask: mask | broke,
    fell: false,
    portal,
    cracked: broke !== 0,
  };
}

export function decodeSlideMoves(raw: string): SlideDir[] {
  return String(raw ?? "")
    .toUpperCase()
    .split("")
    .filter(
      (char): char is SlideDir =>
        (SLIDE_DIRS as string[]).includes(char) || char === "X" || char === "Y",
    )
    .slice(0, 300);
}

export function encodeSlideMoves(moves: SlideDir[]): string {
  return moves.join("");
}

export interface SlideState {
  cell: number;
  mask: number;
}

export interface SlideReplay {
  cell: number;
  mask: number;
  moves: number;
  solved: boolean;
  falls: number;
  /** Every state the ball came to rest in, the start included. */
  visited: SlideState[];
  /** Cells crossed by each slide, for drawing. */
  paths: number[][];
}

/** Replays a move list from the stored start. X = undo, Y = reset; no-op slides are dropped. */
export function replaySlide(board: SlideBoard, moves: SlideDir[]): SlideReplay {
  let state: SlideState = { cell: board.start, mask: 0 };
  let count = 0;
  let falls = 0;
  const visited: SlideState[] = [state];
  const history: SlideState[] = [state];
  const paths: number[][] = [];
  for (const dir of moves) {
    if (dir === "X") {
      if (history.length > 1) history.pop();
      state = history[history.length - 1]!;
      continue;
    }
    if (dir === "Y") {
      history.length = 1;
      state = history[0]!;
      continue;
    }
    if (state.cell === board.exit) break;
    const out = slideOutcome(board, state.cell, state.mask, dir);
    if (!out.path.length) continue;
    state = { cell: out.cell, mask: out.mask };
    history.push(state);
    visited.push(state);
    paths.push(out.path);
    count += 1;
    if (out.fell) falls += 1;
    if (state.cell === board.exit) break;
  }
  return { ...state, moves: count, solved: state.cell === board.exit, falls, visited, paths };
}

/** Breadth-first search over (cell, broken mask): fewest slides and one shortest route. */
export function slideSearch(
  board: SlideBoard,
  from: SlideState = { cell: board.start, mask: 0 },
  maxDepth = SLIDE_CELLS * 4,
): { min: number; route: SlideDir[] } | null {
  if (from.cell === board.exit) return { min: 0, route: [] };
  const key = (s: SlideState) => s.mask * SLIDE_CELLS + s.cell;
  const states: SlideState[] = [from];
  const parent: number[] = [-1];
  const via: SlideDir[] = ["X"];
  const depth: number[] = [0];
  const seen = new Set<number>([key(from)]);
  for (let index = 0; index < states.length; index++) {
    if (depth[index]! >= maxDepth) return null;
    const node = states[index]!;
    for (const dir of SLIDE_DIRS) {
      const out = slideOutcome(board, node.cell, node.mask, dir);
      if (!out.path.length) continue;
      const next = { cell: out.cell, mask: out.mask };
      const id = key(next);
      if (seen.has(id)) continue;
      seen.add(id);
      states.push(next);
      parent.push(index);
      via.push(dir);
      depth.push(depth[index]! + 1);
      if (next.cell === board.exit) {
        const route: SlideDir[] = [];
        for (let walk = states.length - 1; walk > 0; walk = parent[walk]!) route.unshift(via[walk]!);
        return { min: route.length, route };
      }
    }
  }
  return null;
}

export function slideDistance(board: SlideBoard, from: SlideState): number | null {
  return slideSearch(board, from)?.min ?? null;
}
