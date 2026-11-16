/**
 * Ballpark's effects (the Number overhaul, stage 2, 15 Nov 2026): pure helpers the phone's effects read. Display only:
 * nothing here grades or changes a placement.
 */

/** How many tenths of the line a drag from share `a` to share `b` (each 0–1) crossed (the faint drag tick). */
export function numlineTenthsCrossed(a: number, b: number): number {
  const tenth = (s: number) => Math.floor(Math.max(0, Math.min(1, s)) * 10 + 1e-9);
  return Math.min(10, Math.abs(tenth(b) - tenth(a)));
}

/** Each true spot flying in, in the numbers' order, this far apart (ms). */
export const NUMLINE_PAYOFF_STEP_MS = 160;
/** The payoff starts once the reveal screen has settled (its own entrance first). */
export const NUMLINE_PAYOFF_START_MS = 500;

export interface NumlinePayoffStep {
  /** The number's index on its line. */
  index: number;
  /** When its true spot lands (ms from the start). */
  delayMs: number;
  /** A bullseye: it sparkles as it lands. */
  bull: boolean;
}

/**
 * The reveal's payoff: each placed number's true spot flies in from your marker in the numbers' order, a step
 * apart; bullseyes sparkle as they land. Numbers not placed have no marker and take no step.
 */
export function numlinePayoffPlan(rows: readonly { placement: number | null; bull: boolean }[], stepMs = NUMLINE_PAYOFF_STEP_MS, startMs = NUMLINE_PAYOFF_START_MS): NumlinePayoffStep[] {
  const out: NumlinePayoffStep[] = [];
  rows.forEach((row, index) => {
    if (row.placement === null) return;
    out.push({ index, delayMs: startMs + out.length * stepMs, bull: row.bull });
  });
  return out;
}
