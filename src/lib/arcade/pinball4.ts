/**
 * Pinball pinRev 4 (the world expansion, 25 Oct 2026, docs/expansions/e4.md): a taller table with an
 * upper playfield, on the same deterministic engine and contact physics as pinRev 1–3 (pinball.ts, whose
 * swept primitives this module reuses; nothing there changed, so every older round plays as it did).
 *
 * The table is 390 × P4_WORLD_H. The lower table is pinRev 1's, moved down P4_SHIFT (flippers, slingshots,
 * the drop-target bank, the bumpers and the spinner in the left orbit), with a slightly lighter slope
 * (P4_GRAVITY) so a good flip reaches the upper playfield. New, all drawn on their collision shapes:
 *
 *  - J-O-U-L-Z lanes: five lanes under the arch (pinRev 1's three, extended). A ball through a lane lights its
 *    letter; every fresh flipper press shifts the lit letters (left press left, right press right). All five
 *    lit scores P4_PTS_JOULZ and raises the table multiplier (×2…×5, the existing multiplier lights). Lit
 *    letters carry over from ball to ball.
 *  - Two ramps: a ball rolling up into a ramp's mouth fast enough (P4_RAMP_MIN) is a clean ramp shot. It
 *    rides the ramp (a fixed path and time, the same for everyone), scores P4_PTS_RAMP and lights the next
 *    multiplier. The left ramp drops the ball onto the middle J-O-U-L-Z lane (U): shift the lit letters with
 *    the flippers while it rides to light a dark one. The right ramp crosses over and returns the ball down
 *    the left orbit, through the spinner, to the left flipper. A ramp shot within P4_COMBO_TICKS of the last
 *    one's exit builds a combo (P4_PTS_COMBO × the combo count). Too slow, and the ball rolls back out.
 *  - Multiball lock: a clean ramp shot lights the lock; while it is lit, every clean ramp shot carries the
 *    ball up into the lock hole at the top of the right ramp (it still scores as a ramp shot). The first and
 *    second locks keep the ball and plunge a new one; the third releases all three balls for P4_MB_TICKS (about 20 s)
 *    with the jackpot target lit: the standup behind the drop targets, P4_PTS_JACKPOT a hit from below. While
 *    more than one ball is in play, a drained ball costs nothing.
 *  - Skill shot: the ball waits on the plunger while a power meter charges up and down; any flipper press
 *    launches at that power (it launches itself after P4_AUTO_LAUNCH ticks). The plunge rides a wire rail
 *    round the arch and drops into a J-O-U-L-Z lane set by the power (soft: Z, full: J; five equal zones of
 *    the meter, p4PlungeLane). One lane flashes; a plunge into it scores P4_PTS_SKILL.
 *
 * The input is unchanged: the held flippers (PIN_INPUT_FLIPPERS), one event on each tick the set changes.
 * Integer fixed point (1/256 px), no randomness after init, no floats in the state.
 */

