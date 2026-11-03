/**
 * Alley Roll (Sports, 1 Nov 2026; docs/arcade-standard/alleyroll.md): nine balls rolled up a sloping wooden lane,
 * off a ramp and onto a board of lit rings, in at most 60 s. Born on the arcade scoring standard (`alleyRollRev` 1).
 *
 * The lane: LANE_HALF either side of its centre line, sloping up to the ramp at AR_RAMP_Y (the slope takes a little
 * speed every tick, the side rails bounce a ball back at three quarters of its speed). Off the ramp the ball flies
 * (its height on a straight gravity curve) over the board, which is wider than the lane; it bounces off the board's
 * sides and, at half speed, off its back. Where it comes down decides the ball: one of the two 100 pockets in the top
 * corners, else the innermost ring it lands in (50, 40, 30, 20, 10, all round one centre), else the gutter (0).
 *
 * One input a ball (k1, only while a ball waits): `a` the release point across the lane, `b` and `c` the ball's
 * speed across and up the lane (1/256 px a tick). The phone takes the release point from a slide along the bottom
 * and the speed from the swipe up (its speed the power, its angle the direction); the sim holds them to the lane and
 * to AR_MAX_ANGLE. Integer physics only; no wind, no seed: every room's lane is the same lane.
 *
 * Scoring (alleyRollRev 1, the arcade standard; 200 in all): the core 150 on a straight line, ring points (every
 * ball's points, pockets included) ÷ AR_CORE_FULL × 150, full at the elite skill-band median (the brief's "near-flawless"); 100 pockets up to
 * 30 (10 each, up to 3); hot streak up to 20 (4 for each ball scoring 40 or more straight after another that did, up
 * to 5). Any run that rolled a ball scores at least 1; no input scores 0.
 */
import { clampInt, fp, inputRange, type ArcadeGame, type ArcadeInputEvent } from "./engine";
import { stdEach, stdLine, stdPart, stdScore, stdSum, type StdPart, type StdSpec } from "./arcadeStandard";
import { bandCurve, type BandParts } from "./scoreBands";
import { hashInts } from "./cards/cards";

export const ALLEYROLL_REV = 1;
export const AR_BALLS = 9;
export const AR_RUN_TICKS = 60 * 60;
export const AR_INPUT_ROLL = 1;

/* The lane and board, in lane units (px at the release line); positions are kept in 1/256 units. */
export const AR_LANE_HALF = 100;
export const AR_BALL_R = 9;
/** The release point's range either side of the centre line. */
export const AR_RELEASE_MAX = AR_LANE_HALF - AR_BALL_R - 2;
export const AR_RAMP_Y = 640;
/** Speed lost to the slope every tick (1/256 px a tick). */
export const AR_SLOPE = 2;
export const AR_BOARD_HALF = 130;
export const AR_BOARD_D = 300;
/** The ramp turns a quarter of the ball's speed up the lane into lift; gravity in flight (1/256 px a tick²). */
export const AR_LIFT_DIV = 4;
export const AR_GRAVITY = 64;
/** The swipe's speed up the lane: its least and most (1/256 px a tick), and the steepest angle (|across| ≤ up × 3/10). */
export const AR_VMIN = fp(6);
export const AR_VMAX = fp(13);
export const AR_MAX_ANGLE_NUM = 3;
export const AR_MAX_ANGLE_DEN = 10;

/** The rings round one centre (board units), innermost first, and the two pockets. */
export const AR_RING_CX = 0;
export const AR_RING_CY = 190;
export const AR_RINGS: readonly { r: number; points: number }[] = [
  { r: 14, points: 50 },
  { r: 31, points: 40 },
  { r: 50, points: 30 },
  { r: 72, points: 20 },
  { r: 98, points: 10 },
];
export const AR_POCKETS: readonly { x: number; y: number }[] = [{ x: -112, y: 280 }, { x: 112, y: 280 }];
export const AR_POCKET_R = 11;
export const AR_POCKET_POINTS = 100;

/** Ticks a ball's result stays up before the next ball waits. */
export const AR_SHOW_TICKS = 40;

