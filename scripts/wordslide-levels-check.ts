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
 *  5. The step (Joe, 16 Nov 2026): a person-like solver that searches for the slides itself, never reading the stored
 *     words (scripts/slider-human.ts), under human limits, recorded on 24 boards a level
 *     (scripts/fixtures/slider-human-levels.json, `bun scripts/slider-human-record.ts`): a sample replays exactly, and
 *     Hard and Expert step clearly below Normal with Expert still possible to score well on.
 *
 *   bun scripts/wordslide-levels-check.ts
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import type { WordSlidePuzzleData } from "../src/lib/duel/types";
import { WORDSLIDE_LEVEL_SETTINGS } from "../src/lib/levels/word/wordslide";
import { wordSlideLevelRuleBreak } from "../src/lib/duel/levels/wordslide.server";
import { WS_TIME_MS, shiftToken } from "../src/lib/duel/wordSlide";
import { readFileSync } from "node:fs";
import { SLIDER_HUMAN_FIXTURE, SLIDER_HUMAN_SEEDS, type SliderHumanFixture } from "./slider-human-record";
import { SLIDER_HUMANS, sliderHumanScore } from "./slider-human";
import { solveSlide } from "./puzzle-fairness/kits-word";
import { asPhoneSends, gradeSteps } from "./standard-lib";
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
ok((deals.get("hard")! as WordSlidePuzzleData[]).every((d) => d.par === 7), "wordslide hard: 7 slides");
ok((deals.get("expert")! as WordSlidePuzzleData[]).every((d) => d.par === 8), "wordslide expert: 8 slides, deeper than Hard");
ok(WORDSLIDE_LEVEL_SETTINGS.expert.timeLimitMs! < WORDSLIDE_LEVEL_SETTINGS.hard.timeLimitMs!, "wordslide expert: a shorter clock than Hard");

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

// 4b. Expert is possible: a perfect run (the proven fewest slides, made briskly) scores 200 on every Expert board.
for (const d of deals.get("expert")! as WordSlidePuzzleData[]) {
  const line = solveSlide([...d.grid], [...d.words!.join("")]);
  ok(line.length === d.par, `wordslide expert: the solver's line is the par (${line.length} = ${d.par})`);
  const steps = line.map((s, i) => ({ answer: line.slice(0, i + 1).map(shiftToken).join(","), atMs: 2000 + i * 400 }));
  const graded = gradeSteps(d, asPhoneSends(d, steps), false);
  ok(graded.isCorrect && graded.score === 200, `wordslide expert: a perfect run scores 200 (${graded.score})`);
}

// 5. The step, measured by the person-like solver.
const fixture = JSON.parse(readFileSync(SLIDER_HUMAN_FIXTURE, "utf8")) as SliderHumanFixture;
const LEVELS = ["easy", "normal", "hard", "expert"] as const;
for (const level of LEVELS) {
  for (const skill of ["strong", "elite"] as const) {
    const rows = fixture[level]?.[skill] ?? [];
    ok(rows.length === SLIDER_HUMAN_SEEDS.length && rows.every((r, i) => r.seed === SLIDER_HUMAN_SEEDS[i]), `wordslide ${level} ${skill}: the fixture holds the 24 recorded boards`);
  }
  // A sample replays exactly: the first board for each player (the solver is deterministic and graded by the server).
  for (const skill of ["strong", "elite"] as const) {
    const rec = fixture[level]![skill]![0]!;
    const d = roomDeal("wordslide", rec.seed, level === "normal" ? undefined : level) as WordSlidePuzzleData;
    const again = sliderHumanScore(d, SLIDER_HUMANS[skill], 1);
    ok(again.score === rec.score && again.finished === rec.finished && again.slides === rec.slides, `wordslide ${level} ${skill}: board ${rec.seed} replays to its recorded ${rec.score} (${again.score})`);
  }
}
const human = (level: string, skill: string) => {
  const rows = fixture[level]![skill]!;
  return { avg: avg(rows.map((r) => r.score)), done: rows.filter((r) => r.finished).length, best: Math.max(...rows.map((r) => r.score)) };
};
const e = Object.fromEntries(LEVELS.map((l) => [l, human(l, "elite")]));
const st = Object.fromEntries(LEVELS.map((l) => [l, human(l, "strong")]));
ok(e.easy!.avg > e.normal!.avg + 10 && e.normal!.avg > e.hard!.avg + 10 && e.hard!.avg > e.expert!.avg + 10, `wordslide: a clear step for the elite player, ${LEVELS.map((l) => e[l]!.avg.toFixed(1)).join(" → ")}`);
ok(st.easy!.avg > st.normal!.avg && st.normal!.avg > st.hard!.avg && st.hard!.avg > st.expert!.avg, `wordslide: and for the strong player, ${LEVELS.map((l) => st[l]!.avg.toFixed(1)).join(" → ")}`);
ok(e.expert!.done >= 2 && e.expert!.best >= 180, `wordslide expert: possible to score well on (the elite player finishes ${e.expert!.done} of 24, best ${e.expert!.best})`);
ok(e.normal!.done > e.hard!.done && e.hard!.done > e.expert!.done, `wordslide: fewer finishes each level up (${LEVELS.map((l) => e[l]!.done).join(", ")} of 24)`);

console.log(`PASS: wordslide levels — ${checkCount()} checks in ${((Date.now() - t0) / 1000).toFixed(1)} s (person-like elite ${LEVELS.map((l) => `${l} ${e[l]!.avg.toFixed(1)} (${e[l]!.done}/24 finished)`).join(", ")}; strong ${LEVELS.map((l) => `${l} ${st[l]!.avg.toFixed(1)}`).join(", ")})`);
