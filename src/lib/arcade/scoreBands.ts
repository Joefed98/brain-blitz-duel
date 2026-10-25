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
import { STRICT_BANDS } from "./strictBands.data";
import { DEFAULT_ROUND_MAX } from "../duel/roundMax";

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

/*
 * The clamps below take `max`, the most the score may be (DEFAULT_ROUND_MAX, 150, when left out, so
 * every revision scores exactly as before). A game raised to 200 (docs/scoring-200.md) passes its own
 * maximum (roundMaxFor) from its new revision's scoring only; older revisions keep the default.
 */

/** Finish games: curve points (to 140) plus the flat 10 for a full clear; 0…150. */
export function bandFinishFlat(curve: BandCurve, achieved: number, finished: boolean, max = DEFAULT_ROUND_MAX): number {
  return clampInt(bandPoints(curve, achieved) + (finished ? BAND_FINISH_BONUS : 0), 0, max);
}

/**
 * Finish games with a speed element: curve points plus, for a full clear, the
 * 50 % par speed curve over `window` ticks (the full 10 with at least half the
 * window left, falling evenly to 0 at the buzzer); 0…150.
 */
export function bandFinishSpeed(curve: BandCurve, achieved: number, finished: boolean, ticksLeft: number, window: number, max = DEFAULT_ROUND_MAX): number {
  const bonus = finished ? speedBonusCurve(BAND_FINISH_BONUS, clampInt(ticksLeft, 0, window), Math.max(1, window)) : 0;
  return clampInt(bandPoints(curve, achieved) + bonus, 0, max);
}

/** Open games: the curve itself, topping out at 150. */
export function bandOpen(curve: BandCurve, achieved: number, max = DEFAULT_ROUND_MAX): number {
  return clampInt(bandPoints(curve, achieved), 0, max);
}

/** The fewest whole units that reach `points` on a curve (its full-run figure if none short of it does). */
export function bandUnitsFor(curve: BandCurve, points: number): number {
  const top = bandTop(curve);
  for (let u = 0; u < top; u++) if (bandPoints(curve, u) >= points) return u;
  return top;
}

/** What the "?" help calls a good run: the middle of the "good" band (90–109; docs/scoring-targets.md, 19 Oct 2026). */
export const BAND_GOOD_POINTS = 100;

export interface BandHelpWords {
  /** The plain line's start, e.g. "More bricks" → "More bricks, higher score – up to 140." */
  more: string;
  /** What a good run does, given its unit count, e.g. (u) => `clears ${u} bricks`. Default: "counts u". */
  good?: (units: number) => string;
  /** The finish rule on finish games, e.g. "Clearing all 80 adds 10." */
  finish?: string;
}

/**
 * The "?" help SCORE text for a band game: what counts, one plain line (more of
 * it, higher score, and the top), what a good run takes, and the finish rule.
 * Every number comes from the curve, so it follows the revision passed in; `max` is the
 * game's round maximum (roundMax.ts), the finish line's top.
 */