export const AR_CORE_MAX = 150;
export const AR_POCKETS_MAX = 30;
export const AR_POCKET_EACH = 10;
export const AR_STREAK_MAX = 20;
export const AR_STREAK_EACH = 4;
export const AR_STREAK_AT = 40;
/**
 * The core is full at this many ring points: the elite skill-band median (`bun scripts/new-arcade-bands.ts alleyroll`,
 * docs/arcade-standard/alleyroll.md; the near-perfect median, 460, left near-perfect, elite and flawless all at 200).
 */
export const AR_CORE_FULL = 540;
export const AR_V1_BAND_CURVE = bandCurve([0, AR_CORE_FULL], [0, AR_CORE_MAX]);

export const AR_STD_SPEC: StdSpec = {
  field: "alleyRollRev",
  rev: ALLEYROLL_REV,
  parts: [
    { key: "core", label: "Ring points", max: AR_CORE_MAX, of: AR_CORE_FULL, item: "ring point", how: `a straight line, full at ${AR_CORE_FULL} ring points` },
    { key: "pockets", label: "100 pockets", max: AR_POCKETS_MAX, of: 3, item: "pocket", how: "10 each, up to 3" },
    { key: "streak", label: "Hot streak", max: AR_STREAK_MAX, of: 5, item: "ball", how: "4 for each ball scoring 40 or more straight after another that did, up to 5" },
  ],
};

/** Ball phases. */
export const AR_WAIT = 0;
export const AR_ROLL = 1;
export const AR_FLY = 2;
export const AR_SHOW = 3;

export interface ArBall {
  /** Where it was released (lane units) and what it scored. */
  release: number;
  points: number;
  /** Where it came down (board units). */
  x: number;
  y: number;
}

export interface ArState {
  tick: number;
  rev: number;
  /** The ball in play: phase, position (1/256 units: lane y while rolling, board y in flight), speeds, height. */
  phase: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  phaseTick: number;
  balls: ArBall[];
  rejects: number;
  acted: number;
  /** 0 running, 1 nine balls rolled, 2 the buzzer. */
  ended: number;
  endTick: number;
  std: number;
  /** alleyRollRev 2 (Ringer) only: the gold cup's seeded path (period in ticks, phase, half-width in board px). */
  gp?: number;
  gph?: number;
  ga?: number;
}

export function arInit(_seed: number): ArState {
  return { tick: 0, rev: ALLEYROLL_REV, phase: AR_WAIT, x: 0, y: 0, vx: 0, vy: 0, z: 0, vz: 0, phaseTick: 0, balls: [], rejects: 0, acted: 0, ended: 0, endTick: 0, std: 1 };
}

/** The release point, across and up speeds the sim keeps from an input (held to the lane and the angle). */
export function arLaunch(a: number, b: number, c: number): { x: number; vx: number; vy: number } {
  const vy = clampInt(c, AR_VMIN, AR_VMAX);
  const most = Math.floor((vy * AR_MAX_ANGLE_NUM) / AR_MAX_ANGLE_DEN);
  return { x: clampInt(a, -AR_RELEASE_MAX, AR_RELEASE_MAX), vx: clampInt(b, -most, most), vy };
}

/** A landing point's points: a pocket, else the innermost ring round it, else 0. */
export function arPointsAt(x: number, y: number): number {
  for (const p of AR_POCKETS) {
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy <= AR_POCKET_R * AR_POCKET_R) return AR_POCKET_POINTS;
  }
  const dx = x - AR_RING_CX;
  const dy = y - AR_RING_CY;
  const d2 = dx * dx + dy * dy;
  for (const ring of AR_RINGS) if (d2 <= ring.r * ring.r) return ring.points;
  return 0;
}

function bounce(pos: number, vel: number, half: number): { pos: number; vel: number } {
  const lim = (half - AR_BALL_R) * 256;
  if (pos > lim) return { pos: 2 * lim - pos, vel: -Math.abs(Math.trunc((vel * 3) / 4)) };
  if (pos < -lim) return { pos: -2 * lim - pos, vel: Math.abs(Math.trunc((vel * 3) / 4)) };
  return { pos, vel };
}

