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
  generateBombPanel,
  inspectBombRules,
} from "../src/lib/duel/bomb.server";
import { checkBombPlan, decodeBombActions, decodeBombConstraints } from "../src/lib/duel/bomb";
import {
  BOMB_MAX_SEQUENCE,
  BOMB_MIN_SEQUENCE,
  BOMB_NECESSARY_RULES,
  BOMB_RULE_COUNT,
  BOMB_WIRES,
  SAFE_CLUE_COUNT,
  TUBES_COLOURS,
  TUBES_COUNT,
  TUBES_MAX_MIN_MOVES,
  TUBE_CAPACITY,
  TUBES_MIN_MIN_MOVES,
} from "../src/lib/duel/types";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const ROUNDS = 40;

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
      const room = TUBE_CAPACITY - destination.length;
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
console.log(
  `Safe Cracker: ${ROUNDS} cards of ${SAFE_CLUE_COUNT} clues, each unique with all ${SAFE_CLUE_COUNT} clues necessary`,
);

let bombAttempts = 0;
const BOMB_PANELS = 200;
for (let i = 0; i < BOMB_PANELS; i++) {
  const generated = generateBombPanel();
  const bomb = generated.puzzle;
  bombAttempts += generated.attempts;
  const inspected = inspectBombRules(bomb);
  assert(bomb.wires.length === BOMB_WIRES, "wrong wire count");
  assert(bomb.rules.length === BOMB_RULE_COUNT, "wrong rule count");
  assert(["LEFT", "MID", "RIGHT"].includes(bomb.switchPosition), "invalid switch position");
  assert(inspected.unknownRules === 0, "a rule could not be rebuilt from its template");
  assert(inspected.wordingOk, "a rule does not use its template's exact wording");
  assert(inspected.solutions === 1, `rules allow ${inspected.solutions} sequences, not one`);
  assert(inspected.unique, "the one satisfying sequence is not the stored plan");
  assert(inspected.necessary, "fewer than four rules were individually necessary");
  assert(inspected.pairsDistinct, "two rules concern the same action pair");
  assert(inspected.familiesOk, "more than two rules from one family");
  assert(
    inspected.necessaryRules >= BOMB_NECESSARY_RULES,
    `only ${inspected.necessaryRules} rules were necessary`,
  );
  assert(new Set(bomb.rules.map((rule) => rule.id)).size === bomb.rules.length, "a rule repeats");

  const required = decodeBombActions(bomb.required!);
  const constraints = decodeBombConstraints(bomb.constraints!);
  const stored = decodeBombActions(bomb.sequence!);
  assert(required.length === bomb.stepCount, "stepCount does not match the required actions");
  assert(new Set(required).size === required.length, "an action is required twice");
  assert(
    required.length >= BOMB_MIN_SEQUENCE && required.length <= BOMB_MAX_SEQUENCE,
    `required action count out of band: ${required.length}`,
  );
  assert(stored.join(",") === required.join(","), "the stored plan is not the required sequence");

  // Grading accepts the unique sequence and nothing else.
  assert(checkBombPlan(required, constraints, stored).defused, "stored plan did not defuse");
  for (const order of permutations(required)) {
    const accepted = checkBombPlan(required, constraints, order).defused;
    assert(accepted === (order.join(",") === stored.join(",")), "grading accepted another order");
  }
  const spare = stored.includes("bA") ? "bB" : "bA";
  assert(
    checkBombPlan(required, constraints, [spare, ...stored]).exploded,
    "an extra action did not explode",
  );
  assert(
    !checkBombPlan(required, constraints, stored.slice(0, -1)).defused,
    "a short plan counted as defused",
  );
}
assert(BOMB_RULE_TEMPLATE_COUNT === 40, "bomb rule bank is not the 40-template bank");
console.log(
  `Bomb Defusal: ${BOMB_PANELS} panels, each with exactly one satisfying four-action sequence; ` +
    `${(bombAttempts / BOMB_PANELS).toFixed(2)} panel attempts on average`,
);

/** Every order of the required actions — 4! = 24 of them. */
function permutations(actions: string[]): string[][] {
  if (actions.length <= 1) return [actions];
  const out: string[][] = [];
  actions.forEach((action, index) => {
    const rest = [...actions.slice(0, index), ...actions.slice(index + 1)];
    for (const tail of permutations(rest)) out.push([action, ...tail]);
  });
  return out;
}
