/**
 * Rooftop Run — a three-lane runner on the shared engine.
 *
 * The sim is a flat three-lane track: every row of obstacles has a z
 * position in 1/256 units and the whole course is generated at init from the
 * seed. Perspective is render only. Swipes arrive as k = 5 events.
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

const FP = 256;
export const ROOF_WORLD_W = 390;
export const ROOF_WORLD_H = 620;

export const ROOF_RUN_SECONDS = 60;
export const ROOF_RUN_TICKS = ROOF_RUN_SECONDS * TICKS_PER_SECOND;

export const ROOF_INPUT_SWIPE = 5;
export const ROOF_LEFT = 0;
export const ROOF_RIGHT = 1;
export const ROOF_UP = 2;
export const ROOF_DOWN = 3;
/** Minimum swipe length, in px. */
export const ROOF_SWIPE_PX = 24;

export const ROOF_LANES = 3;
export const ROOF_LANE_TICKS = 8;
export const ROOF_JUMP_TICKS = 36;
export const ROOF_SLIDE_TICKS = 28;
/** Jump height is t × (36 − t); at or above this the runner clears a low barrier. */
const AIR_HEIGHT = 100;

export const ROOF_ROW_GAP = 260 * FP;
export const ROOF_SPEED_START = 768;
/** +0.25 units a tick every 3 s, no cap. */
export const ROOF_SPEED_STEP = 64;
export const ROOF_SPEED_STEP_TICKS = 3 * TICKS_PER_SECOND;
const CLEAR_TICKS = 3 * TICKS_PER_SECOND;
/** How deep an obstacle is along the track. */
const DEPTH = 24 * FP;

export const ROOF_NONE = 0;
export const ROOF_LOW = 1;
export const ROOF_HIGH = 2;
export const ROOF_WALL = 3;

export const ROOF_INPUT_RANGES: readonly InputRange[] = [
  inputRange(ROOF_INPUT_SWIPE, [0, 3]),
];

/** Speed on a tick, in 1/256 units a tick. */
export function roofSpeed(tick: number): number {
  return ROOF_SPEED_START + ROOF_SPEED_STEP * Math.trunc(tick / ROOF_SPEED_STEP_TICKS);
}

/** Distance covered after each tick (index = tick). Speed never depends on input. */
const Z_AT: readonly number[] = (() => {
  const out = [0];
  let z = 0;
  for (let tick = 1; tick <= ROOF_RUN_TICKS; tick++) {
    z += roofSpeed(tick);
    out.push(z);
  }
  return out;
})();
const RUN_DISTANCE = Z_AT[ROOF_RUN_TICKS]!;
const CLEAR_DISTANCE = Z_AT[CLEAR_TICKS]!;

/* ============================ Runner motion ============================ */

interface Runner {
  laneFrom: number;
  laneTo: number;
  laneT: number;
  jumpT: number;
  slideT: number;
  lean: number;
}

/** One tick of runner timers and a swipe (dir −1 for none). Shared by the sim and the course check. */
function moveRunner(r: Runner, dir: number): void {
  if (r.laneT > 0) {
    r.laneT -= 1;
    if (r.laneT === 0) r.laneFrom = r.laneTo;
  }
  if (r.jumpT > 0) r.jumpT -= 1;
  if (r.slideT > 0) r.slideT -= 1;
  if (dir < 0) return;
  if ((dir === ROOF_LEFT || dir === ROOF_RIGHT) && r.laneT === 0) {
    const to = clampInt(r.laneTo + (dir === ROOF_LEFT ? -1 : 1), 0, ROOF_LANES - 1);
    if (to !== r.laneTo) {
      r.laneFrom = r.laneTo;
      r.laneTo = to;
      r.laneT = ROOF_LANE_TICKS;
      r.lean = dir === ROOF_LEFT ? -1 : 1;
    }
  } else if (dir === ROOF_UP && r.jumpT === 0) {
    r.jumpT = ROOF_JUMP_TICKS;
    r.slideT = 0;
  } else if (dir === ROOF_DOWN && r.slideT === 0 && r.jumpT === 0) {
    r.slideT = ROOF_SLIDE_TICKS;
  }
}