export function bandHelp(units: string, curve: BandCurve, words: BandHelpWords, max = DEFAULT_ROUND_MAX): string {
  const top = curve.points[curve.points.length - 1]!;
  const n = (u: number) => u.toLocaleString("en-GB");
  const goodUnits = bandUnitsFor(curve, BAND_GOOD_POINTS);
  const good = `A good run (${BAND_GOOD_POINTS} points) ${words.good ? words.good(goodUnits) : `counts ${n(goodUnits)}`}.`;
  return words.finish
    ? `${units} ${words.more}, higher score – up to ${top}. ${good} ${words.finish} Up to ${max}.`
    : `${units} ${words.more}, higher score – ${top} at ${n(bandTop(curve))}. ${good}`;
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
export function bandTotal(parts: BandParts, acted: boolean, max = DEFAULT_ROUND_MAX): number {
  if (!acted) return 0;
  return clampInt(parts.points + parts.bonus - parts.penalty, 0, max);
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

/* ===================== Scoring targets (18 Oct 2026) ===================== */

/**
 * Joe's scoring targets (docs/scoring-targets.md): about 100 for an average run,
 * 120 a good one, 135 a great one, 140–150 near-perfect. The Oct 2026 bands aimed
 * at 70 / 100 / 125 / 140, so each game's new revision keeps its own unit knots
 * and lifts each knot's points through this map (straight lines between; 140
 * and 150 stay put, so finishes and the curve's top are unchanged).
 */
export const BAND_TARGET_MAP: BandCurve = bandCurve([0, 70, 100, 125, 140, 150], [0, 100, 120, 135, 140, 150]);
/** The `band` value a target-stamped state carries (1 = the Oct 2026 bands). */
export const BAND_TARGET_MARK = 2;

const retargeted = new WeakMap<BandCurve, BandCurve>();

/** A curve's knots with their points lifted through BAND_TARGET_MAP (rounded; same units). */
export function bandRetarget(curve: BandCurve): BandCurve {
  let out = retargeted.get(curve);
  if (!out) {
    const { units, points } = BAND_TARGET_MAP;
    const lift = (p: number) => {
      if (p >= 150) return p;
      let i = 1;
      while (units[i]! < p) i++;
      return Math.round(points[i - 1]! + ((points[i]! - points[i - 1]!) * (p - units[i - 1]!)) / (units[i]! - units[i - 1]!));
    };
    out = bandCurve(curve.units, curve.points.map(lift));
    retargeted.set(curve, out);
  }
  return out;
}

/** The curve a state scores on: its game's curve, lifted on target-stamped states (band 2), strict on band 3. */
export function bandCurveOf(state: BandFields, curve: BandCurve): BandCurve {
  if (state.band === BAND_STRICT_MARK) return bandStrict(curve);
  return state.band === BAND_TARGET_MARK ? bandRetarget(curve) : curve;
}

/* ====================== Score bands (19 Oct 2026) ====================== */

/**
 * Joe's score bands (docs/scoring-targets.md): perfect 150 only, near perfect 130–149, great 110–129, good
 * 90–109, decent 80–89, average 60–79, smoothly down to 0. Each game's band-3 revision keeps its play and its
 * achievement units and scores on its own strict curve (strictBands.data.ts, fitted by
 * scripts/arcade-bands-fit.ts so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140), found by the base curve the sim passes to bandCurveOf.
 */
export const BAND_STRICT_MARK = 3;

/** A curve's identity for the strict table: its knots as text. */
export function bandFingerprint(curve: BandCurve): string {
  return `${curve.units.join(",")}|${curve.points.join(",")}`;
}

const strictByBase = new Map<string, BandCurve>();
for (const entry of Object.values(STRICT_BANDS)) strictByBase.set(entry.base, bandCurve(entry.units, entry.points));
const strictCache = new WeakMap<BandCurve, BandCurve>();

/**
 * The strict curve for a base curve. A base with no strict curve is a programming error (a band-3 game must
 * have its row); it scores on the band-2 lift rather than throwing mid-run, and scoring-bands-check fails on it.
 */
export function bandStrict(curve: BandCurve): BandCurve {
  let out = strictCache.get(curve);
  if (!out) {
    out = strictByBase.get(bandFingerprint(curve)) ?? bandRetarget(curve);
    strictCache.set(curve, out);
  }
  return out;
}

/** True when a base curve has its strict row. */
export function bandHasStrict(curve: BandCurve): boolean {
  return strictByBase.has(bandFingerprint(curve));
}

/** A band game whose new rounds score on its strict curve: the same play, `band` 3 from the first tick. */
export function bandStrictGame<G extends { init: (seed: number) => object }>(game: G): G {
  return { ...game, init: (seed: number) => ({ ...game.init(seed), band: BAND_STRICT_MARK }) };
}

/** Engine games (no band curve): the total itself mapped through a knot curve (0 → 0, flat past the top). */
export function bandMapTotal(map: BandCurve, total: number, max = DEFAULT_ROUND_MAX): number {
  return clampInt(bandPoints(map, total), 0, max);
}

/** A band game whose new rounds score on the targets: the same play, `band` 2 from the first tick. */
export function bandTargetGame<G extends { init: (seed: number) => object }>(game: G): G {
  return { ...game, init: (seed: number) => ({ ...game.init(seed), band: BAND_TARGET_MARK }) };
}
