/**
 * word-levels-proof-check (D1, 21 Nov 2026; docs/polish-plan-final/difficulty-spec.md "Word"): the Word levels' proof under
 * the human limits and the rules the level deals store.
 *
 *  1. The limits the deals prove against (src/lib/duel/levels/humanLimits.ts) are the bots' HUMAN_LIMITS exactly.
 *  2. Every dealt Expert board (and every Hard board the deal filters the same way) reaches 200 at the human limits,
 *     graded by the server: Nucleus and Forage by the typed witness, Roundabout by its traced witness, Strikeout by the
 *     person-like guesser's line, Lookout by its reading witness (scripts/word-human-games.ts, word-human-solvers.ts).
 *  3. The stored rules: Nucleus's and Forage's shortest word is refused by the live check and dropped by the grader, and
 *     Easy's three-letter words score on the step-up table; Roundabout's and Forage's free misses and Strikeout's free
 *     strikes are read from the deal; Normal deals carry none of these fields (Normal is today's game).
 *  4. The ladder a player sees: the shortest word, the words to find, the wheel's letters and words, and the starting
 *     letters each step one way from Easy to Expert; Strikeout's Normal givens in the picture are what the server deals.
 *  5. The lever pictures (src/lib/levels/pictures/word.tsx) draw at every level, and no two levels draw alike.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { wordsmithMinLength, wordHuntMinLength } from "../src/lib/duel/types";
import { checkWordsmithWord } from "../src/lib/duel/wordsmith.server";
import { nucleusAcceptedWords } from "../src/lib/duel/levels/wordsmith.server";
import { strikeoutLineAtLimits } from "../src/lib/duel/levels/strikeoutSolver.server";
import { encodeStrikeout2 } from "../src/lib/duel/strikeout";
import { checkWordHuntPath } from "../src/lib/duel/wordHunt.server";
import { lwFreeMissesOf } from "../src/lib/duel/letterWheel";
import { WORD_HUMAN_LIMITS } from "../src/lib/duel/levels/humanLimits";
import { GAME_LEVELS } from "../src/lib/levels/gameLevels";
import { LW_LEVEL_LIMITS, LW_REV5_LIMITS } from "../src/lib/duel/letterWheel";
import { STRIKEOUT_LEVEL_SETTINGS, STRIKEOUT_NORMAL_GIVENS } from "../src/lib/levels/word/strikeout";
import { WORDSEARCH_LEVEL_SETTINGS } from "../src/lib/levels/word/wordsearch";
import { LEVER_PICTURES, SWAPWORD_NORMAL_IN_PLACE } from "../src/lib/levels/pictures/word";
import { SW_MAX_IN_PLACE } from "../src/lib/duel/swapword.server";
import { LEVELS, type Level } from "../src/lib/levels/levels";
import { HUMAN_LIMITS } from "./arcade-skill-bands/human";
import { witnessOf } from "./word-human-games";
import { personLine } from "./word-human-solvers";

let passes = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};
const deal = (type: PuzzleType, level: Level, seed: number): PuzzleData =>
  withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed, ...(level !== "normal" ? { level } : {}) }));
const SEEDS = Array.from({ length: 12 }, (_, i) => 4100 + i * 37);

/* ------------------------------------------------------------------------------------------------ 1. The limits */
ok(WORD_HUMAN_LIMITS.reactMs === HUMAN_LIMITS.reactMs && WORD_HUMAN_LIMITS.moveMs === HUMAN_LIMITS.moveMs, `the deals' limits are HUMAN_LIMITS (${WORD_HUMAN_LIMITS.reactMs} / ${WORD_HUMAN_LIMITS.moveMs} ms)`);

/* ------------------------------------------------------------------------------------------------ 2. 200 at the limits */
const PROVED: [PuzzleType, Level[], "witness" | "line"][] = [
  ["wordsmith", ["hard", "expert"], "witness"],
  ["wordhunt", ["hard", "expert"], "witness"],
  ["letterwheel", ["hard", "expert"], "witness"],
  ["strikeout", ["expert"], "line"],
  ["wordsearch", ["expert"], "line"],
];
for (const [type, levels, kind] of PROVED)
  for (const level of levels) {
    const short: string[] = [];
    for (const seed of SEEDS) {
      const p = deal(type, level, seed);
      const limit = puzzleTimeLimitMs(p);
      const got = kind === "witness" ? witnessOf(p) : personLine(p)!;
      if (!(got.score >= 200 && got.ms <= limit)) short.push(`${seed}: ${got.score} at ${(got.ms / 1000).toFixed(1)} s`);
    }
    ok(short.length === 0, `${type} ${level}: every dealt board reaches 200 at the human limits inside its clock${short.length ? ` (${short.slice(0, 4).join("; ")})` : ""}`);
  }

