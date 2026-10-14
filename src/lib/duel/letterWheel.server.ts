import { LETTER_WHEEL_BANK } from "./letterWheelBank.server";
import { LETTER_WHEEL_BANK_REV1 } from "./letterWheelBankRev1.server";
import { LW_REV } from "./letterWheel";
import { rngBelow, seededRng } from "./wordSeed.server";
import type { LetterWheelPuzzleData } from "./types";

/**
 * wheelRev 1: draws one pre-built 11–14 word crossword from the rev-1 bank
 * (scripts/letter-wheel-bank.ts) by the game's room seed (wordGameSeed).
 */
export function generateLetterWheel(seed: number): LetterWheelPuzzleData {
  const e = LETTER_WHEEL_BANK_REV1[rngBelow(seededRng(seed), LETTER_WHEEL_BANK_REV1.length)]!;
  return {
    type: "letterwheel",
    wheelRev: LW_REV,
    cols: e.cols,
    rows: e.rows,
    letters: e.letters,
    slots: e.slots.map((s) => ({ ...s })),
    words: [...e.words],
  };
}

/** The original draw (8 or 9 words, unstamped), kept for the checks' legacy runs. */
export function generateLetterWheelLegacy(): LetterWheelPuzzleData {
  const e = LETTER_WHEEL_BANK[Math.floor(Math.random() * LETTER_WHEEL_BANK.length)]!;
  return {
    type: "letterwheel",
    cols: e.cols,
    rows: e.rows,
    letters: e.letters,
    slots: e.slots.map((s) => ({ ...s })),
    words: [...e.words],
  };
}
