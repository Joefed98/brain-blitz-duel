/**
 * The arcade scoring standard (29 Oct 2026, docs/arcade-standard-oct-2026.md), shared by every game moved onto it.
 *
 * One shape for every game: the core (the game's main measure) pays on a STRAIGHT LINE from 0 to its maximum,
 * full at a fixed count (a fixed maximum, or the near-perfect level's median where there is none), so each step
 * of better play adds about the same points; each feature pays a fixed share of its own maximum for each item
 * (no rising scales, no skill-points curves); speed counts only on a completed run. The parts' maximums sum to
 * exactly 200 (STD_MAX). Anyone who plays (any input) scores at least 1; mistakes cost what each game says;
 * a run with no input scores 0 as before.
 *
 * Integer only (the sims are deterministic and integer): a part is floor(max × got ÷ of), so it reaches its
 * maximum exactly when every item is taken, and a perfect run adds up to exactly 200.
 */
import { clampInt } from "./engine";
import type { BandParts } from "./scoreBands";

/** Every standard game scores to this (ROUND_MAX's 200 for every game moved onto the standard). */
export const STD_MAX = 200;

/** One scoring part: the core or a feature, with its maximum and, for a feature, the items it is split over. */
export interface StdPartSpec {
  key: string;
  /** Plain words for the reveal and help, e.g. "Coins". */
  label: string;
  max: number;
  /** Items the maximum is split over (a feature's count, or the core's full figure). */
  of: number;
  /** The help's words for one item, e.g. "coin" (pluralised with an "s" unless `items` is given). */
  item?: string;
  items?: string;
}

/** A game's standard: the core and its features, each with its maximum (they sum to STD_MAX). */
export interface StdSpec {
  core: StdPartSpec;
  features: readonly StdPartSpec[];
}

/** A part's points: max × got ÷ of on a straight line, floored, never above max or below 0. */
export function stdLine(max: number, got: number, of: number): number {
  if (of <= 0) return 0;
  const g = clampInt(Math.trunc(got), 0, of);
  return Math.floor((max * g) / of);
}

/**
 * A speed part (only ever called on a completed run): full at `fullAt` or better, 0 at `zeroAt`, a straight line
 * between. Either direction works (time left: fullAt > zeroAt; time taken: fullAt < zeroAt).
 */
export function stdSpeed(max: number, value: number, fullAt: number, zeroAt: number): number {
  if (fullAt === zeroAt) return value === fullAt ? max : 0;
  const share = (value - zeroAt) / (fullAt - zeroAt);
  if (share >= 1) return max;
  if (share <= 0) return 0;
  return Math.floor(max * share);
}

/** The sum of a spec's maximums (STD_MAX on every standard game; arcade-standard-check proves it). */
export function stdSpecMax(spec: StdSpec): number {
  return spec.core.max + spec.features.reduce((a, f) => a + f.max, 0);
}

/** One run's standard breakdown: the core's points and each feature's, and any mistakes' cost. */
export interface StdScore {
  core: number;
  /** Each feature's points, keyed as the spec. */
  features: Record<string, number>;
  /** What mistakes cost (a positive number). */
  penalty: number;
}

/** The score a breakdown adds up to: 0 with no input at all, else at least 1 and at most STD_MAX. */
export function stdTotal(score: StdScore, acted: boolean): number {
  if (!acted) return 0;
  const sum = score.core + Object.values(score.features).reduce((a, p) => a + p, 0) - score.penalty;
  return clampInt(sum, 1, STD_MAX);
}

/**
 * A standard breakdown as BandParts (the arcade reveal, the band tables and the bots read these): the core as
 * the curve's points, the features as one bonus line naming each part that paid, the mistakes as the penalty.
 */
export function stdBandParts(
  spec: StdSpec,
  score: StdScore,
  units: number,
  text: string,
  finished: boolean,
  penaltyText?: string,
): BandParts {
  const paid = spec.features.filter((f) => (score.features[f.key] ?? 0) > 0);
  const bonus = paid.reduce((a, f) => a + (score.features[f.key] ?? 0), 0);
  return {
    units,
    points: score.core,
    bonus,
    penalty: score.penalty,
    finished,
    text,
    bonusText: paid.map((f) => `${f.label} ${score.features[f.key]}`).join(" · ") || "Features",
    penaltyText,
  };
}

const plural = (p: StdPartSpec) => p.items ?? `${p.item ?? p.label.toLowerCase()}s`;
const each = (p: StdPartSpec) => {
  const v = p.max / p.of;
  return Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString();
};

/**
 * The help's feature sentence: "Coins up to 30 (1.5 each of 20), …; the parts total 200." A feature with
 * `of: 1` is stated as its maximum alone.
 */
export function stdFeaturesHelp(spec: StdSpec, extra?: Record<string, string>): string {
  const parts = spec.features.map((f) => {
    if (extra?.[f.key]) return `${f.label} up to ${f.max} (${extra[f.key]})`;
    if (f.of === 1) return `${f.label} ${f.max}`;
    return `${f.label} up to ${f.max} (${each(f)} each of ${f.of} ${plural(f)})`;
  });
  return `${parts.join(", ")}. Core ${spec.core.max} and the features ${stdSpecMax(spec) - spec.core.max}: the parts total ${stdSpecMax(spec)}.`;
}
