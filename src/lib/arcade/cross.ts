/**
 * Cross — an arcade game on the shared engine.
 *
 * Nine lanes of traffic between a start kerb and a goal kerb. Every crossing's
 * course (lane directions, speeds, block widths and spacings) is generated in
 * full at init and proved crossable by a search over lane, column and tick, so
 * everyone drives through the identical traffic. All sim values are integers in
 * 1/256-pixel units and no randomness is drawn during play.
 */

import {
  clampInt,
  inputRange,
  px,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";

/* ============================== Constants ============================== */

export const CROSS_WORLD_W = 390;
export const CROSS_WORLD_H = 580;

export const CROSS_RUN_SECONDS = 60;
export const CROSS_RUN_TICKS = CROSS_RUN_SECONDS * TICKS_PER_SECOND;

export const CROSS_LANES = 9;
export const CROSS_LANE_H = 52;
export const CROSS_COLS = 7;
export const CROSS_COL_W = 52;
export const CROSS_BOARD_W = CROSS_COLS * CROSS_COL_W;
export const CROSS_BOARD_X = (CROSS_WORLD_W - CROSS_BOARD_W) / 2;

export const CROSS_HUD_H = 36;
export const CROSS_KERB_H = 34;
/** Top of the first (topmost) lane. */
export const CROSS_LANES_Y = CROSS_HUD_H + CROSS_KERB_H;

/** The player: a gold disc, 16 px across the half-width. */
export const CROSS_PLAYER_R = 16;
export const CROSS_PLAYER_HALF_FP = 4_096;

/** A hop takes six ticks and moves one lane up. */
export const CROSS_HOP_TICKS = 6;

/** How many crossings are laid out at init; later crossings reuse the last. */
export const CROSS_COURSES = 10;
/** Each crossing runs 10% faster than the one before. */
export const CROSS_SPEED_MIN_FP = 96;
export const CROSS_SPEED_SPAN_FP = 120;
export const CROSS_BLOCK_MIN_FP = 16_384;
export const CROSS_BLOCK_SPAN_FP = 14_336;
export const CROSS_GAP_MIN_FP = 28_672;
export const CROSS_GAP_SPAN_FP = 23_040;

export const CROSS_CROSSING_POINTS = 15;
export const CROSS_LANE_POINTS = 1;
export const CROSS_POINTS_CAP = 110;
export const CROSS_SURVIVE_BONUS = 40;

/** A move: a = 0 up, 1 down, 2 left, 3 right — each from a swipe. */
export const CROSS_INPUT_MOVE = 5;
export const CROSS_INPUT_RANGES: readonly InputRange[] = [inputRange(CROSS_INPUT_MOVE, [0, 3])];

/** Swipes shorter than this, in screen pixels, are not a move. */
export const CROSS_SWIPE_PX = 24;

/** The breather on the kerb between one crossing and the next. */
export const CROSS_PAUSE_TICKS = TICKS_PER_SECOND;

/* ============================== Course ================================= */

export interface CrossLane {
  /** +1 moves right, −1 moves left. */
  dir: number;
  /** Fixed-point units a tick. */
  speed: number;
  blockW: number;
  period: number;
  phase: number;
}

export interface CrossCourse {
  lanes: CrossLane[];
}

function mod(value: number, m: number): number {
  const r = value % m;
  return r < 0 ? r + m : r;
}

/** True when the player's disc at this column centre touches a block. */
export function crossBlocked(lane: CrossLane, centreFp: number, rel: number): boolean {
  const left = centreFp - CROSS_PLAYER_HALF_FP;
  const span = CROSS_PLAYER_HALF_FP * 2;
  const u = mod(left - lane.dir * lane.speed * rel - lane.phase, lane.period);
  return u < lane.blockW || u + span > lane.period;
}

export function crossColumnCentreFp(col: number): number {
  return (CROSS_BOARD_X + col * CROSS_COL_W + CROSS_COL_W / 2) * 256;
}

/** The search horizon used when proving a crossing is passable. */
export const CROSS_SEARCH_TICKS = 900;

/**
 * A breadth-first search over (lane, column, hop progress, tick). A crossing is
 * only accepted when the goal kerb can be reached from the start kerb.
 */
export function crossPassable(course: CrossCourse): boolean {
  // Key: (lane * columns + column) * 7 + ticks left in the hop.
  const key = (lane: number, col: number, hop: number) => (lane * CROSS_COLS + col) * 7 + hop;
  let frontier = new Set<number>([key(0, CROSS_COLS >> 1, 0)]);
  for (let rel = 1; rel <= CROSS_SEARCH_TICKS && frontier.size > 0; rel++) {
    const next = new Set<number>();
    let arrived = false;
    const consider = (lane: number, col: number, hop: number) => {
      if (lane > CROSS_LANES) {
        arrived = true;
        return;
      }
      if (hop === 0 && lane >= 1) {
        const laneDef = course.lanes[lane - 1];
        if (laneDef && crossBlocked(laneDef, crossColumnCentreFp(col), rel)) return;
      }
      next.add(key(lane, col, hop));
    };
    for (const id of frontier) {
      const hop = id % 7;
      const rest = Math.trunc(id / 7);
      const col = rest % CROSS_COLS;
      const lane = Math.trunc(rest / CROSS_COLS);
      if (hop > 0) {
        const left = hop - 1;
        if (left === 0) consider(lane + 1, col, 0);
        else consider(lane, col, left);
        continue;
      }
      consider(lane, col, 0);
      if (col > 0) consider(lane, col - 1, 0);
      if (col < CROSS_COLS - 1) consider(lane, col + 1, 0);
      consider(lane, col, CROSS_HOP_TICKS);
    }
    if (arrived) return true;
    frontier = next;
  }
  return false;
}

function rollCourse(rng: number, index: number): { rng: number; course: CrossCourse } {
  let state = rng;
  for (let attempt = 0; attempt < 40; attempt++) {
    const lanes: CrossLane[] = [];
    for (let lane = 0; lane < CROSS_LANES; lane++) {
      const d = rngBelow(state, 2);
      state = d.state;
      const s = rngBelow(state, CROSS_SPEED_SPAN_FP);
      state = s.state;
      const w = rngBelow(state, CROSS_BLOCK_SPAN_FP);
      state = w.state;
      const g = rngBelow(state, CROSS_GAP_SPAN_FP);
      state = g.state;
      const blockW = CROSS_BLOCK_MIN_FP + w.value;
      const gap = CROSS_GAP_MIN_FP + g.value;
      let speed = CROSS_SPEED_MIN_FP + s.value;
      for (let step = 0; step < index; step++) speed = Math.trunc((speed * 11) / 10);
      const period = blockW + gap;
      const p = rngBelow(state, period);
      state = p.state;
      lanes.push({
        dir: d.value === 0 ? 1 : -1,
        speed,
        blockW,
        period,
        phase: p.value,
      });
    }
    const course = { lanes };
    if (crossPassable(course)) return { rng: state, course };
  }
  // A last-resort course with wide gaps; still deterministic.
  const lanes: CrossLane[] = [];
  for (let lane = 0; lane < CROSS_LANES; lane++) {
    lanes.push({
      dir: lane % 2 === 0 ? 1 : -1,
      speed: CROSS_SPEED_MIN_FP,
      blockW: CROSS_BLOCK_MIN_FP,
      period: CROSS_BLOCK_MIN_FP + CROSS_GAP_MIN_FP + CROSS_GAP_SPAN_FP,
      phase: lane * 4_096,
    });
  }
  return { rng: state, course: { lanes } };
}

/* ================================ State ================================ */

export interface CrossState {
  tick: number;
  rng: number;
  courses: CrossCourse[];
  /** Crossings completed. */
  crossings: number;
  /** 0 = start kerb, 1…9 = lanes, 10 = goal kerb. */
  lane: number;
  col: number;
  /** Ticks left in the hop; 0 means standing. */
  hop: number;
  /** Which way the hop under way is going: +1 forward, −1 back. */
  hopDir: number;
  /** The highest lane reached in the crossing under way. */
  reached: number;
  /** The tick the current crossing began, so traffic is timed from it. */
  crossStart: number;
  /** While the tick is at or below this, the disc waits on the kerb. */
  pauseUntil: number;
  dead: boolean;
  endedTick: number;
}

function init(seed: number): CrossState {
  let rng = seed | 0;
  const courses: CrossCourse[] = [];
  for (let index = 0; index < CROSS_COURSES; index++) {
    const rolled = rollCourse(rng, index);
    rng = rolled.rng;
    courses.push(rolled.course);
  }
  return {
    tick: 0,
    rng,
    courses,
    crossings: 0,
    lane: 0,
    col: CROSS_COLS >> 1,
    hop: 0,
    hopDir: 1,
    reached: 0,
    crossStart: 0,
    pauseUntil: 0,
    dead: false,
    endedTick: 0,
  };
}

/** True while the disc is parked on the kerb between crossings. */
export function crossPaused(state: CrossState): boolean {
  return state.tick < state.pauseUntil;
}

export function crossCourse(state: CrossState): CrossCourse {
  const index = Math.min(state.crossings, CROSS_COURSES - 1);
  return state.courses[index] ?? { lanes: [] };
}

function isOver(state: CrossState): boolean {
  return state.dead || state.tick >= CROSS_RUN_TICKS;
}

export function crossSurvived(state: CrossState): boolean {
  return !state.dead && state.tick >= CROSS_RUN_TICKS;
}

function step(state: CrossState, input: ArcadeInputEvent | null): CrossState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  let { lane, col, hop, hopDir, reached, crossings, crossStart, pauseUntil } = state;
  // Everything sent while the disc waits on the kerb is dropped, so a swipe at
  // the end of one crossing can never carry into the next.
  const paused = tick < pauseUntil;

  if (!paused && hop === 0 && input && input.k === CROSS_INPUT_MOVE) {
    const move = clampInt(input.a, 0, 3);
    if (move === 0) {
      hop = CROSS_HOP_TICKS;
      hopDir = 1;
    } else if (move === 1) {
      if (lane > 0) {
        hop = CROSS_HOP_TICKS;
        hopDir = -1;
      }
    } else if (move === 2) col = Math.max(0, col - 1);
    else col = Math.min(CROSS_COLS - 1, col + 1);
  }

  if (hop > 0) {
    hop -= 1;
    if (hop === 0) {
      lane += hopDir;
      if (lane < 0) lane = 0;
      if (lane > reached) reached = lane;
      if (lane > CROSS_LANES) {
        // The goal kerb: bank the crossing, then a second on the start kerb
        // while the traffic of the next crossing keeps rolling.
        crossings += 1;
        lane = 0;
        col = CROSS_COLS >> 1;
        reached = 0;
        hopDir = 1;
        pauseUntil = tick + CROSS_PAUSE_TICKS;
        crossStart = pauseUntil;
      }
    }
  }

  if (hop === 0 && lane >= 1 && lane <= CROSS_LANES) {
    const course = crossCourse({ ...state, crossings });
    const laneDef = course.lanes[lane - 1];
    if (laneDef && crossBlocked(laneDef, crossColumnCentreFp(col), tick - crossStart)) {
      return {
        ...state,
        tick,
        lane,
        col,
        hop,
        hopDir,
        reached,
        crossings,
        crossStart,
        pauseUntil,
        dead: true,
        endedTick: tick,
      };
    }
  }

  const next: CrossState = {
    ...state,
    tick,
    lane,
    col,
    hop,
    hopDir,
    reached,
    crossings,
    crossStart,
    pauseUntil,
  };
  if (tick >= CROSS_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

function score(state: CrossState): number {
  const earned = Math.min(
    CROSS_POINTS_CAP,
    CROSS_CROSSING_POINTS * state.crossings + CROSS_LANE_POINTS * state.reached,
  );
  return clampInt(earned + (crossSurvived(state) ? CROSS_SURVIVE_BONUS : 0), 0, 150);
}

/* =========================== Integrity checks ========================== */

export const CROSS_CHECKPOINT_INTERVAL = 300;

export interface CrossCheckpointState {
  tick: number;
  crossings: number;
  lane: number;
  col: number;
  hop: number;
  reached: number;
  crossStart: number;
  laneSpeed: number;
}

export interface CrossCheckpoint extends CrossCheckpointState {
  checksum: number;
}

export function crossCheckpointState(state: CrossState): CrossCheckpointState {
  const course = crossCourse(state);
  return {
    tick: state.tick,
    crossings: state.crossings,
    lane: state.lane,
    col: state.col,
    hop: state.hop,
    reached: state.reached,
    crossStart: state.crossStart,
    laneSpeed: course.lanes[0]?.speed ?? 0,
  };
}

/** 32-bit FNV-1a over the integer snapshot. */
export function crossCheckpoint(state: CrossState): CrossCheckpoint {
  const snapshot = crossCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* ================================ Drawing ============================== */

export const CROSS_BG = "#0B0B0F";
export const CROSS_PLAYER = "#F5B82E";
export const CROSS_KERB = "#25252E";
export const CROSS_GOAL = "#2ED3B7";
export const CROSS_BLOCK = "#4F9CF9";

/** Top of a lane row on screen; lane 1 is the bottom lane. */
export function crossLaneTop(lane: number): number {
  return CROSS_LANES_Y + (CROSS_LANES - lane) * CROSS_LANE_H;
}

/** The centre y of a lane, the start kerb (0) or the goal kerb (10). */
export function crossLaneCentre(lane: number): number {
  if (lane <= 0) return CROSS_LANES_Y + CROSS_LANES * CROSS_LANE_H + CROSS_KERB_H / 2;
  if (lane > CROSS_LANES) return CROSS_HUD_H + CROSS_KERB_H / 2;
  return crossLaneTop(lane) + CROSS_LANE_H / 2;
}

function draw(ctx: CanvasRenderingContext2D, state: CrossState, size: CanvasSize): void {
  const scale = Math.min(size.width / CROSS_WORLD_W, size.height / CROSS_WORLD_H);
  const offsetX = (size.width - CROSS_WORLD_W * scale) / 2;
  const offsetY = (size.height - CROSS_WORLD_H * scale) / 2;
  const rel = state.tick - state.crossStart;
  const course = crossCourse(state);

  ctx.save();
  ctx.fillStyle = CROSS_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Kerbs.
  ctx.fillStyle = CROSS_GOAL;
  ctx.fillRect(CROSS_BOARD_X, CROSS_HUD_H, CROSS_BOARD_W, CROSS_KERB_H);
  ctx.fillStyle = CROSS_KERB;
  ctx.fillRect(
    CROSS_BOARD_X,
    CROSS_LANES_Y + CROSS_LANES * CROSS_LANE_H,
    CROSS_BOARD_W,
    CROSS_KERB_H,
  );

  for (let lane = 1; lane <= CROSS_LANES; lane++) {
    const top = crossLaneTop(lane);
    ctx.fillStyle = lane % 2 === 0 ? "#131319" : "#0F0F15";
    ctx.fillRect(CROSS_BOARD_X, top, CROSS_BOARD_W, CROSS_LANE_H);
    const laneDef = course.lanes[lane - 1];
    if (!laneDef) continue;
    const start = mod(laneDef.dir * laneDef.speed * rel + laneDef.phase, laneDef.period);
    const count = Math.ceil((CROSS_BOARD_W * 256) / laneDef.period) + 2;
    ctx.fillStyle = CROSS_BLOCK;
    for (let index = -1; index <= count; index++) {
      const x = px(start + index * laneDef.period);
      ctx.fillRect(x, top + 6, px(laneDef.blockW), CROSS_LANE_H - 12);
    }
  }

  // The board edges mask the traffic beyond the crossing.
  ctx.fillStyle = CROSS_BG;
  ctx.fillRect(0, CROSS_HUD_H, CROSS_BOARD_X, CROSS_WORLD_H - CROSS_HUD_H);
  ctx.fillRect(
    CROSS_BOARD_X + CROSS_BOARD_W,
    CROSS_HUD_H,
    CROSS_WORLD_W - CROSS_BOARD_X - CROSS_BOARD_W,
    CROSS_WORLD_H - CROSS_HUD_H,
  );

  const from = crossLaneCentre(state.lane);
  const to = crossLaneCentre(state.lane + 1);
  const done = state.hop > 0 ? (CROSS_HOP_TICKS - state.hop) / CROSS_HOP_TICKS : 0;
  const cy = state.hop > 0 ? from + (to - from) * done : from;
  ctx.fillStyle = CROSS_PLAYER;
  ctx.beginPath();
  ctx.arc(px(crossColumnCentreFp(state.col)), cy, CROSS_PLAYER_R, 0, Math.PI * 2);
  ctx.fill();

  const remaining = Math.max(0, CROSS_RUN_TICKS - state.tick) / TICKS_PER_SECOND;
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Crossings ${state.crossings}`, 14, 10);
  ctx.textAlign = "right";
  ctx.fillText(`${remaining.toFixed(1)}s`, CROSS_WORLD_W - 14, 10);

  if (state.dead) {
    ctx.fillStyle = "rgba(255, 77, 77, 0.22)";
    ctx.fillRect(0, 0, CROSS_WORLD_W, CROSS_WORLD_H);
  }

  ctx.restore();
}

export const crossGame: ArcadeGame<CrossState, ArcadeInputEvent | null> = {
  key: "cross",
  runTicks: CROSS_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: CROSS_INPUT_RANGES,
};