import { clampInt, TICKS_PER_SECOND, type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import { bandCurve, bandInit, bandPoints, bandStep, bandTotal, type BandFields, type BandParts } from "./scoreBands";
import { stdEach, stdLinear, stdPart, stdScore, stdSum, type StdPart, type StdSpec } from "./arcadeStandard";
import { icos, isin, isqrt, TRIG_ONE } from "./trig";
import {
  capSpeed,
  closestOnSeg,
  flipSurface,
  N_ONE,
  pinFlipAngle,
  PIN_BALLS,
  PIN_BALL_R,
  PIN_BUMPER_KICK,
  PIN_BUMPER_R,
  PIN_FLIP_DOWN_SPEED,
  PIN_FLIP_LEN,
  PIN_FLIP_R,
  PIN_FLIP_REST,
  PIN_FLIP_UP,
  PIN_FLIP_UP_SPEED,
  PIN_GATE,
  PIN_INPUT_FLIPPERS,
  PIN_INPUT_RANGES,
  PIN_LEFT,
  PIN_MAX_SPEED,
  PIN_MULT_MAX,
  PIN_PTS_BANK,
  PIN_PTS_BUMPER,
  PIN_PTS_LANE,
  PIN_PTS_LANE_AGAIN,
  PIN_PTS_SLING,
  PIN_PTS_SPIN,
  PIN_PTS_SPIN_LIT,
  PIN_PTS_TARGET,
  PIN_REV_EXPAND,
  PIN_REV_LONG,
  PIN_REV_STD,
  PIN_RIGHT,
  PIN_RUN_TICKS,
  PIN_V5_RUN_TICKS,
  PIN_SLING,
  PIN_SLING_KICK,
  PIN_TARGET,
  PIN_WALL,
  PIN_WALL_R,
  respond,
  sweepCapsule,
  sweepCircle,
  toLocal,
  toWorld,
  T_ONE,
  unit,
  pinballGameFor,
  pinCheckpoint,
  type PinCheckpoint,
  type PinSegDef,
  type PinState,
  type Seg,
} from "./pinball";

export { PIN_REV_EXPAND, PIN_REV_LONG, PIN_REV_STD };

/* ============================== Constants ============================== */

const FP = 256;
const R = PIN_BALL_R * FP;

export const P4_WORLD_W = 390;
export const P4_WORLD_H = 820;
/** The lower table (pinRev 1's) sits this much lower than in pinRev 1–3. */
export const P4_SHIFT = 120;
/** A slightly lighter slope than pinRev 1's 48, so a good flip reaches the upper playfield. */
export const P4_GRAVITY = 40;

export const P4_MID_X = 181;
export const P4_FLIP_PIVOTS: readonly (readonly [number, number])[] = [
  [113, 620 + P4_SHIFT],
  [249, 620 + P4_SHIFT],
];

/** The top arch (pinRev 1's). */
export const P4_ARCH = { cx: 196, cy: 160, rx: 186, ry: 120, segments: 16 } as const;
export const P4_LANE_INNER = 352;
export const P4_LANE_OUTER = 382;
export const P4_LANE_X = 367;
export const P4_LANE_Y = 652 + P4_SHIFT;
export const P4_GATE_Y = 150;
/** The gate's outer end sits this much higher than its inner end. */
export const P4_GATE_TILT = 12;
export const P4_LEFT_WALL = 10;
export const P4_ORBIT_INNER = 48;
export const P4_ORBIT_TOP = 180 + P4_SHIFT;
export const P4_ORBIT_BOTTOM = 520 + P4_SHIFT;
export const P4_SPINNER_Y = 300 + P4_SHIFT;

/** J-O-U-L-Z lanes: six guide posts make five lanes under the arch; the sensor line between their ends. */
export const P4_LANE_POSTS: readonly number[] = [86, 126, 166, 206, 246, 286];
export const P4_LANE_COUNT = 5;
export const P4_LANES_ALL = (1 << P4_LANE_COUNT) - 1;
export const P4_LANE_POST_TOP = 86;
export const P4_LANE_POST_BOTTOM = 112;
export const P4_LANE_SENSOR_Y = 99;
export const P4_LETTERS = "JOULZ";

export const P4_BUMPERS: readonly (readonly [number, number])[] = [
  [140, 200 + P4_SHIFT],
  [240, 200 + P4_SHIFT],
  [190, 262 + P4_SHIFT],
];
export const P4_TARGET_Y = 350 + P4_SHIFT;
export const P4_TARGET_XS: readonly number[] = [148, 176, 204, 232];
export const P4_TARGET_HALF = 7;
export const P4_TARGET_R = 4;

/** Ramps: each mouth's sensor line (y) and the x span a ball's centre must cross it in, the mouth posts. */
export const P4_RAMP_Y = 300;
export const P4_RAMP_POST_TOP = 286;
export const P4_RAMP_POST_BOTTOM = 318;
export const P4_RAMPS: readonly { x0: number; x1: number; posts: readonly number[] }[] = [
  { x0: 52, x1: 92, posts: [98] },
  { x0: 290, x1: 324, posts: [284, 330] },
];
/** A clean ramp shot needs at least this upward speed at the mouth (1/256 px a tick). */
export const P4_RAMP_MIN = 768;
/** A ramp ride's length in ticks, its path (world px, for drawing) and where the ball comes out (px, 1/256 px a tick). */
export const P4_RAMP_TICKS = 48;
/**
 * The ramps' channels (world px, for drawing only: the ride is a fixed time). The left ramp climbs to the
 * plunge rail (over the top lanes) and its ball runs along the rail to the U lane; the right one climbs past
 * the lock hole, crosses the upper playfield below the letters and drops into the left orbit.
 */
export const P4_RAMP_PATHS: readonly (readonly (readonly [number, number])[])[] = [
  [[72, 300], [64, 240], [62, 182], [68, 136], [84, 102]],
  [[307, 300], [316, 248], [312, 206], [290, 186], [220, 196], [150, 200], [96, 196], [54, 182], [29, 214], [29, 330]],
];
export const P4_RAMP_EXITS: readonly { x: number; y: number; vx: number; vy: number }[] = [
  { x: 186 * FP, y: 70 * FP, vx: 0, vy: 192 },
  { x: 29 * FP, y: 330 * FP, vx: 0, vy: 1024 },
];
/** Back-to-back ramps: a ramp shot within this many ticks of the last one's exit adds to the combo. */
export const P4_COMBO_TICKS = 4 * TICKS_PER_SECOND;

/** The lock hole, where the ramps meet at the top of the upper playfield (on the ramps' level: no collision). */
export const P4_LOCK_X = 306;
export const P4_LOCK_Y = 184;
/** A ramp shot into the lit lock rides its ramp's first part, then drops into the hole (ride codes 4 and 5). */
export const P4_RIDE_LOCK = 3;
export const P4_LOCK_RIDE_TICKS = 36;
/** A locked ball waits this long before the next is plunged; a released ball comes out of the hole this way. */
export const P4_LOCK_RELAUNCH = 50;
export const P4_MB_TICKS = 20 * TICKS_PER_SECOND;
/** Multiball releases the locked balls this many ticks apart. */
export const P4_MB_STAGGER = 24;
export const P4_KICK: readonly (readonly [number, number])[] = [
  [-640, 512],
  [-256, 640],
  [-896, 384],
];
/** The jackpot standup: behind the drop-target bank (reachable from below only while targets are down). */
export const P4_JACKPOT: { a: readonly [number, number]; b: readonly [number, number] } = { a: [166, 440], b: [214, 440] };
export const P4_JACKPOT_COOLDOWN = 30;

/** The plunger: power meter 0…P4_POWER_MAX, rising and falling one step a tick; launch speed from the power. */
export const P4_POWER_MAX = 60;
export const P4_LAUNCH_MIN = 3712;
export const P4_LAUNCH_MAX = 4608;
export const P4_FIRST_WAIT = 40;
export const P4_RELAUNCH = 90;
/** The ball launches itself this many ticks after the meter starts. */
export const P4_AUTO_LAUNCH = 4 * TICKS_PER_SECOND;
/** A skill shot counts only for the first lane crossed within this many ticks of the launch. */
export const P4_SKILL_TICKS = 4 * TICKS_PER_SECOND;
/** The plunge rail: a launched ball crossing the gate line rides it round the arch, then drops into a lane. */
export const P4_RAIL = 3;
export const P4_RAIL_DROP_Y = 70;

/** The J-O-U-L-Z lane (0 = J … 4 = Z) a plunge of this power drops into: soft plunges the right end, full power J. */
export function p4PlungeLane(power: number): number {
  const p = clampInt(power, 0, P4_POWER_MAX);
  return P4_LANE_COUNT - 1 - Math.min(P4_LANE_COUNT - 1, Math.trunc((p * P4_LANE_COUNT) / (P4_POWER_MAX + 1)));
}

/** Where (px) the rail drops a plunge of this power: inside its lane, a little further left the harder it was. */
export function p4PlungeX(power: number): number {
  const p = clampInt(power, 0, P4_POWER_MAX);
  const lane = p4PlungeLane(p);
  const zone = P4_POWER_MAX + 1;
  // Position inside the power zone, 0…zone−1 over the zone's width.
  const into = p * P4_LANE_COUNT - Math.trunc((p * P4_LANE_COUNT) / zone) * zone;
  const centre = (P4_LANE_POSTS[lane]! + P4_LANE_POSTS[lane + 1]!) >> 1;
  return centre + 6 - Math.trunc((12 * into) / Math.max(1, zone - 1));
}

/** The rail ride's length in ticks for a drop at x (px): further round the arch takes longer. */
export function p4RailTicks(x: number): number {
  return 24 + Math.trunc((P4_LANE_INNER - x) / 8);
}

/**
 * The expansion's awards. They are flat: the table multiplier counts on the table's switches (bumpers,
 * slingshots, targets, the bank, the spinner and lane letters), as pinRev 1, not on these.
 */
export const P4_PTS_JOULZ = 5000;
export const P4_PTS_RAMP = 1000;
export const P4_PTS_COMBO = 1000;
export const P4_PTS_LOCK = 2000;
export const P4_PTS_JACKPOT = 5000;
export const P4_PTS_SKILL = 2500;

/** The launch speed for a plunger power. */
export function p4LaunchSpeed(power: number): number {
  return P4_LAUNCH_MIN + Math.trunc(((P4_LAUNCH_MAX - P4_LAUNCH_MIN) * clampInt(power, 0, P4_POWER_MAX)) / P4_POWER_MAX);
}

/** The meter moves this much a tick (a full sweep up and back down in 30 ticks, half a second). */
export const P4_POWER_STEP = 4;
/** The plunger power `t` ticks into charging: up to P4_POWER_MAX and back down, again and again. */
export function p4PowerAt(t: number): number {
  const period = 2 * P4_POWER_MAX;
  const k = (((t * P4_POWER_STEP) % period) + period) % period;
  return k <= P4_POWER_MAX ? k : period - k;
}

/** The lane that flashes for a launch: one of P4_SKILL_LANES, from the seed and the launch count. */
export const P4_SKILL_LANES: readonly number[] = [0, 1, 2, 3, 4];
export function p4SkillLane(seed: number, launch: number): number {
  const n = P4_SKILL_LANES.length;
  const start = ((seed % n) + n) % n;
  return P4_SKILL_LANES[(start + 2 * launch) % n]!;
}

/* ------------------------------- The table ------------------------------ */

function archPoints(): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= P4_ARCH.segments; i++) {
    const a = Math.trunc((32768 * i) / P4_ARCH.segments);
    out.push([P4_ARCH.cx + Math.trunc((P4_ARCH.rx * icos(a)) / TRIG_ONE), P4_ARCH.cy - Math.trunc((P4_ARCH.ry * isin(a)) / TRIG_ONE)]);
  }
  return out;
}

export const P4_JACKPOT_KIND = 4;
const S = P4_SHIFT;
const LEFT_SLING: readonly [number, number][] = [
  [48, 440 + S],
  [48, 520 + S],
  [95, 545 + S],
];
const mirror = (p: readonly [number, number]): [number, number] => [2 * P4_MID_X - p[0], p[1]];

