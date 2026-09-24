/**
 * Slice — an arcade game on the shared engine.
 *
 * Discs are thrown up from the bottom on a schedule built entirely from the
 * seed, so everyone gets the same objects at the same ticks. The finger's swipe
 * is sent as a segment per tick (kind 8) and tested against every airborne
 * object, so the phone and the server reach the same result from the same log.
 *
 * Two multicoloured specials sit in that same schedule: slicing FRENZY opens a
 * five-second burst of bomb-free discs, and slicing LINE hangs a row of six
 * across the screen. Both of their spawns are worked out at init from the seed
 * and simply timed off the tick they were sliced on, so nothing random is ever
 * drawn during play.
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

/** Base launch speed (1/256 px a tick), with three seeded classes. */
export const SLICE_LAUNCH_SPEED = 1570;
export const SLICE_SPEED_CLASSES = [75, 100, 140] as const;
export const SLICE_SPECIAL_SPEED_PERCENT = 160;
export const SLICE_SPECIAL_R = 16;
/** cos / sin of 70°..110° in 1/1024 steps — fixed tables, no runtime trig. */
const SLICE_ANGLE_COS: readonly number[] = [
  350, 333, 316, 299, 282, 265, 248, 230, 213, 195, 178, 160, 143, 125, 107, 89, 71, 54, 36, 18, 0,
  -18, -36, -54, -71, -89, -107, -125, -143, -160, -178, -195, -213, -230, -248, -265, -282, -299,
  -316, -333, -350,
];
const SLICE_ANGLE_SIN: readonly number[] = [
  962, 968, 974, 979, 984, 989, 994, 998, 1002, 1005, 1008, 1011, 1014, 1016, 1018, 1020, 1022,
  1023, 1023, 1024, 1024, 1024, 1023, 1023, 1022, 1020, 1018, 1016, 1014, 1011, 1008, 1005, 1002,
  998, 994, 989, 984, 979, 974, 968, 962,
];

/** A launch window is 1.5 s; the number of objects in it grows over the run. */
export const SLICE_WINDOW_TICKS = 90;
export const SLICE_WINDOWS = SLICE_RUN_TICKS / SLICE_WINDOW_TICKS;
/** One object a window at the start, four a window by the end. */
export const SLICE_PER_WINDOW_START = 1;
export const SLICE_PER_WINDOW_END = 4;

/** Bombs are 12% of launches, and never two in the air at once. */
export const SLICE_BOMB_PERCENT = 12;

/* ------------------------------- Specials ------------------------------ */

export const SLICE_SPECIAL_NONE = 0;
export const SLICE_SPECIAL_FRENZY = 1;
export const SLICE_SPECIAL_LINE = 2;

/** No special appears in the first ten seconds. */
export const SLICE_SPECIAL_EARLIEST = 10 * TICKS_PER_SECOND;
/** A frenzy runs five seconds at eight objects a window, with no bombs. */
export const SLICE_FRENZY_TICKS = 5 * TICKS_PER_SECOND;
export const SLICE_FRENZY_PER_WINDOW = 8;
export const SLICE_FRENZY_COUNT = Math.trunc(
  (SLICE_FRENZY_TICKS * SLICE_FRENZY_PER_WINDOW) / SLICE_WINDOW_TICKS,
);
/** A line is six discs that rise together and hang for two seconds. */
export const SLICE_LINE_COUNT = 6;
export const SLICE_LINE_RISE_TICKS = 24;
export const SLICE_LINE_HANG_TICKS = 72;
export const SLICE_LINE_Y = 250;
export const SLICE_LINE_FIRST_X = 45;
export const SLICE_LINE_GAP_X = 60;
/** Spawns start a few ticks after the special is cut. */
export const SLICE_SPAWN_DELAY = 6;

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
  /** 0 normal, 1 frenzy, 2 line. */
  special: number;
  /** 1 for a disc that rises to a fixed line and hangs there. */
  hang: number;
  /** The line a hanging disc holds, in 1/256 px. */
  targetY: number;
  /** What slicing this object launches; launch ticks are offsets. */
  payload: SliceObject[];
}

