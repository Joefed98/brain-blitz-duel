/**
 * Home Run (`homerun`, homerunRev 1, 2 and 3; docs/arcade-standard/homerun.md): ten seeded pitches in 60 s, one about
 * every 6 s, seen from the hitter's eyes. A swipe swings: the swing starts on the tick the finger starts moving (the
 * phone records it once the finger has moved SWING_START_PX), the swipe's height sets the contact point and its angle
 * the direction (pull, centre, opposite field). The bat meets the plate HOMERUN_SWING_TICKS later.
 *
 * Everything is integer maths. The pitch sequence and the four signs beyond the fence come from the seed at init
 * (homerunPlan, the same for every player); the batted ball is worked out at contact (distance in feet, spray angle,
 * launch), so the renderer only animates what the sim decided. Scoring is the arcade scoring standard
 * (arcadeStandard.ts): distance 130 on a straight line (13 a pitch, full at 450 ft), home runs 50 (5 each), sign hits
 * 20 (5 for each of the four signs). A sign stands beyond the fence everywhere, so a sign hit is always a home run.
 */
import { bandCurve, type BandParts } from "./scoreBands";
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
import { stdBandParts, stdEach, stdLine, stdPart, stdScore, type StdPart, type StdSpec } from "./arcadeStandard";

/* ------------------------------------------------------------------ world */

export const HOMERUN_REV_STD = 1;
/**
 * homerunRev 2 (31 Oct 2026, the Sports tuning batch; docs/arcade-standard/homerun.md "homerunRev 2"): finer aiming
 * (the spray is 9/16 of the swipe angle, fair to ±80° of swipe, so a sign needs a more exact swipe but has more room
 * either side) and the swing starts after HOMERUN_SWING_START_PX_V2 of finger travel (its angle read over a longer
 * chord). The plan, contact, timing, height and the parts are rev 1's. Rooms deal rev 2.
 */
export const HOMERUN_REV_2 = 2;
/**
 * homerunRev 3 (1 Nov 2026, "prepare the shot"; docs/arcade-standard/homerun.md "homerunRev 3"): before each pitch the
 * batter picks a Contact or a Power swing (HOMERUN_INPUT_MODE, locked for the pitch at its release), and the pitcher
 * shows a tell for the last HOMERUN_TELL_TICKS of the wind-up (the grip and arm slot, display only: the plan is rev 2's).
 * Each pitch type has its own timing: the perfect contact tick (fastball a tick early, curve and drop late, changeup
 * later) and window (fastball tightest); Contact's windows and sweet band are wide and it carries at most 410 ft, Power's
 * narrow and it carries 480 ft. The parts are rev 2's; the core is full at 460 ft a pitch. Rooms deal rev 3.
 */
export const HOMERUN_REV_3 = 3;
export const HOMERUN_REV_DEALT = HOMERUN_REV_3;
export const HOMERUN_WORLD_W = 390;
export const HOMERUN_WORLD_H = 720;
export const HOMERUN_BG = "#05070E";
export const HOMERUN_RUN_SECONDS = 60;
export const HOMERUN_RUN_TICKS = HOMERUN_RUN_SECONDS * TICKS_PER_SECOND;
export const HOMERUN_PITCHES = 10;

/** The first pitch's release tick and the gap between releases (one about every 6 s). */
export const HOMERUN_FIRST_RELEASE = 96;
export const HOMERUN_PITCH_GAP = 348;
/** The pitcher's wind-up before each release: a swing is accepted from here on. */
export const HOMERUN_WINDUP_TICKS = 54;
/** From the swing's start to the bat reaching the plate (100 ms). */
export const HOMERUN_SWING_TICKS = 6;
/** A pitch nobody swung at is taken this many ticks after it reaches the plate. */
export const HOMERUN_TAKE_TICKS = 6;
/** The run ends this long after the last pitch is decided (the last ball's flight). */
export const HOMERUN_END_HOLD = 150;

/** The faint strike zone on screen (world px): the plate plane the ball arrives in. */
export const HOMERUN_ZONE_X0 = 212;
export const HOMERUN_ZONE_X1 = 304;
export const HOMERUN_ZONE_Y0 = 446;
export const HOMERUN_ZONE_Y1 = 566;
/**
 * Where the pitcher releases the ball on screen (the mound, far away; display only, used by homerunBallAt). Moved on
 * 31 Oct 2026 with the camera behind the batter's shoulder (homerun.renderer.ts); no rule reads it.
 */
