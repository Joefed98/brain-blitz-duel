/**
 * Rotating Rings rules. The board is three rings of eight segments; the player's
 * answer is the list of taps, each one a ring plus a direction. Turning the
 * middle ring drags the outer ring with it. The server replays the taps through
 * exactly this code.
 */

import { RINGS_COUNT, RINGS_LINKS, RINGS_SEGMENTS } from "./types";

/** A tap is packed as ring × 2, plus one for anticlockwise. */
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

/** Applies one turn, honouring both outward links. */
export function ringsApply(offsets: number[], tap: number): number[] {
  const ring = ringOfTap(tap);
  if (ring < 0 || ring >= RINGS_COUNT) return offsets;
  // ringColour samples at spoke + offset, so a clockwise visible movement
  // requires the previous segment to arrive at the next clockwise spoke.
  const step = tapIsClockwise(tap) ? RINGS_SEGMENTS - 1 : 1;
  const next = [...offsets];
  next[ring] = ((next[ring] ?? 0) + step) % RINGS_SEGMENTS;
  for (const [from, to] of RINGS_LINKS) {
    if (ring !== from) continue;
    next[to] = ((next[to] ?? 0) + step) % RINGS_SEGMENTS;
  }
  return next;
}

/** The colour showing at one spoke of one ring, after the turns so far. */
export function ringColour(
  segments: number[][],
  offsets: number[],
  ring: number,
  spoke: number,
): number {
  const row = segments[ring] ?? [];
  const offset = offsets[ring] ?? 0;
  return row[(spoke + offset) % RINGS_SEGMENTS] ?? -1;
}

/** Spokes whose three segments are all the same colour. */
export function alignedSpokes(segments: number[][], offsets: number[]): number[] {
  const out: number[] = [];
  for (let spoke = 0; spoke < RINGS_SEGMENTS; spoke += 1) {
    const first = ringColour(segments, offsets, 0, spoke);
    let same = first >= 0;
    for (let ring = 1; ring < RINGS_COUNT; ring += 1) {
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
    .filter((value) => Number.isInteger(value) && value >= 0 && value < RINGS_COUNT * 2);
}

export interface RingsReplay {
  offsets: number[];
  solved: boolean;
  moves: number;
  aligned: number;
}

export function replayRings(segments: number[][], taps: number[]): RingsReplay {
  let offsets = freshOffsets();
  let moves = 0;
  for (const tap of taps) {
    if (ringsSolved(segments, offsets)) break;
    const next = ringsApply(offsets, tap);
    if (next === offsets) continue;
    offsets = next;
    moves += 1;
  }
  return {
    offsets,
    solved: ringsSolved(segments, offsets),
    moves,
    aligned: alignedSpokes(segments, offsets).length,
  };
}

/** Exact minimum taps from the start, over the 8×8×8 offset states. */
export function ringsMinMoves(segments: number[][]): { min: number; solution: number[] } | null {
  const key = (offsets: number[]) => offsets.join("|");
  const start = freshOffsets();
  if (ringsSolved(segments, start)) return { min: 0, solution: [] };
  const seen = new Set<string>([key(start)]);
  let frontier: { offsets: number[]; taps: number[] }[] = [{ offsets: start, taps: [] }];
  for (let depth = 1; depth <= RINGS_SEGMENTS ** RINGS_COUNT; depth += 1) {
    const next: { offsets: number[]; taps: number[] }[] = [];
    for (const node of frontier) {
      for (const tap of RING_TAPS) {
        const offsets = ringsApply(node.offsets, tap);
        const id = key(offsets);
        if (seen.has(id)) continue;
        seen.add(id);
        const taps = [...node.taps, tap];
        if (ringsSolved(segments, offsets)) return { min: depth, solution: taps };
        next.push({ offsets, taps });
      }
    }
    if (next.length === 0) return null;
    frontier = next;
  }
  return null;
}
