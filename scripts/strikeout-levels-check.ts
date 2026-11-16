/**
 * strikeout-levels-check (the Word overhaul, stage 3, 15 Nov 2026): Strikeout's Easy, Hard and Expert
 * (src/lib/levels/word/strikeout.ts, the deal src/lib/duel/levels/strikeout.server.ts). No browser, ~20 s.
 *
 *  1. The registry: Easy, Hard and Expert, each naming this check as its proof, every clock at most 120 s.
 *  2. Normal is today's game: a deal asked at Normal is byte for byte the plain deal and carries no level, strikes,
 *     vowels or clock of its own; a puzzle without them plays its revision's rules exactly (so2RulesFor).
 *  3. A room's level deal is the same for every player (the same seed deals the same set).
 *  4. Each level's sets meet the generator's rules at the level's starting letters, and carry its strikes, vowel guesses
 *     and clock.
 *  5. One answer a word, proved by play: a solver that reasons like a person (strikeoutSolver.server.ts: it never sees
 *     the answers, keeps the answer words still possible, guesses the letter in most of them, solves only when one word
 *     is left) narrows every word of every sampled set to exactly one answer word, the right one, within the level's
 *     strikes and vowel guesses, Hard and Expert included.
 *  6. The tuning: the puzzle-fairness kit's near-perfect and great players on the level-tune seeds, graded by the
 *     server's own code, inside the bands tuned (docs: the report's table).
 *  7. Easy's 14 strike markers fit a 320 px phone.
 *
 *   bun scripts/strikeout-levels-check.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { STRIKEOUT_REV3, so2Rules, so2RulesFor, strikeoutRevOf } from "../src/lib/duel/strikeout";
import { strikeout2RuleBreak, strikeoutAnswerWords } from "../src/lib/duel/strikeout.server";
import { strikeoutLevelExtra } from "../src/lib/duel/levels/strikeout.server";
import { solveStrikeoutLikeAPerson } from "../src/lib/duel/levels/strikeoutSolver.server";
import type { StrikeoutPuzzleData } from "../src/lib/duel/types";
import { levelProof, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel } from "../src/lib/levels/levels";
import { STRIKEOUT_LEVEL_ABOUT, STRIKEOUT_LEVEL_SETTINGS } from "../src/lib/levels/word/strikeout";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { dealAt } from "./level-tune";
import { asPhoneSends, gradeSteps } from "./standard-lib";

let checks = 0;
const ok = (cond: unknown, message: string) => {
  assert.ok(cond, message);
  checks++;
};
const LEVELS = ["easy", "hard", "expert"] as const;
const deal = (seed: number, level?: "easy" | "normal" | "hard" | "expert") =>
  withSeededRandom(seed, () => generatePuzzle("strikeout", { bankSeed: seed, ...(level ? { level } : {}) })) as StrikeoutPuzzleData;

// 1. The registry.
ok(JSON.stringify(levelsOf("strikeout")) === JSON.stringify(["easy", "normal", "hard", "expert"]), "Strikeout offers all four levels");
for (const level of LEVELS) {
  const proof = levelProof("strikeout", level);
  ok(proof && "proof" in proof && proof.proof === "scripts/strikeout-levels-check.ts" && existsSync(proof.proof), `${level}: names this check as its one-answer proof`);
  ok(STRIKEOUT_LEVEL_SETTINGS[level].timeLimitMs <= MAX_ROUND_CLOCK_MS, `${level}: clock at most 120 s`);
  ok((STRIKEOUT_LEVEL_ABOUT[level] ?? "").length > 10 && (STRIKEOUT_LEVEL_ABOUT[level] ?? "").length <= 140, `${level}: one plain line about the level`);
  ok(STRIKEOUT_LEVEL_SETTINGS[level].strikes >= 10, `${level}: at least 10 strikes, so the strike bonus can still be full`);
}

// 2. Normal is today's game.
const SEEDS = Array.from({ length: 40 }, (_, i) => 0x51e7 + i * 7919);
for (const seed of SEEDS.slice(0, 12)) {
  const plain = deal(seed);
  const normal = deal(seed, "normal");
  ok(JSON.stringify(plain) === JSON.stringify(normal), `seed ${seed}: Normal deals the plain deal byte for byte`);
  ok(puzzleLevel(plain) === "normal" && !("level" in plain) && plain.maxStrikes === undefined && plain.maxVowels === undefined && plain.timeLimitMs === undefined, `seed ${seed}: Normal carries no level, strikes, vowels or clock`);
  ok(JSON.stringify(so2RulesFor(plain)) === JSON.stringify(so2Rules(strikeoutRevOf(plain))), `seed ${seed}: Normal plays its revision's rules`);
  ok(puzzleTimeLimitMs(plain) === 100_000, `seed ${seed}: Normal's clock is 100 s`);
}
for (const rev of [2, 3, 4, 5, 6, 7]) ok(JSON.stringify(so2RulesFor({ strikeoutRev: rev })) === JSON.stringify(so2Rules(rev)), `rev ${rev}: a puzzle without level fields plays its revision's rules`);

// 3–5. Each level's sets.
for (const level of LEVELS) {
  const s = STRIKEOUT_LEVEL_SETTINGS[level];
  let solved = 0;
  let maxStrikes = 0;
  for (const seed of SEEDS) {
    const p = deal(seed, level);
    ok(JSON.stringify(p) === JSON.stringify(deal(seed, level)), `${level} ${seed}: the same seed deals the same set (every player)`);
    ok(puzzleLevel(p) === level, `${level} ${seed}: stamped ${level}`);
    ok(p.maxStrikes === s.strikes && p.maxVowels === s.vowels && p.timeLimitMs === s.timeLimitMs, `${level} ${seed}: carries the level's strikes, vowels and clock`);
    ok(puzzleTimeLimitMs(p) === s.timeLimitMs, `${level} ${seed}: the clock read is the level's`);
    const rules = so2RulesFor(p);
    ok(rules.maxStrikes === s.strikes && rules.maxVowels === s.vowels, `${level} ${seed}: the replay reads the level's rules`);
    const words = p.words ?? [];
    const givens = p.givens ?? [];
    ok(strikeout2RuleBreak(words, givens, STRIKEOUT_REV3, strikeoutLevelExtra(s)) === null, `${level} ${seed}: the set meets the generator's rules at the level's starting letters`);
    words.forEach((w, i) => {
      const [seven, eight] = i < 3 ? s.givensFirst : s.givensRest;
      const shown = new Set([...(givens[i] ?? "")].filter((ch) => ch !== "_"));
      ok(shown.size === (w.length <= 7 ? seven : eight), `${level} ${seed}: word ${i + 1} shows ${w.length <= 7 ? seven : eight} starting letters`);
      ok(strikeoutAnswerWords(w.length).includes(w), `${level} ${seed}: word ${i + 1} is an answer word`);
    });
    const r = solveStrikeoutLikeAPerson(p);
    // A word is read either by a Solve the solver made with one answer word left, or by guessing every letter out.
    ok(r.candidatesAtSolve.every((n) => n === 1), `${level} ${seed}: every Solve was made with exactly one answer word left`);
    const solves = r.actions.filter((a): a is Extract<typeof a, { kind: "solve" }> => a.kind === "solve");
    ok(solves.every((a) => a.guess === words[a.word]), `${level} ${seed}: each word's one answer is the right one (no wrong Solve)`);
    ok(r.solved && r.strikes < s.strikes, `${level} ${seed}: the person-like solver clears the set within ${s.strikes} strikes (${r.strikes})`);
    if (r.solved) solved++;
    maxStrikes = Math.max(maxStrikes, r.strikes);
  }
  console.log(`  ${level}: the person-like solver cleared ${solved}/${SEEDS.length} sets, at most ${maxStrikes} strikes`);
}

// 6. The tuning: exactly level-tune's runs (its deals and its players' streams); the bands are the tuned numbers with a margin.
const BANDS = {
  easy: { near: [188, 200], great: [185, 200], finishNear: 1 },
  normal: { near: [190, 200], great: [180, 196], finishNear: 1 },
  hard: { near: [172, 192], great: [145, 178], finishNear: 0.9 },
  expert: { near: [155, 182], great: [100, 132], finishNear: 0.75 },
} as const;
for (const level of ["easy", "normal", "hard", "expert"] as const) {
  const scores = { near: [] as number[], great: [] as number[] };
  let finishedNear = 0;
  for (let n = 0; n < 20; n++) {
    const p = dealAt("strikeout", level, n);
    for (const bot of ["near", "great"] as const) {
      const play = KITS.strikeout!.play(p, makeRng(hashText(`level-tune:strikeout:${level}:${n}:${bot}`)), SKILLS[bot], puzzleTimeLimitMs(p));
      const g = gradeSteps(p, asPhoneSends(p, play.steps), play.timed);
      scores[bot].push(g.score);
      if (bot === "near" && g.isCorrect) finishedNear++;
    }
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const b = BANDS[level];
  const near = avg(scores.near);
  const great = avg(scores.great);
  console.log(`  ${level}: near-perfect ${near.toFixed(1)} (finished ${finishedNear}/20), great ${great.toFixed(1)}`);
  ok(near >= b.near[0] && near <= b.near[1], `${level}: near-perfect average ${near.toFixed(1)} in ${b.near.join("–")}`);
  ok(great >= b.great[0] && great <= b.great[1], `${level}: great average ${great.toFixed(1)} in ${b.great.join("–")}`);
  ok(finishedNear / 20 >= b.finishNear, `${level}: near-perfect finishes at least ${b.finishNear * 100}%`);
}

// 7. Easy's markers fit.
const stage = readFileSync("src/puzzles/strikeout.tsx", "utf8");
ok(/const size = max > 12 \? "h-4 w-4"/.test(stage), "the stage draws more than 12 strike markers at 16 px");
ok(14 * 16 + 13 * 4 <= 320 - 24, "14 markers at 16 px with 4 px gaps fit a 320 px phone inside its margins");

console.log(`PASS: strikeout levels — ${checks} checks`);
