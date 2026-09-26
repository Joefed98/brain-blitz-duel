/**
 * Ice Slide rules. The same slide function runs on the phone (to animate the
 * ball) and on the server (to replay the moves a phone sends). A hole swallows
 * the ball mid-slide and drops it back on the start; the move still counts. A
 * one-way arrow cell turns a sliding ball in the arrow's direction.
 */

import { SLIDE_CELLS, SLIDE_COLS as N, type SlideArrow, type SlideDir } from "./types";

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

export function arrowMap(arrows: SlideArrow[] | undefined): Map<number, SlideDir> {
  return new Map((arrows ?? []).map((arrow) => [arrow.cell, arrow.dir]));
}

export interface SlideOutcome {
  /** Cells the ball travels over, in order. */
  path: number[];
  /** Where it comes to rest — the start again when it fell in a hole. */
  cell: number;
  /** True when a hole swallowed it on the way. */
  fell: boolean;
}

/**
 * One slide: the ball keeps going until a wall or the grid edge stops it. The
 * exit stops it too. A hole ends the slide there and sends the ball home, and
 * an arrow cell turns it and lets it carry on.
 */
export function slideOutcome(
  from: number,
  dir: SlideDir,
  walls: Set<number>,
  holes: Set<number>,
  exit: number,
  start: number,
  arrows?: Map<number, SlideDir>,
): SlideOutcome {
  const turns = arrows ?? new Map<number, SlideDir>();
  const path: number[] = [];
  const seen = new Set<string>();
  let cell = from;
  let heading = dir;
  for (let guard = 0; guard < SLIDE_CELLS * 4; guard++) {
    const next = slideStep(cell, heading);
    if (next === null || walls.has(next)) break;
    cell = next;
    path.push(cell);
    if (holes.has(cell)) return { path, cell: start, fell: true };
    if (cell === exit) break;
    const turn = turns.get(cell);
    if (turn) {
      const id = `${cell}:${turn}`;
      // An arrow loop would spin forever: the ball simply stops there.
      if (seen.has(id)) break;
      seen.add(id);
      heading = turn;
    }
  }
  return { path, cell: path.length ? cell : from, fell: false };
}

export function decodeSlideMoves(raw: string): SlideDir[] {
  return String(raw ?? "")
    .toUpperCase()
    .split("")
    .filter((char): char is SlideDir => (SLIDE_DIRS as string[]).includes(char) || char === "X" || char === "Y")
    .slice(0, 200);
}

export function encodeSlideMoves(moves: SlideDir[]): string {
  return moves.join("");
}

export interface SlideReplay {
  /** Where the ball ended up. */
  cell: number;
  /** Slides that actually moved the ball. */
  moves: number;
  solved: boolean;
  /** How many times a hole sent it home. */
  falls: number;
  /** Every cell the ball came to rest on, the start included. */
  visited: number[];
}

/** Replays a move list from the stored start. Moves that change nothing are dropped. */
export function replaySlide(
  walls: number[],
  holes: number[],
  start: number,
  exit: number,
  moves: SlideDir[],
  arrows?: SlideArrow[],
): SlideReplay {
  const blocked = new Set(walls);
  const pits = new Set(holes);
  const turns = arrowMap(arrows);
  let cell = start;
  let count = 0;
  let falls = 0;
  const visited = [start];
  const history = [start];
  for (const dir of moves) {
    if (dir === "X") { if (history.length > 1) history.pop(); cell = history[history.length - 1]!; continue; }
    if (dir === "Y") { history.length = 1; cell = start; continue; }
    if (cell === exit) break;
    const outcome = slideOutcome(cell, dir, blocked, pits, exit, start, turns);
    // A slide into a hole still costs a move, even though the ball ends at home.
    if (!outcome.path.length) continue;
    cell = outcome.cell;
    history.push(cell);
    visited.push(cell);
    count += 1;
    if (outcome.fell) falls += 1;
    if (cell === exit) break;
  }
  return { cell, moves: count, solved: cell === exit, falls, visited };
}

