import { roundPlacings, type RoundPlacing, type ScoringMode } from "./scoringMode";
import { speedBonusCurve } from "./speedPar";
import { bandCurve, bandOpen } from "../arcade/scoreBands";
import { finishParts, partialParts, scoreRev1, tryEfficiency, wasteFactor, PUZZLE_SPEED_POINTS, type ScoreParts } from "./puzzleScoreRev";
import { chainScore } from "./chain";
import type { ChainPuzzleData } from "./types";
import {
  BLOCK_PIECE_POINTS,
  BLOCK_TIME_MS,
  NUMHUNT_ERROR_PENALTY,
  NUMHUNT_TIME_MS,
  ROUND_MS,
  SPOT_DIFFERENCES,
  SPOT_TIME_MS,
  STOPWATCH_MISS_MS,
  TOTAL_ROUNDS,
  UNBLOCK_TIME_MS,
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
  NONO_PARTIAL_POINTS,
  NONO_TIME_MS,
  NONO_WRONG_PENALTY,
  PAIR_PAIRS,
  PAIR_PAIR_POINTS,
  PAIR_TIME_MS,
  FLOOD_CELLS,
  FLOOD_PARTIAL_POINTS,
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
/**
 * The cap today's scoring formulas clamp to (100 + 50). Scoring only: what a round of a game can
 * score, as screens, sounds and texts show it, is that game's maximum in roundMax.ts.
 */
export const MAX_ROUND_SCORE = BASE_POINTS + MAX_SPEED_BONUS;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** 0–50 for how much of the type's own time limit was left. */
export function speedBonus(msRemaining: number, timeLimitMs: number = ROUND_MS): number {
  const limit = timeLimitMs > 0 ? timeLimitMs : ROUND_MS;
  const clamped = clamp(msRemaining, 0, limit);
  return speedBonusCurve(MAX_SPEED_BONUS, clamped, limit);
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
  if (scoreRev1()) {
    // Rev 1: the grader measures d from numbers the player made (no step = no credit).
    if (!Number.isFinite(distance)) return partialParts(0);
    if (d === 0) return finishParts(speedPoints(30, msRemaining, timeLimitMs > 0 ? timeLimitMs : ROUND_MS));
    if (d <= 10) return partialParts(110 - ((d - 1) * (d + 2)) / 2);
    return partialParts(56 - TARGET_REV1_FAR_SLOPE * (d - 10));
  }
  if (d === 0) {
    const limit = timeLimitMs > 0 ? timeLimitMs : ROUND_MS;
    return Math.min(MAX_ROUND_SCORE, 130 + speedBonusCurve(20, msRemaining, limit));
  }
  if (d <= 10) return 120 - ((d - 1) * (d + 2)) / 2;
  return Math.max(0, Math.round(66 - 0.6 * (d - 10)));
}

/** Exact rev 1: beyond 10 away, credit falls this much per unit, as before (0 from about 103 away). */
export const TARGET_REV1_FAR_SLOPE = 0.6;

/** Flash: what a false start costs. tapRev 2: the first FLASH_REV2_CHEAP_FALSE_STARTS cost 8, every later one 11. */
export const FLASH_FALSE_START_COST = 8;
export const FLASH_REV2_CHEAP_FALSE_STARTS = 2;
export const FLASH_REV2_FALSE_START_COST = 11;

export function reactionFalseStartCost(falseStarts: number, tapRev = 0): number {
  const n = Math.max(0, Math.round(falseStarts) || 0);
  if (tapRev < 2) return FLASH_FALSE_START_COST * n;
  const cheap = Math.min(n, FLASH_REV2_CHEAP_FALSE_STARTS);
  return FLASH_FALSE_START_COST * cheap + FLASH_REV2_FALSE_START_COST * (n - cheap);
}

/** Straight lines between [x, score] knots (x rising), flat beyond both ends, rounded. */
export function knotScore(knots: readonly (readonly [number, number])[], x: number): number {
  const first = knots[0]!;
  const last = knots[knots.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < knots.length; i++) {
    const [x1, y1] = knots[i]!;
    if (x > x1) continue;
    const [x0, y0] = knots[i - 1]!;
    return Math.round(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
  }
  return last[1];
}

/**
 * Flash tapRev 3 (14 Oct 2026, Speed tuning): the average reaction (a miss counts
 * 1,200 ms) on a steeper curve, so the bands land near 70 / 100 / 125 / 145:
 * 150 at ≤ 150 ms, 128 at 200 ms, 100 at 300 ms, 0 at 800 ms; false starts cost as
 * tapRev 2 (8, 8, then 11 each).
 */
export const FLASH_REV3_CURVE = [[150, 150], [200, 128], [300, 100], [800, 0]] as const;

/**
 * Flash tapRev 4 (scoring report batch 2, 20 Oct 2026): one curve, the final score (the rev-2 knots row is the
 * identity), fitted so the simulated average / good / great / near-perfect players land about 70 / 100 / 120 / 140
 * after their false starts (as tapRev 2: 8, 8, then 11 each); reactions are the credited ones (replayFlash's decoy
 * cut), so tapping on every colour scores 0.
 */
export const FLASH_REV4_CURVE = [[150, 150], [165, 140], [200, 120], [300, 110], [450, 80], [600, 20], [800, 0]] as const;

/** Reaction Time: 150 at ≤200 ms average, −0.16 per ms above, minus the false-start cost, 0…150. */
export function scoreReaction(averageMs: number, falseStarts = 0, tapRev = 0): number {
  const base = tapRev >= 4
    ? knotScore(FLASH_REV4_CURVE, averageMs)
    : tapRev >= 3
    ? knotScore(FLASH_REV3_CURVE, averageMs)
    : averageMs <= 200 ? 150 : clamp(Math.round(150 - 0.16 * (averageMs - 200)), 0, 150);
  return clamp(base - reactionFalseStartCost(falseStarts, tapRev), 0, 150);
}

/** Double Take rev 1: 22 per difference, −5 per wrong tap; more than 5 wrong taps and all six is not a finish. */
export const SPOT_REV1_POINTS = 22;
export const SPOT_REV1_WRONG_PENALTY = 5;
export const SPOT_REV1_WRONG_LIMIT = 5;

/** Spot the Difference (A): 20 per difference; all six = 130 + SPEED(20). */
export function scoreSpotDifference(foundCount: number, msRemaining: number, timeLimitMs: number = SPOT_TIME_MS, wrongTaps = 0): number {
  const found = clamp(Math.round(foundCount), 0, SPOT_DIFFERENCES);
  if (scoreRev1()) {
    // Rev 1: wrong taps cost SPOT_REV1_WRONG_PENALTY each, and a finish needs at most SPOT_REV1_WRONG_LIMIT of them.
    const wrong = Math.max(0, Math.round(wrongTaps));
    if (found >= SPOT_DIFFERENCES && wrong <= SPOT_REV1_WRONG_LIMIT) return finishParts(speedPoints(30, msRemaining, timeLimitMs));
    return partialParts(SPOT_REV1_POINTS * found - SPOT_REV1_WRONG_PENALTY * wrong);
  }
  if (found >= SPOT_DIFFERENCES) return standardComplete(msRemaining, timeLimitMs);
  return SPOT_DIFF_POINTS * found;
}

/** Bang On rev 1: where the curve's bottom starts its fall to 0 at an all-miss average (500 ms). */
export const STOPWATCH_REV1_KNEE_MS = 300;

/**
 * Bang On tapRev 2: the same line down to STOPWATCH_REV2_KNEE_MS (101), then an
 * even fall to 0 at STOPWATCH_REV2_ZERO_MS, so random taps (about 230 ms off)
 * score about 70 while every average error under 200 ms scores as before.
 */
export const STOPWATCH_REV2_KNEE_MS = 200;
export const STOPWATCH_REV2_ZERO_MS = 325;

/**
 * Bang On tapRev 3 (14 Oct 2026, Speed tuning): full marks need ≤ 5 ms average
 * error (was 20 ms), 137 at 20 ms, then a straight line to tapRev 2's knee (101 at
 * 200 ms) and its fall to 0 at 325 ms, which stay as decided on 13 Oct.
 */
export const STOPWATCH_REV3_CURVE = [[5, 150], [20, 137], [STOPWATCH_REV2_KNEE_MS, 101], [STOPWATCH_REV2_ZERO_MS, 0]] as const;

/**
 * Bang On tapRev 4 (scoring report batch 2, 20 Oct 2026): one curve, the final score (the rev-2 knots row is the
 * identity): the simulated near-perfect / great / good / average players' average errors (40 / 55 / 106 / 176 ms)
 * land about 140 / 120 / 100 / 70, then a steep fall to 0 at STOPWATCH_REV4_ZERO_MS, which random tapping
 * (about 250 ms off) rarely beats.
 */
export const STOPWATCH_REV4_KNEE_MS = 176;
export const STOPWATCH_REV4_ZERO_MS = 220;
export const STOPWATCH_REV4_CURVE = [[5, 150], [40, 140], [55, 120], [106, 100], [STOPWATCH_REV4_KNEE_MS, 70], [STOPWATCH_REV4_ZERO_MS, 0]] as const;

/** Bang On: 150 at ≤ 20 ms average, −0.27 per ms above (47 at 400 ms, 20 at an all-miss 500 ms). */
export function scoreStopWatch(averageDistanceMs: number, tapRev = 0): number {
  if (tapRev >= 4) return clamp(knotScore(STOPWATCH_REV4_CURVE, averageDistanceMs), 0, 150);
  if (tapRev >= 3) return clamp(knotScore(STOPWATCH_REV3_CURVE, averageDistanceMs), 0, 150);
  if (averageDistanceMs <= 20) return 150;
  if (tapRev >= 2 && averageDistanceMs > STOPWATCH_REV2_KNEE_MS) {
    const knee = Math.round(150 - 0.27 * (STOPWATCH_REV2_KNEE_MS - 20));
    return clamp(Math.round((knee * (STOPWATCH_REV2_ZERO_MS - averageDistanceMs)) / (STOPWATCH_REV2_ZERO_MS - STOPWATCH_REV2_KNEE_MS)), 0, 150);
  }
  // Rev 1: the same line down to STOPWATCH_REV1_KNEE_MS, then an even fall to 0 at the 500 ms miss value.
  if (scoreRev1() && averageDistanceMs > STOPWATCH_REV1_KNEE_MS) {
    const knee = Math.round(150 - 0.27 * (STOPWATCH_REV1_KNEE_MS - 20));
    return clamp(Math.round((knee * (STOPWATCH_MISS_MS - averageDistanceMs)) / (STOPWATCH_MISS_MS - STOPWATCH_REV1_KNEE_MS)), 0, 150);
  }
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
  if (scoreRev1()) {
    // Rev 1: wrong taps come off the 30 above the finish base, never below 120, so a finish beats any unfinished run.
    if (finished) return finishParts(Math.max(0, speedBonusCurve(30, msRemaining, limit) - penalty));
    const count = clamp(Math.round(reached), 0, Math.max(1, total) - 1);
    return partialParts((110 * count) / Math.max(1, total - 1) - penalty);
  }
  if (finished) {
    const bonus = speedBonusCurve(20, msRemaining, limit);
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
 * One round's tie-break clock, built from the room's stored puzzle by
 * tieBreak.ts (`roomTieRounds`). `limitMs` is the round's own limit (the
 * puzzle's stored timeLimitMs, else the registry limit; the run length for
 * arcade and engine rounds); `phaseLimitMs` is the clock ms_remaining is
 * stored against (the same, except arcade and engine rounds, which add the
 * phase slack). Flash keeps its average reaction time.
 */
export interface TieRound {
  limitMs: number;
  phaseLimitMs: number;
  flash: boolean;
}

/** A room's tie-break rounds, or null for rooms played before the tie-break stamp. */
export type TieRounds = readonly TieRound[] | null | undefined;

/** Stamped rooms: the time one player used on one round. No answer used the whole round. */
export function roundTimeUsedMs(row: RoundResultRow | undefined, round: TieRound): number {
  if (!row) return round.limitMs;
  if (round.flash && row.reaction_avg_ms !== null) return row.reaction_avg_ms;
  return Math.min(round.limitMs, Math.max(0, round.phaseLimitMs - row.ms_remaining));
}

/**
 * Total time spent answering across all rounds — used for the tie-break.
 * Stamped rooms (`tie` from roomTieRounds) add the time each round actually
 * took against its own limit; older rooms keep their original sum (30 s minus
 * time left, or the average reaction time where a round stored one).
 */
export function totalAnswerMs(results: RoundResultRow[], slot: number, tie?: TieRounds): number {
  return answerMsThrough(results, slot, Number.POSITIVE_INFINITY, tie);
}

export type Outcome = "win" | "loss" | "draw";

export function duelOutcome(
  results: RoundResultRow[],
  mySlot: number,
  opponentSlot: number,
  tie?: TieRounds,
  mode: ScoringMode = "total",
  rounds?: number,
): Outcome {
  if (mode === "placings") {
    // Placings (scoringMode.ts): round wins first (1 point each, a level round 1 each), then the total.
    const through = rounds ?? Math.max(0, ...results.map((r) => r.round_number));
    const players = [{ slot: mySlot }, { slot: opponentSlot }];
    const pointsOf = placingPointsThrough(results, players, through);
    const myPoints = pointsOf.get(mySlot) ?? 0;
    const theirPoints = pointsOf.get(opponentSlot) ?? 0;
    if (myPoints > theirPoints) return "win";
    if (myPoints < theirPoints) return "loss";
  }
  const mine = totalScore(results, mySlot);
  const theirs = totalScore(results, opponentSlot);
  if (mine > theirs) return "win";
  if (mine < theirs) return "loss";

  const myTime = totalAnswerMs(results, mySlot, tie);
  const theirTime = totalAnswerMs(results, opponentSlot, tie);
  if (myTime < theirTime) return "win";
  if (myTime > theirTime) return "loss";
  return "draw";
}

/** A two-player Placings room's points (scoringMode.ts) through `rounds`, and what the last round gave each. */
export function duelPlacings(
  results: RoundResultRow[],
  mySlot: number,
  opponentSlot: number,
  rounds: number,
): { mine: number; theirs: number; lastMine: number; lastTheirs: number } {
  const players = [{ slot: mySlot }, { slot: opponentSlot }];
  const points = placingPointsThrough(results, players, rounds);
  const last = rounds >= 1 ? roundPlacingsOf(results, players, rounds) : new Map<number, RoundPlacing>();
  return {
    mine: points.get(mySlot) ?? 0,
    theirs: points.get(opponentSlot) ?? 0,
    lastMine: last.get(mySlot)?.points ?? 0,
    lastTheirs: last.get(opponentSlot)?.points ?? 0,
  };
}

export function roundBreakdown(results: RoundResultRow[], mySlot: number, opponentSlot: number, rounds = TOTAL_ROUNDS) {
  return Array.from({ length: rounds }, (_, i) => {
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
  /**
   * Placings rooms only (scoringMode.ts; absent on Total score rooms, which list exactly as before): the
   * placing points through the round shown, that round's points and the player's place in it.
   */
  points?: number;
  roundPoints?: number;
  roundPlace?: number;
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
  rows: { slot: number; total: number; answerMs: number; points?: number }[],
): { slot: number; position: number }[] {
  // Placings rows rank by points first; Total score rows carry no points, so this is the old order exactly.
  const level = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    (a.points ?? 0) === (b.points ?? 0) && a.total === b.total && a.answerMs === b.answerMs;
  const sorted = [...rows].sort((a, b) =>
    (b.points ?? 0) !== (a.points ?? 0)
      ? (b.points ?? 0) - (a.points ?? 0)
      : b.total !== a.total
        ? b.total - a.total
        : a.answerMs - b.answerMs,
  );
  const out: { slot: number; position: number }[] = [];
  sorted.forEach((row, index) => {
    const previous = index > 0 ? sorted[index - 1]! : null;
    const tied = previous && level(previous, row) ? out[index - 1]!.position : index + 1;
    out.push({ slot: row.slot, position: tied });
  });
  return out;
}

/** One round's placings among `players` (scoringMode.ts); a player with no answer scored 0. */
export function roundPlacingsOf(
  results: readonly RoundResultRow[],
  players: readonly { slot: number }[],
  round: number,
): Map<number, RoundPlacing> {
  const scores = players.map((p) => ({ slot: p.slot, score: resultFor([...results], p.slot, round)?.score ?? 0 }));
  return new Map(roundPlacings(scores).map((r) => [r.slot, r]));
}

/** Each player's placing points over rounds 1…`lastRound`. */
export function placingPointsThrough(
  results: readonly RoundResultRow[],
  players: readonly { slot: number }[],
  lastRound: number,
): Map<number, number> {
  const out = new Map(players.map((p) => [p.slot, 0]));
  for (let round = 1; round <= lastRound; round++) {
    for (const [slot, placing] of roundPlacingsOf(results, players, round)) {
      out.set(slot, (out.get(slot) ?? 0) + placing.points);
    }
  }
  return out;
}

function answerMsThrough(results: RoundResultRow[], slot: number, lastRound: number, tie?: TieRounds): number {
  if (tie) {
    // Every player in a room plays the same rounds, so a plain sum is fair.
    let sum = 0;
    for (let round = 1; round <= Math.min(lastRound, tie.length); round++) {
      sum += roundTimeUsedMs(resultFor(results, slot, round), tie[round - 1]!);
    }
    return sum;
  }
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
  tie?: TieRounds,
  mode: ScoringMode = "total",
): Standing[] {
  const inRoom = players.filter((p) => p.status !== "left");
  const placings = mode === "placings";
  const slots = inRoom.map((p) => ({ slot: p.player_slot }));
  const pointsNow = placings ? placingPointsThrough(results, slots, throughRound) : null;
  const pointsBefore = placings ? placingPointsThrough(results, slots, throughRound - 1) : null;
  const roundPlace = placings && throughRound >= 1 ? roundPlacingsOf(results, slots, throughRound) : null;
  const rows = inRoom.map((p) => ({
    slot: p.player_slot,
    total: totalScoreThrough(results, p.player_slot, throughRound),
    answerMs: answerMsThrough(results, p.player_slot, throughRound, tie),
    ...(pointsNow ? { points: pointsNow.get(p.player_slot) ?? 0 } : {}),
  }));
  const positions = new Map(rank(rows).map((r) => [r.slot, r.position]));

  const previousRows = inRoom.map((p) => ({
    slot: p.player_slot,
    total: totalScoreThrough(results, p.player_slot, throughRound - 1),
    answerMs: answerMsThrough(results, p.player_slot, throughRound - 1, tie),
    ...(pointsBefore ? { points: pointsBefore.get(p.player_slot) ?? 0 } : {}),
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
        answerMs: answerMsThrough(results, p.player_slot, throughRound, tie),
        position: positions.get(p.player_slot) ?? inRoom.length,
        previousPosition: throughRound > 1 ? (previous.get(p.player_slot) ?? null) : null,
        summary: details.get(p.player_slot)?.summary ?? "No answer",
        detail: details.get(p.player_slot)?.detail ?? [],
        ...(pointsNow
          ? {
              points: pointsNow.get(p.player_slot) ?? 0,
              roundPoints: roundPlace?.get(p.player_slot)?.points ?? 0,
              roundPlace: roundPlace?.get(p.player_slot)?.place ?? inRoom.length,
            }
          : {}),
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

/**
 * Wordsmith: each word point is worth 2.5 round points, rounded down. wordsmithRev 1: WORDSMITH_V1_CURVE.
 * wordsmithRev 2: WORDSMITH_V2_CURVE, at most 140 unless `allLetters` (a word using every tile was found).
 */
export function scoreWordsmith(points: number, rev?: number | null, allLetters = false): number {
  if ((rev ?? 0) >= WORDSMITH_REV_DEPTH) return wordsmithV3Words(points, rev ?? 0) + (allLetters ? WORDSMITH_V3_PANGRAM_BONUS : 0);
  if ((rev ?? 0) >= WORDSMITH_REV_ONE_CURVE) return Math.min(allLetters ? MAX_ROUND_SCORE : WORDSMITH_V2_CAP, bandOpen(WORDSMITH_V2_CURVE, points));
  if (rev === WORDSMITH_REV_CURVE) return bandOpen(WORDSMITH_V1_CURVE, points);
  return clamp(Math.floor(2.5 * Math.max(0, points)), 0, MAX_ROUND_SCORE);
}

/**
 * Scoring targets (18 Oct 2026, docs/scoring-targets.md): Nucleus rounds stamped
 * wordsmithRev 1 score their word points on this curve (straight lines between
 * the knots, 150 at 60, where 2.5 × points tops out). Fitted to the puzzle-fairness kits' word points
 * (scripts/word-open-bands.ts: average 10, good 23, great 34, near-perfect 55)
 * so they land about 95 / 122 / 135 / 145; the first few points stay cheap so
 * random letters (about 2 points) score under 10. Unstamped rounds keep 2.5 × points.
 */
export const WORDSMITH_REV_CURVE = 1;
export const WORDSMITH_V1_CURVE = bandCurve([0, 3, 6, 10, 16, 23, 34, 55, 60], [0, 12, 50, 95, 110, 122, 135, 145, 150]);
/**
 * Nucleus wordsmithRev 2 (scoring report batch 2, 20 Oct 2026, docs/scoring-targets.md): one curve on word
 * points, the final score (its rev-2 knots row is the identity, puzzleScoreRev2.ts). About 4 words (6–7 word
 * points) ≈ 35, the simulated average player's 11 ≈ 70, 13 words (about 18) ≈ 90, 19 words (about 32) ≈ 130;
 * random 4-letter tries (about 3 points) stay under 10. At most 140 without a word using every tile; 150 (at
 * 60 points) only with it.
 */
export const WORDSMITH_REV_ONE_CURVE = 2;
export const WORDSMITH_V2_CURVE = bandCurve([0, 3, 4, 6, 11, 18, 32, 45, 60], [0, 6, 14, 30, 70, 90, 130, 140, 150]);
export const WORDSMITH_V2_CAP = 140;
/** The wordsmithRev rooms dealt before the depth stamp (the rev-2 curve; checks pinned to it with pinPreDepth). */
export const WORDSMITH_REV_TARGET = WORDSMITH_REV_ONE_CURVE;
/**
 * Nucleus depth to 200 (25 Oct 2026, wordsmithRev 3; docs/depth/d1-word.md): the word points curve is rev 2's
 * exactly up to 45 points (140), then climbs slowly to WORDSMITH_V3_CAP (180 at 150 points) with no cap for a
 * missing every-tile word; a word using every tile (the pangram) adds WORDSMITH_V3_PANGRAM_BONUS on top. So a
 * solid haul scores what it did, today's 150 (60 points and the pangram) about 163, 190+ needs the pangram and a
 * haul of about 115 points, and 200 the pangram with 150 points.
 */
export const WORDSMITH_REV_DEPTH = 3;
export const WORDSMITH_V3_CURVE = bandCurve([0, 3, 4, 6, 11, 18, 32, 45, 60, 80, 110, 150], [0, 6, 14, 30, 70, 90, 130, 140, 143, 152, 166, 180]);
export const WORDSMITH_V3_CAP = 180;
export const WORDSMITH_V3_PANGRAM_BONUS = 20;
/**
 * The puzzle top-up (26 Oct 2026, wordsmithRev 4; docs/depth/topup-oct-2026.md): rev 3's curve exactly up to 45
 * points (140), then a little steeper (today's 150 haul, 60 points and the pangram, about 170; 190+ about 100
 * points with the pangram), the same 180 cap and pangram bonus.
 */
export const WORDSMITH_REV_TOPUP = 4;
export const WORDSMITH_V4_CURVE = bandCurve([0, 3, 4, 6, 11, 18, 32, 45, 60, 80, 105, 140], [0, 6, 14, 30, 70, 90, 130, 140, 153, 164, 174, 180]);
/** wordsmithRev 3 and later: the word points part (0–180), on the stamp's own curve (rev 3's by default). */
export function wordsmithV3Words(points: number, rev: number = WORDSMITH_REV_DEPTH): number {
  const curve = rev >= WORDSMITH_REV_TOPUP ? WORDSMITH_V4_CURVE : WORDSMITH_V3_CURVE;
  return Math.min(WORDSMITH_V3_CAP, bandOpen(curve, points, WORDSMITH_V3_CAP));
}
/** Forage's curve (wordHuntRev 1): kits' word points average 9, good 15, great 24, near-perfect 36; 150 at 48. */
export const WORDHUNT_REV_CURVE = 1;
/**
 * Forage wordHuntRev 2 (scoring report batch 2, 20 Oct 2026): the wordHuntRev 1 curve, cut by misses. The phone
 * also sends every rejected trace of 4+ letters (`!cells`); the server re-walks each and counts a miss for a real
 * path that spells no word. WORDHUNT_FREE_MISSES plus WORDHUNT_FREE_MISSES_PER_WORD per word found are free; each
 * one beyond takes WORDHUNT_MISS_COST_PCT % off, so random tracing (dozens of misses for a few lucky words) scores
 * about 0 while a player trying the odd non-word keeps everything.
 */
export const WORDHUNT_REV_MISSES = 2;
export const WORDHUNT_FREE_MISSES = 10;
export const WORDHUNT_FREE_MISSES_PER_WORD = 2;
export const WORDHUNT_MISS_COST_PCT = 3;
/** A rejected trace in a wordHuntRev 2 answer: "!" and its cells, after every word ("WORD:cells"). */
export const WORDHUNT_MISS_MARK = "!";
/** The most misses the phone sends and the server reads (enough to take any score to 0). */
export const WORDHUNT_MAX_MISSES = 120;
/** The wordHuntRev new rounds are dealt (generatePuzzle stamps it). */
export const WORDHUNT_REV_TARGET = WORDHUNT_REV_MISSES;

/** wordHuntRev 2: the share (percent) of the score kept after `misses` with `words` found. */
export function wordHuntMissKeptPct(misses: number, words: number): number {
  const free = WORDHUNT_FREE_MISSES + WORDHUNT_FREE_MISSES_PER_WORD * Math.max(0, Math.trunc(words));
  const extra = Math.max(0, Math.trunc(misses) - free);
  return Math.max(0, 100 - WORDHUNT_MISS_COST_PCT * extra);
}
export const WORDHUNT_V1_CURVE = bandCurve([0, 4, 6, 9, 15, 24, 36, 48], [0, 10, 45, 95, 120, 135, 145, 150]);

/** Word-category completion bonus: round(max × ms_remaining ÷ registry limit). */
export function wordSpeedBonus(msRemaining: number, timeLimitMs: number, max = 20): number {
  if (!(timeLimitMs > 0)) return 0;
  return speedBonusCurve(max, msRemaining, timeLimitMs);
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
  if (scoreRev1()) {
    // Rev 1: `rows` counts only word rows the player made (the grader leaves out rows unchanged from the start).
    if (totalRows > 0 && rows >= totalRows) return finishParts(speedPoints(PUZZLE_SPEED_POINTS, msRemaining, timeLimitMs), movesPoints(15, moves, par), "moves");
    return partialParts(((110 * Math.max(0, rows)) / Math.max(1, totalRows - 1)) * wasteFactor(moves, par));
  }
  if (totalRows > 0 && rows >= totalRows) {
    return clamp(100 + speedPoints(30, msRemaining, timeLimitMs) + movesPoints(20, moves, par), 0, MAX_ROUND_SCORE);
  }
  return clamp(22 * Math.max(0, rows), 0, MAX_ROUND_SCORE);
}

/**
 * Word Hunt: raw word points stay on the play counter; each is worth two round points. wordHuntRev 1:
 * WORDHUNT_V1_CURVE. wordHuntRev 2: the same curve, then the misses' cut (wordHuntMissKeptPct), rounded down.
 */
export function scoreWordHunt(points: number, rev?: number | null, misses = 0, words = 0): number {
  if ((rev ?? 0) >= WORDHUNT_REV_MISSES) return Math.floor((bandOpen(WORDHUNT_V1_CURVE, Math.round(points)) * wordHuntMissKeptPct(misses, words)) / 100);
  if (rev === WORDHUNT_REV_CURVE) return bandOpen(WORDHUNT_V1_CURVE, Math.round(points));
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
  // Rev 1: the grader passes the share of the gold car's blockers cleared (no 0.9 factor).
  // Rev 1, every moves game: unfinished credit × wasteFactor (0 at 4× the minimum moves).
  if (scoreRev1()) return partialParts(110 * clamp(progress, 0, 1) * wasteFactor(moves, minMoves));
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
  if (scoreRev1()) return partialParts((110 * Math.max(0, Math.round(piecesPlaced))) / 8);
  return clamp(BLOCK_PIECE_POINTS * Math.max(0, Math.round(piecesPlaced)), 0, MAX_ROUND_SCORE);
}

/* -------------------------------------------------------------------------- */
/*  Standard shapes (A / B / C)                                                */
/* -------------------------------------------------------------------------- */

/** SPEED(P) = round(P × ms_remaining ÷ registry time limit). */
export function speedPoints(points: number, msRemaining: number, timeLimitMs: number): number {
  if (!(timeLimitMs > 0)) return 0;
  return speedBonusCurve(points, msRemaining, timeLimitMs);
}

/** MOVES(B, m, min) = round(B × clamp(1 − (m − min) ÷ min, 0, 1)). */
export function movesPoints(points: number, moves: number, minMoves: number): number {
  if (!(minMoves > 0)) return 0;
  return Math.round(points * clamp(1 - (moves - minMoves) / minMoves, 0, 1));
}

/** Shape A: complete = 130 + SPEED(20). */
export function standardComplete(msRemaining: number, timeLimitMs: number): number {
  if (scoreRev1()) return finishParts(speedPoints(30, msRemaining, timeLimitMs));
  return clamp(130 + speedPoints(20, msRemaining, timeLimitMs), 0, MAX_ROUND_SCORE);
}

/** Shape B (balanced) and C (move-weighted, Colour Flood only). */
export type MovesShape = "B" | "C";
export const MOVES_SHAPE: Record<MovesShape, { moves: number; speed: number }> = {
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
  // Rev 1, every moves game: 120 + MOVES(15) + PAR(15); a solve never scores under 120.
  if (scoreRev1()) return finishParts(speedPoints(PUZZLE_SPEED_POINTS, msRemaining, limitMs), movesPoints(15, moves, minMoves), "moves");
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
  parts?: ScoreParts | null,
): string {
  // puzzleScoreRev 1 rounds show the breakdown the server stored.
  // The reveal's own score line (above the board) states the stored parts and the verdict row says "Solved" (4 Nov
  // 2026): this line keeps the moves.
  if (parts?.kind === "finish") return `${moves} move${moves === 1 ? "" : "s"}${minMoves > 0 ? ` (fewest ${minMoves})` : ""}`;
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
  wrongStanding = 0,
): number {
  if (solved) return scoreSolvedMoves(presses, minPresses, msRemaining, timeLimitMs);
  const left = Math.max(0, Math.round(lightsLeftOn));
  if (scoreRev1()) {
    // Rev 1: 1–4 lights left = 110 / 95 / 80 / 65 when the player has pressed; else 5 per solution cell standing
    // less 5 per other cell standing (pressed an odd number of times), at most 45, so pressing everywhere earns nothing.
    if (presses > 0 && left >= 1 && left <= 4) return partialParts(125 - 15 * left);
    return partialParts(Math.min(45, 5 * (Math.max(0, Math.round(correctTaps)) - Math.max(0, wrongStanding))));
  }
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
  startConnected = 0,
): number {
  if (solved) return standardComplete(msRemaining, timeLimitMs);
  if (scoreRev1()) {
    // Rev 1: only tiles the player joined beyond the starting board count.
    // Squared, so random turns that join a few tiles earn about nothing.
    const gained = Math.max(0, Math.round(connected) - Math.round(startConnected));
    return partialParts(110 * (gained / Math.max(1, PIPES_CELLS - Math.round(startConnected))) ** 2);
  }
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
  wrongCells = 0,
): number {
  if (solved) return standardComplete(msRemaining, timeLimitMs);
  const total = Math.max(1, totalCells);
  // Rev 1: each wrong digit left in the grid costs 5, as in Mosaic.
  if (scoreRev1()) return partialParts(Math.round((SUDOKU_PARTIAL_POINTS * correctCells) / total) - 5 * Math.max(0, wrongCells));
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
  // Rev 1: every pair joined with cells still empty is the 110 top.
  if (scoreRev1()) return partialParts((110 * pairs) / Math.max(1, Math.round(totalPairs)));
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
  // Rev 1: the grader passes (start − best) ÷ (start − 1), so one move from the exit is 110, × wasteFactor.
  if (scoreRev1()) return partialParts(110 * clamp(progress, 0, 1) * wasteFactor(moves, minMoves));
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
  homeAtStart = 0,
): number {
  if (solved) return scoreSolvedMoves(pushes, minPushes, msRemaining, timeLimitMs);
  const total = Math.max(1, totalCrates);
  // Rev 1: crates the player brought home (not ones that started there); all but one home is 110.
  if (scoreRev1()) return partialParts(((110 * Math.max(0, cratesHome - homeAtStart)) / Math.max(1, total - 1 - homeAtStart)) * wasteFactor(pushes, minPushes));
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
  if (scoreRev1()) {
    // Rev 1: shots are the tries measure (15 / 8 / 0) + PAR(15); unsolved 22 per gem lit, at most 110.
    if (solved) return finishParts(speedPoints(PUZZLE_SPEED_POINTS, msRemaining, timeLimitMs), tryEfficiency(fires), "shots");
    if (fires < 1) return partialParts(0);
    return partialParts(22 * clamp(Math.round(gemsLit), 0, LASER_GEMS));
  }
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
  homeAtStart = 0,
): number {
  if (solved) return scoreSolvedMoves(moves, minMoves, msRemaining, timeLimitMs);
  const total = Math.max(1, discs);
  // Rev 1: only rings the player stacked count (not ones already home at the start); all but the top ring is 110.
  if (scoreRev1()) return partialParts(((110 * Math.max(0, correctFromBottom - homeAtStart)) / Math.max(1, total - 1 - homeAtStart)) * wasteFactor(moves, minMoves));
  return clamp(Math.round((TOWER_PARTIAL_POINTS * correctFromBottom) / total), 0, TOWER_PARTIAL_POINTS);
}

/** Labyrinth rev 1: the share of the route next to the start that earns no credit. */
export const MAZE_REV1_DEAD_ZONE = 0.05;

/** Maze Dash (A). Unfinished round(110 × progress). */
export function scoreMaze(
  solved: boolean,
  progress: number,
  msRemaining: number,
  timeLimitMs: number = MAZE_TIME_MS,
): number {
  if (solved) return standardComplete(msRemaining, timeLimitMs);
  // Rev 1: the grader passes the furthest route step beyond the start ÷ the steps to the exit (the start cell is 0);
  // the first MAZE_REV1_DEAD_ZONE of the route (cells a scribble reaches by chance) earns nothing.
  if (scoreRev1()) return partialParts((110 * Math.max(0, clamp(progress, 0, 1) - MAZE_REV1_DEAD_ZONE)) / (1 - MAZE_REV1_DEAD_ZONE));
  return clamp(Math.round(MAZE_PARTIAL_POINTS * clamp(progress, 0, 1)), 0, MAZE_PARTIAL_POINTS);
}

/** Unfinished boards that must never reach a finished score (130+). */
export const UNFINISHED_CAP = 110;

/** Sort the Tubes (B). Unfinished 22 per single-colour tube, max 110. */
export function scoreTubes(
  solved: boolean,
  moves: number,
  minMoves: number,
  msRemaining: number,
  sortedTubes: number,
  timeLimitMs: number = TUBES_TIME_MS,
  colours = 0,
  sortedAtStart = 0,
  solverShare?: number,
): number {
  if (solved) return scoreSolvedMoves(moves, minMoves, msRemaining, timeLimitMs);
  // tubesRev 2: the solver distance closed, net of waste (solverProgress.server.ts); a solved board is 110.
  if (scoreRev1() && solverShare !== undefined) return partialParts(110 * solverShare);
  // Rev 1: flasks the player corked beyond the start; all colours but one corked is 110.
  if (scoreRev1()) return partialParts(((110 * Math.max(0, Math.round(sortedTubes) - sortedAtStart)) / Math.max(1, colours - 1 - sortedAtStart)) * wasteFactor(moves, minMoves));
  return clamp(TUBES_TUBE_POINTS * Math.max(0, Math.round(sortedTubes)), 0, UNFINISHED_CAP);
}

/** Safe Cracker rev 1 unfinished: points per dial right on the last try beyond the first (a lucky dial is free). */
export const SAFE_REV1_DIAL_POINTS = 25;
export const SAFE_REV1_FREE_DIALS = 1;

/** Safe Cracker: try 1 / 2 / 3 = 130 / 115 / 100 + SPEED(20); else 15 per dial on the last try. */
export function scoreSafe(
  openedOn: number,
  msRemaining: number,
  dialsRight: number,
  timeLimitMs: number = SAFE_TIME_MS,
): number {
  if (scoreRev1()) {
    // Rev 1: tries are the efficiency measure (15 / 8 / 0) + PAR(15).
    if (openedOn >= 1 && openedOn <= SAFE_TRY_POINTS.length) return finishParts(speedPoints(PUZZLE_SPEED_POINTS, msRemaining, timeLimitMs), tryEfficiency(openedOn), "tries");
    return partialParts(SAFE_REV1_DIAL_POINTS * Math.max(0, dialsRight - SAFE_REV1_FREE_DIALS));
  }
  if (openedOn >= 1 && openedOn <= SAFE_TRY_POINTS.length) {
    return clamp(SAFE_TRY_POINTS[openedOn - 1]! + speedPoints(20, msRemaining, timeLimitMs), 0, MAX_ROUND_SCORE);
  }
  return clamp(SAFE_DIAL_POINTS * dialsRight, 0, SAFE_DIAL_POINTS * 4);
}

/**
 * Bomb Defusal (A). Unfinished: version 2 (six steps) = round(75 × correct
 * steps before the strike ÷ 6); version 1 (stored four-step rounds, `steps`
 * omitted) = 25 per correct step, max 75.
 */
export function scoreBomb(
  defused: boolean,
  msRemaining: number,
  correctPrefix: number,
  timeLimitMs: number = BOMB_TIME_MS,
  steps?: number,
): number {
  if (defused) return standardComplete(msRemaining, timeLimitMs);
  // Rev 1 (six steps): 22 per correct leading step, so five of six is 110.
  if (scoreRev1() && steps && steps > 0) return partialParts((110 * Math.min(correctPrefix, steps - 1)) / Math.max(1, steps - 1));
  if (steps && steps > 0) {
    return clamp(Math.round((BOMB_PARTIAL_POINTS * Math.min(correctPrefix, steps)) / steps), 0, BOMB_PARTIAL_POINTS);
  }
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
  lockedAtStart = 0,
  balls = 4,
  solverShare?: number,
): number {
  if (solved) return scoreSolvedMoves(tilts, minMoves, msRemaining, timeLimitMs);
  // gravityRev 2: the solver distance closed, net of waste (solverProgress.server.ts); a solved board is 110.
  if (scoreRev1() && solverShare !== undefined) return partialParts(110 * solverShare);
  // Rev 1: balls the player parked beyond the start; all but one parked is 110.
  if (scoreRev1()) return partialParts(((110 * Math.max(0, Math.round(locked) - lockedAtStart)) / Math.max(1, balls - 1 - lockedAtStart)) * wasteFactor(tilts, minMoves));
  return clamp(GRAV_LOCK_POINTS * Math.max(0, Math.round(locked)), 0, MAX_ROUND_SCORE);
}

/** Chain points and finish bonus follow the stored puzzle rules. */
export function scoreChain(links: number, msRemaining = 0, puzzle?: ChainPuzzleData): number {
  return chainScore(links, msRemaining, puzzle);
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
  if (scoreRev1()) return partialParts(share - NONO_WRONG_PENALTY * wrong);
  return clamp(share - NONO_WRONG_PENALTY * wrong, 0, NONO_PARTIAL_POINTS);
}

/** Matchmaker rev 1: mismatched tries that cost nothing (finding 15 pairs needs about this many even with a perfect memory). */
export const PAIR_REV1_FREE_MISSES = 25;

/** Pair Match (A). Unfinished 8 per pair. */
export function scorePairMatch(
  solved: boolean,
  pairs: number,
  msRemaining: number,
  timeLimitMs: number = PAIR_TIME_MS,
  tries = 0,
): number {
  if (solved) return standardComplete(msRemaining, timeLimitMs);
  // Rev 1: 110 × pairs ÷ 14, less 1 per mismatched try beyond PAIR_REV1_FREE_MISSES (random flipping earns nothing).
  if (scoreRev1()) {
    const misses = Math.max(0, Math.round(tries) - Math.round(pairs));
    return partialParts((110 * clamp(Math.round(pairs), 0, PAIR_PAIRS - 1)) / (PAIR_PAIRS - 1) - Math.max(0, misses - PAIR_REV1_FREE_MISSES));
  }
  return clamp(PAIR_PAIR_POINTS * clamp(Math.round(pairs), 0, PAIR_PAIRS), 0, MAX_ROUND_SCORE);
}

/** Colour Flood floodRev 1 waste factor: 1 up to par, falling evenly to 0 at the move limit. */
export function floodLimitWaste(moves: number, par: number, moveLimit: number): number {
  if (!Number.isFinite(moves) || moves <= par) return 1;
  return clamp((moveLimit - moves) / (moveLimit - par), 0, 1);
}

/** Colour Flood (C). Unfinished round(110 × region ÷ 196). */
export function scoreFlood(
  solved: boolean,
  moves: number,
  par: number,
  region: number,
  msRemaining: number,
  timeLimitMs: number = FLOOD_TIME_MS,
  regionAtStart = 0,
  /** floodRev 1 (moveLimits.ts): the stored move limit; null on stored rounds. */
  moveLimit: number | null = null,
): number {
  if (solved) return scoreSolvedMoves(moves, par, msRemaining, timeLimitMs, "C");
  // Rev 1: only cells the player flooded beyond the starting region count. floodRev 1: the waste
  // factor falls from 1 at par to 0 at the move limit (par + 2) instead of at 4× par, so a board
  // that runs out of moves (random taps, colour cycling) scores 0.
  const waste = moveLimit !== null && moveLimit > par ? floodLimitWaste(moves, par, moveLimit) : wasteFactor(moves, par);
  if (scoreRev1()) return partialParts(((110 * Math.max(0, region - regionAtStart)) / Math.max(1, FLOOD_CELLS - regionAtStart)) * waste);
  return clamp(
    Math.round((FLOOD_PARTIAL_POINTS * clamp(region, 0, FLOOD_CELLS)) / FLOOD_CELLS),
    0,
    FLOOD_PARTIAL_POINTS,
  );
}

/** Sliding Tiles (B). Unfinished 14 per tile in place (max 90). */
export function scoreTiles(
  solved: boolean,
  moves: number,
  minMoves: number,
  inPlace: number,
  msRemaining: number,
  timeLimitMs: number = TILES_TIME_MS,
  startInPlace = 0,
  /** Tiles on the board: 8 on stored rounds, 9 on the extra-cell board (tilesRev 1). */
  tileCount: number = TILES_COUNT,
): number {
  if (solved) return scoreSolvedMoves(moves, minMoves, msRemaining, timeLimitMs);
  // Rev 1: the grader passes only tiles the player put in place (not ones that started there).
  if (scoreRev1()) return partialParts(((110 * Math.max(0, Math.round(inPlace))) / Math.max(1, tileCount - 1 - startInPlace)) * wasteFactor(moves, minMoves));
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
  alignedAtStart = 0,
): number {
  if (solved) return scoreSolvedMoves(moves, minMoves, msRemaining, timeLimitMs);
  // Rev 1: spokes the player lined up beyond the start; all but one is 110.
  if (scoreRev1()) return partialParts(((110 * Math.max(0, Math.round(aligned) - alignedAtStart)) / Math.max(1, RINGS_SEGMENTS - 1 - alignedAtStart)) * wasteFactor(moves, minMoves));
  return clamp(RINGS_SPOKE_POINTS * clamp(Math.round(aligned), 0, RINGS_SEGMENTS), 0, MAX_ROUND_SCORE);
}
