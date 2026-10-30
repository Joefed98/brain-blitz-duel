/**
 * Beat — an arcade game on the shared engine.
 *
 * The chart (which lane, which tick) is generated in full from the seed at init
 * at 120 BPM, so everyone plays the same notes. Taps arrive as kind 9 with the
 * lane in `a`, and judging is a whole-tick comparison, so the phone and the
 * server always agree on the accuracy.
 */

import {
  clampInt,
  inputRange,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { stdLinear, stdPart, stdScore, stdShare, type StdPart, type StdSpec } from "./arcadeStandard";
import { bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, type BandFields, type BandParts } from "./scoreBands";

/* ============================== Constants ============================== */

export const BEAT_WORLD_W = 390;
export const BEAT_WORLD_H = 620;
export const BEAT_HUD_H = 44;

export const BEAT_RUN_SECONDS = 60;
export const BEAT_RUN_TICKS = BEAT_RUN_SECONDS * TICKS_PER_SECOND;

/** A lane tap: kind 9, `a` = lane 0…3. */
export const BEAT_INPUT_TAP = 9;
/** A finger lifted: kind 10, `a` = lane 0…3 it was pressed in. */
export const BEAT_INPUT_RELEASE = 10;
/** Holds appear from this tick (20 s), on about this share of notes. */
export const BEAT_HOLD_FROM = 1200;
export const BEAT_HOLD_PERCENT = 20;
/** Combo tiers that change the lane glow (display only). */
export const BEAT_COMBO_TIERS = [10, 25, 50] as const;

export const BEAT_LANES = 4;
/** The hit line sits this far above the world's bottom. */
export const BEAT_HIT_LIFT = 100;
export const BEAT_HIT_LINE_Y = BEAT_WORLD_H - BEAT_HIT_LIFT;
export const BEAT_FALL_TICKS = 90;
export const BEAT_NOTE_H = 16;

/** 120 BPM at 60 ticks a second. */
export const BEAT_BEAT_TICKS = 30;
export const BEAT_EIGHTH_TICKS = 15;
export const BEAT_FIRST_BEAT = 120;

/** Judgement windows, in ticks either side of the hit line. */
export const BEAT_PERFECT_TICKS = 3;
export const BEAT_GOOD_TICKS = 7;
export const BEAT_OK_TICKS = 12;

/** Note worth in tenths: Perfect 1.0, Good 0.7, OK 0.4. */
export const BEAT_PERFECT_TENTHS = 10;
export const BEAT_GOOD_TENTHS = 7;
export const BEAT_OK_TENTHS = 4;

/** Score in quarter points: perfect 1, good 0.75, OK 0.25, miss −2. */
export const BEAT_PERFECT_Q = 4;
export const BEAT_GOOD_Q = 3;
export const BEAT_OK_Q = 1;
export const BEAT_MISS_Q = -8;

/** Never two notes in the same lane closer than this. */
export const BEAT_LANE_GAP = 12;

export const BEAT_JUDGE_NONE = 0;
export const BEAT_JUDGE_PERFECT = 1;
export const BEAT_JUDGE_GOOD = 2;
export const BEAT_JUDGE_OK = 3;
export const BEAT_JUDGE_MISS = 4;
/** A held head awaiting its release judgement; it earns no points yet. */
export const BEAT_JUDGE_PENDING = 5;

export const BEAT_INPUT_RANGES: readonly InputRange[] = [
  inputRange(BEAT_INPUT_TAP, [0, BEAT_LANES - 1]),
  inputRange(BEAT_INPUT_RELEASE, [0, BEAT_LANES - 1]),
];

/* --------------------------- Rev 2: swipe notes --------------------------- */

/**
 * Swipe-note revision (stored as puzzle.beatRev = 2). The chart (ticks, lanes,
 * holds) is built exactly as before; then, continuing the same PRNG stream,
 * some single tap notes in the second half become swipe notes. Nothing else
 * changes: same windows, same points.
 */
export const BEAT_REV = 2;
/** A swipe: kind 11, `a` = lane 0…3, `b` = 0 for left, 1 for right. */
export const BEAT_INPUT_SWIPE = 11;
/** Swipe notes only from 30 s, on about this share of eligible notes. */
export const BEAT_SWIPE_FROM = 1800;
export const BEAT_SWIPE_PERCENT = 25;
export const BEAT_SWIPE_LEFT = -1;
export const BEAT_SWIPE_RIGHT = 1;

export const BEAT_V2_INPUT_RANGES: readonly InputRange[] = [
  ...BEAT_INPUT_RANGES,
  inputRange(BEAT_INPUT_SWIPE, [0, BEAT_LANES - 1], [0, 1]),
];

/* ================================ Chart ================================ */

export interface BeatChart {
  ticks: number[];
  lanes: number[];
  /** Tail length in ticks for a hold note, 0 for a tap note. */
  holds: number[];
  /** Rev 2 only: −1 swipe left, +1 swipe right, 0 for any other note. */
  swipes?: number[];
  /** beatRev 9 only: 1 for a golden note; for a double tap's second note its first note's index, else −1. */
  golds?: number[];
  pairs?: number[];
}

/** The whole chart, built once from the seed. */
function buildChart(seed: number): { rng: number; chart: BeatChart } {
  let rng = seed | 0;
  const ticks: number[] = [];
  const lanes: number[] = [];
  const lastInLane = [-999, -999, -999, -999];
  const lastTick = BEAT_RUN_TICKS - BEAT_OK_TICKS - 2;

  const add = (tick: number, lane: number): boolean => {
    if (tick < BEAT_FIRST_BEAT || tick > lastTick) return false;
    if (tick - lastInLane[lane]! < BEAT_LANE_GAP) return false;
    ticks.push(tick);
    lanes.push(lane);
    lastInLane[lane] = tick;
    return true;
  };

  /** Tries the drawn lane first, then the others in order. */
  const place = (tick: number, wanted: number, avoid: number): boolean => {
    for (let offset = 0; offset < BEAT_LANES; offset++) {
      const lane = (wanted + offset) % BEAT_LANES;
      if (lane === avoid) continue;
      if (add(tick, lane)) return true;
    }
    return false;
  };

  for (let tick = BEAT_FIRST_BEAT; tick <= lastTick; tick += BEAT_BEAT_TICKS) {
    const laneDraw = rngBelow(rng, BEAT_LANES);
    rng = laneDraw.state;
    const placed = place(tick, laneDraw.value, -1);
    const lane = placed ? lanes[lanes.length - 1]! : -1;

    if (tick >= 2400) {
      // The last twenty seconds mix in short two-lane chords.
      const chordDraw = rngBelow(rng, 100);
      rng = chordDraw.state;
      if (chordDraw.value < 35) {
        const partner = rngBelow(rng, BEAT_LANES);
        rng = partner.state;
        place(tick, partner.value, lane);
      }
    }

    if (tick >= 1200) {
      const eighthDraw = rngBelow(rng, 100);
      rng = eighthDraw.state;
      const chance = tick >= 2400 ? 25 : 50;
      if (eighthDraw.value < chance) {
        const laneFor = rngBelow(rng, BEAT_LANES);
        rng = laneFor.state;
        place(tick + BEAT_EIGHTH_TICKS, laneFor.value, lane);
      }
    }
  }

  // Sort by tick, keeping the lane alongside.
  const order = ticks.map((_, index) => index);
  order.sort((a, b) => ticks[a]! - ticks[b]! || lanes[a]! - lanes[b]!);
  const sortedTicks = order.map((index) => ticks[index]!);
  const sortedLanes = order.map((index) => lanes[index]!);
  // Holds: from 20 s, about one note in five grows a one- to two-beat tail,
  // only when its lane stays clear until the tail has ended.
  const holds = sortedTicks.map(() => 0);
  for (let i = 0; i < sortedTicks.length; i++) {
    const tick = sortedTicks[i]!;
    if (tick < BEAT_HOLD_FROM) continue;
    const roll = rngBelow(rng, 100);
    rng = roll.state;
    if (roll.value >= BEAT_HOLD_PERCENT) continue;
    const lenDraw = rngBelow(rng, 3);
    rng = lenDraw.state;
    const len = BEAT_BEAT_TICKS + lenDraw.value * BEAT_EIGHTH_TICKS;
    if (tick + len > lastTick) continue;
    let clear = true;
    for (let j = i + 1; j < sortedTicks.length && sortedTicks[j]! <= tick + len + BEAT_LANE_GAP; j++) {
      if (sortedLanes[j] === sortedLanes[i]) clear = false;
    }
    if (clear) holds[i] = len;
  }
  return { rng, chart: { ticks: sortedTicks, lanes: sortedLanes, holds } };
}

/* ================================ State ================================ */

export interface BeatState extends BandFields {
  /** Rev 2 only: the stamp, and swipe notes judged so far (hit, and missed or wrong way). */
  rev?: number;
  swipesHit?: number;
  swipesMissed?: number;
  /** beatRev 4 only (Tuning C): 1 = scored on BEAT_V4_BAND_CURVE. Absent on every earlier round. */
  tunec?: number;
  /** beatRev 5 only (Tuning F): 1 = the chart thinned by a tenth at init. Absent on every earlier round. */
  tunef?: number;
  /** beatRev 6 only (taller worlds batch 2): the world height in px (BEAT_TALL_H). Absent = BEAT_WORLD_H. */
  worldH?: number;
  /** beatRev 9 only (the expansion): every field below is absent on earlier rounds. */
  exp?: number;
  /** beatRev 10 only (phone notes, 27 Oct 2026): 1 = the wider hit windows (BEAT_V10_WINDOWS) and the lighter chart. */
  ease?: number;
  /** beatRev 11 only (the arcade scoring standard, 29 Oct 2026): 1 = scored on BEAT_STD_SPEC (beatRev 10's play). */
  std?: number;
  /** Fever: the meter (half steps, to BEAT_FEVER_FULL), ticks of fever left, fevers had, quarters earned in fever. */
  meter?: number;
  fever?: number;
  fevers?: number;
  feverQ?: number;
  /** Golden notes hit and their points; double taps completed; the Perfect streak and its best (the streak bonus). */
  goldsHit?: number;
  goldPts?: number;
  doublesDone?: number;
  streak?: number;
  maxStreak?: number;
  tick: number;
  rng: number;
  chart: BeatChart;
  /** One judgement per note; 0 until it is hit or missed. */
  judged: number[];
  /** The first note that has neither been judged nor passed the miss window. */
  cursor: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  good: number;
  ok: number;
  misses: number;
  strays: number;
  tenths: number;
  /** Per lane: the hold note under the finger, or −1. */
  holding: number[];
  holdStartErrors: number[];
  holdsDone: number;
  holdsDropped: number;
  /** Render only: the last judgement, and how long it has been shown. */
  lastJudge: number;
  lastLane: number;
  judgeAge: number;
}

function init(seed: number): BeatState {
  const built = buildChart(seed);
  return {
    tick: 0,
    rng: built.rng,
    chart: built.chart,
    judged: built.chart.ticks.map(() => BEAT_JUDGE_NONE),
    cursor: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    good: 0,
    ok: 0,
    misses: 0,
    strays: 0,
    tenths: 0,
    holding: [-1, -1, -1, -1],
    holdStartErrors: [0, 0, 0, 0],
    holdsDone: 0,
    holdsDropped: 0,
    lastJudge: BEAT_JUDGE_NONE,
    lastLane: -1,
    judgeAge: 0,
  };
}

function isOver(state: BeatState): boolean {
  return state.tick >= (state.exp ? BEAT_V9_RUN_TICKS : BEAT_RUN_TICKS);
}

export function beatNoteCount(state: BeatState): number {
  return state.chart.ticks.length;
}

export function beatJudgedCount(state: BeatState): number {
  return state.perfect + state.good + state.ok;
}

/** Judgement windows in ticks either side of the hit line: Perfect, Good, OK. */
export interface BeatWindows {
  perfect: number;
  good: number;
  ok: number;
}
/** Every round before beatRev 10: 3 / 7 / 12 ticks. */
export const BEAT_WINDOWS: BeatWindows = { perfect: BEAT_PERFECT_TICKS, good: BEAT_GOOD_TICKS, ok: BEAT_OK_TICKS };

/** The windows a state judges with: beatRev 10's wider ones, or the original. */
export function beatWindows(state: { ease?: number }): BeatWindows {
  return state.ease ? BEAT_V10_WINDOWS : BEAT_WINDOWS;
}

/** Judgement for a tick distance, or a miss when it is outside every window. */
export function beatJudge(distance: number, w: BeatWindows = BEAT_WINDOWS): number {
  if (distance <= w.perfect) return BEAT_JUDGE_PERFECT;
  if (distance <= w.good) return BEAT_JUDGE_GOOD;
  if (distance <= w.ok) return BEAT_JUDGE_OK;
  return BEAT_JUDGE_MISS;
}

function step(state: BeatState, input: ArcadeInputEvent | null): BeatState {
  if (isOver(state)) return state;
  // beatRev 9: five lanes in its later sections (every older round has four).
  const LANES = state.exp ? BEAT_V9_LANES : BEAT_LANES;
  // beatRev 10: wider windows (every older round judges on 3 / 7 / 12).
  const W = beatWindows(state);
  const tick = state.tick + 1;
  const next: BeatState = {
    ...state,
    tick,
    judgeAge: state.lastJudge === BEAT_JUDGE_NONE ? 0 : state.judgeAge + 1,
  };
  const ticks = state.chart.ticks;
  let judged: number[] | null = null;

  // Notes past the OK window are misses; the cursor only moves forward.
  let cursor = next.cursor;
  while (cursor < ticks.length && ticks[cursor]! + W.ok < tick) {
    if (state.judged[cursor] === BEAT_JUDGE_NONE) {
      judged ??= [...state.judged];
      judged[cursor] = BEAT_JUDGE_MISS;
      next.misses += 1;
      next.combo = 0;
      if (state.chart.swipes && state.chart.swipes[cursor]) next.swipesMissed = (next.swipesMissed ?? 0) + 1;
    }
    cursor += 1;
  }
  next.cursor = cursor;

  let holding: number[] | null = null;
  let holdStartErrors: number[] | null = null;
  const judgeHold = (lane: number, releaseError: number) => {
    const index = (holding ?? state.holding)[lane] ?? -1;
    if (index < 0) return;
    const error = Math.max(state.holdStartErrors[lane] ?? 0, releaseError);
    const verdict = error <= W.perfect ? BEAT_JUDGE_PERFECT
      : error <= W.good ? BEAT_JUDGE_GOOD : BEAT_JUDGE_MISS;
    holding ??= [...state.holding];
    holding[lane] = -1;
    judged ??= [...state.judged];
    judged[index] = verdict;
    if (verdict === BEAT_JUDGE_MISS) {
      next.misses += 1;
      next.holdsDropped += 1;
      next.combo = 0;
    } else {
      next.holdsDone += 1;
      if (verdict === BEAT_JUDGE_PERFECT) {
        next.perfect += 1;
        next.tenths += BEAT_PERFECT_TENTHS;
      } else {
        next.good += 1;
        next.tenths += BEAT_GOOD_TENTHS;
      }
      next.combo += 1;
      next.maxCombo = Math.max(next.maxCombo, next.combo);
    }
    next.lastJudge = verdict;
    next.lastLane = lane;
    next.judgeAge = 0;
  };
  // No automatic credit at the tail: a release inside the window is required.
  for (let lane = 0; lane < LANES; lane++) {
    const index = state.holding[lane] ?? -1;
    if (index < 0) continue;
    const tailTick = (ticks[index] ?? 0) + (state.chart.holds[index] ?? 0);
    if (tick > tailTick + W.good) judgeHold(lane, W.good + 1);
  }
  if (input && input.k === BEAT_INPUT_RELEASE) {
    const lane = clampInt(input.a, 0, LANES - 1);
    const index = (holding ?? state.holding)[lane] ?? -1;
    if (index >= 0) {
      const tailTick = (ticks[index] ?? 0) + (state.chart.holds[index] ?? 0);
      judgeHold(lane, Math.abs(tick - tailTick));
    }
  }

  if (input && input.k === BEAT_INPUT_TAP) {
    const lane = clampInt(input.a, 0, LANES - 1);
    let bestIndex = -1;
    let bestDistance = W.ok + 1;
    for (
      let index = cursor;
      index < ticks.length && ticks[index]! - tick <= W.ok;
      index++
    ) {
      if (state.chart.lanes[index] !== lane) continue;
      if ((judged ?? state.judged)[index] !== BEAT_JUDGE_NONE) continue;
      // Rev 2: a tap never takes a swipe note.
      if (state.chart.swipes && state.chart.swipes[index]) continue;
      const distance = Math.abs(ticks[index]! - tick);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0) {
      const verdict = beatJudge(bestDistance, W);
      judged ??= [...state.judged];
      judged[bestIndex] = verdict;
      if ((state.chart.holds[bestIndex] ?? 0) > 0) {
        // Reserve the head now, but judge the whole note only at release.
        judged[bestIndex] = BEAT_JUDGE_PENDING;
        holding ??= [...state.holding];
        holding[lane] = bestIndex;
        holdStartErrors ??= [...state.holdStartErrors];
        holdStartErrors[lane] = bestDistance;
      } else {
        if (verdict === BEAT_JUDGE_PERFECT) {
          next.perfect += 1;
          next.tenths += BEAT_PERFECT_TENTHS;
        } else if (verdict === BEAT_JUDGE_GOOD) {
          next.good += 1;
          next.tenths += BEAT_GOOD_TENTHS;
        } else {
          next.ok += 1;
          next.tenths += BEAT_OK_TENTHS;
        }
        next.combo += 1;
        next.maxCombo = Math.max(next.maxCombo, next.combo);
      }
      next.lastJudge = verdict;
      next.lastLane = lane;
      next.judgeAge = 0;
    } else {
      // A tap with no note anywhere near it costs nothing.
      next.strays += 1;
    }
  }

  // Rev 2: a swipe takes the nearest swipe note in its lane; the wrong way is a miss.
  if (state.rev === BEAT_REV && input && input.k === BEAT_INPUT_SWIPE) {
    const lane = clampInt(input.a, 0, LANES - 1);
    const dir = input.b === 1 ? BEAT_SWIPE_RIGHT : BEAT_SWIPE_LEFT;
    const swipes = state.chart.swipes ?? [];
    let bestIndex = -1;
    let bestDistance = W.ok + 1;
    for (let index = cursor; index < ticks.length && ticks[index]! - tick <= W.ok; index++) {
      if (state.chart.lanes[index] !== lane || !swipes[index]) continue;
      if ((judged ?? state.judged)[index] !== BEAT_JUDGE_NONE) continue;
      const distance = Math.abs(ticks[index]! - tick);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    if (bestIndex >= 0) {
      const verdict = swipes[bestIndex] === dir ? beatJudge(bestDistance, W) : BEAT_JUDGE_MISS;
      judged ??= [...state.judged];
      judged[bestIndex] = verdict;
      if (verdict === BEAT_JUDGE_MISS) {
        next.misses += 1;
        next.combo = 0;
        next.swipesMissed = (next.swipesMissed ?? 0) + 1;
      } else {
        if (verdict === BEAT_JUDGE_PERFECT) {
          next.perfect += 1;
          next.tenths += BEAT_PERFECT_TENTHS;
        } else if (verdict === BEAT_JUDGE_GOOD) {
          next.good += 1;
          next.tenths += BEAT_GOOD_TENTHS;
        } else {
          next.ok += 1;
          next.tenths += BEAT_OK_TENTHS;
        }
        next.combo += 1;
        next.maxCombo = Math.max(next.maxCombo, next.combo);
        next.swipesHit = (next.swipesHit ?? 0) + 1;
      }
      next.lastJudge = verdict;
      next.lastLane = lane;
      next.judgeAge = 0;
    } else {
      next.strays += 1;
    }
  }

  if (judged) next.judged = judged;
  if (holding) next.holding = holding;
  if (holdStartErrors) next.holdStartErrors = holdStartErrors;
  return next;
}

function score(state: BeatState): number {
  const quarters =
    BEAT_PERFECT_Q * state.perfect +
    BEAT_GOOD_Q * state.good +
    BEAT_OK_Q * state.ok +
    BEAT_MISS_Q * state.misses;
  return clampInt(Math.floor(quarters / 4), 0, 150);
}

/* ============================= Checkpoints ============================= */

export const BEAT_CHECKPOINT_INTERVAL = 300;

export interface BeatCheckpointState {
  tick: number;
  cursor: number;
  perfect: number;
  good: number;
  ok: number;
  misses: number;
  strays: number;
  tenths: number;
  combo: number;
  holdFold: number;
}

export interface BeatCheckpoint extends BeatCheckpointState {
  checksum: number;
}

export function beatCheckpointState(state: BeatState): BeatCheckpointState {
  return {
    tick: state.tick,
    cursor: state.cursor,
    perfect: state.perfect,
    good: state.good,
    ok: state.ok,
    misses: state.misses,
    strays: state.strays,
    tenths: state.tenths,
    combo: state.combo,
    holdFold:
      state.holdsDone * 7 + state.holdsDropped * 131 + state.holding.reduce((sum, h, lane) => sum + (h + 1) * (lane + 1) * 17 + (h >= 0 ? (state.holdStartErrors[lane] ?? 0) * (lane + 1) * 257 : 0), 0),
  };
}

export function beatCheckpoint(state: BeatState): BeatCheckpoint {
  const snapshot = beatCheckpointState(state);
  let checksum = 0x811c9dc5;
  const values = Object.values(snapshot);
  // Rev 2 folds its own counters in; older states never have them, so their sums are unchanged.
  if (state.rev === BEAT_REV) values.push(state.swipesHit ?? 0, state.swipesMissed ?? 0);
  // beatRev 4 (Tuning C) adds its marker last.
  if (state.tunec) values.push(state.tunec);
  // beatRev 5 (Tuning F) adds its marker after that, so rev-2/3/4 checksums are unchanged.
  if (state.tunef) values.push(state.tunef);
  // beatRev 6 (taller worlds): the world height, last.
  if (state.worldH) values.push(state.worldH);
  // beatRev 9 (the expansion): its own counters after that, so every earlier checksum is unchanged.
  if (state.exp) values.push(state.exp, state.meter ?? 0, state.fever ?? 0, state.fevers ?? 0, state.feverQ ?? 0, state.goldPts ?? 0, state.doublesDone ?? 0, state.streak ?? 0, state.maxStreak ?? 0, state.goldsHit ?? 0, ...state.holding);
  // beatRev 10 (phone notes): its marker, last.
  if (state.ease) values.push(state.ease);
  // beatRev 11 (the scoring standard): its marker, last.
  if (state.std) values.push(state.std);
  for (const value of values) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const BEAT_BG = "#0B0B0F";
export const BEAT_GOLD = "#F5B82E";
export const BEAT_LANE_COLOURS = ["#2ED3B7", "#F5B82E", "#8B7BF7", "#5AA9FF"];

export const BEAT_JUDGE_TEXT: Record<number, string> = {
  [BEAT_JUDGE_PERFECT]: "PERFECT",
  [BEAT_JUDGE_GOOD]: "GOOD",
  [BEAT_JUDGE_OK]: "OK",
  [BEAT_JUDGE_MISS]: "MISS",
};

export function beatLaneX(lane: number): number {
  const width = BEAT_WORLD_W / BEAT_LANES;
  return lane * width + width / 2;
}

function draw(ctx: CanvasRenderingContext2D, state: BeatState, size: CanvasSize): void {
  // beatRev 6: the taller lanes (the original 620 world otherwise).
  const BEAT_WORLD_H = beatWorldH(state);
  const BEAT_HIT_LINE_Y = beatHitLineY(state);
  const scaleX = size.width / BEAT_WORLD_W;
  const scaleY = size.height / BEAT_WORLD_H;
  const laneW = BEAT_WORLD_W / BEAT_LANES;

  ctx.save();
  ctx.fillStyle = BEAT_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.scale(scaleX, scaleY);

  const tier = BEAT_COMBO_TIERS.filter((t) => state.combo >= t).length;
  for (let lane = 0; lane < BEAT_LANES; lane++) {
    ctx.fillStyle = lane % 2 === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)";
    ctx.fillRect(lane * laneW, BEAT_HUD_H, laneW, BEAT_WORLD_H - BEAT_HUD_H);
    if (tier > 0) {
      // Combo glow rising from the hit line, stronger and taller per tier.
      const glowH = 90 + tier * 70;
      const grad = ctx.createLinearGradient(0, BEAT_HIT_LINE_Y, 0, BEAT_HIT_LINE_Y - glowH);
      grad.addColorStop(0, `${BEAT_LANE_COLOURS[lane]!}${["", "33", "55", "88"][tier]}`);
      grad.addColorStop(1, `${BEAT_LANE_COLOURS[lane]!}00`);
      ctx.fillStyle = grad;
      ctx.fillRect(lane * laneW, BEAT_HIT_LINE_Y - glowH, laneW, glowH);
    }
    if (state.holding[lane]! >= 0) {
      ctx.fillStyle = `${BEAT_LANE_COLOURS[lane]!}40`;
      ctx.fillRect(lane * laneW, BEAT_HIT_LINE_Y - 12, laneW, 24);
    }
  }

  ctx.strokeStyle = BEAT_GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, BEAT_HIT_LINE_Y);
  ctx.lineTo(BEAT_WORLD_W, BEAT_HIT_LINE_Y);
  ctx.stroke();

  const travel = BEAT_HIT_LINE_Y - BEAT_HUD_H;
  const yAt = (remaining: number) => BEAT_HUD_H + (travel * (BEAT_FALL_TICKS - remaining)) / BEAT_FALL_TICKS;
  for (let index = 0; index < state.chart.ticks.length; index++) {
    const lane = state.chart.lanes[index]!;
    const hold = state.chart.holds[index]!;
    const held = state.holding[lane] === index;
    if (state.judged[index] !== BEAT_JUDGE_NONE && !held) continue;
    const hitTick = state.chart.ticks[index]!;
    const remaining = hitTick - state.tick;
    if (remaining > BEAT_FALL_TICKS || remaining + hold < -BEAT_OK_TICKS) continue;
    const colour = BEAT_LANE_COLOURS[lane % BEAT_LANE_COLOURS.length]!;
    if (hold > 0) {
      // The tail, from the head (pinned to the line while held) up to its end.
      const headY = held ? BEAT_HIT_LINE_Y : yAt(remaining);
      const tailY = yAt(remaining + hold);
      ctx.fillStyle = `${colour}${held ? "CC" : "66"}`;
      ctx.fillRect(lane * laneW + laneW / 2 - 9, tailY, 18, Math.max(0, headY - tailY));
      ctx.fillStyle = colour;
      ctx.fillRect(lane * laneW + 14, tailY - 4, laneW - 28, 8);
      // Keep the head visible at the hit line while the tail approaches.
      ctx.fillRect(lane * laneW + 10, headY - BEAT_NOTE_H / 2, laneW - 20, BEAT_NOTE_H);
      continue;
    }
    ctx.fillStyle = colour;
    ctx.fillRect(lane * laneW + 10, yAt(remaining) - BEAT_NOTE_H / 2, laneW - 20, BEAT_NOTE_H);
  }

  // Combo counter beside the hit line.
  if (state.combo > 0) {
    ctx.fillStyle = tier >= 3 ? BEAT_GOLD : tier === 2 ? BEAT_LANE_COLOURS[2]! : tier === 1 ? BEAT_LANE_COLOURS[0]! : "rgba(255,255,255,0.75)";
    ctx.font = "bold 22px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${state.combo}×`, BEAT_WORLD_W - 8, BEAT_HIT_LINE_Y + 8);
    ctx.textBaseline = "alphabetic";
  }

  if (state.lastJudge !== BEAT_JUDGE_NONE && state.judgeAge < 24) {
    ctx.globalAlpha = Math.max(0, 1 - state.judgeAge / 24);
    ctx.fillStyle = state.lastJudge === BEAT_JUDGE_MISS ? "#E0503C" : BEAT_GOLD;
    ctx.font = "bold 18px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      BEAT_JUDGE_TEXT[state.lastJudge] ?? "",
      beatLaneX(Math.max(0, state.lastLane)),
      BEAT_HIT_LINE_Y - 26 - state.judgeAge,
    );
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = BEAT_BG;
  ctx.fillRect(0, 0, BEAT_WORLD_W, BEAT_HUD_H);
  ctx.fillStyle = BEAT_GOLD;
  ctx.font = "bold 20px ui-monospace, monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(`Combo ${state.combo}`, 14, BEAT_HUD_H / 2);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.restore();
}

export const beatGame: ArcadeGame<BeatState, ArcadeInputEvent | null> = {
  key: "beat",
  runTicks: BEAT_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: BEAT_INPUT_RANGES,
};

/** Swipe notes: single tap notes from 30 s whose tick no other note shares. */
function initRev2(seed: number): BeatState {
  const base = init(seed);
  let rng = base.rng;
  const { ticks, holds } = base.chart;
  const swipes = ticks.map(() => 0);
  for (let i = 0; i < ticks.length; i++) {
    if (ticks[i]! < BEAT_SWIPE_FROM || holds[i]! > 0) continue;
    if (ticks[i - 1] === ticks[i] || ticks[i + 1] === ticks[i]) continue;
    const roll = rngBelow(rng, 100);
    rng = roll.state;
    if (roll.value >= BEAT_SWIPE_PERCENT) continue;
    const dir = rngBelow(rng, 2);
    rng = dir.state;
    swipes[i] = dir.value === 0 ? BEAT_SWIPE_LEFT : BEAT_SWIPE_RIGHT;
  }
  return { ...base, rng, rev: BEAT_REV, chart: { ...base.chart, swipes }, swipesHit: 0, swipesMissed: 0 };
}

/** Swipe-note revision. */
export const beatRev2Game: ArcadeGame<BeatState, ArcadeInputEvent | null> = { ...beatGame, init: initRev2, inputRanges: BEAT_V2_INPUT_RANGES };

/** Takes puzzle.beatRev; anything else is the original game. */
export function beatGameFor(rev?: number | null): ArcadeGame<BeatState, ArcadeInputEvent | null> {
  if (rev === BEAT_REV_STD) return beatV11Game;
  if (rev === BEAT_REV_EASE) return beatV10Game;
  if (rev === BEAT_REV_200) return beatV9Game;
  if (rev === BEAT_REV_STRICT) return beatStrictGame;
  if (rev === BEAT_REV_TARGET) return beatTargetGame;
  if (rev === BEAT_REV_TALL) return beatTallGame;
  if (rev === BEAT_REV_TUNEF) return beatTunefGame;
  if (rev === BEAT_REV_TUNEC) return beatTunecGame;
  if (rev === BEAT_REV_BAND) return beatBandGame;
  return rev === BEAT_REV ? beatRev2Game : beatGame;
}

/** Swipe notes in the chart (0 on older rounds). */
export function beatSwipeCount(state: BeatState): number {
  return (state.chart.swipes ?? []).filter((d) => d !== 0).length;
}

/* ================= Oct 2026 score bands (beatRev 3) ================= */

/** Score-band revision (puzzle.beatRev = 3): rev-2 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const BEAT_REV_BAND = 3;
/**
 * Per mille of a perfect chart: Perfect 4, Good 3, OK 1, a missed note −2
 * (half a note, was −8), over 4 × notes; 150 at 1,000 (every note Perfect).
 */
export const BEAT_BAND_CURVE = bandCurve([0, 590, 810, 920, 975, 1000], [0, 70, 100, 125, 145, 150]);

export function beatBandParts(state: BeatState): BandParts {
  if (state.std) return beatV11Parts(state);
  if (state.exp) return beatV9Parts(state);
  const quarters = Math.max(0, BEAT_PERFECT_Q * state.perfect + BEAT_GOOD_Q * state.good + BEAT_OK_Q * state.ok - 2 * state.misses);
  const units = Math.floor((1000 * quarters) / Math.max(1, BEAT_PERFECT_Q * beatNoteCount(state)));
  return { units, points: bandPoints(bandCurveOf(state, state.tunef ? BEAT_V5_BAND_CURVE : state.tunec ? BEAT_V4_BAND_CURVE : BEAT_BAND_CURVE), units), bonus: 0, penalty: 0, finished: false, text: `${state.perfect} perfect · ${state.good} good · ${state.ok} OK · ${state.misses} missed` };
}

function scoreBand(state: BeatState): number {
  return bandTotal(beatBandParts(state), Boolean(state.acted));
}

export const beatBandGame: ArcadeGame<BeatState, ArcadeInputEvent | null> = { ...beatRev2Game, init: (seed) => bandInit(beatRev2Game.init(seed)) };

/* ================= Tuning C (beatRev 4, Oct 2026) ================= */

/**
 * beatRev 4 (Tuning C): beatRev 3 play unchanged, scored about 10 % higher (Joe
 * found Tempo slightly harsh): each knot below the top keeps its units and gains
 * a tenth of its points (145 can only rise to 148); every note Perfect is still
 * 150. States add `tunec: 1`.
 */
export const BEAT_REV_TUNEC = 4;
export const BEAT_V4_BAND_CURVE = bandCurve([0, 590, 810, 920, 975, 1000], [0, 77, 110, 137, 148, 150]);
export const beatTunecGame: ArcadeGame<BeatState, ArcadeInputEvent | null> = { ...beatBandGame, init: (seed) => ({ ...beatBandGame.init(seed), tunec: 1 }) };

/* ================= Tuning F (beatRev 5, Oct 2026) ================= */

/**
 * beatRev 5 (Tuning F): beatRev 4 play and curve on a chart with about a tenth
 * fewer notes (Joe: slightly fewer notes, not more). The beatRev 4 chart is
 * built exactly as before, then round(notes ÷ 10) plain notes are dropped by a
 * stream of its own keyed by the seed: notes in the busiest spots first (a chord
 * partner or an eighth within an eighth of another note), never a hold or a
 * swipe note, and never the first note. Dropping notes only widens lane gaps
 * and leaves every swipe on a tick of its own, so every rule still holds.
 * States add `tunef: 1`.
 */
export const BEAT_REV_TUNEF = 5;
/**
 * beatRev 5 band knots: with fewer notes the same players land a larger share
 * of the chart (scripts/arcade-skill-bands.ts --rev=f, 30 seeds: unit medians
 * 579 / 828 / 935 / 990 on beatRev 4, 662 / 869 / 951 / 989 on beatRev 5), so
 * each knot sits at the new median and keeps the points that level scored on
 * beatRev 4 (Tuning C's deliberately kinder level): fewer notes, same scores.
 * Every note Perfect is still 150.
 */
export const BEAT_V5_BAND_CURVE = bandCurve([0, 662, 869, 951, 990, 1000], [0, 75, 114, 140, 149, 150]);
/** The share of notes beatRev 5 drops, in per cent. */
export const BEAT_THIN_PERCENT = 10;

/** Indexes of the notes beatRev 5 drops from a beatRev 4 chart, ascending. */
export function beatThinned(seed: number, chart: BeatChart): number[] {
  const { ticks, holds } = chart;
  const swipes = chart.swipes ?? [];
  const n = ticks.length;
  const want = Math.round((n * BEAT_THIN_PERCENT) / 100);
  const busy: number[] = [];
  const plain: number[] = [];
  for (let i = 1; i < n; i++) {
    if (holds[i]! > 0 || (swipes[i] ?? 0) !== 0) continue;
    const near = (j: number) => j >= 0 && j < n && Math.abs(ticks[j]! - ticks[i]!) <= BEAT_EIGHTH_TICKS;
    (near(i - 1) || near(i + 1) ? busy : plain).push(i);
  }
  // A seeded shuffle of each pool (Fisher–Yates on its own stream), busy notes first.
  let rng = (seed ^ 0x54454d35) | 0;
  const shuffle = (pool: number[]) => {
    for (let i = pool.length - 1; i > 0; i--) {
      const draw = rngBelow(rng, i + 1);
      rng = draw.state;
      const t = pool[i]!;
      pool[i] = pool[draw.value]!;
      pool[draw.value] = t;
    }
    return pool;
  };
  return [...shuffle(busy), ...shuffle(plain)].slice(0, want).sort((a, b) => a - b);
}

function initTunef(seed: number): BeatState {
  const base = beatTunecGame.init(seed);
  const drop = new Set(beatThinned(seed, base.chart));
  const keep = (_: unknown, i: number) => !drop.has(i);
  const chart: BeatChart = {
    ticks: base.chart.ticks.filter(keep),
    lanes: base.chart.lanes.filter(keep),
    holds: base.chart.holds.filter(keep),
    ...(base.chart.swipes ? { swipes: base.chart.swipes.filter(keep) } : {}),
  };
  return { ...base, chart, judged: chart.ticks.map(() => BEAT_JUDGE_NONE), tunef: 1 };
}

export const beatTunefGame: ArcadeGame<BeatState, ArcadeInputEvent | null> = { ...beatTunecGame, init: initTunef };

/* ================= Taller worlds (beatRev 6, Oct 2026) ================= */

/**
 * beatRev 6 (taller worlds, batch 2): beatRev 5 play (the thinned chart, the
 * same hit windows and curve) in taller lanes, 390 × BEAT_TALL_H, the same for
 * every player. The hit line stays BEAT_HIT_LIFT above the new bottom, so the
 * lanes are 110 px longer; a note still takes BEAT_FALL_TICKS from the top of
 * its lane to the hit line, so it falls faster on screen and is in view for the
 * same time as before. Judging is by tick alone, so nothing a player can score
 * changes. States keep `tunec: 1` and `tunef: 1` and add `worldH`, folded into
 * the checkpoint checksum last.
 */
export const BEAT_REV_TALL = 6;
export const BEAT_TALL_H = 730;
/**
 * beatRev 6 scores on beatRev 5's curve, unchanged: judging is by tick alone, so
 * the same players hit exactly the same notes in the taller lanes
 * (scripts/arcade-skill-bands.ts --rev=g2, 60 seeds: 73 / 112 / 139 / 148 on both
 * revisions; Tuning C's deliberately kinder level, Joe's ruling).
 */
export const BEAT_V6_BAND_CURVE = BEAT_V5_BAND_CURVE;

/** The world height (px) a state plays in: beatRev 6's taller lanes, or the original 620. */
export function beatWorldH(state: { worldH?: number }): number {
  return state.worldH ?? BEAT_WORLD_H;
}
/** The hit line (px) in a state's world: always BEAT_HIT_LIFT above the bottom. */
export function beatHitLineY(state: { worldH?: number }): number {
  return beatWorldH(state) - BEAT_HIT_LIFT;
}
/** A note's fall speed on screen, px a tick: the lane from the HUD to the hit line in BEAT_FALL_TICKS. */
export function beatFallPxPerTick(state: { worldH?: number }): number {
  return (beatHitLineY(state) - BEAT_HUD_H) / BEAT_FALL_TICKS;
}

export const beatTallGame: ArcadeGame<BeatState, ArcadeInputEvent | null> = {
  ...beatTunefGame,
  init: (seed) => ({ ...beatTunefGame.init(seed), worldH: BEAT_TALL_H }),
};

/** The world height (px) a stored round's beatRev plays in. */
export function beatWorldHFor(rev?: number | null): number {
  return rev === BEAT_REV_STD || rev === BEAT_REV_EASE || rev === BEAT_REV_200 || rev === BEAT_REV_TALL || rev === BEAT_REV_TARGET || rev === BEAT_REV_STRICT ? BEAT_TALL_H : BEAT_WORLD_H;
}

/* ================= Scoring targets (beatRev 7, 18 Oct 2026) ================= */

/**
 * beatRev 7 (scoring targets, docs/scoring-targets.md): beatRev 6 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const BEAT_REV_TARGET = 7;
export const beatTargetGame = bandTargetGame(beatTallGame);
/** The curve new rounds score on: BEAT_V6_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const BEAT_V7_BAND_CURVE = bandRetarget(BEAT_V6_BAND_CURVE);


/* ================= Score bands (beatRev 8, 19 Oct 2026) ================= */

/**
 * beatRev 8 (score bands, docs/scoring-targets.md): beatRev 7 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const BEAT_REV_STRICT = 8;
export const beatStrictGame = bandStrictGame(beatTargetGame);
/** The curve new rounds score on: BEAT_V6_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const BEAT_V8_BAND_CURVE = bandStrict(BEAT_V6_BAND_CURVE);


/* ================= The expansion (beatRev 9, 25 Oct 2026) ================= */

/**
 * beatRev 9 (world expansion, docs/expansions/e2.md): a longer song with a fifth lane in its later
 * sections and four skill features, scored to 200 (docs/scoring-200.md). The whole chart is built once
 * from the seed (a stream of its own), so every player plays the same notes; judging stays whole-tick.
 *
 *  - The song: 75 s (was 60), in sections at 120 BPM: quarter notes, then eighths, chords and holds;
 *    from 40 s (after a one-second break with no notes) the lanes become five, and the last section is
 *    the busiest. The lanes share the same 390 px (78 px each in the five-lane part).
 *  - Fever: Perfect fills the meter by 2 half steps and Good by 1; a miss empties it. Once it is full
 *    (BEAT_FEVER_FULL, 30 Perfects' worth), a tap on the meter (the strip above the lanes, input kind
 *    12) starts 8 s of fever, in which every note hit counts again (×2): a point per 8 quarters.
 *  - Golden notes: about one plain tap in ten; hitting one dead on (on the very tick it meets the line) adds 1.
 *  - Double-tap notes: two notes in one lane 9 ticks apart; both Perfect adds 1.
 *  - Perfect streak: a point per 10 Perfects in the run's longest streak.
 *
 * Score: the chart's per mille (Perfect 4, Good 3, OK 1, a miss −2, of 4 a note; both halves of a double
 * count) on BEAT_V9_BAND_CURVE (to 150), plus the features' points, each capped (BEAT_V9_CAPS, 50 in all),
 * to 200. States add `exp: 1` and the fields above, folded into the checkpoint checksum last.
 */
export const BEAT_REV_200 = 9;
export const BEAT_V9_MAX = 200;
export const BEAT_V9_RUN_SECONDS = 75;
export const BEAT_V9_RUN_TICKS = BEAT_V9_RUN_SECONDS * TICKS_PER_SECOND;
export const BEAT_V9_LANES = 5;
/** Five lanes from here (40 s); no note within a second before it or half a beat after. */
export const BEAT_V9_FIVE_FROM = 40 * TICKS_PER_SECOND;
export const BEAT_V9_BREAK = TICKS_PER_SECOND;
export const BEAT_DOUBLE_GAP = 9;
export const BEAT_FEVER_FULL = 60;
export const BEAT_FEVER_TICKS = 8 * TICKS_PER_SECOND;
/** Fever bonus: one point per this many quarters earned in fever. */
export const BEAT_FEVER_Q_PER = 8;
/** A golden note scores when hit dead on: on the very tick it meets the line (a Perfect is within 3). */
export const BEAT_GOLD_TICKS = 0;
export const BEAT_GOLD_POINTS = 1;
/** Perfect streak: a point per this many Perfects in the run's best streak. */
export const BEAT_STREAK_PER = 10;
/** Each feature's most points, 50 in all. */
export const BEAT_V9_CAPS = { fever: 26, gold: 8, double: 8, streak: 8 } as const;

/** Fever: kind 12, a tap on the meter (the HUD strip above the lanes); it starts fever only when the meter is full. */
export const BEAT_INPUT_FEVER = 12;
export const BEAT_V9_INPUT_RANGES: readonly InputRange[] = [
  inputRange(BEAT_INPUT_FEVER, [0, 0]),
  inputRange(BEAT_INPUT_TAP, [0, BEAT_V9_LANES - 1]),
  inputRange(BEAT_INPUT_RELEASE, [0, BEAT_V9_LANES - 1]),
  inputRange(BEAT_INPUT_SWIPE, [0, BEAT_V9_LANES - 1], [0, 1]),
];

/** Lanes on screen at a tick: four, or five from BEAT_V9_FIVE_FROM on beatRev 9. */
export function beatLanesAt(state: { exp?: number }, tick: number): number {
  return state.exp && tick >= BEAT_V9_FIVE_FROM ? BEAT_V9_LANES : BEAT_LANES;
}

/** A lane's centre x for a lane count (beatLaneX is the four-lane one). */
export function beatLaneXOf(lane: number, lanes: number): number {
  const width = BEAT_WORLD_W / lanes;
  return lane * width + width / 2;
}

/** The section plan: [from tick, eighth %, chord %]. */
const V9_SECTIONS: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [14 * TICKS_PER_SECOND, 30, 0],
  [26 * TICKS_PER_SECOND, 35, 20],
  [BEAT_V9_FIVE_FROM, 25, 15],
  [56 * TICKS_PER_SECOND, 35, 25],
];