function moveBall(s: ArState): ArState {
  if (s.phase === AR_ROLL) {
    const vy = Math.max(1, s.vy - AR_SLOPE);
    const w = bounce(s.x + s.vx, s.vx, AR_LANE_HALF);
    const y = s.y + vy;
    if (y >= AR_RAMP_Y * 256) {
      // Off the ramp: a quarter of the speed up the lane turns into lift; board y counts from the ramp's lip.
      return { ...s, phase: AR_FLY, x: w.pos, vx: w.vel, y: y - AR_RAMP_Y * 256, vy, z: 0, vz: Math.trunc(vy / AR_LIFT_DIV), phaseTick: s.tick };
    }
    return { ...s, x: w.pos, vx: w.vel, y, vy };
  }
  // In flight over the board.
  const w = bounce(s.x + s.vx, s.vx, AR_BOARD_HALF);
  let y = s.y + s.vy;
  let vy = s.vy;
  const back = (AR_BOARD_D - AR_BALL_R) * 256;
  if (y > back) {
    y = 2 * back - y;
    vy = -Math.abs(Math.trunc(vy / 2));
  }
  const vz = s.vz - AR_GRAVITY;
  const z = s.z + vz;
  if (z <= 0) {
    const lx = Math.round(w.pos / 256);
    const ly = Math.round(y / 256);
    const ball: ArBall = { release: 0, points: arPointsAt(lx, ly), x: lx, y: ly };
    const balls = s.balls.slice();
    balls[balls.length - 1] = { ...balls[balls.length - 1]!, points: ball.points, x: lx, y: ly };
    return { ...s, phase: AR_SHOW, x: w.pos, vx: 0, y, vy: 0, z: 0, vz: 0, phaseTick: s.tick, balls };
  }
  return { ...s, x: w.pos, vx: w.vel, y, vy, z, vz };
}

function stepV1(state: ArState, input: ArcadeInputEvent | null): ArState {
  if (state.ended) return state;
  let s: ArState = { ...state, tick: state.tick + 1 };
  if (input && input.k === AR_INPUT_ROLL) {
    s.acted = 1;
    if (s.phase === AR_WAIT && s.balls.length < AR_BALLS) {
      const l = arLaunch(input.a, input.b, input.c);
      s = { ...s, phase: AR_ROLL, x: l.x * 256, y: 0, vx: l.vx, vy: l.vy, z: 0, vz: 0, phaseTick: s.tick, balls: [...s.balls, { release: l.x, points: 0, x: 0, y: 0 }] };
    } else s.rejects++;
  }
  if (s.phase === AR_ROLL || s.phase === AR_FLY) s = moveBall(s);
  else if (s.phase === AR_SHOW && s.tick - s.phaseTick >= AR_SHOW_TICKS) {
    if (s.balls.length >= AR_BALLS) return { ...s, phase: AR_WAIT, ended: 1, endTick: s.tick };
    s = { ...s, phase: AR_WAIT, x: 0, y: 0, phaseTick: s.tick };
  }
  if (!s.ended && s.tick >= AR_RUN_TICKS) s = { ...s, ended: 2, endTick: s.tick };
  return s;
}

/* ================================ Scoring ================================ */

/** The balls that have come down (a ball still rolling or in the air at the buzzer scores nothing). */
export function arScored(s: Pick<ArState, "balls" | "phase">): ArBall[] {
  const done = s.phase === AR_ROLL || s.phase === AR_FLY ? s.balls.length - 1 : s.balls.length;
  return s.balls.slice(0, Math.max(0, done));
}

export function arTotals(s: Pick<ArState, "balls" | "phase">): { rings: number; pockets: number; streak: number; balls: number } {
  const done = arScored(s);
  let rings = 0;
  let pockets = 0;
  let streak = 0;
  done.forEach((b, i) => {
    rings += b.points;
    if (b.points === AR_POCKET_POINTS) pockets++;
    if (i > 0 && b.points >= AR_STREAK_AT && done[i - 1]!.points >= AR_STREAK_AT) streak++;
  });
  return { rings, pockets, streak, balls: done.length };
}

