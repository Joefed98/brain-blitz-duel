/**
 * A small seeded generator for puzzle builders that must be reproducible from a
 * room seed (Brimful, Checkout, Ballpark). Kept separate from random.ts so a
 * build never swaps the global draw source and nests safely inside
 * withSeededRandom.
 */
export interface SeededRng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, bound). */
  below(bound: number): number;
  /** Integer in [lo, hi]. */
  int(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

export function seededRng(seed: number): SeededRng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
  const below = (bound: number) => (bound <= 1 ? 0 : Math.floor(next() * bound));
  return {
    next,
    below,
    int: (lo, hi) => lo + below(hi - lo + 1),
    pick: (items) => items[below(items.length)]!,
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = below(i + 1);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

/** Mixes a room seed with a per-game salt so games in one room draw apart. */
export function saltSeed(seed: number, salt: string): number {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}
