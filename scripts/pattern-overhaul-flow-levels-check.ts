/**
 * Chroma Lines' levels (the Pattern overhaul, stage 3, 16 Nov 2026; src/lib/levels/pattern/flow.levels.ts). The
 * levels' one-solution proof (`oneSolution.proof` in the registry):
 *
 *  1. The registry offers Easy, Normal, Hard and Expert, each setting documented data, every clock at most 120 s.
 *  2. Each level deals its own settings: grid, pairs, walls, path lengths, its clock (Expert 90 s on the puzzle),
 *     flowRev 3 and its `level` stamp; a board drawn by the room seed is the same every time.
 *  3. Normal is exactly the deal before levels: with no levels in the registry the deal is byte for byte the same, it
 *     carries no level, grid or clock field, and its board is Normal's bank entry.
 *  4. Every board in every level bank (all 500 of each) passes its level's rules, the exhaustive proof of exactly one
 *     solution and the human-style solver (no guessing; at least the level's "what if" floor). The build stamps' hashes
 *     match, and the bank rebuilds from its seeds (the first entries here; all with CHECKS_FULL=1, or
 *     `bun scripts/flow-bank.ts --level=all --check`).
 *  5. The grid fits a 375 px phone: squares at least 39 px across a 351 px board, a bigger level growing downwards.
 *  6. A flawless solve scores 200 at every level (full speed and clean lines).
 *  7. Grading reads the stored puzzle's level and stamp: full speed by 30 s on Normal flowRev 3, each level's own time
 *     on its boards, 20 s on flowRev 2 and older (unchanged); Expert's speed runs on its 90 s clock.
 *  8. A clear step up: the kits' Great player scores less from Easy to Normal to Hard to Expert and the human-style
 *     solver needs more "what ifs"; the Near-perfect kit finishes nearly every Expert board.
 *  9. Expert's two extra colours have their own beads and symbols, and a 9 × 12 board draws all 108 squares at its
 *     own aspect.
 *
 *   bun scripts/pattern-overhaul-flow-levels-check.ts
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { encodeFlowPaths, flowCellCount, flowGrid, FLOW_COLOUR_HEX } from "../src/lib/duel/flow";
import { FLOW_EASY_BANK, FLOW_EASY_BANK_BUILD } from "../src/lib/duel/flowEasyBank.server";
import { FLOW_HARD_BANK, FLOW_HARD_BANK_BUILD } from "../src/lib/duel/flowHardBank.server";
import { FLOW_EXPERT_BANK, FLOW_EXPERT_BANK_BUILD } from "../src/lib/duel/flowExpertBank.server";
import { FLOW_BANK } from "../src/lib/duel/flowBank.server";
import { FLOW_LEVELS, flowLevelSettings, verifyFlowLevelPuzzle, type FlowLevel } from "../src/lib/duel/flowLevels.server";
import { solveFlowLikeAPerson } from "../src/lib/duel/flowHuman.server";
import { drawBankedPuzzle } from "../src/lib/duel/puzzleBank.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { FLOW_REV3_FULL_BY_S, PATTERN_STD, patternFullByS } from "../src/lib/duel/standard/patternRules";
import { FLOW_SYMBOL_PATH } from "../src/components/puzzles/pattern/flowArt";
import { levelProof, levelsOf, withGameLevels } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel, type Level } from "../src/lib/levels/levels";
import type { FlowColour, PuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { asPhoneSends, gradeSteps } from "./standard-lib";
import { buildLevelBank } from "./flow-bank";

const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
let failures = 0;
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else {
    failures++;
    console.log(`  FAIL ${message}`);
  }
}
type Flow = Extract<PuzzleData, { type: "flow" }>;
const deal = (level: Level, seed: number) =>
  withSeededRandom(seed, () => generatePuzzle("flow", { bankSeed: seed, ...(level === "normal" ? {} : { level }) })) as Flow;
const BANKS: Record<FlowLevel, { bank: readonly Flow[]; build: { entries: number; sha256: string } }> = {
  easy: { bank: FLOW_EASY_BANK, build: FLOW_EASY_BANK_BUILD },
  hard: { bank: FLOW_HARD_BANK, build: FLOW_HARD_BANK_BUILD },
  expert: { bank: FLOW_EXPERT_BANK, build: FLOW_EXPERT_BANK_BUILD },
};

/* ------------------------------------------------------------------ 1. the registry */
console.log("1. registry");
check(levelsOf("flow").join() === "easy,normal,hard,expert", `flow offers all four levels (${levelsOf("flow").join()})`);
for (const level of FLOW_LEVELS) {
  const s = flowLevelSettings(level);
  const proof = levelProof("flow", level);
  check(!!proof && "proof" in proof && proof.proof === "scripts/pattern-overhaul-flow-levels-check.ts" && existsSync(proof.proof), `${level}: names this check as its one-solution proof`);
  check(s.timeLimitMs <= MAX_ROUND_CLOCK_MS, `${level}: clock ${s.timeLimitMs / 1000} s ≤ 120 s`);
  check(s.fullByS * 1000 < s.timeLimitMs, `${level}: full speed by ${s.fullByS} s, inside its clock`);
}
const E = flowLevelSettings("easy");
const H = flowLevelSettings("hard");
const X = flowLevelSettings("expert");
check(E.cols === 6 && E.rows === 6 && E.minPairs === 5 && E.maxPairs === 6 && E.maxWalls === 0 && E.timeLimitMs === 75_000, "Easy: 6 × 6, 5–6 pairs, no walls, 75 s");
check(H.cols === 9 && H.rows === 9 && H.minPairs === 8 && H.maxPairs === 9 && H.minWalls === 4 && H.maxWalls === 6 && H.timeLimitMs === 75_000, "Hard: 9 × 9, 8–9 pairs, 4–6 walls, 75 s");
check(X.cols === 9 && X.rows === 12 && X.minPairs === 12 && X.maxPairs === 14 && X.minWalls === 4 && X.maxWalls === 6 && X.timeLimitMs === 90_000, "Expert: 9 wide × 12 tall, 12–14 pairs, 4–6 walls, 90 s");

