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
 * 5. The reveals (happy-dom): one board at a time with a tab per board opening on the first not right, Yours | Solution
 *    with the full puzzle (none on a room's public half), wrong and missed items highlighted, the score's facts, no
 *    double-sign dart text; every stamp (checkoutRev 1–3, kakuroRev 1–2) still draws.
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

/* ------------------------------------------------------------------ 5. The reveals (happy-dom) */
// The Number overhaul's reveals (15 Nov 2026): one board at a time with a numbered switcher opening on the first board
// not right, Yours | Solution where the solution is there, the wrong and missed items highlighted, the score's key
// numbers as facts, and no double-sign dart text.
{
  const { Window } = await import("happy-dom");
  const win = new Window({ url: "https://joulz.uk/practice" });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "localStorage", "sessionStorage", "location", "MutationObserver", "ResizeObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia"] as const) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (win as unknown as Record<string, unknown>)[key] });
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { createElement, act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { checkoutPuzzle, checkoutRevealBoards } = await import("../src/puzzles/checkout");
  const { kakuroPuzzle, kakuroRevealBoard } = await import("../src/puzzles/kakuro");
  const { splitPuzzle } = await import("../src/lib/duel/secrets");
  const { NUMBER_REVEAL_ANSWERS } = await import("./screens/number-fixture");
  const mount = async (Reveal: unknown, props: Record<string, unknown>) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host as unknown as Element);
    await act(async () => root.render(createElement(Reveal as never, { timeLimitMs: 90_000, myCorrect: false, myReactionAvgMs: null, ...props } as never)));
    return { host, unmount: () => act(async () => root.unmount()) };
  };
  const tabs = (host: Element) => [...host.querySelectorAll('[role="tab"]')];
  const viewButtons = (host: Element) => [...host.querySelectorAll("[data-reveal-view] button")];

  // Checkout: every stamp the reveal draws.
  for (const [label, pinned] of [["checkoutRev 3", false], ["checkoutRev 2", true]] as const) {
    const p = deal<CheckoutPuzzleData>("checkout", 7, pinned);
    const answer = NUMBER_REVEAL_ANSWERS.checkout!(p);
    const boards = checkoutRevealBoards(p, answer);
    ok(boards.map((b) => b.mark).join(",") === "right,right,wrong,open,open", `checkout ${label}: the fixture's marks (${boards.map((b) => b.mark).join(",")})`);
    const { host, unmount } = await mount(checkoutPuzzle.Reveal, { puzzle: p, myAnswer: answer });
    ok(tabs(host).length === p.stages.length, `checkout ${label}: one tab per board (${tabs(host).length})`);
    ok(host.querySelectorAll("[data-reveal-board]").length === 1, `checkout ${label}: one board drawn at a time`);
    ok(host.querySelector("[data-reveal-board]")?.getAttribute("data-reveal-board") === "2", `checkout ${label}: opens on the first board not right (board 3)`);
    ok(host.querySelectorAll('svg[aria-label="Dartboard"]').length === 1, `checkout ${label}: one dartboard`);
    ok(viewButtons(host).length === 2, `checkout ${label}: Yours | Solution with the full puzzle`);
    ok(host.querySelector('[data-checkout-reveal-side="yours"]') !== null, `checkout ${label}: opens on yours`);
    ok(host.querySelectorAll(".co-rv-dart").length === boards[2]!.mine.length, `checkout ${label}: board 3's darts as chips`);
    ok(/Not checked out/.test(host.textContent ?? ""), `checkout ${label}: the wrong board says so`);
    ok(/Checked out/.test(host.textContent ?? "") && /2 \/ 5/.test(host.textContent ?? ""), `checkout ${label}: the boards checked out as a fact`);
    ok(!/− *[DTSQ]-|[−-] *[DTSQ]?-\d/.test(host.textContent ?? "") && !/×/.test(host.textContent ?? ""), `checkout ${label}: no double-sign or stray × text`);
    // Solution: the fewest-darts route, its last dart the finish.
    await act(async () => (viewButtons(host).find((b) => /Solution/.test(b.textContent ?? "")) as unknown as HTMLButtonElement).click());
    ok(host.querySelector('[data-checkout-reveal-side="solution"]') !== null, `checkout ${label}: Solution draws the route`);
    ok(host.querySelectorAll(".co-rv-dart").length === boards[2]!.best.length && host.querySelectorAll(".co-rv-dart[data-finish]").length === 1, `checkout ${label}: the route's darts, the finishing one marked`);
    // The tabs move the one board.
    await act(async () => (tabs(host)[0] as unknown as HTMLButtonElement).click());
    ok(host.querySelector("[data-reveal-board]")?.getAttribute("data-reveal-board") === "0" && host.querySelectorAll("[data-reveal-board]").length === 1, `checkout ${label}: a tab shows its board alone`);
    await unmount();
  }
  // Checkout without the private half (a room's public half): only yours, no switch.
  {
    const p = deal<CheckoutPuzzleData>("checkout", 7);
    const pub = splitPuzzle(p).pub as CheckoutPuzzleData;
    const { host, unmount } = await mount(checkoutPuzzle.Reveal, { puzzle: pub, myAnswer: NUMBER_REVEAL_ANSWERS.checkout!(p) });
    ok(viewButtons(host).length === 0, "checkout public half: no Yours | Solution");
    ok(host.querySelectorAll("[data-reveal-board]").length === 1, "checkout public half: one board");
    await unmount();
  }
  // Checkout rev 1 (unstamped big finish): still reveals.
  {
    const p = { ...deal<CheckoutPuzzleData>("checkout", 9, true), checkoutRev: 1 };
    const { host, unmount } = await mount(checkoutPuzzle.Reveal, { puzzle: p, myAnswer: p.routes?.join("|") ?? "", myCorrect: true, myMsRemaining: 30_000 });
    ok(tabs(host).every((t) => t.getAttribute("data-mark") === "right"), "checkout rev 1: every board right");
    ok(/Time/.test(host.textContent ?? "") && /60\.0 s/.test(host.textContent ?? ""), "checkout rev 1: a solved round shows its time");
    await unmount();
  }

  // Kakuro: Yours | Solution, wrong digits and missed squares highlighted, the facts.
  for (const [label, pinned] of [["kakuroRev 2", false], ["kakuroRev 1", true]] as const) {
    const p = deal<KakuroPuzzleData>("kakuro", 11, pinned);
    const answer = NUMBER_REVEAL_ANSWERS.kakuro!(p);
    const mine = answer.split("").map(Number);
    const model = kakuroRevealBoard(p, mine, "yours");
    ok(model.wrong === 1 && model.missed > 0 && model.right + model.wrong + model.missed === p.white.length, `kakuro ${label}: the fixture's right / wrong / missed (${model.right}/${model.wrong}/${model.missed})`);
    const { host, unmount } = await mount(kakuroPuzzle.Reveal, { puzzle: p, myAnswer: answer, myExtra: { right: model.right, wrong: 1, total: p.white.length } });
    ok(viewButtons(host).length === 2, `kakuro ${label}: Yours | Solution`);
    ok(host.querySelectorAll(".kakuro-board").length === 1, `kakuro ${label}: one grid`);
    ok(host.querySelectorAll(".kakuro-tone-wrong").length === 1, `kakuro ${label}: the wrong digit highlighted`);
    ok(host.querySelectorAll(".kakuro-tone-missed").length === model.missed, `kakuro ${label}: every empty square marked missed`);
    const text = host.textContent ?? "";
    ok(/Squares right/.test(text) && /Runs complete/.test(text) && /Mistakes/.test(text), `kakuro ${label}: the score's facts`);
    await act(async () => (viewButtons(host).find((b) => /Solution/.test(b.textContent ?? "")) as unknown as HTMLButtonElement).click());
    ok(host.querySelectorAll(".kakuro-tone-wrong, .kakuro-tone-missed").length === 0, `kakuro ${label}: Solution draws the solved grid plain`);
    const digits = [...host.querySelectorAll(".kakuro-digit")].map((d) => Number(d.textContent));
    ok(digits.length === p.white.length && p.white.every((c, i) => digits[i] === p.solution![c]), `kakuro ${label}: Solution's digits are the solution's`);
    await unmount();
  }
  // Kakuro without the solution: only yours, a digit wrong only where its run breaks a rule.
  {
    const p = deal<KakuroPuzzleData>("kakuro", 11);
    const pub = splitPuzzle(p).pub as KakuroPuzzleData;
    ok(!pub.solution, "kakuro public half: no solution");
    const { host, unmount } = await mount(kakuroPuzzle.Reveal, { puzzle: pub, myAnswer: NUMBER_REVEAL_ANSWERS.kakuro!(p) });
    ok(viewButtons(host).length === 0, "kakuro public half: no Yours | Solution");
    ok(host.querySelectorAll(".kakuro-board").length === 1, "kakuro public half: one grid");
    await unmount();
  }
  console.log("reveals: Checkout (rev 1–3, public half) and Kakuro (rev 1–2, public half) drawn");
}

