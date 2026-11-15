/**
 * number-overhaul-checkout-kakuro-check (15 Nov 2026, the Number overhaul; numberOverhaul.ts): Checkout checkoutRev 3
 * (a bust clears the board) and Kakuro kakuroRev 2 (only digits that break a rule are mistakes). Fast, no browser.
 *
 * 1. Live deals carry checkoutRev 3 / kakuroRev 2; with pinPreNumberOverhaul they carry checkoutRev 2 / kakuroRev 1.
 * 2. The older stamps grade exactly as before: every answer in scripts/fixtures/number-overhaul-checkout-kakuro-legacy.json
 *    (recorded before the overhaul by scripts/number-overhaul-checkout-kakuro-record.ts) scores and verdicts the same.
 * 3. Checkout's bust rule: past zero, zero off the finishing ring, 1 left on a double finish; a list holding a bust is
 *    never a checkout on rev 3 but is on rev 2; the busted board's darts clear and a clean list after it checks out at
 *    the same score as a first-time one; every dealt board (200 seeds) still has a bust-free route in its fewest darts.
 * 4. Kakuro's rule mistakes: a digit unlike the solution that breaks no rule is no mistake on rev 2 (it is on rev 1); a
 *    repeat is a mistake on both; a run past or out of reach of its clue breaks; the next-empty-square helper.
 *
 *   bun scripts/number-overhaul-checkout-kakuro-check.ts
 */
import { readFileSync } from "node:fs";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { pinPreNumberOverhaul, CHECKOUT_REV_BUST, KAKURO_REV_RULE_MISTAKES } from "../src/lib/duel/numberOverhaul";
import {
  checkoutBustFreeOrder,
  checkoutBustIndex,
  checkoutBustsAt,
  checkoutDartValue,
  checkoutFinisher,
  checkoutOptions,
  checkoutValid,
  decodeCheckoutDarts,
  encodeCheckoutDarts,
  gradeCheckoutStages,
  joinCheckoutRound,
  type CheckoutDart,
} from "../src/lib/duel/checkout";
import { encodeKakuro, kakuroNextEmpty, kakuroRuleMistakeKeys, kakuroRunBroken, kakuroRuns } from "../src/lib/duel/kakuro";
import { encodeTimeline } from "../src/lib/duel/standard/timeline";
import type { CheckoutPuzzleData, CheckoutStageData, KakuroPuzzleData } from "../src/lib/duel/types";

const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  if (!cond) {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};

const deal = <T>(type: "checkout" | "kakuro", seed: number, pinned = false): T => {
  const was = pinPreNumberOverhaul(pinned);
  try {
    return withSeededRandom(seed, () => generatePuzzle(type)) as T;
  } finally {
    pinPreNumberOverhaul(was);
  }
};

/* 1. Stamps. */
for (const seed of [1, 2, 3]) {
  ok(deal<CheckoutPuzzleData>("checkout", seed).checkoutRev === CHECKOUT_REV_BUST, `checkout ${seed}: live deal is checkoutRev 3`);
  ok(deal<CheckoutPuzzleData>("checkout", seed, true).checkoutRev === 2, `checkout ${seed}: pinned deal is checkoutRev 2`);
  ok(deal<KakuroPuzzleData>("kakuro", seed).kakuroRev === KAKURO_REV_RULE_MISTAKES, `kakuro ${seed}: live deal is kakuroRev 2`);
  ok(deal<KakuroPuzzleData>("kakuro", seed, true).kakuroRev === 1, `kakuro ${seed}: pinned deal is kakuroRev 1`);
  // The new stamp changes nothing but the stamp: the boards are the older deal's.
  const a = deal<CheckoutPuzzleData>("checkout", seed), b = deal<CheckoutPuzzleData>("checkout", seed, true);
  ok(JSON.stringify({ ...a, checkoutRev: 0 }) === JSON.stringify({ ...b, checkoutRev: 0 }), `checkout ${seed}: the same boards`);
  const k = deal<KakuroPuzzleData>("kakuro", seed), l = deal<KakuroPuzzleData>("kakuro", seed, true);
  ok(JSON.stringify({ ...k, kakuroRev: 0 }) === JSON.stringify({ ...l, kakuroRev: 0 }), `kakuro ${seed}: the same board`);
}

