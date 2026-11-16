/**
 * wordhunt-levels-check (the Word overhaul, stage 3, 15 Nov 2026): Forage's Easy, Hard and Expert
 * (src/lib/levels/word/wordhunt.ts, src/lib/duel/levels/wordhunt.server.ts). No browser, ~30 s.
 *
 *  1. The registry: Easy, Normal, Hard and Expert; every level beyond Normal open by design (a word find) with its
 *     reason, and one plain line saying what changes.
 *  2. Clocks: every level's dealt clock is the level's own, at most 120 s; Normal carries none (today's 100 s).
 *  3. Normal is today's game: a deal asked at Normal is byte for byte the plain deal and carries no level.
 *  4. A room's level deal is the same for everyone and is stamped with its level.
 *  5. The boards: 6 × 6 (Normal's squares at every level), today's stamp, a golden tile off any Qu, every listed word
 *     really traced on the board, the word count inside the level's band.
 *  6. The tuning: the near-perfect kit's mean on fixed seeds inside the bands tuned on 15 Nov 2026, Easy at least as
 *     kind as Normal and each harder level below the one before.
 *  7. The stage locks the words in on the level's own clock.
 *
 *   bun scripts/wordhunt-levels-check.ts
 */
import { readFileSync } from "node:fs";

import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { WORDHUNT_COLS_DEPTH, WORDHUNT_TIME_MS, type WordHuntPuzzleData } from "../src/lib/duel/types";
import { gameLevelSettings, levelProof, levelsOf } from "../src/lib/levels/gameLevels";
import { puzzleLevel } from "../src/lib/levels/levels";
import { WORDHUNT_LEVEL_ABOUT, type WordHuntLevelSettings } from "../src/lib/levels/word/wordhunt";
import { MAX_ROUND_CLOCK_MS, Tally, aboutLineOk, dealLevel, kitScore, mean, seedsFrom } from "./word-levels-lib";

const t = new Tally();
const TYPE = "wordhunt" as const;
const LEVELS_BEYOND = ["easy", "hard", "expert"] as const;
const N = WORDHUNT_COLS_DEPTH;

const adjacent = (a: number, b: number) => a !== b && Math.abs(Math.floor(a / N) - Math.floor(b / N)) <= 1 && Math.abs((a % N) - (b % N)) <= 1;

// 1. The registry.
t.ok(JSON.stringify(levelsOf(TYPE)) === JSON.stringify(["easy", "normal", "hard", "expert"]), "Forage offers Easy, Normal, Hard and Expert");
for (const level of LEVELS_BEYOND) {
  const proof = levelProof(TYPE, level);
  t.ok(proof && "open" in proof && proof.open.length > 20, `${level}: open by design, with its reason`);
  const s = gameLevelSettings<WordHuntLevelSettings>(TYPE, level)!;
  const why = aboutLineOk(WORDHUNT_LEVEL_ABOUT[level], s.timeLimitMs);
  t.ok(why === null, `${level}: the level's line (${why})`);
}

// 2–5. Deals.
for (const seed of seedsFrom(6101, 6)) {
  const plain = dealLevel(TYPE, null, seed);
  const normal = dealLevel(TYPE, "normal", seed);
  t.ok(JSON.stringify(plain) === JSON.stringify(normal), `seed ${seed}: Normal is the plain deal byte for byte`);
  t.ok(!("level" in (normal as object)) && puzzleTimeLimitMs(normal) === WORDHUNT_TIME_MS, `seed ${seed}: Normal carries no level and today's ${WORDHUNT_TIME_MS / 1000} s`);
  for (const level of LEVELS_BEYOND) {
    const s = gameLevelSettings<WordHuntLevelSettings>(TYPE, level)!;
    const p = dealLevel(TYPE, level, seed) as WordHuntPuzzleData;
    t.ok(JSON.stringify(p) === JSON.stringify(dealLevel(TYPE, level, seed)), `${level} ${seed}: the same seed deals the same board`);
    t.ok(puzzleLevel(p) === level, `${level} ${seed}: stamped ${level}`);
    t.ok(puzzleTimeLimitMs(p) === s.timeLimitMs && s.timeLimitMs <= MAX_ROUND_CLOCK_MS, `${level} ${seed}: its own clock, at most 120 s`);
    t.ok(p.grid.length === N * N, `${level} ${seed}: a ${N} × ${N} board`);
    t.ok(p.wordHuntRev === (normal as WordHuntPuzzleData).wordHuntRev, `${level} ${seed}: today's stamp (wordHuntRev ${p.wordHuntRev})`);
    t.ok(typeof p.golden === "number" && p.grid[p.golden] !== "QU", `${level} ${seed}: a golden tile, never a Qu`);
    const words = p.words ?? [];
    t.ok(words.length >= s.words.min && words.length <= s.words.max, `${level} ${seed}: ${words.length} words inside ${s.words.min}–${s.words.max}`);
    const traced = words.every(({ word, path }) => {
      if (new Set(path).size !== path.length) return false;
      if (!path.every((c, i) => i === 0 || adjacent(path[i - 1]!, c))) return false;
      return path.map((c) => p.grid[c]).join("") === word;
    });
    t.ok(traced, `${level} ${seed}: every listed word is traced on the board`);
  }
}

// 6. The tuning (near-perfect kit, mean on 12 fixed seeds; bands measured on 15 Nov 2026 with a margin).
const BANDS: Record<string, [number, number]> = { easy: [170, 195], normal: [158, 184], hard: [138, 164], expert: [115, 142] };
const means: Record<string, number> = {};
const tuneSeeds = seedsFrom(8101, 12);
for (const level of ["easy", "normal", "hard", "expert"] as const) {
  means[level] = mean(tuneSeeds.map((seed) => kitScore(TYPE, dealLevel(TYPE, level === "normal" ? null : level, seed), seed).score));
  const [lo, hi] = BANDS[level]!;
  t.ok(means[level]! >= lo && means[level]! <= hi, `${level}: the near-perfect mean ${means[level]!.toFixed(1)} inside ${lo}–${hi}`);
}
t.ok(means.easy! >= means.normal!, "Easy is at least as kind as Normal");
t.ok(means.hard! < means.normal! && means.expert! < means.hard!, "Hard is harder than Normal, Expert harder than Hard");
// Joe (16 Nov 2026): a clear step up for the Great player too, not only the Near-perfect one.
const great: Record<string, number> = {};
for (const level of ["easy", "normal", "hard", "expert"] as const) {
  great[level] = mean(tuneSeeds.map((seed) => kitScore(TYPE, dealLevel(TYPE, level === "normal" ? null : level, seed), seed, "great").score));
}
t.ok(great.easy! >= great.normal! && great.hard! < great.normal! - 5 && great.expert! < great.hard! - 5, `the Great player steps down too (${Object.entries(great).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(", ")})`);

// 7. The stage.
const stage = readFileSync("src/components/puzzles/WordHuntPuzzle.tsx", "utf8");
t.ok(/phaseStartedAt \+ \(puzzle\.timeLimitMs \?\? WORDHUNT_TIME_MS\) - now/.test(stage), "the stage locks the words in on the level's own clock");

console.log(`PASS wordhunt-levels-check: ${t.checks} checks (near-perfect means ${Object.entries(means).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(", ")}; great ${Object.entries(great).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(", ")})`);
