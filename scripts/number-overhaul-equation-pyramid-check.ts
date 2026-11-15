/**
 * number-overhaul-equation-pyramid-check (15 Nov 2026, the Number overhaul, docs/design/game-reviews/number.md):
 * Operator `gapsRev 2` and Integer Pyramid's display changes.
 *
 *   1. The deal: Operator deals gapsRev 2 live, gapsRev 1 with pinPreNumberOverhaul(true); the boards are the same.
 *   2. Older stamps grade exactly as recorded before the overhaul (scripts/fixtures/number-overhaul-equation-legacy.json,
 *      `--record` rewrites it, only ever on the code before the change), and a gapsRev 2 copy grades the same answers
 *      the same (the server's arithmetic is unchanged: each equation on its own fill, the phone's try counts).
 *   3. Tries: on gapsRev 2 the same full fill again uses no try; on gapsRev 1 it does (countTry), and in the live
 *      screen (happy-dom) entering the same wrong fill twice leaves the try counter at 1.
 *   4. Going back: Next goes to the next open equation after this one (Finish with none after), a solve moves on round
 *      to the start, and the chips go back to any open equation; a skipped equation
 *      solved later counts on the server like any other (all four right is a finish).
 *   5. Gaps: a chosen empty gap takes the next tile of its kind.
 *   6. Integer Pyramid: the sum check (right / wrong / unknown), the seams only where the player had a hand, the
 *      "Finish" label on the last pyramid, the tray in two rows.
 *   7. The answer reveals (happy-dom): one board at a time with a tab per equation / pyramid, opening on the first not
 *      right, a skipped one marked not reached; Yours against Solution where the reveal has the answers (none on the
 *      public half), wrong pieces and empty gaps or stones highlighted on Yours, the pieces missed outlined on the
 *      solution; the facts that explain the score; an older stamp's answer reveals too.
 *
 *   bun scripts/number-overhaul-equation-pyramid-check.ts [--record]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Window } from "happy-dom";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { joinCountSuffix } from "../src/lib/duel/moveLimits";
import { joinStages } from "../src/lib/duel/stagedRounds";
import { gapSlots, gapStageCorrect, joinGapSegment, splitGapSegment } from "../src/lib/duel/operatorGaps";
import { GAPS_REV_FAIR_TRIES, GAPS_REV_FIRST, operatorFairTries, pinPreNumberOverhaul } from "../src/lib/duel/numberOverhaul";
import { countTry, nextOpenStage, operatorNextLabel, targetGap } from "../src/lib/duel/operatorFairTries";
import { NP_SET_SIZE, NP_TRAY_GAP, NP_TRAY_MIN_W, npBuild, npIndex, npSeams, npSkipLabel, npSumState, npTrayPerRow, npTrayRows } from "../src/lib/duel/numberPyramid";
import type { EquationPuzzleData, PuzzleData } from "../src/lib/duel/types";

const FIXTURE = "scripts/fixtures/number-overhaul-equation-legacy.json";
const RECORD = process.argv.includes("--record");
let failures = 0;
const ok = (cond: unknown, label: string) => {
  if (!cond) {
    failures++;
    console.log(`FAIL ${label}`);
  }
};

const SEEDS = [11, 23, 37, 41, 59, 73];
const deal = (seed: number, pinned: boolean) => {
  const was = pinPreNumberOverhaul(pinned);
  try {
    return withSeededRandom(seed, () => generatePuzzle("equation")) as EquationPuzzleData;
  } finally {
    pinPreNumberOverhaul(was);
  }
};

/* ------------------------------------------------------------------ 1. The deal */
for (const seed of SEEDS) {
  const now = deal(seed, false);
  const old = deal(seed, true);
  ok(now.gapsRev === GAPS_REV_FAIR_TRIES && operatorFairTries(now), `equation ${seed}: deals gapsRev ${GAPS_REV_FAIR_TRIES}`);
  ok(old.gapsRev === GAPS_REV_FIRST && !operatorFairTries(old), `equation ${seed}: pinned, deals gapsRev ${GAPS_REV_FIRST}`);
  ok(JSON.stringify({ ...now, gapsRev: 0 }) === JSON.stringify({ ...old, gapsRev: 0 }), `equation ${seed}: the same board on both stamps`);
}
{
  const p = withSeededRandom(5, () => generatePuzzle("numpyramid")) as PuzzleData & { pyramids: unknown[] };
  ok(p.type === "numpyramid" && p.pyramids.length === NP_SET_SIZE, "Integer Pyramid: still four pyramids (no stamp)");
}

