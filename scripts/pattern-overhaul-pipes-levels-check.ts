/**
 * pattern-overhaul-pipes-levels-check (15 Nov 2026, the Pattern overhaul stage 3; src/lib/levels/pattern/pipes.levels.ts,
 * docs/design/difficulty/README.md): Pipeline's Easy, Hard and Expert, and the proof named by each level's
 * `oneSolution`. No browser (happy-dom for the stage).
 *
 *   1. Settings dealt: every level deals its size (5 × 5, 8 × 8, 8 × 11), its scramble share (Easy exactly 60 %, Hard at
 *      least 90 %, Expert at least 95 %), its leaks rule (Expert `hideLeaks`), the level stamp, today's stamps
 *      (pipesRev 5) and the two-way par; every clock is at most 120 s.
 *   2. One solution: every dealt board (60 a level; 400 at CHECKS_FULL=1) is fixed by the person-like solver (`deducePipes`: matching sides,
 *      no loops, no sealed-off group, no guessing), which also proves Expert humanly solvable, AND the searching solver
 *      (`countPipesSolutions`) finds exactly one layout; both equal the stored solution.
 *   2b. Normal has exactly one solution on pipesRev 5 (120 deals; 1,000 at CHECKS_FULL=1): pipesRev 4's board where it
 *      has one layout, a two-layout board dealt again (16 Nov 2026).
 *   3. Normal is byte for byte the deal before levels (bar the redrawn two-layout boards): 40 live and 10 pre-overhaul deals against
 *      scripts/fixtures/pattern-overhaul-pipes-levels-normal.json (recorded on the tree before levels by
 *      scripts/pattern-overhaul-pipes-levels-record.ts); asking for "normal" deals the same; a level the board lacks
 *      reads as 7 × 7 (pipesDims).
 *   4. The grid rule: no level is more than 8 tiles across (≥ 40 px tiles on a 375 px phone's 351 px board), and
 *      Expert keeps at least 81 tiles by growing downwards.
 *   5. A flawless solve (par turns, full time) scores 200 at every level, and at the level's full-speed time (Expert
 *      90 s, the rest 60 s) still 200; the kit's near-perfect play finishes.
 *   6. Grading reads the stored board's own size: a level board's solve is correct with every tile joined (25 / 64 /
 *      88), an unfinished one gets credit out of its own tiles, the summary counts its own tiles; and the same tiles
 *      read as a 7 × 7 board would not solve (so the size really is read from the puzzle).
 *   7. The stage and reveal draw the level board: its columns, Expert's tall shape and no spills during play on Expert
 *      (the reveal still sprays), every tile a button; the help names Expert's hidden spills.
 */
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/", width: 390, height: 844 });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "navigator", "Node", "Element", "HTMLElement", "SVGElement", "Text", "Event", "CustomEvent", "PointerEvent", "MouseEvent", "getComputedStyle", "MutationObserver"]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}

const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { generatePuzzle, gradeAnswer } = await import("../src/lib/duel/generate.server");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { puzzleTimeLimitMs } = await import("../src/lib/duel/registry");
const { pinPrePatternNov15 } = await import("../src/lib/duel/patternNov15");
const { encodePipesTurnAnswer, pipesAfterTurns, pipesTwoWayParTurns } = await import("../src/lib/duel/depth4/pipesTaps");
const { gradePipesBoard } = await import("../src/lib/duel/logic.server");
const { pipesDims, rotateMask, tileOpenings } = await import("../src/lib/duel/logic");
const { countPipesSolutions, deducePipes, pipesSolutions } = await import("../src/lib/duel/pipesSolve.server");
const { gameLevelSettings, levelsOf, levelProof } = await import("../src/lib/levels/gameLevels");
const { puzzleLevel, MAX_ROUND_CLOCK_MS } = await import("../src/lib/levels/levels");
const { PUZZLE_INSTRUCTIONS } = await import("../src/lib/duel/instructions");
const { pipesPuzzle } = await import("../src/puzzles/pipes");
const { ROUND_SUMMARIES } = await import("../src/lib/duel/roundSummaries");
const { KITS } = await import("./puzzle-fairness/kits");
const { SKILLS, hashText, makeRng } = await import("./puzzle-fairness/kit");
const { asPhoneSends, gradeSteps } = await import("./standard-lib");
const { PIPES_LEVELS_NORMAL_FIXTURE, PIPES_LEVELS_NORMAL_SEEDS } = await import("./pattern-overhaul-pipes-levels-record");
import type { PipesLevelsNormalFixture } from "./pattern-overhaul-pipes-levels-record";
import type { PipesLevelSettings } from "../src/lib/levels/pattern/pipes.levels";
import type { PipesTurn } from "../src/lib/duel/depth4/pipesTaps";
import type { PuzzleData } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else if (failures.length < 60) failures.push(message);
};
type Pipes = Extract<PuzzleData, { type: "pipes" }>;
const LEVELS = ["easy", "hard", "expert"] as const;
const WANT: Record<(typeof LEVELS)[number], { cols: number; rows: number; scrambled: number; exact: boolean; leaks: boolean; fullByS: number }> = {
  easy: { cols: 5, rows: 5, scrambled: 0.6, exact: true, leaks: true, fullByS: 60 },
  hard: { cols: 8, rows: 8, scrambled: 0.9, exact: false, leaks: true, fullByS: 70 }, // Changed with Joe's approval, 22 Nov 2026
  // Hard full speed by 70 s and Expert by 96 s (D4, from the elite's finishes under the human limits; Expert 90 s from
  // Joe, 16 Nov 2026, was the game's 60 s). Changed with Joe's approval, 22 Nov 2026.
  expert: { cols: 8, rows: 11, scrambled: 0.95, exact: false, leaks: false, fullByS: 96 }, // Changed with Joe's approval, 22 Nov 2026
};
// Quick depth: 60 boards a level (and 120 Normal deals); CHECKS_FULL=1: 400 a level and 1,000 Normal deals.
const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const PER_LEVEL = FULL ? 400 : 60;
const NORMAL_DEALS = FULL ? 1000 : 120;
const deal = (seed: number, level?: string) =>
  withSeededRandom(seed, () => generatePuzzle("pipes", { bankSeed: seed, ...(level ? { level: level as never } : {}) })) as Pipes;

