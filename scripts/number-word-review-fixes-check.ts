/**
 * number-word-review-fixes-check (15 Nov 2026, the Number and Word game reviews, docs/design/game-reviews/number.md and
 * word.md): the fixes that needed no design decision, each with the assertion that would have caught it.
 *
 * NUMBER
 *   1. Counterweight: out of hangs plays the fail sound (`wrong`), never the balanced one; help says notches.
 *   2. Exact: no Lock before the first step (button and Enter).
 *   3. Operator / Integer Pyramid / Brimful: a skip never plays the stage-complete moment (StageProgress `quiet`,
 *      rendered in happy-dom); Operator's skip plays the neutral move tick.
 *   4. Integer Pyramid: a full but wrong pyramid marks the stones that break a sum and shakes; Skip reads Finish on
 *      the last board.
 *   5. Brimful measureRev 4 (gameReviewNov15.ts): out of moves ends only that puzzle; the server grades the later
 *      boards; measureRev 3 (pinned) grades exactly as before (later boards after the first unsolved one ignored);
 *      help says Reset is free and what running out does.
 *   6. Checkout: one sign for a negative wedge's dart; the auto-advance timer is cleared on unmount.
 *   7. Ballpark: only the line takes placement input; one sound a place.
 * WORD
 *   8. Nucleus and Forage: "1 word" on the round end.
 *   9. Interlock: help describes the red runs after Done; the fallback board lays out (the old one never could).
 *  10. Slider: Undo and Reset fire on click; the found-word chip skips rows that were words when the stage opened.
 *  11. Forage: help says tapping the last letter takes it off; one error sound for an invalid word.
 *  12. Lookout: re-dragging a found word is silent, the bonus plays one `correct`; help matches the screen.
 *  13. Roundabout: a bonus word plays a positive sound; a harmless repeat is silent.
 *  14. Strikeout: a refused solve gets the soft reject, never `wrong`.
 *  15. Cryptogrid: after a wrong full grid the status line says so (not "Checking…" for ever).
 *
 *   bun scripts/number-word-review-fixes-check.ts
 */
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { MEASURE_REV_BOARD_OUT, measureBoardOut, pinPreGameReviewNov15 } from "../src/lib/duel/gameReviewNov15";
import { decodeMeasureActions, encodeMeasureAction, measureActions, measureApply, measureSolved, splitMeasureRound, type MeasureAction } from "../src/lib/duel/measure";
import { measureMoveLimits } from "../src/lib/duel/moveLimits";
import { npBrokenCells, npBuild, npIndex } from "../src/lib/duel/numberPyramid";
import { checkoutDartTerm } from "../src/lib/duel/checkout";
import { checkLetterWheelWord } from "../src/lib/duel/letterWheel";
import { tileGridFallbackCells, TILEGRID_FALLBACK, tileGridValid } from "../src/lib/duel/tileGrid.server";
import { placedCount, TG_TILES } from "../src/lib/duel/tileGrid";
import { PRACTICE_STAMPS } from "../src/lib/duel/practiceStamps.data";
import type { CheckoutStageData, MeasurePuzzleData, PuzzleData } from "../src/lib/duel/types";

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
/** The text of the first block in `text` that starts at `from` and ends at `to` (exclusive). */
const between = (text: string, from: string, to: string) => {
  const a = text.indexOf(from);
  if (a < 0) return "";
  const b = text.indexOf(to, a + from.length);
  return b < 0 ? text.slice(a) : text.slice(a, b);
};
const helpText = (type: keyof typeof PUZZLE_INSTRUCTIONS) => {
  const ins = PUZZLE_INSTRUCTIONS[type];
  return [ins.goal, ...ins.how.map((l) => `${l.action} ${l.detail}`)].join("\n");
};

