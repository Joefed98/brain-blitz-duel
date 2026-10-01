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
    const kinds: IntruderChangeKind[] = []; const after = cells.slice();
    for (const target of targets) { const changed = changeCell(cells[target]!, colours, shapes); after[target] = changed.cell; kinds.push(changed.kind); }
    const offset = boardIndex >= 3 ? pick(["left", "right", "up", "down"] as const) : undefined;
    boards.push({ size, cells, after, ...(offset ? { offset } : {}) }); answers.push({ cells: targets, kinds });
    const last = targets.at(-1)!; previous = { row: Math.floor(last / size), col: last % size };
  }

  return { type: "intruder", boards, answers };
}
