/**
 * Flash depth (25 Oct 2026, `tapRev: 5`; docs/depth/d3-speed-attention.md): STRETCH plus the steady-hand bonus.
 * Shared by the phone (live summary, reveal, effects) and the server grader (flash.server.ts).
 *
 *   score = curve(average reaction) + steady hand − false starts, 0 to 200
 *
 *   - the curve is tapRev 4's from 165 ms down (FLASH_REV4_CURVE), stretched above: 150 ms now 155 (it was the
 *     150 plateau), 135 ms 170, 120 ms or faster 185;
 *   - steady hand: every flash hit (no miss) with no false start, and every credited reaction within
 *     FLASH_STEADY_TIGHT_MS of each other (fastest to slowest) +15, within FLASH_STEADY_LOOSE_MS +8;
 *   - false starts cost as tapRev 2–4 (8, 8, then 11 each); misses count 1,200 ms; tapRev 4's decoy cut stays.
 */
import { knots, depthClamp } from "../depth200";
import { reactionFalseStartCost } from "../scoring";
import { REACTION_MISS_MS } from "../types";
import { TAP_REV_DEPTH, TAP_REV_TOPUP } from "../tapLog";

export const FLASH_DEPTH_REV = TAP_REV_DEPTH;
/**
 * The puzzle top-up (26 Oct 2026, tapRev 6; docs/depth/topup-oct-2026.md): the same steady hand and false starts on a
 * curve a little higher from 180 ms down (today's near-perfect 160 ms average about 165 with a steady hand), and
 * partial credit: never below FLASH_PARTIAL_PER_HIT per flash hit within FLASH_PARTIAL_HIT_MS (so a player who hit
 * every flash but tapped decoys never scores 0; tapping every decoy credits no reaction, so spam stays 0).
 */
export const FLASH_TOPUP_REV = TAP_REV_TOPUP;
export const FLASH_REV6_CURVE = [[120, 186], [135, 178], [150, 168], [165, 155], [180, 140], [200, 120], [300, 110], [450, 80], [600, 20], [800, 0]] as const;
export const FLASH_PARTIAL_PER_HIT = 2;
export const FLASH_PARTIAL_HIT_MS = 800;

/** tapRev 5's curve: [average ms, points], falling; below 165 ms it is tapRev 4's exactly. */
export const FLASH_REV5_CURVE = [[120, 185], [135, 170], [150, 155], [165, 140], [200, 120], [300, 110], [450, 80], [600, 20], [800, 0]] as const;
export const FLASH_STEADY_TIGHT_MS = 50;
export const FLASH_STEADY_TIGHT_POINTS = 15;
export const FLASH_STEADY_LOOSE_MS = 80;
export const FLASH_STEADY_LOOSE_POINTS = 8;

export function usesFlashDepth(puzzle: unknown): boolean {
  const p = puzzle as { type?: string; tapRev?: number } | null;
  return p?.type === "reaction" && (p.tapRev === FLASH_DEPTH_REV || p.tapRev === FLASH_TOPUP_REV);
}

/** Fastest to slowest credited reaction, or null while any flash is missed or still to come. */
export function flashSpread(times: readonly (number | null)[]): number | null {
  if (times.length === 0 || times.some((t) => t === null || t >= REACTION_MISS_MS)) return null;
  const xs = times as number[];
  return Math.max(...xs) - Math.min(...xs);
}

/** The steady-hand bonus for a finished run: 15, 8 or 0. */
export function flashSteadyBonus(times: readonly (number | null)[], falseStarts: number): number {
  const spread = flashSpread(times);
  if (spread === null || falseStarts > 0) return 0;
  if (spread <= FLASH_STEADY_TIGHT_MS) return FLASH_STEADY_TIGHT_POINTS;
  if (spread <= FLASH_STEADY_LOOSE_MS) return FLASH_STEADY_LOOSE_POINTS;
  return 0;
}

export interface FlashDepthScore {
  score: number;
  /** The curve's points for the average. */
  curve: number;
  steady: number;
  spread: number | null;
  falseStartCost: number;
  /** tapRev 6: the partial-credit floor (2 per flash hit within 800 ms). */
  floor?: number;
}

/** A run's tapRev 5 (or 6) score from its credited reactions (misses as 1,200 ms) and false starts. */
export function scoreFlashDepth(times: readonly (number | null)[], falseStarts: number, flashCount = times.length, tapRev = FLASH_DEPTH_REV): FlashDepthScore {
  const count = Math.max(1, flashCount);
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.min(REACTION_MISS_MS, Math.max(1, times[i] ?? REACTION_MISS_MS));
  const average = Math.round(total / count);
  const filled = Array.from({ length: count }, (_, i) => times[i] ?? null);
  const topup = tapRev >= FLASH_TOPUP_REV;
  const curve = knots(topup ? FLASH_REV6_CURVE : FLASH_REV5_CURVE, average);
  const steady = flashSteadyBonus(filled, falseStarts);
  const falseStartCost = reactionFalseStartCost(falseStarts, FLASH_DEPTH_REV);
  if (!topup) return { score: depthClamp(curve + steady - falseStartCost), curve, steady, spread: flashSpread(filled), falseStartCost };
  const floor = FLASH_PARTIAL_PER_HIT * filled.filter((t) => t !== null && t < FLASH_PARTIAL_HIT_MS).length;
  return { score: depthClamp(Math.max(floor, curve + steady - falseStartCost)), curve, steady, spread: flashSpread(filled), falseStartCost, floor };
}
