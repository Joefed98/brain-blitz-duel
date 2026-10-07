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
/** Winner reveal (last round results -> podium); the server uses the same duration. */
export const WINNER_REVEAL_MS = 6_300;
export const WINNER_VOICE_MS = 200;
export const WINNER_ROLL_MS = 1_800;
export const WINNER_ROLL_END_MS = 5_800;
/** A podium that appears within this window after the reveal ends gets the crash + shake. */
export const WINNER_CRASH_GRACE_MS = 3_000;

export function winnerRevealFrame(elapsedMs: number) {
  const t = Math.max(0, elapsedMs);
  const opacity = Math.min(1, t / 300);
  if (t < WINNER_ROLL_MS || t >= WINNER_ROLL_END_MS) return { opacity, scale: 1, glow: 0 };
  const p = (t - WINNER_ROLL_MS) / (WINNER_ROLL_END_MS - WINNER_ROLL_MS);
  const amp = 0.015 + 0.035 * p;
  const pulse = (1 - Math.cos(((t - WINNER_ROLL_MS) / 250) * Math.PI * 2)) / 2;
  return { opacity, scale: 1 + amp * pulse, glow: (0.25 + 0.5 * p) * pulse };
}