/** A chart plan: the sections and each feature's share (per cent), before and from the fifth lane. */
interface BeatChartPlan {
  sections: readonly (readonly [number, number, number])[];
  /** Double taps (from 14 s), holds (from 20 s), swipes (from 30 s): [before 40 s, from 40 s]. */
  double: readonly [number, number];
  hold: readonly [number, number];
  swipe: readonly [number, number];
  /** The OK window the chart's last note must be judged inside before the run ends. */
  ok: number;
}

const V9_PLAN: BeatChartPlan = { sections: V9_SECTIONS, double: [12, 12], hold: [15, 15], swipe: [22, 22], ok: BEAT_OK_TICKS };

/** beatRev 9's chart: sections, the fifth lane, holds, double taps, swipes and golden notes. */
function buildChartV9(seed: number, plan: BeatChartPlan = V9_PLAN): { rng: number; chart: BeatChart } {
  let rng = (seed ^ 0x54454d39) | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  type Note = { tick: number; lane: number; hold: number; swipe: number; gold: number; first: Note | null };
  const notes: Note[] = [];
  const lastInLane = [-999, -999, -999, -999, -999];
  const lastTick = BEAT_V9_RUN_TICKS - plan.ok - 2;
  const share = (pair: readonly [number, number], tick: number) => pair[tick >= BEAT_V9_FIVE_FROM ? 1 : 0];
  const quiet = (tick: number) => tick > BEAT_V9_FIVE_FROM - BEAT_V9_BREAK && tick < BEAT_V9_FIVE_FROM + BEAT_EIGHTH_TICKS;
  const lanesAt = (tick: number) => (tick >= BEAT_V9_FIVE_FROM ? BEAT_V9_LANES : BEAT_LANES);
  const add = (tick: number, lane: number): Note | null => {
    if (tick < BEAT_FIRST_BEAT || tick > lastTick || quiet(tick)) return null;
    if (tick - lastInLane[lane]! < BEAT_LANE_GAP) return null;
    const note: Note = { tick, lane, hold: 0, swipe: 0, gold: 0, first: null };
    notes.push(note);
    lastInLane[lane] = tick;
    return note;
  };
  const place = (tick: number, wanted: number, avoid: number): Note | null => {
    const lanes = lanesAt(tick);
    for (let offset = 0; offset < lanes; offset++) {
      const lane = (wanted + offset) % lanes;
      if (lane === avoid) continue;
      const note = add(tick, lane);
      if (note) return note;
    }
    return null;
  };
  for (let tick = BEAT_FIRST_BEAT; tick <= lastTick; tick += BEAT_BEAT_TICKS) {
    let section = plan.sections[0]!;
    for (const s of plan.sections) if (tick >= s[0]) section = s;
    const lanes = lanesAt(tick);
    const main = place(tick, draw(lanes), -1);
    const lane = main ? main.lane : -1;
    // A double tap: from 14 s, about one single note in eight gets a second hit 9 ticks later.
    if (main && tick >= 14 * TICKS_PER_SECOND && draw(100) < share(plan.double, tick) && tick + BEAT_DOUBLE_GAP <= lastTick && !quiet(tick + BEAT_DOUBLE_GAP)) {
      const second: Note = { tick: tick + BEAT_DOUBLE_GAP, lane, hold: 0, swipe: 0, gold: 0, first: main };
      notes.push(second);
      lastInLane[lane] = second.tick;
    }
    if (section[2] > 0 && draw(100) < section[2]) place(tick, draw(lanes), lane);
    if (section[1] > 0 && draw(100) < section[1]) place(tick + BEAT_EIGHTH_TICKS, draw(lanesAt(tick + BEAT_EIGHTH_TICKS)), lane);
  }
  notes.sort((a, b) => a.tick - b.tick || a.lane - b.lane);
  const index = new Map(notes.map((n, i) => [n, i]));
  const firsts = new Set(notes.filter((n) => n.first).map((n) => n.first!));
  const alone = (i: number) => notes[i - 1]?.tick !== notes[i]!.tick && notes[i + 1]?.tick !== notes[i]!.tick;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!;
    const plain = !n.first && !firsts.has(n);
    // Holds from 20 s (about one plain note in seven), only when the lane stays clear for the tail.
    if (plain && n.tick >= BEAT_HOLD_FROM && draw(100) < share(plan.hold, n.tick)) {
      const len = BEAT_BEAT_TICKS + draw(3) * BEAT_EIGHTH_TICKS;
      const crosses = n.tick < BEAT_V9_FIVE_FROM && n.tick + len + BEAT_LANE_GAP >= BEAT_V9_FIVE_FROM - BEAT_V9_BREAK;
      let clear = n.tick + len <= lastTick && !crosses;
      for (let j = i + 1; clear && j < notes.length && notes[j]!.tick <= n.tick + len + BEAT_LANE_GAP; j++) if (notes[j]!.lane === n.lane) clear = false;
      if (clear) n.hold = len;
    }
    // Swipes from 30 s: plain single notes alone on their tick.
    if (plain && n.hold === 0 && n.tick >= BEAT_SWIPE_FROM && alone(i) && draw(100) < share(plan.swipe, n.tick)) n.swipe = draw(2) === 0 ? BEAT_SWIPE_LEFT : BEAT_SWIPE_RIGHT;
    // Golden notes from 6 s, about one plain tap in ten (never a hold, swipe or double).
    if (plain && n.hold === 0 && n.swipe === 0 && n.tick >= 6 * TICKS_PER_SECOND && draw(10) === 0) n.gold = 1;
  }
  return {
    rng,
    chart: {
      ticks: notes.map((n) => n.tick),
      lanes: notes.map((n) => n.lane),
      holds: notes.map((n) => n.hold),
      swipes: notes.map((n) => n.swipe),
      golds: notes.map((n) => n.gold),
      pairs: notes.map((n) => (n.first ? index.get(n.first)! : -1)),
    },
  };
}

