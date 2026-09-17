/**
 * Ice Slide rules. The same slide function runs on the phone (to animate the
 * ball) and on the server (to replay the moves a phone sends).
 */

import { SLIDE_CELLS, SLIDE_COLS as N, type SlideDir } from "./types";

export const SLIDE_DIRS: SlideDir[] = ["U", "D", "L", "R"];

function step(cell: number, dir: SlideDir): number | null {
  const row = Math.floor(cell / N);
  const col = cell % N;
  if (dir === "U") return row > 0 ? cell - N : null;
  if (dir === "D") return row < N - 1 ? cell + N : null;
  if (dir === "L") return col > 0 ? cell - 1 : null;
  return col < N - 1 ? cell + 1 : null;
}

/**
 * One slide: the ball keeps going until a wall or the grid edge stops it. The
 * exit stops it too, so the route to the exit is always well defined.
 */
export function slidePath(from: number, dir: SlideDir, walls: Set<number>, exit: number): number[] {
  const path: number[] = [];
  let cell = from;
  for (let guard = 0; guard < SLIDE_CELLS; guard++) {
    const next = step(cell, dir);
    if (next === null || walls.has(next)) break;
    cell = next;
    path.push(cell);
    if (cell === exit) break;
  }
  return path;
}

export function slideTo(from: number, dir: SlideDir, walls: Set<number>, exit: number): number {
  const path = slidePath(from, dir, walls, exit);
  return path.length ? path[path.length - 1]! : from;
}

export function decodeSlideMoves(raw: string): SlideDir[] {
  return String(raw ?? "")
    .toUpperCase()
    .split("")
    .filter((char): char is SlideDir => (SLIDE_DIRS as string[]).includes(char))
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
}

/** Replays a move list from the stored start. Moves that change nothing are dropped. */
export function replaySlide(
  walls: number[],
  start: number,
  exit: number,
  moves: SlideDir[],
): SlideReplay {
  const blocked = new Set(walls);
  let cell = start;
  let count = 0;
  for (const dir of moves) {
    if (cell === exit) break;
    const next = slideTo(cell, dir, blocked, exit);
    if (next === cell) continue;
    cell = next;
    count += 1;
    if (cell === exit) break;
  }
  return { cell, moves: count, solved: cell === exit };
}

/** Fewest slides from a cell to the exit, or null when it cannot be reached. */
export function slideDistance(walls: number[], from: number, exit: number): number | null {
  const blocked = new Set(walls);
  if (from === exit) return 0;
  const seen = new Set<number>([from]);
  let frontier = [from];
  for (let depth = 1; depth <= SLIDE_CELLS * 4; depth++) {
    const next: number[] = [];
    for (const cell of frontier) {
      for (const dir of SLIDE_DIRS) {
        const landed = slideTo(cell, dir, blocked, exit);
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

/** One shortest route from the start, as UDLR letters ("" when unreachable). */
export function shortestSlideRoute(walls: number[], start: number, exit: number): SlideDir[] {
  const blocked = new Set(walls);
  if (start === exit) return [];
  const seen = new Set<number>([start]);
  let frontier: { cell: number; moves: SlideDir[] }[] = [{ cell: start, moves: [] }];
  for (let depth = 1; depth <= SLIDE_CELLS * 4; depth++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const dir of SLIDE_DIRS) {
        const landed = slideTo(node.cell, dir, blocked, exit);
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
