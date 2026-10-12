/**
 * Oct 2026 arcade score bands: one scoring shape for every active arcade game.
 *
 * A game counts its achievement in whole units (buckets, bricks, metres, match
 * points…). A band curve turns units into points: straight lines between a few
 * fixed knots, starting at (0, 0) and rising to the curve's top at the game's
 * full-run figure, so more achievement never scores less and nothing scores 0.
 * Finish games top out at 140 and add a finish bonus of up to 10 (a flat 10, or
 * the 50 % par speed curve) for a full clear; open games (no finish) top out at
 * 150. The knots were fitted so the same simulated skill level lands in a
 * similar band in every game (scripts/arcade-skill-bands.ts, docs/arcade-score-bands-oct-2026.md).
 *
 * Integer maths only: the phone and the server must never round differently.
 */
import { clampInt } from "./engine";
import { speedBonusCurve } from "../duel/speedPar";

/** Knots: units ascending from 0, points ascending from 0. */
export interface BandCurve {
  readonly units: readonly number[];
  readonly points: readonly number[];
}

/** Partial credit tops out here on finish games; the finish bonus adds the rest. */
export const BAND_PARTIAL_TOP = 140;
export const BAND_FINISH_BONUS = 10;

export function bandCurve(units: readonly number[], points: readonly number[]): BandCurve {
  return { units, points };
}

/** Points for `achieved` units on a curve: floor of the straight line between the knots either side. */
export function bandPoints(curve: BandCurve, achieved: number): number {
  const { units, points } = curve;
  const a = Math.trunc(achieved);
  if (a <= 0) return 0;
  const last = units.length - 1;
  if (a >= units[last]!) return points[last]!;
  let i = 1;
  while (units[i]! < a) i++;
  const u0 = units[i - 1]!;
  const u1 = units[i]!;
  const p0 = points[i - 1]!;
  const p1 = points[i]!;
  return p0 + Math.floor(((p1 - p0) * (a - u0)) / (u1 - u0));
}

/** The full-run unit count of a curve (its last knot). */
export function bandTop(curve: BandCurve): number {
  return curve.units[curve.units.length - 1]!;
}

/** Finish games: curve points (to 140) plus the flat 10 for a full clear; 0…150. */
export function bandFinishFlat(curve: BandCurve, achieved: number, finished: boolean): number {
  return clampInt(bandPoints(curve, achieved) + (finished ? BAND_FINISH_BONUS : 0), 0, 150);
}

/**
 * Finish games with a speed element: curve points plus, for a full clear, the
 * 50 % par speed curve over `window` ticks (the full 10 with at least half the
 * window left, falling evenly to 0 at the buzzer); 0…150.
 */
export function bandFinishSpeed(curve: BandCurve, achieved: number, finished: boolean, ticksLeft: number, window: number): number {
  const bonus = finished ? speedBonusCurve(BAND_FINISH_BONUS, clampInt(ticksLeft, 0, window), Math.max(1, window)) : 0;
  return clampInt(bandPoints(curve, achieved) + bonus, 0, 150);
}

/** Open games: the curve itself, topping out at 150. */
export function bandOpen(curve: BandCurve, achieved: number): number {
  return clampInt(bandPoints(curve, achieved), 0, 150);
}

/** The "?" help SCORE text for a band game: what counts, the curve's knots, and the finish rule. */
export function bandHelp(units: string, curve: BandCurve, finish?: string): string {
  const top = curve.points[curve.points.length - 1]!;
  const knots = `Points follow ${bandKnotText(curve)}, in straight lines between`;
  return finish ? `${units} ${knots} (up to ${top}). ${finish} Up to 150.` : `${units} ${knots}: 150 at ${bandTop(curve).toLocaleString("en-GB")}.`;
}

/** "a → p" pairs for the "?" help, e.g. "1 → 14, 5 → 80, 10 → 140". */
export function bandKnotText(curve: BandCurve, unit = ""): string {
  return curve.units
    .map((u, i) => [u, curve.points[i]!] as const)
    .filter(([u]) => u > 0)
    .map(([u, p]) => `${u.toLocaleString("en-GB")}${unit} → ${p}`)
    .join(", ");
}

/* ============================ Stamped states ============================ */

/**
 * Fields a band-stamped state carries (absent on every earlier round, so those
 * replay byte-for-byte). `band` marks the Oct 2026 rules; `acted` turns 1 on
 * the first tick with a player input, and a run with none scores 0.
 */
export interface BandFields {
  band?: number;
  acted?: number;
}

export const BAND_REV_MARK = 1;

function isInput(input: unknown): boolean {
  return input !== null && input !== undefined && input !== false;
}

/**
 * Wraps a sim's step: on a band-stamped state it carries `band` forward and
 * sets `acted` once an input arrives; `track` may add more band-only facts.
 * Unstamped states pass straight through, untouched.
 */
export function bandStep<S, I>(step: (state: S, input: I) => S, track?: (prev: S, next: S) => S): (state: S, input: I) => S {
  return (state: S, input: I): S => {
    const next = step(state, input);
    const prev = state as S & BandFields;
    if (!prev.band || next === state) return next;
    const acted = prev.acted || isInput(input) ? 1 : 0;
    let out = next as S & BandFields;
    if (out.band !== prev.band || (out.acted ?? 0) !== acted) out = { ...out, band: prev.band, acted };
    return track ? track(state, out) : out;
  };
}

/** Wraps a sim's score: band-stamped states score by `band`, every other state by the original rule. */
export function bandScoreOf<S>(original: (state: S) => number, band: (state: S) => number): (state: S) => number {
  return (state: S) => ((state as S & BandFields).band ? band(state) : original(state));
}

/** Marks an initial state as band-stamped. */
export function bandInit<S>(state: S): S {
  return { ...state, band: BAND_REV_MARK, acted: 0 };
}

/** One game's band score, broken down for the reveal. */
export interface BandParts {
  /** Achievement units and the points the curve gives them. */
  units: number;
  points: number;
  /** Finish bonus earned (0 when not finished or an open game). */
  bonus: number;
  /** Penalty taken after the curve (e.g. Slice chillies), as a positive number. */
  penalty: number;
  finished: boolean;
  /** Plain words for the achievement, e.g. "7 / 10 buckets · 2 hoops". */
  text: string;
  /** Plain words for the finish bonus, e.g. "all 10 in". */
  bonusText?: string;
  penaltyText?: string;
}

/** The score a breakdown adds up to; no input at all scores 0. */
export function bandTotal(parts: BandParts, acted: boolean): number {
  if (!acted) return 0;
  return clampInt(parts.points + parts.bonus - parts.penalty, 0, 150);
}

/** Reveal lines for a breakdown (they always add up to the stored score). */
export function bandLines(parts: BandParts, score: number, acted = true): string[] {
  if (!acted) return [`${parts.text} · no input → 0`];
  const lines = [`${parts.text} → ${parts.points}`];
  if (parts.bonus > 0) lines.push(`${parts.bonusText ?? "Finished"} +${parts.bonus}`);
  if (parts.penalty > 0) lines.push(`${parts.penaltyText ?? "Penalty"} −${parts.penalty}`);
  if (score !== parts.points) lines.push(`Total → ${score}`);
  return lines;
}