/* ------------------------------------------------------------------ 2. Older stamps grade as recorded */
type Row = { seed: number; answer: string; score: number; isCorrect: boolean };
const answersFor = (p: EquationPuzzleData): string[] => {
  const right = p.stages.map((_, i) => p.gapAnswers?.[i] ?? "");
  const wrongOf = (i: number) => {
    const n = gapSlots(p.stages[i]!).length;
    const fills = splitGapSegment(right[i], n);
    // A full fill that isn't true: the answer's fills, reversed (or a sign changed).
    const flipped = fills.map((f) => (f === "+" ? "-" : f === "-" ? "+" : f === "×" ? "÷" : f === "÷" ? "×" : f));
    const seg = joinGapSegment(flipped);
    return gapStageCorrect(p.stages[i]!, seg) ? "" : seg;
  };
  return [
    joinCountSuffix(joinStages(["", "", "", ""], 4), [0, 0, 0, 0]),
    joinCountSuffix(joinStages(right, 4), [1, 1, 1, 1]),
    joinCountSuffix(joinStages([right[0]!, right[1]!, wrongOf(2), ""], 4), [1, 2, 3, 0]),
    joinCountSuffix(joinStages(right, 4), [4, 1, 2, 1]),
    joinCountSuffix(joinStages(["", right[1]!, "", right[3]!], 4), [0, 1, 0, 1]),
  ];
};
const rows: Row[] = [];
for (const seed of SEEDS) {
  const old = deal(seed, true);
  for (const answer of answersFor(old)) {
    const g = gradeAnswer(old, answer, 30_000);
    rows.push({ seed, answer, score: g.score, isCorrect: g.isCorrect });
    const now = { ...old, gapsRev: GAPS_REV_FAIR_TRIES } as EquationPuzzleData;
    const gn = gradeAnswer(now, answer, 30_000);
    ok(gn.score === g.score && gn.isCorrect === g.isCorrect, `equation ${seed}: gapsRev 2 grades "${answer}" as gapsRev 1 (${gn.score} vs ${g.score})`);
  }
}
if (RECORD) {
  writeFileSync(FIXTURE, JSON.stringify(rows, null, 1) + "\n");
  console.log(`recorded ${rows.length} grades to ${FIXTURE}`);
} else {
  const want = JSON.parse(readFileSync(FIXTURE, "utf8")) as Row[];
  ok(want.length === rows.length && want.length === 30, `30 recorded grades (${want.length})`);
  want.forEach((w, i) => {
    const r = rows[i];
    ok(r && r.answer === w.answer && r.score === w.score && r.isCorrect === w.isCorrect, `gapsRev 1 seed ${w.seed} "${w.answer}": grades ${w.score} as recorded (${r?.score})`);
  });
  ok(want.some((w) => w.isCorrect) && want.some((w) => !w.isCorrect && w.score > 0), "the fixture holds finishes and part credit");
}

/* ------------------------------------------------------------------ 3. Tries */
{
  const a = countTry(true, [], "+,×");
  ok(a.uses && a.tried.length === 1, "gapsRev 2: a new full fill uses a try");
  const b = countTry(true, a.tried, "+,×");
  ok(!b.uses && b.tried.length === 1, "gapsRev 2: the same fill again uses no try");
  const c = countTry(true, b.tried, "-,×");
  ok(c.uses && c.tried.length === 2, "gapsRev 2: a different fill uses a try");
  ok(countTry(false, ["+,×"], "+,×").uses, "gapsRev 1: the same fill again uses a try");
}

