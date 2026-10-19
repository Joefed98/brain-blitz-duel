/**
 * Slice — an arcade game on the shared engine.
 *
 * Discs are thrown up from the bottom on a schedule built entirely from the
 * seed, so everyone gets the same objects at the same ticks. The finger's swipe
 * is sent as a segment per tick (kind 8) and tested against every airborne
 * object, so the phone and the server reach the same result from the same log.
 *
 * Two specials sit in that same schedule: slicing FRENZY (multicoloured
 * six-pointed star) opens a three-second burst of bomb-free discs, and slicing
 * SLOW (silver four-pointed star) runs every disc and bomb at 40% speed for
 * four seconds. Slow motion scales a per-object "world age" in tenths of a
 * tick, so it stays integer and identical on the server. Nothing random is
 * drawn during play.
 */

import {
  clampInt,
  inputRange,
  isqrt,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, type BandFields, type BandParts } from "./scoreBands";

/* ============================== Constants ============================== */

export const SLICE_WORLD_W = 390;
export const SLICE_WORLD_H = 620;
export const SLICE_HUD_H = 44;

export const SLICE_RUN_SECONDS = 60;
export const SLICE_RUN_TICKS = SLICE_RUN_SECONDS * TICKS_PER_SECOND;

/** One swipe segment per tick: kind 8, start (a, b) to end (c, d) in px. */
export const SLICE_INPUT_SWIPE = 8;
export const SLICE_INPUT_BEGIN = 9;
export const SLICE_INPUT_END = 10;

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
export const SLICE_SPECIAL_SLOW = 2;
/** sliceRev 2: the mayonnaise bottle ("Squeeze") pulls nearby foods together. */
export const SLICE_SPECIAL_MAYO = 3;

/* -------------------------- sliceRev 2 (Oct 2026) -------------------------- */

/**
 * Stored as puzzle.sliceRev. Rev 2 adds the mayonnaise bottle (same seeded
 * timing as the other two specials: once or twice, never in the first ten
 * seconds) and makes a sliced chilli end the combo as well as cost ten points.
 * Scoring weights and the cap are unchanged. Rounds without sliceRev replay on
 * the original rules.
 */
export const SLICE_REV = 2;
/** The pull: foods within this many px of the bottle when it is cut gather at that spot. */
export const SLICE_MAYO_RADIUS = 170;
export const SLICE_MAYO_TICKS = 72;
export const SLICE_MAYO_RAMP = 12;
/** Gathered foods sit this close (per mille of their natural offset) to the pull point. */
export const SLICE_MAYO_HOLD_PERMILLE = 880;

/** No special appears in the first ten seconds. */
export const SLICE_SPECIAL_EARLIEST = 10 * TICKS_PER_SECOND;
/** A frenzy runs three seconds at eight objects a window, with no bombs. */
export const SLICE_FRENZY_TICKS = 3 * TICKS_PER_SECOND;
export const SLICE_FRENZY_PER_WINDOW = 8;
export const SLICE_FRENZY_COUNT = Math.trunc(
  (SLICE_FRENZY_TICKS * SLICE_FRENZY_PER_WINDOW) / SLICE_WINDOW_TICKS,
);
/** Slow motion: four seconds at 40% (4 tenths of a tick of world time per tick). */
export const SLICE_SLOW_TICKS = 4 * TICKS_PER_SECOND;
export const SLICE_SLOW_TENTHS = 4;
/** Spawns start a few ticks after the special is cut. */
export const SLICE_SPAWN_DELAY = 6;

export const SLICE_SLICE_POINTS = 2;
export const SLICE_MULTI_BONUS = 3;
export const SLICE_MULTI_NEEDED = 3;
export const SLICE_BOMB_PENALTY = 10;
/** Qualifying slices refresh this real-time window. */
export const SLICE_COMBO_TICKS = 10 * TICKS_PER_SECOND;
/** One swipe must cut this many discs to start or extend a combo. */
export const SLICE_COMBO_START = 3;
/** Gold border flash on a combo-starting slice: 0.5 s. */
export const SLICE_COMBO_FLASH_TICKS = 30;
/** A continuous slice path is capped at ¾ of the longer world side. */
export const SLICE_MAX_PATH = Math.trunc((Math.max(SLICE_WORLD_W, SLICE_WORLD_H) * 3) / 4);
export const SLICE_COMBO_MAX = 3;
/** Each recorded segment cuts 25% longer, extended back past its start. */
export const SLICE_REACH_NUM = 5;
export const SLICE_REACH_DEN = 4;
/** sliceRev 4 (Tuning C): each segment cuts 50% longer (extended back past its start)… */
export const SLICE_REACH_V4_NUM = 6;
/** …and the blade is this many px wide either side of the line (foods are hit this much further away). */
export const SLICE_BLADE_V4 = 4;

