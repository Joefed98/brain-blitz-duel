/**
 * The scoring standard's Speed and Attention games (27 Oct 2026, docs/scoring-standard.md "Speed and Attention
 * decisions"): each game's numbers and the small rules the phone and the server share (the phone's streak and bonus
 * lines read them, the server grades with them in attention.server.ts, the help texts quote them in
 * attentionTexts.ts). Mixed Signals scores inside its sim (src/lib/arcade/colourClash.ts, clashRev 10). Pure.
 */
import type { AscendOutcome } from "../tapLog";
import type { ChainPuzzleData, MazePuzzleData, NumberHuntPuzzleData, PairPuzzleData, PuzzleData, SpotPuzzleData, SymbolScanPuzzleData, CountUpPuzzleData } from "../types";
import { usesStandard } from "./stamps";

/* ------------------------------------------------------------------ Ascend (numhunt, tapRev 6) */

export const ASCEND_STD = {
  /** Unfinished: up to this by the share of the 24 numbers reached… */
  share: 120,
  /** …plus up to this for how early, shared over the 24 numbers (each number by its own tap time). */
  early: 10,
  /** Each wrong tap costs this off an unfinished score (today's cost), and a sixth of the speed points on a finish. */
  wrongCost: 5,
  /** Today's finish took the wrong taps off its 30 speed points: the same share comes off the standard's speed. */
  wrongSpeedOf: 30,
  speed: 40,
  fullByS: 40,
  /** The flow streak: the longest run of right taps with no wrong tap between, this much for all 24 in one run. */
  flow: 10,
} as const;

/** Ascend's flow streak: the longest run of right taps with no wrong tap between (taps that change nothing don't break it). */
export function ascendBestRun(outcomes: readonly AscendOutcome[]): number {
  let run = 0;
  let best = 0;
  for (const o of outcomes) {
    if (o === "wrong") run = 0;
    else if (o === "correct") best = Math.max(best, ++run);
  }
  return best;
}

/** The flow streak's points for a best run of `best` right taps of `total`. */
export function ascendFlowPoints(best: number, total = 24): number {
  return (ASCEND_STD.flow * Math.max(0, Math.min(total, best))) / Math.max(1, total);
}

export function ascendStandard(p: NumberHuntPuzzleData | PuzzleData | null | undefined): boolean {
  return !!p && p.type === "numhunt" && usesStandard(p);
}

/* ------------------------------------------------------------------ Don't Break the Chain (chain, chainDepthRev 3) */

export const CHAIN_STD = { share: 120, early: 10, speed: 50, fullByS: 30 } as const;

/** The standard drops the milestones (and their pips). */
export function chainStandard(p: ChainPuzzleData | null | undefined): boolean {
  return !!p && usesStandard(p);
}

/* ------------------------------------------------------------------ Eagle Eye (symscan, scanRev 4) */

export const SCAN_STD = {
  perGrid: 40,
  /** Up to this for how early each grid was completed (all its eagles marked). */
  early: 3,
  /** Each wrong eagle left marked costs this off an unfinished score (today's cost). */
  wrongCost: 3,
  speed: 10,
  fullByS: 20,
  /** Clean grids: 40 shared over the three grids, each grid's share only when no wrong eagle was ever marked in it. */
  clean: 40,
  /**
   * A finish: every eagle found in all three grids, with at most this many wrong eagles left marked in each grid
   * (today's finish needed none; a wrong eagle now costs that grid's clean share instead). Marking every eagle on a
   * grid is never a finish.
   */
  finishWrongPerGrid: 3,
} as const;

export function scanStandard(p: SymbolScanPuzzleData | null | undefined): boolean {
  return !!p && usesStandard(p);
}

/* ------------------------------------------------------------------ Double Take (spotdiff, spotRev 3) */

export const SPOT_STD = {
  perDiff: 10,
  early: 0.8,
  /** Each wrong tap costs this off an unfinished score (today's cost). */
  wrongCost: 4,
  speed: 20,
  fullByS: 40,
  /** The hidden seventh difference, finished or not. */
  hidden: 20,
  /** Clean taps: no wrong tap in either picture (all or nothing). */
  clean: 10,
} as const;

export function spotStandard(p: SpotPuzzleData | null | undefined): boolean {
  return !!p && usesStandard(p);
}

/* ------------------------------------------------------------------ Tally (countup, countRev 5) */

export const COUNT_STD = {
  perTray: 30,
  /** A count one off still earns this share of its tray (today's 15 %), unfinished only. */
  near: 0.15,
  early: 2.5,
  speed: 50,
  fullByS: 30,
} as const;

export function countStandard(p: CountUpPuzzleData | null | undefined): boolean {
  return !!p && usesStandard(p);
}

/* ------------------------------------------------------------------ Labyrinth (maze, mazeRev 3) */

export const MAZE_STD = {
  share: 120,
  early: 10,
  speed: 20,
  fullByS: 40,
  /** Stars: 30 shared over the maze's stars (10 each for three), finished or not. */
  stars: 30,
} as const;

export function mazeStandard(p: MazePuzzleData | null | undefined): boolean {
  return !!p && usesStandard(p);
}

/** The stars' points for `taken` of `count` stars. */
export function mazeStarPoints(taken: number, count: number): number {
  return count > 0 ? (MAZE_STD.stars * Math.max(0, Math.min(count, taken))) / count : 0;
}

/* ------------------------------------------------------------------ Matchmaker (pairmatch, pairRev 3) */

export const PAIR_STD = {
  perPair: 8,
  early: 0.6,
  /** Mismatched tries beyond this many cost (today's free misses)… */
  freeMisses: 14,
  /** …a third of a pair's points each (today's: three misses cost a pair). */
  missesPerPair: 3,
  speed: 30,
  fullByS: 60,
  /** The match streak: 1 for each match in the longest run of matches beyond the first PAIR_STD.streakFrom, up to 5. */
  streak: 5,
  streakFrom: 3,
  /** The gold pair matched in the round's first 30 s. */
  gold: 15,
  goldWindowMs: 30_000,
} as const;

export function pairStandard(p: PairPuzzleData | null | undefined): boolean {
  return !!p && usesStandard(p);
}

/** The match streak's points for the longest run of matches. */
export function pairStreakPoints(bestStreak: number): number {
  return Math.max(0, Math.min(PAIR_STD.streak, bestStreak - PAIR_STD.streakFrom));
}

/** The gold pair's points: matched (goldTry set) in the first 30 s of the round. */
export function pairGoldPoints(goldTry: number | null, goldMs: number | null): number {
  return goldTry !== null && goldMs !== null && goldMs <= PAIR_STD.goldWindowMs ? PAIR_STD.gold : 0;
}
