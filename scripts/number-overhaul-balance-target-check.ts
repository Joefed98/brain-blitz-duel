/**
 * number-overhaul-balance-target-check (15 Nov 2026, the Number overhaul; docs/design/game-reviews/number.md):
 * Counterweight and Exact.
 *
 *   1. Counterweight deals balanceRev 4 live and balanceRev 3 with pinPreNumberOverhaul(true).
 *   2. The grading arithmetic is unchanged: the same answer (placements and hang counts) scores the same on balanceRev 3
 *      and 4, finished, part-played and over a hang limit, and every older stamp still grades as dealt.
 *   3. balanceRev 4's hang counting: only a weight hung from the tray counts; moving a hung weight is free; on older
 *      stamps every placement counts, as before (balanceHangCost).
 *   4. The balance under the beam reads "left | right" (balanceTorqueText).
 *   5. Exact: Lock is ready (and gold) only once a step is made; tapping the picked operator again deselects it.
 *   6. The stage wires the rules: balance.tsx counts hangs through balanceHangCost on the stamp and draws the balance
 *      only on balanceRev 4; Exact's Lock carries data-ready from exactLockReady.
 *
 *   bun scripts/number-overhaul-balance-target-check.ts
 */
import { readFileSync } from "node:fs";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { BALANCE_REV_FREE_MOVES, BALANCE_REV_LIMITS, balanceFreeMoves, pinPreNumberOverhaul } from "../src/lib/duel/numberOverhaul";
import { balanceHangCost, balanceTorqueText, exactLockReady, toggleOperator } from "../src/lib/duel/numberOverhaulInput";
import { encodeBalance, type Placement } from "../src/lib/duel/balance";
import { joinCountSuffix } from "../src/lib/duel/moveLimits";
import type { BalancePuzzleData, BalanceScale } from "../src/lib/duel/types";

let failures = 0;
const ok = (cond: boolean, label: string) => {
  if (!cond) {
    failures++;
    console.log(`FAIL ${label}`);
  } else console.log(`ok   ${label}`);
};

/* 1. Deals. */
const live = withSeededRandom(7, () => generatePuzzle("balance")) as BalancePuzzleData;
ok(live.balanceRev === BALANCE_REV_FREE_MOVES && balanceFreeMoves(live), `Counterweight deals balanceRev ${BALANCE_REV_FREE_MOVES} live (${live.balanceRev})`);
const was = pinPreNumberOverhaul(true);
const old = withSeededRandom(7, () => generatePuzzle("balance")) as BalancePuzzleData;
pinPreNumberOverhaul(was);
ok(old.balanceRev === BALANCE_REV_LIMITS && !balanceFreeMoves(old), `pinned: balanceRev ${BALANCE_REV_LIMITS} (${old.balanceRev})`);
ok(JSON.stringify(old.scales) === JSON.stringify(live.scales), "the same seed deals the same scales on both stamps");
ok(old.placeLimits?.join() === live.placeLimits?.join() && old.timeLimitMs === live.timeLimitMs, "the same hang limits and clock on both stamps");

/* 2. Grading arithmetic unchanged. */
const solutions = (live.solutions ?? []) as Placement[];
ok(solutions.length === live.scales.length, "every scale has a stored solution");
const limits = live.placeLimits ?? [];
const answers: [string, string][] = [
  ["every scale balanced, every weight hung once", joinCountSuffix(encodeBalance(solutions), live.scales.map((s) => s.tray.length))],
  ["every scale balanced, a few re-hangs", joinCountSuffix(encodeBalance(solutions), live.scales.map((s, i) => s.tray.length + i + 1))],
  ["two scales balanced", joinCountSuffix(encodeBalance(solutions.map((p, i) => (i < 2 ? p : p.map(() => null)))), live.scales.map((s) => s.tray.length))],
  ["a scale over its hang limit", joinCountSuffix(encodeBalance(solutions), live.scales.map((s, i) => (i === 0 ? (limits[0] ?? 0) + 1 : s.tray.length)))],
  ["nothing hung", ""],
];
for (const [label, answer] of answers) {
  for (const ms of [0, 30_000, 90_000]) {
    const a = gradeAnswer(old, answer, ms);
    const b = gradeAnswer(live, answer, ms);
    ok(a.score === b.score && a.isCorrect === b.isCorrect, `${label}, ${ms} ms left: ${a.score} on balanceRev 3 = ${b.score} on balanceRev 4`);
  }
}
const best = gradeAnswer(live, answers[0]![1], 90_000);
ok(best.isCorrect && best.score > gradeAnswer(live, answers[1]![1], 90_000).score, "par hangs still pay more than re-hangs");
for (const rev of [1, 2]) {
  const p = { ...old, balanceRev: rev } as BalancePuzzleData;
  const a = gradeAnswer(p, answers[0]![1], 30_000);
  const b = gradeAnswer({ ...p }, answers[0]![1], 30_000);
  ok(a.score === b.score && !balanceFreeMoves(p), `balanceRev ${rev} grades as before and keeps paid moves`);
}

