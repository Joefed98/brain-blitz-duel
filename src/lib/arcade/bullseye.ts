/**
 * Bullseye — an arcade game on the shared engine.
 *
 * Front view down the range: six rings, ten arrows, the target shrinking with
 * every shot as the range grows. A drag aims from the bow at the bottom and
 * letting go fires the arrow; longer drags land higher, and each arrow takes
 * that shot's sideways wind drift. Target geometry is in whole pixels; every
 * value in the state is an integer.
 */

import {
  clampInt,
  dragLaunch,
  inputRange,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type DragLaunch,
  type InputRange,
} from "./engine";
import { BAND_STRICT_MARK, bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, BAND_TARGET_MARK, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, type BandFields, type BandParts } from "./scoreBands";

/* ============================== Constants ============================== */

export const BULLSEYE_WORLD_W = 390;
export const BULLSEYE_WORLD_H = 560;

export const BULLSEYE_RUN_SECONDS = 45;
export const BULLSEYE_RUN_TICKS = BULLSEYE_RUN_SECONDS * TICKS_PER_SECOND;
export const BULLSEYE_ARROWS = 10;

/**
 * Target centre, in whole world pixels — sat 40% down the play area so the
 * target reads as further off down the range.
 */
export const BULLSEYE_CX = 195;
export const BULLSEYE_CY = Math.round(BULLSEYE_WORLD_H * 0.4);
export const BULLSEYE_BOW_X = 195;
export const BULLSEYE_BOW_Y = 532;
/** Outer radius at full size; each ring is a sixth of it. */
export const BULLSEYE_OUTER_R = 91;
export const BULLSEYE_RINGS = 6;
export const BULLSEYE_RING_STEP = BULLSEYE_OUTER_R / BULLSEYE_RINGS;

/** Centre outwards. */
export const BULLSEYE_RING_VALUES = [10, 9, 8, 3, 2, 1] as const;
export const BULLSEYE_RING_COLOURS = [
  "#F5B82E",
  "#FF4D4D",
  "#3B82F6",
  "#3B82F6",
  "#F7F7F8",
  "#F7F7F8",
] as const;

/** Ring scale per arrow, in hundredths — the range grows each shot. */
export const BULLSEYE_SCALE_PCT = [100, 96, 92, 88, 84, 80, 77, 74, 71, 68] as const;
export const BULLSEYE_WIND_MAX = 3;
/** The arrow's flight is render-only; the landing is worked out on release. */
export const BULLSEYE_FLIGHT_TICKS = 20;

/** A release: a = launch vx, b = launch vy, in 1/256 px a tick, upwards negative. */
export const BULLSEYE_INPUT_SHOT = 2;
export const BULLSEYE_V_MAX = 3_840;
export const BULLSEYE_INPUT_RANGES: readonly InputRange[] = [
  inputRange(BULLSEYE_INPUT_SHOT, [-BULLSEYE_V_MAX, BULLSEYE_V_MAX], [-BULLSEYE_V_MAX, 0]),
];

/**
 * The launch speed the reference aim vector produces, in 1/256 px a tick, and
 * the flight constant taken from it: a reference-strength straight-up aim
 * carries the arrow exactly the 282 px from the bow to the centre on arrow one.
 */
export const BULLSEYE_REF_V = 1_920;
export const BULLSEYE_FLIGHT_NUM = BULLSEYE_BOW_Y - BULLSEYE_CY;
export const BULLSEYE_FLIGHT_DEN = BULLSEYE_REF_V;

/**
 * Turns the aim vector (finger position minus the anchor, in world pixels) into
 * a launch velocity. Upwards is negative `dy`; a downward vector is clamped to
 * horizontal.
 */
export function bullseyeDrag(dx: number, dy: number): DragLaunch | null {
  const launch = dragLaunch(dx, dy, BULLSEYE_REF_V);
  if (!launch) return null;
  return {
    ...launch,
    vx: clampInt(launch.vx, -BULLSEYE_V_MAX, BULLSEYE_V_MAX),
    vy: clampInt(launch.vy, -BULLSEYE_V_MAX, -1),
  };
}

/** Where a flick lands on the target plane, before the wind drift. */
export function bullseyeLanding(vx: number, vy: number): { x: number; y: number } {
  const reach = (value: number) => Math.round((value * BULLSEYE_FLIGHT_NUM) / BULLSEYE_FLIGHT_DEN);
  return {
    x: clampInt(BULLSEYE_BOW_X + reach(vx), -400, BULLSEYE_WORLD_W + 400),
    y: clampInt(BULLSEYE_BOW_Y - reach(-vy), -400, BULLSEYE_WORLD_H + 400),
  };
}

export function bullseyeScalePct(index: number): number {
  return BULLSEYE_SCALE_PCT[clampInt(index, 0, BULLSEYE_ARROWS - 1)]!;
}

/** One wind unit moves one ring width at this arrow's target scale. */
export function bullseyeWindShiftPx(index: number, wind: number): number {
  const scalePct = bullseyeScalePct(index);
  return Math.round((wind * BULLSEYE_OUTER_R * scalePct) / (BULLSEYE_RINGS * 100));
}

/* ------------------------------- Aim sway ------------------------------ */

/**
 * The aim sways in a small circle: one full turn every 120 ticks (two seconds),
 * radius 0.6 of a ring width at that arrow's scale. The phase depends only on
 * the sim tick, so it is identical for every player and for the server replay.
 * Cosine and sine come from a fixed 120-entry table in 1/1024 units, so no
 * floating-point trigonometry is ever involved.
 */
export const BULLSEYE_SWAY_PERIOD = 120;
export const BULLSEYE_SWAY_UNIT = 1_024;
/** Radius as a tenth: 6/10 of a ring width. */
export const BULLSEYE_SWAY_TENTHS = 6;

export const BULLSEYE_SWAY_COS: readonly number[] = [
  1024, 1023, 1018, 1011, 1002, 989, 974, 956, 935, 912, 887, 859, 828, 796, 761, 724, 685, 644,
  602, 558, 512, 465, 416, 367, 316, 265, 213, 160, 107, 54, 0, -54, -107, -160, -213, -265, -316,
  -367, -416, -465, -512, -558, -602, -644, -685, -724, -761, -796, -828, -859, -887, -912, -935,
  -956, -974, -989, -1002, -1011, -1018, -1023, -1024, -1023, -1018, -1011, -1002, -989, -974, -956,
  -935, -912, -887, -859, -828, -796, -761, -724, -685, -644, -602, -558, -512, -465, -416, -367,
  -316, -265, -213, -160, -107, -54, 0, 54, 107, 160, 213, 265, 316, 367, 416, 465, 512, 558, 602,
  644, 685, 724, 761, 796, 828, 859, 887, 912, 935, 956, 974, 989, 1002, 1011, 1018, 1023,
];

export const BULLSEYE_SWAY_SIN: readonly number[] = [
  0, 54, 107, 160, 213, 265, 316, 367, 416, 465, 512, 558, 602, 644, 685, 724, 761, 796, 828, 859,
  887, 912, 935, 956, 974, 989, 1002, 1011, 1018, 1023, 1024, 1023, 1018, 1011, 1002, 989, 974, 956,
  935, 912, 887, 859, 828, 796, 761, 724, 685, 644, 602, 558, 512, 465, 416, 367, 316, 265, 213,
  160, 107, 54, 0, -54, -107, -160, -213, -265, -316, -367, -416, -465, -512, -558, -602, -644,
  -685, -724, -761, -796, -828, -859, -887, -912, -935, -956, -974, -989, -1002, -1011, -1018,
  -1023, -1024, -1023, -1018, -1011, -1002, -989, -974, -956, -935, -912, -887, -859, -828, -796,
  -761, -724, -685, -644, -602, -558, -512, -465, -416, -367, -316, -265, -213, -160, -107, -54,
];

/** The sway offset, in whole world pixels, for this arrow at this sim tick. */
export function bullseyeSway(index: number, tick: number, scalePct: number = bullseyeScalePct(index)): { dx: number; dy: number } {
  const phase = ((tick % BULLSEYE_SWAY_PERIOD) + BULLSEYE_SWAY_PERIOD) % BULLSEYE_SWAY_PERIOD;
  const radius = BULLSEYE_SWAY_TENTHS * BULLSEYE_OUTER_R * scalePct;
  const divisor = 10 * BULLSEYE_RINGS * 100 * BULLSEYE_SWAY_UNIT;
  return {
    dx: Math.round((radius * BULLSEYE_SWAY_COS[phase]!) / divisor),
    dy: Math.round((radius * BULLSEYE_SWAY_SIN[phase]!) / divisor),
  };
}

