/**
 * Steady — an arcade game on the shared engine.
 *
 * A winding track scrolls down into a ball that sits on a fixed line near the
 * bottom; the player slides the ball left and right to stay inside. The whole
 * path is built at init from the seed, so everyone traces the same track.
 * Positions are integer 1/256-pixel units and nothing is drawn from the
 * generator during play.
 */

import {
  clampInt,
  inputRange,
  px,
  rngBelow,
  ARCADE_INPUT_DRAG,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";

/* ============================== Constants ============================== */

export const STD_WORLD_W = 390;
export const STD_WORLD_H = 620;
export const STD_HUD_H = 44;

export const STD_RUN_SECONDS = 60;
export const STD_RUN_TICKS = STD_RUN_SECONDS * TICKS_PER_SECOND;

/** The track: 44 px wide, 1 px narrower every 4 seconds, never under 18. */
export const STD_WIDTH_START = 44;
export const STD_WIDTH_MIN = 18;
export const STD_NARROW_TICKS = 4 * TICKS_PER_SECOND;

/** Scroll speed 1.2 px a tick, +0.15 every 5 seconds, capped at 3.0. */
export const STD_SCROLL_START_FP = 307;
export const STD_SCROLL_STEP_FP = 38;
export const STD_SCROLL_STEP_TICKS = 5 * TICKS_PER_SECOND;
export const STD_SCROLL_CAP_FP = 768;

/** The ball sits in the vertical middle of the play area and chases the finger at 4 px a tick. */
export const STD_BALL_Y = Math.trunc((STD_HUD_H + STD_WORLD_H) / 2);
export const STD_DOT_R = 9;
export const STD_DOT_LAG_FP = 1_024;

/** The path is sampled every four pixels of travel. */
export const STD_SAMPLE_PX = 4;
export const STD_SAMPLES = 2_400;
export const STD_EDGE_MARGIN = 46;

/**
 * Touches: while any part of the ball overlaps an edge, one on contact and one
 * every 30 ticks until it is back inside; with no finger down for more than 30
 * ticks, one every 30 ticks until the finger returns.
 */
export const STD_TOUCH_EVERY = 30;

export const STD_PX_PER_POINT = 30;
export const STD_PX_PER_METRE = 40;
/** Score: 150 − 5 per touch, min 0. */
export const STD_TOUCH_PENALTY = 5;

/** Drag: a = x, b = 1 finger down / 0 finger lifted. */
export const STD_INPUT_RANGES: readonly InputRange[] = [
  inputRange(ARCADE_INPUT_DRAG, [0, STD_WORLD_W], [0, 1]),
];

export function stdTrackWidth(tick: number): number {
  const narrower = Math.trunc(tick / STD_NARROW_TICKS);
  return Math.max(STD_WIDTH_MIN, STD_WIDTH_START - narrower);
}

export function stdScrollFp(tick: number): number {
  const faster = Math.trunc(tick / STD_SCROLL_STEP_TICKS);
  return Math.min(STD_SCROLL_CAP_FP, STD_SCROLL_START_FP + STD_SCROLL_STEP_FP * faster);
}

/* ================================ State ================================ */

export interface StdState {
  tick: number;
  rng: number;
  /** Track centre every {@link STD_SAMPLE_PX} pixels, in 1/256 px. */
  path: number[];
  /** Distance scrolled so far, in 1/256 px. */
  travelled: number;
  /** Where the finger is, in whole pixels; held between events. */
  aimX: number;
  /** The ball's x, in 1/256 px; its y is fixed. */
  dx: number;
  touches: number;
  /** Ticks the ball has been overlapping an edge (0 when inside). */
  edgeTicks: number;
  onEdge: boolean;
  /** Whether a finger is down, and ticks since it lifted. */
  down: boolean;
  liftTicks: number;
  flash: number;
  endedTick: number;
}

/** A smooth chain of straights and arcs, built once from the seed. */
function buildPath(seed: number): { rng: number; path: number[] } {
  let rng = seed | 0;
  const path: number[] = [];
  let centre = Math.round(STD_WORLD_W / 2) * 256;
  // Sideways drift a sample, in 1/256 px; changes only between segments.
  let drift = 0;
  let left = 0;
  for (let index = 0; index < STD_SAMPLES; index++) {
    if (left <= 0) {
      const lengthDraw = rngBelow(rng, 30);
      rng = lengthDraw.state;
      left = 14 + lengthDraw.value;
      const kindDraw = rngBelow(rng, 3);
      rng = kindDraw.state;
      if (kindDraw.value === 0) {
        drift = 0;
      } else {
        const bend = rngBelow(rng, 220);
        rng = bend.state;
        const towards = centre > Math.round(STD_WORLD_W / 2) * 256 ? -1 : 1;
        const sideDraw = rngBelow(rng, 4);
        rng = sideDraw.state;
        const side = sideDraw.value === 0 ? -towards : towards;
        drift = side * (60 + bend.value);
      }
    }
    centre += drift;
    const low = STD_EDGE_MARGIN * 256;
    const high = (STD_WORLD_W - STD_EDGE_MARGIN) * 256;
    if (centre < low) {
      centre = low;
      drift = Math.abs(drift);
    } else if (centre > high) {
      centre = high;
      drift = -Math.abs(drift);
    }
    path.push(centre);
    left -= 1;
  }
  return { rng, path };
}

function init(seed: number): StdState {
  const built = buildPath(seed);
  const startX = built.path[Math.trunc((STD_WORLD_H - STD_BALL_Y) / STD_SAMPLE_PX)] ?? 0;
  return {
    tick: 0,
    rng: built.rng,
    path: built.path,
    travelled: 0,
    aimX: Math.round(px(startX)),
    dx: startX,
    touches: 0,
    edgeTicks: 0,
    onEdge: false,
    down: false,
    liftTicks: 0,
    flash: 0,
    endedTick: 0,
  };
}

function isOver(state: StdState): boolean {
  return state.tick >= STD_RUN_TICKS;
}

/** The track centre under a screen y, in 1/256 px. */
export function stdCentreAt(state: StdState, yPx: number): number {
  const travelledPx = Math.trunc(state.travelled / 256);
  const along = travelledPx + (STD_WORLD_H - yPx);
  const index = clampInt(Math.round(along / STD_SAMPLE_PX), 0, STD_SAMPLES - 1);
  return state.path[index] ?? 0;
}

export function stdDistancePx(state: StdState): number {
  return Math.trunc(state.travelled / 256);
}

export function stdMetres(state: StdState): number {
  return Math.trunc(stdDistancePx(state) / STD_PX_PER_METRE);
}

function step(state: StdState, input: ArcadeInputEvent | null): StdState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;

  let aimX = state.aimX;
  let down = state.down;
  if (input && input.k === ARCADE_INPUT_DRAG) {
    aimX = clampInt(input.a, 0, STD_WORLD_W);
    down = clampInt(input.b, 0, 1) === 1;
  }

  // The ball only moves while dragged, chasing the finger four pixels a tick at most.
  const target = aimX * 256;
  const gap = target - state.dx;
  const dx = !down
    ? state.dx
    : gap > STD_DOT_LAG_FP
      ? state.dx + STD_DOT_LAG_FP
      : gap < -STD_DOT_LAG_FP
        ? state.dx - STD_DOT_LAG_FP
        : target;

  const next: StdState = {
    ...state,
    tick,
    aimX,
    dx,
    travelled: state.travelled + stdScrollFp(tick),
    down,
    liftTicks: down ? 0 : state.liftTicks + 1,
    flash: Math.max(0, state.flash - 1),
  };
  let touches = state.touches;

  const halfWidth = Math.trunc((stdTrackWidth(tick) * 256) / 2);
  const centre = stdCentreAt(next, STD_BALL_Y);
  const offset = next.dx - centre;
  const limit = halfWidth - STD_DOT_R * 256;
  if (Math.abs(offset) > limit) {
    // No nudge: the ball stays where it is and keeps costing touches.
    next.edgeTicks = state.edgeTicks + 1;
    next.onEdge = true;
    if ((next.edgeTicks - 1) % STD_TOUCH_EVERY === 0) touches += 1;
  } else {
    next.edgeTicks = 0;
    next.onEdge = false;
  }
  if (next.liftTicks > STD_TOUCH_EVERY && (next.liftTicks - 1) % STD_TOUCH_EVERY === 0) {
    touches += 1;
  }
  if (touches !== state.touches) {
    next.touches = touches;
    next.flash = 10;
  }

  if (tick >= STD_RUN_TICKS) next.endedTick = tick;
  return next;
}

