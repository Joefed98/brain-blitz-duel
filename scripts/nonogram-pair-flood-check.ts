/**
 * Proof run for Nonogram, Pair Match and Colour Flood.
 * Run with: bun scripts/nonogram-pair-flood-check.ts
 */

import {
  NONO_PICTOGRAMS,
  generateNonogram,
  nonoUsablePictograms,
} from "../src/lib/duel/nonogram.server";
import {
  cluesFor,
  countNonoSolutions,
  replayNonogram,
  encodeNonoCells,
} from "../src/lib/duel/nonogram";
import { generatePairMatch, pairCombinations } from "../src/lib/duel/pairmatch.server";
import { replayPairs } from "../src/lib/duel/pairmatch";
import { floodMinMoves, generateFlood } from "../src/lib/duel/flood.server";
import { floodSolved, replayFlood } from "../src/lib/duel/flood";
import {
  FLOOD_FALLBACK_PAR,
  FLOOD_MIN_PAR,
  NONO_MAX_FILLED,
  NONO_MIN_FILLED,
  NONO_SIZE,
  PAIR_CARDS,
  PAIR_PAIRS,
} from "../src/lib/duel/types";

const ROUNDS = 40;
let failures = 0;

function check(label: string, ok: boolean) {
  if (!ok) {
    failures++;
    console.log(`FAIL ${label}`);
  }
}

check("nonogram bank has forty pictograms", NONO_PICTOGRAMS.length >= 40);
check("nonogram bank has usable pictograms", nonoUsablePictograms().length >= 10);

for (let round = 0; round < ROUNDS; round++) {
  const puzzle = generateNonogram();
  const pattern = puzzle.pattern ?? [];
  const filled = pattern.filter(Boolean).length;
  const clues = cluesFor(pattern);
  check("nonogram picture is stored", pattern.length === NONO_SIZE * NONO_SIZE);
  check("nonogram filled count in band", filled >= NONO_MIN_FILLED && filled <= NONO_MAX_FILLED);
  check("nonogram every row is used", clues.rows.every((clue) => clue.length > 0));
  check("nonogram every column is used", clues.cols.every((clue) => clue.length > 0));
  check(
    "nonogram clues describe the picture",
    JSON.stringify(clues) === JSON.stringify({ rows: puzzle.rows, cols: puzzle.cols }),
  );
  check(
    "nonogram clues have a unique solution",
    countNonoSolutions(puzzle.rows, puzzle.cols, 2) === 1,
  );
  const marks = pattern.map((cell) => (cell ? 1 : 0)) as (0 | 1 | 2)[];
  const replay = replayNonogram(
    pattern,
    encodeNonoCells(marks).split(",").filter(Boolean).map(Number),
  );
  check("nonogram picture replays as solved", replay.solved && replay.wrong === 0);
}

for (let round = 0; round < ROUNDS; round++) {
  const puzzle = generatePairMatch();
  check("pair board has sixteen cards", puzzle.cards.length === PAIR_CARDS);
  const keys = puzzle.cards.map((card) => `${card.shape}:${card.colour}`);
  const unique = new Set(keys);
  check("pair board has eight distinct pairs", unique.size === PAIR_PAIRS);
  check(
    "each pair appears exactly twice",
    [...unique].every((key) => keys.filter((other) => other === key).length === 2),
  );

  // A perfect game: turn over each pair back to back, sixteen flips in eight tries.
  const order: number[] = [];
  for (const key of unique) {
    const [a, b] = keys.map((other, index) => (other === key ? index : -1)).filter((i) => i >= 0);
    order.push(a!, b!);
  }
  const replay = replayPairs(puzzle.cards, order);
  check("pair perfect game replays as solved", replay.solved && replay.pairs === PAIR_PAIRS);
  check("pair perfect game counts eight tries", replay.tries === PAIR_PAIRS);
  check(
    "pair partial game counts one pair",
    replayPairs(puzzle.cards, order.slice(0, 2)).pairs === 1,
  );
}

check(
  "pair combinations are all distinct",
  new Set(pairCombinations().map((card) => `${card.shape}:${card.colour}`)).size ===
    pairCombinations().length,
);

for (let round = 0; round < 12; round++) {
  const puzzle = generateFlood();
  const solution = puzzle.solution ?? [];
  const replay = replayFlood(puzzle.grid, solution);
  check("flood par is stored", puzzle.par >= FLOOD_MIN_PAR && puzzle.par <= FLOOD_FALLBACK_PAR);
  check("flood stored route floods the board", replay.solved && floodSolved(replay.grid));
  check("flood stored route is exactly par long", replay.moves === puzzle.par);
  check(
    "flood par is the proven minimum",
    (floodMinMoves(puzzle.grid, puzzle.par)?.par ?? 0) === puzzle.par,
  );
  check(
    "flood no shorter route exists",
    puzzle.par <= FLOOD_MIN_PAR || floodMinMoves(puzzle.grid, puzzle.par - 1) === null,
  );
  const partial = replayFlood(puzzle.grid, solution.slice(0, 2));
  check("flood partial play grows the region", !partial.solved && partial.region > 1);
}

console.log(failures === 0 ? "All checks passed" : `${failures} checks failed`);
if (failures > 0) process.exit(1);
