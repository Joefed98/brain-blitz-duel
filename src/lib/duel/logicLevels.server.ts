/** The level settings a Logic overhaul 2 generator deals at (logicLevels.ts). Server only. */
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import { NORMAL, type Level } from "@/lib/levels/levels";
import type { LogicLevelGame, LogicLevelSettings } from "./logicLevels";

/** The settings for `level`, or null at Normal (today's game, dealt exactly as before levels). */
export function logicLevel<K extends LogicLevelGame>(type: K, level: Level | undefined): LogicLevelSettings[K] | null {
  if (!level || level === NORMAL) return null;
  return gameLevelSettings<LogicLevelSettings[K]>(type, level);
}
