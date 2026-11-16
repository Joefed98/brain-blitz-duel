import type { GenerateContext } from "../generate.server";
import type { PuzzleData, StrikeoutPuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { STRIKEOUT_LEVEL_SETTINGS, type StrikeoutLevelSettings } from "@/lib/levels/word/strikeout";

import { dealtTopupRev } from "../depthTopup";
import { STRIKEOUT_REV4, STRIKEOUT_REV5, STRIKEOUT_REV_TOPUP } from "../strikeout";
import { generateStrikeout, so2GivenCount, type So2ExtraGivens } from "../strikeout.server";
import { dealtDepthRev } from "../wordDepth";
import { fmix32, wordGameSeed } from "../wordSeed.server";
import { solveStrikeoutLikeAPerson } from "./strikeoutSolver.server";

/** A level's starting letters on word w of `length` letters, as so2GivenCount's offset. */
export function strikeoutLevelExtra(settings: StrikeoutLevelSettings): So2ExtraGivens {
  return (w, length) => {
    const [seven, eight] = w < 3 ? settings.givensFirst : settings.givensRest;
    return (length <= 7 ? seven : eight) - so2GivenCount(length);
  };
}

/** Draws a level's set tries at most this many times before keeping the last (never reached in the check's seeds). */
export const STRIKEOUT_LEVEL_TRIES = 40;

/** The draw for one try (try 0 is the room's own seed; later tries mix the try in, the same for every player). */
export function strikeoutLevelTry(level: Exclude<Level, "normal">, seed: number, attempt: number): StrikeoutPuzzleData {
  const settings = STRIKEOUT_LEVEL_SETTINGS[level];
  const rev = dealtDepthRev(dealtTopupRev(STRIKEOUT_REV_TOPUP, STRIKEOUT_REV5), STRIKEOUT_REV4);
  const drawSeed = attempt === 0 ? seed : fmix32((seed ^ Math.imul(attempt, 0x9e3779b1)) >>> 0);
  const made = generateStrikeout(drawSeed, rev, strikeoutLevelExtra(settings));
  return { ...made, maxStrikes: settings.strikes, maxVowels: settings.vowels, timeLimitMs: settings.timeLimitMs };
}

/**
 * Strikeout dealt at a level beyond Normal (the Word overhaul, stage 3; settings in src/lib/levels/word/strikeout.ts):
 * the room-seeded draw of five words under the level's starting letters, carrying the level's strikes, vowel guesses and
 * clock (so2RulesFor and puzzleTimeLimitMs read them). Hard and Expert keep only a set the person-like solver
 * (strikeoutSolver.server.ts) clears within the level's strikes, drawing again (seeded) until it does. Never called at
 * Normal, so Normal is exactly today's deal.
 */
export function dealStrikeoutLevel(level: Exclude<Level, "normal">, context: GenerateContext): PuzzleData | null {
  const seed = wordGameSeed("strikeout", context.bankSeed);
  let made = strikeoutLevelTry(level, seed, 0);
  if (level === "easy") return made;
  for (let attempt = 1; attempt < STRIKEOUT_LEVEL_TRIES && !solveStrikeoutLikeAPerson(made).solved; attempt++) {
    made = strikeoutLevelTry(level, seed, attempt);
  }
  return made;
}
