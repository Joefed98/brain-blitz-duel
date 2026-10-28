/**
 * The scoring standard's Number rules shared by the phone and the server (docs/scoring-standard.md, "Number decisions"):
 * each game's numbers (speed, "full by" time, bonus sizes) for the grader (number.server.ts) and the help texts
 * (numberText.ts), Exact's closeness curve, Ballpark's accuracy and bullseyes, and which Checkout boards pay the big
 * finish. Pure; floats only where a score is rounded at the end.
 */
import { checkoutBigFinish, checkoutDartValue, checkoutOptions } from "../checkout";
import type { CheckoutStageData, PuzzleType } from "../types";

/** Each Number game's split of the 50 above 150 (seconds are seconds used on the game's real clock). */
export interface NumberStandardGame {
  speed: number;
  fullByS: number;
  /** The bonus's size (the most it pays). */
  bonus: number;
}

export const NUMBER_STANDARD: Readonly<Partial<Record<PuzzleType, NumberStandardGame>>> = {
  target: { speed: 35, fullByS: 30, bonus: 15 },
  equation: { speed: 40, fullByS: 60, bonus: 10 },
  balance: { speed: 35, fullByS: 60, bonus: 15 },
  numpyramid: { speed: 40, fullByS: 75, bonus: 10 },
  trail: { speed: 40, fullByS: 60, bonus: 10 },
  measure: { speed: 35, fullByS: 60, bonus: 15 },
  checkout: { speed: 30, fullByS: 60, bonus: 20 },
  numline: { speed: 20, fullByS: 60, bonus: 30 },
};

/* ------------------------------------------------------------------ per-part credit */

/** Operator, Counterweight, Brimful: points per equation / scale / puzzle, and the most each part's "how early" adds. */
export const NUMBER_PART_POINTS = 30;
export const NUMBER_PART_EARLY = 2.5;
/** Checkout: points per board and its early extra. */
export const CHECKOUT_STD_BOARD = 24;
export const CHECKOUT_STD_EARLY = 2;
/** Integer Pyramid and Trail: the most progress pays, and the early extras over all parts. */
export const NUMBER_SHARE_POINTS = 120;
export const NUMBER_SHARE_EARLY = 10;
/** Operator and Integer Pyramid: clean points per equation / pyramid (up to 10). */
export const NUMBER_CLEAN_EACH = 2.5;

/* ------------------------------------------------------------------ Exact */

/** Exact's elegance: 15 using the fewest numbers the target needs, 5 less per number more. */
export const EXACT_STD_ELEGANCE = 15;
export const EXACT_STD_ELEGANCE_PER = 5;
/**
 * Exact, not exact: the closest any number made came to the target earns EXACT_STD_CLOSE × EXACT_STD_FALL ^ distance
 * (off by 1 about 120, 5 away 90, 10 away 62, 20 away 30, 40 away 7, nothing from about 70 away). Random steps rarely
 * come within 20 of a three-digit target (scripts/standard-number-check.ts).
 */
export const EXACT_STD_CLOSE = 129;
export const EXACT_STD_FALL = 0.93;

export function exactCloseCredit(distance: number | null): number {
  if (distance === null || !Number.isFinite(distance) || distance < 0) return 0;
  return EXACT_STD_CLOSE * Math.pow(EXACT_STD_FALL, Math.max(1, distance));
}

/* ------------------------------------------------------------------ Ballpark */

/** Accuracy per number: full within 2 % of the line's length, falling evenly to 0 at 15 %. */
export const BALLPARK_STD_FULL = 0.02;
export const BALLPARK_STD_ZERO = 0.15;
/** A bullseye: within 1 % of the line's length; 2 each, up to 30. */
export const BALLPARK_STD_BULLSEYE = 0.01;
export const BALLPARK_STD_BULL_POINTS = 2;
export const BALLPARK_STD_BULL_MAX = 30;
/** Unfinished: up to 8 per number by its accuracy, and up to 10 early over the 15 numbers (also by accuracy). */
export const BALLPARK_STD_ITEM = 8;
export const BALLPARK_STD_EARLY = 10;
/** Unfinished: a number this far off (or more) costs 1, as today. */
export const BALLPARK_STD_WILD = 0.25;

export function ballparkAccuracy(error: number | null | undefined): number {
  if (typeof error !== "number" || !Number.isFinite(error)) return 0;
  if (error <= BALLPARK_STD_FULL) return 1;
  if (error >= BALLPARK_STD_ZERO) return 0;
  return (BALLPARK_STD_ZERO - error) / (BALLPARK_STD_ZERO - BALLPARK_STD_FULL);
}

export function isStdBullseye(error: number | null | undefined): boolean {
  return typeof error === "number" && Number.isFinite(error) && error <= BALLPARK_STD_BULLSEYE;
}

/* ------------------------------------------------------------------ Checkout */

/** Checkout's fewest-darts part (full at the fewest total darts, 0 at twice) and the big-finish part. */
export const CHECKOUT_STD_FEWEST = 10;
export const CHECKOUT_STD_BIG = 10;
/** A board pays the big finish when its checkout is 100 or more and a big finish can end it. */
export const CHECKOUT_STD_BIG_TARGET = 100;

const bigCache = new Map<string, boolean>();

/** True when the board's darts can end on a big finish at all (any route, the board's own dart rule). */
export function checkoutBigFinishReachable(stage: CheckoutStageData): boolean {
  if (!stage.bigFinish) return false;
  const key = JSON.stringify([stage.target, stage.maxDarts, stage.exactDarts ?? false, stage.finish, stage.quad ?? false, stage.wedges]);
  const hit = bigCache.get(key);
  if (hit !== undefined) return hit;
  const options = checkoutOptions(stage);
  const memo = new Map<number, boolean>();
  const can = (left: number, used: number): boolean => {
    if (used >= stage.maxDarts) return false;
    const id = left * 8 + used;
    const known = memo.get(id);
    if (known !== undefined) return known;
    let ok = false;
    for (const dart of options) {
      const v = checkoutDartValue(stage, dart);
      if (v <= 0) continue;
      if (v === left && checkoutBigFinish(stage, dart) && (!stage.exactDarts || used + 1 === stage.maxDarts)) ok = true;
      else if (v < left && can(left - v, used + 1)) ok = true;
      if (ok) break;
    }
    memo.set(id, ok);
    return ok;
  };
  const out = can(stage.target, 0);
  if (bigCache.size > 256) bigCache.clear();
  bigCache.set(key, out);
  return out;
}

/** The boards whose big finish pays (the 10 is split evenly across them): a 100+ checkout a big finish can end. */
export function checkoutBigBoards(stages: readonly CheckoutStageData[]): boolean[] {
  return stages.map((stage) => stage.target >= CHECKOUT_STD_BIG_TARGET && checkoutBigFinishReachable(stage));
}