/** One throw's spot and velocity, drawn from the seed. */
function rollFlight(
  rng: number,
  speedPercent: number,
): {
  rng: number;
  startPx: number;
  vx: number;
  vy: number;
  flightTicks: number;
} {
  let state = rng;
  const spotDraw = rngBelow(state, SLICE_WORLD_W - 120);
  state = spotDraw.state;
  const startPx = 60 + spotDraw.value;

  // Speed class and angle are determined at init. Integer table maths only.
  const speed = Math.trunc((SLICE_LAUNCH_SPEED * speedPercent) / 100);
  const angleDraw = rngBelow(state, SLICE_ANGLE_COS.length);
  state = angleDraw.state;
  let vx = Math.trunc((speed * (SLICE_ANGLE_COS[angleDraw.value] ?? 0)) / 1024);
  const vy = -Math.trunc((speed * (SLICE_ANGLE_SIN[angleDraw.value] ?? 1024)) / 1024);
  // Objects thrown right at an edge never head straight out of it.
  if ((startPx < 120 && vx < 0) || (startPx > SLICE_WORLD_W - 120 && vx > 0)) vx = -vx;

  const flightTicks = Math.trunc((2 * -vy) / SLICE_GRAV) + 6;
  return { rng: state, startPx, vx, vy, flightTicks };
}

function plainObject(
  launchTick: number,
  startPx: number,
  vx: number,
  vy: number,
  flightTicks: number,
  bomb: boolean,
  colour: number,
): SliceObject {
  return {
    launchTick,
    x: startPx * 256,
    vx,
    vy,
    lastTick: launchTick + flightTicks,
    bomb,
    colour,
    special: SLICE_SPECIAL_NONE,
    hang: 0,
    targetY: 0,
    payload: [],
  };
}

/** The bomb-free burst a frenzy releases, with launch ticks as offsets. */
function buildFrenzyPayload(rng: number): { rng: number; payload: SliceObject[] } {
  let state = rng;
  const payload: SliceObject[] = [];
  for (let index = 0; index < SLICE_FRENZY_COUNT; index++) {
    const offset =
      SLICE_SPAWN_DELAY + Math.trunc((index * SLICE_FRENZY_TICKS) / SLICE_FRENZY_COUNT);
    const flight = rollFlight(state, SLICE_SPEED_CLASSES[index % SLICE_SPEED_CLASSES.length]!);
    state = flight.rng;
    const colourDraw = rngBelow(state, SLICE_COLOURS.length);
    state = colourDraw.state;
    payload.push(
      plainObject(
        offset,
        flight.startPx,
        flight.vx,
        flight.vy,
        flight.flightTicks,
        false,
        colourDraw.value,
      ),
    );
  }
  return { rng: state, payload };
}

/** The six discs a line releases: they rise together, then hang for two seconds. */
function buildLinePayload(rng: number): { rng: number; payload: SliceObject[] } {
  let state = rng;
  const payload: SliceObject[] = [];
  for (let index = 0; index < SLICE_LINE_COUNT; index++) {
    const colourDraw = rngBelow(state, SLICE_COLOURS.length);
    state = colourDraw.state;
    payload.push({
      launchTick: SLICE_SPAWN_DELAY,
      x: (SLICE_LINE_FIRST_X + index * SLICE_LINE_GAP_X) * 256,
      vx: 0,
      vy: 0,
      lastTick: SLICE_SPAWN_DELAY + SLICE_LINE_RISE_TICKS + SLICE_LINE_HANG_TICKS,
      bomb: false,
      colour: colourDraw.value,
      special: SLICE_SPECIAL_NONE,
      hang: 1,
      targetY: SLICE_LINE_Y * 256,
      payload: [],
    });
  }
  return { rng: state, payload };
}

