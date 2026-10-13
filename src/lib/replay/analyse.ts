/**
 * One stored round, ready to play back: its seekable timeline and the moments
 * found while the first pass re-simulates it (display only).
 */
import type { PuzzleData } from "@/lib/duel/types";
import { MomentDetector, type Moment } from "./moments";
import { makeStepper } from "./steppers";
import { ReplayTimeline } from "./timeline";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface RoundAnalysis {
  timeline: ReplayTimeline<any>;
  detector: MomentDetector;
}

export function analyseRound(puzzle: PuzzleData, answer: string): RoundAnalysis | null {
  const stepper = makeStepper(puzzle, answer);
  if (!stepper) return null;
  const detector = new MomentDetector(puzzle, {
    runTicks: stepper.runTicks,
    lastTick: stepper.lastTick,
    score: stepper.score,
  });
  const timeline = new ReplayTimeline(stepper, detector.observe);
  return { timeline, detector };
}

/** Scans the whole round at once (checks, small runs) and returns its moments. */
export function momentsOf(
  puzzle: PuzzleData,
  answer: string,
): { moments: Moment[]; endTick: number; score: number } | null {
  const analysis = analyseRound(puzzle, answer);
  if (!analysis) return null;
  analysis.timeline.scanAll();
  return {
    moments: analysis.detector.finish(analysis.timeline.endTick),
    endTick: analysis.timeline.endTick,
    score: analysis.timeline.finalScore ?? 0,
  };
}

/**
 * Scans in slices of `ticks` per callback so the first pass never holds up a
 * frame; resolves with the moments once the run is done, or null if cancelled.
 */
export function scanInSlices(
  analysis: RoundAnalysis,
  opts: { ticks?: number; isCancelled?: () => boolean; budgetMs?: number } = {},
): Promise<{ moments: Moment[]; ms: number } | null> {
  const started = typeof performance !== "undefined" ? performance.now() : 0;
  const slice = opts.ticks ?? 240;
  return new Promise((resolve) => {
    const run = () => {
      if (opts.isCancelled?.()) return resolve(null);
      const done = analysis.timeline.scanSome(slice);
      if (done) {
        const ms = (typeof performance !== "undefined" ? performance.now() : 0) - started;
        resolve({ moments: analysis.detector.finish(analysis.timeline.endTick), ms });
        return;
      }
      setTimeout(run, 0);
    };
    run();
  });
}
