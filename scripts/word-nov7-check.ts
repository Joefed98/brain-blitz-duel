/**
 * word-nov7-check (7 Nov 2026, docs/word-scoring-nov-2026.md): the Word scoring fix (wordNov7.ts) on Interlock
 * tileGridRev 4, Slider wordSlideRev 5 and Lookout wordSearchRev 5.
 *
 *  1. Deals: rooms deal the new stamps; pinPreWordNov7 deals the stamps before (the same board, only the stamp
 *     differs), and a check pinning the standard or Joe's puzzle notes keeps what it pinned.
 *  2. Legacy: every case of scripts/fixtures/word-nov7-legacy.json.gz (recorded on main cc8e1643 by
 *     scripts/word-nov7-record.ts: tileGridRev 3, wordSlideRev 3 and 4, wordSearchRev 4) regrades exactly.
 *  3. Interlock: the dealt solution, done fast, scores 200 on every seed (its big words earn the full 30); unfinished
 *     credit along the flawless line never falls, a correct tile next to an unfinished word never lowers the score,
 *     the answer built shifted or turned counts the same, and scattered tiles never score more than on the old stamp.
 *  4. Slider: the solver distance matches the kit's shortest line; along it the unfinished credit rises with every
 *     slide (seed 7217 no longer falls to 0); a flawless solve scores 200; random slides stay near 0.
 *  5. Lookout: the miss penalty comes off the bonus word too (random drags keep nothing for it); a perfect solve scores
 *     200 on every seed.
 *  6. Every grade's parts add up to its score; bands nothing → flawless never fall (`--seeds=N`, default 30).
 *  7. Texts: the help states the new rules (no jargon), pinned the old; the intro lines are unchanged; the progress
 *     figures read the new facts.
 *
 *   bun scripts/word-nov7-check.ts [--seeds=30]
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { INTERLOCK_REV_FAIR, LOOKOUT_REV_FAIR, SLIDER_REV_FAIR, pinPreWordNov7, usesWordNov7 } from "../src/lib/duel/wordNov7";
import { pinPreStandard } from "../src/lib/duel/standard/stamps";
import { pinPrePuzzleNotes } from "../src/lib/duel/puzzleNotes";
import { WORD_NOV7_HELP, WORD_STANDARD_HELP, WORD_STANDARD_INTRO } from "../src/lib/duel/standard/word";
import { interlockSolutionTiles, sliderCloser } from "../src/lib/duel/standard/word.server";
import { wordSlideDistance } from "../src/lib/duel/wordSlideDistance.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { SCORE_JARGON } from "../src/lib/duel/scoreList";
import { solutionProgress } from "../src/lib/duel/progressFigures";
import { tileGridResultLine, encodeTileGrid, TG_SIZE } from "../src/lib/duel/tileGrid";
import { wsEncode } from "../src/lib/duel/wordSearch";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS, SKILLS, hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import { gradeSteps, median, quantile, sentAnswer } from "./standard-lib";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

let fails = 0;
let passes = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (cond) passes++;
  else {
    fails++;
    console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
};
const eq = (name: string, got: unknown, want: unknown) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const N = Number(process.argv.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 30);
const SEEDS = Array.from({ length: N }, (_, i) => 6100 + i * 7);
const FLAWLESS: Skill = { level: "near", pace: 0.35, err: 0, reactionMs: 150, reactionSd: 10 };
const GAMES = ["tilegrid", "wordslide", "wordsearch"] as const;
const KEY = { tilegrid: "tileGridRev", wordslide: "wordSlideRev", wordsearch: "wordSearchRev" } as const;
const REV = { tilegrid: INTERLOCK_REV_FAIR, wordslide: SLIDER_REV_FAIR, wordsearch: LOOKOUT_REV_FAIR } as const;
const OLD = { tilegrid: 3, wordslide: 4, wordsearch: 4 } as const;
const stamp = (p: PuzzleData, type: (typeof GAMES)[number]) => (p as unknown as Record<string, unknown>)[KEY[type]];
const withPin = <T>(pin: (on: boolean) => boolean, fn: () => T): T => {
  const prev = pin(true);
  try {
    return fn();
  } finally {
    pin(prev);
  }
};
/** The parts of a stored grade add up to its score. */
function partsAddUp(name: string, g: { score: number; extra?: Record<string, unknown> | null }): void {
  const parts = g.extra?.["parts"] as { kind: string; base: number; efficiency?: number; speed?: number } | undefined;
  if (!parts) return ok(`${name}: parts stored`, false);
  const sum = parts.kind === "finish" ? parts.base + (parts.efficiency ?? 0) + (parts.speed ?? 0) : parts.base;
  ok(`${name}: parts add up`, sum === g.score, `${JSON.stringify(parts)} vs ${g.score}`);
}