function tableSegs(): PinSegDef[] {
  const segs: PinSegDef[] = [];
  const wall = (a: readonly [number, number], b: readonly [number, number], r = PIN_WALL_R, kind = PIN_WALL, id?: number) =>
    segs.push({ a, b, r, kind, ...(id !== undefined ? { id } : {}) });
  const arch = archPoints();
  for (let i = 0; i < arch.length - 1; i++) wall(arch[i]!, arch[i + 1]!);
  const archRight = arch[0]!;
  const archLeft = arch[arch.length - 1]!;
  wall(archRight, [P4_LANE_OUTER, P4_WORLD_H + 20]);
  wall(archLeft, [P4_LEFT_WALL, 548 + S]);
  wall([P4_LANE_INNER, P4_GATE_Y], [P4_LANE_INNER, 548 + S]);
  wall([P4_LANE_INNER, 548 + S], [P4_LANE_INNER, P4_WORLD_H + 20]);
  // The one-way gate, tilted down to the playfield side so a ball that lands on it rolls off (pinRev 1's flat
  // gate could hold a ball).
  wall([P4_LANE_INNER, P4_GATE_Y], [P4_LANE_OUTER - 1, P4_GATE_Y - P4_GATE_TILT], 2, PIN_GATE);
  wall([P4_ORBIT_INNER, P4_ORBIT_TOP], [P4_ORBIT_INNER, P4_ORBIT_BOTTOM]);
  wall([P4_LEFT_WALL, 548 + S], [104, 614 + S]);
  wall(mirror([P4_LEFT_WALL, 548 + S]), mirror([104, 614 + S]));
  for (const [px0, py0] of P4_FLIP_PIVOTS) wall([px0, py0 + PIN_FLIP_R + PIN_WALL_R], [px0, P4_WORLD_H + 20]);
  const sling = (pts: readonly (readonly [number, number])[], side: number) => {
    wall(pts[0]!, pts[1]!);
    wall(pts[1]!, pts[2]!);
    wall(pts[0]!, pts[2]!, PIN_WALL_R, PIN_SLING, side);
  };
  sling(LEFT_SLING, 0);
  sling(LEFT_SLING.map(mirror), 1);
  for (const x of P4_LANE_POSTS) wall([x, P4_LANE_POST_TOP], [x, P4_LANE_POST_BOTTOM]);
  P4_TARGET_XS.forEach((x, i) => wall([x - P4_TARGET_HALF, P4_TARGET_Y], [x + P4_TARGET_HALF, P4_TARGET_Y], P4_TARGET_R, PIN_TARGET, i));
  // The ramp mouths' posts.
  for (const ramp of P4_RAMPS) for (const x of ramp.posts) wall([x, P4_RAMP_POST_TOP], [x, P4_RAMP_POST_BOTTOM]);
  // The jackpot standup.
  wall(P4_JACKPOT.a, P4_JACKPOT.b, PIN_WALL_R, P4_JACKPOT_KIND);
  return segs;
}

/** Every static segment of the pinRev 4 table, in world px (drawn exactly as collided). */
export const P4_SEGS: readonly PinSegDef[] = tableSegs();

const SEGS: readonly Seg[] = P4_SEGS.map((d) => {
  const ax = d.a[0] * FP, ay = d.a[1] * FP, bx = d.b[0] * FP, by = d.b[1] * FP;
  const sx = bx - ax, sy = by - ay;
  const len2 = sx * sx + sy * sy;
  const rr = R + d.r * FP;
  return {
    ax, ay, bx, by, sx, sy, len: isqrt(len2), len2, rr, kind: d.kind, id: d.id ?? -1,
    minX: Math.min(ax, bx) - rr, minY: Math.min(ay, by) - rr, maxX: Math.max(ax, bx) + rr, maxY: Math.max(ay, by) + rr,
  };
});

const BUMPER_RR = R + PIN_BUMPER_R * FP;
const FLIP_RR = R + PIN_FLIP_R * FP;
const FLIP_LEN = PIN_FLIP_LEN * FP;
const FLIP_E = 70;
const WALL_E = 128;
const BUMPER_E = 160;

/* ================================ State ================================ */

/** One ball (the main ball's fields live on the state itself; extra multiball balls in `extras`). */
export interface P4Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  still: number;
  /** Riding a ramp: 1 left, 2 right (0 none), and the ticks ridden. */
  ride: number;
  rideT: number;
}

export interface Pin4State extends PinState, BandFields {
  rev4: number;
  /** pinRev 5 (1): the 90-second run (absent on pinRev 4; pinRev 6 carries it too). */
  rev5?: number;
  /**
   * pinRev 6 (1): the arcade scoring standard (absent before it). No table multiplier (it stays x1) and a flat
   * combo award, so table points are a straight count of what the ball did; `combos` counts back-to-back ramp shots.
   */
  rev6?: number;
  combos?: number;
  seed: number;
  /** The main ball's ramp ride (as P4Ball). */
  ride: number;
  rideT: number;
  /** Extra balls in play (multiball). */
  extras: P4Ball[];
  /** Plunger: ticks the meter has charged (−1 when not charging) and the power the last launch used. */
  charge: number;
  power: number;
  /** The lane flashing for the skill shot (−1 none), the tick of the last launch and whether its first lane is still to come. */
  skillLane: number;
  launchTick: number;
  skillOpen: number;
  skills: number;
  skillAt: number;
  /** Lit J-O-U-L-Z letters (bits 0–4), completed sets and the tick of the last. */
  joulz: number;
  joulzAt: number;
  /** Ramps: clean shots, the current combo, the best combo, last ramp exit tick, last ramp shot tick and which. */
  ramps: number;
  combo: number;
  bestCombo: number;
  rampExitAt: number;
  rampAt: number;
  rampSide: number;
  /** Lock and multiball: balls locked (0–2), locks made, multiballs started, the multiball's end tick, pending releases (ticks). */
  locks: number;
  locked: number;
  multiballs: number;
  mbUntil: number;
  releases: number[];
  lockAt: number;
  /** Jackpots scored and the tick of the last. */
  jackpots: number;
  jackpotAt: number;
  /** The lock is lit (a clean ramp shot lights it; multiball puts it out), and balls locked so far (each third starts multiball). */
  lockLit: number;
  locksMade: number;
  /** Where the plunge rail drops the main ball (px). */
  railX: number;
}

export function p4BallInLane(): { x: number; y: number } {
  return { x: P4_LANE_X * FP, y: P4_LANE_Y * FP };
}

function init(seed: number): Pin4State {
  const lane = p4BallInLane();
  return {
    tick: 0,
    x: lane.x,
    y: lane.y,
    vx: 0,
    vy: 0,
    live: 0,
    wait: P4_FIRST_WAIT,
    launched: 0,
    lost: 0,
    held: 0,
    flips: [PIN_FLIP_REST, PIN_FLIP_REST],
    points: 0,
    mult: 1,
    lanes: 0,
    targets: 0,
    bankUp: 0,
    spinLit: 0,
    bumps: 0,
    slings: 0,
    drops: 0,
    banks: 0,
    spins: 0,
    laneLights: 0,
    laneSets: 0,
    bumperAt: P4_BUMPERS.map(() => -999),
    slingAt: [-999, -999],
    still: 0,
    endedTick: 0,
    rev4: PIN_REV_EXPAND,
    seed: seed | 0,
    ride: 0,
    rideT: 0,
    extras: [],
    charge: -1,
    power: 0,
    skillLane: -1,
    launchTick: 0,
    skillOpen: 0,
    skills: 0,
    skillAt: -999,
    joulz: 0,
    joulzAt: -999,
    ramps: 0,
    combo: 0,
    bestCombo: 0,
    rampExitAt: -9999,
    rampAt: -999,
    rampSide: 0,
    locks: 0,
    locked: 0,
    multiballs: 0,
    mbUntil: 0,
    releases: [],
    lockAt: -999,
    jackpots: 0,
    jackpotAt: -999,
    lockLit: 0,
    locksMade: 0,
    railX: 0,
  };
}

/** The run's length in ticks: 90 s on pinRev 5, 60 s on pinRev 4. */
export function p4RunTicks(state: Pin4State): number {
  return state.rev5 ? PIN_V5_RUN_TICKS : PIN_RUN_TICKS;
}

export function p4IsOver(state: Pin4State): boolean {
  return state.endedTick > 0 || state.tick >= p4RunTicks(state);
}

/** Balls in play now (the main ball if live, plus multiball extras). */
export function p4BallsInPlay(state: Pin4State): number {
  return (state.live ? 1 : 0) + state.extras.length;
}

/** The jackpot is lit (multiball running). */
export function p4JackpotLit(state: Pin4State): boolean {
  return state.tick < state.mbUntil;
}

