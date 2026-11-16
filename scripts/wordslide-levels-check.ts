/**
 * wordslide-levels-check (the Word overhaul, stage 3, 15 Nov 2026; src/lib/levels/word/wordslide.ts): Slider's Easy,
 * Hard and Expert.
 *
 *  1. The registry (open by design: any five real words finish), the level lines, the clocks (at most 120 s), Normal byte
 *     for byte the plain deal, every level the same deal for every player (word-levels-shared.ts).
 *  2. Every level board meets its rules: five different common words, no row a word at the start, the stored par the
 *     proven fewest slides back (a fresh search) and inside the level's range, the clock as set; the deal's later layer
 *     keeps that par.
 *  3. The server's cost: a level deal and the grade of an unfinished level board each stay well under a second.
 *  4. The tuning numbers: the kit's near-perfect and great play, graded by the server, on fixed seeds per level.
 *
 *   bun scripts/wordslide-levels-check.ts
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import type { WordSlidePuzzleData } from "../src/lib/duel/types";
import { WORDSLIDE_LEVEL_SETTINGS } from "../src/lib/levels/word/wordslide";
import { wordSlideLevelRuleBreak } from "../src/lib/duel/levels/wordslide.server";
import { WS_TIME_MS, shiftToken } from "../src/lib/duel/wordSlide";
import { BEYOND, checkCount, commonLevelChecks, kitScore, ok, roomDeal } from "./word-levels-shared";

const t0 = Date.now();
const SEEDS = [11, 202, 3003, 40004, 500005, 6000006];
const deals = commonLevelChecks("wordslide", "open", SEEDS, (level) => WORDSLIDE_LEVEL_SETTINGS[level].timeLimitMs ?? WS_TIME_MS);

for (const level of BEYOND) {
  const s = WORDSLIDE_LEVEL_SETTINGS[level];
  for (const d of deals.get(level)! as WordSlidePuzzleData[]) {
    ok(wordSlideLevelRuleBreak(d, s) === null, `wordslide ${level}: board meets its rules (${wordSlideLevelRuleBreak(d, s)})`);
  }
}
ok((deals.get("easy")! as WordSlidePuzzleData[]).every((d) => d.par <= 3), "wordslide easy: 3 slides or fewer");
ok((deals.get("hard")! as WordSlidePuzzleData[]).every((d) => d.par === 8), "wordslide hard: 8 slides");

// 3. The server's cost on the deepest level.
for (const seed of [77, 78, 79]) {
  const t = performance.now();
  const d = roomDeal("wordslide", seed, "expert") as WordSlidePuzzleData;
  const dealMs = performance.now() - t;
  ok(dealMs < 1500, `wordslide expert seed ${seed}: dealt in ${dealMs.toFixed(0)} ms (under 1.5 s)`);
  const answer = [shiftToken({ axis: "r", index: 1, dir: 1 }), shiftToken({ axis: "c", index: 3, dir: -1 }), shiftToken({ axis: "r", index: 4, dir: -1 })].join(",");
  const g0 = performance.now();
  const graded = gradeAnswer(d, answer, 0);
  const gradeMs = performance.now() - g0;
  ok(!graded.isCorrect && gradeMs < 1500, `wordslide expert seed ${seed}: an unfinished board graded in ${gradeMs.toFixed(0)} ms (under 1.5 s)`);
}

// 4. The tuning numbers (Joe's tool's bots and grading, on six fixed seeds).
const TUNE = [0, 1, 2, 3, 4, 5].map((n) => 9000 + n * 37);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const bands: Record<string, { near: number; great: number }> = {};
for (const level of ["easy", "normal", "hard", "expert"] as const) {
  const near: number[] = [];
  const great: number[] = [];
  for (const seed of TUNE) {
    const d = roomDeal("wordslide", seed, level === "normal" ? undefined : level);
    near.push(kitScore("wordslide", d, "near", `${level}:${seed}`).score);
    great.push(kitScore("wordslide", d, "great", `${level}:${seed}`).score);
  }
  bands[level] = { near: avg(near), great: avg(great) };
}
// Tuned 15 Nov 2026 on human clocks (the kit slides along the solver's own line, so it finishes every level fast).
for (const level of ["easy", "normal", "hard", "expert"] as const) {
  ok(bands[level]!.near >= 190, `wordslide ${level}: near-perfect averages ${bands[level]!.near.toFixed(1)} (at least 190)`);
  ok(bands[level]!.great >= 185, `wordslide ${level}: great averages ${bands[level]!.great.toFixed(1)} (at least 185)`);
}

console.log(`PASS: wordslide levels — ${checkCount()} checks in ${((Date.now() - t0) / 1000).toFixed(1)} s (near-perfect ${["easy", "normal", "hard", "expert"].map((l) => `${l} ${bands[l]!.near.toFixed(0)}`).join(", ")})`);
