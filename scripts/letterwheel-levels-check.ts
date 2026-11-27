/**
 * letterwheel-levels-check (the Word overhaul, stage 3, 15 Nov 2026): Roundabout's Easy, Hard and Expert
 * (src/lib/levels/word/letterwheel.ts, src/lib/duel/levels/letterwheel.server.ts, the level banks built by
 * `bun scripts/letter-wheel-bank.ts --level=easy|hard|expert [--check]`). No browser, ~15 s.
 *
 *  1. The registry: Easy, Normal, Hard and Expert; every level beyond Normal open by design (a word find: a traced word
 *     drops into its slot, other real words into the jar) with its reason, and one plain line saying what changes.
 *  2. Every level bank meets its limits (LW_LEVEL_LIMITS): the wheel's letter count, 9 columns at most (taller, never
 *     narrower squares than Normal's), the word counts, every slot word spellable from the wheel, a real word on the
 *     common-answers list and different from the others, the slots inside the box and agreeing at every crossing, the
 *     wheel itself never a word.
 *  3. Clocks: every level's dealt clock is the level's own, at most 120 s; Normal carries none (today's 100 s).
 *  4. Normal is today's game: a deal asked at Normal is byte for byte the plain deal and carries no level.
 *  5. A room's level deal is the same for everyone, drawn from the level's bank, on today's stamp with the jar sized
 *     from the board's own bonus words, stamped with its level.
 *  6. The tuning: the near-perfect kit's mean on fixed seeds inside the bands tuned on 15 Nov 2026, Easy at least as
 *     kind as Normal and each harder level below the one before.
 *
 *   bun scripts/letterwheel-levels-check.ts
 */
import { answerWords, isWord } from "../src/lib/duel/dictionary.server";
import { STRIKEOUT_WORDS_8_RAW } from "../src/lib/duel/strikeoutWords.server"; // Changed with Joe's approval, 21 Nov 2026
import { lwJarSize, lwSlotCells, LW_LEVEL_LIMITS } from "../src/lib/duel/letterWheel";
import { lwBonusDropsAvailable } from "../src/lib/duel/letterWheel.server";
import { LETTER_WHEEL_LEVEL_BANKS } from "../src/lib/duel/levels/letterwheel.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { LETTERWHEEL_TIME_MS, type LetterWheelPuzzleData } from "../src/lib/duel/types";
import { WHEEL_REV_COMMON } from "../src/lib/duel/wordOverhaul";
import { WHEEL_REV_STAR } from "../src/lib/duel/wordStar"; // Changed with Joe's approval, 21 Nov 2026
import { gameLevelSettings, levelProof, levelsOf } from "../src/lib/levels/gameLevels";
import { puzzleLevel } from "../src/lib/levels/levels";
import { LETTERWHEEL_LEVEL_ABOUT, type LetterWheelLevelSettings } from "../src/lib/levels/word/letterwheel";
import { MAX_ROUND_CLOCK_MS, Tally, aboutLineOk, dealLevel, kitScore, mean, seedsFrom } from "./word-levels-lib";

const t = new Tally();
const TYPE = "letterwheel" as const;
const LEVELS_BEYOND = ["easy", "hard", "expert"] as const;

// 1. The registry.
t.ok(JSON.stringify(levelsOf(TYPE)) === JSON.stringify(["easy", "normal", "hard", "expert"]), "Roundabout offers Easy, Normal, Hard and Expert");
for (const level of LEVELS_BEYOND) {
  const proof = levelProof(TYPE, level);
  t.ok(proof && "open" in proof && proof.open.length > 20, `${level}: open by design, with its reason`);
  const s = gameLevelSettings<LetterWheelLevelSettings>(TYPE, level)!;
  const why = aboutLineOk(LETTERWHEEL_LEVEL_ABOUT[level], s.timeLimitMs);
  t.ok(why === null, `${level}: the level's line (${why})`);
}

