import {
  BLOCK_FREE_CELLS,
  BLOCK_PARTIAL_POINTS,
  BLOCK_TIME_MS,
  GONOGO_ITEMS,
  NUMHUNT_ERROR_PENALTY,
  PCTSPRINT_ITEMS,
  PCTSPRINT_TIME_MS,
  ROUND_MS,
  SPOT_DIFFERENCES,
  SPOT_ONE_POINTS,
  SPOT_TIME_MS,
  SPOT_TWO_POINTS,
  STOPWATCH_MAX_DIST_MS,
  MIRMATCH_ITEMS,
  MIRMATCH_TIME_MS,
  SPIN_ITEMS,
  SPIN_TIME_MS,
  STROOP_ITEMS,
  TARGET_FAR_POINTS,
  TARGET_NEAR_POINTS,
  TOTAL_ROUNDS,
  UNBLOCK_MIN_MOVE_BONUS,
  UNBLOCK_TIME_MS,
  WORDMATCH_ITEMS,
  WORDMATCH_TIME_MS,
  LIGHTS_MIN_BONUS,
  LIGHTS_PARTIAL_POINTS,
  LIGHTS_TIME_MS,
  PIPES_CELLS,
  PIPES_PARTIAL_POINTS,
  PIPES_TIME_MS,
  SUDOKU_PARTIAL_POINTS,
  SUDOKU_TIME_MS,
  FLOW_PAIRS,
  FLOW_PARTIAL_POINTS,
  FLOW_TIME_MS,
  PUSH_MIN_PUSH_BONUS,
  PUSH_PARTIAL_POINTS,
  PUSH_TIME_MS,
  SLIDE_MIN_MOVE_BONUS,
  SLIDE_NEAR_POINTS,
  SLIDE_TIME_MS,
  type DuelPlayerRow,
  type PlayerStatus,
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

/** 0–50 for how much of the type's own time limit was left. */
export function speedBonus(msRemaining: number, timeLimitMs: number = ROUND_MS): number {
  const limit = timeLimitMs > 0 ? timeLimitMs : ROUND_MS;
  const clamped = clamp(msRemaining, 0, limit);
  return Math.round((MAX_SPEED_BONUS * clamped) / limit);
}

/** 0–50 from an average reaction time: 50 at 150 ms, 0 at 650 ms or slower. */
export function reactionBonus(averageMs: number): number {
  return clamp(Math.round((650 - averageMs) / 10), 0, MAX_SPEED_BONUS);
}

/** Correct: 100 plus the speed bonus. Wrong / timeout: 0. */
export function scoreRound(
  isCorrect: boolean,
  msRemaining: number,
  timeLimitMs: number = ROUND_MS,
): number {
  if (!isCorrect) return 0;
  return BASE_POINTS + speedBonus(msRemaining, timeLimitMs);
}

/** Groups: both sets earn the standard score; one set at timeout earns 50. */
export function scoreGroups(foundGroups: number, msRemaining: number): number {
  if (foundGroups >= 2) return BASE_POINTS + speedBonus(msRemaining, 60_000);
  return foundGroups === 1 ? 50 : 0;
}

/** Word Ladder: solved earns standard points, plus 20 for a minimum path, capped at 150. */
export function scoreWordLadder(
  solved: boolean,
  validRungs: number,
  shortestLength: number,
  msRemaining: number,
): number {
  if (!solved) return validRungs >= 2 ? 30 : 0;
  const minimumBonus = validRungs === shortestLength ? 20 : 0;
  return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, 60_000) + minimumBonus);
}

/** Number Climb: partial credit is proportional to the correct leading span. */
export function scoreNumberClimb(span: number, msRemaining: number): number {
  const correct = clamp(Math.round(span), 0, 12);
  if (correct === 12) return BASE_POINTS + speedBonus(msRemaining, 45_000);
  return Math.round((BASE_POINTS * correct) / 12);
}

/**
 * Target Number: an exact hit scores the standard 100 plus the speed bonus,
 * a near miss scores a flat amount, anything further away scores nothing.
 */
