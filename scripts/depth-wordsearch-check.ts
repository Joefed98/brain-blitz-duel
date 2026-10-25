/**
 * depth-wordsearch-check (25 Oct 2026, word depth d1; docs/depth/d1-word.md). Lookout's hidden bonus word,
 * `wordSearchRev 3`.
 *
 *   bun scripts/depth-wordsearch-check.ts            # prove
 *   bun scripts/depth-wordsearch-check.ts --record   # re-record the legacy fixture (only on the pre-depth code)
 *
 * 1. Legacy identity: room puzzles on the pre-depth stamp (wordSearchRev 2, puzzleScoreRev 3), recorded before
 *    the depth change (scripts/fixtures/depth-wordsearch-legacy.json.gz: 20 room seeds, every kit level, nothing,
 *    spam), regrade to the same score, verdict and extra; pinPreDepth still deals rev 2.
 * 2. The rev-3 bank (wordSearchBankRev3.server.ts) rebuilds byte-for-byte; every board keeps its rev-2 grid's six
 *    words and cells, hides one more on-theme word (the bonus) exactly once, in a straight line, and the six words
 *    still appear exactly once and no other theme word appears.
 * 3. New deals carry wordSearchRev 3 and the bonus stays private (splitPuzzle), as the placements do.
 * 4. Scoring: without the bonus a rev-3 round scores exactly what rev 2's grade gives (at most 150); the bonus
 *    word adds its own points (DEPTH bonus: WS_BONUS_FOUND + up to WS_BONUS_SPEED for a fast finish), the only
 *    way past 150; finishing beats not; more time left never scores less; 200 only with the bonus and a fast
 *    clean finish; the stored parts add up to the score.
 * 5. Live check: a drag on the bonus answers { valid, bonus: true, word } and nothing else; any other drag never
 *    reveals it.
 * 6. Texts: the intro and help state the bonus word and {max}.
 * 7. Bands: the elite kit player reaches 190–200 on some seed; a good player's median stays within 10 % of rev 2's.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { WORD_SEARCH_BANK } from "../src/lib/duel/wordSearchBank.server";
import { WORD_SEARCH_REV3_BONUS } from "../src/lib/duel/wordSearchBankRev3.server";
import { wordSearchEntry, wordSearchFromIndex } from "../src/lib/duel/wordSearch.server";
import {
  checkWordSearchPath,
  wsBonusPoints,
  wsEncode,
  wsLine,
  WS_BONUS_FOUND,
  WS_BONUS_SPEED,
  WS_BONUS_UNFINISHED,
  WS_DEPTH_REV,
} from "../src/lib/duel/wordSearch";
import { wordSearchPuzzle } from "../src/puzzles/wordSearch";
import { buildRev3Bonus, rev3Problem, rev3Source } from "./word-search-bank";
import { measureGame } from "./depth-word-bands";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, WordSearchPuzzleData } from "../src/lib/duel/types";
import { pinPreDepth } from "../src/lib/duel/wordDepth";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";

const FIXTURE = "scripts/fixtures/depth-wordsearch-legacy.json.gz";
const RECORD = process.argv.includes("--record");
const SEEDS = 20;

interface Case {
  seed: number;
  label: string;
  answer: string;
  ms: number;
  score: number;
  isCorrect: boolean;
  extra: unknown;
}
interface Fixture {
  puzzles: Record<number, PuzzleData>;
  cases: Case[];
}

const failures: string[] = [];
let passes = 0;
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else if (failures.length < 60) failures.push(message);
}

/** Every answer the kits give on one puzzle: nothing, spam, each level's steps (sampled) and final draft. */
function answersFor(puzzle: PuzzleData, seed: number): { label: string; answer: string; ms: number }[] {
  const kit = KITS.wordsearch!;
  const limit = puzzleTimeLimitMs(puzzle);
  const out: { label: string; answer: string; ms: number }[] = [{ label: "nothing", answer: kit.nothing(puzzle), ms: 0 }];
  for (const s of kit.spam(puzzle, makeRng(hashText(`depth-ws:spam:${seed}`)), limit)) out.push({ label: s.label, answer: s.answer, ms: 0 });
  for (const level of LEVELS) {
    const play = kit.play(puzzle, makeRng(hashText(`depth-ws:play:${seed}:${level}`)), SKILLS[level], limit);
    play.steps.forEach((step, i) => {
      if (i % 2 === 0 || i === play.steps.length - 1) out.push({ label: `${level}#${i}`, answer: step.answer, ms: Math.max(0, limit - step.atMs) });
    });
    const last = play.steps.at(-1);
    if (last) out.push({ label: `${level}@buzzer`, answer: last.answer, ms: 0 });
  }
  return out;
}