export const HOMERUN_RELEASE_X = 216;
export const HOMERUN_RELEASE_Y = 214;
/** The phone starts the swing once the finger has moved this far (world px; rev 1). */
export const HOMERUN_SWING_START_PX = 12;
/** homerunRev 2: a longer chord before the swing starts, so its angle (the aim) reads more exactly. */
export const HOMERUN_SWING_START_PX_V2 = 18;
/** The finger travel that starts the swing on a revision. */
export function homerunSwingStartPx(rev?: number | null): number {
  return (rev ?? 1) >= HOMERUN_REV_2 ? HOMERUN_SWING_START_PX_V2 : HOMERUN_SWING_START_PX;
}

/* ------------------------------------------------------------------ input */

export const HOMERUN_INPUT_SWING = 1;
/** a = contact height (world y), b = swing angle in tenths of a degree (0 = level, + = upward, the pull side). */
export const HOMERUN_INPUT_RANGES: readonly InputRange[] = [inputRange(HOMERUN_INPUT_SWING, [0, HOMERUN_WORLD_H], [-900, 900])];
/** homerunRev 3: the swing choice, a = HOMERUN_MODE_CONTACT (0) or HOMERUN_MODE_POWER (1). Rev 1 and 2 never declare it. */
export const HOMERUN_INPUT_MODE = 2;
export const HOMERUN_MODE_CONTACT = 0;
export const HOMERUN_MODE_POWER = 1;
export const HOMERUN_INPUT_RANGES_V3: readonly InputRange[] = [...HOMERUN_INPUT_RANGES, inputRange(HOMERUN_INPUT_MODE, [0, 1])];
/** Swing angles beyond this (tenths of a degree) go foul (rev 1). */
export const HOMERUN_FAIR_ANGLE = 600;
/** homerunRev 2: fair to ±80° of swipe. */
export const HOMERUN_FAIR_ANGLE_V2 = 800;
/** The fair swipe angle on a revision. */
export function homerunFairAngle(rev?: number | null): number {
  return (rev ?? 1) >= HOMERUN_REV_2 ? HOMERUN_FAIR_ANGLE_V2 : HOMERUN_FAIR_ANGLE;
}

/* ---------------------------------------------------------------- pitches */

export const PITCH_FASTBALL = 0;
export const PITCH_CURVE = 1;
export const PITCH_DROP = 2;
export const PITCH_CHANGEUP = 3;
export const HOMERUN_PITCH_NAMES = ["Fastball", "Curve", "Drop", "Changeup"] as const;

export interface HomerunPitch {
  kind: number;
  /** Release tick and the tick the ball reaches the plate. */
  release: number;
  arrive: number;
  /** Where it crosses the plate plane on screen (world px). */
  plateX: number;
  plateY: number;
  /** Signed break across and down at the plate (world px), drawn as the late movement. */
  breakX: number;
  breakY: number;
  /** Shown speed, mph (display). */
  mph: number;
}

export interface HomerunSign {
  /** Spray angle of its centre and its half-width, tenths of a degree (0 = straightaway centre, + = left field). */
  angle: number;
  half: number;
  /** Distance of its face from home plate, feet (always beyond the fence). */
  feet: number;
  /** Height of its middle above the field (display), feet. */
  lift: number;
}

export interface HomerunPlan {
  pitches: HomerunPitch[];
  signs: HomerunSign[];
}

const FLIGHT: Record<number, readonly [number, number]> = {
  [PITCH_FASTBALL]: [40, 47],
  [PITCH_CURVE]: [52, 59],
  [PITCH_DROP]: [50, 57],
  [PITCH_CHANGEUP]: [60, 67],
};
const LANES = [232, 258, 284] as const;
const SIGN_ANGLES = [-300, -150, 0, 150, 300] as const;
export const HOMERUN_SIGNS = 4;