export function scoreTargetNumber(
  distance: number,
  msRemaining: number,
  timeLimitMs: number,
): number {
  if (distance === 0) return BASE_POINTS + speedBonus(msRemaining, timeLimitMs);
  if (distance <= 5) return TARGET_NEAR_POINTS;
  if (distance <= 10) return TARGET_FAR_POINTS;
  return 0;
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

/** Symbol Scan: proportional credit, with a penalty for every incorrect selection. */
export function scoreSymbolScan(
  foundTargets: number,
  totalTargets: number,
  wrongSelections: number,
  msRemaining: number,
): number {
  const total = Math.max(1, totalTargets);
  const found = clamp(Math.round(foundTargets), 0, total);
  const wrong = Math.max(0, Math.round(wrongSelections));
  const accuracy = clamp(Math.round((BASE_POINTS * found) / total) - 15 * wrong, 0, BASE_POINTS);
  const bonus = found === total && wrong === 0 ? speedBonus(msRemaining, 45_000) : 0;
  return accuracy + bonus;
}

/** Mirror Match: three flips, accuracy out of 100 plus a bonus for all three. */
export function scoreMirrorMatch(correctCount: number, msRemaining: number): number {
  const correct = clamp(correctCount, 0, MIRMATCH_ITEMS);
  const accuracy = Math.round((BASE_POINTS * correct) / MIRMATCH_ITEMS);
  const bonus = correct >= MIRMATCH_ITEMS ? speedBonus(msRemaining, MIRMATCH_TIME_MS) : 0;
  return Math.min(MAX_ROUND_SCORE, accuracy + bonus);
}

/** Spin: eight items, accuracy out of 100 plus a bonus for a flawless run. */
export function scoreSpin(correctCount: number, msRemaining: number): number {
  const correct = clamp(correctCount, 0, SPIN_ITEMS);
  const accuracy = Math.round((BASE_POINTS * correct) / SPIN_ITEMS);
  const bonus = correct >= SPIN_ITEMS ? speedBonus(msRemaining, SPIN_TIME_MS) : 0;
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

/**
 * Spot the Difference: all three found scores 100 plus the speed bonus; a
 * partial find is worth a flat 60 or 30.
 */
export function scoreSpotDifference(foundCount: number, msRemaining: number): number {
  const found = clamp(Math.round(foundCount), 0, SPOT_DIFFERENCES);
  if (found >= SPOT_DIFFERENCES) return BASE_POINTS + speedBonus(msRemaining, SPOT_TIME_MS);
  if (found === 2) return SPOT_TWO_POINTS;
  if (found === 1) return SPOT_ONE_POINTS;
  return 0;
}

/** Word Match: accuracy out of 100, plus the speed bonus on a flawless run. */
export function scoreWordMatch(correctCount: number, msRemaining: number): number {
  const correct = clamp(correctCount, 0, WORDMATCH_ITEMS);
  const accuracy = Math.round((BASE_POINTS * correct) / WORDMATCH_ITEMS);
  const bonus = correct >= WORDMATCH_ITEMS ? speedBonus(msRemaining, WORDMATCH_TIME_MS) : 0;
  return Math.min(MAX_ROUND_SCORE, accuracy + bonus);
}

/** Percent Sprint: accuracy out of 100, plus the speed bonus on a flawless run. */
export function scorePercentSprint(correctCount: number, msRemaining: number): number {
  const correct = clamp(correctCount, 0, PCTSPRINT_ITEMS);
  const accuracy = Math.round((BASE_POINTS * correct) / PCTSPRINT_ITEMS);
  const bonus = correct >= PCTSPRINT_ITEMS ? speedBonus(msRemaining, PCTSPRINT_TIME_MS) : 0;
  return Math.min(MAX_ROUND_SCORE, accuracy + bonus);
}

/** Stop Watch: 150 for a perfect average, down to 100 at 400 ms or worse. */
export function scoreStopWatch(averageDistanceMs: number): number {
  const bonus = clamp(
    Math.round(MAX_SPEED_BONUS * (1 - averageDistanceMs / STOPWATCH_MAX_DIST_MS)),
    0,
    MAX_SPEED_BONUS,
  );
  return BASE_POINTS + bonus;
}

/** Number Hunt: a standard round score, less 5 points per wrong tap. */
export function scoreNumberHunt(finished: boolean, msRemaining: number, errors: number): number {
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

export function roundBreakdown(results: RoundResultRow[], mySlot: number, opponentSlot: number) {
  return Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
    const round = i + 1;
    return {
      round,
      mine: resultFor(results, mySlot, round)?.score ?? 0,
      theirs: resultFor(results, opponentSlot, round)?.score ?? 0,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  Rooms of three or more                                                     */
/* -------------------------------------------------------------------------- */

export interface Standing {
  slot: number;
  name: string;
  status: PlayerStatus;
  /** Running total through the round being shown. */
  total: number;
  /** Points from that round, and whether the answer was right. */
  roundScore: number;
  roundCorrect: boolean | null;
  answerMs: number;
  position: number;
  /** Where they stood after the previous round, or null for round one. */
  previousPosition: number | null;
  summary: string;
  detail: string[];
}

function rank(
  rows: { slot: number; total: number; answerMs: number }[],
): { slot: number; position: number }[] {
  const sorted = [...rows].sort((a, b) =>
    b.total !== a.total ? b.total - a.total : a.answerMs - b.answerMs,
  );
  const out: { slot: number; position: number }[] = [];
  sorted.forEach((row, index) => {
    const previous = index > 0 ? sorted[index - 1]! : null;
    const tied =
      previous && previous.total === row.total && previous.answerMs === row.answerMs
        ? out[index - 1]!.position
        : index + 1;
    out.push({ slot: row.slot, position: tied });
  });
  return out;
}

function answerMsThrough(results: RoundResultRow[], slot: number, lastRound: number): number {
  return results
    .filter((r) => r.player_slot === slot && r.round_number <= lastRound)
    .reduce(
      (sum, r) =>
        sum + (r.reaction_avg_ms !== null ? r.reaction_avg_ms : ROUND_MS - r.ms_remaining),
      0,
    );
}

/**
 * The ranked table shown after every round and at the end. Ties on total are
 * broken by the quicker combined answer time; players still level share a
 * position.
 */
export function standings(
  players: DuelPlayerRow[],
  results: RoundResultRow[],
  throughRound: number,
  details: Map<number, { summary: string; detail: string[] }> = new Map(),
): Standing[] {
  const inRoom = players.filter((p) => p.status !== "left");
  const rows = inRoom.map((p) => ({
    slot: p.player_slot,
    total: totalScoreThrough(results, p.player_slot, throughRound),
    answerMs: answerMsThrough(results, p.player_slot, throughRound),
  }));
  const positions = new Map(rank(rows).map((r) => [r.slot, r.position]));

  const previousRows = inRoom.map((p) => ({
    slot: p.player_slot,
    total: totalScoreThrough(results, p.player_slot, throughRound - 1),
    answerMs: answerMsThrough(results, p.player_slot, throughRound - 1),
  }));
  const previous = new Map(rank(previousRows).map((r) => [r.slot, r.position]));

  return inRoom
    .map((p) => {
      const row = resultFor(results, p.player_slot, throughRound);
      return {
        slot: p.player_slot,
        name: p.display_name,
        status: p.status,
        total: totalScoreThrough(results, p.player_slot, throughRound),
        roundScore: row?.score ?? 0,
        roundCorrect: row ? row.is_correct : null,
        answerMs: answerMsThrough(results, p.player_slot, throughRound),
        position: positions.get(p.player_slot) ?? inRoom.length,
        previousPosition: throughRound > 1 ? (previous.get(p.player_slot) ?? null) : null,
        summary: details.get(p.player_slot)?.summary ?? "No answer",
        detail: details.get(p.player_slot)?.detail ?? [],
      } satisfies Standing;
    })
    .sort((a, b) => a.position - b.position || a.slot - b.slot);
}

/** Every player's per-round scores, for the expandable final table. */
export function playerBreakdown(
  results: RoundResultRow[],
  slot: number,
  rounds = TOTAL_ROUNDS,
): { round: number; score: number; correct: boolean | null }[] {
  return Array.from({ length: rounds }, (_, i) => {
    const row = resultFor(results, slot, i + 1);
    return { round: i + 1, score: row?.score ?? 0, correct: row ? row.is_correct : null };
  });
}

/** Word Hunt: the same points-against-par curve Wordsmith uses. */
export function scoreWordHunt(points: number, par: number): number {
  if (points <= 0) return 0;
  const target = par > 0 ? par : 1;
  return Math.min(MAX_ROUND_SCORE, Math.round((MAX_ROUND_SCORE * points) / target));
}

/** Unblock: solved scores 100 plus the speed bonus, plus 20 for a perfect run. */
export function scoreUnblock(
  solved: boolean,
  msRemaining: number,
  moves: number,
  minMoves: number,
): number {
  if (!solved) return 0;
  const perfect = minMoves > 0 && moves <= minMoves ? UNBLOCK_MIN_MOVE_BONUS : 0;
  return Math.min(
    MAX_ROUND_SCORE,
    BASE_POINTS + speedBonus(msRemaining, UNBLOCK_TIME_MS) + perfect,
  );
}

/** Block Party: a full board scores 100 plus the speed bonus, else part marks. */
export function scoreBlockParty(solved: boolean, msRemaining: number, covered: number): number {
  if (solved) {
    return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, BLOCK_TIME_MS));
  }
  const cells = clamp(covered, 0, BLOCK_FREE_CELLS);
  return Math.round((BLOCK_PARTIAL_POINTS * cells) / BLOCK_FREE_CELLS);
}

/* -------------------------------------------------------------------------- */
/*  Logic types                                                                */
/* -------------------------------------------------------------------------- */

/** Lights Out: clearing the board scores the standard points, +20 for the minimum. */
export function scoreLightsOut(
  solved: boolean,
  presses: number,
  minPresses: number,
  msRemaining: number,
  lightsOff: number,
  lightsAtStart: number,
): number {
  if (solved) {
    const bonus = minPresses > 0 && presses === minPresses ? LIGHTS_MIN_BONUS : 0;
    return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, LIGHTS_TIME_MS) + bonus);
  }
  const start = Math.max(1, lightsAtStart);
  return clamp(Math.round((LIGHTS_PARTIAL_POINTS * lightsOff) / start), 0, LIGHTS_PARTIAL_POINTS);
}

/** Pipes: a fully connected network scores the standard points. */
export function scorePipes(solved: boolean, connected: number, msRemaining: number): number {
  if (solved) return BASE_POINTS + speedBonus(msRemaining, PIPES_TIME_MS);
  return clamp(
    Math.round((PIPES_PARTIAL_POINTS * connected) / PIPES_CELLS),
    0,
    PIPES_PARTIAL_POINTS,
  );
}

/** Mini Sudoku: a finished, rule-correct grid scores the standard points. */
export function scoreSudoku(
  solved: boolean,
  correctCells: number,
  totalCells: number,
  msRemaining: number,
): number {
  if (solved) return BASE_POINTS + speedBonus(msRemaining, SUDOKU_TIME_MS);
  const total = Math.max(1, totalCells);
  return clamp(
    Math.round((SUDOKU_PARTIAL_POINTS * correctCells) / total),
    0,
    SUDOKU_PARTIAL_POINTS,
  );
}

/** Flow: a full board scores the standard points, else part marks per pair joined. */
export function scoreFlow(solved: boolean, pairsJoined: number, msRemaining: number): number {
  if (solved) {
    return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, FLOW_TIME_MS));
  }
  const pairs = clamp(pairsJoined, 0, FLOW_PAIRS);
  return Math.round((FLOW_PARTIAL_POINTS * pairs) / FLOW_PAIRS);
}