function initV9(seed: number, plan: BeatChartPlan = V9_PLAN): BeatState {
  const built = buildChartV9(seed, plan);
  const base = beatStrictGame.init(seed);
  return {
    ...base,
    rng: built.rng,
    chart: built.chart,
    judged: built.chart.ticks.map(() => BEAT_JUDGE_NONE),
    holding: [-1, -1, -1, -1, -1],
    holdStartErrors: [0, 0, 0, 0, 0],
    exp: 1,
    meter: 0,
    fever: 0,
    fevers: 0,
    feverQ: 0,
    goldsHit: 0,
    goldPts: 0,
    doublesDone: 0,
    streak: 0,
    maxStreak: 0,
  };
}

const QUARTERS = [0, BEAT_PERFECT_Q, BEAT_GOOD_Q, BEAT_OK_Q] as const;

/** beatRev 9: the shared judging, then the features read from the notes judged this tick. */
function stepV9(state: BeatState, input: ArcadeInputEvent | null): BeatState {
  const next = step(state, input);
  if (next === state) return state;
  let meter = state.meter ?? 0;
  let fever = Math.max(0, (state.fever ?? 0) - 1);
  let fevers = state.fevers ?? 0;
  let feverQ = state.feverQ ?? 0;
  let goldsHit = state.goldsHit ?? 0;
  let goldPts = state.goldPts ?? 0;
  let doublesDone = state.doublesDone ?? 0;
  let streak = state.streak ?? 0;
  let maxStreak = state.maxStreak ?? 0;
  if (next.judged !== state.judged) {
    const { golds = [], pairs = [] } = state.chart;
    for (let i = 0; i < next.judged.length; i++) {
      const was = state.judged[i]!;
      const now = next.judged[i]!;
      if (now === was || now === BEAT_JUDGE_PENDING || (was !== BEAT_JUDGE_NONE && was !== BEAT_JUDGE_PENDING)) continue;
      if (now === BEAT_JUDGE_MISS) {
        streak = 0;
        meter = 0;
        continue;
      }
      if (fever > 0) feverQ += QUARTERS[now] ?? 0;
      else meter = Math.min(BEAT_FEVER_FULL, meter + (now === BEAT_JUDGE_PERFECT ? 2 : now === BEAT_JUDGE_GOOD ? 1 : 0));
      // A golden note hit dead on (its tap within BEAT_GOLD_TICKS of the line).
      if (golds[i] && now === BEAT_JUDGE_PERFECT && Math.abs(next.tick - state.chart.ticks[i]!) <= BEAT_GOLD_TICKS) {
        goldsHit += 1;
        goldPts += BEAT_GOLD_POINTS;
      }
      const first = pairs[i] ?? -1;
      // A double tap counts when both its hits are Perfect.
      if (first >= 0 && now === BEAT_JUDGE_PERFECT && next.judged[first] === BEAT_JUDGE_PERFECT) doublesDone += 1;
      if (now === BEAT_JUDGE_PERFECT) {
        streak += 1;
        maxStreak = Math.max(maxStreak, streak);
      } else streak = 0;
    }
  }
  // FEVER! is the player's call: a tap on the meter (the strip above the lanes) once it is full.
  if (input && input.k === BEAT_INPUT_FEVER && fever === 0 && meter >= BEAT_FEVER_FULL) {
    meter = 0;
    fever = BEAT_FEVER_TICKS;
    fevers += 1;
  }
  return { ...next, meter, fever, fevers, feverQ, goldsHit, goldPts, doublesDone, streak, maxStreak };
}

