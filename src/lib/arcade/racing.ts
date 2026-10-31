/**
 * Racing (`racing`, racingRev 1, 30 Oct 2026; docs/arcade-standard/racing.md): a 90-second, two-lap race on a seeded
 * circuit, driven with a one-thumb joystick, seen from a chase camera (racing.renderer.ts draws it pseudo-3D).
 *
 * The sim is deterministic and integer only (rules in src/lib/arcade/AGENTS.md):
 *  - the circuit is built at init from the seed (racingTrack): RACING_LAP_SEGS segments a lap, each with an integer
 *    curvature (positive = a right-hander) and a display-only elevation; straights, sweepers, corners, a chicane and
 *    two hairpins; the lap split into 4 sectors, so the race has 8 sector passes;
 *  - the car has a speed `v` along the track (1/4096 of a segment a tick) and a lateral position `x` (±65536 = the
 *    tarmac's edge, positive = right);
 *  - input is the k = 7 joystick: `a` steer −100…100 (right positive), `b` throttle (+) / brake (−) −100…100, held
 *    until the next event; a release sends (0, 0), which coasts;
 *  - steering moves the car sideways in proportion to speed; a curve pushes it outwards in proportion to speed² ×
 *    curvature, so the tight corners need braking; the kerb is track; past it (the car's outer wheel on the grass or
 *    gravel) the car slows hard; the tyre wall beyond stops it sideways and costs speed. Grass and walls cost time only.
 *
 * Score (the arcade scoring standard, 200): distance 140 on a straight line (full at two complete laps), clean
 * sectors 30 (floor(30 × clean ÷ 8), a sector clean when driven through with no grass or wall contact), finish 10
 * and speed 20 (only on a finish: full at RACING_PAR_TICKS, 0 at the buzzer). No input 0, any played run 1+.
 */
