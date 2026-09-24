import {
  BLOCK_FREE_CELLS,
  BLOCK_PARTIAL_POINTS,
  BLOCK_TIME_MS,
  GONOGO_ITEMS,
  NUMHUNT_ERROR_PENALTY,
  NUMSEQ_ITEMS,
  NUMSEQ_TIME_MS,
  PCTSPRINT_ITEMS,
  PCTSPRINT_TIME_MS,
  ROUND_MS,
  SPOT_DIFFERENCES,
  SPOT_TIME_MS,
  STOPWATCH_MAX_DIST_MS,
  MIRMATCH_ITEMS,
  MIRMATCH_TIME_MS,
  SPIN_ITEMS,
  SPIN_TIME_MS,
  STROOP_ITEMS,
  TOTAL_ROUNDS,
  UNBLOCK_MIN_MOVE_BONUS,
  UNBLOCK_TIME_MS,
  WORDMATCH_ITEMS,
  WORDMATCH_TIME_MS,
  LIGHTS_MIN_BONUS,
  LIGHTS_TIME_MS,
  PIPES_CELLS,
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
  SLIDE_TIME_MS,
  LASER_FIRE_BASE,
  LASER_GEMS,
  LASER_PARTIAL_POINTS,
  LASER_TIME_MS,
  MAZE_TIME_MS,
  TOWER_MIN_MOVE_BONUS,
  TOWER_PARTIAL_POINTS,
  type DuelPlayerRow,
  type PlayerStatus,
  type RoundResultRow,
} from "./types";
import {
  BOMB_PARTIAL_POINTS,
  BOMB_PREFIX_POINTS,
  BOMB_TIME_MS,
  SAFE_DIAL_POINTS,
  SAFE_TIME_MS,
  SAFE_TRY_POINTS,
  TUBES_MIN_MOVE_BONUS,
  TUBES_TIME_MS,
  GRAV_MIN_MOVE_BONUS,
  GRAV_TIME_MS,
  CHAIN_ERROR_PENALTY,
  CHAIN_LENGTH,
  CHAIN_PARTIAL_POINTS,
  CHAIN_TIME_MS,
  INTRUDER_BOARDS,
  INTRUDER_TIME_MS,
  NONO_PARTIAL_POINTS,
  NONO_TIME_MS,
  NONO_WRONG_PENALTY,
  PAIR_CLEAN_BONUS,
  PAIR_CLEAN_FLIPS,
  PAIR_PAIRS,
  PAIR_PARTIAL_POINTS,
  PAIR_TIME_MS,
  FLOOD_CELLS,
  FLOOD_PARTIAL_POINTS,
  STROKE_FIRST_TRY_BONUS,
  STROKE_PARTIAL_POINTS,
  STROKE_TIME_MS,
  TILES_COUNT,
  TILES_MIN_BONUS,
  TILES_TIME_MS,
  RINGS_MIN_BONUS,
  RINGS_PARTIAL_POINTS,
  RINGS_SEGMENTS,
  RINGS_TIME_MS,
  FLOOD_PAR_BONUS,
  FLOOD_TIME_MS,
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

/** Groups: all four earn the standard score; partial groups earn flat credit. */
export function scoreGroups(foundGroups: number, msRemaining: number): number {
  if (foundGroups >= 4) return BASE_POINTS + speedBonus(msRemaining, 90_000);
  if (foundGroups === 3) return 60;
  if (foundGroups === 2) return 40;
  return foundGroups === 1 ? 20 : 0;
}

/**
 * Word Ladder: solved earns standard points, plus 20 for a minimum path. An
 * unfinished ladder scores by how close the last valid rung came to the end
 * word — one letter away 75, two 50, three 25.
 */
export function scoreWordLadder(
  solved: boolean,
  validRungs: number,
  shortestLength: number,
  msRemaining: number,
  lettersAway: number,
): number {
  if (!solved) {
    if (lettersAway === 1) return 75;
    if (lettersAway === 2) return 50;
    if (lettersAway === 3) return 25;
    return 0;
  }
  const minimumBonus = validRungs === shortestLength ? 20 : 0;
  return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, 60_000) + minimumBonus);
}

