import { BUZZER_MARGIN_MS } from "./buzzer";
import { usesArcadeClock } from "./registry";
import type { PuzzleType, RoundResultRow, StoredPuzzleType } from "./types";
import { ordinal } from "./ordinal";
import type { Standing } from "./scoring";

/**
 * The time a player used, ms, on the round's own clock (`clockMs`: an arcade run's length, else the
 * time limit; buzzer.ts). ms_remaining is measured against the time limit, so an arcade run's
 * figure is held to the run (a full run stored 0 ms left used the run, not the run plus the phase
 * slack). Display only.
 */
export function elapsedMs(
  result: RoundResultRow | undefined,
  timeLimitMs: number,
  clockMs: number = timeLimitMs,
  type?: StoredPuzzleType,
): number | null {
  if (!result) return null;
  // Bang On stores its average distance from the target in reaction_avg_ms: not a time, so no time
  // is shown (its summary says "avg N ms off"). Flash's figure is its average reaction time.
  if (type === "stopwatch") return null;
  if (result.reaction_avg_ms !== null && (type === undefined || type === "reaction")) return result.reaction_avg_ms;
  return Math.min(clockMs, Math.max(0, timeLimitMs - result.ms_remaining));
}

/**
 * "31.2s"; with the round's clock given, anyone who reached the buzzer (less than BUZZER_MARGIN_MS
 * left) shows the full clock in whole seconds, "90s" (18 Oct 2026, display only).
 */
export function formatElapsed(ms: number | null, clockMs?: number): string {
  if (ms === null) return "—";
  if (clockMs !== undefined && clockMs > 0 && ms >= clockMs - BUZZER_MARGIN_MS) return `${Math.round(clockMs / 1000)}s`;
  return `${(ms / 1000).toFixed(1)}s`;
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

/**
 * "correct" only for a full solve; "partial" for points without one; "zero" otherwise. Score-only
 * rounds ("scored"): arcade runs and Flash / Bang On have no solve, and their stored is_correct
 * means something different in every game (survived, cleared, every target, no false start…), so
 * their verdict comes from the score alone (18 Oct 2026, display only).
 */
export type RoundVerdict = "correct" | "partial" | "scored" | "zero";

/** Rounds whose verdict is their score alone: the arcade clock's runs, Flash and Bang On. */
export function scoreOnlyVerdict(type: StoredPuzzleType | undefined): boolean {
  if (!type) return false;
  if (type === "reaction" || type === "stopwatch") return true;
  try {
    return usesArcadeClock(type as PuzzleType);
  } catch {
    return false;
  }
}

export function roundVerdict(
  row: { roundCorrect: boolean | null; roundScore: number },
  scoreOnly = false,
): RoundVerdict {
  if (scoreOnly) return row.roundScore > 0 ? "scored" : "zero";
  if (row.roundCorrect) return "correct";
  return row.roundScore > 0 ? "partial" : "zero";
}

export const VERDICT_LABEL: Record<RoundVerdict, string> = {
  correct: "✓ Correct",
  partial: "Partly solved",
  scored: "Scored",
  zero: "✗",
};

/** Text colour per verdict: green solve, amber partial credit, neutral points, red nothing. */
export const VERDICT_TONE: Record<RoundVerdict, string> = {
  correct: "text-timer-green",
  partial: "text-timer-orange",
  scored: "text-foreground",
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

/*
 * Placings rooms (scoringMode.ts, 6 Nov 2026): the standings, podium and room panel show placing points (and each
 * round's place) where Total score rooms show the score total. Rows of a Total score room carry no points, so
 * these return exactly what those screens showed before.
 */

/** The big figure on a standings or podium row: placing points, else the total score. */
export function shownTotal(row: Pick<Standing, "total" | "points">): number {
  return row.points ?? row.total;
}

/** What the round shown added to it. */
export function shownRound(row: Pick<Standing, "roundScore" | "points" | "roundPoints">): number {
  return row.points !== undefined ? (row.roundPoints ?? 0) : row.roundScore;
}

/** The round column: "+142", or "2nd +7" under Placings. */
export function shownGain(row: Pick<Standing, "roundScore" | "points" | "roundPoints" | "roundPlace">): string {
  if (row.points === undefined) return `+${row.roundScore}`;
  return `${ordinal(row.roundPlace ?? 1)} +${row.roundPoints ?? 0}`;
}

/** The figure a count-up starts from: the round before's. */
export function shownCountFrom(row: Pick<Standing, "total" | "roundScore" | "points" | "roundPoints">): number {
  return Math.max(0, shownTotal(row) - shownRound(row));
}

/** tieMarks' input for a row (Placings rows add the total score, their first tie-break). */
export function placedOf(row: Pick<Standing, "slot" | "total" | "points" | "position">): {
  slot: number;
  points: number;
  position: number;
  score?: number;
} {
  return row.points !== undefined
    ? { slot: row.slot, points: row.points, position: row.position, score: row.total }
    : { slot: row.slot, points: row.total, position: row.position };
}
