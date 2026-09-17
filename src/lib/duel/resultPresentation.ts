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
