/** Presentation-only timing; the room server uses the same fixed duration. */
export const DUEL_START_MS = 5_000;
export const DUEL_START_VOICE_MS = 2_000;

export function duelStartFrame(elapsedMs: number, reducedMotion: boolean) {
  const elapsed = Math.max(0, elapsedMs);
  const progress = Math.min(1, elapsed / DUEL_START_MS);
  return {
    scale: reducedMotion ? 1 : 0.04 + 0.96 * progress ** 3,
    opacity: reducedMotion ? Math.min(1, elapsed / 250) : 1,
  };
}