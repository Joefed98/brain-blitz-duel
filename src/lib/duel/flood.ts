/**
 * Colour Flood rules. The region that belongs to the player is always the blob
 * connected to the top-left cell; tapping a colour repaints it. The server
 * replays the tapped colours through exactly this code.
 */

import { FLOOD_CELLS, FLOOD_COLOURS, FLOOD_SIZE } from "./types";

/**
 * A blocked square (the Logic overhaul's Expert level): a stone the flood never takes and the board never needs. Only
 * a level's board has any; today's never does, so every rule below reads it exactly as before.
 */
export const FLOOD_BLOCKED = 99;

/** A board's shape (the levels' boards are wider than tall is never; they grow downwards): columns and colours. */
export function floodColsOf(puzzle: { cols?: number } | null | undefined): number {
  return puzzle?.cols ?? FLOOD_SIZE;
}
export function floodColoursOf(puzzle: { colours?: number } | null | undefined): number {
  return puzzle?.colours ?? FLOOD_COLOURS;
}

/** Squares the flood must take (all but the blocked ones). */
export function floodPlayable(grid: readonly number[]): number {
  let n = 0;
  for (const v of grid) if (v !== FLOOD_BLOCKED) n++;
  return n;
}

/** Every cell in the player's region, given the current colouring. */
export function regionCells(grid: number[], size: number = FLOOD_SIZE): number[] {
  const colour = grid[0];
  if (colour === undefined) return [];
  const seen = new Set<number>([0]);
  const stack = [0];
  while (stack.length) {
    const cell = stack.pop()!;
    const row = Math.floor(cell / size);
    const col = cell % size;
    const neighbours = [
      col > 0 ? cell - 1 : -1,
      col < size - 1 ? cell + 1 : -1,
      row > 0 ? cell - size : -1,
      cell + size < grid.length ? cell + size : -1,
    ];
    for (const next of neighbours) {
      if (next < 0 || seen.has(next)) continue;
      if (grid[next] !== colour) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  return [...seen];
}

export function regionSize(grid: number[], size: number = FLOOD_SIZE): number {
  return regionCells(grid, size).length;
}

/** Repaints the region; the region then grows into every touching match. */
export function floodApply(grid: number[], colour: number, size: number = FLOOD_SIZE, colours: number = FLOOD_COLOURS): number[] {
  if (!Number.isInteger(colour) || colour < 0 || colour >= colours) return grid;
  if (grid[0] === colour) return grid;
  const next = [...grid];
  for (const cell of regionCells(grid, size)) next[cell] = colour;
  return next;
}

export function floodSolved(grid: number[]): boolean {
  return grid.length > 0 && grid.every((colour) => colour === grid[0] || colour === FLOOD_BLOCKED);
}

export function encodeFloodMoves(moves: number[]): string {
  return moves.join(",");
}

export function decodeFloodMoves(raw: string, colours: number = FLOOD_COLOURS): number[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isInteger(value) && value >= -1 && value < colours);
}

export interface FloodReplay {
  grid: number[];
  solved: boolean;
  moves: number;
  region: number;
  /** True when the move limit (floodRev 1) is used up without a flood: the board has ended unfinished. */
  outOfMoves: boolean;
}

/**
 * The one place a tap list is replayed — used for scoring and for Undo. With a
 * move limit (floodRev 1, moveLimits.ts) taps after the limit-th move are ignored.
 */
export function replayFlood(
  start: number[],
  moves: number[],
  size: number = FLOOD_SIZE,
  limit: number | null = null,
  colours: number = FLOOD_COLOURS,
): FloodReplay {
  const history = [[...start]];
  let made = 0;
  for (const colour of moves) {
    if (limit !== null && made >= limit) break;
    if (colour === -1) { if (history.length > 1) history.pop(); continue; }
    const grid = history[history.length - 1]!;
    if (floodSolved(grid)) break;
    const next = floodApply(grid, colour, size, colours);
    if (next === grid) continue;
    history.push(next);
    made += 1;
  }
  const grid = history[history.length - 1]!;
  return {
    grid,
    solved: floodSolved(grid),
    moves: made,
    // Today's board is FLOOD_CELLS squares with none blocked; a level's counts its own playable squares.
    region: floodSolved(grid) ? (grid.length === FLOOD_CELLS ? FLOOD_CELLS : floodPlayable(grid)) : regionSize(grid, size),
    outOfMoves: limit !== null && made >= limit && !floodSolved(grid),
  };
}
