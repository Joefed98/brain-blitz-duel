/**
 * Score text for the eleven Logic games on the depth revision (logicDepth.ts, 25 Oct 2026): the "?" help SCORE text
 * and the round intro's SCORE line, both from the numbers the depth curve uses, written with the game's maximum
 * (roundMax.ts) so they follow it. The help explains the feature in one short sentence; the intro stays within two
 * phone lines with no scoring terms (intro-score-text-check: no "par").
 */
import { DEPTH_PAR_BASE, DEPTH_TOP_POINTS, depthEliteSeconds, depthFastSeconds, depthGame } from "./logicDepth";
import { dealtLimitMs, EFFICIENCY_WORD, PROGRESS_MEASURE, PROGRESS_SHORT } from "./puzzleBandsText";
import { rev3UnfinishedScore } from "./puzzleScoreRev3";
import { roundMaxFor } from "./roundMax";
import type { PuzzleType } from "./types";

/** What a par game's moves are called. */
const PAR_WORD: Partial<Record<PuzzleType, string>> = { lightsout: "presses", tower: "moves", tubes: "pours", flood: "moves" };

/** The "?" help SCORE text. */
export function depthHelp(type: PuzzleType): string {
  const max = roundMaxFor(type);
  const limit = dealtLimitMs(type);
  const fast = depthFastSeconds(type, limit);
  const elite = depthEliteSeconds(type, limit);
  const half = rev3UnfinishedScore(type, 0.5);
  const eff = EFFICIENCY_WORD[type];
  const head = `Progress counts: ${PROGRESS_MEASURE[type] ?? "your progress"}. Unfinished scores up to 110: about ${half} half done, 110 one step short.`;
  const base = `Any finish scores 120 to ${max}: 120 as time runs out, 150 if you finish in about ${fast} s with no mistakes${eff ? ` (extra ${eff} only cut the speed points)` : ""}.`;
  const route = depthGame(type).route;
  if (route === "par") {
    const word = PAR_WORD[type] ?? "moves";
    return `${head} ${base} Par is the fewest ${word} the puzzle can be solved in: finish in par for ${DEPTH_PAR_BASE} more, and up to ${DEPTH_TOP_POINTS - DEPTH_PAR_BASE} more for finishing faster still, so ${max} is par in about ${elite} s.`;
  }
  if (route === "clean") {
    return `${head} ${base} A clean crack, opening it with tries to spare, adds up to ${DEPTH_TOP_POINTS} for finishing faster still: all of it on the first try, half on the second, so ${max} is the first try in about ${elite} s.`;
  }
  if (type === "flood") {
    return `${head} ${base} Flood it in par (the fewest moves, shown) and faster still for up to ${DEPTH_TOP_POINTS} more (half of it one move over), so ${max} is par in about ${elite} s.`;
  }
  return `${head} ${base} Faster still with no mistakes adds up to ${DEPTH_TOP_POINTS} more, so ${max} is a clean finish in about ${elite} s.`;
}

/** The round intro SCORE line (at most two phone lines, no scoring terms). */
export function depthIntro(type: PuzzleType): string {
  const max = roundMaxFor(type);
  const short = PROGRESS_SHORT[type] ?? "progress";
  const lead = `${short[0]!.toUpperCase()}${short.slice(1)}: up to 110.`;
  const route = depthGame(type).route;
  if (route === "par") return `${lead} Finish: 120+, or ${max} in the fewest ${PAR_WORD[type] ?? "moves"}, fast.`;
  if (route === "clean") return `${lead} Open it: 120+, or ${max} on the first try, fast.`;
  if (type === "flood") return `${lead} Finish: 120+, or ${max} in the fewest moves, fast.`;
  return `${lead} Finish: 120+, or ${max} in about ${depthEliteSeconds(type, dealtLimitMs(type))} s, no mistakes.`;
}