/* ------------------------------------------------------------------------------------------------ 1. deals */

for (const type of GAMES) {
  const p = roomPuzzle(type, 6100);
  eq(`${type}: rooms deal ${KEY[type]} ${REV[type]}`, stamp(p, type), REV[type]);
  ok(`${type}: uses the fix`, usesWordNov7(p));
  const old = withPin(pinPreWordNov7, () => roomPuzzle(type, 6100));
  eq(`${type}: pinned deal carries ${KEY[type]} ${OLD[type]}`, stamp(old, type), OLD[type]);
  eq(`${type}: pinned deal is the same board`, { ...old, [KEY[type]]: 0 }, { ...p, [KEY[type]]: 0 });
  const std = withPin(pinPreStandard, () => roomPuzzle(type, 6100));
  ok(`${type}: the standard pinned keeps its stamp`, !usesWordNov7(std) && stamp(std, type) !== OLD[type], String(stamp(std, type)));
}
eq("wordslide: notes pinned keeps wordSlideRev 3", stamp(withPin(pinPrePuzzleNotes, () => roomPuzzle("wordslide", 6100)), "wordslide"), 3);

/* ------------------------------------------------------------------------------------------------ 2. legacy */
{
  const fx = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/word-nov7-legacy.json.gz")).toString()) as {
    puzzles: PuzzleData[];
    cases: { p: number; answer: string; msLeft: number; score: number; correct: boolean; parts: unknown }[];
  };
  let same = 0;
  for (const c of fx.cases) {
    const g = gradeAnswer(fx.puzzles[c.p]!, c.answer, c.msLeft);
    const parts = (g.extra as Record<string, unknown> | undefined)?.["parts"] ?? null;
    if (g.score === c.score && g.isCorrect === c.correct && JSON.stringify(parts) === JSON.stringify(c.parts)) same++;
    else if (fails < 20) ok(`legacy ${fx.puzzles[c.p]!.type} case`, false, `${c.answer.slice(0, 40)} @${c.msLeft}: ${g.score} vs ${c.score}`);
  }
  eq("legacy: every case regrades exactly", same, fx.cases.length);
  ok("legacy: covers every old stamp", ["tilegrid:3", "wordslide:3", "wordslide:4", "wordsearch:4"].every((k) => fx.puzzles.some((p) => `${p.type}:${stamp(p, p.type as (typeof GAMES)[number])}` === k)));
  ok("legacy: thousands of cases", fx.cases.length >= 3000, String(fx.cases.length));
}

