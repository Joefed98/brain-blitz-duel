/**
 * The Speed games' level deals (the Speed overhaul, stage 3, 15 Nov 2026; src/lib/levels/speedLevels.ts): the deal hands
 * the resolved level here (generate.server.ts), and each game's builder deals the level's settings and stamps what its
 * grader and stage need. Normal never reaches this file (the deal passes no level), so every Normal deal is today's.
 */
import type { Level } from "@/lib/levels/levels";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import { pullLevelClays, type AscendLevel, type BonkLevel, type ChainLevel, type FlashLevel, type PullLevel, type TenfallLevel } from "@/lib/levels/speedLevels";
import { tdLevelStages } from "@/lib/arcade/tenDrop";
import { generateClayShoot, generateTenDrop, generateWhack } from "./arcade.server";
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
  if (type === "whack") {
    const settings = gameLevelSettings<BonkLevel>(type, level);
    return settings ? { ...generateWhack(), bonkLevel: { ...settings, flips: [settings.flips[0], settings.flips[1]] } } : null;
  }
  if (type === "tendrop") {
    const settings = gameLevelSettings<TenfallLevel>(type, level);
    return settings ? { ...generateTenDrop(), tenLevel: { stages: tdLevelStages(settings) } } : null;
  }
  if (type === "clayshoot") {
    const settings = gameLevelSettings<PullLevel>(type, level);
    return settings ? { ...generateClayShoot(), pullLevel: pullLevelClays(settings) } : null;
  }
  return null;
}
