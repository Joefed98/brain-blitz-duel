/**
 * Lightbender's levels (the Pattern overhaul, stage 3, 16 Nov 2026; src/lib/levels/pattern/laser.levels.ts). The check
 * the levels' registry entry names (`oneSolution: { open }`: any lighting layout counts, by design):
 *
 *  1. The registry offers Easy, Normal, Hard and Expert with Joe's settings (mirrors, spare, bombs, shots, clock), each
 *     clock at most 120 s and each full-speed time inside it.
 *  2. Each level deals its own settings: the solution's mirrors (the par) and bombs in range, the tray the par plus the
 *     level's spare, one splitter, six gems, the level's shots, its clock (Hard 75 s, Expert 90 s on the puzzle),
 *     laserRev 4 and its `level` stamp; the same seed deals the same board.
 *  3. What the generator proves on every level board: the stored layout lights every gem with no bomb, no subset of its
 *     pieces does (every piece needed), and the person-like solver lights the board from the level's own tray within
 *     the level's ceiling and past its floor (laserSolve.server.ts; its layout re-traced by the shared tracer).
 *  3b. Hard's and Expert's banks: every entry passes those proofs and its level's ranges, no board twice, the entries
 *     match their build stamp, and the first entries rebuild byte for byte from their seeds (all with CHECKS_FULL=1,
 *     or `bun scripts/laser-bank.ts --check`); a room seed draws a bank entry.
 *  4. Why the levels are `open`: the exhaustive search finds a second lighting layout with only the par mirrors on most
 *     Normal boards (Lightbender takes any of them), and every layout it finds lights the board.
 *  5. Normal is exactly the deal before levels: byte for byte the deal with no levels, asking for Normal deals the same,
 *     and it carries no level, shots or clock field.
 *  6. The board is the same 10 × 10 at every level (no level is bigger, so the grid rule never applies).
 *  7. A flawless solve (every piece placed, one FIRE) scores 200 at every level.
 *  8. Grading reads the stored puzzle: full speed by 30 s on Normal laserRev 4, each level's own time on its boards,
 *     15 s on laserRev 3 and older (unchanged); the level's shots bound the server's replay; a board without its level
 *     stamp grades as Normal.
 *  9. A clear step up and Expert humanly possible to score well on: the levers grow level by level, the person-like
 *     solver needs more tries each level up, the Great and Good kits score less on Expert than on Hard, and the
 *     Near-perfect kit finishes nearly every Expert board in its two shots and averages at least 180 there.
 *
 *   bun scripts/pattern-overhaul-laser-levels-check.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { laserShotsOf, verifyLaser, isSplitter } from "../src/lib/duel/laser";
import { laserAction, replayLaserLog } from "../src/lib/duel/laserLog";
import { appendAction, encodeActionLog, type LoggedAction } from "../src/lib/duel/actionLog";
import { countLaserSolutions, solveLaserLikeAPerson } from "../src/lib/duel/laserSolve.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { LASER_REV4_FULL_BY_S, PATTERN_STD, patternFullByS } from "../src/lib/duel/standard/patternRules";
import { levelProof, levelsOf, withGameLevels, gameLevelSettings } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel, type Level } from "../src/lib/levels/levels";
import type { LaserLevelSettings } from "../src/lib/levels/pattern/laser.levels";
import { LASER_CELLS, LASER_GEMS, LASER_TIME_MS, type LaserPuzzleData } from "../src/lib/duel/types";
import { LASER_BANK_LEVELS, LASER_BANK_SIZE, laserLevelBank, laserLevelKey } from "../src/lib/duel/laserLevels.server";
import { LASER_HARD_BANK_BUILD } from "../src/lib/duel/laserHardBank.server";
import { LASER_EXPERT_BANK_BUILD } from "../src/lib/duel/laserExpertBank.server";
import { buildLaserBank, laserBankPath } from "./laser-bank";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { asPhoneSends, gradeSteps } from "./standard-lib";

const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const THIS = "scripts/pattern-overhaul-laser-levels-check.ts";
let failures = 0;
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else {
    failures++;
    console.log(`  FAIL ${message}`);
  }
}
type Laser = LaserPuzzleData & { level?: Level };
const LEVELS = ["easy", "hard", "expert"] as const;
type Lv = (typeof LEVELS)[number];
const settingsOf = (level: Lv) => gameLevelSettings<LaserLevelSettings>("laser", level)!;
const deal = (level: Level, seed: number) =>
  withSeededRandom(seed, () => generatePuzzle("laser", { bankSeed: seed, ...(level === "normal" ? {} : { level }) })) as Laser;
/** A deal as JSON with its build time (stats.generationMs, wall clock) set aside. */
const strip = (p: object) => JSON.stringify({ ...p, stats: { ...(p as { stats?: object }).stats, generationMs: 0 } });
const piecesOf = (p: Laser) => (p.solution ?? []).filter((m) => !isSplitter(m.kind)).length;