/* ------------------------------------------------------------------ 2. each level deals its settings */
console.log("2. deals");
for (const level of FLOW_LEVELS) {
  const s = flowLevelSettings(level);
  for (const seed of [1, 77, 4242, 99_001]) {
    const p = deal(level, seed);
    const grid = flowGrid(p);
    const pathAvg = (p.solution ?? []).reduce((a, x) => a + x.length, 0) / Math.max(1, p.pairs.length);
    check(puzzleLevel(p) === level, `${level} #${seed}: stamped ${level}`);
    check(p.flowRev === 3, `${level} #${seed}: flowRev 3`);
    check(grid.cols === s.cols && grid.rows === s.rows, `${level} #${seed}: ${grid.cols} × ${grid.rows}`);
    check(p.pairs.length >= s.minPairs && p.pairs.length <= s.maxPairs, `${level} #${seed}: ${p.pairs.length} pairs`);
    check((p.walls ?? []).length >= s.minWalls && (p.walls ?? []).length <= s.maxWalls, `${level} #${seed}: ${(p.walls ?? []).length} walls`);
    check(pathAvg >= s.minAvgPath, `${level} #${seed}: lines average ${pathAvg.toFixed(1)} squares`);
    check(puzzleTimeLimitMs(p) === s.timeLimitMs && puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS, `${level} #${seed}: the round's clock is ${puzzleTimeLimitMs(p)} ms`);
    check(JSON.stringify(deal(level, seed)) === JSON.stringify(p), `${level} #${seed}: the same seed deals the same board`);
  }
}
check(deal("expert", 5).timeLimitMs === 90_000 && deal("hard", 5).timeLimitMs === undefined, "only Expert stores its own clock");
const live = withSeededRandom(3, () => generatePuzzle("flow", { level: "hard" })) as Flow;
check(puzzleLevel(live) === "hard" && verifyFlowLevelPuzzle({ ...live, flowRev: undefined, level: undefined } as unknown as Flow, "hard") === null, "a level dealt without a seed (live) passes its level's proof too");

/* ------------------------------------------------------------------ 3. Normal is the deal before levels */
console.log("3. Normal");
for (const seed of [0, 1, 2, 77, 1234, 4242, 99_001, 7_654_321]) {
  const now = deal("normal", seed);
  const before = withGameLevels({}, () => deal("normal", seed));
  const asked = withSeededRandom(seed, () => generatePuzzle("flow", { bankSeed: seed, level: "normal" }));
  check(JSON.stringify(now) === JSON.stringify(before), `Normal #${seed}: byte for byte the deal with no levels`);
  check(JSON.stringify(asked) === JSON.stringify(now), `Normal #${seed}: asking for Normal deals the same`);
  check(!("level" in now) && now.cols === undefined && now.rows === undefined && now.timeLimitMs === undefined, `Normal #${seed}: no level, grid or clock field`);
  const banked = drawBankedPuzzle("flow", seed) as Flow;
  check(JSON.stringify(banked.pairs) === JSON.stringify(now.pairs) && JSON.stringify(banked.walls) === JSON.stringify(now.walls), `Normal #${seed}: its board is Normal's bank entry`);
}
check(FLOW_BANK.every((p) => p.cols === undefined && p.rows === undefined), "Normal's bank holds 9 × 9 boards only (unchanged)");

