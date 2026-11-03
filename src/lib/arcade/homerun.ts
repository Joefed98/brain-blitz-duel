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
/**
 * homerunRev 4 (3 Nov 2026, "pick your spot"; docs/arcade-standard/homerun.md "homerunRev 4"): a new way to bat. Before
 * each pitch the batter taps a spot on the field (HOMERUN_INPUT_SPOT, locked at the release); then one tap swings
 * (HOMERUN_INPUT_TAP) as a faint ring closes on the ball. Perfect timing sends the ball to the spot, early pulls it left,
 * late pushes it right, and the timing also sets the carry. Its own plan (homerunPlanV4: fastballs, curveballs and
 * changeups with no tell, six fielders a pitch, a lit bonus sign a pitch) and its own parts (HOMERUN_STD_SPEC_V4). No
 * Contact / Power choice, no swipe. Rooms deal rev 4; rev 1, 2 and 3 play, score and replay exactly as before.
 */
export const HOMERUN_REV_4 = 4;
export const HOMERUN_REV_DEALT = HOMERUN_REV_4;
export const HOMERUN_WORLD_W = 390;
export const HOMERUN_WORLD_H = 720;
/**
 * homerunRev 3's play-screen frame (display only, 2 Nov 2026): the stage's view runs HOMERUN_V3_VIEW_ROWS field rows
 * below the 720-row world, so the batter and the plate sit clear above the Contact / Power row laid over the field's
 * bottom. The sim's world, the plan, the timing windows, the scoring and every input are unchanged: the view's top
 * 720 rows are the world's own (the same world px under the same finger), and a touch that starts in the rows below
 * starts no swing.
 */
export const HOMERUN_V3_VIEW_ROWS = 60;
/** The stage's view height (world px) for a revision: the world, plus homerunRev 3's rows below it. */
export function homerunViewHFor(rev?: number | null): number {
  // homerunRev 4 has no buttons over the field: the view is the world again.
  return (rev ?? 1) === HOMERUN_REV_3 ? HOMERUN_WORLD_H + HOMERUN_V3_VIEW_ROWS : HOMERUN_WORLD_H;
}
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
  /** homerunRev 4 only: each pitch's six fielders and its lit bonus sign (an index into HOMERUN_V4_SIGNS). */
  fielders?: HomerunFielder[][];
  lit?: number[];
}

