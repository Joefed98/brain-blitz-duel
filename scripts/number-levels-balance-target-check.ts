/**
 * Counterweight's and Exact's levels (Number overhaul stage 3, 15 Nov 2026; balanceLevels.ts, targetLevels.server.ts).
 *
 *   1. The registry: both games offer Easy, Hard and Expert; every level's clock is at most 120 s.
 *   2. Normal. Counterweight (Joe's decision, 15 Nov 2026): today's game is Hard exactly (the same deal, seed for seed, as
 *      today's Normal with the old era pinned), and Normal is the new balanceRev 5 game with no level field. Exact: Normal
 *      is byte for byte the deal with no levels at all.
 *   3. Each level deals what its settings say, every board solvable (the stored solution checked), unique where the
 *      level asks (an exhaustive count), Exact's target rule proved by exhaustive search.
 *   4. Expert: the person-like solvers complete every Expert board dealt (100 seeds each).
 *   5. Grading: balanceRev 5 grades exactly as balanceRev 4 on the same scales; older stamps (rev 3, rev 4) grade as before;
 *      a level's solution finishes; the stage hides the readout at Expert only.
 *
 * bun scripts/number-levels-balance-target-check.ts
 */
import { readFileSync } from "node:fs";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { encodeBalance, scalePegs, scaleSolved, type Placement } from "../src/lib/duel/balance";
import { BALANCE_NORMAL, BALANCE_REV_LEVELS, balanceHidden, type BalanceLevelSettings } from "../src/lib/duel/balanceLevels";
import { personSolveScale } from "../src/lib/duel/balanceLevels.server";
import { balancedArrangements } from "../src/lib/duel/numberRounds.server";
import { TARGET_EXPERT_BANK_RULE, personSolveTarget, type TargetLevelSettings, type TargetRoundSpec } from "../src/lib/duel/targetLevels.server"; // Changed with Joe's approval, 22 Nov 2026
import { TARGET_REV_ROUNDS, joinTargetRounds, targetRoundsOf, usesTargetRounds } from "../src/lib/duel/targetRounds"; // Changed with Joe's approval, 22 Nov 2026
import { TARGET_EXPERT_BANK } from "../src/lib/duel/targetExpertBank.server";
import { TARGET_ROUND_BANK } from "../src/lib/duel/targetRoundBank.server"; // Changed with Joe's approval, 22 Nov 2026
import { buildTargetExpertBank } from "./target-expert-bank";
import { encodeSteps, LARGE_TILES, replayTargetSteps, solveTarget, solveWithAllSixTiles } from "../src/lib/duel/target";
import { exactMinTiles } from "../src/lib/duel/standard/number.server";
import { joinCountSuffix } from "../src/lib/duel/moveLimits";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { gameLevelSettings, levelsOf, withGameLevels } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel, type Level } from "../src/lib/levels/levels";
import { pinPreNumberOverhaul } from "../src/lib/duel/numberOverhaul";
import type { BalancePuzzleData, PuzzleData, TargetNumberPuzzleData } from "../src/lib/duel/types";

let failures = 0;
let passes = 0;
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures++;
    console.log(`FAIL ${label}`);
  }
};

const LEVELS3: Exclude<Level, "normal">[] = ["easy", "hard", "expert"];
const deal = (type: "balance" | "target", seed: number, level?: Level): PuzzleData =>
  withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed, ...(level ? { level } : {}) }));
const strip = (p: PuzzleData) => {
  const { level: _l, ...rest } = p as PuzzleData & { level?: string };
  return rest;
};

/* 1. The registry. */
for (const type of ["balance", "target"] as const) {
  ok(levelsOf(type).join() === "easy,normal,hard,expert", `${type}: offers Easy, Normal, Hard and Expert (${levelsOf(type).join()})`);
  for (const level of ["easy", "normal", "hard", "expert"] as const) {
    for (let seed = 0; seed < 4; seed++) {
      const p = deal(type, 900 + seed, level === "normal" ? undefined : level);
      ok(puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS, `${type} ${level} ${seed}: clock ${puzzleTimeLimitMs(p)} ≤ 120 s`);
      // D2: Exact's Hard and Expert rounds of targets run 100 s and 120 s; Easy and Normal 75 s. Changed with Joe's approval, 22 Nov 2026
      const exactClock = level === "hard" ? 100_000 : level === "expert" ? 120_000 : 75_000; // Changed with Joe's approval, 22 Nov 2026
      if (type === "target") ok(puzzleTimeLimitMs(p) === exactClock, `Exact ${level} ${seed}: ${exactClock / 1000} s`); // Changed with Joe's approval, 22 Nov 2026
    }
  }
}

