import type { GenerateContext } from "../generate.server";
import type { PuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { LetterWheelLevelSettings } from "@/lib/levels/word/letterwheel";
import { lwJarSize } from "../letterWheel";
import type { LetterWheelBankEntry } from "../letterWheelBank.server";
import { LETTER_WHEEL_BANK_EASY } from "../letterWheelBankEasy.server";
import { LETTER_WHEEL_BANK_EXPERT } from "../letterWheelBankExpert.server";
import { LETTER_WHEEL_BANK_HARD } from "../letterWheelBankHard.server";
import { lwBonusDropsAvailable } from "../letterWheel.server";
import { WHEEL_REV_COMMON } from "../wordOverhaul";
import { rngBelow, seededRng, wordGameSeed } from "../wordSeed.server";

/** Each level's bank (scripts/letter-wheel-bank.ts --level=…). */
export const LETTER_WHEEL_LEVEL_BANKS: Readonly<Record<Exclude<Level, "normal">, readonly LetterWheelBankEntry[]>> = {
  easy: LETTER_WHEEL_BANK_EASY,
  hard: LETTER_WHEEL_BANK_HARD,
  expert: LETTER_WHEEL_BANK_EXPERT,
};

/**
 * Roundabout dealt at a level beyond Normal (the Word overhaul, stage 3; settings in src/lib/levels/word/letterwheel.ts):
 * a board from the level's own bank, drawn by the room's seed as Normal's is (so the same for everyone in a room), on
 * today's stamp (wheelRev 5, the jar sized from the board's own bonus words) and the level's clock. Never called at
 * Normal, so Normal is exactly today's deal.
 */
export function dealRoundaboutLevel(level: Exclude<Level, "normal">, context: GenerateContext): PuzzleData | null {
  const settings = gameLevelSettings<LetterWheelLevelSettings>("letterwheel", level);
  if (!settings) return null;
  const bank = LETTER_WHEEL_LEVEL_BANKS[level];
  const e = bank[rngBelow(seededRng(wordGameSeed(`letterwheel:${level}`, context.bankSeed)), bank.length)]!;
  return {
    type: "letterwheel",
    wheelRev: WHEEL_REV_COMMON,
    cols: e.cols,
    rows: e.rows,
    letters: e.letters,
    slots: e.slots.map((s) => ({ ...s })),
    words: [...e.words],
    jarSize: lwJarSize(lwBonusDropsAvailable(e.letters, e.words)),
    timeLimitMs: settings.timeLimitMs,
    ...(typeof settings.freeMisses === "number" ? { freeMisses: settings.freeMisses } : {}),
    ...(typeof settings.speedFullByS === "number" ? { speedFullByS: settings.speedFullByS } : {}),
  };
}