/* ------------------------------------------------------------------ 1. Counterweight */
{
  const s = src("src/puzzles/balance.tsx");
  const outOfHangs = between(s, "if (!outOfHangs || current >= total - 1", "}, [outOfHangs");
  ok(outOfHangs.length > 0, "Counterweight: the out-of-hangs effect is found");
  ok(/playWrong\(\)/.test(outOfHangs), "Counterweight: out of hangs plays the fail sound (playWrong)");
  ok(!/balance\.level|playCorrect|stage_complete/.test(outOfHangs), "Counterweight: out of hangs never plays the balanced / success sound");
  const help = helpText("balance");
  ok(!/\bpegs?\b/i.test(help), `Counterweight: the help says notches, not peg (${help.match(/.*\bpeg.*/i)?.[0] ?? ""})`);
  ok(/notch/i.test(help), "Counterweight: the help names the notches");
}

/* ------------------------------------------------------------------ 2. Exact */
{
  const s = src("src/puzzles/targetNumber.tsx");
  const lock = between(s, "onClick={() => { if (steps.length > 0) send(steps); }}", "data-exact-lock");
  ok(/disabled=\{isLockedNow \|\| steps\.length === 0\}/.test(lock), "Exact: Lock is disabled until there is a step");
  ok(/else if \(steps\.length > 0\) send\(steps\);/.test(s), "Exact: Enter locks only once there is a step");
  ok(!/onClick=\{\(\) => send\(steps\)\}/.test(s), "Exact: no unguarded Lock click left");
}