/* ------------------------------------------------------------------------------------------------ 3. Interlock */
{
  let solved200 = 0;
  let neverFalls = 0;
  let spamOk = 0;
  for (const seed of SEEDS) {
    const p = roomPuzzle("tilegrid", seed) as Extract<PuzzleData, { type: "tilegrid" }>;
    const sol = p.solution!;
    const limit = puzzleTimeLimitMs(p);
    // The dealt solution itself, done at 20 s (inside the 33 s full-speed time): 150 + 20 + 30.
    const g = gradeAnswer(p, encodeTileGrid(sol), limit - 20_000);
    if (g.score === 200) solved200++;
    else ok(`interlock ${seed}: the dealt solution scores 200`, false, `${g.score} ${JSON.stringify(g.extra?.["parts"])}`);
    partsAddUp(`interlock ${seed} solution`, g);
    // The flawless kit line: every prefix graded at the buzzer never falls.
    const steps = KITS.tilegrid!.play(p, makeRng(hashText(`nov7:tg:${seed}`)), FLAWLESS, limit).steps;
    let prev = 0;
    let falls = false;
    for (let i = 1; i < steps.length; i++) {
      const s = gradeAnswer(p, sentAnswer(p, steps.slice(0, i)), 0);
      partsAddUp(`interlock ${seed} prefix ${i}`, s);
      if (s.score < prev) falls = true;
      prev = s.score;
    }
    if (!falls) neverFalls++;
    // Spam scores no more than it did on the old stamp (same board).
    const old = withPin(pinPreWordNov7, () => roomPuzzle("tilegrid", seed));
    const spams = KITS.tilegrid!.spam(p, makeRng(hashText(`nov7:tg:spam:${seed}`)), limit);
    if (spams.every((sp) => gradeAnswer(p, sp.answer, 0).score <= gradeAnswer(old, sp.answer, 0).score)) spamOk++;
  }
  eq("interlock: the dealt solution scores 200 on every seed", solved200, SEEDS.length);
  eq("interlock: the flawless line never falls", neverFalls, SEEDS.length);
  eq("interlock: spam never scores more than before", spamOk, SEEDS.length);

  // A hand check on seed 6100: the across word, then the first tile of a down word next to it (a run that is no word yet).
  const p = roomPuzzle("tilegrid", 6100) as Extract<PuzzleData, { type: "tilegrid" }>;
  const sol = p.solution!;
  const runs: number[][] = [];
  for (let r = 0; r < TG_SIZE; r++) {
    let cur: number[] = [];
    for (let c = 0; c <= TG_SIZE; c++) {
      const i = r * TG_SIZE + c;
      if (c < TG_SIZE && sol[i]) cur.push(i);
      else {
        if (cur.length >= 2) runs.push(cur);
        cur = [];
      }
    }
  }
  const across = runs[0]!;
  const cells = Array<string>(49).fill("");
  for (const i of across) cells[i] = sol[i]!;
  const acrossOnly = gradeAnswer(p, encodeTileGrid(cells), 0);
  const nextTo = sol.findIndex((l, i) => l && !across.includes(i) && across.some((a) => Math.abs(a - i) === TG_SIZE));
  ok("interlock: a down tile touches the across word", nextTo >= 0);
  const withOne = [...cells];
  withOne[nextTo] = sol[nextTo]!;
  const plusOne = gradeAnswer(p, encodeTileGrid(withOne), 0);
  ok("interlock: a correct tile next to an unfinished word raises the score", plusOne.score > acrossOnly.score, `${acrossOnly.score} → ${plusOne.score}`);
  eq("interlock: counted tiles", plusOne.extra?.["countedTiles"], across.length + 1);
  // The same tiles moved one cell, or turned on their side, count the same.
  const moved = Array<string>(49).fill("");
  const turned = Array<string>(49).fill("");
  withOne.forEach((l, i) => {
    if (!l) return;
    const r = Math.floor(i / TG_SIZE), c = i % TG_SIZE;
    turned[c * TG_SIZE + r] = l;
  });
  const minC = Math.min(...withOne.map((l, i) => (l ? i % TG_SIZE : 99)));
  const shift = minC > 0 ? -1 : 1;
  withOne.forEach((l, i) => l && (moved[i + shift] = l));
  eq("interlock: shifted counts the same", interlockSolutionTiles(p, moved), across.length + 1);
  eq("interlock: turned counts the same", interlockSolutionTiles(p, turned), across.length + 1);
  // A tile off the answer grid counts against it.
  const stray = [...withOne];
  const emptyFar = stray.findIndex((l, i) => !l && !sol[i] && !withOne.some((m, j) => m && (Math.abs(j - i) === 1 || Math.abs(j - i) === TG_SIZE)));
  const left = new Set(sol.filter(Boolean));
  for (const l of withOne) if (l) left.delete(l);
  const spare = p.tray.find((l) => left.has(l));
  if (emptyFar >= 0 && spare) {
    stray[emptyFar] = spare;
    eq("interlock: a stray tile counts against the answer tiles", interlockSolutionTiles(p, stray), across.length);
  }
  eq("interlock: nothing placed counts nothing", interlockSolutionTiles(p, Array(49).fill("")), 0);
  eq("interlock: the line reads the counted tiles", tileGridResultLine({ placed: 8, valid: false, wordTiles: 7, countedTiles: 8 }).text, "8 of 15 tiles placed · 8 counted");
  eq("interlock: older lines unchanged", tileGridResultLine({ placed: 8, valid: false, wordTiles: 7 }).text, "8 of 15 tiles placed · 7 in valid words");
}

