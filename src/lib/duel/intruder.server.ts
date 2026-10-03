/**
 * Server-only generation for Intruder Detection. Each board stores the changed
 * cell and the kind of change privately; the change is never a near-identical
 * colour, and no two consecutive boards change a cell in the same row and
 * column.
 */

import { pick, randomBelow } from "./random";
import { intruderColoursTooClose } from "./intruder";
import {
  INTRUDER_BOARD_SIZES,
  INTRUDER_BOARD_COLOUR_COUNTS,
  INTRUDER_BOARD_SHAPE_COUNTS,
  INTRUDER_CHANGE_COUNTS,
  INTRUDER_COLOURS,
  INTRUDER_SHAPES,
  type IntruderAnswer,
  type IntruderBoard,
  type IntruderCell,
  type IntruderChangeKind,
  type IntruderPuzzleData,
} from "./types";

function randomCell(
  colours: typeof INTRUDER_COLOURS,
  shapes: readonly IntruderCell["shape"][],
): IntruderCell {
  const shape = pick(shapes);
  return { shape, colour: pick(colours), rot: 0 };
}

/** The one changed cell, and which attribute moved. */
function changeCell(
  cell: IntruderCell,
  colours: typeof INTRUDER_COLOURS,
  shapes: readonly IntruderCell["shape"][],
): { cell: IntruderCell; kind: IntruderChangeKind } {
  const kind: IntruderChangeKind = randomBelow(2) === 0 ? "colour" : "shape";

  if (kind === "colour") {
    for (let guard = 0; guard < 40; guard++) {
      const colour = pick(colours);
      if (colour === cell.colour) continue;
      if (intruderColoursTooClose(colour, cell.colour)) continue;
      return { cell: { ...cell, colour }, kind };
    }
  }
  for (let guard = 0; guard < 40; guard++) {
    const shape = pick(shapes);
    if (shape !== cell.shape) return { cell: { ...cell, shape }, kind: "shape" };
  }
  return { cell: { ...cell, shape: cell.shape === "circle" ? "square" : "circle" }, kind: "shape" };
}

/** perm[i] = the original cell whose symbol now sits at cell i. */
function shiftPerm(size: number, dir: "left" | "right" | "up" | "down"): number[] {
  return Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size); const col = index % size;
    const [r, c] = dir === "left" ? [row, (col + 1) % size] : dir === "right" ? [row, (col + size - 1) % size] : dir === "up" ? [(row + 1) % size, col] : [(row + size - 1) % size, col];
    return r * size + c;
  });
}

export function generateIntruder(): IntruderPuzzleData {
  const boards: IntruderBoard[] = [];
  const answers: IntruderAnswer[] = [];
  let previous: { row: number; col: number } | null = null;

  for (const [boardIndex, size] of INTRUDER_BOARD_SIZES.entries()) {
    const colours = INTRUDER_COLOURS.slice(0, INTRUDER_BOARD_COLOUR_COUNTS[boardIndex]);
    const shapes = INTRUDER_SHAPES.slice(0, INTRUDER_BOARD_SHAPE_COUNTS[boardIndex]);
    const count = size * size;
    const cells = Array.from({ length: count }, () => randomCell(colours, shapes));
    const targets: number[] = [];

    // The changed cell never sits in the same row and column twice in a row.
    while (targets.length < INTRUDER_CHANGE_COUNTS[boardIndex]!) {
      const target = randomBelow(count); const row = Math.floor(target / size); const col = target % size;
      if (targets.includes(target) || (previous && previous.row === row && previous.col === col)) continue;
      targets.push(target);
    }
    const kinds: IntruderChangeKind[] = []; const changedAt = cells.slice();
    for (const target of targets) { const changed = changeCell(cells[target]!, colours, shapes); changedAt[target] = changed.cell; kinds.push(changed.kind); }
    // Boards 4–5 slide every symbol one cell (wrapping) inside the fixed grid.
    const perm = boardIndex >= 3 ? shiftPerm(size, pick(["left", "right", "up", "down"] as const)) : null;
    const after = perm ? perm.map((source) => changedAt[source]!) : changedAt;
    const shown = perm ? targets.map((target) => perm.indexOf(target)) : targets;
    boards.push({ size, cells, after, ...(perm ? { perm } : {}) }); answers.push({ cells: shown, kinds });
    const last = targets.at(-1)!; previous = { row: Math.floor(last / size), col: last % size };
  }

  return { type: "intruder", boards, answers };
}
