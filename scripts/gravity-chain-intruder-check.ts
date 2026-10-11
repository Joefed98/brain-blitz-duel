/**
 * Proof run for Gravity Maze and Intruder Detection.
 * Run with: bun scripts/gravity-chain-intruder-check.ts
 */

import { generateGravity, lockInteractions } from "../src/lib/duel/gravity.server";
import { decodeGravityTilts, replayGravity, tilt, GRAVITY_DIRS } from "../src/lib/duel/gravity";
import { generateIntruder } from "../src/lib/duel/intruder.server";
import { intruderColoursTooClose } from "../src/lib/duel/intruder";
import {
  GRAV_BALLS,
  GRAV_MIN_TILTS,
  GRAV_MAX_TILTS,
  INTRUDER_BOARD_SIZES,
  INTRUDER_CHANGE_COUNTS,
  INTRUDER_BOARD_COLOUR_COUNTS,
  INTRUDER_BOARD_SHAPE_COUNTS,
} from "../src/lib/duel/types";

const ROUNDS = 40;
let failures = 0;

function check(label: string, ok: boolean) {
  if (!ok) {
    failures++;
    console.log(`FAIL ${label}`);
  }
}

for (let round = 0; round < ROUNDS; round++) {
  const puzzle = generateGravity();
  const solution = decodeGravityTilts(puzzle.solution ?? "");
  const walls = new Set(puzzle.walls);
  const replay = replayGravity(walls, puzzle.starts, puzzle.targets, solution);
  check("gravity ball count", puzzle.starts.length === GRAV_BALLS && puzzle.targets.length === GRAV_BALLS);
  check("gravity minimum stored", (puzzle.minMoves ?? 0) >= GRAV_MIN_TILTS);
  check("gravity minimum in band", (puzzle.minMoves ?? 0) <= GRAV_MAX_TILTS);
  check("gravity solution solves the board", replay.solved);
  check("gravity solution length equals the minimum", replay.tilts === puzzle.minMoves);
  check(
    "gravity no ball locks on the first tilt",
    GRAVITY_DIRS.every((dir) => tilt(walls, puzzle.starts, puzzle.targets, dir).locked.length === 0),
  );
  check("gravity shortest route has lock interactions", lockInteractions(walls, puzzle.starts, puzzle.targets, solution) >= 2);
}

for (let round = 0; round < ROUNDS; round++) {
  const puzzle = generateIntruder();
  const answers = puzzle.answers ?? [];
  check("intruder five boards", puzzle.boards.length === 5);
  check("intruder five answers", answers.length === 5);
  let previous: { row: number; col: number } | null = null;
  puzzle.boards.forEach((board, index) => {
    const answer = answers[index]!;
    check("intruder board is 3x3", board.size === 3 && board.size === INTRUDER_BOARD_SIZES[index]);
    check(
      "intruder colour palette escalates",
      new Set(board.cells.map((cell) => cell.colour)).size <= INTRUDER_BOARD_COLOUR_COUNTS[index]!,
    );
    check(
      "intruder shape palette escalates",
      new Set(board.cells.map((cell) => cell.shape)).size <= INTRUDER_BOARD_SHAPE_COUNTS[index]!,
    );
    const differing = board.after.filter((after, i) => {
      const cell = board.perm ? board.cells[board.perm[i]!]! : board.cells[i]!;
      return cell.shape !== after.shape || cell.colour !== after.colour || cell.rot !== after.rot;
    });
    check("intruder exact change count", differing.length === INTRUDER_CHANGE_COUNTS[index]);
    check("intruder target cells stored", answer.cells.length === INTRUDER_CHANGE_COUNTS[index]);
    check("intruder shuffle metadata", index >= 3 ? Boolean(board.perm) : !board.perm);
    answer.cells.forEach((cell, changedIndex) => {
      check("intruder target in range", cell >= 0 && cell < 9);
      const before = board.perm ? board.cells[board.perm[cell]!]! : board.cells[cell]!;
      const after = board.after[cell]!;
      const kind = answer.kinds[changedIndex]!;
      check("intruder change kind stored", ["colour", "shape"].includes(kind));
      if (kind === "colour") {
        check("intruder colour change is a real change", before.colour !== after.colour);
        check("intruder avoids close colour pairs", !intruderColoursTooClose(before.colour, after.colour));
      }
      if (kind === "shape") check("intruder shape change", before.shape !== after.shape);
      check("intruder does not rotate", before.rot === after.rot);
    });
    // The generator applies this rule before boards 4-5 slide the grid, so
    // compare the source cells (perm maps a shown cell back to its source).
    const sources = answer.cells.map((cell) => (board.perm ? board.perm[cell]! : cell));
    if (previous) {
      const prev = previous;
      check(
        "intruder never the same position twice in a row",
        sources.every((cell) => Math.floor(cell / board.size) !== prev.row || cell % board.size !== prev.col),
      );
    }
    const lastCell = sources.at(-1)!;
    const position = { row: Math.floor(lastCell / board.size), col: lastCell % board.size };
    previous = position;
  });
}

console.log(failures === 0 ? `All checks passed (${ROUNDS} rounds each)` : `${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
