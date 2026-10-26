/**
 * The STRETCH games' curve shapes and score texts (word depth, 25 Oct 2026; docs/depth/d1-word.md): Interlock,
 * Cryptogrid and Strikeout. Shared by the phone (intro and "?" help) and the server graders
 * (depth/<type>.server.ts), so the texts always state the curve rooms deal. Shapes fitted with
 * scripts/depth-word-bands.ts.
 */
import { DEALT_LIMIT_S, PROGRESS_MEASURE, PROGRESS_SHORT, rev3Figures } from "../puzzleBandsText";
import { rev3Game } from "../puzzleScoreRev3";
import type { PuzzleType } from "../types";
import type { StretchCurve } from "../wordDepth";

export interface StretchShape {
  /** The share of the clock left at which a clean finish earns all of the pace bonus. */
  elite: number;
  /** Where the pace bonus starts (the top-up's own; else rev 3's fastShare, today's 150 pace). */
  fast?: number;
  power: number;
  effPower: number;
}

export const TILEGRID_STRETCH: StretchShape = { elite: 0.84, power: 1.5, effPower: 2 };
/**
 * The puzzle top-up (26 Oct 2026, tileGridRev 2; docs/depth/topup-oct-2026.md): the pace bonus starts a little
 * before today's 150 pace and is full a little sooner, so today's near-perfect finish lands about 150–165 and an
 * elite one 190–200 (tileGridRev 1's elite share sat past the elite player's reach).
 */
export const TILEGRID_STRETCH_TOPUP: StretchShape = { elite: 0.8, fast: 0.66, power: 1.3, effPower: 2 };
export const CODEWORD_STRETCH: StretchShape = { elite: 0.86, power: 1.5, effPower: 2 };
/**
 * The puzzle top-up (26 Oct 2026, strikeoutRev 6; docs/depth/topup-oct-2026.md): the same two halves, each rising
 * evenly with the time left from well before today's 150 pace (pace from STRIKEOUT_TOPUP_PACE.fast, early solves
 * from STRIKEOUT_TOPUP_EARLY_FROM), full only at elite pace. Today's near-perfect finish (about 60 % of the clock
 * left, most words solved early) lands about 165–175, under 185 at its quickest; 190–200 needs elite pace.
 */
export const STRIKEOUT_TOPUP_PACE: StretchShape = { elite: 0.85, fast: 0.45, power: 1, effPower: 2 };
export const STRIKEOUT_TOPUP_EARLY_FROM = 0.25;
export const STRIKEOUT_TOPUP_EARLY_FULL_AT = 0.85;
/** Strikeout's pace bonus is half the stretch (25); early solves are the other half. */
export const STRIKEOUT_STRETCH: StretchShape = { elite: 0.8, power: 1.2, effPower: 2 };
export const STRIKEOUT_PACE_POINTS = 25;
export const STRIKEOUT_EARLY_POINTS = 25;
/** An early-solve share (hidden tiles at the solves ÷ hidden tiles at the starts) of 0.8 or more counts in full. */
export const STRIKEOUT_EARLY_FULL = 0.8;
/** Early points are cut by (time left ÷ rev 3's fastShare)³: they count in full only on a quick finish. */
export const STRIKEOUT_EARLY_QUICK_POWER = 3;

/** The game's stretch curve: the shape's own `fast`, else rev 3's fastShare, and the shape as given. */
export function stretchCurveFor(type: PuzzleType, shape: StretchShape): StretchCurve {
  return { ...shape, fast: shape.fast ?? rev3Game(type).fastShare };
}

function seconds(type: PuzzleType, share: number): number {
  return Math.round((DEALT_LIMIT_S[type] ?? 90) * (1 - share));
}

/** Seconds of a clean finish for 150 (today's pace) and for the maximum. */
export function stretchSeconds(type: PuzzleType, shape: StretchShape): { fast: number; elite: number } {
  return { fast: seconds(type, rev3Game(type).fastShare), elite: seconds(type, shape.elite) };
}

/** The "?" help SCORE text for Interlock and Cryptogrid. */
export function stretchHelp(type: PuzzleType, shape: StretchShape): string {
  const f = rev3Figures(type);
  const s = stretchSeconds(type, shape);
  return `Progress counts: ${PROGRESS_MEASURE[type] ?? "your progress"}. Unfinished scores up to 110: about ${f.half} half done, 110 one step short. Any finish scores 120 or more: 150 if you finish in about ${s.fast} s. Faster still earns a pace bonus: {max} if you finish in about ${s.elite} s.`;
}

/** The intro SCORE line for Interlock and Cryptogrid. */
export function stretchIntro(type: PuzzleType, shape: StretchShape): string {
  const short = PROGRESS_SHORT[type] ?? "progress";
  const s = stretchSeconds(type, shape);
  return `${short[0]!.toUpperCase()}${short.slice(1)}: up to 110. Finish: 120+, 150 in about ${s.fast} s, {max} in about ${s.elite} s.`;
}

/** Strikeout's "?" help SCORE text (strikeoutRev 6, the top-up's rising bonuses). */
export function strikeoutDepthHelp(): string {
  const f = rev3Figures("strikeout");
  const s = stretchSeconds("strikeout", STRIKEOUT_TOPUP_PACE);
  return `Progress counts: ${PROGRESS_MEASURE.strikeout}. Unfinished scores up to 110: about ${f.half} half done. Any finish scores 120 or more: 120 plus up to 30 for speed (all of it in about ${s.fast} s with no strikes), up to ${STRIKEOUT_PACE_POINTS} for pace and up to ${STRIKEOUT_EARLY_POINTS} for early solves: Solve each word while its letters are still hidden (most of them hidden counts in full). Both rise the sooner you finish, all of them in about ${s.elite} s with no strikes. {max} needs both.`;
}

/** Strikeout's intro SCORE line. */
export function strikeoutDepthIntro(): string {
  const s = stretchSeconds("strikeout", STRIKEOUT_TOPUP_PACE);
  return `Words and letters: up to 110. Finish: 150 in about ${s.fast} s; {max} needs early solves too.`;
}
