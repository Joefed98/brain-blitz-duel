/**
 * Proof run for Gravity Maze, Don't Break the Chain and Intruder Detection.
 * Run with: bun scripts/gravity-chain-intruder-check.ts
 */

import { generateGravity } from "../src/lib/duel/gravity.server";
import { decodeGravityTilts, replayGravity } from "../src/lib/duel/gravity";
import { generateChain } from "../src/lib/duel/chain.server";
import { chainLayoutIsFair } from "../src/lib/duel/chain.server";
import { chainRequired, chainValue, replayChain } from "../src/lib/duel/chain";
import { generateIntruder } from "../src/lib/duel/intruder.server";
import { intruderColoursTooClose } from "../src/lib/duel/intruder";
import {
  CHAIN_LENGTH,
  CHAIN_MIN_INVALID,
  CHAIN_MIN_VALID,
  CHAIN_NODES,
  GRAV_MAX_TILTS,
  GRAV_MIN_TILTS,
  INTRUDER_BOARD_SIZES,
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
  check("gravity minimum stored", (puzzle.minMoves ?? 0) >= GRAV_MIN_TILTS);
  check("gravity minimum in band", (puzzle.minMoves ?? 0) <= GRAV_MAX_TILTS);
  check("gravity solution solves the joint state", replay.solved);
  check("gravity solution length equals the minimum", replay.tilts === puzzle.minMoves);
  check("gravity shortest route uses ball-blocks-ball", replay.usedBlock);
}

for (let round = 0; round < ROUNDS; round++) {
  const puzzle = generateChain();
  check("chain node count", puzzle.nodes.length === CHAIN_NODES);
  check(
    "chain layout fair at every step",
    chainLayoutIsFair(puzzle.nodes, puzzle.kind, puzzle.cycle),
  );
  for (let step = 0; step < CHAIN_LENGTH; step++) {
    const needed = chainRequired(puzzle.cycle, step);
    const usedNeeded = Math.floor(step / 3);
    const valid =
      puzzle.nodes.filter((node) => chainValue(node, puzzle.kind) === needed).length - usedNeeded;
    check("chain two valid choices", valid >= CHAIN_MIN_VALID);
    check("chain four invalid nodes", puzzle.nodes.length - step - valid >= CHAIN_MIN_INVALID);
  }
  // A perfect run of twelve completes; a wrong tap never advances the chain.
  const perfect: number[] = [];
  for (let step = 0; step < CHAIN_LENGTH; step++) {
    const needed = chainRequired(puzzle.cycle, step);
    perfect.push(
      puzzle.nodes.findIndex(
        (node, index) =>
          !perfect.includes(index) && chainValue(node, puzzle.kind) === needed,
      ),
    );
  }
  const good = replayChain(puzzle.nodes, puzzle.kind, puzzle.cycle, perfect);
  check("chain perfect run completes", good.completed && good.errors === 0);
  const bad = replayChain(puzzle.nodes, puzzle.kind, puzzle.cycle, [
    puzzle.nodes.findIndex(
      (node) => chainValue(node, puzzle.kind) !== chainRequired(puzzle.cycle, 0),
    ),
  ]);
  check("chain wrong tap counts as an error", bad.errors === 1 && bad.chain.length === 0);
}

for (let round = 0; round < ROUNDS; round++) {
  const puzzle = generateIntruder();
  const answers = puzzle.answers ?? [];
  check("intruder three boards", puzzle.boards.length === 3);
  check("intruder three answers", answers.length === 3);
  let previous: { row: number; col: number } | null = null;
  puzzle.boards.forEach((board, index) => {
    const answer = answers[index]!;
    check("intruder size escalates", board.size === INTRUDER_BOARD_SIZES[index]);
    const differing = board.cells.filter((cell, i) => {
      const after = board.after[i]!;
      return cell.shape !== after.shape || cell.colour !== after.colour || cell.rot !== after.rot;
    });
    check("intruder exactly one cell changes", differing.length === 1);
    const before = board.cells[answer.cell]!;
    const after = board.after[answer.cell]!;
    check("intruder change kind stored", ["colour", "shape"].includes(answer.kind));
    if (answer.kind === "colour") {
      check("intruder colour change is a real change", before.colour !== after.colour);
      check(
        "intruder avoids close colour pairs",
        !intruderColoursTooClose(before.colour, after.colour),
      );
    }
    if (answer.kind === "shape") check("intruder shape change", before.shape !== after.shape);
    check("intruder does not rotate", before.rot === after.rot);
    const position = { row: Math.floor(answer.cell / board.size), col: answer.cell % board.size };
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
