/**
 * Server-only generation for Colour Flood. Boards are painted in blobs (so par
 * lands in a fair band), then the exact minimum number of taps is found with an
 * IDA* search over region states. Par is public — the player sees it — while one
 * route that hits par is stored privately.
 */

import { floodApply, floodSolved, regionCells } from "./flood";
import { randomBelow, shuffled } from "./random";
import bankData from "./floodBank.server.json";
import bankDataV3 from "./floodBankV3.server.json";
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
/** The floodRev 1 / 2 pool (14 Oct 2026). Stored rounds keep their own boards; nothing deals from it now. */
export const FLOOD_BANK = bankData as FloodPuzzleData[];
/**
 * The floodRev 3 pool (19 Oct 2026): 400 proven boards on which no blind colour cycle finishes
 * within the move limit (par + FLOOD_REV2_SPARE_MOVES, unchanged). Built by
 * `bun scripts/flood-bank.ts --rev3`; proved by scripts/flood-cycle-check.ts.
 */
export const FLOOD_BANK_V3 = bankDataV3 as FloodPuzzleData[];

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

/* --------------------------- Blind colour cycling --------------------------- */

/**
 * Every blind cycling order: each sequence of 2 to 5 distinct colours, tapped round and round
 * from any starting colour (a rotation is its own order). 320 orders.
 */
export const FLOOD_CYCLE_ORDERS: readonly (readonly number[])[] = (() => {
  const out: number[][] = [];
  const walk = (prefix: number[]) => {
    if (prefix.length >= 2) out.push(prefix);
    if (prefix.length === FLOOD_COLOURS) return;
    for (let c = 0; c < FLOOD_COLOURS; c++) if (!prefix.includes(c)) walk([...prefix, c]);
  };
  walk([]);
  return out;
})();

/**
 * Taps a blind cycle needs to flood `grid` (the phone's rules: a tap on the current colour is
 * ignored and costs nothing), or null when it has not flooded after `limit` taps. A typed-array
 * twin of replayFlood for speed; scripts/flood-cycle-check.ts proves they agree.
 */
export function floodCycleTaps(grid: readonly number[], order: readonly number[], limit: number): number | null {
  const n = grid.length;
  const inRegion = new Uint8Array(n);
  const cells = new Int32Array(n);
  let count = 0;
  const grow = (colour: number) => {
    // Every cell touching the region in `colour` joins, and spreads through that colour.
    let read = 0;
    while (read < count) {
      const cell = cells[read++]!;
      const row = (cell / FLOOD_SIZE) | 0;
      const col = cell - row * FLOOD_SIZE;
      if (col > 0) add(cell - 1, colour);
      if (col < FLOOD_SIZE - 1) add(cell + 1, colour);
      if (row > 0) add(cell - FLOOD_SIZE, colour);
      if (row < FLOOD_SIZE - 1) add(cell + FLOOD_SIZE, colour);
    }
  };
  const add = (cell: number, colour: number) => {
    if (inRegion[cell] || grid[cell] !== colour) return;
    inRegion[cell] = 1;
    cells[count++] = cell;
  };
  let current = grid[0]!;
  inRegion[0] = 1;
  cells[count++] = 0;
  grow(current);
  if (count === n) return 0;
  let made = 0;
  for (let i = 0; made < limit; i++) {
    const colour = order[i % order.length]!;
    if (colour === current) continue;
    current = colour;
    made += 1;
    grow(colour);
    if (count === n) return made;
  }
  return null;
}

/** The first cycling order that floods `grid` within `limit` taps, or null when none does. */
export function floodCycleFinisher(grid: readonly number[], limit: number): readonly number[] | null {
  for (const order of FLOOD_CYCLE_ORDERS) if (floodCycleTaps(grid, order, limit) !== null) return order;
  return null;
}

/** Fewest taps any cycling order needs within `limit`, or null when none floods the board. */
export function floodCycleBest(grid: readonly number[], limit: number): number | null {
  let best: number | null = null;
  for (const order of FLOOD_CYCLE_ORDERS) {
    const taps = floodCycleTaps(grid, order, best === null ? limit : best - 1);
    if (taps !== null) best = taps;
  }
  return best;
}

/**
 * Offline builder, floodRev 3: one candidate board (one random grid), kept only when its exact
 * minimum is in the band and no cycling order floods it within par + `spare` taps. Cheap rejects
 * first: a cycle that floods within FLOOD_MIN_PAR + spare taps beats every possible limit.
 */
export function floodRev3Candidate(spare: number): FloodPuzzleData | null {
  const grid = randomGrid();
  const cycle = floodCycleBest(grid, FLOOD_MAX_PAR + spare);
  if (cycle !== null && cycle <= FLOOD_MIN_PAR + spare) return null;
  const solved = floodMinMoves(grid, FLOOD_MAX_PAR);
  if (!solved || solved.par < FLOOD_MIN_PAR || solved.par > FLOOD_MAX_PAR) return null;
  if (cycle !== null && cycle <= solved.par + spare) return null;
  return { type: "flood", grid, par: solved.par, solution: solved.solution };
}

/**
 * Rooms and practice draw only from the complete private proven bank: the floodRev 3 bank, which
 * stampMoveLimits (moveLimits.server.ts) stamps floodRev 3 with its par + 2 limit.
 */
export function generateFlood(): FloodPuzzleData {
  if (FLOOD_BANK_V3.length !== FLOOD_BANK_SIZE) throw new Error("Colour Flood bank is incomplete");
  const puzzle = FLOOD_BANK_V3[randomBelow(FLOOD_BANK_V3.length)];
  if (!puzzle) throw new Error("Colour Flood board is missing");
  return { ...puzzle, grid: [...puzzle.grid], solution: [...(puzzle.solution ?? [])] };
}
