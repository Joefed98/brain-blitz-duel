/**
 * Server-only generation for Rotating Rings. Every ring starts with the same
 * colour sequence (two of each colour, so ten of each across five rings), then
 * the board is scrambled with legal turns under a randomly chosen link pattern.
 * Breadth-first search over the 8⁵ offset states proves the exact minimum; only
 * boards needing 7–12 turns, with the two inner rings out of line, are kept.
 */

import { pick, randInt, randomBelow, shuffled } from "./random";
import { alignedSpokes, ringsApply, ringsMinMoves, RING_PATTERNS, RING_TAPS } from "./rings";
import {
  RINGS_COLOURS,
  RINGS_COUNT,
  RINGS_MAX_SCRAMBLE,
  RINGS_MAX_TURNS,
  RINGS_MIN_SCRAMBLE,
  RINGS_MIN_TURNS,
  RINGS_SEGMENTS,
  type RingsPuzzleData,
} from "./types";

function baseSequence(): number[] {
  const pool: number[] = [];
  for (let colour = 0; colour < RINGS_COLOURS; colour += 1) pool.push(colour, colour);
  return shuffled(pool);
}

function hasRotationalSymmetry(sequence: number[]): boolean {
  for (let shift = 1; shift < RINGS_SEGMENTS; shift += 1) {
    if (sequence.every((colour, index) => colour === sequence[(index + shift) % RINGS_SEGMENTS])) return true;
  }
  return false;
}

function rotated(sequence: number[], offset: number): number[] {
  return sequence.map((_c, index) => sequence[(index + offset) % RINGS_SEGMENTS]!);
}

/** True when the two inner rings already match at every spoke. */
export function innerRingsAligned(segments: number[][]): boolean {
  return alignedSpokes(segments.slice(0, 2), [0, 0]).length === RINGS_SEGMENTS;
}

function buildBoard(): RingsPuzzleData | null {
  const sequence = baseSequence();
  if (hasRotationalSymmetry(sequence)) return null;
  const pattern = randomBelow(RING_PATTERNS.length);
  let offsets = Array.from({ length: RINGS_COUNT }, () => 0);
  const steps = randInt(RINGS_MIN_SCRAMBLE, RINGS_MAX_SCRAMBLE);
  for (let step = 0; step < steps; step += 1) offsets = ringsApply(offsets, pick(RING_TAPS), pattern);
  const segments = offsets.map((offset) => rotated(sequence, offset));
  if (innerRingsAligned(segments)) return null;
  const solved = ringsMinMoves(segments, pattern);
  if (!solved || solved.min < RINGS_MIN_TURNS || solved.min > RINGS_MAX_TURNS) return null;
  return { type: "rings", pattern, segments, minMoves: solved.min, solution: solved.solution };
}

export function generateRings(): RingsPuzzleData {
  for (;;) {
    const board = buildBoard();
    if (board) return board;
  }
}
