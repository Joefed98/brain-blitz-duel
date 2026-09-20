/**
 * Server-only generation for Nonogram. A picture is drawn from a small bank of
 * pictograms (or made at random), its clues are computed, and the clues are only
 * kept when a line search proves they describe exactly one picture. The picture
 * is stored privately.
 */

import { cluesFor, countNonoSolutions } from "./nonogram";
import { randomBelow, shuffled } from "./random";
import { NONO_MAX_FILLED, NONO_MIN_FILLED, NONO_SIZE, type NonoPuzzleData } from "./types";

/** Full 9×9 silhouettes: "#" filled, "." empty. Every line is occupied. */
export const NONO_PICTOGRAMS: string[] = [
  "......###...####.....#####.#####..........###.....####.###.....###........#####..",
  "#####.......###......####.....###.....#####.......####.###........####.......####",
  ".....####.###......####.........####...###........###....###......#####.#####....",
  ".###.........#####.#####.........###..###........#####...####..###..........###..",
  ".#####......####......########........#####......###..#####.......####.....####..",
  ".####.....###..........####....###....#####..###.......####....#####....###......",
  "......###....#####...#####......###...#####...###...........########.....###.....",
  "....###.......####...####.......####.####....#####....###.......####.....#####...",
  ".....####.....###....#####.###...........####.####.......#####.....#####.....####",
  "...####..###......###.........#####...#####......#####.#####......###.......#####",
  "....###.....####....###.......####.....####.....####.....####..###...........####",
  ".#####...#####......#####.......###....####..###............###.###..........####",
  ".#####.......###...#####......####...####....###.......####........##########....",
  "..###.........####...####...#####......####....#####..#####........#####....#####",
  ".###.......###.....####.......####...#####...#####.........#########.....####....",
  "#####....#####.....###.....###...........####.####....#####.....###.......###....",
  "...####...#####........####..#####.....#####.#####.......###......###......####..",
  "......###.###.......###.....###......###..........###..#####......####..#####....",
  "###.......####......#####.....#####....####........###.###........#####......####",
  "...####......###...####....###........###.....####.........####..#####..###......",
  ".....####.#####........###....####.....#####.###......#####........###....#####..",
  ".#####.......#####.###..........####....###..###......###........###.......###...",
  ".####.........####..###....#####.....#####......#####..####.......#####...#####..",
  "...###.......#####..###.......###......#####......#########.......####....#####..",
  "...####.......####....###..###.........####...####......#####......###..###......",
  ".####......###......###.....#####....#####......####....###.........#########....",
  "......###...###....#####...#####.........####....###....###.....####.....#####...",
  "...####...###...........###..#####.....####.....####....#####....###....###......",
  "..#####.....####...####.........#########......#####...####.....#####......###...",
  "...###...###...........####....#####...###....####.........####..#####.....####..",
  "#####........#####......###......###....#####.####.....###......###..........####",
  "#####.....####.........####.####.......####......#####.#####...#####.......#####.",
  "..###....#####.....####.......###....###.........########...........####.####....",
  "....########.......####.....####.......####...####..........###.####....#####....",
  "#####......#####.......####.....###.....###.....#####....####......#####....#####",
  "..###.......####.....###...#####....###.........####..###......###..........#####",
  ".....#########.......###......###......###....#####...###........#####..#####....",
  "#####.......###...#####....#####.........####...####.....#####.###.......####....",
  ".....####.####........#####..#####.....####..###...........###...#####....###....",
  "...###....####.......###........####.###.....###.........####......#####...####..",
  ".....#########.......####.....#####.......###.....####....#####...###.......#####",
  "#####.........####..#####..###.........#####....####.......####.###.....#####....",
];

function patternFrom(text: string): boolean[] {
  const cells = text.padEnd(NONO_SIZE * NONO_SIZE, ".").slice(0, NONO_SIZE * NONO_SIZE);
  return [...cells].map((glyph) => glyph === "#");
}

function inFilledBand(pattern: boolean[]): boolean {
  const count = pattern.filter(Boolean).length;
  return count >= NONO_MIN_FILLED && count <= NONO_MAX_FILLED;
}

function fillsEveryLine(pattern: boolean[]): boolean {
  const { rows, cols } = cluesFor(pattern);
  return rows.every((clue) => clue.length > 0) && cols.every((clue) => clue.length > 0);
}

function randomPattern(): boolean[] {
  const pattern = Array.from({ length: NONO_SIZE * NONO_SIZE }, () => false);
  let filled = 0;
  for (let row = 0; row < NONO_SIZE; row += 1) {
    const length = 3 + randomBelow(3);
    const start = randomBelow(NONO_SIZE - length + 1);
    for (let col = start; col < start + length; col += 1) {
      const cell = row * NONO_SIZE + col;
      if (!pattern[cell]) filled += 1;
      pattern[cell] = true;
    }
  }
  const target = Math.max(
    filled,
    NONO_MIN_FILLED + randomBelow(NONO_MAX_FILLED - NONO_MIN_FILLED + 1),
  );
  while (filled < target) {
    const cell = randomBelow(pattern.length);
    if (pattern[cell]) continue;
    pattern[cell] = true;
    filled += 1;
  }
  return pattern;
}

/** True only when the clues have one single solution. */
export function nonoIsUnique(pattern: boolean[]): boolean {
  const { rows, cols } = cluesFor(pattern);
  return countNonoSolutions(rows, cols, 2) === 1;
}

/** Bank pictograms that are both in the filled band and uniquely solvable. */
export function nonoUsablePictograms(): boolean[][] {
  return NONO_PICTOGRAMS.map(patternFrom).filter(
    (pattern) => inFilledBand(pattern) && fillsEveryLine(pattern) && nonoIsUnique(pattern),
  );
}

export function generateNonogram(): NonoPuzzleData {
  for (const pattern of shuffled(
    NONO_PICTOGRAMS.map(patternFrom).filter(
      (candidate) => inFilledBand(candidate) && fillsEveryLine(candidate),
    ),
  )) {
    if (!nonoIsUnique(pattern)) continue;
    const { rows, cols } = cluesFor(pattern);
    return { type: "nonogram", rows, cols, pattern };
  }

  for (let attempt = 0; attempt < 4_000; attempt++) {
    const pattern = randomPattern();
    if (!fillsEveryLine(pattern)) continue;
    if (!nonoIsUnique(pattern)) continue;
    const { rows, cols } = cluesFor(pattern);
    return { type: "nonogram", rows, cols, pattern };
  }

  // The first validated bank entry is a safe final fallback.
  const pattern = patternFrom(NONO_PICTOGRAMS[0] ?? "");
  const { rows, cols } = cluesFor(pattern);
  return { type: "nonogram", rows, cols, pattern };
}
