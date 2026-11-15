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
 *   7. The answer reveals (happy-dom): one board at a time (Counterweight's scales on numbered tabs, as many tabs as
 *      scales, opening on the first not balanced), Yours against Solution where both exist (the moved weights ringed,
 *      the weights left on the tray), the facts behind the score, no stray "×" marks; an older stamp's stored
 *      answer reveals too. Exact: the target beside your closest, your route against a way, each as tiles a step a
 *      row, "No steps made" for an empty answer, the facts.
 *
 *   bun scripts/number-overhaul-balance-target-check.ts
 */
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { BALANCE_REV_FREE_MOVES, BALANCE_REV_LIMITS, balanceFreeMoves, pinPreNumberOverhaul } from "../src/lib/duel/numberOverhaul";
import { balanceHangCost, balanceLeftOnTray, balanceMovedWeights, balanceRevealMarks, balanceTorqueText, exactLockReady, toggleOperator } from "../src/lib/duel/numberOverhaulInput";
import { firstBoardToShow } from "../src/components/puzzles/number/RevealParts";
import { encodeSteps } from "../src/lib/duel/target";
import { encodeBalance, type Placement } from "../src/lib/duel/balance";
import { joinCountSuffix } from "../src/lib/duel/moveLimits";
import type { BalancePuzzleData, BalanceScale, TargetNumberPuzzleData } from "../src/lib/duel/types";

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