export function alleyRollStdParts(state: ArState): StdPart[] | null {
  if (!state || !state.std) return null;
  if (state.rev >= ALLEYROLL_REV_RINGER) return ringerStdParts(state);
  const t = arTotals(state);
  return [
    stdPart(AR_STD_SPEC, "core", stdLine(AR_CORE_MAX, t.rings, AR_CORE_FULL), `${t.rings} ring points`),
    stdPart(AR_STD_SPEC, "pockets", stdEach(t.pockets, AR_POCKET_EACH, AR_POCKETS_MAX), `${t.pockets} pocket${t.pockets === 1 ? "" : "s"}`),
    stdPart(AR_STD_SPEC, "streak", stdEach(t.streak, AR_STREAK_EACH, AR_STREAK_MAX), `${t.streak} in a row`),
  ];
}

export function alleyRollScore(state: ArState): number {
  return stdScore(alleyRollStdParts(state) ?? [], Boolean(state.acted));
}

export function alleyRollBandParts(state: ArState): BandParts {
  const parts = alleyRollStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  const t = arTotals(state);
  return { units: t.rings, points: core, bonus: stdSum(parts) - core, penalty: 0, finished: state.ended === 1, text: `${t.rings} ring points` };
}

/* ============================== Checkpoints ============================== */

export const AR_CHECKPOINT_INTERVAL = 300;
export const AR_CHECKPOINT_KEYS = ["tick", "balls", "ended", "checksum"] as const;
export interface ArCheckpoint {
  tick: number;
  balls: number;
  ended: number;
  checksum: number;
}

export function arCheckpoint(state: ArState): ArCheckpoint {
  const flat = [state.tick, state.phase, state.x, state.y, state.vx, state.vy, state.z, state.vz, state.ended];
  for (const b of state.balls) flat.push(b.release, b.points, b.x, b.y);
  if (state.rev >= ALLEYROLL_REV_RINGER) flat.push(state.gp ?? 0, state.gph ?? 0, state.ga ?? 0);
  return { tick: state.tick, balls: state.balls.length, ended: state.ended, checksum: hashInts(flat) };
}

export const alleyRollGame: ArcadeGame<ArState, ArcadeInputEvent | null> = {
  key: "alleyroll",
  runTicks: AR_RUN_TICKS,
  init: arInit,
  step: stepV1,
  isOver: (state) => state.ended !== 0,
  score: alleyRollScore,
  draw: () => {},
  inputRanges: [inputRange(AR_INPUT_ROLL, [-AR_RELEASE_MAX, AR_RELEASE_MAX], [-AR_VMAX, AR_VMAX], [AR_VMIN, AR_VMAX])],
};

export function alleyRollGameFor(rev?: number | null): ArcadeGame<ArState, ArcadeInputEvent | null> {
  return (rev ?? 1) >= ALLEYROLL_REV_RINGER ? ringerGame : alleyRollGame;
}

/** Plays one ball from a release and speeds on an empty lane (the oracle, the bots and the preview read it). */
export function arSimulateBall(a: number, b: number, c: number): { points: number; x: number; y: number } {
  let s = { ...arInit(0), acted: 1 };
  s = stepV1(s, { t: 1, k: AR_INPUT_ROLL, a, b, c, d: 0 });
  while (s.phase === AR_ROLL || s.phase === AR_FLY) s = stepV1(s, null);
  const last = s.balls[s.balls.length - 1]!;
  return { points: last.points, x: last.x, y: last.y };
}

/* ======================= Ringer (alleyRollRev 2, 3 Nov 2026) =======================
 *
 * The game is shown as Ringer from alleyRollRev 2 (docs/arcade-standard/alleyroll.md, "Ringer"): the same lane, the
 * same ramp and the same input (k1: release, across and up speeds), but a new board and new parts.
 *
 *  - The board is a stack of raised cups (a flat 10 ring round a tower of 20, 30, 40 and 50, each higher and further
 *    back), the two 100 pockets in the top corners and the gold cup (150) sliding back and forth along the top on a
 *    seeded path (period, phase and half-width from the room seed, on the round clock: the same for every player).
 *  - A ball scores where it comes down through a target's rim: each tick of flight, the targets whose rim height the
 *    ball passes downward through (highest first) are tested at the exact crossing point (integer interpolation, so a
 *    landing is not rounded to a tick's step); the floor (height 0) holds the pockets and the 10 ring, else the gutter.
 *  - Scoring (the arcade standard, 200 in all): Ring points 140 on a straight line (every ball's points, pockets and
 *    gold cup included; full at AR2_CORE_FULL), Gold cup 30 (10 a hit, up to 3), Roll streak 20 (4 for each ball
 *    scoring 30 or more straight after another that did, up to 5), Pocket hits 10 (5 each, up to 2).
 */