/**
 * beatRev 9's skill pay (retune, 26 Oct 2026; the stamp was not yet live): the features' own points (each capped,
 * BEAT_V9_CAPS, 50 in all) paid on a rising scale, never more than the points themselves: a good player's ~20 pay 7,
 * a great one's ~40 pay 26, and the full 50 only with every feature maxed. Fitted on the skill-band runs
 * (docs/expansions/e2.md, both seed sets).
 */
export const BEAT_V9_SKILL_PAY = bandCurve([0, 20, 40, 45, 48, 50], [0, 7, 26, 40, 44, 50]);

/** beatRev 9's feature points, each capped (BEAT_V9_CAPS); `total` their sum, `paid` what the score adds (BEAT_V9_SKILL_PAY). */
export function beatV9Bonus(state: BeatState): { fever: number; gold: number; double: number; streak: number; total: number; paid: number } {
  const fever = Math.min(BEAT_V9_CAPS.fever, Math.trunc((state.feverQ ?? 0) / BEAT_FEVER_Q_PER));
  const gold = Math.min(BEAT_V9_CAPS.gold, state.goldPts ?? 0);
  const double = Math.min(BEAT_V9_CAPS.double, state.doublesDone ?? 0);
  const streak = Math.min(BEAT_V9_CAPS.streak, Math.trunc((state.maxStreak ?? 0) / BEAT_STREAK_PER));
  const total = fever + gold + double + streak;
  return { fever, gold, double, streak, total, paid: bandPoints(BEAT_V9_SKILL_PAY, total) };
}

