/**
 * Server-only grading (Speed fix 7, 9 Nov 2026): `gradeAnswer` lives here, apart from every generator and bank, so a
 * room, daily or challenge answer on a fresh server loads only the grading code (generate.server.ts and
 * puzzleBank.server.ts are several megabytes the first deal pays for, never the first answer). Moved as it was, line
 * for line; generate.server.ts re-exports it, so every caller and check grades exactly as before.
 */
import { puzzleUsesSpeedPar, withSpeedCurve } from "./speedPar";
import { puzzleScoreRevOf, storedScoreParts } from "./puzzleScoreRev";
import { PUZZLE_SCORE_REV_BANDS, rev2Applies, rev2Grade, rev2ResultOf } from "./puzzleScoreRev2";
import { PUZZLE_SCORE_REV_HELPER, rev3Applies, rev3Efficiency, rev3Finish, rev3Unfinished } from "./puzzleScoreRev3";
import { rev3EfficiencyOverride, rev3Progress } from "./puzzleProgress";
import { gradeDepth200 } from "./depth200.server";
import { puzzleTimeLimitMs } from "./registry";
import { usesStandard } from "./standard/stamps";
import { gradeStandard } from "./standard/grade.server";
import { splitTimeline, TIMELINE_MAX_CHARS } from "./standard/timeline";
import { answerCapFor, gradeSubmission, latestTapMs, type Graded, type SubmitExtra } from "./grade";
import { gradeWordHunt } from "./wordHunt.server";
import { gradeWordsmith } from "./wordsmith.server";
import type { PuzzleData } from "./types";

/**
 * The single place an answer is checked and scored. `receivedMsRemaining` is the
 * server's own time left when a room answer arrived (tap logs are held to it).
 */
export function gradeAnswer(
  puzzle: PuzzleData,
  sent: string,
  msRemaining: number,
  extra?: SubmitExtra,
  receivedMsRemaining?: number,
): Graded {
  // On a standard stamp the phone appends a draft timeline (standard/timeline.ts): graded and stored without it.
  const std = usesStandard(puzzle);
  // On a standard stamp the body is cut to the game's answer cap before any grader reads it (and the whole text
  // to the cap plus the longest timeline decodeTimeline reads), so the standard grader never sees more than the older
  // path does. Every other puzzle reads `sent` exactly as before.
  const { body: answer, timeline } = std ? standardParts(puzzle, sent) : { body: sent, timeline: null };
  const graded = withSpeedCurve(puzzleUsesSpeedPar(puzzle), () => {
    if (puzzle.type === "wordsmith") return gradeWordsmith(puzzle, answer, msRemaining);
    if (puzzle.type === "wordhunt") return gradeWordHunt(puzzle, answer, msRemaining);
    return gradeSubmission(puzzle, answer, msRemaining, extra, receivedMsRemaining);
  });
  let todayGrade: Graded | null = null;
  const today = () => (todayGrade ??= gradeToday(puzzle, answer, graded, receivedMsRemaining));
  const depthOrToday = () => gradeDepth200({ puzzle, answer, graded, today, receivedMsRemaining }) ?? today();
  // Depth to 200 (depth200.server.ts, the one depth path): a puzzle stamped with its game's depth revision scores to
  // 200 through that game's grader (from the game's own grade or today's); every other puzzle keeps today's grade.
  // The scoring standard (standard/grade.server.ts): a puzzle on its game's standard stamp scores on the one shape.
  if (std) return gradeStandard({ puzzle, answer, timeline, graded, today, receivedMsRemaining }) ?? depthOrToday();
  return depthOrToday();
}

/** A standard puzzle's answer body (cut to its cap) and timeline. */
export function standardParts(puzzle: PuzzleData, sent: string): { body: string; timeline: string | null } {
  const cap = answerCapFor(puzzle);
  const capped = typeof sent === "string" ? sent.slice(0, cap + TIMELINE_MAX_CHARS + 64) : "";
  const split = splitTimeline(capped);
  return { body: split.body.slice(0, cap), timeline: split.timeline };
}

/** Today's grade before any depth revision: puzzleScoreRev 3's helper or rev 2's knots over the game's own grade. */
function gradeToday(puzzle: PuzzleData, answer: string, graded: Graded, receivedMsRemaining?: number): Graded {
  const rev = puzzleScoreRevOf(puzzle);
  // puzzleScoreRev 3 (the shared helper, puzzleScoreRev3.ts): finish puzzles score progress, time and mistakes.
  if (rev >= PUZZLE_SCORE_REV_HELPER && rev3Applies(puzzle.type)) return withRev3(puzzle, answer, graded, receivedMsRemaining);
  // puzzleScoreRev 2 (score bands, puzzleScoreRev2.ts): the rev-1 grade above, mapped through the game's knots.
  return rev >= PUZZLE_SCORE_REV_BANDS && rev2Applies(puzzle.type) ? withRev2(puzzle, graded) : graded;
}

/**
 * A rev-1 grade turned into the rev-3 score: a finish is 120 + speed (cut by the game's mistakes), an unfinished
 * round 110 × progress ÷ the game's one-short progress (puzzleProgress.ts). The breakdown adds up to the score.
 */
function withRev3(puzzle: PuzzleData, answer: string, graded: Graded, receivedMsRemaining?: number): Graded {
  const limit = puzzleTimeLimitMs(puzzle);
  const parts1 = storedScoreParts(graded.extra);
  const finished = graded.isCorrect && (parts1 === null || parts1.kind === "finish");
  const r = finished
    ? rev3Finish(puzzle.type, graded.storedMs, limit, rev3EfficiencyOverride(puzzle, graded.extra) ?? rev3Efficiency(parts1, graded.storedMs, limit))
    : rev3Unfinished(
        puzzle.type,
        rev3Progress({ puzzle, answer, extra: graded.extra, latestMs: latestTapMs(limit, receivedMsRemaining) }) ??
          Math.max(0, parts1 ? parts1.base : graded.score) / 110,
      );
  const shares = finished ? { time: r.time, efficiency: r.efficiency } : { progressShare: r.progress };
  return { ...graded, isCorrect: finished, score: r.score, extra: { ...(graded.extra ?? {}), parts: r.parts, rev1Score: graded.score, ...shares } };
}

/** A rev-1 grade turned into the rev-2 score; the breakdown stored for the reveal adds up to it. */
function withRev2(puzzle: PuzzleData, graded: Graded): Graded {
  const limit = puzzleTimeLimitMs(puzzle);
  const parts1 = storedScoreParts(graded.extra);
  const ms = graded.isCorrect ? graded.storedMs : 0;
  const { score, parts } = rev2Grade(puzzle, graded.score, parts1, ms, limit);
  const result = Math.round(rev2ResultOf(puzzle.type, graded.score, parts1, ms, limit).result * 10) / 10;
  return { ...graded, score, extra: { ...(graded.extra ?? {}), parts, rev1Score: graded.score, result } };
}
