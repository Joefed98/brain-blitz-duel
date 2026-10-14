/**
 * Ballpark rules shared by the phone, the server grader and the generator.
 *
 * Each placement is an integer from 0 to 10,000: the marker's position along
 * the line (0 = left end, 10,000 = right end). The error is the distance from
 * the item's true position as a share of the line's length.
 */
import { partialParts, recordParts, scoreRev1 } from "./puzzleScoreRev";
import { speedBonusCurve } from "./speedPar";
import type { NumlineStageData, NumlineValue } from "./types";

/**
 * Rules revision stamped on new puzzles. 1 (12 Oct 2026): the first rules, 75 s.
 * 2 (14 Oct 2026): the round runs 90 s (stored on the puzzle as `timeLimitMs`)
 * and the item curve is the rev-2 one below. Stored rounds keep what they were
 * dealt: no `timeLimitMs` (the registry's 75 s) and the rev-1 curve.
 */
export const NUMLINE_REV = 2;
/** numlineRev 2: the round clock, stored on each new puzzle. */
export const NUMLINE_REV2_TIME_MS = 90_000;
export const NUMLINE_STAGES = 3;
export const NUMLINE_ITEMS = 5;
export const NUMLINE_TOTAL = NUMLINE_STAGES * NUMLINE_ITEMS;
export const NUMLINE_SCALE = 10_000;
export const NUMLINE_ITEM_POINTS = 8;
/** Full points at or under this error share, none at or over NUMLINE_ZERO_ERROR. */
export const NUMLINE_FULL_ERROR = 0.02;
export const NUMLINE_ZERO_ERROR = 0.15;
export const NUMLINE_SPEED_POINTS = 30;
/** Puzzle score rev 1: an item scores nothing from this error share. */
export const NUMLINE_REV1_ZERO_ERROR = 0.08;
/** Puzzle score rev 1: a placement this far off costs a point. */
export const NUMLINE_REV1_WILD_ERROR = 0.25;
/** numlineRev 2: full points within this share, none from NUMLINE_REV2_ZERO_ERROR. */
export const NUMLINE_REV2_FULL_ERROR = 0.01;
export const NUMLINE_REV2_ZERO_ERROR = 0.1;
/** Every value sits at least this share of the line from a labelled tick. */
export const NUMLINE_TICK_GAP = 0.03;

export function numlineValue(value: NumlineValue): number {
  return value.num / value.den + (value.rootCoef ? value.rootCoef * Math.sqrt(value.root) : 0);
}

/** Where a value sits along a line, 0–1. */
export function numlineShare(stage: Pick<NumlineStageData, "lo" | "hi">, value: number): number {
  return (value - stage.lo) / (stage.hi - stage.lo);
}

/** The labelled ticks of a line, as shares: both ends, plus 0 when it lies inside. */
export function numlineTicks(stage: Pick<NumlineStageData, "lo" | "hi">): number[] {
  const ticks = [0, 1];
  if (stage.lo < 0 && stage.hi > 0) ticks.push(numlineShare(stage, 0));
  return ticks;
}

/** The error share at or under which an item scores all 8 (the reveal's green; rev 2's "close" for the speed part). */
export function numlineFullError(rev = 1): number {
  return rev >= 2 ? NUMLINE_REV2_FULL_ERROR : NUMLINE_FULL_ERROR;
}

export function numlineItemPoints(error: number, rev = 1): number {
  if (!Number.isFinite(error)) return 0;
  // Rev 2 (numlineRev 2, 14 Oct 2026): full within 1 %, falling evenly to 0 at 10 % (wider than rev 1's 8 %, so
  // rough estimates keep some credit), and the same cost for a wild placement.
  if (rev >= 2 && scoreRev1()) {
    if (error >= NUMLINE_REV1_WILD_ERROR) return -1;
    if (error <= NUMLINE_REV2_FULL_ERROR) return NUMLINE_ITEM_POINTS;
    if (error >= NUMLINE_REV2_ZERO_ERROR) return 0;
    return (NUMLINE_ITEM_POINTS * (NUMLINE_REV2_ZERO_ERROR - error)) / (NUMLINE_REV2_ZERO_ERROR - NUMLINE_REV2_FULL_ERROR);
  }
  // Rev 1: full within 2 %, falling evenly to 0 at NUMLINE_REV1_ZERO_ERROR; a wild placement (NUMLINE_REV1_WILD_ERROR
  // or more off) costs 1, so placing at random earns about nothing.
  if (scoreRev1()) {
    if (error >= NUMLINE_REV1_WILD_ERROR) return -1;
    if (error <= NUMLINE_FULL_ERROR) return NUMLINE_ITEM_POINTS;
    if (error >= NUMLINE_REV1_ZERO_ERROR) return 0;
    return (NUMLINE_ITEM_POINTS * (NUMLINE_REV1_ZERO_ERROR - error)) / (NUMLINE_REV1_ZERO_ERROR - NUMLINE_FULL_ERROR);
  }
  if (error <= NUMLINE_FULL_ERROR) return NUMLINE_ITEM_POINTS;
  if (error >= NUMLINE_ZERO_ERROR) return 0;
  return (
    (NUMLINE_ITEM_POINTS * (NUMLINE_ZERO_ERROR - error)) / (NUMLINE_ZERO_ERROR - NUMLINE_FULL_ERROR)
  );
}

