import type { GenerateContext } from "../generate.server";
import type { PuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { WordHuntLevelSettings } from "@/lib/levels/word/wordhunt";
import { generateWordHuntDepthBand } from "../wordHunt.server";

/**
 * Forage dealt at a level beyond Normal (the Word overhaul, stage 3; settings in src/lib/levels/word/wordhunt.ts): a 6×6
 * board built as Normal's is, kept only inside the level's band of everyday words (richer on Easy, sparser on Hard and
 * Expert), on the level's clock. Never called at Normal, so Normal is exactly today's deal.
 */
export function dealForageLevel(level: Exclude<Level, "normal">, _context: GenerateContext): PuzzleData | null {
  const settings = gameLevelSettings<WordHuntLevelSettings>("wordhunt", level);
  if (!settings) return null;
  return { ...generateWordHuntDepthBand(settings.words.min, settings.words.max, settings.seeds), timeLimitMs: settings.timeLimitMs };
}
