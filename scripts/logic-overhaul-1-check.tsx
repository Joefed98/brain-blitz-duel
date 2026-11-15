/**
 * logic-overhaul-1-check (Logic overhaul, session 1, 15 Nov 2026; src/lib/duel/logicOverhaul1.ts,
 * src/polish-logic/logic-overhaul-1.css, docs/design/pages-review/logic-1/GALLERY.md):
 *
 *  1. Polypotions tubesRev 3: rooms deal it on the partial-credit stamp, pinned eras keep theirs; Undo gives its pour
 *     back and Reset gives them all back on rev 3 only; tubesRev 2 answers grade exactly as before; a rev-3 solve that
 *     used Undo scores at least the same pours without it; the limit still ends the board; within 120 s.
 *  2. Box Six: live clashes find exactly the repeating digits in a row, column or box, never a lone digit.
 *  3. Safe Cracker: the broken clues are exactly those the tried code fails, none for an opening try or no try.
 *  4. The stages in happy-dom: Hanoi keeps the ring lifted after an illegal post; Polypotions shows "Out of pours"
 *     before the unfinished board goes in; Mosaic paints a dragged run as its first square; Box Six marks a clash;
 *     Safe Cracker marks broken clues only after a Try.
 *  5. The art: every sprite the new look names exists, and the Minefield painters fall back without `Image`.
 *
 *   bun scripts/logic-overhaul-1-check.tsx
 */
import { Window } from "happy-dom";
import { existsSync, readFileSync } from "node:fs";

const win = new Window({ url: "http://localhost/", width: 390, height: 844 });
const g = globalThis as Record<string, unknown>;
for (const key of [
  "window", "document", "navigator", "Node", "Element", "HTMLElement", "SVGElement", "Text", "Event", "MouseEvent",
  "PointerEvent", "KeyboardEvent", "FocusEvent", "getComputedStyle", "MutationObserver", "CustomEvent",
]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}
g["IS_REACT_ACT_ENVIRONMENT"] = true;
// The stages' sound cues dispatch a CustomEvent on happy-dom's window (bun has its own, which happy-dom refuses).
g["CustomEvent"] = (win as unknown as Record<string, unknown>)["CustomEvent"];
g["ResizeObserver"] ??= class { observe() {} unobserve() {} disconnect() {} };
const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && /not wrapped in act|act\(\.\.\.\)/.test(args[0])) return;
  originalError(...args);
};

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;
const { generatePuzzle, gradeAnswer } = await import("../src/lib/duel/generate.server");
const { pinPreLogicOverhaul1, TUBES_REFUND_REV } = await import("../src/lib/duel/logicOverhaul1");
const { pinPrePartialCredit } = await import("../src/lib/duel/partialCredit");
const { tubesPourLimit, tubesRefundsUndo } = await import("../src/lib/duel/moveLimits");
const { canPour, pour, replayTubeLog, tubesKey, tubesSolved, encodeTubeLog } = await import("../src/lib/duel/tubes");
const { sudokuClashes } = await import("../src/lib/duel/logic");
const { brokenClues, clueHolds } = await import("../src/lib/duel/safe");
const { puzzleTimeLimitMs } = await import("../src/lib/duel/catalogue");
const { towerPuzzle } = await import("../src/puzzles/tower");
const { sortTubesPuzzle } = await import("../src/puzzles/sortTubes");
const { nonogramPuzzle } = await import("../src/puzzles/nonogram");
const { miniSudokuPuzzle } = await import("../src/puzzles/miniSudoku");
const { safeCrackerPuzzle } = await import("../src/puzzles/safeCracker");
type TubeState = number[][];
type TubeToken = Parameters<typeof encodeTubeLog>[0][number];

let passes = 0;
const failures: string[] = [];
const ok = (cond: boolean, msg: string) => (cond ? passes++ : failures.push(msg));

