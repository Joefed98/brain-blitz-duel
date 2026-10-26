/**
 * Server-only Tents and Trees generator. Pairs are laid at random, the line
 * counts derived, and the backtracking solver must find exactly one layout —
 * otherwise the board is re-rolled.
 */

import { pick, randInt, shuffled } from "./random";
import {
  countTentSolutions,
  lineCounts,
  orthNeighbours,
  tentsTouch,
  TENTS_DEPTH_HEIGHT,
  TENTS_SIZE,
} from "./tents";
import type { TentsPuzzleData } from "./types";

function tryLayout(pairs: number, height = TENTS_SIZE): { trees: number[]; tents: number[] } | null {
  const size = TENTS_SIZE;
  const trees: number[] = [];
  const tents: number[] = [];
  const cells = shuffled([...Array(size * height).keys()]);
  for (const tent of cells) {
    if (tents.length >= pairs) break;
    if (trees.includes(tent) || tents.includes(tent)) continue;
    if (tents.some((other) => tentsTouch(other, tent, size))) continue;
    // Keep pairings clear: the new tent must not sit beside an existing tree.
    if (orthNeighbours(tent, size, height).some((cell) => trees.includes(cell))) continue;
    const options = orthNeighbours(tent, size, height).filter(
      (cell) =>
        !trees.includes(cell) &&
        !tents.includes(cell) &&
        !orthNeighbours(cell, size, height).some((n) => n !== tent && tents.includes(n)),
    );
    if (!options.length) continue;
    tents.push(tent);
    trees.push(pick(options));
  }
  return tents.length === pairs ? { trees, tents } : null;
}

/**
 * The depth revision's larger field (depthRev 1, 25 Oct 2026): 8 wide and 9 tall, 12–13 pairs (one more than the
 * 8 × 8 board, so the round's clock still fits a good solve), a third of the 17 line counts hidden, kept only when the solver finds exactly one layout.
 */
export function generateTents(): TentsPuzzleData {
  return buildTents(TENTS_DEPTH_HEIGHT, 12, 13) ?? generateLegacyTents();
}

/** The 8 × 8 field rooms dealt before the depth revision (kept for the calibration and checks). */
export function generateLegacyTents(): TentsPuzzleData {
  const board = buildTents(TENTS_SIZE, 11, 12);
  if (!board) throw new Error("Tents generation failed");
  return board;
}

function buildTents(height: number, minPairs: number, maxPairs: number): TentsPuzzleData | null {
  const size = TENTS_SIZE;
  const tall = height !== size;
  const lineTotal = size + height;
  for (let attempt = 0; attempt < 30000; attempt++) {
    const pairs = randInt(minPairs, maxPairs);
    const layout = tryLayout(pairs, height);
    if (!layout) continue;
    const { rows, cols } = lineCounts(layout.tents, size, height);
    const rowCounts = [...rows];
    const colCounts = [...cols];
    const lines = shuffled([...Array(lineTotal).keys()]).slice(0, Math.round(tall ? lineTotal / 3 : (size * 2) / 3));
    for (const line of lines) {
      if (line < height) rowCounts[line] = -1;
      else colCounts[line - height] = -1;
    }
    const board = { size, ...(tall ? { height } : {}), trees: layout.trees, rowCounts, colCounts };
    if (countTentSolutions(board, 2) !== 1) continue;
    return {
      type: "tents",
      size,
      ...(tall ? { height } : {}),
      trees: [...layout.trees].sort((a, b) => a - b),
      rowCounts,
      colCounts,
      solution: [...layout.tents].sort((a, b) => a - b),
    };
  }
  return null;
}
