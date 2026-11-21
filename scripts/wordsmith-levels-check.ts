/**
 * wordsmith-levels-check (the Word overhaul, stage 3, 15 Nov 2026): Nucleus's Easy, Hard and Expert
 * (src/lib/levels/word/wordsmith.ts, src/lib/duel/levels/wordsmith.server.ts). No browser, ~20 s.
 *
 *  1. The registry: Easy, Normal, Hard and Expert; every level beyond Normal open by design (a word find) with its
 *     reason, and one plain line saying what changes.
 *  2. Clocks: every level's dealt clock is the level's own, at most 120 s; Normal carries none (today's 100 s).
 *  3. Normal is today's game: a deal asked at Normal is byte for byte the plain deal and carries no level.
 *  4. A room's level deal is the same for everyone (the same seed deals the same board) and is stamped with its level.
 *  5. The boards: one of the level's sizes, the centre in the middle, the every-tile word on the board, the everyday
 *     words inside the level's band, today's stamp (wordsmithRev 5, everyday words only).
 *  6. The tuning: the near-perfect kit's mean on fixed seeds inside the bands tuned on 15 Nov 2026 (scripts/level-tune.ts),
 *     Easy at least as kind as Normal and each harder level below the one before.
 *  7. The stage locks the words in on the level's own clock.
 *
 *   bun scripts/wordsmith-levels-check.ts
 */
import { readFileSync } from "node:fs";

import { isEverydayWord } from "../src/lib/duel/dictionary.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { WORDSMITH_CENTRE_INDEX, WORDSMITH_TIME_MS, type WordsmithPuzzleData } from "../src/lib/duel/types";
import { WORDSMITH_REV_EVERYDAY } from "../src/lib/duel/wordOverhaul";
import { WORDSMITH_REV_STAR } from "../src/lib/duel/wordStar"; // Changed with Joe's approval, 21 Nov 2026
import { gameLevelSettings, levelProof, levelsOf } from "../src/lib/levels/gameLevels";
import { puzzleLevel } from "../src/lib/levels/levels";
import { WORDSMITH_LEVEL_ABOUT, type WordsmithLevelSettings } from "../src/lib/levels/word/wordsmith";
import { measureOpen } from "./word-human-tune"; // Changed with Joe's approval, 21 Nov 2026
import { MAX_ROUND_CLOCK_MS, Tally, aboutLineOk, dealLevel, kitScore, mean, seedsFrom } from "./word-levels-lib";

const t = new Tally();
const TYPE = "wordsmith" as const;
const LEVELS_BEYOND = ["easy", "hard", "expert"] as const;

// 1. The registry.
t.ok(JSON.stringify(levelsOf(TYPE)) === JSON.stringify(["easy", "normal", "hard", "expert"]), "Nucleus offers Easy, Normal, Hard and Expert");
for (const level of LEVELS_BEYOND) {
  const proof = levelProof(TYPE, level);
  t.ok(proof && "open" in proof && proof.open.length > 20, `${level}: open by design, with its reason`);
  const s = gameLevelSettings<WordsmithLevelSettings>(TYPE, level)!;
  const why = aboutLineOk(WORDSMITH_LEVEL_ABOUT[level], s.timeLimitMs);
  t.ok(why === null, `${level}: the level's line (${why})`);
}

// 2–5. Deals.
const seeds = seedsFrom(5101, 10);
for (const seed of seeds) {
  const plain = dealLevel(TYPE, null, seed);
  const normal = dealLevel(TYPE, "normal", seed);
  t.ok(JSON.stringify(plain) === JSON.stringify(normal), `seed ${seed}: Normal is the plain deal byte for byte`);
  t.ok(!("level" in (normal as object)) && (normal as WordsmithPuzzleData).timeLimitMs === undefined, `seed ${seed}: Normal carries no level and today's clock`);
  t.ok(puzzleTimeLimitMs(normal) === WORDSMITH_TIME_MS, `seed ${seed}: Normal's clock is ${WORDSMITH_TIME_MS / 1000} s`);
  for (const level of LEVELS_BEYOND) {
    const s = gameLevelSettings<WordsmithLevelSettings>(TYPE, level)!;
    const p = dealLevel(TYPE, level, seed) as WordsmithPuzzleData;
    const again = dealLevel(TYPE, level, seed);
    t.ok(JSON.stringify(p) === JSON.stringify(again), `${level} ${seed}: the same seed deals the same board`);
    t.ok(puzzleLevel(p) === level, `${level} ${seed}: stamped ${level}`);
    t.ok(puzzleTimeLimitMs(p) === s.timeLimitMs && s.timeLimitMs <= MAX_ROUND_CLOCK_MS, `${level} ${seed}: its own clock, at most 120 s`);
    t.ok(s.sizes.includes(p.letters.length), `${level} ${seed}: ${p.letters.length} letters, one of the level's sizes`);
    t.ok(p.wordsmithRev === WORDSMITH_REV_STAR, `${level} ${seed}: today's stamp (wordsmithRev ${WORDSMITH_REV_STAR})`); // Changed with Joe's approval, 21 Nov 2026
    const words = p.words ?? [];
    t.ok(words.every((w) => isEverydayWord(w.word)) && p.wordCount === words.length, `${level} ${seed}: the counted words are everyday words`);
    t.ok(words.length >= s.everyday.min && words.length <= s.everyday.max, `${level} ${seed}: ${words.length} everyday words inside ${s.everyday.min}–${s.everyday.max}`);
    const centre = p.letters[WORDSMITH_CENTRE_INDEX]!;
    t.ok(words.every((w) => w.word.includes(centre)), `${level} ${seed}: every counted word uses the centre letter`);
    t.ok(!!p.source && [...p.source].sort().join("") === [...p.letters].sort().join(""), `${level} ${seed}: the every-tile word is on the board`);
  }
}

