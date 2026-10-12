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
  finishScore,
  dragLaunch,
  inputRange,
  isqrt,
  px,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type DragLaunch,
  type InputRange,
} from "./engine";
import { icos, isin } from "./trig";

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

/** The bin: an 80 px opening, 70 px tall, standing on the floor. */
export const BINTOSS_BIN_HALF = 10_240;
/** The ball centre must cross at least 10 px inside either rim edge. */
export const BINTOSS_RIM_INSET = 2_560;
/** From this throw (0-based) the opening narrows to 68 px. */
export const BINTOSS_NARROW_FROM = 3;
export const BINTOSS_NARROW_HALF = 8_704;
/** From this throw (0-based) the bin slides side to side. */
export const BINTOSS_SLIDE_FROM = 6;
/** Slide amplitude 40–70 px, period 2.0–2.8 s (ticks), both seeded. */
export const BINTOSS_SLIDE_AMP_MIN = 40;
export const BINTOSS_SLIDE_AMP_MAX = 70;
export const BINTOSS_SLIDE_PERIOD_MIN = 120;
export const BINTOSS_SLIDE_PERIOD_MAX = 168;
/** The bin's right edge never passes this (6 px inside the world). */
export const BINTOSS_SLIDE_RIGHT = 98_304;
export const BINTOSS_BIN_H = 17_920;
export const BINTOSS_RIM_Y = 110_080;

/** Downward acceleration each tick. */
export const BINTOSS_GRAVITY = 22;
/** Wind is ±1 … ±4 (never 0), drawn from the seeded PRNG so it is the same for everyone. */
export const BINTOSS_WIND_MAX = 4;

/** Launch clamps: 10 px a tick sideways, 15 px a tick upwards. */
export const BINTOSS_VX_MAX = 2_560;
export const BINTOSS_VY_MAX = 3_840;

/** The next ball appears this many ticks after the last one finished. */
export const BINTOSS_NEXT_DELAY = 20;

/** Bin distances from the ball: 135 px growing by 15 px a throw, up to 270 px. */
export const BINTOSS_FIRST_DIST = 34_560;
export const BINTOSS_DIST_STEP = 3_840;

export const BINTOSS_BASKET_POINTS = 10;
/** Par: ten baskets = 110. */
export const BINTOSS_PAR = 10;

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
export const BINTOSS_WIND_ACC_NARROW = Math.round(
  (BINTOSS_NARROW_HALF * BINTOSS_WIND_SUB) / (BINTOSS_WIND_TICKS * (BINTOSS_WIND_TICKS + 1)),
);

/**
 * Smaller-bucket revision (stored as puzzle.binRev): opening, narrowed opening
 * and rim inset all scaled to 85 % about the same centre. Wind, slides, ball
 * and scoring are unchanged. Rounds without binRev replay on the original bin.
 */
export const BINTOSS_REV2 = 2;
/**
 * Hoop-and-spinner revision (stored as puzzle.binRev = 3), on the rev-2 bucket:
 * a bonus hoop above the bucket on three of throws 2–5, a spinning blocker in
 * front of it on three of throws 6–10, and wind rescaled so one wind point is a
 * quarter of the rev-2 bucket width. Winds and slides are drawn exactly as
 * before; the new draws continue the same PRNG stream after them.
 */
export const BINTOSS_REV3 = 3;
/** The revision new rounds are stamped with. */
export const BINTOSS_REV = BINTOSS_REV3;
export const BINTOSS_BIN_HALF_V2 = 8_704; // 34 px (was 40 px)
export const BINTOSS_NARROW_HALF_V2 = 7_398; // ≈28.9 px (was 34 px)
export const BINTOSS_RIM_INSET_V2 = 2_176; // 8.5 px (was 10 px)

/** Half the bin opening for this throw. */
export function binTossHalf(index: number, rev?: number): number {
  if (rev === BINTOSS_REV2 || rev === BINTOSS_REV3) return index >= BINTOSS_NARROW_FROM ? BINTOSS_NARROW_HALF_V2 : BINTOSS_BIN_HALF_V2;
  return index >= BINTOSS_NARROW_FROM ? BINTOSS_NARROW_HALF : BINTOSS_BIN_HALF;
}