export const ALLEYROLL_REV_RINGER = 2;
/** The stamp rooms deal. */
export const ALLEYROLL_REV_DEALT = ALLEYROLL_REV_RINGER;

export interface ArCup {
  points: number;
  /** Centre and radius on the board (board px), and the rim's height above the board. */
  cx: number;
  cy: number;
  r: number;
  h: number;
}
/** The tower, highest (innermost) first; the 10 ring is the flat ring round it. */
export const AR2_CUPS: readonly ArCup[] = [
  { points: 50, cx: 0, cy: 206, r: 17, h: 9 },
  { points: 40, cx: 0, cy: 196, r: 29, h: 7 },
  { points: 30, cx: 0, cy: 184, r: 46, h: 5 },
  { points: 20, cx: 0, cy: 172, r: 66, h: 3 },
  { points: 10, cx: 0, cy: 168, r: 108, h: 0 },
];
export const AR2_POCKETS: readonly { x: number; y: number }[] = [{ x: -114, y: 252 }, { x: 114, y: 252 }];
export const AR2_POCKET_R = 10;
/** Ringer's swipe speeds up the lane: its least and most (1/256 px a tick); the angle is held as before. */
export const AR2_VMIN = fp(9);
export const AR2_VMAX = fp(13.5);
export const AR2_GOLD_Y = 276;
/** The gold cup takes a ball that drops inside its rim whole: its centre within AR2_GOLD_R of the cup's (rim AR2_GOLD_RIM). */
export const AR2_GOLD_R = 7;
export const AR2_GOLD_RIM = AR2_GOLD_R + AR_BALL_R;
export const AR2_GOLD_H = 6;
export const AR2_GOLD_POINTS = 150;
/** The gold cup's seeded path: a period of 70–110 ticks (even), any phase, a half-width of 56–76 board px. */
export const AR2_GOLD_PERIOD_MIN = 70;
export const AR2_GOLD_PERIOD_MAX = 110;
export const AR2_GOLD_AMP_MIN = 56;
export const AR2_GOLD_AMP_MAX = 76;

export const AR2_CORE_MAX = 140;
export const AR2_GOLD_MAX = 30;
export const AR2_GOLD_EACH = 10;
export const AR2_STREAK_MAX = 20;
export const AR2_STREAK_EACH = 4;
export const AR2_STREAK_AT = 30;
export const AR2_POCKETS_MAX = 10;
export const AR2_POCKET_EACH = 5;
/** The core is full at this many ring points: the near-perfect skill-band median (docs/arcade-standard/alleyroll.md). */
export const AR2_CORE_FULL = 550;
export const AR_V2_BAND_CURVE = bandCurve([0, AR2_CORE_FULL], [0, AR2_CORE_MAX]);

export const AR2_STD_SPEC: StdSpec = {
  field: "alleyRollRev",
  rev: ALLEYROLL_REV_RINGER,
  parts: [
    { key: "core", label: "Ring points", max: AR2_CORE_MAX, of: AR2_CORE_FULL, item: "ring point", how: `a straight line, full at ${AR2_CORE_FULL} ring points` },
    { key: "gold", label: "Gold cup", max: AR2_GOLD_MAX, of: 3, item: "gold cup", how: "10 a hit, up to 3" },
    { key: "streak", label: "Roll streak", max: AR2_STREAK_MAX, of: 5, item: "ball", how: "4 for each ball scoring 30 or more straight after another that did, up to 5" },
    { key: "pockets", label: "Pocket hits", max: AR2_POCKETS_MAX, of: 2, item: "pocket", how: "5 each, up to 2" },
  ],
};

