/**
 * logic-1-levels-check (the Logic overhaul, session 1, stage 3, 15 Nov 2026; src/lib/duel/logicLevels.ts, the level
 * registry src/lib/levels/gameLevels.ts, docs/design/difficulty/README.md). The one-solution proof every Easy, Hard
 * and Expert level of Box Six, Polypotions, Hanoi, Safe Cracker, Mosaic, Colour Flood and Minefield names. Proves:
 *
 *  1. The registry: each game offers Easy, Normal, Hard and Expert; every level's dealt clock is at most 120 s; a deal
 *     at a level carries `level`, Normal none.
 *  2. Box Six: givens in the level's band, exactly one solution, and the human-style grader needing exactly the level's
 *     steps (Easy singles alone; Hard and Expert an advanced step), every board solvable without a guess; Expert's
 *     clashes on Check, Easy's used-up digits.
 *  3. Polypotions: the level's flasks, colours and layers; the stored minimum re-found by search (breadth-first on Easy,
 *     A* on Hard and Expert) and its route replaying to sorted; Expert hidden.
 *  4. Hanoi: the level's fixed posts and rings, the minimum in the band and equal to the distance table, the route
 *     replaying; the timed-out grade's "moves from done" equals the table's distance.
 *  5. Safe Cracker: the level's dials, range and tries; exactly one code by the search and (Easy, Hard) by a full sweep,
 *     every clue needed; two-digit dials encode and decode; the code opens on the first try.
 *  6. Mosaic: the level's columns and rows (grown downwards), exactly one picture (every square forced by the clues;
 *     on Easy also by the full count), and the reasoning the level names (line alone; or needing lines together).
 *  7. Colour Flood: Easy's live boards' par exact by search; every bank board's route floods it in par moves, its par in
 *     the band, and (quick: two Hard and one Expert; CHECKS_FULL=1: all) its par re-proved the minimum.
 *  8. Minefield (Joe, 15 Nov 2026, "too-hard games: today's becomes Hard"): Hard deals minesRev 2 exactly, Normal the
 *     gentler minesRev 3 (16 mines), Easy minesRev 4, Expert minesRev 5 on 120 s; every board cleared by logic alone
 *     from its opening, the opening in the level's band; a played run replays through the server on each revision.
 *  9. The stages in happy-dom: Box Six Expert hides clashes until Check; Easy hides a digit placed six times; Polypotions
 *     Expert veils the layers not yet uncovered; Safe Cracker Expert draws five drums; Colour Flood Expert draws its
 *     blocked stones and six pots; Hanoi's timed-out reveal says how many moves from done.
 *
 *   bun scripts/logic-1-levels-check.tsx
 */
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/", width: 390, height: 844 });
const g = globalThis as Record<string, unknown>;
for (const key of [
  "window", "document", "navigator", "Node", "Element", "HTMLElement", "SVGElement", "Text", "Event", "MouseEvent",
  "PointerEvent", "KeyboardEvent", "FocusEvent", "getComputedStyle", "MutationObserver", "CustomEvent",
]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}
g["IS_REACT_ACT_ENVIRONMENT"] = true;
g["CustomEvent"] = (win as unknown as Record<string, unknown>)["CustomEvent"];
g["ResizeObserver"] ??= class { observe() {} unobserve() {} disconnect() {} };
const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && /not wrapped in act|act\(\.\.\.\)|client\/server desync/.test(args[0])) return;
  originalError(...args);
};

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;
const { generatePuzzle, gradeAnswer } = await import("../src/lib/duel/generate.server");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { puzzleTimeLimitMs } = await import("../src/lib/duel/catalogue");
const { gameLevelSettings, levelsOf } = await import("../src/lib/levels/gameLevels");
const { puzzleLevel } = await import("../src/lib/levels/levels");
const { countSudokuSolutions } = await import("../src/lib/duel/logic.server");
const { sudokuLogicGrade } = await import("../src/lib/duel/sudokuLogic");
const { tubesMinimum, tubesLevelMinimum } = await import("../src/lib/duel/tubes.server");
const { decodeTubeMoves, replayTubes, tubesCapacity, tubesColourCount } = await import("../src/lib/duel/tubes");
const { towerDistances } = await import("../src/lib/duel/tower.server");
const { decodeTowerMoves, encodeTowerMoves, replayTower, towerPegCount } = await import("../src/lib/duel/tower");
const { clueHolds, decodeSafeTries, encodeSafeTries, safeShapeOf, safeSolutions } = await import("../src/lib/duel/safe");
const { countNonoSolutions, nonoDimsOf, nonoLogicSolve } = await import("../src/lib/duel/nonogram");
const { FLOOD_BLOCKED, floodPlayable, replayFlood } = await import("../src/lib/duel/flood");
const { floodLevelMinimum } = await import("../src/lib/duel/floodLevels.server");
const { FLOOD_LEVEL_BANK } = await import("../src/lib/duel/logicLevelBanks.server");
const { minesBoard, minesGeoFor, minesSolve, MINES_REV_EASY, MINES_REV_EXPERT, MINES_REV_LOGIC, MINES_REV_NORMAL } = await import("../src/lib/arcade/minesweeper");
const { miniSudokuPuzzle } = await import("../src/puzzles/miniSudoku");
const { sortTubesPuzzle } = await import("../src/puzzles/sortTubes");
const { safeCrackerPuzzle } = await import("../src/puzzles/safeCracker");
const { colourFloodPuzzle } = await import("../src/puzzles/colourFlood");
const { towerPuzzle } = await import("../src/puzzles/tower");
type Level = "easy" | "normal" | "hard" | "expert";
type Loose = Record<string, unknown>;