/** Multiplier for this many qualifying slices in the live window. */
export function sliceMultiplier(streak: number): number {
  return Math.min(SLICE_COMBO_MAX, 1 + streak);
}

/** How long the bomb flash and the falling halves are drawn for. */
export const SLICE_FLASH_TICKS = 14;
export const SLICE_HALVES_TICKS = 40;

export const SLICE_INPUT_RANGES: readonly InputRange[] = [
  inputRange(SLICE_INPUT_BEGIN, [0, SLICE_WORLD_W], [0, SLICE_WORLD_H]),
  inputRange(SLICE_INPUT_END),
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
  /** 0 normal, 1 frenzy, 2 slow motion. */
  special: number;
  /** What slicing this object launches; launch ticks are offsets. */
  payload: SliceObject[];
  /** sliceRev 6 only (taller worlds): the world height it is thrown in; its rise scales with it. Absent = SLICE_WORLD_H. */
  worldH?: number;
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

/** Everything about the throw schedule comes from the seed, once, at init. */
function buildSchedule(seed: number, rev?: number): { rng: number; objects: SliceObject[] } {
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

  // The two specials, once or twice each, never in the first ten seconds (rev 2 adds the mayonnaise after them).
  const specials = rev === SLICE_REV ? [SLICE_SPECIAL_FRENZY, SLICE_SPECIAL_SLOW, SLICE_SPECIAL_MAYO] : [SLICE_SPECIAL_FRENZY, SLICE_SPECIAL_SLOW];
  for (const special of specials) {
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
        special === SLICE_SPECIAL_FRENZY ? buildFrenzyPayload(rng) : { rng, payload: [] };
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

/** World time at a tick, in tenths of a tick: slow-motion windows run at 40%. */
export function sliceWorldTenths(slowFrom: readonly number[], tick: number): number {
  let world = 10 * tick;
  for (const from of slowFrom) {
    const inside = Math.min(Math.max(tick - from, 0), SLICE_SLOW_TICKS);
    world -= (10 - SLICE_SLOW_TENTHS) * inside;
  }
  return world;
}

/** An object's age in world tenths, or null before launch / after it has left. */
function worldAge(object: SliceObject, tick: number, slowFrom: readonly number[]): number | null {
  if (tick < object.launchTick) return null;
  const age = sliceWorldTenths(slowFrom, tick) - sliceWorldTenths(slowFrom, object.launchTick);
  if (age > 10 * (object.lastTick - object.launchTick)) return null;
  return age;
}

/** Position of an object at a tick, in 1/256 px. Pure integer arithmetic. */
export function sliceObjectAt(
  object: SliceObject,
  tick: number,
  slowFrom: readonly number[] = [],
  mayo: readonly number[] = [],
): { x: number; y: number } | null {
  const natural = naturalAt(object, tick, slowFrom);
  if (!natural || mayo.length === 0 || object.bomb || object.special) return natural;
  return slicePulled(object, natural, tick, slowFrom, mayo);
}

function naturalAt(object: SliceObject, tick: number, slowFrom: readonly number[]): { x: number; y: number } | null {
  const age = worldAge(object, tick, slowFrom);
  if (age === null) return null;
  const drop = Math.trunc((SLICE_GRAV * age * (age + 10)) / 200);
  const rise = Math.trunc((object.vy * age) / 10) + drop;
  const worldH = object.worldH;
  return {
    x: object.x + Math.trunc((object.vx * age) / 10),
    // sliceRev 6: thrown from below the taller board and rising in proportion to it, on the same timing.
    y: worldH ? (worldH + SLICE_R) * 256 + Math.trunc((rise * worldH) / SLICE_WORLD_H) : (SLICE_WORLD_H + SLICE_R) * 256 + rise,
  };
}

/** Pull weight (per mille) at `since` ticks into a squeeze: ramp in, hold, ramp out. */
export function sliceMayoWeight(since: number): number {
  if (since < 0 || since >= SLICE_MAYO_TICKS) return 0;
  const edge = Math.min(since + 1, SLICE_MAYO_TICKS - since, SLICE_MAYO_RAMP);
  return Math.trunc((SLICE_MAYO_HOLD_PERMILLE * edge) / SLICE_MAYO_RAMP);
}

/**
 * Rev 2 squeeze: `mayo` holds flattened [tick, x px, y px] for each cut bottle.
 * A food that was airborne, inside the radius when the bottle was cut, and still
 * airborne when the pull ends is drawn toward the cut point for the pull's span.
 */
function slicePulled(object: SliceObject, natural: { x: number; y: number }, tick: number,
  slowFrom: readonly number[], mayo: readonly number[]): { x: number; y: number } {
  let { x, y } = natural;
  for (let k = 0; k + 2 < mayo.length; k += 3) {
    const from = mayo[k]!;
    const weight = sliceMayoWeight(tick - from);
    if (weight === 0) continue;
    const at = naturalAt(object, from, slowFrom);
    if (!at || !naturalAt(object, from + SLICE_MAYO_TICKS, slowFrom)) continue;
    const cx = mayo[k + 1]! * 256, cy = mayo[k + 2]! * 256;
    const dx = Math.trunc((at.x - cx) / 256), dy = Math.trunc((at.y - cy) / 256);
    if (dx * dx + dy * dy > SLICE_MAYO_RADIUS * SLICE_MAYO_RADIUS) continue;
    x += Math.trunc(((cx - x) * weight) / 1000);
    y += Math.trunc(((cy - y) * weight) / 1000);
  }
  return { x, y };
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

export interface SliceState extends BandFields {
  /** sliceRev 4 only (Tuning C): 1 = the wider, longer blade (SLICE_BLADE_V4, SLICE_REACH_V4_NUM). Absent on every earlier round. */
  tunec?: number;
  /** sliceRev 5 only (Tuning F): 1 = the longer slice (SLICE_MAX_PATH_V5). Absent on every earlier round. */
  tunef?: number;
  /** sliceRev 6 only (taller worlds batch 2): the world height in px (SLICE_TALL_H). Absent = SLICE_WORLD_H. */
  worldH?: number;
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
  /** The tick each slow-motion window started on. */
  slowFrom: number[];
  /** sliceRev 2 only (absent on original rounds): the stamp and [tick, x, y] per cut mayonnaise bottle. */
  rev?: number;
  mayo?: number[];
  flash: number;
  /** 1 while a combo is live (started by a 3+ disc swipe). */
  comboLive: number;
  /** Exclusive sim tick when the combo expires. */
  comboUntil: number;
  /** Ticks left of the gold border flash. */
  comboFlash: number;
  /** The continuous slice path: its end point and length so far, in px. */
  strokeX: number;
  strokeY: number;
  strokeLen: number;
  /** Unique discs, credited weight and qualification across this down-to-up path. */
  strokeCuts: number;
  strokeWeighted: number;
  strokeQualified: number;
  strokeActive: number;
  /** Render only: the last swipe segment, in px. */
  swipe: readonly [number, number, number, number] | null;
  /** Fixed at init: every disc the schedule could offer, specials' batches included. */
  available: number;
  /** Qualifying slice count in the live window; weighted slices; best multiplier. */
  streak: number;
  weighted: number;
  bestMult: number;
  missed: number;
}

function init(seed: number): SliceState {
  return initFor(seed);
}

function initFor(seed: number, rev?: number): SliceState {
  const schedule = buildSchedule(seed, rev);
  return {
    tick: 0,
    rng: schedule.rng,
    objects: schedule.objects,
    slicedAt: schedule.objects.map(() => 0),
    slices: 0,
    bonuses: 0,
    bombsHit: 0,
    frenzyFrom: [],
    slowFrom: [],
    flash: 0,
    comboLive: 0,
    comboUntil: 0,
    comboFlash: 0,
    strokeX: -1,
    strokeY: -1,
    strokeLen: 0,
    strokeCuts: 0,
    strokeWeighted: 0,
    strokeQualified: 0,
    strokeActive: 0,
    swipe: null,
    available: scheduleAvailable(schedule.objects),
    streak: 0,
    weighted: 0,
    bestMult: 1,
    missed: 0,
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

/** True while a squeeze (rev 2) is pulling foods together. */
export function sliceMayoOn(state: SliceState, tick: number): boolean {
  const mayo = state.mayo ?? [];
  for (let k = 0; k + 2 < mayo.length; k += 3) if (sliceMayoWeight(tick - mayo[k]!) > 0) return true;
  return false;
}

/** Mayonnaise bottles cut (rev 2; 0 on original rounds). */
export function sliceMayoCount(state: Pick<SliceState, "mayo">): number {
  return Math.trunc((state.mayo?.length ?? 0) / 3);
}

/** True while slow motion is running. */
export function sliceSlowOn(state: SliceState, tick: number): boolean {
  return state.slowFrom.some((from) => tick >= from && tick < from + SLICE_SLOW_TICKS);
}

/**
 * Clips a swipe segment to what is left of the path budget. A segment that
 * starts where the last one ended continues that path; anything else is a new
 * path. Shared by the phone (before recording) and the sim (enforcing it).
 */
export function sliceClipSegment(
  state: Pick<SliceState, "strokeX" | "strokeY" | "strokeLen"> & { strokeActive?: number; tunef?: number },
  a: number,
  b: number,
  c: number,
  d: number,
): { c: number; d: number; length: number; used: number } | null {
  const used = state.strokeActive || (a === state.strokeX && b === state.strokeY) ? state.strokeLen : 0;
  const left = sliceMaxPath(state) - used;
  if (left <= 0) return null;
  const dx = c - a;
  const dy = d - b;
  const length = isqrt(dx * dx + dy * dy);
  if (length <= left) return { c, d, length, used };
  return {
    c: a + Math.trunc((dx * left) / length),
    d: b + Math.trunc((dy * left) / length),
    length: left,
    used,
  };
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

function step(state: SliceState, rawInput: ArcadeInputEvent | null): SliceState {
  let input = rawInput;
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const next: SliceState = {
    ...state,
    tick,
    flash: state.flash > 0 ? state.flash - 1 : 0,
    comboFlash: state.comboFlash > 0 ? state.comboFlash - 1 : 0,
    swipe: null,
  };

  if (tick >= next.comboUntil) {
    next.comboLive = 0;
    next.streak = 0;
    next.comboUntil = 0;
  }

  if (input?.k === SLICE_INPUT_BEGIN || input?.k === SLICE_INPUT_END ||
      (input?.k === SLICE_INPUT_SWIPE && !state.strokeActive && (input.a !== state.strokeX || input.b !== state.strokeY))) {
    next.strokeActive = input.k === SLICE_INPUT_BEGIN ? 1 : 0;
    next.strokeX = input.k === SLICE_INPUT_BEGIN ? input.a : -1;
    next.strokeY = input.k === SLICE_INPUT_BEGIN ? input.b : -1;
    next.strokeLen = 0;
    next.strokeCuts = 0;
    next.strokeWeighted = 0;
    next.strokeQualified = 0;
  }
  const clipped =
    input && input.k === SLICE_INPUT_SWIPE
      ? sliceClipSegment(next, input.a, input.b, input.c, input.d)
      : null;
  if (input && input.k === SLICE_INPUT_SWIPE && clipped) {
    input = { ...input, c: clipped.c, d: clipped.d };
    next.strokeX = input.c;
    next.strokeY = input.d;
    next.strokeLen = clipped.used + clipped.length;
  }
  if (input && input.k === SLICE_INPUT_SWIPE && clipped) {
    // The cut reaches 25% further back along the swipe than the recorded start.
    // sliceRev 4: 50% further back, and a blade SLICE_BLADE_V4 px wide either side of the line.
    const reach = state.tunec ? SLICE_REACH_V4_NUM : SLICE_REACH_NUM;
    const blade = state.tunec ? SLICE_BLADE_V4 : 0;
    const ax = input.c - Math.trunc(((input.c - input.a) * reach) / SLICE_REACH_DEN);
    const ay = input.d - Math.trunc(((input.d - input.b) * reach) / SLICE_REACH_DEN);
    next.swipe = [ax, ay, input.c, input.d];
    let cut = 0;
    let bombs = 0;
    let slicedAt: number[] | null = null;
    const added: SliceObject[] = [];
    const frenzies: number[] = [];
    const slows: number[] = [];
    const mayos: number[] = [];
    const hitDiscs: number[] = [];

    for (let index = 0; index < state.objects.length; index++) {
      if (state.slicedAt[index]) continue;
      const object = state.objects[index]!;
      if (sliceSuppressed(state, object)) continue;
      const at = sliceObjectAt(object, tick, state.slowFrom, state.mayo);
      if (!at) continue;
      const cx = Math.trunc(at.x / 256);
      const cy = Math.trunc(at.y / 256);
      const radius = object.special ? SLICE_SPECIAL_R : SLICE_R;
      if (cy - radius > sliceWorldH(state) || cy + radius < SLICE_HUD_H) continue;
      if (!segmentHits(ax, ay, input.c, input.d, cx, cy, radius + blade)) continue;
      slicedAt ??= [...state.slicedAt];
      slicedAt[index] = tick;
      if (object.bomb) bombs += 1;
      else {
        cut += 1;
        hitDiscs.push(index);
      }
      if (object.special === SLICE_SPECIAL_FRENZY) frenzies.push(tick);
      if (object.special === SLICE_SPECIAL_SLOW) slows.push(tick);
      if (object.special === SLICE_SPECIAL_MAYO) mayos.push(tick, cx, cy);
      for (const item of object.payload) added.push(spawned(item, tick));
    }

    if (slicedAt) next.slicedAt = slicedAt;
    if (frenzies.length > 0) next.frenzyFrom = [...state.frenzyFrom, ...frenzies];
    if (slows.length > 0) next.slowFrom = [...state.slowFrom, ...slows];
    if (mayos.length > 0) next.mayo = [...(state.mayo ?? []), ...mayos];
    // Accumulate every segment of one finger-down/up path; qualify only once.
    next.strokeCuts += cut;
    const qualifies = next.strokeCuts >= SLICE_COMBO_START && next.strokeQualified === 0;
    if (qualifies) {
      next.strokeQualified = 1;
      next.comboLive = 1;
      next.streak += 1;
      next.comboUntil = tick + SLICE_COMBO_TICKS;
      next.comboFlash = SLICE_COMBO_FLASH_TICKS;
    }
    const multiplier = sliceMultiplier(next.streak);
    if (qualifies) {
      // Earlier segments of this qualifying swipe earn its new multiplier too.
      const credit = next.strokeCuts * multiplier;
      next.weighted += credit - next.strokeWeighted;
      next.strokeWeighted = credit;
    } else {
      next.weighted += cut * multiplier;
      next.strokeWeighted += cut * multiplier;
    }
    if (cut > 0) next.bestMult = Math.max(next.bestMult, multiplier);
    if (added.length > 0) {
      next.objects = [...state.objects, ...added];
      next.slicedAt = [...(slicedAt ?? state.slicedAt), ...added.map(() => 0)];
    }
    if (cut > 0) next.slices = state.slices + cut;
    if (qualifies) next.bonuses = state.bonuses + 1;
    if (bombs > 0) {
      next.bombsHit = state.bombsHit + bombs;
      next.flash = SLICE_FLASH_TICKS;
      if (state.rev === SLICE_REV) {
        // Rev 2: a chilli ends the combo, and this swipe cannot start a new one.
        next.comboLive = 0;
        next.streak = 0;
        next.comboUntil = 0;
        next.comboFlash = 0;
        next.strokeQualified = 1;
      }
    }
  }

  // Misses remain diagnostic only: the timer alone governs combo expiry.
  for (let index = 0; index < next.objects.length; index++) {
    const object = next.objects[index]!;
    if (object.bomb || next.slicedAt[index] || tick - 1 < object.launchTick) continue;
    if (worldAge(object, tick - 1, next.slowFrom) === null) continue;
    if (worldAge(object, tick, next.slowFrom) !== null) continue;
    next.missed += 1;
  }

  return next;
}

function score(state: SliceState): number {
  const total = Math.max(1, sliceTotalDiscs(state));
  // 70% at ×2 ≈109; 90% at ×3 reaches the cap. Bombs subtract before clamping.
  const earned = Math.floor((235 * Math.min(state.weighted, total * SLICE_COMBO_MAX)) / (total * SLICE_COMBO_MAX));
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
  streak: number;
  weighted: number;
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
    if (sliceObjectAt(object, state.tick, state.slowFrom, state.mayo)) airborne += 1;
  }
  return {
    tick: state.tick,
    slices: state.slices,
    bonuses: state.bonuses,
    bombsHit: state.bombsHit,
    airborne,
    slicedFold: (slicedFold ^ Math.imul(state.strokeCuts, 31) ^ Math.imul(state.strokeLen, 131) ^ state.strokeWeighted ^ state.strokeQualified ^ state.comboUntil ^ state.strokeActive ^
      Math.imul(sliceMayoCount(state), 7919)) | 0,
    objectCount: state.objects.length,
    frenzies: state.frenzyFrom.length,
    streak: state.streak,
    weighted: state.weighted,
  };
}

export function sliceCheckpoint(state: SliceState): SliceCheckpoint {
  const snapshot = sliceCheckpointState(state);
  let checksum = 0x811c9dc5;
  const values = Object.values(snapshot);
  // sliceRev 4 adds its marker last, so older sums are unchanged.
  if (state.tunec) values.push(state.tunec);
  // sliceRev 5 adds its marker after that.
  if (state.tunef) values.push(state.tunef);
  // sliceRev 6 (taller worlds): the world height, last.
  if (state.worldH) values.push(state.worldH);
  for (const value of values) {
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

export const SLICE_SILVER = "#C9CED6";

/** A star with this many points, centred on (cx, cy). Render only. */
function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, points: number, outer: number, inner: number): void {
  ctx.beginPath();
  for (let point = 0; point < points * 2; point++) {
    const reach = point % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (point * Math.PI) / points;
    const x = cx + Math.cos(angle) * reach;
    const y = cy + Math.sin(angle) * reach;
    if (point === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Frenzy: multicoloured six-pointed star. Slow: silver four-pointed star. Render only. */
function drawSpecial(ctx: CanvasRenderingContext2D, cx: number, cy: number, special: number): void {
  const outer = SLICE_SPECIAL_R + 4;
  if (special === SLICE_SPECIAL_SLOW) {
    starPath(ctx, cx, cy, 4, outer, outer * 0.38);
    ctx.fillStyle = SLICE_SILVER;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }
  starPath(ctx, cx, cy, 6, outer, outer * 0.5);
  ctx.save();
  ctx.clip();
  const wedges = SLICE_RAINBOW.length;
  for (let index = 0; index < wedges; index++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outer + 1, (index * Math.PI * 2) / wedges, ((index + 1) * Math.PI * 2) / wedges);
    ctx.closePath();
    ctx.fillStyle = SLICE_RAINBOW[index]!;
    ctx.fill();
  }
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: SliceState, size: CanvasSize): void {
  // sliceRev 6: the taller board (the original 620 otherwise).
  const SLICE_WORLD_H = sliceWorldH(state);
  const scaleX = size.width / SLICE_WORLD_W;
  const scaleY = size.height / SLICE_WORLD_H;

  ctx.save();
  ctx.fillStyle = SLICE_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.scale(scaleX, scaleY);

  for (let index = 0; index < state.objects.length; index++) {
    const object = state.objects[index]!;
    if (sliceSuppressed(state, object)) continue;
    const slicedAt = state.slicedAt[index]!;
    if (slicedAt) {
      const age = state.tick - slicedAt;
      if (age > SLICE_HALVES_TICKS) continue;
      const at = sliceObjectAt(object, slicedAt, state.slowFrom);
      if (!at) continue;
      // Render only: the two halves drift apart and fall away.
      const cx = at.x / 256;
      const cy = at.y / 256 + (age * age) / 20;
      const spread = 3 + age;
      const radius = object.special ? SLICE_SPECIAL_R : SLICE_R;
      ctx.globalAlpha = Math.max(0, 1 - age / SLICE_HALVES_TICKS);
      ctx.fillStyle = object.bomb
        ? SLICE_BOMB
        : object.special === SLICE_SPECIAL_SLOW
          ? SLICE_SILVER
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

    const at = sliceObjectAt(object, state.tick, state.slowFrom);
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

  // Gold level bar; countdown is combo-only, not the round timer.
  const mult = sliceMultiplier(state.streak);
  const meterTop = SLICE_HUD_H + 28;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(12, meterTop, 64, 6);
  ctx.fillStyle = SLICE_GOLD;
  ctx.fillRect(12, meterTop, 32 * (mult - 1), 6);
  ctx.font = "bold 14px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`×${mult}`, 12, meterTop - 4);
  if (state.comboLive) {
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textBaseline = "top";
    ctx.fillText(`${Math.ceil(Math.max(0, state.comboUntil - state.tick) / TICKS_PER_SECOND)}s`, 12, meterTop + 10);
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
  } else if (sliceSlowOn(state, state.tick)) {
    ctx.fillStyle = SLICE_SILVER;
    ctx.fillText("SLOW", SLICE_WORLD_W / 2, SLICE_HUD_H / 2);
  }
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  // The frame uses the same world bounds as swipe input, not the outer
  // letterboxed canvas. It is drawn on the canvas so it cannot eat pointer input.
  ctx.strokeStyle = "#3A3A44";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, SLICE_WORLD_W - 2, SLICE_WORLD_H - 2);
  if (state.comboFlash > 0) {
    // Gold border flash for a combo-starting swipe.
    ctx.strokeStyle = SLICE_GOLD;
    ctx.globalAlpha = state.comboFlash / SLICE_COMBO_FLASH_TICKS;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, SLICE_WORLD_W - 6, SLICE_WORLD_H - 6);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export const sliceGame: ArcadeGame<SliceState, ArcadeInputEvent | null> = {
  key: "slice",
  runTicks: SLICE_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: SLICE_INPUT_RANGES,
};

const sliceRev2Game: ArcadeGame<SliceState, ArcadeInputEvent | null> = {
  ...sliceGame,
  init: (seed: number) => ({ ...initFor(seed, SLICE_REV), rev: SLICE_REV, mayo: [] }),
};

/** Takes puzzle.sliceRev; anything else is the original kitchen. */
export function sliceGameFor(rev?: number | null): ArcadeGame<SliceState, ArcadeInputEvent | null> {
  if (rev === SLICE_REV_STRICT) return sliceStrictGame;
  if (rev === SLICE_REV_TARGET) return sliceTargetGame;
  if (rev === SLICE_REV_TALL) return sliceTallGame;
  if (rev === SLICE_REV_LONG) return sliceLongGame;
  if (rev === SLICE_REV_TUNEC) return sliceTunecGame;
  if (rev === SLICE_REV_BAND) return sliceBandGame;
  return rev === SLICE_REV ? sliceRev2Game : sliceGame;
}

/* ================= Oct 2026 score bands (sliceRev 3) ================= */

/** Score-band revision (puzzle.sliceRev = 3): rev-2 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const SLICE_REV_BAND = 3;
/** Per mille of the most a run can earn (every food at ×3); 150 at 900. A chilli still costs 10. */
export const SLICE_BAND_CURVE = bandCurve([0, 410, 645, 745, 830, 900], [0, 78, 105, 130, 147, 150]);

export function sliceBandParts(state: SliceState): BandParts {
  const total = Math.max(1, sliceTotalDiscs(state));
  const units = Math.floor((1000 * Math.min(state.weighted, total * SLICE_COMBO_MAX)) / (total * SLICE_COMBO_MAX));
  const chillies = Math.max(0, state.bombsHit);
  return {
    units,
    points: bandPoints(bandCurveOf(state, state.worldH ? SLICE_V6_BAND_CURVE : state.tunec ? SLICE_V4_BAND_CURVE : SLICE_BAND_CURVE), units),
    bonus: 0,
    penalty: SLICE_BOMB_PENALTY * chillies,
    finished: false,
    text: `${state.slices} foods sliced`,
    penaltyText: `${chillies} ${chillies === 1 ? "chilli" : "chillies"}`,
  };
}

function scoreBand(state: SliceState): number {
  return bandTotal(sliceBandParts(state), Boolean(state.acted));
}

export const sliceBandGame: ArcadeGame<SliceState, ArcadeInputEvent | null> = { ...sliceRev2Game, init: (seed) => bandInit(sliceRev2Game.init(seed)) };

/* ================= Tuning C (sliceRev 4, Oct 2026) ================= */

/**
 * sliceRev 4 (Tuning C): sliceRev 3 play with a slightly bigger blade: each
 * recorded segment cuts 50 % further back past its start (was 25 %) and hits
 * anything within SLICE_BLADE_V4 px of the line (chillies too). The art draws
 * the cut that wide. States add `tunec: 1`.
 */
export const SLICE_REV_TUNEC = 4;
/**
 * sliceRev 4 band knots: the bigger blade lifts average and good players about 5
 * points on the sliceRev 3 curve, so the lower knots move up a little to keep the
 * levels where they were (scripts/arcade-skill-bands.ts slice --rev=c); 150 still at 900.
 */
export const SLICE_V4_BAND_CURVE = bandCurve([0, 435, 670, 755, 835, 900], [0, 78, 105, 130, 147, 150]);
export const sliceTunecGame: ArcadeGame<SliceState, ArcadeInputEvent | null> = { ...sliceBandGame, init: (seed) => ({ ...sliceBandGame.init(seed), tunec: 1 }) };

/* ================= Tuning F (sliceRev 5, Oct 2026) ================= */

/**
 * sliceRev 5 (Tuning F): sliceRev 4 play (blade, reach, foods, curve) with a
 * longer slice: one continuous finger-down path may run SLICE_MAX_PATH_V5 px
 * (the world's full height) before the blade lifts, up from ¾ of it. States add `tunef: 1`.
 */
export const SLICE_REV_LONG = 5;
export const SLICE_MAX_PATH_V5 = Math.max(SLICE_WORLD_W, SLICE_WORLD_H);

/** The most one continuous path may cut on this run, in world px (sliceRev 6: the taller world's height). */
export function sliceMaxPath(state: { tunef?: number; worldH?: number }): number {
  if (state.worldH) return Math.max(SLICE_WORLD_W, state.worldH);
  return state.tunef ? SLICE_MAX_PATH_V5 : SLICE_MAX_PATH;
}

export const sliceLongGame: ArcadeGame<SliceState, ArcadeInputEvent | null> = { ...sliceTunecGame, init: (seed) => ({ ...sliceTunecGame.init(seed), tunef: 1 }) };

/* ================= Taller worlds (sliceRev 6, Oct 2026) ================= */

/**
 * sliceRev 6 (taller worlds, batch 2): sliceRev 5 play (the same throws, blade,
 * reach, specials and curve) on a taller board, 390 × SLICE_TALL_H, the same for
 * every player. Every throw starts just below the new bottom and its rise
 * (velocity and gravity alike) is scaled by SLICE_TALL_H ÷ SLICE_WORLD_H, so it
 * climbs proportionally higher and is in the air for exactly as long as before
 * (the same schedule, launch ticks and last ticks). One continuous path may run
 * the taller world's height (730 px). Foods, chillies and specials keep their
 * size and hit radius. Each thrown object (frenzy payloads included) and the
 * state carry `worldH`; the state's is folded into the checkpoint checksum last.
 */
export const SLICE_REV_TALL = 6;
export const SLICE_TALL_H = 730;
/**
 * sliceRev 6 band knots (per mille of the most a run can earn, as before): the
 * taller board spreads the same throws over more height, so the same players
 * cut a little less (scripts/arcade-skill-bands.ts --rev=g2, 60 seeds: unit
 * medians 428 / 688 / 766 / 769 on sliceRev 5, 436 / 668 / 747 / 769 on sliceRev
 * 6). Each knot sits at the new median, its points set so the level's score
 * (after −10 per chilli, which falls outside the curve) lands at 70 / 100 / 125 /
 * 140: measured 70 / 101 / 125 / 139. 150 still at 900 (great and near-perfect
 * players cut almost the same share, so the top knots are close together).
 */
export const SLICE_V6_BAND_CURVE = bandCurve([0, 436, 668, 747, 769, 900], [0, 79, 103, 131, 147, 150]);

/** The world height (px) a state plays in: sliceRev 6's taller board, or the original 620. */
export function sliceWorldH(state: { worldH?: number }): number {
  return state.worldH ?? SLICE_WORLD_H;
}

/** Input bounds on the taller board (the same kinds, y up to its height). */
export const SLICE_TALL_INPUT_RANGES: readonly InputRange[] = [
  inputRange(SLICE_INPUT_BEGIN, [0, SLICE_WORLD_W], [0, SLICE_TALL_H]),
  inputRange(SLICE_INPUT_END),
  inputRange(SLICE_INPUT_SWIPE, [0, SLICE_WORLD_W], [0, SLICE_TALL_H], [0, SLICE_WORLD_W], [0, SLICE_TALL_H]),
];

function tallObject(object: SliceObject): SliceObject {
  return { ...object, payload: object.payload.map(tallObject), worldH: SLICE_TALL_H };
}

export const sliceTallGame: ArcadeGame<SliceState, ArcadeInputEvent | null> = {
  ...sliceLongGame,
  init: (seed) => {
    const base = sliceLongGame.init(seed);
    return { ...base, objects: base.objects.map(tallObject), worldH: SLICE_TALL_H };
  },
  inputRanges: SLICE_TALL_INPUT_RANGES,
};

/** The world height (px) a stored round's sliceRev plays in. */
export function sliceWorldHFor(rev?: number | null): number {
  return rev === SLICE_REV_TALL || rev === SLICE_REV_TARGET || rev === SLICE_REV_STRICT ? SLICE_TALL_H : SLICE_WORLD_H;
}

/* ================= Scoring targets (sliceRev 7, 18 Oct 2026) ================= */

/**
 * sliceRev 7 (scoring targets, docs/scoring-targets.md): sliceRev 6 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const SLICE_REV_TARGET = 7;
export const sliceTargetGame = bandTargetGame(sliceTallGame);
/** The curve new rounds score on: SLICE_V6_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const SLICE_V7_BAND_CURVE = bandRetarget(SLICE_V6_BAND_CURVE);


/* ================= Score bands (sliceRev 8, 19 Oct 2026) ================= */

/**
 * sliceRev 8 (score bands, docs/scoring-targets.md): sliceRev 7 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const SLICE_REV_STRICT = 8;
export const sliceStrictGame = bandStrictGame(sliceTargetGame);
/** The curve new rounds score on: SLICE_V6_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const SLICE_V8_BAND_CURVE = bandStrict(SLICE_V6_BAND_CURVE);