/**
 * Ice Slide: reaching the exit scores the standard points, +20 for the fewest
 * possible slides. Otherwise only a near miss — two slides or fewer from the
 * exit — earns anything.
 */
export function scoreIceSlide(
  solved: boolean,
  moves: number,
  minMoves: number,
  msRemaining: number,
  movesFromExit: number | null,
): number {
  if (solved) {
    const bonus = minMoves > 0 && moves <= minMoves ? SLIDE_MIN_MOVE_BONUS : 0;
    return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, SLIDE_TIME_MS) + bonus);
  }
  if (movesFromExit !== null && movesFromExit <= 2) return SLIDE_NEAR_POINTS;
  return 0;
}

/** Push: every crate home scores the standard points, +20 for the fewest pushes. */
export function scorePush(
  solved: boolean,
  pushes: number,
  minPushes: number,
  msRemaining: number,
  cratesHome: number,
  totalCrates: number,
): number {
  if (solved) {
    const bonus = minPushes > 0 && pushes <= minPushes ? PUSH_MIN_PUSH_BONUS : 0;
    return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, PUSH_TIME_MS) + bonus);
  }
  const total = Math.max(1, totalCrates);
  return clamp(
    Math.round((PUSH_PARTIAL_POINTS * cratesHome) / total),
    0,
    PUSH_PARTIAL_POINTS,
  );
}
