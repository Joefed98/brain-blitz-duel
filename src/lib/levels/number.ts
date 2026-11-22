/**
 * The Number games' level lines (D2, 22 Nov 2026; docs/polish-plan-final/difficulty-spec.md "Number"): one plain line a
 * level beyond Normal, what the level changes, for the round intro, the "?" help and a game's page (levelAbout.ts). The
 * settings themselves are the registry's (gameLevels.ts); these lines name them. Plain data only.
 */
import type { Level } from "./levels";

export const NUMBER_LEVEL_ABOUT: Readonly<Record<string, Partial<Record<Exclude<Level, "normal">, string>>>> = {
  balance: {
    easy: "Three short scales of six notches, with two or three light weights to hang on each.",
    hard: "Every scale is ten notches long from the first, with two weights already hung on each.",
    expert: "Ten-notch scales with three to six weights to hang, fewer spare hangs and no readout.",
  },
  target: {
    easy: "A two-digit target that two or three of the numbers make, with two large numbers.",
    hard: "Two targets in a row in 100 seconds, the second one needing all six numbers.",
    expert: "Three targets in a row in 120 seconds, the last one from small numbers using all six.",
  },
  equation: {
    easy: "Numbers from 2 to 9, one or two gaps on each line, and no division.",
    hard: "Numbers up to 25, more gaps on each line and division from line 3, in 85 seconds.",
    expert: "Every sign is missing on every line, numbers go up to 30, two tries each, in 78 seconds.",
  },
  numpyramid: {
    easy: "Three small pyramids, the first of only three rows, and no spare tiles in the tray.",
    hard: "Five-row pyramids almost empty, with bigger numbers and three spare tiles in the tray.",
    expert: "Three six-row pyramids with only three stones given, and sums into three digits.",
  },
  measure: {
    easy: "Three short puzzles with two jugs and the tap.",
    hard: "Three jugs on every puzzle, and no tap from the third puzzle on.",
    expert: "No tap on any puzzle, the big jug starts full, and fewer pours are allowed.",
  },
  checkout: {
    easy: "Three standard boards with small targets, any dart finishes, in 120 seconds.",
    hard: "Odd numbers from the first board, then a x4 ring, minus wedges and an exact dart count.",
    expert: "Five boards of odd numbers, each with two minus wedges and an exact dart count.",
  },
  numline: {
    easy: "Every tenth of the ruler is marked with its number.",
    hard: "Harder fractions, a line from −100 to 100 and one from 0 to 1,000.",
    expert: "A line to 10,000 first, then Hard's fractions and negatives, in 75 seconds.",
  },
  kakuro: {
    easy: "A small 5 × 5 grid with about ten white squares.",
    hard: "A wider grid, seven squares across by six down, with 20 to 23 white squares.",
    expert: "The full 7 × 7 grid with 26 to 28 white squares and longer chains of reasoning.",
  },
};
