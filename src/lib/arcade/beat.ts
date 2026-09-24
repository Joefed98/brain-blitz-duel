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

/* ============================== Constants ============================== */

export const BEAT_WORLD_W = 390;
export const BEAT_WORLD_H = 620;
export const BEAT_HUD_H = 44;

export const BEAT_RUN_SECONDS = 60;
export const BEAT_RUN_TICKS = BEAT_RUN_SECONDS * TICKS_PER_SECOND;

/** A lane tap: kind 9, `a` = lane 0…3. */
export const BEAT_INPUT_TAP = 9;

export const BEAT_LANES = 4;
export const BEAT_HIT_LINE_Y = BEAT_WORLD_H - 100;
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

export const BEAT_INPUT_RANGES: readonly InputRange[] = [
  inputRange(BEAT_INPUT_TAP, [0, BEAT_LANES - 1]),
];

/* ================================ Chart ================================ */

export interface BeatChart {
  ticks: number[];
  lanes: number[];
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
  return {
    rng,
    chart: {
      ticks: order.map((index) => ticks[index]!),
      lanes: order.map((index) => lanes[index]!),
    },
  };
}

/* ================================ State ================================ */

export interface BeatState {
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
    lastJudge: BEAT_JUDGE_NONE,
    lastLane: -1,
    judgeAge: 0,
  };
}

function isOver(state: BeatState): boolean {
  return state.tick >= BEAT_RUN_TICKS;
}

export function beatNoteCount(state: BeatState): number {
  return state.chart.ticks.length;
}

export function beatJudgedCount(state: BeatState): number {
  return state.perfect + state.good + state.ok;
}

/** Judgement for a tick distance, or a miss when it is outside every window. */
export function beatJudge(distance: number): number {
  if (distance <= BEAT_PERFECT_TICKS) return BEAT_JUDGE_PERFECT;
  if (distance <= BEAT_GOOD_TICKS) return BEAT_JUDGE_GOOD;
  if (distance <= BEAT_OK_TICKS) return BEAT_JUDGE_OK;
  return BEAT_JUDGE_MISS;
}

function step(state: BeatState, input: ArcadeInputEvent | null): BeatState {
  if (isOver(state)) return state;
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
  while (cursor < ticks.length && ticks[cursor]! + BEAT_OK_TICKS < tick) {
    if (state.judged[cursor] === BEAT_JUDGE_NONE) {
      judged ??= [...state.judged];
      judged[cursor] = BEAT_JUDGE_MISS;
      next.misses += 1;
      next.combo = 0;
    }
    cursor += 1;
  }
  next.cursor = cursor;

  if (input && input.k === BEAT_INPUT_TAP) {
    const lane = clampInt(input.a, 0, BEAT_LANES - 1);
    let bestIndex = -1;
    let bestDistance = BEAT_OK_TICKS + 1;
    for (
      let index = cursor;
      index < ticks.length && ticks[index]! - tick <= BEAT_OK_TICKS;
      index++
    ) {
      if (state.chart.lanes[index] !== lane) continue;
      if ((judged ?? state.judged)[index] !== BEAT_JUDGE_NONE) continue;
      const distance = Math.abs(ticks[index]! - tick);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0) {
      const verdict = beatJudge(bestDistance);
      judged ??= [...state.judged];
      judged[bestIndex] = verdict;
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
      next.lastJudge = verdict;
      next.lastLane = lane;
      next.judgeAge = 0;
    } else {
      // A tap with no note anywhere near it costs nothing.
      next.strays += 1;
    }
  }

  if (judged) next.judged = judged;
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
  };
}

export function beatCheckpoint(state: BeatState): BeatCheckpoint {
  const snapshot = beatCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
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
  const scale = Math.min(size.width / BEAT_WORLD_W, size.height / BEAT_WORLD_H);
  const offsetX = (size.width - BEAT_WORLD_W * scale) / 2;
  const offsetY = (size.height - BEAT_WORLD_H * scale) / 2;
  const laneW = BEAT_WORLD_W / BEAT_LANES;

  ctx.save();
  ctx.fillStyle = BEAT_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  for (let lane = 0; lane < BEAT_LANES; lane++) {
    ctx.fillStyle = lane % 2 === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)";
    ctx.fillRect(lane * laneW, BEAT_HUD_H, laneW, BEAT_WORLD_H - BEAT_HUD_H);
  }

  ctx.strokeStyle = BEAT_GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, BEAT_HIT_LINE_Y);
  ctx.lineTo(BEAT_WORLD_W, BEAT_HIT_LINE_Y);
  ctx.stroke();

  const travel = BEAT_HIT_LINE_Y - BEAT_HUD_H;
  for (let index = 0; index < state.chart.ticks.length; index++) {
    if (state.judged[index] !== BEAT_JUDGE_NONE) continue;
    const hitTick = state.chart.ticks[index]!;
    const remaining = hitTick - state.tick;
    if (remaining > BEAT_FALL_TICKS || remaining < -BEAT_OK_TICKS) continue;
    const progress = (BEAT_FALL_TICKS - remaining) / BEAT_FALL_TICKS;
    const lane = state.chart.lanes[index]!;
    const y = BEAT_HUD_H + travel * progress;
    ctx.fillStyle = BEAT_LANE_COLOURS[lane % BEAT_LANE_COLOURS.length]!;
    ctx.fillRect(lane * laneW + 10, y - BEAT_NOTE_H / 2, laneW - 20, BEAT_NOTE_H);
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
  const left = Math.max(0, BEAT_RUN_TICKS - state.tick);
  ctx.fillText(`${Math.ceil(left / TICKS_PER_SECOND)}s`, BEAT_WORLD_W - 14, BEAT_HUD_H / 2);
  ctx.restore();
}

export const beatGame: ArcadeGame<BeatState, ArcadeInputEvent | null> = {
  key: "beat",
  runTicks: BEAT_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: BEAT_INPUT_RANGES,
};
