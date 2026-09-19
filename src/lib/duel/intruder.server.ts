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
  INTRUDER_COLOURS,
  INTRUDER_SHAPES,
  type IntruderAnswer,
  type IntruderBoard,
  type IntruderCell,
  type IntruderChangeKind,
  type IntruderPuzzleData,
} from "./types";

function randomCell(): IntruderCell {
  const shape = pick(INTRUDER_SHAPES);
  return { shape, colour: pick(INTRUDER_COLOURS), rot: 0 };
}

/** The one changed cell, and which attribute moved. */
function changeCell(cell: IntruderCell): { cell: IntruderCell; kind: IntruderChangeKind } {
  const canRotate = cell.shape === "triangle";
  const roll = randomBelow(canRotate ? 3 : 2);
  const kind: IntruderChangeKind = roll === 0 ? "colour" : roll === 1 ? "shape" : "rot";

  if (kind === "colour") {
    for (let guard = 0; guard < 40; guard++) {
      const colour = pick(INTRUDER_COLOURS);
      if (colour === cell.colour) continue;
      if (intruderColoursTooClose(colour, cell.colour)) continue;
      return { cell: { ...cell, colour }, kind };
    }
  }
  if (kind === "rot") {
    return { cell: { ...cell, rot: cell.rot === 0 ? 180 : 0 }, kind };
  }
  for (let guard = 0; guard < 40; guard++) {
    const shape = pick(INTRUDER_SHAPES);
    if (shape !== cell.shape) return { cell: { ...cell, shape }, kind: "shape" };
  }
  return { cell: { ...cell, shape: cell.shape === "circle" ? "square" : "circle" }, kind: "shape" };
}

export function generateIntruder(): IntruderPuzzleData {
  const boards: IntruderBoard[] = [];
  const answers: IntruderAnswer[] = [];
  let previous: { row: number; col: number } | null = null;

  for (const size of INTRUDER_BOARD_SIZES) {
    const count = size * size;
    let cells = Array.from({ length: count }, randomCell);
    let target = randomBelow(count);

    // The changed cell never sits in the same row and column twice in a row.
    for (let guard = 0; guard < 200; guard++) {
      const row = Math.floor(target / size);
      const col = target % size;
      if (!previous || previous.row !== row || previous.col !== col) break;
      target = randomBelow(count);
    }

    // A rotation change only reads as a change on a triangle.
    let changed = changeCell(cells[target]!);
    for (
      let guard = 0;
      guard < 10 && changed.kind === "rot" && cells[target]!.shape !== "triangle";
      guard++
    ) {
      changed = changeCell(cells[target]!);
    }
    if (changed.kind === "rot") {
      cells = cells.map((cell, index) =>
        index === target ? { ...cell, shape: "triangle" } : cell,
      );
      changed = {
        cell: { ...cells[target]!, rot: cells[target]!.rot === 0 ? 180 : 0 },
        kind: "rot",
      };
    }

    const after = cells.map((cell, index) => (index === target ? changed.cell : cell));
    boards.push({ size, cells, after });
    answers.push({ cell: target, kind: changed.kind });
    previous = { row: Math.floor(target / size), col: target % size };
  }

  return { type: "intruder", boards, answers };
}
