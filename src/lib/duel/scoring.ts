import {
  ROUND_MS,
  STROOP_ITEMS,
  STROOP_POINTS_PER_ITEM,
  TOTAL_ROUNDS,
  type RoundResultRow,
} from "./types";

export const BASE_POINTS = 100;
export const POINTS_PER_SECOND = 5;
export const MAX_ROUND_SCORE = 250;

/** Correct: 100 + 5 per full second remaining. Wrong / timeout: 0. */
export function scoreRound(isCorrect: boolean, msRemaining: number): number {
  if (!isCorrect) return 0;
  const clamped = Math.max(0, Math.min(ROUND_MS, msRemaining));
  return BASE_POINTS + POINTS_PER_SECOND * Math.floor(clamped / 1000);
}

/** Reaction Time only: 250 at a 150 ms average, 0 at 650 ms or slower. */
export function scoreReaction(averageMs: number): number {
  const raw = Math.round(MAX_ROUND_SCORE - (averageMs - 150) / 2);
  return Math.max(0, Math.min(MAX_ROUND_SCORE, raw));
}

/**
 * Colour Clash only: 10 per correct item, plus the usual 5 per second left —
 * but the speed bonus is only earned on a flawless run of ten.
 */
export function scoreStroop(correctCount: number, msRemaining: number): number {
  const accuracy = STROOP_POINTS_PER_ITEM * Math.max(0, Math.min(STROOP_ITEMS, correctCount));
  const clamped = Math.max(0, Math.min(ROUND_MS, msRemaining));
  const bonus =
    correctCount >= STROOP_ITEMS ? POINTS_PER_SECOND * Math.floor(clamped / 1000) : 0;
  return Math.min(MAX_ROUND_SCORE, accuracy + bonus);
}

export function resultFor(
  results: RoundResultRow[],
  slot: number,
  round: number,
): RoundResultRow | undefined {
  return results.find((r) => r.player_slot === slot && r.round_number === round);
}

export function totalScore(results: RoundResultRow[], slot: number): number {
  return results
    .filter((r) => r.player_slot === slot)
    .reduce((sum, r) => sum + r.score, 0);
}

/**
 * Totals for finished rounds only. Used so nothing about the round in progress
 * leaks onto either player's screen.
 */
export function totalScoreThrough(
  results: RoundResultRow[],
  slot: number,
  lastRound: number,
): number {
  return results
    .filter((r) => r.player_slot === slot && r.round_number <= lastRound)
    .reduce((sum, r) => sum + r.score, 0);
}

/**
 * Total time spent answering across all rounds — used for the tie-break.
 * Reaction Time rounds contribute their average reaction time instead.
 */
export function totalAnswerMs(results: RoundResultRow[], slot: number): number {
  return results
    .filter((r) => r.player_slot === slot)
    .reduce(
      (sum, r) =>
        sum + (r.reaction_avg_ms !== null ? r.reaction_avg_ms : ROUND_MS - r.ms_remaining),
      0,
    );
}

export type Outcome = "win" | "loss" | "draw";

export function duelOutcome(
  results: RoundResultRow[],
  mySlot: number,
  opponentSlot: number,
): Outcome {
  const mine = totalScore(results, mySlot);
  const theirs = totalScore(results, opponentSlot);
  if (mine > theirs) return "win";
  if (mine < theirs) return "loss";

  const myTime = totalAnswerMs(results, mySlot);
  const theirTime = totalAnswerMs(results, opponentSlot);
  if (myTime < theirTime) return "win";
  if (myTime > theirTime) return "loss";
  return "draw";
}

export function roundBreakdown(
  results: RoundResultRow[],
  mySlot: number,
  opponentSlot: number,
) {
  return Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
    const round = i + 1;
    return {
      round,
      mine: resultFor(results, mySlot, round)?.score ?? 0,
      theirs: resultFor(results, opponentSlot, round)?.score ?? 0,
    };
  });
}