/** Number Climb: partial credit is proportional to the correct leading span. */
export function scoreNumberClimb(span: number, msRemaining: number): number {
  const correct = clamp(Math.round(span), 0, 12);
  if (correct === 12) return BASE_POINTS + speedBonus(msRemaining, 20_000);
  return Math.min(90, Math.round((BASE_POINTS * correct) / 12));
}

/**
 * Target Number: an exact hit scores the standard 100 plus the speed bonus;
 * anything else scores by how far from the target it landed, with no bonus.
 */
export function scoreTargetNumber(
  distance: number,
  msRemaining: number,
  timeLimitMs: number,
): number {
  if (distance === 0) return BASE_POINTS + speedBonus(msRemaining, timeLimitMs);
  if (distance === 1) return 90;
  if (distance === 2) return 85;
  if (distance <= 5) return 80;
  if (distance <= 10) return 70;
  if (distance <= 20) return 60;
  if (distance <= 50) return 50;
  return 0;
}

/** Reaction Time: 50 at 650 ms or slower, up to 150 at 50 ms. */
export function scoreReaction(averageMs: number): number {
  return 50 + clamp(Math.round((650 - averageMs) / 6), 0, 100);
}

/** Colour Clash: accuracy out of 100, plus the speed bonus on a flawless run. */
export function scoreStroop(correctCount: number, msRemaining: number): number {
  const correct = clamp(correctCount, 0, STROOP_ITEMS);
  const accuracy = Math.min(correct >= STROOP_ITEMS ? BASE_POINTS : 90, Math.round((BASE_POINTS * correct) / STROOP_ITEMS));
  const bonus = correct >= STROOP_ITEMS ? speedBonus(msRemaining) : 0;
  return Math.min(MAX_ROUND_SCORE, accuracy + bonus);
}

/** Symbol Scan: proportional credit, less five points for every wrong tap. */
export function scoreSymbolScan(
  foundTargets: number,
  totalTargets: number,
  wrongSelections: number,
  msRemaining: number,
): number {
  const total = Math.max(1, totalTargets);
  const found = clamp(Math.round(foundTargets), 0, total);
  const wrong = Math.max(0, Math.round(wrongSelections));
  const raw = Math.round((BASE_POINTS * found) / total) - 5 * wrong;
  const floor = found >= 1 ? 5 : 0;
  const accuracy = clamp(Math.max(raw, floor), 0, found === total && wrong === 0 ? BASE_POINTS : 90);
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
  const accuracy = Math.min(correct >= GONOGO_ITEMS ? BASE_POINTS : 90, Math.round((BASE_POINTS * correct) / GONOGO_ITEMS));
  const perfect = correct >= GONOGO_ITEMS && averageHitMs !== null;
  const bonus = perfect ? reactionBonus(averageHitMs!) : 0;
  return Math.min(MAX_ROUND_SCORE, accuracy + bonus);
}

/**
 * Spot the Difference: all five found scores 100 plus the speed bonus; every
 * difference found on its own is worth 20.
 */
export function scoreSpotDifference(foundCount: number, msRemaining: number): number {
  const found = clamp(Math.round(foundCount), 0, SPOT_DIFFERENCES);
  if (found >= SPOT_DIFFERENCES) return BASE_POINTS + speedBonus(msRemaining, SPOT_TIME_MS);
  return 20 * found;
}

/** Pattern Completion: partial credit per board; speed only rewards a perfect set. */
export function scorePatternCompletion(correctCount: number, msRemaining: number): number {
  const correct = clamp(Math.round(correctCount), 0, 3);
  return (
    Math.round((BASE_POINTS * correct) / 3) + (correct === 3 ? speedBonus(msRemaining, 30_000) : 0)
  );
}

/** Word Match: all eight score 100 plus speed; partial pairs earn 13, capped at 90. */
export function scoreWordMatch(correctCount: number, msRemaining: number): number {
  const correct = clamp(correctCount, 0, WORDMATCH_ITEMS);
  if (correct >= WORDMATCH_ITEMS) {
    return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, WORDMATCH_TIME_MS));
  }
  return Math.min(90, 13 * correct);
}

