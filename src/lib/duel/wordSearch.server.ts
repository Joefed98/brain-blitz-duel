import { WORD_SEARCH_BANK } from "./wordSearchBank.server";
import { WS_SIZE, WS_WORDS } from "./wordSearch";
import type { WordSearchPuzzleData } from "./types";

/** Draws one pre-checked grid from the bank (built by scripts/word-search-bank.ts). */
export function generateWordSearch(): WordSearchPuzzleData {
  const entry = WORD_SEARCH_BANK[Math.floor(Math.random() * WORD_SEARCH_BANK.length)]!;
  return {
    type: "wordsearch",
    size: WS_SIZE,
    grid: entry.grid,
    category: entry.category,
    wordCount: WS_WORDS,
    placements: entry.placements.map((p) => ({ word: p.word, cells: [...p.cells] })),
  };
}