export function arInitV2(seed: number): ArState {
  const h = hashInts([seed >>> 0, 0x52696e67]);
  const span = (AR2_GOLD_PERIOD_MAX - AR2_GOLD_PERIOD_MIN) / 2 + 1;
  const gp = AR2_GOLD_PERIOD_MIN + 2 * (h % span);
  const gph = hashInts([h, 7]) % gp;
  const ga = AR2_GOLD_AMP_MIN + (hashInts([h, 11]) % (AR2_GOLD_AMP_MAX - AR2_GOLD_AMP_MIN + 1));
  return { ...arInit(seed), rev: ALLEYROLL_REV_RINGER, gp, gph, ga };
}

/** The gold cup's centre across the board at a tick (1/256 board px): a steady glide end to end and back. */
export function arGoldX256(s: Pick<ArState, "gp" | "gph" | "ga">, tick: number): number {
  const p = s.gp ?? AR2_GOLD_PERIOD_MIN;
  const a = (s.ga ?? AR2_GOLD_AMP_MIN) * 256;
  const half = p / 2;
  const u = (tick + (s.gph ?? 0)) % p;
  return u < half ? -a + Math.trunc((2 * a * u) / half) : a - Math.trunc((2 * a * (u - half)) / half);
}

function inCircle(x: number, y: number, cx: number, cy: number, r: number): boolean {
  const dx = x - cx * 256;
  const dy = y - cy * 256;
  return dx * dx + dy * dy <= r * r * 65536;
}

/**
 * Where a ball coming down from height `z0` to `z1` this tick (1/256 px; moving from (x0, y0) to (x1, y1)) passes
 * through each target's rim, highest first: the points of the first target it passes inside, or null. `goldX` is the
 * gold cup's centre this tick (1/256 px).
 */
function ringerCatch(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, goldX: number): { points: number; x: number; y: number } | null {
  const at = (h: number) => {
    const hz = h * 256;
    if (!(z0 > hz && z1 <= hz)) return null;
    const num = z0 - hz;
    const den = z0 - z1;
    return { x: x0 + Math.trunc(((x1 - x0) * num) / den), y: y0 + Math.trunc(((y1 - y0) * num) / den) };
  };
  const targets: { h: number; test: (x: number, y: number) => number }[] = [];
  for (const cup of AR2_CUPS) if (cup.h > 0) targets.push({ h: cup.h, test: (x, y) => (inCircle(x, y, cup.cx, cup.cy, cup.r) ? cup.points : -1) });
  targets.push({ h: AR2_GOLD_H, test: (x, y) => { const dx = x - goldX; const dy = y - AR2_GOLD_Y * 256; return dx * dx + dy * dy <= AR2_GOLD_R * AR2_GOLD_R * 65536 ? AR2_GOLD_POINTS : -1; } });
  targets.sort((p, q) => q.h - p.h);
  for (const t of targets) {
    const p = at(t.h);
    if (!p) continue;
    const pts = t.test(p.x, p.y);
    if (pts >= 0) return { points: pts, ...p };
  }
  const floor = at(0);
  if (!floor) return null;
  for (const p of AR2_POCKETS) if (inCircle(floor.x, floor.y, p.x, p.y, AR2_POCKET_R)) return { points: AR_POCKET_POINTS, ...floor };
  const ring = AR2_CUPS[AR2_CUPS.length - 1]!;
  return { points: inCircle(floor.x, floor.y, ring.cx, ring.cy, ring.r) ? ring.points : 0, ...floor };
}

/** One tick of flight over the board (the side walls, the back wall at half speed, gravity). */
function flyStep(s: ArState): { x: number; vx: number; y: number; vy: number; z: number; vz: number } {
  const w = bounce(s.x + s.vx, s.vx, AR_BOARD_HALF);
  let y = s.y + s.vy;
  let vy = s.vy;
  const back = (AR_BOARD_D - AR_BALL_R) * 256;
  if (y > back) {
    y = 2 * back - y;
    vy = -Math.abs(Math.trunc(vy / 2));
  }
  const vz = s.vz - AR_GRAVITY;
  return { x: w.pos, vx: w.vel, y, vy, z: s.z + vz, vz };
}