/* 2. Normal. */
{
  let same = 0;
  let newNormal = 0;
  let exactSame = 0;
  for (let seed = 0; seed < 30; seed++) {
    const hard = deal("balance", seed, "hard") as BalancePuzzleData;
    ok(puzzleLevel(hard) === "hard", `Counterweight hard ${seed}: stamped Hard`);
    // Today's game, as rooms dealt it before levels: Normal with the old era pinned.
    const today = withSeededRandom(seed, () => generatePuzzle("balance", { bankSeed: seed }, { pins: ["preBalanceLevels"] }));
    // D2 (Joe's decision 10, a Hard you can see): Hard is the new 10-notch balanceRev 5 game; today's game is still dealt // Changed with Joe's approval, 22 Nov 2026
    // by its pin at Normal. // Changed with Joe's approval, 22 Nov 2026
    if (hard.balanceRev === BALANCE_REV_LEVELS && hard.scales.every((s) => scalePegs(s) === 10) && (today as BalancePuzzleData).balanceRev === 4 && !("level" in today)) same++; // Changed with Joe's approval, 22 Nov 2026
    const normal = deal("balance", seed) as BalancePuzzleData;
    if (normal.balanceRev === BALANCE_REV_LEVELS && !("level" in normal) && normal.scales.length === BALANCE_NORMAL.scales!.length) newNormal++;
    // Exact's Normal: the deal with no levels registered at all.
    const t = JSON.stringify(deal("target", seed));
    const bare = JSON.stringify(withGameLevels({}, () => deal("target", seed)));
    if (t === bare && !t.includes('"level"')) exactSame++;
  }
  ok(same === 30, `Counterweight Hard is the 10-notch balanceRev ${BALANCE_REV_LEVELS} game and today's game is dealt by its pin at Normal, on 30 seeds (${same})`); // Changed with Joe's approval, 22 Nov 2026
  ok(newNormal === 30, `Counterweight Normal is the new balanceRev ${BALANCE_REV_LEVELS} game, no level field (${newNormal}/30)`);
  ok(exactSame === 30, `Exact Normal byte for byte the deal before levels (${exactSame}/30)`);
  // D2: Hard deals balanceRev 5 (the levels' stamp); today's balanceRev 4 game is the pinned era's. // Changed with Joe's approval, 22 Nov 2026
  ok((deal("balance", 3, "hard") as BalancePuzzleData).balanceRev === BALANCE_REV_LEVELS, `Counterweight Hard deals balanceRev ${BALANCE_REV_LEVELS}`); // Changed with Joe's approval, 22 Nov 2026
}

/* 3. Each level deals what its settings say. */
const balanceSettings = (level: Level): BalanceLevelSettings =>
  level === "normal" ? BALANCE_NORMAL : (gameLevelSettings<BalanceLevelSettings>("balance", level) as BalanceLevelSettings);
