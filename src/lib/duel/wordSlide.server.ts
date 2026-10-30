import { commonWords, isWord } from "./dictionary.server";
import { pick, randInt, randomBelow } from "./random";
import type { WordSlidePuzzleData } from "./types";
import { dealtDepthRev } from "./wordDepth";
import { dealtTopupRev } from "./depthTopup";
import { applyShift, markedRowWord, replayWordSlide, slideSwapsOn, WORD_SLIDE_REV_PAR, WORD_SLIDE_REV_TOPUP, WS_MARKED_ROWS, WS_SIZE, type SlideShift } from "./wordSlide";

let pool: string[] | null = null;
function fiveLetterWords(): string[] {
  if (pool) return pool;
  pool = [...new Set(commonWords().filter((w) => w.length === 5 && /^[a-z]+$/.test(w) && isWord(w)))];
  return pool;
}

export function markedRowsSolved(grid: string[]): number {
  return WS_MARKED_ROWS.filter((row) => isWord(markedRowWord(grid, row))).length;
}

/** New boards carry the par-moves stamp (word depth d1); a check pinning the pre-depth stamps gets none. */
export function generateWordSlide(): WordSlidePuzzleData {
  const made = generateWordSlideBoard();
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

export function checkWordSlideRow(raw: string): { valid: boolean; points: number; word: string } {
  const word = String(raw ?? "").trim().toUpperCase();
  return { valid: word.length === WS_SIZE && isWord(word), points: 0, word };
}

/**
 * The server's replay of a stored answer: on wordSlideRev 4 the last row's swaps apply, and only while every locked
 * row is a word in the dictionary (a log that locks non-words to open swaps gets nothing from them).
 */
export function replayWordSlideFor(puzzle: Pick<WordSlidePuzzleData, "grid" | "wordSlideRev">, tokens: string[]) {
  return replayWordSlide(puzzle.grid, tokens, slideSwapsOn(puzzle) ? { swaps: true, isWord: (w) => checkWordSlideRow(w).valid } : {});
}