/* ------------------------------------------------------------------------------------------------ 4. Slider */
{
  let distOk = 0;
  let rises = 0;
  let flawless200 = 0;
  for (const seed of [...SEEDS, 7217]) {
    const p = roomPuzzle("wordslide", seed) as Extract<PuzzleData, { type: "wordslide" }>;
    const limit = puzzleTimeLimitMs(p);
    const steps = KITS.wordslide!.play(p, makeRng(hashText(`nov7:sl:${seed}`)), FLAWLESS, limit).steps;
    const goal = [...p.words!.join("")];
    if (wordSlideDistance(p.grid, goal, 12) === steps.length) distOk++;
    let prev = 0;
    let rising = true;
    const curve: number[] = [];
    for (let i = 1; i < steps.length; i++) {
      const g = gradeAnswer(p, sentAnswer(p, steps.slice(0, i)), 0);
      partsAddUp(`slider ${seed} prefix ${i}`, g);
      curve.push(g.score);
      if (!(g.score > prev)) rising = false;
      prev = g.score;
      // A board of five other real words is a finish there (the phone would send it): the line ends.
      if (g.isCorrect) break;
      eq(`slider ${seed} prefix ${i}: slides closer`, g.extra?.["slidesCloser"], i);
    }
    if (rising) rises++;
    else ok(`slider ${seed}: the shortest line rises`, false, curve.join(" "));
    if (seed === 7217) ok("slider 7217: no prefix at 0", curve.every((s) => s > 0), curve.join(" "));
    const done = gradeSteps(p, steps);
    if (done.score === 200) flawless200++;
    partsAddUp(`slider ${seed} finish`, done.graded);
  }
  eq("slider: solver distance is the kit's shortest line", distOk, SEEDS.length + 1);
  eq("slider: every slide of the shortest line raises the score", rises, SEEDS.length + 1);
  eq("slider: a flawless solve scores 200", flawless200, SEEDS.length + 1);
  // Random slides: near 0.
  const spam: number[] = [];
  for (const seed of SEEDS) {
    const p = roomPuzzle("wordslide", seed);
    for (const sp of KITS.wordslide!.spam(p, makeRng(hashText(`nov7:sl:spam:${seed}`)), puzzleTimeLimitMs(p))) spam.push(gradeAnswer(p, sp.answer, 0).score);
  }
  eq("slider: spam median 0", median(spam), 0);
  ok("slider: spam p90 at most one row", quantile(spam, 0.9) <= 24, String(quantile(spam, 0.9)));
  const p = roomPuzzle("wordslide", 6100) as Extract<PuzzleData, { type: "wordslide" }>;
  eq("slider: nothing done is no closer", sliderCloser(p, "").closer, 0);
  const fig = solutionProgress(p, "", { validRows: [], slidesCloser: 3, slidesFromStart: 6, otherWordRows: 0 });
  eq("slider: the progress figure reads the slides closer", fig?.text, "3/6 slides closer");
  eq("slider: rows made into other words read as rows when they count more", solutionProgress(p, "", { validRows: [], slidesCloser: 1, slidesFromStart: 6, otherWordRows: 2 })?.text, "2/5 rows made");
}