/** The run's pitch sequence and signs, from the seed alone (cached per seed; never mutated). */
export function homerunPlan(seed: number): HomerunPlan {
  const hit = planCache.get(seed | 0);
  if (hit) return hit;
  let rng = (seed ^ 0x5ba1_1e7d) | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  // Three fastballs, two each of curve, drop and changeup, and one more of any kind, shuffled.
  const kinds = [0, 0, 0, 1, 1, 2, 2, 3, 3, draw(4)];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = draw(i + 1);
    [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
  }
  const pitches: HomerunPitch[] = kinds.map((kind, i) => {
    const [lo, hi] = FLIGHT[kind]!;
    const flight = lo + draw(hi - lo + 1);
    const release = HOMERUN_FIRST_RELEASE + i * HOMERUN_PITCH_GAP;
    const plateX = LANES[draw(3)]! + draw(9) - 4;
    const plateY = HOMERUN_ZONE_Y0 + 16 + draw(HOMERUN_ZONE_Y1 - HOMERUN_ZONE_Y0 - 31);
    const breakX = kind === PITCH_CURVE ? (draw(2) ? 1 : -1) * (14 + draw(10)) : kind === PITCH_CHANGEUP ? draw(7) - 3 : draw(5) - 2;
    const breakY = kind === PITCH_DROP ? 22 + draw(12) : kind === PITCH_CURVE ? 8 + draw(8) : kind === PITCH_CHANGEUP ? 6 + draw(6) : draw(4);
    const mph = kind === PITCH_FASTBALL ? 92 + draw(7) : kind === PITCH_CHANGEUP ? 79 + draw(5) : 81 + draw(6);
    return { kind, release, arrive: release + flight, plateX, plateY, breakX, breakY, mph };
  });
  const angles = [...SIGN_ANGLES];
  angles.splice(draw(angles.length), 1);
  const signs: HomerunSign[] = angles.map((angle) => ({ angle: angle + draw(41) - 20, half: 60, feet: 415 + draw(26), lift: 30 + draw(25) }));
  const plan = { pitches, signs };
  if (planCache.size > 32) planCache.clear();
  planCache.set(seed | 0, plan);
  return plan;
}
const planCache = new Map<number, HomerunPlan>();

/* ---------------------------------------------------------------- contact */

/** Timing quality (per mille) by how many ticks the bat is early or late at the plate. */
export const HOMERUN_TIMING_Q = [1000, 930, 820, 680, 520, 360, 200] as const;
/** Height: within this many px of the ball is a square hit; each px past it loses this much (per mille). */
export const HOMERUN_SWEET_PX = 4;
export const HOMERUN_HEIGHT_LOSS = 45;
/** Contact below this quality is a miss (a foul tip). */
export const HOMERUN_MIN_Q = 100;
/** Distance in feet: base + span × quality (a perfect swing carries 470 ft). */
export const HOMERUN_FEET_BASE = 120;
export const HOMERUN_FEET_SPAN = 350;
/** The fence: 330 ft down the lines, 400 ft to straightaway centre. */
export const HOMERUN_FENCE_LINE = 330;
export const HOMERUN_FENCE_CENTRE = 400;
/** The foul lines (spray angle, tenths of a degree). */
export const HOMERUN_FOUL_LINE = 450;

export const OUT_NONE = 0;
export const OUT_TAKEN = 1;
export const OUT_WHIFF = 2;
export const OUT_FOUL = 3;
export const OUT_FAIR = 4;
export const OUT_HOMER = 5;

/* ------------------------------------------------- homerunRev 3: the prepared swing */

/** The pitcher's tell: shown for this many ticks before the release (0.4 s), display only. */
export const HOMERUN_TELL_TICKS = 24;
/** The perfect contact tick against the ball's arrival at the plate, by pitch kind (fastball, curve, drop, changeup). */
export const HOMERUN_V3_PERFECT = [-1, 1, 1, 2] as const;
/**
 * Timing windows, tenths of a tick: quality falls on a straight line from 1000 at the perfect tick to 0 this far either
 * side, by swing (Contact, Power) and pitch kind (fastball tightest, changeup widest).
 */
export const HOMERUN_V3_WINDOW: readonly (readonly number[])[] = [
  [100, 125, 120, 135],
  [52, 64, 60, 68],
];
/** Height: the sweet band either side of the ball (px) and the quality lost a px past it, by swing. */
export const HOMERUN_V3_SWEET = [8, 4] as const;
export const HOMERUN_V3_HEIGHT_LOSS = [20, 35] as const;
/** Carry: base + span × quality, by swing (Contact at most 410 ft, never a sign; Power 480 ft). */
export const HOMERUN_V3_FEET_BASE = [124, 100] as const;
export const HOMERUN_V3_FEET_SPAN = [290, 380] as const;

