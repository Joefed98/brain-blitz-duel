/**
 * Puzzle score bands (19 Oct 2026, `puzzleScoreRev: 2`; docs/scoring-targets.md).
 *
 * Joe's bands for a round (0–150): perfect 150 only, near perfect 130–149, great
 * 110–129, good 90–109, decent 80–89, average 60–79, then smoothly down to 0 for
 * doing nothing. Rev 2 keeps every game's rev-1 grader (what counts, what a
 * finish is, every limit and cost) and turns its result into one number, the
 * round's **result** (0–200), then into points through the game's own knots
 * (PUZZLE_REV2_KNOTS, fitted on the simulated players: scripts/puzzle-bands-fit.ts):
 *
 *   - unfinished: result = 99 × progress, progress = the rev-1 unfinished credit
 *     ÷ 110 (each game's own measure of the answer it holds: cells, words, pairs,
 *     scales…, already cut by its waste and mistake rules), so 50 % done is
 *     result 45 and always scores, and every finish (result ≥ 100) beats every
 *     unfinished run;
 *   - finished: result = 100 + 100 × quality, quality = the share of the clock
 *     left at the finish (straight, no par plateau), or half that and half the
 *     efficiency share (moves, tries, strikes, darts…) on games that measure
 *     efficiency, then cut by any penalty the rev-1 speed part took (wrong taps);
 *   - open games (no finish: Nucleus, Forage, Flash, Bang On, Ballpark): result =
 *     the rev-1 score (0–150).
 *
 * Each game's knots run from (0, 0) through its simulated players' medians
 * (average 70, good 100, great 120, near-perfect 140) to 150 at the result only a
 * perfect run reaches, so the same skill lands in the same band in every game.
 * The 50 % par rule (CLAUDE.md rule 6) gave every finish with half the clock left
 * the full speed part, which made a near-perfect and a perfect finish the same
 * 150; rev 2 measures the whole clock instead (a decision noted for Joe). Older
 * rounds keep their stamps and grade exactly as before.
 *
 * Server-only arithmetic on the grader's own figures; the phone never scores.
 */
import { speedBonusCurve } from "./speedPar";
import { PUZZLE_EFFICIENCY_POINTS, PUZZLE_FINISH_BASE, type ScoreParts } from "./puzzleScoreRev";
import { PUZZLE_REV2_KNOTS } from "./puzzleBands.data";
import { GRAVITY_PROGRESS_REV, TUBES_PROGRESS_REV } from "./moveLimits";
import type { PuzzleData, PuzzleType } from "./types";

export const PUZZLE_SCORE_REV_BANDS = 2;

/** Puzzles with a finish state: their rev-1 breakdown (finishParts / partialParts) is the input. */
export const REV2_FINISH_GAMES: ReadonlySet<PuzzleType> = new Set<PuzzleType>([
  "tilegrid", "wordslide", "wordsearch", "letterwheel", "strikeout", "codeword", "swapword",
  "target", "equation", "balance", "numpyramid", "trail", "measure", "checkout",
  "numhunt", "chain",
  "symscan", "spotdiff", "countup", "maze", "pairmatch",
  "unblock", "blockparty", "iceslide", "gravity", "tiles", "rings", "laser",
  "pipes", "lightsout", "sudoku", "flow", "push", "tower", "tubes", "safe", "bomb", "nonogram", "flood", "tents", "shikaku", "lightup",
]);
/** Puzzles without a clean finish: the rev-1 score itself is the result. */
export const REV2_OPEN_GAMES: ReadonlySet<PuzzleType> = new Set<PuzzleType>(["wordsmith", "wordhunt", "reaction", "stopwatch", "numline"]);

/** Unfinished results stay below every finish (100). */
export const REV2_UNFINISHED_TOP = 99;
const UNFINISHED_CREDIT_TOP = 110;

/** Knots [result, points]: result ascending from 0, points ascending from 0, flat past the last. */
export type Rev2Knots = readonly (readonly [number, number])[];

export function rev2Applies(type: PuzzleType): boolean {
  return REV2_FINISH_GAMES.has(type) || REV2_OPEN_GAMES.has(type);
}

export interface Rev2Result {
  /** 0–99 unfinished, 100–200 finished; open games 0–150. */
  result: number;
  finished: boolean;
  /** Finished: the time share (0–1) and the efficiency share (0–1) when the game measures one. */
  time?: number;
  efficiency?: number;
}

/**
 * The round's result from the rev-1 grade: its breakdown, whether it finished,
 * the time left and the round's limit. Open games pass their rev-1 score.
 */
