/**
 * Don't Break the Chain, Depth to 200 (25 Oct 2026, `chainDepthRev: 1`; docs/depth/d3-speed-attention.md).
 * STRETCH + chain milestones. The game itself is unchanged (boards, cycles, the reversed board, momentum
 * windows); the new revision scores to 200:
 *
 *   - Milestones at 10, 20 and 30 links in a row. Each is worth up to CHAIN_MILESTONE_POINTS, in full when the
 *     ten links leading to it came at a flowing pace (an average gap of CHAIN_FLOW_FULL_MS or less), falling
 *     evenly to nothing at CHAIN_FLOW_ZERO_MS; a chain that breaks keeps the milestones it reached.
 *   - A finish scores as puzzleScoreRev 3 (120 + 30 by time left, 150 with CHAIN_STRETCH.fastShare of the clock
 *     left) and then stretches: a clean finish keeps climbing to +35 with eliteShare of the clock left.
 *   - Unfinished: puzzleScoreRev 3's credit (110 one short) plus the milestones reached, below every finish's 120.
 *
 * Shared by the phone (the milestone pips) and the server (depth/chain.server.ts), integer arithmetic on tap times.
 */
import type { StretchCurve } from "../depth200";
import type { ChainTap } from "../chain";
import type { ChainPuzzleData } from "../types";

export const CHAIN_DEPTH_REV = 1;
export const CHAIN_MILESTONES = [10, 20, 30] as const;
export const CHAIN_MILESTONE_POINTS = 5;
/** Average gap between taps over a milestone's ten links: full points at or under this. */
export const CHAIN_FLOW_FULL_MS = 400;
/** …and none at or over this. */
export const CHAIN_FLOW_ZERO_MS = 650;
/** The finish's stretch above 150 (fastShare is the rev-3 chain fastShare). */
export const CHAIN_STRETCH: StretchCurve = { fastShare: 0.53, eliteShare: 0.68, stretchTop: 35, power: 1.3 };
/**
 * The puzzle top-up (26 Oct 2026, chainDepthRev 2; docs/depth/topup-oct-2026.md): the same chain and milestones;
 * 150 comes a little sooner and the stretch climbs from there (CHAIN_STRETCH_TOPUP), and a milestone pays in full
 * up to CHAIN_TOPUP_FLOW_FULL_MS a link (none from CHAIN_TOPUP_FLOW_ZERO_MS), so today's near-perfect chain lands
 * about 165–175 and only an elite one 190–200.
 */
export const CHAIN_DEPTH_TOPUP_REV = 2;
export const CHAIN_STRETCH_TOPUP: StretchCurve = { fastShare: 0.46, eliteShare: 0.68, stretchTop: 35, power: 1.2 };
export const CHAIN_TOPUP_FLOW_FULL_MS = 450;
export const CHAIN_TOPUP_FLOW_ZERO_MS = 700;

/** The stamp's finish stretch. */
export function chainStretchFor(rev: number): StretchCurve {
  return rev >= CHAIN_DEPTH_TOPUP_REV ? CHAIN_STRETCH_TOPUP : CHAIN_STRETCH;
}

/** The chainDepthRev a stored puzzle carries (0 before the depth revision). */
export function chainDepthRevOf(puzzle: ChainPuzzleData | null | undefined): number {
  return puzzle?.chainDepthRev ?? 0;
}

/** An unfinished chain never reaches a finish (120). */
export const CHAIN_DEPTH_UNFINISHED_TOP = 119;

export function chainUsesDepth(puzzle: ChainPuzzleData | null | undefined): boolean {
  return (puzzle?.chainDepthRev ?? 0) >= CHAIN_DEPTH_REV;
}

export interface ChainMilestone {
  /** Links (10, 20, 30). */
  at: number;
  /** Average gap (ms) between the taps of its ten links. */
  gapMs: number;
  points: number;
}

/** Points for a milestone made with this average gap (on the stamp's flow window). */
export function chainMilestonePoints(gapMs: number, rev = CHAIN_DEPTH_REV): number {
  const full = rev >= CHAIN_DEPTH_TOPUP_REV ? CHAIN_TOPUP_FLOW_FULL_MS : CHAIN_FLOW_FULL_MS;
  const zero = rev >= CHAIN_DEPTH_TOPUP_REV ? CHAIN_TOPUP_FLOW_ZERO_MS : CHAIN_FLOW_ZERO_MS;
  if (gapMs <= full) return CHAIN_MILESTONE_POINTS;
  if (gapMs >= zero) return 0;
  return Math.round((CHAIN_MILESTONE_POINTS * (zero - gapMs)) / (zero - full));
}

/**
 * The milestones reached by a chain of `links` correct taps (`taps` in order, the first `links` of them the
 * links). The first milestone's ten links have nine gaps (the first tap is untimed); later ones ten.
 */
export function chainMilestones(taps: readonly ChainTap[], links: number, rev = CHAIN_DEPTH_REV): ChainMilestone[] {
  const out: ChainMilestone[] = [];
  for (const at of CHAIN_MILESTONES) {
    if (links < at || taps.length < at) break;
    const from = at === 10 ? 0 : at - 11;
    const gaps = at - 1 - from;
    const gapMs = Math.round((taps[at - 1]!.t - taps[from]!.t) / Math.max(1, gaps));
    out.push({ at, gapMs, points: chainMilestonePoints(gapMs, rev) });
  }
  return out;
}

export function chainMilestoneTotal(milestones: readonly ChainMilestone[]): number {
  return milestones.reduce((sum, m) => sum + m.points, 0);
}

/* ------------------------------------------------------------------ texts (help and intro) */

const CHAIN_LIMIT_S = 45;

/** Seconds a clean finish may take for 150, and for the stretch's top. */
export function chainFinishSeconds(curve: StretchCurve = CHAIN_STRETCH_TOPUP): { at150: number; atTop: number } {
  return {
    at150: Math.round(CHAIN_LIMIT_S * (1 - curve.fastShare)),
    atTop: Math.round(CHAIN_LIMIT_S * (1 - curve.eliteShare)),
  };
}

/** The "?" help SCORE text ({max} is filled with the game's maximum). */
export function chainDepthHelp(halfDone: number): string {
  const s = chainFinishSeconds(CHAIN_STRETCH_TOPUP);
  const top = 150 + CHAIN_STRETCH_TOPUP.stretchTop;
  const all = CHAIN_MILESTONES.length * CHAIN_MILESTONE_POINTS;
  return `Progress counts: links tapped. Unfinished scores up to 110: about ${halfDone} half done, 110 one link short. A full chain scores 120 to ${top}: 120 as time runs out, 150 if you finish in about ${s.at150} s, ${top} in about ${s.atTop} s with no slips. Milestones: 10, 20 and 30 links in a row each add up to ${CHAIN_MILESTONE_POINTS} (all ${CHAIN_MILESTONE_POINTS} when their ten links come at about ${(CHAIN_TOPUP_FLOW_FULL_MS / 1000).toFixed(2)} s a link or quicker, none at ${(CHAIN_TOPUP_FLOW_ZERO_MS / 1000).toFixed(1)} s), up to ${all}, so {max} is a very fast, clean chain.`;
}

/** The round intro SCORE line (at most 90 characters). */
export const CHAIN_DEPTH_INTRO = "Links: up to 110. Finish fast for 120 to {max}; quick 10, 20 and 30 in a row add more.";
