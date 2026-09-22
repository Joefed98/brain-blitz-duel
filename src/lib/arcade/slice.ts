/**
 * Slice — an arcade game on the shared engine.
 *
 * Discs are thrown up from the bottom on a schedule built entirely from the
 * seed, so everyone gets the same objects at the same ticks. The finger's swipe
 * is sent as a segment per tick (kind 8) and tested against every airborne
 * object, so the phone and the server reach the same result from the same log.
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

export const SLICE_WORLD_W = 390;
export const SLICE_WORLD_H = 620;
export const SLICE_HUD_H = 44;

export const SLICE_RUN_SECONDS = 60;
export const SLICE_RUN_TICKS = SLICE_RUN_SECONDS * TICKS_PER_SECOND;

/** One swipe segment per tick: kind 8, start (a, b) to end (c, d) in px. */
export const SLICE_INPUT_SWIPE = 8;

/** Objects are 40 px across. */
export const SLICE_R = 20;
export const SLICE_R_FP = SLICE_R * 256;

/** Gravity, in 1/256 px a tick a tick. */
export const SLICE_GRAV = 16;
/** Launch speed upwards, in 1/256 px a tick. */
export const SLICE_VY_MIN = 1380;
export const SLICE_VY_MAX = 1760;
/** Sideways drift, in 1/256 px a tick. */
export const SLICE_VX_MAX = 620;

/** A launch window is 1.5 s; the number of objects in it grows over the run. */
export const SLICE_WINDOW_TICKS = 90;
export const SLICE_WINDOWS = SLICE_RUN_TICKS / SLICE_WINDOW_TICKS;

/** Bombs are 12% of launches, and never two in the air at once. */
export const SLICE_BOMB_PERCENT = 12;

export const SLICE_SLICE_POINTS = 2;
export const SLICE_MULTI_BONUS = 3;
export const SLICE_MULTI_NEEDED = 3;
export const SLICE_BOMB_PENALTY = 10;

/** How long the bomb flash and the falling halves are drawn for. */
export const SLICE_FLASH_TICKS = 14;
export const SLICE_HALVES_TICKS = 40;

export const SLICE_INPUT_RANGES: readonly InputRange[] = [
  inputRange(
    SLICE_INPUT_SWIPE,
    [0, SLICE_WORLD_W],
    [0, SLICE_WORLD_H],
    [0, SLICE_WORLD_W],
    [0, SLICE_WORLD_H],
  ),
];

/* =============================== Schedule =============================== */

export interface SliceObject {
  launchTick: number;
  /** Launch position and velocity, in 1/256 px. */
  x: number;
  vx: number;
  vy: number;
  /** The last tick this object is on screen for. */
  lastTick: number;
  bomb: boolean;
  colour: number;
}

/** Everything about the throw schedule comes from the seed, once, at init. */
function buildSchedule(seed: number): { rng: number; objects: SliceObject[] } {
  let rng = seed | 0;
  const objects: SliceObject[] = [];
  let bombFreeFrom = 0;

  for (let window = 0; window < SLICE_WINDOWS; window++) {
    const count = 1 + Math.floor((2 * window) / (SLICE_WINDOWS - 1));
    for (let index = 0; index < count; index++) {
      const slot = rngBelow(rng, SLICE_WINDOW_TICKS - 8);
      rng = slot.state;
      const launchTick = window * SLICE_WINDOW_TICKS + 1 + slot.value;

      const spotDraw = rngBelow(rng, SLICE_WORLD_W - 120);
      rng = spotDraw.state;
      const startPx = 60 + spotDraw.value;

      const vyDraw = rngBelow(rng, SLICE_VY_MAX - SLICE_VY_MIN + 1);
      rng = vyDraw.state;
      const vy = -(SLICE_VY_MIN + vyDraw.value);

      const vxDraw = rngBelow(rng, 2 * SLICE_VX_MAX + 1);
      rng = vxDraw.state;
      // Objects thrown from the edges lean back towards the middle.
      const lean = startPx < SLICE_WORLD_W / 2 ? 1 : -1;
      const vx = Math.trunc((vxDraw.value - SLICE_VX_MAX) / 2) + lean * 180;

      const bombDraw = rngBelow(rng, 100);
      rng = bombDraw.state;
      const flightTicks = Math.trunc((2 * -vy) / SLICE_GRAV) + 6;
      const bomb = bombDraw.value < SLICE_BOMB_PERCENT && launchTick >= bombFreeFrom;
      if (bomb) bombFreeFrom = launchTick + flightTicks + 1;

      const colourDraw = rngBelow(rng, SLICE_COLOURS.length);
      rng = colourDraw.state;

      objects.push({
        launchTick,
        x: startPx * 256,
        vx,
        vy,
        lastTick: launchTick + flightTicks,
        bomb,
        colour: colourDraw.value,
      });
    }
  }

  objects.sort((a, b) => a.launchTick - b.launchTick || a.x - b.x);
  return { rng, objects };
}

