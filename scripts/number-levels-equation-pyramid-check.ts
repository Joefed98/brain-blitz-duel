/**
 * number-levels-equation-pyramid-check (stage 3 of the Number overhaul, 15 Nov 2026; docs/number-overhaul.md "Stage
 * 3"): Operator's and Integer Pyramid's levels.
 *
 *   1. The registry: both games offer Easy, Hard and Expert with their settings; Operator names `open` (any true fill
 *      counts), Integer Pyramid this check as its proof; every level's clock is the game's own (90 s / 120 s, ≤ 120 s).
 *   2. Normal is today's game, byte for byte: a deal with the registry's entries is identical to one with no entries
 *      (and to one asking for "normal"), carries no `level`, and keeps Operator's 3 tries.
 *   3. Integer Pyramid's level banks: rebuilt byte for byte (scripts/number-pyramid-levels-bank.ts --check); every
 *      board matches its level's stage (rows, empty stones, bottom values, the tray = the empty stones' values plus the
 *      level's decoys); exactly ONE tray assignment, decoys included (the fast counter, cross-checked against
 *      npCountSolutions on the four- and five-row boards); the person-like solver (every stone forced by a sum or the only
 *      tile that fits) completes every board, every Expert board included (800 boards); deals at each level come
 *      from its bank and grade a full solve as a finish.
 *   4. Operator's levels on 150 room seeds each: every line has the level's shape (numbers, gaps of each kind, decoys,
 *      the signs it may use; Expert's lines all mixed), between one and its most true fills, its stored fill true, the
 *      person-like search (left to right, whole running totals) finds a fill within the budget on every line, Expert
 *      included; the level's tries are stamped (Expert 2) and graded from the stored puzzle: a right fill on a third
 *      try counts on Hard, not on Expert.
 *
 *   bun scripts/number-levels-equation-pyramid-check.ts
 */
import { spawnSync } from "node:child_process";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { joinCountSuffix } from "../src/lib/duel/moveLimits";
import { joinStages } from "../src/lib/duel/stagedRounds";
import { gapSlots, gapStageCorrect, splitGapSegment } from "../src/lib/duel/operatorGaps";
import { countGapAnswers, operatorPersonSearch, OPERATOR_PERSON_BUDGET, type OperatorLevelSettings } from "../src/lib/duel/operatorGaps.server";
import { npCountSolutions, npEncodeRound, type NpPlacements } from "../src/lib/duel/numberPyramid";
import { npCountSolutionsFast, npPersonSolve, type NpLevelSettings } from "../src/lib/duel/numberPyramidLevels";
import { NUMBER_PYRAMID_LEVEL_BANKS } from "../src/lib/duel/numberPyramidLevelsBank.server";
import { puzzleDef } from "../src/lib/duel/registry";
import type { EquationPuzzleData, NumberPyramidPuzzleData, PuzzleData } from "../src/lib/duel/types";
import { gameLevelSettings, levelProof, levelsOf, withGameLevels } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel, type Level } from "../src/lib/levels/levels";

let failures = 0;
function check(ok: boolean, label: string): void {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}

const LEVELS3 = ["easy", "hard", "expert"] as const;
const deal = (type: "equation" | "numpyramid", seed: number, level?: Level) =>
  withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed, ...(level ? { level } : {}) }));

/* 1. The registry. */
for (const type of ["equation", "numpyramid"] as const) {
  check(JSON.stringify(levelsOf(type)) === JSON.stringify(["easy", "normal", "hard", "expert"]), `1. ${type} offers Easy, Normal, Hard, Expert`);
  for (const level of LEVELS3) {
    const proof = levelProof(type, level);
    check(type === "equation" ? !!proof && "open" in proof : !!proof && "proof" in proof && proof.proof === "scripts/number-levels-equation-pyramid-check.ts", `1. ${type} ${level}: one-solution rule named`);
    const clock = (deal(type, 7, level) as { timeLimitMs?: number }).timeLimitMs ?? puzzleDef(type).timeLimitMs;
    check(clock <= MAX_ROUND_CLOCK_MS && clock === (type === "equation" ? 90_000 : 120_000), `1. ${type} ${level}: clock ${clock / 1000} s`);
  }
}

