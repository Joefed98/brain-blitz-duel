/**
 * In-code proof for Sort the Tubes, Safe Cracker and Bomb Defusal. Run with
 * `bun scripts/tubes-safe-bomb-check.ts`.
 */

import { generateTubes } from "../src/lib/duel/tubes.server";
import { decodeTubeMoves, replayTubes, tubeSorted, colourAlreadyHome } from "../src/lib/duel/tubes";
import { generateSafe } from "../src/lib/duel/safe.server";
import { safeSolutions } from "../src/lib/duel/safe";
import { generateBomb } from "../src/lib/duel/bomb.server";
import { decodeBombActions, replayBomb } from "../src/lib/duel/bomb";
import {
  BOMB_MAX_SEQUENCE,
  BOMB_MIN_SEQUENCE,
  SAFE_CLUE_COUNT,
  TUBES_MAX_MIN_MOVES,
  TUBES_MIN_MIN_MOVES,
} from "../src/lib/duel/types";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const ROUNDS = 40;

for (let i = 0; i < ROUNDS; i++) {
  const tubes = generateTubes();
  assert(!tubes.tubes.some(tubeSorted), "a tube started finished");
  assert(!colourAlreadyHome(tubes.tubes), "a colour started in one tube");
  assert(
    tubes.minMoves! >= TUBES_MIN_MIN_MOVES && tubes.minMoves! <= TUBES_MAX_MIN_MOVES,
    `minimum out of band: ${tubes.minMoves}`,
  );
  const solved = replayTubes(tubes.tubes, decodeTubeMoves(tubes.solution!));
  assert(solved.solved, "the stored solution did not solve the board");
  assert(solved.moves === tubes.minMoves, "the stored solution is not the minimum length");
}
console.log(`Sort the Tubes: ${ROUNDS} boards reverse-generated, BFS minimum stored and replayed`);

for (let i = 0; i < ROUNDS; i++) {
  const safe = generateSafe();
  assert(safe.clues.length === SAFE_CLUE_COUNT, "wrong clue count");
  assert(safeSolutions(safe.clues, 2).length === 1, "the clue card is not unique");
  for (let drop = 0; drop < safe.clues.length; drop++) {
    const without = safe.clues.filter((_, index) => index !== drop);
    assert(safeSolutions(without, 2).length > 1, `clue ${drop + 1} is unnecessary`);
  }
}
console.log(`Safe Cracker: ${ROUNDS} cards unique with all ${SAFE_CLUE_COUNT} clues necessary`);

for (let i = 0; i < ROUNDS; i++) {
  const bomb = generateBomb();
  const sequence = decodeBombActions(bomb.sequence!);
  assert(sequence.length === bomb.stepCount, "stepCount does not match the sequence");
  assert(
    sequence.length >= BOMB_MIN_SEQUENCE && sequence.length <= BOMB_MAX_SEQUENCE,
    `sequence length out of band: ${sequence.length}`,
  );
  const clean = replayBomb(sequence, sequence);
  assert(clean.defused && clean.strikes === 0, "the stored sequence does not defuse the bomb");
  const wrong = replayBomb(sequence, ["b" + (sequence[0] === "bA" ? "B" : "A"), ...sequence]);
  assert(wrong.strikes === 1, "a wrong action did not strike");
}
console.log(`Bomb Defusal: ${ROUNDS} panels with 2–4 step sequences and working strikes`);
