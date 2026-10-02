import { NUMBER_PYRAMID_BANK } from "./numberPyramidBank.server";
import type { NumberPyramidPuzzleData } from "./types";

/** Draws one pre-proven pyramid from the bank (built by scripts/number-pyramid-bank.ts). */
export function generateNumberPyramid(): NumberPyramidPuzzleData {
  const entry = NUMBER_PYRAMID_BANK[Math.floor(Math.random() * NUMBER_PYRAMID_BANK.length)]!;
  return {
    type: "numpyramid",
    givens: [...entry.givens],
    tray: [...entry.tray],
    solution: [...entry.solution],
  };
}