/** Where a shot released on this tick would land, sway included, wind excluded. */
export function bullseyeAimPoint(
  index: number,
  tick: number,
  vx: number,
  vy: number,
): { x: number; y: number } {
  const landing = bullseyeLanding(vx, vy);
  const sway = bullseyeSway(index, tick);
  return { x: landing.x + sway.dx, y: landing.y + sway.dy };
}

/* ---------------------------- Moving target ---------------------------- */

/** From this arrow (0-based) the whole target drifts left and right. */
export const BULLSEYE_DRIFT_FROM = 3;
/** One full drift cycle, ticks (2.6 s). */
export const BULLSEYE_DRIFT_PERIOD = 156;

/**
 * Sideways target offset, whole world px, for this arrow at this sim tick:
 * 0 before arrow 4, then a sine-table oscillation whose amplitude rises from
 * 60 px (arrow 4) to 100 px (arrow 8 on); phase and direction from the seed.
 */
export function bullseyeTargetDx(index: number, tick: number, phase: number, dir: number): number {
  if (index < BULLSEYE_DRIFT_FROM) return 0;
  const amp = 60 + 10 * Math.min(4, index - BULLSEYE_DRIFT_FROM);
  const t = (((tick + phase) % BULLSEYE_DRIFT_PERIOD) + BULLSEYE_DRIFT_PERIOD) % BULLSEYE_DRIFT_PERIOD;
  const slot = Math.trunc((t * BULLSEYE_SWAY_PERIOD) / BULLSEYE_DRIFT_PERIOD);
  return Math.round((dir * amp * BULLSEYE_SWAY_SIN[slot]!) / BULLSEYE_SWAY_UNIT);
}

/**
 * Which ring a landing point falls in, as an index, or −1 for a miss. Compared
 * with scaled integers so there is never a floating-point radius.
 */
export function bullseyeRingAt(x: number, y: number, scalePct: number, cy: number = BULLSEYE_CY): number {
  const dx = x - BULLSEYE_CX;
  const dy = y - cy;
  const distance2 = dx * dx + dy * dy;
  for (let ring = 1; ring <= BULLSEYE_RINGS; ring++) {
    // Keep authoritative geometry integer-only: radius is
    // OUTER_R × ring ÷ RINGS × scalePct ÷ 100.
    const radiusNumerator = BULLSEYE_OUTER_R * ring * scalePct;
    if (distance2 * BULLSEYE_RINGS * BULLSEYE_RINGS * 10_000 <= radiusNumerator ** 2) {
      return ring - 1;
    }
  }
  return -1;
}

/** From this arrow (0-based) the ring values are a seeded permutation per arrow. */
export const BULLSEYE_SHUFFLE_FROM = 6;

/** Colour for a ring VALUE, so the 10 ring keeps its colour wherever it sits. */
export function bullseyeValueColour(value: number): string {
  const index = BULLSEYE_RING_VALUES.indexOf(value as (typeof BULLSEYE_RING_VALUES)[number]);
  return BULLSEYE_RING_COLOURS[index < 0 ? 0 : index]!;
}

/** The value of each ring (centre outwards) for this arrow. */
export function bullseyeRingValues(state: Pick<BullseyeState, "ringValues">, arrow: number): readonly number[] {
  return state.ringValues[clampInt(arrow, 0, BULLSEYE_ARROWS - 1)] ?? BULLSEYE_RING_VALUES;
}

export function bullseyeRingValue(ring: number, values: readonly number[] = BULLSEYE_RING_VALUES): number {
  return ring < 0 ? 0 : (values[ring] ?? 0);
}

/* -------------------- Rev 2: inner bull and balloons --------------------- */

/**
 * Inner-bull-and-balloons revision (stored as puzzle.bullRev = 2). Winds, drift
 * and ring shuffles are drawn exactly as before; the balloon draws continue
 * the same PRNG stream after them. Unstamped rounds never see either.
 */
export const BULLSEYE_REV = 2;

/** The inner bull: a disc a third the radius of the 10 ring, worth 12 (10 + 2). */
export const BULLSEYE_INNER_BULL_POINTS = 12;
/** Inner-bull radius as a fraction of the outer radius: 1 / (RINGS × 3). */
export const BULLSEYE_INNER_BULL_DIV = BULLSEYE_RINGS * 3;

/**
 * True when (x, y) is in the inner bull for this arrow: the centre disc, only
 * while the 10 is the centre ring (always on darts 1–6; on shuffled darts only
 * when the 10 landed in the middle). Integer comparison, as bullseyeRingAt.
 */
export function bullseyeInInnerBull(x: number, y: number, scalePct: number, values: readonly number[], cy: number = BULLSEYE_CY): boolean {
  if (values[0] !== 10) return false;
  const dx = x - BULLSEYE_CX;
  const dy = y - cy;
  return (dx * dx + dy * dy) * BULLSEYE_INNER_BULL_DIV * BULLSEYE_INNER_BULL_DIV * 10_000 <= (BULLSEYE_OUTER_R * scalePct) ** 2;
}

/** Balloons on three of darts 3–10 (0-based 2–9), each worth 12, popped instead of scoring on the board. */
export const BULLSEYE_BALLOON_FROM = 2;
export const BULLSEYE_BALLOON_COUNT = 3;
export const BULLSEYE_BALLOON_POINTS = 12;
/** Balloon radius, whole world px (the drawn body is exactly this circle). */
export const BULLSEYE_BALLOON_R = 12;
/** The balloon drifts across this band of the range and wraps round, so it is always somewhere in view. */
export const BULLSEYE_BALLOON_LEFT = 20;
export const BULLSEYE_BALLOON_SPAN = 350;
/** Drift speed in 1/256 px a tick (0.45–0.85 px a tick), seeded per balloon. */
export const BULLSEYE_BALLOON_SPEED_MIN = 115;
export const BULLSEYE_BALLOON_SPEED_SPAN = 103;
/** Height band of the balloon's path centre, whole px (around the target's height). */
export const BULLSEYE_BALLOON_Y_MIN = BULLSEYE_CY - 120;
export const BULLSEYE_BALLOON_Y_SPAN = 200;
/** Bob: ±10 px, one bob every 240 ticks (4 s). */
export const BULLSEYE_BALLOON_BOB = 10;
export const BULLSEYE_BALLOON_BOB_PERIOD = 240;

export interface BullseyeBalloon {
  /** Drift direction ±1, speed (1/256 px a tick), start offset (1/256 px), path height (px), bob phase (ticks). */
  dir: number;
  speed: number;
  offset: number;
  y: number;
  bob: number;
}

/** Where a dart's balloon is at a sim tick, whole world px. Integer only. */
export function bullseyeBalloonAt(balloon: BullseyeBalloon, tick: number): { x: number; y: number } {
  const span = BULLSEYE_BALLOON_SPAN * 256;
  const travelled = (((balloon.offset + balloon.dir * balloon.speed * tick) % span) + span) % span;
  const phase = (((tick + balloon.bob) % BULLSEYE_BALLOON_BOB_PERIOD) + BULLSEYE_BALLOON_BOB_PERIOD) % BULLSEYE_BALLOON_BOB_PERIOD;
  const slot = Math.trunc((phase * BULLSEYE_SWAY_PERIOD) / BULLSEYE_BALLOON_BOB_PERIOD);
  return {
    x: BULLSEYE_BALLOON_LEFT + Math.trunc(travelled / 256),
    y: balloon.y + Math.round((BULLSEYE_BALLOON_BOB * BULLSEYE_SWAY_SIN[slot]!) / BULLSEYE_SWAY_UNIT),
  };
}

/** Does a landing point pop the balloon at this tick? */
export function bullseyeBalloonPopped(balloon: BullseyeBalloon, tick: number, x: number, y: number): boolean {
  const at = bullseyeBalloonAt(balloon, tick);
  const dx = x - at.x;
  const dy = y - at.y;
  return dx * dx + dy * dy <= BULLSEYE_BALLOON_R * BULLSEYE_BALLOON_R;
}

