/**
 * Checkout rules shared by the phone, the server grader and the generator.
 *
 * A dart is a wedge (0–19 clockwise from the top, 20 = bull) and a ring
 * multiplier (1 single, 2 double, 3 treble, 4 the thin x4 ring where a board
 * has one). The bull scores 25 as a single (outer bull) and 50 as a double
 * (inner bull), as in real darts; it has no treble or x4. A stage is solved by
 * darts that bring its target to exactly zero, within its dart limit (or with
 * exactly that many darts where the stage says so), the last dart landing in
 * the stage's finishing ring.
 */
import { isBigFinishDart } from "./numberDepth";
import { finishParts, partialParts, scoreRev1, PUZZLE_SPEED_POINTS } from "./puzzleScoreRev";
import { speedBonusCurve } from "./speedPar";
import type { CheckoutStageData } from "./types";

export const CHECKOUT_REV = 1;
/**
 * checkoutRev 2 (25 Oct 2026, depthRev 1, numberDepth.ts): every stage may also check out on a big finish, the
 * Bull or (on a double-finish board) a treble, for the big-finish bonus (`bigFinish` on each stage).
 */
export const CHECKOUT_REV_BIG_FINISH = 2;
export const CHECKOUT_STAGES = 5;
export const CHECKOUT_BULL = 20;
export const CHECKOUT_BULL_VALUE = 25;
export const CHECKOUT_WEIGHTS = [18, 20, 22, 24, 26] as const;
/** Puzzle score rev 1 unfinished weights: the best four sum to 110. */
export const CHECKOUT_REV1_WEIGHTS = [22, 24, 26, 28, 32] as const;
export const CHECKOUT_MIN_DART_POINTS = 2;
export const CHECKOUT_SPEED_POINTS = 30;
/** The standard board, clockwise from the top. */
export const CHECKOUT_STANDARD = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

export interface CheckoutDart {
  wedge: number;
  ring: number;
}

export function checkoutDartAllowed(stage: CheckoutStageData, dart: CheckoutDart): boolean {
  if (!Number.isInteger(dart.wedge) || !Number.isInteger(dart.ring)) return false;
  if (dart.wedge === CHECKOUT_BULL) return dart.ring === 1 || dart.ring === 2;
  if (dart.wedge < 0 || dart.wedge >= stage.wedges.length) return false;
  return dart.ring >= 1 && dart.ring <= (stage.quad ? 4 : 3);
}

export function checkoutDartValue(stage: CheckoutStageData, dart: CheckoutDart): number {
  const base = dart.wedge === CHECKOUT_BULL ? CHECKOUT_BULL_VALUE : (stage.wedges[dart.wedge] ?? 0);
  return base * dart.ring;
}

/** Every dart the board allows, in a fixed order. */
export function checkoutOptions(stage: CheckoutStageData): CheckoutDart[] {
  const out: CheckoutDart[] = [];
  const rings = stage.quad ? 4 : 3;
  for (let wedge = 0; wedge < stage.wedges.length; wedge++)
    for (let ring = 1; ring <= rings; ring++) out.push({ wedge, ring });
  out.push({ wedge: CHECKOUT_BULL, ring: 1 }, { wedge: CHECKOUT_BULL, ring: 2 });
  return out;
}

export function checkoutRemaining(
  stage: CheckoutStageData,
  darts: readonly CheckoutDart[],
): number {
  return darts.reduce((left, dart) => left - checkoutDartValue(stage, dart), stage.target);
}

/** True when this dart may end the stage: the finishing ring, or (checkoutRev 2) a big finish. */
export function checkoutFinisher(stage: CheckoutStageData, dart: CheckoutDart): boolean {
  return dart.ring === stage.finish || (stage.bigFinish === true && isBigFinishDart(stage.finish, dart, CHECKOUT_BULL));
}

/** True when this dart ends the stage on a big finish (checkoutRev 2 boards only). */
export function checkoutBigFinish(stage: CheckoutStageData, dart: CheckoutDart | undefined): boolean {
  return !!dart && stage.bigFinish === true && isBigFinishDart(stage.finish, dart, CHECKOUT_BULL);
}

/** True when these darts check out: exactly zero, right count, last dart in the finishing ring (or a big finish). */
export function checkoutValid(stage: CheckoutStageData, darts: readonly CheckoutDart[]): boolean {
  if (!darts.length || darts.length > stage.maxDarts) return false;
  if (stage.exactDarts && darts.length !== stage.maxDarts) return false;
  if (!darts.every((dart) => checkoutDartAllowed(stage, dart))) return false;
  return checkoutRemaining(stage, darts) === 0 && checkoutFinisher(stage, darts[darts.length - 1]!);
}

export function encodeCheckoutDarts(darts: readonly CheckoutDart[]): string {
  return darts.map((dart) => `${dart.wedge}:${dart.ring}`).join(",");
}

/** Reads at most `limit + 1` darts, so an over-long list stays invalid rather than trimmed. */
export function decodeCheckoutDarts(raw: string, limit: number): CheckoutDart[] {
  const out: CheckoutDart[] = [];
  for (const part of String(raw ?? "").split(",")) {
    if (out.length > limit) break;
    const match = /^(\d{1,2}):(\d)$/.exec(part.trim());
    if (match) out.push({ wedge: Number(match[1]), ring: Number(match[2]) });
  }
  return out;
}

/** Round answer: one dart list per stage joined by "|"; an empty segment is an unsolved stage. */
export function splitCheckoutRound(raw: string | null | undefined): string[] {
  const parts = String(raw ?? "").split("|");
  return Array.from({ length: CHECKOUT_STAGES }, (_, i) => parts[i] ?? "");
}

