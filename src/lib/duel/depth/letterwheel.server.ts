/**
 * Roundabout's depth grader (25 Oct 2026, word depth d1; wordDepth.server.ts, docs/depth/d1-word.md).
 *
 * wheelRev 2 rounds score today's grade (rev 3's helper: up to 110 unfinished, 120 + up to 30 for a finish) plus
 * the bonus jar: real words traced from the wheel that are not in the crossword fill it by length (letterWheel.ts
 * lwJarDrops; each miss after the free 5 spills a drop), and a full jar adds 50, the only way past 150. Unfinished rounds stay at 119 at most, so every
 * finish still beats every unfinished run. Nothing else changes: the crossword, the log, misses and today's score.
 */
import { isWord } from "../dictionary.server";
import { LW_JAR_DROPS, LW_JAR_UNFINISHED_TOP, lwDecodeLog, lwJarBonus, lwJarKept, lwJarTally, lwUsesJar } from "../letterWheel";
import { storedScoreParts, type ScoreParts } from "../puzzleScoreRev";
import { withBonus } from "../wordDepth";
import type { DepthGrader } from "../wordDepth.server";

export const letterwheelDepth: DepthGrader = {
  applies: (puzzle) => puzzle.type === "letterwheel" && lwUsesJar(puzzle),
  grade: ({ puzzle, answer, today }) => {
    if (puzzle.type !== "letterwheel") return today;
    const size = puzzle.jarSize ?? LW_JAR_DROPS;
    const jar = lwJarTally(puzzle.words ?? [], puzzle.letters, lwDecodeLog(answer), (w) => isWord(w));
    // Each miss after the free ones spills a drop (today's own miss count, from the same log).
    const misses = Number(today.extra?.["misses"] ?? 0);
    const kept = lwJarKept(jar.drops, misses);
    const jarBonus = lwJarBonus(kept, size);
    const finished = today.isCorrect;
    const score = finished ? withBonus(today.score, jarBonus) : Math.min(LW_JAR_UNFINISHED_TOP, withBonus(today.score, jarBonus));
    const before = storedScoreParts(today.extra);
    // The breakdown adds up to the score: a finish reads "120 + N bonus jar + M speed".
    const parts: ScoreParts =
      finished && before?.kind === "finish"
        ? { kind: "finish", base: before.base, efficiency: score - today.score, measure: "bonus jar", speed: today.score - before.base }
        : { kind: "partial", base: score };
    return {
      ...today,
      score,
      extra: {
        ...(today.extra ?? {}),
        parts,
        todayScore: today.score,
        bonusWords: jar.bonus.length,
        jarDrops: kept,
        jarSpilled: jar.drops - kept,
        jarSize: size,
        jarBonus: score - today.score,
      },
    };
  },
};
