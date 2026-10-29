/**
 * The arcade scoring standard (29 Oct 2026, batch B; docs/arcade-standard.md).
 *
 * One scoring shape for an arcade game's standard revision:
 *
 *  - **core**: the game's main measure on a straight line, `max × min(value, fullAt) ÷ fullAt` (rounded down), so each
 *    step of better play adds about the same points; no curves, knots or rising scales. Where the game has no fixed
 *    maximum, `fullAt` is the near-perfect skill-band level's median, measured with scripts/arcade-skill-bands.ts;
 *  - **features**: fixed amounts (so much each, up to a cap, or a share of a cap);
 *  - the parts' maximums add up to exactly STD_TOTAL (200); anyone who plays scores at least 1, a run with no input 0.
 *
 * Each game's sim owns its parts (`<game>StdParts(state)`) and its spec (`<game>_STD_SPEC`, the same parts with their
 * maximums and help words); `standard/index.ts` lists them for the reveal, the help and arcade-standard-check.
 *
 * Integer maths only: the phone and the server must never round differently.
 */
import { clampInt } from "./engine";

/** Every standard revision's maximum (the parts' maximums sum to it). */
export const STD_TOTAL = 200;

/** One scored part of a run: what it measured, the points it earned and the most it can earn. */
export interface StdPart {
  /** Stable id (the spec's), e.g. "core", "perfects". */
  key: string;
  /** Short name, e.g. "Floors", "Perfect drops". */
  label: string;
  /** What this run did, e.g. "34 floors", "12 of 30 perfect". */
  detail: string;
  points: number;
  max: number;
}

/** A part as the help and the check know it: its maximum and one plain line on how it pays. */
export interface StdSpecPart {
  key: string;
  label: string;
  max: number;
  /** How it pays, e.g. "full at 34 floors", "3 each, up to 6". */
  how: string;
}

export interface StdSpec {
  /** The puzzle field and the revision that score on this spec. */
  field: string;
  rev: number;
  /** The core part first, then the features. */
  parts: readonly StdSpecPart[];
}

/** Core on a straight line: `max` at `fullAt`, rounded down, never above `max`. */
export function stdLinear(value: number, fullAt: number, max: number): number {
  const v = clampInt(Math.trunc(value), 0, fullAt);
  return Math.floor((max * v) / Math.max(1, fullAt));
}

/** A fixed amount for each one done, up to `max`. */
export function stdEach(count: number, each: number, max: number): number {
  return clampInt(Math.trunc(count) * each, 0, max);
}

/** A share of `max`: `done` of `of` (rounded down; `of` 0 gives 0). */
export function stdShare(done: number, of: number, max: number): number {
  if (of <= 0) return 0;
  return Math.floor((max * clampInt(Math.trunc(done), 0, of)) / of);
}

/** The sum of the parts' points. */
export function stdSum(parts: readonly StdPart[]): number {
  let total = 0;
  for (const p of parts) total += p.points;
  return total;
}

/** The sum of the parts' maximums (STD_TOTAL on every standard spec). */
export function stdMaxSum(parts: readonly { max: number }[]): number {
  let total = 0;
  for (const p of parts) total += p.max;
  return total;
}

/** The stored score: 0 with no input, else the parts' sum held to 1…STD_TOTAL (anyone who plays scores at least 1). */
export function stdScore(parts: readonly StdPart[], acted: boolean): number {
  if (!acted) return 0;
  return clampInt(stdSum(parts), 1, STD_TOTAL);
}

/** Reveal lines: one per part ("Floors: 34 floors → 140 of 140"), then the total; they add up to the stored score. */
export function stdLines(parts: readonly StdPart[], score: number, acted = true): string[] {
  if (!acted) return [`${parts[0]?.detail ?? "No input"} · no input → 0`];
  const lines = parts.map((p) => `${p.label}: ${p.detail} → ${p.points} of ${p.max}`);
  const sum = stdSum(parts);
  if (score !== sum) lines.push(sum < 1 ? `At least 1 for playing → ${score}` : `Total → ${score}`);
  else lines.push(`Total → ${score} of ${STD_TOTAL}`);
  return lines;
}

/** The "?" help SCORE text: every part with its maximum and how it pays, and that they total 200. */
export function stdHelp(spec: StdSpec, lead = ""): string {
  const parts = spec.parts.map((p) => `${p.label} up to ${p.max} (${p.how})`).join("; ");
  return `${lead ? `${lead} ` : ""}${parts}. Together ${stdMaxSum(spec.parts)} points.`;
}

/** Builds a part from its spec entry. */
export function stdPart(spec: StdSpec, key: string, points: number, detail: string): StdPart {
  const s = spec.parts.find((p) => p.key === key);
  if (!s) throw new Error(`arcadeStandard: ${spec.field} has no part ${key}`);
  return { key, label: s.label, detail, points: clampInt(points, 0, s.max), max: s.max };
}
