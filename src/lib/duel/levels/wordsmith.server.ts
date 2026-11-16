import type { GenerateContext } from "../generate.server";
import type { PuzzleData, WordsmithPuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { WordsmithLevelSettings } from "@/lib/levels/word/wordsmith";
import { dealtTopupRev } from "../depthTopup";
import { isEverydayWord } from "../dictionary.server";
import { pick } from "../random";
import { WORDSMITH_REV_DEPTH, WORDSMITH_REV_TARGET, WORDSMITH_REV_TOPUP } from "../scoring";
import { dealtDepthRev } from "../wordDepth";
import { generateWordsmithBand } from "../wordsmith.server";

/** The everyday words a board allows (the ones it counts and lists from wordsmithRev 5). */
export function wordsmithEverydayCount(puzzle: WordsmithPuzzleData): number {
  return (puzzle.words ?? []).filter((entry) => isEverydayWord(entry.word)).length;
}

/**
 * Nucleus dealt at a level beyond Normal (the Word overhaul, stage 3; settings in src/lib/levels/word/wordsmith.ts): a
 * board of one of the level's sizes whose centre allows the level's band of everyday words (richer on Easy, sparser on
 * Hard and Expert), on the level's clock, stamped as Normal's deal is (the deal's layers then move it to today's stamp
 * and keep the everyday words). Never called at Normal, so Normal is exactly today's deal.
 */
export function dealNucleusLevel(level: Exclude<Level, "normal">, _context: GenerateContext): PuzzleData | null {
  const settings = gameLevelSettings<WordsmithLevelSettings>("wordsmith", level);
  if (!settings) return null;
  const want = settings.everyday;
  let best: WordsmithPuzzleData | null = null;
  let bestGap = Infinity;
  for (let attempt = 0; attempt < 400; attempt++) {
    const made = generateWordsmithBand(pick(settings.sizes), settings.words);
    const n = wordsmithEverydayCount(made);
    const gap = n < want.min ? want.min - n : n > want.max ? n - want.max : 0;
    if (gap < bestGap) {
      best = made;
      bestGap = gap;
    }
    if (gap === 0) break;
  }
  return {
    ...best!,
    wordsmithRev: dealtDepthRev(dealtTopupRev(WORDSMITH_REV_TOPUP, WORDSMITH_REV_DEPTH), WORDSMITH_REV_TARGET),
    timeLimitMs: settings.timeLimitMs,
  };
}
