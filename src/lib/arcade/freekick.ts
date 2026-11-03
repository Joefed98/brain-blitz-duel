/**
 * Free Kick (`freekick`, freekickRev 1, Oct 2026): ten free kicks in 75 seconds, on the arcade scoring standard.
 *
 * The whole run is dealt at init from the seed (fkSeedPlan): every kick's spot (distance and angle to goal), the
 * wall (3–5 players and where it stands), the keeper's starting place, the wind, and the four targets. The player
 * draws a stroke through the ball; on release the phone records ONE event (kind FREEKICK_INPUT_KICK): `a` = aim (the
 * launch yaw in milliradians off the line from the ball to the goal's centre, + to the right), `b` = curl (−100…100,
 * + bends to the right), `c` = power (0…1000: launch speed and loft rise together, so power sets how high the ball
 * arrives). The stroke's speed is measured on the phone; only these integers are replayed.
 *
 * World units: 1/65536 m (FK_M per metre), velocities per tick, 60 ticks a second. x across (goal centre 0, + right
 * as the camera sees it), y up (ground 0), z toward the goal (goal line front at z 0, the ball at −distance).
 * Integer maths only: products stay far under 2^53 and every division is truncated, so phone and server agree.
 *
 * Ball flight: gravity, air drag, Magnus curl (acceleration b × the velocity turned a quarter, so the curl bends the
 * path sideways), wind across the pitch, the wall (one box per player, shoulder to shoulder, jumping on a fixed
 * schedule after the kick), the keeper (reacts a fixed time after the ball passes the wall, then dives toward the
 * straight-line prediction of the ball from the sim's own state, at a fixed top speed; saves inside a fixed reach
 * ellipse), the posts and crossbar (cylinders, sub-stepped, deterministic bounce), the net.
 *
 * Score (FREEKICK_STD_SPEC, 200): core 130 = per goal 10 + up to 3 for placement away from the keeper (straight line
 * on the distance from where the ball crosses the goal plane to the keeper's body centre at that moment, full at
 * FREEKICK_PLACE_FULL_CM); targets 40 (10 for each of the 4 seeded targets hit); round the wall 20 (2 per goal that
 * bends round the wall, FREEKICK_CURL_MIN); five in a row 10 (five consecutive goals at any point). No speed part.
 */
import { clampInt, inputRange, isqrt, rngBelow, type ArcadeGame, type ArcadeInputEvent, type CanvasSize, type InputRange } from "./engine";
import { bandCurve, type BandParts } from "./scoreBands";
import { stdEach, stdLine, stdPart, stdScore, stdSum, type StdPart, type StdSpec } from "./arcadeStandard";

/* ================================ Constants ================================ */

export const FREEKICK_REV_STD = 1;
/**
 * freekickRev 2 (Top Bins, 31 Oct 2026; docs/arcade-standard/freekick.md "freekickRev 2"): no wind; each kick's spot
 * seeded 18–32 yards from the goal's centre at up to 35° either side; the wall (3–5) and the keeper set for the spot.
 * The flight, the keeper's reactions and the scoring are rev 1's.
 */
export const FREEKICK_REV_2 = 2;
/**
 * freekickRev 3 (Top Bins, 1 Nov 2026; docs/arcade-standard/freekick.md "freekickRev 3"): the shot is prepared in
 * three steps instead of one drawn stroke: tap the goal to aim (FREEKICK_INPUT_AIM: the target point on the goal
 * plane), drag to set the curl (FREEKICK_INPUT_CURL), then a power meter (FREEKICK_INPUT_POWER starts it,
 * FREEKICK_INPUT_STRIKE strikes): released inside the sweet zone the ball flies to the target with that curl; past the
 * zone it rises over (too much) or comes in low and slow (too little), by how far off. Spots, walls, keeper and flight
 * are rev 2's; a 90 s run (ten 540-tick slots) so there is time to set each shot; the core is full at
 * FREEKICK_V3_CORE_FULL.
 */
export const FREEKICK_REV_3 = 3;
/**
 * freekickRev 4 (Top Bins, 3 Nov 2026; docs/arcade-standard/freekick.md "freekickRev 4"): the shot is drawn: one stroke
 * out from the ball sets the target (where it ends) and the curl (how it bends), sent as one FREEKICK_INPUT_SHOT; then
 * rev 3's power meter. A goal from a strongly bent shot (|curl| ≥ FK_V4_BENT) pays the Curl bonus; the corner targets'
 * hoops shrink kick by kick to 70 % (fkHoopRFor). Spots, walls, keeper, solver, meter and the 90 s run are rev 3's.
 */
export const FREEKICK_REV_4 = 4;
/** The revision rooms deal. */
export const FREEKICK_REV_DEALT = FREEKICK_REV_4;
export const FREEKICK_RUN_SECONDS = 75;
export const FREEKICK_RUN_TICKS = FREEKICK_RUN_SECONDS * 60;
export const FREEKICK_KICKS = 10;

/** The world in CSS px (the renderer's 2.5-D view; the sim itself is in metres). */
export const FREEKICK_WORLD_W = 390;
export const FREEKICK_WORLD_H = 720;
export const FREEKICK_BG = "#05070B";

/** Fixed-point units per metre. */
export const FK_M = 65536;
const m = (metres: number) => Math.round(metres * FK_M);

export const FREEKICK_INPUT_KICK = 1;
export const FREEKICK_AIM_MAX = 500;
export const FREEKICK_CURL_MAX = 100;
export const FREEKICK_POWER_MAX = 1000;
export const FREEKICK_INPUT_RANGES: readonly InputRange[] = [
  inputRange(FREEKICK_INPUT_KICK, [-FREEKICK_AIM_MAX, FREEKICK_AIM_MAX], [-FREEKICK_CURL_MAX, FREEKICK_CURL_MAX], [0, FREEKICK_POWER_MAX]),
];

/**
 * freekickRev 3's inputs (older revisions have no range for them, so they are never recorded or replayed there):
 * AIM a = the target's x on the goal plane in cm (+ right), b = its height in cm; CURL b = the curl (−100…100, + bends
 * to the right); POWER starts the meter; STRIKE takes the kick with the meter where it is on that tick.
 */
export const FREEKICK_INPUT_AIM = 2;
export const FREEKICK_INPUT_CURL = 3;
export const FREEKICK_INPUT_POWER = 4;
export const FREEKICK_INPUT_STRIKE = 5;
/** The target (the ball's centre on the goal plane) stays on the frame: out to the posts' and the bar's centres, up from the grass. */
export const FK_V3_AIM_X_MAX = 372;
export const FK_V3_AIM_Y_MIN = 11;
export const FK_V3_AIM_Y_MAX = 250;
export const FREEKICK_INPUT_RANGES_V3: readonly InputRange[] = [
  inputRange(FREEKICK_INPUT_AIM, [-FK_V3_AIM_X_MAX, FK_V3_AIM_X_MAX], [FK_V3_AIM_Y_MIN, FK_V3_AIM_Y_MAX]),
  inputRange(FREEKICK_INPUT_CURL, [0, 0], [-FREEKICK_CURL_MAX, FREEKICK_CURL_MAX]),
  inputRange(FREEKICK_INPUT_POWER),
  inputRange(FREEKICK_INPUT_STRIKE),
];
/**
 * freekickRev 4's inputs: SHOT a = the target's x (cm), b = its height (cm), c = the curl (−100…100, + bends right), all
 * from one drawn stroke; then POWER and STRIKE as rev 3. Rev 4 has no range for AIM or CURL (kinds 2, 3), and earlier
 * revisions none for SHOT.
 */
export const FREEKICK_INPUT_SHOT = 6;
export const FREEKICK_INPUT_RANGES_V4: readonly InputRange[] = [
  inputRange(FREEKICK_INPUT_POWER),
  inputRange(FREEKICK_INPUT_STRIKE),
  inputRange(FREEKICK_INPUT_SHOT, [-FK_V3_AIM_X_MAX, FK_V3_AIM_X_MAX], [FK_V3_AIM_Y_MIN, FK_V3_AIM_Y_MAX], [-FREEKICK_CURL_MAX, FREEKICK_CURL_MAX]),
];
/** freekickRev 4: a goal whose shot was drawn with at least this much bend (|curl|) pays the Curl bonus. */
export const FK_V4_BENT = 70;
/** freekickRev 4: the corner hoop's radius on the last kick, per mille of its first (a straight line between). */
export const FK_V4_HOOP_LAST_PERMILLE = 700;
/**
 * The power meter (freekickRev 3): from the POWER tick it sweeps 0 → 1000 → 0 every FK_V3_METER_PERIOD ticks (a
 * triangle, a function of the ticks since it started alone, so the replay recomputes it from the STRIKE's tick). The
 * sweet zone is FK_V3_ZONE_LO…FK_V3_ZONE_HI. Past it by e units: too much adds e × FK_V3_OVER_VY to the launch's rise
 * (the ball arrives higher, over the bar), too little scales the whole launch down by e × FK_V3_UNDER_PERMILLE ‰
 * (lower and slower, so the keeper has longer).
 */