/** Percent Sprint: accuracy out of 100, plus the speed bonus on a flawless run. */
export function scorePercentSprint(correctCount: number, msRemaining: number): number {
  const correct = clamp(correctCount, 0, PCTSPRINT_ITEMS);
  const accuracy = Math.round((BASE_POINTS * correct) / PCTSPRINT_ITEMS);
  const bonus = correct >= PCTSPRINT_ITEMS ? speedBonus(msRemaining, PCTSPRINT_TIME_MS) : 0;
  return Math.min(MAX_ROUND_SCORE, accuracy + bonus);
}

/** Number Sequence: 20 a sequence, plus the speed bonus for all five. */
export function scoreNumberSequence(correctCount: number, msRemaining: number): number {
  const correct = clamp(correctCount, 0, NUMSEQ_ITEMS);
  const accuracy = 20 * correct;
  const bonus = correct >= NUMSEQ_ITEMS ? speedBonus(msRemaining, NUMSEQ_TIME_MS) : 0;
  return Math.min(MAX_ROUND_SCORE, accuracy + bonus);
}

/**
 * Equation Balancing: a true equation scores the standard points; otherwise
 * every operator in the right place is worth 30, up to 90.
 */
export function scoreEquation(
  correct: boolean,
  symbolsInPlace: number,
  msRemaining: number,
  timeLimitMs: number,
): number {
  if (correct) return BASE_POINTS + speedBonus(msRemaining, timeLimitMs);
  return clamp(30 * Math.max(0, Math.round(symbolsInPlace)), 0, 90);
}

/**
 * Count Up: the exact total scores the standard points; a near miss scores by
 * how far out it was, and a rough guess within a tenth still counts.
 */
export function scoreCountUp(
  answered: boolean,
  given: number,
  trueCount: number,
  msRemaining: number,
  timeLimitMs: number,
): number {
  if (!answered) return 0;
  const away = Math.abs(Math.round(given) - Math.round(trueCount));
  if (away === 0) return BASE_POINTS + speedBonus(msRemaining, timeLimitMs);
  if (away === 1) return 70;
  if (away === 2) return 50;
  if (away === 3) return 30;
  return away <= Math.max(1, trueCount) * 0.1 ? 15 : 0;
}

/** Stop Watch: 150 for a perfect average, down to 50 at 400 ms or worse. */
export function scoreStopWatch(averageDistanceMs: number): number {
  const bonus = clamp(
    Math.round(100 * (1 - averageDistanceMs / STOPWATCH_MAX_DIST_MS)),
    0,
    100,
  );
  return 50 + bonus;
}

/**
 * Number Hunt: a standard round score, less 5 points per wrong tap. An
 * unfinished run scores by how far up the order the player got.
 */