/* ------------------------------------------------------------------------------------------------ 3. The stored rules */
{
  // Normal carries none of the level fields.
  for (const type of ["wordsmith", "wordhunt", "letterwheel", "strikeout"] as PuzzleType[])
    for (const seed of SEEDS.slice(0, 3)) {
      const p = deal(type, "normal", seed) as unknown as Record<string, unknown>;
      const extra = ["minLength", "wordsFullAt", "baseFullAt", "extraFullAt", "freeMisses", "freeMissesPerWord", "strikeFree", "level"].filter((k) => k in p);
      ok(extra.length === 0, `${type} normal ${seed}: no level field on Normal's deal (${extra.join(", ")})`);
    }
  // Nucleus: each level's shortest word is stored, refused below it by the live check, dropped below it by the grader.
  for (const [level, min] of [["easy", 3], ["hard", 5], ["expert", 6]] as const) {
    const p = deal("wordsmith", level, SEEDS[0]!) as Extract<PuzzleData, { type: "wordsmith" }>;
    ok(wordsmithMinLength(p) === min, `nucleus ${level}: minLength ${min} stored (${String((p as { minLength?: number }).minLength)})`);
    const at = (p.words ?? []).find((w) => w.word.length === min) ?? null;
    ok(!!at && checkWordsmithWord(p.letters, at.word, [], p.wordsmithRev, wordsmithMinLength(p)).valid, `nucleus ${level}: a ${min}-letter word is accepted (${at?.word})`);
    // A real word one letter shorter than the level's shortest, spelled from the board, is refused live and dropped graded.
    const under = nucleusAcceptedWords(p.letters, min - 1).find((w) => w.length === min - 1);
    if (under) {
      ok(!checkWordsmithWord(p.letters, under, [], p.wordsmithRev, wordsmithMinLength(p)).valid, `nucleus ${level}: ${under} (${min - 1} letters) is refused live`);
      ok((gradeAnswer(p, under, 0).extra as { points?: number })?.points === 0, `nucleus ${level}: the grader drops ${under}`);
    }
  }
  {
    const p = deal("wordsmith", "easy", SEEDS[1]!) as Extract<PuzzleData, { type: "wordsmith" }>;
    const three = (p.words ?? []).find((w) => w.word.length === 3);
    ok(!!three && checkWordsmithWord(p.letters, three!.word, [], p.wordsmithRev, 3).points === 2, `nucleus easy: a three-letter word scores 2 on the step-up table (${three?.word})`);
    const g = gradeAnswer(p, three!.word, 0);
    ok((g.extra as { points?: number })?.points === 2, "nucleus easy: the grader counts it at 2 points");
    const n = deal("wordsmith", "normal", SEEDS[1]!) as Extract<PuzzleData, { type: "wordsmith" }>;
    ok(!checkWordsmithWord(n.letters, three!.word, [], n.wordsmithRev, wordsmithMinLength(n)).valid || n.letters.join("") !== p.letters.join(""), "nucleus normal: three letters are too short");
  }
  // Forage: the shortest word and the free misses.
  for (const [level, min, free] of [["easy", 3, 120], ["hard", 5, 6], ["expert", 7, 3]] as const) {
    const p = deal("wordhunt", level, SEEDS[2]!) as Extract<PuzzleData, { type: "wordhunt" }>;
    ok(wordHuntMinLength(p) === min && (p as { freeMisses?: number }).freeMisses === free, `forage ${level}: minLength ${min} and ${free} free misses stored`);
    ok((p.words ?? []).every((w) => w.word.length >= min) && (p.words ?? []).length > 0, `forage ${level}: every listed word has ${min}+ letters (${(p.words ?? []).length} listed)`);
    const normal = deal("wordhunt", "normal", SEEDS[2]!) as Extract<PuzzleData, { type: "wordhunt" }>;
    const four = (normal.words ?? []).find((w) => w.word.length === 4);
    if (four && min > 4) {
      // A four-letter word's path is refused below the level's shortest length, live and graded.
      const verdict = checkWordHuntPath(normal.grid, four.path, [], min);
      ok(!verdict.valid && verdict.reason === "Too short", `forage ${level}: a four-letter trace is refused (${four.word})`);
      ok(gradeAnswer({ ...normal, minLength: min } as PuzzleData, `${four.word}:${four.path.join("-")}`, 0).score === 0, `forage ${level}: the grader drops a word under ${min} letters`);
    }
  }
  // Roundabout: free misses stored and read.
  for (const [level, free] of [["easy", 5], ["hard", 3], ["expert", 2]] as const) {
    const p = deal("letterwheel", level, SEEDS[3]!) as Extract<PuzzleData, { type: "letterwheel" }>;
    ok(lwFreeMissesOf(p) === free, `roundabout ${level}: ${free} free misses (${lwFreeMissesOf(p)})`);
  }
  {
    const p = deal("letterwheel", "expert", SEEDS[3]!) as Extract<PuzzleData, { type: "letterwheel" }>;
    const words = p.words ?? [];
    const miss = ["QZX", "XQZ", "ZXQ"];
    const answer = [...miss, ...words].join(",");
    const limit = puzzleTimeLimitMs(p);
    const lvl = gradeAnswer(p, answer, limit - 30_000).score;
    const five = gradeAnswer({ ...p, freeMisses: 5 } as PuzzleData, answer, limit - 30_000).score;
    ok(lvl < five, `roundabout expert: three misses cost past its 2 free (${lvl} < ${five} with 5 free)`);
  }
  // Strikeout: Expert's free strikes are stored and read: the person-like line's 200 needs them on most sets.
  {
    let helped = 0;
    for (const seed of SEEDS.slice(0, 6)) {
      const p = deal("strikeout", "expert", seed) as Extract<PuzzleData, { type: "strikeout" }>;
      ok((p as { strikeFree?: number }).strikeFree === STRIKEOUT_LEVEL_SETTINGS.expert.strikeFree, `strikeout expert ${seed}: ${STRIKEOUT_LEVEL_SETTINGS.expert.strikeFree} free strikes stored`);
      const line = strikeoutLineAtLimits(p);
      const answer = encodeStrikeout2(line.solve.actions);
      const msLeft = puzzleTimeLimitMs(p) - line.ms;
      const without = { ...p } as Record<string, unknown>;
      delete without["strikeFree"];
      const a = gradeAnswer(p, answer, msLeft).score;
      const b = gradeAnswer(without as unknown as PuzzleData, answer, msLeft).score;
      ok(a >= b, `strikeout expert ${seed}: the free strikes never cost (${a} ≥ ${b})`);
      if (a > b) helped++;
    }
    ok(helped > 0, `strikeout expert: the grader reads the free strikes (${helped} of 6 lines score more with them)`);
  }
  // Strikeout: Normal's givens in the picture are the server's.
  {
    const p = deal("strikeout", "normal", SEEDS[5]!) as Extract<PuzzleData, { type: "strikeout" }>;
    const shown = (p.givens ?? []).map((g) => [...g].filter((c) => c !== "_").length);
    const want = (p.words ?? []).map((w, i) => (i < 3 ? STRIKEOUT_NORMAL_GIVENS.givensFirst : STRIKEOUT_NORMAL_GIVENS.givensRest)[w.length <= 7 ? 0 : 1]);
    ok(JSON.stringify(shown) === JSON.stringify(want), `strikeout normal: the picture's starting letters are the deal's (${shown.join(",")} / ${want.join(",")})`);
  }
}