export const FK_V3_METER_PERIOD = 96;
export const FK_V3_ZONE_LO = 720;
export const FK_V3_ZONE_HI = 800;
export const FK_V3_OVER_VY = 20;
export const FK_V3_UNDER_PERMILLE = 4;
/** freekickRev 3's run: 90 s, ten 540-tick slots (kick k by 540k + 360). */
export const FREEKICK_V3_RUN_SECONDS = 90;
export const FREEKICK_V3_RUN_TICKS = FREEKICK_V3_RUN_SECONDS * 60;
export const FREEKICK_V3_SLOT = 540;

/** Phases of a kick. */
export const FK_SETUP = 0;
export const FK_AIM = 1;
export const FK_FLIGHT = 2;
export const FK_SETTLE = 3;
export const FK_OVER = 4;

/** Whistle and camera settle before a kick can be taken. */
export const FREEKICK_SETUP_TICKS = 30;
/** The longest a flight runs before it is judged short. */
export const FREEKICK_FLIGHT_MAX = 110;
/** Settle after the outcome (the ball plays on, the result shows) before the next kick. */
export const FREEKICK_SETTLE_TICKS = 70;
/** Each kick has its own 450-tick slot; kick k must be taken by FREEKICK_SLOT × k + this, so all ten fit in 75 s. */
export const FREEKICK_SLOT = 450;
export const FREEKICK_DEADLINE_IN_SLOT = FREEKICK_SLOT - FREEKICK_FLIGHT_MAX - FREEKICK_SETTLE_TICKS;

/** Outcomes. */
export const FK_OUT_NONE = 0;
export const FK_OUT_GOAL = 1;
export const FK_OUT_SAVED = 2;
export const FK_OUT_WALL = 3;
export const FK_OUT_WIDE = 4;
export const FK_OUT_SHORT = 5;
export const FK_OUT_UNTAKEN = 6;

/* Pitch geometry (metres as fixed point). */
export const FK_BALL_R = m(0.11);
export const FK_GOAL_HALF_W = m(3.66);
export const FK_GOAL_H = m(2.44);
export const FK_POST_R = m(0.06);
/** Post and bar centres: just behind the line's front. */
export const FK_POST_X = FK_GOAL_HALF_W + FK_POST_R;
export const FK_POST_Z = FK_POST_R;
export const FK_BAR_Y = FK_GOAL_H + FK_POST_R;
/** The goal plane: the whole ball over the line. */
export const FK_GOAL_Z = 2 * FK_POST_R + FK_BALL_R;
export const FK_NET_Z = m(2.0);

/** The wall: 9.15 m from the ball, players 0.55 m apart shoulder to shoulder, 1.85 m tall, jumping 0.18 m. */
export const FK_WALL_DIST = m(9.15);
export const FK_WALL_SPACING = m(0.55);
export const FK_WALL_H = m(1.85);
export const FK_WALL_JUMP = m(0.18);
export const FK_WALL_JUMP_FROM = 6;
export const FK_WALL_JUMP_PEAK = 18;
export const FK_WALL_JUMP_TO = 30;

/** The keeper: stands 0.4 m off the line; body centre 1.0 m high; reach ellipse 0.95 m across, 1.35 m up (plus the ball). */
export const FK_KEEPER_Z = -m(0.4);
export const FK_KEEPER_Y = m(1.0);
export const FK_KEEPER_AX_CM = 95 + 11;
export const FK_KEEPER_AY_CM = 135 + 11;
/** Reaction: this many ticks after the ball passes the wall's line. */
export const FK_KEEPER_REACT = 10;
export const FK_KEEPER_VMAX = m(0.085);
export const FK_KEEPER_ACC = m(0.008);
export const FK_KEEPER_LIMIT = m(3.3);

/** Physics. */
const G = 179; // 9.81 m/s² in units a tick²
const DRAG = 230;
const CURL_DIV = 16000;
const WIND_K = 6;
const SPEED_MIN = Math.round((14 * FK_M) / 60);
const SPEED_SPAN = Math.round((18 * FK_M) / 60);
const ELEV_MIN_MRAD = 209;
const ELEV_SPAN_MRAD = 175;
const RESTITUTION_256 = 140;
const SUBSTEPS = 6;

/** Targets: a hoop in a top corner (radius 0.55 m, centred 0.55 m in from the post and the bar) or the crossbar. */
export const FK_TARGET_NONE = 0;
export const FK_TARGET_LEFT = 1;
export const FK_TARGET_RIGHT = 2;
export const FK_TARGET_BAR = 3;
export const FK_HOOP_R = m(0.55);
export const FK_HOOP_X = FK_GOAL_HALF_W - FK_HOOP_R;
export const FK_HOOP_Y = FK_GOAL_H - FK_HOOP_R;
export const FREEKICK_TARGETS = 4;

/* ================================ Scoring ================================ */

/** Placement is full when the ball crosses the goal plane this far (cm) from the keeper's body centre. */
export const FREEKICK_PLACE_FULL_CM = 150;
/** Round the wall: the curl alone moved the ball at least this far back across the line of the kick. */
export const FREEKICK_CURL_MIN = m(0.75);
export const FREEKICK_CORE_MAX = 130;
export const FREEKICK_GOAL_UNITS = 100;
export const FREEKICK_PLACE_UNITS = 30;
/** Core units: 100 a goal + 0…30 for placement; full at 1300 (every kick a goal, every one placed in full). */
export const FREEKICK_CORE_FULL = FREEKICK_KICKS * (FREEKICK_GOAL_UNITS + FREEKICK_PLACE_UNITS);
export const FREEKICK_TARGETS_MAX = 40;
export const FREEKICK_CURL_MAX_PTS = 20;
export const FREEKICK_STREAK_MAX = 10;
export const FREEKICK_STREAK_RUN = 5;
export const FREEKICK_V1_BAND_CURVE = bandCurve([0, FREEKICK_CORE_FULL], [0, FREEKICK_CORE_MAX]);

export const FREEKICK_STD_SPEC: StdSpec = {
  field: "freekickRev",
  rev: FREEKICK_REV_STD,
  parts: [
    { key: "core", label: "Goals", max: FREEKICK_CORE_MAX, of: FREEKICK_KICKS, item: "goal", how: `10 a goal plus up to 3 for placing it away from the keeper (full at ${FREEKICK_PLACE_FULL_CM / 100} m)` },
    { key: "targets", label: "Targets", max: FREEKICK_TARGETS_MAX, of: FREEKICK_TARGETS, item: "target", how: `10 for each of the ${FREEKICK_TARGETS} targets scored through` },
    { key: "curl", label: "Round the wall", max: FREEKICK_CURL_MAX_PTS, of: FREEKICK_KICKS, item: "curler", how: "2 for each goal curled round the end of the wall" },
    { key: "streak", label: "Five in a row", max: FREEKICK_STREAK_MAX, of: 1, item: "streak", how: "10 for five goals in a row" },
  ],
};

/** freekickRev 2's spec: rev 1's parts exactly, on its own stamp. */
export const FREEKICK_V2_STD_SPEC: StdSpec = { ...FREEKICK_STD_SPEC, rev: FREEKICK_REV_2 };
export const FREEKICK_V2_BAND_CURVE = bandCurve([0, FREEKICK_CORE_FULL], [0, FREEKICK_CORE_MAX]);

/**
 * freekickRev 3's core: the same units (100 a goal + up to 30 for placement), full at FREEKICK_V3_CORE_FULL (re-fitted
 * to the prepared shot, docs/arcade-standard/freekick.md "freekickRev 3"); the other parts are rev 1's.
 */
export const FREEKICK_V3_CORE_FULL = 1100;
export const FREEKICK_V3_STD_SPEC: StdSpec = {
  ...FREEKICK_STD_SPEC,
  rev: FREEKICK_REV_3,
  parts: FREEKICK_STD_SPEC.parts.map((p) => (p.key === "core" ? { ...p, how: `10 a goal plus up to 3 for placing it away from the keeper (full at ${FREEKICK_PLACE_FULL_CM / 100} m); the part is full at ${FREEKICK_V3_CORE_FULL / 10}` } : p)),
};
export const FREEKICK_V3_BAND_CURVE = bandCurve([0, FREEKICK_V3_CORE_FULL], [0, FREEKICK_CORE_MAX]);

