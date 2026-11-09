/**
 * The one ranking (B3, docs/audit-nov-2026/architecture.md). Every place a player is given comes from here: a room's
 * standings after each round and at the end (scoring.ts `standings`, so the podium, its awards, async boards, friend
 * challenges, share text and device history too), a two-player room's win / loss / draw (`duelOutcome`) and the
 * Daily's board (daily.ts `rankBoard`). Ratings will read final places from the same rule.
 *
 * The order: more placing points first (Placings rooms only; Total score rows carry none, so they rank exactly as
 * before Placings existed), then the higher total, then less time used (the tie-break). Rows level on all three
 * share a place, and the next place skips (1, 2, 2, 4). Rows sharing a place keep their input order unless the caller
 * gives a display order (`within`), which never changes a place. Pure; shared by phone and server.
 */

export interface RankRow {
  total: number;
  /** The tie-break's time used, ms (less is better). */
  timeMs: number;
  /** Placings rooms only (scoringMode.ts): the placing points. */
  points?: number;
}

/** Negative when `a` ranks above `b`, positive when below, 0 when level. */
export function compareRank(a: RankRow, b: RankRow): number {
  const pa = a.points ?? 0;
  const pb = b.points ?? 0;
  if (pb !== pa) return pb - pa;
  if (b.total !== a.total) return b.total - a.total;
  return a.timeMs - b.timeMs;
}

/** Level on points, total and time: the two share a place. */
export function sameRank(a: RankRow, b: RankRow): boolean {
  return (a.points ?? 0) === (b.points ?? 0) && a.total === b.total && a.timeMs === b.timeMs;
}

/**
 * The rows in ranked order with their places (1, 2, 2, 4). `within` orders rows sharing a place (display only); without
 * it they keep their input order (the sort is stable).
 */
export function placesOf<R extends RankRow>(
  rows: readonly R[],
  within?: (a: R, b: R) => number,
): { row: R; place: number }[] {
  const sorted = [...rows].sort(within ? (a, b) => compareRank(a, b) || within(a, b) : compareRank);
  const out: { row: R; place: number }[] = [];
  sorted.forEach((row, index) => {
    const previous = index > 0 ? sorted[index - 1]! : null;
    const place = previous && sameRank(previous, row) ? out[index - 1]!.place : index + 1;
    out.push({ row, place });
  });
  return out;
}

export type Outcome = "win" | "loss" | "draw";

/** One player against another on the same rule: "win" when `mine` ranks above `theirs`. */
export function outcomeOf(mine: RankRow, theirs: RankRow): Outcome {
  const order = compareRank(mine, theirs);
  return order < 0 ? "win" : order > 0 ? "loss" : "draw";
}
