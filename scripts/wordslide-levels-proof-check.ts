/**
 * wordslide-levels-proof-check (D1, 21 Nov 2026; src/lib/levels/word/wordslide.ts, wordSlideRev 7): Slider's grid-size
 * ladder and its proof at the human limits.
 *
 *  1. Normal is untouched: a puzzle without wordSlideRev 7 is 5 × 5 whatever it carries; every rule at size 5 reads tokens
 *     and rows exactly as before (a token past row or column 4 is still ignored); the indexed row closeness the solver uses
 *     on the bigger grids gives exactly the scan's value.
 *  2. Every level deal: wordSlideRev 7 and its size (Easy 4, Hard 6, Expert 7), the level's own words (common answers of
 *     the grid's length, answerWords, all different), no row a word at the start, the stored par the proven fewest slides
 *     (a fresh search) inside the level's range, on Normal's clock; the same deal for everyone.
 *  3. Expert's bank (Joe, 21 Nov 2026; Hard and Easy deal unfiltered from the room seed): at least SLIDER_BANK_SIZE boards,
 *     every entry meets its rules and is re-proved (three sampled at quick depth, every entry with CHECKS_FULL=1): the
 *     elite person-like solver's line at the human limits (SLIDER_AT_LIMITS) is graded 200 by the server on the board's
 *     own par line. 3b: that par line is stored on Expert boards only and read only on wordSlideRev 7.
 *  4. The server enforces the size: a level board's dealt words grade as a finish (200 when quick, within par); its rows
 *     are checked at the grid's length live and when graded; a 7 × 7 token is ignored on a 5 × 5 board.
 *  5. The cost: an unfinished 7 × 7 board grades in under 1.5 s.
 *
 *   bun scripts/wordslide-levels-proof-check.ts [CHECKS_FULL=1]
 */
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { WordSlidePuzzleData } from "../src/lib/duel/types";
import { WORDSLIDE_LEVEL_SETTINGS } from "../src/lib/levels/word/wordslide";
import { sliderBankPuzzle, wordSlideLevelRuleBreak } from "../src/lib/duel/levels/wordslide.server";
import { SLIDER_LEVEL_BANK } from "../src/lib/duel/sliderLevelBank.server";
import { checkWordSlideRow, slideWords } from "../src/lib/duel/wordSlide.server";
import { decodeSlideTokens, parseToken, replayWordSlide, shiftToken, wordSlideSize, WORD_SLIDE_REV_SIZED, WS_TIME_MS } from "../src/lib/duel/wordSlide";
import { wordSlideDistance } from "../src/lib/duel/wordSlideDistance.server";
import { rowCloseness, rowClosenessScan } from "./slider-human";
import { SLIDER_BANK_SIZE, sliderBankProof } from "./slider-level-bank";
import { sliderParLine } from "../src/lib/duel/wordSlide";
import { asPhoneSends, gradeSteps } from "./standard-lib";

let passes = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};
const FULL = process.env.CHECKS_FULL === "1";
const deal = (seed: number, level?: "easy" | "hard" | "expert") =>
  withSeededRandom(seed, () => generatePuzzle("wordslide", { bankSeed: seed, ...(level ? { level } : {}) })) as WordSlidePuzzleData;

/* 1. Normal untouched. */
{
  const n = deal(41);
  ok(n.size === undefined && wordSlideSize(n) === 5 && n.grid.length === 25, "normal: no size stored, read as 5 × 5");
  ok(wordSlideSize({ wordSlideRev: 6, size: 7 }) === 5 && wordSlideSize({ wordSlideRev: 7, size: 7 }) === 7 && wordSlideSize({ wordSlideRev: 7, size: 9 }) === 5, "the size is read only on wordSlideRev 7, and only 4–7");
  ok(parseToken("r5+") === null && parseToken("c4-") !== null && parseToken("S05") === null && parseToken("L5") === null, "at size 5 a token past row or column 4 is still ignored");
  ok(parseToken("r6+", 7) !== null && parseToken("r7+", 7) === null && parseToken("S56", 7) !== null, "at size 7 rows and columns 0–6");
  ok(decodeSlideTokens("r1+,r6-,c2-,x", 5).join(",") === "r1+,c2-", "a 5 × 5 answer drops the 7 × 7 token");
  const before = replayWordSlide(n.grid, ["r1+", "c3-", "U", "r4-"]);
  ok(JSON.stringify(before) === JSON.stringify(replayWordSlide(n.grid, ["r1+", "c3-", "U", "r4-", "r6+"])), "a 5 × 5 replay ignores a token past its grid");
  let same = 0;
  let total = 0;
  for (const len of [4, 6, 7]) {
    const words = slideWords(len);
    for (let i = 0; i < 40; i++) {
      const a = words[(i * 7919) % words.length]!;
      const b = words[(i * 104729 + 13) % words.length]!;
      const row = [...(a.slice(0, len - 2) + b.slice(len - 2))].reverse().join("").toUpperCase();
      total++;
      if (rowCloseness(row) === rowClosenessScan(row)) same++;
    }
  }
  ok(same === total, `the indexed closeness equals the scan on ${same} of ${total} level rows`);
}