let passes = 0;
const failures: string[] = [];
const ok = (cond: boolean, msg: string) => (cond ? passes++ : failures.push(msg));
const FULL = process.env["CHECKS_FULL"] === "1";
const GAMES = ["sudoku", "tubes", "tower", "safe", "nonogram", "flood", "minesweeper"] as const;
const LEVELS: Level[] = ["easy", "hard", "expert"];
const deal = (type: string, level: Level | undefined, seed: number) =>
  withSeededRandom(seed, () => generatePuzzle(type as never, { bankSeed: seed, ...(level ? { level } : {}) })) as unknown as Loose & { type: string };
const settings = <S,>(type: string, level: Level) => gameLevelSettings<S>(type, level)!;
const N = FULL ? 30 : 8;

/* ------------------------------------------------------------------ 1. the registry and the clock */
for (const type of GAMES) {
  ok(levelsOf(type).join(",") === "easy,normal,hard,expert", `${type}: offers Easy, Normal, Hard and Expert`);
  for (const level of ["easy", "normal", "hard", "expert"] as Level[]) {
    for (let n = 0; n < 3; n++) {
      const p = deal(type, level === "normal" ? undefined : level, 900 + n);
      // An arcade run's clock carries 3 s of slack that is not play (difficulty-check's rule).
      const clock = puzzleTimeLimitMs(p as never) - (type === "minesweeper" ? 3000 : 0);
      ok(clock <= 120_000, `${type} ${level}: clock ${clock} ms within 120 s`);
      ok(puzzleLevel(p) === level, `${type} ${level}: the deal carries its level (${String(p["level"])})`);
    }
  }
}

/* ------------------------------------------------------------------ 2. Box Six */
for (const level of LEVELS) {
  const lv = settings<{ givens: [number, number]; steps: string; clashes: string; hideUsed: boolean; timeMs: number }>("sudoku", level);
  for (let n = 0; n < N; n++) {
    const p = deal("sudoku", level, 100 + n) as Loose & { givens: number[] };
    const count = p.givens.filter(Boolean).length;
    ok(count >= lv.givens[0] && count <= lv.givens[1], `sudoku ${level} ${n}: ${count} givens in ${lv.givens.join("–")}`);
    ok(countSudokuSolutions(p.givens) === 1, `sudoku ${level} ${n}: exactly one solution`);
    ok(sudokuLogicGrade(p.givens) === lv.steps, `sudoku ${level} ${n}: needs ${lv.steps} (got ${sudokuLogicGrade(p.givens)})`);
    ok((p["clashes"] === "check") === (lv.clashes === "check") && Boolean(p["hideUsed"]) === lv.hideUsed, `sudoku ${level} ${n}: the level's clash and keypad rules ride on the board`);
    ok(p["timeLimitMs"] === lv.timeMs, `sudoku ${level} ${n}: the level's clock`);
  }
}
// Today's boards all fall to singles (Normal is today's game, and singles are what it asks).
for (let n = 0; n < 6; n++) {
  const p = deal("sudoku", undefined, 300 + n) as Loose & { givens: number[] };
  ok(sudokuLogicGrade(p.givens) !== null, `sudoku normal ${n}: solvable by logic`);
  ok(!("clashes" in p) && !("hideUsed" in p) && !("timeLimitMs" in p), `sudoku normal ${n}: no level fields`);
}