/* ================================ State ================================ */

export interface BullseyeHit {
  /** Where the arrow landed, in whole world pixels. */
  x: number;
  y: number;
  /** Ring index, or −1 for outside the target. */
  ring: number;
  value: number;
  /** Which arrow it was, so drawing knows the target size it hit. */
  arrow: number;
  /** The persisted wind applied to this arrow. */
  wind: number;
  /** Target's sideways offset when this arrow landed. */
  tdx: number;
  /** Rev 2 only: 1 when it landed in the inner bull. */
  bull?: number;
  /** Rev 2 only: 1 when it popped the balloon (rev 2: and scored nothing on the board). */
  pop?: number;
  /** bullRev 4 only: the popped balloon's value (1–3), added on top of the ring. */
  bal?: number;
  /** bullRev 8 only: the bull streak's length on this dart (2+, n bulls in a row) and the streak points it earned. */
  sk?: number;
  skp?: number;
  /** bullRev 8 only: 1 when it landed in the dead-centre ring. */
  dc?: number;
}

export interface BullseyeState extends BandFields {
  tick: number;
  rng: number;
  /** Wind for each arrow, −3 … +3. Same for everyone. */
  winds: number[];
  /** Arrows fired so far; also the index of the arrow now on the string. */
  arrowIndex: number;
  hits: BullseyeHit[];
  total: number;
  /** Ticks left of the current arrow's flight animation. */
  flightTick: number;
  endedTick: number;
  /** Moving-target phase (ticks) and direction (±1), from the seed. */
  driftPhase: number;
  driftDir: number;
  /** Ring values centre-outwards per arrow; shuffled from arrow 7. Same for everyone. */
  ringValues: number[][];
  /** Rev 2 only: the revision stamp, and each dart's balloon (null on darts without one). */
  rev?: number;
  balloons?: (BullseyeBalloon | null)[];
  /**
   * bullRev 4 only (Tuning B): 1 marks the value balloons that cross the board
   * (`balloons` then holds BullseyeBalloonV4 entries). Absent on every earlier round.
   */
  tune?: number;
  /**
   * bullRev 8 only (the world expansion, docs/expansions/e5.md): 1 marks the taller range with targets at
   * different distances and heights and the bullseye streak. Absent on every earlier round.
   */
  expand?: number;
  /** bullRev 8: each dart's target, its centre height (sim px; the range runs from −BULLSEYE_V8_LIFT) and size (per cent). */
  targets?: BullseyeTarget[];
  /** bullRev 8: bulls in a row so far, and the streak points they have earned (uncapped; the score caps them). */
  streak?: number;
  streakPts?: number;
  /** bullRev 8: darts in the dead-centre ring so far. */
  dead?: number;
}

export function bullseyeWinds(seed: number): number[] {
  let rng = seed | 0;
  const winds: number[] = [];
  for (let index = 0; index < BULLSEYE_ARROWS; index++) {
    const drawn = rngBelow(rng, BULLSEYE_WIND_MAX * 2 + 1);
    rng = drawn.state;
    winds.push(drawn.value - BULLSEYE_WIND_MAX);
  }
  return winds;
}

export function bullseyeInit(seed: number, storedWinds?: readonly number[]): BullseyeState {
  let rng = seed | 0;
  for (let index = 0; index < BULLSEYE_ARROWS; index++) {
    rng = rngBelow(rng, BULLSEYE_WIND_MAX * 2 + 1).state;
  }
  const generated = bullseyeWinds(seed);
  const validStored =
    storedWinds?.length === BULLSEYE_ARROWS &&
    storedWinds.every(
      (wind) => Number.isInteger(wind) && wind >= -BULLSEYE_WIND_MAX && wind <= BULLSEYE_WIND_MAX,
    );
  const winds = validStored ? [...storedWinds] : generated;
  const phaseDraw = rngBelow(rng, BULLSEYE_DRIFT_PERIOD);
  const dirDraw = rngBelow(phaseDraw.state, 2);
  rng = dirDraw.state;
  const ringValues: number[][] = [];
  for (let arrow = 0; arrow < BULLSEYE_ARROWS; arrow++) {
    const values = [...BULLSEYE_RING_VALUES] as number[];
    if (arrow >= BULLSEYE_SHUFFLE_FROM) {
      for (let i = values.length - 1; i > 0; i--) {
        const pick = rngBelow(rng, i + 1);
        rng = pick.state;
        const j = pick.value;
        [values[i], values[j]] = [values[j]!, values[i]!];
      }
      // Never the plain layout: rotate one step if the shuffle came out unchanged.
      if (values.every((v, i) => v === BULLSEYE_RING_VALUES[i])) values.push(values.shift()!);
    }
    ringValues.push(values);
  }
  return {
    ringValues,
    driftPhase: phaseDraw.value,
    driftDir: dirDraw.value === 0 ? -1 : 1,
    tick: 0,
    rng,
    winds,
    arrowIndex: 0,
    hits: [],
    total: 0,
    flightTick: 0,
    endedTick: 0,
  };
}

function isOver(state: BullseyeState): boolean {
  if (state.tick >= BULLSEYE_RUN_TICKS) return true;
  return state.arrowIndex >= BULLSEYE_ARROWS && state.flightTick <= 0;
}

/** Every arrow loosed. */
export function bullseyeFinished(state: BullseyeState): boolean {
  return state.arrowIndex >= BULLSEYE_ARROWS;
}

function step(state: BullseyeState, input: ArcadeInputEvent | null): BullseyeState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const flightTick = Math.max(0, state.flightTick - 1);

  const canFire = flightTick === 0 && state.arrowIndex < BULLSEYE_ARROWS;
  if (input && input.k === BULLSEYE_INPUT_SHOT && canFire) {
    const arrow = state.arrowIndex;
    const wind = state.winds[arrow] ?? 0;
    const vx = clampInt(input.a, -BULLSEYE_V_MAX, BULLSEYE_V_MAX);
    const vy = clampInt(input.b, -BULLSEYE_V_MAX, 0);
    // The landing is the aim point on the release tick — sway included — then
    // shifted sideways by this arrow's wind.
    const aimed = bullseyeAimPoint(arrow, tick, vx, vy);
    const x = aimed.x + bullseyeWindShiftPx(arrow, wind);
    const y = aimed.y;
    // Scored against where the target is when the arrow lands.
    const tdx = bullseyeTargetDx(arrow, tick + BULLSEYE_FLIGHT_TICKS, state.driftPhase, state.driftDir);
    let ring = bullseyeRingAt(x - tdx, y, bullseyeScalePct(arrow));
    let value = bullseyeRingValue(ring, bullseyeRingValues(state, arrow));
    let hit: BullseyeHit = { x, y, ring, value, arrow, wind, tdx };
    if (state.expand === BULLSEYE_EXPAND) return bullseyeV8Shot(state, tick, vx, vy);
    if (state.rev === BULLSEYE_REV && state.tune === BULLSEYE_TUNE) {
      // bullRev 4: the board scores as rev 2 (inner bull 12); a balloon the dart
      // passes through on its way in pops and adds its own value on top.
      const bull = ring === 0 && bullseyeInInnerBull(x - tdx, y, bullseyeScalePct(arrow), bullseyeRingValues(state, arrow));
      if (bull) value = BULLSEYE_INNER_BULL_POINTS;
      const balloon = (state.balloons?.[arrow] ?? null) as BullseyeBalloonV4 | null;
      const popped = balloon !== null && bullseyeBalloonV4Popped(balloon, state, arrow, tick + BULLSEYE_FLIGHT_TICKS, x, y);
      if (popped) value += balloon.value;
      hit = { x, y, ring, value, arrow, wind, tdx, bull: bull ? 1 : 0, pop: popped ? 1 : 0, bal: popped ? balloon.value : 0 };
    } else if (state.rev === BULLSEYE_REV) {
      // Rev 2: a balloon in the way takes the dart; otherwise the inner bull adds 2.
      const balloon = state.balloons?.[arrow] ?? null;
      if (balloon && bullseyeBalloonPopped(balloon, tick + BULLSEYE_FLIGHT_TICKS, x, y)) {
        ring = -1;
        value = BULLSEYE_BALLOON_POINTS;
        hit = { x, y, ring, value, arrow, wind, tdx, bull: 0, pop: 1 };
      } else {
        const bull = ring === 0 && bullseyeInInnerBull(x - tdx, y, bullseyeScalePct(arrow), bullseyeRingValues(state, arrow));
        if (bull) value = BULLSEYE_INNER_BULL_POINTS;
        hit = { x, y, ring, value, arrow, wind, tdx, bull: bull ? 1 : 0, pop: 0 };
      }
    }
    const next: BullseyeState = {
      ...state,
      tick,
      flightTick: BULLSEYE_FLIGHT_TICKS,
      arrowIndex: arrow + 1,
      hits: [...state.hits, hit],
      total: state.total + value,
    };
    if (isOver(next)) return { ...next, endedTick: tick };
    return next;
  }

  const next: BullseyeState = { ...state, tick, flightTick };
  if (isOver(next)) return { ...next, endedTick: tick };
  return next;
}

