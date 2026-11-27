/**
 * codeword-levels-proof-check (D1, 21 Nov 2026; src/lib/levels/word/codeword.ts, difficulty-spec.md "Cryptogrid"): the grid
 * is Cryptogrid's ladder (Easy 5 × 5, Normal 7 × 7, Hard 8 × 7 and Expert 9 × 7, wider with seven rows: Joe, 21 Nov 2026),
 * each level from its own bank (src/lib/duel/codewordLevelBank.server.ts, scripts/codeword-bank.ts --levels).
 *
 *  1. Every bank entry meets its level's rules: the grid's width and height, symmetric and connected, no run of two or of more than seven
 *     letters, every word a common answer, the letter range, the starting letters, and exactly one decoding from them
 *     against the full dictionary (codewordLevelEntryRuleBreak, the same solver as today's bank proof). No board twice.
 *  2. Expert: the person-like solver (codewordHuman.server.ts) decodes every board from its four letters alone, and its line
 *     entered at the human limits (0.25 s to react, 0.15 s a tap: humanLimits.ts) scores 200 through the server's grader
 *     on the dealt puzzle, inside the level's speed line, for every Expert bank board.
 *  3. Deals: a level's deal stores its width, its rows (the wider grids), clock and speed line; the same room seed deals the
 *     same board; Normal carries none of them; every level's clock is at most 120 s.
 *  4. The grader: a level board's crack scores full speed only inside its own stored line; a Normal board's line is 60 s.
 *  5. The bank rebuilds byte for byte: the first entries of each level here (CHECKS_FULL=1: the whole file, through
 *     `bun scripts/codeword-bank.ts --levels --check`), and today's 1,000-board bank's first 20 entries.
 */
import { spawnSync } from "node:child_process";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { CODEWORD_BANK } from "../src/lib/duel/codewordBank.server";
import { CODEWORD_LEVEL_BANK } from "../src/lib/duel/codewordLevelBank.server";
import { codewordFromLevelEntry, codewordLevelEntryRuleBreak } from "../src/lib/duel/codeword.server";
import { solveCodewordLikeAHuman } from "../src/lib/duel/levels/codewordHuman.server";
import { encodeCodeword } from "../src/lib/duel/codeword";
import { WORD_HUMAN_LIMITS } from "../src/lib/duel/levels/humanLimits";
import { CODEWORD_LEVELS, type CodewordLevelSettings } from "../src/lib/levels/word/codeword";
import type { CodewordPuzzleData } from "../src/lib/duel/types";
import { HUMAN_LIMITS } from "./arcade-skill-bands/human";
import { buildEntry, buildLevelEntry, codewordLevelCols, codewordLevelRules, CODEWORD_BANK_LEVELS } from "./codeword-bank";
import { codewordLine } from "./word-human-solvers";

let passes = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};
const FULL = process.env.CHECKS_FULL === "1" || process.argv.includes("--full");
const settingsOf = (level: "easy" | "hard" | "expert") => CODEWORD_LEVELS.levels[level]!.settings as CodewordLevelSettings;
const deal = (seed: number, level?: "easy" | "hard" | "expert") =>
  withSeededRandom(seed, () => generatePuzzle("codeword", { bankSeed: seed, ...(level ? { level } : {}) })) as CodewordPuzzleData;

ok(WORD_HUMAN_LIMITS.reactMs === HUMAN_LIMITS.reactMs && WORD_HUMAN_LIMITS.moveMs === HUMAN_LIMITS.moveMs, "the level deals' human limits are the bots' HUMAN_LIMITS");