/* 2. The older stamps grade exactly as before. */
const legacy = JSON.parse(readFileSync("scripts/fixtures/number-overhaul-checkout-kakuro-legacy.json", "utf8")) as {
  type: "checkout" | "kakuro"; seed: number; answer: string; ms: number; score: number; isCorrect: boolean;
}[];
ok(legacy.length >= 200, `${legacy.length} recorded grades`);
let same = 0;
for (const row of legacy) {
  const p = deal<CheckoutPuzzleData | KakuroPuzzleData>(row.type, row.seed, true);
  const g = gradeAnswer(p, row.answer, row.ms);
  if (g.score === row.score && g.isCorrect === row.isCorrect) same++;
  else ok(false, `${row.type} ${row.seed}: older stamp grades ${g.score}/${g.isCorrect}, recorded ${row.score}/${row.isCorrect}`);
}
console.log(`older stamps: ${same} / ${legacy.length} grades unchanged`);

/* 3. Checkout's bust. */
const standard: CheckoutStageData = { wedges: [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5], target: 40, maxDarts: 3, finish: 2 };
const w = (value: number) => standard.wedges.indexOf(value);
const dart = (value: number, ring: number): CheckoutDart => ({ wedge: w(value), ring });
ok(checkoutBustsAt(standard, -2, dart(14, 3), 1), "past zero is a bust");
ok(checkoutBustsAt(standard, 0, dart(20, 2), 1) === false, "zero on a double is a checkout, not a bust");
ok(checkoutBustsAt(standard, 0, dart(20, 1), 2), "zero on a single (double finish) is a bust");
ok(checkoutBustsAt(standard, 1, dart(13, 3), 1), "1 left on a double finish is a bust");
ok(checkoutBustsAt({ ...standard, finish: 3 }, 1, dart(13, 3), 1) === false, "1 left on a treble finish is not a bust");
ok(checkoutBustsAt(standard, 2, dart(19, 2), 1) === false, "2 left is no bust");
const exact: CheckoutStageData = { ...standard, maxDarts: 4, exactDarts: true };
ok(checkoutBustsAt(exact, 0, dart(20, 2), 2), "an exact-darts board reaching zero early is a bust");
ok(checkoutBustsAt(exact, 0, dart(20, 2), 4) === false, "an exact-darts board reaching zero on its last dart is a checkout");
// A list with a bust on the way checks out on rev 2 (negative wedges let it come back) but never on rev 3.
const neg: CheckoutStageData = { ...standard, wedges: standard.wedges.map((v, i) => (i === 1 ? -1 : v)), target: 20 };
const back: CheckoutDart[] = [{ wedge: 0, ring: 1 }, { wedge: 0, ring: 1 }, { wedge: 1, ring: 1 }];
ok(checkoutBustIndex(neg, back) === 0, "S20 on 20 (zero off the double) busts at the first dart");
const below: CheckoutStageData = { ...neg, target: 18 };
// 18: S20 takes it past zero (−2), then D−1 adds 2 back to 0 on a double.
const busted: CheckoutDart[] = [dart(20, 1), { wedge: 1, ring: 2 }];
ok(checkoutValid(below, busted, false), "rev 2: S20 then D−1 checks 18 out (it went below zero on the way)");
ok(!checkoutValid(below, busted, true), "rev 3: the same darts bust at S20, so they never check out");
const pr2 = { type: "checkout", checkoutRev: 2, stages: [below, standard, standard, standard, standard], minDarts: [2, 2, 2, 2, 2] } as unknown as CheckoutPuzzleData;
const pr3 = { ...pr2, checkoutRev: 3 } as CheckoutPuzzleData;
const one = joinCheckoutRound([encodeCheckoutDarts(busted), "", "", "", ""]);
ok(gradeCheckoutStages(pr2.stages, pr2.minDarts!, one, false)[0]!.solved, "rev 2 grades the over-and-back board solved");
ok(!gradeAnswer(pr3, one, 30_000).correctCount && gradeAnswer(pr2, one, 30_000).correctCount === 1, "the server: rev 3 counts it unsolved, rev 2 solved");
// After a bust the phone sends only the darts thrown since: a clean finish then scores exactly like a first-time one.
const clean = joinCheckoutRound([encodeCheckoutDarts([dart(14, 1), dart(2, 2)]), "", "", "", ""]);
ok(checkoutValid(below, [dart(14, 1), dart(2, 2)], true), "a clean 18 (S14, D2) checks out on rev 3");
ok(gradeAnswer(pr3, clean, 30_000).score === gradeAnswer(pr2, clean, 30_000).score, "a bust-then-clean board scores as a first-time checkout");
// Every dealt board still has a bust-free route in its stored fewest darts (an ordered search with the bust rule).
function bustFreeMin(stage: CheckoutStageData): number | null {
  const opts = checkoutOptions(stage);
  for (let len = stage.exactDarts ? stage.maxDarts : 1; len <= stage.maxDarts; len++) {
    let found = false;
    const walk = (left: number, n: number) => {
      for (const d of opts) {
        if (found) return;
        const next = left - checkoutDartValue(stage, d);
        if (checkoutBustsAt(stage, next, d, n + 1)) continue;
        if (next === 0) {
          if (n + 1 === len && checkoutFinisher(stage, d)) found = true;
          continue;
        }
        if (n + 1 < len) walk(next, n + 1);
      }
    };
    walk(stage.target, 0);
    if (found) return len;
  }
  return null;
}
let boards = 0;
for (let seed = 0; seed < 200; seed++) {
  const p = deal<CheckoutPuzzleData>("checkout", 1000 + seed);
  p.stages.forEach((stage, i) => {
    boards++;
    const min = bustFreeMin(stage);
    ok(min !== null && min === p.minDarts?.[i], `checkout ${1000 + seed} board ${i + 1}: bust-free fewest ${min} = stored ${p.minDarts?.[i]}`);
    const route = decodeCheckoutDarts(p.routes?.[i] ?? "", stage.maxDarts);
    ok(checkoutValid(stage, route, false), `checkout ${1000 + seed} board ${i + 1}: the stored route checks out`);
    ok(checkoutValid(stage, checkoutBustFreeOrder(stage, route), true), `checkout ${1000 + seed} board ${i + 1}: the stored route, reordered, checks out on rev 3`);
  });
}
console.log(`checkout: ${boards} dealt boards each keep a bust-free route in their fewest darts`);

