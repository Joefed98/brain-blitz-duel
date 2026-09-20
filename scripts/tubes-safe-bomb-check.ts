/**
 * In-code proof for Sort the Tubes, Safe Cracker and Bomb Defusal. Run with
 * `bun scripts/tubes-safe-bomb-check.ts`.
 */

import { generateTubes } from "../src/lib/duel/tubes.server";
import {
  canPour,
  decodeTubeMoves,
  pourAmount,
  replayTubes,
  topGroup,
  tubeSorted,
  colourAlreadyHome,
} from "../src/lib/duel/tubes";
import { generateSafe } from "../src/lib/duel/safe.server";
import { safeSolutions } from "../src/lib/duel/safe";
import {
  BOMB_RULE_TEMPLATE_COUNT,
  generateBomb,
  inspectBombRules,
} from "../src/lib/duel/bomb.server";
import { decodeBombActions, replayBomb } from "../src/lib/duel/bomb";
import {
  BOMB_MAX_SEQUENCE,
  BOMB_MIN_EFFECTIVE_RULES,
  BOMB_MIN_SEQUENCE,
  BOMB_RULE_COUNT,
  BOMB_WIRES,
  SAFE_CLUE_COUNT,
  TUBES_COLOURS,
  TUBES_COUNT,
  TUBES_MAX_MIN_MOVES,
  TUBES_MIN_MIN_MOVES,
} from "../src/lib/duel/types";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const ROUNDS = 20;

let tubesTotalMs = 0;
for (let i = 0; i < ROUNDS; i++) {
  const startedAt = Date.now();
  const tubes = generateTubes();
  tubesTotalMs += Date.now() - startedAt;

  assert(tubes.tubes.length === TUBES_COUNT, `expected ${TUBES_COUNT} tubes`);
  assert(!tubes.tubes.some(tubeSorted), "a tube started finished");
  assert(!colourAlreadyHome(tubes.tubes), "a colour started in one tube");
  assert(
    tubes.minMoves! >= TUBES_MIN_MIN_MOVES && tubes.minMoves! <= TUBES_MAX_MIN_MOVES,
    `minimum out of band: ${tubes.minMoves}`,
  );

  // Partial pours: a tube's top group may spill onto a shorter free run in
  // the destination rather than being refused outright.
  outer: for (let from = 0; from < tubes.tubes.length; from++) {
    const group = topGroup(tubes.tubes[from]!);
    if (!group) continue;
    for (let to = 0; to < tubes.tubes.length; to++) {
      if (to === from) continue;
      const destination = tubes.tubes[to]!;
      const room = 4 - destination.length;
      const target = topGroup(destination);
      const shouldAllow = room > 0 && (!target || target.colour === group.colour);
      if (shouldAllow && group.count > room) {
        assert(canPour(tubes.tubes, from, to), "a partial pour was wrongly refused");
        assert(pourAmount(tubes.tubes, from, to) === room, "a partial pour moved the wrong count");
        break outer;
      }
    }
  }

  const solved = replayTubes(tubes.tubes, decodeTubeMoves(tubes.solution!));
  assert(solved.solved, "the stored solution did not solve the board");
  assert(solved.moves === tubes.minMoves, "the stored solution is not the minimum length");
}
console.log(
  `Sort the Tubes: ${ROUNDS} boards of ${TUBES_COUNT} tubes / ${TUBES_COLOURS} colours reverse-generated, ` +
    `BFS minimum (${TUBES_MIN_MIN_MOVES}–${TUBES_MAX_MIN_MOVES}) stored and replayed with partial pours, ` +
    `avg ${(tubesTotalMs / ROUNDS).toFixed(0)}ms/board (max ${tubesTotalMs === 0 ? 0 : Math.max(0, tubesTotalMs)}ms total)`,
);

for (let i = 0; i < ROUNDS; i++) {
  const safe = generateSafe();
  assert(safe.clues.length === SAFE_CLUE_COUNT, "wrong clue count");
  assert(safeSolutions(safe.clues, 2).length === 1, "the clue card is not unique");
  for (let drop = 0; drop < safe.clues.length; drop++) {
    const without = safe.clues.filter((_, index) => index !== drop);
    assert(safeSolutions(without, 2).length > 1, `clue ${drop + 1} is unnecessary`);
  }
}
console.log(`Safe Cracker: ${ROUNDS} cards of ${SAFE_CLUE_COUNT} clues, each unique with all ${SAFE_CLUE_COUNT} clues necessary`);

for (let i = 0; i < ROUNDS; i++) {
  const bomb = generateBomb();
  const inspected = inspectBombRules(bomb);
  assert(bomb.wires.length === BOMB_WIRES, "wrong wire count");
  assert(bomb.rules.length === BOMB_RULE_COUNT, "wrong rule count");
  assert(["LEFT", "MID", "RIGHT"].includes(bomb.switchPosition), "invalid switch position");
  assert(!inspected.contradictory, "generated rules contradict each other");
  assert(inspected.effective >= BOMB_MIN_EFFECTIVE_RULES, "too few effective rules");
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
assert(BOMB_RULE_TEMPLATE_COUNT >= 30, "bomb rule bank has fewer than 30 templates");
console.log(`Bomb Defusal: ${ROUNDS} panels with 3–6 steps, six rules and working strikes`);