/* ------------------------------------------------------------------ 3. Polypotions */
for (const level of LEVELS) {
  const lv = settings<{ flasks: number; colours: number; capacity: number; minMoves: [number, number]; hidden: boolean; timeMs: number }>("tubes", level);
  for (let n = 0; n < (FULL ? 12 : 4); n++) {
    const p = deal("tubes", level, 120 + n) as Loose & { tubes: number[][]; minMoves: number; solution: string };
    ok(p.tubes.length === lv.flasks && tubesColourCount(p.tubes) === lv.colours && tubesCapacity(p.tubes) === lv.capacity, `tubes ${level} ${n}: ${lv.flasks} flasks, ${lv.colours} colours, ${lv.capacity} layers`);
    ok(p.minMoves >= lv.minMoves[0] && p.minMoves <= lv.minMoves[1], `tubes ${level} ${n}: minimum ${p.minMoves} in ${lv.minMoves.join("–")}`);
    const again = level === "easy" ? tubesMinimum(p.tubes) : tubesLevelMinimum(p.tubes);
    ok(again !== null && again.minMoves === p.minMoves, `tubes ${level} ${n}: the minimum re-found by search (${again?.minMoves})`);
    const replay = replayTubes(p.tubes, decodeTubeMoves(p.solution, p.tubes.length));
    ok(replay.solved && replay.moves === p.minMoves, `tubes ${level} ${n}: the stored route sorts in the minimum`);
    ok(Boolean(p["hidden"]) === lv.hidden && p["timeLimitMs"] === lv.timeMs, `tubes ${level} ${n}: hidden and clock as the level says`);
    // The pour allowance stays the minimum + 6 (the moveLimits layer).
    ok(p["pourLimit"] === undefined || (p["pourLimit"] as number) >= p.minMoves + 6, `tubes ${level} ${n}: the pour allowance (${String(p["pourLimit"])}) is at least min + 6`);
  }
}