/* ------------------------------------------------------------------------------------------------ 4. The ladder */
{
  const minOf = (type: string, level: Level, normal: number) => (level === "normal" ? normal : ((GAME_LEVELS[type]!.levels[level]!.settings as { minLength: number }).minLength));
  const asc = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1]!);
  ok(asc(LEVELS.map((l) => minOf("wordsmith", l, 4))), `nucleus: the shortest word climbs Easy to Expert (${LEVELS.map((l) => minOf("wordsmith", l, 4)).join(", ")})`);
  ok(asc(LEVELS.map((l) => minOf("wordhunt", l, 4))), `forage: the shortest word climbs Easy to Expert (${LEVELS.map((l) => minOf("wordhunt", l, 4)).join(", ")})`);
  const ws = LEVELS.map((l) => (l === "normal" ? 6 : WORDSEARCH_LEVEL_SETTINGS[l].words));
  ok(asc(ws), `lookout: words to find climb (${ws.join(", ")})`);
  const lw = LEVELS.map((l) => (l === "normal" ? LW_REV5_LIMITS.minWords : LW_LEVEL_LIMITS[l].minWords));
  ok(asc(lw), `roundabout: crossword words climb (${lw.join(", ")})`);
  const so = LEVELS.map((l) => (l === "normal" ? STRIKEOUT_NORMAL_GIVENS.givensFirst[0] : STRIKEOUT_LEVEL_SETTINGS[l].givensFirst[0]));
  ok(so.every((x, i) => i === 0 || x < so[i - 1]!), `strikeout: starting letters fall (${so.join(", ")})`);
}

/* ------------------------------------------------------------------------------------------------ 5. The pictures */
ok(SWAPWORD_NORMAL_IN_PLACE === SW_MAX_IN_PLACE, `swapword: the picture's Normal tiles in place are the deal's (${SWAPWORD_NORMAL_IN_PLACE} / ${SW_MAX_IN_PLACE})`);
for (const [type, Picture] of Object.entries(LEVER_PICTURES)) {
  const drawn = LEVELS.map((level) => renderToStaticMarkup(createElement(Picture, { level, size: 64 })));
  ok(drawn.every((svg) => svg.startsWith("<svg") && svg.includes("data-lever-picture")), `${type}: a picture at every level`);
  ok(new Set(drawn).size === LEVELS.length, `${type}: no two levels draw alike`);
}

if (failures.length) {
  console.log(`FAIL word-levels-proof-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS word-levels-proof-check: ${passes} checks`);