/* ------------------------------------------------------------------ 1. Polypotions tubesRev 3 */
/** Any route to sorted (depth-first over unseen boards); null when none within the depth. */
function solveTubes(start: TubeState, depth = 60): { from: number; to: number }[] | null {
  const seen = new Set<string>();
  const path: { from: number; to: number }[] = [];
  const go = (state: TubeState): boolean => {
    if (tubesSolved(state)) return true;
    if (path.length >= depth) return false;
    const key = tubesKey(state);
    if (seen.has(key)) return false;
    seen.add(key);
    for (let from = 0; from < state.length; from++)
      for (let to = 0; to < state.length; to++) {
        if (from === to || !canPour(state, from, to)) continue;
        path.push({ from, to });
        if (go(pour(state, from, to))) return true;
        path.pop();
      }
    return false;
  };
  return go(start) ? [...path] : null;
}

const SEEDS = [11, 23, 37, 41, 59];
for (const seed of SEEDS) {
  const live = generatePuzzle("tubes", { bankSeed: seed });
  ok(live.type === "tubes" && live.tubesRev === TUBES_REFUND_REV && tubesRefundsUndo(live), `tubes ${seed}: rooms deal tubesRev ${TUBES_REFUND_REV}`);
  ok(puzzleTimeLimitMs(live) <= 120_000, `tubes ${seed}: within 120 s (${puzzleTimeLimitMs(live)} ms)`);
  const pinned = generatePuzzle("tubes", { bankSeed: seed }, { pins: ["preLogicOverhaul1"] });
  ok(pinned.type === "tubes" && pinned.tubesRev === 2, `tubes ${seed}: pinned, tubesRev 2`);
  const { tubesRev: _a, ...liveRest } = live as unknown as Record<string, unknown>;
  const { tubesRev: _b, ...pinnedRest } = pinned as unknown as Record<string, unknown>;
  ok(JSON.stringify(liveRest) === JSON.stringify(pinnedRest), `tubes ${seed}: the same board, limit and par`);
  const prev = pinPrePartialCredit(true);
  const older = generatePuzzle("tubes", { bankSeed: seed });
  pinPrePartialCredit(prev);
  ok(older.type === "tubes" && older.tubesRev === 2, `tubes ${seed}: an older era (prePartialCredit) keeps tubesRev 2`);
  if (live.type !== "tubes" || pinned.type !== "tubes") continue;

  const route = solveTubes(live.tubes);
  ok(route !== null, `tubes ${seed}: a route exists`);
  if (!route) continue;
  const limit = tubesPourLimit(live)!;
  const first = route[0]!;
  // A pour, Undo, then the route: rev 2 counts the undone pour, rev 3 gives it back.
  const withUndo: TubeToken[] = [first, "undo", ...route];
  const r3 = replayTubeLog(live.tubes, withUndo, limit, undefined, true);
  const r2 = replayTubeLog(live.tubes, withUndo, limit, undefined, false);
  if (route.length + 1 <= limit) {
    ok(r3.solved && r3.moves === route.length, `tubes ${seed}: rev 3 counts ${route.length} (got ${r3.moves})`);
    ok(r2.solved && r2.moves === route.length + 1, `tubes ${seed}: rev 2 still counts the undone pour (got ${r2.moves})`);
  }
  const withReset: TubeToken[] = [...route.slice(0, 3), "reset", ...route];
  const rr = replayTubeLog(live.tubes, withReset, limit, undefined, true);
  if (route.length <= limit) ok(rr.moves === route.length, `tubes ${seed}: rev 3 Reset gives every pour back`);
  // Grading: rev 3 never scores a route-with-undo below the same route on rev 2's grading of it.
  const answer = encodeTubeLog(withUndo);
  const g3 = gradeAnswer(live, answer, 40_000);
  const g2 = gradeAnswer(pinned, answer, 40_000);
  ok(g3.score >= g2.score, `tubes ${seed}: rev 3 grades the undone pour no worse (${g3.score} vs ${g2.score})`);
  ok(gradeAnswer(pinned, answer, 40_000).score === g2.score, `tubes ${seed}: rev 2 grading is stable`);
  // The limit still ends the board on rev 3 (net pours).
  const bounce: TubeToken[] = [];
  for (let i = 0; i < limit + 3; i++) bounce.push(first, { from: first.to, to: first.from });
  const capped = replayTubeLog(live.tubes, bounce, limit, undefined, true);
  ok(capped.moves <= limit, `tubes ${seed}: rev 3 never counts past the limit`);
}

