/**
 * Rooftop Run — a three-lane runner on the shared engine.
 *
 * The sim is a flat three-lane track: every row of obstacles and coins has a z
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
export const ROOF_SPEED_STEP = 128;
export const ROOF_SPEED_STEP_TICKS = 10 * TICKS_PER_SECOND;
export const ROOF_SPEED_CAP = 1664;
const CLEAR_TICKS = 3 * TICKS_PER_SECOND;
/** How deep an obstacle or coin is along the track. */
const DEPTH = 24 * FP;

export const ROOF_NONE = 0;
export const ROOF_LOW = 1;
export const ROOF_HIGH = 2;
export const ROOF_WALL = 3;
export const ROOF_COIN_GROUND = 1;
export const ROOF_COIN_AIR = 2;

export const ROOF_COIN_POINTS = 2;
export const ROOF_SURVIVE_BONUS = 30;

export const ROOF_INPUT_RANGES: readonly InputRange[] = [
  inputRange(ROOF_INPUT_SWIPE, [0, 3]),
];

/** Speed on a tick, in 1/256 units a tick. */
export function roofSpeed(tick: number): number {
  return Math.min(
    ROOF_SPEED_CAP,
    ROOF_SPEED_START + ROOF_SPEED_STEP * Math.trunc(tick / ROOF_SPEED_STEP_TICKS),
  );
}

/** Total distance the course covers in the full run. */
function runDistance(): number {
  let z = 0;
  for (let tick = 1; tick <= ROOF_RUN_TICKS; tick++) z += roofSpeed(tick);
  return z;
}
const RUN_DISTANCE = runDistance();
const CLEAR_DISTANCE = (() => {
  let z = 0;
  for (let tick = 1; tick <= CLEAR_TICKS; tick++) z += roofSpeed(tick);
  return z;
})();

/* ================================ Course =============================== */

export interface RoofRow {
  z: number;
  kinds: number[];
  coins: number[];
}

export function roofPassable(kind: number): boolean {
  return kind !== ROOF_WALL;
}

export function buildRoofCourse(seed: number): { rows: RoofRow[]; totalCoins: number; rng: number } {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const rows: RoofRow[] = [];
  let totalCoins = 0;
  let prevPass = [true, true, true];
  let sinceObstacle = 2;
  for (let i = 1; i * ROOF_ROW_GAP <= RUN_DISTANCE; i++) {
    const z = i * ROOF_ROW_GAP;
    let kinds = [ROOF_NONE, ROOF_NONE, ROOF_NONE];
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
        if (ok) {
          kinds = trial;
          break;
        }
      }
    }
    const hasObstacle = kinds.some((k) => k !== ROOF_NONE);
    if (hasObstacle) {
      prevPass = kinds.map(roofPassable);
      sinceObstacle = 1;
    } else sinceObstacle += 1;

    const coins = [0, 0, 0];
    if (draw(10) < 6) {
      const want = draw(10) < 8 ? 2 : 1;
      let placed = 0;
      for (let attempt = 0; attempt < 8 && placed < want; attempt++) {
        const lane = draw(3);
        const kind = kinds[lane]!;
        if (kind === ROOF_WALL || kind === ROOF_HIGH || coins[lane] !== 0) continue;
        coins[lane] = kind === ROOF_LOW || draw(10) < 3 ? ROOF_COIN_AIR : ROOF_COIN_GROUND;
        totalCoins += 1;
        placed += 1;
      }
    }
    rows.push({ z, kinds, coins });
  }
  return { rows, totalCoins, rng };
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
  coins: number;
  /** Bit per lane of each row's coins already taken. */
  taken: number[];
  cursor: number;
  crashed: number;
  ended: number;
  endedTick: number;
  rows: RoofRow[];
  totalCoins: number;
  /** Render only: last lane-change direction. */
  lean: number;
}

