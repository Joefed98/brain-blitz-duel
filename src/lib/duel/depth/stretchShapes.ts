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
  power: number;
  effPower: number;
}

export const TILEGRID_STRETCH: StretchShape = { elite: 0.84, power: 1.5, effPower: 2 };
export const CODEWORD_STRETCH: StretchShape = { elite: 0.86, power: 1.5, effPower: 2 };
/** Strikeout's pace bonus is half the stretch (25); early solves are the other half. */
export const STRIKEOUT_STRETCH: StretchShape = { elite: 0.8, power: 1.2, effPower: 2 };
export const STRIKEOUT_PACE_POINTS = 25;
export const STRIKEOUT_EARLY_POINTS = 25;
/** An early-solve share (hidden tiles at the solves ÷ hidden tiles at the starts) of 0.8 or more counts in full. */
export const STRIKEOUT_EARLY_FULL = 0.8;
/** Early points are cut by (time left ÷ rev 3's fastShare)³: they count in full only on a quick finish. */
export const STRIKEOUT_EARLY_QUICK_POWER = 3;

/** The game's stretch curve: rev 3's fastShare as `fast`, the shape as given. */
export function stretchCurveFor(type: PuzzleType, shape: StretchShape): StretchCurve {
  return { fast: rev3Game(type).fastShare, ...shape };
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

/** Strikeout's "?" help SCORE text. */
export function strikeoutDepthHelp(): string {
  const f = rev3Figures("strikeout");
  const s = stretchSeconds("strikeout", STRIKEOUT_STRETCH);
  return `Progress counts: ${PROGRESS_MEASURE.strikeout}. Unfinished scores up to 110: about ${f.half} half done. Any finish scores 120 or more: 150 if you finish in about ${s.fast} s with no strikes. Above that, up to ${STRIKEOUT_PACE_POINTS} for pace (all of it in about ${s.elite} s, no strikes) and up to ${STRIKEOUT_EARLY_POINTS} for early solves: Solve each word while its letters are still hidden (most of them hidden counts in full, on a quick finish). {max} needs both.`;
}

/** Strikeout's intro SCORE line. */
export function strikeoutDepthIntro(): string {
  const s = stretchSeconds("strikeout", STRIKEOUT_STRETCH);
  return `Words and letters: up to 110. Finish: 150 in about ${s.fast} s; {max} needs early solves too.`;
}
