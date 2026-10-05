/**
 * Proof run for Gravity Maze and Intruder Detection.
 * Run with: bun scripts/gravity-chain-intruder-check.ts
 */

import { generateGravity } from "../src/lib/duel/gravity.server";
import { decodeGravityTilts, replayGravity } from "../src/lib/duel/gravity";
import { generateIntruder } from "../src/lib/duel/intruder.server";
import { intruderColoursTooClose } from "../src/lib/duel/intruder";
import {
  GRAV_FALLBACK_MIN_TILTS,
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
  const replay = replayGravity(
    puzzle.walls,
    { a: puzzle.startA, b: puzzle.startB },
    puzzle.targetA,
    puzzle.targetB,
    solution,
  );
  // The generator eases its minimum to GRAV_FALLBACK_MIN_TILTS after 200
  // failed attempts, so the wanted band is the wider one, not GRAV_MIN_TILTS.
  check("gravity minimum stored", (puzzle.minMoves ?? 0) >= GRAV_FALLBACK_MIN_TILTS);
  check("gravity minimum in band", (puzzle.minMoves ?? 0) <= GRAV_MAX_TILTS);
  check("gravity solution solves the joint state", replay.solved);
  check("gravity solution length equals the minimum", replay.tilts === puzzle.minMoves);
  check("gravity shortest route uses ball-blocks-ball", replay.usedBlock);
  check(
    "gravity shortest route swaps the balls' relative order",
    solutionSwapsOrder(new Set(puzzle.walls), { a: puzzle.startA, b: puzzle.startB }, solution),
  );
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
    const lastCell = answer.cells.at(-1)!;
    const position = { row: Math.floor(lastCell / board.size), col: lastCell % board.size };
    if (previous) {
      check(
        "intruder never the same position twice in a row",
        previous.row !== position.row || previous.col !== position.col,
      );
    }
    previous = position;
  });
}

console.log(failures === 0 ? `All checks passed (${ROUNDS} rounds each)` : `${failures} failures`);
process.exit(failures === 0 ? 0 : 1);

function centralNodes(nodes: { x: number; y: number }[]): number {
  return nodes.filter(
    (node) => node.x >= 100 / 3 && node.x <= 200 / 3 && node.y >= 100 / 3 && node.y <= 200 / 3,
  ).length;
}

function minimumSpacing(nodes: { x: number; y: number }[]): number {
  let smallest = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      smallest = Math.min(
        smallest,
        Math.hypot(nodes[i]!.x - nodes[j]!.x, nodes[i]!.y - nodes[j]!.y),
      );
    }
  }
  return smallest;
}
