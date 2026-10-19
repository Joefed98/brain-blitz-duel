/**
 * Solver-distance progress for Topsy-Turvy (gravityRev 2) and Polypotions (tubesRev 2), 19 Oct 2026
 * (docs/scoring-targets.md). Server-only: it runs the boards' own breadth-first solvers.
 *
 * Balls parked and flasks corked were reached about as often by random tilts and pours at the limit as by an
 * average player, so the score bands held both games' unfinished credit near 0. Progress is now how much closer
 * the board the player holds is to solved, by the solver: `closer` = the stored minimum less the fewest moves
 * that board still needs. Every move beyond `closer` (a tilt or pour that did not bring the board nearer, Undo and
 * Reset never giving one back) cancels some of them: one per wasted tilt, two per wasted pour (random pours do far
 * more real sorting than random tilts: pouring only onto a matching colour or into an empty flask mostly merges
 * runs, so a random pour list at the limit ends a few pours from solved). So wandering, even into a nearly sorted
 * board, earns little. A board that can no longer be solved (a locked ball in the way, a dead end) holds no progress.
 *
 * Measured on the puzzle-fairness kits (room seeds 5001–5030 and 7001–7030): average players keep about 0.3–0.4 of
 * the board; random input's 90th percentile is 0 in both games.
 */
import { gravityMinimum } from "./gravity.server";
import type { GravityBalls } from "./gravity";
import { tubesMinimum } from "./tubes.server";
import type { TubeState } from "./tubes";
import type { GravityPuzzleData, TubesPuzzleData } from "./types";

/** Each tilt that did not bring the board nearer cancels this many that did. */
export const GRAVITY_WASTE_WEIGHT = 1;
/** Each pour that did not bring the flasks nearer cancels this many that did. */
export const TUBES_WASTE_WEIGHT = 2;

/** 0–1: the share of the stored minimum closed, net of waste; `remaining` null = the board cannot be solved. */
export function solverProgress(minMoves: number, remaining: number | null, moves: number, wasteWeight: number): number {
  if (!(minMoves > 0) || remaining === null) return 0;
  const closer = Math.max(0, minMoves - remaining);
  const waste = Math.max(0, moves - closer);
  return Math.max(0, closer - wasteWeight * waste) / minMoves;
}

/** Topsy-Turvy: progress of the balls as they stand after `tilts` counted tilts. */
export function gravitySolverProgress(puzzle: GravityPuzzleData, balls: GravityBalls, tilts: number): number {
  const found = gravityMinimum(new Set(puzzle.walls), balls, puzzle.targets);
  return solverProgress(puzzle.minMoves ?? 0, found ? found.minMoves : null, tilts, GRAVITY_WASTE_WEIGHT);
}

/** Polypotions: progress of the flasks as they stand after `pours` counted pours. */
export function tubesSolverProgress(puzzle: TubesPuzzleData, tubes: TubeState, pours: number): number {
  const found = tubesMinimum(tubes);
  return solverProgress(puzzle.minMoves ?? 0, found ? found.minMoves : null, pours, TUBES_WASTE_WEIGHT);
}
