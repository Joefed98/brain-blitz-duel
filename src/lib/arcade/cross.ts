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

/** Par: six full crossings. */
/** 4 per lane advanced, +4 per completed crossing (a full crossing = 40). */
export const CROSS_LANE_POINTS = 4;
export const CROSS_CROSSING_POINTS = 4;
/** Bonus for a crossing finished without being hit on any lane. */
export const CROSS_CLEAN_POINTS = 8;
export const CROSS_LIVES = 3;

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
  /** Lives left, clean crossings banked, and whether this crossing has been hit. */
  lives: number;
  clean: number;
  hitThisCrossing: boolean;
  /** After a respawn the disc ignores traffic until its cell is first clear. */
  ghost: boolean;
  /** Render only: the tick of the last hit. */
  hitTick: number;
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
    lives: CROSS_LIVES,
    clean: 0,
    hitThisCrossing: false,
    ghost: false,
    hitTick: -1000,
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
  let { lane, col, hop, hopDir, reached, crossings, crossStart, pauseUntil, clean, hitThisCrossing, ghost } = state;
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
        if (!hitThisCrossing) clean += 1;
        hitThisCrossing = false;
        ghost = false;
        lane = 0;
        col = CROSS_COLS >> 1;
        reached = 0;
        hopDir = 1;
        pauseUntil = tick + CROSS_PAUSE_TICKS;
        crossStart = pauseUntil;
      }
    }
  }

  if (!paused && hop === 0 && lane >= 1 && lane <= CROSS_LANES) {
    const course = crossCourse({ ...state, crossings });
    const laneDef = course.lanes[lane - 1];
    const blocked = !!laneDef && crossBlocked(laneDef, crossColumnCentreFp(col), tick - crossStart);
    if (ghost && !blocked) ghost = false;
    if (blocked && !ghost) {
      const lives = state.lives - 1;
      const base = { ...state, tick, lane, hop: 0, hopDir: 1, reached, crossings, crossStart, clean, lives, hitTick: tick };
      if (lives <= 0) return { ...base, col, pauseUntil, hitThisCrossing: true, ghost, dead: true, endedTick: tick };
      // Back to the start column of the lane it died on, after a second's pause.
      return { ...base, col: CROSS_COLS >> 1, pauseUntil: tick + CROSS_PAUSE_TICKS, hitThisCrossing: true, ghost: true };
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
    clean,
    hitThisCrossing,
    ghost,
  };
  if (tick >= CROSS_RUN_TICKS) return { ...next, endedTick: tick };
  return next;
}

function score(state: CrossState): number {
  // Each lane is a ninth of a crossing, so progress counts in lanes.
  const lanes = state.crossings * CROSS_LANES + clampInt(state.reached, 0, CROSS_LANES);
  return clampInt(
    CROSS_LANE_POINTS * lanes + CROSS_CROSSING_POINTS * state.crossings + CROSS_CLEAN_POINTS * state.clean,
    0,
    150,
  );
}

/* =========================== Integrity checks ========================== */

export const CROSS_CHECKPOINT_INTERVAL = 300;