/** The fewest turns either way from the dealt board to the stored solution (a flawless player's log). */
function bestLog(p: Pipes): PipesTurn[] {
  return p.tiles.flatMap((tile, cell) => {
    const want = p.solution![cell]! & 15;
    for (let t = 0; t < 4; t++) if (rotateMask(tileOpenings(tile), t) === want) return t === 0 ? [] : t <= 2 ? Array<PipesTurn>(t).fill({ cell, turn: 1 }) : [{ cell, turn: 3 } as PipesTurn];
    return [];
  });
}

/* 1–2. Settings dealt, one solution. */
check(JSON.stringify(levelsOf("pipes")) === JSON.stringify(["easy", "normal", "hard", "expert"]), `levels: pipes offers ${levelsOf("pipes").join(", ")}`);
const dealt: Record<string, Pipes[]> = {};
for (const level of LEVELS) {
  const s = gameLevelSettings<PipesLevelSettings>("pipes", level)!;
  const w = WANT[level];
  check(s.cols === w.cols && s.rows === w.rows && s.scrambled === w.scrambled && Boolean(s.exact) === w.exact && s.leaks === w.leaks && (s.speedFullByS ?? 60) === w.fullByS, `${level}: settings ${JSON.stringify(s)}`);
  const proof = levelProof("pipes", level);
  check(!!proof && "proof" in proof && proof.proof === "scripts/pattern-overhaul-pipes-levels-check.ts", `${level}: oneSolution doesn't name this check`);
  dealt[level] = [];
  for (let i = 0; i < PER_LEVEL; i++) {
    const seed = 153_000 + 101 * i;
    const p = deal(seed, level);
    dealt[level]!.push(p);
    const n = w.cols * w.rows;
    check(p.cols === w.cols && p.rows === w.rows && p.tiles.length === n && p.solution?.length === n, `${level} ${seed}: board ${p.cols}×${p.rows}, ${p.tiles.length} tiles`);
    check(puzzleLevel(p) === level, `${level} ${seed}: stamped ${puzzleLevel(p)}`);
    check(p.pipesRev === 5, `${level} ${seed}: pipesRev ${p.pipesRev}`);
    check(p.par === pipesTwoWayParTurns(p.tiles, p.solution!), `${level} ${seed}: par ${p.par} isn't the two-way par`);
    check(puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS && puzzleTimeLimitMs(p) === 120_000, `${level} ${seed}: clock ${puzzleTimeLimitMs(p)}`);
    check((p.hideLeaks === true) === !w.leaks, `${level} ${seed}: hideLeaks ${p.hideLeaks}`);
    const wrong = p.tiles.filter((t, c) => tileOpenings(t) !== (p.solution![c]! & 15)).length;
    if (w.exact) check(wrong === Math.round(w.scrambled * n), `${level} ${seed}: ${wrong} of ${n} turned, not exactly ${Math.round(w.scrambled * n)}`);
    else check(wrong / n >= w.scrambled, `${level} ${seed}: only ${wrong} of ${n} turned`);
    check(p.source >= 0 && p.source < n, `${level} ${seed}: source ${p.source}`);
    const masks = p.tiles.map(tileOpenings);
    const human = deducePipes(masks, w.cols, w.rows);
    check(!!human && human.join() === p.solution!.map((m) => m & 15).join(), `${level} ${seed}: the person-like solver doesn't fix the board to its solution`);
    check(countPipesSolutions(masks, w.cols, w.rows, 2) === 1, `${level} ${seed}: not exactly one solution`);
    check(gradePipesBoard(p.source, p.solution!.map((sides) => ({ sides })), w.cols).solved, `${level} ${seed}: the solution doesn't solve`);
  }
}
// The solvers themselves, against brute force on every 3 × 2 board of shapes (5^6 = 15,625): the searching solver's
// count is exact, the person-like solver fixes only boards with one layout, and both kinds occur.
{
  const ring = [0b0110, 0b1100, 0b0011, 0b1001]; // four corners round a 2 × 2: a ring, one layout (walls fix it)
  check(countPipesSolutions(ring, 2, 2, 2) === 1, "solver: the 2 × 2 ring of corners isn't one layout");
  let several = 0;
  let single = 0;
  let compared = 0;
  const shapes = [1, 3, 5, 7, 15];
  const rec = (acc: number[]) => {
    if (acc.length === 6) {
      let brute = 0;
      const rots = acc.map((m) => [...new Set([0, 1, 2, 3].map((t) => rotateMask(m, t)))]);
      const walk = (i: number, cur: number[]) => {
        if (i === 6) {
          if (gradePipesBoard(0, cur.map((sides) => ({ sides })), 3).solved) brute++;
          return;
        }
        for (const r of rots[i]!) walk(i + 1, [...cur, r]);
      };
      walk(0, []);
      const counted = countPipesSolutions(acc, 3, 2, 99);
      if (counted !== brute) failures.push(`solver: ${acc.join(",")} counted ${counted}, brute force ${brute}`);
      const human = deducePipes(acc, 3, 2);
      if (human && brute !== 1) failures.push(`solver: the person-like solver fixed ${acc.join(",")} with ${brute} layouts`);
      if (brute > 1) several++;
      if (brute === 1) single++;
      compared++;
      return;
    }
    for (const s of shapes) rec([...acc, s]);
  };
  rec([]);
  check(compared === 5 ** 6, `solver: compared ${compared} 3 × 2 boards against brute force`);
  check(single > 0 && several === 0, `solver: brute force found ${single} one-layout and ${several} many-layout 3 × 2 boards`);
  // Larger boards with two layouts do occur: about 4 % of the 7 × 7 boards Normal dealt before pipesRev 5's uniqueness
  // pass (the pipesRev 4 deal, pinPrePatternNov15). On such deals the searching solver finds two different layouts
  // that both solve, and the person-like solver refuses the board.
  let twoLayout = 0;
  const was = pinPrePatternNov15(true);
  try {
    for (let i = 0; i < 300 && twoLayout < 5; i++) {
      const p = deal(154_000 + 7 * i);
      const masks = p.tiles.map(tileOpenings);
      const layouts = pipesSolutions(masks, 7, 7, 2);
      check(layouts.length >= 1, `solver: pipesRev 4 deal ${154_000 + 7 * i} has no layout`);
      if (layouts.length < 2) continue;
      twoLayout++;
      check(layouts[0]!.join() !== layouts[1]!.join(), "solver: two equal layouts");
      for (const l of layouts) check(gradePipesBoard(p.source, l.map((sides) => ({ sides }))).solved, "solver: a found layout doesn't solve");
      check(deducePipes(masks, 7, 7) === null, "solver: the person-like solver fixed a two-layout board");
    }
  } finally {
    pinPrePatternNov15(was);
  }
  check(twoLayout >= 3, `solver: only ${twoLayout} two-layout pipesRev 4 deals in 300`);
}

