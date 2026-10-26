/**
 * Bang On depth grader (`tapRev: 5`, depth/bangOn.ts): the tap log replayed on the fixed schedule as grade.ts did,
 * tapRev 4's curve plus the dead-centre and zone-streak points, to 200. Older stamps return null.
 */
import { decodeTapTimes, replayBangOn, tapRevOf } from "../tapLog";
import { latestTapMs } from "../grade";
import { puzzleTimeLimitMs } from "../registry";
import { STOPWATCH_ATTEMPTS } from "../types";
import type { DepthGrader } from "../depth200.server";
import { bangOnMarks, scoreBangOnDepth, usesBangOnDepth } from "./bangOn";

export const bangOnDepth: DepthGrader = {
  applies: usesBangOnDepth,
  grade: ({ puzzle, answer, graded, receivedMsRemaining }) => {
    if (puzzle.type !== "stopwatch") return graded;
    const limit = puzzleTimeLimitMs(puzzle);
    const { times } = decodeTapTimes(graded.answer || answer, latestTapMs(limit, receivedMsRemaining));
    const replay = replayBangOn(puzzle.watches, times, limit);
    const s = scoreBangOnDepth(puzzle.watches, replay.results, STOPWATCH_ATTEMPTS, tapRevOf(puzzle));
    const { marks } = bangOnMarks(puzzle.watches, replay.results);
    return {
      ...graded,
      score: s.score,
      extra: {
        ...(graded.extra ?? {}),
        depth: { curve: s.curve, centre: s.centre, centreHits: s.centreHits, streak: s.streak, streakWatches: s.streakWatches, bestStreak: s.bestStreak, zone: marks.map((m) => m.zone), dead: marks.map((m) => m.centre), ...(s.floor !== undefined ? { floor: s.floor } : {}) },
      },
    };
  },
};