/** homerunRev 3: the tick (relative to the ball's arrival) a perfectly timed bat meets this pitch. */
export function homerunPerfectOffset(kind: number, rev?: number | null): number {
  return (rev ?? 1) >= HOMERUN_REV_3 ? (HOMERUN_V3_PERFECT[kind] ?? 0) : 0;
}

/** One pitch's outcome, fixed at contact. */
export interface HomerunHit {
  out: number;
  /** Contact quality per mille, carry in feet, spray and launch angles (tenths of a degree). */
  q: number;
  feet: number;
  spray: number;
  launch: number;
  /** Sign struck (index into the plan's signs), else -1. */
  sign: number;
  /** The tick the pitch was decided (contact, or the take / whiff). */
  at: number;
  /** The swing that decided it: its start tick (-1 = taken), height and angle (display: the bat's follow-through). */
  st: number;
  a: number;
  b: number;
  /** homerunRev 3: the swing the pitch was played with (HOMERUN_MODE_*); absent on rev 1 and 2. */
  m?: number;
}

export function homerunFence(spray: number): number {
  const a = Math.min(Math.abs(spray), HOMERUN_FOUL_LINE);
  return HOMERUN_FENCE_LINE + Math.floor(((HOMERUN_FENCE_CENTRE - HOMERUN_FENCE_LINE) * (HOMERUN_FOUL_LINE - a)) / HOMERUN_FOUL_LINE);
}

/**
 * The swing's spray angle from the swipe angle: rev 1 three quarters of it (60° of swipe → 45°, the foul line); rev 2
 * nine sixteenths (80° of swipe → 45°), so the same aiming error moves the ball a quarter less.
 */
export function homerunSpray(angle: number, rev?: number | null): number {
  return (rev ?? 1) >= HOMERUN_REV_2 ? Math.trunc((angle * 9) / 16) : Math.trunc((angle * 3) / 4);
}

/** A swing starting on `swingTick` at height `a` with angle `b` against `pitch` on revision `rev`: the outcome. */
export function homerunContact(plan: HomerunPlan, pitch: HomerunPitch, swingTick: number, a: number, b: number, rev: number = HOMERUN_REV_STD, mode: number = HOMERUN_MODE_CONTACT): HomerunHit {
  if (rev >= HOMERUN_REV_3) return contactV3(plan, pitch, swingTick, a, b, mode === HOMERUN_MODE_POWER ? HOMERUN_MODE_POWER : HOMERUN_MODE_CONTACT);
  const contact = swingTick + HOMERUN_SWING_TICKS;
  const at = Math.max(contact, pitch.arrive);
  const dt = Math.abs(contact - pitch.arrive);
  const qt = dt < HOMERUN_TIMING_Q.length ? HOMERUN_TIMING_Q[dt]! : 0;
  const dh = Math.abs(a - pitch.plateY);
  const qh = dh <= HOMERUN_SWEET_PX ? 1000 : Math.max(0, 1000 - (dh - HOMERUN_SWEET_PX) * HOMERUN_HEIGHT_LOSS);
  const q = Math.floor((qt * qh) / 1000);
  const launch = clampInt(260 + (pitch.plateY - a) * 14, 40, 620);
  const swing = { st: swingTick, a, b };
  if (q < HOMERUN_MIN_Q) return { out: OUT_WHIFF, q, feet: 0, spray: 0, launch, sign: -1, at, ...swing };
  const spray = homerunSpray(b, rev);
  if (Math.abs(b) > homerunFairAngle(rev)) return { out: OUT_FOUL, q, feet: 0, spray, launch, sign: -1, at, ...swing };
  const feet = HOMERUN_FEET_BASE + Math.floor((HOMERUN_FEET_SPAN * q) / 1000);
  const homer = feet > homerunFence(spray);
  let sign = -1;
  let best = 1 << 30;
  plan.signs.forEach((s, i) => {
    const off = Math.abs(spray - s.angle);
    if (homer && feet >= s.feet && off <= s.half && off < best) {
      best = off;
      sign = i;
    }
  });
  return { out: homer ? OUT_HOMER : OUT_FAIR, q, feet, spray, launch, sign, at, ...swing };
}

