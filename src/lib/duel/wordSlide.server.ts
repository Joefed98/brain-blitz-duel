import { commonWords, isWord } from "./dictionary.server";
import { pick, randInt, randomBelow } from "./random";
import type { WordSlidePuzzleData } from "./types";
import { applyShift, markedRowWord, WS_MARKED_ROWS, WS_SIZE, type SlideShift } from "./wordSlide";

let pool: string[] | null = null;
function fiveLetterWords(): string[] {
  if (pool) return pool;
  pool = [...new Set(commonWords().filter((w) => w.length === 5 && /^[a-z]+$/.test(w) && isWord(w)))];
  return pool;
}

const FILLER = "AAABCDEEEEFGHIIILMNNOOOPRRSSTTTUWY";

export function markedRowsSolved(grid: string[]): number {
  return WS_MARKED_ROWS.filter((row) => isWord(markedRowWord(grid, row))).length;
}

export function generateWordSlide(): WordSlidePuzzleData {
  const words = fiveLetterWords();
  for (let attempt = 0; attempt < 200; attempt++) {
    const chosen = [pick(words), pick(words), pick(words)].map((w) => w.toUpperCase());
    if (new Set(chosen).size < 3) continue;
    const grid: string[] = [];
    for (let row = 0; row < WS_SIZE; row++) {
      const marked = WS_MARKED_ROWS.indexOf(row as 0 | 2 | 4);
      for (let col = 0; col < WS_SIZE; col++) {
        grid.push(marked >= 0 ? chosen[marked]![col]! : FILLER[randomBelow(FILLER.length)]!);
      }
    }
    const count = randInt(6, 10);
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
    if (markedRowsSolved(current) === WS_MARKED_ROWS.length) continue;
    return { type: "wordslide", grid: current, par: count, words: chosen };
  }
  const base = [..."HOUSEATRENSTONEPILAGLIGHT"];
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
    grid: shifts.reduce(applyShift, base),
    par: shifts.length,
    words: ["HOUSE", "STONE", "LIGHT"],
  };
}

export function checkWordSlideRow(raw: string): { valid: boolean; points: number; word: string } {
  const word = String(raw ?? "").trim().toUpperCase();
  return { valid: word.length === WS_SIZE && isWord(word), points: 0, word };
}
