/**
 * depth-wordsmith-check, part 2: Nucleus wordsmithRev 3 (imported by scripts/depth-wordsmith-check.ts).
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import {
  scoreWordsmith,
  WORDSMITH_REV_DEPTH,
  WORDSMITH_REV_TARGET,
  WORDSMITH_V2_CURVE,
  WORDSMITH_V3_CAP,
  WORDSMITH_V3_PANGRAM_BONUS,
  wordsmithV3Words,
} from "../src/lib/duel/scoring";
import { bandOpen } from "../src/lib/arcade/scoreBands";
import { pinPreDepth } from "../src/lib/duel/wordDepth";
import { storedScoreParts } from "../src/lib/duel/puzzleScoreRev";
import type { WordsmithPuzzleData } from "../src/lib/duel/types";
import { roomPuzzle } from "./puzzle-fairness/run";
import { measureGame } from "./depth-word-bands";

type Ok = (cond: boolean, message: string) => void;

export function checkNew(ok: Ok): void {
  ok(roundMaxFor("wordsmith") === 200, "Nucleus's round maximum is 200");
  const p = roomPuzzle("wordsmith", 4300) as WordsmithPuzzleData;
  ok(p.wordsmithRev === WORDSMITH_REV_DEPTH, `rooms deal wordsmithRev 3 (${p.wordsmithRev})`);
  pinPreDepth(true);
  try {
    ok((roomPuzzle("wordsmith", 4300) as WordsmithPuzzleData).wordsmithRev === WORDSMITH_REV_TARGET, "pinPreDepth deals wordsmithRev 2");
  } finally {
    pinPreDepth(false);
  }

  // The curve: rev 2's below 45 points, never falling, at most the cap; the pangram adds the bonus; 0–200.
  let prev = -1;
  for (let x = 0; x <= 400; x++) {
    const w = wordsmithV3Words(x);
    ok(w >= prev, `the word curve never falls (${x} points)`);
    prev = w;
    ok(w <= WORDSMITH_V3_CAP, `${x} points: at most ${WORDSMITH_V3_CAP} without the pangram`);
    if (x <= 45) ok(w === Math.min(150, bandOpen(WORDSMITH_V2_CURVE, x)), `${x} points: rev 2's score (${w})`);
    const all = scoreWordsmith(x, WORDSMITH_REV_DEPTH, true);
    ok(all === w + WORDSMITH_V3_PANGRAM_BONUS && all <= 200 && all >= 0, `${x} points with the pangram: +${WORDSMITH_V3_PANGRAM_BONUS}`);
    ok(scoreWordsmith(x, WORDSMITH_REV_DEPTH, false) < 190, `${x} points: 190+ needs the pangram`);
  }
  ok(scoreWordsmith(60, WORDSMITH_REV_DEPTH, true) >= 150 && scoreWordsmith(60, WORDSMITH_REV_DEPTH, true) <= 165, "today's 150 (60 points and the pangram) scores 150–165");
  ok(scoreWordsmith(150, WORDSMITH_REV_DEPTH, true) === 200, "200 at 150 points with the pangram");

  // Graded boards: the stored score and its parts, the pangram's bonus, the server's own figures.
  for (let s = 0; s < 12; s++) {
    const board = roomPuzzle("wordsmith", 4400 + s) as WordsmithPuzzleData;
    const words = (board.words ?? []).map((w) => w.word);
    const pangram = words.find((w) => w.length >= board.letters.length);
    ok(Boolean(pangram), `board ${s}: a word uses every tile`);
    const without = words.filter((w) => w.length < board.letters.length);
    const a = gradeAnswer(board, without.join(","), 0);
    const b = gradeAnswer(board, words.join(","), 0);
    ok(a.score <= WORDSMITH_V3_CAP && a.extra?.["pangramBonus"] === 0, `board ${s}: without the pangram at most ${WORDSMITH_V3_CAP} (${a.score})`);
    ok(b.score === Math.min(200, (b.extra?.["wordScore"] as number) + WORDSMITH_V3_PANGRAM_BONUS) && b.extra?.["pangramBonus"] === WORDSMITH_V3_PANGRAM_BONUS, `board ${s}: the pangram adds its bonus (${b.score})`);
    for (const g of [a, b]) ok(storedScoreParts(g.extra)?.base === g.score, `board ${s}: the stored breakdown is the score`);
    ok(gradeAnswer(board, "", 0).score === 0, `board ${s}: nothing scores 0`);
    const forged = gradeAnswer(board, "QQQQ,ZZZZZZZZZ", 0);
    ok(forged.score === 0, `board ${s}: non-words score nothing`);
  }

  // Bands: elite reaches 190–200, a solid (good) player within 10 % of before.
  const g = measureGame("wordsmith", 30);
  const lvl = (id: string) => g.levels.find((l) => l.id === id)!;
  ok(lvl("elite").now.best >= 190 && lvl("elite").now.best <= 200, `elite best 190–200 (${lvl("elite").now.best})`);
  ok(Math.abs(lvl("good").now.median - lvl("good").old.median) <= 0.1 * lvl("good").old.median, `good median within 10 % (${lvl("good").old.median} → ${lvl("good").now.median})`);
  ok(lvl("near").now.median >= 145 && lvl("near").now.median <= 170, `near-perfect median about 150–165 (${lvl("near").now.median})`);

  // Texts.
  const help = PUZZLE_INSTRUCTIONS.wordsmith.score;
  // The text pass (F2, 4 Nov 2026) calls the pangram the every-tile word: "Every-tile word: find the word that uses every tile …, 20."
  ok(/Every-tile word: [^.]*every tile[^.]*, (\d+)\./.exec(help)?.[1] === String(WORDSMITH_V3_PANGRAM_BONUS) && /Total 200\./.test(help), `help states the pangram bonus and 200: "${help}"`);
  ok(/every tile/.test(INTRO_SCORE.wordsmith) && /\b200\b/.test(INTRO_SCORE.wordsmith), `intro states the bonus and 200: "${INTRO_SCORE.wordsmith}"`);
}
