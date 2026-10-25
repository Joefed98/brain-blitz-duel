/**
 * Score text for the par games (word depth d1: Slider `wordSlideRev 1`, Swapword `swapwordRev 4`; parBonus.ts):
 * today's rev-3 helper numbers for progress and the finish, then the par bonus that is the only way past 150.
 */
import { parBonusEliteSeconds, PAR_BONUS_MAX, type ParBonusCurve } from "./parBonus";
import { dealtLimitMs, PROGRESS_MEASURE, PROGRESS_SHORT, rev3Figures } from "./puzzleBandsText";
import { PRE_DEPTH_MAX } from "./wordDepth";
import type { PuzzleType } from "./types";

/** The "?" help SCORE text: progress, the finish to 150, then the par bonus to the game's maximum ({max}). */
export function parBonusHelp(type: PuzzleType, curve: ParBonusCurve, used: string, par: string): string {
  const f = rev3Figures(type);
  return `Progress counts: ${PROGRESS_MEASURE[type] ?? "your progress"}. Unfinished scores up to 110: about ${f.half} half done, 110 one step short. Any finish scores 120 to ${PRE_DEPTH_MAX}: 120 as time runs out, ${PRE_DEPTH_MAX} if you finish in about ${f.fastSeconds} s with no wasted ${used}. Par bonus: finish in ${par} or fewer for ${curve.base} to ${PAR_BONUS_MAX} more, the whole ${PAR_BONUS_MAX} in about ${parBonusEliteSeconds(curve, dealtLimitMs(type))} s; {max} only with it.`;
}

/** The round intro SCORE line (two phone lines at most; no scoring terms). */
export function parBonusIntro(type: PuzzleType, fewest: string): string {
  const short = PROGRESS_SHORT[type] ?? "progress";
  return `${short[0]!.toUpperCase()}${short.slice(1)}: up to 110. Finish: 120+, or {max} in the fewest ${fewest}, fast.`;
}