/** How far inside the rim edge the ball centre must cross to count. */
export function binTossRimInset(rev?: number): number {
  return rev === BINTOSS_REV2 || rev === BINTOSS_REV3 ? BINTOSS_RIM_INSET_V2 : BINTOSS_RIM_INSET;
}

/**
 * Rev 3: the same calibration on the rev-2 bucket, made exact. The wind is
 * carried in units of 1/(T(T+1)/2) of 1/256 px (T = the reference flight's
 * ticks), so one wind point's acceleration is simply a quarter of the bucket
 * width and its drift over that flight is exactly that quarter, with no
 * rounding.
 */
export const BINTOSS_WIND_SUB_V3 = (BINTOSS_WIND_TICKS * (BINTOSS_WIND_TICKS + 1)) / 2;
export const BINTOSS_WIND_ACC_V3 = BINTOSS_BIN_HALF_V2 / 2;
export const BINTOSS_WIND_ACC_NARROW_V3 = BINTOSS_NARROW_HALF_V2 / 2;

/** The wind's sub-unit for a revision (see BINTOSS_WIND_SUB_V3). */
export function binTossWindSub(rev?: number): number {
  return rev === BINTOSS_REV3 ? BINTOSS_WIND_SUB_V3 : BINTOSS_WIND_SUB;
}

/**
 * One wind point's acceleration for this throw: a quarter of its bucket width
 * (rev 3), or of the original bucket width (unstamped and rev 2 rounds).
 */
export function binTossWindAcc(index: number, rev?: number): number {
  if (rev === BINTOSS_REV3) return index >= BINTOSS_NARROW_FROM ? BINTOSS_WIND_ACC_NARROW_V3 : BINTOSS_WIND_ACC_V3;
  return index >= BINTOSS_NARROW_FROM ? BINTOSS_WIND_ACC_NARROW : BINTOSS_WIND_ACC;
}

/* ------------------------- Rev 3: hoop and spinner ------------------------ */

/** Hoops on three of throws 2–5 (0-based 1–4): never a sliding or spinner throw. */
export const BINTOSS_HOOP_FROM = 1;
export const BINTOSS_HOOP_TO = 4;
export const BINTOSS_HOOP_COUNT = 3;
/** Opening half-width and the two rim caps that the ball bounces off, 1/256 px. */
export const BINTOSS_HOOP_HALF = 5_632; // 22 px
export const BINTOSS_HOOP_CAP_R = 768; // 3 px
/** Hoop height above the bucket rim: 64–100 px, seeded. */
export const BINTOSS_HOOP_LIFT_MIN = 64;
export const BINTOSS_HOOP_LIFT_SPAN = 37;
/** Extra points for a ball that goes through the hoop and then into the bucket. */
export const BINTOSS_HOOP_POINTS = 3;

/** Spinners on three of throws 6–10 (0-based 5–9). */
export const BINTOSS_SPIN_FROM = 5;
export const BINTOSS_SPIN_COUNT = 3;
/** Pivot 22 px in front of the bucket's near rim edge and 46 px above the rim; it rides with the bucket. */
export const BINTOSS_SPIN_GAP = 5_632;
export const BINTOSS_SPIN_LIFT = 11_776;
/** Bar half-length 24 px, half-thickness 3 px. */
export const BINTOSS_SPIN_HALF = 6_144;
export const BINTOSS_SPIN_THICK = 768;
/** One full turn every 128 ticks (about 2.1 s): 512 angle units a tick. */
export const BINTOSS_SPIN_RATE = 512;

export interface BinTossHoop {
  /** Hoop centre, 1/256 px. */
  x: number;
  y: number;
}

export interface BinTossSpinner {
  /** Starting angle (65536 a turn) and turning direction ±1, seeded. */
  phase: number;
  dir: number;
}

/** The two hoop rim caps, 1/256 px. */
export function binTossHoopCaps(hoop: BinTossHoop): [number, number][] {
  return [
    [hoop.x - BINTOSS_HOOP_HALF, hoop.y],
    [hoop.x + BINTOSS_HOOP_HALF, hoop.y],
  ];
}

