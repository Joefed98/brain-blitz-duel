/**
 * The Logic overhaul's level deals that need more than a generator call (session 1, 15 Nov 2026; logicLevels.ts).
 * Server-only.
 *
 *  - Colour Flood's Hard and Expert boards come from the bank scripts/flood-level-bank.ts builds
 *    (floodLevelBank.server.json; each board's par proved exact by search and re-proved by logic-1-levels-check),
 *    picked by the room seed (salted by the game and level), so every phone in a room gets the same board; Easy's are
 *    built live (a few milliseconds).
 *  - Polypotions' levels are built live (the A* proof takes well under a tenth of a second).
 */
import type { Level } from "@/lib/levels/levels";

import bank from "./floodLevelBank.server.json";
import { generateFloodLevel } from "./floodLevels.server";
import type { FloodLevel, TubesLevel } from "./logicLevels";
import { randomBelow } from "./random";
import { saltSeed } from "./seededRng";
import { generateTubesLevel } from "./tubes.server";
import type { FloodPuzzleData, TubesPuzzleData } from "./types";

export const FLOOD_LEVEL_BANK = bank as unknown as { hard: FloodPuzzleData[]; expert: FloodPuzzleData[] };

export function dealFloodLevel(lv: FloodLevel, level: Level, bankSeed: number | undefined): FloodPuzzleData {
  const pool = level === "hard" ? FLOOD_LEVEL_BANK.hard : level === "expert" ? FLOOD_LEVEL_BANK.expert : null;
  if (!pool) return generateFloodLevel(lv);
  if (!pool.length) throw new Error(`Colour Flood ${level} bank is empty (bun scripts/flood-level-bank.ts)`);
  const index = bankSeed === undefined ? randomBelow(pool.length) : saltSeed(bankSeed, `flood:${level}`) % pool.length;
  const board = pool[Math.abs(index)]!;
  return { ...board, grid: [...board.grid], solution: [...(board.solution ?? [])], timeLimitMs: lv.timeMs };
}

export function dealTubesLevel(lv: TubesLevel, _level: Level, _bankSeed: number | undefined): TubesPuzzleData {
  return generateTubesLevel(lv);
}