/* ------------------------------------------------------------------ 4. the level banks */
console.log("4. banks (every board proved)");
for (const level of FLOW_LEVELS) {
  const { bank, build } = BANKS[level];
  const s = flowLevelSettings(level);
  check(bank.length === s.bankSize && build.entries === bank.length, `${level}: ${bank.length} boards (${s.bankSize})`);
  check(createHash("sha256").update(JSON.stringify(bank)).digest("hex") === build.sha256, `${level}: the entries match their build stamp`);
  const t0 = Date.now();
  let bad = 0;
  let firstBad = "";
  const keys = new Set<string>();
  for (const [i, p] of bank.entries()) {
    const why = verifyFlowLevelPuzzle(p, level);
    if (why) {
      bad++;
      if (!firstBad) firstBad = `#${i}: ${why}`;
    }
    keys.add(`${p.pairs.map((x) => `${x.a}-${x.b}`).join(",")}|${(p.walls ?? []).join(",")}`);
  }
  check(bad === 0, `${level}: every board proved unique and finished by the human-style solver${bad ? ` (${bad} not, first ${firstBad})` : ""} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  check(keys.size === bank.length, `${level}: no board twice`);
  const n = FULL ? s.bankSize : 12;
  const rebuilt = await buildLevelBank(level, n);
  const committed = bank.slice(0, n).map((e) => `  ${JSON.stringify(e)},`).join("\n");
  check(rebuilt.source.includes(committed), `${level}: the first ${n} entries rebuild byte for byte from their seeds`);
}

/* ------------------------------------------------------------------ 5. the grid fits */
console.log("5. grid");
const BOARD_W = 351;
for (const level of [...FLOW_LEVELS, "normal" as const]) {
  const g = level === "normal" ? { cols: 9, rows: 9 } : flowLevelSettings(level);
  const cell = BOARD_W / g.cols;
  check(cell >= 39, `${level}: ${g.cols} × ${g.rows}, squares ${cell.toFixed(0)} px across a 351 px board`);
}
check(X.rows > X.cols && X.cols * X.rows >= 81, "Expert grows downwards (9 × 12), more squares than Normal at the same width");

/* ------------------------------------------------------------------ 6. a flawless solve scores 200 */
console.log("6. flawless");
for (const level of ["easy", "normal", "hard", "expert"] as Level[]) {
  for (const seed of [3, 30]) {
    const p = deal(level, seed);
    const run = gradeSteps(p, asPhoneSends(p, [{ answer: encodeFlowPaths(p.solution ?? []), atMs: 4_000 }]));
    check(run.isCorrect && run.score === 200, `${level} #${seed}: a flawless solve at 4 s scores ${run.score}`);
  }
}

/* ------------------------------------------------------------------ 7. grading reads the level */
console.log("7. grading");
const solveAt = (p: Flow, s: number) => gradeSteps(p, asPhoneSends(p, [{ answer: encodeFlowPaths(p.solution ?? []), atMs: s * 1000 }])).score;
const n3 = deal("normal", 11);
check(patternFullByS("flow", n3) === FLOW_REV3_FULL_BY_S && FLOW_REV3_FULL_BY_S === 30, "Normal flowRev 3: full speed by 30 s");
check(solveAt(n3, 29) === 200 && solveAt(n3, 40) < 200, "Normal flowRev 3: 200 at 29 s, less at 40 s");
const n2 = { ...n3, flowRev: 2 } as Flow;
check(patternFullByS("flow", n2) === PATTERN_STD.flow.fullByS && PATTERN_STD.flow.fullByS === 20, "flowRev 2 keeps full speed by 20 s");
check(solveAt(n2, 25) < 200 && solveAt(n2, 19) === 200, "flowRev 2: 200 at 19 s, less at 25 s (as before)");
for (const level of FLOW_LEVELS) {
  const p = deal(level, 12);
  const s = flowLevelSettings(level);
  check(patternFullByS("flow", p) === s.fullByS, `${level}: graded with its own full-speed time (${s.fullByS} s)`);
  check(solveAt(p, s.fullByS - 1) === 200 && solveAt(p, s.fullByS + 8) < 200, `${level}: 200 within ${s.fullByS} s, less after`);
}
const x = deal("expert", 12);
const xSpeedLate = solveAt(x, 80);
check(xSpeedLate > 150, `Expert: a solve at 80 s still has speed points on its 90 s clock (${xSpeedLate})`);
const hardAsNormal = { ...deal("hard", 12) } as Record<string, unknown>;
delete hardAsNormal["level"];
check(patternFullByS("flow", hardAsNormal) === FLOW_REV3_FULL_BY_S, "the same board without its level stamp grades as Normal (the stored stamp decides)");