export function stdClean(state: StdState): boolean {
  return state.tick >= STD_RUN_TICKS && state.touches === 0;
}

function score(state: StdState): number {
  return clampInt(150 - STD_TOUCH_PENALTY * state.touches, 0, 150);
}

/* ============================= Checkpoints ============================= */

export const STD_CHECKPOINT_INTERVAL = 300;

export interface StdCheckpointState {
  tick: number;
  dx: number;
  travelled: number;
  touches: number;
  width: number;
  centre: number;
  onEdge: number;
}

export interface StdCheckpoint extends StdCheckpointState {
  checksum: number;
}

export function stdCheckpointState(state: StdState): StdCheckpointState {
  return {
    tick: state.tick,
    dx: state.dx,
    travelled: state.travelled,
    touches: state.touches,
    width: stdTrackWidth(state.tick),
    centre: stdCentreAt(state, STD_BALL_Y),
    onEdge: (state.onEdge ? 1 : 0) + (state.down ? 2 : 0),
  };
}

export function stdCheckpoint(state: StdState): StdCheckpoint {
  const snapshot = stdCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const STD_BG = "#0B0B0F";
export const STD_GOLD = "#F5B82E";
export const STD_DOT = "#2ED3B7";

function draw(ctx: CanvasRenderingContext2D, state: StdState, size: CanvasSize): void {
  const scale = Math.min(size.width / STD_WORLD_W, size.height / STD_WORLD_H);
  const offsetX = (size.width - STD_WORLD_W * scale) / 2;
  const offsetY = (size.height - STD_WORLD_H * scale) / 2;

  ctx.save();
  ctx.fillStyle = STD_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const half = stdTrackWidth(state.tick) / 2;
  const points: { x: number; y: number }[] = [];
  for (let y = STD_HUD_H; y <= STD_WORLD_H; y += 4) {
    points.push({ x: px(stdCentreAt(state, y)), y });
  }

  ctx.fillStyle = "rgba(46, 211, 183, 0.10)";
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x - half, point.y);
    else ctx.lineTo(point.x - half, point.y);
  });
  for (let index = points.length - 1; index >= 0; index--) {
    const point = points[index]!;
    ctx.lineTo(point.x + half, point.y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = STD_GOLD;
  ctx.lineWidth = 2;
  for (const side of [-half, half]) {
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x + side, point.y);
      else ctx.lineTo(point.x + side, point.y);
    });
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(px(state.dx), STD_BALL_Y, STD_DOT_R, 0, Math.PI * 2);
  ctx.fillStyle = state.flash > 0 ? "#FF4D4D" : STD_DOT;
  ctx.fill();

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`${stdMetres(state)} m · ${state.touches} touches`, 14, 14);
  ctx.textAlign = "right";

  ctx.restore();
}

export const steadyGame: ArcadeGame<StdState, ArcadeInputEvent | null> = {
  key: "steady",
  runTicks: STD_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: STD_INPUT_RANGES,
};
