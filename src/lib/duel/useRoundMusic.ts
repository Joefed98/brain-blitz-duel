import { useEffect } from "react";

import { resetArcadeClock } from "@/lib/arcade/clock";
import { leaveRoundMusic, syncRoundMusic, type RoundMusicPlan } from "@/lib/sound";

/** Engine screens reset the shared run clock a moment after they mount. */
const ARCADE_CLOCK_SETTLE_MS = 1000;

/**
 * Arcade rounds follow the sim clock, but only once the new run has reported
 * its own ticks; before that the clock can still hold the previous run's end.
 */
export function roundMusicRemaining(
  phaseRemainingMs: number,
  runMs: number | null,
  clockStart: number | null,
  now: number,
  arcadeRemaining: (runMs: number) => number,
): number {
  if (runMs === null) return phaseRemainingMs;
  if (clockStart === null || now - clockStart < ARCADE_CLOCK_SETTLE_MS) return runMs;
  return arcadeRemaining(runMs);
}

/**
 * The single owner of round music, driven by the room's or practice's
 * round-phase state. Called once by each of those screens; no component below
 * them starts or stops round music.
 */
export function useRoundMusic(plan: RoundMusicPlan, leaveReason: string): void {
  const { key, track, on, remainingMs, reason } = plan;
  // A new round starts with a fresh run clock (render-only, never feeds the sim).
  useEffect(() => {
    if (key) resetArcadeClock();
  }, [key]);
  useEffect(() => {
    syncRoundMusic({ key, track, on, remainingMs, reason });
  }, [key, track, on, remainingMs, reason]);
  useEffect(() => () => leaveRoundMusic(leaveReason), []); // eslint-disable-line react-hooks/exhaustive-deps
}