/* 2b. Normal has exactly one solution on pipesRev 5 (Joe, 16 Nov 2026; logic.server.ts withPipesOneLayout): every live
   Normal deal's tiles have exactly one layout (the searching solver, stopping at 2), and it is the stored solution.
   The deal is pipesRev 4's board whenever that board already has one layout (the same tiles, source and solution);
   only a two-layout board is dealt again (a different board), so the change is exactly the redraw. pipesRev 4 and
   below deal as before (section 3's pre-overhaul fixture, and deal-identity-check). */
{
  let redealt = 0;
  for (let i = 0; i < NORMAL_DEALS; i++) {
    const seed = 155_000 + 31 * i;
    const p = deal(seed);
    check(p.pipesRev === 5 && p.cols === undefined && p.tiles.length === 49, `normal ${seed}: not a pipesRev 5 7 × 7 board`);
    const masks = p.tiles.map(tileOpenings);
    const layouts = pipesSolutions(masks, 7, 7, 2);
    check(layouts.length === 1, `normal ${seed}: ${layouts.length} layouts`);
    check(layouts[0]?.join() === p.solution!.map((m) => m & 15).join(), `normal ${seed}: the one layout isn't the stored solution`);
    check(p.par === pipesTwoWayParTurns(p.tiles, p.solution!), `normal ${seed}: par ${p.par} isn't the redrawn board's two-way par`);
    const was = pinPrePatternNov15(true);
    let before: Pipes;
    try {
      before = deal(seed);
    } finally {
      pinPrePatternNov15(was);
    }
    const beforeLayouts = countPipesSolutions(before.tiles.map(tileOpenings), 7, 7, 2);
    const sameBoard = JSON.stringify([p.tiles, p.source, p.solution]) === JSON.stringify([before.tiles, before.source, before.solution]);
    if (beforeLayouts === 1) check(sameBoard, `normal ${seed}: a one-layout board was dealt again`);
    else {
      redealt++;
      check(!sameBoard, `normal ${seed}: a two-layout board was kept`);
    }
  }
  check(redealt >= 1 && redealt <= NORMAL_DEALS * 0.1, `normal: ${redealt} of ${NORMAL_DEALS} deals redrawn (about 4 % expected)`);
}

