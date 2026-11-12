/**
 * A recorded game's score over time (wave 3, W3b; docs/rated/matchmaking-interface.md "Playback"), made by the server
 * from the stored run alone: the replay stepper (src/lib/replay/steppers.ts, proved by replay-check to end on the
 * server replay's own state and score) is stepped to the end and the sim's score read once a second.
 *
 * Only real progress: the timeline is kept only when its last point equals the stored score (the round's graded
 * score); otherwise, or for a game with no engine replay (every puzzle, and Letterfall, which needs the dictionary),
 * there is no timeline and the recorded score shows only at the game's end. Display only: nothing here grades,
 * scores or writes a stored row.
 */
import { TICKS_PER_SECOND } from "@/lib/arcade/engine";
import type { PuzzleData } from "@/lib/duel/types";
import { makeStepper, replayToEnd } from "@/lib/replay/steppers";

import type { ScoreTimeline } from "./matchmaking";

/** A point every second of the run (and the last tick). */
const SAMPLE_TICKS = TICKS_PER_SECOND;

/** The stored run's score over time, or null (no engine replay, a dictionary game, or a final score that differs). */
export function scoreTimeline(puzzle: PuzzleData, answer: string, storedScore: number): ScoreTimeline | null {
  let stepper;
  try {
    stepper = makeStepper(puzzle, answer);
  } catch {
    return null;
  }
  if (!stepper || stepper.needsDict) return null;
  const points: [number, number][] = [];
  let lastScore = Number.NaN;
  const note = (tick: number, score: number) => {
    if (score === lastScore) return;
    lastScore = score;
    points.push([Math.round((tick * 1000) / TICKS_PER_SECOND), score]);
  };
  let end;
  try {
    const s0 = stepper.init();
    note(0, stepper.score(s0));
    end = replayToEnd(stepper, (state, tick) => {
      if (tick % SAMPLE_TICKS === 0) note(tick, stepper.score(state));
    });
  } catch {
    return null;
  }
  // The last point is the end of the run, and must be the graded score: otherwise the stored score is not the sim's
  // (a game whose stored score maps the sim's total), and only the final score is shown.
  if (end.score !== storedScore) return null;
  if (points[points.length - 1]?.[1] !== end.score) note(end.ticks, end.score);
  return points;
}
