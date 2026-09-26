/**
 * Sliding Tiles rules. A frame is nine numbers, row-major, with 0 for the gap.
 * The player's answer is the list of tile values tapped; the server replays it
 * through exactly this code.
 */

import { TILES_COUNT, TILES_SIZE } from "./types";

export const TILES_UNDO = -1;
export const TILES_RESET = -2;

export function solvedFrame(): number[] {
  return [...Array.from({ length: TILES_COUNT }, (_value, index) => index + 1), 0];
}

export function tilesSolved(frame: number[]): boolean {
  const goal = solvedFrame();
  return frame.length === goal.length && frame.every((value, index) => value === goal[index]);
}

/** How many tiles already sit in their finished position. */
export function tilesInPlace(frame: number[]): number {
  const goal = solvedFrame();
  return frame.filter((value, index) => value !== 0 && value === goal[index]).length;
}

function adjacent(a: number, b: number): boolean {
  const ra = Math.floor(a / TILES_SIZE);
  const ca = a % TILES_SIZE;
  const rb = Math.floor(b / TILES_SIZE);
  const cb = b % TILES_SIZE;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

/** Every tile value that can slide into the gap right now. */
export function tilesMovable(frame: number[]): number[] {
  const gap = frame.indexOf(0);
  if (gap < 0) return [];
  return frame
    .map((value, index) => (value !== 0 && adjacent(index, gap) ? value : 0))
    .filter((value) => value !== 0);
}

/** Slides one tile into the gap, or returns null when that tile cannot move. */
export function tilesSlide(frame: number[], tile: number): number[] | null {
  const gap = frame.indexOf(0);
  const from = frame.indexOf(tile);
  if (gap < 0 || from < 0 || tile === 0 || !adjacent(from, gap)) return null;
  const next = [...frame];
  next[gap] = tile;
  next[from] = 0;
  return next;
}

export function encodeTileMoves(moves: number[]): string {
  return moves.join(",");
}

export function decodeTileMoves(raw: string): number[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isInteger(value) && value >= TILES_RESET && value <= TILES_COUNT);
}

export interface TilesReplay {
  frame: number[];
  solved: boolean;
  moves: number;
  inPlace: number;
}

/** The one place a move list is replayed — used for scoring, Undo and Reset. */
export function replayTiles(start: number[], moves: number[]): TilesReplay {
  const history: number[][] = [[...start]];
  let totalMoves = 0;
  for (const move of moves) {
    const frame = history[history.length - 1]!;
    if (tilesSolved(frame)) break;
    if (move === TILES_RESET) {
      history.length = 1;
      continue;
    }
    if (move === TILES_UNDO) {
      if (history.length > 1) history.pop();
      continue;
    }
    const next = tilesSlide(frame, move);
    if (next) { history.push(next); totalMoves++; }
  }
  const frame = history[history.length - 1]!;
  return {
    frame,
    solved: tilesSolved(frame),
    moves: totalMoves,
    inPlace: tilesInPlace(frame),
  };
}
