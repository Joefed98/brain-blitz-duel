/**
 * Flash depth grader (`tapRev: 5`, depth/flash.ts): the tap log replayed as grade.ts did (tapRev 4's decoy cut,
 * false starts), scored to 200 on the stretched curve with the steady-hand bonus. Older stamps return null.
 */
import { decodeTapTimes, replayFlash } from "../tapLog";
import { latestTapMs } from "../grade";
import { puzzleTimeLimitMs } from "../registry";
import type { DepthGrader } from "../depth200.server";
import { scoreFlashDepth, usesFlashDepth } from "./flash";

export const flashDepth: DepthGrader = {
  applies: usesFlashDepth,
  grade: ({ puzzle, answer, graded, receivedMsRemaining }) => {
    if (puzzle.type !== "reaction") return graded;
    const limit = puzzleTimeLimitMs(puzzle);
    // The same log grade.ts read (its taps were held to the receipt time there too).
    const { times } = decodeTapTimes(graded.answer || answer, latestTapMs(limit, receivedMsRemaining));
    const replay = replayFlash(puzzle, times, limit);
    const s = scoreFlashDepth(replay.times, Math.min(99, Math.max(0, replay.falseStarts)), puzzle.flashes.length);
    return {
      ...graded,
      score: s.score,
      extra: { ...(graded.extra ?? {}), depth: { curve: s.curve, steady: s.steady, spread: s.spread, falseStartCost: s.falseStartCost } },
    };
  },
};
