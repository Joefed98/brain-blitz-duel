import { gameDisplayName } from "./gameNames";
/**
 * Server-only Block Party layout building. A layout is only used once a solver
 * has proved it fits and counted how many ways it can be done.
 */

import { BLOCK_ORIENTATIONS, BLOCK_PIECES, absoluteCells } from "./blockParty";
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

/** Picks pegs at random until a layout lands in the fair difficulty band. */
export function generateBlockParty(): BlockPartyPuzzleData {
  for (let attempt = 0; attempt < 400; attempt++) {
    const blockers = shuffled(Array.from({ length: BLOCK_CELLS }, (_, i) => i))
      .slice(0, BLOCK_BLOCKERS)
      .sort((a, b) => a - b);
    const { count, first } = solveBlockParty(blockers);
    if (!first) continue;
    if (count < 5 || count > 60) continue;
    return { type: "blockparty", blockers, solution: first, solutions: count };
  }

  // Safety net: keep looking for any solvable layout at all.
  for (let attempt = 0; attempt < 400; attempt++) {
    const blockers = shuffled(Array.from({ length: BLOCK_CELLS }, (_, i) => i))
      .slice(0, BLOCK_BLOCKERS)
      .sort((a, b) => a - b);
    const { count, first } = solveBlockParty(blockers, 1);
    if (first) return { type: "blockparty", blockers, solution: first, solutions: count };
  }

  throw new Error(`Could not build a ${gameDisplayName("blockparty")} layout of ${BLOCK_FREE_CELLS} cells.`);
}
