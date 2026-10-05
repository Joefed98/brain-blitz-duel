import {
  BLOCK_PIECE_POINTS,
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
  FLOW_PAIR_POINTS,
  SLIDE_PARTIAL_POINTS,
  MAZE_PARTIAL_POINTS,
  SPOT_DIFF_POINTS,
  FLOW_TIME_MS,
  PUSH_PARTIAL_POINTS,
  PUSH_TIME_MS,
  SLIDE_TIME_MS,
  LASER_FIRE_BASE,
  LASER_GEMS,
  LASER_GEM_POINTS,
  LASER_TIME_MS,
  MAZE_TIME_MS,
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
  TUBES_TUBE_POINTS,
  TUBES_TIME_MS,
  GRAV_TIME_MS,
  GRAV_LOCK_POINTS,
  CHAIN_LINK_POINTS,
  INTRUDER_BOARDS,
  INTRUDER_TIME_MS,
  NONO_PARTIAL_POINTS,
  NONO_TIME_MS,
  NONO_WRONG_PENALTY,
  PAIR_PAIRS,
  PAIR_PAIR_POINTS,
  PAIR_TIME_MS,
  FLOOD_CELLS,
  FLOOD_PARTIAL_POINTS,
  STROKE_FIRST_TRY_BONUS,
  STROKE_PARTIAL_POINTS,
  STROKE_TIME_MS,
  TILES_COUNT,
  TILES_TIME_MS,
  RINGS_SPOKE_POINTS,
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

/** Spot the Difference (A): 20 per difference; all six = 130 + SPEED(20). */
export function scoreSpotDifference(foundCount: number, msRemaining: number, timeLimitMs: number = SPOT_TIME_MS): number {
  const found = clamp(Math.round(foundCount), 0, SPOT_DIFFERENCES);
  if (found >= SPOT_DIFFERENCES) return standardComplete(msRemaining, timeLimitMs);
  return SPOT_DIFF_POINTS * found;
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

/** Wordsmith: each word point is worth 2.5 round points, rounded down. */
export function scoreWordsmith(points: number): number {
  return clamp(Math.floor(2.5 * Math.max(0, points)), 0, MAX_ROUND_SCORE);
}

/** Word-category completion bonus: round(max × ms_remaining ÷ registry limit). */
export function wordSpeedBonus(msRemaining: number, timeLimitMs: number, max = 20): number {
  if (!(timeLimitMs > 0)) return 0;
  return Math.round((max * clamp(msRemaining, 0, timeLimitMs)) / timeLimitMs);
}

/** Word Slide: all five rows = 100 + SPEED(30) + MOVES(20, moves, par); otherwise 22 per valid row. */
export function scoreWordSlide(
  rows: number,
  totalRows: number,
  msRemaining: number,
  timeLimitMs: number,
  moves = 0,
  par = 0,
): number {
  if (totalRows > 0 && rows >= totalRows) {
    return clamp(100 + speedPoints(30, msRemaining, timeLimitMs) + movesPoints(20, moves, par), 0, MAX_ROUND_SCORE);
  }
  return clamp(22 * Math.max(0, rows), 0, MAX_ROUND_SCORE);
}

/** Word Hunt: raw word points stay on the play counter; each is worth two round points. */
export function scoreWordHunt(points: number): number {
  return clamp(2 * Math.round(points), 0, MAX_ROUND_SCORE);
}

/** Unblock (B). Unfinished: round(70 × blocker progress), or 10 for fewer blockers, max 70. */
export function scoreUnblock(
  solved: boolean,
  msRemaining: number,
  moves: number,
  minMoves: number,
  progress = 0,
  fewerBlockers = false,
  timeLimitMs: number = UNBLOCK_TIME_MS,
): number {
  if (solved) return scoreSolvedMoves(moves, minMoves, msRemaining, timeLimitMs);
  const partial = Math.round(70 * clamp(progress, 0, 1));
  return clamp(Math.max(partial, fewerBlockers ? 10 : 0), 0, 70);
}

/** Block Party (A). Unfinished 12 per piece placed. */
export function scoreBlockParty(
  solved: boolean,
  msRemaining: number,
  piecesPlaced: number,
  timeLimitMs: number = BLOCK_TIME_MS,
): number {
  if (solved) return standardComplete(msRemaining, timeLimitMs);
  return clamp(BLOCK_PIECE_POINTS * Math.max(0, Math.round(piecesPlaced)), 0, MAX_ROUND_SCORE);
}

/* -------------------------------------------------------------------------- */
/*  Standard shapes (A / B / C)                                                */
/* -------------------------------------------------------------------------- */

/** SPEED(P) = round(P × ms_remaining ÷ registry time limit). */
export function speedPoints(points: number, msRemaining: number, timeLimitMs: number): number {
  if (!(timeLimitMs > 0)) return 0;
  return Math.round((points * clamp(msRemaining, 0, timeLimitMs)) / timeLimitMs);
}

/** MOVES(B, m, min) = round(B × clamp(1 − (m − min) ÷ min, 0, 1)). */
export function movesPoints(points: number, moves: number, minMoves: number): number {
  if (!(minMoves > 0)) return 0;
  return Math.round(points * clamp(1 - (moves - minMoves) / minMoves, 0, 1));
}

/** Shape A: complete = 130 + SPEED(20). */
export function standardComplete(msRemaining: number, timeLimitMs: number): number {
  return clamp(130 + speedPoints(20, msRemaining, timeLimitMs), 0, MAX_ROUND_SCORE);
}

/** Shape B (balanced) and C (move-weighted, Colour Flood only). */
export type MovesShape = "B" | "C";
const MOVES_SHAPE: Record<MovesShape, { moves: number; speed: number }> = {
  B: { moves: 25, speed: 25 },
  C: { moves: 40, speed: 10 },
};

/** Fewest-moves complete: 100 + MOVES + SPEED, clamp 0…150. */
export function scoreSolvedMoves(
  moves: number,
  minMoves: number,
  msRemaining: number,
  limitMs: number,
  shape: MovesShape = "B",
): number {
  const w = MOVES_SHAPE[shape];
  return clamp(
    BASE_POINTS + movesPoints(w.moves, moves, minMoves) + speedPoints(w.speed, msRemaining, limitMs),
    0,
    MAX_ROUND_SCORE,
  );
}

/** Reveal line for a solved fewest-moves puzzle. */
export function solvedMovesText(
  moves: number,
  minMoves: number,
  msRemaining: number | undefined,
  limitMs: number,
  shape: MovesShape = "B",
): string {
  const w = MOVES_SHAPE[shape];
  const mb = movesPoints(w.moves, moves, minMoves);
  const sb = speedPoints(w.speed, msRemaining ?? 0, limitMs);
  return `Solved · ${moves} moves${minMoves > 0 ? ` (min ${minMoves})` : ""} · 100 + ${mb} moves + ${sb} speed`;
}

/* -------------------------------------------------------------------------- */
/*  Logic types                                                                */
/* -------------------------------------------------------------------------- */

/** Lights Out (B). Unfinished: 1/2/3/4 lights left = 85/75/60/50, else 5 per solution tap (max 45). */
export function scoreLightsOut(
  solved: boolean,
  presses: number,
  minPresses: number,
  msRemaining: number,
  lightsLeftOn: number,
  correctTaps: number,
  timeLimitMs: number = LIGHTS_TIME_MS,
): number {
  if (solved) return scoreSolvedMoves(presses, minPresses, msRemaining, timeLimitMs);
  const left = Math.max(0, Math.round(lightsLeftOn));
  if (left === 1) return 85;
  if (left === 2) return 75;
  if (left === 3) return 60;
  if (left === 4) return 50;
  return clamp(5 * Math.max(0, Math.round(correctTaps)), 0, 45);
}

/** Pipes (A). Stepped unfinished credit unchanged. */
export function scorePipes(
  solved: boolean,
  connected: number,
  msRemaining: number,
  timeLimitMs: number = PIPES_TIME_MS,
): number {
  if (solved) return standardComplete(msRemaining, timeLimitMs);
  const joined = clamp(Math.round(connected), 0, PIPES_CELLS);
  if (joined >= PIPES_CELLS - 1) return 90;
  if (joined >= PIPES_CELLS - 2) return 85;
  if (joined >= 27) return 85 - 5 * Math.floor((PIPES_CELLS - 3 - joined) / 2);
  return Math.round(1.5 * joined);
}

/** Mini Sudoku (A). Unfinished round(110 × correct ÷ non-givens). */
export function scoreSudoku(
  solved: boolean,
  correctCells: number,
  totalCells: number,
  msRemaining: number,
  timeLimitMs: number = SUDOKU_TIME_MS,
): number {
  if (solved) return standardComplete(msRemaining, timeLimitMs);
  const total = Math.max(1, totalCells);
  return clamp(Math.round((SUDOKU_PARTIAL_POINTS * correctCells) / total), 0, SUDOKU_PARTIAL_POINTS);
}

/** Colour Connect (A). Unfinished 10 per pair joined. */
export function scoreFlow(
  solved: boolean,
  pairsJoined: number,
  msRemaining: number,
  totalPairs: number = FLOW_PAIRS,
  timeLimitMs: number = FLOW_TIME_MS,
): number {
  if (solved) return standardComplete(msRemaining, timeLimitMs);
  const pairs = clamp(Math.round(pairsJoined), 0, Math.max(1, Math.round(totalPairs)));
  return clamp(FLOW_PAIR_POINTS * pairs, 0, MAX_ROUND_SCORE);
}

/** Ice Slide (B). Unfinished round(90 × (1 − best distance ÷ start distance)). */
export function scoreIceSlide(
  solved: boolean,
  moves: number,
  minMoves: number,
  msRemaining: number,
  progress: number,
  timeLimitMs: number = SLIDE_TIME_MS,
): number {
  if (solved) return scoreSolvedMoves(moves, minMoves, msRemaining, timeLimitMs);
  return clamp(Math.round(SLIDE_PARTIAL_POINTS * clamp(progress, 0, 1)), 0, SLIDE_PARTIAL_POINTS);
}

/** Push (B). Unfinished round(110 × crates home ÷ crates). */
export function scorePush(
  solved: boolean,
  pushes: number,
  minPushes: number,
  msRemaining: number,
  cratesHome: number,
  totalCrates: number,
  timeLimitMs: number = PUSH_TIME_MS,
): number {
  if (solved) return scoreSolvedMoves(pushes, minPushes, msRemaining, timeLimitMs);
  const total = Math.max(1, totalCrates);
  return clamp(Math.round((PUSH_PARTIAL_POINTS * cratesHome) / total), 0, PUSH_PARTIAL_POINTS);
}

/** Laser and Mirrors: 130 / 115 / 100 by fire + SPEED(20); fired but unlit: 15 per gem. */
export function scoreLaser(
  solved: boolean,
  gemsLit: number,
  fires: number,
  msRemaining: number,
  timeLimitMs: number = LASER_TIME_MS,
): number {
  if (solved) {
    const shot = Math.max(1, Math.min(LASER_FIRE_BASE.length, Math.round(fires) || 1));
    return clamp(LASER_FIRE_BASE[shot - 1]! + speedPoints(20, msRemaining, timeLimitMs), 0, MAX_ROUND_SCORE);
  }
  if (fires < 1) return 0;
  const lit = clamp(Math.round(gemsLit), 0, LASER_GEMS);
  return clamp(LASER_GEM_POINTS * lit, 0, MAX_ROUND_SCORE);
}

/** Tower (B). Unfinished round(110 × discs home from the bottom ÷ discs). */
export function scoreTower(
  solved: boolean,
  moves: number,
  minMoves: number,
  msRemaining: number,
  timeLimitMs: number,
  correctFromBottom: number,
  discs: number,
): number {
  if (solved) return scoreSolvedMoves(moves, minMoves, msRemaining, timeLimitMs);
  const total = Math.max(1, discs);
  return clamp(Math.round((TOWER_PARTIAL_POINTS * correctFromBottom) / total), 0, TOWER_PARTIAL_POINTS);
}

/** Maze Dash (A). Unfinished round(110 × progress). */
export function scoreMaze(
  solved: boolean,
  progress: number,
  msRemaining: number,
  timeLimitMs: number = MAZE_TIME_MS,
): number {
  if (solved) return standardComplete(msRemaining, timeLimitMs);
  return clamp(Math.round(MAZE_PARTIAL_POINTS * clamp(progress, 0, 1)), 0, MAZE_PARTIAL_POINTS);
}

/** Sort the Tubes (B). Unfinished 22 per single-colour tube. */
export function scoreTubes(
  solved: boolean,
  moves: number,
  minMoves: number,
  msRemaining: number,
  sortedTubes: number,
  timeLimitMs: number = TUBES_TIME_MS,
): number {
  if (solved) return scoreSolvedMoves(moves, minMoves, msRemaining, timeLimitMs);
  return clamp(TUBES_TUBE_POINTS * Math.max(0, Math.round(sortedTubes)), 0, MAX_ROUND_SCORE);
}

/** Safe Cracker: try 1 / 2 / 3 = 130 / 115 / 100 + SPEED(20); else 15 per dial on the last try. */
export function scoreSafe(
  openedOn: number,
  msRemaining: number,
  dialsRight: number,
  timeLimitMs: number = SAFE_TIME_MS,
): number {
  if (openedOn >= 1 && openedOn <= SAFE_TRY_POINTS.length) {
    return clamp(SAFE_TRY_POINTS[openedOn - 1]! + speedPoints(20, msRemaining, timeLimitMs), 0, MAX_ROUND_SCORE);
  }
  return clamp(SAFE_DIAL_POINTS * dialsRight, 0, SAFE_DIAL_POINTS * 4);
}

/** Bomb Defusal (A). Unfinished 25 per correct step before the strike, max 75. */
export function scoreBomb(
  defused: boolean,
  msRemaining: number,
  correctPrefix: number,
  timeLimitMs: number = BOMB_TIME_MS,
): number {
  if (defused) return standardComplete(msRemaining, timeLimitMs);
  return clamp(BOMB_PREFIX_POINTS * correctPrefix, 0, BOMB_PARTIAL_POINTS);
}

/** Gravity Maze (B). Unfinished 30 per locked ball. */
export function scoreGravity(
  solved: boolean,
  tilts: number,
  minMoves: number,
  msRemaining: number,
  locked: number,
  timeLimitMs: number = GRAV_TIME_MS,
): number {
  if (solved) return scoreSolvedMoves(tilts, minMoves, msRemaining, timeLimitMs);
  return clamp(GRAV_LOCK_POINTS * Math.max(0, Math.round(locked)), 0, MAX_ROUND_SCORE);
}

/** Don't Break the Chain: 6 per completed link, capped at 150; no bonus, no penalty. */
export function scoreChain(links: number): number {
  return clamp(CHAIN_LINK_POINTS * links, 0, MAX_ROUND_SCORE);
}

/** Intruder Detection (A): 24 per board (12 for half a two-change board); all five = 130 + SPEED(20). */
export function scoreIntruder(
  points: number,
  allCorrect: boolean,
  msRemaining: number,
  timeLimitMs: number = INTRUDER_TIME_MS,
): number {
  if (allCorrect) return standardComplete(msRemaining, timeLimitMs);
  return clamp(Math.round(points), 0, MAX_ROUND_SCORE);
}

/** Nonogram (A). Unfinished clamp(round(110 × correct ÷ total) − 5 × wrong, 0, 110). */
export function scoreNonogram(
  solved: boolean,
  correct: number,
  total: number,
  wrong: number,
  msRemaining: number,
  timeLimitMs: number = NONO_TIME_MS,
): number {
  if (solved) return standardComplete(msRemaining, timeLimitMs);
  const share = total > 0 ? Math.round((NONO_PARTIAL_POINTS * correct) / total) : 0;
  return clamp(share - NONO_WRONG_PENALTY * wrong, 0, NONO_PARTIAL_POINTS);
}

/** Pair Match (A). Unfinished 8 per pair. */
export function scorePairMatch(
  solved: boolean,
  pairs: number,
  msRemaining: number,
  timeLimitMs: number = PAIR_TIME_MS,
): number {
  if (solved) return standardComplete(msRemaining, timeLimitMs);
  return clamp(PAIR_PAIR_POINTS * clamp(Math.round(pairs), 0, PAIR_PAIRS), 0, MAX_ROUND_SCORE);
}

/** Colour Flood (C). Unfinished round(110 × region ÷ 196). */
export function scoreFlood(
  solved: boolean,
  moves: number,
  par: number,
  region: number,
  msRemaining: number,
  timeLimitMs: number = FLOOD_TIME_MS,
): number {
  if (solved) return scoreSolvedMoves(moves, par, msRemaining, timeLimitMs, "C");
  return clamp(
    Math.round((FLOOD_PARTIAL_POINTS * clamp(region, 0, FLOOD_CELLS)) / FLOOD_CELLS),
    0,
    FLOOD_PARTIAL_POINTS,
  );
}

/** One-Stroke (retired): finishing scores, with a bonus for getting it first time. */
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

/** Sliding Tiles (B). Unfinished 14 per tile in place (max 90). */
export function scoreTiles(
  solved: boolean,
  moves: number,
  minMoves: number,
  inPlace: number,
  msRemaining: number,
  timeLimitMs: number = TILES_TIME_MS,
): number {
  if (solved) return scoreSolvedMoves(moves, minMoves, msRemaining, timeLimitMs);
  return clamp(14 * clamp(Math.round(inPlace), 0, TILES_COUNT), 0, 90);
}

/** Rotating Rings (B). Unfinished 12 per aligned spoke. */
export function scoreRings(
  solved: boolean,
  moves: number,
  minMoves: number,
  aligned: number,
  msRemaining: number,
  timeLimitMs: number = RINGS_TIME_MS,
): number {
  if (solved) return scoreSolvedMoves(moves, minMoves, msRemaining, timeLimitMs);
  return clamp(RINGS_SPOKE_POINTS * clamp(Math.round(aligned), 0, RINGS_SEGMENTS), 0, MAX_ROUND_SCORE);
}
