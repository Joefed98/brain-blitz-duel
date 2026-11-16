/**
 * logic-levels-check (Logic overhaul 2, stage 3, 16 Nov 2026): Easy, Hard and Expert for Tents and Trees, Shikaku,
 * Lamplighter, Trail, Loopline, Regions and Island Link (src/lib/duel/logicLevels.ts, logicLevelDeal.server.ts). The
 * registry names this script as every one of those levels' one-solution proof.
 *
 *   1. The registry: each game offers Easy, Hard and Expert, each naming this proof, every clock at most 120 s.
 *   2. Normal is untouched: a Normal deal carries no level and no clock of its own, and asking for "normal" deals the
 *      same board as asking for nothing.
 *   3. Every level's boards (live deals and every bank entry): the level stamped, the level's clock, the level's board
 *      (width kept, height or size, counts), exactly one solution by the game's own solver, finished by a person-style
 *      solver (logicHuman.server.ts: deduction and one-step trials, no guessing) inside the level's band of trials,
 *      the stored solution graded a correct finish.
 *   4. The slow levels come from their banks, and the banks rebuild as the live deal builds them (a sample; the
 *      builder's own --check rebuilds every entry).
 *   5. Expert is humanly possible (Joe, 15 Nov 2026): the person-style solver finishes every Expert board (3), and the
 *      elite bot (the kits' near-perfect player) finishes most of them.
 *
 * Quick by default (a few boards a level, a sample of each bank); CHECKS_FULL=1 or --full: more boards and every bank
 * entry.
 */
import assert from "node:assert/strict";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { solveLikePerson } from "../src/lib/duel/logicHuman.server";
import { LOGIC_GAME_LEVELS, LOGIC_LEVEL_GAMES, type LogicLevelGame } from "../src/lib/duel/logicLevels";
import { LOGIC_LEVEL_BANK } from "../src/lib/duel/logicLevelBank.server";
import { LOGIC_LEVEL_BANKED, LOGIC_LEVEL_BANK_SIZE, logicLevelBankSeed } from "../src/lib/duel/logicLevelBankSpec";
import { dealLogicLevel, logicLevelBankOff } from "../src/lib/duel/logicLevelDeal.server";
import { countTentSolutions, encodeTents, tentsHeightOf, TENTS_SIZE } from "../src/lib/duel/tents";
import { countShikakuSolutions, encodeShikaku, shikakuHeightOf, SHIKAKU_SIZE } from "../src/lib/duel/shikaku";
import { countLightUpSolutions, encodeBulbs, lightUpHeightOf, LIGHTUP_SIZE } from "../src/lib/duel/lightUp";
import { trCountSolutions, trEncode } from "../src/lib/duel/trail";
import { countFencesSolutions } from "../src/lib/duel/fences.server";
import { encodeFences, fencesEdgeCount, FENCES_LINE } from "../src/lib/duel/fences";
import { solveFillomino } from "../src/lib/duel/fillomino.server";
import { encodeFillomino } from "../src/lib/duel/fillomino";
import { bridgesSolutionAnswer, countBridgesSolutions } from "../src/lib/duel/bridges.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/catalogue";
import { levelsOf, levelProof, gameLevelSettings } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel, type Level } from "../src/lib/levels/levels";
import type { PuzzleData } from "../src/lib/duel/types";
import { tune } from "./level-tune";

const FULL = process.env["CHECKS_FULL"] === "1" || process.argv.includes("--full");
const BOARDS = FULL ? 10 : 3;
const BANK_SAMPLE = FULL ? LOGIC_LEVEL_BANK_SIZE : 6;
const BOT_SEEDS = FULL ? 12 : 6;
const LEVELS = ["easy", "hard", "expert"] as const;
const WIDTH: Partial<Record<LogicLevelGame, number>> = { tents: TENTS_SIZE, shikaku: SHIKAKU_SIZE, lightup: LIGHTUP_SIZE };

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}: ${(error as Error).message.split("\n")[0]}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const deal = (type: LogicLevelGame, level: Level | null, n: number): PuzzleData =>
  withSeededRandom(5000 + n, () => generatePuzzle(type, { bankSeed: 5000 + n, ...(level ? { level } : {}) }));