/* ------------------------------------------------------------------ 4. Going back */
{
  const open = new Set([0, 2]);
  ok(nextOpenStage(1, 4, (i) => open.has(i)) === 2, "Next goes forward to the next open equation");
  ok(nextOpenStage(2, 4, (i) => open.has(i)) === 0, "after a solve, play goes round to an earlier skipped equation");
  ok(nextOpenStage(2, 4, (i) => open.has(i), false) === null, "Next on the last open equation: no wrap, so the round can finish (Finish)");
  ok(nextOpenStage(1, 4, (i) => open.has(i), false) === 2, "Next goes forward without wrapping");
  ok(nextOpenStage(0, 4, (i) => i === 0) === null, "no other open equation: the round can finish");
  ok(operatorNextLabel(true, null, 1, 4) === "Finish" && operatorNextLabel(true, 3, 1, 4) === "Next", "gapsRev 2: Finish when no other equation is open");
  ok(operatorNextLabel(false, null, 3, 4) === "Submit" && operatorNextLabel(false, 2, 1, 4) === "Next", "gapsRev 1: Submit on the last equation, as before");
  const p = deal(SEEDS[0]!, false);
  const right = p.stages.map((_, i) => p.gapAnswers?.[i] ?? "");
  // Equation 1 skipped, the other three solved, then equation 1 gone back to and solved: the stored answer holds all four.
  const g = gradeAnswer(p, joinCountSuffix(joinStages(right, 4), [1, 1, 1, 1]), 10_000);
  ok(g.isCorrect && g.score >= 150, `a skipped equation solved later counts: all four right is a finish (${g.score})`);
  const part = gradeAnswer(p, joinCountSuffix(joinStages(["", right[1]!, right[2]!, ""], 4), [0, 1, 1, 0]), 10_000);
  ok(!part.isCorrect && part.score > 0, `out of order: two equations right score part credit (${part.score})`);
}

/* ------------------------------------------------------------------ 5. Choosing a gap */
{
  const kinds = ["number", "sign", "number", "sign"] as const;
  ok(targetGap(kinds, [null, null, null, null], "number", 2) === 2, "a chosen empty number gap takes the next number");
  ok(targetGap(kinds, [null, null, null, null], "number", 1) === 0, "a chosen sign gap doesn't take a number (leftmost instead)");
  ok(targetGap(kinds, [null, null, "7", null], "number", 2) === 0, "a chosen gap already filled: the leftmost empty one");
  ok(targetGap(kinds, ["4", null, "7", null], "number", null) === -1, "no empty number gap: nothing");
}

/* ------------------------------------------------------------------ 6. Integer Pyramid */
{
  const rows5 = 5;
  const solution = npBuild([3, 5, 2, 7, 4]);
  const values = [...solution] as (number | null)[];
  const top = npIndex(3, 0), left = npIndex(4, 0), right = npIndex(4, 1);
  ok(npSumState(values, top, left, right) === "right", "a right sum is right");
  values[left] = values[left]! + 1;
  ok(npSumState(values, top, left, right) === "wrong", "a wrong sum is wrong");
  values[right] = null;
  ok(npSumState(values, top, left, right) === "unknown", "a sum with an empty stone is unknown");
  const givens = solution.map((v, i) => (i === left || i === top ? null : v));
  const full = [...solution] as (number | null)[];
  full[left] = full[left]! + 1;
  const seams = npSeams(givens, full, rows5);
  ok(seams.some((x) => x.row === 3 && x.col === 0 && x.state === "wrong"), "the wrong sum shows a crack");
  ok(seams.every((x) => [npIndex(x.row, x.col), npIndex(x.row + 1, x.col), npIndex(x.row + 1, x.col + 1)].some((c) => givens[c] == null)), "only sums with a placed stone are judged");
  ok(npSeams(solution, solution, rows5).length === 0, "an all-given pyramid shows no seams");
  ok(npSeams(givens, solution, rows5).every((x) => x.state === "right"), "a right pyramid shows only gold seams");
  ok(npSkipLabel(0) === "Skip" && npSkipLabel(NP_SET_SIZE - 2) === "Skip" && npSkipLabel(NP_SET_SIZE - 1) === "Finish", "Skip reads Finish on the last pyramid");
  for (const n of [3, 6, 9, 12, 15]) ok(Math.ceil(n / npTrayPerRow(n)) <= 2, `a tray of ${n} fits two rows`);
  // The layout pass (Joe, 15 Nov 2026): balanced rows, never a single tile alone on a row, every tile at least 44 px.
  for (const width of [343, 359, 374, 520]) {
    for (let n = 1; n <= 15; n++) {
      const rows = npTrayRows(n, width);
      const fits = rows.every((k) => k * NP_TRAY_MIN_W + (k - 1) * NP_TRAY_GAP <= width);
      ok(rows.reduce((a, b) => a + b, 0) === n && fits, `tray ${n} at ${width}px: every tile placed, each at least 44 px (${rows.join("+")})`);
      ok(Math.max(...rows) - Math.min(...rows) <= 1, `tray ${n} at ${width}px: rows differ by at most one tile (${rows.join("+")})`);
      ok(n === 1 || rows.every((k) => k >= 2), `tray ${n} at ${width}px: never a single tile alone on a row (${rows.join("+")})`);
    }
  }
  ok(npTrayRows(6, 359).join() === "6" && npTrayRows(7, 300).join() === "4,3" && npTrayRows(9, 300).join() === "5,4", "tray rows: 6 in one row, 7 as 4+3, 9 as 5+4 where one row can't hold them");
  ok(/data-np-tray-row/.test(readFileSync("src/puzzles/numberPyramid.tsx", "utf8")), "Integer Pyramid: the tray draws its balanced rows");
}