for (const level of ["easy", "normal", "hard", "expert"] as const) { // Changed with Joe's approval, 22 Nov 2026
  const set = balanceSettings(level);
  let bad = 0;
  for (let seed = 0; seed < 25; seed++) {
    const p = deal("balance", 2000 + seed, level === "normal" ? undefined : level) as BalancePuzzleData;
    const specs = set.scales!;
    const why: string[] = [];
    if (p.balanceRev !== BALANCE_REV_LEVELS) why.push(`rev ${p.balanceRev}`);
    if (p.scales.length !== specs.length) why.push("scale count");
    p.scales.forEach((scale, i) => {
      const spec = specs[i]!;
      if (scalePegs(scale) !== spec.pegs) why.push(`scale ${i} notches ${scalePegs(scale)}`);
      if (scale.tray.length !== spec.loose || scale.fixed.length !== spec.fixed) why.push(`scale ${i} weights`);
      if (scale.tray.some((w) => w > (spec.maxW ?? 9)) || scale.fixed.some((f) => f.w > (spec.maxW ?? 9))) why.push(`scale ${i} too heavy`);
      if (!scaleSolved(scale, (p.solutions?.[i] ?? []) as Placement)) why.push(`scale ${i} solution unbalanced`);
      if (spec.unique && balancedArrangements(scale) !== 1) why.push(`scale ${i} not unique`);
      if (p.placeLimits?.[i] !== scale.tray.length + set.spare![i]!) why.push(`scale ${i} limit`);
    });
    if (!!p.hideBalance !== !!set.hide || balanceHidden(p) !== !!set.hide) why.push("readout");
    if (why.length) {
      bad++;
      console.log(`  Counterweight ${level} ${seed}: ${why.join(", ")}`);
    }
  }
  ok(bad === 0, `Counterweight ${level}: 25 boards as the settings say, solvable, unique where asked`);
}
{
  // D2 (22 Nov 2026): Hard and Expert are targets in a row (targetRounds.ts), each target checked by its own rule: // Changed with Joe's approval, 22 Nov 2026
  // today's Normal rule (1 or 2 large, 101–999), the Expert bank, or the level rule by exhaustive search. // Changed with Joe's approval, 22 Nov 2026
  const settings = (level: "easy" | "hard" | "expert") => gameLevelSettings<TargetLevelSettings>("target", level)!;
  const bankKeys = new Set(TARGET_EXPERT_BANK.map((b) => JSON.stringify({ tiles: b.tiles, target: b.target, solution: b.solution }))); // Changed with Joe's approval, 22 Nov 2026
  const roundKeys = new Set(TARGET_ROUND_BANK.map((b) => JSON.stringify({ tiles: b.tiles, target: b.target, solution: b.solution }))); // Changed with Joe's approval, 22 Nov 2026
  for (const level of ["easy", "hard", "expert"] as const) {
    const set = settings(level);
    const specs: readonly TargetRoundSpec[] = "rounds" in set ? set.rounds : [set]; // Changed with Joe's approval, 22 Nov 2026
    let bad = 0;
    for (let seed = 0; seed < (level === "expert" ? 12 : 25); seed++) {
      const p = deal("target", 3000 + seed, level) as TargetNumberPuzzleData;
      const why: string[] = [];
      const rounds = targetRoundsOf(p); // Changed with Joe's approval, 22 Nov 2026
      if (rounds.length !== specs.length) why.push(`${rounds.length} targets`); // Changed with Joe's approval, 22 Nov 2026
      if ("rounds" in set && (p.timeLimitMs !== set.clockS * 1000 || p.speedFullByS !== set.fullByS || p.targetRev !== TARGET_REV_ROUNDS)) why.push("round stamps"); // Changed with Joe's approval, 22 Nov 2026
      rounds.forEach((r, i) => { // Changed with Joe's approval, 22 Nov 2026
        const spec = specs[i]; // Changed with Joe's approval, 22 Nov 2026
        if (!spec) return; // Changed with Joe's approval, 22 Nov 2026
        const solution = usesTargetRounds(p) ? (p.solutions?.[i] ?? []) : p.solution; // Changed with Joe's approval, 22 Nov 2026
        const replay = replayTargetSteps(r.tiles, r.target, solution); // Changed with Joe's approval, 22 Nov 2026
        if (replay.distance !== 0 || replay.steps.length !== solution.length) why.push(`target ${i + 1}: stored solution misses`); // Changed with Joe's approval, 22 Nov 2026
        const large = r.tiles.filter((t) => LARGE_TILES.includes(t)).length; // Changed with Joe's approval, 22 Nov 2026
        if (r.tiles.some((t) => !LARGE_TILES.includes(t) && (t < 1 || t > 10))) why.push(`target ${i + 1}: small tile out of 1–10`); // Changed with Joe's approval, 22 Nov 2026
        if ("normal" in spec) { // Changed with Joe's approval, 22 Nov 2026
          if (large < 1 || large > 2 || r.target < 101 || r.target > 999) why.push(`target ${i + 1}: not a Normal-style target`); // Changed with Joe's approval, 22 Nov 2026
          if (spec.person && !personSolveTarget(r.tiles, r.target)) why.push(`target ${i + 1}: the person-like solver misses it`); // Changed with Joe's approval, 22 Nov 2026
          return; // Changed with Joe's approval, 22 Nov 2026
        } // Changed with Joe's approval, 22 Nov 2026
        if ("normalBank" in spec) { // Changed with Joe's approval, 22 Nov 2026
          if (!roundKeys.has(JSON.stringify({ tiles: r.tiles, target: r.target, solution }))) why.push(`target ${i + 1}: not a round-bank board`); // Changed with Joe's approval, 22 Nov 2026
          if (!personSolveTarget(r.tiles, r.target)) why.push(`target ${i + 1}: the person-like solver misses it`); // Changed with Joe's approval, 22 Nov 2026
          return; // Changed with Joe's approval, 22 Nov 2026
        } // Changed with Joe's approval, 22 Nov 2026
        if ("expertBank" in spec) { // Changed with Joe's approval, 22 Nov 2026
          if (!bankKeys.has(JSON.stringify({ tiles: r.tiles, target: r.target, solution }))) why.push(`target ${i + 1}: not a bank board`); // Changed with Joe's approval, 22 Nov 2026
          return; // Changed with Joe's approval, 22 Nov 2026
        } // Changed with Joe's approval, 22 Nov 2026
        if (large < spec.large[0] || large > spec.large[1]) why.push(`target ${i + 1}: large ${large}`); // Changed with Joe's approval, 22 Nov 2026
        if (r.target < spec.target[0] || r.target > spec.target[1]) why.push(`target ${i + 1}: target ${r.target}`); // Changed with Joe's approval, 22 Nov 2026
        const min = exactMinTiles(r.tiles, r.target); // Changed with Joe's approval, 22 Nov 2026
        if (min < spec.tiles[0] || min > spec.tiles[1]) why.push(`target ${i + 1}: fewest numbers ${min}`); // Changed with Joe's approval, 22 Nov 2026
        if (spec.tiles[0] === 6) { // Changed with Joe's approval, 22 Nov 2026
          // Exhaustive: no route from any five (or fewer) of the numbers, a route from all six. Changed with Joe's approval, 22 Nov 2026
          for (let skip = 0; skip < 6; skip++) if (solveTarget(r.tiles.filter((_, k) => k !== skip), r.target)) why.push(`target ${i + 1}: five numbers reach it without tile ${skip}`); // Changed with Joe's approval, 22 Nov 2026
          if (!solveWithAllSixTiles(r.tiles, r.target)) why.push(`target ${i + 1}: no route from all six`); // Changed with Joe's approval, 22 Nov 2026
        } else if (min < spec.tiles[0] || !solveTarget(r.tiles, r.target)) why.push(`target ${i + 1}: not a ${spec.tiles[0]}–${spec.tiles[1]} number target`); // Changed with Joe's approval, 22 Nov 2026
        if (spec.person && !personSolveTarget(r.tiles, r.target)) why.push(`target ${i + 1}: the person-like solver misses it`); // Changed with Joe's approval, 22 Nov 2026
      }); // Changed with Joe's approval, 22 Nov 2026
      if (why.length) {
        bad++;
        console.log(`  Exact ${level} ${seed}: ${why.join(", ")}`);
      }
    }
    ok(bad === 0, `Exact ${level}: every target obeys its rule (exhaustive search)`); // Changed with Joe's approval, 22 Nov 2026
  }
}