// Every one of the seven games deals within 120 s (the overhaul's rule at every level).
for (const type of ["sudoku", "tubes", "tower", "safe", "nonogram", "flood", "minesweeper"] as const) {
  for (const seed of SEEDS.slice(0, 2)) {
    const p = generatePuzzle(type, { bankSeed: seed });
    ok(puzzleTimeLimitMs(p) <= 120_000, `${type} ${seed}: at most 120 s (${puzzleTimeLimitMs(p)} ms)`);
  }
}

/* ------------------------------------------------------------------ 2. Box Six clashes */
{
  const grid = new Array(36).fill(0);
  grid[0] = 3;
  grid[5] = 3; // same row
  grid[7] = 2;
  grid[30] = 2; // column 0 vs column 1: no clash
  grid[13] = 4;
  grid[16] = 4; // row 2, different boxes: clash (same row)
  const c = sudokuClashes(grid);
  ok(c.has(0) && c.has(5), "Box Six: a repeat in a row clashes");
  ok(!c.has(7) && !c.has(30), "Box Six: different rows, columns and boxes never clash");
  ok(c.has(13) && c.has(16), "Box Six: a second row clash");
  ok(sudokuClashes(new Array(36).fill(0)).size === 0, "Box Six: an empty grid has no clash");
  const box = new Array(36).fill(0);
  box[0] = 5;
  box[8] = 5; // row 1 col 2: same 2x3 box as cell 0
  ok(sudokuClashes(box).size === 2, "Box Six: a repeat in a box clashes");
}

/* ------------------------------------------------------------------ 3. Safe Cracker's broken clues */
{
  for (const seed of SEEDS) {
    const p = generatePuzzle("safe", { bankSeed: seed });
    if (p.type !== "safe") continue;
    const tried = [0, 0, 0, 0];
    const broken = brokenClues(p.clues, tried);
    const expected = p.clues.flatMap((c, i) => (clueHolds(c, tried) ? [] : [i]));
    ok(JSON.stringify(broken) === JSON.stringify(expected), `safe ${seed}: broken clues are the failed ones`);
    ok(brokenClues(p.clues, undefined).length === 0, `safe ${seed}: no try, nothing marked`);
  }
}