export function rev2ResultOf(
  type: PuzzleType,
  rev1Score: number,
  parts: ScoreParts | null,
  msRemaining: number,
  limitMs: number,
): Rev2Result {
  if (REV2_OPEN_GAMES.has(type)) return { result: clamp(rev1Score, 0, 150), finished: false };
  if (!parts || parts.kind === "partial") {
    const credit = parts ? parts.base : rev1Score;
    const progress = clamp(credit, 0, UNFINISHED_CREDIT_TOP) / UNFINISHED_CREDIT_TOP;
    return { result: REV2_UNFINISHED_TOP * progress, finished: false };
  }
  const left = limitMs > 0 ? clamp(msRemaining, 0, limitMs) / limitMs : 0;
  const hasEff = parts.efficiency !== undefined;
  const speedMax = hasEff ? 30 - PUZZLE_EFFICIENCY_POINTS : 30;
  // A penalty the rev-1 speed part took (wrong taps, rough placing): the share of the speed it kept.
  const expected = limitMs > 0 ? speedBonusCurve(speedMax, clamp(msRemaining, 0, limitMs), limitMs) : 0;
  const kept = expected > 0 && parts.speed !== undefined ? clamp(parts.speed / expected, 0, 1) : 1;
  // Finishes that score their base on accuracy (below 120) keep that share too.
  const baseShare = parts.base < PUZZLE_FINISH_BASE ? clamp(parts.base / PUZZLE_FINISH_BASE, 0, 1) : 1;
  const time = left * kept * baseShare;
  if (hasEff) {
    const efficiency = clamp(parts.efficiency! / PUZZLE_EFFICIENCY_POINTS, 0, 1);
    return { result: 100 + 100 * (0.5 * time + 0.5 * efficiency), finished: true, time, efficiency };
  }
  return { result: 100 + 100 * time, finished: true, time };
}

/** Points for a result on a game's knots (straight lines between, flat beyond the last). */
export function rev2Points(knots: Rev2Knots, result: number): number {
  if (!(result > 0) || knots.length === 0) return 0;
  const last = knots[knots.length - 1]!;
  if (result >= last[0]) return Math.round(last[1]);
  for (let i = 1; i < knots.length; i++) {
    const [x1, y1] = knots[i]!;
    if (result > x1) continue;
    const [x0, y0] = knots[i - 1]!;
    return Math.round(y0 + ((y1 - y0) * (result - x0)) / (x1 - x0));
  }
  return Math.round(last[1]);
}

/**
 * A game whose progress measure changed under its own stamp scores on its own knots row, `<type>:<stamp>`
 * (Topsy-Turvy gravityRev 2, Polypotions tubesRev 2: solverProgress.server.ts); older rounds keep the game's row.
 */
export function rev2KnotsKey(puzzle: PuzzleData): string {
  if (puzzle.type === "gravity" && (puzzle.gravityRev ?? 0) >= GRAVITY_PROGRESS_REV) return `gravity:${GRAVITY_PROGRESS_REV}`;
  if (puzzle.type === "tubes" && (puzzle.tubesRev ?? 0) >= TUBES_PROGRESS_REV) return `tubes:${TUBES_PROGRESS_REV}`;
  return puzzle.type;
}

/** The knots row rooms deal today for each game (the help text states these). */
export const REV2_DEALT_KEY: Partial<Record<PuzzleType, string>> = {
  gravity: `gravity:${GRAVITY_PROGRESS_REV}`,
  tubes: `tubes:${TUBES_PROGRESS_REV}`,
};

/** The knots a game is dealt on today (the shared default when a game has no fitted row). */
export function rev2KnotsFor(type: PuzzleType): Rev2Knots {
  return PUZZLE_REV2_KNOTS[REV2_DEALT_KEY[type] ?? type] ?? PUZZLE_REV2_KNOTS[type] ?? REV2_DEFAULT_KNOTS;
}

/** The knots a stored puzzle scores on (its own stamp's row). */
export function rev2KnotsForPuzzle(puzzle: PuzzleData): Rev2Knots {
  return PUZZLE_REV2_KNOTS[rev2KnotsKey(puzzle)] ?? PUZZLE_REV2_KNOTS[puzzle.type] ?? REV2_DEFAULT_KNOTS;
}

/** Default shape: half done 45, a finish at the buzzer 90, a third of the clock left 120, 150 from 80 % left. */
export const REV2_DEFAULT_KNOTS: Rev2Knots = [[0, 0], [50, 45], [99, 85], [100, 90], [133, 120], [160, 140], [180, 150]];

export interface Rev2Grade {
  score: number;
  parts: ScoreParts;
}

/**
 * Rev 2's score and the breakdown stored for the reveal (it always adds up to
 * the score): unfinished "N for progress"; finished "base + efficiency + speed",
 * where base is what a finish at the buzzer scores and the rest is split between
 * the efficiency and time shares in proportion.
 */
export function rev2Grade(puzzle: PuzzleData, rev1Score: number, parts: ScoreParts | null, msRemaining: number, limitMs: number): Rev2Grade {
  const knots = rev2KnotsForPuzzle(puzzle);
  const r = rev2ResultOf(puzzle.type, rev1Score, parts, msRemaining, limitMs);
  const score = Math.max(0, Math.min(150, rev2Points(knots, r.result)));
  if (!r.finished) return { score, parts: { kind: "partial", base: score } };
  const base = Math.min(score, rev2Points(knots, 100));
  const rest = score - base;
  if (r.efficiency === undefined) return { score, parts: { kind: "finish", base, speed: rest } };
  const total = r.efficiency + (r.time ?? 0);
  const efficiency = total > 0 ? Math.round((rest * r.efficiency) / total) : 0;
  return { score, parts: { kind: "finish", base, efficiency, speed: rest - efficiency, measure: parts?.measure ?? "efficiency" } };
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}