/**
 * beatRev 9 band knots: per mille of the chart, fitted so the simulated players who ignore the features
 * land where they did on beatRev 8 (scripts/expansions-e2-bands.ts); every note Perfect is 150. The retune
 * (26 Oct 2026) added the 994 knot, so a run a few notes short of all Perfect stays clear of an all-Perfect one.
 */
export const BEAT_V9_BAND_CURVE = bandCurve([0, 580, 790, 925, 985, 994, 1000], [0, 68, 96, 112, 126, 131, 150]);

export function beatV9Parts(state: BeatState): BandParts {
  const quarters = Math.max(0, BEAT_PERFECT_Q * state.perfect + BEAT_GOOD_Q * state.good + BEAT_OK_Q * state.ok - 2 * state.misses);
  const units = Math.floor((1000 * quarters) / Math.max(1, BEAT_PERFECT_Q * beatNoteCount(state)));
  const b = beatV9Bonus(state);
  const bits = [b.fever && `fever ${b.fever}`, b.gold && `golden ${b.gold}`, b.double && `doubles ${b.double}`, b.streak && `streaks ${b.streak}`].filter(Boolean);
  return { units, points: bandPoints(BEAT_V9_BAND_CURVE, units), bonus: b.paid, penalty: 0, finished: false, text: `${state.perfect} perfect · ${state.good} good · ${state.ok} OK · ${state.misses} missed`, bonusText: `Skill ${b.total} of 50 (${bits.join(" · ") || "none"})` };
}

