/**
 * Roundabout's score texts under wheelRev 2 (25 Oct 2026, word depth d1; docs/depth/d1-word.md): today's helper
 * numbers (rev 3, puzzleBandsText.ts) plus the bonus jar. The intro SCORE line and the "?" help both come from here.
 */
import { LW_FREE_MISSES, LW_JAR_DROPS, LW_JAR_POINTS, LW_JAR_UNFINISHED_TOP } from "./letterWheel";
import { PROGRESS_MEASURE, rev3Figures } from "./puzzleBandsText";
import { roundMaxFor } from "./roundMax";

/** The finish's top without the jar (rev 3's 120 + 30). */
const FINISH_TOP = 150;

/** The "?" help SCORE text. */
export function letterWheelJarHelp(): string {
  const f = rev3Figures("letterwheel");
  const max = roundMaxFor("letterwheel");
  return `Progress counts: ${PROGRESS_MEASURE.letterwheel}. Unfinished scores up to 110: about ${f.half} half done, 110 one step short. Any finish scores 120 to ${FINISH_TOP}: 120 as time runs out, ${FINISH_TOP} if you finish in about ${f.fastSeconds} s with no more than ${LW_FREE_MISSES} misses. Bonus jar: real words that are not in the crossword fill it (3 letters 1 drop, 4 letters 2, 5 letters 3, 6+ letters 4; each word once), and each miss after the first ${LW_FREE_MISSES} spills a drop. A full jar (${LW_JAR_DROPS} drops; smaller on a wheel with few bonus words) adds ${LW_JAR_POINTS}, a half-full one ${LW_JAR_POINTS / 2}: only the jar takes a round past ${FINISH_TOP}, to ${max}. With the jar an unfinished round still scores at most ${LW_JAR_UNFINISHED_TOP}.`;
}

/** The round intro SCORE line (at most two phone lines). */
export function letterWheelJarIntro(): string {
  return `Words: up to 110. A fast finish ${FINISH_TOP}; a full bonus jar lifts it to {max}.`;
}
