/**
 * Shared answer encoding and scoring for staged rounds (Equation
 * Balancing, Symbol Scan, Count Up). Answers are one segment per stage,
 * joined by "|"; an empty segment is a skipped stage. Used by the server
 * grader, the reveal and the result summaries so they always agree.
 */
import { finishParts, partialParts, scoreRev1 } from "./puzzleScoreRev";
import { speedBonusCurve } from "./speedPar";
import {
  EQUATION_STAGE_POINTS,
  EQUATION_STAGE_COUNT,
  EQUATION_SPEED_POINTS,
  EQUATION_TIME_MS,
  STAGE_WEIGHTS_3,
  COUNTUP_TIME_MS,
  SYMSCAN_TIME_MS,
  type Operator,
} from "./types";

export const STAGE_COUNT = 3;

export function splitStages(answer: string | null | undefined, count = STAGE_COUNT): string[] {
  const parts = (answer ?? "").split("|");
  return Array.from({ length: count }, (_, i) => (parts[i] ?? "").trim());
}

export function joinStages(parts: string[], count = STAGE_COUNT): string {
  return Array.from({ length: count }, (_, i) => parts[i] ?? "").join("|");
}

function clampMs(ms: number, limit: number): number {
  return Math.max(0, Math.min(limit, ms));
}

/* ------------------------------ Equation ------------------------------ */

export function parseOperators(segment: string): Operator[] {
  return segment.split(",").map((v) => v.trim()).filter((v) => v.length > 0) as Operator[];
}

/** Puzzle score rev 1: Operator's four stages while unfinished (the best three = 110). */
export const EQUATION_REV1_STAGE_POINTS = [20, 30, 35, 45] as const;
/** Puzzle score rev 1: Eagle Eye's and Tally's three stages while unfinished (all three = 110). */
export const STAGE_WEIGHTS_3_REV1 = [25, 40, 45] as const;

function stageWeight(stage: number): number {
  return (scoreRev1() ? STAGE_WEIGHTS_3_REV1 : STAGE_WEIGHTS_3)[stage] ?? 0;
}

export function scoreEquationStages(correct: boolean[], msRemaining: number): number {
  // A stored three-stage round retains its original weights and bonus.
  const legacy = correct.length === 3;
  if (scoreRev1() && !legacy) {
    // Rev 1: all four = 120 + PAR(30); otherwise 20 / 30 / 35 / 45 per stage, any order.
    if (correct.length === EQUATION_STAGE_COUNT && correct.every(Boolean)) return finishParts(speedBonusCurve(30, clampMs(msRemaining, EQUATION_TIME_MS), EQUATION_TIME_MS));
    return partialParts(correct.reduce((sum, ok, i) => sum + (ok ? EQUATION_REV1_STAGE_POINTS[i] ?? 0 : 0), 0));
  }
  const weights = legacy ? [30, 40, 50] : EQUATION_STAGE_POINTS;
  const base = correct.reduce((sum, ok, i) => sum + (ok ? weights[i] ?? 0 : 0), 0);
  const all = correct.length === (legacy ? 3 : EQUATION_STAGE_COUNT) && correct.every(Boolean);
  const bonus = all ? speedBonusCurve(legacy ? 30 : EQUATION_SPEED_POINTS, clampMs(msRemaining, EQUATION_TIME_MS), EQUATION_TIME_MS) : 0;
  return Math.min(150, base + bonus);
}

/* ----------------------------- Symbol Scan ---------------------------- */

export function parseSelection(segment: string): number[] {
  return [...new Set(segment.split(",").map((v) => Number.parseInt(v, 10)).filter(Number.isFinite))];
}

export interface ScanStageResult {
  found: number;
  targets: number;
  wrong: number;
  points: number;
  perfect: boolean;
}

export function scanStageResult(stage: number, selected: number[], targets: number[]): ScanStageResult {
  const weight = stageWeight(stage);
  const found = targets.filter((t) => selected.includes(t)).length;
  const wrong = selected.filter((s) => !targets.includes(s)).length;
  const total = Math.max(1, targets.length);
  const points = Math.max(0, Math.round((weight * found) / total) - 3 * wrong);
  return { found, targets: targets.length, wrong, points, perfect: found === targets.length && wrong === 0 };
}

export function scoreSymbolScanStages(results: ScanStageResult[], msRemaining: number, timeLimitMs: number = SYMSCAN_TIME_MS): number {
  const base = results.reduce((sum, r) => sum + r.points, 0);
  const all = results.length === STAGE_COUNT && results.every((r) => r.perfect);
  // Rev 1: all three perfect = 120 + PAR(30); otherwise the stages' points (25 / 40 / 45 at most).
  if (scoreRev1()) return all ? finishParts(speedBonusCurve(30, clampMs(msRemaining, timeLimitMs), timeLimitMs)) : partialParts(base);
  const bonus = all ? speedBonusCurve(20, clampMs(msRemaining, timeLimitMs), timeLimitMs) : 0;
  return Math.min(150, base + bonus);
}

/* ------------------------------ Count Up ------------------------------ */

export function parseCount(segment: string): number | null {
  const n = Number.parseInt(segment, 10);
  return Number.isFinite(n) ? n : null;
}

export function countStagePoints(stage: number, given: number | null, truth: number): number {
  if (given === null) return 0;
  const weight = stageWeight(stage);
  const away = Math.abs(given - truth);
  if (away === 0) return weight;
  if (away === 1) return Math.round(weight * 0.6);
  if (away === 2) return Math.round(weight * 0.3);
  return 0;
}

export function scoreCountUpStages(given: (number | null)[], counts: number[], msRemaining: number, timeLimitMs: number = COUNTUP_TIME_MS): number {
  const base = counts.reduce((sum, truth, i) => sum + countStagePoints(i, given[i] ?? null, truth), 0);
  const all = counts.length === STAGE_COUNT && counts.every((truth, i) => given[i] === truth);
  // Rev 1: all three exact = 120 + PAR(30); otherwise the trays' points (25 / 40 / 45 at most, near counts 60 % / 30 %).
  if (scoreRev1()) return all ? finishParts(speedBonusCurve(30, clampMs(msRemaining, timeLimitMs), timeLimitMs)) : partialParts(base);
  const bonus = all ? speedBonusCurve(20, clampMs(msRemaining, timeLimitMs), timeLimitMs) : 0;
  return Math.min(150, base + bonus);
}

/** Strict left-to-right evaluation. Returns null on a non-whole or negative step. */
export function evaluateLeftToRight(numbers: number[], ops: Operator[]): number | null {
  if (ops.length !== numbers.length - 1) return null;
  let value = numbers[0]!;
  for (let i = 0; i < ops.length; i++) {
    const next = numbers[i + 1]!;
    const op = ops[i]!;
    if (op === "+") value += next;
    else if (op === "-") value -= next;
    else if (op === "×") value *= next;
    else if (op === "÷") {
      if (next === 0 || value % next !== 0) return null;
      value /= next;
    } else return null;
    if (value < 0 || !Number.isInteger(value)) return null;
  }
  return value;
}

export function equationStageCorrect(numbers: number[], target: number, segment: string): boolean {
  return evaluateLeftToRight(numbers, parseOperators(segment)) === target;
}
