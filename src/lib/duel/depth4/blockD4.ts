/**
 * Tessellate's 7×7 board (blockRev 1): the exact-cover solver and the generator, shared by the bank build
 * (scripts/depth4-block-bank.ts) and the depth check. Pure; randomness only through ../random.
 */
import { absoluteCells, BLOCK_D4_ORIENTATIONS, BLOCK_GEOMETRY_D4, verifyPlacements } from "../blockParty";
import { shuffled } from "../random";
import type { BlockPartyPuzzleData, BlockPlacement } from "../types";

const GEO = BLOCK_GEOMETRY_D4;
const N = GEO.cols;

/** Solution count band: the 6×6 board's 5–60 (sixteen pegs make the bigger board as constrained). */
export const BLOCK_D4_MIN_SOLUTIONS = 5;
export const BLOCK_D4_MAX_SOLUTIONS = 60;
export const BLOCK_D4_CAP = 61;
export const BLOCK_D4_BUDGET = 1_500_000;

const COVERING: number[][][][] = GEO.pieces.map((_, piece) =>
  Array.from({ length: GEO.cells }, (_c, cell) => {
    const out: number[][] = [];
    const row = Math.floor(cell / N);
    const col = cell % N;
    for (const offsets of BLOCK_D4_ORIENTATIONS[piece]!) {
      for (const [dr, dc] of offsets) {
        const cells = absoluteCells(offsets, row - dr, col - dc, N);
        if (cells && cells.includes(cell) && !out.some((o) => o.join() === cells.join())) out.push(cells);
      }
    }
    return out;
  }),
);

const SIZES = GEO.pieces.map((p) => p.cells.length);
const FULL = (1 << GEO.pieces.length) - 1;
/** fillable[unused mask × 35 + n]: some set of the unused pieces covers exactly n cells. */
const FILLABLE = (() => {
  const table = new Uint8Array((FULL + 1) * 35);
  for (let mask = 0; mask <= FULL; mask++) {
    table[mask * 35] = 1;
    for (let piece = 0; piece < SIZES.length; piece++) {
      if (!(mask & (1 << piece))) continue;
      const rest = mask & ~(1 << piece);
      for (let n = 0; n + SIZES[piece]! <= 33; n++) if (table[rest * 35 + n]) table[mask * 35 + n + SIZES[piece]!] = 1;
    }
  }
  return table;
})();

/** False when some empty region could not be covered exactly by any set of the unused pieces. */
function regionsFillable(taken: boolean[], unused: number, seen: Uint8Array, stack: number[]): boolean {
  seen.fill(0);
  for (let start = 0; start < GEO.cells; start++) {
    if (taken[start] || seen[start]) continue;
    let size = 0;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      size += 1;
      const r = Math.floor(c / N);
      const col = c % N;
      if (r > 0 && !taken[c - N] && !seen[c - N]) { seen[c - N] = 1; stack.push(c - N); }
      if (r < N - 1 && !taken[c + N] && !seen[c + N]) { seen[c + N] = 1; stack.push(c + N); }
      if (col > 0 && !taken[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; stack.push(c - 1); }
      if (col < N - 1 && !taken[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; stack.push(c + 1); }
    }
    if (size > 33 || !FILLABLE[unused * 35 + size]) return false;
  }
  return true;
}

export interface BlockD4Solve {
  count: number;
  first: BlockPlacement[] | null;
  /** True when the search ran out of budget (the count is then a lower bound). */
  exhausted: boolean;
}

/** Counts solutions up to `cap`, keeping the first one found (lowest free cell first, pieces in order). */
export function solveBlockD4(blockers: number[], cap = BLOCK_D4_CAP, budget = BLOCK_D4_BUDGET): BlockD4Solve {
  const taken = new Array<boolean>(GEO.cells).fill(false);
  for (const cell of blockers) taken[cell] = true;
  const used = new Array<boolean>(GEO.pieces.length).fill(false);
  const stack: BlockPlacement[] = [];
  let count = 0;
  let first: BlockPlacement[] | null = null;
  let steps = 0;
  const seen = new Uint8Array(GEO.cells);
  const scratch: number[] = [];
  const unusedMask = () => used.reduce((m, u, i) => (u ? m : m | (1 << i)), 0);
  if (!regionsFillable(taken, FULL, seen, scratch)) return { count: 0, first: null, exhausted: false };
  const recurse = (): void => {
    if (count >= cap || steps > budget) return;
    steps += 1;
    const cell = taken.indexOf(false);
    if (cell === -1) {
      count += 1;
      if (!first) first = stack.map((p) => ({ piece: p.piece, cells: [...p.cells] }));
      return;
    }
    for (let piece = 0; piece < GEO.pieces.length; piece++) {
      if (used[piece]) continue;
      for (const cells of COVERING[piece]![cell]!) {
        if (cells.some((c) => taken[c])) continue;
        for (const c of cells) taken[c] = true;
        used[piece] = true;
        stack.push({ piece, cells });
        if (regionsFillable(taken, unusedMask(), seen, scratch)) recurse();
        stack.pop();
        used[piece] = false;
        for (const c of cells) taken[c] = false;
        if (count >= cap || steps > budget) return;
      }
    }
  };
  recurse();
  return { count, first, exhausted: steps > budget };
}

/** One in-band 7×7 board, or null after `attempts`. */
export function generateBlockD4(attempts = 400): BlockPartyPuzzleData | null {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const blockers = shuffled(Array.from({ length: GEO.cells }, (_, i) => i))
      .slice(0, GEO.blockers)
      .sort((a, b) => a - b);
    const { count, first, exhausted } = solveBlockD4(blockers);
    if (!first || exhausted) continue;
    if (count < BLOCK_D4_MIN_SOLUTIONS || count > BLOCK_D4_MAX_SOLUTIONS) continue;
    return { type: "blockparty", blockers, solution: first, solutions: count, blockRev: 1 };
  }
  return null;
}

/** Null when a stored 7×7 board passes every rule the generator applies. */
export function verifyBlockD4(puzzle: BlockPartyPuzzleData): string | null {
  const { blockers } = puzzle;
  if (blockers.length !== GEO.blockers) return "peg count";
  if (blockers.some((c, i) => !Number.isInteger(c) || c < 0 || c >= GEO.cells || (i > 0 && c <= blockers[i - 1]!))) return "pegs not distinct and sorted";
  if (!puzzle.solution || !verifyPlacements(blockers, puzzle.solution, GEO).solved) return "solution does not solve";
  const { count, first, exhausted } = solveBlockD4(blockers);
  if (exhausted) return "solver budget";
  if (count < BLOCK_D4_MIN_SOLUTIONS || count > BLOCK_D4_MAX_SOLUTIONS) return "solution count outside the band";
  if (count !== puzzle.solutions) return "stored solution count";
  if (JSON.stringify(first) !== JSON.stringify(puzzle.solution)) return "stored solution is not the solver's first";
  return null;
}
