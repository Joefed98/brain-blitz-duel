import {
  BLOCK_FREE_CELLS,
  BLOCK_PARTIAL_POINTS,
  BLOCK_TIME_MS,
  GONOGO_ITEMS,
  NUMHUNT_ERROR_PENALTY,
  NUMHUNT_TIME_MS,
  NUMSEQ_ITEMS,
  NUMSEQ_TIME_MS,
  PCTSPRINT_ITEMS,
  PCTSPRINT_TIME_MS,
  ROUND_MS,
  SPOT_DIFFERENCES,
  SPOT_TIME_MS,
  MIRMATCH_ITEMS,
  MIRMATCH_TIME_MS,
  SPIN_ITEMS,
  SPIN_TIME_MS,
  STROOP_ITEMS,
  TOTAL_ROUNDS,
  UNBLOCK_TIME_MS,
  WORDMATCH_ITEMS,
  WORDMATCH_TIME_MS,
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
  GRAV_TIME_MS,
  GRAV_LOCK_POINTS,
  CHAIN_LINK_POINTS,
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
  TILES_TIME_MS,
  RINGS_PARTIAL_POINTS,
  RINGS_SEGMENTS,
  RINGS_TIME_MS,
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
  const d = Math.max(0, Math.round(distance));
  if (d === 0) {
    const limit = timeLimitMs > 0 ? timeLimitMs : ROUND_MS;
    return Math.min(MAX_ROUND_SCORE, 130 + Math.round((20 * clamp(msRemaining, 0, limit)) / limit));
  }
  if (d <= 10) return 120 - ((d - 1) * (d + 2)) / 2;
  return Math.max(0, Math.round(66 - 0.6 * (d - 10)));
}

/** Reaction Time: 50 at 650 ms or slower, up to 150 at 50 ms. */
/** Reaction Time: 150 at ≤200 ms average, −0.16 per ms above, −8 per false start, 0…150. */
export function scoreReaction(averageMs: number, falseStarts = 0): number {
  const base = averageMs <= 200 ? 150 : clamp(Math.round(150 - 0.16 * (averageMs - 200)), 0, 150);
  return clamp(base - 8 * Math.max(0, falseStarts), 0, 150);
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
 * Spot the Difference: all six found scores 100 plus the speed bonus; otherwise
 * round(100 × found ÷ 6).
 */
export function scoreSpotDifference(foundCount: number, msRemaining: number): number {
  const found = clamp(Math.round(foundCount), 0, SPOT_DIFFERENCES);
  if (found >= SPOT_DIFFERENCES) return BASE_POINTS + speedBonus(msRemaining, SPOT_TIME_MS);
  return Math.round((BASE_POINTS * found) / SPOT_DIFFERENCES);
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
  if (averageDistanceMs <= 20) return 150;
  return clamp(Math.round(150 - 0.27 * (averageDistanceMs - 20)), 0, 150);
}

/**
 * Number Hunt: 5 per number tapped in order, −5 per wrong tap; all 24 = 130 +
 * round(20 × ms_remaining ÷ limit) − 5 per wrong tap; clamp 0…150.
 */
export function scoreNumberHunt(
  finished: boolean,
  msRemaining: number,
  errors: number,
  reached = 0,
  total = 1,
  timeLimitMs = NUMHUNT_TIME_MS,
): number {
  const limit = timeLimitMs > 0 ? timeLimitMs : NUMHUNT_TIME_MS;
  const penalty = NUMHUNT_ERROR_PENALTY * Math.max(0, errors);
  if (finished) {
    const bonus = Math.round((20 * clamp(msRemaining, 0, limit)) / limit);
    return clamp(130 + bonus - penalty, 0, MAX_ROUND_SCORE);
  }
  const count = clamp(Math.round(reached), 0, Math.max(1, total));
  return clamp(5 * count - penalty, 0, MAX_ROUND_SCORE);
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

/** Reveal line for a solved move puzzle. */
export function solvedMovesText(moves: number, minMoves: number, msRemaining: number | undefined, limitMs: number): string {
  const mb = moveBonus(moves, minMoves);
  const sb = moveSpeedBonus(msRemaining ?? 0, limitMs);
  return `Solved · ${moves} moves${minMoves > 0 ? ` (min ${minMoves})` : ""} · +${mb} move bonus · +${sb} speed`;
}

/** Wordsmith: each word point is worth 2.5 round points, rounded down. */
export function scoreWordsmith(points: number): number {
  return clamp(Math.floor(2.5 * Math.max(0, points)), 0, MAX_ROUND_SCORE);
}

/** Word-category completion bonus: round(max × ms_remaining ÷ registry limit). */
export function wordSpeedBonus(msRemaining: number, timeLimitMs: number, max = 20): number {
  if (!(timeLimitMs > 0)) return 0;
  return Math.round((max * clamp(msRemaining, 0, timeLimitMs)) / timeLimitMs);
}

/** Word Slide: all five rows = 125 + round(25 × ms left ÷ limit); otherwise 22 per valid row. */
export function scoreWordSlide(rows: number, totalRows: number, msRemaining: number, timeLimitMs: number): number {
  if (totalRows > 0 && rows >= totalRows) return clamp(125 + wordSpeedBonus(msRemaining, timeLimitMs, 25), 0, MAX_ROUND_SCORE);
  return clamp(22 * Math.max(0, rows), 0, MAX_ROUND_SCORE);
}

/** Word Hunt: raw word points stay on the play counter; each is worth two round points. */
export function scoreWordHunt(points: number): number {
  return clamp(2 * Math.round(points), 0, MAX_ROUND_SCORE);
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

