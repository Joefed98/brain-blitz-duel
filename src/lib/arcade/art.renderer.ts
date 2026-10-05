/** Shared helpers for per-game art renderers. Render only; never used by sims. */

let query: MediaQueryList | null = null;

/** True when the device asks for reduced motion: ambient animation freezes. */
export function reducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  query ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return query.matches;
}

/** Small stable integer hash for seeded decoration. */
export function artHash(a: number, b = 0): number {
  let h = Math.imul((a | 0) ^ Math.imul(b | 0, 0x9e3779b1), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