/** Position of an object at a tick, in 1/256 px. Pure integer arithmetic. */
export function sliceObjectAt(object: SliceObject, tick: number): { x: number; y: number } | null {
  const age = tick - object.launchTick;
  if (age < 0 || tick > object.lastTick) return null;
  const drop = Math.trunc((SLICE_GRAV * age * (age + 1)) / 2);
  return {
    x: object.x + object.vx * age,
    y: (SLICE_WORLD_H + SLICE_R) * 256 + object.vy * age + drop,
  };
}

/* ================================ State ================================ */

export interface SliceState {
  tick: number;
  rng: number;
  objects: SliceObject[];
  /** 0 = still flying or gone, otherwise the tick it was sliced on. */
  slicedAt: number[];
  slices: number;
  bonuses: number;
  bombsHit: number;
  flash: number;
  /** Render only: the last swipe segment, in px. */
  swipe: readonly [number, number, number, number] | null;
}

function init(seed: number): SliceState {
  const schedule = buildSchedule(seed);
  return {
    tick: 0,
    rng: schedule.rng,
    objects: schedule.objects,
    slicedAt: schedule.objects.map(() => 0),
    slices: 0,
    bonuses: 0,
    bombsHit: 0,
    flash: 0,
    swipe: null,
  };
}

function isOver(state: SliceState): boolean {
  return state.tick >= SLICE_RUN_TICKS;
}

/** Total discs in the schedule — bombs are not something to slice. */
export function sliceTotalDiscs(state: SliceState): number {
  return state.objects.reduce((total, object) => total + (object.bomb ? 0 : 1), 0);
}

/** Whether the segment comes within an object's radius. Integer maths only. */
function segmentHits(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
): boolean {
  const r2 = SLICE_R * SLICE_R;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = cx - x1;
  const fy = cy - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return fx * fx + fy * fy <= r2;
  const dot = fx * dx + fy * dy;
  if (dot <= 0) return fx * fx + fy * fy <= r2;
  if (dot >= len2) {
    const gx = cx - x2;
    const gy = cy - y2;
    return gx * gx + gy * gy <= r2;
  }
  const cross = fx * dy - fy * dx;
  return cross * cross <= r2 * len2;
}

function step(state: SliceState, input: ArcadeInputEvent | null): SliceState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const next: SliceState = {
    ...state,
    tick,
    flash: state.flash > 0 ? state.flash - 1 : 0,
    swipe: null,
  };

  if (input && input.k === SLICE_INPUT_SWIPE) {
    next.swipe = [input.a, input.b, input.c, input.d];
    let cut = 0;
    let bombs = 0;
    let slicedAt: number[] | null = null;

    for (let index = 0; index < state.objects.length; index++) {
      if (state.slicedAt[index]) continue;
      const object = state.objects[index]!;
      const at = sliceObjectAt(object, tick);
      if (!at) continue;
      const cx = Math.trunc(at.x / 256);
      const cy = Math.trunc(at.y / 256);
      if (cy - SLICE_R > SLICE_WORLD_H || cy + SLICE_R < SLICE_HUD_H) continue;
      if (!segmentHits(input.a, input.b, input.c, input.d, cx, cy)) continue;
      slicedAt ??= [...state.slicedAt];
      slicedAt[index] = tick;
      if (object.bomb) bombs += 1;
      else cut += 1;
    }

    if (slicedAt) next.slicedAt = slicedAt;
    if (cut > 0) next.slices = state.slices + cut;
    if (cut >= SLICE_MULTI_NEEDED) next.bonuses = state.bonuses + 1;
    if (bombs > 0) {
      next.bombsHit = state.bombsHit + bombs;
      next.flash = SLICE_FLASH_TICKS;
    }
  }

  return next;
}

function score(state: SliceState): number {
  const earned =
    SLICE_SLICE_POINTS * state.slices +
    SLICE_MULTI_BONUS * state.bonuses -
    SLICE_BOMB_PENALTY * state.bombsHit;
  return clampInt(earned, 0, 150);
}

/* ============================= Checkpoints ============================= */

export const SLICE_CHECKPOINT_INTERVAL = 300;

