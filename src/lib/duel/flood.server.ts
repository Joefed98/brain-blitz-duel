/**
 * Server-only generation for Colour Flood. Boards are painted in blobs (so par
 * lands in a fair band), then the exact minimum number of taps is found with an
 * IDA* search over region states. Par is public — the player sees it — while one
 * route that hits par is stored privately.
 */

import { floodApply, floodSolved, regionCells } from "./flood";
import { randomBelow, shuffled } from "./random";
import bankData from "./floodBank.server.json";
import {
  FLOOD_CELLS,
  FLOOD_COLOURS,
  FLOOD_MAX_PAR,
  FLOOD_MIN_PAR,
  FLOOD_SEARCH_CAP,
  FLOOD_SIZE,
  type FloodPuzzleData,
} from "./types";

/** Colours the region actually touches — every other tap is a wasted move. */
function usefulColours(grid: number[]): number[] {
  const region = new Set(regionCells(grid));
  const mine = grid[0];
  const out = new Set<number>();
  for (const cell of region) {
    const row = Math.floor(cell / FLOOD_SIZE);
    const col = cell % FLOOD_SIZE;
    const neighbours = [
      col > 0 ? cell - 1 : -1,
      col < FLOOD_SIZE - 1 ? cell + 1 : -1,
      row > 0 ? cell - FLOOD_SIZE : -1,
      row < FLOOD_SIZE - 1 ? cell + FLOOD_SIZE : -1,
    ];
    for (const next of neighbours) {
      if (next < 0 || region.has(next)) continue;
      const colour = grid[next];
      if (colour === undefined) continue;
      if (colour !== mine) out.add(colour);
    }
  }
  return [...out];
}

/** Admissible lower bound: every colour still outside the region needs a tap. */
function remainingColours(grid: number[]): number {
  const region = new Set(regionCells(grid));
  const left = new Set<number>();
  for (let cell = 0; cell < grid.length; cell++) {
    if (region.has(cell)) continue;
    const colour = grid[cell];
    if (colour !== undefined) left.add(colour);
  }
  const mine = grid[0];
  if (mine !== undefined) left.delete(mine);
  return left.size;
}

/**
 * The exact minimum number of taps, with one route that achieves it. Returns
 * null when the search runs past its node cap or the depth limit.
 */
export function floodMinMoves(
  grid: number[],
  maxDepth: number = FLOOD_MAX_PAR,
  cap: number = FLOOD_SEARCH_CAP,
): { par: number; solution: number[] } | null {
  let nodes = 0;
  let overflow = false;

  const walk = (state: number[], depth: number, limit: number, path: number[]): number[] | null => {
    if (floodSolved(state)) return path;
    if (depth + remainingColours(state) > limit) return null;
    nodes += 1;
    if (nodes > cap) {
      overflow = true;
      return null;
    }
    for (const colour of usefulColours(state)) {
      const found = walk(floodApply(state, colour), depth + 1, limit, [...path, colour]);
      if (found) return found;
      if (overflow) return null;
    }
    return null;
  };

  for (let limit = remainingColours(grid); limit <= maxDepth; limit++) {
    const found = walk(grid, 0, limit, []);
    if (found) return { par: found.length, solution: found };
    if (overflow) return null;
  }
  return null;
}

/** A blobby board: random seeds, then two smoothing passes. */
function randomGrid(): number[] {
  const grid = Array.from({ length: FLOOD_CELLS }, () => randomBelow(FLOOD_COLOURS));
  for (let pass = 0; pass < 2; pass++) {
    for (const cell of shuffled(Array.from({ length: FLOOD_CELLS }, (_, index) => index))) {
      if (randomBelow(100) >= 45) continue;
      const row = Math.floor(cell / FLOOD_SIZE);
      const col = cell % FLOOD_SIZE;
      const neighbours = [
        col > 0 ? cell - 1 : -1,
        col < FLOOD_SIZE - 1 ? cell + 1 : -1,
        row > 0 ? cell - FLOOD_SIZE : -1,
        row < FLOOD_SIZE - 1 ? cell + FLOOD_SIZE : -1,
      ].filter((index) => index >= 0);
      const from = neighbours[randomBelow(neighbours.length)];
      if (from === undefined) continue;
      const colour = grid[from];
      if (colour !== undefined) grid[cell] = colour;
    }
  }
  // Every colour must appear, or par could never reach the wanted band.
  for (let colour = 0; colour < FLOOD_COLOURS; colour++) {
    if (!grid.includes(colour)) grid[randomBelow(FLOOD_CELLS)] = colour;
  }
  return grid;
}

export const FLOOD_BANK_SIZE = 400;
export const FLOOD_BANK = bankData as FloodPuzzleData[];

/** Offline builder: retry until an exact minimum in the strict band is proven. */
export function generateProvenFlood(): FloodPuzzleData {
  while (true) {
    const grid = randomGrid();
    const solved = floodMinMoves(grid, FLOOD_MAX_PAR);
    if (solved && solved.par >= FLOOD_MIN_PAR && solved.par <= FLOOD_MAX_PAR) {
      return { type: "flood", grid, par: solved.par, solution: solved.solution };
    }
  }
}

/** Rooms and practice draw only from the complete private proven bank. */
export function generateFlood(): FloodPuzzleData {
  if (FLOOD_BANK.length !== FLOOD_BANK_SIZE) throw new Error("Colour Flood bank is incomplete");
  const puzzle = FLOOD_BANK[randomBelow(FLOOD_BANK.length)];
  if (!puzzle) throw new Error("Colour Flood board is missing");
  return { ...puzzle, grid: [...puzzle.grid], solution: [...(puzzle.solution ?? [])] };
}