/* 4. Kakuro's rule mistakes. */
for (const seed of [5, 6, 7, 8]) {
  const p2 = deal<KakuroPuzzleData>("kakuro", seed);
  const p1 = deal<KakuroPuzzleData>("kakuro", seed, true);
  const sol = p2.solution ?? [];
  const n = p2.size * p2.size;
  const runs = kakuroRuns(p2);
  const solText = encodeKakuro(sol);
  // A lone wrong digit on an empty board: unlike the solution, but (usually) breaking no rule.
  let lone: number[] | null = null;
  for (const c of p2.white) {
    for (let d = 1; d <= 9 && !lone; d++) {
      if (d === sol[c]) continue;
      const v = new Array<number>(n).fill(0);
      v[c] = d;
      if (!runs.some((r) => kakuroRunBroken(r, v))) lone = v;
    }
    if (lone) break;
  }
  ok(lone !== null, `kakuro ${seed}: a lone off-solution digit that breaks no rule exists`);
  if (lone) {
    const timeline = encodeTimeline([{ t: 9_000, draft: encodeKakuro(lone) }, { t: 30_000, draft: solText }]);
    const g2 = gradeAnswer(p2, `${solText}${timeline}`, 60_000);
    const g1 = gradeAnswer(p1, `${solText}${timeline}`, 60_000);
    const clean2 = gradeAnswer(p2, `${solText}${encodeTimeline([{ t: 30_000, draft: solText }])}`, 60_000);
    ok(g2.score === clean2.score, `kakuro ${seed}: rev 2 — a digit that broke no rule costs nothing (${g2.score} = ${clean2.score})`);
    ok(g1.score < g2.score, `kakuro ${seed}: rev 1 — the same digit costs the clean bonus (${g1.score} < ${g2.score})`);
    ok(kakuroRuleMistakeKeys(p2, [encodeKakuro(lone), solText]).length === 0, `kakuro ${seed}: no rule mistake keys`);
  }
  // A repeat in a run: a mistake on both stamps.
  const run = runs.find((r) => r.cells.length >= 2)!;
  const rep = new Array<number>(n).fill(0);
  rep[run.cells[0]!] = sol[run.cells[0]!]!;
  rep[run.cells[1]!] = sol[run.cells[0]!]!;
  ok(kakuroRunBroken(run, rep), `kakuro ${seed}: a repeat breaks its run`);
  const repTimeline = encodeTimeline([{ t: 5_000, draft: encodeKakuro(rep) }, { t: 30_000, draft: solText }]);
  const clean = gradeAnswer(p2, `${solText}${encodeTimeline([{ t: 30_000, draft: solText }])}`, 60_000).score;
  ok(gradeAnswer(p2, `${solText}${repTimeline}`, 60_000).score < clean, `kakuro ${seed}: rev 2 — a repeat costs the clean bonus`);
  ok(gradeAnswer(p1, `${solText}${repTimeline}`, 60_000).score < clean, `kakuro ${seed}: rev 1 — a repeat costs the clean bonus`);
  const firstOnly = new Array<number>(n).fill(0);
  firstOnly[run.cells[0]!] = rep[run.cells[0]!]!;
  ok(kakuroRuleMistakeKeys(p2, [encodeKakuro(firstOnly), encodeKakuro(rep)]).length === 1, `kakuro ${seed}: one key for the repeated digit (the earlier digit is no mistake)`);
  // Past the clue, and out of reach.
  const big = new Array<number>(n).fill(0);
  const two = runs.find((r) => r.cells.length === 2);
  if (two) {
    big[two.cells[0]!] = 9;
    ok(kakuroRunBroken(two, big) === (9 + 1 > two.sum || 9 + 8 < two.sum), `kakuro ${seed}: a 2-run with a 9 breaks only when it can't reach ${two.sum}`);
  }
  // The next empty square: across first, then down, wrapping round the run.
  const v = new Array<number>(n).fill(0);
  const across = runs.find((r) => r.across && r.cells.length >= 3)!;
  ok(kakuroNextEmpty(p2, v, across.cells[0]!) === across.cells[1], `kakuro ${seed}: after the run's first square comes its second`);
  for (const c of across.cells) v[c] = 1;
  const down = runs.find((r) => !r.across && r.cells.includes(across.cells[0]!))!;
  const wantDown = [...down.cells.slice(down.cells.indexOf(across.cells[0]!) + 1), ...down.cells.slice(0, down.cells.indexOf(across.cells[0]!))].find((c) => !v[c]) ?? null;
  ok(kakuroNextEmpty(p2, v, across.cells[0]!) === wantDown, `kakuro ${seed}: a full across run moves on down`);
}

if (failures.length) {
  console.log(`\nFAIL number-overhaul-checkout-kakuro-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log("number-overhaul-checkout-kakuro-check: all passed");