/** Spinner pivot for this throw at this tick (it rides with the sliding bucket), 1/256 px. */
export function binTossSpinPivot(state: Pick<BinTossState, "slides" | "rev">, index: number, tick: number): { x: number; y: number } {
  const centre = binTossCentreAt(state, index, tick);
  return { x: centre - binTossHalf(index, state.rev) - BINTOSS_SPIN_GAP, y: BINTOSS_RIM_Y - BINTOSS_SPIN_LIFT };
}

/** Spinner bar angle at a sim tick: fixed speed, no randomness after init. */
export function binTossSpinAngle(spinner: BinTossSpinner, tick: number): number {
  return (spinner.phase + spinner.dir * BINTOSS_SPIN_RATE * tick) & 65535;
}

/** The bar's two end points, 1/256 px. */
export function binTossSpinEnds(
  state: Pick<BinTossState, "slides" | "rev">,
  index: number,
  spinner: BinTossSpinner,
  tick: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const pivot = binTossSpinPivot(state, index, tick);
  const angle = binTossSpinAngle(spinner, tick);
  const dx = Math.trunc((BINTOSS_SPIN_HALF * icos(angle)) / 16_384);
  const dy = Math.trunc((BINTOSS_SPIN_HALF * isin(angle)) / 16_384);
  return { x0: pivot.x - dx, y0: pivot.y - dy, x1: pivot.x + dx, y1: pivot.y + dy };
}

/** Closest point on a segment to (x, y), integer maths only. */
function closestOnSegment(x: number, y: number, x0: number, y0: number, x1: number, y1: number): { x: number; y: number } {
  const ex = x1 - x0;
  const ey = y1 - y0;
  const len2 = ex * ex + ey * ey;
  if (len2 <= 0) return { x: x0, y: y0 };
  // Work in 1/1024 of the segment so the products stay well inside 2^53.
  const t = clampInt(Math.trunc((((x - x0) * ex + (y - y0) * ey) * 1024) / len2), 0, 1024);
  return { x: x0 + Math.trunc((ex * t) / 1024), y: y0 + Math.trunc((ey * t) / 1024) };
}

/**
 * Bounces the ball off a round obstacle point (a hoop cap or the spinner bar's
 * nearest point) with this reach. Pushes the ball out to the surface and
 * reflects the inward part of its speed at half strength. Returns true on a hit.
 */
function bounceOff(
  ball: { x: number; y: number; vx: number; vy: number },
  cx: number,
  cy: number,
  reach: number,
): boolean {
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  if (Math.abs(dx) >= reach || Math.abs(dy) >= reach) return false;
  const d = isqrt(dx * dx + dy * dy);
  if (d >= reach) return false;
  const nx = d > 0 ? Math.trunc((dx * 1024) / d) : 0;
  const ny = d > 0 ? Math.trunc((dy * 1024) / d) : -1024;
  ball.x = cx + Math.trunc((nx * reach) / 1024);
  ball.y = cy + Math.trunc((ny * reach) / 1024);
  const vn = Math.trunc((ball.vx * nx + ball.vy * ny) / 1024);
  if (vn < 0) {
    // Reflect and keep half: v −= 1.5 × vn × n.
    const k = vn + (vn >> 1);
    ball.vx = Math.trunc(ball.vx - (k * nx) / 1024);
    ball.vy = Math.trunc(ball.vy - (k * ny) / 1024);
  }
  return true;
}

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
export function binTossAdvance(
  flight: BinTossFlight,
  wind: number,
  windAcc: number = BINTOSS_WIND_ACC,
  sub: number = BINTOSS_WIND_SUB,
): BinTossFlight {
  const windV = flight.windV + wind * windAcc;
  const windPos = flight.windPos + windV;
  const drift =
    Math.trunc(windPos / sub) - Math.trunc(flight.windPos / sub);
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
  windAcc: number = BINTOSS_WIND_ACC,
  sub: number = BINTOSS_WIND_SUB,
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
    flight = binTossAdvance(flight, wind, windAcc, sub);
    points.push({ x: px(flight.x), y: px(flight.y) });
    if (stopAtRim && flight.vy > 0 && flight.y >= BINTOSS_RIM_Y) break;
    if (flight.y >= BINTOSS_FLOOR_Y - BINTOSS_BALL_R) break;
    if (flight.x < -BINTOSS_BALL_R || flight.x > BINTOSS_WORLD_RIGHT + BINTOSS_BALL_R) break;
  }
  return points;
}

