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
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Number overhaul): the ruler is three slices
  // (only the plain middle stretches, sideways), no longer one stretched rod.
  ok(/data-numline-ruler/.test(s) && /fill=\{`url\(#\$\{id\}-steel\)`\}/.test(s) && /fill=\{fill\} stroke="#1a1b21"/.test(s), "Ballpark: the old steel tape and gradient pins (Joe's pick, 20 Nov 2026)"); // Changed with Joe's approval, 21 Nov 2026
  ok(/variant="gold"/.test(between(s, 'data-game-controls="actions"', "</Button>")), "Ballpark: Place is the screen's one gold button");
  const css = src("src/polish-layout/batch-w-numline.css");
  ok(/text-shadow: 0 0 18px/.test(css) && /g\.numline-drop/.test(css), "Ballpark: the old lit card and glowing pins in the live round"); // Changed with Joe's approval, 21 Nov 2026
  // Changed the card's size, never its input: a touch on the card still never places (the review fix stands).
  ok(/if \(!numlinePointerAllowed\(event\.target/.test(s), "Ballpark: the number card still takes no input");
}

/* ------------------------------------------------------------------ 5. The deals are unchanged */
{
  const digest = (type: "measure" | "numline", seed: number) =>
    // Changed with Joe's approval, 15 Nov 2026 (too-hard games: today's becomes Hard): Brimful's overhaul-era game is
    // dealt at Hard now (measureLevels.ts; Normal is the new measureRev 5 game), so its deal is compared there.
    // D2 (22 Nov 2026): Brimful's Hard has its own boards now, so today's game is reached by its pin at Normal. // Changed with Joe's approval, 22 Nov 2026
    JSON.stringify(withSeededRandom(seed, () => (type === "measure" ? generatePuzzle(type, { bankSeed: seed }, { pins: ["preMeasureLevels"] }) : generatePuzzle(type, {})))); // Changed with Joe's approval, 22 Nov 2026
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
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Number overhaul): the ruler ships as its three slices.
  for (const f of ["measure/jug-front", "measure/shelf", "numline/ruler-l", "numline/ruler-m", "numline/ruler-r", "numline/card", "numline/pin", "numline/pin-placed"])
    ok(existsSync(`public/number/${f}.webp`), `art: public/number/${f}.webp`);
  for (const f of ["measure.py", "numline.py"]) ok(existsSync(`docs/design/number-overhaul/source/${f}`), `art: its Blender source ${f}`);
  // The material pass (Joe's clarification, 15 Nov 2026): the glass shell draws its middle too (fill), the water is
  // glossy with a meniscus, and Ballpark's card is the rendered lacquer card.
  ok(/\$\{JUG_SLICE\} fill \//.test(src("src/puzzles/measure.tsx")), "Brimful: the glass shell draws its middle (the rendered highlights)");
  ok(/\.mj-surface::after/.test(src("src/puzzles/measure.tsx")) && /\.mj-glass::after/.test(src("src/puzzles/measure.tsx")), "Brimful: the water's meniscus and the glass's crisp highlight");
  ok(!/numline\/card\.webp/.test(src("src/polish-layout/batch-w-numline.css")) && /\.numline-card \{[\s\S]*radial-gradient/.test(src("src/polish-layout/batch-w-numline.css")), "Ballpark: the number card is the old lit card"); // Changed with Joe's approval, 21 Nov 2026
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

/* ------------------------------------------------------------------ 8. Ballpark's proportions (the layout pass) */
// Joe, 15 Nov 2026: the line is the big element (a tall ruler, bold end labels, a big pin), the card small and compact.
{
  const { numlineLiveSizes, NUMLINE_CARD_H } = await import("../src/puzzles/numline");
  for (const arenaH of [430, 520, 600, 680]) {
    const z = numlineLiveSizes(arenaH);
    ok(z.t >= 72 && z.t > 40, `Ballpark ${arenaH}: the ruler is much thicker than the first pass's 40 px (${z.t})`);
    ok(z.lineH >= 4 * z.cardH && z.cardH === NUMLINE_CARD_H && z.cardH <= 60, `Ballpark ${arenaH}: the line box is at least four times the compact card (${z.lineH} vs ${z.cardH})`);
    ok(z.lineH + z.cardH + 56 <= Math.max(arenaH, 250 + z.cardH + 56), `Ballpark ${arenaH}: card and line fit the arena (${z.lineH + z.cardH + 56} in ${arenaH})`);
    ok(z.label >= 34 && z.cardFont <= 40 && z.cardFont >= 32, `Ballpark ${arenaH}: bold end labels (${z.label} px) and a 32–40 px number (${z.cardFont} px)`);
    ok(z.pinR >= 20 && z.pinRise >= 2 * z.pinR, `Ballpark ${arenaH}: a big pin (r ${z.pinR}) standing clear of the tape`);
    ok(z.yShare > 0.5 && z.yShare < 1, `Ballpark ${arenaH}: the tape sits low in its box, room above for the pins`);
  }
  const src = readFileSync("src/puzzles/numline.tsx", "utf8");
  // D2: no minor ticks on the live ruler unless a level's line marks them (Easy's numbered tenths, stored as marks). Changed with Joe's approval, 22 Nov 2026
  ok(/minor=\{stage\.marks \?\? 0\}/.test(src), "Ballpark: the live ruler has no minor ticks unless a level marks them (the old steel tape)"); // Changed with Joe's approval, 21 Nov 2026; 22 Nov 2026
  ok(/height: 56px;/.test(readFileSync("src/polish-layout/batch-w-numline.css", "utf8")), "Ballpark: the card is compact (56 px)");
}

/* ------------------------------------------------------------------ 9. Stage 2 effects (the effects kit) */
// The helpers the effects read, the kit calls in the stages, and that nothing an effect touches is graded.
{
  const fx = await import("../src/lib/duel/measureFx");
  const { numlineTenthsCrossed, numlinePayoffPlan, NUMLINE_PAYOFF_STEP_MS, NUMLINE_PAYOFF_START_MS } = await import("../src/lib/duel/numlineFx");
  const { measureActions, measureApply, measureSolved, replayMeasure } = await import("../src/lib/duel/measure");
  const { isStdBullseye } = await import("../src/lib/duel/standard/number");
  // Brimful: one move from the target, over real dealt boards and every state one or two moves from the start.
  let nearChecked = 0;
  let nearFound = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const p = withSeededRandom(seed, () => generatePuzzle("measure")) as MeasurePuzzleData;
    for (const board of p.boards) {
      const states: number[][] = [[...board.start]];
      for (const a of measureActions(board)) {
        const n1 = measureApply(board, board.start, a);
        if (!n1) continue;
        states.push(n1);
        for (const b of measureActions(board)) {
          const n2 = measureApply(board, n1, b);
          if (n2) states.push(n2);
        }
      }
      // The stored best line's states: the one before its last move is always one move from the target.
      const best = p.solutions?.[p.boards.indexOf(board)];
      if (best) {
        let at = [...board.start];
        for (const a of decodeMeasureActions(best, board.caps.length)) {
          const n = measureApply(board, at, a);
          if (!n) continue;
          states.push(n);
          at = n;
        }
      }
      const lines = fx.measureTargetLines(board);
      for (const st of states) {
        nearChecked++;
        const near = fx.measureNearJugs(board, st);
        // The truth by brute force: some single move solves the board, and those jugs land on their line.
        const want = new Set<number>();
        if (!measureSolved(board, st))
          for (const a of measureActions(board)) {
            const n = measureApply(board, st, a);
            if (n && measureSolved(board, n)) n.forEach((v, j) => { if (v !== st[j] && lines[j] !== null && v === lines[j]) want.add(j); });
          }
        if (near.length) nearFound++;
        if (near.join() !== [...want].sort((a, b) => a - b).join()) { ok(false, `Brimful ${seed}: one-move hint ${near.join()} vs ${[...want].join()} at ${st.join(",")}`); break; }
      }
      ok(fx.measureNearJugs(board, replayMeasure(board, (p.solutions?.[p.boards.indexOf(board)] ? decodeMeasureActions(p.solutions[p.boards.indexOf(board)]!, board.caps.length) : [])).amounts).length === 0, `Brimful ${seed}: a solved board gives no hint`);
    }
  }
  ok(nearChecked > 1000 && nearFound > 20, `Brimful: the one-move hint checked on ${nearChecked} states, found on ${nearFound}`);
  ok(fx.measureFillPlays(1) === 1 && fx.measureFillPlays(4) === 1 && fx.measureFillPlays(5) === 2 && fx.measureFillPlays(8) === 2 && fx.measureFillPlays(9) === 3 && fx.measureFillPlays(14) === 3 && fx.measureFillPlays(0) === 1, "Brimful: the tap's running water is sized to the amount (1 / 2 / 3 plays)");
  const ms = src("src/puzzles/measure.tsx");
  ok(/gameFx\("pickUp", glassOf\(jug\), \{ silent: true \}\)/.test(ms), "Brimful: a picked jug lifts with the kit (pickUp, the game's cue plays the sound)");
  ok(/gameFx\("pour", source, \{ tilt: jug > from \? 28 : -28, silent: true \}\)/.test(ms), "Brimful: the pour tilts the jug towards the one it pours into (pour)");
  ok(/gameFx\("tap", liquidOf\(jug\), \{ silent: true \}\)/.test(ms), "Brimful: the receiving water settles (tap at the liquid's foot)");
  ok(/gameFx\("match", flash, \{ silent: true \}\)/.test(ms) && /soundCue\("measure\.target"\)/.test(ms), "Brimful: a jug on its target line flashes the line (match) with the plink");
  ok(/gameFx\("nearMiss", glassOf\(near\[0\]!\), \{ silent: true \}\)/.test(ms) && /soundCue\("measure\.near"\)/.test(ms), "Brimful: one move from the target, the matching jug pulses a hint (nearMiss)");
  ok(/measureFillPlays\(/.test(ms) && /soundCue\("measure\.fill"\)/.test(ms), "Brimful: the fill sound plays sized to the litres added");
  // Ballpark: the drag tick.
  ok(numlineTenthsCrossed(0.05, 0.08) === 0 && numlineTenthsCrossed(0.08, 0.12) === 1 && numlineTenthsCrossed(0.12, 0.08) === 1 && numlineTenthsCrossed(0.05, 0.55) === 5 && numlineTenthsCrossed(0, 1) === 10 && numlineTenthsCrossed(-1, 2) === 10, "Ballpark: the tenths a drag crosses");
  const ns = src("src/puzzles/numline.tsx");
  ok(/numlineTenthsCrossed\(marker \/ NUMLINE_SCALE, nextShare\) > 0\) soundCue\("numline\.dragTick"\)/.test(ns), "Ballpark: a faint tick as the marker crosses a tenth");
  ok(/gameFx\("drop", lineBox\.current\?\.querySelector\(`\[data-numline-placed=/.test(ns), "Ballpark: the placed pin stamps in with the kit (drop)");
  // Ballpark's payoff: placed numbers in order, a step apart; bullseyes on the stamp's own threshold sparkle.
  const plan = numlinePayoffPlan([{ placement: 10, bull: true }, { placement: null, bull: false }, { placement: 400, bull: false }, { placement: 900, bull: true }]);
  ok(plan.map((x) => `${x.index}@${x.delayMs}${x.bull ? "*" : ""}`).join(" ") === `0@${NUMLINE_PAYOFF_START_MS}* 2@${NUMLINE_PAYOFF_START_MS + NUMLINE_PAYOFF_STEP_MS} 3@${NUMLINE_PAYOFF_START_MS + 2 * NUMLINE_PAYOFF_STEP_MS}*`, `Ballpark: the payoff's order and timing (${plan.map((x) => `${x.index}@${x.delayMs}`).join(" ")})`);
  ok(isStdBullseye(0.01) && !isStdBullseye(0.011), "Ballpark: a bullseye is within 1 % (the stamp's own rule the reveal rows carry)");
  ok(/gameFx\("slide", el, \{ from:/.test(ns) && /gameFx\("stars", ring,/.test(ns) && /soundCue\("numline\.bullseye"\)/.test(ns) && /<FxCountUp value=\{all\.filter\(\(r\) => r\.bull\)\.length\}/.test(ns), "Ballpark: the reveal's payoff (true spots fly in, bullseyes sparkle, the count climbs)");
  // Effects never reach the graders: the grading and dealing modules don't import the effects.
  for (const path of ["src/lib/duel/grade.ts", "src/lib/duel/measure.ts", "src/lib/duel/numline.ts", "src/lib/duel/standard/number.server.ts"])
    ok(!/measureFx|numlineFx|fx\/kit/.test(src(path)), `${path}: never reads an effect`);
  ok(!/gameFx|soundCue|import/.test(src("src/lib/duel/measureFx.ts").replace(/^import .*$/gm, "")) && !/kit|sound/.test(src("src/lib/duel/numlineFx.ts")), "The effect helpers are pure (no kit, no sound)");
}

console.log(`number-overhaul-measure-numline-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`FAIL summary: ${failures.length} failed`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