export function joinCheckoutRound(parts: readonly string[]): string {
  return Array.from({ length: CHECKOUT_STAGES }, (_, i) => parts[i] ?? "").join("|");
}

/** Short dart label: S20, D16, T19, Q12, 25, Bull. */
export function checkoutDartLabel(stage: CheckoutStageData, dart: CheckoutDart): string {
  if (dart.wedge === CHECKOUT_BULL) return dart.ring === 2 ? "Bull" : "25";
  const prefix = ["", "S", "D", "T", "Q"][dart.ring] ?? "";
  return `${prefix}${stage.wedges[dart.wedge] ?? "?"}`;
}

export interface CheckoutSearch {
  /** Fewest darts in any valid route; null when there is none. */
  minDarts: number | null;
  /** One route with that many darts. */
  route: CheckoutDart[] | null;
  /** Valid routes counted as unordered sets of the earlier darts plus the finishing dart. */
  routes: number;
}

/**
 * Exhaustive search over every dart sequence up to the stage's dart limit.
 * The order of the darts before the last one never matters, so routes are
 * counted once per unordered set of earlier darts.
 */
export function searchCheckout(stage: CheckoutStageData): CheckoutSearch {
  const options = checkoutOptions(stage);
  const values = options.map((dart) => checkoutDartValue(stage, dart));
  const finishers = options
    .map((dart, i) => [dart, values[i]!] as const)
    .filter(([dart]) => checkoutFinisher(stage, dart));
  let minDarts: number | null = null;
  let route: CheckoutDart[] | null = null;
  let routes = 0;
  const lengths = stage.exactDarts
    ? [stage.maxDarts]
    : Array.from({ length: stage.maxDarts }, (_, i) => i + 1);
  for (const length of lengths) {
    // Earlier darts as non-decreasing option indices: each unordered set once.
    const walk = (start: number, left: number, picked: number[], remaining: number) => {
      if (left === 0) {
        for (const [dart, value] of finishers) {
          if (value !== remaining) continue;
          routes += 1;
          if (minDarts === null || length < minDarts) {
            minDarts = length;
            route = [...picked.map((i) => options[i]!), dart];
          }
        }
        return;
      }
      for (let i = start; i < options.length; i++) {
        picked.push(i);
        walk(i, left - 1, picked, remaining - values[i]!);
        picked.pop();
      }
    };
    walk(0, length - 1, [], stage.target);
  }
  return { minDarts, route, routes };
}

/** True when always throwing the biggest dart that fits finishes the stage. */
export function checkoutGreedySolves(stage: CheckoutStageData): boolean {
  const options = checkoutOptions(stage);
  const values = options.map((dart) => checkoutDartValue(stage, dart));
  const finishValues = new Set(
    options
      .filter((dart) => checkoutFinisher(stage, dart))
      .map((dart) => checkoutDartValue(stage, dart)),
  );
  let remaining = stage.target;
  for (let dart = 1; dart <= stage.maxDarts; dart++) {
    let best = -Infinity;
    for (const value of values) if (value <= remaining && value > best) best = value;
    if (!Number.isFinite(best)) return false;
    remaining -= best;
    if (remaining === 0)
      return finishValues.has(best) && (!stage.exactDarts || dart === stage.maxDarts);
  }
  return false;
}

export interface CheckoutStageResult {
  solved: boolean;
  darts: number;
  minDarts: number;
  /** True when solved in the fewest darts (the exact-darts stage always is). */
  fewest: boolean;
}

export function gradeCheckoutStages(
  stages: readonly CheckoutStageData[],
  minDarts: readonly number[],
  raw: string,
): CheckoutStageResult[] {
  const parts = splitCheckoutRound(raw);
  return stages.map((stage, index) => {
    const darts = decodeCheckoutDarts(parts[index] ?? "", stage.maxDarts);
    const solved = checkoutValid(stage, darts);
    const min = minDarts[index] ?? stage.maxDarts;
    return {
      solved,
      darts: solved ? darts.length : 0,
      minDarts: min,
      fewest: solved && (stage.exactDarts === true || darts.length <= min),
    };
  });
}

/** Stage weights 18–26, +2 per stage in the fewest darts, all five solved adds up to 30 for speed. Max 150. */
export function scoreCheckout(
  results: readonly CheckoutStageResult[],
  msRemaining: number,
  timeLimitMs: number,
): number {
  if (scoreRev1()) {
    const all = results.length === CHECKOUT_STAGES && results.every((r) => r.solved);
    // Rev 1: all five = 120 + 3 per board in the fewest darts + PAR(15); otherwise 22 / 24 / 26 / 28 / 32 per board, any order (any four at most 110).
    if (all) return finishParts(timeLimitMs > 0 ? speedBonusCurve(PUZZLE_SPEED_POINTS, msRemaining, timeLimitMs) : 0, 3 * results.filter((r) => r.fewest).length, "darts");
    return partialParts(results.reduce((sum, r, i) => sum + (r.solved ? CHECKOUT_REV1_WEIGHTS[i] ?? 0 : 0), 0));
  }
  const base = results.reduce(
    (sum, r, i) =>
      sum + (r.solved ? (CHECKOUT_WEIGHTS[i] ?? 0) + (r.fewest ? CHECKOUT_MIN_DART_POINTS : 0) : 0),
    0,
  );
  const all = results.length === CHECKOUT_STAGES && results.every((r) => r.solved);
  const bonus =
    all && timeLimitMs > 0 ? speedBonusCurve(CHECKOUT_SPEED_POINTS, msRemaining, timeLimitMs) : 0;
  return Math.max(0, Math.min(150, base + bonus));
}