export const beatV9Game: ArcadeGame<BeatState, ArcadeInputEvent | null> = {
  ...beatGame,
  runTicks: BEAT_V9_RUN_TICKS,
  init: initV9,
  step: bandStep(stepV9),
  score: (state) => bandTotal(beatV9Parts(state), Boolean(state.acted), BEAT_V9_MAX),
  inputRanges: BEAT_V9_INPUT_RANGES,
};

/* ================= Phone notes: an easier Tempo (beatRev 10, 27 Oct 2026) ================= */

/**
 * beatRev 10 (Joe's phone notes, 27 Oct 2026: "about 20 % easier, especially once the 5th lane arrives;
 * scores should rise accordingly"): beatRev 9's song, features, curve and skill pay, with
 *  - wider hit windows, 4 / 8 / 13 ticks either side of the line (were 3 / 7 / 12): Perfect ±67 ms
 *    (was ±50), Good ±133 ms, OK ±217 ms; a hold's release uses the same Perfect and Good. A golden note
 *    still needs the very tick (BEAT_GOLD_TICKS);
 *  - a lighter chart (built on beatRev 9's stream, so as many draws in the same order): eighths 25 % and
 *    chords none from 14 s, eighths 30 % and chords 15 % from 26 s (were 30 / 0 and 35 / 20); then the five
 *    lanes ease in: quarter notes alone from 40 s to 44 s, eighths 15 % and chords 8 % to 56 s (were 25 / 15
 *    from 40 s), and 25 / 15 in the last section (were 35 / 25); double taps 10 % before the fifth lane and
 *    6 % after (were 12), holds 15 % then 10 % (were 15), swipes 22 % then 14 % (were 22).
 * Scores rise for the same play (the base curve and skill pay are beatRev 9's: every note Perfect plus every
 * feature maxed is still 200). States add `ease: 1`, folded into the checkpoint checksum last.
 */