/** homerunRev 3's contact: the pitch kind's perfect tick and window, the swing's sweet band and carry. */
function contactV3(plan: HomerunPlan, pitch: HomerunPitch, swingTick: number, a: number, b: number, m: number): HomerunHit {
  const rev = HOMERUN_REV_3;
  const contact = swingTick + HOMERUN_SWING_TICKS;
  const at = Math.max(contact, pitch.arrive);
  const dt = Math.abs(contact - (pitch.arrive + homerunPerfectOffset(pitch.kind, rev)));
  const win = HOMERUN_V3_WINDOW[m]![pitch.kind] ?? 60;
  const qt = Math.max(0, 1000 - Math.floor((dt * 10000) / win));
  const dh = Math.abs(a - pitch.plateY);
  const sweet = HOMERUN_V3_SWEET[m]!;
  const qh = dh <= sweet ? 1000 : Math.max(0, 1000 - (dh - sweet) * HOMERUN_V3_HEIGHT_LOSS[m]!);
  const q = Math.floor((qt * qh) / 1000);
  const launch = clampInt(260 + (pitch.plateY - a) * 14, 40, 620);
  const swing = { st: swingTick, a, b, m };
  if (q < HOMERUN_MIN_Q) return { out: OUT_WHIFF, q, feet: 0, spray: 0, launch, sign: -1, at, ...swing };
  const spray = homerunSpray(b, rev);
  if (Math.abs(b) > homerunFairAngle(rev)) return { out: OUT_FOUL, q, feet: 0, spray, launch, sign: -1, at, ...swing };
  const feet = HOMERUN_V3_FEET_BASE[m]! + Math.floor((HOMERUN_V3_FEET_SPAN[m]! * q) / 1000);
  const homer = feet > homerunFence(spray);
  let sign = -1;
  let best = 1 << 30;
  plan.signs.forEach((s, i) => {
    const off = Math.abs(spray - s.angle);
    if (homer && feet >= s.feet && off <= s.half && off < best) {
      best = off;
      sign = i;
    }
  });
  return { out: homer ? OUT_HOMER : OUT_FAIR, q, feet, spray, launch, sign, at, ...swing };
}

/* ------------------------------------------------------------------ state */

export interface HomerunState {
  tick: number;
  seed: number;
  rev: number;
  /** Inputs that reached the sim (any swipe counts: anyone who plays scores at least 1). */
  acted: number;
  /** Pitches decided so far (the current pitch's index). */
  pitch: number;
  /** The current pitch's swing, once started: its tick, height and angle (-1 tick = none). */
  swingTick: number;
  swingA: number;
  swingB: number;
  /** Every decided pitch's outcome, in order. */
  hits: HomerunHit[];
  /** Totals the parts read: carry (each pitch capped at 450 ft), home runs and the signs struck (a bit each). */
  feet: number;
  homers: number;
  signs: number;
  /** The tick the last pitch was decided (0 until then). */
  doneAt: number;
  /** homerunRev 3: the swing chosen now (carried from pitch to pitch, Contact at first) and the one locked for the current pitch at its release. */
  mode: number;
  pmode: number;
}

export function homerunInit(seed: number, rev: number = HOMERUN_REV_STD): HomerunState {
  homerunPlan(seed);
  return { tick: 0, seed: seed | 0, rev, acted: 0, pitch: 0, swingTick: -1, swingA: 0, swingB: 0, hits: [], feet: 0, homers: 0, signs: 0, doneAt: 0, mode: HOMERUN_MODE_CONTACT, pmode: HOMERUN_MODE_CONTACT };
}

/** The pitch the batter faces now (null after the tenth). */
export function homerunCurrent(state: HomerunState): HomerunPitch | null {
  return homerunPlan(state.seed).pitches[state.pitch] ?? null;
}

function decide(state: HomerunState, hit: HomerunHit): HomerunState {
  const capped = Math.min(hit.feet, homerunFullFeet(state.rev));
  const homer = hit.out === OUT_HOMER;
  const pitch = state.pitch + 1;
  return {
    ...state,
    pitch,
    swingTick: -1,
    hits: [...state.hits, hit],
    feet: state.feet + capped,
    homers: state.homers + (homer ? 1 : 0),
    signs: hit.sign >= 0 ? state.signs | (1 << hit.sign) : state.signs,
    doneAt: pitch >= HOMERUN_PITCHES ? hit.at : state.doneAt,
  };
}