export interface SliceCheckpointState {
  tick: number;
  slices: number;
  bonuses: number;
  bombsHit: number;
  airborne: number;
  /** A fold of which objects have been sliced, so a drift shows up at once. */
  slicedFold: number;
}

export interface SliceCheckpoint extends SliceCheckpointState {
  checksum: number;
}

export function sliceCheckpointState(state: SliceState): SliceCheckpointState {
  let airborne = 0;
  let slicedFold = 0;
  for (let index = 0; index < state.objects.length; index++) {
    if (state.slicedAt[index]) {
      slicedFold = (slicedFold + (index + 1) * state.slicedAt[index]!) | 0;
      continue;
    }
    if (sliceObjectAt(state.objects[index]!, state.tick)) airborne += 1;
  }
  return {
    tick: state.tick,
    slices: state.slices,
    bonuses: state.bonuses,
    bombsHit: state.bombsHit,
    airborne,
    slicedFold,
  };
}

export function sliceCheckpoint(state: SliceState): SliceCheckpoint {
  const snapshot = sliceCheckpointState(state);
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const SLICE_BG = "#0B0B0F";
export const SLICE_GOLD = "#F5B82E";
export const SLICE_COLOURS = ["#2ED3B7", "#F5B82E", "#8B7BF7", "#F2734C"];
export const SLICE_BOMB = "#1B1B24";

function draw(ctx: CanvasRenderingContext2D, state: SliceState, size: CanvasSize): void {
  const scale = Math.min(size.width / SLICE_WORLD_W, size.height / SLICE_WORLD_H);
  const offsetX = (size.width - SLICE_WORLD_W * scale) / 2;
  const offsetY = (size.height - SLICE_WORLD_H * scale) / 2;

  ctx.save();
  ctx.fillStyle = SLICE_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  for (let index = 0; index < state.objects.length; index++) {
    const object = state.objects[index]!;
    const slicedAt = state.slicedAt[index]!;
    if (slicedAt) {
      const age = state.tick - slicedAt;
      if (age > SLICE_HALVES_TICKS) continue;
      const at = sliceObjectAt(object, slicedAt);
      if (!at) continue;
      // Render only: the two halves drift apart and fall away.
      const cx = at.x / 256;
      const cy = at.y / 256 + (age * age) / 20;
      const spread = 3 + age;
      ctx.globalAlpha = Math.max(0, 1 - age / SLICE_HALVES_TICKS);
      ctx.fillStyle = object.bomb
        ? SLICE_BOMB
        : SLICE_COLOURS[object.colour % SLICE_COLOURS.length]!;
      ctx.beginPath();
      ctx.arc(cx - spread, cy, SLICE_R, Math.PI / 2, (3 * Math.PI) / 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + spread, cy, SLICE_R, (3 * Math.PI) / 2, Math.PI / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }

    const at = sliceObjectAt(object, state.tick);
    if (!at) continue;
    const cx = at.x / 256;
    const cy = at.y / 256;
    if (cy - SLICE_R > SLICE_WORLD_H) continue;
    ctx.beginPath();
    ctx.arc(cx, cy, SLICE_R, 0, Math.PI * 2);
    if (object.bomb) {
      ctx.fillStyle = SLICE_BOMB;
      ctx.fill();
      ctx.strokeStyle = "#E0503C";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#E0503C";
      ctx.fillRect(cx - 2, cy - SLICE_R - 8, 4, 8);
    } else {
      ctx.fillStyle = SLICE_COLOURS[object.colour % SLICE_COLOURS.length]!;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (state.swipe) {
    const [x1, y1, x2, y2] = state.swipe;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(224,80,60,${(state.flash / SLICE_FLASH_TICKS) * 0.45})`;
    ctx.fillRect(0, 0, SLICE_WORLD_W, SLICE_WORLD_H);
  }

  ctx.fillStyle = SLICE_BG;
  ctx.fillRect(0, 0, SLICE_WORLD_W, SLICE_HUD_H);
  ctx.fillStyle = SLICE_GOLD;
  ctx.font = "bold 20px ui-monospace, monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(`Sliced ${state.slices}`, 14, SLICE_HUD_H / 2);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  const left = Math.max(0, SLICE_RUN_TICKS - state.tick);
  ctx.fillText(`${Math.ceil(left / TICKS_PER_SECOND)}s`, SLICE_WORLD_W - 14, SLICE_HUD_H / 2);
  ctx.restore();
}

export const sliceGame: ArcadeGame<SliceState, ArcadeInputEvent | null> = {
  key: "slice",
  runTicks: SLICE_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: SLICE_INPUT_RANGES,
};
