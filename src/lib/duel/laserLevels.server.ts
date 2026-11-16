/**
 * Lightbender's level boards (16 Nov 2026; settings in src/lib/levels/pattern/laser.levels.ts). Server-only.
 *
 * Easy is generated live (a few ms). Hard and Expert deal from their own seeded banks (laserHardBank /
 * laserExpertBank .server.ts), built by `bun scripts/laser-bank.ts --level=<level>` and proved byte for byte with
 * `--check`: entry i is `generateLaserLevel` (the level's ranges, the generator's own proofs and the person-like
 * solver's floor and ceiling) under `laserLevelSeed(level, i, retry)`, for the smallest retry giving a board not
 * already in the bank. Expert's floor makes a live board take one to two seconds of search, too long for a deal.
 *
 * Normal is never dealt here: it keeps today's live deal exactly.
 */
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { LaserLevelSettings } from "@/lib/levels/pattern/laser.levels";

import { generateLaserLevel } from "./laser.server";
import { LASER_EXPERT_BANK } from "./laserExpertBank.server";
import { LASER_HARD_BANK } from "./laserHardBank.server";
import { withSeededRandom } from "./random";
import type { LaserPuzzleData } from "./types";

export type LaserBankLevel = "hard" | "expert";
export const LASER_BANK_LEVELS: readonly LaserBankLevel[] = ["hard", "expert"];
/** Boards in each level bank. */
export const LASER_BANK_SIZE: Record<LaserBankLevel, number> = { hard: 300, expert: 200 };

export function laserLevelSettings(level: "easy" | LaserBankLevel): LaserLevelSettings {
  const settings = gameLevelSettings<LaserLevelSettings>("laser", level);
  if (!settings) throw new Error(`laser has no ${level} level`);
  return settings;
}

function fmix32(value: number): number {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function salt(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** The fixed generator seed of a level bank's entry `index`, retry `retry`. */
export function laserLevelSeed(level: LaserBankLevel, index: number, retry: number): number {
  let h = fmix32(salt(`laser:${level}`));
  h = fmix32(h ^ Math.imul(index + 1, 0x9e3779b1));
  return fmix32(h ^ Math.imul(retry + 1, 0x27d4eb2f));
}

/** One bank entry: the level's generator under a fixed seed, with its wall-clock build time zeroed. */
export function buildLaserLevelEntry(level: LaserBankLevel, seed: number): LaserPuzzleData {
  const puzzle = withSeededRandom(seed, () => generateLaserLevel(laserLevelSettings(level)));
  if (puzzle.stats) puzzle.stats = { ...puzzle.stats, generationMs: 0 };
  return puzzle;
}

/** A board's identity (the fixed squares and the emitter). */
export function laserLevelKey(puzzle: LaserPuzzleData): string {
  return `laser:${puzzle.source}${puzzle.dir}|${puzzle.gems.join(",")}|${puzzle.bombs.join(",")}|${[...puzzle.blocks].sort((a, b) => a - b).join(",")}`;
}

export function laserLevelBank(level: LaserBankLevel): readonly LaserPuzzleData[] {
  return level === "hard" ? LASER_HARD_BANK : LASER_EXPERT_BANK;
}

/**
 * A Hard or Expert board for this seed (rooms and practice: the deal's seed; a deal without one: live). Boards whose
 * identity is in `avoid` are skipped by stepping on through the bank.
 */
export function drawLaserLevel(level: LaserBankLevel, seed: number | undefined, avoid?: ReadonlySet<string>): LaserPuzzleData {
  const bank = laserLevelBank(level);
  if (seed === undefined || bank.length === 0) return generateLaserLevel(laserLevelSettings(level));
  const start = fmix32((seed >>> 0) ^ salt(`laser:${level}`)) % bank.length;
  let chosen = bank[start]!;
  if (avoid && avoid.size > 0) {
    for (let step = 0; step < bank.length; step++) {
      const entry = bank[(start + step) % bank.length]!;
      if (!avoid.has(laserLevelKey(entry))) {
        chosen = entry;
        break;
      }
    }
  }
  return JSON.parse(JSON.stringify(chosen)) as LaserPuzzleData;
}