// 6. The tuning (near-perfect kit, mean on 16 fixed seeds; bands measured on 15 Nov 2026 with a margin).
const BANDS: Record<string, [number, number]> = { easy: [180, 200], normal: [172, 196], hard: [180, 200], expert: [178, 200] }; // Changed with Joe's approval, 21 Nov 2026
const means: Record<string, number> = {};
const tuneSeeds = seedsFrom(7301, 16);
for (const level of ["easy", "normal", "hard", "expert"] as const) {
  means[level] = mean(tuneSeeds.map((seed) => kitScore(TYPE, dealLevel(TYPE, level === "normal" ? null : level, seed), seed).score));
  const [lo, hi] = BANDS[level]!;
  t.ok(means[level]! >= lo && means[level]! <= hi, `${level}: the near-perfect mean ${means[level]!.toFixed(1)} inside ${lo}–${hi}`);
}
t.ok(means.easy! >= means.normal! - 8, "Easy is at least as kind as Normal");
const reach = (l: "normal" | "hard" | "expert") => { const [e] = measureOpen(TYPE, l, seedsFrom(40001, 100), 3, false, ["elite"]); return e!.at200 / e!.runs; }; // Changed with Joe's approval, 21 Nov 2026
const share = { normal: reach("normal"), hard: reach("hard"), expert: reach("expert") }; // Changed with Joe's approval, 21 Nov 2026
t.ok(share.normal > share.hard && share.hard > share.expert && share.expert >= 0.2, `the elite under the human limits reaches 200 less often each level up, and on Expert on at least a fifth of runs (${Object.entries(share).map(([k, v]) => `${k} ${(100 * v).toFixed(0)}%`).join(", ")})`); // Changed with Joe's approval, 21 Nov 2026
// Joe (16 Nov 2026): a clear step up for the Great player too, not only the Near-perfect one.
const great: Record<string, number> = {};
for (const level of ["easy", "normal", "hard", "expert"] as const) {
  great[level] = mean(tuneSeeds.map((seed) => kitScore(TYPE, dealLevel(TYPE, level === "normal" ? null : level, seed), seed, "great").score));
}
const people = (person: "average" | "elite") => Object.fromEntries((["easy", "normal", "hard", "expert"] as const).map((l) => [l, measureOpen(TYPE, l, tuneSeeds, 3, false, [person])[0]!.mean])) as Record<string, number>; // Changed with Joe's approval, 21 Nov 2026
const show = (r: Record<string, number>) => Object.entries(r).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(", "); // Changed with Joe's approval, 21 Nov 2026
const average = people("average"); // Changed with Joe's approval, 21 Nov 2026
t.ok(average.easy! >= average.normal! && average.hard! < average.normal! - 5 && average.expert! < average.hard! - 5, `the average player under the human limits steps down too (${show(average)}; the Great kit, which finds long words as easily as short: ${show(great)})`); // Changed with Joe's approval, 21 Nov 2026

// 7. The stage.
const stage = readFileSync("src/components/puzzles/WordsmithPuzzle.tsx", "utf8");
t.ok(/phaseStartedAt \+ \(puzzle\.timeLimitMs \?\? WORDSMITH_TIME_MS\) - now/.test(stage), "the stage locks the words in on the level's own clock");

console.log(`PASS wordsmith-levels-check: ${t.checks} checks (near-perfect means ${Object.entries(means).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(", ")}; great ${Object.entries(great).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(", ")})`);