// 2. The banks.
const answers = new Set<string>();
for (let n = 3; n <= 9; n++) for (const w of answerWords(n)) answers.add(w.toUpperCase());
for (const w of STRIKEOUT_WORDS_8_RAW.split(/\s+/)) if (w) answers.add(w.toUpperCase()); // Changed with Joe's approval, 21 Nov 2026
for (const level of LEVELS_BEYOND) {
  const lim = LW_LEVEL_LIMITS[level];
  const bank = LETTER_WHEEL_LEVEL_BANKS[level];
  t.ok(bank.length === lim.bank, `${level}: the bank holds ${lim.bank} boards`);
  t.ok(new Set(bank.map((e) => [...e.letters].sort().join(""))).size === bank.length, `${level}: no two boards share a wheel`);
  let bad: string | null = null;
  for (const [n, e] of bank.entries()) {
    const why = (() => {
      if (e.letters.length !== lim.letters) return `${e.letters.length} letters`;
      if (e.cols > lim.maxCols || e.rows > lim.maxRows) return `${e.cols} × ${e.rows}`;
      if (e.words.length < lim.minWords || e.words.length > lim.maxWords) return `${e.words.length} words`;
      if (e.words.filter((w) => w.length >= 4).length < lim.minLong) return "too few long words";
      if (e.words.filter((w) => w.length === 3).length > lim.maxShort) return "too many 3-letter words";
      if (new Set(e.words).size !== e.words.length) return "a repeated word";
      if (isWord(e.letters)) return "the wheel spells a word";
      for (const w of e.words) {
        if (!answers.has(w) || !isWord(w)) return `${w} is not a common answer`;
        const left = [...e.letters];
        for (const ch of w) {
          const at = left.indexOf(ch);
          if (at < 0) return `${w} is not on the wheel`;
          left.splice(at, 1);
        }
      }
      const grid = new Map<number, string>();
      for (const [i, s] of e.slots.entries()) {
        if (s.len !== e.words[i]!.length) return "a slot's length";
        const endR = s.row + (s.across ? 0 : s.len - 1);
        const endC = s.col + (s.across ? s.len - 1 : 0);
        if (s.row < 0 || s.col < 0 || endR >= e.rows || endC >= e.cols) return "a slot outside the box";
        for (const [j, cell] of lwSlotCells(s, e.cols).entries()) {
          const ch = e.words[i]![j]!;
          if (grid.has(cell) && grid.get(cell) !== ch) return "a crossing disagrees";
          grid.set(cell, ch);
        }
      }
      return null;
    })();
    if (why) {
      bad = `#${n}: ${why}`;
      break;
    }
  }
  t.ok(bad === null, `${level}: every board meets its limits (${bad})`);
}

// 3–5. Deals.
for (const seed of seedsFrom(4101, 12)) {
  const plain = dealLevel(TYPE, null, seed);
  const normal = dealLevel(TYPE, "normal", seed);
  t.ok(JSON.stringify(plain) === JSON.stringify(normal), `seed ${seed}: Normal is the plain deal byte for byte`);
  t.ok(!("level" in (normal as object)) && puzzleTimeLimitMs(normal) === LETTERWHEEL_TIME_MS, `seed ${seed}: Normal carries no level and today's ${LETTERWHEEL_TIME_MS / 1000} s`);
  for (const level of LEVELS_BEYOND) {
    const s = gameLevelSettings<LetterWheelLevelSettings>(TYPE, level)!;
    const p = dealLevel(TYPE, level, seed) as LetterWheelPuzzleData;
    t.ok(JSON.stringify(p) === JSON.stringify(dealLevel(TYPE, level, seed)), `${level} ${seed}: the same seed deals the same board`);
    t.ok(puzzleLevel(p) === level, `${level} ${seed}: stamped ${level}`);
    t.ok(puzzleTimeLimitMs(p) === s.timeLimitMs && s.timeLimitMs <= MAX_ROUND_CLOCK_MS, `${level} ${seed}: its own clock, at most 120 s`);
    t.ok(p.wheelRev === WHEEL_REV_STAR, `${level} ${seed}: today's stamp (wheelRev ${WHEEL_REV_STAR})`); // Changed with Joe's approval, 21 Nov 2026
    const from = LETTER_WHEEL_LEVEL_BANKS[level].some((e) => e.letters === p.letters && JSON.stringify(e.words) === JSON.stringify(p.words));
    t.ok(from, `${level} ${seed}: a board from the level's bank`);
    t.ok(p.jarSize === lwJarSize(lwBonusDropsAvailable(p.letters, p.words ?? [])), `${level} ${seed}: the jar sized from the board's own bonus words`);
  }
}

// 6. The tuning (near-perfect kit, mean on 16 fixed seeds; bands measured on 15 Nov 2026 with a margin).
const BANDS: Record<string, [number, number]> = { easy: [170, 195], normal: [162, 186], hard: [155, 180], expert: [140, 165] }; // Changed with Joe's approval, 22 Nov 2026
const means: Record<string, number> = {};
const tuneSeeds = seedsFrom(9101, 16);
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

console.log(`PASS letterwheel-levels-check: ${t.checks} checks (near-perfect means ${Object.entries(means).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(", ")}; great ${Object.entries(great).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(", ")})`);
