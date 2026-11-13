/**
 * The arcade wall-clock trial's recorder (13 Nov 2026, log only; wallClock.ts has the rule): a new room or practice
 * arcade run that arrived past the line is recorded as `arcade_run_slow` (props mode, run_ms, over_ms and, in practice,
 * token_age_s: how long after the deal was sealed). Nothing is flagged, stored on the result or changed in grading.
 * Fire-and-forget, never throws.
 */
import { recordEvents } from "@/lib/data/events.server";
import type { PuzzleData } from "@/lib/duel/types";

import { arcadeWallClock } from "./wallClock";

export function noteSlowArcadeRun(input: {
  mode: "room" | "practice";
  puzzle: PuzzleData;
  /** The server's start for the round (ms); null or undefined when unknown (the run isn't judged). */
  startMs: number | null | undefined;
  nowMs: number;
  /** Practice: when the deal was sealed (ms), for the token's age. */
  dealtAtMs?: number | undefined;
  roomId?: string | null;
  playerId?: string | null;
}): boolean {
  try {
    const reading = arcadeWallClock(input.puzzle, input.startMs, input.nowMs);
    if (!reading || reading.overMs <= 0) return false;
    const props: Record<string, number | string> = { run_ms: reading.runMs, over_ms: reading.overMs };
    if (input.dealtAtMs !== undefined && Number.isFinite(input.dealtAtMs)) props["token_age_s"] = Math.round((input.nowMs - input.dealtAtMs) / 1000);
    recordEvents({
      event: "arcade_run_slow",
      mode: input.mode,
      game: input.puzzle.type,
      roomId: input.roomId ?? null,
      playerId: input.playerId ?? null,
      props,
    });
    return true;
  } catch {
    return false;
  }
}
