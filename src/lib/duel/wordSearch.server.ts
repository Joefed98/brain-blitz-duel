import { WORD_SEARCH_BANK } from "./wordSearchBank.server";
import { WS_REV, WS_SIZE, WS_WORDS } from "./wordSearch";
import type { WordSearchPuzzleData } from "./types";

/**
 * Draws one pre-checked grid from the bank (built by scripts/word-search-bank.ts).
 * Rev 1 (14 Oct 2026): the 76-theme bank, plus each word's letter count as public data
 * for the chips. Stored rounds keep their own grid and placements; grading never reads the bank.
 */
export function generateWordSearch(): WordSearchPuzzleData {
  const entry = WORD_SEARCH_BANK[Math.floor(Math.random() * WORD_SEARCH_BANK.length)]!;
  return {
    type: "wordsearch",
    size: WS_SIZE,
    grid: entry.grid,
    category: entry.category,
    wordCount: WS_WORDS,
    wordSearchRev: WS_REV,
    wordLengths: entry.placements.map((p) => p.word.length),
    placements: entry.placements.map((p) => ({ word: p.word, cells: [...p.cells] })),
  };
}