/* 2. Every level deal. */
for (const level of ["easy", "hard", "expert"] as const) {
  const s = WORDSLIDE_LEVEL_SETTINGS[level];
  for (const seed of [11, 202, 3003, 40004]) {
    const d = deal(seed, level);
    const again = deal(seed, level);
    ok(JSON.stringify(d) === JSON.stringify(again), `${level} ${seed}: the same deal for everyone`);
    ok(d.wordSlideRev === WORD_SLIDE_REV_SIZED && d.size === s.size && d.grid.length === s.size * s.size, `${level} ${seed}: wordSlideRev 7 on a ${s.size} × ${s.size} grid`);
    ok(wordSlideLevelRuleBreak(d, s) === null, `${level} ${seed}: meets its rules (${wordSlideLevelRuleBreak(d, s)})`);
    ok((d.timeLimitMs ?? WS_TIME_MS) === WS_TIME_MS, `${level} ${seed}: Normal's 100 s`);
  }
}

/* 3. Expert's bank (Joe, 21 Nov 2026: Hard is dealt unfiltered from the room seed; Expert only from proved boards). */
{
  const s = WORDSLIDE_LEVEL_SETTINGS.expert;
  const bank = SLIDER_LEVEL_BANK.expert;
  ok(!("hard" in SLIDER_LEVEL_BANK) && !WORDSLIDE_LEVEL_SETTINGS.hard.bank && !WORDSLIDE_LEVEL_SETTINGS.easy.bank, "hard and easy deal from the room seed, unfiltered (no bank)");
  ok(bank.length >= SLIDER_BANK_SIZE.expert, `expert: the bank holds ${bank.length} boards (at least ${SLIDER_BANK_SIZE.expert}, so a board rarely repeats)`);
  ok(new Set(bank.map((e) => e.grid)).size === bank.length, "expert: no board twice");
  const boards = bank.map((e) => sliderBankPuzzle(s, e));
  ok(boards.every((b) => wordSlideLevelRuleBreak(b, s) === null), "expert: every entry meets its rules (common answers, the par proven, its own par line)");
  const sample = FULL ? boards : [boards[0]!, boards[Math.floor(boards.length / 2)]!, boards[boards.length - 1]!];
  for (const [i, b] of sample.entries()) {
    const proof = sliderBankProof(b);
    ok(proof.ok, `expert #${i}: re-proved, the elite's line at the human limits scores 200 (score ${proof.score}, ${proof.slides} slides, ${(proof.ms / 1000).toFixed(1)} s)`);
  }
}

/* 3b. Expert's own par line (stored on the board, wordSlideRev 7 only); every other board scores on its par as before. */
{
  const e = deal(909, "expert");
  const line = sliderParLine(e);
  ok(e.parFullAt === WORDSLIDE_LEVEL_SETTINGS.expert.parLine!.full && e.parZeroAt === WORDSLIDE_LEVEL_SETTINGS.expert.parLine!.zero && line.full === e.parFullAt && line.zero === e.parZeroAt, `expert: its par line stored and read (${line.full} / ${line.zero} slides)`);
  const n = deal(909);
  ok(n.parFullAt === undefined && n.parZeroAt === undefined && sliderParLine(n).full === n.par && sliderParLine(n).zero === 2 * n.par, "normal: no par line stored, scored on its par and twice it");
  ok(sliderParLine({ par: 6, wordSlideRev: 6, parFullAt: 20, parZeroAt: 40 }).full === 6, "a par line on a board without wordSlideRev 7 is ignored");
  for (const level of ["easy", "hard"] as const) {
    const d = deal(909, level);
    ok(d.parFullAt === undefined && sliderParLine(d).full === d.par, `${level}: no par line of its own`);
  }
}

/* 4. The server enforces the size. */
for (const level of ["easy", "hard", "expert"] as const) {
  const d = deal(5005, level);
  const goal = [...(d.words ?? []).join("")];
  // The proven shortest line, found by a search from the deal (the grader never sees it): replay each one-slide move
  // that brings the grid closer.
  const line: string[] = [];
  let grid = [...d.grid];
  for (let k = 0; k < d.par; k++) {
    const left = wordSlideDistance(grid, goal, d.par - k)!;
    let next: string | null = null;
    for (const axis of ["r", "c"] as const)
      for (let index = 0; index < d.size! && !next; index++)
        for (const dir of [1, -1] as const) {
          const t = shiftToken({ axis, index, dir });
          const g = replayWordSlide(grid, [t], { size: d.size }).grid;
          if (wordSlideDistance(g, goal, left - 1) === left - 1) {
            next = t;
            grid = g;
            break;
          }
        }
    line.push(next!);
  }
  const steps = line.map((_, i) => ({ answer: line.slice(0, i + 1).join(","), atMs: 2000 + i * 400 }));
  const graded = gradeSteps(d, asPhoneSends(d, steps), false);
  ok(graded.isCorrect && graded.score === 200, `${level}: the par line, made briskly, scores 200 (${graded.score})`);
  const row = (d.words ?? [])[0]!;
  ok(checkWordSlideRow(row, d.size).valid && !checkWordSlideRow(row).valid === (row.length !== 5), `${level}: a row is checked at the grid's length (${row})`);
}

/* 5. The cost. */
{
  const d = deal(77, "expert");
  const t = performance.now();
  const g = gradeAnswer(d, ["r1+", "c3-", "r4-"].join(","), 0);
  const ms = performance.now() - t;
  ok(!g.isCorrect && ms < 1500, `expert: an unfinished 7 × 7 board graded in ${ms.toFixed(0)} ms (under 1.5 s)`);
}

if (failures.length) {
  console.log(`FAIL wordslide-levels-proof-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS wordslide-levels-proof-check: ${passes} checks${FULL ? " (full depth)" : ""}`);