/* 3. Normal byte for byte. */
{
  // Re-recorded 16 Nov 2026 (uniqueness on pipesRev 5): 2 of the 40 live entries (seeds 153073, 153369) are boards
  // dealt again for having two layouts (tiles, source, solution and par); the other 38 and all 10 pre-overhaul
  // entries are byte for byte the earlier recording (section 2b proves the redraw rule on every Normal deal).
  const fx = JSON.parse(readFileSync(PIPES_LEVELS_NORMAL_FIXTURE, "utf8")) as PipesLevelsNormalFixture;
  check(fx.live.length === PIPES_LEVELS_NORMAL_SEEDS.length && fx.prePattern.length === 10, "normal: fixture size");
  for (const { seed, puzzle } of fx.live) {
    check(JSON.stringify(deal(seed)) === JSON.stringify(puzzle), `normal ${seed}: the live deal changed`);
    check(JSON.stringify(deal(seed, "normal")) === JSON.stringify(puzzle), `normal ${seed}: asking for Normal deals differently`);
  }
  const was = pinPrePatternNov15(true);
  try {
    for (const { seed, puzzle } of fx.prePattern) check(JSON.stringify(deal(seed)) === JSON.stringify(puzzle), `normal ${seed}: the pre-overhaul deal changed`);
  } finally {
    pinPrePatternNov15(was);
  }
  const n = fx.live[0]!.puzzle as Pipes;
  check(n.cols === undefined && n.rows === undefined && n.hideLeaks === undefined && puzzleLevel(n) === "normal", "normal: carries level fields");
  check(JSON.stringify(pipesDims(n)) === JSON.stringify({ cols: 7, rows: 7, cells: 49 }), `normal: dims ${JSON.stringify(pipesDims(n))}`);
}

/* 4. The grid rule. */
for (const level of LEVELS) {
  const { cols, rows } = WANT[level];
  check(351 / cols >= 40, `${level}: ${cols} across gives ${(351 / cols).toFixed(1)} px tiles on a 375 px phone`);
  if (level === "expert") check(rows > cols && cols * rows >= 81, `expert: ${cols} × ${rows} doesn't grow downwards to 81+ tiles`);
}