/* ------------------------------------------------------------------ 1. the registry */
console.log("1. registry");
check(levelsOf("laser").join() === "easy,normal,hard,expert", `laser offers all four levels (${levelsOf("laser").join()})`);
for (const level of LEVELS) {
  const s = settingsOf(level);
  const proof = levelProof("laser", level);
  check(!!proof && "open" in proof && proof.open.includes(THIS) && existsSync(THIS), `${level}: the registry's one-solution entry is open and names this check`);
  check(s.timeLimitMs <= MAX_ROUND_CLOCK_MS, `${level}: clock ${s.timeLimitMs / 1000} s ≤ 120 s`);
  check(s.fullByS * 1000 < s.timeLimitMs, `${level}: full speed by ${s.fullByS} s, inside its clock`);
  check(s.humanMinTurns < s.humanTurns, `${level}: the person-like solver's floor is under its ceiling`);
}
const E = settingsOf("easy");
const H = settingsOf("hard");
const X = settingsOf("expert");
check(E.minMirrors === 4 && E.maxMirrors === 5 && E.spare === 3 && E.minBombs === 1 && E.maxBombs === 2 && E.shots === 5 && E.timeLimitMs === 60_000, "Easy: 4–5 mirrors, 3 spare, 1–2 bombs, 5 shots, 60 s");
check(H.minMirrors === 8 && H.maxMirrors === 9 && H.spare === 1 && H.minBombs === 4 && H.maxBombs === 5 && H.shots === 3 && H.timeLimitMs === 75_000, "Hard: 8–9 mirrors, 1 spare, 4–5 bombs, 3 shots, 75 s");
check(X.minMirrors === 9 && X.maxMirrors === 10 && X.spare === 1 && X.minBombs === 5 && X.maxBombs === 6 && X.shots === 2 && X.timeLimitMs === 90_000, "Expert: 9–10 mirrors, 1 spare, 5–6 bombs, 2 shots, 90 s");

