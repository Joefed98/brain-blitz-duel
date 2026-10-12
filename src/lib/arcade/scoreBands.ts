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

/** "a → p" pairs for the "?" help, e.g. "1 → 14, 5 → 80, 10 → 140". */
export function bandKnotText(curve: BandCurve, unit = ""): string {
  return curve.units
    .map((u, i) => [u, curve.points[i]!] as const)
    .filter(([u]) => u > 0)
    .map(([u, p]) => `${u.toLocaleString("en-GB")}${unit} → ${p}`)
    .join(", ");
}