/* 4. Expert: the person-like solvers complete every board dealt. */
{
  let balancePass = 0;
  let targetPass = 0;
  const N = 100;
  for (let seed = 0; seed < N; seed++) {
    const b = deal("balance", 5000 + seed, "expert") as BalancePuzzleData;
    if (b.scales.every((scale) => personSolveScale(scale) !== null)) balancePass++;
    const t = deal("target", 5000 + seed, "expert") as TargetNumberPuzzleData;
    // D2: every target of the Expert round. // Changed with Joe's approval, 22 Nov 2026
    if (targetRoundsOf(t).every((r) => personSolveTarget(r.tiles, r.target))) targetPass++; // Changed with Joe's approval, 22 Nov 2026
  }
  console.log(`  person-like solver on Expert: Counterweight ${balancePass}/${N}, Exact ${targetPass}/${N}`);
  ok(balancePass === N, `Counterweight Expert: the person-like solver balances every scale on ${N} boards (${balancePass})`);
  ok(targetPass === N, `Exact Expert: the person-like solver reaches every target of the round on ${N} rounds (${targetPass})`); // Changed with Joe's approval, 22 Nov 2026
}

/* 4b. Exact's Expert bank (Changed with Joe's approval, 16 Nov 2026 (Exact Expert bank)): Expert deals from a proved
 * bank, never a live search. Every board in it obeys the Expert rule by exhaustive search and is reached by the
 * person-like solver; the bank rebuilds (a sample of its first boards; CHECKS_FULL=1 the whole bank); each deal is a
 * bank board and takes milliseconds. */
{
  const set = TARGET_EXPERT_BANK_RULE; // D2: the bank's own rule (Expert is a round of targets). Changed with Joe's approval, 22 Nov 2026
  let bad = 0;
  for (const [i, b] of TARGET_EXPERT_BANK.entries()) {
    const why: string[] = [];
    if (b.tiles.length !== 6 || b.tiles.some((t) => LARGE_TILES.includes(t) || t < 1 || t > 10)) why.push("not six small numbers");
    if (b.target < set.target[0] || b.target > set.target[1]) why.push(`target ${b.target}`);
    const replay = replayTargetSteps(b.tiles, b.target, b.solution);
    if (replay.distance !== 0 || replay.steps.length !== b.solution.length) why.push("stored solution misses");
    for (let skip = 0; skip < 6; skip++) if (solveTarget(b.tiles.filter((_, k) => k !== skip), b.target)) why.push(`five numbers reach it without tile ${skip}`);
    if (!solveWithAllSixTiles(b.tiles, b.target)) why.push("no route from all six");
    if (!personSolveTarget(b.tiles, b.target)) why.push("the person-like solver misses it");
    if (why.length) {
      bad++;
      console.log(`  Exact Expert bank ${i}: ${why.join(", ")}`);
    }
  }
  ok(TARGET_EXPERT_BANK.length >= 300, `Exact Expert bank: ${TARGET_EXPERT_BANK.length} boards (300 or more)`);
  ok(bad === 0, `Exact Expert bank: every board needs all six numbers, hits its target and is reached by the person-like solver (${TARGET_EXPERT_BANK.length - bad}/${TARGET_EXPERT_BANK.length})`);
  const keys = new Set(TARGET_EXPERT_BANK.map((b) => `${[...b.tiles].sort((x, y) => x - y).join(",")}>${b.target}`));
  ok(keys.size === TARGET_EXPERT_BANK.length, "Exact Expert bank: no board twice");
  const full = process.env["CHECKS_FULL"] === "1";
  const rebuilt = buildTargetExpertBank(full ? TARGET_EXPERT_BANK.length : 6);
  ok(JSON.stringify(rebuilt) === JSON.stringify(TARGET_EXPERT_BANK.slice(0, rebuilt.length)), `Exact Expert bank: ${full ? "the whole bank" : "its first 6 boards"} rebuild exactly`);
  const inBank = new Set(TARGET_EXPERT_BANK.map((b) => JSON.stringify(b)));
  let fromBank = 0;
  let slowest = 0;
  for (let seed = 0; seed < 60; seed++) {
    const t0 = performance.now();
    const p = deal("target", 7000 + seed, "expert") as TargetNumberPuzzleData;
    slowest = Math.max(slowest, performance.now() - t0);
    // D2: the Expert round's last target is the bank board. // Changed with Joe's approval, 22 Nov 2026
    const last = targetRoundsOf(p).length - 1; // Changed with Joe's approval, 22 Nov 2026
    const lastBoard = targetRoundsOf(p)[last]!; // Changed with Joe's approval, 22 Nov 2026
    if (inBank.has(JSON.stringify({ tiles: lastBoard.tiles, target: lastBoard.target, solution: usesTargetRounds(p) ? p.solutions?.[last] : p.solution }))) fromBank++; // Changed with Joe's approval, 22 Nov 2026
  }
  ok(fromBank === 60, `Exact Expert: every round ends on a bank board (${fromBank}/60)`); // Changed with Joe's approval, 22 Nov 2026
  ok(slowest < 50, `Exact Expert: a deal takes milliseconds (slowest ${slowest.toFixed(1)} ms)`);
  const a = JSON.stringify(deal("target", 4242, "expert"));
  ok(a === JSON.stringify(deal("target", 4242, "expert")), "Exact Expert: the same seed deals the same board");
}