/** Everything about the throw schedule comes from the seed, once, at init. */
function buildSchedule(seed: number): { rng: number; objects: SliceObject[] } {
  let rng = seed | 0;
  const objects: SliceObject[] = [];
  let bombFreeFrom = 0;
  let ordinaryIndex = 0;
  let speedClasses = [0, 1, 2];

  for (let window = 0; window < SLICE_WINDOWS; window++) {
    const span = SLICE_PER_WINDOW_END - SLICE_PER_WINDOW_START;
    const count = SLICE_PER_WINDOW_START + Math.floor((span * window) / (SLICE_WINDOWS - 1));
    for (let index = 0; index < count; index++) {
      const slot = rngBelow(rng, SLICE_WINDOW_TICKS - 8);
      rng = slot.state;
      const launchTick = window * SLICE_WINDOW_TICKS + 1 + slot.value;

      if (ordinaryIndex % 3 === 0) {
        speedClasses = [0, 1, 2];
        for (let i = 2; i > 0; i--) {
          const pick = rngBelow(rng, i + 1);
          rng = pick.state;
          [speedClasses[i], speedClasses[pick.value]] = [
            speedClasses[pick.value]!,
            speedClasses[i]!,
          ];
        }
      }
      const flight = rollFlight(rng, SLICE_SPEED_CLASSES[speedClasses[ordinaryIndex % 3] ?? 1]!);
      ordinaryIndex++;
      rng = flight.rng;

      const bombDraw = rngBelow(rng, 100);
      rng = bombDraw.state;
      const bomb = bombDraw.value < SLICE_BOMB_PERCENT && launchTick >= bombFreeFrom;
      if (bomb) bombFreeFrom = launchTick + flight.flightTicks + 1;

      const colourDraw = rngBelow(rng, SLICE_COLOURS.length);
      rng = colourDraw.state;

      objects.push(
        plainObject(
          launchTick,
          flight.startPx,
          flight.vx,
          flight.vy,
          flight.flightTicks,
          bomb,
          colourDraw.value,
        ),
      );
    }
  }

  // The two specials, once or twice each, never in the first ten seconds.
  for (const special of [SLICE_SPECIAL_FRENZY, SLICE_SPECIAL_LINE]) {
    const countDraw = rngBelow(rng, 2);
    rng = countDraw.state;
    const count = 1 + countDraw.value;
    for (let index = 0; index < count; index++) {
      const span = SLICE_RUN_TICKS - SLICE_SPECIAL_EARLIEST - 240;
      const tickDraw = rngBelow(rng, span);
      rng = tickDraw.state;
      const launchTick = SLICE_SPECIAL_EARLIEST + tickDraw.value;

      const flight = rollFlight(rng, SLICE_SPECIAL_SPEED_PERCENT);
      rng = flight.rng;

      const built =
        special === SLICE_SPECIAL_FRENZY ? buildFrenzyPayload(rng) : buildLinePayload(rng);
      rng = built.rng;

      const object = plainObject(
        launchTick,
        flight.startPx,
        flight.vx,
        flight.vy,
        flight.flightTicks,
        false,
        0,
      );
      object.special = special;
      object.payload = built.payload;
      objects.push(object);
    }
  }

  objects.sort((a, b) => a.launchTick - b.launchTick || a.x - b.x || a.special - b.special);
  return { rng, objects };
}

/** Position of an object at a tick, in 1/256 px. Pure integer arithmetic. */
export function sliceObjectAt(object: SliceObject, tick: number): { x: number; y: number } | null {
  const age = tick - object.launchTick;
  if (age < 0 || tick > object.lastTick) return null;
  if (object.hang) {
    const start = (SLICE_WORLD_H + SLICE_R) * 256;
    const y =
      age >= SLICE_LINE_RISE_TICKS
        ? object.targetY
        : start + Math.trunc(((object.targetY - start) * age) / SLICE_LINE_RISE_TICKS);
    return { x: object.x, y };
  }
  const drop = Math.trunc((SLICE_GRAV * age * (age + 1)) / 2);
  return {
    x: object.x + object.vx * age,
    y: (SLICE_WORLD_H + SLICE_R) * 256 + object.vy * age + drop,
  };
}

/** A payload object, timed off the tick its special was sliced on. */
function spawned(object: SliceObject, tick: number): SliceObject {
  return {
    ...object,
    launchTick: tick + object.launchTick,
    lastTick: tick + object.lastTick,
    payload: [],
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
  /** The tick each frenzy started on; during one, scheduled bombs stay away. */
  frenzyFrom: number[];
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
    frenzyFrom: [],
    flash: 0,
    swipe: null,
    available: scheduleAvailable(schedule.objects),
  };
}

/**
 * Every disc the run could offer: each non-bomb in the schedule (specials
 * included) plus every disc a special would release, sliced or not.
 */
function scheduleAvailable(objects: readonly SliceObject[]): number {
  let total = 0;
  for (const object of objects) {
    if (object.bomb) continue;
    total += 1;
    for (const item of object.payload) if (!item.bomb) total += 1;
  }
  return total;
}

function isOver(state: SliceState): boolean {
  return state.tick >= SLICE_RUN_TICKS;
}

/** True while a frenzy is running. */
export function sliceFrenzyOn(state: SliceState, tick: number): boolean {
  return state.frenzyFrom.some((from) => tick >= from && tick < from + SLICE_FRENZY_TICKS);
}

/** A bomb launched inside a frenzy never appears at all. */
export function sliceSuppressed(state: SliceState, object: SliceObject): boolean {
  if (!object.bomb) return false;
  return state.frenzyFrom.some(
    (from) => object.launchTick >= from && object.launchTick < from + SLICE_FRENZY_TICKS,
  );
}

/** Total discs in the schedule — bombs are not something to slice. */
export function sliceTotalDiscs(state: SliceState): number {
  return state.available;
}

