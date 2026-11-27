/**
 * wordsearch-levels-check (the Word overhaul, stage 3, 15 Nov 2026): Lookout's Easy, Hard and Expert
 * (src/lib/levels/word/wordsearch.ts, the deal src/lib/duel/levels/wordsearch.server.ts, the banks
 * src/lib/duel/wordSearchLevelBank.server.ts by scripts/word-search-level-bank.ts). No browser, ~30 s.
 *
 *  1. The registry: Easy, Hard and Expert, each naming this check as its proof, every clock at most 120 s, and the
 *     bigger levels grow in rows, never columns (Hard and Expert keep Normal's ten columns; Easy is narrower).
 *  2. Normal is today's game: a deal asked at Normal is byte for byte the plain deal, square, with no level, rows or
 *     clock of its own, and the line helpers read a square board exactly as before.
 *  3. A room's level deal is the same for every player.
 *  4. The banks rebuild byte for byte, and every board keeps the level's rules: its grid size, its word count, each
 *     listed word and the bonus exactly once (all eight directions scanned), in the level's directions, no other theme
 *     word and no blocked word anywhere, Expert's false starts present.
 *  5. One answer for each word, proved by a person's scan: reading every line of the grid in all eight directions for
 *     the theme's words (all a player knows) finds exactly the listed words and the bonus, each once, so every theme
 *     word a player can find is one that counts; the chips' lengths match the listed words; no false start is itself a
 *     theme word. The server's own live check accepts every listed word and the bonus on the tall boards (both ways
 *     round, bottom rows included) and refuses a false start; a full answer grades as a finish.
 *  6. The tuning: the puzzle-fairness kit's near-perfect and great players on the level-tune seeds, graded by the
 *     server's own code, inside the bands tuned.
 *
 *   bun scripts/wordsearch-levels-check.ts
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { WORD_SEARCH_CATEGORIES } from "../src/lib/duel/wordSearchWords";
import { checkWordSearchPath, wsDecode, wsEncode, wsLine, wsRowsOf, wsSnapLine } from "../src/lib/duel/wordSearch";
import { WORD_SEARCH_LEVEL_BANK } from "../src/lib/duel/wordSearchLevelBank.server";
import { lookoutLevelPuzzle } from "../src/lib/duel/levels/wordsearch.server";
import type { WordSearchPuzzleData } from "../src/lib/duel/types";
import { levelProof, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel } from "../src/lib/levels/levels";
import { WORDSEARCH_LEVEL_ABOUT, WORDSEARCH_LEVEL_SETTINGS, WS_ALL_DIRS } from "../src/lib/levels/word/wordsearch";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { dealAt } from "./level-tune";
import { asPhoneSends, gradeSteps } from "./standard-lib";
import { countInGridRect, levelEntryProblem, levelWords } from "./word-search-level-bank";

let checks = 0;
const ok = (cond: unknown, message: string) => {
  assert.ok(cond, message);
  checks++;
};
const LEVELS = ["easy", "hard", "expert"] as const;
const deal = (seed: number, level?: "easy" | "normal" | "hard" | "expert") =>
  withSeededRandom(seed, () => generatePuzzle("wordsearch", { bankSeed: seed, ...(level ? { level } : {}) })) as WordSearchPuzzleData;

// 1. The registry.
ok(JSON.stringify(levelsOf("wordsearch")) === JSON.stringify(["easy", "normal", "hard", "expert"]), "Lookout offers all four levels");
for (const level of LEVELS) {
  const s = WORDSEARCH_LEVEL_SETTINGS[level];
  const proof = levelProof("wordsearch", level);
  ok(proof && "proof" in proof && proof.proof === "scripts/wordsearch-levels-check.ts" && existsSync(proof.proof), `${level}: names this check as its proof`);
  ok(s.timeLimitMs <= MAX_ROUND_CLOCK_MS, `${level}: clock at most 120 s`);
  ok(s.cols <= 10, `${level}: no more than Normal's ten columns (taller, never smaller squares)`);
  ok(s.rows >= s.cols, `${level}: grows in rows, not columns`);
  ok((WORDSEARCH_LEVEL_ABOUT[level] ?? "").length > 10 && (WORDSEARCH_LEVEL_ABOUT[level] ?? "").length <= 140, `${level}: one plain line about the level`);
}
ok(WORDSEARCH_LEVEL_SETTINGS.easy.dirs.length === 2, "Easy's words read across or down only");
ok(WORDSEARCH_LEVEL_SETTINGS.hard.dirs.length === 8 && WORDSEARCH_LEVEL_SETTINGS.expert.dirs.length === 8, "Hard and Expert run every way");
ok(WORDSEARCH_LEVEL_SETTINGS.expert.decoys > 0, "Expert has false starts");

// 2. Normal is today's game.
const SEEDS = Array.from({ length: 30 }, (_, i) => 0x10c0 + i * 7919);
for (const seed of SEEDS.slice(0, 12)) {
  const plain = deal(seed);
  ok(JSON.stringify(plain) === JSON.stringify(deal(seed, "normal")), `seed ${seed}: Normal deals the plain deal byte for byte`);
  ok(puzzleLevel(plain) === "normal" && plain.rows === undefined && plain.timeLimitMs === undefined, `seed ${seed}: Normal carries no level, rows or clock`);
  ok(wsRowsOf(plain) === plain.size && plain.size === 10 && plain.grid.length === 100, `seed ${seed}: Normal's 10 × 10 square board`);
  ok(puzzleTimeLimitMs(plain) === 120_000, `seed ${seed}: Normal's clock is 120 s`);
}
for (let start = 0; start < 100; start += 7)
  for (let end = 0; end < 100; end += 11) {
    ok(JSON.stringify(wsLine(start, end, 10)) === JSON.stringify(wsLine(start, end, 10, 10)), `square line ${start}→${end} unchanged`);
    ok(JSON.stringify(wsSnapLine(start, end, 10)) === JSON.stringify(wsSnapLine(start, end, 10, 10)), `square snap ${start}→${end} unchanged`);
  }

// 3. The same deal for every player, at each level.
for (const level of LEVELS)
  for (const seed of SEEDS) {
    const p = deal(seed, level);
    ok(JSON.stringify(p) === JSON.stringify(deal(seed, level)), `${level} ${seed}: the same seed deals the same board`);
    const s = WORDSEARCH_LEVEL_SETTINGS[level];
    ok(puzzleLevel(p) === level && p.size === s.cols && wsRowsOf(p) === s.rows && p.grid.length === s.cols * s.rows, `${level} ${seed}: a ${s.cols} × ${s.rows} board stamped ${level}`);
    ok(p.wordCount === s.words && p.placements?.length === s.words && p.wordLengths?.length === s.words, `${level} ${seed}: ${s.words} words`);
    ok(puzzleTimeLimitMs(p) === s.timeLimitMs, `${level} ${seed}: the level's clock`);
    ok((p.wordSearchRev ?? 0) === (deal(seed).wordSearchRev ?? -1), `${level} ${seed}: today's Lookout stamp`);
  }

// 4. The banks.
const rebuilt = spawnSync("bun", ["scripts/word-search-level-bank.ts", "--check"], { encoding: "utf8" });
ok(rebuilt.status === 0, `the level banks rebuild byte for byte: ${(rebuilt.stdout || rebuilt.stderr).trim()}`);
for (const level of LEVELS) {
  const s = WORDSEARCH_LEVEL_SETTINGS[level];
  const bank = WORD_SEARCH_LEVEL_BANK[level];
  ok(bank.length >= 300, `${level}: ${bank.length} boards`);
  ok(new Set(bank.map((e) => e.grid)).size === bank.length, `${level}: no board twice`);
  ok(new Set(bank.map((e) => e.category)).size === Object.keys(WORD_SEARCH_CATEGORIES).length, `${level}: every theme dealt`);
  for (const [i, e] of bank.entries()) {
    const problem = levelEntryProblem(e, s);
    ok(problem === null, `${level} #${i} (${e.category}): ${problem ?? "keeps the rules"}`);
  }
}

// 5. One answer for each word: a person's scan, the live check and the grade.
for (const level of LEVELS) {
  const s = WORDSEARCH_LEVEL_SETTINGS[level];
  for (const [i, e] of WORD_SEARCH_LEVEL_BANK[level].entries()) {
    const g = e.grid.split("");
    const theme = WORD_SEARCH_CATEGORIES[e.category] ?? [];
    const seen = theme.filter((w) => countInGridRect(g, w, s.cols, s.rows) > 0);
    const listed = e.placements.map((p) => p.word);
    ok(JSON.stringify([...seen].sort()) === JSON.stringify([...listed, e.bonus.word].sort()), `${level} #${i}: a scan for the theme finds exactly the listed words and the bonus`);
    ok(seen.every((w) => countInGridRect(g, w, s.cols, s.rows) === 1), `${level} #${i}: each found once`);
    if (s.decoys > 0) {
      for (const w of listed) {
        const stem = w.slice(0, -1);
        if (countInGridRect(g, stem, s.cols, s.rows) >= 2) ok(!theme.includes(stem) && !levelWords(e.category).includes(stem), `${level} #${i}: the false start ${stem} is not a theme word`);
      }
    }
    if (i % 8 !== 0) continue;
    const p = lookoutLevelPuzzle(level, e);
    for (const pl of [...e.placements, e.bonus]) {
      for (const path of [pl.cells, [...pl.cells].reverse()]) {
        const v = checkWordSearchPath(p.placements ?? [], p.size, path, [], p.bonus, wsRowsOf(p));
        ok(v.valid && v.word === pl.word, `${level} #${i}: the live check accepts ${pl.word}`);
      }
    }
    const short = [...e.placements[0]!.cells].slice(0, -1);
    ok(!checkWordSearchPath(p.placements ?? [], p.size, short, [], p.bonus, wsRowsOf(p)).valid, `${level} #${i}: a word one letter short is refused`);
    const answer = wsEncode(e.placements.map((pl) => pl.cells));
    ok(JSON.stringify(wsDecode(answer, p.size, wsRowsOf(p))) === JSON.stringify(e.placements.map((pl) => pl.cells)), `${level} #${i}: every selection decodes on the tall board`);
    ok(gradeAnswer(p, answer, 30_000).isCorrect, `${level} #${i}: finding every listed word is a finish`);
    ok(!gradeAnswer(p, wsEncode(e.placements.slice(1).map((pl) => pl.cells)), 0).isCorrect, `${level} #${i}: one word short is not`);
  }
}
for (const [dr, dc] of WS_ALL_DIRS) ok(Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr !== 0 || dc !== 0), `direction ${dr},${dc} is a step`);

// The reveal draws a tall board whole (every cell, the loop box the board's own shape); a square board as before.
{
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { wordSearchPuzzle } = await import("../src/puzzles/wordSearch");
  for (const level of LEVELS) {
    const s = WORDSEARCH_LEVEL_SETTINGS[level];
    const p = deal(SEEDS[0]!, level);
    const html = renderToStaticMarkup(createElement(wordSearchPuzzle.Reveal, { puzzle: p, myAnswer: wsEncode((p.placements ?? []).slice(0, 2).map((pl) => pl.cells)), myCorrect: false, myReactionAvgMs: null, myMsRemaining: 0, timeLimitMs: s.timeLimitMs, myExtra: {} } as never));
    ok((html.match(/data-ws-cell="/g) ?? []).length === s.cols * s.rows, `${level}: the reveal draws all ${s.cols * s.rows} cells`);
    ok(html.includes(`viewBox="0 0 ${s.cols} ${s.rows}"`), `${level}: the loops are drawn on the board's own shape`);
  }
  const plain = deal(SEEDS[0]!);
  const html = renderToStaticMarkup(createElement(wordSearchPuzzle.Reveal, { puzzle: plain, myAnswer: "", myCorrect: false, myReactionAvgMs: null, myMsRemaining: 0, timeLimitMs: 120_000, myExtra: {} } as never));
  ok((html.match(/data-ws-cell="/g) ?? []).length === 100 && html.includes('viewBox="0 0 10 10"'), "Normal's reveal draws its 10 × 10 board as before");
}

// 6. The tuning.
const BANDS = {
  easy: { near: [185, 200], great: [165, 195] },
  normal: { near: [180, 200], great: [165, 190] },
  hard: { near: [174, 196], great: [150, 175] },
  expert: { near: [152, 178], great: [100, 130] }, // Changed with Joe's approval, 21 Nov 2026
} as const;
for (const level of ["easy", "normal", "hard", "expert"] as const) {
  const scores = { near: [] as number[], great: [] as number[] };
  let finished = 0;
  for (let n = 0; n < 20; n++) {
    const p = dealAt("wordsearch", level, n);
    for (const bot of ["near", "great"] as const) {
      const play = KITS.wordsearch!.play(p, makeRng(hashText(`level-tune:wordsearch:${level}:${n}:${bot}`)), SKILLS[bot], puzzleTimeLimitMs(p));
      const g = gradeSteps(p, asPhoneSends(p, play.steps), play.timed);
      scores[bot].push(g.score);
      if (bot === "near" && g.isCorrect) finished++;
    }
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const near = avg(scores.near);
  const great = avg(scores.great);
  console.log(`  ${level}: near-perfect ${near.toFixed(1)} (finished ${finished}/20), great ${great.toFixed(1)}`);
  ok(near >= BANDS[level].near[0] && near <= BANDS[level].near[1], `${level}: near-perfect ${near.toFixed(1)} in ${BANDS[level].near.join("–")}`);
  ok(great >= BANDS[level].great[0] && great <= BANDS[level].great[1], `${level}: great ${great.toFixed(1)} in ${BANDS[level].great.join("–")}`);
  ok(finished >= 18, `${level}: near-perfect finishes 18 of 20 or more`);
}

console.log(`PASS: wordsearch levels — ${checks} checks`);
