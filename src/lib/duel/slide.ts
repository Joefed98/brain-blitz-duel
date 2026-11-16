/**
 * Ice Slide rules. The same slide function runs on the phone (to animate the
 * ball) and on the server (to replay the moves a phone sends). The ball keeps
 * sliding until a wall or the edge stops it. A hole swallows it and drops it
 * back on the start (the move still counts); an arrow turns it; a portal sends
 * it out of its twin with the same heading; thin ice it crosses turns into a
 * hole for every later slide. The board state is (cell, broken-ice bitmask).
 */

import {
  SLIDE_COLS as N,
  type SlideArrow,
  type SlideDir,
  type SlidePuzzleData,
} from "./types";

export const SLIDE_DIRS: SlideDir[] = ["U", "D", "L", "R"];

/**
 * One square on in `dir`, or null at the edge. A board is 12 × 12 unless a level gives it its own `cols` × `rows`
 * (difficulty levels, 16 Nov 2026: Easy 8 × 8, Expert 12 × 14); the defaults are today's board exactly.
 */
export function slideStep(cell: number, dir: SlideDir, cols = N, rows = N): number | null {
  if (dir === "X" || dir === "Y") return null;
  const row = Math.floor(cell / cols);
  const col = cell % cols;
  if (dir === "U") return row > 0 ? cell - cols : null;
  if (dir === "D") return row < rows - 1 ? cell + cols : null;
  if (dir === "L") return col > 0 ? cell - 1 : null;
  return col < cols - 1 ? cell + 1 : null;
}

/** A stored board's size: its own `cols` × `rows` (a level board), else today's 12 × 12. */
export function slideDims(puzzle: { cols?: number | undefined; rows?: number | undefined } | null | undefined): { cols: number; rows: number; cells: number } {
  const cols = puzzle?.cols ?? N;
  const rows = puzzle?.rows ?? N;
  return { cols, rows, cells: cols * rows };
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
  /** The board's size (absent: 12 × 12). */
  cols?: number;
  rows?: number;
}

export function slideBoard(
  puzzle: Pick<SlidePuzzleData, "walls" | "holes" | "arrows" | "portals" | "thin" | "start" | "exit"> & { cols?: number | undefined; rows?: number | undefined },
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
    ...(puzzle.cols !== undefined || puzzle.rows !== undefined ? { cols: puzzle.cols ?? N, rows: puzzle.rows ?? N } : {}),
  };
}

function boardCells(board: Pick<SlideBoard, "cols" | "rows">): number {
  return (board.cols ?? N) * (board.rows ?? N);
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
  const cols = board.cols ?? N;
  const rows = board.rows ?? N;
  for (let guard = 0; guard < cols * rows * 4; guard++) {
    const next = slideStep(cell, heading, cols, rows);
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
  /**
   * The slides still standing: every slide played less those Undo or Reset took back (slideRev 5, the Pattern
   * overhaul: Undo gives the slide back). Older stamps count `moves`.
   */
  net: number;
  /** Cells crossed by each standing slide, in order (the route the player's board shows). */
  standing: number[][];
  /** The direction of each standing slide, in order (the reveal's arrow chips). */
  standingDirs: SlideDir[];
  /** The cell where each fall happened, in play order (undone falls included: the reveal marks where the ball fell). */
  fellAt: number[];
}

/** The slides a stamp counts: slideRev 5 (the Pattern overhaul) the standing slides, older stamps every slide played. */
export function countedSlides(replay: Pick<SlideReplay, "moves" | "net">, undoGivesBack: boolean): number {
  return undoGivesBack ? replay.net : replay.moves;
}

/** Replays a move list from the stored start. X = undo, Y = reset; no-op slides are dropped. */
export function replaySlide(board: SlideBoard, moves: SlideDir[]): SlideReplay {
  let state: SlideState = { cell: board.start, mask: 0 };
  let count = 0;
  let falls = 0;
  const visited: SlideState[] = [state];
  const history: SlideState[] = [state];
  const paths: number[][] = [];
  const standing: number[][] = [];
  const standingDirs: SlideDir[] = [];
  const fellAt: number[] = [];
  for (const dir of moves) {
    if (dir === "X") {
      if (history.length > 1) {
        history.pop();
        standing.pop();
        standingDirs.pop();
      }
      state = history[history.length - 1]!;
      continue;
    }
    if (dir === "Y") {
      history.length = 1;
      standing.length = 0;
      standingDirs.length = 0;
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
    standing.push(out.path);
    standingDirs.push(dir);
    count += 1;
    if (out.fell) {
      falls += 1;
      fellAt.push(out.path[out.path.length - 1]!);
    }
    if (state.cell === board.exit) break;
  }
  return { ...state, moves: count, solved: state.cell === board.exit, falls, visited, paths, net: history.length - 1, standing, standingDirs, fellAt };
}

/** Breadth-first search over (cell, broken mask): fewest slides and one shortest route. */
export function slideSearch(
  board: SlideBoard,
  from: SlideState = { cell: board.start, mask: 0 },
  maxDepth = boardCells(board) * 4,
): { min: number; route: SlideDir[] } | null {
  if (from.cell === board.exit) return { min: 0, route: [] };
  const cells = boardCells(board);
  const key = (s: SlideState) => s.mask * cells + s.cell;
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

/** True when one slide from this resting state reaches the exit (display and sound only: the exit's near-miss glow). */
export function oneSlideFromExit(board: SlideBoard, from: SlideState): boolean {
  if (from.cell === board.exit) return false;
  return SLIDE_DIRS.some((dir) => {
    const out = slideOutcome(board, from.cell, from.mask, dir);
    return !out.fell && out.cell === board.exit;
  });
}

export function slideDistance(board: SlideBoard, from: SlideState): number | null {
  return slideSearch(board, from)?.min ?? null;
}