/** homerunRev 4: a fielder for one pitch: where he stands (spray tenths of a degree, feet) and his catch area. */
export interface HomerunFielder {
  spray: number;
  feet: number;
  /** A ball landing within `half` tenths of a degree and `depth` ft of him (short of a home run) is caught. */
  half: number;
  depth: number;
  /** 1 for the three outfielders. */
  out: number;
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

/**
 * The run's pitch sequence and signs, from the seed alone (cached per seed; never mutated). Rev 1–3 share one plan;
 * homerunRev 4 (`rev` 4 or more) has its own (homerunPlanV4).
 */
export function homerunPlan(seed: number, rev?: number | null): HomerunPlan {
  if ((rev ?? 1) >= HOMERUN_REV_4) return homerunPlanV4(seed);
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
  // homerunRev 4 meets every pitch on its arrival (the ring shows the moment).
  return (rev ?? 1) === HOMERUN_REV_3 ? (HOMERUN_V3_PERFECT[kind] ?? 0) : 0;
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
  /** homerunRev 4: ticks the bat met the plate after the ball (early < 0), and the fielder who caught it. `a`, `b` are the spot (world px). */
  dt?: number;
  c?: number;
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
  /** homerunRev 4 only: the spot chosen now (world px, carried from pitch to pitch) and the one locked at the release. */
  spotX?: number;
  spotY?: number;
  pspotX?: number;
  pspotY?: number;
  /** homerunRev 4 only: perfect swings in a row now, the best run, perfect swings in all and lit signs struck. */
  streak?: number;
  best?: number;
  perfects?: number;
  bonus?: number;
}

export function homerunInit(seed: number, rev: number = HOMERUN_REV_STD): HomerunState {
  homerunPlan(seed, rev);
  if (rev >= HOMERUN_REV_4) {
    const sx = HOMERUN_V4_SPOT_START.x;
    const sy = HOMERUN_V4_SPOT_START.y;
    return {
      tick: 0, seed: seed | 0, rev, acted: 0, pitch: 0, swingTick: -1, swingA: 0, swingB: 0, hits: [], feet: 0, homers: 0, signs: 0, doneAt: 0,
      mode: HOMERUN_MODE_CONTACT, pmode: HOMERUN_MODE_CONTACT, spotX: sx, spotY: sy, pspotX: sx, pspotY: sy, streak: 0, best: 0, perfects: 0, bonus: 0,
    };
  }
  return { tick: 0, seed: seed | 0, rev, acted: 0, pitch: 0, swingTick: -1, swingA: 0, swingB: 0, hits: [], feet: 0, homers: 0, signs: 0, doneAt: 0, mode: HOMERUN_MODE_CONTACT, pmode: HOMERUN_MODE_CONTACT };
}

/** The pitch the batter faces now (null after the tenth). */
export function homerunCurrent(state: HomerunState): HomerunPitch | null {
  return homerunPlan(state.seed, state.rev).pitches[state.pitch] ?? null;
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
  if (prev.rev >= HOMERUN_REV_4) return stepV4(prev, input);
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

/** The spec a revision scores on. */
export function homerunStdSpecFor(rev?: number | null): StdSpec {
  if ((rev ?? 1) >= HOMERUN_REV_4) return HOMERUN_STD_SPEC_V4;
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
  if (state.rev === HOMERUN_REV_4) return homerunStdPartsV4(state);
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
    { core: get("core"), features: state.rev >= HOMERUN_REV_4 ? { homers: get("homers"), signs: get("signs"), streak: get("streak") } : { homers: get("homers"), signs: get("signs") }, penalty: 0 },
    state.feet,
    `${state.homers} HR · ${state.feet} ft`,
    state.pitch >= HOMERUN_PITCHES,
  );
}

/* ---------------------------------------------------- homerunRev 4: pick your spot */

/** homerunRev 4's input kinds: a spot (a = x, b = y, world px) and the tap that swings (no payload). */
export const HOMERUN_INPUT_SPOT = 3;
export const HOMERUN_INPUT_TAP = 4;
export const HOMERUN_INPUT_RANGES_V4: readonly InputRange[] = [inputRange(HOMERUN_INPUT_SPOT, [0, HOMERUN_WORLD_W], [0, HOMERUN_WORLD_H]), inputRange(HOMERUN_INPUT_TAP)];
/** The tap is taken as a swing from this many ticks before the release (a tap earlier than that is a spot or nothing). */
export const HOMERUN_V4_TAP_EARLY = 12;
/** Where a spot can be tapped (world px): the fair field and stands between the foul poles, from the upper deck to the infield grass. */
export const HOMERUN_V4_SPOT_X0 = 16;
export const HOMERUN_V4_SPOT_X1 = HOMERUN_WORLD_W - 16;
export const HOMERUN_V4_SPOT_Y0 = 34;
export const HOMERUN_V4_SPOT_Y1 = 268;
/** The spot before the batter taps one: straightaway centre, 230 ft out (short of the centre fielder). */
export const HOMERUN_V4_SPOT_START = { x: 195, y: 193 } as const;
/** The deepest a spot (and so a perfect hit) can be, feet. */
export const HOMERUN_V4_MAX_FEET = 520;
/** The shallowest a spot can be, feet. */
export const HOMERUN_V4_MIN_FEET = 45;

/** The stylised field's mapping (shared with the art): spray in tenths of a degree ↔ world x, 4 px a degree. */
const V4_CX = 195;
/** The ground plane: a field row y is `GROUND_K / (feet + 16) + 163` (the camera's horizon and focal length × height). */
const V4_YH = 163;
const V4_GROUND_K = 7488;
const V4_BACK = 16;

/** The spray (tenths of a degree, + = left field) a world x stands for, held fair. */
export function homerunV4SprayAt(x: number): number {
  return clampInt(Math.trunc(((V4_CX - Math.trunc(x)) * 5) / 2), -HOMERUN_FOUL_LINE + 10, HOMERUN_FOUL_LINE - 10);
}
/** The world x of a spray. */
export function homerunV4XOf(spray: number): number {
  return V4_CX - (spray * 2) / 5;
}
/** The top of the outfield wall (world y) at a spray: deepest (400 ft) in centre, so highest on screen. */
export function homerunWallTopY(spray: number): number {
  return 168 + Math.floor(((400 - homerunFence(spray)) * 8) / 100);
}
/** A field row (world y) for a carry in feet (short of the wall). */
export function homerunGroundY(feet: number): number {
  return V4_YH + V4_GROUND_K / (Math.max(1, feet) + V4_BACK);
}
/** The stands' row (world y) a home run of `feet` lands on at `spray`: 1.1 px of height a foot past the fence. */
export function homerunStandY(spray: number, feet: number): number {
  return homerunWallTopY(spray) - 10 - (feet - homerunFence(spray)) * 1.1;
}

/** homerunRev 4's signs: fixed boxes (world px) at three heights, each with its timing tolerance (ticks either side of perfect). */
export interface HomerunV4Sign {
  x: number;
  y: number;
  w: number;
  h: number;
  /** The timing tolerance: the swing must meet the ball within this many ticks of perfect to strike it. */
  tol: number;
  /** Where it stands: on the fence, the scoreboard, the upper deck. */
  tier: "fence" | "board" | "upper";
  text: string;
}
export const HOMERUN_V4_SIGNS: readonly HomerunV4Sign[] = [
  { x: 70, y: 141, w: 48, h: 14, tol: 2, tier: "fence", text: "450 CLUB" },
  { x: 268, y: 143, w: 48, h: 14, tol: 2, tier: "fence", text: "JOULZ" },
  { x: 128, y: 106, w: 44, h: 20, tol: 1, tier: "board", text: "DEEP" },
  { x: 40, y: 44, w: 30, h: 13, tol: 0, tier: "upper", text: "MOON" },
  { x: 220, y: 40, w: 30, h: 13, tol: 0, tier: "upper", text: "LIGHTS" },
];

/** The sign box (index) a spot sits in, else -1. */
export function homerunV4SignAt(x: number, y: number): number {
  return HOMERUN_V4_SIGNS.findIndex((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
}

/** What a spot (world px) asks for: its spray and carry, and the sign it sits in (-1 none). */
export function homerunV4Target(x: number, y: number): { spray: number; feet: number; sign: number } {
  const spray = homerunV4SprayAt(x);
  const fence = homerunFence(spray);
  const wall = homerunWallTopY(spray);
  let feet: number;
  if (y < wall) {
    // The stands: beyond the fence, deeper the higher the spot (the inverse of homerunStandY).
    feet = clampInt(fence + Math.floor(((wall - 10 - Math.trunc(y)) * 10) / 11), fence + 5, HOMERUN_V4_MAX_FEET);
  } else {
    const dy = Math.max(1, Math.trunc(y) - V4_YH);
    feet = clampInt(Math.floor(V4_GROUND_K / dy) - V4_BACK, HOMERUN_V4_MIN_FEET, fence - 5);
  }
  return { spray, feet, sign: homerunV4SignAt(x, y) };
}

/** A spot's legal place: inside the spot area (x held between the poles, y between the upper deck and the infield). */
export function homerunV4SpotOk(x: number, y: number): boolean {
  return x >= HOMERUN_V4_SPOT_X0 && x <= HOMERUN_V4_SPOT_X1 && y >= HOMERUN_V4_SPOT_Y0 && y <= HOMERUN_V4_SPOT_Y1;
}

/** Flight times by kind (ticks from release to the plate): fastballs quick, curveballs in between, changeups slow. */
const FLIGHT_V4: Record<number, readonly [number, number]> = {
  [PITCH_FASTBALL]: [36, 41],
  [PITCH_CURVE]: [48, 54],
  [PITCH_CHANGEUP]: [62, 70],
};
/** Base fielders: three outfielders, then third base, short stop and second base (spray, feet; the seed moves them). */
const FIELDERS_V4: readonly { spray: number; feet: number; ds: number; df: number; out: number }[] = [
  { spray: 260, feet: 285, ds: 50, df: 20, out: 1 },
  { spray: 0, feet: 310, ds: 50, df: 20, out: 1 },
  { spray: -260, feet: 285, ds: 50, df: 20, out: 1 },
  { spray: 330, feet: 100, ds: 30, df: 10, out: 0 },
  { spray: 140, feet: 140, ds: 40, df: 12, out: 0 },
  { spray: -140, feet: 140, ds: 40, df: 12, out: 0 },
];
/** Catch areas: outfielders ±4.5° and ±35 ft, infielders ±4.5° and ±22 ft. */
export const HOMERUN_V4_CATCH = { outHalf: 45, outDepth: 35, inHalf: 45, inDepth: 22 } as const;
/** How far fielders move between pitches (either way): spray tenths and feet. */
export const HOMERUN_V4_SHIFT = { spray: 20, feet: 10 } as const;

const planV4Cache = new Map<number, HomerunPlan>();
/** homerunRev 4's plan from the seed: the pitches (4 fastballs, 3 curveballs, 3 changeups), six fielders and a lit sign a pitch. */
export function homerunPlanV4(seed: number): HomerunPlan {
  const hit = planV4Cache.get(seed | 0);
  if (hit) return hit;
  let rng = (seed ^ 0x4b17_5907) | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const kinds = [0, 0, 0, 0, PITCH_CURVE, PITCH_CURVE, PITCH_CURVE, PITCH_CHANGEUP, PITCH_CHANGEUP, PITCH_CHANGEUP];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = draw(i + 1);
    [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
  }
  const pitches: HomerunPitch[] = kinds.map((kind, i) => {
    const [lo, hi] = FLIGHT_V4[kind]!;
    const flight = lo + draw(hi - lo + 1);
    const release = HOMERUN_FIRST_RELEASE + i * HOMERUN_PITCH_GAP;
    const plateX = LANES[draw(3)]! + draw(9) - 4;
    const plateY = HOMERUN_ZONE_Y0 + 20 + draw(HOMERUN_ZONE_Y1 - HOMERUN_ZONE_Y0 - 39);
    // A curveball bends the whole way (it starts wide of where it crosses); a changeup floats in and sinks a little.
    const breakX = kind === PITCH_CURVE ? (draw(2) ? 1 : -1) * (30 + draw(15)) : 0;
    const breakY = kind === PITCH_CURVE ? 10 + draw(7) : kind === PITCH_CHANGEUP ? 8 + draw(7) : 0;
    const mph = kind === PITCH_FASTBALL ? 92 + draw(7) : kind === PITCH_CHANGEUP ? 76 + draw(5) : 79 + draw(6);
    return { kind, release, arrive: release + flight, plateX, plateY, breakX, breakY, mph };
  });
  const base = FIELDERS_V4.map((f) => ({ ...f, spray: f.spray + draw(2 * f.ds + 1) - f.ds, feet: f.feet + draw(2 * f.df + 1) - f.df }));
  const fielders: HomerunFielder[][] = pitches.map(() =>
    base.map((f) => ({
      spray: clampInt(f.spray + draw(2 * HOMERUN_V4_SHIFT.spray + 1) - HOMERUN_V4_SHIFT.spray, -430, 430),
      feet: f.feet + draw(2 * HOMERUN_V4_SHIFT.feet + 1) - HOMERUN_V4_SHIFT.feet,
      half: f.out ? HOMERUN_V4_CATCH.outHalf : HOMERUN_V4_CATCH.inHalf,
      depth: f.out ? HOMERUN_V4_CATCH.outDepth : HOMERUN_V4_CATCH.inDepth,
      out: f.out,
    })),
  );
  // One lit sign a pitch, never the same one twice running.
  const lit: number[] = [];
  for (let i = 0; i < HOMERUN_PITCHES; i++) {
    let k = draw(HOMERUN_V4_SIGNS.length - (i > 0 ? 1 : 0));
    if (i > 0 && k >= lit[i - 1]!) k += 1;
    lit.push(k);
  }
  const plan: HomerunPlan = { pitches, signs: [], fielders, lit };
  if (planV4Cache.size > 32) planV4Cache.clear();
  planV4Cache.set(seed | 0, plan);
  return plan;
}

/** homerunRev 4's timing: a swing meeting the ball within this many ticks of its arrival lands on the spot (a sign has its own tolerance). */
export const HOMERUN_V4_ON_SPOT = 1;
/** A PERFECT swing (the streak) meets the ball on its arrival tick exactly (within this many ticks). */
export const HOMERUN_V4_PERFECT = 0;
/** Further off than this many ticks is a miss. */
export const HOMERUN_V4_MISS = 7;
/** Each tick off (past the tolerance) moves the ball this many tenths of a degree (early pulls left, late pushes right) and takes this much of its carry (per mille). */
export const HOMERUN_V4_DRIFT = 25;
export const HOMERUN_V4_FALL = 45;
export const OUT_CAUGHT = 6;

/**
 * homerunRev 4's contact. `dt` is the bat's tick at the plate less the ball's arrival (early < 0). Within the target's
 * tolerance (a sign's own, else HOMERUN_V4_PERFECT) the ball lands on the spot; past it, it drifts by the ticks off
 * and falls short in proportion. A sign is struck only when it is the pitch's lit sign and the swing is within its
 * tolerance; a fielder catches a fair ball short of a home run landing in his area.
 */
export function homerunContactV4(plan: HomerunPlan, index: number, swingTick: number, spotX: number, spotY: number): HomerunHit {
  const pitch = plan.pitches[index]!;
  const contact = swingTick + HOMERUN_SWING_TICKS;
  const at = Math.max(contact, pitch.arrive);
  const dt = contact - pitch.arrive;
  const off = Math.abs(dt);
  const target = homerunV4Target(spotX, spotY);
  const swing = { st: swingTick, a: spotX, b: spotY, dt };
  if (off > HOMERUN_V4_MISS) return { out: OUT_WHIFF, q: 0, feet: 0, spray: 0, launch: 0, sign: -1, at, ...swing };
  const tol = target.sign >= 0 ? HOMERUN_V4_SIGNS[target.sign]!.tol : HOMERUN_V4_ON_SPOT;
  const q = off <= tol ? 1000 : 1000 - off * HOMERUN_V4_FALL;
  const spray = off <= tol ? target.spray : target.spray - Math.sign(dt) * off * HOMERUN_V4_DRIFT;
  const feet = Math.floor((target.feet * q) / 1000);
  const launch = clampInt(feet, 120, 520);
  if (Math.abs(spray) > HOMERUN_FOUL_LINE) return { out: OUT_FOUL, q, feet: 0, spray, launch, sign: -1, at, ...swing };
  if (feet > homerunFence(spray)) {
    const sign = target.sign >= 0 && target.sign === plan.lit![index] && off <= tol ? target.sign : -1;
    return { out: OUT_HOMER, q, feet, spray, launch, sign, at, ...swing };
  }
  const caught = plan.fielders![index]!.findIndex((f) => Math.abs(spray - f.spray) <= f.half && Math.abs(feet - f.feet) <= f.depth);
  if (caught >= 0) return { out: OUT_CAUGHT, q, feet, spray, launch, sign: -1, at, ...swing, c: caught };
  return { out: OUT_FAIR, q, feet, spray, launch, sign: -1, at, ...swing };
}

/** Whether a decided rev-4 pitch was swung on perfectly (the bat on the ball's arrival tick). */
export function homerunV4Perfect(hit: HomerunHit): boolean {
  return hit.st >= 0 && hit.out !== OUT_WHIFF && Math.abs(hit.dt ?? 99) <= HOMERUN_V4_PERFECT;
}

/** The distance the core counts for a rev-4 pitch: a fair ball not caught (home runs included), up to HOMERUN_V4_FULL_FEET. */
export function homerunV4Counted(hit: HomerunHit): number {
  return hit.out === OUT_FAIR || hit.out === OUT_HOMER ? Math.min(hit.feet, HOMERUN_V4_FULL_FEET) : 0;
}

function decideV4(state: HomerunState, hit: HomerunHit): HomerunState {
  const pitch = state.pitch + 1;
  const perfect = homerunV4Perfect(hit);
  const streak = perfect ? (state.streak ?? 0) + 1 : 0;
  return {
    ...state,
    pitch,
    swingTick: -1,
    hits: [...state.hits, hit],
    feet: state.feet + homerunV4Counted(hit),
    homers: state.homers + (hit.out === OUT_HOMER ? 1 : 0),
    signs: hit.sign >= 0 ? state.signs | (1 << hit.sign) : state.signs,
    bonus: (state.bonus ?? 0) + (hit.sign >= 0 ? 1 : 0),
    perfects: (state.perfects ?? 0) + (perfect ? 1 : 0),
    streak,
    best: Math.max(state.best ?? 0, streak),
    doneAt: pitch >= HOMERUN_PITCHES ? hit.at : state.doneAt,
  };
}

function stepV4(prev: HomerunState, input: ArcadeInputEvent | null): HomerunState {
  let state: HomerunState = { ...prev, tick: prev.tick + 1 };
  const plan = homerunPlanV4(state.seed);
  const pitch = plan.pitches[state.pitch];
  if (input && input.k === HOMERUN_INPUT_SPOT) {
    state.acted += 1;
    if (homerunV4SpotOk(input.a, input.b)) {
      state.spotX = input.a;
      state.spotY = input.b;
    }
  }
  // The pitch is played to the spot standing at its release (a spot tapped after it waits for the next pitch).
  if (pitch && state.tick === pitch.release) {
    state.pspotX = state.spotX ?? HOMERUN_V4_SPOT_START.x;
    state.pspotY = state.spotY ?? HOMERUN_V4_SPOT_START.y;
  }
  if (input && input.k === HOMERUN_INPUT_TAP) {
    state.acted += 1;
    if (pitch && state.swingTick < 0 && state.tick >= pitch.release - HOMERUN_V4_TAP_EARLY) state.swingTick = state.tick;
  }
  if (pitch) {
    if (state.swingTick >= 0) {
      const hit = homerunContactV4(plan, state.pitch, state.swingTick, state.pspotX ?? 0, state.pspotY ?? 0);
      if (state.tick >= hit.at) state = decideV4(state, hit);
    } else if (state.tick >= pitch.arrive + HOMERUN_TAKE_TICKS) {
      state = decideV4(state, { out: OUT_TAKEN, q: 0, feet: 0, spray: 0, launch: 0, sign: -1, at: state.tick, st: -1, a: state.pspotX ?? 0, b: state.pspotY ?? 0 });
    }
  }
  return state;
}

/** homerunRev 4's parts: distance 120 (full at 330 ft a pitch), home runs 40, bonus signs 20, perfect streak 20. */
export const HOMERUN_V4_CORE_MAX = 120;
export const HOMERUN_V4_FULL_FEET = 300;
export const HOMERUN_V4_FULL_AT = HOMERUN_V4_FULL_FEET * HOMERUN_PITCHES;
export const HOMERUN_V4_HOMER_EACH = 4;
export const HOMERUN_V4_HOMERS_MAX = 40;
export const HOMERUN_V4_BONUS_EACH = 2;
export const HOMERUN_V4_BONUS_MAX = 20;
export const HOMERUN_V4_STREAK_EACH = 2;
export const HOMERUN_V4_STREAK_MAX = 20;
export const HOMERUN_STD_SPEC_V4: StdSpec = {
  field: "homerunRev",
  rev: HOMERUN_REV_4,
  parts: [
    { key: "core", label: "Distance", max: HOMERUN_V4_CORE_MAX, of: HOMERUN_V4_FULL_AT, how: `up to ${HOMERUN_V4_CORE_MAX / HOMERUN_PITCHES} a pitch by distance, full at ${HOMERUN_V4_FULL_FEET} ft; a caught ball counts nothing` },
    { key: "homers", label: "Home runs", max: HOMERUN_V4_HOMERS_MAX, of: HOMERUN_PITCHES, item: "home run", how: `${HOMERUN_V4_HOMER_EACH} each, up to ${HOMERUN_PITCHES}` },
    { key: "signs", label: "Bonus signs", max: HOMERUN_V4_BONUS_MAX, of: HOMERUN_PITCHES, item: "bonus sign", how: `${HOMERUN_V4_BONUS_EACH} for each pitch's lit sign struck` },
    { key: "streak", label: "Perfect streak", max: HOMERUN_V4_STREAK_MAX, of: HOMERUN_PITCHES, item: "perfect swing", how: `${HOMERUN_V4_STREAK_EACH} for each swing in your longest run of perfect swings` },
  ],
};
/** The dealt revision's spec. */
export const HOMERUN_STD_SPEC_DEALT = HOMERUN_STD_SPEC_V4;
/** homerunRev 4's core: a straight line to 120 at 3,300 ft. */
export const HOMERUN_V4_BAND_CURVE = bandCurve([0, HOMERUN_V4_FULL_AT], [0, HOMERUN_V4_CORE_MAX]);

function homerunStdPartsV4(state: HomerunState): StdPart[] {
  const spec = HOMERUN_STD_SPEC_V4;
  const caught = state.hits.filter((h) => h.out === OUT_CAUGHT).length;
  const best = state.best ?? 0;
  const bonus = state.bonus ?? 0;
  return [
    stdPart(spec, "core", stdLine(HOMERUN_V4_CORE_MAX, state.feet, HOMERUN_V4_FULL_AT), `${state.feet} ft over ${state.hits.length} pitch${state.hits.length === 1 ? "" : "es"}${caught ? `, ${caught} caught` : ""}`),
    stdPart(spec, "homers", stdEach(state.homers, HOMERUN_V4_HOMER_EACH, HOMERUN_V4_HOMERS_MAX), `${state.homers} home run${state.homers === 1 ? "" : "s"}`),
    stdPart(spec, "signs", stdEach(bonus, HOMERUN_V4_BONUS_EACH, HOMERUN_V4_BONUS_MAX), `${bonus} of ${HOMERUN_PITCHES} lit signs`),
    stdPart(spec, "streak", stdEach(best, HOMERUN_V4_STREAK_EACH, HOMERUN_V4_STREAK_MAX), `best run ${best} perfect (${state.perfects ?? 0} in all)`),
  ];
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
  const v3 = state.rev === HOMERUN_REV_3 ? [state.mode, state.pmode, ...state.hits.map((h) => h.m ?? 0)] : [];
  // homerunRev 4 adds the spots, the streak and the timing of each pitch (earlier checksums are unchanged).
  const v4 =
    state.rev >= HOMERUN_REV_4
      ? [state.spotX ?? 0, state.spotY ?? 0, state.pspotX ?? 0, state.pspotY ?? 0, state.streak ?? 0, state.best ?? 0, state.bonus ?? 0, ...state.hits.flatMap((h) => [h.dt ?? 0, h.c ?? -1, h.a, h.b])]
      : [];
  for (const value of [...Object.values(snap), state.swingA, state.swingB, ...extra, ...v3, ...v4]) {
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

/** homerunRev 4's game: the spot and the tap (its own input kinds), its own plan and parts. */
export const homerunGameV4: ArcadeGame<HomerunState, ArcadeInputEvent | null> = {
  ...homerunGame,
  init: (seed: number) => homerunInit(seed, HOMERUN_REV_4),
  inputRanges: HOMERUN_INPUT_RANGES_V4,
};

export function homerunGameFor(rev?: number | null): ArcadeGame<HomerunState, ArcadeInputEvent | null> {
  const r = rev ?? 1;
  return r >= HOMERUN_REV_4 ? homerunGameV4 : r >= HOMERUN_REV_3 ? homerunGameV3 : r >= HOMERUN_REV_2 ? homerunGameV2 : homerunGame;
}

/** Display: where pitch `p` is on screen at sim time `t` (fractional ticks allowed), with its size; null off-flight. */
export function homerunBallAt(p: HomerunPitch, t: number, rev?: number | null): { x: number; y: number; u: number } | null {
  if (t < p.release || t > p.arrive + HOMERUN_TAKE_TICKS) return null;
  const u = (t - p.release) / (p.arrive - p.release);
  // Perspective: the ball covers little screen distance early and most of it late (1 / depth).
  const depth = 1 / (1 + 9 * Math.max(0, 1 - u));
  const k = (depth - 0.1) / 0.9;
  // homerunRev 4: the curveball bends from early in its flight (plainly visible); earlier revisions break late.
  const v4 = (rev ?? 1) >= HOMERUN_REV_4;
  const late = v4 ? Math.max(0, (u - 0.2) / 0.8) : Math.max(0, (u - 0.55) / 0.45);
  const brk = v4 ? Math.pow(late, 1.6) : late * late;
  return {
    x: HOMERUN_RELEASE_X + (p.plateX - p.breakX - HOMERUN_RELEASE_X) * k + p.breakX * brk,
    y: HOMERUN_RELEASE_Y + (p.plateY - p.breakY - HOMERUN_RELEASE_Y) * k + p.breakY * brk,
    u,
  };
}