/* ------------------------------------------------------------------------------------------------ 5. Lookout */
{
  let perfect = 0;
  for (const seed of SEEDS) {
    const p = roomPuzzle("wordsearch", seed) as Extract<PuzzleData, { type: "wordsearch" }>;
    const limit = puzzleTimeLimitMs(p);
    const words = (p.placements ?? []).map((pl) => pl.cells);
    // The bonus word, then the six by 30 s.
    const drafts = [[p.bonus!.cells], ...words.map((_, i) => [p.bonus!.cells, ...words.slice(0, i + 1)])].map((sels, i) => ({ answer: wsEncode(sels.map((c) => [...c])), atMs: 5_000 + i * 4_000 }));
    const g = gradeAnswer(p, sentAnswer(p, drafts), limit - drafts[drafts.length - 1]!.atMs);
    if (g.score === 200) perfect++;
    partsAddUp(`lookout ${seed}`, g);
  }
  eq("lookout: a perfect solve scores 200", perfect, SEEDS.length);
  const p = roomPuzzle("wordsearch", 6100) as Extract<PuzzleData, { type: "wordsearch" }>;
  const old = withPin(pinPreWordNov7, () => roomPuzzle("wordsearch", 6100));
  const bonus = wsEncode([[...p.bonus!.cells]]);
  const wrong = "0.1";
  // The bonus and 20 wrong drags: old 0 + 30 = 30; new max(0, 30 − 2 × 15) = 0.
  const drags = [bonus, ...Array(20).fill(wrong)].join(",");
  eq("lookout: old stamp keeps the bonus past the penalty", gradeAnswer(old, drags, 0).score, 30);
  eq("lookout: new stamp takes the penalty off the bonus", gradeAnswer(p, drags, 0).score, 0);
  // The bonus and 8 wrong drags: max(0, 30 − 6) = 24 (both stamps without a word: old 0 + 30).
  eq("lookout: a few wrong drags cost the bonus a little", gradeAnswer(p, [bonus, ...Array(8).fill(wrong)].join(","), 0).score, 24);
  // Random drags: no more than on the old stamp, median 0.
  const spam: number[] = [];
  let notMore = true;
  for (const seed of SEEDS) {
    const q = roomPuzzle("wordsearch", seed);
    const qOld = withPin(pinPreWordNov7, () => roomPuzzle("wordsearch", seed));
    for (const sp of KITS.wordsearch!.spam(q, makeRng(hashText(`nov7:ws:spam:${seed}`)), puzzleTimeLimitMs(q))) {
      const s = gradeAnswer(q, sp.answer, 0).score;
      spam.push(s);
      if (s > gradeAnswer(qOld, sp.answer, 0).score) notMore = false;
    }
  }
  eq("lookout: spam median 0", median(spam), 0);
  ok("lookout: spam never scores more than before", notMore);
}

/* ------------------------------------------------------------------------------------------------ 6. bands */
for (const type of GAMES) {
  const kit = KITS[type]!;
  const med: number[] = [];
  const nothing: number[] = [];
  for (const seed of SEEDS) nothing.push(gradeAnswer(roomPuzzle(type, seed), kit.nothing(roomPuzzle(type, seed)), 0).score);
  med.push(median(nothing));
  for (const level of LEVELS) {
    const scores = SEEDS.map((seed) => {
      const p = roomPuzzle(type, seed);
      const play = kit.play(p, makeRng(hashText(`nov7:band:${type}:${seed}:${level}`)), SKILLS[level], puzzleTimeLimitMs(p));
      const r = gradeSteps(p, play.steps, play.timed);
      partsAddUp(`${type} ${level} ${seed}`, r.graded);
      return r.score;
    });
    med.push(median(scores));
  }
  const flaw = SEEDS.map((seed) => {
    const p = roomPuzzle(type, seed);
    return gradeSteps(p, kit.play(p, makeRng(hashText(`nov7:band:${type}:${seed}:flawless`)), FLAWLESS, puzzleTimeLimitMs(p)).steps).score;
  });
  med.push(median(flaw));
  ok(`${type}: medians never fall with skill (nothing, ${LEVELS.join(", ")}, flawless)`, med.every((m, i) => i === 0 || m >= med[i - 1]!), med.join(" "));
  eq(`${type}: nothing scores 0`, med[0], 0);
  eq(`${type}: flawless median 200`, med[med.length - 1], 200);
}

/* ------------------------------------------------------------------------------------------------ 7. texts */
for (const type of GAMES) {
  const help = PUZZLE_INSTRUCTIONS[type as PuzzleType].score;
  eq(`${type}: help states the fix`, help, WORD_NOV7_HELP[type].split("{max}").join("200"));
  ok(`${type}: help has no jargon`, SCORE_JARGON.every((re) => !re.test(help)), help);
  eq(`${type}: intro unchanged`, INTRO_SCORE[type as PuzzleType], WORD_STANDARD_INTRO[type].split("{max}").join("200"));
  withPin(pinPreWordNov7, () => eq(`${type}: pinned help is the standard's`, PUZZLE_INSTRUCTIONS[type as PuzzleType].score, WORD_STANDARD_HELP[type].split("{max}").join("200")));
}
ok("interlock help: the answer grid", WORD_NOV7_HELP.tilegrid.includes("answer grid"));
ok("slider help: closer to the answer words", WORD_NOV7_HELP.wordslide.includes("closer to the answer words"));
ok("lookout help: the penalty takes from the bonus word", WORD_NOV7_HELP.wordsearch.includes("the bonus word together"));

console.log(`word-nov7-check: ${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