/** Multiball is on: its clock is running or more than one ball is (still) out. */
export function p4Multiball(state: Pin4State): boolean {
  return p4JackpotLit(state) || state.extras.length > 0 || state.releases.length > 0;
}

/* ============================== Collisions ============================= */

interface Contact {
  t: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
  what: number;
  index: number;
}

interface Hits {
  bumper: number;
  sling: number;
  target: number;
  jackpot: number;
}

function segActive(s: Seg, targets: number): boolean {
  return s.kind !== PIN_TARGET || ((targets >> s.id) & 1) === 0;
}

type Angles = { a0: number; a1: number; omega: number }[];

function sweepFlipper(side: number, x0: number, y0: number, x1: number, y1: number, ang: { a0: number; a1: number }) {
  const [pxp, pyp] = P4_FLIP_PIVOTS[side]!;
  const px0 = pxp * FP, py0 = pyp * FP;
  const reach = FLIP_LEN + FLIP_RR + 4 * FP;
  if (Math.max(x0, x1) < px0 - reach || Math.min(x0, x1) > px0 + reach) return null;
  if (Math.max(y0, y1) < py0 - reach || Math.min(y0, y1) > py0 + reach) return null;
  const c0 = icos(ang.a0), s0 = isin(ang.a0), c1 = icos(ang.a1), s1 = isin(ang.a1);
  const [lx0, ly0] = toLocal(x0 - px0, y0 - py0, c0, s0);
  const [lx1, ly1] = toLocal(x1 - px0, y1 - py0, c1, s1);
  const hit = sweepCapsule(lx0, ly0, lx1, ly1, 0, 0, FLIP_LEN, 0, FLIP_LEN, FLIP_LEN * FLIP_LEN, FLIP_RR);
  if (!hit) return null;
  const a = ang.a0 + Math.trunc(((ang.a1 - ang.a0) * hit.t) / T_ONE);
  const c = icos(a), sn = isin(a);
  const [wx, wy] = toWorld(hit.x, hit.y, c, sn);
  const [nx, ny] = toWorld(hit.nx, hit.ny, c, sn);
  const len = Math.max(1, isqrt(nx * nx + ny * ny));
  return { t: hit.t, x: px0 + wx, y: py0 + wy, nx: Math.trunc((nx * N_ONE) / len), ny: Math.trunc((ny * N_ONE) / len) };
}

function earliestContact(s: Pin4State, x0: number, y0: number, x1: number, y1: number, angles: Angles): Contact | null {
  let best: Contact | null = null;
  const loX = Math.min(x0, x1), hiX = Math.max(x0, x1), loY = Math.min(y0, y1), hiY = Math.max(y0, y1);
  SEGS.forEach((seg, index) => {
    if (hiX < seg.minX || loX > seg.maxX || hiY < seg.minY || loY > seg.maxY) return;
    if (!segActive(seg, s.targets)) return;
    const hit = sweepCapsule(x0, y0, x1, y1, seg.ax, seg.ay, seg.sx, seg.sy, seg.len, seg.len2, seg.rr, seg.kind === PIN_GATE);
    if (hit && (!best || hit.t < best.t)) best = { ...hit, what: 0, index };
  });
  P4_BUMPERS.forEach(([bx, by], index) => {
    const cx = bx * FP, cy = by * FP;
    if (hiX < cx - BUMPER_RR || loX > cx + BUMPER_RR || hiY < cy - BUMPER_RR || loY > cy + BUMPER_RR) return;
    const t = sweepCircle(x0, y0, x1, y1, cx, cy, BUMPER_RR);
    if (t < 0 || (best && t >= best.t)) return;
    const px0 = x0 + Math.trunc(((x1 - x0) * t) / T_ONE);
    const py0 = y0 + Math.trunc(((y1 - y0) * t) / T_ONE);
    const [nx, ny] = unit(px0 - cx, py0 - cy);
    best = { t, x: px0, y: py0, nx, ny, what: 1, index };
  });
  for (let side = 0; side < 2; side++) {
    const hit = sweepFlipper(side, x0, y0, x1, y1, angles[side]!);
    if (hit && (!best || hit.t < best.t)) best = { ...hit, what: 2, index: side };
  }
  return best;
}

function hitSeg(b: P4Ball, seg: Seg, nx: number, ny: number, hits: Hits): void {
  if (seg.kind === PIN_SLING) {
    const vn = respond(b, nx, ny, WALL_E, PIN_SLING_KICK);
    if (vn > 128) hits.sling = seg.id;
    return;
  }
  const vn = respond(b, nx, ny, WALL_E, 0);
  if (seg.kind === PIN_TARGET && vn > 0) hits.target = seg.id;
  // The jackpot standup counts only from below (its face towards the drop targets).
  if (seg.kind === P4_JACKPOT_KIND && vn > 128 && ny > 0) hits.jackpot = 1;
}

function applyContact(b: P4Ball, c: Contact, angles: Angles, hits: Hits): void {
  if (c.what === 1) {
    if (respond(b, c.nx, c.ny, BUMPER_E, PIN_BUMPER_KICK) > 0) hits.bumper = c.index;
    return;
  }
  if (c.what === 2) {
    const ang = angles[c.index]!;
    const [pxp, pyp] = P4_FLIP_PIVOTS[c.index]!;
    const cos = icos(ang.a1), sin = isin(ang.a1);
    const [lx] = toLocal(c.x - pxp * FP, c.y - pyp * FP, cos, sin);
    const [svx, svy] = flipSurface(clampInt(lx, 0, FLIP_LEN), ang.omega, cos, sin);
    respond(b, c.nx, c.ny, FLIP_E, 0, svx, svy);
    return;
  }
  hitSeg(b, SEGS[c.index]!, c.nx, c.ny, hits);
}

function resolve(s: Pin4State, b: P4Ball, angles: Angles, hits: Hits): void {
  SEGS.forEach((seg) => {
    if (b.x < seg.minX || b.x > seg.maxX || b.y < seg.minY || b.y > seg.maxY) return;
    if (!segActive(seg, s.targets)) return;
    const { qx, qy, d2 } = closestOnSeg(b.x, b.y, seg);
    if (d2 >= seg.rr * seg.rr) return;
    // The one-way gate holds only a ball above it (a ball below passes up through).
    if (seg.kind === PIN_GATE && b.y >= qy) return;
    let nx: number, ny: number;
    if (d2 === 0) [nx, ny] = unit(-seg.sy, seg.sx);
    else [nx, ny] = unit(b.x - qx, b.y - qy);
    b.x = qx + Math.trunc((nx * seg.rr) / N_ONE) + Math.sign(nx);
    b.y = qy + Math.trunc((ny * seg.rr) / N_ONE) + Math.sign(ny);
    hitSeg(b, seg, nx, ny, hits);
  });
  P4_BUMPERS.forEach(([bx, by], index) => {
    const dx = b.x - bx * FP, dy = b.y - by * FP;
    if (Math.abs(dx) >= BUMPER_RR || Math.abs(dy) >= BUMPER_RR) return;
    if (dx * dx + dy * dy >= BUMPER_RR * BUMPER_RR) return;
    const [nx, ny] = unit(dx, dy);
    b.x = bx * FP + Math.trunc((nx * BUMPER_RR) / N_ONE) + Math.sign(nx);
    b.y = by * FP + Math.trunc((ny * BUMPER_RR) / N_ONE) + Math.sign(ny);
    if (respond(b, nx, ny, BUMPER_E, PIN_BUMPER_KICK) > 0) hits.bumper = index;
  });
  for (let side = 0; side < 2; side++) {
    const [pxp, pyp] = P4_FLIP_PIVOTS[side]!;
    const px0 = pxp * FP, py0 = pyp * FP;
    const dx = b.x - px0, dy = b.y - py0;
    const reach = FLIP_LEN + FLIP_RR;
    if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
    const ang = angles[side]!;
    const cos = icos(ang.a1), sin = isin(ang.a1);
    const [lx, ly] = toLocal(dx, dy, cos, sin);
    const qx = clampInt(lx, 0, FLIP_LEN);
    const ddx = lx - qx;
    const d2 = ddx * ddx + ly * ly;
    if (d2 >= FLIP_RR * FLIP_RR) continue;
    let lnx: number, lny: number;
    if (d2 === 0) [lnx, lny] = [0, -N_ONE];
    else [lnx, lny] = unit(ddx, ly);
    const [wx, wy] = toWorld(qx + Math.trunc((lnx * FLIP_RR) / N_ONE), Math.trunc((lny * FLIP_RR) / N_ONE), cos, sin);
    const [nx0, ny0] = toWorld(lnx, lny, cos, sin);
    const [nx, ny] = unit(nx0, ny0);
    b.x = px0 + wx + Math.sign(nx);
    b.y = py0 + wy + Math.sign(ny);
    const [svx, svy] = flipSurface(qx, ang.omega, cos, sin);
    respond(b, nx, ny, FLIP_E, 0, svx, svy);
  }
}