/**
 * Rolling up the lane (as rev 1), but off the ramp the ball leaves from the lip itself: the part of the tick already
 * past the lip counts as flight (its lift so far), so a little more speed always carries a little further.
 */
function rollV2(s: ArState): ArState {
  const vy = Math.max(1, s.vy - AR_SLOPE);
  const w = bounce(s.x + s.vx, s.vx, AR_LANE_HALF);
  const y = s.y + vy;
  if (y >= AR_RAMP_Y * 256) {
    const past = y - AR_RAMP_Y * 256;
    const lift = Math.trunc(vy / AR_LIFT_DIV);
    // The share of the tick already flown: its lift so far and gravity's pull over it.
    const vz = lift - Math.trunc((AR_GRAVITY * past) / vy);
    return { ...s, phase: AR_FLY, x: w.pos, vx: w.vel, y: past, vy, z: Math.trunc(((lift + vz) * past) / (2 * vy)), vz, phaseTick: s.tick };
  }
  return { ...s, x: w.pos, vx: w.vel, y, vy };
}

function moveBallV2(s: ArState): ArState {
  if (s.phase === AR_ROLL) return rollV2(s);
  const { x, vx, y, vy, z, vz } = flyStep(s);
  const hit = ringerCatch(s.x, s.y, s.z, x, y, z, arGoldX256(s, s.tick));
  if (hit) {
    const lx = Math.round(hit.x / 256);
    const ly = Math.round(hit.y / 256);
    const balls = s.balls.slice();
    balls[balls.length - 1] = { ...balls[balls.length - 1]!, points: hit.points, x: lx, y: ly };
    return { ...s, phase: AR_SHOW, x: hit.x, vx: 0, y: hit.y, vy: 0, z: 0, vz: 0, phaseTick: s.tick, balls };
  }
  return { ...s, x, vx, y, vy, z, vz };
}

/** Ringer's release point, across and up speeds from an input (the lane, AR2_VMIN–AR2_VMAX, the angle). */
export function arLaunchV2(a: number, b: number, c: number): { x: number; vx: number; vy: number } {
  const vy = clampInt(c, AR2_VMIN, AR2_VMAX);
  const most = Math.floor((vy * AR_MAX_ANGLE_NUM) / AR_MAX_ANGLE_DEN);
  return { x: clampInt(a, -AR_RELEASE_MAX, AR_RELEASE_MAX), vx: clampInt(b, -most, most), vy };
}

function stepV2(state: ArState, input: ArcadeInputEvent | null): ArState {
  if (state.ended) return state;
  let s: ArState = { ...state, tick: state.tick + 1 };
  if (input && input.k === AR_INPUT_ROLL) {
    s.acted = 1;
    if (s.phase === AR_WAIT && s.balls.length < AR_BALLS) {
      const l = arLaunchV2(input.a, input.b, input.c);
      s = { ...s, phase: AR_ROLL, x: l.x * 256, y: 0, vx: l.vx, vy: l.vy, z: 0, vz: 0, phaseTick: s.tick, balls: [...s.balls, { release: l.x, points: 0, x: 0, y: 0 }] };
    } else s.rejects++;
  }
  if (s.phase === AR_ROLL || s.phase === AR_FLY) s = moveBallV2(s);
  else if (s.phase === AR_SHOW && s.tick - s.phaseTick >= AR_SHOW_TICKS) {
    if (s.balls.length >= AR_BALLS) return { ...s, phase: AR_WAIT, ended: 1, endTick: s.tick };
    s = { ...s, phase: AR_WAIT, x: 0, y: 0, phaseTick: s.tick };
  }
  if (!s.ended && s.tick >= AR_RUN_TICKS) s = { ...s, ended: 2, endTick: s.tick };
  return s;
}