export interface CrossCheckpointState {
  tick: number;
  crossings: number;
  lane: number;
  col: number;
  hop: number;
  hopDir: number;
  reached: number;
  crossStart: number;
  pauseUntil: number;
  laneSpeed: number;
  lives: number;
  clean: number;
  flags: number;
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
    hopDir: state.hopDir,
    reached: state.reached,
    crossStart: state.crossStart,
    pauseUntil: state.pauseUntil,
    laneSpeed: course.lanes[0]?.speed ?? 0,
    lives: state.lives,
    clean: state.clean,
    flags: (state.hitThisCrossing ? 1 : 0) | (state.ghost ? 2 : 0),
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
export const CROSS_BLOCK_COLOURS = [CROSS_BLOCK, "#F25C54", "#F5B82E", "#A56A43", "#2ED3B7", "#F080AB"] as const;

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A car (or a lorry with a cab) filling exactly its collision box. Render only. */
function drawVehicle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: number, colour: string, lorry: boolean): void {
  const front = dir > 0 ? x + w : x;
  const back = dir > 0 ? x : x + w;
  ctx.fillStyle = colour;
  if (lorry) {
    const cab = Math.min(26, w * 0.28);
    const gap = 3;
    // Trailer, then cab at the front.
    roundRect(ctx, dir > 0 ? x : x + cab + gap, y, w - cab - gap, h, 4);
    ctx.fill();
    roundRect(ctx, dir > 0 ? x + w - cab : x, y + 2, cab, h - 4, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(11, 11, 15, 0.55)";
    ctx.fillRect(dir > 0 ? x + w - cab * 0.55 : x + cab * 0.2, y + 6, cab * 0.35, h - 12);
  } else {
    roundRect(ctx, x, y, w, h, Math.min(12, h / 2));
    ctx.fill();
    // Windscreen and rear window.
    ctx.fillStyle = "rgba(11, 11, 15, 0.5)";
    const ws = Math.min(14, w * 0.18);
    ctx.fillRect(dir > 0 ? x + w * 0.62 : x + w * 0.38 - ws, y + 5, ws, h - 10);
    ctx.fillRect(dir > 0 ? x + w * 0.18 : x + w * 0.82 - ws * 0.7, y + 6, ws * 0.7, h - 12);
  }
  // Headlights (white, at the front) and tail lights (red, at the back).
  ctx.fillStyle = "#FFFFFF";
  const hx = front - dir * 4;
  ctx.beginPath();
  ctx.arc(hx, y + 6, 2.6, 0, Math.PI * 2);
  ctx.arc(hx, y + h - 6, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.beginPath();
  ctx.moveTo(front, y + 2);
  ctx.lineTo(front + dir * 18, y - 2);
  ctx.lineTo(front + dir * 18, y + h + 2);
  ctx.lineTo(front, y + h - 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#FF3B3B";
  const tx = back + dir * 2;
  ctx.fillRect(tx - 1.5, y + 3, 3, 5);
  ctx.fillRect(tx - 1.5, y + h - 8, 3, 5);
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
    // Faster lanes (top third of this crossing's speeds) carry lorries.
    const speeds = course.lanes.map((l) => l.speed).sort((a, b) => a - b);
    const lorry = laneDef.speed >= (speeds[Math.floor((speeds.length * 2) / 3)] ?? Infinity);
    for (let index = -1; index <= count; index++) {
      const x = px(start + index * laneDef.period);
      const colour = CROSS_BLOCK_COLOURS[(lane + index + 8) % CROSS_BLOCK_COLOURS.length] ?? CROSS_BLOCK;
      drawVehicle(ctx, x, top + 7, px(laneDef.blockW), CROSS_LANE_H - 14, laneDef.dir, colour, lorry);
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
  const to = crossLaneCentre(state.lane + state.hopDir);
  const done = state.hop > 0 ? (CROSS_HOP_TICKS - state.hop) / CROSS_HOP_TICKS : 0;
  const cy = state.hop > 0 ? from + (to - from) * done : from;
  ctx.fillStyle = CROSS_PLAYER;
  ctx.globalAlpha = state.ghost && Math.floor(state.tick / 6) % 2 === 0 ? 0.45 : 1;
  ctx.beginPath();
  ctx.arc(px(crossColumnCentreFp(state.col)), cy, CROSS_PLAYER_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Lives, top right.
  for (let i = 0; i < CROSS_LIVES; i++) {
    ctx.fillStyle = i < state.lives ? CROSS_PLAYER : "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(CROSS_WORLD_W - 22 - i * 18, 18, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Crossings ${state.crossings}`, 14, 10);
  ctx.textAlign = "right";

  // The breather between crossings, announced over the board.
  if (state.tick - state.hitTick < 20 && !state.dead) {
    ctx.fillStyle = `rgba(255, 77, 77, ${0.25 * (1 - (state.tick - state.hitTick) / 20)})`;
    ctx.fillRect(0, 0, CROSS_WORLD_W, CROSS_WORLD_H);
  }
  if (crossPaused(state) && state.tick - state.hitTick >= CROSS_PAUSE_TICKS) {
    ctx.fillStyle = "rgba(11, 11, 15, 0.55)";
    ctx.fillRect(CROSS_BOARD_X, CROSS_WORLD_H / 2 - 30, CROSS_BOARD_W, 60);
    ctx.fillStyle = CROSS_PLAYER;
    ctx.font = "700 24px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Crossing ${state.crossings + 1}`, CROSS_WORLD_W / 2, CROSS_WORLD_H / 2);
  }

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