/* ------------------------------------------------------------------ 4. Hanoi */
for (const level of LEVELS) {
  const lv = settings<{ pegs: number; discs: number; minMoves: [number, number]; timeMs: number }>("tower", level);
  for (let n = 0; n < N; n++) {
    const p = deal("tower", level, 140 + n) as Loose & { start: number[][]; discs: number; targetPeg: number; minMoves: number; solution: string };
    ok(towerPegCount(p.start) === lv.pegs && p.discs === lv.discs, `tower ${level} ${n}: ${lv.pegs} posts, ${lv.discs} rings`);
    ok(p.minMoves >= lv.minMoves[0] && p.minMoves <= lv.minMoves[1], `tower ${level} ${n}: minimum ${p.minMoves} in ${lv.minMoves.join("–")}`);
    const replay = replayTower(p.start, p.targetPeg, p.discs, decodeTowerMoves(p.solution));
    ok(replay.solved && replay.moves === p.minMoves, `tower ${level} ${n}: the stored route finishes in the minimum`);
    ok(p["timeLimitMs"] === lv.timeMs && p["towerRev"] === 1, `tower ${level} ${n}: the level's clock and towerRev 1`);
    // The timed-out grade: half the route played, the table's distance left.
    const half = decodeTowerMoves(p.solution).slice(0, Math.floor(p.minMoves / 2));
    const graded = gradeAnswer(p as never, encodeTowerMoves(half), 0);
    const left = (graded.extra as Loose | undefined)?.["movesLeft"];
    ok(left === p.minMoves - half.length, `tower ${level} ${n}: timed out ${p.minMoves - half.length} moves from done (stored ${String(left)})`);
  }
}
{
  // The distance table agrees with the generator's minimum on one board per level.
  for (const level of LEVELS) {
    const p = deal("tower", level, 160) as Loose & { start: number[][]; discs: number; targetPeg: number; minMoves: number };
    const pegs = towerPegCount(p.start);
    const dist = towerDistances(p.targetPeg, p.discs, pegs);
    let code = 0;
    const at = new Array<number>(p.discs + 1).fill(0);
    p.start.forEach((peg, i) => peg.forEach((d) => (at[d] = i)));
    for (let d = p.discs; d >= 1; d--) code = code * pegs + at[d]!;
    ok(dist[code] === p.minMoves, `tower ${level}: the stored minimum is the search's distance`);
  }
  // Normal stays today's game: posts at random, nine rings, no stamp.
  const posts = new Set<number>();
  for (let n = 0; n < 12; n++) {
    const p = deal("tower", undefined, 170 + n) as Loose & { start: number[][] };
    posts.add(towerPegCount(p.start));
    ok(!("towerRev" in p) && p["discs"] === 9, `tower normal ${n}: today's deal (no towerRev, nine rings)`);
  }
  ok(posts.size === 2, "tower normal: today's 3 or 4 posts at random");
}

/* ------------------------------------------------------------------ 5. Safe Cracker */
for (const level of LEVELS) {
  const lv = settings<{ dials: number; max: number; clues: number; tries: number; timeMs: number }>("safe", level);
  for (let n = 0; n < N; n++) {
    const p = deal("safe", level, 180 + n) as Loose & { clues: Parameters<typeof clueHolds>[0][]; combination: number[] };
    const shape = safeShapeOf(p);
    ok(shape.dials === lv.dials && shape.max === lv.max && shape.tries === lv.tries && p.clues.length === lv.clues, `safe ${level} ${n}: ${lv.dials} dials of 0–${lv.max}, ${lv.tries} tries, ${lv.clues} clues`);
    ok(p.combination.every((d) => d >= 0 && d <= lv.max), `safe ${level} ${n}: the code is in range`);
    const found = safeSolutions(p.clues, 2, shape);
    ok(found.length === 1 && found[0]!.join() === p.combination.join(), `safe ${level} ${n}: exactly one code by the search`);
    if (level !== "expert" || (FULL && n < 2)) {
      // A full sweep agrees with the search.
      let count = 0;
      const span = lv.max + 1;
      for (let v = 0; v < span ** lv.dials; v++) {
        const d: number[] = [];
        for (let i = lv.dials - 1, x = v; i >= 0; i--, x = Math.floor(x / span)) d[i] = x % span;
        if (p.clues.every((c) => clueHolds(c, d))) count++;
      }
      ok(count === 1, `safe ${level} ${n}: a full sweep finds exactly one code (${count})`);
    }
    ok(p.clues.every((_, i) => safeSolutions(p.clues.filter((__, j) => j !== i), 2, shape).length > 1), `safe ${level} ${n}: every clue is needed`);
    const encoded = encodeSafeTries([p.combination], shape);
    ok(decodeSafeTries(encoded, shape)[0]?.join() === p.combination.join(), `safe ${level} ${n}: the code encodes and decodes (${encoded})`);
    const graded = gradeAnswer(p as never, encoded, 50_000);
    ok(graded.isCorrect && graded.score >= 150, `safe ${level} ${n}: the code opens on the first try (${graded.score})`);
    // Tries past the level's allowance never count.
    const wrong = p.combination.map((d) => (d + 1) % (lv.max + 1));
    const over = encodeSafeTries([...new Array(lv.tries).fill(wrong), p.combination], shape);
    ok(!gradeAnswer(p as never, over, 50_000).isCorrect, `safe ${level} ${n}: a try past the ${lv.tries} allowed never opens it`);
  }
}