function hits(r: Runner, kinds: readonly number[]): boolean {
  const lane = r.laneT > ROOF_LANE_TICKS / 2 ? r.laneFrom : r.laneTo;
  const kind = kinds[lane]!;
  const air = roofJumpHeight(r.jumpT) >= AIR_HEIGHT;
  return kind === ROOF_WALL || (kind === ROOF_LOW && !air) || (kind === ROOF_HIGH && r.slideT === 0);
}

const packRunner = (r: Runner) =>
  r.laneFrom | (r.laneTo << 2) | (r.laneT << 4) | (r.jumpT << 8) | (r.slideT << 14);
const unpackRunner = (code: number): Runner => ({
  laneFrom: code & 3,
  laneTo: (code >> 2) & 3,
  laneT: (code >> 4) & 15,
  jumpT: (code >> 8) & 63,
  slideT: (code >> 14) & 31,
  lean: 0,
});

/* ================================ Course =============================== */

/**
 * The course check lets its runner swipe only on every third tick. That player
 * is strictly weaker than a real one, so a course it survives is survivable.
 */
const SOLVER_EVERY = 3;

export interface RoofRow {
  z: number;
  kinds: number[];
}

export function roofPassable(kind: number): boolean {
  return kind !== ROOF_WALL;
}

/**
 * Rows are drawn one at a time. After each row, every runner state reachable
 * (swiping on every third tick) is advanced tick by tick through that row; a row that
 * leaves no survivor is re-rolled (an empty row is the last resort), so every
 * course can be run to the end at every speed.
 */
export function buildRoofCourse(seed: number): { rows: RoofRow[]; rng: number } {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const rows: RoofRow[] = [];
  let frontier = Int32Array.of(packRunner({ laneFrom: 1, laneTo: 1, laneT: 0, jumpT: 0, slideT: 0, lean: 0 }));
  const seen = new Int32Array(1 << 19);
  const scratch = new Int32Array(1 << 19);
  let stamp = 0;
  let tick = 0;
  let prevPass = [true, true, true];
  let sinceObstacle = 2;
  const NONE = [ROOF_NONE, ROOF_NONE, ROOF_NONE];

  /** Advance the frontier through the ticks up to zEnd, dying on this row's kinds. */
  const advance = (from: Int32Array, fromTick: number, kinds: readonly number[], zStart: number, zEnd: number) => {
    let set = from;
    let t = fromTick;
    const r: Runner = { laneFrom: 0, laneTo: 0, laneT: 0, jumpT: 0, slideT: 0, lean: 0 };
    while (t < ROOF_RUN_TICKS && Z_AT[t + 1]! <= zEnd) {
      t += 1;
      const check = Z_AT[t]! >= zStart;
      stamp += 1;
      let n = 0;
      for (let k = 0; k < set.length; k++) {
        const code = set[k]!;
        for (let dir = -1; dir <= (t % SOLVER_EVERY === 0 ? 3 : -1); dir++) {
          r.laneFrom = code & 3;
          r.laneTo = (code >> 2) & 3;
          r.laneT = (code >> 4) & 15;
          r.jumpT = (code >> 8) & 63;
          r.slideT = (code >> 14) & 31;
          moveRunner(r, dir);
          if (check && hits(r, kinds)) continue;
          const next = packRunner(r);
          if (seen[next] === stamp) continue;
          seen[next] = stamp;
          scratch[n++] = next;
        }
      }
      set = scratch.slice(0, n);
      if (n === 0) break;
    }
    return { set, tick: t };
  };

  for (let i = 1; i * ROOF_ROW_GAP <= RUN_DISTANCE; i++) {
    const z = i * ROOF_ROW_GAP;
    let kinds = NONE;
    let result: { set: Int32Array; tick: number } | null = null;
    if (z > CLEAR_DISTANCE) {
      const reach = sinceObstacle >= 2 ? 2 : 1;
      for (let attempt = 0; attempt < 20; attempt++) {
        const count = draw(3);
        const trial = [ROOF_NONE, ROOF_NONE, ROOF_NONE];
        for (let n = 0; n < count; n++) trial[draw(3)] = 1 + draw(3);
        let ok = false;
        for (let lane = 0; lane < ROOF_LANES && !ok; lane++) {
          if (!roofPassable(trial[lane]!)) continue;
          for (let from = 0; from < ROOF_LANES; from++) {
            if (prevPass[from] && Math.abs(lane - from) <= reach) ok = true;
          }
        }
        if (!ok) continue;
        const tried = advance(frontier, tick, trial, z, z + DEPTH);
        if (tried.set.length > 0) {
          kinds = trial;
          result = tried;
          break;
        }
      }
    }
    result ??= advance(frontier, tick, NONE, z, z + DEPTH);
    frontier = result.set;
    tick = result.tick;
    const hasObstacle = kinds.some((k) => k !== ROOF_NONE);
    if (hasObstacle) {
      prevPass = kinds.map(roofPassable);
      sinceObstacle = 1;
    } else sinceObstacle += 1;
    rows.push({ z, kinds });
  }
  return { rows, rng };
}

