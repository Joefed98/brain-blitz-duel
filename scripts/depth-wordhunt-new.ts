/**
 * depth-wordhunt-check, part 2: wordHuntRev 3 (the 6×6 board, long words and the golden tile). Imported by
 * scripts/depth-wordhunt-check.ts.
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { storedScoreParts } from "../src/lib/duel/puzzleScoreRev";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { WORDHUNT_COLS, wordHuntCols, type WordHuntPuzzleData } from "../src/lib/duel/types";
import { pinPreDepth } from "../src/lib/duel/wordDepth";
import { scoreWordHuntDepth, wordHuntValue, WORDHUNT_REV_DEPTH } from "../src/lib/duel/wordHunt";
import { isWordHuntMiss, wordFromPath, WORDHUNT_DEPTH_MIN_WORDS } from "../src/lib/duel/wordHunt.server";
import { WORDHUNT_MISS_MARK } from "../src/lib/duel/scoring";
import { hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { ELITE, playScore } from "./depth-word-bands";

type Ok = (cond: boolean, message: string) => void;

const enc = (words: { word: string; path: number[] }[]) => words.map((w) => `${w.word}:${w.path.join("-")}`).join(",");

export function newStampChecks(ok: Ok): void {
  // Deals: rev 3 boards are 6×6 with a public golden tile; a pinned deal is today's 5×5.
  const boards: WordHuntPuzzleData[] = [];
  for (let s = 1; s <= 12; s++) {
    const p = roomPuzzle("wordhunt", 4400 + s) as WordHuntPuzzleData;
    boards.push(p);
    ok(p.wordHuntRev === WORDHUNT_REV_DEPTH && p.grid.length === 36 && wordHuntCols(p.grid) === 6, `seed ${s}: new rounds deal the 6×6 board on wordHuntRev 3`);
    ok(typeof p.golden === "number" && p.golden >= 0 && p.golden < 36 && p.grid[p.golden] !== "QU", `seed ${s}: a golden tile (not Qu) is stored`);
    ok((p.words ?? []).length >= WORDHUNT_DEPTH_MIN_WORDS || s > 10, `seed ${s}: the board holds ${p.words?.length} words`);
    ok((p.words ?? []).filter((w) => w.path.includes(p.golden!)).length >= 20, `seed ${s}: the golden tile sits on plenty of words`);
    ok(puzzleTimeLimitMs(p) === 100_000, `seed ${s}: the round's clock is unchanged (100 s)`);
  }
  pinPreDepth(true);
  try {
    const old = roomPuzzle("wordhunt", 4401) as WordHuntPuzzleData;
    ok(old.grid.length === 25 && old.wordHuntRev === 2 && old.golden === undefined, "a pinned deal is today's 5×5 wordHuntRev 2 board");
  } finally {
    pinPreDepth(false);
  }

  // Adjacency: 5 columns for every older board, 6 for the depth board.
  const five = "ABCDEFGHIJKLMNOPQRSTUVWXY".split("");
  ok(wordHuntCols(five) === WORDHUNT_COLS && wordFromPath(five, [4, 5]) === null && wordFromPath(five, [0, 5]) === "AF", "5×5 boards keep 5-column adjacency");
  const six = "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJ".split("");
  ok(wordFromPath(six, [5, 6]) === null && wordFromPath(six, [0, 6]) === "AG" && wordFromPath(six, [35, 28]) === "JC", "6×6 boards use 6-column adjacency");

  // Word values.
  const v = (word: string, gold: boolean) => wordHuntValue(word, gold ? [0, 1] : [2, 3], 0);
  ok(v("PANE", false).value === 1 && v("PLANE", false).value === 2 && v("PLANET", false).value === 6 && v("PLANETS", false).value === 14 && v("PLANETARY", false).value === 22, "long words: 6 letters ×1.5, 7+ ×2");
  ok(v("PANE", true).value === 2 && v("PLANETS", true).value === 28 && v("PANE", true).gold && !v("PANE", false).gold, "the golden tile doubles a word traced through it");
  ok(scoreWordHuntDepth(1000, 0).score === 150 && scoreWordHuntDepth(1000, 0).bonusPart === 0, "base points alone stop at 150");
  ok(scoreWordHuntDepth(1000, 1000).score === roundMaxFor("wordhunt") && roundMaxFor("wordhunt") === 200, "base and feature points together reach the 200 maximum");
  ok(scoreWordHuntDepth(0, 1000).score === 50, "feature points alone add at most 50");

  // Grading on real boards.
  const kit = KITS.wordhunt!;
  let eliteBest = 0;
  for (const [i, p] of boards.entries()) {
    const words = p.words ?? [];
    // Every 4–5 letter word, none through the golden tile: base points only, never above 150.
    const plain = words.filter((w) => w.word.length <= 5 && !w.path.includes(p.golden!));
    const gPlain = gradeAnswer(p, enc(plain), 0);
    ok(gPlain.score <= 150 && Number(gPlain.extra?.["extraPoints"]) === 0, `board ${i}: base words alone score ${gPlain.score} (≤ 150, no extras)`);
    // Every word on its golden path: features push it past 150.
    const all = gradeAnswer(p, enc(words), 0);
    ok(all.score > 150 && all.score <= 200, `board ${i}: every word, through gold where it can, scores ${all.score} (151–200)`);
    const parts = storedScoreParts(all.extra);
    ok(parts !== null && parts.kind === "partial" && parts.base === all.score, `board ${i}: the stored breakdown adds up to the score`);
    // A gold path beats the same word avoiding gold.
    const gw = words.find((w) => w.path.includes(p.golden!) && w.word.length === 4);
    if (gw) {
      const gGold = gradeAnswer(p, enc([gw]), 0);
      ok(Number(gGold.extra?.["extraPoints"]) === 1 && (gGold.extra?.["goldWords"] as string[]).includes(gw.word), `board ${i}: a 4-letter word through gold adds 1 extra`);
    }
    // More words never score less (prefixes of the elite kit's run).
    const play = kit.play(p, makeRng(hashText(`dwn:${i}`)), ELITE, 100_000);
    let prev = -1;
    let mono = true;
    for (const st of play.steps.filter((x) => x.atMs <= 100_000)) {
      const sc = gradeAnswer(p, st.answer, 0).score;
      if (sc < prev) mono = false;
      prev = sc;
      if (sc < 0 || sc > 200) mono = false;
    }
    ok(mono, `board ${i}: more words never score less, scores stay 0–200`);
    // Misses still cut.
    const few = plain.slice(0, 6);
    const missPath = [[0, 1, 2, 3], [0, 6, 12, 18], [5, 4, 3, 2], [30, 31, 32, 33], [35, 29, 23, 17]].find((m) => isWordHuntMiss(p.grid, m));
    if (missPath) {
      const miss = Array.from({ length: 60 }, () => `${WORDHUNT_MISS_MARK}${missPath.join("-")}`).join(",");
      const gFew = gradeAnswer(p, enc(few), 0);
      const missed = gradeAnswer(p, `${enc(few)},${miss}`, 0);
      ok(missed.score < gFew.score, `board ${i}: misses still cut the score (${gFew.score} → ${missed.score})`);
    }
    // Nothing and spam stay near 0.
    ok(gradeAnswer(p, "", 0).score === 0, `board ${i}: nothing scores 0`);
    for (const sp of kit.spam(p, makeRng(hashText(`dwn:spam:${i}`)), 100_000)) ok(gradeAnswer(p, sp.answer, 0).score <= 25, `board ${i}: spam ${sp.label} stays low`);
    eliteBest = Math.max(eliteBest, playScore("wordhunt", p, 4400 + i, "elite", ELITE));
  }
  ok(eliteBest >= 190 && eliteBest <= 200, `the elite kit player's best is ${eliteBest} (190–200)`);

  // Texts.
  const help = PUZZLE_INSTRUCTIONS.wordhunt;
  // The text pass (F2, 4 Nov 2026) says "×1.5" in words: "extra for 6-letter words, double for 7 or more, double again through
  // the gold tile", then "Total 200."
  ok(
    /extra for 6-letter words/.test(help.score) && /double for 7 or more/.test(help.score) && /gold tile/.test(help.score) && /Total 200\./.test(help.score),
    "the help states the long words, the gold tile and the 200 maximum",
  );
  ok(help.how.some((l) => !l.helpOnly && /gold tile/.test(`${l.action} ${l.detail}`)), "the intro's how lines name the features in one line");
  ok(/gold tile/.test(INTRO_SCORE.wordhunt) && /\b200\b/.test(INTRO_SCORE.wordhunt), "the intro score line names the gold tile and the maximum");
}