/* ------------------------------------------------------------------ 3b. The live screen (happy-dom) */
{
  const win = new Window({ url: "https://joulz.uk/practice" });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "localStorage", "sessionStorage", "location", "MutationObserver", "ResizeObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia"] as const) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (win as unknown as Record<string, unknown>)[key] });
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { createElement, act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { GapsStage } = await import("../src/puzzles/equationGaps");
  let screens = 0;
  for (const fair of [true, false]) {
    const p = deal(SEEDS[1]!, !fair);
    // Equation 1 (signs only): a wrong full fill, entered twice (emptied in between).
    const n = gapSlots(p.stages[0]!).length;
    const rightFills = splitGapSegment(p.gapAnswers?.[0] ?? "", n);
    const wrong = rightFills.map((f) => (f === "+" ? "-" : f === "-" ? "+" : f === "×" ? "÷" : "×"));
    if (gapStageCorrect(p.stages[0]!, joinGapSegment(wrong))) continue;
    screens++;
    let draft = "";
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host as unknown as Element);
    const props = { puzzle: p, locked: false, onSubmit: () => {}, onDraftAnswer: (d: string) => (draft = d), stateKey: `check-${fair}`, phaseStartedAt: 0, now: 0 };
    await act(async () => root.render(createElement(GapsStage as never, props as never)));
    const click = async (label: string) => {
      const b = [...host.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === label);
      ok(!!b, `${fair ? "gapsRev 2" : "gapsRev 1"}: the "${label}" key is drawn`);
      await act(async () => (b as unknown as HTMLButtonElement)?.click());
    };
    const signLabel = (f: string) => `Sign ${f === "-" ? "−" : f}`;
    for (const f of wrong) await click(signLabel(f));
    // Empty the first gap and put the same sign back: the same full fill again.
    const firstGap = host.querySelector(".opg-gap[data-filled='true']") as unknown as HTMLButtonElement | null;
    await act(async () => firstGap?.click());
    await click(signLabel(wrong[0]!));
    const tries = Number(draft.split("#")[1]?.split(",")[0] ?? NaN);
    ok(tries === (fair ? 1 : 2), `${fair ? "gapsRev 2" : "gapsRev 1"}: the same wrong fill twice uses ${fair ? 1 : 2} tries (${tries})`);
    if (fair) {
      // The equation chips: equation 2 is open, so its chip goes there.
      const chip = host.querySelector("[data-stage-chip='1']") as unknown as HTMLButtonElement | null;
      ok(!!chip && !chip.disabled, "gapsRev 2: an open equation's chip can be tapped");
      await act(async () => chip?.click());
      ok(host.querySelector("[data-stage-chip='1']")?.getAttribute("data-state") === "current", "gapsRev 2: the chip moves to that equation");
      const back = host.querySelector("[data-stage-chip='0']") as unknown as HTMLButtonElement | null;
      ok(!!back && !back.disabled && back.getAttribute("data-state") === "started", "gapsRev 2: the equation left part-tried can be gone back to");
    } else ok(!host.querySelector("[data-stage-chip]"), "gapsRev 1: no equation chips");
    await act(async () => root.unmount());
  }
  ok(screens === 2, `both stamps' screens were played (${screens})`);
}

