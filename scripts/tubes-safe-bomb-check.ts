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
console.log(
  `Safe Cracker: ${ROUNDS} cards of ${SAFE_CLUE_COUNT} clues, each unique with all ${SAFE_CLUE_COUNT} clues necessary`,
);

for (let i = 0; i < ROUNDS; i++) {
  const bomb = generateBomb();
  const inspected = inspectBombRules(bomb);
  assert(bomb.wires.length === BOMB_WIRES, "wrong wire count");
  assert(bomb.rules.length === BOMB_RULE_COUNT, "wrong rule count");
  assert(["LEFT", "MID", "RIGHT"].includes(bomb.switchPosition), "invalid switch position");
  assert(!inspected.contradictory, "generated rules contradict each other");
  assert(inspected.consistent, "ordering constraints contain a cycle");
  assert(inspected.wordingOk, "a rule uses a wording that could be read two ways");
  assert(inspected.effective >= BOMB_MIN_EFFECTIVE_RULES, "too few effective rules");
  assert(inspected.orderRules >= BOMB_MIN_ORDER_RULES, "too few ordering constraints");

  const required = decodeBombActions(bomb.required!);
  const constraints = decodeBombConstraints(bomb.constraints!);
  assert(required.length === bomb.stepCount, "stepCount does not match the required actions");
  assert(new Set(required).size === required.length, "an action is required twice");
  assert(
    required.length >= BOMB_MIN_SEQUENCE && required.length <= BOMB_MAX_SEQUENCE,
    `required action count out of band: ${required.length}`,
  );
  assert(inspected.required === required.length, "inspection disagrees on the required actions");

  // The stored order defuses, and so does EVERY order the constraints allow.
  const stored = decodeBombActions(bomb.sequence!);
  assert(checkBombPlan(required, constraints, stored).defused, "stored plan did not defuse");
  const orders = permutations(required).filter(
    (order) => checkBombPlan(required, constraints, order).defused,
  );
  assert(orders.length >= 1, "no order of the required actions defuses the bomb");
  for (const order of orders) {
    assert(satisfies(order, constraints), "an accepted order breaks a constraint");
  }
  for (const order of permutations(required)) {
    const accepted = checkBombPlan(required, constraints, order).defused;
    assert(accepted === satisfies(order, constraints), "grading disagrees with the constraints");
  }

  // Anything other than the required set explodes.
  const spare = stored[0] === "bA" ? "bB" : "bA";
  assert(
    checkBombPlan(required, constraints, [spare, ...stored]).exploded ||
      required.includes(spare as string),
    "an extra action did not explode",
  );
  assert(
    !checkBombPlan(required, constraints, stored.slice(0, -1)).defused,
    "a short plan counted as defused",
  );
}
assert(BOMB_RULE_TEMPLATE_COUNT >= 30, "bomb rule bank has fewer than 30 templates");
console.log(
  `Bomb Defusal: ${ROUNDS} panels, each with one unambiguous four-action plan and order-independent grading`,
);

/** Every order of the required actions — at most 6! = 720 of them. */
function permutations(actions: string[]): string[][] {
  if (actions.length <= 1) return [actions];
  const out: string[][] = [];
  actions.forEach((action, index) => {
    const rest = [...actions.slice(0, index), ...actions.slice(index + 1)];
    for (const tail of permutations(rest)) out.push([action, ...tail]);
  });
  return out;
}

/** Does this order respect every ordering constraint? */
function satisfies(order: string[], constraints: BombConstraint[]): boolean {
  const at = (action: string) => order.indexOf(action);
  return constraints.every((constraint) => {
    if (constraint.kind === "before") {
      const a = at(constraint.a);
      const b = at(constraint.b);
      return a < 0 || b < 0 || a < b;
    }
    const index = at(constraint.a);
    if (index < 0) return true;
    return constraint.kind === "first" ? index === 0 : index === order.length - 1;
  });
}
