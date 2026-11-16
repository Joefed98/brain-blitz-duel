/**
 * The Speed games' level deals (the Speed overhaul, stage 3, 15 Nov 2026; src/lib/levels/speedLevels.ts): the deal hands
 * the resolved level here (generate.server.ts), and each game's builder deals the level's settings and stamps what its
 * grader and stage need. Normal never reaches this file (the deal passes no level), so every Normal deal is today's.
 */
import type { Level } from "@/lib/levels/levels";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { AscendLevel, ChainLevel, FlashLevel } from "@/lib/levels/speedLevels";
import { generateChain } from "./chain.server";
import { buildReaction } from "@/puzzles/reaction";
import { buildNumberHunt } from "@/puzzles/numberHunt";
import type { PuzzleData, PuzzleType } from "./types";

export function dealSpeedLevel(type: PuzzleType, level: Level | undefined): PuzzleData | null {
  if (!level || level === "normal") return null;
  if (type === "reaction") {
    const settings = gameLevelSettings<FlashLevel>(type, level);
    return settings ? buildReaction(settings) : null;
  }
  if (type === "numhunt") {
    const settings = gameLevelSettings<AscendLevel>(type, level);
    return settings ? buildNumberHunt(settings) : null;
  }
  if (type === "chain") {
    const settings = gameLevelSettings<ChainLevel>(type, level);
    return settings ? generateChain(undefined, settings) : null;
  }
  return null;
}