/**
 * freekickRev 4's parts (200): Goals 120 (the same units, full at FREEKICK_V4_CORE_FULL), Targets 40 (10 each), Round
 * the wall 10 (1 a goal), Curl bonus 20 (2 a goal from a shot bent at least FK_V4_BENT), Five in a row 10.
 */
export const FREEKICK_V4_CORE_MAX = 120;
export const FREEKICK_V4_CORE_FULL = 750;
export const FREEKICK_V4_WALL_MAX = 10;
export const FREEKICK_V4_BENT_MAX = 20;
export const FREEKICK_V4_STD_SPEC: StdSpec = {
  field: "freekickRev",
  rev: FREEKICK_REV_4,
  parts: [
    { key: "core", label: "Goals", max: FREEKICK_V4_CORE_MAX, of: FREEKICK_KICKS, item: "goal", how: `a goal plus a little for placing it away from the keeper (full at ${FREEKICK_PLACE_FULL_CM / 100} m); the part is full at ${FREEKICK_V4_CORE_FULL / 10}` },
    { key: "targets", label: "Targets", max: FREEKICK_TARGETS_MAX, of: FREEKICK_TARGETS, item: "target", how: `10 for each of the ${FREEKICK_TARGETS} targets scored through (the corner hoops shrink kick by kick)` },
    { key: "curl", label: "Round the wall", max: FREEKICK_V4_WALL_MAX, of: FREEKICK_KICKS, item: "curler", how: "1 for each goal curled round the end of the wall" },
    { key: "bent", label: "Curl bonus", max: FREEKICK_V4_BENT_MAX, of: FREEKICK_KICKS, item: "bender", how: "2 for each goal from a strongly bent shot" },
    { key: "streak", label: "Five in a row", max: FREEKICK_STREAK_MAX, of: 1, item: "streak", how: "10 for five goals in a row" },
  ],
};
export const FREEKICK_V4_BAND_CURVE = bandCurve([0, FREEKICK_V4_CORE_FULL], [0, FREEKICK_V4_CORE_MAX]);

/** A corner hoop's radius (world units) on kick `k` (0…9): rev 1–3 the full FK_HOOP_R; rev 4 down to 70 % by the last. */
export function fkHoopRFor(rev: number, k: number): number {
  if (rev < FREEKICK_REV_4) return FK_HOOP_R;
  const kk = Math.max(0, Math.min(FREEKICK_KICKS - 1, k));
  const permille = 1000 - Math.trunc(((1000 - FK_V4_HOOP_LAST_PERMILLE) * kk) / (FREEKICK_KICKS - 1));
  return Math.trunc((FK_HOOP_R * permille) / 1000);
}

/* ================================ The deal ================================ */

export interface FkKick {
  /** Ball spot (x across, z = −distance). */
  bx: number;
  bz: number;
  /** Unit vector from the ball to the goal's centre, in 4096ths (fx across, fz forward). */
  fx: number;
  fz: number;
  /** Wall: players, and its ends across the line of the kick (u, from the ball; + to the right). */
  wallN: number;
  wallL: number;
  wallR: number;
  /** −1: the wall covers the left post; +1 the right. */
  side: number;
  keeperX: number;
  /** −5…5, + blows to the right (always 0 on freekickRev 2). */
  wind: number;
  target: number;
  /** freekickRev 2 (display): the spot's distance in yards from the goal's centre and its angle in degrees (+ right). */
  yards?: number;
  degrees?: number;
}

export interface FkPlan {
  kicks: FkKick[];
}

function draw(rng: { s: number }, bound: number): number {
  const r = rngBelow(rng.s, bound);
  rng.s = r.state;
  return r.value;
}

/** The local frame of a kick: u across (to the right), w along the line from the ball to the goal centre. */
export function fkLocal(k: FkKick, x: number, z: number): { u: number; w: number } {
  const dx = x - k.bx;
  const dz = z - k.bz;
  return { u: Math.trunc((dx * k.fz - dz * k.fx) / 4096), w: Math.trunc((dx * k.fx + dz * k.fz) / 4096) };
}

/** World x, z from a kick's local u, w. */
export function fkWorld(k: FkKick, u: number, w: number): { x: number; z: number } {
  return { x: k.bx + Math.trunc((u * k.fz + w * k.fx) / 4096), z: k.bz + Math.trunc((-u * k.fx + w * k.fz) / 4096) };
}

function makeKick(rng: { s: number }, target: number): FkKick {
  const dist = m(17.5) + draw(rng, m(7.5));
  const maxX = Math.trunc((dist * 45) / 100);
  const bx = draw(rng, 2 * maxX + 1) - maxX;
  const bz = -dist;
  const dx = -bx;
  const dz = dist;
  const len = isqrt(dx * dx + dz * dz);
  const fx = Math.trunc((dx * 4096) / len);
  const fz = Math.trunc((dz * 4096) / len);
  const side = bx < -m(1.5) ? -1 : bx > m(1.5) ? 1 : draw(rng, 2) === 0 ? -1 : 1;
  const central = Math.abs(bx) < m(4) && dist < m(21);
  const wallN = 3 + draw(rng, central ? 3 : 2) + (central ? 0 : 0);
  const extra = m(0.15) + draw(rng, m(0.35));
  const post = { x: side * FK_GOAL_HALF_W, z: 0 };
  const kk: FkKick = { bx, bz, fx, fz, wallN, wallL: 0, wallR: 0, side, keeperX: 0, wind: 0, target };
  const p = fkLocal(kk, post.x, post.z);
  const uPost = Math.trunc((p.u * FK_WALL_DIST) / p.w);
  if (side < 0) {
    kk.wallL = uPost - extra;
    kk.wallR = kk.wallL + wallN * FK_WALL_SPACING;
  } else {
    kk.wallR = uPost + extra;
    kk.wallL = kk.wallR - wallN * FK_WALL_SPACING;
  }
  kk.keeperX = -side * (m(0.3) + draw(rng, m(0.9)));
  kk.wind = draw(rng, 11) - 5;
  return kk;
}

/** freekickRev 2's spot range: 18–32 yards from the goal's centre, up to 35° (611 mrad) either side. */
export const FK_V2_YARD = m(0.9144);
export const FK_V2_DIST_MIN = 18 * FK_V2_YARD;
export const FK_V2_DIST_MAX = 32 * FK_V2_YARD;
export const FK_V2_ANGLE_MAX = 611;
/** The keeper's start: this far beyond the bisector of the posts' angle, away from the wall (0.3–1.0 m), held to ±3 m. */
export const FK_V2_KEEPER_SHIFT_MIN = m(0.3);
export const FK_V2_KEEPER_SHIFT_SPAN = m(0.7);
export const FK_V2_KEEPER_START_MAX = m(3.0);

/**
 * A freekickRev 2 kick: the spot by distance and angle; the wall by the spot (4–5 for a central kick inside 25 yards,
 * 3 from a wide angle or beyond 30 yards, else 3–4), covering the near post as on rev 1; the keeper on the bisector of
 * the angle the posts make at the ball, stepped toward the far post. No wind.
 */
function makeKickV2(rng: { s: number }, target: number): FkKick {
  const dist = FK_V2_DIST_MIN + draw(rng, FK_V2_DIST_MAX - FK_V2_DIST_MIN + 1);
  const ang = draw(rng, 2 * FK_V2_ANGLE_MAX + 1) - FK_V2_ANGLE_MAX;
  const sc = fkSinCos(ang);
  const bx = Math.trunc((dist * sc.s) / 4096);
  const bz = -Math.trunc((dist * sc.c) / 4096);
  const len = isqrt(bx * bx + bz * bz);
  const fx = Math.trunc((-bx * 4096) / len);
  const fz = Math.trunc((-bz * 4096) / len);
  const side = bx < -m(1.5) ? -1 : bx > m(1.5) ? 1 : draw(rng, 2) === 0 ? -1 : 1;
  const central = Math.abs(ang) <= 210 && dist <= 25 * FK_V2_YARD;
  const wide = Math.abs(ang) >= 436 || dist >= 30 * FK_V2_YARD;
  const wallN = central ? 4 + draw(rng, 2) : wide ? 3 : 3 + draw(rng, 2);
  const extra = m(0.15) + draw(rng, m(0.35));
  const kk: FkKick = { bx, bz, fx, fz, wallN, wallL: 0, wallR: 0, side, keeperX: 0, wind: 0, target };
  const p = fkLocal(kk, side * FK_GOAL_HALF_W, 0);
  const uPost = Math.trunc((p.u * FK_WALL_DIST) / p.w);
  if (side < 0) {
    kk.wallL = uPost - extra;
    kk.wallR = kk.wallL + wallN * FK_WALL_SPACING;
  } else {
    kk.wallR = uPost + extra;
    kk.wallL = kk.wallR - wallN * FK_WALL_SPACING;
  }
  // The bisector meets the goal line where it splits the mouth in the ratio of the ball's distances to the posts.
  const dL = isqrt((bx + FK_GOAL_HALF_W) * (bx + FK_GOAL_HALF_W) + bz * bz);
  const dR = isqrt((bx - FK_GOAL_HALF_W) * (bx - FK_GOAL_HALF_W) + bz * bz);
  const xb = -FK_GOAL_HALF_W + Math.trunc((2 * FK_GOAL_HALF_W * dL) / (dL + dR));
  kk.keeperX = clampInt(xb - side * (FK_V2_KEEPER_SHIFT_MIN + draw(rng, FK_V2_KEEPER_SHIFT_SPAN)), -FK_V2_KEEPER_START_MAX, FK_V2_KEEPER_START_MAX);
  kk.yards = Math.round(dist / FK_V2_YARD);
  kk.degrees = Math.round((ang * 180) / 3141.59);
  return kk;
}