/* 3. Hang counting. */
const placement: Placement = [3, null, 6];
ok(balanceHangCost(placement, 1, 2, true) === 1, "free moves: a weight hung from the tray counts");
ok(balanceHangCost(placement, 0, 1, true) === 0, "free moves: moving a hung weight to another notch is free");
ok(balanceHangCost(placement, 0, null, true) === 0, "free moves: putting a weight back costs nothing");
ok(balanceHangCost(placement, 1, 2, false) === 1 && balanceHangCost(placement, 0, 1, false) === 1, "older stamps: every placement counts");
ok(balanceHangCost(placement, 0, null, false) === 0, "older stamps: putting a weight back costs nothing");
// A whole scale on balanceRev 4: hang two weights, move both, back to the tray, hang again: 3 hangs.
{
  let p: Placement = [null, null];
  let hangs = 0;
  const move = (tray: number, peg: number | null) => {
    hangs += balanceHangCost(p, tray, peg, true);
    p = p.map((v, i) => (i === tray ? peg : v));
  };
  move(0, 1); move(1, 6); move(0, 2); move(1, 7); move(0, null); move(0, 0);
  ok(hangs === 3, `free moves: hang, hang, move, move, back, hang = 3 hangs (${hangs})`);
}

/* 4. The balance shown. */
const scale: BalanceScale = { fixed: [{ peg: 1, w: 2 }], tray: [3, 4] };
ok(balanceTorqueText(scale, [5, null]) === "6 | 6", `torque: 2 at 3 left, 3 at 2 right = "6 | 6" (${balanceTorqueText(scale, [5, null])})`);
ok(balanceTorqueText(scale, [null, 7]) === "6 | 16", `torque: 4 at 4 right = "6 | 16" (${balanceTorqueText(scale, [null, 7])})`);
ok(balanceTorqueText(scale, [null, null]) === "6 | 0", "torque: nothing hung on the right = \"6 | 0\"");

/* 5. Exact. */
ok(!exactLockReady(0) && exactLockReady(1) && exactLockReady(5), "Exact: Lock ready only once a step is made");
ok(toggleOperator(null, "+") === "+", "Exact: an operator is picked");
ok(toggleOperator("+", "+") === null, "Exact: tapping the picked operator again deselects it");
ok(toggleOperator("+", "×") === "×", "Exact: another operator replaces the picked one");

/* 6. The stages wire it. */
const bal = readFileSync("src/puzzles/balance.tsx", "utf8");
ok(/balanceHangCost\(placement, tray, peg, freeMoves\)/.test(bal), "balance.tsx counts hangs through balanceHangCost on the stamp");
ok(/const freeMoves = balanceFreeMoves\(data\)/.test(bal), "balance.tsx reads the stamp through balanceFreeMoves");
ok(/freeMoves \? balanceTorqueText\(scale, placement\) : undefined/.test(bal), "the balance under the beam shows on balanceRev 4 only");
ok(/lastTap\.current/.test(bal), "older stamps keep the double tap back to the tray");
ok(/Pick a weight first/.test(bal) && /onEmptyNotch=\{emptyNotch\}/.test(bal), "a notch tapped with nothing picked nudges the tray");
const tgt = readFileSync("src/puzzles/targetNumber.tsx", "utf8");
ok(/data-ready=\{exactLockReady\(steps\.length\) \? "" : undefined\}/.test(tgt), "Exact: Lock is gold (data-ready) only once there is a step");
ok(/setOperator\(toggleOperator\(operator, op\)\)/.test(tgt), "Exact: the operator keys toggle");

if (failures) {
  console.log(`FAIL number-overhaul-balance-target-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log("number-overhaul-balance-target-check: all passed");