export const BEAT_REV_EASE = 10;
export const BEAT_V10_WINDOWS: BeatWindows = { perfect: 4, good: 8, ok: 13 };
const V10_PLAN: BeatChartPlan = {
  sections: [
    [0, 0, 0],
    [14 * TICKS_PER_SECOND, 25, 0],
    [26 * TICKS_PER_SECOND, 30, 15],
    [BEAT_V9_FIVE_FROM, 0, 0],
    [44 * TICKS_PER_SECOND, 15, 8],
    [56 * TICKS_PER_SECOND, 25, 15],
  ],
  double: [12, 12],
  hold: [15, 10],
  swipe: [22, 14],
  ok: BEAT_V10_WINDOWS.ok,
};
/** beatRev 10 scores on beatRev 9's base curve: the same play lands more of the chart, so its score rises. */
export const BEAT_V10_BAND_CURVE = BEAT_V9_BAND_CURVE;

export const beatV10Game: ArcadeGame<BeatState, ArcadeInputEvent | null> = {
  ...beatV9Game,
  init: (seed) => ({ ...initV9(seed, V10_PLAN), ease: 1 }),
};

/* ================= The arcade scoring standard (beatRev 11, 29 Oct 2026) ================= */

/**
 * beatRev 11 (the arcade scoring standard, docs/arcade-standard/beat.md): beatRev 10's song, chart, windows and
 * features exactly (the same notes, judging, fever meter, golden notes, double taps and streaks), scored on the
 * standard (arcadeStandard.ts), with no curve, knots or rising scale:
 *  - Accuracy up to 130: the chart's per mille (Perfect 4, Good 3, OK 1, a missed note −2, of 4 a note, never
 *    below 0) on a straight line, full at 1,000 (every note Perfect);
 *  - Fever up to 25: a share of 25 for each fever started, full at 4 (6, 12, 18, 25). Fever no longer counts
 *    notes again (no ×2): it is its own fixed part;
 *  - Golden notes up to 15: the share of the chart's golden notes hit dead on;
 *  - Double taps up to 15: the share of the chart's double taps with both hits Perfect;
 *  - Perfect streak up to 15: the longest run of Perfects as a share of the chart's notes (full for every note
 *    Perfect in one streak).
 * Earning a feature never costs accuracy: the parts only read the judgements the shared step makes. States add
 * `std: 1`, folded into the checkpoint checksum last.
 */
