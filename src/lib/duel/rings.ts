/**
 * Rotating Rings rules. Five rings of eight segments; each puzzle carries one
 * LINK PATTERN from a fixed bank, so turning a ring may also turn others the
 * same or the opposite way. Answers are lists of taps (ring × 2 + anticlockwise),
 * plus UNDO and RESET codes; the server replays them through exactly this code.
 */

import { RINGS_COUNT, RINGS_SEGMENTS } from "./types";

export interface RingLink {
  from: number;
  to: number;
  /** 1 = same way, −1 = opposite way. */
  sign: 1 | -1;
}

export interface RingPattern {
  links: RingLink[];
  /** Legend lines, ring numbers counted from 1 = innermost. */
  legend: string[];
}

export const RING_PATTERNS: RingPattern[] = [
  {
    links: [{ from: 1, to: 3, sign: -1 }],
    legend: ["Ring 2 also turns ring 4 the opposite way"],
  },
  {
    links: [
      { from: 2, to: 1, sign: 1 },
      { from: 2, to: 3, sign: 1 },
    ],
    legend: ["Ring 3 also turns rings 2 and 4 the same way"],
  },
  {
    links: [
      { from: 0, to: 2, sign: 1 },
      { from: 3, to: 4, sign: -1 },
    ],
    legend: ["Ring 1 also turns ring 3 the same way", "Ring 4 also turns ring 5 the opposite way"],
  },
  {
    links: [
      { from: 1, to: 2, sign: 1 },
      { from: 3, to: 1, sign: -1 },
    ],
    legend: ["Ring 2 also turns ring 3 the same way", "Ring 4 also turns ring 2 the opposite way"],
  },
  {
    links: [
      { from: 4, to: 0, sign: 1 },
      { from: 2, to: 3, sign: -1 },
    ],
    legend: ["Ring 5 also turns ring 1 the same way", "Ring 3 also turns ring 4 the opposite way"],
  },
  {
    links: [
      { from: 0, to: 1, sign: -1 },
      { from: 4, to: 2, sign: 1 },
    ],
    legend: ["Ring 1 also turns ring 2 the opposite way", "Ring 5 also turns ring 3 the same way"],
  },
];

export function ringPattern(index: number | undefined): RingPattern {
  return RING_PATTERNS[(((index ?? 0) % RING_PATTERNS.length) + RING_PATTERNS.length) % RING_PATTERNS.length]!;
}

export const RING_UNDO = RINGS_COUNT * 2;
export const RING_RESET = RINGS_COUNT * 2 + 1;

export function encodeRingTap(ring: number, clockwise: boolean): number {
  return ring * 2 + (clockwise ? 0 : 1);
}

export function ringOfTap(tap: number): number {
  return Math.floor(tap / 2);
}

export function tapIsClockwise(tap: number): boolean {
  return tap % 2 === 0;
}

export const RING_TAPS: number[] = Array.from({ length: RINGS_COUNT * 2 }, (_v, tap) => tap);

export function freshOffsets(): number[] {
  return Array.from({ length: RINGS_COUNT }, () => 0);
}

/** Applies one turn, honouring the pattern's links. */
export function ringsApply(offsets: number[], tap: number, pattern: number): number[] {
  const ring = ringOfTap(tap);
  if (ring < 0 || ring >= RINGS_COUNT) return offsets;
  // ringColour samples at spoke + offset, so a clockwise visible movement
  // requires the previous segment to arrive at the next clockwise spoke.
  const step = tapIsClockwise(tap) ? RINGS_SEGMENTS - 1 : 1;
  const next = [...offsets];
  next[ring] = ((next[ring] ?? 0) + step) % RINGS_SEGMENTS;
  for (const link of ringPattern(pattern).links) {
    if (link.from !== ring) continue;
    const moved = link.sign === 1 ? step : RINGS_SEGMENTS - step;
    next[link.to] = ((next[link.to] ?? 0) + moved) % RINGS_SEGMENTS;
  }
  return next;
}

export function ringColour(segments: number[][], offsets: number[], ring: number, spoke: number): number {
  const row = segments[ring] ?? [];
  const offset = offsets[ring] ?? 0;
  return row[(spoke + offset) % RINGS_SEGMENTS] ?? -1;
}

/** Spokes whose segments are all the same colour across every ring. */
export function alignedSpokes(segments: number[][], offsets: number[]): number[] {
  const out: number[] = [];
  for (let spoke = 0; spoke < RINGS_SEGMENTS; spoke += 1) {
    const first = ringColour(segments, offsets, 0, spoke);
    let same = first >= 0;
    for (let ring = 1; ring < segments.length; ring += 1) {
      if (ringColour(segments, offsets, ring, spoke) !== first) same = false;
    }
    if (same) out.push(spoke);
  }
  return out;
}

export function ringsSolved(segments: number[][], offsets: number[]): boolean {
  return alignedSpokes(segments, offsets).length === RINGS_SEGMENTS;
}

export function encodeRingTaps(taps: number[]): string {
  return taps.join(",");
}

export function decodeRingTaps(raw: string): number[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= RING_RESET)
    .slice(0, 300);
}

export interface RingsReplay {
  offsets: number[];
  solved: boolean;
  moves: number;
  aligned: number;
}

export function replayRings(segments: number[][], pattern: number, taps: number[]): RingsReplay {
  const history: number[][] = [freshOffsets()];
  let offsets = history[0]!;
  let moves = 0;
  for (const tap of taps) {
    if (tap === RING_UNDO) {
      if (history.length > 1) history.pop();
      offsets = history[history.length - 1]!;
      continue;
    }
    if (tap === RING_RESET) {
      history.length = 1;
      offsets = history[0]!;
      continue;
    }
    if (ringsSolved(segments, offsets)) break;
    offsets = ringsApply(offsets, tap, pattern);
    history.push(offsets);
    moves += 1;
  }
  return {
    offsets,
    solved: ringsSolved(segments, offsets),
    moves,
    aligned: alignedSpokes(segments, offsets).length,
  };
}

/** Exact minimum taps from the start, over all 8⁵ offset states. */
export function ringsMinMoves(segments: number[][], pattern: number): { min: number; solution: number[] } | null {
  const key = (offsets: number[]) => offsets.reduce((acc, v) => acc * RINGS_SEGMENTS + v, 0);
  const start = freshOffsets();
  if (ringsSolved(segments, start)) return { min: 0, solution: [] };
  const states: number[][] = [start];
  const parent: number[] = [-1];
  const via: number[] = [-1];
  const seen = new Set<number>([key(start)]);
  for (let index = 0; index < states.length; index++) {
    for (const tap of RING_TAPS) {
      const offsets = ringsApply(states[index]!, tap, pattern);
      const id = key(offsets);
      if (seen.has(id)) continue;
      seen.add(id);
      states.push(offsets);
      parent.push(index);
      via.push(tap);
      if (ringsSolved(segments, offsets)) {
        const solution: number[] = [];
        for (let walk = states.length - 1; walk > 0; walk = parent[walk]!) solution.unshift(via[walk]!);
        return { min: solution.length, solution };
      }
    }
  }
  return null;
}