/* 5. Grading. */
const balanceAnswer = (p: BalancePuzzleData, extra = 0) =>
  joinCountSuffix(encodeBalance((p.solutions ?? []) as Placement[]), p.scales.map((s) => s.tray.length + extra));
for (const level of ["easy", "normal", "hard", "expert"] as const) {
  const p = deal("balance", 77, level === "normal" ? undefined : level) as BalancePuzzleData;
  for (const ms of [0, 40_000, 100_000]) {
    const g = gradeAnswer(p, balanceAnswer(p), ms);
    ok(g.isCorrect && g.score >= 150, `Counterweight ${level}: the solution finishes (${ms} ms left: ${g.score})`);
    if (p.balanceRev === BALANCE_REV_LEVELS) {
      // balanceRev 5 grades as balanceRev 4 on the same scales and limits.
      const as4 = { ...p, balanceRev: 4 } as BalancePuzzleData;
      for (const answer of [balanceAnswer(p), balanceAnswer(p, 2), joinCountSuffix(encodeBalance(p.scales.map((s) => s.tray.map(() => null))), p.scales.map(() => 0))]) {
        const a = gradeAnswer(p, answer, ms);
        const b = gradeAnswer(as4, answer, ms);
        ok(a.score === b.score && a.isCorrect === b.isCorrect, `Counterweight ${level}: rev 5 grades as rev 4 (${ms} ms, ${a.score} vs ${b.score})`);
      }
    }
  }
}
{
  // Older stamps: rev 3 and rev 4 deals grade as the overhaul's own check expects (the same score on both stamps).
  const was = pinPreNumberOverhaul(true);
  const rev3 = deal("balance", 7) as BalancePuzzleData;
  pinPreNumberOverhaul(was);
  // D2: today's balanceRev 4 game is the preBalanceLevels era's at Normal (Hard is balanceRev 5). Changed with Joe's approval, 22 Nov 2026
  const rev4 = withSeededRandom(7, () => generatePuzzle("balance", { bankSeed: 7 }, { pins: ["preBalanceLevels"] })) as BalancePuzzleData; // Changed with Joe's approval, 22 Nov 2026
  ok(rev3.balanceRev === 3 && rev4.balanceRev === 4, `older stamps still dealt: rev ${rev3.balanceRev}, rev ${rev4.balanceRev} by its pin`); // Changed with Joe's approval, 22 Nov 2026
  for (const ms of [0, 30_000, 90_000]) {
    const a = gradeAnswer(rev3, balanceAnswer(rev3), ms).score;
    const b = gradeAnswer(rev4, balanceAnswer(rev4), ms).score;
    ok(a === b, `rev 3 and rev 4 grade the same clean solve (${ms} ms: ${a} / ${b})`);
  }
}
for (const level of LEVELS3) {
  const p = deal("target", 88, level) as TargetNumberPuzzleData;
  // D2: a round of targets sends every target's route. // Changed with Joe's approval, 22 Nov 2026
  const g = gradeAnswer(p, usesTargetRounds(p) ? joinTargetRounds((p.solutions ?? []).map((s) => encodeSteps(s))) : encodeSteps(p.solution), 60_000); // Changed with Joe's approval, 22 Nov 2026
  ok(g.isCorrect && g.score === 200, `Exact ${level}: the stored route at full speed scores 200 (${g.score})`);
  const none = gradeAnswer(p, encodeSteps([]), 60_000);
  ok(!none.isCorrect && none.score < 150, `Exact ${level}: nothing made does not finish (${none.score})`);
}
{
  const bal = readFileSync("src/puzzles/balance.tsx", "utf8");
  ok(/freeMoves && !balanceHidden\(data\)/.test(bal), "the stage hides the readout through balanceHidden");
  ok(!balanceHidden(deal("balance", 1) as BalancePuzzleData) && !balanceHidden(deal("balance", 1, "hard") as BalancePuzzleData), "Normal and Hard show the readout");
  ok(balanceHidden(deal("balance", 1, "expert") as BalancePuzzleData), "Expert hides the readout");
}

