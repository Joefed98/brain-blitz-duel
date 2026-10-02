import { LETTER_WHEEL_BANK } from "./letterWheelBank.server";
import type { LetterWheelPuzzleData } from "./types";

/** Draws one pre-built crossword from the bank (built by scripts/letter-wheel-bank.ts). */
export function generateLetterWheel(): LetterWheelPuzzleData {
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
