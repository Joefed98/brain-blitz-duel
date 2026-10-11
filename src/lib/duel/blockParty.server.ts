import { gameDisplayName } from "./gameNames";
/**
 * Server-only Block Party layout building. A layout is only used once a solver
 * has proved it fits and counted how many ways it can be done.
 */

import { BLOCK_ORIENTATIONS, BLOCK_PIECES, absoluteCells, verifyPlacements } from "./blockParty";
import { shuffled } from "./random";
import {
  BLOCK_BLOCKERS,
  BLOCK_CELLS,
  BLOCK_COLS as N,
  BLOCK_FREE_CELLS,
  type BlockPartyPuzzleData,
  type BlockPlacement,
} from "./types";

/** Every way a piece can sit so that it covers a given cell. */
function optionsCovering(piece: number, cell: number): number[][] {
  const out: number[][] = [];
  const row = Math.floor(cell / N);
  const col = cell % N;
  for (const offsets of BLOCK_ORIENTATIONS[piece]!) {
    for (const [dr, dc] of offsets) {
      const cells = absoluteCells(offsets, row - dr, col - dc);
      if (cells && cells.includes(cell)) out.push(cells);
    }
  }
  return out;
}

interface SolveResult {
  count: number;
  first: BlockPlacement[] | null;
}

/** Counts solutions up to `cap`, keeping the first one found. */
export function solveBlockParty(blockers: number[], cap = 200, budget = 400_000): SolveResult {
  const taken = new Array<boolean>(BLOCK_CELLS).fill(false);
  for (const cell of blockers) taken[cell] = true;
  const used = new Array<boolean>(BLOCK_PIECES.length).fill(false);
  const stack: BlockPlacement[] = [];
  let count = 0;
  let first: BlockPlacement[] | null = null;
  let steps = 0;

  const nextFree = () => taken.findIndex((value) => !value);

  const recurse = (): void => {
    if (count >= cap || steps > budget) return;
    steps += 1;
    const cell = nextFree();
    if (cell === -1) {
      count += 1;
      if (!first) first = stack.map((p) => ({ piece: p.piece, cells: [...p.cells] }));
      return;
    }
    for (let piece = 0; piece < BLOCK_PIECES.length; piece++) {
      if (used[piece]) continue;
      for (const cells of optionsCovering(piece, cell)) {
        if (cells.some((c) => taken[c])) continue;
        for (const c of cells) taken[c] = true;
        used[piece] = true;
        stack.push({ piece, cells });
        recurse();
        stack.pop();
        used[piece] = false;
        for (const c of cells) taken[c] = false;
        if (count >= cap || steps > budget) return;
      }
    }
  };

  recurse();
  return { count, first };
}

/** The fair difficulty band: how many ways the layout can be done. */
export const BLOCK_MIN_SOLUTIONS = 5;
export const BLOCK_MAX_SOLUTIONS = 60;
/** The live generator's own attempt cap for in-band layouts. */
export const BLOCK_MAX_ATTEMPTS = 400;

/**
 * Picks pegs at random until a layout lands in the fair difficulty band.
 * `inBandOnly` (used by the bank build) skips the out-of-band safety net and
 * throws instead.
 */
export function generateBlockParty(
  maxAttempts = BLOCK_MAX_ATTEMPTS,
  inBandOnly = false,
): BlockPartyPuzzleData {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const blockers = shuffled(Array.from({ length: BLOCK_CELLS }, (_, i) => i))
      .slice(0, BLOCK_BLOCKERS)
      .sort((a, b) => a - b);
    const { count, first } = solveBlockParty(blockers);
    if (!first) continue;
    if (count < BLOCK_MIN_SOLUTIONS || count > BLOCK_MAX_SOLUTIONS) continue;
    return { type: "blockparty", blockers, solution: first, solutions: count };
  }

  if (inBandOnly) throw new Error(`No in-band ${gameDisplayName("blockparty")} layout in ${maxAttempts} attempts.`);
  // Safety net: keep looking for any solvable layout at all.
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const blockers = shuffled(Array.from({ length: BLOCK_CELLS }, (_, i) => i))
      .slice(0, BLOCK_BLOCKERS)
      .sort((a, b) => a - b);
    const { count, first } = solveBlockParty(blockers, 1);
    if (first) return { type: "blockparty", blockers, solution: first, solutions: count };
  }

  throw new Error(`Could not build a ${gameDisplayName("blockparty")} layout of ${BLOCK_FREE_CELLS} cells.`);
}

/**
 * Re-checks a stored layout as `generateBlockParty` accepts one: seven distinct
 * sorted pegs, a legal full solution, and a solver count inside the band that
 * matches the stored count, with the stored solution the solver's first.
 */
export function verifyBlockPartyPuzzle(puzzle: BlockPartyPuzzleData): string | null {
  const { blockers } = puzzle;
  if (puzzle.type !== "blockparty") return "wrong type";
  if (blockers.length !== BLOCK_BLOCKERS) return "peg count";
  if (blockers.some((c, i) => !Number.isInteger(c) || c < 0 || c >= BLOCK_CELLS || (i > 0 && c <= blockers[i - 1]!)))
    return "pegs not distinct and sorted";
  if (!puzzle.solution || !verifyPlacements(blockers, puzzle.solution).solved) return "solution does not solve";
  const { count, first } = solveBlockParty(blockers);
  if (count < BLOCK_MIN_SOLUTIONS || count > BLOCK_MAX_SOLUTIONS) return "solution count outside the band";
  if (count !== puzzle.solutions) return "stored solution count";
  if (JSON.stringify(first) !== JSON.stringify(puzzle.solution)) return "stored solution is not the solver's first";
  return null;
}
