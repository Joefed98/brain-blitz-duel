/**
 * Randomness for puzzle generation and round selection.
 *
 * Every draw comes from the platform CSPRNG (`crypto.getRandomValues`) with no
 * seed of any kind, so two rooms started in the same server process are
 * independent. `Math.random` is only a fallback for the rare runtime without
 * Web Crypto.
 */

const CRYPTO: Crypto | undefined =
  typeof globalThis.crypto?.getRandomValues === "function" ? globalThis.crypto : undefined;

/** A fresh float in [0, 1) from the CSPRNG. */
export function random(): number {
  if (!CRYPTO) return Math.random();
  const buffer = new Uint32Array(1);
  CRYPTO.getRandomValues(buffer);
  return buffer[0]! / 0x1_0000_0000;
}

/** A uniform integer in [0, bound) — rejection sampled, so no modulo bias. */
export function randomBelow(bound: number): number {
  if (bound <= 1) return 0;
  if (!CRYPTO) return Math.floor(Math.random() * bound);
  const limit = Math.floor(0x1_0000_0000 / bound) * bound;
  const buffer = new Uint32Array(1);
  for (;;) {
    CRYPTO.getRandomValues(buffer);
    const value = buffer[0]!;
    if (value < limit) return value % bound;
  }
}

export function pick<T>(items: readonly T[]): T {
  return items[randomBelow(items.length)]!;
}

export function randInt(min: number, max: number): number {
  return min + randomBelow(max - min + 1);
}

/** A proper Fisher–Yates shuffle over a copy of the list. */
export function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Picks one entry with probability proportional to its weight. Zero or negative
 * weights are never chosen unless every option is zero, in which case the draw
 * falls back to a plain uniform pick.
 */
export function weightedPick<T>(items: readonly T[], weight: (item: T) => number): T {
  const weights = items.map((item) => Math.max(0, weight(item)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return pick(items);
  let roll = random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}
