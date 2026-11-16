/**
 * The Logic overhaul's level deals that need more than a generator call (session 1, 15 Nov 2026; logicLevels.ts).
 * Server-only.
 *
 *  - Colour Flood's Hard and Expert boards come from the bank scripts/flood-level-bank.ts builds
 *    (floodLevelBank.server.json; each board's par proved exact by search and re-proved by logic-1-levels-check),
 *    picked by the room seed (salted by the game and level), so every phone in a room gets the same board; Easy's are
 *    built live (a few milliseconds).
 *  - Box Six's Hard and Expert boards (one and two advanced steps needed) come from the bank
 *    scripts/sudoku-level-bank.ts builds (sudokuLevelBank.server.json, re-proved by logic-1-levels-check), picked the
 *    same way; the level's clock and rules are added at the deal. Easy's are built live.
 *  - Safe Cracker's Expert cards (seven clues, each needed) come from scripts/safe-level-bank.ts's bank
 *    (safeLevelBank.server.json); Easy and Hard are built live.
 *  - Polypotions' levels are built live (the A* proof takes well under a tenth of a second).
 */
import type { Level } from "@/lib/levels/levels";

import bank from "./floodLevelBank.server.json";
import sudokuBank from "./sudokuLevelBank.server.json";
import safeBank from "./safeLevelBank.server.json";
import { generateSafeLevel } from "./safe.server";
import { generateSudokuLevel } from "./logic.server";
import { generateFloodLevel } from "./floodLevels.server";
import type { FloodLevel, SafeLevel, SudokuLevel, TubesLevel } from "./logicLevels";
import { randomBelow } from "./random";
import { saltSeed } from "./seededRng";
import { generateTubesLevel } from "./tubes.server";
import { SUDOKU_REV_FEWER, type FloodPuzzleData, type SafePuzzleData, type SudokuPuzzleData, type TubesPuzzleData } from "./types";

export const FLOOD_LEVEL_BANK = bank as unknown as { hard: FloodPuzzleData[]; expert: FloodPuzzleData[] };

export function dealFloodLevel(lv: FloodLevel, level: Level, bankSeed: number | undefined): FloodPuzzleData {
  const pool = level === "hard" ? FLOOD_LEVEL_BANK.hard : level === "expert" ? FLOOD_LEVEL_BANK.expert : null;
  if (!pool) return generateFloodLevel(lv);
  if (!pool.length) throw new Error(`Colour Flood ${level} bank is empty (bun scripts/flood-level-bank.ts)`);
  const index = bankSeed === undefined ? randomBelow(pool.length) : saltSeed(bankSeed, `flood:${level}`) % pool.length;
  const board = pool[Math.abs(index)]!;
  return { ...board, grid: [...board.grid], solution: [...(board.solution ?? [])], timeLimitMs: lv.timeMs, moveSpare: lv.spare };
}

export function dealTubesLevel(lv: TubesLevel, _level: Level, _bankSeed: number | undefined): TubesPuzzleData {
  return generateTubesLevel(lv);
}

export const SUDOKU_LEVEL_BANK = sudokuBank as unknown as { hard: SudokuPuzzleData[]; expert: SudokuPuzzleData[] };

export function dealSudokuLevel(lv: SudokuLevel, level: Level, bankSeed: number | undefined): SudokuPuzzleData {
  const pool = level === "hard" ? SUDOKU_LEVEL_BANK.hard : level === "expert" ? SUDOKU_LEVEL_BANK.expert : null;
  if (!pool) return generateSudokuLevel(lv);
  if (!pool.length) throw new Error(`Box Six ${level} bank is empty (bun scripts/sudoku-level-bank.ts)`);
  const index = bankSeed === undefined ? randomBelow(pool.length) : saltSeed(bankSeed, `sudoku:${level}`) % pool.length;
  const board = pool[Math.abs(index)]!;
  return {
    type: "sudoku",
    givens: [...board.givens],
    solution: [...(board.solution ?? [])],
    sudokuRev: SUDOKU_REV_FEWER,
    timeLimitMs: lv.timeMs,
    ...(lv.clashes === "check" ? { clashes: "check" as const } : {}),
    ...(lv.hideUsed ? { hideUsed: true } : {}),
  };
}

export const SAFE_LEVEL_BANK = safeBank as unknown as { expert: SafePuzzleData[] };

export function dealSafeLevel(lv: SafeLevel, level: Level, bankSeed: number | undefined): SafePuzzleData {
  if (level !== "expert") return generateSafeLevel(lv);
  const pool = SAFE_LEVEL_BANK.expert;
  if (!pool.length) throw new Error("Safe Cracker expert bank is empty (bun scripts/safe-level-bank.ts)");
  const index = bankSeed === undefined ? randomBelow(pool.length) : saltSeed(bankSeed, "safe:expert") % pool.length;
  const card = pool[Math.abs(index)]!;
  return { ...card, clues: card.clues.map((c) => ({ ...c })), combination: [...(card.combination ?? [])], timeLimitMs: lv.timeMs };
}
