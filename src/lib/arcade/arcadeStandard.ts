/**
 * The arcade scoring standard (29 Oct 2026; docs/arcade-standard/README.md): the one helper every arcade game moved
 * onto it shares (batches A, B and C and Grappler's swingRev 15 were built separately and combined here).
 *
 * One shape for every game:
 *
 *  - **core**: the game's main measure on a STRAIGHT LINE from 0 to its maximum, full at a fixed count (a fixed
 *    maximum, or the near-perfect skill-band level's median where there is none, measured with
 *    scripts/arcade-skill-bands.ts), so each step of better play adds about the same points; no curves, knots or
 *    rising scales;
 *  - **features**: fixed amounts (so much each up to a cap, or an equal share of a cap for each item); speed counts
 *    only on a completed run;
 *  - the parts' maximums add up to exactly STD_MAX (200); mistakes cost what each game says; anyone who plays (any
 *    input) scores at least 1, a run with no input 0.
 *
 * Each game's sim owns its parts and its spec (`field`, `rev` and the parts, core first); scripts/arcade-standard/
 * holds one arcade-standard-check entry per game.
 *
 * Integer maths only (the phone and the server must never round differently): a part is floor(max × got ÷ of), so it
 * reaches its maximum exactly when every item is taken, and a perfect run adds up to exactly 200.
 */
import { clampInt } from "./engine";
import type { BandParts } from "./scoreBands";

/** Every standard revision's maximum (ROUND_MAX's 200; the parts' maximums sum to it). */
export const STD_MAX = 200;

/** One part as the spec knows it: the core or a feature, with its maximum and how the help states it. */
export interface StdSpecPart {
  /** Stable id; the core's is "core". */
  key: string;
  /** Plain words for the reveal and help, e.g. "Coins". */
  label: string;
  max: number;
  /** Items the maximum is split over (a feature's count, or the core's full figure), where the game states one. */
  of?: number;
  /** The help's words for one item, e.g. "coin" (pluralised with an "s" unless `items` is given). */
  item?: string;
  items?: string;
  /** How it pays in one plain line, e.g. "full at 34 floors", "3 each, up to 6". */
  how?: string;
}

/** A game's standard: the puzzle field and revision that score on it, and its parts (the core first). */
export interface StdSpec {
  field: string;
  rev: number;
  parts: readonly StdSpecPart[];
}

/** The spec's core part (its first). */
export function stdCore(spec: StdSpec): StdSpecPart {
  return spec.parts[0]!;
}

/** The spec's features (every part after the core). */
export function stdFeatures(spec: StdSpec): readonly StdSpecPart[] {
  return spec.parts.slice(1);
}

/** The spec's part `key` (throws on a key the spec does not have: a programming error, caught by the checks). */
export function stdSpecPart(spec: StdSpec, key: string): StdSpecPart {
  const p = spec.parts.find((q) => q.key === key);
  if (!p) throw new Error(`arcadeStandard: ${spec.field} has no part ${key}`);
  return p;
}

/** A part's points on a straight line: max × got ÷ of, floored, never above max or below 0 (`of` 0 gives 0). */
export function stdLine(max: number, got: number, of: number): number {
  if (of <= 0) return 0;
  const g = clampInt(Math.trunc(got), 0, of);
  return Math.floor((max * g) / of);
}

/** A spec part's points on its straight line (the part must state `of`). */
export function stdPartLine(part: StdSpecPart, got: number): number {
  if (part.of === undefined) throw new Error(`arcadeStandard: part ${part.key} states no item count`);
  return stdLine(part.max, got, part.of);
}