/* ================================= Step ================================= */

/** What a ball did this tick that the state must act on after its physics (a lock, a ramp entry). */
interface BallEvents {
  ramp: number;
  rail: boolean;
}

function addPoints(s: Pin4State, points: number): void {
  s.points += points * s.mult;
}

/** Lane, spinner, ramp-mouth and lock sensors for one ball's move from y0 to its current place. */
function sensors(s: Pin4State, b: P4Ball, y0: number, ev: BallEvents): void {
  const laneY = P4_LANE_SENSOR_Y * FP;
  if ((y0 < laneY) !== (b.y < laneY)) {
    for (let lane = 0; lane < P4_LANE_COUNT; lane++) {
      if (b.x <= P4_LANE_POSTS[lane]! * FP || b.x >= P4_LANE_POSTS[lane + 1]! * FP) continue;
      // The skill shot: the launch's first lane (only one, and only the main ball).
      if (s.skillOpen && b === (s as unknown as P4Ball)) {
        s.skillOpen = 0;
        if (lane === s.skillLane) {
          s.skills += 1;
          s.skillAt = s.tick;
          s.points += P4_PTS_SKILL;
        }
      }
      if ((s.joulz >> lane) & 1) addPoints(s, PIN_PTS_LANE_AGAIN);
      else {
        s.joulz |= 1 << lane;
        s.laneLights += 1;
        addPoints(s, PIN_PTS_LANE);
        if (s.joulz === P4_LANES_ALL) {
          s.joulz = 0;
          s.laneSets += 1;
          s.joulzAt = s.tick;
          s.points += P4_PTS_JOULZ;
          // pinRev 6: no multiplier (the standard pays J-O-U-L-Z as a feature instead).
          if (!s.rev6) s.mult = Math.min(PIN_MULT_MAX, s.mult + 1);
        }
      }
    }
  }
  const spinY = P4_SPINNER_Y * FP;
  if ((y0 < spinY) !== (b.y < spinY) && b.x > P4_LEFT_WALL * FP && b.x < P4_ORBIT_INNER * FP) {
    const spins = clampInt(Math.trunc(Math.abs(b.vy) / 192), 1, 16);
    s.spins += spins;
    s.points += spins * (s.tick < s.spinLit ? PIN_PTS_SPIN_LIT : PIN_PTS_SPIN) * s.mult;
  }
  // Ramp mouths: crossing the line upward inside a mouth.
  const rampY = P4_RAMP_Y * FP;
  if (y0 >= rampY && b.y < rampY) {
    P4_RAMPS.forEach((ramp, i) => {
      if (b.x <= ramp.x0 * FP || b.x >= ramp.x1 * FP) return;
      if (-b.vy >= P4_RAMP_MIN) ev.ramp = i + 1;
      else {
        // Too slow: it rolls back out of the mouth.
        b.y = rampY + FP;
        b.vy = Math.max(256, Math.trunc(-b.vy / 2));
        b.vx = Math.trunc(b.vx / 2);
      }
    });
  }
  // The plunge rail: a launched ball crossing the gate line in the shooter lane.
  const gateY = P4_GATE_Y * FP;
  if (y0 >= gateY && b.y < gateY && b.x > P4_LANE_INNER * FP) ev.rail = true;
}

/** One tick of physics for one ball: gravity, then substeps of swept motion and contact. */
function simulateBall(s: Pin4State, b: P4Ball, flipsFrom: number[], ev: BallEvents): void {
  b.vy += P4_GRAVITY;
  capSpeed(b);
  const flipsTo = s.flips;
  const moving = flipsFrom[0] !== flipsTo[0] || flipsFrom[1] !== flipsTo[1];
  const fastest = Math.max(Math.abs(b.vx), Math.abs(b.vy));
  let n = clampInt(Math.trunc((fastest + 383) / 384), 2, 12);
  if (moving && n < 6) n = 6;
  const hits: Hits = { bumper: -1, sling: -1, target: -1, jackpot: -1 };
  let lastY = b.y;
  for (let k = 1; k <= n; k++) {
    const angles = [0, 1].map((side) => {
      const f0 = flipsFrom[side]! + Math.trunc(((flipsTo[side]! - flipsFrom[side]!) * (k - 1)) / n);
      const f1 = flipsFrom[side]! + Math.trunc(((flipsTo[side]! - flipsFrom[side]!) * k) / n);
      return { a0: pinFlipAngle(side, f0), a1: pinFlipAngle(side, f1), omega: pinFlipAngle(side, flipsTo[side]!) - pinFlipAngle(side, flipsFrom[side]!) };
    });
    const sx = k === n ? b.vx - (n - 1) * Math.trunc(b.vx / n) : Math.trunc(b.vx / n);
    const sy = k === n ? b.vy - (n - 1) * Math.trunc(b.vy / n) : Math.trunc(b.vy / n);
    const x0 = b.x, y0 = b.y;
    const x1 = x0 + sx, y1 = y0 + sy;
    const contact = earliestContact(s, x0, y0, x1, y1, angles);
    if (contact) {
      b.x = contact.x;
      b.y = contact.y;
      applyContact(b, contact, angles, hits);
    } else {
      b.x = x1;
      b.y = y1;
    }
    resolve(s, b, angles, hits);
    sensors(s, b, lastY, ev);
    lastY = b.y;
    if (ev.ramp || ev.rail) break;
  }
  capSpeed(b);
  score(s, hits);
}

/** Points for a ball's strikes this tick (each bumper and sling at most once every 4 ticks). */
function score(s: Pin4State, hits: Hits): void {
  if (hits.bumper >= 0 && s.tick - (s.bumperAt[hits.bumper] ?? -999) >= 4) {
    s.bumps += 1;
    addPoints(s, PIN_PTS_BUMPER);
    s.bumperAt[hits.bumper] = s.tick;
  }
  if (hits.sling >= 0 && s.tick - (s.slingAt[hits.sling] ?? -999) >= 4) {
    s.slings += 1;
    addPoints(s, PIN_PTS_SLING);
    s.slingAt[hits.sling] = s.tick;
  }
  if (hits.target >= 0 && ((s.targets >> hits.target) & 1) === 0) {
    s.targets |= 1 << hits.target;
    s.drops += 1;
    addPoints(s, PIN_PTS_TARGET);
    if (s.targets === 15) {
      s.banks += 1;
      addPoints(s, PIN_PTS_BANK);
      s.bankUp = s.tick + 6 * TICKS_PER_SECOND;
      s.spinLit = s.tick + 15 * TICKS_PER_SECOND;
    }
  }
  if (hits.jackpot >= 0 && p4JackpotLit(s) && s.tick - s.jackpotAt >= P4_JACKPOT_COOLDOWN) {
    s.jackpots += 1;
    s.jackpotAt = s.tick;
    s.points += P4_PTS_JACKPOT;
  }
}

/** The main ball's fields as a ball (the state itself carries them). */
function mainBall(s: Pin4State): P4Ball {
  return s as unknown as P4Ball;
}

