import { answerWords, commonWords, isWord } from "./dictionary.server";
import { pick, randInt, randomBelow } from "./random";
import type { WordSlidePuzzleData } from "./types";
import { dealtDepthRev } from "./wordDepth";
import { dealtTopupRev } from "./depthTopup";
import { applyShift, markedRowWord, replayWordSlide, slideSwapsOn, wordSlideSize, wsRows, WORD_SLIDE_REV_PAR, WORD_SLIDE_REV_TOPUP, WS_MARKED_ROWS, WS_SIZE, type SlideShift } from "./wordSlide";

let pool: string[] | null = null;
export function fiveLetterWords(): string[] {
  if (pool) return pool;
  pool = [...new Set(commonWords().filter((w) => w.length === 5 && /^[a-z]+$/.test(w) && isWord(w)))];
  return pool;
}

const pools = new Map<number, string[]>();
/**
 * The words of `length` letters a level grid's rows are drawn from (D1, 21 Nov 2026, Joe: the common-answers list,
 * answerWords, as Strikeout, Cryptogrid and Swapword use, so no odd word reaches a row); 5 is Normal's fiveLetterWords,
 * untouched. Lower case.
 */
export function slideWords(length: number): string[] {
  if (length === WS_SIZE) return fiveLetterWords();
  const hit = pools.get(length);
  if (hit) return hit;
  const list = [...new Set(answerWords(length).map((w) => w.toLowerCase()).filter((w) => /^[a-z]+$/.test(w) && isWord(w)))];
  pools.set(length, list);
  return list;
}

const everydayPools = new Map<number, string[]>();
/**
 * Every everyday word of `length` letters (commonWords): what a player knows and reads a level grid's rows against (the
 * person-like solver's vocabulary, scripts/slider-human.ts); 5 is fiveLetterWords. Lower case.
 */
export function everydaySlideWords(length: number): string[] {
  if (length === WS_SIZE) return fiveLetterWords();
  const hit = everydayPools.get(length);
  if (hit) return hit;
  const list = [...new Set(commonWords().filter((w) => w.length === length && /^[a-z]+$/.test(w) && isWord(w)))];
  everydayPools.set(length, list);
  return list;
}

export function markedRowsSolved(grid: string[], size: number = WS_SIZE): number {
  return (size === WS_SIZE ? WS_MARKED_ROWS : wsRows(size)).filter((row) => isWord(markedRowWord(grid, row, size))).length;
}

/** New boards carry the par-moves stamp (word depth d1); a check pinning the pre-depth stamps gets none. */
export function generateWordSlide(): WordSlidePuzzleData {
  return stampWordSlideRev(generateWordSlideBoard());
}

/** The stamp a new board is generated on before the deal's layers (the levels build on the same one). */
export function stampWordSlideRev(made: WordSlidePuzzleData): WordSlidePuzzleData {
  const rev = dealtDepthRev<number | null>(dealtTopupRev(WORD_SLIDE_REV_TOPUP, WORD_SLIDE_REV_PAR), null);
  return rev === null ? made : { ...made, wordSlideRev: rev };
}

function generateWordSlideBoard(): WordSlidePuzzleData {
  const words = fiveLetterWords();
  for (let attempt = 0; attempt < 200; attempt++) {
    const chosen = Array.from({ length: WS_SIZE }, () => pick(words).toUpperCase());
    if (new Set(chosen).size < WS_SIZE) continue;
    const grid = [...chosen.join("")];
    const count = randInt(5, 8);
    let current = grid;
    let previous: SlideShift | null = null;
    for (let n = 0; n < count; n++) {
      let shift: SlideShift;
      do {
        shift = { axis: randomBelow(2) ? "r" : "c", index: randomBelow(WS_SIZE), dir: randomBelow(2) ? 1 : -1 };
      } while (
        previous &&
        previous.axis === shift.axis &&
        previous.index === shift.index &&
        previous.dir === -shift.dir
      );
      current = applyShift(current, shift);
      previous = shift;
    }
    // Never deal a row that is already a word (13 Oct 2026, with puzzleScoreRev 1): doing nothing must score 0.
    // A board with no word row draws exactly as before, so the fixed intro example is unchanged.
    if (markedRowsSolved(current) > 0) continue;
    return { type: "wordslide", grid: current, par: count, words: chosen };
  }
  const fallbackWords = ["HOUSE", "WATER", "STONE", "PLANT", "LIGHT"];
  const base = [...fallbackWords.join("")];
  const shifts: SlideShift[] = [
    { axis: "r", index: 0, dir: 1 },
    { axis: "c", index: 2, dir: 1 },
    { axis: "r", index: 4, dir: -1 },
    { axis: "c", index: 0, dir: -1 },
    { axis: "r", index: 2, dir: 1 },
    { axis: "c", index: 4, dir: 1 },
  ];
  return {
    type: "wordslide",
    grid: shifts.reduce((g, s) => applyShift(g, s), base),
    par: shifts.length,
    words: fallbackWords,
  };
}

export function checkWordSlideRow(raw: string, size: number = WS_SIZE): { valid: boolean; points: number; word: string } {
  const word = String(raw ?? "").trim().toUpperCase();
  return { valid: word.length === size && isWord(word), points: 0, word };
}

/**
 * The server's replay of a stored answer: on wordSlideRev 4 the last row's swaps apply, and only while every locked
 * row is a word in the dictionary (a log that locks non-words to open swaps gets nothing from them).
 */
export function replayWordSlideFor(puzzle: Pick<WordSlidePuzzleData, "grid" | "wordSlideRev" | "size">, tokens: string[]) {
  const size = wordSlideSize(puzzle);
  // wordSlideRev 7 (D1, level deals): the stored size; Normal and every older round replay on 5 × 5 exactly as before.
  if (size !== WS_SIZE) return replayWordSlide(puzzle.grid, tokens, { size, ...(slideSwapsOn(puzzle) ? { swaps: true, isWord: (w: string) => checkWordSlideRow(w, size).valid } : {}) });
  return replayWordSlide(puzzle.grid, tokens, slideSwapsOn(puzzle) ? { swaps: true, isWord: (w) => checkWordSlideRow(w).valid } : {});
}