/**
 * floor(1.7 × arrow total − 20), clamped to 0…150.
 * Arrows still unfired when the clock ends add nothing.
 */
export function bullseyeScoreFor(total: number, rev?: number): number {
  // Rev 2 totals can pass 100 (12 for an inner bull or a balloon); the curve is unchanged.
  const points = clampInt(total, 0, BULLSEYE_ARROWS * (rev === BULLSEYE_REV ? 12 : 10));
  return clampInt(Math.floor((17 * points) / 10 - 20), 0, 150);
}

function score(state: BullseyeState): number {
  return bullseyeScoreFor(state.total, state.rev);
}

/** Rev 2: darts in the inner bull, and balloons popped. */
export function bullseyeInnerBulls(state: BullseyeState): number {
  return state.hits.filter((hit) => hit.bull === 1).length;
}
export function bullseyePops(state: BullseyeState): number {
  return state.hits.filter((hit) => hit.pop === 1).length;
}

/** Arrows in the gold or red rings — the headline for the standings summary. */
export function bullseyeInner(state: BullseyeState): number {
  return state.hits.filter((hit) => hit.value >= 9).length;
}

/* =========================== Integrity checks ========================== */

export const BULLSEYE_CHECKPOINT_INTERVAL = 300;

export interface BullseyeCheckpointState {
  tick: number;
  arrowIndex: number;
  flightTick: number;
  total: number;
  lastX: number;
  lastY: number;
  lastRing: number;
  wind: number;
  lastTdx: number;
}

export interface BullseyeCheckpoint extends BullseyeCheckpointState {
  checksum: number;
}

export function bullseyeCheckpointState(state: BullseyeState): BullseyeCheckpointState {
  const last = state.hits[state.hits.length - 1];
  return {
    tick: state.tick,
    arrowIndex: state.arrowIndex,
    flightTick: state.flightTick,
    total: state.total,
    lastX: last ? last.x : 0,
    lastY: last ? last.y : 0,
    lastRing: last ? last.ring : -1,
    wind: state.winds[Math.min(state.arrowIndex, BULLSEYE_ARROWS - 1)] ?? 0,
    lastTdx: last ? last.tdx : 0,
  };
}

