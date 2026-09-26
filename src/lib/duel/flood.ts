/**
 * Colour Flood rules. The region that belongs to the player is always the blob
 * connected to the top-left cell; tapping a colour repaints it. The server
 * replays the tapped colours through exactly this code.
 */

import { FLOOD_CELLS, FLOOD_COLOURS, FLOOD_SIZE } from "./types";

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
      row < size - 1 ? cell + size : -1,
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
export function floodApply(grid: number[], colour: number, size: number = FLOOD_SIZE): number[] {
  if (!Number.isInteger(colour) || colour < 0 || colour >= FLOOD_COLOURS) return grid;
  if (grid[0] === colour) return grid;
  const next = [...grid];
  for (const cell of regionCells(grid, size)) next[cell] = colour;
  return next;
}

export function floodSolved(grid: number[]): boolean {
  return grid.length > 0 && grid.every((colour) => colour === grid[0]);
}

export function encodeFloodMoves(moves: number[]): string {
  return moves.join(",");
}

export function decodeFloodMoves(raw: string): number[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isInteger(value) && value >= -1 && value < FLOOD_COLOURS);
}

export interface FloodReplay {
  grid: number[];
  solved: boolean;
  moves: number;
  region: number;
}

/** The one place a tap list is replayed — used for scoring and for Undo. */
export function replayFlood(
  start: number[],
  moves: number[],
  size: number = FLOOD_SIZE,
): FloodReplay {
  const history = [[...start]];
  let made = 0;
  for (const colour of moves) {
    if (colour === -1) { if (history.length > 1) history.pop(); continue; }
    const grid = history[history.length - 1]!;
    if (floodSolved(grid)) break;
    const next = floodApply(grid, colour, size);
    if (next === grid) continue;
    history.push(next);
    made += 1;
  }
  const grid = history[history.length - 1]!;
  return {
    grid,
    solved: floodSolved(grid),
    moves: made,
    region: floodSolved(grid) ? FLOOD_CELLS : regionSize(grid, size),
  };
}