/* ================================ State ================================ */

export interface RoofState {
  tick: number;
  rng: number;
  z: number;
  speed: number;
  laneFrom: number;
  laneTo: number;
  laneT: number;
  jumpT: number;
  slideT: number;
  cursor: number;
  crashed: number;
  ended: number;
  endedTick: number;
  rows: RoofRow[];
  /** Render only: last lane-change direction. */
  lean: number;
}

/** Course cache: building checks every reachable runner state, so do it once per seed. */
const courseCache = new Map<number, { rows: RoofRow[]; rng: number }>();

function init(seed: number): RoofState {
  let course = courseCache.get(seed | 0);
  if (!course) {
    course = buildRoofCourse(seed);
    if (courseCache.size > 16) courseCache.clear();
    courseCache.set(seed | 0, course);
  }
  return {
    tick: 0,
    rng: course.rng,
    z: 0,
    speed: ROOF_SPEED_START,
    laneFrom: 1,
    laneTo: 1,
    laneT: 0,
    jumpT: 0,
    slideT: 0,
    cursor: 0,
    crashed: 0,
    ended: 0,
    endedTick: 0,
    rows: course.rows,
    lean: 0,
  };
}

function isOver(state: RoofState): boolean {
  return state.ended !== 0;
}

export function roofJumpHeight(jumpT: number): number {
  if (jumpT <= 0) return 0;
  const t = ROOF_JUMP_TICKS - jumpT;
  return t * (ROOF_JUMP_TICKS - t);
}