import {
  ARCADE_INPUT_DRAG,
  clampInt,
  inputRange,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { stdBandParts, stdLine, stdPart, stdScore, stdSpeed, stdSum, type StdPart, type StdSpec } from "./arcadeStandard";
import { bandCurve, type BandParts } from "./scoreBands";

/* ================================ Constants ================================ */

export const RACING_REV_STD = 1;
/** racingRev 2 (31 Oct 2026, Apex): the F1 lights start, the softer joystick (dead zone, expo, smoothing). */
export const RACING_REV_2 = 2;
/** The revision rooms and practice deal. */
export const RACING_REV_DEALT = RACING_REV_2;
/** The race itself: 90 s (on racingRev 2 from lights out). */
export const RACING_RUN_SECONDS = 90;
export const RACING_RUN_TICKS = RACING_RUN_SECONDS * TICKS_PER_SECOND;

/**
 * racingRev 2's start lights: the car waits on its grid spot; light k (1…5) comes on at RACING_V2_LIGHT0 + (k − 1) ×
 * RACING_V2_LIGHT_GAP, all five go out at RACING_V2_GO and the race clock starts. Until then the car cannot move.
 */
export const RACING_V2_LIGHTS = 5;
export const RACING_V2_LIGHT0 = 30;
export const RACING_V2_LIGHT_GAP = TICKS_PER_SECOND;
export const RACING_V2_GO = RACING_V2_LIGHT0 + RACING_V2_LIGHTS * RACING_V2_LIGHT_GAP;
/** racingRev 2's whole run: the lights, then the 90-second race. */
export const RACING_V2_RUN_TICKS = RACING_V2_GO + RACING_RUN_TICKS;

/** The tick the race clock starts on (0 on racingRev 1; lights out on 2). */
export function racingGoTick(rev: number): number {
  return rev >= RACING_REV_2 ? RACING_V2_GO : 0;
}
/** How many start lights are lit at a tick (racingRev 2; 0 before the first and from lights out). */
export function racingLightsOn(rev: number, tick: number): number {
  if (rev < RACING_REV_2 || tick >= RACING_V2_GO || tick < RACING_V2_LIGHT0) return 0;
  return Math.min(RACING_V2_LIGHTS, Math.floor((tick - RACING_V2_LIGHT0) / RACING_V2_LIGHT_GAP) + 1);
}
/** The race clock (ticks since the start; 0 during racingRev 2's lights). */
export function racingRaceTicks(state: Pick<RacingState, "rev" | "tick">): number {
  return Math.max(0, state.tick - racingGoTick(state.rev));
}

export const RACING_WORLD_W = 390;
/** 390 × 727 since 31 Oct 2026 (display only, every revision): the arena box's aspect at 414 × 896, so no strip below. */
export const RACING_WORLD_H = 727;
export const RACING_BG = "#1A1418";

/** The joystick: a = steer, b = throttle (+) / brake (−). */
export const RACING_INPUT_STICK = ARCADE_INPUT_DRAG;
export const RACING_STICK_MAX = 100;
export const RACING_INPUT_RANGES: readonly InputRange[] = [
  inputRange(RACING_INPUT_STICK, [-RACING_STICK_MAX, RACING_STICK_MAX], [-RACING_STICK_MAX, RACING_STICK_MAX]),
];

/** One track segment, in distance units (the ghosts' `s` unit: 4096 a segment). */
export const RACING_SEG = 4096;
/** Segments in a lap (every circuit is exactly this long). */
export const RACING_LAP_SEGS = 1290;
export const RACING_LAP = RACING_LAP_SEGS * RACING_SEG;
export const RACING_LAPS = 2;
export const RACING_TOTAL = RACING_LAP * RACING_LAPS;
export const RACING_SECTORS_PER_LAP = 4;
export const RACING_SECTORS = RACING_SECTORS_PER_LAP * RACING_LAPS;
export const RACING_SECTOR_LEN = RACING_TOTAL / RACING_SECTORS;

/** Lateral units: the tarmac's half width; the kerb runs to RACING_KERB_X; the tyre wall's face is at RACING_WALL_X. */
export const RACING_ROAD_X = 65536;
export const RACING_KERB_X = 73728;
export const RACING_WALL_X = 131072;
/** The car's half width (lateral units): it is off track once its outer wheel passes the kerb. */
export const RACING_CAR_HALF = 16384;
/** The car's centre may be this far out before a wheel is on the grass / the car touches the wall. */
export const RACING_CLEAN_X = RACING_KERB_X - RACING_CAR_HALF;
export const RACING_WALL_LIMIT = RACING_WALL_X - RACING_CAR_HALF;

/** Top speed (distance units a tick: 0.75 of a segment) and how the HUD reads it. */
export const RACING_VMAX = 3072;
export const RACING_KMH_AT_VMAX = 300;
/** Throttle: speed gained per tick at full throttle from rest (falls linearly to 0 at top speed). */
export const RACING_ACCEL = 18;
/** Full brake: speed lost a tick. */
export const RACING_BRAKE = 42;
/** Coasting drag a tick. */
export const RACING_COAST = 5;
/** Off track: speeds above this fall hard (1/RACING_OFF_DIV a tick, at least RACING_OFF_MIN). */
export const RACING_OFF_CAP = 1075;
export const RACING_OFF_DIV = 22;
export const RACING_OFF_MIN = 18;
/** Steering: lateral units a tick at full lock and top speed (proportional to speed). */
export const RACING_STEER_K = 3000;
/** A curve of curvature c balances full lock at speed RACING_C_BAL × VMAX ÷ c. */
export const RACING_C_BAL = 4;
/** Past that speed the tyres let go: the car also slides outwards by RACING_SLIDE_K × the excess a tick. */
export const RACING_SLIDE_K = 6;

/**
 * racingRev 2's steering (the joystick less sensitive): the stick's steer `a` goes through a dead zone of
 * RACING_V2_DEAD, then an expo curve (half the gain at mid-stick, the same full lock), and the front wheels turn
 * towards that at most RACING_V2_WHEEL_RATE a tick (smoothing: centre to full lock in about 0.2 s). Throttle and
 * brake are unchanged.
 */
export const RACING_V2_DEAD = 10;
export const RACING_V2_WHEEL_RATE = 8;

/** racingRev 2: the steer the wheels head for from a stick value (dead zone, then expo; integer, odd-symmetric). */
export function racingV2SteerTarget(a: number): number {
  const m = Math.abs(a);
  if (m <= RACING_V2_DEAD) return 0;
  const u = Math.trunc(((Math.min(RACING_STICK_MAX, m) - RACING_V2_DEAD) * 100) / (RACING_STICK_MAX - RACING_V2_DEAD));
  const t = Math.trunc((u * u + 100 * u) / 200);
  return a < 0 ? -t : t;
}

/* ================================ The track ================================ */

export const RACING_SEC_STRAIGHT = 0;
export const RACING_SEC_SWEEPER = 1;
export const RACING_SEC_CORNER = 2;
export const RACING_SEC_HAIRPIN = 3;
export const RACING_SEC_CHICANE = 4;

/** One section of the lap, for the renderer's furniture (braking boards, gravel, skid marks) and the bots. */
export interface RacingSection {
  kind: number;
  /** First segment and length in segments. */
  start: number;
  len: number;
  /** +1 a right-hander, −1 a left-hander (the chicane's first turn), 0 a straight. */
  dir: number;
  /** Peak curvature (absolute). */
  peak: number;
}

export interface RacingTrack {
  seed: number;
  /** Curvature per segment (integer, positive = right). */
  curve: Int8Array;
  /** Elevation per segment, display units (renderer only). */
  hill: Int16Array;
  sections: RacingSection[];
  /** The corner sections (corners, hairpins, chicanes) in lap order: braking boards and gravel traps. */
  corners: RacingSection[];
}

const CURVE_EASE = 6;

function makeDraw(seed: number) {
  let rng = (seed ^ 0x5a17_c0de) | 0;
  return (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
}

/** Builds a seed's circuit (pure; cached by racingTrack). */
export function buildRacingTrack(seed: number): RacingTrack {
  const draw = makeDraw(seed);
    // The same set every lap (so every circuit takes about as long): two hairpins, a chicane, three corners, two sweepers.
  const kinds: number[] = [RACING_SEC_HAIRPIN, RACING_SEC_HAIRPIN, RACING_SEC_CHICANE, RACING_SEC_CORNER, RACING_SEC_CORNER, RACING_SEC_CORNER, RACING_SEC_SWEEPER, RACING_SEC_SWEEPER];
  // Shuffle (Fisher–Yates on the seeded stream), keeping two hairpins apart.
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = draw(i + 1);
    const t = kinds[i]!;
    kinds[i] = kinds[j]!;
    kinds[j] = t;
  }
  for (let i = 1; i < kinds.length; i++)
    if (kinds[i] === RACING_SEC_HAIRPIN && kinds[i - 1] === RACING_SEC_HAIRPIN) {
      const k = (i + 2) % kinds.length;
      const t = kinds[i]!;
      kinds[i] = kinds[k]!;
      kinds[k] = t;
    }

  const curved: { kind: number; len: number; dir: number; peak: number }[] = kinds.map((kind) => {
    const dir = draw(2) === 0 ? -1 : 1;
    if (kind === RACING_SEC_SWEEPER) return { kind, len: 60 + draw(50), dir, peak: 1 + draw(2) };
    if (kind === RACING_SEC_CORNER) return { kind, len: 34 + draw(22), dir, peak: 4 + draw(3) };
    if (kind === RACING_SEC_HAIRPIN) return { kind, len: 30 + draw(8), dir, peak: 10 + draw(2) };
    return { kind, len: 34 + draw(8), dir, peak: 7 };
  });
  const curvedLen = curved.reduce((a, c) => a + c.len, 0);
  // Straights: one before each curved section and a closing one, each at least its minimum, the rest shared by weight.
  const nStraights = curved.length + 1;
  const minLen = (i: number) => (i === 0 ? 70 : i === nStraights - 1 ? 60 : 34);
  let spare = RACING_LAP_SEGS - curvedLen;
  for (let i = 0; i < nStraights; i++) spare -= minLen(i);
  const weights: number[] = [];
  for (let i = 0; i < nStraights; i++) weights.push(1 + draw(6));
  const wsum = weights.reduce((a, w) => a + w, 0);
  const straightLen: number[] = [];
  let given = 0;
  for (let i = 0; i < nStraights; i++) {
    const extra = i === nStraights - 1 ? spare - given : Math.floor((spare * weights[i]!) / wsum);
    given += extra;
    straightLen.push(minLen(i) + extra);
  }

  const curve = new Int8Array(RACING_LAP_SEGS);
  const sections: RacingSection[] = [];
  let at = 0;
  const ease = (start: number, len: number, value: number) => {
    for (let k = 0; k < len; k++) {
      const inK = Math.min(k + 1, len - k, CURVE_EASE);
      curve[start + k] = Math.trunc((value * inK) / CURVE_EASE);
    }
  };
  for (let i = 0; i < nStraights; i++) {
    sections.push({ kind: RACING_SEC_STRAIGHT, start: at, len: straightLen[i]!, dir: 0, peak: 0 });
    at += straightLen[i]!;
    const c = curved[i];
    if (!c) break;
    if (c.kind === RACING_SEC_CHICANE) {
      const half = c.len >> 1;
      ease(at, half, c.peak * c.dir);
      ease(at + half, c.len - half, -c.peak * c.dir);
    } else ease(at, c.len, c.peak * c.dir);
    sections.push({ kind: c.kind, start: at, len: c.len, dir: c.dir, peak: c.peak });
    at += c.len;
  }

  // Gentle hills (display only): smoothstep between seeded heights every 90–160 segments, level at the start line.
  const hill = new Int16Array(RACING_LAP_SEGS);
  let h0 = 0;
  let p = 0;
  while (p < RACING_LAP_SEGS) {
    let len = 90 + draw(71);
    if (RACING_LAP_SEGS - (p + len) < 90) len = RACING_LAP_SEGS - p;
    const h1 = p + len >= RACING_LAP_SEGS ? 0 : draw(2400) - 1200;
    const L3 = len * len * len;
    for (let k = 0; k < len; k++) hill[p + k] = h0 + Math.trunc(((h1 - h0) * (3 * k * k * len - 2 * k * k * k)) / L3);
    h0 = h1;
    p += len;
  }
  return { seed, curve, hill, sections, corners: sections.filter((s) => s.kind >= RACING_SEC_CORNER) };
}

const trackCache = new Map<number, RacingTrack>();
/** A seed's circuit (cached; the same object for the sim, the renderer and the bots). */
export function racingTrack(seed: number): RacingTrack {
  const key = seed | 0;
  let t = trackCache.get(key);
  if (!t) {
    t = buildRacingTrack(key);
    if (trackCache.size > 24) trackCache.clear();
    trackCache.set(key, t);
  }
  return t;
}

/** The seeded plan (the brief's `pSeedPlan`): the circuit itself. */
export const racingSeedPlan = racingTrack;

/** The segment (0 … LAP_SEGS − 1) a race distance falls on. */
export function racingSegAt(s: number): number {
  const lapS = ((s % RACING_LAP) + RACING_LAP) % RACING_LAP;
  return Math.floor(lapS / RACING_SEG);
}

/** The highest speed a curvature allows at full lock (the balance point). */
export function racingBalanceSpeed(c: number): number {
  const a = Math.abs(c);
  return a <= 0 ? RACING_VMAX : Math.min(RACING_VMAX, Math.floor((RACING_C_BAL * RACING_VMAX) / a));
}

/* ================================ The state ================================ */

export interface RacingState {
  rev: number;
  seed: number;
  tick: number;
  /** Input events that did something (0 → the run scores 0). */
  acted: number;
  /** Race distance (0 … RACING_TOTAL), speed, lateral position. */
  s: number;
  v: number;
  x: number;
  /** The held joystick. */
  steer: number;
  pedal: number;
  /** racingRev 2: the front wheels' steer (smoothed towards the stick's target; 0 on racingRev 1). */
  wheel: number;
  /** 1 on a tick with a wheel on the grass / against the tyre wall. */
  off: number;
  wall: number;
  /** The current sector (0 … 8; 8 once finished) and whether it has had contact. */
  sector: number;
  dirty: number;
  /** Clean sectors so far and their bit mask (bit k = sector k clean). */
  clean: number;
  cleanMask: number;
  /** Ticks off track and wall impacts (the reveal's facts). */
  offTicks: number;
  wallHits: number;
  /** Contacts begun (a tick with grass or wall after one with neither). */
  contacts: number;
  /** The tick the second lap was completed (0 until then). */
  finishTick: number;
}

export function racingInit(seed: number): RacingState {
  racingTrack(seed);
  return {
    rev: RACING_REV_STD,
    seed: seed | 0,
    tick: 0,
    acted: 0,
    s: 0,
    v: 0,
    x: 0,
    steer: 0,
    pedal: 0,
    wheel: 0,
    off: 0,
    wall: 0,
    sector: 0,
    dirty: 0,
    clean: 0,
    cleanMask: 0,
    offTicks: 0,
    wallHits: 0,
    contacts: 0,
    finishTick: 0,
  };
}

/** Lateral push of a curve at speed v (units a tick, towards the outside, signed as c): speed² × curvature, plus the slide past the grip limit. */
export function racingPush(c: number, v: number): number {
  const push = Math.trunc((c * v * v * RACING_STEER_K) / (RACING_C_BAL * RACING_VMAX * RACING_VMAX));
  const over = v - racingBalanceSpeed(c);
  return over > 0 && c !== 0 ? push + Math.sign(c) * over * RACING_SLIDE_K : push;
}

/** Lateral move from a steer at speed v. */
export function racingSteerMove(steer: number, v: number): number {
  return Math.trunc((steer * RACING_STEER_K * v) / (RACING_STICK_MAX * RACING_VMAX));
}

export function racingStep(prev: RacingState, input: ArcadeInputEvent | null): RacingState {
  if (racingIsOver(prev)) return prev;
  const s0 = { ...prev, tick: prev.tick + 1 };
  if (input && input.k === RACING_INPUT_STICK) {
    s0.steer = clampInt(Math.trunc(input.a), -RACING_STICK_MAX, RACING_STICK_MAX);
    s0.pedal = clampInt(Math.trunc(input.b), -RACING_STICK_MAX, RACING_STICK_MAX);
    s0.acted += 1;
  }
  const v2 = s0.rev >= RACING_REV_2;
  if (v2) {
    // The wheels follow the stick's target at the smoothing rate, also on the grid (the car shows it).
    const want = racingV2SteerTarget(s0.steer);
    s0.wheel += clampInt(want - s0.wheel, -RACING_V2_WHEEL_RATE, RACING_V2_WHEEL_RATE);
    // The car waits on its grid spot until the lights go out.
    if (s0.tick <= RACING_V2_GO) return s0;
  }
  const track = racingTrack(s0.seed);
  const c = track.curve[racingSegAt(s0.s)]!;

  // Speed.
  let v = s0.v;
  const offBefore = Math.abs(s0.x) > RACING_CLEAN_X;
  if (s0.pedal > 0) {
    if (!(offBefore && v >= RACING_OFF_CAP)) v += Math.floor((RACING_ACCEL * s0.pedal * (RACING_VMAX - v)) / (RACING_STICK_MAX * RACING_VMAX));
  } else if (s0.pedal < 0) v -= Math.floor((RACING_BRAKE * -s0.pedal) / RACING_STICK_MAX);
  else v -= RACING_COAST;
  if (offBefore) {
    if (v > RACING_OFF_CAP) v -= Math.max(RACING_OFF_MIN, Math.floor(v / RACING_OFF_DIV));
    else v -= v >> 7;
  }
  v = clampInt(v, 0, RACING_VMAX);

  // Sideways: the steer, and the curve pushing outwards (a right-hander pushes left).
  let x = s0.x + racingSteerMove(v2 ? s0.wheel : s0.steer, v) - racingPush(c, v);
  let wall = 0;
  if (x > RACING_WALL_LIMIT || x < -RACING_WALL_LIMIT) {
    x = x > 0 ? RACING_WALL_LIMIT : -RACING_WALL_LIMIT;
    wall = 1;
    if (!s0.wall) {
      v = Math.floor((v * 3) / 4);
      s0.wallHits += 1;
    } else v -= v >> 5;
  }
  const off = Math.abs(x) > RACING_CLEAN_X ? 1 : 0;
  if ((off || wall) && !s0.off && !s0.wall) s0.contacts += 1;
  s0.x = x;
  s0.v = v;
  s0.wall = wall;
  s0.off = off;
  if (off) s0.offTicks += 1;
  if (off || wall) s0.dirty = 1;

  // Distance, sectors and the finish.
  let s = s0.s + v;
  if (s >= RACING_TOTAL) s = RACING_TOTAL;
  s0.s = s;
  while (s0.sector < RACING_SECTORS && s >= (s0.sector + 1) * RACING_SECTOR_LEN) {
    if (!s0.dirty) {
      s0.clean += 1;
      s0.cleanMask |= 1 << s0.sector;
    }
    s0.sector += 1;
    s0.dirty = 0;
  }
  if (s >= RACING_TOTAL && !s0.finishTick) s0.finishTick = s0.tick;
  return s0;
}

export function racingIsOver(s: RacingState): boolean {
  return s.finishTick > 0 || s.tick >= racingGoTick(s.rev) + RACING_RUN_TICKS;
}

/** The lap the car is on (1 or 2). */
export function racingLap(s: Pick<RacingState, "s">): number {
  return Math.min(RACING_LAPS, Math.floor(s.s / RACING_LAP) + 1);
}

/** Monotonic counters for the shared success / miss effects layer (display only). */
export function racingFxCounts(state: RacingState): { cleanSectors: number; laps: number; contacts: number } {
  return { cleanSectors: state.clean, laps: Math.floor(Math.min(state.s, RACING_TOTAL) / RACING_LAP), contacts: state.contacts };
}

/** HUD speed in km/h (display). */
export function racingKmh(v: number): number {
  return Math.round((v * RACING_KMH_AT_VMAX) / RACING_VMAX);
}

/* ================================ The standard ================================ */

export const RACING_CORE_MAX = 140;
export const RACING_SECTORS_MAX = 30;
export const RACING_FINISH_MAX = 10;
export const RACING_SPEED_MAX = 20;
/**
 * The speed part is full at this finish tick: the near-perfect level's median finish time on the dealt seeds
 * (scripts/racing-bands.ts, room seeds 0–59), and 0 at the buzzer.
 */
export const RACING_PAR_TICKS = 4850;
/**
 * racingRev 2's speed part is full at this race time (ticks from lights out): the near-perfect level's median on the
 * rev-2 deal (scripts/racing-bands.ts, room seeds 0–59).
 */
export const RACING_V2_PAR_TICKS = 4854;

/** The speed part's full-by race time for a revision. */
export function racingParTicks(rev: number): number {
  return rev >= RACING_REV_2 ? RACING_V2_PAR_TICKS : RACING_PAR_TICKS;
}

export const RACING_STD_SPEC: StdSpec = {
  field: "racingRev",
  rev: RACING_REV_STD,
  parts: [
    { key: "core", label: "Distance", max: RACING_CORE_MAX, of: RACING_LAPS, item: "lap", how: "a straight line, full at two complete laps" },
    { key: "sectors", label: "Clean sectors", max: RACING_SECTORS_MAX, of: RACING_SECTORS, item: "clean sector", how: `${RACING_SECTORS_MAX / RACING_SECTORS} each of ${RACING_SECTORS} sectors with no grass or wall` },
    { key: "finish", label: "Finish", max: RACING_FINISH_MAX, of: 1, how: "for completing both laps" },
    { key: "speed", label: "Speed", max: RACING_SPEED_MAX, of: 1, how: `on a finish: full by ${(RACING_PAR_TICKS / TICKS_PER_SECOND).toFixed(0)} s, 0 at the buzzer` },
  ],
};

/** racingRev 2's spec: the same four parts; speed on the race clock from lights out. */
export const RACING_V2_STD_SPEC: StdSpec = {
  field: "racingRev",
  rev: RACING_REV_2,
  parts: RACING_STD_SPEC.parts.map((p) =>
    p.key === "speed" ? { ...p, how: `on a finish: full by ${(RACING_V2_PAR_TICKS / TICKS_PER_SECOND).toFixed(0)} s from lights out, 0 at the buzzer` } : p,
  ),
};

/** A revision's spec (null for an unknown one). */
export function racingStdSpecFor(rev: number): StdSpec | null {
  return rev === RACING_REV_STD ? RACING_STD_SPEC : rev === RACING_REV_2 ? RACING_V2_STD_SPEC : null;
}

/** The run's parts (null off racingRev 1 and 2). */
export function racingStdParts(state: RacingState): StdPart[] | null {
  const spec = racingStdSpecFor(state.rev);
  if (!spec) return null;
  const dist = clampInt(state.s, 0, RACING_TOTAL);
  const pct = Math.floor((dist * 100) / RACING_TOTAL);
  const finished = state.finishTick > 0;
  const go = racingGoTick(state.rev);
  const raceTicks = finished ? state.finishTick - go : 0;
  const secs = (raceTicks / TICKS_PER_SECOND).toFixed(1);
  return [
    stdPart(spec, "core", stdLine(RACING_CORE_MAX, dist, RACING_TOTAL), finished ? "2 of 2 laps" : `${pct}% of 2 laps`),
    stdPart(spec, "sectors", stdLine(RACING_SECTORS_MAX, state.clean, RACING_SECTORS), `${state.clean} of ${RACING_SECTORS} clean`),
    stdPart(spec, "finish", finished ? RACING_FINISH_MAX : 0, finished ? "both laps" : "not finished"),
    stdPart(spec, "speed", finished ? stdSpeed(RACING_SPEED_MAX, raceTicks, racingParTicks(state.rev), RACING_RUN_TICKS) : 0, finished ? `${secs} s` : "no finish"),
  ];
}

export function racingScore(state: RacingState): number {
  const parts = racingStdParts(state);
  return parts ? stdScore(parts, state.acted > 0) : 0;
}

/** The core's straight line for the help (liveBands): 140 at two laps, in per mille of the race. */
export const RACING_V1_BAND_CURVE = bandCurve([0, 1000], [0, RACING_CORE_MAX]);
/** racingRev 2's core: the same straight line. */
export const RACING_V2_BAND_CURVE = RACING_V1_BAND_CURVE;

/** For the skill-band tool and the reveal: units = per mille of the race, points = the core, bonus = the features. */
export function racingBandParts(state: RacingState): BandParts {
  const parts = racingStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  const features: Record<string, number> = {};
  for (const p of parts.slice(1)) features[p.key] = p.points;
  return stdBandParts(
    racingStdSpecFor(state.rev) ?? RACING_STD_SPEC,
    { core, features, penalty: 0 },
    Math.floor((clampInt(state.s, 0, RACING_TOTAL) * 1000) / RACING_TOTAL),
    parts.map((p) => `${p.label} ${p.points}`).join(" · "),
    state.finishTick > 0,
  );
}

/** The parts' sum before the 1…200 hold (checks). */
export function racingPartsSum(state: RacingState): number {
  return stdSum(racingStdParts(state) ?? []);
}

/* ================================ Checkpoints ================================ */

export const RACING_CHECKPOINT_INTERVAL = 120;
export const RACING_CHECKPOINT_KEYS = ["tick", "s", "v", "x", "steer", "pedal", "sector", "clean", "acted", "checksum"] as const;
export type RacingCheckpoint = Record<(typeof RACING_CHECKPOINT_KEYS)[number], number>;

export function racingChecksum(s: RacingState): number {
  let h = 2166136261;
  const mix = (n: number) => {
    h = Math.imul(h ^ (n | 0), 16777619);
  };
  mix(s.tick);
  mix(s.s);
  mix(s.v);
  mix(s.x);
  mix(s.steer);
  mix(s.pedal);
  mix(s.sector);
  mix(s.dirty);
  mix(s.clean);
  mix(s.cleanMask);
  mix(s.offTicks);
  mix(s.wallHits);
  mix(s.contacts);
  mix(s.finishTick);
  mix(s.acted);
  // racingRev 2's smoothed wheel (racingRev 1 checksums exactly as before).
  if (s.rev >= RACING_REV_2) mix(s.wheel);
  return h >>> 0;
}

export function racingCheckpoint(s: RacingState): RacingCheckpoint {
  return { tick: s.tick, s: s.s, v: s.v, x: s.x, steer: s.steer, pedal: s.pedal, sector: s.sector, clean: s.clean, acted: s.acted, checksum: racingChecksum(s) };
}

/* ================================ The game ================================ */

/** A plain fallback draw (the art lives in racing.renderer.ts). */
function drawPlain(ctx: CanvasRenderingContext2D, state: RacingState, size: CanvasSize): void {
  const { width: w, height: h } = size;
  ctx.fillStyle = "#F2A65A";
  ctx.fillRect(0, 0, w, h * 0.42);
  ctx.fillStyle = "#3E5A2C";
  ctx.fillRect(0, h * 0.42, w, h * 0.58);
  const shift = (state.x / RACING_ROAD_X) * w * 0.3;
  ctx.fillStyle = "#3A3A40";
  ctx.beginPath();
  ctx.moveTo(w / 2 - 6, h * 0.42);
  ctx.lineTo(w / 2 + 6, h * 0.42);
  ctx.lineTo(w * 0.95 - shift, h);
  ctx.lineTo(w * 0.05 - shift, h);
  ctx.fill();
  ctx.fillStyle = "#24252A";
  ctx.fillRect(w / 2 - 30, h * 0.78, 60, 34);
  ctx.fillStyle = "#fff";
  ctx.font = "600 14px sans-serif";
  ctx.fillText(`${racingKmh(state.v)} km/h  lap ${racingLap(state)}/2`, 12, 22);
}

export const racingGame: ArcadeGame<RacingState, ArcadeInputEvent | null> = {
  key: "racing",
  runTicks: RACING_RUN_TICKS,
  init: racingInit,
  step: racingStep,
  isOver: racingIsOver,
  score: racingScore,
  draw: drawPlain,
  inputRanges: RACING_INPUT_RANGES,
};

/** racingRev 2: the lights, then the race (the run is the lights longer). */
export function racingInitV2(seed: number): RacingState {
  return { ...racingInit(seed), rev: RACING_REV_2 };
}
export const racingGameV2: ArcadeGame<RacingState, ArcadeInputEvent | null> = {
  ...racingGame,
  runTicks: RACING_V2_RUN_TICKS,
  init: racingInitV2,
};

/** The game for a stored stamp (unstamped and 1: racingRev 1; 2: the lights start and the softer joystick). */
export function racingGameFor(rev?: number | null): ArcadeGame<RacingState, ArcadeInputEvent | null> {
  return (rev ?? 1) >= RACING_REV_2 ? racingGameV2 : racingGame;
}