/* ------------------------------------------------------------------ 6. Mosaic */
for (const level of LEVELS) {
  const lv = settings<{ cols: number; rows: number; logic: "line" | "two"; timeMs: number }>("nonogram", level);
  for (let n = 0; n < N; n++) {
    const p = deal("nonogram", level, 200 + n) as Loose & { rows: number[][]; cols: number[][]; pattern: boolean[] };
    const dims = nonoDimsOf(p);
    ok(dims.w === lv.cols && dims.h === lv.rows && p.pattern.length === lv.cols * lv.rows, `nonogram ${level} ${n}: ${lv.cols} × ${lv.rows}`);
    const line = nonoLogicSolve(p.rows, p.cols, false).solved;
    const two = nonoLogicSolve(p.rows, p.cols, true).solved;
    // Exactly one picture: every square the deduction settles is forced by the clues, so a full solve proves it; on
    // Easy's 6 × 6 the full count agrees (the count's backtracking is too slow for 9-wide boards).
    ok(two, `nonogram ${level} ${n}: exactly one picture (every square forced by the clues)`);
    if (level === "easy") ok(countNonoSolutions(p.rows, p.cols, 2) === 1, `nonogram ${level} ${n}: the full count finds one picture`);
    const solvedBy = nonoLogicSolve(p.rows, p.cols, true);
    void solvedBy;
    ok(lv.logic === "line" ? line : !line && two, `nonogram ${level} ${n}: needs ${lv.logic === "line" ? "single lines" : "lines together"} (line ${line}, two ${two})`);
    const answer = p.pattern.flatMap((c, i) => (c ? [i] : [])).join(",");
    ok(gradeAnswer(p as never, answer, 30_000).isCorrect, `nonogram ${level} ${n}: the picture grades solved`);
  }
}

/* ------------------------------------------------------------------ 7. Colour Flood */
{
  const lvE = settings<{ cols: number; rows: number; colours: number; par: [number, number]; timeMs: number }>("flood", "easy");
  for (let n = 0; n < N; n++) {
    const p = deal("flood", "easy", 220 + n) as Loose & { grid: number[]; par: number; solution: number[] };
    ok(p.grid.length === lvE.cols * lvE.rows && p.par >= lvE.par[0] && p.par <= lvE.par[1], `flood easy ${n}: ${lvE.cols} × ${lvE.rows}, par ${p.par} in band`);
    ok(floodLevelMinimum(p.grid, lvE.cols, 40)?.par === p.par, `flood easy ${n}: par is the search's minimum`);
  }
  for (const level of ["hard", "expert"] as const) {
    const lv = settings<{ cols: number; rows: number; colours: number; par: [number, number]; blocked: number; timeMs: number }>("flood", level);
    const bank = FLOOD_LEVEL_BANK[level];
    ok(bank.length >= (level === "hard" ? 120 : 48), `flood ${level}: the bank holds ${bank.length} boards`);
    ok(new Set(bank.map((b) => b.grid.join())).size === bank.length, `flood ${level}: no board twice`);
    bank.forEach((b, i) => {
      const replay = replayFlood(b.grid, b.solution ?? [], lv.cols, null, lv.colours);
      ok(replay.solved && replay.moves === b.par && b.par >= lv.par[0] && b.par <= lv.par[1], `flood ${level} bank ${i}: the route floods it in par (${b.par})`);
      ok(b.grid.filter((v) => v === FLOOD_BLOCKED).length === lv.blocked && floodPlayable(b.grid) === b.grid.length - lv.blocked, `flood ${level} bank ${i}: ${lv.blocked} blocked squares`);
    });
    const prove = FULL ? bank.length : level === "hard" ? 2 : 1;
    for (let i = 0; i < prove; i++) ok(floodLevelMinimum(bank[i]!.grid, lv.cols, lv.par[1])?.par === bank[i]!.par, `flood ${level} bank ${i}: par re-proved the minimum`);
    const p = deal("flood", level, 240) as Loose & { grid: number[] };
    ok(bank.some((b) => b.grid.join() === p.grid.join()) && p["timeLimitMs"] === lv.timeMs, `flood ${level}: rooms deal a bank board on the level's clock`);
    ok(deal("flood", level, 240)["grid"]!.toString() === p.grid.toString(), `flood ${level}: the same room seed deals the same board`);
  }
}

