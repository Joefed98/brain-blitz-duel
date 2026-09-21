/**
 * Bin Toss — an arcade game on the shared engine.
 *
 * Side view: a crumpled ball at the bottom-left, a bin standing on the floor to
 * the right. A flick launches the ball; gravity plus a per-throw sideways wind
 * decide where it lands. Ten throws, the bin further away each time. Everything
 * is integer fixed-point (1/256 px) and every constant below is written once.
 */

import {
  clampInt,
  flickLaunch,
  inputRange,
  px,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type FlickLaunch,
  type InputRange,
} from "./engine";

/* ============================== Constants ============================== */

/** The world the sim runs in. Drawing scales this to the canvas. */
export const BINTOSS_WORLD_W = 390;
export const BINTOSS_WORLD_H = 560;

export const BINTOSS_RUN_SECONDS = 60;
export const BINTOSS_RUN_TICKS = BINTOSS_RUN_SECONDS * TICKS_PER_SECOND;
export const BINTOSS_THROWS = 10;

/** Every simulation constant below is already in 1/256-pixel units. */
export const BINTOSS_WORLD_RIGHT = 99_840;
export const BINTOSS_WORLD_BOTTOM = 143_360;

/** The ball's resting place: 40 px in, sitting on the floor at 500 px. */
export const BINTOSS_FLOOR_Y = 128_000;
export const BINTOSS_BALL_X = 10_240;
export const BINTOSS_BALL_R = 1_792;
export const BINTOSS_BALL_Y = 126_208;

/** The bin: an 84 px opening, 70 px tall, standing on the floor. */
export const BINTOSS_BIN_HALF = 10_752;
/** The ball centre must cross at least 10 px inside either rim edge. */
export const BINTOSS_RIM_INSET = 2_560;
export const BINTOSS_BIN_H = 17_920;
export const BINTOSS_RIM_Y = 110_080;

/** Downward acceleration each tick. */
export const BINTOSS_GRAVITY = 24;
/** One wind unit of sideways acceleration each tick. */
export const BINTOSS_WIND_UNIT = 8;
export const BINTOSS_WIND_MAX = 2;

/** Launch clamps: 10 px a tick sideways, 15 px a tick upwards. */
export const BINTOSS_VX_MAX = 2_560;
export const BINTOSS_VY_MAX = 3_840;

/** The next ball appears this many ticks after the last one finished. */
export const BINTOSS_NEXT_DELAY = 20;

/** Bin distances from the ball: 110 px growing by 15 px a throw. */
export const BINTOSS_FIRST_DIST = 28_160;
export const BINTOSS_DIST_STEP = 3_840;

export const BINTOSS_BASKET_POINTS = 10;
export const BINTOSS_TIME_BONUS = 50;

/** A flick: a = launch vx, b = launch vy, both in 1/256 px a tick. */
export const BINTOSS_INPUT_FLICK = 1;
export const BINTOSS_INPUT_RANGES: readonly InputRange[] = [
  inputRange(BINTOSS_INPUT_FLICK, [-BINTOSS_VX_MAX, BINTOSS_VX_MAX], [-BINTOSS_VY_MAX, 0]),
];

/**
 * The launch speed a reference 1300 px/s flick produces, in 1/256 px a tick.
 * Solved from this sim's gravity so that a 1300 px/s flick at 60° lands in the
 * bin on throw five (170 px away) with no wind.
 */
export const BINTOSS_REF_V = 1_243;

/**
 * Turns the last stretch of finger movement into a launch velocity. `dx`/`dy`
 * are world pixels moved over `dtMs` milliseconds; upwards is negative `dy`.
 * Returns null for a short, slow or downward swipe.
 */
export function binTossFlick(dx: number, dy: number, dtMs: number): FlickLaunch | null {
  const launch = flickLaunch(dx, dy, dtMs, BINTOSS_REF_V);
  if (!launch) return null;
  return {
    ...launch,
    vx: clampInt(launch.vx, -BINTOSS_VX_MAX, BINTOSS_VX_MAX),
    vy: clampInt(launch.vy, -BINTOSS_VY_MAX, -1),
  };
}

