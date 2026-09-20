/**
 * Proof run for Gravity Maze, Don't Break the Chain and Intruder Detection.
 * Run with: bun scripts/gravity-chain-intruder-check.ts
 */

import { generateGravity } from "../src/lib/duel/gravity.server";
import { decodeGravityTilts, replayGravity } from "../src/lib/duel/gravity";
import { generateChain } from "../src/lib/duel/chain.server";
import {
  chainSolutionIsFair,
  chainTrapNodes,
  countChainSolutions,
} from "../src/lib/duel/chain.server";
import { chainRequired, chainWouldCross, replayChain } from "../src/lib/duel/chain";
import { generateIntruder } from "../src/lib/duel/intruder.server";
import { intruderColoursTooClose } from "../src/lib/duel/intruder";
import {
  CHAIN_LENGTH,
  CHAIN_MIN_INVALID,
  CHAIN_NODES,
  GRAV_MAX_TILTS,
  GRAV_MIN_TILTS,
  INTRUDER_BOARD_SIZES,
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
  check("gravity minimum stored", (puzzle.minMoves ?? 0) >= GRAV_MIN_TILTS);
  check("gravity minimum in band", (puzzle.minMoves ?? 0) <= GRAV_MAX_TILTS);
  check("gravity solution solves the joint state", replay.solved);
  check("gravity solution length equals the minimum", replay.tilts === puzzle.minMoves);
  check("gravity shortest route uses ball-blocks-ball", replay.usedBlock);
}

for (let round = 0; round < ROUNDS; round++) {
  const puzzle = generateChain();
  const solution = puzzle.solution ?? [];
  check("chain node count", puzzle.nodes.length === CHAIN_NODES);
  check(
    "chain stored solution count",
    puzzle.solutionCount === countChainSolutions(puzzle.nodes, puzzle.cycle),
  );
  check(
    "chain has 1–8 routes",
    (puzzle.solutionCount ?? 0) >= 1 && (puzzle.solutionCount ?? 0) <= 8,
  );
  check(
    "chain has two early dead-end traps",
    chainTrapNodes(puzzle.nodes, puzzle.cycle).length >= 2,
  );
  check("chain shape-only cycle", puzzle.cycle.length === 3);
  check(
    "chain searched solution stored",
    chainSolutionIsFair(puzzle.nodes, puzzle.cycle, solution),
  );
  const prefix: number[] = [];
  for (let step = 0; step < CHAIN_LENGTH; step++) {
    const needed = chainRequired(puzzle.cycle, step);
    const unused = puzzle.nodes
      .map((_node, index) => index)
      .filter((index) => !prefix.includes(index));
    check(
      "chain three shape-invalid nodes",
      unused.filter((index) => puzzle.nodes[index]?.shape !== needed).length >= CHAIN_MIN_INVALID,
    );
    if (step >= 3)
      check(
        "chain crossing decoy exists",
        unused.some(
          (index) =>
            puzzle.nodes[index]?.shape === needed && chainWouldCross(puzzle.nodes, prefix, index),
        ),
      );
    const next = solution[step];
    if (next !== undefined) prefix.push(next);
  }
  const good = replayChain(puzzle.nodes, puzzle.cycle, solution);
  check("chain perfect run completes", good.completed && good.errors === 0);
  const bad = replayChain(puzzle.nodes, puzzle.cycle, [
    puzzle.nodes.findIndex((node) => node.shape !== chainRequired(puzzle.cycle, 0)),
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
    check(
      "intruder colour palette escalates",
      new Set(board.cells.map((cell) => cell.colour)).size <= INTRUDER_BOARD_COLOUR_COUNTS[index]!,
    );
    check(
      "intruder shape palette escalates",
      new Set(board.cells.map((cell) => cell.shape)).size <= INTRUDER_BOARD_SHAPE_COUNTS[index]!,
    );
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