function legacyPuzzle(seed: number): PuzzleData {
  pinPreDepth(true);
  try {
    return roomPuzzle("wordsearch", seed);
  } finally {
    pinPreDepth(false);
  }
}

if (RECORD) {
  const fixture: Fixture = { puzzles: {}, cases: [] };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const puzzle = legacyPuzzle(seed);
    fixture.puzzles[seed] = puzzle;
    for (const a of answersFor(puzzle, seed)) {
      const g = gradeAnswer(puzzle, a.answer, a.ms);
      fixture.cases.push({ seed, ...a, score: g.score, isCorrect: g.isCorrect, extra: g.extra });
    }
  }
  writeFileSync(FIXTURE, gzipSync(JSON.stringify(fixture)));
  console.log(`recorded ${fixture.cases.length} cases on ${SEEDS} legacy puzzles → ${FIXTURE}`);
  process.exit(0);
}

/* 1. Legacy identity. */
{
  const fixture = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as Fixture;
  for (const c of fixture.cases) {
    const g = gradeAnswer(fixture.puzzles[c.seed]!, c.answer, c.ms);
    ok(g.score === c.score && g.isCorrect === c.isCorrect && JSON.stringify(g.extra) === JSON.stringify(c.extra), `legacy seed ${c.seed} ${c.label}: ${c.score} → ${g.score}`);
  }
  for (let seed = 1; seed <= 3; seed++) {
    const p = legacyPuzzle(seed) as WordSearchPuzzleData;
    ok(JSON.stringify(p) === JSON.stringify(fixture.puzzles[seed]), `pinPreDepth deals seed ${seed} exactly as before`);
  }
}

/* 2. The rev-3 bank. */
{
  const t0 = Date.now();
  const { bonus } = buildRev3Bonus(WORD_SEARCH_BANK.length, (i) => wordSearchEntry(i, 2));
  ok(rev3Source(bonus) === readFileSync("src/lib/duel/wordSearchBankRev3.server.ts", "utf8"), "the rev-3 bonus bank rebuilds byte-for-byte");
  ok(WORD_SEARCH_REV3_BONUS.length === WORD_SEARCH_BANK.length, "one bonus word for every bank grid");
  for (let i = 0; i < WORD_SEARCH_BANK.length; i++) {
    const e = wordSearchEntry(i, 2);
    const b = WORD_SEARCH_REV3_BONUS[i]!;
    const problem = rev3Problem(e, b);
    ok(problem === null, `bank #${i} (${e.category}): ${problem}`);
    const line = wsLine(b.cells[0]!, b.cells.at(-1)!, 10);
    ok(line !== null && line.join(".") === b.cells.join("."), `bank #${i}: the bonus lies in a straight line`);
    const p = wordSearchFromIndex(i, WS_DEPTH_REV);
    ok(JSON.stringify(p.placements) === JSON.stringify(e.placements) && p.bonus?.word === b.word, `bank #${i}: rev 3 keeps the six words and adds the bonus`);
    ok([...p.grid].every((ch, c) => ch === e.grid[c] || b.cells.includes(c)), `bank #${i}: only the bonus cells change`);
  }
  console.log(`  rev-3 bank: ${WORD_SEARCH_BANK.length} boards proved in ${Date.now() - t0} ms`);
}