export function scoreNumberHunt(
  finished: boolean,
  msRemaining: number,
  errors: number,
  reached = 0,
  total = 1,
): number {
  if (finished) {
    if (errors > 0) return clamp(BASE_POINTS - NUMHUNT_ERROR_PENALTY * errors, 0, 90);
    const raw = BASE_POINTS + speedBonus(msRemaining) - NUMHUNT_ERROR_PENALTY * errors;
    return Math.round(clamp(raw, 0, MAX_ROUND_SCORE));
  }
  const count = clamp(Math.round(reached), 0, Math.max(1, total));
  if (count < 1) return 0;
  const raw = Math.round((90 * count) / Math.max(1, total)) - NUMHUNT_ERROR_PENALTY * errors;
  return clamp(Math.max(raw, 5), 0, 90);
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

/** Move-based puzzles: +40 at the minimum, sliding to 0 at twice the minimum. */
export function moveBonus(moves: number, minMoves: number): number {
  if (minMoves <= 0) return 0;
  return Math.round(40 * clamp(1 - (moves - minMoves) / minMoves, 0, 1));
}

/** Move-based puzzles: a small speed extra, up to 10. */
export function moveSpeedBonus(msRemaining: number, limitMs: number): number {
  if (limitMs <= 0) return 0;
  return Math.round(10 * clamp(msRemaining, 0, limitMs) / limitMs);
}

/** Move-based puzzles, solved: 100 + move bonus + speed bonus, cap 150. */
export function scoreSolvedMoves(moves: number, minMoves: number, msRemaining: number, limitMs: number): number {
  return Math.min(MAX_ROUND_SCORE, BASE_POINTS + moveBonus(moves, minMoves) + moveSpeedBonus(msRemaining, limitMs));
}

/** Word rounds: raw word points stay on the play counter; each is worth three round points. */
export function scoreWordHunt(points: number): number {
  return clamp(3 * Math.round(points), 0, MAX_ROUND_SCORE);
}

/**
 * Unblock: solved scores 100 plus the speed bonus, plus 20 for a perfect run.
 * An unfinished layout scores by how much of the solver's distance was closed.
 */
export function scoreUnblock(
  solved: boolean,
  msRemaining: number,
  moves: number,
  minMoves: number,
  progress = 0,
  fewerBlockers = false,
): number {
  if (solved) {
    return scoreSolvedMoves(moves, minMoves, msRemaining, UNBLOCK_TIME_MS);
  }
  const partial = Math.round(70 * clamp(progress, 0, 1));
  return clamp(Math.max(partial, fewerBlockers ? 10 : 0), 0, 70);
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

/**
 * Lights Out: clearing the board scores the standard points, +20 for the
 * minimum. A board left with a few lights on scores by how few remain; beyond
 * four, only taps that belong to the solution earn anything.
 */
export function scoreLightsOut(
  solved: boolean,
  presses: number,
  minPresses: number,
  msRemaining: number,
  lightsLeftOn: number,
  correctTaps: number,
): number {
  if (solved) {
    return scoreSolvedMoves(presses, minPresses, msRemaining, LIGHTS_TIME_MS);
  }
  const left = Math.max(0, Math.round(lightsLeftOn));
  if (left === 1) return 85;
  if (left === 2) return 75;
  if (left === 3) return 60;
  if (left === 4) return 50;
  return clamp(5 * Math.max(0, Math.round(correctTaps)), 0, 45);
}

/** Pipes: a fully connected network scores the standard points. */
export function scorePipes(solved: boolean, connected: number, msRemaining: number): number {
  if (solved) return BASE_POINTS + speedBonus(msRemaining, PIPES_TIME_MS);
  const joined = clamp(Math.round(connected), 0, PIPES_CELLS);
  if (joined >= PIPES_CELLS - 1) return 90;
  if (joined >= PIPES_CELLS - 2) return 85;
  if (joined >= PIPES_CELLS - 4) return 80;
  if (joined >= 19) return 80 - 5 * Math.ceil((PIPES_CELLS - 4 - joined) / 2);
  return 2 * joined;
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

/** Colour Connect: a full board scores the standard points, else part marks per pair joined. */
export function scoreFlow(solved: boolean, pairsJoined: number, msRemaining: number): number {
  if (solved) {
    return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, FLOW_TIME_MS));
  }
  const pairs = clamp(pairsJoined, 0, FLOW_PAIRS);
  return Math.round((FLOW_PARTIAL_POINTS * pairs) / FLOW_PAIRS);
}

/**
 * Ice Slide: reaching the exit scores the standard points, +20 for the fewest
 * possible slides. Otherwise the score follows how much of the distance to the
 * exit the player closed.
 */
export function scoreIceSlide(
  solved: boolean,
  moves: number,
  minMoves: number,
  msRemaining: number,
  progress: number,
): number {
  if (solved) {
    return scoreSolvedMoves(moves, minMoves, msRemaining, SLIDE_TIME_MS);
  }
  return clamp(Math.round(70 * clamp(progress, 0, 1)), 0, 70);
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
  return clamp(Math.round((PUSH_PARTIAL_POINTS * cratesHome) / total), 0, PUSH_PARTIAL_POINTS);
}

/**
 * Laser and Mirrors: every gem on the first shot scores most, the third shot
 * least; gems lit by a shot that missed some are a consolation.
 */
export function scoreLaser(
  solved: boolean,
  gemsLit: number,
  fires: number,
  msRemaining: number,
): number {
  if (solved) {
    const shot = Math.max(1, Math.min(LASER_FIRE_BASE.length, Math.round(fires) || 1));
    const base = LASER_FIRE_BASE[shot - 1]!;
    return Math.min(MAX_ROUND_SCORE, base + speedBonus(msRemaining, LASER_TIME_MS));
  }
  if (fires < 1) return 0;
  const lit = Math.max(0, Math.round(gemsLit));
  return clamp(Math.round((LASER_PARTIAL_POINTS * lit) / LASER_GEMS), 0, LASER_PARTIAL_POINTS);
}

/** Tower: the whole stack home scores the standard points, +20 for the minimum. */
export function scoreTower(
  solved: boolean,
  moves: number,
  minMoves: number,
  msRemaining: number,
  timeLimitMs: number,
  correctFromBottom: number,
  discs: number,
): number {
  if (solved) {
    const bonus = minMoves > 0 && moves <= minMoves ? TOWER_MIN_MOVE_BONUS : 0;
    return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, timeLimitMs) + bonus);
  }
  const total = Math.max(1, discs);
  return clamp(
    Math.round((TOWER_PARTIAL_POINTS * correctFromBottom) / total),
    0,
    TOWER_PARTIAL_POINTS,
  );
}