/* 2. Normal is today's game. */
for (const type of ["equation", "numpyramid"] as const) {
  let same = 0;
  let unmarked = 0;
  for (let seed = 0; seed < 40; seed++) {
    const live = JSON.stringify(deal(type, seed));
    const bare = withGameLevels({}, () => JSON.stringify(deal(type, seed)));
    const asked = JSON.stringify(deal(type, seed, "normal"));
    if (live === bare && live === asked) same++;
    if (!("level" in (JSON.parse(live) as object))) unmarked++;
  }
  check(same === 40 && unmarked === 40, `2. ${type}: 40 Normal deals identical with and without the level entries, no level field (${same}, ${unmarked})`);
}
check((deal("equation", 3) as EquationPuzzleData).tryLimit === 3, "2. Operator's Normal keeps 3 tries");

/* 3. Integer Pyramid's level banks. */
{
  const rebuilt = spawnSync("bun", ["scripts/number-pyramid-levels-bank.ts", "--check"], { encoding: "utf8" });
  check(rebuilt.status === 0, `3. level banks rebuild byte for byte (${(rebuilt.stdout ?? "").trim().split("\n").pop()})`);
  for (const level of LEVELS3) {
    const settings = gameLevelSettings<NpLevelSettings>("numpyramid", level)!;
    const bank = NUMBER_PYRAMID_LEVEL_BANKS[level];
    let shape = 0, unique = 0, slowAgree = 0, slowTried = 0, person = 0, boards = 0;
    const steps: number[] = [];
    for (const entry of bank) {
      entry.pyramids.forEach((b, i) => {
        boards++;
        const st = settings.stages[i]!;
        const empties = b.givens.map((g, c) => (g == null ? c : -1)).filter((c) => c >= 0);
        const bottom = b.solution.slice(b.solution.length - b.rows);
        const missing = empties.map((c) => b.solution[c]!).sort((x, y) => x - y);
        const tray = [...b.tray].sort((x, y) => x - y);
        const left = [...tray];
        const contains = missing.every((v) => { const k = left.indexOf(v); if (k < 0) return false; left.splice(k, 1); return true; });
        if (b.rows === st.rows && b.givens.length === (b.rows * (b.rows + 1)) / 2 && empties.length >= st.minEmpty && empties.length <= st.maxEmpty
          && bottom.every((v) => v >= st.bottomLo && v <= st.bottomHi) && contains && left.length === settings.decoys
          && b.givens.every((g, c) => g == null || g === b.solution[c])) shape++;
        if (npCountSolutionsFast(b.givens, b.tray, b.rows, 2) === 1) unique++;
        if (b.rows <= 5 && slowTried < 120) { slowTried++; if (npCountSolutions(b.givens, b.tray, b.rows, 2) === 1) slowAgree++; }
        const solved = npPersonSolve(b.givens, b.tray, b.rows, b.solution);
        if (solved.solved) person++;
        steps.push(solved.steps.filter((s) => s.why === "only-tile").length);
      });
    }
    check(bank.length >= 100 && shape === boards, `3. ${level}: ${bank.length} sets, every board the level's shape (${shape}/${boards})`);
    check(unique === boards, `3. ${level}: every board has exactly one tray assignment, decoys included (${unique}/${boards})`);
    if (slowTried) check(slowAgree === slowTried, `3. ${level}: npCountSolutions agrees on ${slowTried} boards`);
    check(person === boards, `3. ${level}: the person-like solver completes every board (${person}/${boards}; "only tile" steps a board: avg ${(steps.reduce((a, b) => a + b, 0) / boards).toFixed(1)}, max ${Math.max(...steps)})`);
    // Deals come from the bank and a full solve grades as a finish.
    let fromBank = 0, finishes = 0;
    const keys = new Set(bank.map((e) => JSON.stringify(e.pyramids.map((b) => b.givens))));
    for (let seed = 0; seed < 12; seed++) {
      const p = deal("numpyramid", seed, level) as NumberPyramidPuzzleData;
      if (puzzleLevel(p) === level && keys.has(JSON.stringify(p.pyramids.map((b) => b.givens)))) fromBank++;
      const boardsPl: NpPlacements[] = p.pyramids.map((b, i) => {
        const used = new Set<number>();
        const pl: NpPlacements = {};
        b.givens.forEach((g, cell) => {
          if (g != null) return;
          const t = b.tray.findIndex((v, k) => v === p.solutions![i]![cell] && !used.has(k));
          used.add(t);
          pl[cell] = t;
        });
        return pl;
      });
      const g = gradeAnswer(p as PuzzleData, npEncodeRound(4, boardsPl), 60_000);
      if (g.isCorrect && g.score >= 150) finishes++;
    }
    check(fromBank === 12 && finishes === 12, `3. ${level}: deals stamped ${level} from its bank (${fromBank}/12), a full solve finishes (${finishes}/12)`);
  }
}