/* 3. New deals carry rev 3, the bonus stays private. */
{
  const p = generatePuzzle("wordsearch") as WordSearchPuzzleData;
  ok(p.wordSearchRev === WS_DEPTH_REV && p.bonus !== undefined, "new rounds deal wordSearchRev 3 with a bonus word");
  const { pub, priv } = splitPuzzle(p);
  ok(!("bonus" in (pub as object)) && !("placements" in (pub as object)) && JSON.stringify((priv as Record<string, unknown>)["bonus"]) === JSON.stringify(p.bonus), "the bonus is private until the reveal, like the placements");
  ok(!JSON.stringify(pub).includes(`"${p.bonus!.word}"`), "the public half never names the bonus word");
}

/* 4. Scoring. */
{
  let elite = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const p = roomPuzzle("wordsearch", seed) as WordSearchPuzzleData;
    const limit = puzzleTimeLimitMs(p);
    const six = (p.placements ?? []).map((pl) => pl.cells);
    const bonus = p.bonus!.cells;
    const old = { ...p, wordSearchRev: 2, bonus: undefined } as unknown as PuzzleData;
    let prev = -1, prevB = -1;
    for (const share of [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.85, 0.9, 1]) {
      const ms = Math.round(limit * share);
      const plain = gradeAnswer(p, wsEncode(six), ms);
      const rev2 = gradeAnswer(old, wsEncode(six), ms);
      ok(plain.score === rev2.score && plain.score <= 150, `seed ${seed} ${share}: without the bonus a finish scores rev 2's ${rev2.score} (${plain.score})`);
      const withB = gradeAnswer(p, wsEncode([...six.slice(0, 3), [...bonus].reverse(), ...six.slice(3)]), ms);
      ok(withB.isCorrect && withB.score === plain.score + wsBonusPoints(true, true, share), `seed ${seed} ${share}: the bonus adds its points (${plain.score} → ${withB.score})`);
      ok(withB.score >= prevB && plain.score >= prev, `seed ${seed} ${share}: more time left never scores less`);
      ok(withB.score <= 200 && (withB.score < 200 || share >= 0.9), `seed ${seed} ${share}: 200 only with the bonus and a fast finish (${withB.score})`);
      const parts = (withB.extra as { parts?: { base: number; efficiency?: number; speed?: number } }).parts!;
      ok(parts.base + (parts.efficiency ?? 0) + (parts.speed ?? 0) === withB.score, `seed ${seed} ${share}: the parts add up to the score`);
      prev = plain.score;
      prevB = withB.score;
    }
    elite = Math.max(elite, prevB);
    // Unfinished: today's credit plus the small found bonus, still below every finish.
    const five = gradeAnswer(p, wsEncode([...six.slice(0, 5), bonus]), 0);
    const fiveOld = gradeAnswer(old, wsEncode(six.slice(0, 5)), 0);
    ok(!five.isCorrect && five.score === fiveOld.score + WS_BONUS_UNFINISHED && five.score < 120, `seed ${seed}: five words and the bonus score ${fiveOld.score} + ${WS_BONUS_UNFINISHED}, under any finish (${five.score})`);
    // A bonus drag is never a wrong pick.
    const spam = gradeAnswer(p, wsEncode([...Array.from({ length: 8 }, () => bonus), ...six.slice(0, 2)]), 0);
    ok((spam.extra as { wrong?: number }).wrong === 0, `seed ${seed}: repeated bonus drags are not wrong picks`);
    // Nothing found: as rev 2.
    ok(gradeAnswer(p, "", 0).score === gradeAnswer(old, "", 0).score, `seed ${seed}: an empty answer scores as rev 2`);
  }
  ok(elite === 200, `a fast finish with the bonus reaches 200 (${elite})`);
  ok(WS_BONUS_FOUND + WS_BONUS_SPEED === 50 && wsBonusPoints(false, true, 1) === 0, "the bonus is the whole extra 50 and needs the word");
}