/** Where a launch would cross the bin's rim line, in world pixels — dev only. */
export function binTossPredict(vx: number, vy: number, wind: number): { x: number; y: number } {
  let x = BINTOSS_BALL_X;
  let y = BINTOSS_BALL_Y;
  let dx = vx;
  let dy = vy;
  for (let tick = 0; tick < BINTOSS_RUN_TICKS; tick++) {
    dx += wind * BINTOSS_WIND_UNIT;
    dy += BINTOSS_GRAVITY;
    x += dx;
    y += dy;
    if (dy > 0 && y >= BINTOSS_RIM_Y) break;
    if (y >= BINTOSS_FLOOR_Y - BINTOSS_BALL_R) break;
  }
  return { x: Math.round(px(x)), y: Math.round(px(y)) };
}

/** The bin's centre for a throw. */
export function binTossDistance(index: number): number {
  return BINTOSS_FIRST_DIST + BINTOSS_DIST_STEP * clampInt(index, 0, BINTOSS_THROWS - 1);
}

export function binTossBinCentre(index: number): number {
  return BINTOSS_BALL_X + binTossDistance(index);
}

/* ================================ State ================================ */

export const BINTOSS_AIM = 0;
export const BINTOSS_FLY = 1;
export const BINTOSS_WAIT = 2;

export interface BinTossState {
  tick: number;
  rng: number;
  /** The throw now in hand, 0-based; reaches ten when they are all done. */
  throwIndex: number;
  resolved: number;
  baskets: number;
  /** Wind for each of the ten throws, −2 … +2. Same for everyone. */
  winds: number[];
  /** 1 for a basket, 0 for a miss, in throw order. */
  results: number[];
  phase: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** When the next ball appears, during the wait phase. */
  readyTick: number;
  /** Last rim hit, for the render-only bin wobble. */
  wobbleTick: number;
  endedTick: number;
}

function init(seed: number): BinTossState {
  let rng = seed | 0;
  const winds: number[] = [];
  for (let index = 0; index < BINTOSS_THROWS; index++) {
    const drawn = rngBelow(rng, BINTOSS_WIND_MAX * 2 + 1);
    rng = drawn.state;
    winds.push(drawn.value - BINTOSS_WIND_MAX);
  }
  return {
    tick: 0,
    rng,
    throwIndex: 0,
    resolved: 0,
    baskets: 0,
    winds,
    results: [],
    phase: BINTOSS_AIM,
    x: BINTOSS_BALL_X,
    y: BINTOSS_BALL_Y,
    vx: 0,
    vy: 0,
    readyTick: 0,
    wobbleTick: 0,
    endedTick: 0,
  };
}

function isOver(state: BinTossState): boolean {
  return state.resolved >= BINTOSS_THROWS || state.tick >= BINTOSS_RUN_TICKS;
}

/** Every throw taken and every one of them in. */
export function binTossPerfect(state: BinTossState): boolean {
  return state.baskets >= BINTOSS_THROWS;
}

/** Ends the throw in flight and starts the wait for the next ball. */
function resolve(state: BinTossState, tick: number, scored: boolean): BinTossState {
  return {
    ...state,
    tick,
    phase: BINTOSS_WAIT,
    resolved: state.resolved + 1,
    baskets: state.baskets + (scored ? 1 : 0),
    results: [...state.results, scored ? 1 : 0],
    throwIndex: Math.min(BINTOSS_THROWS, state.throwIndex + 1),
    readyTick: tick + BINTOSS_NEXT_DELAY,
    vx: 0,
    vy: 0,
  };
}

