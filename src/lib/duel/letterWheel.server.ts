import { LETTER_WHEEL_BANK } from "./letterWheelBank.server";
import { LETTER_WHEEL_BANK_REV1 } from "./letterWheelBankRev1.server";
import { LW_REV, LW_REV_JAR, lwJarDrops, lwJarSize } from "./letterWheel";
import { isWord, wordsFrom } from "./dictionary.server";
import { dealtDepthRev } from "./wordDepth";
import { rngBelow, seededRng } from "./wordSeed.server";
import type { LetterWheelPuzzleData } from "./types";

/**
 * wheelRev 1: draws one pre-built 11–14 word crossword from the rev-1 bank
 * (scripts/letter-wheel-bank.ts) by the game's room seed (wordGameSeed).
 */
export function generateLetterWheel(seed: number): LetterWheelPuzzleData {
  const e = LETTER_WHEEL_BANK_REV1[rngBelow(seededRng(seed), LETTER_WHEEL_BANK_REV1.length)]!;
  // Word depth (25 Oct 2026): wheelRev 2 deals the same board plus the bonus jar's size (pinPreDepth deals rev 1).
  const rev = dealtDepthRev(LW_REV_JAR, LW_REV);
  return {
    type: "letterwheel",
    wheelRev: rev,
    cols: e.cols,
    rows: e.rows,
    letters: e.letters,
    slots: e.slots.map((s) => ({ ...s })),
    words: [...e.words],
    ...(rev >= LW_REV_JAR ? { jarSize: lwJarSize(lwBonusDropsAvailable(e.letters, e.words)) } : {}),
  };
}

/** Drops every bonus word on this wheel holds together (dictionary words, 3+ letters, not in the crossword). */
export function lwBonusDropsAvailable(letters: string, words: readonly string[]): number {
  const slots = new Set(words);
  return wordsFrom(letters, 3, true)
    .map((w) => w.toUpperCase())
    .filter((w) => !slots.has(w) && isWord(w))
    .reduce((sum, w) => sum + lwJarDrops(w), 0);
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