/* ------------------------------------------------------------------ 3. Skips are quiet (StageProgress in happy-dom) */
{
  const win = new Window({ url: "https://joulz.uk/practice" });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "localStorage", "sessionStorage", "location", "MutationObserver"] as const) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (win as unknown as Record<string, unknown>)[key] });
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { createElement, act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { StageProgress } = await import("../src/components/puzzles/StageProgress");
  const { FX_EVENT } = await import("../src/lib/fx");
  let glows = 0;
  window.addEventListener(FX_EVENT, (e) => {
    if ((e as CustomEvent<{ hook: string }>).detail?.hook === "onStageComplete") glows++;
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as Element);
  const wait = () => new Promise((r) => setTimeout(r, 80));
  await act(async () => root.render(createElement(StageProgress, { stage: 0, total: 4 })));
  await act(async () => root.render(createElement(StageProgress, { stage: 1, total: 4 })));
  await wait();
  ok(glows === 1, `StageProgress: a completed stage plays the stage-complete moment once (${glows})`);
  await act(async () => root.render(createElement(StageProgress, { stage: 2, total: 4, quiet: true })));
  await wait();
  ok(glows === 1, `StageProgress: a skipped stage (quiet) plays no stage-complete moment (${glows})`);
  await act(async () => root.render(createElement(StageProgress, { stage: 3, total: 4 })));
  await wait();
  ok(glows === 2, `StageProgress: the next completed stage plays it again (${glows})`);
  await act(async () => root.unmount());

  for (const [path, test] of [
    ["src/puzzles/equation.tsx", /<StageProgress stage=\{stage\} total=\{total\} quiet=\{stage > 0 && !equationStageCorrect\(/],
    ["src/puzzles/equationGaps.tsx", /<StageProgress stage=\{stage\} total=\{total\} quiet=\{stage > 0 && !gapStageCorrect\(/],
    ["src/puzzles/numberPyramid.tsx", /<StageProgress stage=\{stage\} total=\{NP_SET_SIZE\} quiet=\{stage > 0 && [^\n]*!npComplete\(/],
    ["src/puzzles/measure.tsx", /<StageProgress stage=\{stage\} total=\{MEASURE_BOARDS\} quiet=\{[^\n]*\.solved\} \/>/],
  ] as const) ok(test.test(src(path)), `${path}: an unsolved stage moves on quietly`);
  for (const path of ["src/puzzles/equation.tsx", "src/puzzles/equationGaps.tsx"]) {
    const adv = between(src(path), 'soundCue("equation.advance");', "};");
    ok(/playSound\("move"\)/.test(adv), `${path}: Operator's skip plays the neutral move tick`);
    ok(!/correct|stage_complete|playCorrect/.test(adv.replace(/StageCorrect|equationStageCorrect|gapStageCorrect/g, "")), `${path}: Operator's skip plays no solve sound`);
  }
}

/* ------------------------------------------------------------------ 4. Integer Pyramid */
{
  const rows = 5;
  const solution = npBuild([3, 5, 2, 8, 4]);
  // The bottom two rows were the gaps; the player put a decoy (one too many) on the bottom-left stone.
  const givens: (number | null)[] = solution.map((v, i) => (i >= npIndex(3, 0) ? null : v));
  const wrong = [...solution] as (number | null)[];
  const a = npIndex(4, 0), b = npIndex(4, 1), above = npIndex(3, 0);
  wrong[a] = solution[a]! + 1;
  const broken = npBrokenCells(givens, wrong, rows);
  ok(broken.includes(a) && broken.includes(b) && broken.includes(above), `Integer Pyramid: the decoy and the stones in its sum are marked (${broken.join(",")})`);
  ok(broken.length === 3, `Integer Pyramid: only the broken sum's stones are marked (${broken.join(",")})`);
  ok(broken.every((c) => givens[c] == null), "Integer Pyramid: only placed stones are marked, never a given");
  ok(npBrokenCells(givens, solution, rows).length === 0, "Integer Pyramid: a right pyramid marks nothing");
  ok(npBrokenCells(givens, solution.map((v, i) => (i === a ? null : v)), rows).length === 0, "Integer Pyramid: a sum with an empty stone is not judged");
  const s = src("src/puzzles/numberPyramid.tsx");
  ok(/const fullWrong = !!board && !complete && fullValues\.every\(\(v\) => v != null\);/.test(s), "Integer Pyramid: a full, incomplete pyramid is detected");
  ok(/wrongMoveFlash\(/.test(between(s, "useEffect(() => {\n    if (fullWrongKey", "}, [fullWrongKey")), "Integer Pyramid: a full wrong pyramid gets the wrong-move shake and its quiet sound");
  ok(/marks: Object\.fromEntries\(broken\.map/.test(s), "Integer Pyramid: the broken stones are drawn red (marks)");
  ok(/\{stage >= NP_SET_SIZE - 1 \? "Finish" : "Skip"\}/.test(s), "Integer Pyramid: Skip reads Finish on the last board");
}

/* ------------------------------------------------------------------ 5. Brimful measureRev 4 */
{
  const deal = (seed: number, pinned: boolean) => {
    const before = pinPreGameReviewNov15(pinned);
    try {
      return withSeededRandom(seed, () => generatePuzzle("measure", { bankSeed: seed })) as MeasurePuzzleData;
    } finally {
      pinPreGameReviewNov15(before);
    }
  };
  const live = deal(4101, false);
  const old = deal(4101, true);
  ok(live.measureRev === MEASURE_REV_BOARD_OUT && measureBoardOut(live), `Brimful: rooms deal measureRev 4 (${live.measureRev})`);
  ok(old.measureRev === 3 && !measureBoardOut(old), `Brimful: the pin deals measureRev 3 (${old.measureRev})`);
  const { measureRev: _a, ...liveRest } = live as unknown as Record<string, unknown>;
  const { measureRev: _b, ...oldRest } = old as unknown as Record<string, unknown>;
  ok(JSON.stringify(liveRest) === JSON.stringify(oldRest), "Brimful: measureRev is the only difference from the older deal");
  ok(PRACTICE_STAMPS.measure.includes("measureRev=4"), `Brimful: practice stamps carry measureRev 4 (${PRACTICE_STAMPS.measure})`);

  /** Legal moves on `board` that never solve it, until its limit is used up. */
  const exhaust = (p: MeasurePuzzleData, i: number): MeasureAction[] => {
    const board = p.boards[i]!;
    const limit = measureMoveLimits(p)![i]!;
    let amounts = [...board.start];
    const out: MeasureAction[] = [];
    const all = measureActions(board).filter((x) => x.kind !== "reset");
    let k = 0;
    while (out.length < limit && k < 10_000) {
      const action = all[k++ % all.length]!;
      const next = measureApply(board, amounts, action);
      if (!next || measureSolved(board, next)) continue;
      amounts = next;
      out.push(action);
    }
    return out;
  };
  const enc = (actions: MeasureAction[]) => actions.map(encodeMeasureAction).join(",");
  const limitMs = puzzleTimeLimitMs(live);
  let boardOutRuns = 0;
  for (const seed of [4101, 4102, 4103, 4104, 4105, 4106]) {
    const p = deal(seed, false);
    const q = deal(seed, true);
    const sol = p.solutions ?? [];
    const first = exhaust(p, 0);
    if (first.length !== measureMoveLimits(p)![0]) continue;
    boardOutRuns++;
    // Puzzle 1 run out of moves, then puzzles 2 and 3 solved.
    const answer = [enc(first), sol[1] ?? "", sol[2] ?? "", ""].join("|");
    const g = gradeAnswer(p, answer, limitMs - 40_000);
    ok(g.correctCount === 2, `Brimful ${seed}: measureRev 4 grades the puzzles after one out of moves (${g.correctCount} solved)`);
    ok(g.score > 0 && !g.isCorrect, `Brimful ${seed}: measureRev 4 scores them, unfinished (${g.score})`);
    // measureRev 3: exactly as before, the run ended at puzzle 1, so the later boards count for nothing.
    const gq = gradeAnswer(q, answer, limitMs - 40_000);
    const stripped = gradeAnswer(q, [enc(first), "", "", ""].join("|"), limitMs - 40_000);
    ok(gq.correctCount === 0, `Brimful ${seed}: measureRev 3 closes every board after the first out of moves (${gq.correctCount})`);
    ok(gq.score === stripped.score && JSON.stringify(gq.extra) === JSON.stringify(stripped.extra), `Brimful ${seed}: measureRev 3 ignores the later boards' actions exactly (${gq.score} vs ${stripped.score})`);
    // A board unsolved but NOT out of moves still closes the rest on measureRev 4 (the clock ran out there).
    const short = [enc(first.slice(0, 2)), sol[1] ?? "", "", ""].join("|");
    const gs = gradeAnswer(p, short, limitMs - 40_000);
    ok(gs.correctCount === 0, `Brimful ${seed}: an open, unsolved board still ends the run (${gs.correctCount})`);
    // Every solved run grades the same on both stamps (the boards, limits and numbers are rev 3's).
    const full = sol.join("|");
    const gf = gradeAnswer(p, full, limitMs - 30_000), gqf = gradeAnswer(q, full, limitMs - 30_000);
    ok(gf.score === gqf.score && gf.isCorrect && gqf.isCorrect, `Brimful ${seed}: a full solve scores the same on both stamps (${gf.score} / ${gqf.score})`);
  }
  ok(boardOutRuns >= 4, `Brimful: at least 4 seeds ran a board out of moves (${boardOutRuns})`);
  ok(decodeMeasureActions(splitMeasureRound("|")[0] ?? "", 2).length === 0, "Brimful: an empty board decodes to no moves");
  const s = src("src/puzzles/measure.tsx");
  const effect = between(s, "if (!outOfMoves || locked || submitted.current) return undefined;", "}, [outOfMoves");
  ok(/if \(boardOut && stage < MEASURE_BOARDS - 1\)/.test(effect) && /setStage\(stage \+ 1\)/.test(effect), "Brimful: the phone moves on to the next puzzle when one runs out (measureRev 4)");
  ok(/playWrong\(\)/.test(effect), "Brimful: running out plays the fail sound");
  const help = helpText("measure");
  ok(!/Every action\b/.test(help) && /Reset[^\n]*costs no move/.test(help), "Brimful: the help says Reset is not a move");
  ok(/that puzzle ends and the next one starts/.test(help), "Brimful: the help says running out ends only that puzzle");
}

/* ------------------------------------------------------------------ 6. Checkout */
{
  const stage = { wedges: [20, -7, 5] } as unknown as CheckoutStageData;
  const neg = checkoutDartTerm(stage, { wedge: 1, ring: 2 });
  ok(!/[−-].*[−-]/.test(neg) && /^\+\s?D7$/.test(neg.replace(/ /g, " ")), `Checkout: a negative wedge's dart has one sign ("${neg}")`);
  const pos = checkoutDartTerm(stage, { wedge: 0, ring: 3 });
  ok(/^−\sT20$/.test(pos.replace(/ /g, " ")), `Checkout: a positive dart reads − T20 ("${pos}")`);
  const s = src("src/puzzles/checkout.tsx");
  ok(/useEffect\(\(\) => \(\) => \{\n\s+if \(advanceTimer\.current\) clearTimeout\(advanceTimer\.current\);/.test(s), "Checkout: the auto-advance timer is cleared on unmount");
  ok(/advanceTimer\.current = setTimeout\(/.test(s) && !/\n\s+setTimeout\(\(\) => \{\n\s+setCorrect\(false\);/.test(s), "Checkout: the auto-advance goes through the cleared timer");
  ok(/\{checkoutDartTerm\(current, d\)\}/.test(s), "Checkout: the score line draws checkoutDartTerm");
}

/* ------------------------------------------------------------------ 7. Ballpark */
{
  const { numlinePointerAllowed } = await import("../src/puzzles/numline");
  const card = document.createElement("div");
  card.setAttribute("data-numline-item", "");
  const inner = document.createElement("span");
  card.appendChild(inner);
  const lineEl = document.createElement("div");
  ok(!numlinePointerAllowed(inner as unknown as Element, 500, 300), "Ballpark: a touch on the number card never places");
  ok(!numlinePointerAllowed(lineEl as unknown as Element, 200, 300), "Ballpark: a touch above the line never places");
  ok(numlinePointerAllowed(lineEl as unknown as Element, 320, 300), "Ballpark: a touch on the line places");
  const s = src("src/puzzles/numline.tsx");
  const place = between(s, "const place = () => {", "if (next.length >= NUMLINE_TOTAL)");
  ok(!/playTick|fx\.onPlace/.test(place) && /numlinePlaceSound\(\)/.test(place), "Ballpark: a place plays one sound (no extra tick or place sound)");
  const sound = between(s, "export function numlinePlaceSound", "\n}");
  ok(!/playTick|fx\.onPlace|playSound/.test(sound), "Ballpark: the place adds only its pop and its own cue to the draft's move");
  ok(/numlinePointerAllowed\(event\.target/.test(between(s, "const down = (event", "const move")), "Ballpark: the pointer-down goes through numlinePointerAllowed");
}

/* ------------------------------------------------------------------ 8. Nucleus and Forage: one word */
{
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { wordsmithPuzzle } = await import("../src/puzzles/wordsmith");
  const { wordHuntPuzzle } = await import("../src/puzzles/wordHunt");
  const ws = withSeededRandom(31, () => generatePuzzle("wordsmith", { bankSeed: 31 })) as PuzzleData & { words?: { word: string }[] };
  const wh = withSeededRandom(31, () => generatePuzzle("wordhunt", { bankSeed: 31 })) as PuzzleData & { words?: { word: string }[] };
  for (const [name, def, puzzle] of [["Nucleus", wordsmithPuzzle, ws], ["Forage", wordHuntPuzzle, wh]] as const) {
    const one = puzzle.words?.[0]?.word ?? "WORD";
    const html1 = renderToStaticMarkup(createElement(def.Reveal, { puzzle, myAnswer: one, myExtra: {} } as never));
    const html2 = renderToStaticMarkup(createElement(def.Reveal, { puzzle, myAnswer: `${one},${puzzle.words?.[1]?.word ?? "MORE"}`, myExtra: {} } as never));
    ok(/>1 word</.test(html1) && !/>1 words</.test(html1), `${name}: the round end says "1 word"`);
    ok(/>2 words</.test(html2), `${name}: two finds say "2 words"`);
  }
}

/* ------------------------------------------------------------------ 9. Interlock */
{
  const help = helpText("tilegrid");
  ok(!/Red runs need fixing/.test(help) && /After Done/.test(help) && /flash red/.test(help), "Interlock: the help says bad runs flash red after Done");
  const cells = tileGridFallbackCells();
  ok(cells !== null, "Interlock: the fallback board lays out");
  ok(!!cells && placedCount(cells) === TG_TILES, `Interlock: the fallback board has ${TG_TILES} tiles (${cells ? placedCount(cells) : 0})`);
  ok(!!cells && tileGridValid(cells), "Interlock: the fallback board is a valid crossword");
  ok(TILEGRID_FALLBACK.length === 3 && TILEGRID_FALLBACK.filter((p) => p.horizontal).length === 1, "Interlock: the fallback is an H (one across, two down)");
  // The old fallback (PLANETS across row 2, COMPLEX down column 0) crossed P with M, so it could never lay out: it
  // never dealt a board, and replacing it changes no dealt or stored puzzle.
  ok("complex"[2] !== "planets"[0], "Interlock: the old fallback could never lay out (P crossed M)");
}

/* ------------------------------------------------------------------ 10. Slider */
{
  const s = src("src/puzzles/wordSlide.tsx");
  ok(/onClick=\{\(\) => push\("U"\)\}/.test(s) && /onClick=\{\(\) => push\("X"\)\}/.test(s), "Slider: Undo and Reset fire on click (release)");
  ok(!/onPointerDown=\{\(\) => push\("[UX]"\)\}/.test(s), "Slider: Undo and Reset never fire on touch-down");
  ok(/if \(v\.valid && !openingWords\.current\?\.has\(word\)\) setAccepted\(/.test(s), "Slider: rows that were words at the stage's open are not re-announced");
}

/* ------------------------------------------------------------------ 11. Forage */
{
  const help = helpText("wordhunt");
  ok(/Tapping the last letter again takes it off the word/.test(help) && !/also submits the word/.test(help), "Forage: the help says tapping the last letter takes it off");
  const s = src("src/components/puzzles/WordHuntPuzzle.tsx");
  const invalid = between(s, "    } else {\n      setFlash(\"bad\");", "setMessage(verdict.reason");
  ok(/puzzleReject\(gridRef\.current, false\)/.test(invalid), "Forage: an invalid word's shake is silent (the check's `wrong` is its one sound)");
}

/* ------------------------------------------------------------------ 12. Lookout */
{
  const { wordSearchVerdictSound, wordSearchPuzzle } = await import("../src/puzzles/wordSearch");
  ok(wordSearchVerdictSound({ valid: false, reason: "Already found" }) === null, "Lookout: re-dragging a found word plays nothing");
  ok(wordSearchVerdictSound({ valid: false, reason: "Not a word" }) === "wrong", "Lookout: a drag that is no word plays `wrong`");
  ok(wordSearchVerdictSound({ valid: true }) === "correct", "Lookout: a word plays `correct`");
  ok((wordSearchPuzzle.Stage as { silentWordChecks?: boolean }).silentWordChecks === true, "Lookout: FeedbackStage's check sounds are off (the stage plays the one sound)");
  const s = src("src/puzzles/wordSearch.tsx");
  const then = between(s, 'void checkWord("", already, path).then((verdict) => {', "});\n    },");
  ok((then.match(/fx\.onCorrect\(\)/g) ?? []).length === 1, "Lookout: one `correct` per verdict (the bonus played two)");
  const help = helpText("wordsearch");
  ok(!/is struck through/.test(help) && /turns gold on the grid/.test(help), "Lookout: the help describes the found word as the screen shows it");
}

/* ------------------------------------------------------------------ 13. Roundabout */
{
  const { letterWheelVerdictSound, letterWheelPuzzle } = await import("../src/puzzles/letterWheel");
  const slots = ["CAT", "ACT"];
  const bonus = checkLetterWheelWord(slots, "TAC", [], true);
  ok(bonus.reason === "Not in this puzzle" && !bonus.valid, "Roundabout: the server reports a bonus word as not in this puzzle (unchanged)");
  ok(letterWheelVerdictSound(bonus, true, false) === "correct", "Roundabout: a new bonus word plays a positive sound, never `wrong`");
  ok(letterWheelVerdictSound(bonus, true, true) === null, "Roundabout: a word already in the jar is silent");
  ok(letterWheelVerdictSound(checkLetterWheelWord(slots, "CAT", ["CAT"], true), true, false) === null, "Roundabout: repeating a slot word is silent");
  ok(letterWheelVerdictSound(checkLetterWheelWord(slots, "XQZ", [], false), true, false) === "wrong", "Roundabout: a miss plays `wrong`");
  ok(letterWheelVerdictSound(checkLetterWheelWord(slots, "CAT", [], true), true, false) === "correct", "Roundabout: a slot word plays `correct`");
  ok(letterWheelVerdictSound(bonus, false, false) === "wrong", "Roundabout: wheelRev 1 (no jar) keeps `wrong` for a word not in the puzzle");
  ok((letterWheelPuzzle.Stage as { silentWordChecks?: boolean }).silentWordChecks === true, "Roundabout: FeedbackStage's check sounds are off (the stage plays the one sound)");
  const s = src("src/puzzles/letterWheel.tsx");
  ok(!/playTick/.test(s), "Roundabout: the bonus no longer adds a tick on top");
  const jarRepeat = between(s, '} else if (v.reason === "Not in this puzzle") {', "} else {");
  ok(jarRepeat.length > 0 && !/puzzleReject|fx\.onWrong|playWrong/.test(jarRepeat.replace(/\/\/[^\n]*/g, "")), "Roundabout: the already-in-the-jar shake is silent");
}

/* ------------------------------------------------------------------ 14. Strikeout */
{
  const s = src("src/puzzles/strikeout.tsx");
  const v1 = between(s, 'if (next.last === "notword") {', "} else if (before && next.strikes");
  const v2 = between(s, 'if (next.last === "notword" || next.last === "vowels") {', "} else if (before && next.strikes");
  ok(v1.length > 0 && v2.length > 0, "Strikeout: both refusal branches are found");
  for (const [name, block] of [["rev 1–2", v1], ["rev 3+", v2]] as const) {
    ok(/puzzleReject\(/.test(block), `Strikeout ${name}: a refused solve gets the soft reject`);
    ok(!/fx\.onWrong|playWrong/.test(block), `Strikeout ${name}: a refused solve never plays \`wrong\``);
  }
  ok((s.match(/puzzleReject\(strikeRef\.current, false\);\n\s+fx\.onWrong\(\);/g) ?? []).length === 2, "Strikeout: a strike plays one sound (`wrong`, a silent shake)");
}

/* ------------------------------------------------------------------ 15. Cryptogrid */
{
  const { codewordFullStatus } = await import("../src/puzzles/codeword");
  ok(codewordFullStatus(true) === "wrong" && codewordFullStatus(false) === "checking", "Cryptogrid: a grid the server judged wrong reads wrong, an unchecked one Checking…");
  const s = src("src/puzzles/codeword.tsx");
  ok(/if \(view\.complete\) \{\n\s+setCheckedWrong\(sentMoves\);/.test(s), "Cryptogrid: the server's wrong verdict is kept for the grid it judged");
  ok(/codewordFullStatus\(checkedWrong === encoded\) === "wrong" \? <span className="text-destructive">A letter is wrong<\/span> : <span>Checking…<\/span>/.test(s), "Cryptogrid: the status line shows the wrong state, not Checking… for ever");
}

console.log(`number-word-review-fixes-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`FAIL summary: ${failures.length} failed`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