/** A ramp ride's end: the ball comes out at the ramp's exit. */
function endRide(s: Pin4State, b: P4Ball): void {
  const exit = P4_RAMP_EXITS[b.ride - 1]!;
  b.x = exit.x;
  b.y = exit.y;
  b.vx = exit.vx;
  b.vy = exit.vy;
  b.ride = 0;
  b.rideT = 0;
  b.still = 0;
  s.rampExitAt = s.tick;
}

/** A clean ramp shot: points, the next multiplier and the combo; the ball starts its ride. */
function startRide(s: Pin4State, b: P4Ball, side: number): void {
  const back = s.tick - s.rampExitAt <= P4_COMBO_TICKS;
  s.combo = back ? s.combo + 1 : 1;
  s.bestCombo = Math.max(s.bestCombo, s.combo);
  s.ramps += 1;
  s.rampAt = s.tick;
  s.rampSide = side;
  if (s.rev6) {
    // pinRev 6: a flat award for each back-to-back shot (no rising scale) and no multiplier; combos counted.
    s.points += P4_PTS_RAMP + (s.combo > 1 ? P4_PTS_COMBO : 0);
    if (s.combo > 1) s.combos = (s.combos ?? 0) + 1;
  } else {
    s.points += P4_PTS_RAMP + (s.combo > 1 ? P4_PTS_COMBO * (s.combo - 1) : 0);
    s.mult = Math.min(PIN_MULT_MAX, s.mult + 1);
  }
  b.ride = side;
  b.rideT = 0;
  b.vx = 0;
  b.vy = 0;
  if (p4Multiball(s)) return;
  // The lock: a ramp shot lights it; with it lit, the ramp carries the ball up into the lock hole.
  if (s.lockLit) b.ride = side + P4_RIDE_LOCK;
  else s.lockLit = 1;
}

/** Releases one ball from the lock hole (multiball). */
function kickOut(index: number): P4Ball {
  const [vx, vy] = P4_KICK[index % P4_KICK.length]!;
  return { x: P4_LOCK_X * FP, y: (P4_LOCK_Y + 2) * FP, vx, vy, still: 0, ride: 0, rideT: 0 };
}

/** A ball dropped into the lock hole. Returns true when the ball is gone from play (locked). */
function lockBall(s: Pin4State, b: P4Ball, isMain: boolean): boolean {
  s.lockAt = s.tick;
  s.locksMade += 1;
  s.points += P4_PTS_LOCK;
  if (s.locks < 2) {
    s.locks += 1;
    s.locked += 1;
    if (isMain) {
      s.live = 0;
      s.wait = P4_LOCK_RELAUNCH;
      const lane = p4BallInLane();
      s.x = lane.x;
      s.y = lane.y;
      s.vx = 0;
      s.vy = 0;
      s.ride = 0;
      s.rideT = 0;
      s.still = 0;
    }
    return true;
  }
  // The third: multiball. This ball comes straight back out, then the two locked ones; the lock goes dark.
  s.locks = 0;
  s.lockLit = 0;
  s.multiballs += 1;
  s.mbUntil = s.tick + P4_MB_TICKS;
  s.releases = [s.tick + P4_MB_STAGGER, s.tick + 2 * P4_MB_STAGGER];
  const k = kickOut(0);
  b.x = k.x;
  b.y = k.y;
  b.vx = k.vx;
  b.vy = k.vy;
  return false;
}

function step(state: Pin4State, input: ArcadeInputEvent | null): Pin4State {
  if (p4IsOver(state)) return state;
  const tick = state.tick + 1;
  const next: Pin4State = {
    ...state,
    tick,
    flips: state.flips.slice(),
    bumperAt: state.bumperAt.slice(),
    slingAt: state.slingAt.slice(),
    extras: state.extras.map((b) => ({ ...b })),
    releases: state.releases.slice(),
  };
  let held = state.held;
  if (input && input.k === PIN_INPUT_FLIPPERS) held = clampInt(input.a, 0, 3);
  const pressed = held & ~state.held;
  next.held = held;

  // A fresh press shifts the lit J-O-U-L-Z letters (left press left, right press right).
  const all = P4_LANES_ALL;
  const top = P4_LANE_COUNT - 1;
  if (pressed & PIN_LEFT) next.joulz = ((next.joulz >> 1) | ((next.joulz & 1) << top)) & all;
  if (pressed & PIN_RIGHT) next.joulz = ((next.joulz << 1) | (next.joulz >> top)) & all;
  next.lanes = next.joulz;

  if (next.bankUp > 0 && tick >= next.bankUp) {
    next.targets = 0;
    next.bankUp = 0;
  }

  const from = next.flips.slice();
  for (let side = 0; side < 2; side++) {
    const up = (held >> side) & 1;
    const lift = from[side]!;
    next.flips[side] = up ? Math.max(PIN_FLIP_UP, lift - PIN_FLIP_UP_SPEED) : Math.min(PIN_FLIP_REST, lift + PIN_FLIP_DOWN_SPEED);
  }

  // Multiball: locked balls come out of the hole on their ticks.
  while (next.releases.length && tick >= next.releases[0]!) {
    next.releases.shift();
    next.locked = Math.max(0, next.locked - 1);
    next.extras.push(kickOut(next.multiballs + next.extras.length + 1));
  }

  if (!state.live) {
    if (next.lost >= PIN_BALLS && next.extras.length === 0) {
      next.endedTick = tick;
      return next;
    }
    if (next.wait > 0) {
      next.wait -= 1;
      if (next.wait === 0) {
        next.charge = 0;
        next.skillLane = p4SkillLane(next.seed, next.launched);
      }
    } else if (next.charge >= 0) {
      next.charge += 1;
      const launch = (pressed & (PIN_LEFT | PIN_RIGHT)) !== 0 || next.charge >= P4_AUTO_LAUNCH;
      if (launch) {
        next.power = p4PowerAt(next.charge);
        const lane = p4BallInLane();
        next.x = lane.x;
        next.y = lane.y;
        next.vx = 0;
        next.vy = -p4LaunchSpeed(next.power);
        next.live = 1;
        next.launched += 1;
        next.still = 0;
        next.charge = -1;
        next.launchTick = tick;
        next.skillOpen = 1;
      }
    }
  } else {
    stepBall(next, mainBall(next), from, true);
  }
  for (let i = 0; i < next.extras.length; i++) stepBall(next, next.extras[i]!, from, false);
  if (next.skillOpen && tick - next.launchTick > P4_SKILL_TICKS) next.skillOpen = 0;

  // Balls touching each other push apart (equal masses: the normal parts swap).
  collideBalls(next);

  // Drains.
  const drained = (b: P4Ball) => b.ride === 0 && (b.y > (P4_WORLD_H + PIN_BALL_R) * FP || b.y < 0 || b.x < 0 || b.x > P4_WORLD_W * FP);
  next.extras = next.extras.filter((b) => !drained(b));
  if (next.live && drained(mainBall(next))) {
    const extra = next.extras.shift();
    if (extra) {
      // Another ball is still in play: this drain costs nothing, and that ball becomes the main one.
      next.x = extra.x;
      next.y = extra.y;
      next.vx = extra.vx;
      next.vy = extra.vy;
      next.still = extra.still;
      next.ride = extra.ride;
      next.rideT = extra.rideT;
    } else if (next.releases.length > 0) {
      // Multiball is still releasing: the next locked ball becomes the main one.
      next.releases.shift();
      next.locked = Math.max(0, next.locked - 1);
      const k = kickOut(next.multiballs + 2);
      next.x = k.x;
      next.y = k.y;
      next.vx = k.vx;
      next.vy = k.vy;
      next.still = 0;
      next.ride = 0;
      next.rideT = 0;
    } else {
      next.live = 0;
      next.lost += 1;
      next.vx = 0;
      next.vy = 0;
      const lane = p4BallInLane();
      next.x = lane.x;
      next.y = lane.y;
      next.wait = P4_RELAUNCH;
      next.still = 0;
      next.ride = 0;
      next.rideT = 0;
      // A drained ball takes its bonuses with it (pinRev 1's rule): the multiplier, dropped targets, the lit
      // spinner and the ramp combo. Lit letters and locked balls carry over to the next ball.
      next.mult = 1;
      next.targets = 0;
      next.bankUp = 0;
      next.spinLit = 0;
      next.combo = 0;
      next.mbUntil = Math.min(next.mbUntil, tick);
      if (next.lost >= PIN_BALLS) next.endedTick = tick;
    }
  }
  if (tick >= p4RunTicks(next) && next.endedTick === 0) next.endedTick = tick;
  return next;
}

