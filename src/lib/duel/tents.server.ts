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
  TENTS_SIZE,
} from "./tents";
import type { TentsPuzzleData } from "./types";

function tryLayout(pairs: number): { trees: number[]; tents: number[] } | null {
  const size = TENTS_SIZE;
  const trees: number[] = [];
  const tents: number[] = [];
  const cells = shuffled([...Array(size * size).keys()]);
  for (const tent of cells) {
    if (tents.length >= pairs) break;
    if (trees.includes(tent) || tents.includes(tent)) continue;
    if (tents.some((other) => tentsTouch(other, tent, size))) continue;
    // Keep pairings clear: the new tent must not sit beside an existing tree.
    if (orthNeighbours(tent, size).some((cell) => trees.includes(cell))) continue;
    const options = orthNeighbours(tent, size).filter(
      (cell) =>
        !trees.includes(cell) &&
        !tents.includes(cell) &&
        !orthNeighbours(cell, size).some((n) => n !== tent && tents.includes(n)),
    );
    if (!options.length) continue;
    tents.push(tent);
    trees.push(pick(options));
  }
  return tents.length === pairs ? { trees, tents } : null;
}

export function generateTents(): TentsPuzzleData {
  const size = TENTS_SIZE;
  for (let attempt = 0; attempt < 30000; attempt++) {
    const pairs = randInt(11, 12);
    const layout = tryLayout(pairs);
    if (!layout) continue;
    const { rows, cols } = lineCounts(layout.tents, size);
    const rowCounts = [...rows];
    const colCounts = [...cols];
    const lines = shuffled([...Array(size * 2).keys()]).slice(0, Math.round((size * 2) / 3));
    for (const line of lines) {
      if (line < size) rowCounts[line] = -1;
      else colCounts[line - size] = -1;
    }
    const board = { size, trees: layout.trees, rowCounts, colCounts };
    if (countTentSolutions(board, 2) !== 1) continue;
    return {
      type: "tents",
      size,
      trees: [...layout.trees].sort((a, b) => a - b),
      rowCounts,
      colCounts,
      solution: [...layout.tents].sort((a, b) => a - b),
    };
  }
  throw new Error("Tents generation failed");
}
