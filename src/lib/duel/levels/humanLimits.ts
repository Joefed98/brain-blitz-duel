/**
 * The human limits the Word levels are proved against (D1, 21 Nov 2026; plan rule 6): the best humans take 0.25 s to
 * react to what they see and 0.15 s for each tap, key or traced letter after it. The same figures as the bots' HUMAN_LIMITS
 * (scripts/arcade-skill-bands/human.ts); word-levels-proof-check proves they agree. A level deal that must hold a 200
 * keeps a board only when a line a person could find reaches 200 entered at this pace. Pure; server use only.
 */
export const WORD_HUMAN_LIMITS = { reactMs: 250, moveMs: 150 } as const;

/** Time to make one entry at the limits: react once, then `taps` taps, keys or traced letters. */
export function limitEntryMs(taps: number): number {
  return WORD_HUMAN_LIMITS.reactMs + Math.max(0, taps) * WORD_HUMAN_LIMITS.moveMs;
}