/**
 * Fewest slides from a cell to the exit, or null when it cannot be reached.
 * Holes and arrows are both part of the search: a slide over a hole simply
 * lands back on the start, and an arrow turns the ball mid-slide.
 */
export function slideDistance(
  walls: number[],
  holes: number[],
  from: number,
  exit: number,
  start: number,
  arrows?: SlideArrow[],
): number | null {
  const blocked = new Set(walls);
  const pits = new Set(holes);
  const turns = arrowMap(arrows);
  if (from === exit) return 0;
  const seen = new Set<number>([from]);
  let frontier = [from];
  for (let depth = 1; depth <= SLIDE_CELLS * 4; depth++) {
    const next: number[] = [];
    for (const cell of frontier) {
      for (const dir of SLIDE_DIRS) {
        const landed = slideOutcome(cell, dir, blocked, pits, exit, start, turns).cell;
        if (landed === cell || seen.has(landed)) continue;
        if (landed === exit) return depth;
        seen.add(landed);
        next.push(landed);
      }
    }
    if (!next.length) return null;
    frontier = next;
  }
  return null;
}

/** Every slide path reachable from the start, including the cells crossed. */
export function reachableSlidePaths(
  walls: number[],
  holes: number[],
  start: number,
  exit: number,
  arrows?: SlideArrow[],
): { signatures: Set<string>; crossed: Set<number> } {
  const blocked = new Set(walls);
  const pits = new Set(holes);
  const turns = arrowMap(arrows);
  const seen = new Set<number>([start]);
  const queue = [start];
  const signatures = new Set<string>();
  const crossed = new Set<number>();
  for (let at = 0; at < queue.length; at++) {
    const cell = queue[at]!;
    if (cell === exit) continue;
    for (const dir of SLIDE_DIRS) {
      const outcome = slideOutcome(cell, dir, blocked, pits, exit, start, turns);
      if (!outcome.path.length) continue;
      outcome.path.forEach((pathCell) => crossed.add(pathCell));
      signatures.add(`${cell}:${dir}:${outcome.path.join(",")}>${outcome.cell}`);
      if (!seen.has(outcome.cell)) {
        seen.add(outcome.cell);
        queue.push(outcome.cell);
      }
    }
  }
  return { signatures, crossed };
}

/** One shortest route from the start, as UDLR letters ("" when unreachable). */
export function shortestSlideRoute(
  walls: number[],
  holes: number[],
  start: number,
  exit: number,
  arrows?: SlideArrow[],
): SlideDir[] {
  const blocked = new Set(walls);
  const pits = new Set(holes);
  const turns = arrowMap(arrows);
  if (start === exit) return [];
  const seen = new Set<number>([start]);
  let frontier: { cell: number; moves: SlideDir[] }[] = [{ cell: start, moves: [] }];
  for (let depth = 1; depth <= SLIDE_CELLS * 4; depth++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const dir of SLIDE_DIRS) {
        const landed = slideOutcome(node.cell, dir, blocked, pits, exit, start, turns).cell;
        if (landed === node.cell || seen.has(landed)) continue;
        const moves = [...node.moves, dir];
        if (landed === exit) return moves;
        seen.add(landed);
        next.push({ cell: landed, moves });
      }
    }
    if (!next.length) return [];
    frontier = next;
  }
  return [];
}

/** True when a route never slides over a hole. */
export function slideRouteAvoidsHoles(
  walls: number[],
  holes: number[],
  start: number,
  exit: number,
  moves: SlideDir[],
  arrows?: SlideArrow[],
): boolean {
  const blocked = new Set(walls);
  const pits = new Set(holes);
  const turns = arrowMap(arrows);
  let cell = start;
  for (const dir of moves) {
    if (dir === "X" || dir === "Y") continue;
    const outcome = slideOutcome(cell, dir, blocked, pits, exit, start, turns);
    if (outcome.fell) return false;
    if (!outcome.path.length) continue;
    cell = outcome.cell;
    if (cell === exit) break;
  }
  return true;
}
