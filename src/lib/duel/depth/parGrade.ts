/** Slider and Swapword (word depth d1): today's grade with the par bonus added, its breakdown adding up. */
import type { Graded } from "../grade";
import { storedScoreParts } from "../puzzleScoreRev";

export function parGrade(today: Graded, score: number, bonus: number, detail: Record<string, unknown>): Graded {
  const parts = storedScoreParts(today.extra);
  const extra = { ...(today.extra ?? {}), ...detail, parBonus: bonus };
  if (!parts || parts.kind !== "finish" || bonus <= 0) return { ...today, extra };
  // "120 + 34 par bonus + 30 speed": the bonus is the breakdown's measured part, today's 30 stays speed.
  const speed = score - parts.base - bonus;
  return { ...today, score, extra: { ...extra, parts: { kind: "finish", base: parts.base, efficiency: bonus, speed, measure: "par bonus" } } };
}
