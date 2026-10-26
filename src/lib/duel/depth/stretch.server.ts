/**
 * The STRETCH finish shared by Interlock, Cryptogrid and Strikeout (word depth, 25 Oct 2026; wordDepth.ts
 * stretchFinish, docs/depth/d1-word.md). Server-only.
 *
 * Today's grade is kept exactly (unfinished rounds, and the 120 + speed of a finish); a finish adds the stretch
 * points above it, read from rev 3's own figures stored on the grade: `extra.time` (the share of the clock left)
 * and `extra.efficiency` (the game's mistakes). The breakdown reads "120 + N pace bonus + M speed" (plus any
 * game bonus the caller adds) and always adds up to the score.
 */
import type { Graded } from "../grade";
import { storedScoreParts, type ScoreParts } from "../puzzleScoreRev";
import { DEPTH_MAX, type StretchCurve } from "../wordDepth";

/** Stretch points (0 – `points`) for a finish with `left` of the clock left and `efficiency`. */
export function stretchPoints(curve: StretchCurve, left: number, efficiency: number, points: number): number {
  const l = clamp01(left);
  const e = clamp01(efficiency);
  const s = clamp01((l - curve.fast) / Math.max(0.01, curve.elite - curve.fast));
  return Math.round(points * Math.pow(e, curve.effPower) * Math.pow(s, curve.power));
}

/** The finish figures rev 3 stored on today's grade, or null for an unfinished round. */
export function finishFigures(today: Graded): { parts: ScoreParts; time: number; efficiency: number } | null {
  const parts = storedScoreParts(today.extra);
  if (!today.isCorrect || parts?.kind !== "finish") return null;
  const time = Number(today.extra?.["time"]);
  const eff = Number(today.extra?.["efficiency"] ?? 1);
  return { parts, time: Number.isFinite(time) ? time : 0, efficiency: Number.isFinite(eff) ? eff : 1 };
}

/**
 * Today's finish plus `bonuses` (each a named part, e.g. pace bonus, early solves), capped at the depth maximum.
 * The breakdown puts the bonuses together in the efficiency slot, named by `measure`.
 */
export function addFinishBonus(today: Graded, parts: ScoreParts, bonus: number, measure: string, detail: Record<string, unknown>): Graded {
  const extra = Math.max(0, Math.min(DEPTH_MAX - today.score, Math.round(bonus)));
  const score = today.score + extra;
  const speed = score - 120 - extra;
  return {
    ...today,
    score,
    extra: { ...(today.extra ?? {}), ...detail, parts: { kind: "finish", base: parts.base, efficiency: extra, speed, measure } satisfies ScoreParts },
  };
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
