import {
  GONOGO_ITEMS,
  NUMHUNT_ERROR_PENALTY,
  ROUND_MS,
  STROOP_ITEMS,
  TOTAL_ROUNDS,
  type RoundResultRow,
} from "./types";

export const BASE_POINTS = 100;
/** Speed bonus on top of the base — a correct answer always scores 100–150. */
export const MAX_SPEED_BONUS = 50;
export const MAX_ROUND_SCORE = BASE_POINTS + MAX_SPEED_BONUS;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** 0–50 for how much of the 30 seconds was left. */
export function speedBonus(msRemaining: number): number {
  const clamped = clamp(msRemaining, 0, ROUND_MS);
  return Math.round((MAX_SPEED_BONUS * clamped) / ROUND_MS);
}

/** 0–50 from an average reaction time: 50 at 150 ms, 0 at 650 ms or slower. */
export function reactionBonus(averageMs: number): number {
  return clamp(Math.round((650 - averageMs) / 10), 0, MAX_SPEED_BONUS);
}

/** Correct: 100 plus the speed bonus. Wrong / timeout: 0. */
export function scoreRound(isCorrect: boolean, msRemaining: number): number {
  if (!isCorrect) return 0;
  return BASE_POINTS + speedBonus(msRemaining);
}

/** Reaction Time only: a run is never wrong, so it always scores at least 100. */
export function scoreReaction(averageMs: number): number {
  return BASE_POINTS + reactionBonus(averageMs);
}

/** Colour Clash: accuracy out of 100, plus the speed bonus on a flawless run. */
export function scoreStroop(correctCount: number, msRemaining: number): number {
  const correct = clamp(correctCount, 0, STROOP_ITEMS);
  const accuracy = Math.round((BASE_POINTS * correct) / STROOP_ITEMS);
  const bonus = correct >= STROOP_ITEMS ? speedBonus(msRemaining) : 0;
  return Math.min(MAX_ROUND_SCORE, accuracy + bonus);
}

/** Go / No-Go: accuracy out of 100, plus a reaction bonus on a flawless run. */
export function scoreGoNoGo(correctCount: number, averageHitMs: number | null): number {
  const correct = clamp(correctCount, 0, GONOGO_ITEMS);
  const accuracy = Math.round((BASE_POINTS * correct) / GONOGO_ITEMS);
  const perfect = correct >= GONOGO_ITEMS && averageHitMs !== null;
  const bonus = perfect ? reactionBonus(averageHitMs!) : 0;
  return Math.min(MAX_ROUND_SCORE, accuracy + bonus);
}

/** Number Hunt: a standard round score, less 5 points per wrong tap. */
export function scoreNumberHunt(
  finished: boolean,
  msRemaining: number,
  errors: number,
): number {
  if (!finished) return 0;
  const raw = BASE_POINTS + speedBonus(msRemaining) - NUMHUNT_ERROR_PENALTY * errors;
  return Math.round(clamp(raw, 0, MAX_ROUND_SCORE));
}

export function resultFor(
  results: RoundResultRow[],
  slot: number,
  round: number,
): RoundResultRow | undefined {
  return results.find((r) => r.player_slot === slot && r.round_number === round);
}

export function totalScore(results: RoundResultRow[], slot: number): number {
  return results.filter((r) => r.player_slot === slot).reduce((sum, r) => sum + r.score, 0);
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