/** 32-bit FNV-1a over the integer snapshot, with an xor before each multiply. */
export function bullseyeCheckpoint(state: BullseyeState): BullseyeCheckpoint {
  const snapshot = bullseyeCheckpointState(state);
  let checksum = 0x811c9dc5;
  const values = Object.values(snapshot);
  // Rev 2 folds its own counters in; older states never have them, so their sums are unchanged.
  if (state.rev === BULLSEYE_REV) values.push(bullseyeInnerBulls(state), bullseyePops(state));
  // bullRev 4 adds its marker and the balloon points taken; rev-2 sums are unchanged.
  if (state.tune === BULLSEYE_TUNE) values.push(state.tune, bullseyeBalloonPoints(state));
  // bullRev 8 adds its marker, the streak and its points last; every older sum is unchanged.
  if (state.expand === BULLSEYE_EXPAND) values.push(state.expand, state.streak ?? 0, state.streakPts ?? 0, state.dead ?? 0);
  for (const value of values) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* ================================ Drawing ============================== */

export const BULLSEYE_BG = "#0B0B0F";
export const BULLSEYE_GOLD = "#F5B82E";
export const BULLSEYE_TEXT = "#F7F7F8";

export interface BullseyeTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function bullseyeTransform(size: CanvasSize): BullseyeTransform {
  const scale = Math.min(size.width / BULLSEYE_WORLD_W, size.height / BULLSEYE_WORLD_H);
  return {
    scale,
    offsetX: (size.width - BULLSEYE_WORLD_W * scale) / 2,
    offsetY: (size.height - BULLSEYE_WORLD_H * scale) / 2,
  };
}

/** The six rings at the size this arrow sees them. */
export function bullseyeDrawTarget(
  ctx: CanvasRenderingContext2D,
  scalePct: number,
  dx = 0,
  values: readonly number[] = BULLSEYE_RING_VALUES,
): void {
  ctx.save();
  ctx.translate(dx, 0);
  drawRings(ctx, scalePct, values);
  ctx.restore();
}

function drawRings(ctx: CanvasRenderingContext2D, scalePct: number, values: readonly number[]): void {
  for (let ring = BULLSEYE_RINGS; ring >= 1; ring--) {
    const radius = (BULLSEYE_RING_STEP * ring * scalePct) / 100;
    ctx.beginPath();
    const value = values[ring - 1] ?? 0;
    ctx.fillStyle = bullseyeValueColour(value);
    ctx.globalAlpha = value >= 9 ? 0.9 : 0.35;
    ctx.arc(BULLSEYE_CX, BULLSEYE_CY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(11, 11, 15, 0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.font = "700 9px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let index = 0; index < BULLSEYE_RINGS; index++) {
    const outer = (BULLSEYE_RING_STEP * (index + 1) * scalePct) / 100;
    const inner = index === 0 ? 0 : (BULLSEYE_RING_STEP * index * scalePct) / 100;
    const y = BULLSEYE_CY - Math.max(8, (outer + inner) / 2);
    const value = values[index] ?? 0;
    ctx.fillStyle = value === 10 || value <= 6 ? "#0B0B0F" : BULLSEYE_TEXT;
    ctx.fillText(String(value), BULLSEYE_CX, y);
  }
}

function drawWind(ctx: CanvasRenderingContext2D, wind: number): void {
  const centreX = BULLSEYE_WORLD_W / 2;
   // Separate wind line below the 19.5px HUD, still above the target's top.
   const y = 84;
  ctx.save();
  ctx.strokeStyle = wind === 0 ? "#F7F7F855" : BULLSEYE_GOLD;
  ctx.lineWidth = 2.8;
  if (wind !== 0) {
    const dir = wind < 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(centreX - 33.6 * dir, y);
    ctx.lineTo(centreX + 33.6 * dir, y);
    ctx.lineTo(centreX + 22.4 * dir, y - 8.4);
    ctx.moveTo(centreX + 33.6 * dir, y);
    ctx.lineTo(centreX + 22.4 * dir, y + 8.4);
    ctx.stroke();
  }
  ctx.font = "600 18.2px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = BULLSEYE_TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    wind === 0 ? "no wind" : `${wind < 0 ? "←" : "→"} ${Math.abs(wind)}`,
    centreX,
    y - 18,
  );
  ctx.restore();
}

/** The bow with a nocked arrow, sitting at bottom-centre. Render only. */
function drawBow(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(BULLSEYE_BOW_X, BULLSEYE_BOW_Y);
  ctx.strokeStyle = "rgba(247, 247, 248, 0.65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 10, 22, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = BULLSEYE_GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(0, -26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5, -18);
  ctx.lineTo(0, -28);
  ctx.lineTo(5, -18);
  ctx.stroke();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: BullseyeState, size: CanvasSize): void {
  const { scale, offsetX, offsetY } = bullseyeTransform(size);
  // Mid-flight the target is still the one the arrow was loosed at.
  const shown =
    state.flightTick > 0
      ? Math.max(0, state.arrowIndex - 1)
      : Math.min(state.arrowIndex, BULLSEYE_ARROWS - 1);

  ctx.save();
  ctx.fillStyle = BULLSEYE_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Mid-flight the target keeps moving (it is scored where it is on landing).
  const shownDx = bullseyeTargetDx(shown, state.tick, state.driftPhase, state.driftDir);
  bullseyeDrawTarget(ctx, bullseyeScalePct(shown), shownDx, bullseyeRingValues(state, shown));

  // The last landed arrow stays as a faint correction dot until the next release.
  const last = state.hits[state.hits.length - 1];
  if (last && state.flightTick === 0) {
    ctx.fillStyle = BULLSEYE_GOLD;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // In flight: the arrow travels from the bow to its landing point, shrinking
  // as it goes down the range. Render only.
  if (last && state.flightTick > 0) {
    const progress = (BULLSEYE_FLIGHT_TICKS - state.flightTick) / BULLSEYE_FLIGHT_TICKS;
    const x = BULLSEYE_BOW_X + (last.x - BULLSEYE_BOW_X) * progress;
    const y = BULLSEYE_BOW_Y + (last.y - BULLSEYE_BOW_Y) * progress;
    ctx.fillStyle = BULLSEYE_GOLD;
    ctx.globalAlpha = 0.45 + 0.55 * progress;
    ctx.beginPath();
    ctx.arc(x, y, 3 + 7 * (1 - progress), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (state.arrowIndex < BULLSEYE_ARROWS) drawWind(ctx, state.winds[state.arrowIndex] ?? 0);
  if (state.arrowIndex < BULLSEYE_ARROWS && state.flightTick === 0) drawBow(ctx);

  ctx.font = "600 19.5px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = BULLSEYE_TEXT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const shownArrow = Math.min(BULLSEYE_ARROWS, state.arrowIndex + 1);
  ctx.fillText(`Dart ${shownArrow} / ${BULLSEYE_ARROWS} · ${state.total} pts`, 12, 12);
  ctx.textAlign = "right";

  ctx.restore();
}

/**
 * The aim line the shot would take if the finger were released right now: a
 * dotted line from the bow to the predicted landing point, with a small ring
 * there. Render only — the sim never sees it.
 */
export function bullseyeDrawAim(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  landing: { x: number; y: number },
): void {
  const { scale, offsetX, offsetY } = bullseyeTransform(size);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = BULLSEYE_GOLD;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(BULLSEYE_BOW_X, BULLSEYE_BOW_Y - 26);
  ctx.lineTo(landing.x, landing.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(landing.x, landing.y, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

export const bullseyeGame: ArcadeGame<BullseyeState, ArcadeInputEvent | null> = {
  key: "bullseye",
  runTicks: BULLSEYE_RUN_TICKS,
  init: bullseyeInit,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: BULLSEYE_INPUT_RANGES,
};

/** Rev 2 start state: the original state plus balloons drawn after every original draw. */
export function bullseyeInitRev2(seed: number, storedWinds?: readonly number[]): BullseyeState {
  const base = bullseyeInit(seed, storedWinds);
  let rng = base.rng;
  const pool: number[] = [];
  for (let i = BULLSEYE_BALLOON_FROM; i < BULLSEYE_ARROWS; i++) pool.push(i);
  const balloons: (BullseyeBalloon | null)[] = Array.from({ length: BULLSEYE_ARROWS }, () => null);
  for (let n = 0; n < BULLSEYE_BALLOON_COUNT; n++) {
    const pick = rngBelow(rng, pool.length);
    const dir = rngBelow(pick.state, 2);
    const speed = rngBelow(dir.state, BULLSEYE_BALLOON_SPEED_SPAN);
    const offset = rngBelow(speed.state, BULLSEYE_BALLOON_SPAN * 256);
    const y = rngBelow(offset.state, BULLSEYE_BALLOON_Y_SPAN);
    const bob = rngBelow(y.state, BULLSEYE_BALLOON_BOB_PERIOD);
    rng = bob.state;
    const index = pool.splice(pick.value, 1)[0]!;
    balloons[index] = {
      dir: dir.value === 0 ? -1 : 1,
      speed: BULLSEYE_BALLOON_SPEED_MIN + speed.value,
      offset: offset.value,
      y: BULLSEYE_BALLOON_Y_MIN + y.value,
      bob: bob.value,
    };
  }
  return { ...base, rng, rev: BULLSEYE_REV, balloons };
}

/** Inner-bull-and-balloons revision. */
export const bullseyeRev2Game: ArcadeGame<BullseyeState, ArcadeInputEvent | null> = { ...bullseyeGame, init: (seed) => bullseyeInitRev2(seed) };

/** Takes puzzle.bullRev; anything else is the original game. */
export function bullseyeGameFor(rev?: number | null): ArcadeGame<BullseyeState, ArcadeInputEvent | null> {
  if (rev === BULLSEYE_REV_EXPAND) return bullseyeExpandGame;
  if (rev === BULLSEYE_REV_STRICT) return bullseyeStrictGame;
  if (rev === BULLSEYE_REV_TARGET) return bullseyeTargetGame;
  if (rev === BULLSEYE_REV_TUNED) return bullseyeTunedGame;
  if (rev === BULLSEYE_REV_BAND) return bullseyeBandGame;
  return rev === BULLSEYE_REV ? bullseyeRev2Game : bullseyeGame;
}

/** Start state for a stored round: its own winds and its own revision. */
export function bullseyeInitFor(seed: number, storedWinds: readonly number[] | undefined, rev?: number | null): BullseyeState {
  if (rev === BULLSEYE_REV_EXPAND) return bullseyeInitRev8(seed, storedWinds);
  if (rev === BULLSEYE_REV_STRICT) return { ...bandInit(bullseyeInitRev4(seed, storedWinds)), band: BAND_STRICT_MARK };
  if (rev === BULLSEYE_REV_TARGET) return { ...bandInit(bullseyeInitRev4(seed, storedWinds)), band: BAND_TARGET_MARK };
  if (rev === BULLSEYE_REV_TUNED) return bandInit(bullseyeInitRev4(seed, storedWinds));
  if (rev === BULLSEYE_REV_BAND) return bandInit(bullseyeInitRev2(seed, storedWinds));
  return rev === BULLSEYE_REV ? bullseyeInitRev2(seed, storedWinds) : bullseyeInit(seed, storedWinds);
}

/* ============ Tuning B (bullRev 4): value balloons across the board ============ */

/**
 * bullRev 4 (Tuning B, Oct 2026): rev-2 rings and inner bull on the score bands,
 * with three value balloons (+1 green, +2 blue, +3 purple, one of each on three
 * of darts 3–10) that fly back and forth across the board itself, moving with
 * it as it drifts. A dart that passes through its dart's balloon pops it, adds
 * the balloon's value and carries on into the ring it lands in. The balloon
 * draws continue the PRNG after the original draws (winds, drift, ring swaps).
 * States keep `rev: 2` (the inner bull) and add `tune: 1`.
 */
export const BULLSEYE_REV_TUNED = 4;
export const BULLSEYE_TUNE = 1;
export const BULLSEYE_V4_BALLOON_VALUES = [1, 2, 3] as const;
/** Speed by value, 1/256 px a tick: +1 0.5 px, +2 0.75 px, +3 1 px a tick. */
export const BULLSEYE_V4_BALLOON_SPEED: Readonly<Record<number, number>> = { 1: 128, 2: 192, 3: 256 };
/** The path runs this far past the board's edge each side, whole px, so the balloon clears it before turning back. */
export const BULLSEYE_V4_BALLOON_OVERRUN = BULLSEYE_BALLOON_R + 4;
/** Entry and exit heights within this many hundredths of the board radius of the centre line. */
export const BULLSEYE_V4_BALLOON_Y_PCT = 65;
/** Bob: ±4 px, one bob every 150 ticks (2.5 s). */
export const BULLSEYE_V4_BALLOON_BOB = 4;
export const BULLSEYE_V4_BALLOON_BOB_PERIOD = 150;
/** Start phase resolution along the back-and-forth path. */
export const BULLSEYE_V4_PHASE_UNITS = 1_024;

export interface BullseyeBalloonV4 {
  /** Points (1–3); also sets speed and colour. */
  value: number;
  /** First crossing direction ±1, start phase (of PHASE_UNITS round the back-and-forth loop), bob phase (ticks). */
  dir: number;
  phase: number;
  bob: number;
  /** Height at the left and right ends of the path, px from the board's centre line (up negative). */
  ya: number;
  yb: number;
}

/** Board radius this dart sees, whole px. */
function boardRadiusPx(arrow: number): number {
  return Math.trunc((BULLSEYE_OUTER_R * bullseyeScalePct(arrow)) / 100);
}

/** Half the balloon's path length for this dart (board radius plus the overrun), whole px. */
export function bullseyeV4HalfSpan(arrow: number, scalePct: number = bullseyeScalePct(arrow)): number {
  return Math.trunc((BULLSEYE_OUTER_R * scalePct) / 100) + BULLSEYE_V4_BALLOON_OVERRUN;
}

/**
 * Where a bullRev 4 balloon is at a sim tick, whole world px: back and forth
 * along a straight line across the board (a triangle wave on the tick, so it
 * never jumps), plus a small bob, all relative to the board's centre as it
 * drifts. Integer only.
 */
export function bullseyeBalloonV4At(
  balloon: BullseyeBalloonV4,
  state: Pick<BullseyeState, "driftPhase" | "driftDir"> & Partial<Pick<BullseyeState, "expand" | "targets">>,
  arrow: number,
  tick: number,
): { x: number; y: number } {
  const board = bullseyeBoard(state, arrow);
  const half = bullseyeV4HalfSpan(arrow, board.scalePct);
  const length = 2 * half * 256;
  const loop = 2 * length;
  const speed = BULLSEYE_V4_BALLOON_SPEED[balloon.value] ?? BULLSEYE_V4_BALLOON_SPEED[1]!;
  const start = Math.trunc((balloon.phase * loop) / BULLSEYE_V4_PHASE_UNITS);
  const d = (((start + speed * tick) % loop) + loop) % loop;
  const along = d < length ? d : loop - d;
  const from = balloon.dir > 0 ? along : length - along;
  const localX = -half + Math.trunc(from / 256);
  const localY = balloon.ya + Math.trunc(((balloon.yb - balloon.ya) * from) / length);
  const phase = (((tick + balloon.bob) % BULLSEYE_V4_BALLOON_BOB_PERIOD) + BULLSEYE_V4_BALLOON_BOB_PERIOD) % BULLSEYE_V4_BALLOON_BOB_PERIOD;
  const slot = Math.trunc((phase * BULLSEYE_SWAY_PERIOD) / BULLSEYE_V4_BALLOON_BOB_PERIOD);
  const bob = Math.round((BULLSEYE_V4_BALLOON_BOB * BULLSEYE_SWAY_SIN[slot]!) / BULLSEYE_SWAY_UNIT);
  return {
    x: BULLSEYE_CX + bullseyeDxOf(state, arrow, tick) + localX,
    y: board.cy + localY + bob,
  };
}

/** Does a landing point pass through this dart's bullRev 4 balloon at the landing tick? */
export function bullseyeBalloonV4Popped(
  balloon: BullseyeBalloonV4,
  state: Pick<BullseyeState, "driftPhase" | "driftDir"> & Partial<Pick<BullseyeState, "expand" | "targets">>,
  arrow: number,
  tick: number,
  x: number,
  y: number,
): boolean {
  const at = bullseyeBalloonV4At(balloon, state, arrow, tick);
  const dx = x - at.x;
  const dy = y - at.y;
  return dx * dx + dy * dy <= BULLSEYE_BALLOON_R * BULLSEYE_BALLOON_R;
}

/** This dart's balloon centre at a tick, for either balloon revision, or null when it has none. */
export function bullseyeBalloonPos(state: BullseyeState, arrow: number, tick: number): { x: number; y: number } | null {
  const balloon = state.balloons?.[arrow] ?? null;
  if (!balloon) return null;
  if (state.tune === BULLSEYE_TUNE) return bullseyeBalloonV4At(balloon as unknown as BullseyeBalloonV4, state, arrow, tick);
  return bullseyeBalloonAt(balloon, tick);
}

/** This dart's balloon value: 1–3 on bullRev 4, 12 on rev 2, 0 when it has none. */
export function bullseyeBalloonValue(state: BullseyeState, arrow: number): number {
  const balloon = state.balloons?.[arrow] ?? null;
  if (!balloon) return 0;
  return state.tune === BULLSEYE_TUNE ? ((balloon as unknown as BullseyeBalloonV4).value ?? 0) : BULLSEYE_BALLOON_POINTS;
}

/** bullRev 4: balloon points taken so far. */
export function bullseyeBalloonPoints(state: BullseyeState): number {
  return state.hits.reduce((sum, hit) => sum + (hit.bal ?? 0), 0);
}

/** bullRev 4 start state: the original state plus three value balloons drawn after every original draw. */
export function bullseyeInitRev4(seed: number, storedWinds?: readonly number[]): BullseyeState {
  return withValueBalloons(bullseyeInit(seed, storedWinds), boardRadiusPx);
}

/** Draws the three value balloons after every earlier draw; `radius` is each dart's board radius (px). */
function withValueBalloons(base: BullseyeState, radius: (arrow: number) => number): BullseyeState {
  let rng = base.rng;
  // Which value goes on which balloon: one of the six orders.
  const order = rngBelow(rng, 6);
  rng = order.state;
  const values: number[] = [...BULLSEYE_V4_BALLOON_VALUES];
  const perm = order.value;
  [values[0], values[perm % 3]] = [values[perm % 3]!, values[0]!];
  if (perm >= 3) [values[1], values[2]] = [values[2]!, values[1]!];
  const pool: number[] = [];
  for (let i = BULLSEYE_BALLOON_FROM; i < BULLSEYE_ARROWS; i++) pool.push(i);
  const balloons: (BullseyeBalloonV4 | null)[] = Array.from({ length: BULLSEYE_ARROWS }, () => null);
  for (let n = 0; n < BULLSEYE_BALLOON_COUNT; n++) {
    const pick = rngBelow(rng, pool.length);
    const index = pool.splice(pick.value, 1)[0]!;
    const lim = Math.trunc((radius(index) * BULLSEYE_V4_BALLOON_Y_PCT) / 100);
    const dir = rngBelow(pick.state, 2);
    const phase = rngBelow(dir.state, BULLSEYE_V4_PHASE_UNITS);
    const ya = rngBelow(phase.state, 2 * lim + 1);
    const yb = rngBelow(ya.state, 2 * lim + 1);
    const bob = rngBelow(yb.state, BULLSEYE_V4_BALLOON_BOB_PERIOD);
    rng = bob.state;
    balloons[index] = {
      value: values[n]!,
      dir: dir.value === 0 ? -1 : 1,
      phase: phase.value,
      bob: bob.value,
      ya: ya.value - lim,
      yb: yb.value - lim,
    };
  }
  return { ...base, rng, rev: BULLSEYE_REV, tune: BULLSEYE_TUNE, balloons: balloons as unknown as (BullseyeBalloon | null)[] };
}

/* ================= Oct 2026 score bands (bullRev 3) ================= */

/** Score-band revision (puzzle.bullRev = 3): rev-2 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const BULLSEYE_REV_BAND = 3;
/** Dart total (rev-2 rings, 12 for an inner bull or a balloon); 150 at 110. */
export const BULLSEYE_BAND_CURVE = bandCurve([0, 72, 82, 94, 102, 110], [0, 70, 100, 125, 145, 150]);

export function bullseyeBandParts(state: BullseyeState): BandParts {
  if (state.expand === BULLSEYE_EXPAND) return bullseyeV8Parts(state);
  const units = Math.max(0, state.total);
  const curve = bandCurveOf(state, state.tune === BULLSEYE_TUNE ? BULLSEYE_V4_BAND_CURVE : BULLSEYE_BAND_CURVE);
  return { units, points: bandPoints(curve, units), bonus: 0, penalty: 0, finished: false, text: `${units} points from ${state.arrowIndex} darts` };
}

function scoreBand(state: BullseyeState): number {
  if (state.expand === BULLSEYE_EXPAND) return bandTotal(bullseyeBandParts(state), Boolean(state.acted), BULLSEYE_V8_MAX);
  return bandTotal(bullseyeBandParts(state), Boolean(state.acted));
}

export const bullseyeBandGame: ArcadeGame<BullseyeState, ArcadeInputEvent | null> = { ...bullseyeRev2Game, init: (seed) => bandInit(bullseyeInitRev2(seed)) };

/** bullRev 4: balloon points (up to 6) count toward the dart total; knots refitted with scripts/arcade-skill-bands.ts --rev=current; 150 at 112. */
export const BULLSEYE_V4_BAND_CURVE = bandCurve([0, 75, 82, 92, 101, 112], [0, 70, 100, 125, 145, 150]);

/** bullRev 4 (Tuning B): value balloons across the board, scored on the bands. */
export const bullseyeTunedGame: ArcadeGame<BullseyeState, ArcadeInputEvent | null> = { ...bullseyeRev2Game, init: (seed) => bandInit(bullseyeInitRev4(seed)) };

/* ================= Scoring targets (bullRev 5, 18 Oct 2026) ================= */

/**
 * bullRev 5 (scoring targets, docs/scoring-targets.md): bullRev 4 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const BULLSEYE_REV_TARGET = 5;
export const bullseyeTargetGame = bandTargetGame(bullseyeTunedGame);
/** The curve new rounds score on: BULLSEYE_V4_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const BULLSEYE_V5_BAND_CURVE = bandRetarget(BULLSEYE_V4_BAND_CURVE);


/* ================= Score bands (bullRev 6, 19 Oct 2026) ================= */

/**
 * bullRev 6 (score bands, docs/scoring-targets.md): bullRev 5 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const BULLSEYE_REV_STRICT = 6;
export const bullseyeStrictGame = bandStrictGame(bullseyeTargetGame);
/** The curve new rounds score on: BULLSEYE_V4_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const BULLSEYE_V6_BAND_CURVE = bandStrict(BULLSEYE_V4_BAND_CURVE);


/* ============ World expansion (bullRev 8, 26 Oct 2026; docs/expansions/e9.md) ============ */

/**
 * bullRev 8: bullRev 6's darts, rings, inner bull, wind, sway, drifting board, shuffles and value
 * balloons on a taller range (390 × BULLSEYE_V8_WORLD_H; the range runs BULLSEYE_V8_LIFT px above the
 * original top, so the bow, the counter and every original coordinate stay where they were), with each
 * dart's board at its own distance and height: five distances, nearer boards lower and bigger, further
 * ones higher and smaller (seeded per dart after every earlier draw; darts 1–3 never the two furthest).
 * A drag carries the dart 1.5 times as far (BULLSEYE_V8_FLIGHT_NUM), so every board is in reach.
 *
 * The skill features: a bullseye streak and the dead-centre ring. Darts in the gold 10 (wherever the 10
 * sits, inner bull included) in a row build a streak ×n (n bulls in a row); from ×3 each bull adds
 * BULLSEYE_V8_STREAK_STEP × (n − 2) streak points (+2, +4, +6 …), counted up to BULLSEYE_V8_STREAK_CAP.
 * A dart anywhere else ends it. Inside the bull (when the 10 is the centre ring) a dead-centre ring a quarter
 * of the bull's radius adds BULLSEYE_V8_DEAD_PTS on top (counted up to BULLSEYE_V8_DEAD_CAP); it keeps the
 * streak as any bull does. The score is the dart total on bullRev 6's own curve (up to 150), plus the
 * streak and dead-centre points: a near-perfect player fills the streak; only pinpoint darts reach 190–200.
 * Everything (boards, heights, winds, drift, shuffles, balloons) is drawn from the seed at init.
 * States add `expand: 1`, `targets`, `streak`, `streakPts` and `dead`; scoring passes 200 as the maximum.
 */
export const BULLSEYE_REV_EXPAND = 8;
export const BULLSEYE_EXPAND = 1;
export const BULLSEYE_V8_MAX = 200;
/** The extra range above the original top, px; the world is 390 × (560 + lift). */
export const BULLSEYE_V8_LIFT = 168;
export const BULLSEYE_V8_WORLD_H = BULLSEYE_WORLD_H + BULLSEYE_V8_LIFT;
/** bullRev 8's flight constant: 1.5 × the original reach for the same drag. */
export const BULLSEYE_V8_FLIGHT_NUM = (BULLSEYE_FLIGHT_NUM * 3) / 2;
/** The five distances, near to far: board size (per cent) and centre height (sim px, up negative). */
export const BULLSEYE_V8_SCALES = [104, 92, 82, 72, 64] as const;
export const BULLSEYE_V8_HEIGHTS = [246, 178, 112, 48, -12] as const;
/** Each board's height is moved up to this many px either way (seeded). */
export const BULLSEYE_V8_JITTER = 10;
/** Darts 1–3 are dealt from the three nearest distances. */
export const BULLSEYE_V8_EASY_DARTS = 3;
/** The drifting board stays this far inside the range's sides. */
export const BULLSEYE_V8_SIDE = 8;
/** Streak points per bull: STEP × (n − 2) on the n-th bull in a row (none for the first two). */
export const BULLSEYE_V8_STREAK_STEP = 2;
/** The streak length from which a bull earns streak points. */
export const BULLSEYE_V8_STREAK_FROM = 3;
/** The most streak points the score counts. */
export const BULLSEYE_V8_STREAK_CAP = 30;
/**
 * The dead-centre ring: a quarter of the bull's (the centre ring's) radius; each dart in it adds this, counted up to
 * the cap. A quarter, not the half first planned, because with the band tool's fixed bots near-perfect players landed
 * five of their 10-centred bulls inside a half-radius ring and elite ones six (docs/expansions/e9.md); inside a quarter
 * it is two against three and a half, so pinpoint darts are what reach 190–200. 7 a dart, up to 42: a seed has six to
 * nine darts with the 10 in the centre, and on a six-dart seed a perfect run (inner bull every dart, dead centre on
 * the six) needs them all for 200 (expansion-e9-check proves the ceiling on every tuning and fresh seed).
 */
export const BULLSEYE_V8_DEAD_DIV = BULLSEYE_RINGS * 4;
export const BULLSEYE_V8_DEAD_PTS = 7;
export const BULLSEYE_V8_DEAD_CAP = 42;

export interface BullseyeTarget {
  /** Centre height, sim px (the original range's coordinates; negative above its top). */
  cy: number;
  /** Board size, per cent of the full board. */
  scale: number;
  /** Distance level, 0 (near) to 4 (far). */
  dist: number;
}

/** A dart's board: its centre height and size. Earlier revisions: the original centre and the shrinking range. */
export function bullseyeBoard(state: Partial<Pick<BullseyeState, "expand" | "targets">>, arrow: number): { cy: number; scalePct: number } {
  const target = state.expand === BULLSEYE_EXPAND ? state.targets?.[clampInt(arrow, 0, BULLSEYE_ARROWS - 1)] : undefined;
  return target ? { cy: target.cy, scalePct: target.scale } : { cy: BULLSEYE_CY, scalePct: bullseyeScalePct(arrow) };
}

/**
 * The board's sideways drift at a tick: bullseyeTargetDx, held inside the range on bullRev 8 (a near,
 * big board swings less so its rim never leaves the screen).
 */
export function bullseyeDxOf(state: Pick<BullseyeState, "driftPhase" | "driftDir"> & Partial<Pick<BullseyeState, "expand" | "targets">>, arrow: number, tick: number): number {
  const dx = bullseyeTargetDx(arrow, tick, state.driftPhase, state.driftDir);
  if (state.expand !== BULLSEYE_EXPAND) return dx;
  const room = BULLSEYE_CX - BULLSEYE_V8_SIDE - Math.ceil((BULLSEYE_OUTER_R * bullseyeBoard(state, arrow).scalePct) / 100);
  return clampInt(dx, -room, room);
}

/** Where a flick lands before the wind: bullseyeLanding, with bullRev 8's longer reach. */
export function bullseyeLandingFor(state: Partial<Pick<BullseyeState, "expand">>, vx: number, vy: number): { x: number; y: number } {
  if (state.expand !== BULLSEYE_EXPAND) return bullseyeLanding(vx, vy);
  const reach = (value: number) => Math.round((value * BULLSEYE_V8_FLIGHT_NUM) / BULLSEYE_FLIGHT_DEN);
  return {
    x: clampInt(BULLSEYE_BOW_X + reach(vx), -400, BULLSEYE_WORLD_W + 400),
    y: clampInt(BULLSEYE_BOW_Y - reach(-vy), -BULLSEYE_V8_LIFT - 400, BULLSEYE_WORLD_H + 400),
  };
}

/** Where a shot released on this tick would land for this state's dart, sway included, wind excluded. */
export function bullseyeAimPointFor(state: BullseyeState, tick: number, vx: number, vy: number): { x: number; y: number } {
  if (state.expand !== BULLSEYE_EXPAND) return bullseyeAimPoint(state.arrowIndex, tick, vx, vy);
  const arrow = clampInt(state.arrowIndex, 0, BULLSEYE_ARROWS - 1);
  const landing = bullseyeLandingFor(state, vx, vy);
  const sway = bullseyeSway(arrow, tick, bullseyeBoard(state, arrow).scalePct);
  return { x: landing.x + sway.dx, y: landing.y + sway.dy };
}

/** One wind unit moves one ring width at this dart's board size. */
export function bullseyeWindShiftFor(state: BullseyeState, arrow: number, wind: number): number {
  if (state.expand !== BULLSEYE_EXPAND) return bullseyeWindShiftPx(arrow, wind);
  return Math.round((wind * BULLSEYE_OUTER_R * bullseyeBoard(state, arrow).scalePct) / (BULLSEYE_RINGS * 100));
}

/** Streak points for the n-th bull in a row: STEP × (n − 2) from the third. */
export function bullseyeStreakGain(n: number): number {
  return n >= BULLSEYE_V8_STREAK_FROM ? BULLSEYE_V8_STREAK_STEP * (n - BULLSEYE_V8_STREAK_FROM + 1) : 0;
}

/** True when a hit landed in the gold 10, wherever the 10 sits (the inner bull included). */
export function bullseyeIsBull(hit: Pick<BullseyeHit, "ring" | "value" | "bal">): boolean {
  return hit.ring >= 0 && hit.value - (hit.bal ?? 0) >= 10;
}

/** bullRev 8: one dart, scored where its board is when it lands. */
function bullseyeV8Shot(state: BullseyeState, tick: number, vx: number, vy: number): BullseyeState {
  const arrow = state.arrowIndex;
  const wind = state.winds[arrow] ?? 0;
  const board = bullseyeBoard(state, arrow);
  const aimed = bullseyeAimPointFor(state, tick, vx, vy);
  const x = aimed.x + bullseyeWindShiftFor(state, arrow, wind);
  const y = aimed.y;
  const land = tick + BULLSEYE_FLIGHT_TICKS;
  const tdx = bullseyeDxOf(state, arrow, land);
  const values = bullseyeRingValues(state, arrow);
  const ring = bullseyeRingAt(x - tdx, y, board.scalePct, board.cy);
  let value = bullseyeRingValue(ring, values);
  const bull = ring === 0 && bullseyeInInnerBull(x - tdx, y, board.scalePct, values, board.cy);
  if (bull) value = BULLSEYE_INNER_BULL_POINTS;
  const balloon = (state.balloons?.[arrow] ?? null) as BullseyeBalloonV4 | null;
  const popped = balloon !== null && bullseyeBalloonV4Popped(balloon, state, arrow, land, x, y);
  if (popped) value += balloon.value;
  const hit: BullseyeHit = { x, y, ring, value, arrow, wind, tdx, bull: bull ? 1 : 0, pop: popped ? 1 : 0, bal: popped ? balloon.value : 0 };
  let streak = 0;
  let gained = 0;
  let dead = state.dead ?? 0;
  if (bullseyeIsBull(hit)) {
    streak = (state.streak ?? 0) + 1;
    gained = bullseyeStreakGain(streak);
    if (streak > 1) hit.sk = streak;
    if (gained > 0) hit.skp = gained;
    if (bullseyeInDeadCentre(x - tdx, y, board.scalePct, values, board.cy)) {
      hit.dc = 1;
      dead += 1;
    }
  }
  const next: BullseyeState = {
    ...state,
    tick,
    flightTick: BULLSEYE_FLIGHT_TICKS,
    arrowIndex: arrow + 1,
    hits: [...state.hits, hit],
    total: state.total + value,
    streak,
    streakPts: (state.streakPts ?? 0) + gained,
    dead,
  };
  if (isOver(next)) return { ...next, endedTick: tick };
  return next;
}

/**
 * bullRev 8's dead-centre ring: within a quarter of the bull's radius of the board's centre, on a dart whose centre
 * ring is the 10 (integer comparison, as bullseyeRingAt).
 */
export function bullseyeInDeadCentre(x: number, y: number, scalePct: number, values: readonly number[], cy: number): boolean {
  if (values[0] !== 10) return false;
  const dx = x - BULLSEYE_CX;
  const dy = y - cy;
  return (dx * dx + dy * dy) * BULLSEYE_V8_DEAD_DIV * BULLSEYE_V8_DEAD_DIV * 10_000 <= (BULLSEYE_OUTER_R * scalePct) ** 2;
}

/** bullRev 8's dead-centre points as the score counts them. */
export function bullseyeDeadPoints(state: Pick<BullseyeState, "dead">): number {
  return Math.min(BULLSEYE_V8_DEAD_CAP, BULLSEYE_V8_DEAD_PTS * (state.dead ?? 0));
}

/** bullRev 8's start state: bullRev 6's draws (winds, drift, ring swaps), then each dart's board, then the value balloons. */
export function bullseyeInitRev8(seed: number, storedWinds?: readonly number[]): BullseyeState {
  const base = bullseyeInit(seed, storedWinds);
  let rng = base.rng;
  const targets: BullseyeTarget[] = [];
  for (let arrow = 0; arrow < BULLSEYE_ARROWS; arrow++) {
    const levels = arrow < BULLSEYE_V8_EASY_DARTS ? 3 : BULLSEYE_V8_SCALES.length;
    const dist = rngBelow(rng, levels);
    const jitter = rngBelow(dist.state, 2 * BULLSEYE_V8_JITTER + 1);
    rng = jitter.state;
    targets.push({ cy: BULLSEYE_V8_HEIGHTS[dist.value]! + jitter.value - BULLSEYE_V8_JITTER, scale: BULLSEYE_V8_SCALES[dist.value]!, dist: dist.value });
  }
  const placed = withValueBalloons({ ...base, rng }, (arrow) => Math.trunc((BULLSEYE_OUTER_R * targets[arrow]!.scale) / 100));
  return { ...bandInit(placed), band: BAND_STRICT_MARK, expand: BULLSEYE_EXPAND, targets, streak: 0, streakPts: 0, dead: 0 };
}

/**
 * bullRev 8's dart-total curve (rings, inner bulls and balloons; the streak and dead-centre points come on
 * top), fitted with scripts/expansion-e9-bands.ts (docs/expansions/e9.md).
 */
export const BULLSEYE_V8_BAND_CURVE = bandCurve([0, 54, 69, 81, 92, 100, 108, 113, 118, 130], [0, 57, 73, 98, 112, 121, 128, 130, 142, 150]);

/** bullRev 8's streak points as the score counts them (up to BULLSEYE_V8_STREAK_CAP). */
export function bullseyeStreakPoints(state: Pick<BullseyeState, "streakPts">): number {
  return clampInt(state.streakPts ?? 0, 0, BULLSEYE_V8_STREAK_CAP);
}

function bullseyeV8Parts(state: BullseyeState): BandParts {
  const units = Math.max(0, state.total);
  const streak = bullseyeStreakPoints(state);
  const dead = bullseyeDeadPoints(state);
  return {
    units,
    points: bandPoints(BULLSEYE_V8_BAND_CURVE, units),
    bonus: streak + dead,
    penalty: 0,
    finished: false,
    text: `${units} points from ${state.arrowIndex} darts`,
    bonusText: `Bull streak +${streak} · dead-centre ${state.dead ?? 0} +${dead}`,
  };
}

/** bullRev 8: the taller range with boards at five distances, the bullseye streak and the dead-centre ring, scored to 200. */
export const bullseyeExpandGame: ArcadeGame<BullseyeState, ArcadeInputEvent | null> = { ...bullseyeRev2Game, init: (seed) => bullseyeInitRev8(seed) };