/**
 * Maze Dash: reaching the exit scores the standard points; otherwise the
 * percentage of the shortest path reached, as points.
 */
export function scoreMaze(solved: boolean, progress: number, msRemaining: number): number {
  if (solved) return BASE_POINTS + speedBonus(msRemaining, MAZE_TIME_MS);
  return clamp(Math.round(100 * clamp(progress, 0, 1)), 0, 90);
}

/**
 * Sort the Tubes: solved scores the standard points, +20 for the minimum; every
 * tube holding a single colour is worth 10 on its own.
 */
export function scoreTubes(
  solved: boolean,
  moves: number,
  minMoves: number,
  msRemaining: number,
  sortedTubes: number,
): number {
  if (solved) {
    const bonus = minMoves > 0 && moves <= minMoves ? TUBES_MIN_MOVE_BONUS : 0;
    return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, TUBES_TIME_MS) + bonus);
  }
  return clamp(10 * Math.max(0, Math.round(sortedTubes)), 0, 90);
}

/** Safe Cracker: the first try scores most, the third least. */
export function scoreSafe(openedOn: number, msRemaining: number, dialsRight: number): number {
  if (openedOn >= 1 && openedOn <= SAFE_TRY_POINTS.length) {
    const base = SAFE_TRY_POINTS[openedOn - 1]!;
    return Math.min(MAX_ROUND_SCORE, base + speedBonus(msRemaining, SAFE_TIME_MS));
  }
  return clamp(SAFE_DIAL_POINTS * dialsRight, 0, SAFE_DIAL_POINTS * 4);
}

/** Bomb Defusal: exact sequence scores full marks; only its correct prefix scores otherwise. */
export function scoreBomb(defused: boolean, msRemaining: number, correctPrefix: number): number {
  if (defused) {
    return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, BOMB_TIME_MS));
  }
  return clamp(BOMB_PREFIX_POINTS * correctPrefix, 0, BOMB_PARTIAL_POINTS);
}

/**
 * Gravity Maze: solved scores the standard points, +20 for the fewest tilts;
 * otherwise progress through the joint-state search, never below 40 with one
 * ball home.
 */
export function scoreGravity(
  solved: boolean,
  tilts: number,
  minMoves: number,
  msRemaining: number,
  onTarget: number,
  progress = 0,
): number {
  if (solved) {
    return scoreSolvedMoves(tilts, minMoves, msRemaining, GRAV_TIME_MS);
  }
  const partial = Math.round(70 * clamp(progress, 0, 1));
  return clamp(Math.max(partial, onTarget >= 1 ? 40 : 0), 0, 70);
}

/** Don't Break the Chain: fifteen in a row, less ten a mistake. */
export function scoreChain(
  completed: boolean,
  correct: number,
  errors: number,
  msRemaining: number,
): number {
  if (completed) {
    if (errors > 0) return clamp(BASE_POINTS - CHAIN_ERROR_PENALTY * errors, 0, 90);
    return clamp(
      BASE_POINTS + speedBonus(msRemaining, CHAIN_TIME_MS) - CHAIN_ERROR_PENALTY * errors,
      0,
      MAX_ROUND_SCORE,
    );
  }
  return clamp(
    Math.round((CHAIN_PARTIAL_POINTS * correct) / CHAIN_LENGTH),
    0,
    CHAIN_PARTIAL_POINTS,
  );
}

