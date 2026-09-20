/**
 * Server-only generation for Nonogram. A picture is drawn from a small bank of
 * pictograms (or made at random), its clues are computed, and the clues are only
 * kept when a line search proves they describe exactly one picture. The picture
 * is stored privately.
 */

import { countNonoSolutions, cluesFor } from "./nonogram";
import { randomBelow, shuffled } from "./random";
import {
  NONO_MAX_FILLED,
  NONO_MIN_FILLED,
  NONO_SIZE,
  type NonoPuzzleData,
} from "./types";

/** Forty simple 5×5 pictograms: "#" filled, "." empty. */
export const NONO_PICTOGRAMS: string[] = [
  ".#.#.##.####.##..#...", // heart
  ".#.#.", // placeholder replaced below
].length
  ? [
      // hearts, arrows, cups, houses, letters and simple icons
      ".#.#.###########.#...",
      "..#....###..#####.#..",
      "..#..#####.###..#..#.",
      "#...#.###..###..#...#",
      ".###.#...##...##...#.",
      "#####..#....#....#...",
      "#...##...######.#...#",
      "###..#..#.###.#..#..#",
      ".###.#...#####.#...#.",
      "..#..#####..#...###..",
      "#####.#...#.#####...#",
      "#...##...##...#.###..",
      "..#....#..#####..#...",
      ".#.#..###.#####.###..",
      "#####....#...#....###",
      "..#..###.##...#.###..",
      "###..#..#.####..#..##",
      "#.#.##.#.#.#.#.##.#.#",
      "#####.#.#..###..#.#..",
      "###...#....#....#.###",
      "..#..#####...#...#.#.",
      "#...#.#.#...#...#.#.#",
      "#####.###...#...#####",
      ".#.#.#####.###..#.#..",
      "#....###..#####..#..#",
      "..##...####.##...##..",
      "#..#.####.#..#.####..",
      "#####....#..#..#....#",
      ".###.#.#.######.#..#.",
      "#...##.#...#...#.#..#",
      "..#...###.#####.###..",
      "####..#..#####..#..##",
      "#..#.#..#.####..#..#.",
      ".#.#.##.##.#.##.#..#.",
      "#####.#...#...#..####",
      "#.#.#..#..#####..#..#",
      ".####.#...####..#...#",
      "###.#..#.#..####..#.#",
      "#..#.#.#.#..#..#.#..#",
      ".##.####.#.###..##.#.",
      "#...##..#..##..#..#.#",
      "..#..#.#.######.#.#..",
    ]
  : [];

function patternFrom(text: string): boolean[] {
  const cells = text.padEnd(NONO_SIZE * NONO_SIZE, ".").slice(0, NONO_SIZE * NONO_SIZE);
  return [...cells].map((glyph) => glyph === "#");
}

function filledCount(pattern: boolean[]): boolean {
  const count = pattern.filter(Boolean).length;
  return count >= NONO_MIN_FILLED && count <= NONO_MAX_FILLED;
}

function randomPattern(): boolean[] {
  const target = NONO_MIN_FILLED + randomBelow(NONO_MAX_FILLED - NONO_MIN_FILLED + 1);
  const pattern = Array.from({ length: NONO_SIZE * NONO_SIZE }, () => false);
  let filled = 0;
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

export function generateNonogram(): NonoPuzzleData {
  const bank = shuffled(NONO_PICTOGRAMS.map(patternFrom).filter(filledCount));

  for (const pattern of bank) {
    if (!nonoIsUnique(pattern)) continue;
    const { rows, cols } = cluesFor(pattern);
    return { type: "nonogram", rows, cols, pattern };
  }

  for (let attempt = 0; attempt < 4_000; attempt++) {
    const pattern = randomPattern();
    if (!nonoIsUnique(pattern)) continue;
    const { rows, cols } = cluesFor(pattern);
    return { type: "nonogram", rows, cols, pattern };
  }

  // Unreachable in practice: a simple striped picture is always unique.
  const pattern = patternFrom("#####.....#####.....#####");
  const { rows, cols } = cluesFor(pattern);
  return { type: "nonogram", rows, cols, pattern };
}