/* ------------------------------------------------------------------ 4. The stages */
function mount(node: React.ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return { host, unmount: () => act(() => root.unmount()) };
}
const press = (el: Element | null | undefined) =>
  act(() => {
    el?.dispatchEvent(new (win as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent("pointerdown", { bubbles: true }));
    el?.dispatchEvent(new (win as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent("click", { bubbles: true }));
  });

// Hanoi: lift, illegal post, still lifted.
{
  const p = generatePuzzle("tower", { bankSeed: 5 });
  if (p.type === "tower") {
    const submits: string[] = [];
    const { host, unmount } = mount(
      React.createElement(towerPuzzle.Stage, { puzzle: p, locked: false, onSubmit: (a: string) => submits.push(a), onDraftAnswer: () => {}, phaseStartedAt: 0, now: 0, stateKey: "t-hanoi" } as never),
    );
    const posts = [...host.querySelectorAll("button")].filter((b) => b.closest("[data-logic-stage='tower']"));
    const pegs = p.start ?? [];
    // Find a post holding a bigger top ring than another post's top ring (a move onto it is illegal).
    let from = -1, onto = -1;
    for (let a = 0; a < pegs.length; a++)
      for (let b = 0; b < pegs.length; b++) {
        const ta = pegs[a]?.[pegs[a]!.length - 1], tb = pegs[b]?.[pegs[b]!.length - 1];
        if (a !== b && ta !== undefined && tb !== undefined && ta > tb && from < 0) { from = a; onto = b; }
      }
    if (from >= 0 && posts[from] && posts[onto]) {
      press(posts[from]);
      ok(host.querySelector(".hanoi-lifted") !== null, "Hanoi: a tap lifts the top ring");
      press(posts[onto]);
      ok(host.querySelector(".hanoi-lifted") !== null, "Hanoi: after an illegal post the ring stays lifted");
    } else ok(false, "Hanoi: found an illegal move on the start board");
    unmount();
  }
}

// Mosaic: a drag paints as its first square.
{
  const p = generatePuzzle("nonogram", { bankSeed: 3 });
  if (p.type === "nonogram") {
    const { host, unmount } = mount(
      React.createElement(nonogramPuzzle.Stage, { puzzle: p, locked: false, onSubmit: () => {}, onDraftAnswer: () => {}, phaseStartedAt: 0, now: 0, stateKey: "t-nono" } as never),
    );
    const cells = [...host.querySelectorAll("[data-nono-index]")] as HTMLElement[];
    ok(host.querySelector("[data-nono-paint]") !== null, "Mosaic: the board takes drags");
    const board = host.querySelector("[data-nono-paint]")!;
    const D = (win as unknown as { document: Document }).document;
    const realFrom = D.elementFromPoint?.bind(D);
    let target: Element | null = null;
    (D as unknown as { elementFromPoint: () => Element | null }).elementFromPoint = () => target;
    act(() => cells[0]!.dispatchEvent(new (win as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent("pointerdown", { bubbles: true })));
    for (const i of [1, 2, 3]) {
      target = cells[i]!;
      act(() => board.dispatchEvent(new (win as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent("pointermove", { bubbles: true, clientX: 1, clientY: 1 })));
    }
    act(() => win.dispatchEvent(new (win as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent("pointerup", { bubbles: true })));
    const filled = [0, 1, 2, 3].filter((i) => (host.querySelectorAll("[data-nono-index]")[i] as HTMLElement).className.includes("bg-primary")).length;
    ok(filled === 4, `Mosaic: a drag from an empty square fills the run (${filled} of 4)`);
    target = cells[5]!;
    act(() => board.dispatchEvent(new (win as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent("pointermove", { bubbles: true, clientX: 1, clientY: 1 })));
    ok(!(host.querySelectorAll("[data-nono-index]")[5] as HTMLElement).className.includes("bg-primary"), "Mosaic: after the pointer lifts, moving paints nothing");
    if (realFrom) (D as unknown as { elementFromPoint: typeof realFrom }).elementFromPoint = realFrom;
    unmount();
  }
}

// Box Six: a clash shows on the board.
{
  const p = generatePuzzle("sudoku", { bankSeed: 7 });
  if (p.type === "sudoku") {
    const { host, unmount } = mount(
      React.createElement(miniSudokuPuzzle.Stage, { puzzle: p, locked: false, onSubmit: () => {}, onDraftAnswer: () => {}, phaseStartedAt: 0, now: 0 } as never),
    );
    // An empty cell in a row holding a given: enter that given's digit.
    let cell = -1, digit = 0;
    for (let c = 0; c < 36 && cell < 0; c++) {
      if (p.givens[c]) continue;
      const row = Math.floor(c / 6);
      for (let k = 0; k < 6; k++) if (p.givens[row * 6 + k]) { cell = c; digit = p.givens[row * 6 + k]!; break; }
    }
    const cells = host.querySelectorAll(".logic-sudoku-cell");
    press(cells[cell]);
    const keys = [...host.querySelectorAll(".logic-sudoku-key")];
    press(keys[digit - 1]);
    ok(host.querySelectorAll("[data-clash]").length >= 2, "Box Six: a repeated digit marks both cells as clashing");
    unmount();
  }
}

// Safe Cracker: nothing marked before a Try, the broken clues after a wrong one.
{
  const p = generatePuzzle("safe", { bankSeed: 9 });
  if (p.type === "safe") {
    const { host, unmount } = mount(
      React.createElement(safeCrackerPuzzle.Stage, { puzzle: p, locked: false, onSubmit: () => {}, onDraftAnswer: () => {}, phaseStartedAt: 0, now: 0, stateKey: "t-safe" } as never),
    );
    ok(host.querySelectorAll("[data-broken]").length === 0, "Safe Cracker: no clue marked before a Try");
    const tryButton = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Try");
    act(() => tryButton?.dispatchEvent(new (win as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent("click", { bubbles: true })));
    const want = brokenClues(p.clues, [0, 0, 0, 0]).length;
    ok(host.querySelectorAll("[data-broken]").length === want, `Safe Cracker: a wrong Try marks its ${want} broken clue(s)`);
    unmount();
  }
}

// Polypotions: the "Out of pours" moment before the board goes in.
{
  const p = generatePuzzle("tubes", { bankSeed: 11 });
  if (p.type === "tubes") {
    const small = { ...p, pourLimit: 2 };
    const submits: string[] = [];
    const { host, unmount } = mount(
      React.createElement(sortTubesPuzzle.Stage, { puzzle: small, locked: false, onSubmit: (a: string) => submits.push(a), onDraftAnswer: () => {}, phaseStartedAt: 0, now: 0, stateKey: "t-tubes" } as never),
    );
    const flasks = [...host.querySelectorAll(".logic-potions > button")] as HTMLElement[];
    // The first two pours of a route (each lifts, then pours).
    const route = solveTubes(p.tubes) ?? [];
    for (const step of route.slice(0, 2)) { press(flasks[step.from]); press(flasks[step.to]); }
    ok(host.querySelector("[data-out-of-pours]") !== null, `Polypotions: out of pours shows its moment (${host.querySelector("[data-move-limit]")?.textContent ?? "-"})`);
    ok(submits.length === 0, "Polypotions: the board waits for the moment before it goes in");
    unmount();
  }
}

/* ------------------------------------------------------------------ 6. The reveals */
{
  const { colourFloodPuzzle } = await import("../src/puzzles/colourFlood");
  const { SOLUTION_SWITCH_TYPES } = await import("../src/components/duel/SolutionSwitch");
  const reveal = (def: { Reveal: unknown }, puzzle: unknown, answer: string, correct = false) => {
    const { host, unmount } = mount(
      React.createElement(def.Reveal as never, { puzzle, myAnswer: answer, myCorrect: correct, myReactionAvgMs: null, timeLimitMs: 90_000 } as never),
    );
    const out = { facts: [...host.querySelectorAll("[data-reveal-facts] dt")].map((d) => d.textContent ?? ""), host };
    return { ...out, done: unmount };
  };
  const noStray = (host: Element, name: string) =>
    ok(![...host.querySelectorAll("p, span, dt, dd, li")].some((el) => el.children.length === 0 && /^\s*[×✗]\s*$/.test(el.textContent ?? "")), `${name} reveal: no stray × or ✗`);

  const sud = generatePuzzle("sudoku", { bankSeed: 7 });
  if (sud.type === "sudoku") {
    const r = reveal(miniSudokuPuzzle, sud, "0".repeat(36));
    ok(r.facts.some((f) => /^Right of \d+$/.test(f)) && r.facts.includes("Wrong") && r.facts.includes("Empty"), `Box Six reveal: right, wrong and empty (${r.facts.join(" | ")})`);
    ok(/Solution/.test(r.host.textContent ?? "") && /Yours/.test(r.host.textContent ?? "") && SOLUTION_SWITCH_TYPES.has("sudoku"), "Box Six reveal: Solution and Yours, one at a time through the switch");
    ok(r.host.querySelectorAll('[data-tone="missed"]').length > 0, "Box Six reveal: an empty answer rings the cells missed");
    noStray(r.host, "Box Six"); r.done();
  }
  const tb = generatePuzzle("tubes", { bankSeed: 11 });
  if (tb.type === "tubes") {
    const r = reveal(sortTubesPuzzle, tb, "");
    ok(r.facts.some((f) => f.startsWith("Pours used")) && r.facts.includes("Par") && r.facts.some((f) => f.startsWith("Sorted of")), `Polypotions reveal: pours used, par, sorted (${r.facts.join(" | ")})`);
    const chips = r.host.querySelectorAll('[data-move-strip="tubes"] .logic-move-chip').length;
    ok(!tb.solution || chips > 0, `Polypotions reveal: the shortest route as pictures (${chips})`);
    noStray(r.host, "Polypotions"); r.done();
  }
  const tw = generatePuzzle("tower", { bankSeed: 5 });
  if (tw.type === "tower") {
    const r = reveal(towerPuzzle, tw, "");
    ok(r.facts.includes("Moves") && r.facts.includes("Fewest possible"), `Hanoi reveal: moves and the fewest possible (${r.facts.join(" | ")})`);
    ok(!tw.solution || r.host.querySelectorAll('[data-move-strip="tower"] .logic-move-chip').length > 0, "Hanoi reveal: the shortest route as pictures");
    noStray(r.host, "Hanoi"); r.done();
  }
  const sf = generatePuzzle("safe", { bankSeed: 9 });
  if (sf.type === "safe") {
    const r = reveal(safeCrackerPuzzle, sf, "0000");
    ok(r.host.querySelectorAll("[data-safe-tries] .logic-safe-try").length === 1, "Safe Cracker reveal: each try as a row of drums");
    ok(r.host.querySelectorAll("[data-safe-clues] li").length === sf.clues.length, "Safe Cracker reveal: every clue listed");
    ok(r.facts.some((f) => f.startsWith("Tries of")) && r.facts.some((f) => f.startsWith("Best dials of")), `Safe Cracker reveal: tries and best dials (${r.facts.join(" | ")})`);
    r.done();
  }
  const nn = generatePuzzle("nonogram", { bankSeed: 3 });
  if (nn.type === "nonogram") {
    const r = reveal(nonogramPuzzle, nn, "");
    ok(r.facts.some((f) => f.startsWith("Right of")) && r.facts.includes("Wrong") && r.facts.includes("Missed"), `Mosaic reveal: right, wrong, missed (${r.facts.join(" | ")})`);
    ok(r.host.querySelectorAll("[data-missed]").length === (nn.pattern ?? []).filter(Boolean).length, "Mosaic reveal: an empty answer outlines every square missed");
    r.done();
  }
  const fl = generatePuzzle("flood", { bankSeed: 4 });
  if (fl.type === "flood") {
    const r = reveal(colourFloodPuzzle, fl, "");
    ok(r.facts.some((f) => f.startsWith("Moves")) && r.facts.includes("Par") && r.facts.includes("Flooded"), `Colour Flood reveal: moves, par, flooded (${r.facts.join(" | ")})`);
    ok(!fl.solution || r.host.querySelector("[data-flood-route]") !== null, "Colour Flood reveal: the par route as swatches");
    r.done();
  }
  const { RUN_SUMMARY_TYPES } = await import("../src/components/duel/ArcadeRunSummary");
  ok(RUN_SUMMARY_TYPES.has("minesweeper") && RUN_SUMMARY_TYPES.size === 1, "Minefield's reveal draws the run (and no other game's changes)");
  const { minesweeperPuzzle } = await import("../src/puzzles/minesweeper");
  const ms = generatePuzzle("minesweeper", { bankSeed: 2 });
  {
    const r = reveal(minesweeperPuzzle, ms, "");
    ok(r.host.querySelector("[data-run-summary='minesweeper']") !== null, "Minefield reveal: the board as the run left it");
    ok(r.facts.some((f) => f.startsWith("Safe found of")) && r.facts.includes("Mines hit"), `Minefield reveal: safe found and mines hit (${r.facts.join(" | ")})`);
    r.done();
  }
}

/* ------------------------------------------------------------------ 5. The art */
const SPRITES = ["box-tile", "box-tile-given", "flask-glass", "cork", "hanoi-ring", "hanoi-post", "hanoi-plate", "hanoi-plate-gold",
  "safe-door", "safe-drum", "mosaic-tile", "mosaic-well", "flood-pot", "mine-raised", "mine-open", "mine-mine", "mine-flag"];
for (const s of SPRITES) ok(existsSync(`public/logic-art/${s}.webp`), `art: ${s}.webp exists`);
const css = readFileSync("src/polish-logic/logic-overhaul-1.css", "utf8");
for (const m of css.matchAll(/\/logic-art\/([a-z-]+)\.webp/g)) ok(SPRITES.includes(m[1]!), `art: the stylesheet's ${m[1]} is a rendered sprite`);
ok(/@import "\.\/polish-logic\/logic-overhaul-1\.css";/.test(readFileSync("src/styles.css", "utf8")), "art: styles.css imports the overhaul");
{
  const { logicSprite } = await import("../src/lib/arcade/logicArt.renderer");
  const saved = g["Image"];
  delete g["Image"];
  ok(logicSprite("mine-raised") === null, "art: with no Image the Minefield painters keep their vector art");
  if (saved !== undefined) g["Image"] = saved;
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} logic-overhaul-1 checks failed`);
  process.exit(1);
}
console.log(`PASS logic-overhaul-1-check: ${passes} checks`);
process.exit(0);
