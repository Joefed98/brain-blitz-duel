/**
 * The arcade wall-clock trial (13 Nov 2026, log only; docs/security/arcade-wall-clock.md): how long an arcade run took
 * on the server's own clock, from the server's start for the round to the answer's arrival, against the run's length.
 * A run past `run length × WALL_CLOCK_SHARE + WALL_CLOCK_SLACK_MS` is recorded (analytics `arcade_run_slow`), never
 * flagged, regraded or refused; after a week Joe approves the number and a follow-up turns on the existing flag.
 * Pure; the server records (wallClock.server.ts).
 */
import { puzzleRunMs } from "@/lib/duel/catalogue";
import type { PuzzleData } from "@/lib/duel/types";

export const WALL_CLOCK_SHARE = 1.3;
export const WALL_CLOCK_SLACK_MS = 15_000;

export interface WallClockReading {
  /** The run's length (ms; the clock it shows). */
  runMs: number;
  /** From the server's start to the answer's arrival (ms). */
  elapsedMs: number;
  /** The line past which a run is recorded (ms). */
  limitMs: number;
  /** How far past the line (ms), 0 when inside it. */
  overMs: number;
}

/** The reading for an arcade run; null for a puzzle, or with no start. */
export function arcadeWallClock(puzzle: PuzzleData, startMs: number | undefined | null, nowMs: number): WallClockReading | null {
  const runMs = puzzleRunMs(puzzle);
  if (runMs === null || startMs === undefined || startMs === null || !Number.isFinite(startMs)) return null;
  const elapsedMs = Math.max(0, nowMs - startMs);
  const limitMs = Math.round(runMs * WALL_CLOCK_SHARE + WALL_CLOCK_SLACK_MS);
  return { runMs, elapsedMs, limitMs, overMs: Math.max(0, elapsedMs - limitMs) };
}