/* ------------------------------------------------------------------ 8. Minefield */
{
  const want: Record<string, number> = { easy: MINES_REV_EASY, normal: MINES_REV_NORMAL, hard: MINES_REV_LOGIC, expert: MINES_REV_EXPERT };
  for (const level of ["easy", "normal", "hard", "expert"] as Level[]) {
    for (let n = 0; n < N; n++) {
      const p = deal("minesweeper", level === "normal" ? undefined : level, 260 + n) as Loose & { seed: number; minesRev: number };
      ok(p.minesRev === want[level], `minesweeper ${level} ${n}: minesRev ${want[level]} (got ${p.minesRev})`);
      const geo = minesGeoFor(p.minesRev);
      const board = minesBoard(p.seed, p.minesRev);
      ok(board.tries >= 0 && board.mines.filter(Boolean).length === geo.count && board.mines.length === geo.cells, `minesweeper ${level} ${n}: ${geo.cols} × ${geo.rows} with ${geo.count} mines`);
      const proof = minesSolve(board.mines, board.start, geo.count, geo);
      const opening = proof.steps[0]?.length ?? 0;
      ok(proof.solved && opening >= geo.openMin && opening <= geo.openMax, `minesweeper ${level} ${n}: cleared by logic from a ${opening}-square opening`);
      if (n === 0) {
        // A clear played square by square in the proof's order replays through the server to a cleared board.
        const events: { t: number; k: number; a: number; b: number; c: number; d: number }[] = [];
        proof.steps.slice(1).forEach((step, i) => events.push({ t: 30 + i * 12, k: 1, a: step[0]!, b: 0, c: 0, d: 0 }));
        const { encodeMinesweeperRun, replayMinesweeperRun } = await import("../src/lib/duel/minesweeper");
        const raw = encodeMinesweeperRun({ seed: p.seed, claimedScore: 0, events, endTick: 0, checkpoints: [] });
        const r = replayMinesweeperRun(p.seed, raw, p.minesRev);
        ok(r.cleared && r.hits === 0, `minesweeper ${level}: the proof's clear replays through the server (cleared ${r.cleared})`);
      }
    }
  }
  ok(minesGeoFor(MINES_REV_NORMAL).count === 16 && minesGeoFor(MINES_REV_LOGIC).count === 20, "minesweeper: Normal has 16 mines, Hard today's 20");
  ok(minesGeoFor(MINES_REV_EXPERT).runTicks === 120 * 60, "minesweeper: Expert runs 120 s");
}