const planCache = new Map<number, FkPlan>();

/** The run's schedule from the seed (and the revision): identical for every player and the server. */
export function fkSeedPlan(seed: number, rev: number = FREEKICK_REV_STD): FkPlan {
  if (rev >= FREEKICK_REV_2) return fkSeedPlanV2(seed);
  const key = seed | 0;
  const hit = planCache.get(key);
  if (hit) return hit;
  const rng = { s: (key ^ 0x5f3d_9a17) | 0 };
  // The four target kicks (distinct) and their kinds.
  const order = Array.from({ length: FREEKICK_KICKS }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = draw(rng, i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const targets = new Array<number>(FREEKICK_KICKS).fill(FK_TARGET_NONE);
  // 2 of 3 targets are the top corner behind the wall's end (the classic free kick), 1 of 3 the crossbar.
  for (let i = 0; i < FREEKICK_TARGETS; i++) targets[order[i]!] = draw(rng, 3) === 0 ? FK_TARGET_BAR : FK_TARGET_LEFT;
  const kicks = targets.map((t) => {
    const kick = makeKick(rng, t);
    if (t === FK_TARGET_LEFT) kick.target = kick.side < 0 ? FK_TARGET_LEFT : FK_TARGET_RIGHT;
    return kick;
  });
  const plan = { kicks };
  if (planCache.size > 64) planCache.clear();
  planCache.set(key, plan);
  return plan;
}

const planCacheV2 = new Map<number, FkPlan>();

/** freekickRev 2's schedule: the targets as rev 1 (four kicks; two in three the corner behind the wall, else the bar). */
function fkSeedPlanV2(seed: number): FkPlan {
  const key = seed | 0;
  const hit = planCacheV2.get(key);
  if (hit) return hit;
  const rng = { s: (key ^ 0x2b7e_15a6) | 0 };
  const order = Array.from({ length: FREEKICK_KICKS }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = draw(rng, i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const targets = new Array<number>(FREEKICK_KICKS).fill(FK_TARGET_NONE);
  for (let i = 0; i < FREEKICK_TARGETS; i++) targets[order[i]!] = draw(rng, 3) === 0 ? FK_TARGET_BAR : FK_TARGET_LEFT;
  const kicks = targets.map((t) => {
    const kick = makeKickV2(rng, t);
    if (t === FK_TARGET_LEFT) kick.target = kick.side < 0 ? FK_TARGET_LEFT : FK_TARGET_RIGHT;
    return kick;
  });
  const plan = { kicks };
  if (planCacheV2.size > 64) planCacheV2.clear();
  planCacheV2.set(key, plan);
  return plan;
}

/* ================================ Flight ================================ */

export interface FkFlight {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Curl (the input's b). */
  b: number;
  /** Ticks since the kick. */
  t: number;
  /** The curl's own displacement across the line of the kick (velocity and distance). */
  cuv: number;
  cu: number;
  kx: number;
  kv: number;
  /** Tick (flight time) the keeper starts to move, or −1. */
  react: number;
  out: number;
  /** At the wall's line: 0 not yet, −1 beside its left end, 1 beside its right end, 2 over it, 3 blocked. */
  wallSide: number;
  crossX: number;
  crossY: number;
  crossK: number;
  /** Where the ball passed the keeper's line (x, y) and the keeper's x then: placement is measured here. */
  passX: number;
  passY: number;
  passK: number;
  bar: number;
  post: number;
}

/** Integer sine and cosine (4096ths) of an angle in milliradians, |angle| ≤ ~800. */
export function fkSinCos(mrad: number): { s: number; c: number } {
  const t = Math.trunc(mrad);
  const t2 = t * t; // ≤ 6.4e5
  // sin = t − t³/6 + t⁵/120 (t in 1/1000), scaled to 4096.
  const t3 = t2 * t;
  const t5 = t3 * t2;
  const s = Math.trunc((t * 4096) / 1000) - Math.trunc((t3 * 4096) / 6e9) + Math.trunc((t5 * 4096) / 1.2e17);
  const t4 = t2 * t2;
  const c = 4096 - Math.trunc((t2 * 4096) / 2e6) + Math.trunc((t4 * 4096) / 2.4e13);
  return { s, c };
}

/** The wall's jump height `t` ticks after the kick (fixed schedule). */
export function fkWallJump(t: number): number {
  if (t < FK_WALL_JUMP_FROM || t > FK_WALL_JUMP_TO) return 0;
  const half = FK_WALL_JUMP_PEAK - FK_WALL_JUMP_FROM;
  const d = t - FK_WALL_JUMP_PEAK;
  return Math.max(0, FK_WALL_JUMP - Math.trunc((FK_WALL_JUMP * d * d) / (half * half)));
}

/** The flight a kick's input launches (the ball on its spot, the keeper on his). */
export function fkLaunch(k: FkKick, a: number, b: number, c: number): FkFlight {
  const aim = clampInt(Math.trunc(a), -FREEKICK_AIM_MAX, FREEKICK_AIM_MAX);
  const curl = clampInt(Math.trunc(b), -FREEKICK_CURL_MAX, FREEKICK_CURL_MAX);
  const power = clampInt(Math.trunc(c), 0, FREEKICK_POWER_MAX);
  const speed = SPEED_MIN + Math.trunc((SPEED_SPAN * power) / 1000);
  const elev = fkSinCos(ELEV_MIN_MRAD + Math.trunc((ELEV_SPAN_MRAD * power) / 1000));
  const yaw = fkSinCos(aim);
  const dirX = Math.trunc((k.fx * yaw.c + k.fz * yaw.s) / 4096);
  const dirZ = Math.trunc((k.fz * yaw.c - k.fx * yaw.s) / 4096);
  const h = Math.trunc((speed * elev.c) / 4096);
  return {
    x: k.bx,
    y: FK_BALL_R,
    z: k.bz,
    vx: Math.trunc((h * dirX) / 4096),
    vy: Math.trunc((speed * elev.s) / 4096),
    vz: Math.trunc((h * dirZ) / 4096),
    b: curl,
    t: 0,
    cuv: 0,
    cu: 0,
    kx: k.keeperX,
    kv: 0,
    react: -1,
    out: FK_OUT_NONE,
    wallSide: 0,
    crossX: 0,
    crossY: 0,
    crossK: 0,
    passX: 0,
    passY: 0,
    passK: 0,
    bar: 0,
    post: 0,
  };
}

const cm = (units: number) => Math.trunc((units * 100) / FK_M);

/** Reflects the ball off a cylinder whose axis runs along one world axis (deterministic bounce). */
function bounce(f: FkFlight, axis: "x" | "y", ca: number, cb: number): boolean {
  // The cylinder's cross-section is in the plane of the other two axes: (p, q) = (y, z) for the bar, (x, z) for a post.
  const p = axis === "x" ? f.y : f.x;
  const dp = p - ca;
  const dq = f.z - cb;
  const reach = FK_BALL_R + FK_POST_R;
  const d2 = dp * dp + dq * dq;
  if (d2 >= reach * reach) return false;
  const len = Math.max(1, isqrt(d2));
  const vp = axis === "x" ? f.vy : f.vx;
  const vn = Math.trunc((vp * dp + f.vz * dq) / len);
  // Push the ball out to touching distance.
  const np = ca + Math.trunc((dp * reach) / len);
  const nq = cb + Math.trunc((dq * reach) / len);
  if (axis === "x") f.y = np;
  else f.x = np;
  f.z = nq;
  if (vn >= 0) return true;
  const j = Math.trunc((vn * (256 + RESTITUTION_256)) / 256);
  const nvp = vp - Math.trunc((j * dp) / len);
  f.vz -= Math.trunc((j * dq) / len);
  if (axis === "x") f.vy = nvp;
  else f.vx = nvp;
  return true;
}

/** One tick of a flight (mutates `f`; the sim steps a copy). */
export function fkFlightStep(k: FkKick, f: FkFlight, frame = true, ground = true): void {
  f.t += 1;
  const px = f.x;
  const py = f.y;
  const pz = f.z;
  // Forces: gravity, drag, Magnus curl (b × the velocity turned a quarter), wind across.
  const axc = Math.trunc((f.b * f.vz) / CURL_DIV);
  const azc = -Math.trunc((f.b * f.vx) / CURL_DIV);
  f.vx += axc + k.wind * WIND_K - Math.trunc(f.vx / DRAG);
  f.vz += azc - Math.trunc(f.vz / DRAG);
  f.vy += -G - Math.trunc(f.vy / DRAG);
  f.cuv += Math.trunc((axc * k.fz - azc * k.fx) / 4096);
  f.cu += f.cuv;
  // Move, sub-stepped near the goal frame so the posts and bar never tunnel.
  const near = f.z > -m(1.5) && f.z < m(1.0);
  const steps = near ? SUBSTEPS : 1;
  for (let i = 0; i < steps; i++) {
    const last = i === steps - 1;
    f.x += last ? f.vx - Math.trunc(f.vx / steps) * (steps - 1) : Math.trunc(f.vx / steps);
    f.y += last ? f.vy - Math.trunc(f.vy / steps) * (steps - 1) : Math.trunc(f.vy / steps);
    f.z += last ? f.vz - Math.trunc(f.vz / steps) * (steps - 1) : Math.trunc(f.vz / steps);
    if (frame && near && f.y < FK_BAR_Y + FK_BALL_R + FK_POST_R) {
      if (Math.abs(f.x) <= FK_POST_X && bounce(f, "x", FK_BAR_Y, FK_POST_Z)) f.bar = 1;
      if (f.y < FK_BAR_Y) {
        if (bounce(f, "y", FK_POST_X, FK_POST_Z)) f.post = 1;
        if (bounce(f, "y", -FK_POST_X, FK_POST_Z)) f.post = 1;
      }
    }
  }
  // Ground (a ghost flight, freekickRev 3's solver, flies through it: its height at the goal plane is then monotonic in power).
  if (ground && f.y < FK_BALL_R) {
    f.y = FK_BALL_R;
    f.vy = f.vy < -m(0.03) ? -Math.trunc(f.vy / 2) : 0;
    f.vx -= Math.trunc(f.vx / 12);
    f.vz -= Math.trunc(f.vz / 12);
  }
  // The wall: judged where the ball crosses its line.
  if (f.wallSide === 0) {
    const a = fkLocal(k, px, pz);
    const bl = fkLocal(k, f.x, f.z);
    if (a.w < FK_WALL_DIST && bl.w >= FK_WALL_DIST) {
      const span = bl.w - a.w;
      const u = a.u + Math.trunc(((bl.u - a.u) * (FK_WALL_DIST - a.w)) / Math.max(1, span));
      const y = py + Math.trunc(((f.y - py) * (FK_WALL_DIST - a.w)) / Math.max(1, span));
      const top = FK_WALL_H + fkWallJump(f.t);
      if (f.out === FK_OUT_NONE && u > k.wallL - FK_BALL_R && u < k.wallR + FK_BALL_R && y < top + FK_BALL_R) {
        f.wallSide = 3;
        f.out = FK_OUT_WALL;
        const back = fkWorld(k, u, FK_WALL_DIST - m(0.3));
        f.x = back.x;
        f.z = back.z;
        f.y = y;
        const vu = Math.trunc((f.vx * k.fz - f.vz * k.fx) / 4096);
        const vw = -Math.trunc((3 * Math.trunc((f.vx * k.fx + f.vz * k.fz) / 4096)) / 10);
        const nvu = Math.trunc(vu / 2);
        f.vx = Math.trunc((nvu * k.fz + vw * k.fx) / 4096);
        f.vz = Math.trunc((-nvu * k.fx + vw * k.fz) / 4096);
        f.vy = Math.trunc(f.vy / 2);
      } else {
        f.wallSide = u <= k.wallL - FK_BALL_R ? -1 : u >= k.wallR + FK_BALL_R ? 1 : 2;
        f.react = f.t + FK_KEEPER_REACT;
      }
    }
  }
  // The keeper: still until he reacts, then dives toward the straight-line prediction of the ball.
  if (f.react >= 0 && f.t >= f.react) {
    let goal = f.kx;
    if (f.vz > 0 && f.z < FK_KEEPER_Z) goal = f.x + Math.trunc((f.vx * (FK_KEEPER_Z - f.z)) / f.vz);
    goal = clampInt(goal, -FK_KEEPER_LIMIT, FK_KEEPER_LIMIT);
    const want = clampInt(Math.trunc((goal - f.kx) / 3), -FK_KEEPER_VMAX, FK_KEEPER_VMAX);
    f.kv += clampInt(want - f.kv, -FK_KEEPER_ACC, FK_KEEPER_ACC);
    f.kx += f.kv;
  }
  if (f.out === FK_OUT_NONE && pz < FK_KEEPER_Z && f.z >= FK_KEEPER_Z && f.vz > 0) {
    const span = Math.max(1, f.z - pz);
    const x = px + Math.trunc(((f.x - px) * (FK_KEEPER_Z - pz)) / span);
    const y = py + Math.trunc(((f.y - py) * (FK_KEEPER_Z - pz)) / span);
    const dx = cm(x - f.kx);
    const dy = cm(y - FK_KEEPER_Y);
    f.passX = x;
    f.passY = y;
    f.passK = f.kx;
    if (dx * dx * FK_KEEPER_AY_CM * FK_KEEPER_AY_CM + dy * dy * FK_KEEPER_AX_CM * FK_KEEPER_AX_CM <= FK_KEEPER_AX_CM * FK_KEEPER_AX_CM * FK_KEEPER_AY_CM * FK_KEEPER_AY_CM) {
      f.out = FK_OUT_SAVED;
      f.z = FK_KEEPER_Z - m(0.05);
      f.x = x;
      f.y = y;
      f.vz = -Math.trunc(f.vz / 5);
      f.vx = Math.trunc(f.vx / 3) + (x >= f.kx ? m(0.03) : -m(0.03));
      f.vy = Math.trunc(f.vy / 3) + m(0.02);
    }
  }
  // The goal plane.
  if (f.out === FK_OUT_NONE && pz < FK_GOAL_Z && f.z >= FK_GOAL_Z) {
    const span = Math.max(1, f.z - pz);
    f.crossX = px + Math.trunc(((f.x - px) * (FK_GOAL_Z - pz)) / span);
    f.crossY = py + Math.trunc(((f.y - py) * (FK_GOAL_Z - pz)) / span);
    f.crossK = f.kx;
    f.out = Math.abs(f.crossX) < FK_GOAL_HALF_W && f.crossY < FK_GOAL_H ? FK_OUT_GOAL : FK_OUT_WIDE;
  }
  // The net holds a goal.
  if (f.out === FK_OUT_GOAL) {
    if (f.z > FK_NET_Z) {
      f.z = FK_NET_Z;
      f.vz = -Math.trunc(f.vz / 6);
      f.vx = Math.trunc(f.vx / 2);
    }
    if (f.y > FK_GOAL_H - FK_BALL_R && f.z > FK_GOAL_Z) {
      f.y = FK_GOAL_H - FK_BALL_R;
      if (f.vy > 0) f.vy = 0;
    }
    const lim = FK_GOAL_HALF_W - FK_BALL_R;
    if (f.z > FK_GOAL_Z && Math.abs(f.x) > lim) {
      f.x = f.x > 0 ? lim : -lim;
      f.vx = -Math.trunc(f.vx / 4);
    }
  }
  if (f.out === FK_OUT_NONE) {
    const slow = f.y <= FK_BALL_R && Math.abs(f.vx) + Math.abs(f.vz) < m(0.02);
    if (f.t >= FREEKICK_FLIGHT_MAX || slow || f.z < -m(60)) f.out = FK_OUT_SHORT;
  }
}

/** What a finished flight earns: placement units (0…30), a target hit, curled round the wall. */
export function fkJudge(k: FkKick, f: FkFlight, hoopR: number = FK_HOOP_R): { goal: boolean; place: number; distCm: number; target: boolean; curled: boolean } {
  const goal = f.out === FK_OUT_GOAL;
  if (!goal) return { goal, place: 0, distCm: 0, target: false, curled: false };
  const dx = cm(f.passX - f.passK);
  const dy = cm(f.passY - FK_KEEPER_Y);
  const distCm = isqrt(dx * dx + dy * dy);
  const place = Math.min(FREEKICK_PLACE_UNITS, Math.trunc((FREEKICK_PLACE_UNITS * distCm) / FREEKICK_PLACE_FULL_CM));
  let target = false;
  if (k.target === FK_TARGET_BAR) target = f.bar === 1;
  else if (k.target === FK_TARGET_LEFT || k.target === FK_TARGET_RIGHT) {
    // The hoop stays tucked in its corner as it shrinks (freekickRev 4; FK_HOOP_R gives rev 1–3's hoop exactly).
    const hx = cm(f.crossX - (k.target === FK_TARGET_LEFT ? -(FK_GOAL_HALF_W - hoopR) : FK_GOAL_HALF_W - hoopR));
    const hy = cm(f.crossY - (FK_GOAL_H - hoopR));
    const r = cm(hoopR);
    target = hx * hx + hy * hy <= r * r;
  }
  const curled = (f.wallSide === -1 && f.cu >= FREEKICK_CURL_MIN) || (f.wallSide === 1 && f.cu <= -FREEKICK_CURL_MIN);
  return { goal, place, distCm, target, curled };
}

/* ================================ freekickRev 3: the prepared shot ================================ */

/** The keeper of a ghost flight stands this far away (no save is ever in reach; products stay far under 2^53). */
const GHOST_KX = 1000 * FK_M;

/**
 * Where a shot with no wall and no keeper (and no woodwork) crosses the goal plane (world units), or null when it never
 * reaches it. The solver's measure (integer, the same everywhere).
 */
export function fkGhostCross(k: FkKick, a: number, b: number, c: number): { x: number; y: number } | null {
  const f = fkLaunch(k, a, b, c);
  f.wallSide = 2;
  f.kx = GHOST_KX;
  while (f.out === FK_OUT_NONE) fkFlightStep(k, f, false, false);
  if (f.out !== FK_OUT_GOAL && f.out !== FK_OUT_WIDE) return null;
  return { x: f.crossX, y: f.crossY };
}

const solveCache = new Map<string, { a: number; c: number }>();

/**
 * freekickRev 3's aim: the launch (aim a, power c) that, with curl b, crosses the goal plane at (xCm, yCm), found by
 * alternating integer bisections on the ghost flight (power for the height, aim for the side; three rounds). Pure and
 * deterministic (cached); the phone, the server and the art all call it.
 */
export function fkV3Solve(k: FkKick, xCm: number, yCm: number, b: number): { a: number; c: number } {
  const key = `${k.bx},${k.bz},${k.wind},${xCm},${yCm},${b}`;
  const hit = solveCache.get(key);
  if (hit) return hit;
  const tx = Math.trunc((xCm * FK_M) / 100);
  const ty = Math.trunc((yCm * FK_M) / 100);
  let a = 0;
  let c = 500;
  const aimFor = () => {
    let lo = -FREEKICK_AIM_MAX;
    let hi = FREEKICK_AIM_MAX;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      const x = fkGhostCross(k, mid, b, c);
      // A yaw so wide the ball never reaches the goal plane counts as wide on its own side.
      if (x ? x.x < tx : mid < 0) lo = mid;
      else hi = mid;
    }
    const xl = fkGhostCross(k, lo, b, c);
    const xh = fkGhostCross(k, hi, b, c);
    a = !xh || (xl && Math.abs(xl.x - tx) <= Math.abs(xh.x - tx)) ? lo : hi;
  };
  const powerFor = () => {
    let lo = 0;
    let hi = FREEKICK_POWER_MAX;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      const y = fkGhostCross(k, a, b, mid);
      if (!y || y.y < ty) lo = mid;
      else hi = mid;
    }
    const yl = fkGhostCross(k, a, b, lo);
    const yh = fkGhostCross(k, a, b, hi);
    c = !yh || (yl && Math.abs(yl.y - ty) <= Math.abs(yh.y - ty)) ? lo : hi;
  };
  aimFor();
  const near = Math.trunc((2 * FK_M) / 100);
  for (let round = 0; round < 8; round++) {
    powerFor();
    aimFor();
    const at = fkGhostCross(k, a, b, c);
    if (at && Math.abs(at.x - tx) <= near && Math.abs(at.y - ty) <= near) break;
  }
  const out = { a, c };
  if (solveCache.size > 4000) solveCache.clear();
  solveCache.set(key, out);
  return out;
}

/** The meter's value (0…1000) `ticks` after it started: a triangle sweep, FK_V3_METER_PERIOD ticks a cycle. */
export function fkV3Meter(ticks: number): number {
  const half = FK_V3_METER_PERIOD / 2;
  const p = ((ticks % FK_V3_METER_PERIOD) + FK_V3_METER_PERIOD) % FK_V3_METER_PERIOD;
  return p <= half ? Math.trunc((p * 1000) / half) : Math.trunc(((FK_V3_METER_PERIOD - p) * 1000) / half);
}

/** How far a meter value is past the sweet zone: + too much, − too little, 0 a clean strike. */
export function fkV3MeterError(meter: number): number {
  return meter > FK_V3_ZONE_HI ? meter - FK_V3_ZONE_HI : meter < FK_V3_ZONE_LO ? meter - FK_V3_ZONE_LO : 0;
}

/** freekickRev 3's launch: the solved shot for the target and curl, then the meter's error applied. */
export function fkV3Launch(k: FkKick, xCm: number, yCm: number, b: number, meter: number): FkFlight {
  const s = fkV3Solve(k, xCm, yCm, b);
  const f = fkLaunch(k, s.a, b, s.c);
  const e = fkV3MeterError(meter);
  if (e > 0) f.vy += e * FK_V3_OVER_VY;
  else if (e < 0) {
    const keep = Math.max(250, 1000 + e * FK_V3_UNDER_PERMILLE);
    f.vx = Math.trunc((f.vx * keep) / 1000);
    f.vy = Math.trunc((f.vy * keep) / 1000);
    f.vz = Math.trunc((f.vz * keep) / 1000);
  }
  return f;
}

/* ================================ The sim ================================ */

export interface FreekickState {
  tick: number;
  seed: number;
  freekickRev: number;
  acted: number;
  /** The kick being played (0…9; 10 when done). */
  k: number;
  phase: number;
  phaseTick: number;
  /** The tick kick k must be taken by. */
  deadline: number;
  /** The current kick's flight (null before it is taken). */
  fl: FkFlight | null;
  kickTick: number;
  /** Per kick: outcome (FK_OUT_*; −1 not played yet), placement units, flags. */
  outs: number[];
  places: number[];
  /** Bit 1 target, bit 2 curled round the wall. */
  flags: number[];
  goals: number;
  units: number;
  targets: number;
  curled: number;
  streak: number;
  best: number;
  /**
   * freekickRev 3 only (absent on earlier revisions, so their states are unchanged): the shot being prepared for the
   * current kick: the target (cm on the goal plane; aimed 0 until the first AIM), the curl, the tick the power meter
   * started (−1 not started), and the meter's value at the strike (−1 before it).
   */
  aimX?: number;
  aimY?: number;
  aimed?: number;
  curl?: number;
  meterAt?: number;
  strikeM?: number;
  /** freekickRev 4 only: goals from a strongly bent shot (the Curl bonus). */
  bent?: number;
}

export function fkDeadline(k: number): number {
  return FREEKICK_SLOT * k + FREEKICK_DEADLINE_IN_SLOT;
}

/** A kick's deadline on a revision (freekickRev 3: 540-tick slots in a 90 s run). */
export function fkDeadlineFor(rev: number, k: number): number {
  return rev >= FREEKICK_REV_3 ? FREEKICK_V3_SLOT * k + FREEKICK_V3_SLOT - FREEKICK_FLIGHT_MAX - FREEKICK_SETTLE_TICKS : fkDeadline(k);
}

/** The run's length on a revision (ticks). */
export function fkRunTicksFor(rev: number): number {
  return rev >= FREEKICK_REV_3 ? FREEKICK_V3_RUN_TICKS : FREEKICK_RUN_TICKS;
}

/** freekickRev 3's fresh shot for a new kick (no target, no curl, meter off). */
const V3_FRESH = { aimX: 0, aimY: 0, aimed: 0, curl: 0, meterAt: -1, strikeM: -1 } as const;

function initFor(rev: number) {
  return (seed: number) => init(seed, rev);
}

function init(seed: number, rev: number = FREEKICK_REV_STD): FreekickState {
  fkSeedPlan(seed, rev);
  return {
    tick: 0,
    seed: seed | 0,
    freekickRev: rev,
    acted: 0,
    k: 0,
    phase: FK_SETUP,
    phaseTick: 0,
    deadline: fkDeadlineFor(rev, 0),
    fl: null,
    kickTick: 0,
    outs: new Array<number>(FREEKICK_KICKS).fill(-1),
    places: new Array<number>(FREEKICK_KICKS).fill(0),
    flags: new Array<number>(FREEKICK_KICKS).fill(0),
    goals: 0,
    units: 0,
    targets: 0,
    curled: 0,
    streak: 0,
    best: 0,
    ...(rev >= FREEKICK_REV_3 ? V3_FRESH : {}),
    ...(rev >= FREEKICK_REV_4 ? { bent: 0 } : {}),
  };
}

/** The kick being played (or the last one). */
export function fkKickOf(state: FreekickState): FkKick {
  const plan = fkSeedPlan(state.seed, state.freekickRev);
  return plan.kicks[Math.min(state.k, FREEKICK_KICKS - 1)]!;
}

function resolve(s: FreekickState, kick: FkKick, out: number, f: FkFlight | null): void {
  const outs = s.outs.slice();
  outs[s.k] = out;
  s.outs = outs;
  if (out === FK_OUT_GOAL && f) {
    const j = fkJudge(kick, f, fkHoopRFor(s.freekickRev, s.k));
    s.goals += 1;
    s.units += FREEKICK_GOAL_UNITS + j.place;
    const places = s.places.slice();
    places[s.k] = j.place;
    s.places = places;
    const flags = s.flags.slice();
    // freekickRev 4: bit 4 a goal from a strongly bent shot.
    const bent = s.freekickRev >= FREEKICK_REV_4 && Math.abs(s.curl ?? 0) >= FK_V4_BENT;
    flags[s.k] = (j.target ? 1 : 0) | (j.curled ? 2 : 0) | (bent ? 4 : 0);
    s.flags = flags;
    if (bent) s.bent = (s.bent ?? 0) + 1;
    if (j.target) s.targets += 1;
    if (j.curled) s.curled += 1;
    s.streak += 1;
    if (s.streak > s.best) s.best = s.streak;
  } else s.streak = 0;
  s.phase = FK_SETTLE;
  s.phaseTick = s.tick;
}

function step(state: FreekickState, input: ArcadeInputEvent | null): FreekickState {
  if (state.phase === FK_OVER || state.tick >= fkRunTicksFor(state.freekickRev)) return state;
  const s: FreekickState = { ...state, tick: state.tick + 1 };
  const kick = fkKickOf(s);
  if (s.phase === FK_SETUP) {
    if (s.tick - s.phaseTick >= FREEKICK_SETUP_TICKS) {
      s.phase = FK_AIM;
      s.phaseTick = s.tick;
    }
  } else if (s.phase === FK_AIM && s.freekickRev >= FREEKICK_REV_3) {
    // freekickRev 3: aim and curl (redone freely until the meter starts), the meter, the strike.
    const metering = (s.meterAt ?? -1) >= 0;
    const v4 = s.freekickRev >= FREEKICK_REV_4;
    if (v4 && input && input.k === FREEKICK_INPUT_SHOT && !metering) {
      // freekickRev 4: the drawn shot sets the target and the curl together (redrawn freely until the meter starts).
      s.aimX = clampInt(Math.trunc(input.a), -FK_V3_AIM_X_MAX, FK_V3_AIM_X_MAX);
      s.aimY = clampInt(Math.trunc(input.b), FK_V3_AIM_Y_MIN, FK_V3_AIM_Y_MAX);
      s.curl = clampInt(Math.trunc(input.c), -FREEKICK_CURL_MAX, FREEKICK_CURL_MAX);
      s.aimed = 1;
    } else if (!v4 && input && input.k === FREEKICK_INPUT_AIM && !metering) {
      s.aimX = clampInt(Math.trunc(input.a), -FK_V3_AIM_X_MAX, FK_V3_AIM_X_MAX);
      s.aimY = clampInt(Math.trunc(input.b), FK_V3_AIM_Y_MIN, FK_V3_AIM_Y_MAX);
      s.aimed = 1;
    } else if (!v4 && input && input.k === FREEKICK_INPUT_CURL && !metering) {
      s.curl = clampInt(Math.trunc(input.b), -FREEKICK_CURL_MAX, FREEKICK_CURL_MAX);
    } else if (input && input.k === FREEKICK_INPUT_POWER && !metering && s.aimed === 1) {
      s.meterAt = s.tick;
    } else if (input && input.k === FREEKICK_INPUT_STRIKE && metering) {
      const meter = fkV3Meter(s.tick - (s.meterAt ?? 0));
      s.strikeM = meter;
      s.fl = fkV3Launch(kick, s.aimX ?? 0, s.aimY ?? 0, s.curl ?? 0, meter);
      s.kickTick = s.tick;
      s.acted += 1;
      s.phase = FK_FLIGHT;
      s.phaseTick = s.tick;
    } else if (s.tick >= s.deadline) {
      resolve(s, kick, FK_OUT_UNTAKEN, null);
    }
  } else if (s.phase === FK_AIM) {
    if (input && input.k === FREEKICK_INPUT_KICK) {
      s.fl = fkLaunch(kick, input.a, input.b, input.c);
      s.kickTick = s.tick;
      s.acted += 1;
      s.phase = FK_FLIGHT;
      s.phaseTick = s.tick;
    } else if (s.tick >= s.deadline) {
      resolve(s, kick, FK_OUT_UNTAKEN, null);
    }
  } else if (s.phase === FK_FLIGHT || s.phase === FK_SETTLE) {
    if (s.fl) {
      const f = { ...s.fl };
      fkFlightStep(kick, f);
      s.fl = f;
      if (s.phase === FK_FLIGHT && f.out !== FK_OUT_NONE) resolve(s, kick, f.out, f);
    }
    if (s.phase === FK_SETTLE && s.tick - s.phaseTick >= FREEKICK_SETTLE_TICKS) {
      s.k += 1;
      s.fl = null;
      if (s.k >= FREEKICK_KICKS) s.phase = FK_OVER;
      else {
        s.phase = FK_SETUP;
        s.phaseTick = s.tick;
        s.deadline = fkDeadlineFor(s.freekickRev, s.k);
        if (s.freekickRev >= FREEKICK_REV_3) Object.assign(s, V3_FRESH);
      }
    }
  }
  return s;
}

function isOver(state: FreekickState): boolean {
  return state.phase === FK_OVER || state.tick >= fkRunTicksFor(state.freekickRev);
}

/**
 * freekickRev 1's, 2's and 3's scored parts (the same parts, each on its own spec; rev 3's core full at
 * FREEKICK_V3_CORE_FULL; null on any other revision).
 */
export function freekickStdParts(state: FreekickState): StdPart[] | null {
  const r = state.freekickRev;
  if (r === FREEKICK_REV_4) {
    const placed4 = state.units - state.goals * FREEKICK_GOAL_UNITS;
    const spec4 = FREEKICK_V4_STD_SPEC;
    return [
      stdPart(spec4, "core", stdLine(FREEKICK_V4_CORE_MAX, state.units, FREEKICK_V4_CORE_FULL), `${state.goals} of ${FREEKICK_KICKS} scored · placement ${placed4} of ${state.goals * FREEKICK_PLACE_UNITS}`),
      stdPart(spec4, "targets", stdEach(state.targets, 10, FREEKICK_TARGETS_MAX), `${state.targets} of ${FREEKICK_TARGETS} targets`),
      stdPart(spec4, "curl", stdEach(state.curled, 1, FREEKICK_V4_WALL_MAX), `${state.curled} round the wall`),
      stdPart(spec4, "bent", stdEach(state.bent ?? 0, 2, FREEKICK_V4_BENT_MAX), `${state.bent ?? 0} bent shots scored`),
      stdPart(spec4, "streak", state.best >= FREEKICK_STREAK_RUN ? FREEKICK_STREAK_MAX : 0, `best ${state.best} in a row`),
    ];
  }
  const spec = r === FREEKICK_REV_STD ? FREEKICK_STD_SPEC : r === FREEKICK_REV_2 ? FREEKICK_V2_STD_SPEC : r === FREEKICK_REV_3 ? FREEKICK_V3_STD_SPEC : null;
  if (!spec) return null;
  const placed = state.units - state.goals * FREEKICK_GOAL_UNITS;
  const full = r === FREEKICK_REV_3 ? FREEKICK_V3_CORE_FULL : FREEKICK_CORE_FULL;
  return [
    stdPart(spec, "core", stdLine(FREEKICK_CORE_MAX, state.units, full), `${state.goals} of ${FREEKICK_KICKS} scored · placement ${placed} of ${state.goals * FREEKICK_PLACE_UNITS}`),
    stdPart(spec, "targets", stdEach(state.targets, 10, FREEKICK_TARGETS_MAX), `${state.targets} of ${FREEKICK_TARGETS} targets`),
    stdPart(spec, "curl", stdEach(state.curled, 2, FREEKICK_CURL_MAX_PTS), `${state.curled} round the wall`),
    stdPart(spec, "streak", state.best >= FREEKICK_STREAK_RUN ? FREEKICK_STREAK_MAX : 0, `best ${state.best} in a row`),
  ];
}

function score(state: FreekickState): number {
  const parts = freekickStdParts(state);
  return parts ? stdScore(parts, state.acted > 0) : 0;
}

/** For the skill-band tool: units = core units, points = the core, bonus = the features. */
export function freekickBandParts(state: FreekickState): BandParts {
  const parts = freekickStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  return {
    units: state.units,
    points: core,
    bonus: stdSum(parts) - core,
    penalty: 0,
    finished: false,
    text: parts.map((p) => `${p.label} ${p.points}`).join(" · "),
  };
}

/** A plain fallback draw (the art lives in freekick.renderer.ts). */
function drawPlain(ctx: CanvasRenderingContext2D, state: FreekickState, size: CanvasSize): void {
  ctx.fillStyle = FREEKICK_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.fillStyle = "#F3F1EC";
  ctx.font = "14px sans-serif";
  ctx.fillText(`Kick ${Math.min(state.k + 1, FREEKICK_KICKS)}/${FREEKICK_KICKS} · ${state.goals} goals`, 12, 24);
}

export const freekickGame: ArcadeGame<FreekickState, ArcadeInputEvent | null> = {
  key: "freekick",
  runTicks: FREEKICK_RUN_TICKS,
  init: initFor(FREEKICK_REV_STD),
  step,
  isOver,
  score,
  draw: drawPlain,
  inputRanges: FREEKICK_INPUT_RANGES,
};

/** freekickRev 2's game: the same step (the kick plan follows the state's stamp), started on rev 2. */
export const freekickGameV2: ArcadeGame<FreekickState, ArcadeInputEvent | null> = { ...freekickGame, init: initFor(FREEKICK_REV_2) };

/** freekickRev 3's game: the same step on rev 3 (the prepared shot), its own inputs and a 90 s run. */
export const freekickGameV3: ArcadeGame<FreekickState, ArcadeInputEvent | null> = {
  ...freekickGame,
  runTicks: FREEKICK_V3_RUN_TICKS,
  init: initFor(FREEKICK_REV_3),
  inputRanges: FREEKICK_INPUT_RANGES_V3,
};

/** freekickRev 4's game: rev 3's step on rev 4 (the drawn shot, the Curl bonus, the shrinking hoops), its own inputs. */
export const freekickGameV4: ArcadeGame<FreekickState, ArcadeInputEvent | null> = {
  ...freekickGameV3,
  init: initFor(FREEKICK_REV_4),
  inputRanges: FREEKICK_INPUT_RANGES_V4,
};

/** The game for a stored stamp: rev 4 on freekickRev 4 and above, 3 on 3, 2 on 2, else rev 1 (unstamped rounds included). */
export function freekickGameFor(rev?: number | null): ArcadeGame<FreekickState, ArcadeInputEvent | null> {
  const r = rev ?? FREEKICK_REV_STD;
  return r >= FREEKICK_REV_4 ? freekickGameV4 : r >= FREEKICK_REV_3 ? freekickGameV3 : r >= FREEKICK_REV_2 ? freekickGameV2 : freekickGame;
}

/* ================================ Checkpoints ================================ */

export const FREEKICK_CHECKPOINT_INTERVAL = 60;
export const FREEKICK_CHECKPOINT_KEYS = ["tick", "k", "phase", "x", "y", "z", "goals", "units", "checksum"] as const;
export interface FreekickCheckpoint {
  tick: number;
  k: number;
  phase: number;
  x: number;
  y: number;
  z: number;
  goals: number;
  units: number;
  checksum: number;
}

export function freekickCheckpoint(state: FreekickState): FreekickCheckpoint {
  const f = state.fl;
  const snap = { tick: state.tick, k: state.k, phase: state.phase, x: f?.x ?? 0, y: f?.y ?? 0, z: f?.z ?? 0, goals: state.goals, units: state.units };
  let checksum = 0x811c9dc5;
  const extra = [state.acted, state.targets, state.curled, state.best, state.streak, state.kickTick, f?.kx ?? 0, f?.vx ?? 0, f?.vy ?? 0, f?.vz ?? 0, f?.out ?? 0, ...state.outs];
  // freekickRev 3: the prepared shot too (earlier revisions' checksums are unchanged).
  if (state.freekickRev >= FREEKICK_REV_3) extra.push(state.aimX ?? 0, state.aimY ?? 0, state.aimed ?? 0, state.curl ?? 0, state.meterAt ?? 0, state.strikeM ?? 0);
  // freekickRev 4: the Curl bonus count.
  if (state.freekickRev >= FREEKICK_REV_4) extra.push(state.bent ?? 0);
  for (const value of [...Object.values(snap), ...extra]) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* ============================ The camera (display only) ============================ */

/**
 * The fixed camera for a kick: 6 m behind the ball on the line to the goal's centre, 2.2 m up, looking level along
 * that line, focal length FREEKICK_FOCAL world px, the horizon at FREEKICK_HORIZON. Floats are fine here: the sim and
 * the server never read it (the renderer, the phone's stroke mapping and the shared effects layer do).
 */
export const FREEKICK_FOCAL = 800;
export const FREEKICK_HORIZON = 300;
export const FREEKICK_CAM_BACK = 6;
export const FREEKICK_CAM_H = 2.2;

export interface FkCamera {
  /** Camera position (metres). */
  cx: number;
  cz: number;
  /** Forward unit vector across / forward (metres). */
  fx: number;
  fz: number;
}

export function fkCamera(k: FkKick): FkCamera {
  const fx = k.fx / 4096;
  const fz = k.fz / 4096;
  const n = Math.hypot(fx, fz) || 1;
  return { cx: k.bx / FK_M - (fx / n) * FREEKICK_CAM_BACK, cz: k.bz / FK_M - (fz / n) * FREEKICK_CAM_BACK, fx: fx / n, fz: fz / n };
}

/** Camera space (metres): u across (+ right), w forward, h height above the camera. */
export function fkCamSpace(cam: FkCamera, x: number, y: number, z: number): { u: number; w: number; h: number } {
  const dx = x - cam.cx;
  const dz = z - cam.cz;
  return { u: dx * cam.fz - dz * cam.fx, w: dx * cam.fx + dz * cam.fz, h: y - FREEKICK_CAM_H };
}

/** World metres to world px (null behind the camera). */
export function fkProject(cam: FkCamera, x: number, y: number, z: number): { x: number; y: number; s: number } | null {
  const c = fkCamSpace(cam, x, y, z);
  if (c.w < 0.2) return null;
  const s = FREEKICK_FOCAL / c.w;
  return { x: FREEKICK_WORLD_W / 2 + c.u * s, y: FREEKICK_HORIZON - c.h * s, s };
}

/** World px on the ground plane back to world metres (x, z), or null above the horizon. */
export function fkUnprojectGround(cam: FkCamera, sx: number, sy: number): { x: number; z: number } | null {
  const dy = sy - FREEKICK_HORIZON;
  if (dy <= 0.5) return null;
  const w = (FREEKICK_FOCAL * FREEKICK_CAM_H) / dy;
  const u = ((sx - FREEKICK_WORLD_W / 2) * w) / FREEKICK_FOCAL;
  return { x: cam.cx + u * cam.fz + w * cam.fx, z: cam.cz - u * cam.fx + w * cam.fz };
}

/**
 * The shared success/miss effects layer's counters (display only): goals scored, targets hit, kicks missed (saved,
 * blocked, wide, short or not taken) so far, all monotonic, and the world-px point where the last kick crossed the
 * goal plane (null when it never got there).
 */
export function freekickFxCounts(state: FreekickState): { goals: number; targets: number; misses: number; at: { x: number; y: number } | null } {
  let misses = 0;
  for (const o of state.outs) if (o >= 0 && o !== FK_OUT_GOAL) misses++;
  const f = state.fl;
  let at: { x: number; y: number } | null = null;
  if (f && (f.out === FK_OUT_GOAL || f.out === FK_OUT_WIDE)) {
    const p = fkProject(fkCamera(fkKickOf(state)), f.crossX / FK_M, f.crossY / FK_M, FK_GOAL_Z / FK_M);
    if (p) at = { x: p.x, y: p.y };
  }
  return { goals: state.goals, targets: state.targets, misses, at };
}
