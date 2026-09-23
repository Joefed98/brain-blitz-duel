/**
 * Bin Toss — an arcade game on the shared engine.
 *
 * Side view: a crumpled ball at the bottom-left, a bin standing on the floor to
 * the right. A drag aims the throw and letting go launches the ball; gravity
 * plus a per-throw sideways wind decide where it lands. Ten throws, the bin
 * further away each time. Everything is integer fixed-point (1/256 px) and
 * every constant below is written once.
 */

import {
  clampInt,
  dragLaunch,
  inputRange,
  px,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type DragLaunch,
  type InputRange, parPoints, ARCADE_COMPLETION_BONUS } from "./engine";

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

/** The bin: a 100 px opening, 70 px tall, standing on the floor. */
export const BINTOSS_BIN_HALF = 12_800;
/** The ball centre must cross at least 10 px inside either rim edge. */
export const BINTOSS_RIM_INSET = 2_560;
export const BINTOSS_BIN_H = 17_920;
export const BINTOSS_RIM_Y = 110_080;

/** Downward acceleration each tick. */
export const BINTOSS_GRAVITY = 22;
/** Wind runs −3 … +3, drawn from the seeded PRNG so it is the same for everyone. */
export const BINTOSS_WIND_MAX = 3;

/** Launch clamps: 10 px a tick sideways, 15 px a tick upwards. */
export const BINTOSS_VX_MAX = 2_560;
export const BINTOSS_VY_MAX = 3_840;

/** The next ball appears this many ticks after the last one finished. */
export const BINTOSS_NEXT_DELAY = 20;

/** Bin distances from the ball: 100 px growing by 15 px a throw, up to 235 px. */
export const BINTOSS_FIRST_DIST = 25_600;
export const BINTOSS_DIST_STEP = 3_840;

export const BINTOSS_BASKET_POINTS = 11;
/** Par: ten baskets = 110. */
export const BINTOSS_PAR = 10;
export const BINTOSS_TIME_BONUS = 50;

/** A release: a = launch vx, b = launch vy, both in 1/256 px a tick. */
export const BINTOSS_INPUT_FLICK = 1;
export const BINTOSS_INPUT_RANGES: readonly InputRange[] = [
  inputRange(BINTOSS_INPUT_FLICK, [-BINTOSS_VX_MAX, BINTOSS_VX_MAX], [-BINTOSS_VY_MAX, 0]),
];

/**
 * The launch speed the reference aim vector produces, in 1/256 px a tick.
 * Solved from this sim's gravity so that a reference-strength aim at 60° lands
 * in the bin on throw five (160 px away) with no wind.
 */
export const BINTOSS_REF_V = 1_169;

/**
 * The wind is a constant sideways acceleration, carried in 1/65536-px units so
 * that its total drift can be pinned exactly. It is calibrated on the flight of
 * the reference throw — the one that lands on the bin: over exactly that many
 * ticks one wind point moves the ball sideways by a quarter of the bin opening,
 * 25 px.
 */
function referenceRimTicks(): number {
  // The 60° reference launch, rising and then falling back to rim height.
  let speed = -Math.round((BINTOSS_REF_V * 866) / 1_000);
  let y = BINTOSS_BALL_Y;
  for (let tick = 1; tick <= 1_000; tick++) {
    speed += BINTOSS_GRAVITY;
    y += speed;
    if (speed > 0 && y >= BINTOSS_RIM_Y) return tick;
  }
  return 70;
}

export const BINTOSS_WIND_TICKS = referenceRimTicks();
export const BINTOSS_WIND_SUB = 256;
export const BINTOSS_WIND_ACC = Math.round(
  (BINTOSS_BIN_HALF * BINTOSS_WIND_SUB) / (BINTOSS_WIND_TICKS * (BINTOSS_WIND_TICKS + 1)),
);

/**
 * Turns the aim vector (finger position minus the anchor, in world pixels) into
 * a launch velocity. Upwards is negative `dy`; a downward vector is clamped to
 * horizontal. Returns null for a drag under the cancel distance.
 */
export function binTossDrag(dx: number, dy: number): DragLaunch | null {
  const launch = dragLaunch(dx, dy, BINTOSS_REF_V);
  if (!launch) return null;
  return {
    ...launch,
    vx: clampInt(launch.vx, -BINTOSS_VX_MAX, BINTOSS_VX_MAX),
    vy: clampInt(launch.vy, -BINTOSS_VY_MAX, -1),
  };
}

/** A ball in flight: launch velocity plus the wind's own integration. */
export interface BinTossFlight {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Sideways speed the wind has built up, in 1/65536 px a tick. */
  windV: number;
  /** Sideways distance the wind has carried, in 1/65536 px. */
  windPos: number;
}

/** One tick of free flight. The single place gravity and wind are integrated. */
export function binTossAdvance(flight: BinTossFlight, wind: number): BinTossFlight {
  const windV = flight.windV + wind * BINTOSS_WIND_ACC;
  const windPos = flight.windPos + windV;
  const drift =
    Math.trunc(windPos / BINTOSS_WIND_SUB) - Math.trunc(flight.windPos / BINTOSS_WIND_SUB);
  const vy = flight.vy + BINTOSS_GRAVITY;
  return {
    x: flight.x + flight.vx + drift,
    y: flight.y + vy,
    vx: flight.vx,
    vy,
    windV,
    windPos,
  };
}

/**
 * Walks a whole flight without touching the simulation — same gravity and same
 * wind integration, so a drawn path matches what the sim will do. Render only.
 */
