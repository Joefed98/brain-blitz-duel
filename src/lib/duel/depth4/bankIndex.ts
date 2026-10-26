/** Depth batch 4's banks: which entry a room seed draws (a 32-bit mix of the seed and the bank's name). */
export function d4BankIndex(name: string, seed: number, size: number): number {
  if (size <= 0) return 0;
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) % size;
}
