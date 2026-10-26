/**
 * Matchmaker, Depth to 200 (25 Oct 2026, `pairRev: 1`; docs/depth/d3-speed-attention.md). FEATURES: the match
 * streak and the gold pair. The board, the flips and puzzleScoreRev 3's 150 are unchanged; the extra 50 comes only
 * from the two features:
 *
 *   - Match streak: matches in a row (tries that match, no miss between) build a multiplier, ×2 on the second
 *     match in a row up to ×PAIR_STREAK_TOP_MULT; every match adds its multiplier less one to the streak points,
 *     and the streak bonus is those points less PAIR_STREAK_FREE (a short run is what anyone makes when the
 *     last known pairs are cashed), at most PAIR_STREAK_MAX. A miss resets the multiplier to ×1.
 *   - Gold pair: one of the fifteen pairs is gold. Matched on try PAIR_GOLD_FULL_TRY or sooner it is worth
 *     PAIR_GOLD_MAX, falling evenly to nothing on try PAIR_GOLD_ZERO_TRY.
 *
 * Shared by the phone (the streak line and the gold card) and the server (depth/matchmaker.server.ts): both walk
 * the flip list through `pairDepthReplay`, so the bonus is the server's.
 */
import { sameCard } from "../pairmatch";
import type { PairCard, PairPuzzleData } from "../types";

export const PAIR_DEPTH_REV = 1;
export const PAIR_STREAK_TOP_MULT = 5;
export const PAIR_STREAK_FREE = 16;
export const PAIR_STREAK_MAX = 30;
export const PAIR_GOLD_MAX = 20;
export const PAIR_GOLD_FULL_TRY = 8;
export const PAIR_GOLD_ZERO_TRY = 20;

export function pairUsesDepth(puzzle: PairPuzzleData | null | undefined): boolean {
  return (puzzle?.pairRev ?? 0) >= PAIR_DEPTH_REV && !!puzzle?.gold;
}

export function isGoldCard(puzzle: PairPuzzleData, card: PairCard | undefined): boolean {
  return pairUsesDepth(puzzle) && sameCard(puzzle.gold, card);
}

export interface PairDepthReplay {
  /** The multiplier the next match would score at (×1 after a miss). */
  multiplier: number;
  /** Matches in the current run. */
  streak: number;
  /** Longest run of matches. */
  bestStreak: number;
  /** Streak points before the free ones come off. */
  streakPoints: number;
  streakBonus: number;
  /** The try (1-based) on which the gold pair was matched, or null. */
  goldTry: number | null;
  goldBonus: number;
}

export function pairStreakBonus(points: number): number {
  return Math.max(0, Math.min(PAIR_STREAK_MAX, points - PAIR_STREAK_FREE));
}

export function pairGoldBonus(goldTry: number | null): number {
  if (goldTry === null) return 0;
  if (goldTry <= PAIR_GOLD_FULL_TRY) return PAIR_GOLD_MAX;
  if (goldTry >= PAIR_GOLD_ZERO_TRY) return 0;
  return Math.round((PAIR_GOLD_MAX * (PAIR_GOLD_ZERO_TRY - goldTry)) / (PAIR_GOLD_ZERO_TRY - PAIR_GOLD_FULL_TRY));
}

/** Walks the flips exactly as replayPairs does (matched cards and a re-tap of the open card are ignored). */
export function pairDepthReplay(puzzle: PairPuzzleData, flips: readonly number[]): PairDepthReplay {
  const cards = puzzle.cards;
  const matched = new Set<number>();
  let first: number | null = null;
  let tries = 0;
  let streak = 0;
  let bestStreak = 0;
  let streakPoints = 0;
  let goldTry: number | null = null;
  for (const card of flips) {
    if (matched.has(card)) continue;
    if (first === null) {
      first = card;
      continue;
    }
    if (card === first) continue;
    tries += 1;
    if (sameCard(cards[first], cards[card])) {
      matched.add(first).add(card);
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      streakPoints += Math.min(PAIR_STREAK_TOP_MULT, streak) - 1;
      if (goldTry === null && isGoldCard(puzzle, cards[card])) goldTry = tries;
    } else {
      streak = 0;
    }
    first = null;
  }
  return {
    multiplier: Math.min(PAIR_STREAK_TOP_MULT, streak + 1),
    streak,
    bestStreak,
    streakPoints,
    streakBonus: pairStreakBonus(streakPoints),
    goldTry,
    goldBonus: pairGoldBonus(goldTry),
  };
}

/* ------------------------------------------------------------------ texts (help and intro) */

/** The "?" help SCORE text: the rev-3 text for the base, then the two features ({max} filled by the caller). */
export function pairDepthHelp(baseHelp: string, max: number): string {
  return `${baseHelp.split(String(max)).join("150")} On top: matches in a row build a streak (the second match in a row counts double, up to five times on the fifth); a long streak adds up to ${PAIR_STREAK_MAX}, a miss starts it again. The gold pair adds ${PAIR_GOLD_MAX} if you match it within ${PAIR_GOLD_FULL_TRY} tries, less after, none from try ${PAIR_GOLD_ZERO_TRY}. {max} needs both.`;
}

/** The round intro SCORE line (at most 90 characters). */
export const PAIR_DEPTH_INTRO = "Pairs: up to 110; finish fast for more. Streaks and an early gold pair add up to {max}.";