function step(state: RoofState, input: ArcadeInputEvent | null): RoofState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: RoofState = { ...state, tick };
  const dir = input && input.k === ROOF_INPUT_SWIPE ? clampInt(input.a, 0, 3) : -1;
  moveRunner(s, dir);

  s.speed = roofSpeed(tick);
  s.z += s.speed;

  let cursor = s.cursor;
  while (cursor < s.rows.length && s.rows[cursor]!.z + DEPTH < s.z) cursor += 1;
  for (let i = cursor; i < s.rows.length; i++) {
    const row = s.rows[i]!;
    if (row.z > s.z) break;
    if (hits(s, row.kinds)) {
      s.crashed = 1;
      break;
    }
  }
  s.cursor = cursor;

  if (s.crashed) {
    s.ended = 2;
    s.endedTick = tick;
  } else if (tick >= ROOF_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** floor(150 × (seconds survived ÷ 60)²), in whole ticks. */
export function roofScoreOf(ticksSurvived: number): number {
  const t = clampInt(ticksSurvived, 0, ROOF_RUN_TICKS);
  return clampInt(Math.trunc((150 * t * t) / (ROOF_RUN_TICKS * ROOF_RUN_TICKS)), 0, 150);
}

function score(state: RoofState): number {
  return roofScoreOf(state.ended === 1 ? ROOF_RUN_TICKS : state.tick);
}

/* ============================= Checkpoints ============================= */

export const ROOF_CHECKPOINT_INTERVAL = 300;

export const ROOF_CHECKPOINT_KEYS = [
  "tick",
  "z",
  "speed",
  "laneFrom",
  "laneTo",
  "laneT",
  "jumpT",
  "slideT",
  "cursor",
  "crashed",
  "rng",
  "checksum",
] as const;

export interface RoofCheckpoint {
  tick: number;
  z: number;
  speed: number;
  laneFrom: number;
  laneTo: number;
  laneT: number;
  jumpT: number;
  slideT: number;
  cursor: number;
  crashed: number;
  rng: number;
  checksum: number;
}

export function roofCheckpoint(state: RoofState): RoofCheckpoint {
  const snap = {
    tick: state.tick,
    z: state.z,
    speed: state.speed,
    laneFrom: state.laneFrom,
    laneTo: state.laneTo,
    laneT: state.laneT,
    jumpT: state.jumpT,
    slideT: state.slideT,
    cursor: state.cursor,
    crashed: state.crashed,
    rng: state.rng | 0,
  };
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snap)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* =============================== Drawing =============================== */

export const ROOF_GOLD = "#F5B82E";
export const ROOF_TEAL = "#2ED3B7";
export const ROOF_SKY_TOP = "#05050A";
export const ROOF_SKY_BOTTOM = "#1B1530";

const HORIZON_Y = 110;
const GROUND_Y = 560;
const LANE_W = 110;
const FOCAL = 300;
const VIEW = 2200;
/** Fixed perspective table: scale for every 20 units ahead (render only). */
const PERSPECTIVE: readonly number[] = Array.from(
  { length: VIEW / 20 + 2 },
  (_, i) => FOCAL / (FOCAL + i * 20),
);
function persp(ahead: number): number {
  const i = Math.max(0, ahead / 20);
  const lo = Math.floor(i);
  const f = i - lo;
  const a = PERSPECTIVE[Math.min(lo, PERSPECTIVE.length - 1)]!;
  const b = PERSPECTIVE[Math.min(lo + 1, PERSPECTIVE.length - 1)]!;
  return a + (b - a) * f;
}
function project(lanePos: number, ahead: number) {
  const s = persp(ahead);
  return {
    x: ROOF_WORLD_W / 2 + (lanePos - 1) * LANE_W * s,
    y: HORIZON_Y + (GROUND_Y - HORIZON_Y) * s,
    s,
  };
}

function hazard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = ROOF_TEAL;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "rgba(11,11,15,0.55)";
  const step = Math.max(4, h);
  for (let sx = x - h; sx < x + w; sx += step * 1.4) {
    ctx.beginPath();
    ctx.moveTo(sx, y + h);
    ctx.lineTo(sx + step * 0.6, y + h);
    ctx.lineTo(sx + step * 0.6 + h, y);
    ctx.lineTo(sx + h, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawRoofObstacle(
  ctx: CanvasRenderingContext2D,
  kind: number,
  cx: number,
  ground: number,
  s: number,
): void {
  const w = LANE_W * 0.86 * s;
  if (kind === ROOF_LOW) hazard(ctx, cx - w / 2, ground - 34 * s, w, 34 * s);
  else if (kind === ROOF_HIGH) {
    ctx.fillStyle = "rgba(46,211,183,0.5)";
    ctx.fillRect(cx - w / 2, ground - 120 * s, 4 * s + 1, 120 * s);
    ctx.fillRect(cx + w / 2 - 4 * s - 1, ground - 120 * s, 4 * s + 1, 120 * s);
    hazard(ctx, cx - w / 2, ground - 120 * s, w, 30 * s);
  } else if (kind === ROOF_WALL) {
    hazard(ctx, cx - w / 2, ground - 150 * s, w, 150 * s);
  }
}

function limb(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, len: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.sin(angle) * len, y + Math.cos(angle) * len);
  ctx.stroke();
}

export function drawRoofRunner(
  ctx: CanvasRenderingContext2D,
  cx: number,
  ground: number,
  lift: number,
  sliding: boolean,
  lean: number,
  jumping = false,
  tick = 0,
) {
  ctx.save();
  ctx.translate(cx, ground - lift);
  ctx.rotate(lean * 0.18);
  ctx.fillStyle = ROOF_GOLD;
  ctx.strokeStyle = ROOF_GOLD;
  ctx.lineCap = "round";
  ctx.lineWidth = 5;
  if (sliding) {
    ctx.beginPath();
    ctx.ellipse(0, -14, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(18, -28, 9, 0, Math.PI * 2);
    ctx.fill();
    // Arms tucked back along the body.
    limb(ctx, 10, -20, -1.9, 18);
    limb(ctx, 4, -16, -1.7, 16);
  } else {
    ctx.beginPath();
    ctx.arc(0, -64, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-10, -52, 20, 30, 6);
    ctx.fill();
    ctx.fillRect(-10, -24, 7, 24);
    ctx.fillRect(3, -24, 7, 24);
    if (jumping) {
      // Arms stretched up.
      limb(ctx, -9, -48, Math.PI - 0.35, 22);
      limb(ctx, 9, -48, Math.PI + 0.35, 22);
    } else {
      // Arms pumping in opposition.
      const swing = Math.sin(tick * 0.45) * 0.8;
      limb(ctx, -11, -48, swing, 20);
      limb(ctx, 11, -48, -swing, 20);
    }
  }
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: RoofState, size: CanvasSize): void {
  const scale = Math.min(size.width / ROOF_WORLD_W, size.height / ROOF_WORLD_H);
  const ox = (size.width - ROOF_WORLD_W * scale) / 2;
  const oy = (size.height - ROOF_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = ROOF_SKY_TOP;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  const sky = ctx.createLinearGradient(0, 0, 0, ROOF_WORLD_H);
  sky.addColorStop(0, ROOF_SKY_TOP);
  sky.addColorStop(1, ROOF_SKY_BOTTOM);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ROOF_WORLD_W, ROOF_WORLD_H);

  // Rooftop edges and lane lines receding to the vanishing point.
  ctx.lineWidth = 2;
  for (let edge = 0; edge <= ROOF_LANES; edge++) {
    const near = project(edge - 0.5, 0);
    const far = project(edge - 0.5, VIEW);
    ctx.strokeStyle = edge === 0 || edge === ROOF_LANES ? ROOF_GOLD : "rgba(245,184,46,0.25)";
    ctx.beginPath();
    ctx.moveTo(near.x, ROOF_WORLD_H);
    ctx.lineTo(far.x, far.y);
    ctx.stroke();
  }
  // Moving cross-lines, for a sense of speed.
  const zUnits = state.z / FP;
  ctx.strokeStyle = "rgba(245,184,46,0.12)";
  for (let d = 130 - (zUnits % 130); d < VIEW; d += 130) {
    const l = project(-0.5, d);
    const r = project(2.5, d);
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(r.x, r.y);
    ctx.stroke();
  }

  // Rows, far to near.
  for (let i = state.rows.length - 1; i >= state.cursor; i--) {
    const row = state.rows[i]!;
    const ahead = (row.z - state.z) / FP;
    if (ahead > VIEW || ahead < -30) continue;
    for (let lane = 0; lane < ROOF_LANES; lane++) {
      const p = project(lane, Math.max(0, ahead));
      drawRoofObstacle(ctx, row.kinds[lane]!, p.x, p.y, p.s);
    }
  }

  // Runner.
  const progress = state.laneT > 0 ? 1 - state.laneT / ROOF_LANE_TICKS : 1;
  const lanePos = state.laneFrom + (state.laneTo - state.laneFrom) * progress;
  const me = project(lanePos, 0);
  drawRoofRunner(
    ctx,
    me.x,
    me.y,
    roofJumpHeight(state.jumpT) * 0.3,
    state.slideT > 0,
    state.laneT > 0 ? state.lean : 0,
    state.jumpT > 0,
    state.tick,
  );

  ctx.restore();
}

export const rooftopGame: ArcadeGame<RoofState, ArcadeInputEvent | null> = {
  key: "rooftop",
  runTicks: ROOF_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: ROOF_INPUT_RANGES,
};