/* ------------------------------------------------------------------ 2 and 3. deals and what the generator proves */
console.log("2–3. deals and proofs");
const DEAL_SEEDS = FULL ? 120 : 24;
const turnsOf: Record<string, number[]> = { easy: [], normal: [], hard: [], expert: [] };
for (const level of LEVELS) {
  const s = settingsOf(level);
  let bad = 0;
  let firstBad = "";
  const fail = (seed: number, why: string) => {
    bad++;
    if (!firstBad) firstBad = `#${seed}: ${why}`;
  };
  for (let i = 0; i < DEAL_SEEDS; i++) {
    const seed = 7000 + i * 13;
    const p = deal(level, seed);
    const par = piecesOf(p);
    if (puzzleLevel(p) !== level) fail(seed, `stamped ${puzzleLevel(p)}`);
    if (p.laserRev !== 4) fail(seed, `laserRev ${p.laserRev}`);
    if (par < s.minMirrors || par > s.maxMirrors || p.par !== par) fail(seed, `par ${p.par}, solution mirrors ${par}`);
    if (p.mirrors !== par + s.spare) fail(seed, `tray ${p.mirrors} for par ${par}`);
    if (p.bombs.length < s.minBombs || p.bombs.length > s.maxBombs) fail(seed, `${p.bombs.length} bombs`);
    if (p.gems.length !== LASER_GEMS || p.splitterPieces !== 1) fail(seed, "gems or splitter");
    if (p.shots !== s.shots || laserShotsOf(p) !== s.shots) fail(seed, `shots ${p.shots}`);
    if (puzzleTimeLimitMs(p) !== s.timeLimitMs || (s.timeLimitMs === LASER_TIME_MS) !== (p.timeLimitMs === undefined)) fail(seed, `clock ${puzzleTimeLimitMs(p)}`);
    // The generator's proofs, re-run here.
    const solution = p.solution ?? [];
    if (!verifyLaser(p, solution, 1).solved) fail(seed, "the stored layout doesn't light every gem");
    for (let mask = 0; mask < (1 << solution.length) - 1; mask++) {
      if (verifyLaser(p, solution.filter((_, k) => (mask & (1 << k)) !== 0), 1).solved) {
        fail(seed, `a subset of the stored layout lights every gem (${mask})`);
        break;
      }
    }
    const human = solveLaserLikeAPerson(p, s.humanTurns);
    if (!human.solved || !human.layout || !verifyLaser(p, human.layout, 1).solved) fail(seed, "the person-like solver doesn't light it");
    else if (human.turns < s.humanMinTurns || human.turns > s.humanTurns) fail(seed, `the person-like solver needs ${human.turns} tries`);
    turnsOf[level]!.push(human.turns);
    if (i < 4) check(strip(deal(level, seed)) === strip(p), `${level} #${seed}: the same seed deals the same board (bar its build time)`);
  }
  check(bad === 0, `${level}: ${DEAL_SEEDS} deals carry the level's settings and its proofs${bad ? ` (${bad} not, first ${firstBad})` : ""}`);
}
const live = withSeededRandom(3, () => generatePuzzle("laser", { level: "expert" })) as Laser;
check(puzzleLevel(live) === "expert" && live.shots === 2 && live.timeLimitMs === 90_000, "a level dealt without a room seed (practice) carries its level too");