/** Where a launch would cross the bin's rim line, in world pixels. Render only. */
export function binTossPredict(
  vx: number,
  vy: number,
  wind: number,
  windAcc: number = BINTOSS_WIND_ACC,
  sub: number = BINTOSS_WIND_SUB,
): { x: number; y: number } {
  const path = binTossPath(vx, vy, wind, true, windAcc, sub);
  const last = path[path.length - 1]!;
  return { x: Math.round(last.x), y: Math.round(last.y) };
}

/** The bin's centre for a throw. */
export function binTossDistance(index: number): number {
  return BINTOSS_FIRST_DIST + BINTOSS_DIST_STEP * clampInt(index, 0, BINTOSS_THROWS - 1);
}

/** The bin's resting centre for a throw (before any slide). */
export function binTossBinCentre(index: number): number {
  return BINTOSS_BALL_X + binTossDistance(index);
}

export interface BinTossSlide {
  /** Amplitude in 1/256 px (0 = no slide), period and phase in ticks. */
  amp: number;
  period: number;
  phase: number;
}

/**
 * Sideways slide offset at this tick, 1/256 px. A parabolic half-wave per half
 * period (integer only, so identical everywhere), positive then negative.
 */
export function binTossSlideOffset(slide: BinTossSlide | undefined, tick: number): number {
  if (!slide || slide.amp <= 0 || slide.period < 2) return 0;
  const period = slide.period;
  const q = (((tick + slide.phase) % period) + period) % period;
  const half = period >> 1;
  const sign = q < half ? 1 : -1;
  const h = q < half ? q : q - half;
  const span = period - half;
  const width = q < half ? half : span;
  return sign * Math.trunc((slide.amp * 4 * h * (width - h)) / (width * width));
}

/** The bin's actual centre for a throw at a sim tick, slide included. */
export function binTossCentreAt(state: Pick<BinTossState, "slides">, index: number, tick: number): number {
  return binTossBinCentre(index) + binTossSlideOffset(state.slides[index], tick);
}

/* ================================ State ================================ */

export const BINTOSS_AIM = 0;
export const BINTOSS_FLY = 1;
export const BINTOSS_WAIT = 2;

export interface BinTossState {
  /** Rev 3 only: the hoop for each throw (null on throws without one). */
  hoops?: (BinTossHoop | null)[];
  /** Rev 3 only: the spinner for each throw (null on throws without one). */
  spinners?: (BinTossSpinner | null)[];
  /** Rev 3 only: 1 once the ball in flight has gone down through this throw's hoop. */
  hooped?: number;
  /** Rev 3 only: balls that went through the hoop and then into the bucket. */
  swishes?: number;
  /** Rev 3 only: baskets made on spinner throws. */
  spinBaskets?: number;
  /** Rev 3 only: last hoop or spinner contact tick (render only, like wobbleTick). */
  knockTick?: number;
  tick: number;
  rng: number;
  /** The throw now in hand, 0-based; reaches ten when they are all done. */
  throwIndex: number;
  resolved: number;
  baskets: number;
  /** Wind for each of the ten throws, −3 … +3. Same for everyone. */
  winds: number[];
  /** Seeded side-to-side slide per throw (amp 0 before throw 7). */
  slides: BinTossSlide[];
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
  /** Set only on the smaller-bucket revision; absent keeps older states byte-identical. */
  rev?: number;
}

