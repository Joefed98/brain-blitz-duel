/**
 * number-overhaul-measure-numline-check (15 Nov 2026, the Number overhaul's stage 1 for Brimful and Ballpark; fast,
 * no browser). Both games change look and input only, so:
 *
 *   1. Brimful's reveal draws each puzzle's best line as jug pictures: measureLineStates gives the jugs after each
 *      move, starting from the board's start, every step exactly measureApply's, ending on the target (all four
 *      boards of 40 live deals), and the reveal no longer lists moves as chips.
 *   2. Brimful's stage moment: a solved board leaves through NumberStage's "clear" (no extra `correct` on advance), a
 *      board out of moves through a quiet "fail" slide with its one `wrong` (measureRev 4); the glass is the sprite.
 *   3. Ballpark's edge bump: numlineEdgeOf names the end a touch lies beyond, nothing on the line itself, and a bump
 *      plays `numline.edge` once per end, never in place of the marker's clamp.
 *   4. Ballpark's place plays one sound (exactly one duelz-sound cue, `numline.place`); a finished line (not the
 *      last) clears through NumberStage before the next comes in.
 *   5. Neither game's deal changed: live deals equal the pre-overhaul era's (pinPreNumberOverhaul) on 30 seeds each.
 *   6. The art, the sound slots and their cue-sheet rows exist.
 *   7. The reveals (happy-dom): one puzzle or line at a time with a tab per board, opening on the first not right;
 *      Brimful shows your moves and the fewest as jug pictures with the numbers behind the score; Ballpark draws
 *      every marker paired with its true spot, how far off each was in plain words, and the average, bullseyes and
 *      worst miss; both reveal older stamps' answers too (measureRev 1, numlineRev 1).
 *
 *   bun scripts/number-overhaul-measure-numline-check.ts
 */
import { existsSync, readFileSync } from "node:fs";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { decodeMeasureActions, measureApply, measureLineStates, measureSolved } from "../src/lib/duel/measure";
import { pinPreNumberOverhaul } from "../src/lib/duel/numberOverhaul";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import type { MeasurePuzzleData, NumlinePuzzleData } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};
const src = (path: string) => readFileSync(path, "utf8");
const between = (text: string, from: string, to: string) => {
  const a = text.indexOf(from);
  if (a < 0) return "";
  const b = text.indexOf(to, a + from.length);
  return text.slice(a, b < 0 ? undefined : b);
};

/* ------------------------------------------------------------------ 1. Brimful's best-line pictures */
{
  let boards = 0;
  for (let seed = 0; seed < 40; seed++) {
    const p = withSeededRandom(seed, () => generatePuzzle("measure", { bankSeed: seed })) as MeasurePuzzleData;
    p.boards.forEach((board, i) => {
      const raw = p.solutions?.[i];
      if (!raw) return ok(false, `Brimful ${seed}/${i}: the deal carries its best line`);
      const actions = decodeMeasureActions(raw, board.caps.length);
      const states = measureLineStates(board, raw);
      ok(states.length === actions.length + 1, `Brimful ${seed}/${i}: one picture a move plus the start (${states.length} for ${actions.length})`);
      ok(JSON.stringify(states[0]!.amounts) === JSON.stringify(board.start) && states[0]!.action === null, `Brimful ${seed}/${i}: the first picture is the start`);
      let amounts = [...board.start];
      let same = true;
      actions.forEach((a, k) => {
        const next = measureApply(board, amounts, a);
        if (!next || JSON.stringify(next) !== JSON.stringify(states[k + 1]?.amounts)) same = false;
        if (next) amounts = next;
      });
      ok(same, `Brimful ${seed}/${i}: every picture is measureApply's jugs after its move`);
      ok(measureSolved(board, states[states.length - 1]!.amounts), `Brimful ${seed}/${i}: the last picture reaches the target`);
      boards++;
    });
  }
  ok(boards === 160, `Brimful: 160 boards' best lines drawn (${boards})`);
  // A refused move ends the pictures there (never a made-up state).
  const board = { caps: [3, 5], start: [0, 0], tap: true, goal: "amount" as const, target: 4 };
  ok(measureLineStates(board, "E0").length === 1, "Brimful: a refused first move leaves only the start");
  const reveal = between(src("src/puzzles/measure.tsx"), "function Reveal(", "export const measurePuzzle");
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Number overhaul: the reveal redesign moved
  // the best line into LinePictures, one puzzle at a time; section 7 renders it).
  ok(/<LinePictures key=\{`best-\$\{index\}`\} board=\{b\.board\} raw=\{b\.best\} kind="best" solved \/>/.test(reveal), "Brimful: the reveal draws the best line as jug pictures");
  ok(!/StepChips|routeSteps/.test(src("src/puzzles/measure.tsx")), "Brimful: the reveal no longer lists the moves as chips");
}