export function binTossPath(
  vx: number,
  vy: number,
  wind: number,
  stopAtRim: boolean,
): { x: number; y: number }[] {
  let flight: BinTossFlight = {
    x: BINTOSS_BALL_X,
    y: BINTOSS_BALL_Y,
    vx,
    vy,
    windV: 0,
    windPos: 0,
  };
  const points = [{ x: px(flight.x), y: px(flight.y) }];
  for (let tick = 0; tick < BINTOSS_RUN_TICKS; tick++) {
    flight = binTossAdvance(flight, wind);
    points.push({ x: px(flight.x), y: px(flight.y) });
    if (stopAtRim && flight.vy > 0 && flight.y >= BINTOSS_RIM_Y) break;
    if (flight.y >= BINTOSS_FLOOR_Y - BINTOSS_BALL_R) break;
    if (flight.x < -BINTOSS_BALL_R || flight.x > BINTOSS_WORLD_RIGHT + BINTOSS_BALL_R) break;
  }
  return points;
}

/** Where a launch would cross the bin's rim line, in world pixels. Render only. */
export function binTossPredict(vx: number, vy: number, wind: number): { x: number; y: number } {
  const path = binTossPath(vx, vy, wind, true);
  const last = path[path.length - 1]!;
  return { x: Math.round(last.x), y: Math.round(last.y) };
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
  /** Wind for each of the ten throws, −3 … +3. Same for everyone. */
  winds: number[];
  /** 1 for a basket, 0 for a miss, in throw order. */
  results: number[];
  phase: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** The wind's own integration for the throw in flight. */
  windV: number;
  windPos: number;
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
    windV: 0,
    windPos: 0,
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
    windV: 0,
    windPos: 0,
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
        windV: 0,
        windPos: 0,
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
        windV: 0,
        windPos: 0,
      };
    }
    return { ...state, tick };
  }

  // In flight: gravity plus the wind's own exact sideways drift.
  const wind = state.winds[state.throwIndex] ?? 0;
  const advanced = binTossAdvance(
    {
      x: state.x,
      y: state.y,
      vx: state.vx,
      vy: state.vy,
      windV: state.windV,
      windPos: state.windPos,
    },
    wind,
  );
  let vx = advanced.vx;
  let vy = advanced.vy;
  let nx = advanced.x;
  let ny = advanced.y;
  const windV = advanced.windV;
  const windPos = advanced.windPos;
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

  const next: BinTossState = { ...state, tick, vx, vy, windV, windPos, x: nx, y: ny, wobbleTick };

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
  let points = parPoints(baskets, BINTOSS_PAR);
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
  let x = state.x;
  let y = state.y;
  const vx = state.vx;
  let vy = state.vy;
  ctx.save();
  for (let step = 1; step <= 10; step++) {
    x -= vx;
    y -= vy;
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

export interface BinTossLandingPresentation {
  progress: number;
  binCentre: number;
  binIndex: number;
}

/** Draws a walked flight as a dotted arc. Never touches simulation state. */
function drawPath(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  points: { x: number; y: number }[],
  colour: string,
  alpha: number,
): void {
  const { scale, offsetX, offsetY } = binTossTransform(size);
  const first = points[0];
  if (!first) return;
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = colour;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.restore();
}

/** The arc a finished throw took, kept faint until the next release. */
export function binTossDrawGhost(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  ghost: BinTossGhost,
  alpha = 0.22,
): void {
  drawPath(
    ctx,
    size,
    binTossPath(ghost.vx, ghost.vy, ghost.wind, true),
    BINTOSS_BALL_COLOUR,
    alpha,
  );
}

/**
 * The aim path: always the NO-WIND arc for the current drag, drawn its full
 * length down to the floor whatever the wind is. Render only — the sim never
 * sees it, and the wind is what the player has to allow for themselves.
 */
export function binTossDrawAim(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  aim: BinTossGhost,
  cancelled = false,
): void {
  const points = binTossPath(aim.vx, aim.vy, 0, false);
  if (cancelled) drawPath(ctx, size, points, BINTOSS_TEXT, 0.28);
  else drawPath(ctx, size, points, BINTOSS_BALL_COLOUR, 0.5);
}

/** Client-only scored-ball animation layered over the deterministic board. */
export function binTossDrawLanding(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  landing: BinTossLandingPresentation,
): void {
  const { scale, offsetX, offsetY } = binTossTransform(size);
  const p = Math.max(0, Math.min(1, landing.progress));
  const centre = px(landing.binCentre);
  const half = px(BINTOSS_BIN_HALF);
  const rim = px(BINTOSS_RIM_Y);
  const floor = px(BINTOSS_FLOOR_Y);
  const radius = px(BINTOSS_BALL_R);
  let x = centre;
  let y = rim + radius;
  if (p < 0.48) {
    const local = p / 0.48;
    x = centre + half * 0.42 * local;
    y = rim + radius + (floor - rim - radius * 2) * local;
  } else if (p < 0.76) {
    const local = (p - 0.48) / 0.28;
    x = centre + half * 0.42 * (1 - local * 1.55);
    y = floor - radius - Math.sin(local * Math.PI) * 12;
  } else {
    const local = (p - 0.76) / 0.24;
    x = centre - half * 0.23 + half * 0.1 * local;
    y = floor - radius;
  }
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = BINTOSS_BALL_COLOUR;
  ctx.globalAlpha = 0.35 + 0.5 * Math.sin(Math.min(1, p * 1.5) * Math.PI);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(centre, rim, half, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.translate(x, y);
  ctx.rotate(p * Math.PI * 3);
  ctx.fillStyle = BINTOSS_BALL_COLOUR;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
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
