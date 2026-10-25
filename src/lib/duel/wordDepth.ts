/**
 * Word puzzle depth to 200 (25 Oct 2026, depth session d1; docs/depth/d1-word.md, docs/scoring-200.md).
 *
 * Nine word games score up to 200 under their own new stamps: Nucleus, Interlock, Slider, Forage, Lookout,
 * Roundabout, Strikeout, Cryptogrid and Swapword. Two routes:
 *
 *   - STRETCH (Interlock, Cryptogrid, Strikeout, Nucleus): the game is unchanged; a solid player of today
 *     scores what they do now, play that reaches 150 today scores about 150–165, and only elite play (very
 *     fast, no mistakes) reaches 190–200 (`stretchFinish`).
 *   - FEATURES (Slider, Forage, Lookout, Roundabout, Swapword; Nucleus and Strikeout add one to the stretch):
 *     today's score (at most 150) plus a feature bonus; the extra 50 is reachable only through the feature.
 *
 * Shared by the phone and the server: pure arithmetic on the grader's own figures, no dictionary, no answers.
 * Older stamps never reach this file's scoring (generate.server.ts calls the depth grader only for puzzles that
 * carry their game's depth stamp), so a stored round always scores exactly as before.
 */
import type { PuzzleType } from "./types";

/** The nine games of this depth session. */
export const WORD_DEPTH_GAMES: readonly PuzzleType[] = [
  "wordsmith", "tilegrid", "wordslide", "wordhunt", "wordsearch", "letterwheel", "strikeout", "codeword", "swapword",
];

/** The round maximum the depth stamps score to (ROUND_MAX's line for each of the nine). */
export const DEPTH_MAX = 200;
/** Today's maximum, the top of every pre-depth stamp. */
export const PRE_DEPTH_MAX = 150;

let pinned = false;
/**
 * Checks written for the pre-depth stamps (their numbers are today's 150 scale) pin new deals of the nine games to
 * the stamp before the depth one, so they keep proving what they were written for. Never called by app code.
 */
export function pinPreDepth(on: boolean): void {
  pinned = on;
}

/** The stamp new puzzles of a depth game are dealt: `depthRev`, or `preRev` while a check pinned the old one. */
export function dealtDepthRev<T>(depthRev: T, preRev: T): T {
  return pinned ? preRev : depthRev;
}

/** True while a check pins new deals to the pre-depth stamps. */
export function preDepthPinned(): boolean {
  return pinned;
}

/* ------------------------------------------------------------------ the stretch finish */

/**
 * A stretch game's finish curve. Below `fast` (rev 3's fastShare) it is rev 3's finish exactly:
 * 120 + 30 × min(1, left ÷ fast) × efficiency. Beyond it the top 50 opens up only for play clearly faster than
 * today's 150 pace and free of mistakes: 50 × efficiency^effPower × s^power, s = (left − fast) ÷ (elite − fast)
 * clamped to 0–1, so finishing at today's 150 pace still scores 150, a little faster about 150–165, and only
 * `elite` time left with no mistakes reaches 200.
 */
export interface StretchCurve {
  /** Today's fastShare (rev 3): the share of the clock left at which a clean finish scores 150. */
  fast: number;
  /** The share of the clock left at which a clean finish scores 200. */
  elite: number;
  /** Shape of the climb from 150 to 200 (> 1: slow at first, so today's 150 players stay near 150). */
  power: number;
  /** How hard mistakes cut the top 50 (efficiency to this power). */
  effPower: number;
}

export interface StretchParts {
  score: number;
  /** Rev 3's speed points (0–30). */
  speed: number;
  /** The stretch points above 150 (0–50). */
  stretch: number;
}

export function stretchFinish(curve: StretchCurve, left: number, efficiency: number): StretchParts {
  const l = clamp01(left);
  const e = clamp01(efficiency);
  const speed = Math.round(30 * Math.min(1, l / curve.fast) * e);
  const span = Math.max(0.01, curve.elite - curve.fast);
  const s = clamp01((l - curve.fast) / span);
  const stretch = Math.round(50 * Math.pow(e, curve.effPower) * Math.pow(s, curve.power));
  return { score: Math.min(DEPTH_MAX, 120 + speed + stretch), speed, stretch };
}

/** Seconds a clean finish may take and still score 200 ("200 in about N s"). */
export function stretchEliteSeconds(curve: StretchCurve, limitMs: number): number {
  return Math.round((limitMs * (1 - curve.elite)) / 1000);
}

/** Seconds a clean finish may take and still score 150 (today's pace). */
export function stretchFastSeconds(curve: StretchCurve, limitMs: number): number {
  return Math.round((limitMs * (1 - curve.fast)) / 1000);
}

/** Today's score plus a feature bonus, never above the depth maximum. */
export function withBonus(base: number, bonus: number): number {
  return Math.max(0, Math.min(DEPTH_MAX, Math.round(base) + Math.max(0, Math.round(bonus))));
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