/* ------------------------------------------------------------------ 2. Brimful's stage moment and glass */
{
  const s = src("src/puzzles/measure.tsx");
  ok(/<NumberStage type="measure" index=\{stage\} exit=\{exit\}/.test(s), "Brimful: the board sits in the shared stage moment, keyed by board");
  ok(/const exit: StageExit = holding \? "clear" : boardOut && outOfMoves && stage < MEASURE_BOARDS - 1 \? "fail" : null;/.test(s), "Brimful: solved boards clear, boards out of moves fail");
  ok(!/playCorrect/.test(s) && !/<StageCorrect /.test(s), "Brimful: the stage moment is the board's one success sound (no extra correct, no CORRECT line)");
  const effect = between(s, "if (boardOut && stage < MEASURE_BOARDS - 1) {", "return () => clearTimeout(timer);");
  // Changed with Joe's approval, 15 Nov 2026 (Number overhaul brief): the board's own dull thunk (measure.fail).
  ok(effect.length > 0 && !(effect.match(/play[A-Z]\w*\(\)/g) ?? []).length && (effect.match(/soundCue\(/g) ?? []).length === 1 && /soundCue\(stageFailCue\("measure"\)\)/.test(effect), "Brimful: out of moves plays one sound, its own dull thunk (measure.fail)");
  ok(/quiet=\{exit === "fail"\}/.test(s), "Brimful: the fail slide adds no second sound");
  ok(/numberArt\("measure", "jug-front"\)/.test(s) && /className="mj-shell"/.test(s), "Brimful: the glass is the rendered shell in front of the water");
  ok(!/#F5B82E/.test(s), "Brimful: no bright yellow");
}

/* ------------------------------------------------------------------ 3–4. Ballpark: edge bump, one sound, stage moment */
{
  const g = globalThis as unknown as { window?: unknown };
  const cues: string[] = [];
  g.window = {
    dispatchEvent: (e: { type?: string; detail?: { cue?: string } }) => {
      if (e?.type === "duelz-sound") cues.push(String(e.detail?.cue));
      return true;
    },
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  const { numlineEdgeOf, numlinePlaceSound } = await import("../src/puzzles/numline");
  // A 390 px box at x = 10, the tape inset 22 px each side: span 346, so the ends sit at x = 32 and x = 378.
  const left = 10;
  const span = 346;
  ok(numlineEdgeOf(31, left, span) === "lo" && numlineEdgeOf(0, left, span) === "lo", "Ballpark: a touch left of 0 bumps the low end");
  ok(numlineEdgeOf(379, left, span) === "hi" && numlineEdgeOf(500, left, span) === "hi", "Ballpark: a touch right of the top end bumps the high end");
  ok(numlineEdgeOf(32, left, span) === null && numlineEdgeOf(378, left, span) === null && numlineEdgeOf(200, left, span) === null, "Ballpark: the line itself (ends included) never bumps");
  numlinePlaceSound();
  ok(cues.length === 1 && cues[0] === "numline.place", `Ballpark: a place plays one cue (${cues.join(", ")})`);

  const s = src("src/puzzles/numline.tsx");
  const bump = between(s, "const bumpAt = (clientX: number) => {", "\n  };");
  ok(/numlineEdgeOf\(clientX/.test(bump) && /soundCue\("numline\.edge"\)/.test(bump) && /side !== edge\?\.side/.test(bump), "Ballpark: the bump plays numline.edge once per end");
  ok(/setMarker\(Math\.round\(shareAt\(event\.clientX\) \* NUMLINE_SCALE\)\);\n\s+bumpAt\(event\.clientX\);/.test(between(s, "const down = (event", "const up")), "Ballpark: a bump comes with the marker's clamp, never in its place");
  const place = between(s, "const place = () => {", "\n  };");
  ok(/numlinePlaceSound\(\)/.test(place) && !/soundCue\(/.test(place), "Ballpark: place calls only numlinePlaceSound");
  ok(/if \(next\.length < NUMLINE_TOTAL && next\.length % NUMLINE_ITEMS === 0\) setClearing\(stageIndex\);/.test(place), "Ballpark: a finished line (not the last) clears before the next");
  ok(/<NumberStage type="numline" index=\{shownStage\} exit=\{clearing !== null \? "clear" : null\}/.test(s), "Ballpark: the line sits in the shared stage moment");
  ok(!/soundCue\("numline\.line"\)/.test(s), "Ballpark: no second sound when the next line comes in");
  ok(/numberArt\("numline", "ruler"\)/.test(s) && /"pin-placed" : "pin"/.test(s), "Ballpark: the rule and the pins are the rendered pieces");
  ok(/variant="gold"/.test(between(s, 'data-game-controls="actions"', "</Button>")), "Ballpark: Place is the screen's one gold button");
  const css = src("src/polish-layout/batch-w-numline.css");
  ok(!/drop-shadow|text-shadow: 0 0 1|0 0 14px/.test(css), "Ballpark: nothing glows in the live round");
  // Changed the card's size, never its input: a touch on the card still never places (the review fix stands).
  ok(/if \(!numlinePointerAllowed\(event\.target/.test(s), "Ballpark: the number card still takes no input");
}

/* ------------------------------------------------------------------ 5. The deals are unchanged */
{
  const digest = (type: "measure" | "numline", seed: number) =>
    JSON.stringify(withSeededRandom(seed, () => generatePuzzle(type, type === "measure" ? { bankSeed: seed } : {})));
  for (const type of ["measure", "numline"] as const) {
    let same = 0;
    for (let seed = 0; seed < 30; seed++) {
      const live = digest(type, seed);
      const was = pinPreNumberOverhaul(true);
      const old = digest(type, seed);
      pinPreNumberOverhaul(was);
      if (live === old) same++;
    }
    ok(same === 30, `${type}: the overhaul leaves the deal exactly as before (${same} of 30)`);
  }
}

/* ------------------------------------------------------------------ 6. Art and sound slots */
{
  for (const f of ["measure/jug-front", "measure/shelf", "numline/ruler", "numline/card", "numline/pin", "numline/pin-placed"])
    ok(existsSync(`public/number/${f}.webp`), `art: public/number/${f}.webp`);
  for (const f of ["measure.py", "numline.py"]) ok(existsSync(`docs/design/number-overhaul/source/${f}`), `art: its Blender source ${f}`);
  // The material pass (Joe's clarification, 15 Nov 2026): the glass shell draws its middle too (fill), the water is
  // glossy with a meniscus, and Ballpark's card is the rendered lacquer card.
  ok(/\$\{JUG_SLICE\} fill \//.test(src("src/puzzles/measure.tsx")), "Brimful: the glass shell draws its middle (the rendered highlights)");
  ok(/\.mj-surface::after/.test(src("src/puzzles/measure.tsx")) && /\.mj-glass::after/.test(src("src/puzzles/measure.tsx")), "Brimful: the water's meniscus and the glass's crisp highlight");
  ok(/numline\/card\.webp/.test(src("src/polish-layout/batch-w-numline.css")), "Ballpark: the number card is the rendered lacquer card");
  const sheet = src("docs/sound-cues/cue-sheet.csv");
  for (const slot of ["measure.stageClear", "measure.fail", "numline.stageClear", "numline.edge"]) {
    ok(Boolean((SOUND_MANIFEST as Record<string, unknown>)[slot]), `sound: ${slot} in the manifest`);
    ok(sheet.includes(slot), `sound: ${slot} on the cue sheet`);
  }
}

/* ------------------------------------------------------------------ 7. The reveals (happy-dom) */
{
  const { Window } = await import("happy-dom");
  const win = new Window({ url: "https://joulz.uk/practice" });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "localStorage", "sessionStorage", "location", "MutationObserver", "ResizeObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia"] as const) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (win as unknown as Record<string, unknown>)[key] });
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { createElement, act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { measurePuzzle, measureRevealBoards } = await import("../src/puzzles/measure");
  const { numlinePuzzle, numlineRevealLines, numlineOffText } = await import("../src/puzzles/numline");
  const { gradeNumlineItems, encodeNumline } = await import("../src/lib/duel/numline");
  const render = async (Reveal: unknown, puzzle: unknown, answer: string) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host as unknown as Element);
    const props = { puzzle, myAnswer: answer, myCorrect: false, myReactionAvgMs: null, myMsRemaining: 0, timeLimitMs: 120_000 };
    await act(async () => root.render(createElement(Reveal as never, props as never)));
    return { host, done: async () => { await act(async () => root.unmount()); host.remove(); } };
  };
  const tabs = (host: Element) => [...host.querySelectorAll('[role="tab"]')];
  const shown = (host: Element) => host.querySelectorAll('[role="tabpanel"]').length;

  // Brimful: puzzle 1 solved on the fewest line, puzzle 2 two moves in, 3 and 4 not reached.
  for (const [label, era] of [["live", false], ["measureRev 1", true]] as const) {
    const full = withSeededRandom(7, () => generatePuzzle("measure", { bankSeed: 7 })) as MeasurePuzzleData;
    const p: MeasurePuzzleData = era ? ({ ...full, measureRev: 1, minMoves: undefined, moveLimits: undefined } as MeasurePuzzleData) : full;
    const best0 = p.solutions?.[0] ?? "";
    const part1 = (p.solutions?.[1] ?? "").split(",").slice(0, 1).join(",");
    const answer = [best0, part1].join("|");
    const boards = measureRevealBoards(p, answer);
    ok(boards.map((b) => b.mark).join() === "right,wrong,open,open", `Brimful ${label}: verdicts solved, not solved, not reached ×2 (${boards.map((b) => b.mark).join()})`);
    const { host, done } = await render(measurePuzzle.Reveal, p, answer);
    ok(tabs(host).length === 4 && shown(host) === 1, `Brimful ${label}: four tabs, one puzzle shown`);
    ok(tabs(host)[1]?.getAttribute("aria-selected") === "true", `Brimful ${label}: opens on the first puzzle not solved`);
    ok(/Solved/.test(host.textContent ?? "") && /1 of 4/.test(host.textContent ?? ""), `Brimful ${label}: the facts say 1 of 4 solved`);
    ok(/Your moves/.test(host.textContent ?? ""), `Brimful ${label}: your moves are named`);
    const fewestView = host.querySelector('[data-measure-line="best"]');
    ok(!!fewestView, `Brimful ${label}: the fewest-moves line is shown first where the reveal has it`);
    const yoursBtn = [...host.querySelectorAll("button")].find((b) => b.textContent === "Yours");
    await act(async () => (yoursBtn as unknown as HTMLButtonElement | undefined)?.click());
    const yours = host.querySelector('[data-measure-line="yours"]');
    ok(!!yours && yours.querySelectorAll("li").length === 2, `Brimful ${label}: Yours draws the start and your one move`);
    ok(!!yours?.querySelector("li[data-miss]"), `Brimful ${label}: an unsolved line's last picture is marked not solved`);
    await act(async () => (tabs(host)[2] as unknown as HTMLButtonElement)?.click());
    ok(/didn’t reach this puzzle/.test(host.textContent ?? ""), `Brimful ${label}: a puzzle not reached says so, no made-up moves`);
    ok(!/×/.test(host.textContent ?? ""), `Brimful ${label}: no stray ×`);
    await done();
  }

  // Ballpark: line 1 exact, line 2 every marker 3 % off, line 3 two placed.
  for (const [label, era] of [["live", false], ["numlineRev 1", true]] as const) {
    const full = withSeededRandom(11, () => generatePuzzle("numline")) as NumlinePuzzleData;
    const p: NumlinePuzzleData = era ? ({ ...full, numlineRev: 1, depthRev: undefined, timeLimitMs: undefined } as NumlinePuzzleData) : full;
    const truths = gradeNumlineItems(p.stages, p.values ?? [], encodeNumline(new Array(15).fill(0)), p.numlineRev).map((r) => r.truth);
    const off = (t: number) => (t > 5000 ? t - 300 : t + 300);
    const answer = encodeNumline([...truths.slice(0, 5), ...truths.slice(5, 10).map(off), ...truths.slice(10, 12)]);
    const lines = numlineRevealLines(p, answer);
    ok(lines.map((l) => l.mark).join() === "right,wrong,wrong", `Ballpark ${label}: verdicts all close, not, not (${lines.map((l) => l.mark).join()})`);
    ok(numlineOffText({ placement: 10, error: 0.024, bull: false }) === "2.4% off" && numlineOffText({ placement: null, error: null, bull: false }) === "Not placed", "Ballpark: how far off, in plain words");
    const { host, done } = await render(numlinePuzzle.Reveal, p, answer);
    ok(tabs(host).length === 3 && shown(host) === 1, `Ballpark ${label}: three tabs, one line shown`);
    ok(tabs(host)[1]?.getAttribute("aria-selected") === "true", `Ballpark ${label}: opens on the first line not all close`);
    const pairs = [...host.querySelectorAll("[data-reveal-pair]")];
    ok(pairs.length === 5 && pairs.every((g) => g.querySelectorAll("line").length === 2), `Ballpark ${label}: each of the five markers is joined to its true spot`);
    const rows = [...host.querySelectorAll(".nl-reveal-row")];
    ok(rows.length === 5 && rows.every((r) => /3\.0% off/.test(r.textContent ?? "")), `Ballpark ${label}: each number says how far off it was (${rows.map((r) => r.textContent).join(" | ")})`);
    ok(/Average off/.test(host.textContent ?? "") && /Worst miss/.test(host.textContent ?? ""), `Ballpark ${label}: the average and the worst miss explain the score`);
    ok(/Bullseyes/.test(host.textContent ?? "") === !era, `Ballpark ${label}: bullseyes counted where the stamp scores them`);
    await act(async () => (tabs(host)[2] as unknown as HTMLButtonElement)?.click());
    ok(host.querySelectorAll("[data-reveal-pair] circle").length >= 5 && [...host.querySelectorAll(".nl-reveal-row")].filter((r) => /Not placed/.test(r.textContent ?? "")).length === 3, `Ballpark ${label}: unplaced numbers say so and draw no marker`);
    await act(async () => (tabs(host)[0] as unknown as HTMLButtonElement)?.click());
    ok([...host.querySelectorAll(".nl-reveal-row")].every((r) => r.hasAttribute("data-close")), `Ballpark ${label}: exact markers read as close`);
    ok(!/×/.test(host.textContent ?? ""), `Ballpark ${label}: no stray ×`);
    await done();
  }
}

console.log(`number-overhaul-measure-numline-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`FAIL summary: ${failures.length} failed`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