/** One ball's tick: a ramp ride, or physics, a lock or a ramp entry, and the stuck rescue. */
function stepBall(s: Pin4State, b: P4Ball, flipsFrom: number[], isMain: boolean): void {
  if (b.ride === P4_RAIL) {
    b.rideT += 1;
    if (b.rideT >= p4RailTicks(s.railX)) {
      b.x = s.railX * FP;
      b.y = P4_RAIL_DROP_Y * FP;
      b.vx = 0;
      b.vy = 192;
      b.ride = 0;
      b.rideT = 0;
    }
    return;
  }
  if (b.ride > P4_RIDE_LOCK) {
    b.rideT += 1;
    if (b.rideT >= P4_LOCK_RIDE_TICKS) {
      b.ride = 0;
      b.rideT = 0;
      b.x = P4_LOCK_X * FP;
      b.y = P4_LOCK_Y * FP;
      if (lockBall(s, b, isMain) && !isMain) b.y = -FP * 1000;
    }
    return;
  }
  if (b.ride) {
    b.rideT += 1;
    if (b.rideT >= P4_RAMP_TICKS) endRide(s, b);
    return;
  }
  const ev: BallEvents = { ramp: 0, rail: false };
  simulateBall(s, b, flipsFrom, ev);
  if (ev.rail) {
    b.ride = P4_RAIL;
    b.rideT = 0;
    b.vx = 0;
    b.vy = 0;
    if (isMain) s.railX = p4PlungeX(s.power);
    return;
  }
  if (ev.ramp) {
    startRide(s, b, ev.ramp);
    return;
  }
  const slow = Math.abs(b.vx) + Math.abs(b.vy) < 40 && b.y < (560 + P4_SHIFT) * FP;
  b.still = slow ? b.still + 1 : 0;
  if (b.still >= 150) {
    b.vx = s.tick % 2 === 0 ? 384 : -384;
    b.vy = -256;
    b.still = 0;
  }
}

/** Equal-mass ball contacts: overlapping balls are pushed apart and swap the parts of their velocity along the line between them. */
function collideBalls(s: Pin4State): void {
  const balls: P4Ball[] = [];
  if (s.live && !s.ride) balls.push(mainBall(s));
  for (const b of s.extras) if (!b.ride && b.y > 0) balls.push(b);
  const rr = 2 * R;
  for (let i = 0; i < balls.length; i++)
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i]!, b = balls[j]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) >= rr || Math.abs(dy) >= rr) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const [nx, ny] = d2 === 0 ? [0, N_ONE] : unit(dx, dy);
      const d = isqrt(d2);
      const push = Math.trunc((rr - d) / 2) + 1;
      a.x -= Math.trunc((nx * push) / N_ONE);
      a.y -= Math.trunc((ny * push) / N_ONE);
      b.x += Math.trunc((nx * push) / N_ONE);
      b.y += Math.trunc((ny * push) / N_ONE);
      const va = Math.trunc((a.vx * nx + a.vy * ny) / N_ONE);
      const vb = Math.trunc((b.vx * nx + b.vy * ny) / N_ONE);
      if (va - vb <= 0) continue;
      const dv = va - vb;
      a.vx -= Math.trunc((dv * nx) / N_ONE);
      a.vy -= Math.trunc((dv * ny) / N_ONE);
      b.vx += Math.trunc((dv * nx) / N_ONE);
      b.vy += Math.trunc((dv * ny) / N_ONE);
    }
}

/* ============================== Scoring ============================== */

/**
 * pinRev 4's curve to 200 over table points (multiplier included): fitted on the skill-band bots
 * (scripts/e4-bands.ts) so each level up to great lands near its pinRev 3 score and only strong use of the
 * ramps, multiball, J-O-U-L-Z and the skill shot climbs to 190–200. Merge retune (26 Oct 2026; the stamp is not
 * live): the top flattened so near-perfect's top 10 % stays under about 185, on the tuning and 200 fresh seeds.
 */
export const PIN_V4_BAND_CURVE = bandCurve([0, 14200, 25000, 37700, 52400, 105000, 140000], [0, 69, 98, 119, 168, 185, 200]);
/** pinRev 4's top score (its ROUND_MAX line, roundMax.ts). */
export const PIN_V4_MAX = 200;

export function pinball4BandParts(state: Pin4State): BandParts {
  const units = Math.max(0, state.points);
  return {
    units,
    points: bandPoints(PIN_V4_BAND_CURVE, units),
    bonus: 0,
    penalty: 0,
    finished: false,
    text: `${units.toLocaleString("en-GB")} table points`,
  };
}

function scoreBand(state: Pin4State): number {
  return bandTotal(pinball4BandParts(state), Boolean(state.acted), PIN_V4_MAX);
}

/* ============================= Checkpoints ============================= */

