/**
 * Puzzle score shape (Oct 2026, `puzzleScoreRev: 1`). Every new puzzle is
 * stamped by generatePuzzle; stored rounds without the stamp keep the shape
 * they were created under (130 + speed, 100 + moves + speed, the old partial
 * credit), exactly as speedPar keeps the old speed curve.
 *
 * Rev 1, for every non-arcade game with a finish state:
 *   - a finish scores at least 120 (PUZZLE_FINISH_BASE), plus up to 30: all
 *     speed (PAR(30)), or 15 efficiency + PAR(15) where the game has an
 *     efficiency measure (moves, tries, strikes, darts);
 *   - unfinished credit tops out at 110 (PUZZLE_UNFINISHED_CAP), so every finish
 *     beats every unfinished run, and counts only progress the player made.
 *
 * The rev in force is set around the server's synchronous grade call
 * (gradeSubmission), like withSpeedCurve. Everywhere else (checks that call a
 * scorer directly, displays) the legacy shape is the default; a display that
 * needs rev 1 reads the stored breakdown (`extra.parts`) or wraps its call.
 */
export const PUZZLE_SCORE_REV = 1;
/**
 * The revision new puzzles are dealt (20 Oct 2026): 3, the shared helper
 * (puzzleScoreRev3.ts) for finish puzzles, graded on the rev-1 shape and then
 * turned into 110 × progress or 120 + speed; open games keep rev 2's curves
 * (puzzleScoreRev2.ts). A display that asks "rev-1 shape or later" still
 * compares with PUZZLE_SCORE_REV.
 */
export const PUZZLE_SCORE_REV_DEALT = 3;

let dealtOverride: number | null = null;
/** The puzzleScoreRev new puzzles are stamped with (PUZZLE_SCORE_REV_DEALT unless a check pinned another). */
export function dealtPuzzleScoreRev(): number {
  return dealtOverride ?? PUZZLE_SCORE_REV_DEALT;
}
/**
 * Checks written for the rev-1 shape (their numbers are rev 1's) pin new puzzles to it, so they keep proving what
 * they were written for; scoring-bands-check proves rev 2. Never called by app code.
 */
export function pinDealtPuzzleScoreRev(rev: number | null): void {
  dealtOverride = rev;
}
export const PUZZLE_FINISH_BASE = 120;
export const PUZZLE_UNFINISHED_CAP = 110;
/** The 30 above the finish base: all speed, or split 15 / 15 with an efficiency measure. */
export const PUZZLE_FINISH_EXTRA = 30;
export const PUZZLE_EFFICIENCY_POINTS = 15;
export const PUZZLE_SPEED_POINTS = 15;

let active = 0;

/** The stored puzzle's score revision (0 = unstamped). */
export function puzzleScoreRevOf(puzzle: unknown): number {
  const rev = (puzzle as { puzzleScoreRev?: number } | null)?.puzzleScoreRev;
  return typeof rev === "number" && Number.isFinite(rev) ? rev : 0;
}

/** Run a synchronous grade (or display) under one score revision, restoring the previous one after. */
export function withPuzzleScoreRev<T>(rev: number, run: () => T): T {
  const before = active;
  active = rev;
  try {
    return run();
  } finally {
    active = before;
  }
}

/** True while grading a rev-1 (or later) puzzle. */
export function scoreRev1(): boolean {
  return active >= 1;
}

/** Rev 1: cap any unfinished credit at 110 and floor it at 0. */
export function unfinishedCredit(points: number): number {
  if (!Number.isFinite(points)) return 0;
  return Math.max(0, Math.min(PUZZLE_UNFINISHED_CAP, Math.round(points)));
}

/**
 * Rev 1, moves games: unfinished credit is multiplied by this efficiency share,
 * 1 up to the minimum moves, falling evenly to 0 at 4× the minimum, so random
 * moves until the buzzer earn nothing while a player who ran out of time on a
 * sensible line keeps most of their progress.
 */
export const WASTE_ZERO_AT = 4;

export function wasteFactor(moves: number, minMoves: number): number {
  if (!(minMoves > 0) || !Number.isFinite(moves)) return 1;
  const over = (moves - minMoves) / ((WASTE_ZERO_AT - 1) * minMoves);
  return Math.max(0, Math.min(1, 1 - over));
}

/**
 * Rev 1: tries reward. Full 15 on try 1, about 8 on try 2, 0 from try 3
 * (Safe Cracker's tries, Lightbender's shots).
 */
export const TRY_EFFICIENCY = [15, 8, 0] as const;

export function tryEfficiency(tryNumber: number): number {
  const n = Math.max(1, Math.round(tryNumber) || 1);
  return TRY_EFFICIENCY[Math.min(TRY_EFFICIENCY.length, n) - 1] ?? 0;
}

let lastParts: ScoreParts | null = null;

/**
 * Rev 1 finish: 120 + efficiency + speed, capped at 150. Records the breakdown
 * for the grader to store on the round (takeScoreParts).
 */
export function finishParts(speed: number, efficiency?: number, measure?: string): number {
  const s = Math.max(0, Math.round(speed));
  const e = efficiency === undefined ? undefined : Math.max(0, Math.round(efficiency));
  lastParts = { kind: "finish", base: PUZZLE_FINISH_BASE, speed: s, ...(e !== undefined ? { efficiency: e, measure: measure ?? "efficiency" } : {}) };
  return Math.min(150, PUZZLE_FINISH_BASE + (e ?? 0) + s);
}

/** Rev 1 unfinished: the credit capped at 110, recorded as the breakdown. */
export function partialParts(points: number): number {
  const v = unfinishedCredit(points);
  lastParts = { kind: "partial", base: v };
  return v;
}

/** Record a breakdown that does not fit finishParts / partialParts (Ballpark's accuracy-scaled finish). */
export function recordParts(parts: ScoreParts): void {
  lastParts = parts;
}

/** The breakdown recorded by the last finishParts / partialParts call, cleared on read. */
export function takeScoreParts(): ScoreParts | null {
  const parts = lastParts;
  lastParts = null;
  return parts;
}

/** The breakdown a rev-1 grade stores on the round (`extra.parts`) for the reveal. */
export interface ScoreParts {
  /** "finish": base + efficiency + speed; "partial": unfinished credit. */
  kind: "finish" | "partial";
  base: number;
  efficiency?: number;
  speed?: number;
  /** What the efficiency part measures, for the reveal line ("moves", "tries", "strikes", "darts"). */
  measure?: string;
}

/** The stored breakdown on a round's extra, if it has one. */
export function storedScoreParts(extra: Record<string, unknown> | null | undefined): ScoreParts | null {
  const parts = extra?.["parts"] as ScoreParts | undefined;
  return parts && (parts.kind === "finish" || parts.kind === "partial") ? parts : null;
}

/** "120 + 11 moves + 15 speed" for a stored finish. */
export function scorePartsText(parts: ScoreParts): string {
  if (parts.kind === "partial") return `${parts.base} for progress`;
  const terms = [`${parts.base}`];
  // A measure naming two things reads "25 gold crate and par" (4 Nov 2026: "25 gold crate + par" read as a missing number).
  if (parts.efficiency !== undefined) terms.push(`${parts.efficiency} ${(parts.measure ?? "efficiency").replace(/ \+ /g, " and ")}`);
  if (parts.speed !== undefined) terms.push(`${parts.speed} speed`);
  return terms.join(" + ");
}
