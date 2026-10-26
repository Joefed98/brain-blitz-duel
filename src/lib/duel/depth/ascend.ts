/**
 * Ascend depth (25 Oct 2026, `tapRev: 5`; docs/depth/d3-speed-attention.md): FEATURE, the flow streak. Shared by
 * the phone (the live multiplier) and the server grader (ascend.server.ts).
 *
 *   score = puzzleScoreRev 3's Ascend score (at most 150) + flow points, at most 200
 *
 *   - flow: each right tap within ASCEND_FLOW_GAP_MS of the right tap before it extends the streak; a wrong tap
 *     ends it, and so does a longer pause (the next right tap starts a new one);
 *   - the multiplier is ×1 for the first 3 taps of a streak, ×2 from the 4th, ×3 from the 8th, ×4 from the 12th;
 *     every right tap earns its multiplier less one (×1 earns nothing), at most ASCEND_FLOW_MAX in all.
 * All 24 in one unbroken streak earns 51, so 200 needs rev 3's 150 (a clean, fast finish) and a near-unbroken flow.
 */
import { depthClamp } from "../depth200";
import { TAP_REV_DEPTH, replayAscend, type NumberTap } from "../tapLog";
import type { NumberHuntPuzzleData } from "../types";

export const ASCEND_DEPTH_REV = TAP_REV_DEPTH;
export const ASCEND_FLOW_GAP_MS = 1_000;
/** Right taps per multiplier step. */
export const ASCEND_FLOW_STEP = 4;
export const ASCEND_FLOW_TOP = 4;
export const ASCEND_FLOW_MAX = 50;

export function usesAscendDepth(puzzle: unknown): boolean {
  const p = puzzle as { type?: string; tapRev?: number } | null;
  return p?.type === "numhunt" && p.tapRev === ASCEND_DEPTH_REV;
}

/** The multiplier for the n-th right tap of a streak (n from 1). */
export function flowMultiplier(streak: number): number {
  return streak <= 0 ? 1 : Math.min(ASCEND_FLOW_TOP, 1 + Math.floor(streak / ASCEND_FLOW_STEP));
}

export interface AscendFlow {
  /** Flow points, at most ASCEND_FLOW_MAX. */
  points: number;
  /** The highest multiplier reached. */
  best: number;
  /** The streak after the last tap, and the round-clock ms of its last right tap (null: none running). */
  streak: number;
  lastAt: number | null;
}

/** Walks the log as replayAscend does (the same outcomes) and scores the flow streak. */
export function ascendFlow(puzzle: NumberHuntPuzzleData, taps: readonly NumberTap[]): AscendFlow {
  const { outcomes } = replayAscend(puzzle, taps);
  let streak = 0;
  let lastAt: number | null = null;
  let points = 0;
  let best = 1;
  taps.forEach((tap, i) => {
    const outcome = outcomes[i];
    if (outcome === "wrong") {
      streak = 0;
      lastAt = null;
      return;
    }
    if (outcome !== "correct") return;
    streak = lastAt !== null && tap.t - lastAt <= ASCEND_FLOW_GAP_MS ? streak + 1 : 1;
    lastAt = tap.t;
    const m = flowMultiplier(streak);
    best = Math.max(best, m);
    points += m - 1;
  });
  return { points: Math.min(ASCEND_FLOW_MAX, points), best, streak, lastAt };
}

/** The multiplier on show at round-clock `now`: the streak's, or ×1 once the pause has run out. */
export function liveFlowMultiplier(flow: AscendFlow, now: number): number {
  if (flow.lastAt === null || now - flow.lastAt > ASCEND_FLOW_GAP_MS) return 1;
  // The next right tap would be the streak's (streak + 1)-th.
  return flowMultiplier(flow.streak);
}

export function ascendDepthScore(rev3Score: number, flow: AscendFlow): number {
  return depthClamp(rev3Score + flow.points);
}