/** Whether the segment comes within an object's radius. Integer maths only. */
function segmentHits(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const r2 = radius * radius;
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
    const added: SliceObject[] = [];
    const frenzies: number[] = [];

    for (let index = 0; index < state.objects.length; index++) {
      if (state.slicedAt[index]) continue;
      const object = state.objects[index]!;
      if (sliceSuppressed(state, object)) continue;
      const at = sliceObjectAt(object, tick);
      if (!at) continue;
      const cx = Math.trunc(at.x / 256);
      const cy = Math.trunc(at.y / 256);
      const radius = object.special ? SLICE_SPECIAL_R : SLICE_R;
      if (cy - radius > SLICE_WORLD_H || cy + radius < SLICE_HUD_H) continue;
      if (!segmentHits(input.a, input.b, input.c, input.d, cx, cy, radius)) continue;
      slicedAt ??= [...state.slicedAt];
      slicedAt[index] = tick;
      if (object.bomb) bombs += 1;
      else cut += 1;
      if (object.special === SLICE_SPECIAL_FRENZY) frenzies.push(tick);
      for (const item of object.payload) added.push(spawned(item, tick));
    }

    if (slicedAt) next.slicedAt = slicedAt;
    if (frenzies.length > 0) next.frenzyFrom = [...state.frenzyFrom, ...frenzies];
    if (added.length > 0) {
      next.objects = [...state.objects, ...added];
      next.slicedAt = [...(slicedAt ?? state.slicedAt), ...added.map(() => 0)];
    }
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
  const total = Math.max(1, sliceTotalDiscs(state));
  const earned = Math.floor((150 * Math.min(state.slices, total)) / total);
  return clampInt(earned - SLICE_BOMB_PENALTY * state.bombsHit, 0, 150);
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
  /** How many objects are in the schedule, specials' spawns included. */
  objectCount: number;
  frenzies: number;
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
    const object = state.objects[index]!;
    if (sliceSuppressed(state, object)) continue;
    if (sliceObjectAt(object, state.tick)) airborne += 1;
  }
  return {
    tick: state.tick,
    slices: state.slices,
    bonuses: state.bonuses,
    bombsHit: state.bombsHit,
    airborne,
    slicedFold,
    objectCount: state.objects.length,
    frenzies: state.frenzyFrom.length,
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
export const SLICE_RAINBOW = ["#FF4D4D", "#FFE600", "#3DDC84", "#4D8CFF", "#B26BFF"];
export const SLICE_BOMB = "#1B1B24";

/** A multicoloured disc with a star (frenzy) or a bar (line). Render only. */
function drawSpecial(ctx: CanvasRenderingContext2D, cx: number, cy: number, special: number): void {
  const wedges = SLICE_RAINBOW.length;
  for (let index = 0; index < wedges; index++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(
      cx,
      cy,
      SLICE_SPECIAL_R,
      (index * Math.PI * 2) / wedges,
      ((index + 1) * Math.PI * 2) / wedges,
    );
    ctx.closePath();
    ctx.fillStyle = SLICE_RAINBOW[index]!;
    ctx.fill();
  }
  ctx.fillStyle = "#0B0B0F";
  if (special === SLICE_SPECIAL_LINE) {
    ctx.fillRect(cx - 9, cy - 2, 18, 4);
    return;
  }
  ctx.beginPath();
  for (let point = 0; point < 10; point++) {
    const reach = point % 2 === 0 ? 11 : 5;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const x = cx + Math.cos(angle) * reach;
    const y = cy + Math.sin(angle) * reach;
    if (point === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

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
    if (sliceSuppressed(state, object)) continue;
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
      const radius = object.special ? SLICE_SPECIAL_R : SLICE_R;
      ctx.globalAlpha = Math.max(0, 1 - age / SLICE_HALVES_TICKS);
      ctx.fillStyle = object.bomb
        ? SLICE_BOMB
        : object.special !== SLICE_SPECIAL_NONE
          ? SLICE_RAINBOW[0]!
          : SLICE_COLOURS[object.colour % SLICE_COLOURS.length]!;
      ctx.beginPath();
      ctx.arc(cx - spread, cy, radius, Math.PI / 2, (3 * Math.PI) / 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + spread, cy, radius, (3 * Math.PI) / 2, Math.PI / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }

    const at = sliceObjectAt(object, state.tick);
    if (!at) continue;
    const cx = at.x / 256;
    const cy = at.y / 256;
    if (cy - SLICE_R > SLICE_WORLD_H) continue;
    if (object.special !== SLICE_SPECIAL_NONE) {
      drawSpecial(ctx, cx, cy, object.special);
      continue;
    }
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
  ctx.textAlign = "center";
  if (sliceFrenzyOn(state, state.tick)) {
    ctx.fillStyle = SLICE_RAINBOW[2]!;
    ctx.fillText("FRENZY", SLICE_WORLD_W / 2, SLICE_HUD_H / 2);
  }
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