/** A fixed amount for each one done, up to `max`. */
export function stdEach(count: number, each: number, max: number): number {
  return clampInt(Math.trunc(count) * each, 0, max);
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

/** The sum of a spec's (or a parts list's) maximums: STD_MAX on every standard game (arcade-standard-check proves it). */
export function stdSpecMax(spec: StdSpec | readonly { max: number }[]): number {
  const parts = "parts" in spec ? spec.parts : spec;
  let total = 0;
  for (const p of parts) total += p.max;
  return total;
}

/** The stored score from the parts' sum: 0 with no input at all, else held to 1…STD_MAX (anyone who plays scores 1+). */
export function stdFinal(sum: number, acted: boolean): number {
  if (!acted) return 0;
  return clampInt(sum, 1, STD_MAX);
}

/* ---- A run's parts as a list (each with what the run did): the reveal's breakdown lines. ---- */

/** One scored part of a run: what it measured, the points it earned and the most it can earn. */
export interface StdPart {
  key: string;
  label: string;
  /** What this run did, e.g. "34 floors", "12 of 30 perfect". */
  detail: string;
  points: number;
  max: number;
}

/** Builds a run's part from its spec entry (points held to 0…max). */
export function stdPart(spec: StdSpec, key: string, points: number, detail: string): StdPart {
  const s = stdSpecPart(spec, key);
  return { key, label: s.label, detail, points: clampInt(points, 0, s.max), max: s.max };
}

/** The sum of the parts' points. */
export function stdSum(parts: readonly StdPart[]): number {
  let total = 0;
  for (const p of parts) total += p.points;
  return total;
}

/** The stored score of a parts list (stdFinal of their sum). */
export function stdScore(parts: readonly StdPart[], acted: boolean): number {
  return stdFinal(stdSum(parts), acted);
}

/** Reveal lines: one per part ("Floors: 34 floors → 140 of 140"), then the total; they add up to the stored score. */
export function stdLines(parts: readonly StdPart[], score: number, acted = true): string[] {
  if (!acted) return [`${parts[0]?.detail ?? "No input"} · no input → 0`];
  const lines = parts.map((p) => `${p.label}: ${p.detail} → ${p.points} of ${p.max}`);
  const sum = stdSum(parts);
  if (score !== sum) lines.push(sum < 1 ? `At least 1 for playing → ${score}` : `Total → ${score}`);
  else lines.push(`Total → ${score} of ${STD_MAX}`);
  return lines;
}

/**
 * The "?" help SCORE text from each part's `how` (text pass, 4 Nov 2026): one line per part, "Label: how, up to N.",
 * then `after` (penalties and notes, plain sentences), then "Total 200." The help draws it a sentence a row.
 */
export function stdHelp(spec: StdSpec, after = ""): string {
  return `${stdHelpLines(spec)}${after ? ` ${after}` : ""} Total ${stdSpecMax(spec)}.`;
}

/** The help's part lines alone ("Label: how, up to N." for each part), without any note or the total. */
export function stdHelpLines(spec: StdSpec): string {
  return spec.parts.map((p) => `${p.label}: ${p.how ? `${p.how}, ` : ""}up to ${p.max}.`).join(" ");
}

/* ---- A run's parts as a breakdown (core points, each feature's, the mistakes' cost): the band tables and bots. ---- */

/** One run's standard breakdown: the core's points and each feature's, and any mistakes' cost. */
export interface StdBreakdown {
  core: number;
  /** Each feature's points, keyed as the spec. */
  features: Record<string, number>;
  /** What mistakes cost (a positive number). */
  penalty: number;
}

/** The score a breakdown adds up to (stdFinal of core + features − penalty). */
export function stdTotal(score: StdBreakdown, acted: boolean): number {
  return stdFinal(score.core + Object.values(score.features).reduce((a, p) => a + p, 0) - score.penalty, acted);
}

/**
 * A breakdown as BandParts (the arcade reveal, the band tables and the bots read these): the core as the curve's
 * points, the features as one bonus line naming each part that paid, the mistakes as the penalty.
 */
export function stdBandParts(spec: StdSpec, score: StdBreakdown, units: number, text: string, finished: boolean, penaltyText?: string): BandParts {
  const paid = stdFeatures(spec).filter((f) => (score.features[f.key] ?? 0) > 0);
  const bonus = paid.reduce((a, f) => a + (score.features[f.key] ?? 0), 0);
  return {
    units,
    points: score.core,
    bonus,
    penalty: score.penalty,
    finished,
    text,
    bonusText: paid.map((f) => `${f.label} ${score.features[f.key]}`).join(" · ") || "Features",
    ...(penaltyText === undefined ? {} : { penaltyText }),
  };
}

const plural = (p: StdSpecPart) => p.items ?? `${p.item ?? p.label.toLowerCase()}s`;
const each = (p: StdSpecPart) => {
  const v = p.max / (p.of ?? 1);
  return Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString();
};

/**
 * The help's feature sentence from each feature's `of`: "Coins up to 30 (1.5 each of 20 coins), …; the parts total
 * 200." A feature with `of: 1` is stated as its maximum alone; `extra` words a feature its own way.
 */
export function stdFeaturesHelp(spec: StdSpec, extra?: Record<string, string>): string {
  const core = stdCore(spec);
  const parts = stdFeatures(spec).map((f) => {
    if (extra?.[f.key]) return `${f.label} up to ${f.max} (${extra[f.key]})`;
    if (f.of === 1) return `${f.label} ${f.max}`;
    return `${f.label} up to ${f.max} (${each(f)} each of ${f.of} ${plural(f)})`;
  });
  return `${parts.join(", ")}. Core ${core.max} and the features ${stdSpecMax(spec) - core.max}: the parts total ${stdSpecMax(spec)}.`;
}