/** Exactly one solution by the game's own solver. */
function unique(p: Any): boolean {
  switch (p.type as LogicLevelGame) {
    case "tents":
      return countTentSolutions(p, 2) === 1;
    case "shikaku":
      return countShikakuSolutions(p.clues, 2, p.size, shikakuHeightOf(p)) === 1;
    case "lightup":
      return countLightUpSolutions(p, 2) === 1;
    case "trail":
      return trCountSolutions(p.givens, 2) === 1;
    case "fences":
      return countFencesSolutions(p.size, p.clues, 2) === 1;
    case "fillomino": {
      const r = solveFillomino(p.size, p.givens, 2);
      return !r.exhausted && r.count === 1;
    }
    case "bridges":
      return countBridgesSolutions(p.size, p.islands, 2) === 1;
  }
}

/** The stored solution as the phone sends it. */
function solutionAnswer(p: Any): string {
  switch (p.type as LogicLevelGame) {
    case "tents":
      return encodeTents(p.solution);
    case "shikaku":
      return encodeShikaku(p.solution);
    case "lightup":
      return encodeBulbs(p.solution);
    case "trail":
      return trEncode(p.solution);
    case "fences":
      return encodeFences(Array.from({ length: fencesEdgeCount(p.size) }, (_, e) => (p.solution.includes(e) ? FENCES_LINE : 0)));
    case "fillomino":
      return encodeFillomino(p.solution);
    case "bridges":
      return bridgesSolutionAnswer(p);
  }
}

/** The board is the level's (sizes and counts). */
function shaped(type: LogicLevelGame, p: Any, s: Any): void {
  if (WIDTH[type]) assert.equal(p.size, WIDTH[type], "Normal's width kept");
  switch (type) {
    case "tents":
      assert.equal(tentsHeightOf(p), s.height);
      assert.ok(p.trees.length >= s.pairs[0] && p.trees.length <= s.pairs[1], `pairs ${p.trees.length}`);
      assert.equal([...p.rowCounts, ...p.colCounts].filter((x: number) => x < 0).length, Math.round((p.size + s.height) * s.hidden), "hidden line counts");
      return;
    case "shikaku":
      assert.equal(shikakuHeightOf(p), s.height);
      assert.ok(p.clues.length >= s.rects[0] && p.clues.length <= s.rects[1], `rectangles ${p.clues.length}`);
      assert.ok(Math.max(...p.clues.map((c: Any) => c.n)) <= s.maxArea, "largest area");
      return;
    case "lightup":
      assert.equal(lightUpHeightOf(p), s.height);
      assert.ok(p.walls.length >= s.walls[0] && p.walls.length <= s.walls[1], `walls ${p.walls.length}`);
      assert.ok(p.wallNumbers.filter((n: number) => n >= 0).length <= Math.round(p.walls.length * s.numbered), "numbered walls");
      return;
    case "trail":
      assert.equal(p.givens.filter((g: Any) => g != null).length, s.givens, "numbers shown");
      return;
    case "fences":
      assert.equal(p.size, s.size);
      assert.ok(p.clues.filter((c: number) => c >= 0).length >= s.minClues, "numbers kept");
      return;
    case "fillomino":
      assert.equal(p.size, s.size);
      return;
    case "bridges":
      assert.equal(p.size, s.size);
      assert.ok(p.islands.length >= s.islands[0] && p.islands.length <= s.islands[1], `islands ${p.islands.length}`);
      return;
  }
}

/** Section 3: one board at a level. */
function board(type: LogicLevelGame, level: (typeof LEVELS)[number], p: Any, where: string): void {
  const s = gameLevelSettings<Any>(type, level)!;
  check(`${type} ${level} ${where}: the level's board, unique and fair for a person`, () => {
    assert.equal(puzzleLevel(p), level, "the level stamped");
    assert.equal(p.timeLimitMs, s.timeLimitMs, "the level's clock");
    assert.ok(puzzleTimeLimitMs(p) <= MAX_ROUND_CLOCK_MS);
    shaped(type, p, s);
    assert.ok(unique(p), "exactly one solution");
    const person = solveLikePerson(p);
    assert.ok(person.solved, "a person-style solver finishes it (no guessing)");
    assert.ok(person.eliminations >= s.person[0] && person.eliminations <= s.person[1], `${person.eliminations} one-step trials, band ${s.person.join("–")}`);
    const graded = gradeAnswer(p, solutionAnswer(p), s.timeLimitMs / 2);
    assert.equal(graded.isCorrect, true, "the stored solution is a correct finish");
    assert.ok(graded.score >= 150, `a finish's score (${graded.score})`);
  });
}

