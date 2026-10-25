/**
 * Forage's depth rules (wordHuntRev 3, 25 Oct 2026, word depth d1; docs/depth/d1-word.md "Forage"). Shared by the
 * phone (its counter and word chips) and the server (the score); pure arithmetic on public rules: the board, the
 * golden tile and the traced path. Older stamps never read this file: they keep the 5×5 board and today's curve.
 *
 *   - A 6×6 board (36 tiles) instead of 5×5; the round's clock is unchanged.
 *   - Long words: 6 letters ×1.5, 7+ letters ×2 (on the word's points: 6 → 4 × 1.5 = 6, 7 → 14, 8+ → 22).
 *   - The golden tile: one public tile glows gold; a word traced through it scores double.
 *   - Score: base word points (no multipliers) on a curve to 150, plus the extras the features add on their own
 *     curve to 50, both cut by misses as rev 2. Base points alone never pass 150: the extra 50 comes only from long
 *     words and the golden tile.
 */
import { bandCurve, bandOpen } from "@/lib/arcade/scoreBands";
import { wordHuntPoints } from "./types";

/** wordHuntRev 3: the 6×6 board, long-word multiplier and golden tile. */
export const WORDHUNT_REV_DEPTH = 3;
/** The board's side on wordHuntRev 3. */
export const WORDHUNT_DEPTH_COLS = 6;
/** Long words: from this many letters ×1.5, from WORDHUNT_LONG_DOUBLE ×2. */
export const WORDHUNT_LONG_FROM = 6;
export const WORDHUNT_LONG_DOUBLE = 7;
/** The golden tile's multiplier. */
export const WORDHUNT_GOLD_MULT = 2;
/** The parts of the score: base points to 150, feature extras to 50. */
export const WORDHUNT_DEPTH_BASE_MAX = 150;
export const WORDHUNT_DEPTH_BONUS_MAX = 50;

/**
 * Base word points (no multipliers) → points, at most 150: today's Forage curve (wordHuntRev 1's curve through its
 * rev-2 knots), refitted on the 6×6 board so a player of today's skill lands where they did on 5×5.
 */
export const WORDHUNT_V3_BASE_CURVE = bandCurve([0, 4, 6, 9, 18, 27, 44, 70], [0, 6, 25, 58, 92, 112, 135, 150]);
/** Feature extras (what long words and the golden tile add) → bonus points, at most 50. */
export const WORDHUNT_V3_BONUS_CURVE = bandCurve([0, 8, 17, 27, 48, 89, 140], [0, 6, 9, 13, 20, 38, 50]);

/** True when the stored board carries the depth rules. */
export function wordHuntDepth(puzzle: { wordHuntRev?: number | undefined } | null | undefined): boolean {
  return (puzzle?.wordHuntRev ?? 0) >= WORDHUNT_REV_DEPTH;
}

/** The long-word multiplier for a word of `length` letters, in halves (2 = ×1, 3 = ×1.5, 4 = ×2). */
export function wordHuntLongHalves(length: number): number {
  if (length >= WORDHUNT_LONG_DOUBLE) return 4;
  if (length >= WORDHUNT_LONG_FROM) return 3;
  return 2;
}

/** The "×1.5" / "×2" label of a long word ("" for shorter ones). */
export function wordHuntLongLabel(length: number): string {
  const h = wordHuntLongHalves(length);
  return h === 4 ? "×2" : h === 3 ? "×1.5" : "";
}

export interface WordHuntValue {
  /** The word's points with no multiplier (the rev-1/2 table). */
  base: number;
  /** Its points with the long-word and golden multipliers. */
  value: number;
  /** value − base: what the features added. */
  extra: number;
  long: boolean;
  gold: boolean;
}

/** One accepted word's points on wordHuntRev 3, from its letters and the path traced (golden = the tile index). */
export function wordHuntValue(word: string, path: readonly number[], golden: number | null | undefined): WordHuntValue {
  const base = wordHuntPoints(word);
  const halves = wordHuntLongHalves(word.trim().length);
  const gold = typeof golden === "number" && path.includes(golden);
  const value = (base * halves * (gold ? WORDHUNT_GOLD_MULT : 1)) / 2;
  return { base, value, extra: value - base, long: halves > 2, gold };
}

export interface WordHuntDepthScore {
  score: number;
  /** Base points' part (0–150) and the features' part (0–50), both after the misses' cut. */
  basePart: number;
  bonusPart: number;
}

/** wordHuntRev 3's score: base points on their curve plus feature extras on theirs, each cut by `keptPct`. */
export function scoreWordHuntDepth(basePoints: number, extraPoints: number, keptPct = 100): WordHuntDepthScore {
  const kept = Math.max(0, Math.min(100, keptPct));
  const basePart = Math.floor((bandOpen(WORDHUNT_V3_BASE_CURVE, Math.round(basePoints)) * kept) / 100);
  const bonusPart = Math.floor((bandOpen(WORDHUNT_V3_BONUS_CURVE, Math.round(extraPoints), WORDHUNT_DEPTH_BONUS_MAX) * kept) / 100);
  return { score: Math.min(WORDHUNT_DEPTH_BASE_MAX, basePart) + Math.min(WORDHUNT_DEPTH_BONUS_MAX, bonusPart), basePart, bonusPart };
}
