import { WORD_SEARCH_BANK, type WordSearchBankEntry } from "./wordSearchBank.server";
import { WORD_SEARCH_REV2_REPLACEMENTS } from "./wordSearchBankRev2.server";
import { WORD_SEARCH_REV3_BONUS } from "./wordSearchBankRev3.server";
import { WS_DEPTH_REV, WS_REV, WS_SIZE, WS_WORDS } from "./wordSearch";
import { dealtDepthRev } from "./wordDepth";
import type { WordSearchPuzzleData } from "./types";

/**
 * The grid a bank index deals under a revision: rev 2 swaps in the seeded replacement for a grid that
 * hides a word that is or contains its theme's name (wsThemeClash); rev 1 deals the bank grid.
 */
export function wordSearchEntry(index: number, rev: number = WS_REV): WordSearchBankEntry {
  return (rev >= 2 ? WORD_SEARCH_REV2_REPLACEMENTS[index] : undefined) ?? WORD_SEARCH_BANK[index]!;
}

/** The puzzle for a bank index under a revision (rev 3: the rev-2 grid with its bonus word written in). */
export function wordSearchFromIndex(index: number, rev: number = WS_REV): WordSearchPuzzleData {
  const entry = wordSearchEntry(index, rev);
  const bonus = rev >= WS_DEPTH_REV ? WORD_SEARCH_REV3_BONUS[index] : undefined;
  let grid = entry.grid;
  if (bonus) {
    const g = grid.split("");
    bonus.cells.forEach((cell, i) => (g[cell] = bonus.word[i]!));
    grid = g.join("");
  }
  return {
    type: "wordsearch",
    size: WS_SIZE,
    grid,
    category: entry.category,
    wordCount: WS_WORDS,
    wordSearchRev: rev,
    wordLengths: entry.placements.map((p) => p.word.length),
    placements: entry.placements.map((p) => ({ word: p.word, cells: [...p.cells] })),
    ...(bonus ? { bonus: { word: bonus.word, cells: [...bonus.cells] } } : {}),
  };
}

/**
 * Draws one pre-checked grid from the bank (built by scripts/word-search-bank.ts).
 * Rev 1 (14 Oct 2026): the 76-theme bank, plus each word's letter count as public data
 * for the chips. Rev 2 (19 Oct 2026): no hidden word is or contains its theme's name.
 * Rev 3 (25 Oct 2026, word depth): the rev-2 grid plus a hidden bonus word (dealtDepthRev: checks may pin rev 2).
 * Stored rounds keep their own grid and placements; grading never reads the bank.
 */
export function generateWordSearch(): WordSearchPuzzleData {
  return wordSearchFromIndex(Math.floor(Math.random() * WORD_SEARCH_BANK.length), dealtDepthRev(WS_DEPTH_REV, WS_REV));
}