/* ------------------------------------------------------------------------------------------------ 1. The banks */
for (const level of CODEWORD_BANK_LEVELS) {
  const bank = CODEWORD_LEVEL_BANK[level];
  const s = settingsOf(level);
  const rules = codewordLevelRules(level);
  ok(bank.length === s.bank, `${level}: the bank holds ${s.bank} boards (${bank.length})`);
  ok(new Set(bank).size === bank.length && new Set(bank.map((e) => e.split("|")[0])).size === bank.length, `${level}: no board twice`);
  const broken = bank.map((e, i) => [i, codewordLevelEntryRuleBreak(e, rules)] as const).filter(([, b]) => b !== null);
  ok(broken.length === 0, `${level}: every board meets its rules and has exactly one decoding (${broken.slice(0, 3).map(([i, b]) => `#${i} ${b}`).join(", ")})`);
  const rows = s.rows ?? s.size;
  const dims = new Set(
    bank.map((e) => {
      const b = codewordFromLevelEntry(e, 1, codewordLevelCols(level));
      return `${b.size} × ${b.rows ?? b.size}`;
    }),
  );
  ok(dims.size === 1 && dims.has(`${s.size} × ${rows}`), `${level}: every grid is ${s.size} × ${rows} (${[...dims].join(", ")})`);
}

/* ------------------------------------------------------------------------------------------------ 2. Expert's proof */
{
  const s = settingsOf("expert");
  let cracked = 0;
  let at200 = 0;
  let slowest = 0;
  const bank = CODEWORD_LEVEL_BANK.expert;
  const cols = codewordLevelCols("expert");
  for (const entry of bank) {
    const board = codewordFromLevelEntry(entry, 1, cols);
    const human = solveCodewordLikeAHuman(board.cells, board.numbers, board.givens, cols);
    if (human.solved && human.letters.join("") === board.solution) cracked++;
  }
  ok(cracked === bank.length, `expert: the person-like solver cracks ${cracked} of ${bank.length} boards from their four letters`);
  // The dealt puzzle (today's stamps, the level's clock and speed line), the line graded by the server.
  const base = deal(1, "expert");
  for (const entry of bank) {
    const p = { ...base, ...codewordFromLevelEntry(entry, base.codewordRev, cols), timeLimitMs: base.timeLimitMs, speedFullByS: base.speedFullByS } as CodewordPuzzleData;
    const line = codewordLine(p);
    if (line.score >= 200) at200++;
    slowest = Math.max(slowest, line.ms);
  }
  ok(at200 === bank.length, `expert: the person-like line at the human limits scores 200 on ${at200} of ${bank.length} boards (slowest ${(slowest / 1000).toFixed(1)} s, speed full by ${s.speedFullByS} s)`);
}

/* ------------------------------------------------------------------------------------------------ 3. Deals */
for (const level of CODEWORD_BANK_LEVELS) {
  const s = settingsOf(level);
  for (const seed of [3, 41, 977]) {
    const p = deal(seed, level);
    const rows = s.rows ?? s.size;
    ok(
      p.size === s.size && p.rows === s.rows && p.cells.length === s.size * rows,
      `${level} ${seed}: a ${s.size} × ${rows} grid (${p.size} × ${p.rows ?? p.size}, ${p.cells.length} squares)`,
    );
    ok(p.timeLimitMs === s.clockMs && s.clockMs <= 120_000 && p.speedFullByS === s.speedFullByS, `${level} ${seed}: the level's clock and speed line stored`);
    ok(p.givens.length === s.givens && (p as { level?: string }).level === level, `${level} ${seed}: ${s.givens} starting letters, stamped ${level}`);
    ok(JSON.stringify(deal(seed, level)) === JSON.stringify(p), `${level} ${seed}: the same seed deals the same board`);
  }
}
{
  const n = deal(41);
  ok(
    n.size === 7 && n.rows === undefined && n.speedFullByS === undefined && n.timeLimitMs === undefined && (n as { level?: string }).level === undefined,
    "normal: today's 7 × 7 board, no level fields",
  );
}

/* ------------------------------------------------------------------------------------------------ 4. The grader */
{
  const p = deal(5, "hard");
  const answer = encodeCodeword(Array.from({ length: p.numbers }, (_, i) => ({ n: i + 1, letter: p.solution![i]! })).filter((a) => !p.givens.some((g) => g.n === a.n)));
  const limit = p.timeLimitMs!;
  const inside = gradeAnswer(p, answer, limit - (p.speedFullByS! * 1000 - 1000));
  const outside = gradeAnswer(p, answer, limit - (p.speedFullByS! * 1000 + 5000));
  ok(inside.isCorrect && outside.isCorrect && inside.score > outside.score, `hard: a crack inside the stored ${p.speedFullByS} s line scores more than one 5 s past it (${inside.score} / ${outside.score})`);
  const n = deal(5);
  const nAnswer = encodeCodeword(Array.from({ length: n.numbers }, (_, i) => ({ n: i + 1, letter: n.solution![i]! })).filter((a) => !n.givens.some((g) => g.n === a.n)));
  const at59 = gradeAnswer(n, nAnswer, 120_000 - 59_000);
  const at65 = gradeAnswer(n, nAnswer, 120_000 - 65_000);
  ok(at59.score > at65.score, `normal: the speed line is still 60 s (${at59.score} at 59 s, ${at65.score} at 65 s)`);
}

/* ------------------------------------------------------------------------------------------------ 5. Rebuilds */
if (FULL) {
  const r = spawnSync("bun", ["scripts/codeword-bank.ts", "--levels", "--check"], { encoding: "utf8" });
  ok(r.status === 0, `the level banks rebuild byte for byte (${(r.stdout + r.stderr).trim().split("\n").pop()})`);
} else {
  for (const level of CODEWORD_BANK_LEVELS) {
    const n = level === "expert" ? 3 : 5;
    let same = 0;
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) {
      const entry = buildLevelEntry(level, i, seen);
      seen.add(entry.split("|")[0]!);
      if (entry === CODEWORD_LEVEL_BANK[level][i]) same++;
    }
    ok(same === n, `${level}: the first ${n} boards rebuild exactly (${same})`);
  }
}
{
  let same = 0;
  for (let i = 0; i < 20; i++) if (buildEntry(i) === CODEWORD_BANK[i]) same++;
  ok(same === 20, `normal: today's bank's first 20 boards rebuild exactly from the size-aware generator (${same})`);
}

if (failures.length) {
  console.log(`FAIL codeword-levels-proof-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS codeword-levels-proof-check: ${passes} checks`);
