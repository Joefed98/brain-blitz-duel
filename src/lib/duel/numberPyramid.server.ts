import { NUMBER_PYRAMID_BANK } from "./numberPyramidBank.server";
import type { NumberPyramidPuzzleData } from "./types";

/** Draws one pre-proven three-pyramid set from the bank. */
export function generateNumberPyramid(): NumberPyramidPuzzleData {
  const entry = NUMBER_PYRAMID_BANK[Math.floor(Math.random() * NUMBER_PYRAMID_BANK.length)]!;
  return {
    type: "numpyramid",
    pyramids: entry.pyramids.map(({ rows, givens, tray }) => ({ rows, givens: [...givens], tray: [...tray] })),
    solutions: entry.pyramids.map(({ solution }) => [...solution]),
  };
}