/* ------------------------------------------------------------------ 9. the stages */
async function mount(node: React.ReactElement): Promise<{ root: HTMLElement; unmount: () => void }> {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const r = createRoot(root);
  await act(async () => r.render(node));
  return { root, unmount: () => { act(() => r.unmount()); root.remove(); } };
}
const stageProps = (puzzle: unknown) => ({ puzzle, locked: false, onSubmit: () => {}, onDraftAnswer: () => {}, phaseStartedAt: Date.now(), now: Date.now() }) as never;
{
  // Box Six Expert: a clash shows only after Check.
  const p = deal("sudoku", "expert", 400) as Loose & { givens: number[] };
  const { root, unmount } = await mount(React.createElement(miniSudokuPuzzle.Stage!, stageProps(p)));
  const blank = p.givens.findIndex((v) => !v);
  const rowGiven = p.givens.find((v, c) => v && Math.floor(c / 6) === Math.floor(blank / 6))!;
  await act(async () => (root.querySelector(`[data-cell="${blank}"]`) as HTMLElement).click());
  const keys = [...root.querySelectorAll<HTMLButtonElement>(".logic-sudoku-key")];
  await act(async () => keys[rowGiven - 1]!.click());
  ok(root.querySelectorAll("[data-clash]").length === 0, "sudoku expert: a clash is not shown while playing");
  await act(async () => (root.querySelector("[data-sudoku-check]") as HTMLElement).click());
  ok(root.querySelectorAll("[data-clash]").length > 0, "sudoku expert: Check shows the clash");
  unmount();
  // Box Six Easy: a digit placed six times leaves the keypad.
  const e = deal("sudoku", "easy", 401) as Loose & { givens: number[]; solution: number[] };
  const { root: r2, unmount: u2 } = await mount(React.createElement(miniSudokuPuzzle.Stage!, stageProps(e)));
  const digit = [1, 2, 3, 4, 5, 6].find((d) => e.givens.filter((v) => v === d).length === 5) ?? null;
  if (digit !== null) {
    const cell = e.solution.findIndex((v, c) => v === digit && !e.givens[c]);
    await act(async () => (r2.querySelector(`[data-cell="${cell}"]`) as HTMLElement).click());
    await act(async () => [...r2.querySelectorAll<HTMLButtonElement>(".logic-sudoku-key")][digit - 1]!.click());
    ok([...r2.querySelectorAll<HTMLButtonElement>(".logic-sudoku-key")][digit - 1]!.hasAttribute("data-used-up"), "sudoku easy: a digit placed six times is hidden");
  } else ok(r2.querySelectorAll("[data-used-up]").length === e.givens.filter(Boolean).length - e.givens.filter(Boolean).length, "sudoku easy: no digit used up at the start");
  u2();
}
{
  // Polypotions Expert: layers under the top of each flask are veiled at the start.
  const p = deal("tubes", "expert", 402) as Loose & { tubes: number[][] };
  const { root, unmount } = await mount(React.createElement(sortTubesPuzzle.Stage!, stageProps(p)));
  const veiled = root.querySelectorAll("[data-hidden-layer]").length;
  const expected = p.tubes.reduce((sum, t) => sum + Math.max(0, t.length - 1), 0);
  ok(veiled === expected, `tubes expert: every layer under a flask's top is veiled (${veiled} of ${expected})`);
  ok(root.querySelectorAll("[data-flask]").length === 12, "tubes expert: twelve flasks drawn");
  unmount();
  const n = deal("tubes", undefined, 403);
  const { root: r2, unmount: u2 } = await mount(React.createElement(sortTubesPuzzle.Stage!, stageProps(n)));
  ok(r2.querySelectorAll("[data-hidden-layer]").length === 0, "tubes normal: nothing veiled");
  u2();
}
{
  const p = deal("safe", "expert", 404);
  const { root, unmount } = await mount(React.createElement(safeCrackerPuzzle.Stage!, stageProps(p)));
  ok(root.querySelector('.logic-safe-drums[data-dials="5"]') !== null && root.querySelectorAll(".logic-safe-drums .safe-dial-drum").length === 5, "safe expert: five drums");
  ok(/tries left\s*2/.test(root.textContent ?? ""), "safe expert: two tries");
  unmount();
}
{
  const p = deal("flood", "expert", 405) as Loose & { grid: number[] };
  const { root, unmount } = await mount(React.createElement(colourFloodPuzzle.Stage!, stageProps(p)));
  ok(root.querySelectorAll("[data-flood-blocked]").length === p.grid.filter((v) => v === FLOOD_BLOCKED).length, "flood expert: every blocked stone drawn");
  ok(root.querySelectorAll(".logic-paint-pot").length === 6, "flood expert: six paint pots");
  unmount();
}
{
  const p = deal("tower", "hard", 406) as Loose & { solution: string; minMoves: number };
  const played = encodeTowerMoves(decodeTowerMoves(p.solution).slice(0, 5));
  const graded = gradeAnswer(p as never, played, 0);
  const { root, unmount } = await mount(React.createElement(towerPuzzle.Reveal!, { puzzle: p, myAnswer: played, myCorrect: false, myReactionAvgMs: null, timeLimitMs: 120_000, myExtra: graded.extra } as never));
  ok((root.textContent ?? "").includes(`${p.minMoves - 5} moves from done`), `tower: the timed-out reveal says ${p.minMoves - 5} moves from done`);
  unmount();
}

console.log(`logic-1-levels-check: ${passes} passed, ${failures.length} failed`);
for (const f of failures.slice(0, 40)) console.log(`  FAIL ${f}`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
process.exit(0);
