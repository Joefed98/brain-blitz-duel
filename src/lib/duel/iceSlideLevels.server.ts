/**
 * Skid's level boards (difficulty levels, 16 Nov 2026; src/lib/levels/pattern/iceslide.levels.ts). Server-only.
 *
 * Each level beyond Normal deals from its own bank (iceSlideLevelBank.server.ts, written by
 * `bun scripts/iceslide-levels-bank.ts`, `--check` rebuilds it byte for byte): entry i of a level is
 * `generateIceSlideLevel(settings)` under the fixed seed `iceSlideLevelEntrySeed(level, i, retry)` for the smallest
 * retry whose board passes `verifyIceSlideLevelPuzzle` (the breadth-first proof of its minimum) and isn't a copy of an
 * earlier entry. A room or practice deal draws the entry its seed lands on, as the Normal bank does.
 */
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { Level } from "@/lib/levels/levels";
import type { IceSlideLevelSettings } from "@/lib/levels/pattern/iceslide.levels";

import { ICESLIDE_LEVEL_BANKS } from "./iceSlideLevelBank.server";
import { withSeededRandom } from "./random";
import { generateIceSlideLevel, verifyIceSlideLevelPuzzle } from "./slide.server";
import type { SlidePuzzleData } from "./types";

export type IceSlideLevel = Exclude<Level, "normal">;
export const ICESLIDE_BANK_LEVELS: readonly IceSlideLevel[] = ["easy", "hard", "expert"];
/** Bumping this re-deals every level bank (never done once a level is live). */
const LEVEL_BANK_VERSION = 1;

function fmix32(value: number): number {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function levelSalt(level: IceSlideLevel): number {
  let h = 0x51ce5d1e;
  for (const ch of `iceslide:${level}`) h = fmix32(h ^ ch.charCodeAt(0));
  return h;
}

/** The fixed seed of entry `index` of a level's bank on try `retry`. */
export function iceSlideLevelEntrySeed(level: IceSlideLevel, index: number, retry: number): number {
  let h = fmix32(levelSalt(level) ^ LEVEL_BANK_VERSION);
  h = fmix32(h ^ Math.imul(index + 1, 0x9e3779b1));
  return fmix32(h ^ Math.imul(retry + 1, 0x27d4eb2f));
}

export function iceSlideLevelSettings(level: IceSlideLevel): IceSlideLevelSettings {
  const s = gameLevelSettings<IceSlideLevelSettings>("iceslide", level);
  if (!s) throw new Error(`iceslide has no ${level} level`);
  return s;
}

/** One verified board for `index` of a level's bank on try `retry` (null when that seed's board fails its proof). */
export function buildIceSlideLevelEntry(level: IceSlideLevel, index: number, retry: number): SlidePuzzleData | null {
  const s = iceSlideLevelSettings(level);
  let puzzle: SlidePuzzleData;
  try {
    puzzle = withSeededRandom(iceSlideLevelEntrySeed(level, index, retry), () => generateIceSlideLevel(s));
  } catch {
    return null;
  }
  return verifyIceSlideLevelPuzzle(puzzle, s) === null ? puzzle : null;
}

/** A board's identity in its bank (the copies check and the recently played list). */
export function iceSlideLevelKey(p: SlidePuzzleData): string {
  return `${p.start}>${p.exit}|${p.walls.join(",")}|${p.holes.join(",")}`;
}

/**
 * The level board a seed deals: the bank entry it lands on, stepping past boards the host played recently (keys as the
 * Normal bank's, `iceslide:<key>`). A deep copy, so the bank is never changed. No seed (a deal outside a room or
 * practice): a fresh board from the level's generator.
 */
export function drawIceSlideLevel(level: IceSlideLevel, seed: number | undefined, avoid?: ReadonlySet<string>): SlidePuzzleData {
  const bank = ICESLIDE_LEVEL_BANKS[level];
  if (seed === undefined || !bank.length) return generateIceSlideLevel(iceSlideLevelSettings(level));
  const start = fmix32((seed >>> 0) ^ levelSalt(level)) % bank.length;
  let chosen = bank[start]!;
  if (avoid && avoid.size > 0) {
    for (let step = 0; step < bank.length; step++) {
      const entry = bank[(start + step) % bank.length]!;
      if (!avoid.has(`iceslide:${iceSlideLevelKey(entry)}`)) {
        chosen = entry;
        break;
      }
    }
  }
  return JSON.parse(JSON.stringify(chosen)) as SlidePuzzleData;
}