/* 5. Live check. */
{
  const p = roomPuzzle("wordsearch", 3) as WordSearchPuzzleData;
  const b = p.bonus!;
  const v = checkWordSearchPath(p.placements!, p.size, b.cells, [], b);
  ok(v.valid && v.bonus === true && v.word === b.word, "a drag on the bonus answers { valid, bonus, word }");
  ok(checkWordSearchPath(p.placements!, p.size, [...b.cells].reverse(), [], b).bonus === true, "backwards too");
  ok(!checkWordSearchPath(p.placements!, p.size, b.cells, [b.word], b).valid, "found once only");
  const six = checkWordSearchPath(p.placements!, p.size, p.placements![0]!.cells, [], b);
  ok(six.valid && six.bonus === undefined && six.word === p.placements![0]!.word, "a listed word answers as before");
  const short = checkWordSearchPath(p.placements!, p.size, b.cells.slice(0, -1), [], b);
  ok(!short.valid && short.word === "", "a near miss on the bonus reveals nothing");
}

/* 6. Texts and the stage. */
{
  const intro = INTRO_SCORE.wordsearch;
  const help = PUZZLE_INSTRUCTIONS.wordsearch;
  ok(/bonus word/i.test(intro) && /\b200\b/.test(intro) && intro.length <= 90, `intro states the bonus and the maximum: "${intro}"`);
  ok(/hidden but not listed/.test(help.score) && /\b200\b/.test(help.score) && help.how.some((l) => !l.helpOnly && /theme word/.test(l.action)), "help explains the bonus word in one line");
  const html = (puzzle: PuzzleData) => renderToStaticMarkup(createElement(wordSearchPuzzle.Stage, { puzzle, locked: false, onSubmit: () => {}, stateKey: `depth-ws-${Math.random()}` } as never));
  const p3 = roomPuzzle("wordsearch", 4);
  ok(html(p3).includes('data-ws-chip="bonus"'), "a rev-3 stage draws the bonus chip from the first paint");
  ok(!html(legacyPuzzle(4)).includes('data-ws-chip="bonus"'), "a rev-2 stage draws no bonus chip");
}

/* 7. Bands. */
{
  const g = measureGame("wordsearch", 30);
  const lvl = (id: string) => g.levels.find((l) => l.id === id)!;
  const good = lvl("good");
  ok(Math.abs(good.now.median - good.old.median) <= good.old.median * 0.1, `a good player's median stays within 10 % (${good.old.median} → ${good.now.median})`);
  ok(lvl("near").now.median >= 145 && lvl("near").now.median <= 165, `near-perfect median 150–165 (${lvl("near").now.median})`);
  ok(lvl("elite").now.best >= 190 && lvl("elite").now.best <= 200, `elite best 190–200 (${lvl("elite").now.best})`);
  // 26 Oct 2026 retune: the hidden word pays a fixed 15; the rest of the top 50 only at elite pace (the stretch curve).
  ok(lvl("near").now.top10 <= 175, `near-perfect top 10 % at most 175 (${lvl("near").now.top10})`);
  ok(lvl("elite").now.top10 >= 190, `elite top 10 % 190 or more (${lvl("elite").now.top10})`);
  ok(wsBonusPoints(true, true, 0.75) === WS_BONUS_FOUND && WS_BONUS_FOUND >= 12 && WS_BONUS_FOUND <= 15, "at today's 150 pace the hidden word pays only its fixed part");
  ok(lvl("average").now.top10 <= 160, `average play stays low (${lvl("average").now.top10})`);
}

if (failures.length) {
  console.log(failures.map((f) => `  ✗ ${f}`).join("\n"));
  console.log(`FAIL depth-wordsearch-check: ${failures.length} failures, ${passes} passes`);
  process.exit(1);
}
console.log(`PASS depth-wordsearch-check: ${passes} checks — legacy Lookout rounds grade as before; the rev-3 bonus bank, privacy, scoring, live check, texts and bands hold`);
