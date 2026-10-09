/**
 * Shared speed-bonus curve. Par (version 1): the full bonus with at least half the
 * limit left, then an even fall to 0 at the limit. Legacy (unversioned puzzles):
 * linear max × left ÷ limit. The curve in force is set only around the server's
 * synchronous grade call (withSpeedCurve), so stored rounds keep the rule they
 * were created under; everywhere else (live counters, demos) uses par.
 */
export const SPEED_PAR_VERSION = 1;

let parActive = true;

/** True when a stored puzzle was created under the par rule. */
export function puzzleUsesSpeedPar(puzzle: unknown): boolean {
  return (puzzle as { speedPar?: number } | null)?.speedPar === SPEED_PAR_VERSION;
}

/** Run a synchronous grade under one curve, restoring the previous one after. */
export function withSpeedCurve<T>(par: boolean, run: () => T): T {
  const before = parActive;
  parActive = par;
  try {
    return run();
  } finally {
    parActive = before;
  }
}

/** speedBonus(max, left, limit) = round(max × min(1, left ÷ (0.5 × limit))); legacy = round(max × left ÷ limit). */
export function speedBonusCurve(max: number, timeLeft: number, limit: number): number {
  if (!(limit > 0) || !Number.isFinite(timeLeft)) return 0;
  const left = Math.max(0, Math.min(limit, timeLeft));
  if (!parActive) return Math.round((max * left) / limit);
  if (2 * left >= limit) return max;
  return Math.round((2 * max * left) / limit);
}