/** Intruder Detection: a share per grid, and the speed bonus only for a clean sweep. */
export function scoreIntruder(correct: number, allFirstTry: boolean, msRemaining: number): number {
  const base = Math.round((BASE_POINTS * clamp(correct, 0, INTRUDER_BOARDS)) / INTRUDER_BOARDS);
  const bonus =
    correct >= INTRUDER_BOARDS && allFirstTry ? speedBonus(msRemaining, INTRUDER_TIME_MS) : 0;
  return Math.min(allFirstTry && correct >= INTRUDER_BOARDS ? MAX_ROUND_SCORE : 90, base + bonus);
}

/** Nonogram: the whole picture scores; a part-filled grid loses five a mistake. */
export function scoreNonogram(
  solved: boolean,
  correct: number,
  total: number,
  wrong: number,
  msRemaining: number,
): number {
  if (solved) {
    return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, NONO_TIME_MS));
  }
  const share = total > 0 ? Math.round((NONO_PARTIAL_POINTS * correct) / total) : 0;
  return clamp(share - NONO_WRONG_PENALTY * wrong, 0, NONO_PARTIAL_POINTS);
}

/** Pair Match: all ten pairs score, with a bonus for a tidy, short game. */
export function scorePairMatch(
  solved: boolean,
  pairs: number,
  tries: number,
  msRemaining: number,
): number {
  if (solved) {
    const bonus = tries <= PAIR_CLEAN_FLIPS ? PAIR_CLEAN_BONUS : 0;
    return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, PAIR_TIME_MS) + bonus);
  }
  return clamp(
    Math.round((PAIR_PARTIAL_POINTS * clamp(pairs, 0, PAIR_PAIRS)) / PAIR_PAIRS),
    0,
    PAIR_PARTIAL_POINTS,
  );
}

/** Colour Flood: flooding the board scores, with a bonus for hitting par. */
export function scoreFlood(
  solved: boolean,
  moves: number,
  par: number,
  region: number,
  msRemaining: number,
): number {
  if (solved) {
    return scoreSolvedMoves(moves, par, msRemaining, FLOOD_TIME_MS);
  }
  return clamp(
    Math.round((FLOOD_PARTIAL_POINTS * clamp(region, 0, FLOOD_CELLS)) / FLOOD_CELLS),
    0,
    FLOOD_PARTIAL_POINTS,
  );
}

/** One-Stroke: finishing scores, with a bonus for getting it first time. */
export function scoreStroke(
  solved: boolean,
  solvedOn: number,
  best: number,
  total: number,
  msRemaining: number,
): number {
  if (solved) {
    const bonus = solvedOn === 1 ? STROKE_FIRST_TRY_BONUS : 0;
    return Math.min(MAX_ROUND_SCORE, BASE_POINTS + speedBonus(msRemaining, STROKE_TIME_MS) + bonus);
  }
  const share = total > 0 ? Math.round((STROKE_PARTIAL_POINTS * clamp(best, 0, total)) / total) : 0;
  return clamp(share, 0, STROKE_PARTIAL_POINTS);
}

/**
 * Sliding Tiles: ordering the frame scores, with a bonus for the minimum;
 * otherwise 14 for every tile sitting in its own place.
 */
export function scoreTiles(
  solved: boolean,
  moves: number,
  minMoves: number,
  inPlace: number,
  msRemaining: number,
): number {
  if (solved) {
    return scoreSolvedMoves(moves, minMoves, msRemaining, TILES_TIME_MS);
  }
  return clamp(14 * clamp(Math.round(inPlace), 0, TILES_COUNT), 0, 90);
}

/** Rotating Rings: lining up the spokes scores, with a bonus for the minimum. */
export function scoreRings(
  solved: boolean,
  moves: number,
  minMoves: number,
  aligned: number,
  msRemaining: number,
): number {
  if (solved) {
    return scoreSolvedMoves(moves, minMoves, msRemaining, RINGS_TIME_MS);
  }
  return clamp(
    Math.round((RINGS_PARTIAL_POINTS * clamp(aligned, 0, RINGS_SEGMENTS)) / RINGS_SEGMENTS),
    0,
    RINGS_PARTIAL_POINTS,
  );
}