export const BEAT_REV_STD = 11;
/** Accuracy (per mille of the chart) at which the core is full: fixed by Joe at 1,000. */
export const BEAT_V11_ACC_FULL = 1000;
export const BEAT_V11_CORE_MAX = 130;
/** Fever is full at this many fevers started (a flawless run starts 4 in the 75 s song). */
export const BEAT_V11_FEVERS_FULL = 4;
export const BEAT_V11_MAX = { core: BEAT_V11_CORE_MAX, fever: 25, gold: 15, double: 15, streak: 15 } as const;
/** The core's straight line (per mille → points), for the help and arcade-help-bands-check. */
export const BEAT_V11_BAND_CURVE = bandCurve([0, BEAT_V11_ACC_FULL], [0, BEAT_V11_CORE_MAX]);

export const BEAT_STD_SPEC: StdSpec = {
  field: "beatRev",
  rev: BEAT_REV_STD,
  parts: [
    { key: "core", label: "Accuracy", max: BEAT_V11_MAX.core, how: "Perfect 4, Good 3, OK 1 and a missed note −2, of 4 a note, in thousandths of the song; full at 1,000, every note Perfect" },
    { key: "fever", label: "Fever", max: BEAT_V11_MAX.fever, how: "for each fever you start, full at 4 fevers" },
    { key: "gold", label: "Golden notes", max: BEAT_V11_MAX.gold, how: "the share of the song's golden notes hit dead on" },
    { key: "double", label: "Double taps", max: BEAT_V11_MAX.double, how: "the share of the song's double taps with both hits Perfect" },
    { key: "streak", label: "Perfect streak", max: BEAT_V11_MAX.streak, how: "your longest run of Perfects as a share of the song's notes" },
  ],
};

/** The chart's per mille: Perfect 4, Good 3, OK 1, a miss −2 (floor 0), over 4 × notes. */
export function beatAccuracy(state: BeatState): number {
  const quarters = Math.max(0, BEAT_PERFECT_Q * state.perfect + BEAT_GOOD_Q * state.good + BEAT_OK_Q * state.ok - 2 * state.misses);
  return Math.floor((1000 * quarters) / Math.max(1, BEAT_PERFECT_Q * beatNoteCount(state)));
}

/** Golden notes and double taps in the chart (both fixed at init from the seed). */
export function beatFeatureCounts(state: BeatState): { golds: number; doubles: number } {
  let golds = 0;
  let doubles = 0;
  for (const g of state.chart.golds ?? []) if (g) golds += 1;
  for (const p of state.chart.pairs ?? []) if (p >= 0) doubles += 1;
  return { golds, doubles };
}

/** beatRev 11's parts (core first), or null for a state not on the standard. */
export function beatStdParts(state: BeatState): StdPart[] | null {
  if (!state.std) return null;
  const acc = beatAccuracy(state);
  const { golds, doubles } = beatFeatureCounts(state);
  const notes = beatNoteCount(state);
  const fevers = state.fevers ?? 0;
  const goldsHit = state.goldsHit ?? 0;
  const done = state.doublesDone ?? 0;
  const streak = state.maxStreak ?? 0;
  return [
    stdPart(BEAT_STD_SPEC, "core", stdLinear(acc, BEAT_V11_ACC_FULL, BEAT_V11_MAX.core), `${acc} of 1,000`),
    stdPart(BEAT_STD_SPEC, "fever", stdShare(Math.min(fevers, BEAT_V11_FEVERS_FULL), BEAT_V11_FEVERS_FULL, BEAT_V11_MAX.fever), `${fevers} fever${fevers === 1 ? "" : "s"}`),
    stdPart(BEAT_STD_SPEC, "gold", stdShare(goldsHit, golds, BEAT_V11_MAX.gold), `${goldsHit} of ${golds}`),
    stdPart(BEAT_STD_SPEC, "double", stdShare(done, doubles, BEAT_V11_MAX.double), `${done} of ${doubles}`),
    stdPart(BEAT_STD_SPEC, "streak", stdShare(streak, notes, BEAT_V11_MAX.streak), `${streak} of ${notes} notes`),
  ];
}

/** The features' points on beatRev 11 (what the HUD's "+n" shows); 0 off the standard. */
export function beatStdBonus(state: BeatState): number {
  const parts = beatStdParts(state);
  if (!parts) return 0;
  let total = 0;
  for (const p of parts) if (p.key !== "core") total += p.points;
  return total;
}

/** beatRev 11 for the skill-band tool: units = the chart's per mille, points = accuracy, bonus = the features. */
export function beatV11Parts(state: BeatState): BandParts {
  const parts = beatStdParts(state) ?? [];
  return {
    units: beatAccuracy(state),
    points: parts[0]?.points ?? 0,
    bonus: beatStdBonus(state),
    penalty: 0,
    finished: false,
    text: `${state.perfect} perfect · ${state.good} good · ${state.ok} OK · ${state.misses} missed`,
    bonusText: parts.slice(1).map((p) => `${p.label} ${p.points}`).join(" · "),
  };
}

export const beatV11Game: ArcadeGame<BeatState, ArcadeInputEvent | null> = {
  ...beatV10Game,
  init: (seed) => ({ ...beatV10Game.init(seed), std: 1 }),
  score: (state) => stdScore(beatStdParts(state) ?? [], Boolean(state.acted)),
};