/* ------------------------------------------------------------------ 7. The answer reveals (happy-dom) */
{
  const { createElement, act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { GapsReveal } = await import("../src/puzzles/equationGaps");
  const { numberPyramidPuzzle } = await import("../src/puzzles/numberPyramid");
  const { NUMBER_REVEAL_ANSWERS } = await import("./screens/number-fixture");
  const { splitPuzzle } = await import("../src/lib/duel/secrets");
  const mount = async (component: unknown, props: Record<string, unknown>) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host as unknown as Element);
    await act(async () => root.render(createElement(component as never, { myCorrect: false, myReactionAvgMs: null, timeLimitMs: 90_000, myMsRemaining: 0, ...props } as never)));
    return { host, unmount: () => act(async () => root.unmount()) };
  };
  const tabs = (host: { querySelectorAll: (s: string) => ArrayLike<Element> }) => [...(host.querySelectorAll("[role='tab']") as unknown as Element[])];
  const pressView = async (host: { querySelectorAll: (s: string) => ArrayLike<Element> }, name: string) => {
    const b = [...(host.querySelectorAll("[data-reveal-view] button") as unknown as HTMLButtonElement[])].find((x) => x.textContent?.trim() === name);
    ok(!!b, `the "${name}" view button is drawn`);
    await act(async () => b?.click());
  };

  // Operator: equations 1 and 3 right, 2 a wrong full fill, 4 skipped (the screens' fixture answer).
  for (const pinned of [false, true]) {
    const tag = pinned ? "gapsRev 1" : "gapsRev 2";
    const full = deal(SEEDS[2]!, pinned);
    const answer = NUMBER_REVEAL_ANSWERS.equation!(full);
    const { host, unmount } = await mount(GapsReveal, { puzzle: full, myAnswer: answer });
    const t = tabs(host);
    ok(t.length === 4, `${tag} reveal: one tab per equation (${t.length})`);
    ok(host.querySelectorAll("[data-reveal-board]").length === 1, `${tag} reveal: one equation shown at a time`);
    ok(t[1]?.getAttribute("aria-selected") === "true", `${tag} reveal: opens on the first equation not right`);
    ok(t.map((x) => x.getAttribute("data-mark")).join(",") === "right,wrong,right,open", `${tag} reveal: right, wrong, right, not reached (${t.map((x) => x.getAttribute("data-mark")).join(",")})`);
    ok(!!host.querySelector("[data-reveal-view]"), `${tag} reveal: Yours against Solution where the answers are known`);
    ok(host.querySelectorAll(".opg-gap[data-mark='fix']").length > 0, `${tag} reveal: the solution outlines the pieces the player didn't have`);
    await pressView(host, "Yours");
    ok(host.querySelectorAll(".opg-gap[data-mark='bad']").length > 0, `${tag} reveal: yours highlights the wrong pieces`);
    ok(/^Makes \d+, not \d+$|^Doesn't make a whole number$/.test(host.querySelector("[data-operator-reveal-note]")?.textContent ?? ""), `${tag} reveal: says what the wrong line makes (${host.querySelector("[data-operator-reveal-note]")?.textContent})`);
    const facts = host.querySelector("[data-number-reveal-facts]")?.textContent ?? "";
    ok(/Right\s*2 of 4/.test(facts) && /Tries used\s*5/.test(facts) && /Time/.test(facts), `${tag} reveal: the facts (${facts})`);
    await act(async () => (t[3] as HTMLButtonElement).click());
    ok(host.querySelector("[data-operator-reveal-note]")?.textContent === "One way to make it true", `${tag} reveal: the skipped equation shows a true fill`);
    await pressView(host, "Yours");
    ok(host.querySelectorAll(".opg-gap[data-mark='miss']").length === gapSlots(full.stages[3]!).length, `${tag} reveal: the skipped equation's gaps are marked empty`);
    ok(host.querySelector("[data-operator-reveal-note]")?.textContent === "Not reached", `${tag} reveal: the skipped equation reads "Not reached"`);
    await act(async () => (t[0] as HTMLButtonElement).click());
    ok(!host.querySelector("[data-reveal-view]"), `${tag} reveal: a right equation shows the player's own fill alone`);
    await unmount();
    // The public half (no answers): the player's fill alone, still one at a time.
    const pub = await mount(GapsReveal, { puzzle: splitPuzzle(full).pub, myAnswer: answer });
    ok(tabs(pub.host).length === 4 && !pub.host.querySelector("[data-reveal-view]"), `${tag} reveal: without the answers, yours alone`);
    await pub.unmount();
  }

  // Integer Pyramid: pyramid 1 complete, 2 half placed with two swapped, 3 and 4 untouched.
  {
    const full = withSeededRandom(SEEDS[2]!, () => generatePuzzle("numpyramid"));
    const answer = NUMBER_REVEAL_ANSWERS.numpyramid!(full);
    const { host, unmount } = await mount(numberPyramidPuzzle.Reveal, { puzzle: full, myAnswer: answer });
    const t = tabs(host);
    ok(t.length === 4, `pyramid reveal: one tab per pyramid (${t.length})`);
    ok(host.querySelectorAll("[data-reveal-board]").length === 1 && host.querySelectorAll(".np-art").length === 1, "pyramid reveal: one pyramid drawn at a time");
    ok(t[1]?.getAttribute("aria-selected") === "true", "pyramid reveal: opens on the first pyramid not complete");
    ok(t.map((x) => x.getAttribute("data-mark")).join(",") === "right,wrong,open,open", `pyramid reveal: complete, wrong, not reached ×2 (${t.map((x) => x.getAttribute("data-mark")).join(",")})`);
    ok(host.querySelectorAll("[data-np-fix]").length > 0, "pyramid reveal: the solution outlines the stones the player didn't have");
    await pressView(host, "Yours");
    ok(host.querySelectorAll("[data-np-wrong]").length >= 2, "pyramid reveal: yours highlights the wrong stones");
    ok(host.querySelectorAll("[data-np-missed]").length > 0, "pyramid reveal: yours marks the empty stones");
    ok(/wrong/.test(host.querySelector("[data-np-reveal-note]")?.textContent ?? ""), `pyramid reveal: says how many are wrong (${host.querySelector("[data-np-reveal-note]")?.textContent})`);
    const facts = host.querySelector("[data-number-reveal-facts]")?.textContent ?? "";
    ok(/Complete\s*1 of 4/.test(facts) && /Wrong stones\s*[1-9]/.test(facts) && /Time/.test(facts), `pyramid reveal: the facts (${facts})`);
    await act(async () => (t[0] as HTMLButtonElement).click());
    ok(!host.querySelector("[data-reveal-view]") && host.querySelector("[data-np-reveal-note]")?.textContent === "Complete", "pyramid reveal: a complete pyramid shows the player's own");
    await unmount();
    const pub = await mount(numberPyramidPuzzle.Reveal, { puzzle: splitPuzzle(full).pub, myAnswer: answer });
    ok(tabs(pub.host).length === 4 && !pub.host.querySelector("[data-reveal-view]"), "pyramid reveal: without the solutions, yours alone");
    await act(async () => (tabs(pub.host)[1] as HTMLButtonElement).click());
    ok(pub.host.querySelectorAll("[data-np-wrong]").length >= 1, "pyramid reveal: without the solutions, stones in a broken sum still read wrong");
    await pub.unmount();
  }
}

if (failures) {
  console.log(`FAIL number-overhaul-equation-pyramid-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log("PASS number-overhaul-equation-pyramid-check");
process.exit(0);
