/**
 * The Word overhaul's deal (wordOverhaul.ts), server only: each game's new stamp and what that stamp changes in the
 * deal. Runs as the last DEAL_LAYERS layer (generate.server.ts); with the era pinned (`preWordOverhaul`) or on any other
 * stamp, the puzzle passes through untouched.
 */
import { isEverydayWord } from "./dictionary.server";
import { LETTER_WHEEL_BANK_REV5 } from "./letterWheelBankRev5.server";
import { lwBonusDropsAvailable } from "./letterWheel.server";
import { lwJarSize } from "./letterWheel";
import { rngBelow, seededRng } from "./wordSeed.server";
import { wordSlideDistance } from "./wordSlideDistance.server";
import { overhaulStamp } from "./wordOverhaul";
import type { LetterWheelPuzzleData, PuzzleData, WordSlidePuzzleData, WordsmithPuzzleData } from "./types";

/** A small stable hash of a string (FNV-1a, 32 bits): Roundabout's rev-5 draw from the rev-4 board the seed dealt. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Nucleus rev 5: the count and the missed list are the everyday words; par and the board unchanged. */
export function everydayWordsmith(puzzle: WordsmithPuzzleData): WordsmithPuzzleData {
  const words = (puzzle.words ?? []).filter((entry) => isEverydayWord(entry.word));
  return { ...puzzle, words, wordCount: words.length };
}

/** Slider rev 6: par is the proven fewest shifts to the dealt words (never above the scramble length). */
export function provenSliderPar(puzzle: WordSlidePuzzleData): WordSlidePuzzleData {
  const goal = [...(puzzle.words ?? []).join("")];
  const d = wordSlideDistance(puzzle.grid, goal, Math.max(0, puzzle.par));
  return d === null || d < 1 ? puzzle : { ...puzzle, par: d };
}

/** Roundabout rev 5: a board from the rev-5 bank, drawn by a hash of the board the room seed dealt (so the same in a room). */
export function commonWheel(puzzle: LetterWheelPuzzleData): LetterWheelPuzzleData {
  const key = `${puzzle.letters}|${puzzle.cols}x${puzzle.rows}|${(puzzle.words ?? []).join(",")}`;
  const e = LETTER_WHEEL_BANK_REV5[rngBelow(seededRng(hash32(key)), LETTER_WHEEL_BANK_REV5.length)]!;
  return {
    ...puzzle,
    cols: e.cols,
    rows: e.rows,
    letters: e.letters,
    slots: e.slots.map((s) => ({ ...s })),
    words: [...e.words],
    jarSize: lwJarSize(lwBonusDropsAvailable(e.letters, e.words)),
  };
}

/** The layer: the stamp, then the content its rules change. */
export function dealWordOverhaul<T extends PuzzleData>(puzzle: T): T {
  const stamped = overhaulStamp(puzzle);
  if (stamped === puzzle) return puzzle;
  switch (stamped.type) {
    case "wordsmith":
      return everydayWordsmith(stamped) as T;
    case "wordslide":
      return provenSliderPar(stamped) as T;
    case "letterwheel":
      return commonWheel(stamped) as T;
    default:
      return stamped;
  }
}