/* ------------------------------------------------------------------ 6. Stage 2 effects (display only) */
{
  const { dartSpot, CHECKOUT_BOARD_GEOMETRY: G, CHECKOUT_TUG_MS } = await import("../src/puzzles/checkout");
  const { checkoutDartFlight, CHECKOUT_FLIGHT_MS, CHECKOUT_THROW_FROM } = await import("../src/puzzles/checkoutFx");
  const { kakuroRunRate, kakuroSolveOrder, KAKURO_SWEEP_MS, KAKURO_SWEEP_RUN_MS } = await import("../src/puzzles/kakuroFx");
  const { CHECKOUT_BULL } = await import("../src/lib/duel/checkout");
  ok(CHECKOUT_FLIGHT_MS <= 600, `Checkout: the flight is at most 600 ms (${CHECKOUT_FLIGHT_MS})`);
  ok(CHECKOUT_TUG_MS <= 900, `Checkout: Undo's tug is a short physical action (${CHECKOUT_TUG_MS} ms)`);
  // Every wedge and ring, plain and ×4 boards, every dart position: the flight ends exactly on the drawn spot, and that
  // spot is inside the chosen ring's band and the chosen wedge (the same geometry as the hit areas).
  const band = (ring: number, quad: boolean): [number, number] =>
    ring === 2 ? [G.R_DOUBLE_IN, G.R_DOUBLE_OUT] : ring === 3 ? [G.R_TREBLE_IN, G.R_TREBLE_OUT] : ring === 4 ? [G.R_QUAD_IN, G.R_QUAD_OUT] : quad ? [G.R_QUAD_OUT, G.R_TREBLE_IN] : [G.R_TREBLE_OUT, G.R_DOUBLE_IN];
  let spots = 0;
  let inRing = 0;
  let landsOnSpot = 0;
  let fromThrow = 0;
  for (const quad of [false, true])
    for (let wedge = 0; wedge < 20; wedge++)
      for (const ring of quad ? [1, 2, 3, 4] : [1, 2, 3])
        for (let nth = 0; nth < 3; nth++) {
          spots++;
          const spot = dartSpot({ wedge, ring }, quad, nth);
          const r = Math.hypot(spot.x - G.C, spot.y - G.C);
          const [r0, r1] = band(ring, quad);
          const angle = ((Math.atan2(spot.y - G.C, spot.x - G.C) * 180) / Math.PI + 90 + 360) % 360;
          const off = Math.abs(((angle - wedge * 18 + 540) % 360) - 180);
          if (r > r0 && r < r1 && off < 9) inRing++;
          const frames = checkoutDartFlight(spot);
          const last = frames[frames.length - 1]!;
          if (last.dx === 0 && last.dy === 0 && last.scale === 1 && last.offset === 1) landsOnSpot++;
          const first = frames[0]!;
          if (Math.abs(spot.x + first.dx - CHECKOUT_THROW_FROM.x) < 0.02 && Math.abs(spot.y + first.dy - CHECKOUT_THROW_FROM.y) < 0.02 && first.scale > 1) fromThrow++;
        }
  ok(inRing === spots, `Checkout: every dart lands inside its chosen ring's band and wedge (${inRing} / ${spots})`);
  ok(landsOnSpot === spots, `Checkout: every flight ends exactly on its landing spot, at full size (${landsOnSpot} / ${spots})`);
  ok(fromThrow === spots, `Checkout: every flight starts at the throw point below the board, larger (${fromThrow} / ${spots})`);
  for (const ring of [1, 2]) {
    const spot = dartSpot({ wedge: CHECKOUT_BULL, ring }, false, 0);
    const r = Math.hypot(spot.x - G.C, spot.y - G.C);
    ok(ring === 2 ? r < G.R_INNER_BULL : r > G.R_INNER_BULL && r < G.R_BULL, `Checkout: a ${ring === 2 ? "bull" : "25"} dart lands in its ring (${r.toFixed(2)})`);
    const frames = checkoutDartFlight(spot);
    ok(frames[frames.length - 1]!.dx === 0 && frames[frames.length - 1]!.dy === 0, "Checkout: a bull dart's flight ends on its spot");
  }
  // The flight rises above the straight line from the throw to the board (an arc, not a slide).
  const mid = checkoutDartFlight({ x: 100, y: 30 })[3]!;
  ok(30 + mid.dy < (CHECKOUT_THROW_FROM.y + 30) / 2 - 10, `Checkout: the flight arcs above the straight line (${(30 + mid.dy).toFixed(1)})`);

  // Kakuro: the run-complete two-note rises with the run's length, a 2-square run at the recording's own pitch.
  const rates = [2, 3, 4, 5, 6, 7, 8, 9].map(kakuroRunRate);
  ok(rates[0] === 1, `Kakuro: a 2-square run plays the recording at its own pitch (${rates[0]})`);
  ok(rates.every((r, i) => i === 0 || r > rates[i - 1]!), `Kakuro: each square more raises the pitch (${rates.join(", ")})`);
  ok(rates[rates.length - 1]! <= 2.3, `Kakuro: the pitch stays within about an octave and a quarter (${rates[rates.length - 1]})`);
  // The solve sweep lights every across run before any down run, in reading order, and ends by the sweep's length.
  let orderOk = 0;
  let boards = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const p = deal<KakuroPuzzleData>("kakuro", seed);
    const runs = kakuroRuns(p);
    const { step, turns } = kakuroSolveOrder(runs);
    const across = runs.filter((r) => r.across);
    const down = runs.filter((r) => !r.across);
    boards++;
    const acrossOk = across.every((run, i) => run.cells.every((c) => turns.get(c)?.a === i));
    const downOk = down.every((run, i) => run.cells.every((c) => turns.get(c)?.d === across.length + i));
    const before = p.white.every((c) => (turns.get(c)?.a ?? 0) < (turns.get(c)?.d ?? 0));
    const total = across.length + down.length;
    const ends = (total - 1) * step + KAKURO_SWEEP_RUN_MS <= KAKURO_SWEEP_MS && KAKURO_SWEEP_MS <= 1200;
    if (acrossOk && downOk && before && ends) orderOk++;
  }
  ok(orderOk === boards, `Kakuro: the solve lights the runs across, then down, ending by ${KAKURO_SWEEP_MS} ms (${orderOk} / ${boards} boards)`);
  // Nothing in the effects touches grading: the grading and rules modules import neither the kit nor the effects files.
  for (const path of ["src/lib/duel/checkout.ts", "src/lib/duel/kakuro.ts", "src/lib/duel/grade.ts", "src/lib/duel/standard/number.server.ts", "src/lib/duel/standard/grid.server.ts"]) {
    const text = readFileSync(path, "utf8");
    ok(!/fx\/kit|checkoutFx|kakuroFx/.test(text), `${path}: no effects import (grading untouched)`);
  }
  for (const path of ["src/puzzles/checkoutFx.ts", "src/puzzles/kakuroFx.ts"]) {
    const text = readFileSync(path, "utf8");
    ok(!/grade|numberOverhaul|stageState|onSubmit|onDraftAnswer/.test(text.replace(/^\s*\*.*$/gm, "").replace(/\/\/.*$/gm, "")), `${path}: display only (no grade, stamp, state or submit)`);
  }
  // The stage wires them through the kit, its own cues kept (silent kit sounds), on landing.
  const src = readFileSync("src/puzzles/checkout.tsx", "utf8");
  ok(/const onLand = \(\) => \{[\s\S]*?soundCue\("checkout\.thud"\)[\s\S]*?soundCue\("checkout\.bust"\)[\s\S]*?gameFx\("wrong"[\s\S]*?soundCue\("checkout\.tick"\)[\s\S]*?countUpText\(/.test(src), "Checkout: the thud, bust and count-down play when the dart lands");
  ok(/soundCue\("checkout\.undo"\);\s*\n\s*\/\/[^\n]*\n\s*tugOut\(/.test(src), "Checkout: Undo plays its tug");
  ok(/gameFx\("match", box\.current\?\.querySelector\("\[data-checkout-lit\]"\)/.test(src), "Checkout: a finish rings the lit ring (match)");
  const ksrc = readFileSync("src/puzzles/kakuro.tsx", "utf8");
  ok(/gameFx\("drop"/.test(ksrc) && /gameFx\("wrong", clueEl\(i\)/.test(ksrc) && /gameFx\("match", el/.test(ksrc) && /gameFx\("combo"/.test(ksrc), "Kakuro: drop, wrong, match and combo through the kit");
  ok(/cue: "kakuro\.run", rate: kakuroRunRate\(/.test(ksrc), "Kakuro: the run chime is pitched by its length");
  console.log("stage 2 effects: dart flight, landing, tug, run pitch and the solve order proved");
}

if (failures.length) {
  console.log(`\nFAIL number-overhaul-checkout-kakuro-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log("number-overhaul-checkout-kakuro-check: all passed");