/* ------------------------------------------------------------------ 3b. the banks */
console.log("3b. Hard's and Expert's banks");
for (const level of LASER_BANK_LEVELS) {
  const s = settingsOf(level);
  const bank = laserLevelBank(level);
  const build = level === "hard" ? LASER_HARD_BANK_BUILD : LASER_EXPERT_BANK_BUILD;
  check(bank.length === LASER_BANK_SIZE[level] && build.entries === bank.length, `${level}: ${bank.length} boards (${LASER_BANK_SIZE[level]})`);
  check(createHash("sha256").update(JSON.stringify(bank)).digest("hex") === build.sha256, `${level}: the entries match their build stamp`);
  const t0 = Date.now();
  let bad = 0;
  let firstBad = "";
  for (const [i, p] of bank.entries()) {
    const solution = p.solution ?? [];
    const why =
      p.mirrors < s.minMirrors || p.mirrors > s.maxMirrors ? `${p.mirrors} mirrors`
      : p.bombs.length < s.minBombs || p.bombs.length > s.maxBombs ? `${p.bombs.length} bombs`
      : p.gems.length !== LASER_GEMS || p.splitterPieces !== 1 ? "gems or splitter"
      : !verifyLaser(p, solution, 1).solved ? "the stored layout doesn't light every gem"
      : (() => {
          for (let mask = 0; mask < (1 << solution.length) - 1; mask++)
            if (verifyLaser(p, solution.filter((_, k) => (mask & (1 << k)) !== 0), 1).solved) return "a subset lights every gem";
          const human = solveLaserLikeAPerson({ ...p, mirrors: p.mirrors + s.spare }, s.humanTurns);
          if (!human.solved || !verifyLaser({ ...p, mirrors: p.mirrors + s.spare }, human.layout!, 1).solved) return "not lit by the person-like solver";
          return human.turns < s.humanMinTurns ? `the person-like solver needs only ${human.turns} tries` : null;
        })();
    if (why) {
      bad++;
      if (!firstBad) firstBad = `#${i}: ${why}`;
    }
  }
  check(bad === 0, `${level}: every bank board passes its level's ranges and proofs${bad ? ` (${bad} not, first ${firstBad})` : ""} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  check(new Set(bank.map(laserLevelKey)).size === bank.length, `${level}: no board twice`);
  const n = FULL ? bank.length : level === "hard" ? 6 : 3;
  const rebuilt = buildLaserBank(level, n);
  const committed = readFileSync(laserBankPath(level), "utf8");
  const lines = (src: string) => src.split("\n").filter((l) => l.startsWith("  {"));
  check(JSON.stringify(lines(rebuilt.source)) === JSON.stringify(lines(committed).slice(0, n)), `${level}: the first ${n} entries rebuild byte for byte from their seeds`);
  const dealt = deal(level, 4242);
  const strip0 = (p: LaserPuzzleData) => laserLevelKey(p);
  check(bank.some((e) => strip0(e) === strip0(dealt)), `${level}: a room seed draws a bank entry`);
}

/* ------------------------------------------------------------------ 4. why the levels are open */
console.log("4. open by design");
{
  let second = 0;
  let complete = 0;
  let wrong = 0;
  const N = 12;
  for (let i = 0; i < N; i++) {
    const p = deal("normal", 300 + i);
    turnsOf["normal"]!.push(solveLaserLikeAPerson(p, 1_000_000).turns);
    const c = countLaserSolutions({ ...p, mirrors: p.par ?? p.mirrors }, 2, 3_000_000);
    if (c.complete || c.solutions >= 2) complete++;
    if (c.solutions >= 2) second++;
    for (const layout of c.layouts) if (!verifyLaser({ ...p, mirrors: p.par ?? p.mirrors }, layout, 1).solved) wrong++;
  }
  console.log(`   ${second} of ${N} Normal boards have a second lighting layout with only the par mirrors`);
  check(complete === N, "the exhaustive search settles every sampled board");
  check(second >= N / 2, `most Normal boards have more than one lighting layout (${second} of ${N}): Lightbender is open by design`);
  check(wrong === 0, "every layout the exhaustive search finds lights the board");
}
// The exhaustive search finds the stored layout on a board where it's the only one with those pieces.
{
  const p = deal("easy", 41);
  const c = countLaserSolutions({ ...p, mirrors: p.par ?? 0 }, 50, 3_000_000);
  const key = (l: { cell: number; kind: string }[]) => l.map((m) => `${m.cell}${m.kind}`).sort().join();
  check(c.complete && c.layouts.some((l) => key(l) === key(p.solution ?? [])), "the exhaustive search finds the stored layout");
}

/* ------------------------------------------------------------------ 5. Normal is the deal before levels */
console.log("5. Normal");
for (const seed of [0, 1, 2, 77, 1234, 4242, 99_001, 7_654_321]) {
  const now = deal("normal", seed);
  const before = withGameLevels({}, () => deal("normal", seed));
  const asked = withSeededRandom(seed, () => generatePuzzle("laser", { bankSeed: seed, level: "normal" }));

  check(strip(now) === strip(before), `Normal #${seed}: byte for byte the deal with no levels (bar its build time)`);
  check(strip(asked) === strip(now), `Normal #${seed}: asking for Normal deals the same`);
  check(!("level" in now) && now.shots === undefined && now.timeLimitMs === undefined && now.laserRev === 4, `Normal #${seed}: laserRev 4, no level, shots or clock field`);
  check(now.mirrors === (now.par ?? 0) + 2 && now.bombs.length >= 3 && now.bombs.length <= 4 && laserShotsOf(now) === 3, `Normal #${seed}: 2 spare mirrors, 3–4 bombs, 3 shots`);
}

/* ------------------------------------------------------------------ 6. the board */
console.log("6. board");
for (const level of [...LEVELS, "normal" as const]) {
  const p = deal(level, 5);
  const cells = [p.source, ...p.gems, ...p.bombs, ...p.blocks, ...(p.solution ?? []).map((m) => m.cell)];
  check(cells.every((c) => c >= 0 && c < LASER_CELLS) && LASER_CELLS === 100, `${level}: the same 10 × 10 board (35 px squares on a 375 px phone, as Normal)`);
}

/* ------------------------------------------------------------------ 7. a flawless solve scores 200 */
console.log("7. flawless");
const flawless = (p: Laser, atMs: number): string => {
  let log: LoggedAction[] = [];
  let t = 500;
  for (const m of p.solution ?? []) log = appendAction(log, laserAction.place(m.cell, m.kind), (t += 200));
  return encodeActionLog(appendAction(log, laserAction.fire(), atMs));
};
for (const level of ["easy", "normal", "hard", "expert"] as Level[]) {
  for (const seed of [3, 30]) {
    const p = deal(level, seed);
    const run = gradeSteps(p, [{ answer: flawless(p, 4_000), atMs: 5_500 }], true);
    check(run.isCorrect && run.score === 200, `${level} #${seed}: a flawless solve at 4 s scores ${run.score}`);
  }
}

/* ------------------------------------------------------------------ 8. grading reads the level */
console.log("8. grading");
const solveAt = (p: Laser, s: number) => gradeAnswer(p, flawless(p, s * 1000), puzzleTimeLimitMs(p) - s * 1000).score;
const n4 = deal("normal", 11);
check(patternFullByS("laser", n4) === LASER_REV4_FULL_BY_S && LASER_REV4_FULL_BY_S === 30, "Normal laserRev 4: full speed by 30 s");
check(solveAt(n4, 29) === 200 && solveAt(n4, 40) < 200, `Normal laserRev 4: 200 at 29 s (${solveAt(n4, 29)}), less at 40 s (${solveAt(n4, 40)})`);
const n3 = { ...n4, laserRev: 3 } as Laser;
check(patternFullByS("laser", n3) === PATTERN_STD.laser.fullByS && PATTERN_STD.laser.fullByS === 15, "laserRev 3 keeps full speed by 15 s");
check(solveAt(n3, 14) === 200 && solveAt(n3, 20) < 200, "laserRev 3: 200 at 14 s, less at 20 s (as before)");
for (const level of LEVELS) {
  const p = deal(level, 12);
  const s = settingsOf(level);
  check(patternFullByS("laser", p) === s.fullByS, `${level}: graded with its own full-speed time (${s.fullByS} s)`);
  check(solveAt(p, s.fullByS - 1) === 200 && solveAt(p, s.fullByS + 8) < 200, `${level}: 200 within ${s.fullByS} s, less after`);
  // The level's shots bound the server's replay: misses up to the last shot count, the next FIRE is dropped.
  let log: LoggedAction[] = [];
  for (let k = 0; k < s.shots + 1; k++) log = appendAction(log, laserAction.fire(), 1_000 + k * 2_000);
  const r = replayLaserLog(p, encodeActionLog(log), s.timeLimitMs);
  check(r.shots === s.shots && r.diag.dropped === 1, `${level}: the replay counts ${r.shots} of ${s.shots + 1} FIREs`);
  const g = gradeAnswer(p, encodeActionLog(log), 0);
  check((g.extra as { fires?: number })["fires"] === s.shots && !g.isCorrect, `${level}: the stored grade counts the level's shots`);
}
const x = deal("expert", 12);
check(solveAt(x, 80) > 150, `Expert: a solve at 80 s still has speed points on its 90 s clock (${solveAt(x, 80)})`);
// A solve on the level's last shot still solves; Expert's third FIRE does not.
{
  let log: LoggedAction[] = [];
  log = appendAction(log, laserAction.fire(), 1_000);
  log = appendAction(log, laserAction.fire(), 3_000);
  let t = 4_000;
  for (const m of x.solution ?? []) log = appendAction(log, laserAction.place(m.cell, m.kind), (t += 100));
  const third = encodeActionLog(appendAction(log, laserAction.fire(), 9_000));
  check(!gradeAnswer(x, third, 80_000).isCorrect, "Expert: a solving third FIRE doesn't count (two shots)");
  const easy = deal("easy", 12);
  let elog: LoggedAction[] = [];
  for (let k = 0; k < 4; k++) elog = appendAction(elog, laserAction.fire(), 1_000 + k * 1_000);
  t = 6_000;
  for (const m of easy.solution ?? []) elog = appendAction(elog, laserAction.place(m.cell, m.kind), (t += 100));
  check(gradeAnswer(easy, encodeActionLog(appendAction(elog, laserAction.fire(), 9_000)), 51_000).isCorrect, "Easy: a solving fifth FIRE counts (five shots)");
}
const hardAsNormal = { ...deal("hard", 12) } as Record<string, unknown>;
delete hardAsNormal["level"];
check(patternFullByS("laser", hardAsNormal) === LASER_REV4_FULL_BY_S, "the same board without its level stamp grades as Normal (the stored stamp decides)");
check(laserShotsOf({}) === 3 && laserShotsOf({ shots: 2 }) === 2, "a puzzle without shots gives three (every older round)");

/* ------------------------------------------------------------------ 9. a clear step up; Expert humanly possible */
console.log("9. step up");
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] ?? 0;
const m = Object.fromEntries(Object.entries(turnsOf).map(([k, v]) => [k, median(v)]));
console.log(`   the person-like solver's median tries: ${JSON.stringify(m)}`);
check(m["easy"]! < m["normal"]! && m["normal"]! < m["hard"]! && m["hard"]! < m["expert"]!, "each level up needs more tries of the person-like solver");
check(E.maxMirrors < 7 && H.minMirrors >= 8 && X.minMirrors > H.minMirrors, "the beam grows: Easy 4–5, Normal 7–8, Hard 8–9, Expert 9–10 mirrors");
check(E.spare > 2 && H.spare < 2 && X.spare < 2 && E.shots > 3 && X.shots < 3 && X.minBombs > H.minBombs && H.minBombs > 3 && E.maxBombs < 3, "slack falls and danger grows: spare mirrors, shots and bombs");
const kit = KITS.laser!;
const SEEDS = FULL ? 60 : 30;
const kitAverage = (level: Lv, skill: "great" | "good") => {
  let sum = 0;
  for (let i = 0; i < SEEDS; i++) {
    const p = deal(level, 900 + i);
    const play = kit.play(p, makeRng(hashText(`laser-levels:${level}:${i}:${skill}`)), SKILLS[skill], puzzleTimeLimitMs(p));
    sum += gradeSteps(p, asPhoneSends(p, play.steps), play.timed).score;
  }
  return sum / SEEDS;
};
for (const skill of ["great", "good"] as const) {
  const h = kitAverage("hard", skill);
  const x = kitAverage("expert", skill);
  console.log(`   ${skill} kit: Hard ${h.toFixed(1)}, Expert ${x.toFixed(1)}`);
  check(x < h - 4, `the ${skill} kit scores clearly less on Expert (${x.toFixed(1)}) than on Hard (${h.toFixed(1)})`);
}
let nearFinish = 0;
let nearSum = 0;
for (let i = 0; i < SEEDS; i++) {
  const p = deal("expert", 900 + i);
  const play = kit.play(p, makeRng(hashText(`laser-levels:expert:${i}:near`)), SKILLS.near, puzzleTimeLimitMs(p));
  const run = gradeSteps(p, asPhoneSends(p, play.steps), play.timed);
  if (run.isCorrect) nearFinish++;
  nearSum += run.score;
}
console.log(`   Near-perfect kit on Expert: finishes ${nearFinish}/${SEEDS}, average ${(nearSum / SEEDS).toFixed(1)}`);
check(nearFinish >= SEEDS * 0.9, `the Near-perfect kit finishes ${nearFinish} of ${SEEDS} Expert boards in its two shots`);
check(nearSum / SEEDS >= 180, `the Near-perfect kit scores well on Expert (average ${(nearSum / SEEDS).toFixed(1)})`);

console.log(`\n${failures === 0 ? "PASS" : "FAIL"} pattern-overhaul-laser-levels-check: ${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