function init(seed: number): BinTossState {
  let rng = seed | 0;
  const winds: number[] = [];
  for (let index = 0; index < BINTOSS_THROWS; index++) {
    const drawn = rngBelow(rng, BINTOSS_WIND_MAX * 2);
    rng = drawn.state;
    // 0..3 → −4..−1, 4..7 → +1..+4: never still air.
    winds.push(drawn.value < BINTOSS_WIND_MAX ? drawn.value - BINTOSS_WIND_MAX : drawn.value - BINTOSS_WIND_MAX + 1);
  }
  const slides: BinTossSlide[] = [];
  for (let index = 0; index < BINTOSS_THROWS; index++) {
    if (index < BINTOSS_SLIDE_FROM) {
      slides.push({ amp: 0, period: BINTOSS_SLIDE_PERIOD_MIN, phase: 0 });
      continue;
    }
    const ampDraw = rngBelow(rng, BINTOSS_SLIDE_AMP_MAX - BINTOSS_SLIDE_AMP_MIN + 1);
    const periodDraw = rngBelow(ampDraw.state, BINTOSS_SLIDE_PERIOD_MAX - BINTOSS_SLIDE_PERIOD_MIN + 1);
    const period = BINTOSS_SLIDE_PERIOD_MIN + periodDraw.value;
    const phaseDraw = rngBelow(periodDraw.state, period);
    rng = phaseDraw.state;
    // Keep the whole bin on screen: the swing is trimmed to the room on its right.
    const room = BINTOSS_SLIDE_RIGHT - BINTOSS_NARROW_HALF - binTossBinCentre(index);
    const amp = Math.min((BINTOSS_SLIDE_AMP_MIN + ampDraw.value) * 256, room);
    slides.push({ amp, period, phase: phaseDraw.value });
  }
  return {
    tick: 0,
    rng,
    slides,
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
  const rev3 =
    state.rev === BINTOSS_REV3
      ? {
          hooped: 0,
          swishes: (state.swishes ?? 0) + (scored && state.hooped ? 1 : 0),
          spinBaskets: (state.spinBaskets ?? 0) + (scored && state.spinners?.[state.throwIndex] ? 1 : 0),
        }
      : {};
  return {
    ...state,
    ...rev3,
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
  const half = binTossHalf(state.throwIndex, state.rev);
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
    binTossWindAcc(state.throwIndex, state.rev),
    binTossWindSub(state.rev),
  );
  let vx = advanced.vx;
  let vy = advanced.vy;
  let nx = advanced.x;
  let ny = advanced.y;
  const windV = advanced.windV;
  const windPos = advanced.windPos;
  let wobbleTick = state.wobbleTick;
  let hooped = state.hooped;
  let knockTick = state.knockTick;

  // Rev 3: the hoop's rim caps and the spinner bar bounce the ball; going down
  // between the caps marks the throw as through the hoop.
  if (state.rev === BINTOSS_REV3) {
    const ball = { x: nx, y: ny, vx, vy };
    const hoop = state.hoops?.[state.throwIndex] ?? null;
    if (hoop) {
      if (vy > 0 && state.y < hoop.y && ny >= hoop.y && Math.abs(nx - hoop.x) < BINTOSS_HOOP_HALF - BINTOSS_HOOP_CAP_R) hooped = 1;
      for (const [cx, cy] of binTossHoopCaps(hoop)) {
        if (bounceOff(ball, cx, cy, BINTOSS_HOOP_CAP_R + BINTOSS_BALL_R)) knockTick = tick;
      }
    }
    const spinner = state.spinners?.[state.throwIndex] ?? null;
    if (spinner) {
      const bar = binTossSpinEnds(state, state.throwIndex, spinner, tick);
      // Checked at the half step and the full step, so a fast ball cannot pass through the bar.
      for (const part of [1, 2]) {
        const sx = part === 1 ? state.x + ((ball.x - state.x) >> 1) : ball.x;
        const sy = part === 1 ? state.y + ((ball.y - state.y) >> 1) : ball.y;
        const near = closestOnSegment(sx, sy, bar.x0, bar.y0, bar.x1, bar.y1);
        const probe = { x: sx, y: sy, vx: ball.vx, vy: ball.vy };
        if (bounceOff(probe, near.x, near.y, BINTOSS_SPIN_THICK + BINTOSS_BALL_R)) {
          ball.x = probe.x;
          ball.y = probe.y;
          ball.vx = probe.vx;
          ball.vy = probe.vy;
          knockTick = tick;
          break;
        }
      }
    }
    nx = ball.x;
    ny = ball.y;
    vx = ball.vx;
    vy = ball.vy;
  }

  const centre = binTossCentreAt(state, state.throwIndex, tick);

  // Crossing the rim line on the way down decides the throw.
  if (vy > 0 && state.y < BINTOSS_RIM_Y && ny >= BINTOSS_RIM_Y) {
    const offset = Math.abs(nx - centre);
    if (offset <= half - binTossRimInset(state.rev)) {
      const caught: BinTossState = { ...state, x: nx, y: ny, wobbleTick };
      if (state.rev === BINTOSS_REV3) {
        caught.hooped = hooped ?? 0;
        caught.knockTick = knockTick ?? 0;
      }
      return resolve(caught, tick, true);
    }
    if (offset <= half + BINTOSS_BALL_R) {
      // A rim edge: the ball bounces away and the throw is a miss.
      wobbleTick = tick;
      vx = -(vx >> 1);
      vy = -(vy >> 1);
      nx = state.x + vx;
      ny = state.y + vy;
    }
  }

  // Below the rim and overlapping the bin means it struck the outside wall.
  if (ny > BINTOSS_RIM_Y && Math.abs(nx - centre) <= half + BINTOSS_BALL_R) {
    wobbleTick = tick;
    vx = -(vx >> 1);
    nx =
      state.x < centre
        ? centre - half - BINTOSS_BALL_R
        : centre + half + BINTOSS_BALL_R;
  }

  const next: BinTossState = { ...state, tick, vx, vy, windV, windPos, x: nx, y: ny, wobbleTick };
  if (state.rev === BINTOSS_REV3) {
    next.hooped = hooped ?? 0;
    next.knockTick = knockTick ?? 0;
  }

  // Landing on the floor or leaving the canvas is a miss.
  if (ny >= BINTOSS_FLOOR_Y - BINTOSS_BALL_R) return resolve(next, tick, false);
  if (nx < -BINTOSS_BALL_R || nx > BINTOSS_WORLD_RIGHT + BINTOSS_BALL_R) {
    return resolve(next, tick, false);
  }
  if (ny < -BINTOSS_WORLD_BOTTOM) return resolve(next, tick, false);
  return next;
}

function score(state: BinTossState): number {
  if (state.rev === BINTOSS_REV3) return binTossRev3Score(state.baskets, state.swishes ?? 0, state.tick);
  const baskets = clampInt(state.baskets, 0, BINTOSS_THROWS);
  // 10 per basket; a perfect 10/10 = 130 + round(20 × ticks left ÷ run).
  if (baskets >= BINTOSS_THROWS) return finishScore(BINTOSS_RUN_TICKS, state.tick);
  return clampInt(BINTOSS_BASKET_POINTS * baskets, 0, 130);
}

/** Rev 3: the most a run that misses at least one bucket can score (9 in, every hoop bonus). */
export const BINTOSS_V3_PARTIAL_MAX = 9 * 10 + 3 * 3;

/**
 * Rev 3: 10 per bucket plus 3 per hoop swish, up to 130; all ten in = 130 +
 * up to 20 for speed + 3 per hoop swish, up to 150.
 */
export function binTossRev3Score(baskets: number, swishes: number, tick: number): number {
  const made = clampInt(baskets, 0, BINTOSS_THROWS);
  const bonus = BINTOSS_HOOP_POINTS * clampInt(swishes, 0, BINTOSS_HOOP_COUNT);
  if (made >= BINTOSS_THROWS) return clampInt(finishScore(BINTOSS_RUN_TICKS, tick) + bonus, 0, 150);
  return clampInt(BINTOSS_BASKET_POINTS * made + bonus, 0, 130);
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
  const values = Object.values(snapshot);
  // Rev 3 folds its own counters in; older states never have them, so their sums are unchanged.
  if (state.rev === BINTOSS_REV3) values.push(state.hooped ?? 0, state.swishes ?? 0, state.spinBaskets ?? 0);
  for (const value of values) {
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
   // Separate wind line below the 19.5px HUD; its top clears the HUD by 12px.
   const y = 84;
  const strength = Math.abs(wind);
  ctx.save();
  ctx.strokeStyle = wind === 0 ? "#F7F7F855" : BINTOSS_BIN_COLOUR;
  ctx.lineWidth = 2.8;
  if (wind !== 0) {
    const dir = wind < 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(centreX - 36.4 * dir, y);
    ctx.lineTo(centreX + 36.4 * dir, y);
    ctx.lineTo(centreX + 25.2 * dir, y - 8.4);
    ctx.moveTo(centreX + 36.4 * dir, y);
    ctx.lineTo(centreX + 25.2 * dir, y + 8.4);
    ctx.stroke();
  }
  // Strength bars under the arrow.
  for (let bar = 0; bar < BINTOSS_WIND_MAX; bar++) {
    ctx.fillStyle = bar < strength ? BINTOSS_BIN_COLOUR : "#F7F7F822";
    ctx.fillRect(centreX - 26 + bar * 11, y + 10, 8, 4);
  }
  ctx.font = "600 18.2px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = BINTOSS_TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(wind === 0 ? "no wind" : `${wind < 0 ? "←" : "→"} ${strength}`, centreX, y - 19);
  ctx.restore();
}

function drawBin(ctx: CanvasRenderingContext2D, state: BinTossState): void {
  const index = Math.min(state.throwIndex, BINTOSS_THROWS - 1);
  const centre = px(binTossCentreAt(state, index, state.tick));
  const half = px(binTossHalf(index, state.rev));
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
  ctx.font = "600 19.5px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = BINTOSS_TEXT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const shown = Math.min(BINTOSS_THROWS, state.throwIndex + 1);
  ctx.fillText(`Throw ${shown} / ${BINTOSS_THROWS} · ${state.baskets} in`, 12, 12);
  ctx.textAlign = "right";

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
  /** Throw index, so the wind uses that throw's bin width. */
  index?: number;
  /** Bucket revision, so the wind uses that revision's calibration. */
  rev?: number | undefined;
}

export interface BinTossLandingPresentation {
  progress: number;
  binCentre: number;
  binIndex: number;
  rev?: number | undefined;
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
    binTossPath(ghost.vx, ghost.vy, ghost.wind, true, binTossWindAcc(ghost.index ?? 0, ghost.rev), binTossWindSub(ghost.rev)),
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
  const half = px(binTossHalf(landing.binIndex, landing.rev));
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

function initRev2(seed: number): BinTossState {
  return { ...init(seed), rev: BINTOSS_REV2 };
}

/**
 * Where a hoop goes on throw `index`: on the falling part of a seeded reference
 * throw that lands in the middle of the still bucket with this throw's wind, so
 * there is always a throw through the hoop and into the bucket. Returns null if
 * no reference fits (the throw then has no hoop).
 */
function placeHoop(index: number, wind: number, liftPx: number, apexPx: number): BinTossHoop | null {
  const centre = binTossBinCentre(index);
  const hoopY = BINTOSS_RIM_Y - liftPx * 256;
  const acc = binTossWindAcc(index, BINTOSS_REV3);
  const sub = BINTOSS_WIND_SUB_V3;
  for (let k = 0; k < 12; k++) {
    // A throw whose top is apexPx above the hoop (seeded), then alternately higher and lower.
    const apex = Math.max(12, apexPx + ((k + 1) >> 1) * (k % 2 ? 12 : -12));
    const rise = (BINTOSS_BALL_Y - hoopY) / 256 + apex;
    const vy = -clampInt(isqrt(2 * BINTOSS_GRAVITY * rise * 256), 800, BINTOSS_VY_MAX);
    // The sideways speed whose rim crossing is nearest the bucket centre (the
    // crossing moves right as the speed grows, so a bisection finds it).
    let lo = -BINTOSS_VX_MAX;
    let hi = BINTOSS_VX_MAX;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (binTossPredict(mid, vy, wind, acc, sub).x * 256 < centre) lo = mid;
      else hi = mid;
    }
    const errLo = Math.abs(binTossPredict(lo, vy, wind, acc, sub).x * 256 - centre);
    const errHi = Math.abs(binTossPredict(hi, vy, wind, acc, sub).x * 256 - centre);
    const best = errLo <= errHi ? lo : hi;
    if (Math.min(errLo, errHi) > 1_024) continue;
    // Walk that flight in sim units to find where it falls through the hoop's height.
    let flight: BinTossFlight = { x: BINTOSS_BALL_X, y: BINTOSS_BALL_Y, vx: best, vy, windV: 0, windPos: 0 };
    let up: number | null = null;
    let down: number | null = null;
    for (let tick = 0; tick < 400 && down === null; tick++) {
      const next = binTossAdvance(flight, wind, acc, sub);
      if (next.vy < 0 && flight.y > hoopY && next.y <= hoopY) up = next.x;
      if (next.vy > 0 && flight.y < hoopY && next.y >= hoopY) down = next.x;
      flight = next;
    }
    if (down === null) continue;
    // The rising part must pass clear of the hoop and its caps, and the hoop must sit over the bucket.
    if (up !== null && Math.abs(up - down) < 40 * 256) continue;
    if (Math.abs(down - centre) > 60 * 256) continue;
    return { x: down, y: hoopY };
  }
  return null;
}

/** Picks `count` distinct throw indices from [from, to] off the PRNG stream. */
function pickThrows(rng: number, from: number, to: number, count: number): { rng: number; picked: boolean[] } {
  const pool: number[] = [];
  for (let i = from; i <= to; i++) pool.push(i);
  const picked = Array.from({ length: BINTOSS_THROWS }, () => false);
  for (let n = 0; n < count && pool.length > 0; n++) {
    const draw = rngBelow(rng, pool.length);
    rng = draw.state;
    picked[pool.splice(draw.value, 1)[0]!] = true;
  }
  return { rng, picked };
}

function initRev3(seed: number): BinTossState {
  // Winds and slides first, exactly as every revision draws them.
  const base = init(seed);
  let rng = base.rng;
  const hoopPick = pickThrows(rng, BINTOSS_HOOP_FROM, BINTOSS_HOOP_TO, BINTOSS_HOOP_COUNT);
  rng = hoopPick.rng;
  const spinPick = pickThrows(rng, BINTOSS_SPIN_FROM, BINTOSS_THROWS - 1, BINTOSS_SPIN_COUNT);
  rng = spinPick.rng;
  const hoops: (BinTossHoop | null)[] = [];
  const spinners: (BinTossSpinner | null)[] = [];
  for (let index = 0; index < BINTOSS_THROWS; index++) {
    let hoop: BinTossHoop | null = null;
    if (hoopPick.picked[index]) {
      const lift = rngBelow(rng, BINTOSS_HOOP_LIFT_SPAN);
      const apex = rngBelow(lift.state, 41);
      rng = apex.state;
      hoop = placeHoop(index, base.winds[index] ?? 0, BINTOSS_HOOP_LIFT_MIN + lift.value, 30 + apex.value);
    }
    hoops.push(hoop);
    let spinner: BinTossSpinner | null = null;
    if (spinPick.picked[index]) {
      const phase = rngBelow(rng, 65_536);
      const dir = rngBelow(phase.state, 2);
      rng = dir.state;
      spinner = { phase: phase.value, dir: dir.value === 0 ? -1 : 1 };
    }
    spinners.push(spinner);
  }
  return { ...base, rng, rev: BINTOSS_REV3, hoops, spinners, hooped: 0, swishes: 0, spinBaskets: 0, knockTick: 0 };
}

/** Smaller-bucket revision. */
export const binTossRev2Game: ArcadeGame<BinTossState, ArcadeInputEvent | null> = { ...binTossGame, init: initRev2 };
/** Hoop-and-spinner revision on the smaller bucket. */
export const binTossRev3Game: ArcadeGame<BinTossState, ArcadeInputEvent | null> = { ...binTossGame, init: initRev3 };

/** Takes puzzle.binRev; anything else is the original bin. */
export function binTossGameFor(rev?: number | null): ArcadeGame<BinTossState, ArcadeInputEvent | null> {
  if (rev === BINTOSS_REV3) return binTossRev3Game;
  return rev === BINTOSS_REV2 ? binTossRev2Game : binTossGame;
}
