import { checkAnswer } from "./puzzles";
import { puzzleTimeLimitMs } from "./registry";
import { decodeSteps, formatStep, replayTargetSteps } from "./target";
import {
  scoreGoNoGo,
  scoreNumberHunt,
  scoreReaction,
  scoreRound,
  scoreStopWatch,
  scoreStroop,
  scoreTargetNumber,
  scoreWordMatch,
} from "./scoring";
import {
  GONOGO_ITEMS,
  NUMHUNT_COUNT,
  REACTION_PENALTY_MS,
  ROUND_MS,
  STOPWATCH_MISS_MS,
  STROOP_ITEMS,
  WORDMATCH_ITEMS,
  type PuzzleData,
} from "./types";

export interface SubmitExtra {
  reactionAvgMs?: number | undefined;
  correctCount?: number | undefined;
  errors?: number | undefined;
}

export interface Graded {
  answer: string;
  isCorrect: boolean;
  score: number;
  reactionAvgMs: number | null;
  correctCount: number | null;
  errors: number | null;
  /** Per-type detail stored on the round (Target Number: value reached + steps). */
  extra: Record<string, unknown> | null;
  storedMs: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * The single place an answer is checked and scored. Runs on the server only —
 * for real rooms (submit_answer) and for practice mode alike.
 */
export function gradeSubmission(
  puzzle: PuzzleData,
  rawAnswer: string,
  msRemaining: number,
  rawExtra?: SubmitExtra,
): Graded {
  const extra = rawExtra ?? {};
  const answer = typeof rawAnswer === "string" ? rawAnswer.slice(0, 200) : "";
  const timeLimitMs = puzzleTimeLimitMs(puzzle);
  const ms = clamp(msRemaining, 0, timeLimitMs);

  let isCorrect = false;
  let score = 0;
  let reactionAvgMs: number | null = null;
  let correctCount: number | null = null;
  let errors: number | null = null;
  let extraDetail: Record<string, unknown> | null = null;
  let storedMs = ms;

  switch (puzzle.type) {
    case "reaction": {
      reactionAvgMs = clamp(extra.reactionAvgMs ?? REACTION_PENALTY_MS, 0, 5_000);
      isCorrect = true;
      score = scoreReaction(reactionAvgMs);
      storedMs = 0;
      break;
    }
    case "gonogo": {
      correctCount = clamp(extra.correctCount ?? 0, 0, GONOGO_ITEMS);
      reactionAvgMs =
        extra.reactionAvgMs === undefined || extra.reactionAvgMs === null
          ? null
          : clamp(extra.reactionAvgMs, 0, 5_000);
      isCorrect = correctCount >= GONOGO_ITEMS;
      score = scoreGoNoGo(correctCount, reactionAvgMs);
      storedMs = 0;
      break;
    }
    case "stroop": {
      correctCount = clamp(extra.correctCount ?? 0, 0, STROOP_ITEMS);
      isCorrect = correctCount >= STROOP_ITEMS;
      score = scoreStroop(correctCount, ms);
      break;
    }
    case "wordmatch": {
      // Checked here against the stored answers — the client never sees them.
      const picks = answer.split(",").map((v) => Number.parseInt(v, 10));
      correctCount = (puzzle.answers ?? []).filter((a, i) => picks[i] === a).length;
      isCorrect = correctCount >= WORDMATCH_ITEMS;
      score = scoreWordMatch(correctCount, ms);
      break;
    }
    case "stopwatch": {
      const distances = answer
        .split(",")
        .map((v) => Number.parseInt(v, 10))
        .filter((v) => Number.isFinite(v))
        .map((v) => clamp(v, 0, STOPWATCH_MISS_MS));
      reactionAvgMs = distances.length
        ? Math.round(distances.reduce((a, b) => a + b, 0) / distances.length)
        : STOPWATCH_MISS_MS;
      isCorrect = true;
      score = scoreStopWatch(reactionAvgMs);
      storedMs = 0;
      break;
    }
    case "numhunt": {
      const reached = Number.parseInt(answer.split(",")[0] ?? "0", 10);
      errors = clamp(extra.errors ?? 0, 0, 99);
      const finished = Number.isFinite(reached) && reached >= NUMHUNT_COUNT;
      isCorrect = finished;
      score = scoreNumberHunt(finished, ms, errors);
      break;
    }
    case "target": {
      // The client sends its steps; every one is replayed and re-checked here
      // and the final value is worked out from the tiles, never trusted.
      const replay = replayTargetSteps(puzzle.tiles, puzzle.target, decodeSteps(answer));
      const distance = replay.distance ?? Number.MAX_SAFE_INTEGER;
      isCorrect = distance === 0;
      score = scoreTargetNumber(distance, ms, timeLimitMs);
      extraDetail = {
        value: replay.value,
        steps: replay.steps.map(formatStep),
      };
      break;
    }
    default: {
      isCorrect = answer.length > 0 && checkAnswer(puzzle, answer);
      score = scoreRound(isCorrect, ms, timeLimitMs);
    }
  }

  return { answer, isCorrect, score, reactionAvgMs, correctCount, errors, extra: extraDetail, storedMs };
}