function step(state: BinTossState, input: ArcadeInputEvent | null): BinTossState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;

  // The wait between throws.
  if (state.phase === BINTOSS_WAIT) {
    if (tick >= state.readyTick) {
      return {
        ...state,
        tick,
        phase: BINTOSS_AIM,
        x: BINTOSS_BALL_X,
        y: BINTOSS_BALL_Y,
        vx: 0,
        vy: 0,
      };
    }
    return { ...state, tick };
  }

  // A flick launches the ball; the flight starts on the following tick.
  if (state.phase === BINTOSS_AIM) {
    if (input && input.k === BINTOSS_INPUT_FLICK) {
      return {
        ...state,
        tick,
        phase: BINTOSS_FLY,
        vx: clampInt(input.a, -BINTOSS_VX_MAX, BINTOSS_VX_MAX),
        vy: clampInt(input.b, -BINTOSS_VY_MAX, 0),
      };
    }
    return { ...state, tick };
  }

  // In flight.
  const wind = state.winds[state.throwIndex] ?? 0;
  let vx = state.vx + wind * BINTOSS_WIND_UNIT;
  let vy = state.vy + BINTOSS_GRAVITY;
  let nx = state.x + vx;
  let ny = state.y + vy;
  let wobbleTick = state.wobbleTick;

  const centre = binTossBinCentre(state.throwIndex);

  // Crossing the rim line on the way down decides the throw.
  if (vy > 0 && state.y < BINTOSS_RIM_Y && ny >= BINTOSS_RIM_Y) {
    const offset = Math.abs(nx - centre);
    if (offset <= BINTOSS_BIN_HALF - BINTOSS_RIM_INSET) {
      return resolve({ ...state, x: nx, y: ny, wobbleTick }, tick, true);
    }
    if (offset <= BINTOSS_BIN_HALF + BINTOSS_BALL_R) {
      // A rim edge: the ball bounces away and the throw is a miss.
      wobbleTick = tick;
      vx = -(vx >> 1);
      vy = -(vy >> 1);
      nx = state.x + vx;
      ny = state.y + vy;
    }
  }

  // Below the rim and overlapping the bin means it struck the outside wall.
  if (ny > BINTOSS_RIM_Y && Math.abs(nx - centre) <= BINTOSS_BIN_HALF + BINTOSS_BALL_R) {
    wobbleTick = tick;
    vx = -(vx >> 1);
    nx =
      state.x < centre
        ? centre - BINTOSS_BIN_HALF - BINTOSS_BALL_R
        : centre + BINTOSS_BIN_HALF + BINTOSS_BALL_R;
  }

  const next: BinTossState = { ...state, tick, vx, vy, x: nx, y: ny, wobbleTick };

  // Landing on the floor or leaving the canvas is a miss.
  if (ny >= BINTOSS_FLOOR_Y - BINTOSS_BALL_R) return resolve(next, tick, false);
  if (nx < -BINTOSS_BALL_R || nx > BINTOSS_WORLD_RIGHT + BINTOSS_BALL_R) {
    return resolve(next, tick, false);
  }
  if (ny < -BINTOSS_WORLD_BOTTOM) return resolve(next, tick, false);
  return next;
}

function score(state: BinTossState): number {
  const baskets = clampInt(state.baskets, 0, BINTOSS_THROWS);
  let points = baskets * BINTOSS_BASKET_POINTS;
  if (baskets >= BINTOSS_THROWS) {
    const remaining = Math.max(0, BINTOSS_RUN_TICKS - state.tick);
    points += Math.round((BINTOSS_TIME_BONUS * remaining) / BINTOSS_RUN_TICKS);
  }
  return clampInt(points, 0, 150);
}

/* =========================== Integrity checks ========================== */

export const BINTOSS_CHECKPOINT_INTERVAL = 300;

export interface BinTossCheckpointState {
  tick: number;
  phase: number;
  throwIndex: number;
  resolved: number;
  baskets: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  wind: number;
}

export interface BinTossCheckpoint extends BinTossCheckpointState {
  checksum: number;
}

export function binTossCheckpointState(state: BinTossState): BinTossCheckpointState {
  return {
    tick: state.tick,
    phase: state.phase,
    throwIndex: state.throwIndex,
    resolved: state.resolved,
    baskets: state.baskets,
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    wind: state.winds[Math.min(state.throwIndex, BINTOSS_THROWS - 1)] ?? 0,
  };
}