export function homerunStep(prev: HomerunState, input: ArcadeInputEvent | null): HomerunState {
  let state: HomerunState = { ...prev, tick: prev.tick + 1 };
  const plan = homerunPlan(state.seed);
  const pitch = plan.pitches[state.pitch];
  if (state.rev >= HOMERUN_REV_3) {
    // The swing choice: any time; the pitch is played with the choice standing at its release.
    if (input && input.k === HOMERUN_INPUT_MODE) {
      state.acted += 1;
      state.mode = input.a === HOMERUN_MODE_POWER ? HOMERUN_MODE_POWER : HOMERUN_MODE_CONTACT;
    }
    if (pitch && state.tick === pitch.release) state.pmode = state.mode;
  }
  if (input && input.k === HOMERUN_INPUT_SWING) {
    state.acted += 1;
    if (pitch && state.swingTick < 0 && state.tick >= pitch.release - HOMERUN_WINDUP_TICKS) {
      state.swingTick = state.tick;
      state.swingA = clampInt(input.a, 0, HOMERUN_WORLD_H);
      state.swingB = clampInt(input.b, -900, 900);
    }
  }
  if (pitch) {
    if (state.swingTick >= 0) {
      // Rev 3: the pitch is played with the swing locked at its release (contact always comes after the release).
      const hit = homerunContact(plan, pitch, state.swingTick, state.swingA, state.swingB, state.rev, state.pmode);
      if (state.tick >= hit.at) state = decide(state, hit);
    } else if (state.tick >= pitch.arrive + HOMERUN_TAKE_TICKS) {
      const taken: HomerunHit = { out: OUT_TAKEN, q: 0, feet: 0, spray: 0, launch: 0, sign: -1, at: state.tick, st: -1, a: 0, b: 0 };
      state = decide(state, state.rev >= HOMERUN_REV_3 ? { ...taken, m: state.pmode } : taken);
    }
  }
  return state;
}

export function homerunIsOver(state: HomerunState): boolean {
  return state.tick >= HOMERUN_RUN_TICKS || (state.pitch >= HOMERUN_PITCHES && state.tick >= state.doneAt + HOMERUN_END_HOLD);
}

/* ---------------------------------------------------------------- scoring */

/** Distance: 130 on a straight line, 13 a pitch, full at 450 ft each (carry above it counts 450). */
export const HOMERUN_CORE_MAX = 130;
export const HOMERUN_FULL_FEET = 450;
export const HOMERUN_FULL_AT = HOMERUN_FULL_FEET * HOMERUN_PITCHES;
/** homerunRev 3: the core is full at 460 ft a pitch (a Power swing met within a tick and the sweet band). */
export const HOMERUN_FULL_FEET_V3 = 460;
export const HOMERUN_FULL_AT_V3 = HOMERUN_FULL_FEET_V3 * HOMERUN_PITCHES;
/** The carry a pitch counts up to on a revision. */
export function homerunFullFeet(rev?: number | null): number {
  return (rev ?? 1) >= HOMERUN_REV_3 ? HOMERUN_FULL_FEET_V3 : HOMERUN_FULL_FEET;
}
export const HOMERUN_HOMER_EACH = 5;
export const HOMERUN_HOMERS_MAX = 50;
export const HOMERUN_SIGNS_MAX = 20;

/** homerunRev 1's spec (born on the standard); rev 2 keeps every part (HOMERUN_STD_SPEC_V2). */
export const HOMERUN_STD_SPEC: StdSpec = {
  field: "homerunRev",
  rev: HOMERUN_REV_STD,
  parts: [
    { key: "core", label: "Distance", max: HOMERUN_CORE_MAX, of: HOMERUN_FULL_AT, how: `up to ${HOMERUN_CORE_MAX / HOMERUN_PITCHES} a pitch by distance, full at ${HOMERUN_FULL_FEET} ft` },
    { key: "homers", label: "Home runs", max: HOMERUN_HOMERS_MAX, of: HOMERUN_PITCHES, item: "home run", how: `${HOMERUN_HOMER_EACH} each, up to ${HOMERUN_PITCHES}` },
    { key: "signs", label: "Sign hits", max: HOMERUN_SIGNS_MAX, of: HOMERUN_SIGNS, item: "sign", how: `${HOMERUN_SIGNS_MAX / HOMERUN_SIGNS} for each of the ${HOMERUN_SIGNS} signs beyond the fence` },
  ],
};

