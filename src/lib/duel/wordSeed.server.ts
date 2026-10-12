/**
 * Seeds for the room-seeded word games (Strikeout, Cryptogrid, Swapword).
 *
 * Room start passes the room seed and practice a fresh one, so every player in
 * a room gets the identical puzzle and the same seed always deals the same
 * board. Without a seed (the fixed intro example, the checks) one is drawn from
 * random(), which withSeededRandom fixes for the intro example.
 */

import { randomBelow } from "./random";

/** murmur3 fmix32. */
export function fmix32(value: number): number {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** FNV-1a of a string, so each game's draws are independent of the others'. */
export function saltOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** The game's own seed for this room (or a fresh one). */
export function wordGameSeed(type: string, roomSeed: number | undefined): number {
  const base = roomSeed === undefined ? randomBelow(0x8000_0000) : roomSeed >>> 0;
  return fmix32(base ^ saltOf(type));
}

/** mulberry32: small, well-mixed and identical on every runtime. */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

export function rngBelow(rng: () => number, bound: number): number {
  return bound <= 1 ? 0 : Math.floor(rng() * bound);
}

export function rngShuffle<T>(rng: () => number, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rngBelow(rng, i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