/* 7. The answer reveals. */
// The pure rules first.
ok(JSON.stringify(balanceRevealMarks([[0], [null], [3, null]], [true, false, false])) === JSON.stringify(["right", "open", "wrong"]), "a scale's tab: balanced, nothing hung, or tried");
ok(firstBoardToShow(["right", "right", "wrong", "open"]) === 2 && firstBoardToShow(["right", "right"]) === 0, "the reveal opens on the first board not right");
ok([...balanceMovedWeights([0, null, 5], [0, 6, 2])].join(",") === "1,2", "the solution's ringed weights are the ones hung elsewhere");
ok(balanceLeftOnTray([0, null, 5, undefined as unknown as null], 4).join(",") === "1,3", "the weights left on the tray");
{
  const win = new Window({ url: "https://joulz.uk/practice" });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "localStorage", "sessionStorage", "location", "MutationObserver", "ResizeObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia"] as const) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (win as unknown as Record<string, unknown>)[key] });
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { createElement, act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { balancePuzzle } = await import("../src/puzzles/balance");
  const { targetNumberPuzzle } = await import("../src/puzzles/targetNumber");
  const show = async (def: { Reveal?: unknown }, props: Record<string, unknown>) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host as unknown as Element);
    await act(async () => root.render(createElement(def.Reveal as never, { myCorrect: false, myReactionAvgMs: null, timeLimitMs: 120_000, ...props } as never)));
    return { host, done: () => act(async () => root.unmount()) };
  };
  const tabs = (host: Element) => [...host.querySelectorAll('[role="tab"]')];
  const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ");
  const click = async (el: Element | null | undefined) => act(async () => (el as unknown as HTMLElement | null)?.click());

  // Counterweight on balanceRev 4: scales 1 and 2 balanced, scale 3 one weight hung (not balanced), scale 4 untouched.
  const p = live;
  const sol = p.solutions ?? [];
  const placements: Placement[] = p.scales.map((scale, i) => (i < 2 ? sol[i]! : i === 2 ? scale.tray.map((_, t) => (t === 0 ? (sol[i]?.[0] ?? null) : null)) : scale.tray.map(() => null)));
  const answer = joinCountSuffix(encodeBalance(placements), p.scales.map((s, i) => (i < 2 ? s.tray.length : i === 2 ? 1 : 0)));
  {
    const { host, done } = await show(balancePuzzle, { puzzle: p, myAnswer: answer, myMsRemaining: 30_000 });
    const t = tabs(host);
    ok(t.length === p.scales.length, `Counterweight: one tab a scale (${t.length} of ${p.scales.length})`);
    ok(host.querySelectorAll("[data-reveal-board]").length === 1 && host.querySelectorAll(".balance-instrument").length === 1, "Counterweight: exactly one scale drawn at a time");
    ok(t.map((x) => x.getAttribute("data-mark")).join(",") === "right,right,wrong,open", `Counterweight: tabs marked balanced, balanced, not balanced, nothing hung (${t.map((x) => x.getAttribute("data-mark")).join(",")})`);
    ok(t[2]?.getAttribute("aria-selected") === "true", "Counterweight: opens on the first scale not balanced");
    ok(!!host.querySelector("[data-reveal-view]"), "Counterweight: Yours against Solution on a scale not balanced");
    ok(host.querySelector("[data-reveal-side]")?.getAttribute("data-reveal-side") === "solution", "Counterweight: the balanced arrangement is drawn first");
    ok(host.querySelectorAll('[data-reveal-mark="moved"]').length > 0, "Counterweight: the weights hung elsewhere than yours are ringed");
    ok(!!host.querySelector("[data-number-reveal-facts]") && /Balanced\s*2 of 4/.test(text(host.querySelector("[data-number-reveal-facts]"))), "Counterweight: the facts say 2 of 4 balanced");
    ok(!/×/.test(text(host)), "Counterweight: no stray × marks");
    const yours = [...host.querySelectorAll("[data-reveal-view] button")].find((b) => b.textContent === "Yours");
    await click(yours);
    ok(host.querySelector("[data-reveal-side]")?.getAttribute("data-reveal-side") === "yours", "Counterweight: Yours shows your weights");
    ok(/Still on the tray/.test(text(host)), "Counterweight: Yours shows the weights left on the tray");
    ok(/Your hangs, scale 3\s*1 of/.test(text(host.querySelector("[data-number-reveal-facts]"))), "Counterweight: Yours names its hangs as yours, with the limit");
    ok(!!host.querySelector("[data-balance-torque]"), "Counterweight: the balance shows under the beam");
    await click(t[0]);
    ok(tabs(host)[0]?.getAttribute("aria-selected") === "true" && !host.querySelector("[data-reveal-view]"), "Counterweight: a balanced scale shows yours, no switch");
    await done();
  }
  // Every scale balanced: opens on scale 1, the time shown.
  {
    const all = joinCountSuffix(encodeBalance(sol), p.scales.map((s) => s.tray.length));
    const { host, done } = await show(balancePuzzle, { puzzle: p, myAnswer: all, myMsRemaining: 61_000, myCorrect: true });
    ok(tabs(host)[0]?.getAttribute("aria-selected") === "true", "Counterweight: all balanced opens on scale 1");
    ok(/Time\s*59\.0 s/.test(text(host.querySelector("[data-number-reveal-facts]"))), "Counterweight: a full set shows its time");
    await done();
  }
  // A stored round with no stamp (three scales, no hang counts, no solutions): yours alone, the scales in order.
  {
    const stored = balancePuzzle.generate() as BalancePuzzleData;
    const { host, done } = await show(balancePuzzle, { puzzle: stored, myAnswer: encodeBalance([[0, null], [null, null], [null, null]]), myMsRemaining: 0 });
    ok(tabs(host).length === 3 && host.querySelectorAll(".balance-instrument").length === 1, "Counterweight: an unstamped round reveals its three scales one at a time");
    ok(!host.querySelector("[data-reveal-view]"), "Counterweight: no solution stored, no switch");
    await done();
  }
  // An answer with no reveal (never submitted).
  {
    const { host, done } = await show(balancePuzzle, { puzzle: p, myAnswer: null });
    ok(tabs(host)[0]?.getAttribute("aria-selected") === "true" && tabs(host).every((x) => x.getAttribute("data-mark") === "open"), "Counterweight: nothing hung reads as not reached on every tab");
    await done();
  }

  // Exact.
  const ex = withSeededRandom(11, () => generatePuzzle("target")) as TargetNumberPuzzleData;
  {
    const part = encodeSteps(ex.solution.slice(0, 2));
    const { host, done } = await show(targetNumberPuzzle, { puzzle: ex, myAnswer: part });
    ok(!!host.querySelector('[data-plate="target"]') && text(host.querySelector('[data-plate="target"]')).includes(String(ex.target)), "Exact: the target plate shows the target");
    ok(/away/.test(text(host.querySelector('[data-plate="yours"]'))), "Exact: your closest says how far off");
    ok(!!host.querySelector("[data-reveal-view]") && host.querySelector("[data-reveal-side]")?.getAttribute("data-reveal-side") === "solution", "Exact: a miss shows a way to the target first, with Yours to switch to");
    ok(host.querySelectorAll("[data-route-step]").length === ex.solution.length, "Exact: the way drawn a step a row as tiles");
    const yours = [...host.querySelectorAll("[data-reveal-view] button")].find((b) => b.textContent === "Your route");
    await click(yours);
    ok(host.querySelectorAll("[data-route-step]").length === 2, "Exact: your route drawn a step a row");
    ok(/Your steps\s*2/.test(text(host.querySelector("[data-number-reveal-facts]"))) && /\d+ away/.test(text(host.querySelector('[data-plate="yours"]'))), "Exact: how far off on your plate, your steps in the facts");
    const outside = [...host.querySelectorAll("p, [data-plate]")].map((e) => e.textContent ?? "").join(" ");
    ok(!/×/.test(outside), "Exact: × only inside a step, never as a mark");
    await done();
  }
  {
    const { host, done } = await show(targetNumberPuzzle, { puzzle: ex, myAnswer: encodeSteps(ex.solution), myCorrect: true });
    ok(/Spot on/.test(text(host)) && host.querySelector("[data-reveal-side]")?.getAttribute("data-reveal-side") === "yours", "Exact: a hit opens on your route, Spot on");
    ok(host.querySelectorAll("[data-route-step] [data-hit]").length >= 1, "Exact: the step that hits the target is gold");
    await done();
  }
  {
    const { host, done } = await show(targetNumberPuzzle, { puzzle: { ...ex, solution: [] }, myAnswer: "" });
    ok(/No steps made/.test(text(host)) && !host.querySelector("[data-reveal-view]"), "Exact: an empty answer with no stored way reads No steps made, no switch");
    await done();
  }
}

if (failures) {
  console.log(`FAIL number-overhaul-balance-target-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log("number-overhaul-balance-target-check: all passed");