/** homerunRev 2: the same three parts and maximums. */
export const HOMERUN_STD_SPEC_V2: StdSpec = { ...HOMERUN_STD_SPEC, rev: HOMERUN_REV_2 };
/** homerunRev 3: the same three parts and maximums; the core full at 460 ft a pitch. */
export const HOMERUN_STD_SPEC_V3: StdSpec = {
  field: "homerunRev",
  rev: HOMERUN_REV_3,
  parts: [
    { key: "core", label: "Distance", max: HOMERUN_CORE_MAX, of: HOMERUN_FULL_AT_V3, how: `up to ${HOMERUN_CORE_MAX / HOMERUN_PITCHES} a pitch by distance, full at ${HOMERUN_FULL_FEET_V3} ft` },
    HOMERUN_STD_SPEC.parts[1]!,
    HOMERUN_STD_SPEC.parts[2]!,
  ],
};
export const HOMERUN_STD_SPEC_DEALT = HOMERUN_STD_SPEC_V3;

/** The spec a revision scores on. */
export function homerunStdSpecFor(rev?: number | null): StdSpec {
  return (rev ?? 1) >= HOMERUN_REV_3 ? HOMERUN_STD_SPEC_V3 : (rev ?? 1) === HOMERUN_REV_2 ? HOMERUN_STD_SPEC_V2 : HOMERUN_STD_SPEC;
}

export const HOMERUN_V1_BAND_CURVE = bandCurve([0, HOMERUN_FULL_AT], [0, HOMERUN_CORE_MAX]);
/** homerunRev 2's core: rev 1's straight line. */
export const HOMERUN_V2_BAND_CURVE = HOMERUN_V1_BAND_CURVE;
/** homerunRev 3's core: a straight line to 130 at 4,600 ft. */
export const HOMERUN_V3_BAND_CURVE = bandCurve([0, HOMERUN_FULL_AT_V3], [0, HOMERUN_CORE_MAX]);

export function homerunSignCount(state: Pick<HomerunState, "signs">): number {
  let n = 0;
  for (let i = 0; i < HOMERUN_SIGNS; i++) if (state.signs & (1 << i)) n++;
  return n;
}

/** homerunRev 1's, 2's and 3's scored parts (null on any other revision). */
export function homerunStdParts(state: HomerunState): StdPart[] | null {
  if (state.rev !== HOMERUN_REV_STD && state.rev !== HOMERUN_REV_2 && state.rev !== HOMERUN_REV_3) return null;
  const spec = homerunStdSpecFor(state.rev);
  const fullAt = state.rev === HOMERUN_REV_3 ? HOMERUN_FULL_AT_V3 : HOMERUN_FULL_AT;
  const signs = homerunSignCount(state);
  const avg = state.pitch > 0 ? Math.round(state.feet / Math.max(1, state.hits.length)) : 0;
  return [
    stdPart(spec, "core", stdLine(HOMERUN_CORE_MAX, state.feet, fullAt), `${state.feet} ft over ${state.hits.length} pitch${state.hits.length === 1 ? "" : "es"} (avg ${avg})`),
    stdPart(spec, "homers", stdEach(state.homers, HOMERUN_HOMER_EACH, HOMERUN_HOMERS_MAX), `${state.homers} home run${state.homers === 1 ? "" : "s"}`),
    stdPart(spec, "signs", stdLine(HOMERUN_SIGNS_MAX, signs, HOMERUN_SIGNS), `${signs} of ${HOMERUN_SIGNS} signs`),
  ];
}

export function homerunScore(state: HomerunState): number {
  const parts = homerunStdParts(state);
  return parts ? stdScore(parts, state.acted > 0) : 0;
}

/** For the skill-band tool and the reveal: units = capped feet, points = the core, bonus = the features. */
export function homerunBandParts(state: HomerunState): BandParts {
  const parts = homerunStdParts(state) ?? [];
  const get = (k: string) => parts.find((p) => p.key === k)?.points ?? 0;
  return stdBandParts(
    homerunStdSpecFor(state.rev),
    { core: get("core"), features: { homers: get("homers"), signs: get("signs") }, penalty: 0 },
    state.feet,
    `${state.homers} HR · ${state.feet} ft`,
    state.pitch >= HOMERUN_PITCHES,
  );
}

/* ------------------------------------------------------------- checkpoint */