function init(seed: number): RoofState {
  const course = buildRoofCourse(seed);
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
    coins: 0,
    taken: new Array<number>(course.rows.length).fill(0),
    cursor: 0,
    crashed: 0,
    ended: 0,
    endedTick: 0,
    rows: course.rows,
    totalCoins: course.totalCoins,
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

  if (s.laneT > 0) {
    s.laneT -= 1;
    if (s.laneT === 0) s.laneFrom = s.laneTo;
  }
  if (s.jumpT > 0) s.jumpT -= 1;
  if (s.slideT > 0) s.slideT -= 1;

  if (input && input.k === ROOF_INPUT_SWIPE) {
    const dir = clampInt(input.a, 0, 3);
    if ((dir === ROOF_LEFT || dir === ROOF_RIGHT) && s.laneT === 0) {
      const to = clampInt(s.laneTo + (dir === ROOF_LEFT ? -1 : 1), 0, ROOF_LANES - 1);
      if (to !== s.laneTo) {
        s.laneFrom = s.laneTo;
        s.laneTo = to;
        s.laneT = ROOF_LANE_TICKS;
        s.lean = dir === ROOF_LEFT ? -1 : 1;
      }
    } else if (dir === ROOF_UP && s.jumpT === 0) {
      s.jumpT = ROOF_JUMP_TICKS;
      s.slideT = 0;
    } else if (dir === ROOF_DOWN && s.slideT === 0 && s.jumpT === 0) {
      s.slideT = ROOF_SLIDE_TICKS;
    }
  }

  s.speed = roofSpeed(tick);
  s.z += s.speed;

  const lane = s.laneT > ROOF_LANE_TICKS / 2 ? s.laneFrom : s.laneTo;
  const air = roofJumpHeight(s.jumpT) >= AIR_HEIGHT;
  const sliding = s.slideT > 0;
  let taken = s.taken;
  let cursor = s.cursor;
  while (cursor < s.rows.length && s.rows[cursor]!.z + DEPTH < s.z) cursor += 1;
  for (let i = cursor; i < s.rows.length; i++) {
    const row = s.rows[i]!;
    if (row.z > s.z) break;
    const kind = row.kinds[lane]!;
    const hit =
      kind === ROOF_WALL || (kind === ROOF_LOW && !air) || (kind === ROOF_HIGH && !sliding);
    if (hit) {
      s.crashed = 1;
      break;
    }
    const coin = row.coins[lane]!;
    const bit = 1 << lane;
    if (coin !== 0 && (taken[i]! & bit) === 0) {
      if ((coin === ROOF_COIN_AIR && air) || (coin === ROOF_COIN_GROUND && !air)) {
        if (taken === s.taken) taken = taken.slice();
        taken[i] = taken[i]! | bit;
        s.coins += 1;
      }
    }
  }
  s.taken = taken;
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

export function roofScoreOf(coins: number, survived: boolean): number {
  return clampInt(ROOF_COIN_POINTS * coins + (survived ? ROOF_SURVIVE_BONUS : 0), 0, 150);
}

function score(state: RoofState): number {
  return roofScoreOf(state.coins, state.ended === 1);
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
  "coins",
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
  coins: number;
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
    coins: state.coins,
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

export function drawRoofCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.fillStyle = ROOF_GOLD;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1.5, 14 * s), 0, Math.PI * 2);
  ctx.fill();
}

export function drawRoofRunner(
  ctx: CanvasRenderingContext2D,
  cx: number,
  ground: number,
  lift: number,
  sliding: boolean,
  lean: number,
) {
  ctx.save();
  ctx.translate(cx, ground - lift);
  ctx.rotate(lean * 0.18);
  ctx.fillStyle = ROOF_GOLD;
  if (sliding) {
    ctx.beginPath();
    ctx.ellipse(0, -14, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(18, -28, 9, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, -64, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-10, -52, 20, 30, 6);
    ctx.fill();
    ctx.fillRect(-10, -24, 7, 24);
    ctx.fillRect(3, -24, 7, 24);
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
      const coin = row.coins[lane]!;
      if (coin !== 0 && (state.taken[i]! & (1 << lane)) === 0) {
        drawRoofCoin(ctx, p.x, p.y - (coin === ROOF_COIN_AIR ? 120 : 22) * p.s, p.s);
      }
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
  );

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Coins ${state.coins} / ${state.totalCoins}`, 14, 14);
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