/* ------------------------------------------------------------------ 8. a clear step up */
console.log("8. step up");
const kit = KITS.flow!;
const great: Record<string, number> = {};
const nearFinish: Record<string, number> = {};
const whatIfs: Record<string, number> = {};
const SEEDS = 24;
for (const level of ["easy", "normal", "hard", "expert"] as Level[]) {
  let g = 0;
  let nf = 0;
  let w = 0;
  for (let i = 0; i < SEEDS; i++) {
    const p = deal(level, 500 + i);
    const lim = puzzleTimeLimitMs(p);
    const pg = kit.play(p, makeRng(hashText(`flow-levels:${level}:${i}:great`)), SKILLS.great, lim);
    g += gradeSteps(p, asPhoneSends(p, pg.steps), pg.timed).score;
    const pn = kit.play(p, makeRng(hashText(`flow-levels:${level}:${i}:near`)), SKILLS.near, lim);
    if (gradeSteps(p, asPhoneSends(p, pn.steps), pn.timed).isCorrect) nf++;
    w += solveFlowLikeAPerson(p.pairs, p.walls ?? [], flowGrid(p)).whatIfs;
  }
  great[level] = g / SEEDS;
  nearFinish[level] = nf / SEEDS;
  whatIfs[level] = w / SEEDS;
}
console.log(`   Great averages ${JSON.stringify(Object.fromEntries(Object.entries(great).map(([k, v]) => [k, Math.round(v)])))}; "what ifs" ${JSON.stringify(Object.fromEntries(Object.entries(whatIfs).map(([k, v]) => [k, Math.round(v * 10) / 10])))}`);
check(great["easy"]! > great["normal"]! && great["normal"]! > great["hard"]! && great["hard"]! > great["expert"]!, "the Great kit scores less at each level up");
check(whatIfs["easy"]! < whatIfs["normal"]! && whatIfs["normal"]! < whatIfs["hard"]! && whatIfs["hard"]! < whatIfs["expert"]!, "each level up needs more reasoning (human-style 'what ifs')");
check(nearFinish["expert"]! >= 0.9, `the Near-perfect kit finishes ${Math.round(nearFinish["expert"]! * 100)} % of Expert boards`);

/* ------------------------------------------------------------------ 9. colours and the tall board */
console.log("9. art");
const ALL: FlowColour[] = Object.keys(FLOW_COLOUR_HEX) as FlowColour[];
check(ALL.length === 14 && ALL.includes("CYAN") && ALL.includes("TAN"), "fourteen colours, Expert's CYAN and TAN among them");
check(new Set(Object.values(FLOW_SYMBOL_PATH)).size === 14 && ALL.every((c) => !!FLOW_SYMBOL_PATH[c]), "every colour has its own symbol");
check(ALL.every((c) => existsSync(`public/pattern-art/flow/bead-${c.toLowerCase()}.webp`)), "every colour has its bead sprite");
check(FLOW_EXPERT_BANK.some((p) => p.pairs.length >= 13), "Expert's bank deals 13- and 14-pair boards");
check(FLOW_EXPERT_BANK.filter((p) => p.pairs.length > 12).every((p) => p.pairs.some((pr) => pr.colour === "CYAN" || pr.colour === "TAN")), "a board of more than 12 pairs uses the extra colours");
check(FLOW_EASY_BANK.concat(FLOW_HARD_BANK, FLOW_BANK).every((p) => p.pairs.every((pr) => pr.colour !== "CYAN" && pr.colour !== "TAN")), "only Expert's bigger boards deal the extra colours");
const { FlowBoard } = await import("../src/puzzles/flow");
const xp = FLOW_EXPERT_BANK[0]!;
const html = renderToStaticMarkup(createElement(FlowBoard, { pairs: xp.pairs, paths: xp.pairs.map(() => []), walls: xp.walls ?? [], cols: 9, cells: flowCellCount(flowGrid(xp)) }));
const squares = (html.match(/class="flow-cell /g) ?? []).length + (html.match(/class="flow-wall /g) ?? []).length;
check(squares === 108, `the Expert board draws all 108 squares (${squares})`);
check(html.includes("aspect-ratio:9 / 12") && html.includes('data-flow-grid="9x12"') && !html.includes("aspect-square"), "the Expert board keeps its own 9 : 12 aspect");
const normalHtml = renderToStaticMarkup(createElement(FlowBoard, { pairs: FLOW_BANK[0]!.pairs, paths: [], walls: FLOW_BANK[0]!.walls ?? [] }));
check(normalHtml.includes("aspect-square") && !normalHtml.includes("data-flow-grid"), "a 9 × 9 board draws as before (square, no grid mark)");

console.log(`\n${failures === 0 ? "PASS" : "FAIL"} pattern-overhaul-flow-levels-check: ${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