/* 4. Operator's levels. */
{
  for (const level of LEVELS3) {
    const settings = gameLevelSettings<OperatorLevelSettings>("equation", level)!;
    let shape = 0, answers = 0, stored = 0, person = 0, lines = 0, tries = 0;
    const nodes: number[] = [];
    for (let seed = 0; seed < 150; seed++) {
      const p = deal("equation", 5000 + seed, level) as EquationPuzzleData;
      if (p.tryLimit === settings.tries && puzzleLevel(p) === level && (p.gapsRev ?? 0) >= 1) tries++;
      p.stages.forEach((stage, i) => {
        lines++;
        const line = settings.lines[i]!;
        const slots = gapSlots(stage);
        const numGaps = slots.filter((s) => s.kind === "number").length;
        const signGaps = slots.filter((s) => s.kind === "sign").length;
        const fills = splitGapSegment(p.gapAnswers?.[i] ?? "", slots.length);
        const numbers = stage.numbers.map((n, k) => {
          const at = slots.findIndex((s) => s.kind === "number" && s.index === k);
          return at >= 0 ? Number(fills[at]) : n;
        });
        const ops = (stage.signs ?? []).map((o, k) => {
          const at = slots.findIndex((s) => s.kind === "sign" && s.index === k);
          return at >= 0 ? fills[at]! : o!;
        });
        const inRange = (v: number) => v >= line.lo && v <= line.hi;
        if (stage.numbers.length === line.count && numGaps === line.numberGaps && signGaps === line.signGaps
          && (stage.tray ?? []).length === line.numberGaps + (line.numberGaps ? line.decoys : 0)
          && numbers.every(inRange) && (stage.tray ?? []).every(inRange)
          && ops.every((o) => line.signs.includes(o)) && [...(line.need ?? "")].every((o) => ops.includes(o))
          && (level !== "expert" || (numGaps > 0 && signGaps > 0 && (stage.tray ?? []).length === numGaps + 2))) shape++;
        const n = countGapAnswers(stage, line.maxAnswers);
        if (n >= 1 && n <= line.maxAnswers) answers++;
        if (gapStageCorrect(stage, p.gapAnswers?.[i])) stored++;
        const found = operatorPersonSearch(stage, OPERATOR_PERSON_BUDGET);
        if (found <= OPERATOR_PERSON_BUDGET) person++;
        nodes.push(found);
      });
    }
    const sorted = nodes.filter(Number.isFinite).sort((a, b) => a - b);
    check(shape === lines, `4. ${level}: every line has the level's shape (${shape}/${lines})`);
    check(answers === lines && stored === lines, `4. ${level}: every line has 1 to its most true fills (${answers}/${lines}), the stored fill true (${stored}/${lines})`);
    check(person === lines, `4. ${level}: the person-like search finds a fill on every line (${person}/${lines}; partial lines tried: median ${sorted[Math.floor(sorted.length / 2)]}, max ${sorted[sorted.length - 1]})`);
    check(tries === 150, `4. ${level}: ${settings.tries} tries stamped and the level marked (${tries}/150)`);
  }
  // Tries graded from the stored puzzle: the right fill on the third try.
  for (const [level, counts] of [["hard", true], ["expert", false]] as const) {
    const p = deal("equation", 11, level) as EquationPuzzleData;
    const body = joinStages(p.gapAnswers ?? [], p.stages.length);
    const g = gradeAnswer(p as PuzzleData, joinCountSuffix(body, p.stages.map(() => 3)), 30_000);
    check(g.isCorrect === counts, `4. ${level}: all four right on a third try ${counts ? "counts" : "does not count"} (tryLimit ${p.tryLimit}, score ${g.score})`);
    const first = gradeAnswer(p as PuzzleData, joinCountSuffix(body, p.stages.map(() => 1)), 30_000);
    check(first.isCorrect && first.score >= 150, `4. ${level}: all four right first time finishes (${first.score})`);
  }
}

console.log(failures ? `FAIL: ${failures} failure(s)` : "PASS: number-levels-equation-pyramid-check");
process.exit(failures ? 1 : 0);
