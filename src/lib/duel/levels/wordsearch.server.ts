import type { GenerateContext } from "../generate.server";
import type { PuzzleData, WordSearchPuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { WORDSEARCH_LEVEL_SETTINGS } from "@/lib/levels/word/wordsearch";

import { WS_DEPTH_REV, WS_REV } from "../wordSearch";
import { WORD_SEARCH_LEVEL_BANK, type WordSearchLevelEntry } from "../wordSearchLevelBank.server";
import { dealtDepthRev } from "../wordDepth";

/** The puzzle a level bank entry deals (the same base revision Normal's deal starts from; the deal's layers stamp it on). */
export function lookoutLevelPuzzle(level: Exclude<Level, "normal">, entry: WordSearchLevelEntry): WordSearchPuzzleData {
  const s = WORDSEARCH_LEVEL_SETTINGS[level];
  return {
    type: "wordsearch",
    size: s.cols,
    rows: s.rows,
    grid: entry.grid,
    category: entry.category,
    wordCount: entry.placements.length,
    wordSearchRev: dealtDepthRev(WS_DEPTH_REV, WS_REV),
    wordLengths: entry.placements.map((p) => p.word.length),
    placements: entry.placements.map((p) => ({ word: p.word, cells: [...p.cells] })),
    bonus: { word: entry.bonus.word, cells: [...entry.bonus.cells] },
    timeLimitMs: s.timeLimitMs,
    ...(typeof s.speedFullByS === "number" ? { speedFullByS: s.speedFullByS } : {}),
  };
}

/**
 * Lookout dealt at a level beyond Normal (the Word overhaul, stage 3; settings in src/lib/levels/word/wordsearch.ts): one
 * board of the level's bank (scripts/word-search-level-bank.ts), drawn as Normal's is (the deal's seeded Math.random, so a
 * room's board is the same for every player). Never called at Normal, so Normal is exactly today's deal.
 */
export function dealLookoutLevel(level: Exclude<Level, "normal">, _context: GenerateContext): PuzzleData | null {
  const bank = WORD_SEARCH_LEVEL_BANK[level];
  return lookoutLevelPuzzle(level, bank[Math.floor(Math.random() * bank.length)]!);
}