/** pinRev 1's checkpoint fields, with the expansion's state folded into the checksum after them. */
export function pin4Checkpoint(state: Pin4State) {
  const snapshot = {
    tick: state.tick,
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    points: state.points,
    lost: state.lost,
    held: state.held,
    left: state.flips[0] ?? 0,
    right: state.flips[1] ?? 0,
    lanes: state.lanes,
    targets: state.targets,
    mult: state.mult,
  };
  let checksum = 0x811c9dc5;
  const values = [
    ...Object.values(snapshot),
    state.live, state.wait, state.launched, state.bankUp, state.spinLit, state.bumps, state.slings, state.drops, state.spins, state.acted ?? 0,
    state.rev4, state.ride, state.rideT, state.charge, state.power, state.skills, state.joulz, state.ramps, state.combo, state.locks, state.locked,
    state.multiballs, state.mbUntil, state.jackpots, state.lockLit, state.locksMade, state.railX, state.extras.length,
    ...state.extras.flatMap((b) => [b.x, b.y, b.vx, b.vy, b.ride, b.rideT]),
    ...state.releases,
    // pinRev 5 folds its flag in last, so pinRev 4's checksum is unchanged.
    ...(state.rev5 ? [state.rev5] : []),
    // pinRev 6 folds its flag and combo count in after it, so pinRev 5's checksum is unchanged.
    ...(state.rev6 ? [state.rev6, state.combos ?? 0] : []),
  ];
  for (const value of values) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Game ================================= */

/** Plain fallback drawing (the art lives in pinball4.renderer.ts). */
function draw(ctx: CanvasRenderingContext2D, state: Pin4State, size: CanvasSize): void {
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.scale(size.width / P4_WORLD_W, size.height / P4_WORLD_H);
  ctx.strokeStyle = "#3DFFE0";
  ctx.lineCap = "round";
  for (const seg of P4_SEGS) {
    ctx.lineWidth = seg.r * 2;
    ctx.beginPath();
    ctx.moveTo(seg.a[0], seg.a[1]);
    ctx.lineTo(seg.b[0], seg.b[1]);
    ctx.stroke();
  }
  ctx.fillStyle = "#F4FFF8";
  for (const b of [state, ...state.extras]) {
    ctx.beginPath();
    ctx.arc(b.x / FP, b.y / FP, PIN_BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The pinRev 4 game: band-stamped (band 3, `acted`), scored to 200 on PIN_V4_BAND_CURVE. */
export const pinball4Game: ArcadeGame<Pin4State, ArcadeInputEvent | null> = {
  key: "pinball",
  runTicks: PIN_RUN_TICKS,
  init: (seed) => ({ ...bandInit(init(seed)), band: 3 }),
  step: bandStep(step),
  isOver: p4IsOver,
  score: scoreBand,
  draw,
  inputRanges: PIN_INPUT_RANGES,
};

/* ========================= The 90-second table ========================= */

/**
 * pinRev 5's curve over table points: pinRev 4's shape with the units stretched for the extra 30 s (the
 * skill-band bots make about 1.9 times the table points in 90 s), fitted with scripts/pinball-90-bands.ts on
 * room seeds 0–59 (docs/phone-notes-oct-2026/pinball.md) so every level's median lands where it did on
 * pinRev 4 (weak to elite within a few points) and only a near-flawless 90 s reaches 200.
 */
export const PIN_V5_BAND_CURVE = bandCurve([0, 27000, 47500, 80000, 104000, 140000, 266000], [0, 69, 98, 122, 168, 182, 200]);

export function pinball5BandParts(state: Pin4State): BandParts {
  const units = Math.max(0, state.points);
  return {
    units,
    points: bandPoints(PIN_V5_BAND_CURVE, units),
    bonus: 0,
    penalty: 0,
    finished: false,
    text: `${units.toLocaleString("en-GB")} table points`,
  };
}

/** The pinRev 5 game: pinRev 4's table and play for 90 s, scored to 200 on PIN_V5_BAND_CURVE. */
export const pinball5Game: ArcadeGame<Pin4State, ArcadeInputEvent | null> = {
  ...pinball4Game,
  runTicks: PIN_V5_RUN_TICKS,
  init: (seed) => ({ ...bandInit(init(seed)), band: 3, rev5: 1 }),
  score: (state) => bandTotal(pinball5BandParts(state), Boolean(state.acted), PIN_V4_MAX),
};

/* ================= The arcade scoring standard (pinRev 6) ================= */

/**
 * pinRev 6 (29 Oct 2026, docs/arcade-standard/pinball.md): pinRev 5's table and 90 s play, scored on the arcade
 * scoring standard (arcadeStandard.ts). Table points no longer carry a multiplier (it stays x1) and a back-to-back
 * ramp shot adds a flat P4_PTS_COMBO, so the table's points are a straight count of what the ball did; the core pays
 * them on a straight line, full at the skill-band tool's near-perfect median (PIN_V6_FULL_AT). The features pay fixed
 * amounts on top: J-O-U-L-Z completed 10 each (up to 2), multiball started 20, jackpots 5 each (up to 3) and ramp
 * combos 5 each (up to 3). Every feature also scores its table points, so earning one never costs core points.
 */
export const PIN_V6_FULL_AT = 61000;
export const PIN_V6_CORE_MAX = 130;
export const PIN_V6_JOULZ_EACH = 10;
export const PIN_V6_JOULZ_MAX = 20;
export const PIN_V6_MULTIBALL = 20;
export const PIN_V6_JACKPOT_EACH = 5;
export const PIN_V6_JACKPOT_MAX = 15;
export const PIN_V6_COMBO_EACH = 5;
export const PIN_V6_COMBO_MAX = 15;
/** The core's straight line (the help and arcade-help-bands-check read it): 0 to 130 at PIN_V6_FULL_AT table points. */
export const PIN_V6_BAND_CURVE = bandCurve([0, PIN_V6_FULL_AT], [0, PIN_V6_CORE_MAX]);

const fmt = (n: number) => n.toLocaleString("en-GB");

export const PIN_STD_SPEC: StdSpec = {
  field: "pinRev",
  rev: PIN_REV_STD,
  parts: [
    { key: "core", label: "Table points", max: PIN_V6_CORE_MAX, how: `a straight line, full at ${fmt(PIN_V6_FULL_AT)}` },
    { key: "joulz", label: "J-O-U-L-Z", max: PIN_V6_JOULZ_MAX, how: `${PIN_V6_JOULZ_EACH} for each set of all five letters, up to ${PIN_V6_JOULZ_MAX / PIN_V6_JOULZ_EACH}` },
    { key: "multiball", label: "Multiball", max: PIN_V6_MULTIBALL, how: "once multiball has started" },
    { key: "jackpots", label: "Jackpots", max: PIN_V6_JACKPOT_MAX, how: `${PIN_V6_JACKPOT_EACH} each, up to ${PIN_V6_JACKPOT_MAX / PIN_V6_JACKPOT_EACH}` },
    { key: "combos", label: "Ramp combos", max: PIN_V6_COMBO_MAX, how: `${PIN_V6_COMBO_EACH} for each ramp shot back to back, up to ${PIN_V6_COMBO_MAX / PIN_V6_COMBO_EACH}` },
  ],
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** pinRev 6's parts (null on any earlier revision). */
export function pinballStdParts(state: Pin4State): StdPart[] | null {
  if (!state || !state.rev6) return null;
  const points = Math.max(0, state.points);
  const combos = state.combos ?? 0;
  return [
    stdPart(PIN_STD_SPEC, "core", stdLinear(points, PIN_V6_FULL_AT, PIN_V6_CORE_MAX), `${fmt(points)} table points`),
    stdPart(PIN_STD_SPEC, "joulz", stdEach(state.laneSets, PIN_V6_JOULZ_EACH, PIN_V6_JOULZ_MAX), plural(state.laneSets, "set", "sets")),
    stdPart(PIN_STD_SPEC, "multiball", state.multiballs > 0 ? PIN_V6_MULTIBALL : 0, state.multiballs > 0 ? plural(state.multiballs, "multiball", "multiballs") : "not started"),
    stdPart(PIN_STD_SPEC, "jackpots", stdEach(state.jackpots, PIN_V6_JACKPOT_EACH, PIN_V6_JACKPOT_MAX), plural(state.jackpots, "jackpot", "jackpots")),
    stdPart(PIN_STD_SPEC, "combos", stdEach(combos, PIN_V6_COMBO_EACH, PIN_V6_COMBO_MAX), plural(combos, "combo", "combos")),
  ];
}

/** pinRev 6 for the skill-band tool: units the table points, points the core, bonus the features. */
export function pinball6BandParts(state: Pin4State): BandParts {
  const parts = pinballStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  const units = Math.max(0, state.points);
  return { units, points: core, bonus: stdSum(parts) - core, penalty: 0, finished: false, text: `${fmt(units)} table points` };
}

/** The pinRev 6 game: pinRev 5's table and play for 90 s, scored on the standard (0 with no input, else 1 to 200). */
export const pinball6Game: ArcadeGame<Pin4State, ArcadeInputEvent | null> = {
  ...pinball5Game,
  init: (seed) => ({ ...bandInit(init(seed)), band: 3, rev5: 1, rev6: 1, combos: 0 }),
  score: (state) => stdScore(pinballStdParts(state) ?? [], Boolean(state.acted)),
};

/** Max speed note for the reveal and checks: the cap is pinRev 1's. */
export const P4_MAX_SPEED = PIN_MAX_SPEED;

/* ============================ Any revision ============================ */

/** The game for any stored pinRev: pinRev 6 the standard, pinRev 5 the 90-second table, pinRev 4 this table, anything else pinball.ts's (pinballGameFor). */
export function pinballGameForAny(rev?: number | null): ArcadeGame<PinState, ArcadeInputEvent | null> {
  if (rev === PIN_REV_STD) return pinball6Game as unknown as ArcadeGame<PinState, ArcadeInputEvent | null>;
  if (rev === PIN_REV_LONG) return pinball5Game as unknown as ArcadeGame<PinState, ArcadeInputEvent | null>;
  return rev === PIN_REV_EXPAND ? (pinball4Game as unknown as ArcadeGame<PinState, ArcadeInputEvent | null>) : pinballGameFor(rev);
}

/** A checkpoint for any revision's state (pinRev 4 folds its own fields into the checksum). */
export function pinCheckpointAny(state: PinState): PinCheckpoint {
  return (state as Partial<Pin4State>).rev4 ? pin4Checkpoint(state as Pin4State) : pinCheckpoint(state);
}