/** 32-bit FNV-1a over the integer snapshot, with an xor before each multiply. */
export function binTossCheckpoint(state: BinTossState): BinTossCheckpoint {
  const snapshot = binTossCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* ================================ Drawing ============================== */

export const BINTOSS_BG = "#0B0B0F";
export const BINTOSS_BALL_COLOUR = "#F5B82E";
export const BINTOSS_BIN_COLOUR = "#2ED3B7";
export const BINTOSS_MISS_COLOUR = "#FF4D4D";
export const BINTOSS_TEXT = "#F7F7F8";

export interface BinTossTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** The same world-to-canvas mapping the sim's own drawing uses. */
export function binTossTransform(size: CanvasSize): BinTossTransform {
  const scale = Math.min(size.width / BINTOSS_WORLD_W, size.height / BINTOSS_WORLD_H);
  return {
    scale,
    offsetX: (size.width - BINTOSS_WORLD_W * scale) / 2,
    offsetY: (size.height - BINTOSS_WORLD_H * scale) / 2,
  };
}

function drawWind(ctx: CanvasRenderingContext2D, wind: number): void {
  const centreX = BINTOSS_WORLD_W / 2;
  const y = 66;
  const strength = Math.abs(wind);
  ctx.save();
  ctx.strokeStyle = wind === 0 ? "#F7F7F855" : BINTOSS_BIN_COLOUR;
  ctx.lineWidth = 2;
  if (wind !== 0) {
    const dir = wind < 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(centreX - 26 * dir, y);
    ctx.lineTo(centreX + 26 * dir, y);
    ctx.lineTo(centreX + 18 * dir, y - 6);
    ctx.moveTo(centreX + 26 * dir, y);
    ctx.lineTo(centreX + 18 * dir, y + 6);
    ctx.stroke();
  }
  // Strength bars under the arrow.
  for (let bar = 0; bar < BINTOSS_WIND_MAX; bar++) {
    ctx.fillStyle = bar < strength ? BINTOSS_BIN_COLOUR : "#F7F7F822";
    ctx.fillRect(centreX - 26 + bar * 11, y + 10, 8, 4);
  }
  ctx.font = "600 13px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = BINTOSS_TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(wind === 0 ? "no wind" : `${wind < 0 ? "←" : "→"} ${strength}`, centreX, y - 14);
  ctx.restore();
}

function drawBin(ctx: CanvasRenderingContext2D, state: BinTossState): void {
  const index = Math.min(state.throwIndex, BINTOSS_THROWS - 1);
  const centre = px(binTossBinCentre(index));
  const half = px(BINTOSS_BIN_HALF);
  const top = px(BINTOSS_RIM_Y);
  const floor = px(BINTOSS_FLOOR_Y);
  // A rim hit rocks the bin for a few frames; render only.
  const since = state.tick - state.wobbleTick;
  const lean = state.wobbleTick > 0 && since >= 0 && since < 24 ? (since % 8 < 4 ? 2 : -2) : 0;

  ctx.save();
  ctx.translate(centre + lean, floor);
  ctx.strokeStyle = BINTOSS_BIN_COLOUR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-half, top - floor);
  ctx.lineTo(-half + 4, 0);
  ctx.lineTo(half - 4, 0);
  ctx.lineTo(half, top - floor);
  ctx.stroke();
  // The opening.
  ctx.beginPath();
  ctx.ellipse(0, top - floor, half, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, state: BinTossState): void {
  const radius = px(BINTOSS_BALL_R);
  ctx.save();
  ctx.translate(px(state.x), px(state.y));
  // Tumble: render only, driven by the tick so it stays deterministic.
  ctx.rotate(((state.tick * 11) % 360) * (Math.PI / 180));
  ctx.fillStyle = BINTOSS_BALL_COLOUR;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0B0B0F88";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.6, -radius * 0.2);
  ctx.lineTo(radius * 0.5, radius * 0.4);
  ctx.moveTo(-radius * 0.2, radius * 0.6);
  ctx.lineTo(radius * 0.3, -radius * 0.5);
  ctx.stroke();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: BinTossState, size: CanvasSize): void {
  const { scale, offsetX, offsetY } = binTossTransform(size);

  ctx.save();
  ctx.fillStyle = BINTOSS_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Floor.
  ctx.strokeStyle = "rgba(247, 247, 248, 0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, px(BINTOSS_FLOOR_Y));
  ctx.lineTo(BINTOSS_WORLD_W, px(BINTOSS_FLOOR_Y));
  ctx.stroke();

  drawBin(ctx, state);
  if (state.throwIndex < BINTOSS_THROWS) drawWind(ctx, state.winds[state.throwIndex] ?? 0);
  if (state.resolved < BINTOSS_THROWS) {
    drawTrail(ctx, state);
    drawBall(ctx, state);
  }

  // HUD.
  const remaining = Math.max(0, BINTOSS_RUN_TICKS - state.tick) / TICKS_PER_SECOND;
  ctx.font = "600 15px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = BINTOSS_TEXT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const shown = Math.min(BINTOSS_THROWS, state.throwIndex + 1);
  ctx.fillText(`Throw ${shown} / ${BINTOSS_THROWS} · ${state.baskets} in`, 12, 12);
  ctx.textAlign = "right";
  ctx.fillText(`${remaining.toFixed(1)}s`, BINTOSS_WORLD_W - 12, 12);

  // A pip per throw taken.
  for (let index = 0; index < BINTOSS_THROWS; index++) {
    const result = state.results[index];
    ctx.fillStyle =
      result === 1 ? BINTOSS_BALL_COLOUR : result === 0 ? BINTOSS_MISS_COLOUR : "#F7F7F822";
    ctx.beginPath();
    ctx.arc(20 + index * 16, BINTOSS_WORLD_H - 16, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * A short fading trail behind the ball in flight. Worked out by walking the
 * flight backwards from the current velocity, so it is render only and the sim
 * never stores it.
 */
function drawTrail(ctx: CanvasRenderingContext2D, state: BinTossState): void {
  if (state.phase !== BINTOSS_FLY) return;
  const wind = (state.winds[state.throwIndex] ?? 0) * BINTOSS_WIND_UNIT;
  let x = state.x;
  let y = state.y;
  let vx = state.vx;
  let vy = state.vy;
  ctx.save();
  for (let step = 1; step <= 10; step++) {
    x -= vx;
    y -= vy;
    vx -= wind;
    vy -= BINTOSS_GRAVITY;
    if (y > BINTOSS_FLOOR_Y || x < 0) break;
    ctx.globalAlpha = 0.34 * (1 - step / 11);
    ctx.fillStyle = BINTOSS_BALL_COLOUR;
    ctx.beginPath();
    ctx.arc(px(x), px(y), px(BINTOSS_BALL_R) * (1 - step / 14), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export interface BinTossGhost {
  vx: number;
  vy: number;
  wind: number;
}

/** Draws the completed attempt's trajectory without changing simulation state. */
export function binTossDrawGhost(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  ghost: BinTossGhost,
): void {
  const { scale, offsetX, offsetY } = binTossTransform(size);
  let x = BINTOSS_BALL_X;
  let y = BINTOSS_BALL_Y;
  let vx = ghost.vx;
  let vy = ghost.vy;
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = BINTOSS_BALL_COLOUR;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(px(x), px(y));
  for (let tick = 0; tick < BINTOSS_RUN_TICKS; tick++) {
    vx += ghost.wind * BINTOSS_WIND_UNIT;
    vy += BINTOSS_GRAVITY;
    x += vx;
    y += vy;
    ctx.lineTo(px(x), px(y));
    if (vy > 0 && y >= BINTOSS_RIM_Y) break;
    if (y >= BINTOSS_FLOOR_Y - BINTOSS_BALL_R) break;
    if (x < -BINTOSS_BALL_R || x > BINTOSS_WORLD_RIGHT + BINTOSS_BALL_R) break;
  }
  ctx.stroke();
  ctx.restore();
}

export const binTossGame: ArcadeGame<BinTossState, ArcadeInputEvent | null> = {
  key: "bintoss",
  runTicks: BINTOSS_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: BINTOSS_INPUT_RANGES,
};