export function ringerTotals(s: Pick<ArState, "balls" | "phase">): { rings: number; gold: number; pockets: number; streak: number; balls: number } {
  const done = arScored(s);
  let rings = 0;
  let gold = 0;
  let pockets = 0;
  let streak = 0;
  done.forEach((b, i) => {
    rings += b.points;
    if (b.points === AR2_GOLD_POINTS) gold++;
    if (b.points === AR_POCKET_POINTS) pockets++;
    if (i > 0 && b.points >= AR2_STREAK_AT && done[i - 1]!.points >= AR2_STREAK_AT) streak++;
  });
  return { rings, gold, pockets, streak, balls: done.length };
}

function ringerStdParts(state: ArState): StdPart[] {
  const t = ringerTotals(state);
  return [
    stdPart(AR2_STD_SPEC, "core", stdLine(AR2_CORE_MAX, t.rings, AR2_CORE_FULL), `${t.rings} ring points`),
    stdPart(AR2_STD_SPEC, "gold", stdEach(t.gold, AR2_GOLD_EACH, AR2_GOLD_MAX), `${t.gold} gold cup${t.gold === 1 ? "" : "s"}`),
    stdPart(AR2_STD_SPEC, "streak", stdEach(t.streak, AR2_STREAK_EACH, AR2_STREAK_MAX), `${t.streak} in a row`),
    stdPart(AR2_STD_SPEC, "pockets", stdEach(t.pockets, AR2_POCKET_EACH, AR2_POCKETS_MAX), `${t.pockets} pocket${t.pockets === 1 ? "" : "s"}`),
  ];
}

export const ringerGame: ArcadeGame<ArState, ArcadeInputEvent | null> = {
  ...alleyRollGame,
  init: arInitV2,
  step: stepV2,
  inputRanges: [inputRange(AR_INPUT_ROLL, [-AR_RELEASE_MAX, AR_RELEASE_MAX], [-AR2_VMAX, AR2_VMAX], [AR2_VMIN, AR2_VMAX])],
};

/**
 * Rolls one ball on Ringer's board from release tick `t0` (the input's tick) on seed `seed`'s gold path: where it came
 * down, its points, and the tick it came down on. The oracle, the bots and the checks read it.
 */
export function arSimulateBallV2(a: number, b: number, c: number, seed = 0, t0 = 1): { points: number; x: number; y: number; tick: number } {
  let s: ArState = { ...arInitV2(seed), acted: 1, tick: t0 - 1 };
  s = stepV2(s, { t: t0, k: AR_INPUT_ROLL, a, b, c, d: 0 });
  while (s.phase === AR_ROLL || s.phase === AR_FLY) s = stepV2(s, null);
  const last = s.balls[s.balls.length - 1]!;
  return { points: last.points, x: last.x, y: last.y, tick: s.phaseTick };
}

/**
 * Where a roll passes down through the gold cup's rim height (board px), and the tick offset from the release tick at
 * which it does, the gold cup left out (null when a higher cup catches it first or it never comes down there).
 */
export function arGoldCrossing(a: number, b: number, c: number): { x: number; y: number; dt: number } | null {
  let s: ArState = { ...arInitV2(0), acted: 1 };
  s = stepV2(s, { t: 1, k: AR_INPUT_ROLL, a, b, c, d: 0 });
  while (s.phase === AR_ROLL) s = { ...moveBallV2(s), tick: s.tick + 1 };
  const FAR = 1 << 30;
  while (s.phase === AR_FLY) {
    const f = flyStep(s);
    const hz = AR2_GOLD_H * 256;
    const high = ringerCatch(s.x, s.y, s.z, f.x, f.y, f.z, FAR);
    const crossing = s.z > hz && f.z <= hz;
    if (high && !crossing && high.points !== 0) return null;
    if (crossing) {
      if (high && AR2_CUPS.some((cup) => cup.h > AR2_GOLD_H && cup.points === high.points)) return null;
      const num = s.z - hz;
      const den = s.z - f.z;
      return { x: (s.x + Math.trunc(((f.x - s.x) * num) / den)) / 256, y: (s.y + Math.trunc(((f.y - s.y) * num) / den)) / 256, dt: s.tick };
    }
    if (high) return null;
    s = { ...s, x: f.x, vx: f.vx, y: f.y, vy: f.vy, z: f.z, vz: f.vz, tick: s.tick + 1 };
  }
  return null;
}