/* 5–6. Flawless solve 200, grading reads the board's size, the kit finishes. */
for (const level of LEVELS) {
  const { cols, rows } = WANT[level];
  for (const p of dealt[level]!.slice(0, 12)) {
    const log = bestLog(p);
    check(log.length === p.par, `${level}: the flawless log has ${log.length} turns, par ${p.par}`);
    const board = pipesAfterTurns(p.tiles, log);
    const gr = gradeAnswer(p, encodePipesTurnAnswer(board, log), 120_000);
    const extra = gr.extra as { connected?: number; turns?: number };
    check(gr.isCorrect && gr.score === 200, `${level}: a flawless solve grades ${gr.isCorrect} ${gr.score}`);
    // Full speed by the level's time (Expert 90 s, the rest 60 s): a flawless solve at exactly that time is 200, a
    // second later it isn't.
    const fullBy = WANT[level].fullByS * 1000;
    check(gradeAnswer(p, encodePipesTurnAnswer(board, log), 120_000 - fullBy).score === 200, `${level}: a flawless solve at ${WANT[level].fullByS} s isn't 200`);
    check(gradeAnswer(p, encodePipesTurnAnswer(board, log), 120_000 - fullBy - 3000).score < 200, `${level}: a flawless solve 3 s after ${WANT[level].fullByS} s is still 200`);
    check(extra.connected === cols * rows && extra.turns === p.par, `${level}: graded connected ${extra.connected}, turns ${extra.turns}`);
    // Read as a 7 × 7 board the same tiles don't solve (the grader really reads the stored size).
    check(!gradePipesBoard(p.source, board).solved, `${level}: the solved board also solves read as 7 × 7`);
    // Unfinished: half the log, credit from 1 to 130 out of its own tiles.
    const half = log.slice(0, Math.floor(log.length / 2));
    const gh = gradeAnswer(p, encodePipesTurnAnswer(pipesAfterTurns(p.tiles, half), half), 0);
    check(!gh.isCorrect && gh.score > 0 && gh.score <= 130, `${level}: a half-done board scores ${gh.score}`);
    const sum = (ROUND_SUMMARIES.pipes as unknown as (r: unknown, p: unknown) => { summary: string })({ is_correct: false, extra: gh.extra, score: gh.score, ms_remaining: 0 }, p);
    check(sum.summary.includes(`/ ${cols * rows} connected`), `${level}: summary "${sum.summary}"`);
  }
  // The kit's near-perfect player finishes the level's boards.
  let finished = 0;
  const sample = dealt[level]!.slice(0, 10);
  for (const [i, p] of sample.entries()) {
    const steps = KITS.pipes!.play(p, makeRng(hashText(`pipes-levels:${level}:${i}`)), SKILLS.near, 120_000).steps;
    if (gradeSteps(p, asPhoneSends(p, steps)).isCorrect) finished++;
  }
  check(finished >= 8, `${level}: the near-perfect kit finished ${finished} of ${sample.length}`);
}

/* 7. The stage, the reveal and the help. */
{
  const ex = dealt["expert"]![0]!;
  const hard = dealt["hard"]![0]!;
  const play = (p: Pipes) =>
    renderToStaticMarkup(React.createElement(pipesPuzzle.Stage, { puzzle: p, locked: false, onSubmit: () => {}, onDraftAnswer: () => {} } as never));
  const exHtml = play(ex);
  check(/repeat\(8, minmax\(0, 1fr\)\)/.test(exHtml) && /repeat\(11, minmax\(0, 1fr\)\)/.test(exHtml), "stage: Expert isn't drawn 8 × 11");
  check(exHtml.includes("data-pipes-tall") && exHtml.includes("--pipes-ar:"), "stage: Expert's board isn't tall-shaped");
  check((exHtml.match(/data-pipe-index=/g) ?? []).length === 88, "stage: Expert doesn't draw 88 tiles");
  check(!exHtml.includes("data-pipe-leak="), "stage: Expert shows spills during play");
  check(play({ ...ex, hideLeaks: undefined }).includes("data-pipe-leak="), "stage: the Expert board with leaks shown draws no spill (the test can't see one)");
  const hardHtml = play(hard);
  check(/repeat\(8, minmax\(0, 1fr\)\)/.test(hardHtml) && !hardHtml.includes("data-pipes-tall"), "stage: Hard isn't a square 8 × 8");
  check(hardHtml.includes("data-pipe-leak="), "stage: Hard shows no spills during play");
  const rev = renderToStaticMarkup(
    React.createElement(pipesPuzzle.Reveal, { timeLimitMs: 120_000, puzzle: ex, myAnswer: "", myCorrect: false, myMsRemaining: 0, myExtra: { connected: 3 } } as never),
  );
  check((rev.match(/data-pipe-index=/g) ?? []).length === 176 && rev.includes("data-pipes-tall"), "reveal: Expert's two boards aren't 8 × 11");
  check(rev.includes("3 of 88 joined") || rev.includes("3/88"), "reveal: the count isn't out of 88");
  const how = PUZZLE_INSTRUCTIONS.pipes.how;
  check(how.some((l) => /Expert/.test(l.action) && /spills/.test(l.detail) && l.helpOnly), "help: Expert's hidden spills aren't named (help only)");
  check(how.filter((l) => !l.helpOnly).length <= 4, "help: more than four intro HOW lines");
}

console.log(`pattern-overhaul-pipes-levels-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  process.exit(1);
}