export const HOMERUN_CHECKPOINT_INTERVAL = 60;
export const HOMERUN_CHECKPOINT_KEYS = ["tick", "pitch", "swingTick", "feet", "homers", "signs", "acted", "checksum"] as const;
export interface HomerunCheckpoint {
  tick: number;
  pitch: number;
  swingTick: number;
  feet: number;
  homers: number;
  signs: number;
  acted: number;
  checksum: number;
}

export function homerunCheckpoint(state: HomerunState): HomerunCheckpoint {
  const snap = { tick: state.tick, pitch: state.pitch, swingTick: state.swingTick, feet: state.feet, homers: state.homers, signs: state.signs, acted: state.acted };
  let checksum = 0x811c9dc5;
  const extra = state.hits.flatMap((h) => [h.out, h.q, h.feet, h.spray, h.sign, h.at]);
  // homerunRev 3 adds the swing choices (rev 1 and 2 checksums are unchanged).
  const v3 = state.rev >= HOMERUN_REV_3 ? [state.mode, state.pmode, ...state.hits.map((h) => h.m ?? 0)] : [];
  for (const value of [...Object.values(snap), state.swingA, state.swingB, ...extra, ...v3]) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* -------------------------------------------------------------- the game */

/** A plain fallback picture (the play screen draws homerun.renderer.ts). */
function drawPlain(ctx: CanvasRenderingContext2D, state: HomerunState, size: CanvasSize): void {
  ctx.fillStyle = HOMERUN_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  const p = homerunCurrent(state);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.strokeRect(HOMERUN_ZONE_X0, HOMERUN_ZONE_Y0, HOMERUN_ZONE_X1 - HOMERUN_ZONE_X0, HOMERUN_ZONE_Y1 - HOMERUN_ZONE_Y0);
  if (p && state.tick >= p.release && state.tick <= p.arrive) {
    const u = (state.tick - p.release) / (p.arrive - p.release);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(HOMERUN_RELEASE_X + (p.plateX - HOMERUN_RELEASE_X) * u, HOMERUN_RELEASE_Y + (p.plateY - HOMERUN_RELEASE_Y) * u, 2 + 8 * u, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const homerunGame: ArcadeGame<HomerunState, ArcadeInputEvent | null> = {
  key: "homerun",
  runTicks: HOMERUN_RUN_TICKS,
  init: (seed: number) => homerunInit(seed),
  step: homerunStep,
  isOver: homerunIsOver,
  score: homerunScore,
  draw: drawPlain,
  inputRanges: HOMERUN_INPUT_RANGES,
};

/** homerunRev 2's game: rev 1's with the finer aim (the state carries rev 2). */
export const homerunGameV2: ArcadeGame<HomerunState, ArcadeInputEvent | null> = { ...homerunGame, init: (seed: number) => homerunInit(seed, HOMERUN_REV_2) };

/** homerunRev 3's game: the swing choice (its own input kind) and the pitch's own timing. */
export const homerunGameV3: ArcadeGame<HomerunState, ArcadeInputEvent | null> = {
  ...homerunGame,
  init: (seed: number) => homerunInit(seed, HOMERUN_REV_3),
  inputRanges: HOMERUN_INPUT_RANGES_V3,
};

export function homerunGameFor(rev?: number | null): ArcadeGame<HomerunState, ArcadeInputEvent | null> {
  const r = rev ?? 1;
  return r >= HOMERUN_REV_3 ? homerunGameV3 : r >= HOMERUN_REV_2 ? homerunGameV2 : homerunGame;
}

/** Display: where pitch `p` is on screen at sim time `t` (fractional ticks allowed), with its size; null off-flight. */
export function homerunBallAt(p: HomerunPitch, t: number): { x: number; y: number; u: number } | null {
  if (t < p.release || t > p.arrive + HOMERUN_TAKE_TICKS) return null;
  const u = (t - p.release) / (p.arrive - p.release);
  // Perspective: the ball covers little screen distance early and most of it late (1 / depth).
  const depth = 1 / (1 + 9 * Math.max(0, 1 - u));
  const k = (depth - 0.1) / 0.9;
  const late = Math.max(0, (u - 0.55) / 0.45);
  const brk = late * late;
  return {
    x: HOMERUN_RELEASE_X + (p.plateX - p.breakX - HOMERUN_RELEASE_X) * k + p.breakX * brk,
    y: HOMERUN_RELEASE_Y + (p.plateY - p.breakY - HOMERUN_RELEASE_Y) * k + p.breakY * brk,
    u,
  };
}
