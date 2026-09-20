/**
 * Server-only generation for Rotating Rings. Each ring starts with the same
 * colour sequence (so every spoke is one colour), then the board is scrambled
 * with legal turns — honouring both outward links — and a breadth-first search
 * over the 8⁴ offset states proves the exact minimum. Only boards needing 6–10
 * turns are kept.
 */

import { pick, randInt, shuffled } from "./random";
import { alignedSpokes, ringsApply, ringsMinMoves, RING_TAPS } from "./rings";
import {
  RINGS_ATTEMPTS,
  RINGS_COLOURS,
  RINGS_COUNT,
  RINGS_MAX_SCRAMBLE,
  RINGS_MAX_TURNS,
  RINGS_MIN_SCRAMBLE,
  RINGS_MIN_TURNS,
  RINGS_SEGMENTS,
  type RingsPuzzleData,
} from "./types";

/** Eight segments, two of each of the four colours, in a random order. */
function baseSequence(): number[] {
  const pool: number[] = [];
  for (let colour = 0; colour < RINGS_COLOURS; colour += 1) pool.push(colour, colour);
  return shuffled(pool);
}

/** A sequence that repeats under rotation would make several starts identical. */
function hasRotationalSymmetry(sequence: number[]): boolean {
  for (let shift = 1; shift < RINGS_SEGMENTS; shift += 1) {
    if (sequence.every((colour, index) => colour === sequence[(index + shift) % RINGS_SEGMENTS])) {
      return true;
    }
  }
  return false;
}

/** Rotates one ring's segment list so the board starts scrambled, not solved. */
function rotated(sequence: number[], offset: number): number[] {
  return sequence.map((_colour, index) => sequence[(index + offset) % RINGS_SEGMENTS]!);
}

function buildBoard(): RingsPuzzleData | null {
  const sequence = baseSequence();
  if (hasRotationalSymmetry(sequence)) return null;

  let offsets = Array.from({ length: RINGS_COUNT }, () => 0);
  const steps = randInt(RINGS_MIN_SCRAMBLE, RINGS_MAX_SCRAMBLE);
  for (let step = 0; step < steps; step += 1) offsets = ringsApply(offsets, pick(RING_TAPS));

  // Bake the scramble into the stored segments; the player always starts at 0.
  const segments = offsets.map((offset) => rotated(sequence, offset));
  if (
    alignedSpokes(
      segments,
      Array.from({ length: RINGS_COUNT }, () => 0),
    ).length >= RINGS_SEGMENTS
  ) {
    return null;
  }

  const solved = ringsMinMoves(segments);
  if (!solved) return null;
  if (solved.min < RINGS_MIN_TURNS || solved.min > RINGS_MAX_TURNS) return null;
  return { type: "rings", segments, minMoves: solved.min, solution: solved.solution };
}

export function generateRings(): RingsPuzzleData {
  for (let attempt = 0; attempt < RINGS_ATTEMPTS; attempt += 1) {
    const board = buildBoard();
    if (board) return board;
  }
  // Fallback: any scrambled board with a proven minimum, whatever the length.
  for (;;) {
    const sequence = baseSequence();
    if (hasRotationalSymmetry(sequence)) continue;
    let offsets = Array.from({ length: RINGS_COUNT }, () => 0);
    for (let step = 0; step < RINGS_MIN_SCRAMBLE; step += 1) {
      offsets = ringsApply(offsets, pick(RING_TAPS));
    }
    const segments = offsets.map((offset) => rotated(sequence, offset));
    const solved = ringsMinMoves(segments);
    if (!solved || solved.min === 0) continue;
    console.warn(`[rings] minimum outside the band: ${solved.min}`);
    return { type: "rings", segments, minMoves: solved.min, solution: solved.solution };
  }
}
