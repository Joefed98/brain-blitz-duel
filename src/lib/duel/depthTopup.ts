/**
 * Puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md).
 */
let preTopup = false;

/** Checks and reports: deal the stamps rooms dealt before the top-up (returns the previous setting). */
export function pinPreTopup(on: boolean): boolean {
  const prev = preTopup;
  preTopup = on;
  return prev;
}

export function preTopupPinned(): boolean {
  return preTopup;
}

/** The stamp new puzzles are dealt: the top-up's, or the live one before it while a check pins it. */
export function dealtTopupRev<T>(topupRev: T, liveRev: T): T {
  return preTopup ? liveRev : topupRev;
}