// 1. The registry.
for (const type of LOGIC_LEVEL_GAMES) {
  check(`${type}: offers Easy, Normal, Hard and Expert, each proved here, clocks at most 120 s`, () => {
    assert.deepEqual(levelsOf(type), ["easy", "normal", "hard", "expert"]);
    for (const level of LEVELS) {
      assert.deepEqual(levelProof(type, level), { proof: "scripts/logic-levels-check.ts" });
      assert.ok(LOGIC_GAME_LEVELS[type].levels[level].settings.timeLimitMs <= MAX_ROUND_CLOCK_MS);
    }
  });
}

// 2. Normal is today's game.
for (const type of LOGIC_LEVEL_GAMES) {
  check(`${type}: Normal deals exactly as before levels`, () => {
    const plain = deal(type, null, 0) as Any;
    const normal = deal(type, "normal", 0) as Any;
    assert.deepEqual(normal, plain, "asking for Normal is asking for nothing");
    assert.equal(plain.level, undefined, "no level on a Normal deal");
    assert.equal(plain.timeLimitMs, undefined, "no clock of its own");
    assert.equal(dealLogicLevel(type, "normal", () => 1), null, "the level deal stands aside at Normal");
  });
}

// 3. Live deals at every level.
for (const type of LOGIC_LEVEL_GAMES)
  for (const level of LEVELS) for (let n = 0; n < BOARDS; n++) board(type, level, deal(type, level, n), `deal ${n}`);

// 4. The banks.
for (const { type, level } of LOGIC_LEVEL_BANKED) {
  const bank = LOGIC_LEVEL_BANK[`${type}:${level}`] ?? [];
  check(`${type} ${level}: dealt from a bank of ${LOGIC_LEVEL_BANK_SIZE}`, () => {
    assert.equal(bank.length, LOGIC_LEVEL_BANK_SIZE);
    const dealt = deal(type as LogicLevelGame, level, 1) as Any;
    assert.ok(bank.some((e) => JSON.stringify((e as Any).solution) === JSON.stringify(dealt.solution)), "a dealt board is a bank entry");
  });
  const step = Math.max(1, Math.floor(bank.length / BANK_SAMPLE));
  for (let i = 0; i < bank.length; i += step) {
    // Bank entries are unstamped (the deal's layers and the level stamp come after); stamp them as a deal would.
    const dealtEntry = withSeededRandom(1, () => generatePuzzle(type, { bankSeed: 0, level })) as Any;
    const entry = { ...bank[i]!, level, ...Object.fromEntries(Object.entries(dealtEntry).filter(([k]) => /(?:Rev|Version)$|^speedPar$/.test(k))) } as Any;
    board(type as LogicLevelGame, level as (typeof LEVELS)[number], entry, `bank entry ${i}`);
  }
  check(`${type} ${level}: bank entries rebuild as the live deal builds them`, () => {
    for (const i of [0, Math.floor(bank.length / 2)]) {
      const seed = logicLevelBankSeed(type, level, i);
      const rebuilt = logicLevelBankOff(() => withSeededRandom(seed, () => dealLogicLevel(type, level, () => seed)));
      assert.equal(JSON.stringify(rebuilt), JSON.stringify(bank[i]), `entry ${i}`);
    }
  });
}

// 5. Expert is humanly possible: the elite bot finishes most Expert boards.
for (const type of LOGIC_LEVEL_GAMES) {
  const rows = await tune(type, "expert", BOT_SEEDS);
  const elite = rows.find((r) => r.bot === "near-perfect")!;
  check(`${type} expert: the elite bot finishes most boards (${Math.round(elite.finishRate * 100)} %, average ${elite.average.toFixed(0)})`, () => {
    assert.equal(elite.dealt, "expert");
    assert.ok(elite.finishRate > 0.5, `finished ${elite.finishRate}`);
  });
}

console.log(`logic-levels-check: ${passed} passed, ${failed} failed${FULL ? " (full)" : ""}`);
if (failed) {
  console.log("FAIL");
  process.exit(1);
}
