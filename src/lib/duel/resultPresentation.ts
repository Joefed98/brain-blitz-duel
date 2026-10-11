import type { RoundResultRow } from "./types";
import type { Standing } from "./scoring";

export function elapsedMs(result: RoundResultRow | undefined, timeLimitMs: number): number | null {
  if (!result) return null;
  return result.reaction_avg_ms ?? Math.max(0, timeLimitMs - result.ms_remaining);
}

export function formatElapsed(ms: number | null): string {
  return ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`;
}

export function roundResultOrder<T extends Standing>(
  rows: T[],
  times: ReadonlyMap<number, number | null>,
): T[] {
  return [...rows].sort(
    (a, b) =>
      b.roundScore - a.roundScore ||
      (times.get(a.slot) ?? Number.POSITIVE_INFINITY) -
        (times.get(b.slot) ?? Number.POSITIVE_INFINITY) ||
      a.slot - b.slot,
  );
}

export function positionChange(row: Standing): string {
  if (row.previousPosition === null) return "–";
  const change = row.previousPosition - row.position;
  return change > 0 ? `▲${change}` : change < 0 ? `▼${-change}` : "–";
}

export function previousStandingOrder(rows: Standing[]): Standing[] {
  return [...rows].sort(
    (a, b) =>
      (a.previousPosition ?? a.position) - (b.previousPosition ?? b.position) || a.slot - b.slot,
  );
}

/** "correct" only for a full solve; "partial" for points without one; "zero" otherwise. */
export type RoundVerdict = "correct" | "partial" | "zero";

export function roundVerdict(row: { roundCorrect: boolean | null; roundScore: number }): RoundVerdict {
  if (row.roundCorrect) return "correct";
  return row.roundScore > 0 ? "partial" : "zero";
}

export const VERDICT_LABEL: Record<RoundVerdict, string> = {
  correct: "✓ Correct",
  partial: "Partly solved",
  zero: "✗",
};

/** Text colour per verdict: green solve, amber partial credit, red nothing. */
export const VERDICT_TONE: Record<RoundVerdict, string> = {
  correct: "text-timer-green",
  partial: "text-timer-orange",
  zero: "text-warn",
};

const TIME_SEGMENT = /^\d+(?:\.\d+)?\s?s$/;

/**
 * Round summaries end with the player's time ("4 / 6 words · 31.2s"). Results
 * rows already show that time in their own column, so it is dropped here to
 * show it once.
 */
export function summaryWithoutTime(summary: string): string {
  return summary
    .split(" · ")
    .filter((segment) => !TIME_SEGMENT.test(segment.trim()))
    .join(" · ");
}
