/**
 * In-code proof for Sort the Tubes, Safe Cracker and Bomb Defusal (six-step
 * version 2 bank and fresh panels; four-step version 1 for stored rounds). Run with
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
  generateBombPanel,
  inspectBombRules,
} from "../src/lib/duel/bomb.server";
import { BOMB_V2_BANK } from "../src/lib/duel/bombBank.server";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { scoreBomb } from "../src/lib/duel/scoring";
import { checkBombPlan, decodeBombActions, decodeBombConstraints } from "../src/lib/duel/bomb";
import {
  BOMB_NECESSARY_RULES,
  BOMB_RULE_COUNT,
  BOMB_TIME_MS,
  BOMB_V2,
  BOMB_V2_FAMILY_CAP,
  BOMB_V2_NECESSARY,
  BOMB_V2_RULES,
  BOMB_V2_STEPS,
  BOMB_V2_TIME_MS,
  BOMB_WIRES,
  type BombPuzzleData,
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

// Version 2 (six steps): every panel in the server-only bank, plus a few fresh ones.
let bombAttempts = 0;
const fresh: BombPuzzleData[] = [];
for (let i = 0; i < 3; i++) {
  const generated = generateBombPanel(BOMB_V2);
  bombAttempts += generated.attempts;
  fresh.push(generated.puzzle);
}
const v2Panels = [...BOMB_V2_BANK, ...fresh];
assert(BOMB_V2_BANK.length >= 200, `bank has only ${BOMB_V2_BANK.length} panels`);
const families = new Set<string>();
for (const bomb of v2Panels) checkPanel(bomb, BOMB_V2_STEPS, true);
for (const bomb of v2Panels) for (const rule of bomb.rules) families.add(familyName(rule.id));
assert(families.size === 4, "bank does not use all four rule families");
const drawn = generatePuzzle("bomb") as BombPuzzleData;
assert(generateBomb().bombVersion === BOMB_V2, "bank draw not v2");
assert(drawn.bombVersion === BOMB_V2 && drawn.timeLimitMs === BOMB_V2_TIME_MS && drawn.stepCount === BOMB_V2_STEPS, "new rounds are not six-step version 2");
console.log(
  `Bomb Defusal v2: ${BOMB_V2_BANK.length} bank + ${fresh.length} fresh panels, each with exactly one six-action sequence ` +
    `of 60,480, every rule necessary, ${BOMB_V2_NECESSARY}–${BOMB_V2_RULES} rules, ≤${BOMB_V2_FAMILY_CAP} per family; ` +
    `${(bombAttempts / fresh.length).toFixed(1)} attempts per fresh panel`,
);

// Version 1 (stored four-step rounds) still proves and grades as before.
const BOMB_PANELS = 60;
for (let i = 0; i < BOMB_PANELS; i++) checkPanel(generateBombPanel(1).puzzle, 4, false);
console.log(`Bomb Defusal v1: ${BOMB_PANELS} four-step panels still prove unique and grade as before`);

// Scoring: v2 partial = round(75 × prefix ÷ 6); v1 = 25 per step, max 75; complete unchanged.
const v2Partial = [0, 13, 25, 38, 50, 63];
for (let k = 0; k < 6; k++) assert(scoreBomb(false, 0, k, BOMB_V2_TIME_MS, 6) === v2Partial[k], `v2 partial ${k}`);
for (let k = 0; k <= 4; k++) assert(scoreBomb(false, 0, k, BOMB_TIME_MS) === Math.min(75, 25 * k), `v1 partial ${k}`);
assert(scoreBomb(true, BOMB_V2_TIME_MS / 2, 6, BOMB_V2_TIME_MS, 6) === 150, "v2 complete at half time");
const v2Graded = gradeAnswer(drawn, drawn.sequence!, BOMB_V2_TIME_MS / 2);
assert(v2Graded.isCorrect && v2Graded.score === 150, `v2 graded complete ${v2Graded.score}`);
const v2Short = drawn.sequence!.split(",");
// Repeating the first action as step 4 is a strike after three correct steps.
const v2Partial3 = gradeAnswer(drawn, [...v2Short.slice(0, 3), v2Short[0]!].join(","), 0);
// New rounds carry the Oct 2026 puzzle score shape (puzzleScoreRev 1: 22 per step); stored rounds keep round(75 × 3 ÷ 6).
assert(v2Partial3.score === 66 && !v2Partial3.isCorrect, `v2 three-step strike ${v2Partial3.score}`);
const { puzzleScoreRev: _rev, ...drawnStored } = drawn as BombPuzzleData & { puzzleScoreRev?: number };
const v2Stored3 = gradeAnswer(drawnStored as BombPuzzleData, [...v2Short.slice(0, 3), v2Short[0]!].join(","), 0);
assert(v2Stored3.score === 38 && !v2Stored3.isCorrect, `v2 stored three-step strike ${v2Stored3.score}`);
const v1 = generateBombPanel(1).puzzle;
const v1Steps = v1.sequence!.split(",");
const v1Two = gradeAnswer(v1, [...v1Steps.slice(0, 2), v1Steps[3]!].join(","), 0);
assert(v1Two.score === 50 && v1.bombVersion === undefined && v1.timeLimitMs === undefined, `v1 two-step strike ${v1Two.score}`);
console.log("Bomb Defusal scoring: v2 0/13/25/38/50/63 for 0–5 steps, v1 0/25/50/75 unchanged, complete 150 at half time");

function familyName(id: string): string {
  const template = Number(id.slice(1, id.indexOf(":")));
  return template <= 14 ? "conditional" : template <= 26 ? "ordering" : template <= 34 ? "counting" : "colour";
}

function checkPanel(bomb: BombPuzzleData, steps: number, v2: boolean): void {
  const inspected = inspectBombRules(bomb);
  assert(bomb.wires.length === BOMB_WIRES, "wrong wire count");
  if (v2) {
    assert(bomb.bombVersion === BOMB_V2, "v2 panel not stamped");
    assert(bomb.rules.length >= BOMB_V2_NECESSARY && bomb.rules.length <= BOMB_V2_RULES, `card has ${bomb.rules.length} rules`);
    assert(inspected.necessaryRules === bomb.rules.length, "a v2 rule is not individually necessary");
  } else {
    assert(bomb.rules.length === BOMB_RULE_COUNT, "wrong rule count");
    assert(inspected.necessaryRules >= BOMB_NECESSARY_RULES, `only ${inspected.necessaryRules} rules were necessary`);
  }
  assert(["LEFT", "MID", "RIGHT"].includes(bomb.switchPosition), "invalid switch position");
  assert(inspected.unknownRules === 0, "a rule could not be rebuilt from its template");
  assert(inspected.wordingOk, "a rule does not use its template's exact wording");
  assert(inspected.solutions === 1, `rules allow ${inspected.solutions} sequences, not one`);
  assert(inspected.unique, "the one satisfying sequence is not the stored plan");
  assert(inspected.necessary, "too few rules were individually necessary");
  assert(inspected.pairsDistinct, "two rules concern the same action pair");
  assert(inspected.familiesOk, "too many rules from one family");
  assert(new Set(bomb.rules.map((rule) => rule.id)).size === bomb.rules.length, "a rule repeats");

  const required = decodeBombActions(bomb.required!);
  const constraints = decodeBombConstraints(bomb.constraints!);
  const stored = decodeBombActions(bomb.sequence!);
  assert(required.length === steps && bomb.stepCount === steps, `expected ${steps} steps`);
  assert(new Set(required).size === required.length, "an action is required twice");
  assert(stored.join(",") === required.join(","), "the stored plan is not the required sequence");
  assert(checkBombPlan(required, constraints, stored).defused, "stored plan did not defuse");
  // Grading accepts the stored order and nothing else (all 4! or 6! orders).
  for (const order of permutations(required)) {
    const accepted = checkBombPlan(required, constraints, order).defused;
    assert(accepted === (order.join(",") === stored.join(",")), "grading accepted another order");
  }
  const spare = stored.includes("bA") ? (stored.includes("bB") ? stored[0]! : "bB") : "bA";
  assert(checkBombPlan(required, constraints, [spare, ...stored]).exploded, "an extra action did not explode");
  assert(!checkBombPlan(required, constraints, stored.slice(0, -1)).defused, "a short plan counted as defused");
}
assert(BOMB_RULE_TEMPLATE_COUNT === 40, "bomb rule bank is not the 40-template bank");

/** Every order of the required actions — 4! = 24 or 6! = 720 of them. */
function permutations(actions: string[]): string[][] {
  if (actions.length <= 1) return [actions];
  const out: string[][] = [];
  actions.forEach((action, index) => {
    const rest = [...actions.slice(0, index), ...actions.slice(index + 1)];
    for (const tail of permutations(rest)) out.push([action, ...tail]);
  });
  return out;
}
