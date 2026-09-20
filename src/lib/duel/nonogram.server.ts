/**
 * Server-only generation for Nonogram. A picture is drawn from a small bank of
 * pictograms (or made at random), its clues are computed, and the clues are only
 * kept when a line search proves they describe exactly one picture. The picture
 * is stored privately.
 */

import { cluesFor, countNonoSolutions } from "./nonogram";
import { randomBelow, shuffled } from "./random";
import { NONO_MAX_FILLED, NONO_MIN_FILLED, NONO_SIZE, type NonoPuzzleData } from "./types";

/** Forty simple 5×5 pictograms: "#" filled, "." empty. */
export const NONO_PICTOGRAMS: string[] = [
  ".#.#.###########.#...", // heart
  "..#....###..#####.#..", // arrow up
  "..#..#####.###..#..#.", // cup
  "#...#.###..###..#...#", // bow tie
  ".###.#...##...##...#.", // letter O
  "#####..#....#....#...", // flag
  "#...##...######.#...#", // letter H
  "###..#..#.###.#..#..#", // letter B
  ".###.#...#####.#...#.", // ring
  "..#..#####..#...###..", // key
  "#####.#...#.#####...#", // letter S
  "#...##...##...#.###..", // cup base
  "..#....#..#####..#...", // arrow down
  ".#.#..###.#####.###..", // cat face
  "#####....#...#....###", // letter Z
  "..#..###.##...#.###..", // tree
  "###..#..#.####..#..##", // letter D
  "#.#.##.#.#.#.#.##.#.#", // chequer
  "#####.#.#..###..#.#..", // trophy
  "###...#....#....#.###", // letter I
  "..#..#####...#...#.#.", // person
  "#...#.#.#...#...#.#.#", // letter X
  "#####.###...#...#####", // letter I serif
  ".#.#.#####.###..#.#..", // crown
  "#....###..#####..#..#", // letter L
  "..##...####.##...##..", // slope
  "#..#.####.#..#.####..", // letter R
  "#####....#..#..#....#", // letter N
  ".###.#.#.######.#..#.", // house
  "#...##.#...#...#.#..#", // letter Y
  "..#...###.#####.###..", // rocket
  "####..#..#####..#..##", // letter P
  "#..#.#..#.####..#..#.", // letter U
  ".#.#.##.##.#.##.#..#.", // lattice
  "#####.#...#...#..####", // letter C
  "#.#.#..#..#####..#..#", // star
  ".####.#...####..#...#", // letter G
  "###.#..#.#..####..#.#", // letter K
  "#..#.#.#.#..#..#.#..#", // letter V
  ".##.####.#.###..##.#.", // fish
  "#...##..#..##..#..#.#", // letter W
  "..#..#.#.######.#.#..", // diamond
];

function patternFrom(text: string): boolean[] {
  const cells = text.padEnd(NONO_SIZE * NONO_SIZE, ".").slice(0, NONO_SIZE * NONO_SIZE);
  return [...cells].map((glyph) => glyph === "#");
}

function inFilledBand(pattern: boolean[]): boolean {
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

/** Bank pictograms that are both in the filled band and uniquely solvable. */
export function nonoUsablePictograms(): boolean[][] {
  return NONO_PICTOGRAMS.map(patternFrom).filter((p) => inFilledBand(p) && nonoIsUnique(p));
}

export function generateNonogram(): NonoPuzzleData {
  for (const pattern of shuffled(NONO_PICTOGRAMS.map(patternFrom).filter(inFilledBand))) {
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