export function encodeNumline(placements: readonly number[]): string {
  return placements.map((p) => String(Math.round(p))).join(",");
}

/** Placements in play order; reading stops at the first value that is not a whole 0–10,000. */
export function decodeNumline(raw: string | null | undefined): number[] {
  const out: number[] = [];
  if (!raw) return out;
  for (const part of String(raw).split(",")) {
    if (out.length >= NUMLINE_TOTAL) break;
    const text = part.trim();
    if (!/^\d{1,5}$/.test(text)) break;
    const value = Number(text);
    if (value > NUMLINE_SCALE) break;
    out.push(value);
  }
  return out;
}

export interface NumlineItemResult {
  placed: boolean;
  /** Error as a share of the line (0–1); null when unplaced. */
  error: number | null;
  /** Unrounded points 0–8. */
  points: number;
  /** True position 0–10,000. */
  truth: number;
  /** Placement 0–10,000; null when unplaced. */
  placement: number | null;
}

export function gradeNumlineItems(
  stages: readonly NumlineStageData[],
  values: readonly NumlineValue[][],
  raw: string | null | undefined,
  /** The puzzle's numlineRev (1 when absent). */
  rev = 1,
): NumlineItemResult[] {
  const placements = decodeNumline(raw);
  const out: NumlineItemResult[] = [];
  stages.forEach((stage, s) => {
    stage.items.forEach((_, i) => {
      const index = s * NUMLINE_ITEMS + i;
      const value = values[s]?.[i];
      const share = value ? numlineShare(stage, numlineValue(value)) : NaN;
      const truth = Math.round(share * NUMLINE_SCALE);
      const placement = placements[index];
      if (placement === undefined || !Number.isFinite(share)) {
        out.push({ placed: false, error: null, points: 0, truth, placement: null });
        return;
      }
      const error = Math.abs(placement / NUMLINE_SCALE - share);
      out.push({ placed: true, error, points: numlineItemPoints(error, rev), truth, placement });
    });
  });
  return out;
}

/** Accuracy points earned, 0–120 (unrounded). */
export function numlineAccuracy(results: readonly NumlineItemResult[]): number {
  return results.reduce((sum, r) => sum + r.points, 0);
}

/**
 * numlineRev 1: round(accuracy) + (all 15 placed: round(speed par curve up to 30 × accuracy ÷ 120)). Max 150.
 * Placing another item never lowers the score: items only add points and the
 * speed part needs every item placed.
 */
export function scoreNumline(
  results: readonly NumlineItemResult[],
  msRemaining: number,
  timeLimitMs: number,
  /** The puzzle's numlineRev (1 when absent). */
  rev = 1,
): number {
  const accuracy = numlineAccuracy(results);
  const all = results.length === NUMLINE_TOTAL && results.every((r) => r.placed);
  if (rev >= 2 && scoreRev1()) {
    // numlineRev 2: as rev 1, but the speed part scales with the share of numbers placed close (within
    // NUMLINE_REV2_FULL_ERROR), so a quick, rough finish no longer takes most of it.
    const acc = Math.max(0, accuracy);
    if (!all) return partialParts(acc);
    const close = results.filter((r) => r.error !== null && r.error <= NUMLINE_REV2_FULL_ERROR).length / NUMLINE_TOTAL;
    const speed = timeLimitMs > 0 ? Math.round(speedBonusCurve(NUMLINE_SPEED_POINTS, msRemaining, timeLimitMs) * close) : 0;
    recordParts({ kind: "finish", base: Math.round(acc), speed });
    return Math.max(0, Math.min(150, Math.round(acc) + speed));
  }
  if (scoreRev1()) {
    // Rev 1: all 15 placed = accuracy (120 at full) + PAR(30) scaled by accuracy; unplaced numbers leave it unfinished, at most 110.
    const acc = Math.max(0, accuracy);
    if (!all) return partialParts(acc);
    const shareAll = acc / (NUMLINE_TOTAL * NUMLINE_ITEM_POINTS);
    const speed = timeLimitMs > 0 ? Math.round(speedBonusCurve(NUMLINE_SPEED_POINTS, msRemaining, timeLimitMs) * shareAll) : 0;
    recordParts({ kind: "finish", base: Math.round(acc), speed });
    return Math.max(0, Math.min(150, Math.round(acc) + speed));
  }
  const share = accuracy / (NUMLINE_TOTAL * NUMLINE_ITEM_POINTS);
  const bonus =
    all && timeLimitMs > 0
      ? Math.round(speedBonusCurve(NUMLINE_SPEED_POINTS, msRemaining, timeLimitMs) * share)
      : 0;
  return Math.max(0, Math.min(150, Math.round(accuracy) + bonus));
}

/** "4.2%" style error label. */
export function numlineErrorLabel(error: number | null): string {
  if (error === null) return "—";
  return `${(error * 100).toFixed(1)}%`;
}
