import { ROUND_MS, TOTAL_ROUNDS, type RoundResultRow } from "./types";

export const BASE_POINTS = 100;
export const POINTS_PER_SECOND = 5;

/** Correct: 100 + 5 per full second remaining. Wrong / timeout: 0. */
export function scoreRound(isCorrect: boolean, msRemaining: number): number {
  if (!isCorrect) return 0;
  const clamped = Math.max(0, Math.min(ROUND_MS, msRemaining));
  return BASE_POINTS + POINTS_PER_SECOND * Math.floor(clamped / 1000);
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

/** Total time spent answering across all rounds — used for the tie-break. */
export function totalAnswerMs(results: RoundResultRow[], slot: number): number {
  return results
    .filter((r) => r.player_slot === slot)
    .reduce((sum, r) => sum + (ROUND_MS - r.ms_remaining), 0);
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