/* ------------------------------------------------------------------ 9. Counterweight's goal line names its scales */
// 16 Nov 2026 (Joe): the goal line names the scales each level deals; a four-scale deal keeps the game's own line.
{
  const { balanceGoalLine } = await import("../src/puzzles/balance");
  const { frameGoal } = await import("../src/components/duel/GameFrame");
  ok(frameGoal("balance") === "Balance each of the four scales", `Counterweight: the game's own goal line names four scales (${frameGoal("balance")})`);
  for (const level of ["easy", "normal", "hard", "expert"] as const) {
    for (const seed of [1, 2, 3]) {
      const p = deal("balance", seed, level) as PuzzleData & { scales: unknown[] };
      const n = p.scales.length;
      const shown = balanceGoalLine(n) ?? frameGoal("balance");
      const word = ["", "one", "two", "three", "four", "five", "six"][n];
      ok(shown.includes(`${word} scales`) || (n === 1 && shown === "Balance the scale"), `Counterweight ${level} ${seed}: the goal line names ${n} scales ("${shown}")`);
    }
  }
}

console.log(failures ? `FAIL number-levels-balance-target-check: ${failures} failed, ${passes} passed` : `number-levels-balance-target-check: ${passes} passed, 0 failed`);
process.exit(failures ? 1 : 0);
