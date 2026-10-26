import { speedBonusCurve } from "../duel/speedPar";
/**
 * Ink Bridge — a ten-level drawing puzzle. Each level a ball waits at a spout
 * above a bucket, with thin grey level blocks in between (a ball touching one
 * stops dead). Strokes arrive as k = 8 events: (a, b) a point in world px,
 * c = 1 to start a stroke there, c = 0 to draw a segment from the pen to that
 * point; each level has a fixed ink budget and lines persist for the level.
 * RELEASE (k = 13, a = a press counter) drops the ball; it rolls along drawn
 * lines. Bucket = next level; lost off the bottom, stopped on a block or
 * stalled = a failed attempt (lines cleared, ink refilled). Three failed
 * attempts end the run. Every level is built at init from the seed and
 * verified solvable within its ink by a stored reference solution run through
 * this same integer physics.
 */

import {
  clampInt,
  finishScore,
  inputRange,
  isqrt,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { BAND_STRICT_MARK, bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";
import { isin, TRIG_ONE } from "./trig";

/* ============================== Constants ============================== */

const FP = 256;
export const INK_WORLD_W = 390;
export const INK_WORLD_H = 620;
export const INK_RUN_TICKS = 120 * TICKS_PER_SECOND;
export const INK_INPUT_STROKE = 8;
export const INK_INPUT_RELEASE = 13;
export const INK_INPUT_UNDO = 14;
export const INK_INPUT_RESET = 15;
export const INK_INPUT_DROP_AGAIN = 16;
/** Live levels only: commits the live draft strokes drawn since the last lift. */
export const INK_INPUT_LIFT = 17;
/** Stroke points closer than this to the pen are not sent. */
export const INK_STEP_PX = 12;
export const INK_LEVELS = 10;
export const INK_FAILS = 3;
const MAX_SEGS = 200;

const BALL_R = 7;
const GRAVITY = 64; // 0.25 px/tick²
/** Friction while rolling: speed loses 3/256 a tick. */
const FRICTION_256 = 3;
const MAX_V = 16 * FP;
const SPOUT_Y = 50;
/** A drop that has not finished after this long is a failed attempt. */
const DROP_MAX = 600;
const PROGRESS_WINDOW = 90;
const PROGRESS_DISTANCE = 6 * FP;

export const INK_BUCKET_W = 64;
export const INK_BUCKET_H = 36;
export const INK_BLOCK_H = 4;
const BLOCK_COUNTS = [1, 2, 3, 3, 4, 5, 6, 7, 7, 8];
/**
 * Birds revision (stored as puzzle.inkRev): obstacles are white birds 6.5 px
 * thick (1.625× the 4 px blocks, kept per obstacle in 1/256 px as `h`), and
 * levels 6–10 have about 30% fewer. Rounds without inkRev keep blocks.
 */
export const INK_REV = 2;
export const INK_BIRD_H_FP = 1_664; // 6.5 px
const BIRD_COUNTS = [1, 2, 3, 3, 4, 4, 4, 5, 5, 6];
/**
 * inkRev 3 ("Rainbow Bridge"): rounds 1–4 reuse old levels 3–6 (stationary
 * pot), 5–8 reuse old levels 7–10 (moving pot), 9–10 are new "live" levels —
 * stationary pot, slightly slower gravity, a shared ink budget 1.5× the usual
 * and a second drawing phase while the ball falls (see INK_INPUT_LIFT).
 * Rounds 1/2 generation and physics are untouched by this revision.
 */
export const INK_REV3 = 3;
/**
 * inkRev 4: inkRev 3's levels, unchanged, plus an optional gold star on four of
 * levels 1–8. Each star sits on the path of a second proved line (a different
 * route from the easy reference) and is never needed to pot the coin. Stars
 * are placed from their own seeded stream, so the levels stay byte-identical.
 */
export const INK_REV4 = 4;
/** Score-band revision (puzzle.inkRev = 5): rev-4 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const INK_REV_BAND = 5;
/** Tuning C (puzzle.inkRev = 6): inkRev 5 play unchanged, scored on INK_V6_BAND_CURVE. */
export const INK_REV_TUNEC = 6;
/** Rev 3 rules (live levels 9–10, shared live ink) apply to rev 3 and rev 4. */
function rev3Rules(rev?: number | null): boolean {
  return rev === INK_REV3 || rev === INK_REV4 || rev === INK_REV_BAND || rev === INK_REV_TUNEC || rev === INK_REV_TARGET || rev === INK_REV_STRICT || rev === INK_REV_EXPAND;
}

/* ================= x200 (inkRev 10, 26 Oct 2026; parked as Expansion E1's inkRev 9) ================= */

/**
 * inkRev 10 ("more sky", docs/expansions/x200-inkbridge.md): the world is 390 × 674 (INK_TALL_H; older rounds keep
 * 620), every level laid out as inkRev 3's with the pot (and so the whole fall below the spout) INK_TALL_DROP px
 * lower, with 9 % more ink, and every line generation proves drawn as a phone sends it (inkPhoneLine) with a hand's
 * margin. The same features on every seed (the seed only places them; buildLevelsRev10): an ink star and
 * INK_SILVER_PER_LEVEL silver coins on a proved bonus line on each of levels 1–8, INK_CLOUD_LEVELS bounce clouds (a
 * capsule INK_CLOUD_HW × INK_CLOUD_R that throws the coin back up; the bonus line there is a trick shot off it),
 * INK_WIND_LEVELS wind zones (a sideways push on a coin in the air), one shamrock, and a hand-drawn live stroke
 * proving each live level. None is ever needed: every level's reference line pots the coin on its own. Level 1 is a
 * warm-up (its misses cost no fail). Scored to 200 (roundMax): the levels on INK_V10_BAND_CURVE (≤ 140) and up to
 * 10 for speed, plus the features' raw points paid on INK_V10_SKILL_PAY (≤ INK_FEATURE_MAX).
 */
export const INK_REV_EXPAND = 10;
export const INK_TALL_H = 674;
/** How much lower every inkRev 10 pot sits (the extra sky): INK_TALL_H − INK_WORLD_H. */
export const INK_TALL_DROP = INK_TALL_H - INK_WORLD_H;
/**
 * inkRev 10 gravity: the usual 64 (and the live levels' 54) scaled by 620 / 674, so a coin falling the taller
 * world's longer drop reaches the pot at the speed it did in the 620 world.
 */
export const INK_TALL_GRAVITY = 59;
export const INK_TALL_LIVE_GRAVITY = 50;
/** Bounce cloud: the core segment's half length and the capsule's radius, px (drawn 52 × 20). */
export const INK_CLOUD_HW = 16;
export const INK_CLOUD_R = 10;
/** Cloud bounce: the normal speed kept (/256), and the least speed it sends the coin away at (1/256 px a tick). */
const CLOUD_BOUNCE_256 = 236;
export const INK_CLOUD_KICK = 5 * 256;
/** The most the features add (the round maximum 200 less the base's 150). */
export const INK_FEATURE_MAX = 50;
/** The world height a round is drawn and played in. */
export function inkWorldHFor(rev?: number | null): number {
  return rev === INK_REV_EXPAND ? INK_TALL_H : INK_WORLD_H;
}
export function inkWorldH(state: { worldH?: number }): number {
  return state.worldH ?? INK_WORLD_H;
}
/** Does this revision carry gold stars (rev 4's four, inkRev 10's ink stars)? */
function starRev(rev?: number | null): boolean {
  return rev === INK_REV4 || rev === INK_REV_EXPAND;
}
/** Star draw radius in px; the coin collects it when its centre comes within STAR_R + coin radius. */
export const INK_STAR_R = 9;
export const INK_STAR_LEVELS = 4;
export const INK_STAR_POINTS = 2;
/** A star must sit at least this far (px) from every point of the easy reference route. */
export const INK_STAR_OFF_ROUTE = 40;
/** Live levels start at this 0-based index under inkRev 3. */
const INK_LIVE_FROM = 8;
/** Gravity on live levels: a little gentler than the usual 64 (1/256 px/tick²). */
export const INK_LIVE_GRAVITY = 54;
/** Shared ink budget multiplier on live levels (pre-release line + live strokes), ×256. */
const INK_LIVE_BUDGET_256 = 384;
/** Pre-release line ink cap on live levels, px: short enough that it alone usually strands the
 * ball well short of the bucket, so the mid-fall live stroke genuinely does the rescuing. */
export const INK_LIVE_PRE_CAP = 170;
/** No-draw zone radius around the ball's current position on live levels: one coin diameter. */
export const INK_NO_DRAW_ZONE_PX = BALL_R * 2;
/** Obstacle thickness in px (render and tests). */
export function inkBlockH(b: InkBlock): number {
  return b.h ? b.h / FP : INK_BLOCK_H;
}
/** Rim caps on the bucket lip (collision circles, as Bin Toss). */
const RIM_R = 4;
/** Rim bounce keeps this share of the normal speed (/256). */
const RIM_BOUNCE_256 = 140;
/** Rounds 9 and 10 (0-based 8, 9): the bucket slides, seeded amplitude and period. */
const SLIDE_FROM = 8;
const SLIDE_AMP_MIN = 28;
const SLIDE_AMP_SPAN = 23;
const SLIDE_PERIOD_MIN = 5 * TICKS_PER_SECOND;
const SLIDE_PERIOD_SPAN = 2 * TICKS_PER_SECOND + 1;

export const INK_INPUT_RANGES: readonly InputRange[] = [
  inputRange(INK_INPUT_STROKE, [0, INK_WORLD_W], [0, INK_WORLD_H], [0, 1]),
  inputRange(INK_INPUT_RELEASE, [0, 255]),
  inputRange(INK_INPUT_UNDO, [0, 255]),
  inputRange(INK_INPUT_RESET, [0, 255]),
  inputRange(INK_INPUT_DROP_AGAIN, [0, 255]),
  inputRange(INK_INPUT_LIFT, [0, 255]),
];
/** inkRev 10: strokes reach the taller world's bottom. */
export const INK_TALL_INPUT_RANGES: readonly InputRange[] = [inputRange(INK_INPUT_STROKE, [0, INK_WORLD_W], [0, 674], [0, 1]), ...INK_INPUT_RANGES.slice(1)];

/** Ink for a level (0-based), px: 500 at level 1 rising to 1,400 at level 10. */
export function inkBudget(level: number): number {
  return 500 + Math.trunc((900 * clampInt(level, 0, INK_LEVELS - 1)) / (INK_LEVELS - 1));
}

/** Is this level (0-based) a "live" level — only true under inkRev 3, rounds 9–10. */
export function inkIsLive(level: number, rev?: number | null): boolean {
  return rev3Rules(rev) && level >= INK_LIVE_FROM;
}

/** Ink for a level, rev-aware: live levels share a budget 1.5× the usual. */
export function inkBudgetFor(level: number, rev?: number | null): number {
  // inkRev 10: 9 % more ink for the taller levels.
  const base = rev === INK_REV_EXPAND ? Math.trunc((inkBudget(level) * 279) / 256) : inkBudget(level);
  return inkIsLive(level, rev) ? Math.trunc((base * INK_LIVE_BUDGET_256) / 256) : base;
}

/** Current slide speed of the bucket, px/tick (0 on a still pot). */
export function inkSlideSpeed(lvl: InkLevel, tick: number): number {
  if (lvl.slideAmp === 0) return 0;
  const a =
    (lvl.slidePhase + Math.trunc(((tick % lvl.slidePeriod) * 65536) / lvl.slidePeriod)) & 65535;
  const da = Math.max(1, Math.trunc(65536 / lvl.slidePeriod));
  return Math.trunc((lvl.slideAmp * (isin((a + da) & 65535) - isin(a))) / TRIG_ONE);
}

/* ================================ Types ================================ */

export interface InkSeg {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Length in px (integer). */
  len: number;
}

export interface InkBlock {
  x0: number;
  x1: number;
  /** Top edge, px. */
  y: number;
  /** Birds revision only: thickness in 1/256 px (absent = 4 px block). */
  h?: number;
}

/** inkRev 10 bounce cloud: centre (px); its capsule core runs INK_CLOUD_HW either side. */
export interface InkCloud {
  x: number;
  y: number;
}

/**
 * inkRev 10 wind zone: a rectangle (px) where a coin in the air is pushed sideways by `ax` (1/256 px a tick²,
 * signed) every tick its centre is inside. A coin rolling on a line is held by the line.
 */
export interface InkWind {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  ax: number;
}

export interface InkLevel {
  /** inkRev 10 only: the world's height (absent = INK_WORLD_H) and the level's gravity (1/256 px a tick²; absent = the caller's). */
  worldH?: number;
  gravity?: number;
  /** inkRev 10 only: bounce clouds, and the proved trick line that pots after bouncing off one. */
  clouds?: InkCloud[];
  trickRef?: number[][];
  trickT0?: number;
  /** inkRev 10 only: the level's wind zone, its silver coins (+2 each) and the run's one shamrock (+20), every one
   * on the path of the level's proved bonus line (starRef, which also takes the star). */
  wind?: InkWind;
  silver?: { x: number; y: number }[];
  shamrock?: { x: number; y: number };
  /** inkRev 10 live levels only: the hand-drawn live stroke that, after the pre-release line `ref`, pots the coin
   * (drawn from `start` ticks after RELEASE, a phone point a tick; handLive). */
  liveHand?: { start: number; pts: number[] }[];
  spoutX: number;
  bucketX: number;
  /** Bucket rim, px. */
  bucketY: number;
  blocks: InkBlock[];
  /** Slide amplitude (px, 0 = still), period (ticks) and phase (angle units). */
  slideAmp: number;
  slidePeriod: number;
  slidePhase: number;
  /** Reference solution: strokes as flat [x, y, x, y …] point lists, and a release tick that lands it.
   * Live levels only: this is the *pre-release* line (one stroke). */
  ref: number[][];
  refT0: number;
  /** Rev 4 only: the gold star (px) and the proved line through it (strokes and release tick). */
  star?: { x: number; y: number };
  starRef?: number[][];
  starT0?: number;
  /** Live levels only: up to two live strokes completing the route, each fired as
   * STROKE(down)/STROKE(point)/LIFT starting at `tick` ticks after release (LIFT lands on
   * `tick + 2`, i.e. the stroke is committed two ticks after the first point is drawn). */
  liveRef?: { tick: number; pts: number[] }[];
}

export interface InkBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Index into segs of the line it is rolling on, or −1. */
  on: number;
  /** Position along that line and speed along it, 1/256 px. */
  u: number;
  sp: number;
  stall: number;
}

/** Earliest contact of a moving point with a capsule, in continuous sub-tick time. */
function capsuleContact(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  seg: InkSeg,
): number | null {
  const ax = seg.x0 * FP,
    ay = seg.y0 * FP,
    bx = seg.x1 * FP,
    by = seg.y1 * FP;
  const radius = (BALL_R + 3) * FP;
  // A quick miss (x200, 26 Oct 2026, speed only): a contact below needs some point of the move within the radius
  // (plus a hair) of the segment, so when the move's box and the segment's box are further apart than that on
  // either axis the answer is null, exactly as the full test gives. Every revision plays identically.
  const pad = radius + 2 * FP;
  if (Math.max(x0, x1) < Math.min(ax, bx) - pad || Math.min(x0, x1) > Math.max(ax, bx) + pad || Math.max(y0, y1) < Math.min(ay, by) - pad || Math.min(y0, y1) > Math.max(ay, by) + pad) return null;
  const dx = x1 - x0,
    dy = y1 - y0,
    sx = bx - ax,
    sy = by - ay;
  const lengthSq = sx * sx + sy * sy;
  const distanceSq = (t: number) => {
    const px = x0 + dx * t,
      py = y0 + dy * t;
    const u = Math.max(0, Math.min(1, ((px - ax) * sx + (py - ay) * sy) / lengthSq));
    return (px - ax - u * sx) ** 2 + (py - ay - u * sy) ** 2;
  };
  // Already touching this capsule (e.g. just rolled off its end): only new entries collide.
  if (distanceSq(0) <= radius * radius) return null;
  // The earliest candidate in [0, 1] that really touches (the same answer as trying them in ascending order;
  // speed only: no candidate list, filtered and sorted copy).
  let best: number | null = null;
  const consider = (t: number) => {
    if (t < 0 || t > 1 || (best !== null && t >= best)) return;
    if (distanceSq(Math.min(1, t + 0.00001)) <= radius * radius + 1) best = t;
  };
  // Infinite strip: solve the crossing of either parallel offset line.
  const cross0 = (x0 - ax) * sy - (y0 - ay) * sx;
  const crossV = dx * sy - dy * sx;
  if (crossV !== 0)
    for (let sign = -1; sign <= 1; sign += 2) {
      const t = (sign * radius * Math.sqrt(lengthSq) - cross0) / crossV;
      if (t >= 0 && t <= 1) consider(t);
    }
  // Rounded caps: solve the moving-point vs circle quadratic, including vertical lines.
  const a = dx * dx + dy * dy;
  if (a !== 0)
    for (let end = 0; end < 2; end++) {
      const ox = x0 - (end === 0 ? ax : bx),
        oy = y0 - (end === 0 ? ay : by);
      const b = 2 * (ox * dx + oy * dy),
        c = ox * ox + oy * oy - radius * radius;
      const disc = b * b - 4 * a * c;
      if (disc >= 0) consider((-b - Math.sqrt(disc)) / (2 * a));
    }
  return best;
}

/* =============================== Physics =============================== */

/** Normal pointing up out of a segment (px, unnormalised), or null for a vertical line. */
function upNormal(seg: InkSeg): [number, number] | null {
  const dx = seg.x1 - seg.x0;
  const dy = seg.y1 - seg.y0;
  if (dx > 0) return [dy, -dx];
  if (dx < 0) return [-dy, dx];
  return null;
}

/** Signed height above the line (1/256 px) and position along it (1/256 px). */
function relate(seg: InkSeg, x: number, y: number, n: readonly [number, number]) {
  const rx = x - seg.x0 * FP;
  const ry = y - seg.y0 * FP;
  const along = Math.trunc((rx * (seg.x1 - seg.x0) + ry * (seg.y1 - seg.y0)) / seg.len);
  const height = Math.trunc((rx * n[0] + ry * n[1]) / seg.len);
  return { along, height };
}

function placeOn(ball: InkBall, seg: InkSeg): void {
  const n = upNormal(seg)!;
  ball.x =
    seg.x0 * FP +
    Math.trunc(((seg.x1 - seg.x0) * ball.u) / seg.len) +
    Math.trunc((n[0] * BALL_R * FP) / seg.len);
  ball.y =
    seg.y0 * FP +
    Math.trunc(((seg.y1 - seg.y0) * ball.u) / seg.len) +
    Math.trunc((n[1] * BALL_R * FP) / seg.len);
}

/** The segment continuing a stroke past one end of seg i, or −1. */
function joined(segs: readonly InkSeg[], i: number, forward: boolean): number {
  const seg = segs[i]!;
  if (forward) {
    const j = i + 1;
    const next = segs[j];
    if (next && next.x0 === seg.x1 && next.y0 === seg.y1 && upNormal(next)) return j;
  } else {
    const j = i - 1;
    const prev = segs[j];
    if (prev && prev.x1 === seg.x0 && prev.y1 === seg.y0 && upNormal(prev)) return j;
  }
  return -1;
}

function touchesBlock(ball: InkBall, b: InkBlock): boolean {
  const cx = clampInt(ball.x, b.x0 * FP, b.x1 * FP);
  const cy = clampInt(ball.y, b.y * FP, b.y * FP + (b.h ?? INK_BLOCK_H * FP));
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  const r = BALL_R * FP;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Pushes a free ball out of any line it has sunk into (closer than its radius,
 * less a pixel of slack so a ball resting on a line is left alone). Vertical
 * lines act as walls: horizontal speed is killed and the ball slides down.
 * Sloped or flat lines approached from above catch the ball. Returns true if
 * the ball landed on a line.
 */
function clampOut(ball: InkBall, segs: readonly InkSeg[], prevX: number): boolean {
  const r = (BALL_R - 1) * FP;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!;
    // Speed only: a ball further than r from the segment's box on either axis is further than r from it (skipped below too).
    if ((ball.x < seg.x0 * FP - r && ball.x < seg.x1 * FP - r) || (ball.x > seg.x0 * FP + r && ball.x > seg.x1 * FP + r) || (ball.y < seg.y0 * FP - r && ball.y < seg.y1 * FP - r) || (ball.y > seg.y0 * FP + r && ball.y > seg.y1 * FP + r)) continue;
    const ax = seg.x0 * FP,
      ay = seg.y0 * FP,
      sx = (seg.x1 - seg.x0) * FP,
      sy = (seg.y1 - seg.y0) * FP;
    const lenSq = sx * sx + sy * sy;
    const t =
      lenSq > 0 ? Math.max(0, Math.min(1, ((ball.x - ax) * sx + (ball.y - ay) * sy) / lenSq)) : 0;
    const cx = ax + sx * t,
      cy = ay + sy * t;
    let dx = ball.x - cx,
      dy = ball.y - cy;
    const distSq = dx * dx + dy * dy;
    if (distSq >= r * r) continue;
    const n = upNormal(seg);
    let dist = Math.sqrt(distSq);
    if (dist < 1) {
      // Dead centre: push to the side the ball came from (walls) or upward.
      if (n) {
        dx = n[0];
        dy = n[1];
      } else {
        dx = prevX < ax ? -1 : 1;
        dy = 0;
      }
      dist = Math.hypot(dx, dy);
    }
    ball.x = Math.trunc(cx + (dx * BALL_R * FP) / dist);
    ball.y = Math.trunc(cy + (dy * BALL_R * FP) / dist);
    if (!n) {
      ball.vx = 0;
      continue;
    }
    if (relate(seg, ball.x, ball.y, n).height > 0 && ball.vy >= 0 && t > 0 && t < 1) {
      ball.on = i;
      ball.u = clampInt(relate(seg, ball.x, ball.y, n).along, 0, seg.len * FP);
      ball.sp = Math.trunc((ball.vx * (seg.x1 - seg.x0) + ball.vy * (seg.y1 - seg.y0)) / seg.len);
      placeOn(ball, seg);
      return true;
    }
    // Underside or a cap: lose the speed into the line.
    const nx = dx / dist,
      ny = dy / dist;
    const into = ball.vx * nx + ball.vy * ny;
    if (into < 0) {
      ball.vx = Math.trunc(ball.vx - into * nx);
      ball.vy = Math.trunc(ball.vy - into * ny);
    }
  }
  return false;
}

/** Bucket centre x (px) on a tick: fixed, or a seeded slow slide in rounds 9–10. */
export function inkBucketX(lvl: InkLevel, tick: number): number {
  if (lvl.slideAmp === 0) return lvl.bucketX;
  const a =
    (lvl.slidePhase + Math.trunc(((tick % lvl.slidePeriod) * 65536) / lvl.slidePeriod)) & 65535;
  return lvl.bucketX + Math.trunc((lvl.slideAmp * isin(a)) / TRIG_ONE);
}

/** Bounce the ball off the two rim caps; returns true if it struck one. */
function rimBounce(ball: InkBall, bx: number, by: number): boolean {
  let struck = false;
  for (const cx of [bx - INK_BUCKET_W / 2, bx + INK_BUCKET_W / 2]) {
    const dx = ball.x - cx * FP;
    const dy = ball.y - by * FP;
    const reach = (BALL_R + RIM_R) * FP;
    if (Math.abs(dx) >= reach || Math.abs(dy) >= reach) continue;
    const d = isqrt(dx * dx + dy * dy);
    if (d >= reach) continue;
    struck = true;
    const nx = d > 0 ? Math.trunc((dx * 1024) / d) : 0;
    const ny = d > 0 ? Math.trunc((dy * 1024) / d) : -1024;
    // Push out to the surface, then reflect the inward part of the velocity.
    ball.x = cx * FP + Math.trunc((nx * reach) / 1024);
    ball.y = by * FP + Math.trunc((ny * reach) / 1024);
    const vn = Math.trunc((ball.vx * nx + ball.vy * ny) / 1024);
    if (vn < 0) {
      const k = vn + Math.trunc((vn * RIM_BOUNCE_256) / 256);
      ball.vx = Math.trunc(ball.vx - (k * nx) / 1024);
      ball.vy = Math.trunc(ball.vy - (k * ny) / 1024);
    }
    ball.on = -1;
    ball.u = 0;
    ball.sp = 0;
  }
  return struck;
}

/**
 * inkRev 10: bounce the coin off the first cloud it touches; returns that cloud's index or −1. The coin
 * is pushed out to the capsule's surface and the inward part of its velocity reflected, keeping
 * CLOUD_BOUNCE_256 of it and leaving at INK_CLOUD_KICK at least (springy: a coin rolling on a line is
 * thrown off it too). Integer maths only.
 */
function cloudBounce(ball: InkBall, clouds: readonly InkCloud[], segs: readonly InkSeg[]): number {
  for (let i = 0; i < clouds.length; i++) {
    const cl = clouds[i]!;
    const cx = clampInt(ball.x, (cl.x - INK_CLOUD_HW) * FP, (cl.x + INK_CLOUD_HW) * FP);
    const cy = cl.y * FP;
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const reach = (INK_CLOUD_R + BALL_R) * FP;
    if (Math.abs(dx) >= reach || Math.abs(dy) >= reach) continue;
    const d = isqrt(dx * dx + dy * dy);
    if (d >= reach) continue;
    const nx = d > 0 ? Math.trunc((dx * 1024) / d) : 0;
    const ny = d > 0 ? Math.trunc((dy * 1024) / d) : -1024;
    const seg = ball.on >= 0 ? segs[ball.on] : undefined;
    if (seg) {
      // Rolling: its speed along the line becomes a free velocity.
      ball.vx = Math.trunc(((seg.x1 - seg.x0) * ball.sp) / seg.len);
      ball.vy = Math.trunc(((seg.y1 - seg.y0) * ball.sp) / seg.len);
    }
    ball.x = cx + Math.trunc((nx * reach) / 1024);
    ball.y = cy + Math.trunc((ny * reach) / 1024);
    ball.on = -1;
    ball.u = 0;
    ball.sp = 0;
    const vn = Math.trunc((ball.vx * nx + ball.vy * ny) / 1024);
    if (vn >= 0) return -1; // already leaving: pushed clear, no bounce
    const out = Math.max(INK_CLOUD_KICK, Math.trunc((-vn * CLOUD_BOUNCE_256) / 256));
    const k = out - vn;
    ball.vx = clampInt(ball.vx + Math.trunc((k * nx) / 1024), -MAX_V, MAX_V);
    ball.vy = clampInt(ball.vy + Math.trunc((k * ny) / 1024), -MAX_V, MAX_V);
    return i;
  }
  return -1;
}

/** One tick of the ball: 0 still going, 1 in the bucket, 2 failed. Mutates ball. */
function moveBall(
  ball: InkBall,
  segs: readonly InkSeg[],
  lvl: InkLevel,
  tick = 0,
  gravity = GRAVITY,
  hit?: { cloud: number },
): number {
  // inkRev 10 levels carry their own (gentler) gravity, so every caller plays them alike.
  if (lvl.gravity !== undefined) gravity = lvl.gravity;
  const px = ball.x;
  const py = ball.y;
  const seg = ball.on >= 0 ? segs[ball.on] : undefined;
  if (seg) {
    // Rolling: gravity along the line, fixed friction, onward along the stroke or off the end.
    ball.sp += Math.trunc((gravity * (seg.y1 - seg.y0)) / seg.len);
    ball.sp -= Math.trunc((ball.sp * FRICTION_256) / 256);
    ball.sp = clampInt(ball.sp, -MAX_V, MAX_V);
    ball.u += ball.sp;
    ball.stall = 0;
    if (ball.u < 0 || ball.u > seg.len * FP) {
      const forward = ball.u > 0;
      const j = joined(segs, ball.on, forward);
      const next = j >= 0 ? segs[j]! : null;
      const dot = next
        ? (seg.x1 - seg.x0) * (next.x1 - next.x0) + (seg.y1 - seg.y0) * (next.y1 - next.y0)
        : 0;
      if (next && dot > 0) {
        const over = forward ? ball.u - seg.len * FP : -ball.u;
        ball.sp = Math.trunc((ball.sp * dot) / (seg.len * next.len));
        ball.on = j;
        ball.u = forward ? Math.min(over, next.len * FP) : Math.max(0, next.len * FP - over);
        placeOn(ball, next);
      } else {
        ball.u = clampInt(ball.u, 0, seg.len * FP);
        placeOn(ball, seg);
        ball.vx = Math.trunc(((seg.x1 - seg.x0) * ball.sp) / seg.len);
        ball.vy = Math.trunc(((seg.y1 - seg.y0) * ball.sp) / seg.len);
        ball.on = -1;
      }
    } else placeOn(ball, seg);
  } else {
    ball.on = -1;
    ball.stall = 0;
    ball.vy = Math.min(MAX_V, ball.vy + gravity);
    // inkRev 10: a wind zone pushes a coin in the air sideways while its centre is inside.
    const w = lvl.wind;
    if (w && ball.x >= w.x0 * FP && ball.x <= w.x1 * FP && ball.y >= w.y0 * FP && ball.y <= w.y1 * FP) ball.vx = clampInt(ball.vx + w.ax, -MAX_V, MAX_V);
    const steps = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) / ((BALL_R * FP) / 2)));
    for (let sub = 1; sub <= steps; sub++) {
      const startX = ball.x,
        startY = ball.y;
      const endX = px + Math.trunc((ball.vx * sub) / steps);
      const endY = py + Math.trunc((ball.vy * sub) / steps);
      let first = 2,
        firstIndex = -1;
      // capsuleContact's quick miss, inlined (speed only: a segment this test skips gives null there too).
      const pad = (BALL_R + 5) * FP;
      const loX = Math.min(startX, endX) - pad,
        hiX = Math.max(startX, endX) + pad,
        loY = Math.min(startY, endY) - pad,
        hiY = Math.max(startY, endY) + pad;
      for (let i = 0; i < segs.length; i++) {
        const sg = segs[i]!;
        if ((sg.x0 * FP < loX && sg.x1 * FP < loX) || (sg.x0 * FP > hiX && sg.x1 * FP > hiX) || (sg.y0 * FP < loY && sg.y1 * FP < loY) || (sg.y0 * FP > hiY && sg.y1 * FP > hiY)) continue;
        const contact = capsuleContact(startX, startY, endX, endY, sg);
        if (contact !== null && contact < first) {
          first = contact;
          firstIndex = i;
        }
      }
      ball.x = endX;
      ball.y = endY;
      if (firstIndex >= 0) {
        const line = segs[firstIndex]!;
        const hitX = startX + Math.trunc((endX - startX) * first);
        const hitY = startY + Math.trunc((endY - startY) * first);
        const n = upNormal(line);
        if (n && relate(line, startX, startY, n).height >= 0 && ball.vy >= 0) {
          ball.on = firstIndex;
          ball.u = clampInt(relate(line, hitX, hitY, n).along, 0, line.len * FP);
          ball.sp = Math.trunc(
            (ball.vx * (line.x1 - line.x0) + ball.vy * (line.y1 - line.y0)) / line.len,
          );
          placeOn(ball, line);
        } else {
          // A vertical wall or underside still stops the ball rather than tunnelling.
          ball.x = hitX;
          ball.y = hitY;
          // A vertical line is a wall the ball slides down.
          if (!n) ball.vx = 0;
          else ball.vy = -Math.trunc(ball.vy / 2);
        }
        if (ball.on < 0) clampOut(ball, segs, startX);
        break;
      }
      if (clampOut(ball, segs, startX)) break;
    }
    if (ball.x < BALL_R * FP || ball.x > (INK_WORLD_W - BALL_R) * FP) {
      ball.x = clampInt(ball.x, BALL_R * FP, (INK_WORLD_W - BALL_R) * FP);
      ball.vx = 0;
    }
  }
  // Speed only: a bird's box grown by the coin's radius must hold the coin's centre before touchesBlock can say yes.
  const reachB = BALL_R * FP;
  for (const b of lvl.blocks) {
    if (ball.y < b.y * FP - reachB || ball.x < b.x0 * FP - reachB || ball.x > b.x1 * FP + reachB || ball.y > b.y * FP + (b.h ?? INK_BLOCK_H * FP) + reachB) continue;
    if (touchesBlock(ball, b)) return 2;
  }
  if (lvl.clouds) {
    const c = cloudBounce(ball, lvl.clouds, segs);
    if (c >= 0) {
      if (hit) hit.cloud = c;
      return 0;
    }
  }
  // The pot only matters within its rim caps' reach of the rim's height, or crossing it (speed only: the pot's
  // place is worked out just then; rimBounce strikes nothing further away).
  const nearRim = Math.abs(ball.y - lvl.bucketY * FP) < (BALL_R + RIM_R) * FP;
  const crossing = py < lvl.bucketY * FP && ball.y >= lvl.bucketY * FP;
  if (nearRim || crossing) {
    const bucketX = inkBucketX(lvl, tick);
    if (nearRim && rimBounce(ball, bucketX, lvl.bucketY)) return 0;
    // Into the bucket between its rim caps, or past the bottom.
    if (crossing) {
      const x = Math.trunc(ball.x / FP);
      if (Math.abs(x - bucketX) <= INK_BUCKET_W / 2 - BALL_R) return 1;
    }
  }
  if (ball.y > ((lvl.worldH ?? INK_WORLD_H) + BALL_R) * FP) return 2;
  return 0;
}

function spoutBall(lvl: InkLevel): InkBall {
  return { x: lvl.spoutX * FP, y: SPOUT_Y * FP, vx: 0, vy: 0, on: -1, u: 0, sp: 0, stall: 0 };
}

/** Pen state for stroke building, shared by the sim and the generator. */
interface Pen {
  segs: InkSeg[];
  strokeStarts: number[];
  penX: number;
  penY: number;
  penDown: number;
  ink: number;
}

/** `inPlace` (strokeSegs' own pen only, speed only): add the segment to the pen's list rather than to a copy of it. */
function addStroke(p: Pen, x: number, y: number, start: boolean, inPlace = false): void {
  if (start) {
    p.strokeStarts.push(p.segs.length);
    p.penX = x;
    p.penY = y;
    p.penDown = 1;
    return;
  }
  if (!p.penDown) return;
  let dx = x - p.penX;
  let dy = y - p.penY;
  let len = isqrt(dx * dx + dy * dy);
  if (len < 1) return;
  if (len * FP > p.ink) {
    // Out of ink: the stroke stops where the ink runs out.
    const have = Math.trunc(p.ink / FP);
    p.penDown = 0;
    if (have < 2) return;
    dx = Math.trunc((dx * have) / len);
    dy = Math.trunc((dy * have) / len);
    len = isqrt(dx * dx + dy * dy);
    if (len < 1) return;
  }
  if (p.segs.length >= MAX_SEGS) return;
  p.ink -= len * FP;
  const seg = { x0: p.penX, y0: p.penY, x1: p.penX + dx, y1: p.penY + dy, len };
  if (inPlace) p.segs.push(seg);
  else p.segs = [...p.segs, seg];
  p.penX += dx;
  p.penY += dy;
}

/** Runs a drop with fixed lines released on tick t0: 1 bucket, 2 failed. */
function simulateDrop(
  lvl: InkLevel,
  segs: readonly InkSeg[],
  t0 = 0,
  gravity = GRAVITY,
): number {
  // inkRev 10 levels (the only ones with their own world height) also fail a stalled coin, as play does.
  if (lvl.worldH !== undefined) return dropWithHit(lvl, segs, t0, undefined, gravity).result;
  const ball = spoutBall(lvl);
  for (let t = 0; t < DROP_MAX; t++) {
    const r = moveBall(ball, segs, lvl, t0 + t + 1, gravity);
    if (r) return r;
  }
  return 2;
}

function strokeSegs(ref: readonly number[][], ink: number): Pen {
  const pen: Pen = { segs: [], strokeStarts: [], penX: 0, penY: 0, penDown: 0, ink: ink * FP };
  for (const pts of ref) {
    addStroke(pen, pts[0]!, pts[1]!, true, true);
    for (let i = 2; i < pts.length; i += 2) addStroke(pen, pts[i]!, pts[i + 1]!, false, true);
  }
  return pen;
}

/* =============================== Levels ================================ */

type Draw = (bound: number) => number;

function blockOverlaps(a: InkBlock, b: InkBlock): boolean {
  return a.x0 < b.x1 + 16 && b.x0 < a.x1 + 16 && Math.abs(a.y - b.y) < 30;
}

function layout(
  level: number,
  count: number,
  draw: Draw,
  h?: number,
  forceSlide = false,
  drop = 0,
): InkLevel {
  const spoutX = 60 + draw(271);
  let bucketX = 50 + draw(291);
  if (Math.abs(bucketX - spoutX) < 100)
    bucketX =
      spoutX < 195 ? Math.min(340, spoutX + 100 + draw(60)) : Math.max(50, spoutX - 100 - draw(60));
  // inkRev 10 (drop > 0): the pot sits lower in the taller world, so the fall (and every bird range) is longer.
  const bucketY = 470 + drop + draw(81);
  let slideAmp = 0;
  let slidePeriod = 1;
  let slidePhase = 0;
  if (forceSlide || level >= SLIDE_FROM) {
    bucketX = clampInt(bucketX, 72, INK_WORLD_W - 72);
    // Keep the whole slide (bucket plus rim) on screen.
    const room = Math.min(bucketX, INK_WORLD_W - bucketX) - INK_BUCKET_W / 2 - RIM_R - 4;
    slideAmp = Math.max(0, Math.min(SLIDE_AMP_MIN + draw(SLIDE_AMP_SPAN), room));
    slidePeriod = SLIDE_PERIOD_MIN + draw(SLIDE_PERIOD_SPAN);
    slidePhase = draw(65536);
  }
  const mouth = INK_BUCKET_W / 2 + 10 + slideAmp;
  const blocks: InkBlock[] = [];
  // Block 0 sits right under the spout, so a straight fall never works.
  const len0 = 60 + draw(81);
  let x0 = clampInt(spoutX - 10 - draw(len0 - 20), 0, INK_WORLD_W - len0);
  if (x0 > spoutX - BALL_R) x0 = spoutX - BALL_R - 2;
  if (x0 + len0 < spoutX + BALL_R) x0 = spoutX + BALL_R + 2 - len0;
  blocks.push({ x0, x1: x0 + len0, y: SPOUT_Y + 90 + draw(Math.min(160, 60 + level * 12)), ...(h ? { h } : {}) });
  for (let k = 1, tries = 0; k < count && tries < 60; tries++) {
    const len = 60 + draw(141);
    const bx = draw(INK_WORLD_W - len + 1);
    const by = 130 + draw(Math.max(1, bucketY - 50 - 130));
    const b: InkBlock = { x0: bx, x1: bx + len, y: by, ...(h ? { h } : {}) };
    // Keep the bucket mouth and the spout column above block 0 clear.
    if (by > bucketY - 60 && bx < bucketX + mouth && bx + len > bucketX - mouth) continue;
    if (blocks.some((o) => blockOverlaps(o, b))) continue;
    blocks.push(b);
    k++;
  }
  return { ...(drop ? { worldH: INK_WORLD_H + drop } : {}), spoutX, bucketX, bucketY, blocks, slideAmp, slidePeriod, slidePhase, ref: [], refT0: 0 };
}

/** Candidate reference strokes: a ramp under the spout to above the bucket, optionally via a waypoint. */
function findReference(
  lvl: InkLevel,
  ink: number,
  gravity = GRAVITY,
): { ref: number[][]; t0: number } | null {
  const dir = lvl.bucketX > lvl.spoutX ? 1 : -1;
  const sx = lvl.spoutX - dir * 24;
  const sy = SPOUT_Y + 28;
  const ends: number[] = [];
  for (const off of [0, -12, 12, -24, 24, -36, 36, -48]) ends.push(lvl.bucketX - dir * off);
  const lifts = [14, 26, 44, 70];
  const way: (readonly [number, number])[] = [];
  for (const fy of [25, 45, 65])
    for (const fx of [-60, -20, 20, 60, 110]) {
      way.push([lvl.spoutX + dir * fx, sy + Math.trunc(((lvl.bucketY - sy) * fy) / 100)]);
    }
  // Screen candidates against the still bucket (one drop each); a sliding level then needs a
  // release, among 16 over one slide period, that lands with the bucket moving.
  const still: InkLevel = { ...lvl, slideAmp: 0 };
  // inkRev 10 (speed only): the candidates through one waypoint share their first leg, and a drop that ends far
  // from the second leg on the first one ends the same with it (stillDrop).
  const shared = lvl.worldH !== undefined ? new Map<number, PrefixRun>() : null;
  for (const w of [null, ...way]) {
    for (const lift of lifts) {
      for (const ex of ends) {
        const ey = lvl.bucketY - lift;
        const pts = w ? [sx, sy, w[0], w[1], ex, ey] : [sx, sy, ex, ey];
        if (w && (w[0] < 4 || w[0] > INK_WORLD_W - 4 || w[1] >= ey - 10)) continue;
        const ref = [pts];
        const pen = strokeSegs(ref, ink);
        if (pen.penDown === 0) continue; // ran out of ink
        if ((shared ? sharedDrop(still, pen.segs, gravity, shared) : simulateDrop(still, pen.segs, 0, gravity)) !== 1) continue;
        if (!lvl.slideAmp) return { ref, t0: 0 };
        const t0 = landingRelease(lvl, pen.segs, gravity);
        if (t0 >= 0) return { ref, t0 };
      }
    }
  }
  return null;
}

/**
 * A drop on a stroke's first segment alone, released on tick 0: its result, and the coin before every tick (and at
 * the end) so a drop with more segments can pick it up from any tick.
 */
interface PrefixRun {
  result: number;
  balls: InkBall[];
  /** The tick in which the coin rolled off the segment's far end (where a second leg would carry it on), or −1. */
  offEnd: number;
}

/** Squared distance (1/256 px squared) from a point to a segment (px). */
function segDistance2(seg: InkSeg, x: number, y: number): number {
  const ax = seg.x0 * FP;
  const ay = seg.y0 * FP;
  const sx = (seg.x1 - seg.x0) * FP;
  const sy = (seg.y1 - seg.y0) * FP;
  const lengthSq = sx * sx + sy * sy;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((x - ax) * sx + (y - ay) * sy) / lengthSq)) : 0;
  const dx = x - ax - sx * t;
  const dy = y - ay - sy * t;
  return dx * dx + dy * dy;
}

/**
 * A no-path drop picked up on tick `from` with the coin as `ball` and its earlier positions `before` (the coin before
 * each tick so far): the rest of dropWithHit's run, the same rules in the same order (the stall rule reads those
 * earlier positions as dropWithHit's ring would hold them).
 */
function dropFrom(lvl: InkLevel, segs: readonly InkSeg[], gravity: number, from: number, start: InkBall, before: readonly InkBall[], t0 = 0): number {
  const ball: InkBall = { ...start };
  const rx: number[] = new Array<number>(PROGRESS_WINDOW).fill(0);
  const ry: number[] = new Array<number>(PROGRESS_WINDOW).fill(0);
  for (let k = Math.max(0, from - PROGRESS_WINDOW + 1); k < from; k++) {
    rx[k % PROGRESS_WINDOW] = before[k]!.x;
    ry[k % PROGRESS_WINDOW] = before[k]!.y;
  }
  let floor = (lvl.bucketY + RIM_R + BALL_R + 2) * FP;
  for (const sg of segs) floor = Math.max(floor, (Math.max(sg.y0, sg.y1) + BALL_R + 6) * FP);
  for (const cl of lvl.clouds ?? []) floor = Math.max(floor, (cl.y + INK_CLOUD_R + BALL_R + 2) * FP);
  for (let t = from; t < DROP_MAX; t++) {
    rx[t % PROGRESS_WINDOW] = ball.x;
    ry[t % PROGRESS_WINDOW] = ball.y;
    const r = moveBall(ball, segs, lvl, t0 + t + 1, gravity);
    if (r) return r;
    if (ball.on < 0 && ball.vy >= 0 && ball.y > floor) return 2;
    const o = (t + 1) % PROGRESS_WINDOW;
    if (t >= PROGRESS_WINDOW - 1 && Math.hypot(ball.x - rx[o]!, ball.y - ry[o]!) <= PROGRESS_DISTANCE) return 2;
  }
  return 2;
}

/**
 * inkRev 10 generation (speed only): the result of a still-pot drop from tick 0 on `segs`, sharing the run on their
 * first segment alone. A later segment takes part in a tick only when the coin is within its reach (10 px) of it at
 * some moment of that tick — every moment of a tick lies within 32 px of where the coin began it — or when the coin
 * rolls off the first segment's far end onto it; until the first tick that begins within 50 px of a later segment or
 * leaves that end, the drop runs exactly as on the first segment alone, so it is picked up from there (or, when that
 * never happens, ends as that run ended).
 */
function sharedDrop(lvl: InkLevel, segs: readonly InkSeg[], gravity: number, cache: Map<number, PrefixRun>, m = 1, prefixKey?: number): number {
  if (segs.length <= m || m < 1 || lvl.clouds?.length || lvl.wind) return simulateDrop(lvl, segs, 0, gravity);
  const first = segs[0]!;
  // The cache holds runs of one level and one family's prefixes: the caller names a longer prefix by its own key.
  const key = prefixKey ?? (((first.x0 + 1024) * 4096 + first.y0 + 1024) * 4096 + first.x1 + 1024) * 4096 + first.y1 + 1024;
  let run = cache.get(key);
  if (!run) {
    const prefix = segs.slice(0, m);
    const ball = spoutBall(lvl);
    const balls: InkBall[] = [];
    let offEnd = -1;
    let result = 2;
    const rx: number[] = new Array<number>(PROGRESS_WINDOW).fill(0);
    const ry: number[] = new Array<number>(PROGRESS_WINDOW).fill(0);
    for (let t = 0; t < DROP_MAX; t++) {
      balls.push({ ...ball });
      rx[t % PROGRESS_WINDOW] = ball.x;
      ry[t % PROGRESS_WINDOW] = ball.y;
      const wasOn = ball.on;
      const r = moveBall(ball, prefix, lvl, t + 1, gravity);
      if (offEnd < 0 && wasOn === m - 1 && ball.on < 0 && ball.u !== 0) offEnd = t;
      if (r) {
        result = r;
        break;
      }
      const o = (t + 1) % PROGRESS_WINDOW;
      if (t >= PROGRESS_WINDOW - 1 && Math.hypot(ball.x - rx[o]!, ball.y - ry[o]!) <= PROGRESS_DISTANCE) break;
    }
    balls.push({ ...ball });
    run = { result, balls, offEnd };
    cache.set(key, run);
  }
  const far = (50 * FP) ** 2;
  // The first tick that may differ: one that begins near a later segment, or the one rolling off the far end.
  // (balls ends with the coin after the run's last tick, which began far enough already when the run ended early.)
  const last = run.offEnd >= 0 ? run.offEnd : run.balls.length - 1;
  // The later segments' box grown by 50 px: a coin outside it is further than 50 px from all of them.
  let loX = Infinity,
    hiX = -Infinity,
    loY = Infinity,
    hiY = -Infinity;
  for (let j = m; j < segs.length; j++) {
    const sg = segs[j]!;
    loX = Math.min(loX, sg.x0 * FP, sg.x1 * FP);
    hiX = Math.max(hiX, sg.x0 * FP, sg.x1 * FP);
    loY = Math.min(loY, sg.y0 * FP, sg.y1 * FP);
    hiY = Math.max(hiY, sg.y0 * FP, sg.y1 * FP);
  }
  loX -= 50 * FP;
  hiX += 50 * FP;
  loY -= 50 * FP;
  hiY += 50 * FP;
  for (let i = 0; i < last; i++) {
    const b = run.balls[i]!;
    if (b.x < loX || b.x > hiX || b.y < loY || b.y > hiY) continue;
    for (let j = m; j < segs.length; j++) if (segDistance2(segs[j]!, b.x, b.y) <= far) return dropFrom(lvl, segs, gravity, i, b, run.balls);
  }
  if (run.offEnd >= 0) return dropFrom(lvl, segs, gravity, run.offEnd, run.balls[run.offEnd]!, run.balls);
  return run.result;
}

/**
 * inkRev 10 (speed only): landingRelease on a moving pot. The pot is the only thing that moves, and the coin meets it
 * only within 11 px of its rim (the rim caps' reach) or crossing its rim's height, so every release plays the same
 * ticks as the still pot until the first tick that begins within 45 px of the rim's height (a tick's travel and
 * settling stay under 32 px); each of the 16 releases is picked up from there with the pot moving.
 */
function movingRelease(lvl: InkLevel, segs: readonly InkSeg[], gravity: number): number {
  const still: InkLevel = { ...lvl, slideAmp: 0 };
  const ball = spoutBall(still);
  const balls: InkBall[] = [];
  const near = (lvl.bucketY - 45) * FP;
  let from = -1;
  let result = 2;
  const rx: number[] = new Array<number>(PROGRESS_WINDOW).fill(0);
  const ry: number[] = new Array<number>(PROGRESS_WINDOW).fill(0);
  for (let t = 0; t < DROP_MAX; t++) {
    balls.push({ ...ball });
    if (ball.y >= near) {
      from = t;
      break;
    }
    rx[t % PROGRESS_WINDOW] = ball.x;
    ry[t % PROGRESS_WINDOW] = ball.y;
    const r = moveBall(ball, segs, still, t + 1, gravity);
    if (r) {
      result = r;
      break;
    }
    const o = (t + 1) % PROGRESS_WINDOW;
    if (t >= PROGRESS_WINDOW - 1 && Math.hypot(ball.x - rx[o]!, ball.y - ry[o]!) <= PROGRESS_DISTANCE) break;
  }
  const tries = 16;
  for (let k = 0; k < tries; k++) {
    const t0 = Math.trunc((k * lvl.slidePeriod) / tries);
    // Ended before nearing the pot: every release ends the same way.
    const r = from < 0 ? result : dropFrom(lvl, segs, gravity, from, balls[from]!, balls, t0);
    if (r === 1) return t0;
  }
  return -1;
}

/** First of 16 evenly spaced release ticks over one slide period that lands; −1 if none. */
function landingRelease(lvl: InkLevel, segs: readonly InkSeg[], gravity = GRAVITY): number {
  if (lvl.worldH !== undefined && lvl.slideAmp) return movingRelease(lvl, segs, gravity);
  const tries = lvl.slideAmp ? 16 : 1;
  for (let k = 0; k < tries; k++) {
    const t0 = Math.trunc((k * lvl.slidePeriod) / tries);
    if (simulateDrop(lvl, segs, t0, gravity) === 1) return t0;
  }
  return -1;
}

/** Does any release over one slide period land with no lines? */
function landsUnaided(lvl: InkLevel, gravity = GRAVITY): boolean {
  return landingRelease(lvl, [], gravity) >= 0;
}

/** inkRev 10 (speed only): simulateStaged's drop on fixed lines, the coin before every tick, and how it ended. */
function ballsOf(lvl: InkLevel, segs: readonly InkSeg[], gravity: number): { balls: InkBall[]; result: number } {
  const ball = spoutBall(lvl);
  const balls: InkBall[] = [];
  for (let t = 0; t < DROP_MAX; t++) {
    balls.push({ ...ball });
    const r = moveBall(ball, segs, lvl, t + 1, gravity);
    if (r) return { balls, result: r };
  }
  return { balls, result: 2 };
}

/**
 * inkRev 10 (speed only): simulateStaged with two stages, the first line set until tick `at` and `segs` from it,
 * picked up from the first set's own drop (`pre`): exactly the same ticks, run from the coin as tick `at` began.
 */
function stagedFrom(lvl: InkLevel, segs: readonly InkSeg[], gravity: number, at: number, pre: { balls: InkBall[]; result: number }): number {
  // simulateStaged's loop index t plays tick t + 1; the later set first plays tick `at` (index at − 1).
  const from = Math.max(0, at - 1);
  if (from >= pre.balls.length) return pre.result;
  const ball: InkBall = { ...pre.balls[from]! };
  for (let t = from; t < DROP_MAX; t++) {
    const r = moveBall(ball, segs, lvl, t + 1, gravity);
    if (r) return r;
  }
  return 2;
}

/** Runs a drop whose line set changes mid-flight: `stages` is sorted by tick, stages[0].tick === 0. */
function simulateStaged(lvl: InkLevel, stages: { tick: number; segs: readonly InkSeg[] }[], gravity = GRAVITY): number {
  const ball = spoutBall(lvl);
  let segs = stages[0]?.segs ?? [];
  let si = 1;
  for (let t = 0; t < DROP_MAX; t++) {
    const tick = t + 1;
    while (si < stages.length && stages[si]!.tick <= tick) {
      segs = stages[si]!.segs;
      si++;
    }
    const r = moveBall(ball, segs, lvl, tick, gravity);
    if (r) return r;
  }
  return 2;
}

/** Ball trace (position + which line it is on, if any) tick by tick for a fixed line set. */
function traceDrop(
  lvl: InkLevel,
  segs: readonly InkSeg[],
  gravity = GRAVITY,
): { x: number; y: number; on: number }[] {
  const ball = spoutBall(lvl);
  const trace: { x: number; y: number; on: number }[] = [{ x: ball.x, y: ball.y, on: ball.on }];
  for (let t = 0; t < DROP_MAX; t++) {
    const r = moveBall(ball, segs, lvl, t + 1, gravity);
    trace.push({ x: ball.x, y: ball.y, on: ball.on });
    if (r) break;
  }
  return trace;
}

/**
 * Samples many candidate pre-release lines (single stroke from near the spout, every
 * direction, several lengths up to `cap`) and reports whether any of them alone lands
 * the ball in the bucket. Used both to validate shield placement at generation time and
 * to pick layouts where the live stroke is genuinely required.
 */
const PRE_SAMPLE_ANGLES = 8;
const PRE_SAMPLE_LEN_FRACS = [1];
function anyPreAloneWins(lvl: InkLevel, cap: number, gravity: number): boolean {
  // Capped at 3 starts × 8 angles × 1 length = 24 sampled lines (speed: keeps init p95 low).
  const starts: [number, number][] = [
    [lvl.spoutX, SPOUT_Y + 10],
    [lvl.spoutX - 24, SPOUT_Y + 28],
    [lvl.spoutX + 24, SPOUT_Y + 28],
  ];
  for (const [sx, sy] of starts) {
    for (let a = 0; a < PRE_SAMPLE_ANGLES; a++) {
      const theta = (a / PRE_SAMPLE_ANGLES) * Math.PI * 2;
      for (const frac of PRE_SAMPLE_LEN_FRACS) {
        const len = Math.round(cap * frac);
        const ex = clampInt(sx + Math.round(Math.cos(theta) * len), 0, INK_WORLD_W);
        const ey = clampInt(sy + Math.round(Math.sin(theta) * len), 0, lvl.worldH ?? INK_WORLD_H);
        const pen = strokeSegs([[sx, sy, ex, ey]], cap);
        if (pen.segs.length === 0) continue;
        if (simulateDrop(lvl, pen.segs, 0, gravity) === 1) return true;
      }
    }
  }
  return false;
}

/**
 * Live-level reference: a pre-release line (one stroke, from the spout to a waypoint) that by
 * itself should usually fail, plus one live stroke (waypoint to the bucket) drawn and lifted
 * once the ball has rolled off the pre-release line, respecting the no-draw zone at every tick
 * the stroke is drawn. Prefers candidates where the pre-release line alone does NOT win.
 */
function findLiveReference(
  lvl: InkLevel,
  ink: number,
  gravity: number,
): { ref: number[][]; t0: number; liveRef: { tick: number; pts: number[] }[]; preAlone: boolean } | null {
  const dir = lvl.bucketX > lvl.spoutX ? 1 : -1;
  const sx = lvl.spoutX - dir * 24;
  const sy = SPOUT_Y + 28;
  const ends: number[] = [];
  for (const off of [0, -12, 12, -24, 24, -36, 36, -48]) ends.push(lvl.bucketX - dir * off);
  const lifts = [14, 26, 44, 70];
  // Waypoints stay in the top half of the fall and close to the spout column: the
  // pre-release line alone should strand the ball well short of the bucket, so landing
  // takes a genuine mid-fall correction (not just a longer single line).
  const way: (readonly [number, number])[] = [];
  for (const fy of [20, 32, 44])
    for (const fx of [-36, -16, 16, 36, 60])
      way.push([lvl.spoutX + dir * fx, sy + Math.trunc(((lvl.bucketY - sy) * fy) / 100)]);
  const zone = INK_NO_DRAW_ZONE_PX + 2;
  let fallback: ReturnType<typeof findLiveReference> = null;
  for (const w of way) {
    if (w[0] < 4 || w[0] > INK_WORLD_W - 4) continue;
    const ref1 = [[sx, sy, w[0], w[1]]];
    // Cap the pre-release line's own ink well below the full live budget: the line
    // must stop short of the bucket on its own, so it genuinely needs the live stroke.
    const pen1 = strokeSegs(ref1, Math.min(ink, INK_LIVE_PRE_CAP));
    if (pen1.penDown !== 1) continue; // the pre-release line must fit fully within its cap
    const used1 = pen1.segs.reduce((sum, seg) => sum + seg.len, 0) * FP;
    const remaining = ink * FP - used1; // full live budget minus the capped pre-release line
    if (remaining < FP * 8) continue;
    const trace = traceDrop(lvl, pen1.segs, gravity);
    // inkRev 10 (speed only): the pre-release line's own drop, the coin before every tick, so each candidate's
    // staged drop is picked up on the tick its live stroke turns solid (the ticks before it are this drop's).
    const preRun = lvl.worldH !== undefined ? ballsOf(lvl, pen1.segs, gravity) : null;
    let drawTick = -1;
    for (let t = 1; t < trace.length; t++) {
      if (trace[t - 1]!.on === 0 && trace[t]!.on === -1) {
        drawTick = t + 2;
        break;
      }
    }
    if (drawTick < 0 || drawTick + 2 >= trace.length - 1) continue;
    // The live stroke is a catch ramp drawn just beneath the falling ball (a stroke
    // starting at the pre-line's end would sit inside the no-draw ring as the ball
    // leaves it), placed a few ticks into the fall and leading to the pot.
    const catches: { t: number; x: number; y: number }[] = [];
    for (const d of [2, 8, 16]) {
      const t = drawTick + d;
      if (t + 3 >= trace.length - 1) break;
      const p = trace[t + 2]!;
      for (const dy0 of [26, 44])
        for (const dx0 of [6]) {
          const cx = Math.round(p.x / FP) + dir * dx0;
          const cy = Math.round(p.y / FP) + dy0;
          if (cx >= 2 && cx <= INK_WORLD_W - 2 && cy < (lvl.worldH ?? INK_WORLD_H)) catches.push({ t, x: cx, y: cy });
        }
    }
    for (const cat of catches) {
    for (const lift of lifts) {
      for (const ex of ends) {
        const ey = lvl.bucketY - lift;
        if (cat.y >= ey - 10) continue;
        const ref2 = [[cat.x, cat.y, ex, ey]];
        const pen2 = strokeSegs(ref2, Math.trunc(remaining / FP));
        if (pen2.penDown !== 1) continue;
        let safe = true;
        // Real step() checks the no-draw zone against the ball position *before* that
        // tick's physics update runs: the STROKE(down) event at physics tick `drawTick`
        // sees the position after tick drawTick-1, and STROKE(point) at drawTick+1 sees
        // the position after tick drawTick. Mirror that here (checked against both
        // endpoints, with one extra tick of margin either side).
        for (const tt of [cat.t - 1, cat.t, cat.t + 1]) {
          const p = trace[Math.max(0, Math.min(tt, trace.length - 1))]!;
          if (Math.hypot(p.x / FP - cat.x, p.y / FP - cat.y) < zone) safe = false;
          if (Math.hypot(p.x / FP - ex, p.y / FP - ey) < zone) safe = false;
        }
        if (!safe) continue;
        const actTick = cat.t + 2;
        const result = preRun
          ? stagedFrom(lvl, [...pen1.segs, ...pen2.segs], gravity, actTick, preRun)
          : simulateStaged(
              lvl,
              [
                { tick: 0, segs: pen1.segs },
                { tick: actTick, segs: [...pen1.segs, ...pen2.segs] },
              ],
              gravity,
            );
        if (result !== 1) continue;
        const preAlone = simulateDrop(lvl, pen1.segs, 0, gravity) === 1;
        const candidate = { ref: ref1, t0: 0, liveRef: [{ tick: cat.t, pts: ref2[0]! }], preAlone };
        if (!preAlone) return candidate;
        if (!fallback) fallback = candidate;
      }
    }
    }
  }
  return fallback;
}

/** Test hook: does the live reference (pre-release + live strokes) land, and does the
 * pre-release line alone also land (reported as a share across seeds)? */
export function inkLiveReferenceCheck(seed: number): { ok: number; preAloneWins: number; liveLevels: number } {
  const { list } = buildLevels(seed, INK_REV3);
  let ok = 0,
    preAloneWins = 0,
    liveLevels = 0;
  list.forEach((lvl, i) => {
    if (!inkIsLive(i, INK_REV3)) return;
    liveLevels++;
    const gravity = INK_LIVE_GRAVITY;
    const budget = inkBudgetFor(i, INK_REV3);
    const pen1 = strokeSegs(lvl.ref, budget);
    const preAlone = pen1.penDown === 1 && simulateDrop(lvl, pen1.segs, lvl.refT0, gravity) === 1;
    if (preAlone) preAloneWins++;
    let segs: InkSeg[] = pen1.segs;
    let usedInk = pen1.segs.reduce((sum, seg) => sum + seg.len, 0) * FP;
    let fits = pen1.penDown === 1;
    const stages: { tick: number; segs: readonly InkSeg[] }[] = [{ tick: 0, segs }];
    for (const ev of lvl.liveRef ?? []) {
      const pen2 = strokeSegs([ev.pts], Math.trunc((budget * FP - usedInk) / FP));
      if (pen2.penDown !== 1) {
        fits = false;
        break;
      }
      segs = [...segs, ...pen2.segs];
      usedInk += pen2.segs.reduce((sum, seg) => sum + seg.len, 0) * FP;
      stages.push({ tick: ev.tick + 2, segs });
    }
    if (fits && simulateStaged(lvl, stages, gravity) === 1 && !landsUnaided(lvl, gravity)) ok++;
  });
  return { ok, preAloneWins, liveLevels };
}

/** Rev-3 level plan: 1–4 reuse old levels 3–6 stationary, 5–8 reuse old levels 7–10
 * (inkRev2 bird counts) with a forced moving pot, 9–10 are new live levels (stationary,
 * gentler gravity, hardest block count, shared live ink budget). */
function buildLevelsRev3(
  seed: number,
  drop = 0,
  rev = INK_REV3,
  /** inkRev 10 only: decorates a made level with its features, or null to try the next layout. */
  accept?: (lvl: InkLevel, level: number) => InkLevel | null,
): { list: InkLevel[]; rng: number } {
  let rng = seed | 0;
  const draw: Draw = (bound) => {
    const r = rngBelow(rng, Math.max(1, bound));
    rng = r.state;
    return r.value;
  };
  const list: InkLevel[] = [];
  for (let i = 0; i < INK_LEVELS; i++) {
    let sourceLevel: number;
    let forceSlide = false;
    let live = false;
    if (i < 4) {
      sourceLevel = i + 2;
    } else if (i < 8) {
      sourceLevel = i + 2;
      forceSlide = true;
    } else {
      sourceLevel = INK_LEVELS - 1;
      live = true;
    }
    // Every round under inkRev 3 draws white birds, never the old red blocks.
    const counts: readonly number[] = BIRD_COUNTS;
    const h = INK_BIRD_H_FP;
    const gravity = live ? INK_LIVE_GRAVITY : GRAVITY;
    const count = counts[sourceLevel]!;
    const ink = inkBudgetFor(i, rev);
    let made: InkLevel | null = null;
    for (let attempt = 0; attempt < (live ? 48 : 120) && !made; attempt++) {
      const c = Math.max(1, count - Math.trunc(attempt / 20));
      let lvl = layout(sourceLevel, c, draw, h, forceSlide, drop);
      if (drop) lvl.gravity = live ? INK_TALL_LIVE_GRAVITY : INK_TALL_GRAVITY;
      if (live) {
        // A shield block straddling the spout column, between the pre-release
        // waypoints (within ±60 px of the spout) and the bucket: a pre-release line
        // alone sends the ball on a course that this shield intercepts, so reaching
        // the bucket genuinely needs the live stroke to route around it.
        const shieldY = SPOUT_Y + 28 + Math.trunc(((lvl.bucketY - (SPOUT_Y + 28)) * 78) / 100);
        const shield: InkBlock = {
          x0: Math.max(0, lvl.spoutX - 70),
          x1: Math.min(INK_WORLD_W, lvl.spoutX + 70),
          y: shieldY,
          ...(h ? { h } : {}),
        };
        // The shield row always exists: birds it would overlap give way to it.
        lvl.blocks = [...lvl.blocks.filter((o) => !blockOverlaps(o, shield)), shield];
      }
      if (landsUnaided(lvl, gravity)) continue;
      if (live) {
        // Adversarial gate: reject this layout/shield combo outright if any sampled
        // pre-release line (any direction, up to the cap) already wins alone.
        if (anyPreAloneWins(lvl, INK_LIVE_PRE_CAP, gravity)) continue;
        const found = findLiveReference(lvl, ink, gravity);
        if (found) made = { ...lvl, ref: found.ref, refT0: found.t0, liveRef: found.liveRef };
      } else {
        const found = findReference(lvl, ink, gravity);
        if (found) made = { ...lvl, ref: found.ref, refT0: found.t0 };
      }
      if (made && accept) made = accept(made, i);
    }
    if (!made) {
      // Last resort: an open layout with no obstacles between spout and bucket column,
      // so a pre-release line short enough for INK_LIVE_PRE_CAP always exists, and (for
      // live levels) the fallback route is still built live — pre-cap aware with a real
      // liveRef — never a plain over-cap single-stroke solve.
      const spoutX = 120;
      const lvl: InkLevel = {
        ...(drop ? { worldH: INK_WORLD_H + drop, gravity: live ? INK_TALL_LIVE_GRAVITY : INK_TALL_GRAVITY } : {}),
        spoutX,
        bucketX: 300,
        bucketY: 540 + drop,
        blocks: live
          ? [{ x0: Math.max(0, spoutX - 70), x1: Math.min(INK_WORLD_W, spoutX + 70), y: 420 + drop, h }]
          : [{ x0: 90, x1: 150, y: 200, h }],
        slideAmp: 0,
        slidePeriod: 1,
        slidePhase: 0,
        ref: [],
        refT0: 0,
      };
      if (live) {
        const found = findLiveReference(lvl, ink, gravity);
        if (found) {
          made = { ...lvl, ref: found.ref, refT0: found.t0, liveRef: found.liveRef };
        } else {
          // Degenerate but cap/shield-aware: a short pre-release line that alone falls
          // short, finished off by one live stroke straight into the bucket.
          const preEnd: [number, number] = [spoutX, SPOUT_Y + 28 + 120];
          made = {
            ...lvl,
            ref: [[spoutX, SPOUT_Y + 28, preEnd[0], preEnd[1]]],
            refT0: 0,
            liveRef: [{ tick: 6, pts: [preEnd[0], preEnd[1], lvl.bucketX, lvl.bucketY - 20] }],
          };
        }
      } else {
        const found = findReference(lvl, ink, gravity);
        made = { ...lvl, ref: found?.ref ?? [[96, 78, 300, 526 + drop]], refT0: found?.t0 ?? 0 };
      }
      if (accept) made = accept(made, i) ?? made;
    }
    list.push(made);
  }
  return { list, rng };
}

/** Squared distance (px²) from a point to a bird's rectangle. */
function blockDistance2(b: InkBlock, x: number, y: number): number {
  const top = b.y;
  const bottom = b.y + Math.ceil(inkBlockH(b));
  const dx = x < b.x0 ? b.x0 - x : x > b.x1 ? x - b.x1 : 0;
  const dy = y < top ? top - y : y > bottom ? y - bottom : 0;
  return dx * dx + dy * dy;
}

/**
 * Rev 4: a star for this (non-live) level, or null. Tries candidate lines in a
 * seeded order; a candidate must pot the coin within the level's ink (with a
 * timed release on a moving pot). The star goes at the point of its path
 * farthest from the easy reference route, at least INK_STAR_OFF_ROUTE away,
 * clear of every bird and well above the pot.
 */
function placeStar(lvl: InkLevel, level: number, draw: Draw, rev = INK_REV4): Pick<InkLevel, "star" | "starRef" | "starT0"> | null {
  const ink = inkBudgetFor(level, rev);
  const still: InkLevel = { ...lvl, slideAmp: 0 };
  const refTrace = traceDrop(still, strokeSegs(lvl.ref, ink).segs);
  const dir = lvl.bucketX > lvl.spoutX ? 1 : -1;
  const sy = SPOUT_Y + 28;
  const candidates: number[][] = [];
  for (const sx of [lvl.spoutX - dir * 24, lvl.spoutX + dir * 24, lvl.spoutX - dir * 48]) {
    for (const fy of [30, 50, 70])
      for (const fx of [-120, -80, -40, 0, 40, 80, 120, 160]) {
        const wx = lvl.spoutX + dir * fx;
        const wy = sy + Math.trunc(((lvl.bucketY - sy) * fy) / 100);
        for (const lift of [14, 30, 50])
          for (const off of [0, -16, 16]) candidates.push([sx, sy, wx, wy, lvl.bucketX - dir * off, lvl.bucketY - lift]);
      }
  }
  // Seeded order, so every room tries the same lines in the same order.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = draw(i + 1);
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  // The reference route in whole px, every other tick (it moves under 16 px a tick, far below the 40 px gap).
  const refPts = refTrace.filter((_, i) => i % 2 === 0).map((r) => [Math.trunc(r.x / FP), Math.trunc(r.y / FP)] as const);
  for (const pts of candidates.slice(0, 220)) {
    if (pts[2]! < 4 || pts[2]! > INK_WORLD_W - 4 || pts[3]! >= pts[5]! - 10) continue;
    const ref = [pts];
    const pen = strokeSegs(ref, ink);
    if (pen.penDown === 0) continue;
    // One walk gives both the outcome and the path.
    const ball = spoutBall(still);
    const path: { x: number; y: number }[] = [];
    let outcome = 0;
    for (let t = 0; t < DROP_MAX && !outcome; t++) {
      outcome = moveBall(ball, pen.segs, still, t + 1);
      path.push({ x: ball.x, y: ball.y });
    }
    if (outcome !== 1) continue;
    const t0 = lvl.slideAmp ? landingRelease(lvl, pen.segs) : 0;
    if (t0 < 0) continue;
    let best: { x: number; y: number } | null = null;
    let bestD = -1;
    for (const p of path) {
      const x = Math.trunc(p.x / FP);
      const y = Math.trunc(p.y / FP);
      if (y < SPOUT_Y + 40 || y > lvl.bucketY - 40 || x < 14 || x > INK_WORLD_W - 14) continue;
      let near = Infinity;
      for (const [rx, ry] of refPts) {
        const d = (rx - x) * (rx - x) + (ry - y) * (ry - y);
        if (d < near) near = d;
        if (near < INK_STAR_OFF_ROUTE * INK_STAR_OFF_ROUTE) break;
      }
      if (near < INK_STAR_OFF_ROUTE * INK_STAR_OFF_ROUTE + 4 * INK_STAR_OFF_ROUTE) continue;
      if (lvl.blocks.some((b) => blockDistance2(b, x, y) < (INK_STAR_R + BALL_R + 4) ** 2)) continue;
      if (near > bestD) {
        bestD = near;
        best = { x, y };
      }
    }
    if (best) return { star: best, starRef: ref, starT0: t0 };
  }
  return null;
}

/** Rev 4: inkRev 3's levels with stars added on their own seeded stream. */
function buildLevelsRev4(seed: number): { list: InkLevel[]; rng: number } {
  const base = buildLevelsRev3(seed);
  let srng = (seed ^ 0x51a7b5) | 0;
  const draw: Draw = (bound) => {
    const r = rngBelow(srng, Math.max(1, bound));
    srng = r.state;
    return r.value;
  };
  const order = Array.from({ length: INK_LIVE_FROM }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = draw(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const list = base.list.map((lvl) => ({ ...lvl }));
  let placed = 0;
  for (const level of order) {
    if (placed >= INK_STAR_LEVELS) break;
    const star = placeStar(list[level]!, level, draw);
    if (!star) continue;
    list[level] = { ...list[level]!, ...star };
    placed++;
  }
  return { list, rng: base.rng };
}

/* ---------------------- inkRev 10: bounce clouds and stars ---------------------- */

/** Levels (of 1–8) that get a bounce cloud (exactly, on inkRev 10). */
export const INK_CLOUD_LEVELS = 4;
/** Seeded ramps (cloud places) tried per level. */
const CLOUD_TRIES = 16;
/** A trick line must still work moved by each of these (px), at least TRICK_STEADY of them. */
const TRICK_WOBBLE = [[3, 0], [-3, 0], [0, 3], [0, -3]] as const;
const TRICK_STEADY = 3;

/** A drop with a fixed line set released on tick t0, reporting the first cloud bounce (tick, or −1) and the path. */
function dropWithHit(
  lvl: InkLevel,
  segs: readonly InkSeg[],
  t0 = 0,
  path?: { x: number; y: number }[],
  gravity = GRAVITY,
): { result: number; hitAt: number } {
  return dropRun(lvl, segs, t0, path, gravity, 0, spoutBall(lvl), NO_BALLS, -1);
}
const NO_BALLS: readonly InkBall[] = [];

/**
 * dropWithHit's drop picked up on tick `from` (speed only): the coin as `start`, its positions before each earlier
 * tick in `before`, and the first cloud bounce so far `hitAt0`; from 0 with the spout's coin it is the whole drop.
 * Every later tick runs exactly as dropWithHit's would.
 */
function dropRun(
  lvl: InkLevel,
  segs: readonly InkSeg[],
  t0: number,
  path: { x: number; y: number }[] | undefined,
  gravity: number,
  from: number,
  start: InkBall,
  before: readonly InkBall[],
  hitAt0: number,
): { result: number; hitAt: number } {
  const ball: InkBall = { ...start };
  const hit = { cloud: hitAt0 >= 0 ? 0 : -1 };
  let hitAt = hitAt0;
  // The step's stall rule too (a coin that moves 6 px or less over PROGRESS_WINDOW ticks has failed), so a coin
  // resting on a line fails here when it would in play, without running out the clock.
  const rx: number[] = new Array<number>(PROGRESS_WINDOW).fill(0);
  const ry: number[] = new Array<number>(PROGRESS_WINDOW).fill(0);
  for (let k = Math.max(0, from - PROGRESS_WINDOW + 1); k < from; k++) {
    rx[k % PROGRESS_WINDOW] = before[k]!.x;
    ry[k % PROGRESS_WINDOW] = before[k]!.y;
  }
  // A coin in the air moving down below every line, the pot's rim and every cloud can only fall out of the world
  // (gravity only adds downward speed, and nothing else it can meet sends it up), so the drop has failed there:
  // without a path to record, it ends at once (speed only: the same result and cloud tick as running it out).
  let floor = (lvl.bucketY + RIM_R + BALL_R + 2) * FP;
  if (!path) {
    for (const sg of segs) floor = Math.max(floor, (Math.max(sg.y0, sg.y1) + BALL_R + 6) * FP);
    for (const cl of lvl.clouds ?? []) floor = Math.max(floor, (cl.y + INK_CLOUD_R + BALL_R + 2) * FP);
  }
  for (let t = from; t < DROP_MAX; t++) {
    rx[t % PROGRESS_WINDOW] = ball.x;
    ry[t % PROGRESS_WINDOW] = ball.y;
    const r = moveBall(ball, segs, lvl, t0 + t + 1, gravity, hit);
    if (hit.cloud >= 0 && hitAt < 0) hitAt = t;
    path?.push({ x: ball.x, y: ball.y });
    if (r) return { result: r, hitAt };
    if (!path && ball.on < 0 && ball.vy >= 0 && ball.y > floor) return { result: 2, hitAt };
    // The oldest of the last PROGRESS_WINDOW positions (the step's positions[0]).
    const o = (t + 1) % PROGRESS_WINDOW;
    if (t >= PROGRESS_WINDOW - 1 && Math.hypot(ball.x - rx[o]!, ball.y - ry[o]!) <= PROGRESS_DISTANCE) return { result: 2, hitAt };
  }
  return { result: 2, hitAt };
}

/**
 * The still pot's drop up to the first tick that begins within 45 px of the rim's height (speed only): until then a
 * moving pot's drop from any release plays the same ticks (the pot is the only thing that moves, and the coin meets
 * it only within 11 px of the rim's height or crossing it; a tick's travel and settling stay under 32 px). `from` is
 * that tick (−1 when the drop ended before it, as `ended`), with the coin before every tick, the path and the first
 * cloud bounce so far.
 */
function stillPrefix(lvl: InkLevel, segs: readonly InkSeg[], gravity: number): { from: number; balls: InkBall[]; path: Pt[]; hitAt: number; ended: { result: number; hitAt: number } } {
  const still: InkLevel = { ...lvl, slideAmp: 0 };
  const ball = spoutBall(still);
  const balls: InkBall[] = [];
  const path: Pt[] = [];
  const hit = { cloud: -1 };
  let hitAt = -1;
  const near = (lvl.bucketY - 45) * FP;
  const rx: number[] = new Array<number>(PROGRESS_WINDOW).fill(0);
  const ry: number[] = new Array<number>(PROGRESS_WINDOW).fill(0);
  for (let t = 0; t < DROP_MAX; t++) {
    balls.push({ ...ball });
    if (ball.y >= near) return { from: t, balls, path, hitAt, ended: { result: 2, hitAt } };
    rx[t % PROGRESS_WINDOW] = ball.x;
    ry[t % PROGRESS_WINDOW] = ball.y;
    const r = moveBall(ball, segs, still, t + 1, gravity, hit);
    if (hit.cloud >= 0 && hitAt < 0) hitAt = t;
    path.push({ x: ball.x, y: ball.y });
    if (r) return { from: -1, balls, path, hitAt, ended: { result: r, hitAt } };
    const o = (t + 1) % PROGRESS_WINDOW;
    if (t >= PROGRESS_WINDOW - 1 && Math.hypot(ball.x - rx[o]!, ball.y - ry[o]!) <= PROGRESS_DISTANCE) return { from: -1, balls, path, hitAt, ended: { result: 2, hitAt } };
  }
  return { from: -1, balls, path, hitAt, ended: { result: 2, hitAt } };
}

/** Squared distance (px²) from a point to a cloud's core segment. */
function cloudDistance2(cl: InkCloud, x: number, y: number): number {
  const dx = x < cl.x - INK_CLOUD_HW ? cl.x - INK_CLOUD_HW - x : x > cl.x + INK_CLOUD_HW ? x - cl.x - INK_CLOUD_HW : 0;
  const dy = y - cl.y;
  return dx * dx + dy * dy;
}

/** The first of 16 release ticks over one slide period that pots after a cloud bounce; −1 if none. */
function trickRelease(lvl: InkLevel, segs: readonly InkSeg[]): number {
  for (let k = 0; k < 16; k++) {
    const t0 = Math.trunc((k * lvl.slidePeriod) / 16);
    const d = dropWithHit(lvl, segs, t0);
    if (d.result === 1 && d.hitAt >= 0) return t0;
  }
  return -1;
}

type CloudFind = { cloud: InkCloud; trickRef: number[][]; trickT0: number; path: { x: number; y: number }[]; hitAt: number };

/**
 * inkRev 10: a bounce cloud for this (non-live) level and its proved trick line, or null. The cloud is
 * set where a seeded ramp's coin falls (so the ramp's coin lands on its top); a place is kept only when
 * it is clear of every bird, the pot and the reference route, the coin still never pots unaided, the
 * reference line still pots (with its own release) without touching the cloud, and the trick line (the
 * ramp, plus a catch ramp under the coin's fall after the bounce if needed) pots after the bounce within
 * the level's ink.
 */
function placeCloud(lvl: InkLevel, level: number, draw: Draw): CloudFind | null {
  const ink = inkBudgetFor(level, INK_REV_EXPAND);
  const refSegs = strokeSegs(lvl.ref, ink).segs;
  const still: InkLevel = { ...lvl, slideAmp: 0 };
  const refPts = traceDrop(still, refSegs).map((r) => [Math.trunc(r.x / FP), Math.trunc(r.y / FP)] as const);
  const dir = lvl.bucketX > lvl.spoutX ? 1 : -1;
  const clearRef = INK_CLOUD_R + BALL_R + 8;
  const top = SPOUT_Y + 100;
  const gap = 14;
  for (let attempt = 0; attempt < CLOUD_TRIES; attempt++) {
    // A seeded ramp from beside the spout, mostly toward the pot.
    const rd = draw(4) === 0 ? -dir : dir;
    const sx = lvl.spoutX - rd * 24;
    const sy = SPOUT_Y + 28;
    const ex = clampInt(sx + rd * (40 + draw(150)), 6, INK_WORLD_W - 6);
    const ey = sy + 24 + draw(Math.max(1, Math.min(220, lvl.bucketY - 200 - sy)));
    const pick = draw(1000);
    const ramp = [sx, sy, ex, ey];
    const pen = strokeSegs([ramp], ink);
    if (pen.penDown === 0 || pen.segs.length === 0) continue;
    // Where its coin falls: descending, off the line, in the band where a cloud may sit.
    const fall: { x: number; y: number }[] = [];
    let wasOn = false;
    const ball = spoutBall(still);
    for (let t = 0; t < DROP_MAX; t++) {
      const prevY = ball.y;
      const r = moveBall(ball, pen.segs, still, t + 1);
      if (ball.on >= 0) wasOn = true;
      else if (wasOn && ball.y > prevY) {
        const x = Math.trunc(ball.x / FP);
        const y = Math.trunc(ball.y / FP);
        if (y >= top && y <= lvl.bucketY - 80 && x >= 30 && x <= INK_WORLD_W - 30) fall.push({ x, y });
      }
      if (r) break;
    }
    if (fall.length === 0) continue;
    const at = fall[Math.trunc((pick * fall.length) / 1000)]!;
    const cloud: InkCloud = { x: clampInt(at.x, 30, INK_WORLD_W - 30), y: at.y + INK_CLOUD_R + BALL_R - 3 };
    const { x, y } = cloud;
    if (lvl.blocks.some((b) => b.x0 - gap < x + INK_CLOUD_HW && x - INK_CLOUD_HW < b.x1 + gap && b.y - gap - INK_CLOUD_R < y && y < b.y + inkBlockH(b) + gap + INK_CLOUD_R)) continue;
    // Clear of the pot and its slide (a cloud never sits over the pot's mouth).
    if (Math.abs(x - lvl.bucketX) < INK_BUCKET_W / 2 + lvl.slideAmp + INK_CLOUD_HW + INK_CLOUD_R + BALL_R && y > lvl.bucketY - 90) continue;
    if (refPts.some(([rx, ry]) => cloudDistance2(cloud, rx, ry) < clearRef * clearRef)) continue;
    const withCloud: InkLevel = { ...lvl, clouds: [cloud] };
    if (landsUnaided(withCloud)) continue;
    const refDrop = dropWithHit(withCloud, refSegs, lvl.refT0);
    if (refDrop.result !== 1 || refDrop.hitAt >= 0) continue;
    const stillCloud: InkLevel = { ...withCloud, slideAmp: 0 };
    const path: { x: number; y: number }[] = [];
    const first = dropWithHit(stillCloud, pen.segs, 0, path);
    if (first.hitAt < 0) continue;
    // The bounce alone, or a catch ramp drawn under the coin's fall after it, leading to the pot.
    const tries: number[][][] = first.result === 1 ? [[ramp]] : [];
    if (first.result !== 1) {
      let apex = first.hitAt;
      for (let i = first.hitAt; i < path.length; i++) if (path[i]!.y < path[apex]!.y) apex = i;
      for (const fallBy of [24, 60, 110]) {
        let k = -1;
        for (let i = apex; i < path.length; i++) if (path[i]!.y >= path[apex]!.y + fallBy * FP) { k = i; break; }
        if (k < 0) continue;
        const px = Math.trunc(path[k]!.x / FP);
        const py = Math.trunc(path[k]!.y / FP) + 22;
        const d = lvl.bucketX >= px ? 1 : -1;
        for (const lift of [26, 50]) {
          const cx = lvl.bucketX - d * 8;
          const cy = lvl.bucketY - lift;
          if (py >= cy - 8 || Math.abs(cx - px) < 24) continue;
          // Every point inside the world, as a finger can draw it (the sim clamps strokes to it).
          for (const back of [24, 10]) tries.push([ramp, [clampInt(px - d * back, 2, INK_WORLD_W - 2), py - 4, cx, cy]]);
        }
      }
    }
    for (const ref of tries) {
      const pen2 = ref.length === 1 ? pen : strokeSegs(ref, ink);
      if (pen2.penDown === 0) continue;
      const p2: { x: number; y: number }[] = [];
      const r = ref.length === 1 ? first : dropWithHit(stillCloud, pen2.segs, 0, p2);
      if (r.result !== 1 || r.hitAt < 0) continue;
      // A hand is never exact: the line must still bounce and pot moved 3 px either way, across and down.
      let steady = 0;
      for (const [ox, oy] of TRICK_WOBBLE) {
        const moved = strokeSegs(ref.map((pts) => pts.map((v, j) => v + (j % 2 === 0 ? ox : oy))), ink);
        const w = dropWithHit(stillCloud, moved.segs);
        if (moved.penDown !== 0 && w.result === 1 && w.hitAt >= 0) steady++;
      }
      if (steady < TRICK_STEADY) continue;
      const t0 = lvl.slideAmp ? trickRelease(withCloud, pen2.segs) : 0;
      if (t0 < 0) continue;
      return { cloud, trickRef: ref, trickT0: t0, path: ref.length === 1 ? path : p2, hitAt: r.hitAt };
    }
  }
  return null;
}

/**
 * inkRev 10: a star on the trick line's path after the bounce, as high as it rises (at least 44 px
 * down, under the HUD), clear of birds and the cloud and off the reference route; or null.
 */
function trickStar(lvl: InkLevel, level: number, found: CloudFind): { x: number; y: number } | null {
  const refPts = traceDrop({ ...lvl, slideAmp: 0 }, strokeSegs(lvl.ref, inkBudgetFor(level, INK_REV_EXPAND)).segs).map((r) => [Math.trunc(r.x / FP), Math.trunc(r.y / FP)] as const);
  let best: { x: number; y: number } | null = null;
  for (let i = found.hitAt + 1; i < found.path.length; i++) {
    const x = Math.trunc(found.path[i]!.x / FP);
    const y = Math.trunc(found.path[i]!.y / FP);
    if (y < 44 || x < 14 || x > INK_WORLD_W - 14 || y > lvl.bucketY - 40) continue;
    if (best && y >= best.y) continue;
    if (cloudDistance2(found.cloud, x, y) < (INK_CLOUD_R + INK_STAR_R + 6) ** 2) continue;
    if (lvl.blocks.some((b) => blockDistance2(b, x, y) < (INK_STAR_R + BALL_R + 4) ** 2)) continue;
    if (refPts.some(([rx, ry]) => (rx - x) ** 2 + (ry - y) ** 2 < INK_STAR_OFF_ROUTE * INK_STAR_OFF_ROUTE)) continue;
    best = { x, y };
  }
  return best;
}

/* ---------------------- inkRev 10 (x200): every run's features, fixed in number ---------------------- */

/**
 * inkRev 10 deals the same features on every seed (the seed only places them): each of levels 1–8 has an ink star
 * and INK_SILVER_PER_LEVEL silver coins on its proved bonus line; INK_CLOUD_LEVELS of them also a bounce cloud (the
 * bonus line is then the trick line, bouncing off it), INK_WIND_LEVELS a wind zone the bonus line rides (never a
 * cloud level too), and one of the eight the run's shamrock, on that level's bonus line. A level's layout is kept
 * only when all of its features can be placed and proved (buildLevelsRev3's accept hook), so the counts never vary.
 */
export const INK_BONUS_LEVELS = INK_LIVE_FROM;
/** inkRev 10: the first level is a warm-up: a missed drop there costs no fail. */
export const INK_WARMUP_LEVELS = 1;
export const INK_WIND_LEVELS = 3;
export const INK_SILVER_PER_LEVEL = 3;
/** Pickup radii (px): the coin takes one when its centre comes within this plus its own radius. */
export const INK_SILVER_R = 6;
export const INK_SHAMROCK_R = 9;
/** Raw feature points (paid out on INK_V10_SKILL_PAY): ink star 5, trick shot 5, silver coin 2, shamrock 20. */
export const INK_RAW_STAR = 5;
export const INK_RAW_TRICK = 5;
export const INK_RAW_SILVER = 2;
export const INK_RAW_SHAMROCK = 20;
/** Wind push (1/256 px a tick²) and how many ticks the bonus line must ride inside the zone. */
const WIND_MIN = 14;
const WIND_SPAN = 13;
const WIND_RIDE = 10;

type Pt = { x: number; y: number };

/**
 * inkRev 10: the points a phone sends for a finger tracing a straight-segment line (one each time it is
 * INK_STEP_PX from the last one sent, and the end), whole px. Generation proves every inkRev 10 line drawn this
 * way, so a line that only works drawn exactly (a near-vertical stretch breaks into wall pieces) is never proof.
 */
export function inkPhoneLine(pts: readonly number[]): number[] {
  const out = [pts[0]!, pts[1]!];
  let lx = pts[0]!;
  let ly = pts[1]!;
  const round = (num: number, den: number) => (num >= 0 ? Math.trunc((2 * num + den) / (2 * den)) : -Math.trunc((-2 * num + den) / (2 * den)));
  for (let i = 2; i + 1 < pts.length; i += 2) {
    const x0 = pts[i - 2]!;
    const y0 = pts[i - 1]!;
    const dx = pts[i]! - x0;
    const dy = pts[i + 1]! - y0;
    const n = Math.max(1, isqrt(dx * dx + dy * dy) + 1);
    for (let k = 1; k <= n; k++) {
      const x = x0 + round(dx * k, n);
      const y = y0 + round(dy * k, n);
      if ((x - lx) * (x - lx) + (y - ly) * (y - ly) >= INK_STEP_PX * INK_STEP_PX) {
        out.push(x, y);
        lx = x;
        ly = y;
      }
    }
  }
  const ex = pts[pts.length - 2]!;
  const ey = pts[pts.length - 1]!;
  if (lx !== ex || ly !== ey) out.push(ex, ey);
  return out;
}

/** Does a polyline have a near-vertical stretch (under 1 px across for every 4.5 down)? A hand's line through it is fragile. */
export function inkSteep(pts: readonly number[]): boolean {
  for (let i = 2; i + 1 < pts.length; i += 2) {
    const dx = Math.abs(pts[i]! - pts[i - 2]!);
    const dy = pts[i + 1]! - pts[i - 1]!;
    if (dx * dx * 1000 < 48 * (dx * dx + dy * dy)) return true;
  }
  return false;
}

/**
 * Speed only: how many of a phone-drawn waypoint line's leading segments it shares with every line from the same
 * start through the same waypoint (its first leg's points as inkPhoneLine sends them, up to the corner); 0 when the
 * line has no waypoint.
 */
function sharedPrefix(pts: readonly number[]): number {
  if (pts.length < 6 || [pts[0]!, pts[2]!].some((x) => x < 0 || x >= 512) || [pts[1]!, pts[3]!].some((y) => y < 0 || y >= 1024)) return 0;
  const full = inkPhoneLine(pts);
  const leg = inkPhoneLine(pts.slice(0, 4));
  let c = 0;
  while (c + 1 < leg.length && c + 1 < full.length && leg[c] === full[c] && leg[c + 1] === full[c + 1]) c += 2;
  return Math.max(0, c / 2 - 1);
}
/** The cache key of a waypoint line's shared prefix: its start, its waypoint and the prefix's length. */
function prefixKey(pts: readonly number[], m: number): number {
  // Every coordinate is inside the world (x under 512, y under 1024): 46 bits, exact in a double.
  return (((pts[0]! * 1024 + pts[1]!) * 512 + pts[2]!) * 1024 + pts[3]!) * 256 + m;
}

/** A line set as a phone sends it (inkPhoneLine on every stroke), within `ink`. */
function phoneSegs(ref: readonly number[][], ink: number): Pen {
  return strokeSegs(ref.map(inkPhoneLine), ink);
}

/** Does a drop's path take the star (or any pickup of radius r) at p? */
function passes(path: readonly Pt[], p: Pt, r = INK_STAR_R): boolean {
  const reach = (r + BALL_R) * (r + BALL_R);
  return path.some((q) => (q.x / FP - p.x) ** 2 + (q.y / FP - p.y) ** 2 <= reach);
}

/**
 * The release that pots and passes `need` with a hand's timing margin: of 16 over the slide period, the middle of
 * the longest run that works (a run of one must also work 4 ticks either side); 0 on a still pot when it pots. −1 if none.
 */
function steadyRelease(lvl: InkLevel, segs: readonly InkSeg[], need: (path: Pt[], hitAt: number) => boolean): number {
  const P = Math.max(1, lvl.slidePeriod);
  if (!lvl.slideAmp) {
    const path: Pt[] = [];
    const d = dropWithHit(lvl, segs, 0, path);
    return d.result === 1 && need(path, d.hitAt) ? 0 : -1;
  }
  // Every release plays the still pot's ticks until the coin nears the rim (speed only; stillPrefix).
  const pre = stillPrefix(lvl, segs, GRAVITY);
  const ok = (t: number) => {
    if (pre.from < 0) return pre.ended.result === 1 && need(pre.path, pre.ended.hitAt);
    const path = pre.path.slice();
    const d = dropRun(lvl, segs, ((t % P) + P) % P, path, GRAVITY, pre.from, pre.balls[pre.from]!, pre.balls, pre.hitAt);
    return d.result === 1 && need(path, d.hitAt);
  };
  const N = 16;
  const at = (k: number) => Math.trunc((k * P) / N);
  const good = Array.from({ length: N }, (_, k) => ok(at(k)));
  if (good.every(Boolean)) return 0;
  let best = -1;
  let bestLen = 0;
  for (let k = 0; k < N; k++) {
    if (!good[k] || good[(k + N - 1) % N]) continue;
    let len = 0;
    while (len < N && good[(k + len) % N]) len++;
    if (len > bestLen) {
      bestLen = len;
      best = k;
    }
  }
  if (best < 0) return -1;
  if (bestLen >= 2) return at((best + Math.trunc(bestLen / 2)) % N) - (bestLen % 2 === 0 ? Math.trunc(P / (2 * N)) : 0);
  const t0 = at(best);
  return ok(t0 - 4) && ok(t0 + 4) ? t0 : -1;
}

/** A line that still pots (and passes `need`) moved 3 px each way, three times of four: a hand is never exact. */
function lineHolds(lvl: InkLevel, ref: readonly number[][], t0: number, ink: number, need: (path: Pt[], hitAt: number) => boolean, by = 1): boolean {
  const H = lvl.worldH ?? INK_WORLD_H;
  let steady = 0;
  let tried = 0;
  for (const [wx, wy] of TRICK_WOBBLE) {
    const ox = wx * by;
    const oy = wy * by;
    tried++;
    const moved = phoneSegs(ref.map((pts) => pts.map((v, j) => (j % 2 === 0 ? clampInt(v + ox, 0, INK_WORLD_W) : clampInt(v + oy, 0, H)))), ink);
    if (moved.penDown !== 0) {
      const path: Pt[] = [];
      const d = dropWithHit(lvl, moved.segs, t0, path);
      if (d.result === 1 && need(path, d.hitAt)) steady++;
    }
    if (steady + (TRICK_WOBBLE.length - tried) < TRICK_STEADY) return false;
  }
  return steady >= TRICK_STEADY;
}

/** The reference route's points (px) on the still pot. */
function routeOf(lvl: InkLevel, ink: number): (readonly [number, number])[] {
  return traceDrop({ ...lvl, slideAmp: 0 }, phoneSegs(lvl.ref, ink).segs).map((r) => [Math.trunc(r.x / FP), Math.trunc(r.y / FP)] as const);
}

function nearestRoute2(route: readonly (readonly [number, number])[], x: number, y: number, stop = 0): number {
  let near = Infinity;
  for (const [rx, ry] of route) {
    const d = (rx - x) * (rx - x) + (ry - y) * (ry - y);
    if (d < near) near = d;
    if (near < stop) break;
  }
  return near;
}

/** steadyReference's first step alone: the level's own reference, when it holds. */
function steadyOwn(lvl: InkLevel, ink: number): { ref: number[][]; t0: number } | null {
  return steadyReference(lvl, ink, true);
}

/**
 * inkRev 10: a reference line for a static level that pots with a hand's margin (drawn as a phone sends it, lineHolds,
 * and on a moving pot a steady release), never touching a cloud: the level's own reference when it holds, else the
 * first of findReference's family (up to 40) that does (`gentle`, the warm-up level: never near-vertical, holding
 * 6 px either way). Null when none holds.
 */
function steadyReference(lvl: InkLevel, ink: number, ownOnly = false, gentle = false): { ref: number[][]; t0: number } | null {
  const clear = (_: Pt[], hitAt: number) => hitAt < 0;
  const still: InkLevel = { ...lvl, slideAmp: 0 };
  // Speed only: the family's lines through one waypoint share their first leg (sharedPrefix, sharedDrop).
  const shared = new Map<number, PrefixRun>();
  const tryRef = (ref: number[][], family = false): { ref: number[][]; t0: number } | null => {
    const pen = phoneSegs(ref, ink);
    if (pen.penDown === 0) return null;
    const m = family ? sharedPrefix(ref[0]!) : 0;
    if ((m > 0 ? sharedDrop(still, pen.segs, GRAVITY, shared, m, prefixKey(ref[0]!, m)) : dropWithHit(still, pen.segs).result) !== 1) return null;
    const t0 = steadyRelease(lvl, pen.segs, clear);
    if (t0 < 0 || !lineHolds(lvl, ref, t0, ink, clear)) return null;
    // The warm-up level (gentle): never near-vertical, and it still holds moved 6 px either way.
    if (gentle && (ref.some(inkSteep) || !lineHolds(lvl, ref, t0, ink, clear, 2))) return null;
    return { ref, t0 };
  };
  const own = lvl.ref.length ? tryRef(lvl.ref) : null;
  if (own || ownOnly) return own;
  const dir = lvl.bucketX > lvl.spoutX ? 1 : -1;
  const sx = lvl.spoutX - dir * 24;
  const sy = SPOUT_Y + 28;
  const way: (readonly [number, number])[] = [];
  for (const fy of [25, 45, 65]) for (const fx of [-60, -20, 20, 60, 110]) way.push([lvl.spoutX + dir * fx, sy + Math.trunc(((lvl.bucketY - sy) * fy) / 100)]);
  let tried = 0;
  for (const w of [null, ...way])
    for (const lift of [26, 44, 14, 70])
      for (const off of [0, -12, 12, -24, 24]) {
        const ex = lvl.bucketX - dir * off;
        const ey = lvl.bucketY - lift;
        if (w && (w[0] < 4 || w[0] > INK_WORLD_W - 4 || w[1] >= ey - 10)) continue;
        if (++tried > 40) return null;
        const got = tryRef([w ? [sx, sy, w[0], w[1], ex, ey] : [sx, sy, ex, ey]], true);
        if (got) return got;
      }
  return null;
}

/**
 * Pickup places on a bonus line's path (the path it takes on its own release): the shamrock (when asked) at the
 * point farthest from the reference route, then INK_SILVER_PER_LEVEL silver coins spread along the rest; all off
 * the reference route, clear of the star, the birds, the clouds, the HUD and each other. Null if they do not fit.
 */
function pickupSpots(lvl: InkLevel, path: readonly Pt[], star: Pt, route: readonly (readonly [number, number])[], wantShamrock: boolean): { silver: Pt[]; shamrock?: Pt } | null {
  const cands: Pt[] = [];
  for (let i = 4; i < path.length; i += 2) {
    const x = Math.trunc(path[i]!.x / FP);
    const y = Math.trunc(path[i]!.y / FP);
    if (y < 46 || y > lvl.bucketY - 30 || x < 12 || x > INK_WORLD_W - 12) continue;
    if ((x - star.x) ** 2 + (y - star.y) ** 2 < (INK_STAR_R + INK_SHAMROCK_R + 6) ** 2) continue;
    if (lvl.blocks.some((b) => blockDistance2(b, x, y) < (INK_SHAMROCK_R + 3) ** 2)) continue;
    if (lvl.clouds?.some((cl) => cloudDistance2(cl, x, y) < (INK_CLOUD_R + INK_SHAMROCK_R + 3) ** 2)) continue;
    if (nearestRoute2(route, x, y, 18 * 18) < 18 * 18) continue;
    cands.push({ x, y });
  }
  const chosen: Pt[] = [];
  const clearOf = (p: Pt, gap: number) => chosen.every((q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= gap * gap);
  let shamrock: Pt | undefined;
  if (wantShamrock) {
    let bestD = -1;
    for (const p of cands) {
      const d = Math.min(nearestRoute2(route, p.x, p.y), (p.x - star.x) ** 2 + (p.y - star.y) ** 2);
      if (d > bestD && (p.x - star.x) ** 2 + (p.y - star.y) ** 2 >= 40 * 40) {
        bestD = d;
        shamrock = p;
      }
    }
    if (!shamrock) return null;
    chosen.push(shamrock);
  }
  const silver: Pt[] = [];
  const n = cands.length;
  for (let j = 0; j < INK_SILVER_PER_LEVEL; j++) {
    const at = Math.trunc(((j + 1) * n) / (INK_SILVER_PER_LEVEL + 1));
    let pick: Pt | null = null;
    for (let k = 0; k < n && !pick; k++) {
      // Nearest candidate to the spread point that keeps its distance from the others.
      for (const i of [at + k, at - k]) {
        const p = cands[i];
        if (p && clearOf(p, 24)) {
          pick = p;
          break;
        }
      }
    }
    if (!pick) return null;
    silver.push(pick);
    chosen.push(pick);
  }
  silver.sort((a, b) => a.y - b.y || a.x - b.x);
  return shamrock ? { silver, shamrock } : { silver };
}

type Bonus = { ref: number[][]; t0: number; star: Pt; path: Pt[] };

/**
 * inkRev 10: the bonus line of a level without a cloud: a ramp from beside the spout through a waypoint to over the
 * pot (seeded order), its star at the point of its path farthest from the reference route; on a wind level the path
 * must ride the wind for WIND_RIDE ticks. Kept only when it holds (lineHolds, a steady release on a moving pot).
 */
function plainBonus(lvl: InkLevel, ink: number, draw: Draw, route: readonly (readonly [number, number])[]): Bonus | null {
  const still: InkLevel = { ...lvl, slideAmp: 0 };
  const dir = lvl.bucketX > lvl.spoutX ? 1 : -1;
  const sy = SPOUT_Y + 28;
  const candidates: number[][] = [];
  for (const sx of [lvl.spoutX - dir * 24, lvl.spoutX + dir * 24, lvl.spoutX - dir * 48])
    for (const fy of [30, 50, 70])
      for (const fx of [-120, -80, -40, 0, 40, 80, 120, 160]) {
        const wx = lvl.spoutX + dir * fx;
        const wy = sy + Math.trunc(((lvl.bucketY - sy) * fy) / 100);
        for (const lift of [14, 30, 50]) for (const off of [0, -16, 16]) candidates.push([sx, sy, wx, wy, lvl.bucketX - dir * off, lvl.bucketY - lift]);
      }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = draw(i + 1);
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  const off2 = INK_STAR_OFF_ROUTE * INK_STAR_OFF_ROUTE;
  let screened = 0;
  let tried = 0;
  const shared = new Map<number, PrefixRun>();
  for (const pts of candidates) {
    if (screened >= 40 || ++tried > 160) break;
    if (pts[2]! < 4 || pts[2]! > INK_WORLD_W - 4 || pts[3]! >= pts[5]! - 10 || inkSteep(pts)) continue;
    const ref = [pts];
    const pen = phoneSegs(ref, ink);
    if (pen.penDown === 0) continue;
    // Speed only: screened first without a path, sharing the first leg with the other lines through its waypoint.
    const m = sharedPrefix(pts);
    if (m > 0 && sharedDrop(still, pen.segs, GRAVITY, shared, m, prefixKey(pts, m)) !== 1) continue;
    const path: Pt[] = [];
    if (dropWithHit(still, pen.segs, 0, path).result !== 1) continue;
    screened++;
    const w = lvl.wind;
    if (w && path.filter((p) => p.x >= w.x0 * FP && p.x <= w.x1 * FP && p.y >= w.y0 * FP && p.y <= w.y1 * FP).length < WIND_RIDE) continue;
    let star: Pt | null = null;
    let bestD = -1;
    for (const p of path) {
      const x = Math.trunc(p.x / FP);
      const y = Math.trunc(p.y / FP);
      if (y < SPOUT_Y + 40 || y > lvl.bucketY - 40 || x < 14 || x > INK_WORLD_W - 14) continue;
      const near = nearestRoute2(route, x, y, off2);
      if (near < off2 + 4 * INK_STAR_OFF_ROUTE) continue;
      if (lvl.blocks.some((b) => blockDistance2(b, x, y) < (INK_STAR_R + BALL_R + 4) ** 2)) continue;
      if (near > bestD) {
        bestD = near;
        star = { x, y };
      }
    }
    if (!star) continue;
    const s = star;
    const need = (p: Pt[]) => passes(p, s);
    // Cheapest first: the line must hold on the still pot before a release is looked for.
    if (lvl.slideAmp && !lineHolds(still, ref, 0, ink, need)) continue;
    const t0 = steadyRelease(lvl, pen.segs, need);
    if (t0 < 0 || !lineHolds(lvl, ref, t0, ink, need)) continue;
    const real: Pt[] = [];
    dropWithHit(lvl, pen.segs, t0, real);
    return { ref, t0, star: s, path: real };
  }
  return null;
}

/** inkRev 10: a cloud level's trick line, made to hold (a steady release, lineHolds), with its star at the top of the bounce. */
function cloudBonus(lvl: InkLevel, level: number, ink: number, draw: Draw): { level: InkLevel; bonus: Bonus } | null {
  for (let k = 0; k < 2; k++) {
    const found = placeCloud(lvl, level, draw);
    if (!found) return null;
    const star = trickStar(lvl, level, found);
    if (!star) continue;
    const withCloud: InkLevel = { ...lvl, clouds: [found.cloud] };
    const pen = phoneSegs(found.trickRef, ink);
    if (pen.penDown === 0) continue;
    const segs = pen.segs;
    const need = (p: Pt[], hitAt: number) => hitAt >= 0 && passes(p, star);
    const t0 = steadyRelease(withCloud, segs, need);
    if (t0 < 0 || !lineHolds(withCloud, found.trickRef, t0, ink, need)) continue;
    const real: Pt[] = [];
    dropWithHit(withCloud, segs, t0, real);
    return { level: { ...withCloud, trickRef: found.trickRef, trickT0: t0 }, bonus: { ref: found.trickRef, t0, star, path: real } };
  }
  return null;
}

/* ---------------- inkRev 10: live levels proved by hand (the real step, phone points, hand pace) ---------------- */

/** inkRev 10 live proofs: a live stroke is drawn from `start` ticks after RELEASE, one phone point a tick (about
 * INK_STEP_PX px a tick, an unhurried finger), lifted the tick after its last point. */
export const INK_HAND_START = 20;

/** A fresh state on one level of a run (generation's hand proofs play it through the real step). */
function levelState(lvl: InkLevel, level: number): InkState {
  const list = Array.from({ length: INK_LEVELS }, () => lvl);
  return {
    tick: 0,
    rng: 0,
    list,
    level,
    levels: level,
    fails: 0,
    segs: [],
    strokeStarts: [],
    penX: 0,
    penY: 0,
    penDown: 0,
    ink: inkBudgetFor(level, INK_REV_EXPAND) * FP,
    dropping: 0,
    ball: spoutBall(lvl),
    dropTicks: 0,
    positions: [],
    ended: 0,
    endedTick: 0,
    flashKind: 0,
    flashTick: -100,
    failedBall: null,
    rev: INK_REV_EXPAND,
    draftSegs: [],
    draftStrokeStarts: [],
    draftPenX: 0,
    draftPenY: 0,
    draftPenDown: 0,
    liveLifts: 0,
    preInkUsed: 0,
    stars: 0,
    starGot: 0,
    worldH: lvl.worldH ?? INK_TALL_H,
    tricks: 0,
    cloudHit: 0,
    cloudTick: -100,
    cloudIdx: -1,
    silver: 0,
    silverGot: 0,
    shamrocks: 0,
    shamrockGot: 0,
  };
}

type LiveStroke = { start: number; pts: number[] };

/**
 * One drop played by hand through the real step: the pre-release strokes as a phone sends them (a point a tick),
 * RELEASE, then each live stroke from `start` (+ `late`) ticks after RELEASE, a point a tick, lifted the tick after.
 * Every point moved by (ox, oy). Returns the ball's path after RELEASE (px and whether it is on a line) and whether it potted.
 */
function handDrop(lvl: InkLevel, level: number, pre: readonly number[][], live: readonly LiveStroke[], ox = 0, oy = 0, late = 0): { potted: boolean; path: { x: number; y: number; on: number }[] } {
  const H = lvl.worldH ?? INK_TALL_H;
  const at = new Map<number, ArcadeInputEvent>();
  const put = (t: number, k: number, a: number, b: number, c: number): number => {
    let tick = t;
    while (at.has(tick)) tick++;
    at.set(tick, { t: tick, k, a, b, c, d: 0 });
    return tick;
  };
  const moved = (pts: readonly number[]) => inkPhoneLine(pts.map((v, j) => (j % 2 === 0 ? clampInt(v + ox, 0, INK_WORLD_W) : clampInt(v + oy, 0, H))));
  let t = 1;
  for (const st of pre) {
    const pts = moved(st);
    for (let j = 0; j < pts.length; j += 2) t = put(t, INK_INPUT_STROKE, pts[j]!, pts[j + 1]!, j === 0 ? 1 : 0) + 1;
  }
  const rel = put(t, INK_INPUT_RELEASE, 1, 0, 0);
  let presses = 1;
  for (const lv of live) {
    const pts = moved(lv.pts);
    let tt = rel + lv.start + late;
    for (let j = 0; j < pts.length; j += 2) tt = put(tt, INK_INPUT_STROKE, pts[j]!, pts[j + 1]!, j === 0 ? 1 : 0) + 1;
    put(tt, INK_INPUT_LIFT, ++presses, 0, 0);
  }
  let s = levelState(lvl, level);
  const path: { x: number; y: number; on: number }[] = [];
  for (let k = 0; k < rel + DROP_MAX + 2; k++) {
    s = step(s, at.get(s.tick + 1) ?? null);
    if (s.levels > level) return { potted: true, path };
    if (s.fails || s.ended) return { potted: false, path };
    if (s.dropping) path.push({ x: s.ball.x / FP, y: s.ball.y / FP, on: s.ball.on });
  }
  return { potted: false, path };
}

/**
 * inkRev 10: a live level's hand-drawn solution, or null: its pre-release line, then a catch ramp under the coin's
 * fall to over the pot (never near-vertical), drawn from INK_HAND_START ticks after RELEASE at a hand's pace. Kept only
 * when it also pots moved 3 px each way, with its far end 5 px either side, and started 4 ticks early or 5 late.
 */
function handLive(lvl: InkLevel, level: number): LiveStroke | null {
  const pre = lvl.ref;
  const ink = inkBudgetFor(level, INK_REV_EXPAND);
  const prePen = strokeSegs(pre.map(inkPhoneLine), Math.min(ink, INK_LIVE_PRE_CAP));
  const preUsed = prePen.segs.reduce((sum, seg) => sum + seg.len, 0);
  const trace = traceDrop(lvl, prePen.segs).slice(1).map((p) => ({ x: p.x / FP, y: p.y / FP, on: p.on }));
  const zone = INK_NO_DRAW_ZONE_PX + 2;
  const preRun = ballsOf(lvl, prePen.segs, GRAVITY);
  /** The cheap screen: the stroke turns solid on its LIFT (start + points + 1 ticks in), and no point it sends comes near the coin. */
  const screen = (cand: LiveStroke): boolean => {
    const pts = inkPhoneLine(cand.pts);
    const n = pts.length / 2;
    for (let j = 0; j < n; j++) {
      const p = trace[Math.min(trace.length - 1, cand.start + j)];
      if (p && Math.hypot(p.x - pts[2 * j]!, p.y - pts[2 * j + 1]!) < zone) return false;
    }
    const pen2 = strokeSegs([pts], ink - preUsed);
    if (pen2.penDown !== 1) return false;
    // simulateStaged's two stages, picked up from the pre-release line's own drop (speed only; stagedFrom).
    return stagedFrom(lvl, [...prePen.segs, ...pen2.segs], GRAVITY, cand.start + n + 1, preRun) === 1;
  };
  let leave = -1;
  for (let t = 1; t < trace.length; t++)
    if (trace[t - 1]!.on >= 0 && trace[t]!.on < 0) {
      leave = t;
      break;
    }
  if (leave < 0) return null;
  // A hand that starts sooner or later, sits a few px off, or swings the stroke's far end a little must still pot.
  const holds = (cand: LiveStroke): boolean => {
    if (!handDrop(lvl, level, pre, [cand]).potted) return false;
    if (!handDrop(lvl, level, pre, [cand], 0, 0, 5).potted || !handDrop(lvl, level, pre, [{ ...cand, start: cand.start - 4 }]).potted) return false;
    for (const [ox, oy] of TRICK_WOBBLE) if (!handDrop(lvl, level, pre, [cand], ox, oy).potted) return false;
    for (const ex of [-5, 5]) {
      const swung = { ...cand, pts: [cand.pts[0]!, cand.pts[1]!, clampInt(cand.pts[2]! + ex, 0, INK_WORLD_W), cand.pts[3]!] };
      if (!handDrop(lvl, level, pre, [swung]).potted) return false;
    }
    return true;
  };
  for (const d of [8, 16, 26, 38, 52]) {
    const p = trace[leave + d];
    if (!p) break;
    const dir = lvl.bucketX >= p.x ? 1 : -1;
    for (const dy0 of [40, 64, 90, 120]) {
      const cx = clampInt(Math.round(p.x) + dir * 8, 2, INK_WORLD_W - 2);
      const cy = Math.round(p.y) + dy0;
      if (cy >= lvl.bucketY - 40) continue;
      for (const lift of [30, 50, 70])
        for (const off of [0, -14, 14, -28, 28]) {
          const cand: LiveStroke = { start: INK_HAND_START, pts: [cx, cy, lvl.bucketX - dir * off, lvl.bucketY - lift] };
          if (inkSteep(cand.pts)) continue;
          if (!screen(cand) || !screen({ ...cand, start: cand.start + 5 }) || !screen({ ...cand, start: cand.start - 4 })) continue;
          if (holds(cand)) return cand;
        }
    }
  }
  return null;
}

type InkKind = "plain" | "cloud" | "wind";

/**
 * inkRev 10: a level (1–8) with its features placed and proved, or null when this layout cannot carry them. When a
 * cloud or wind will not fit this layout and `canSwap` allows it (a later level is still plain and takes this one's
 * kind), the level is made plain instead and `swapped` reports it.
 */
function decorateLevel(lvl: InkLevel, level: number, kind: InkKind, shamrock: boolean, draw: Draw, canSwap = false): { level: InkLevel; swapped: boolean } | null {
  const made = decorateAs(lvl, level, kind, shamrock, draw);
  if (made !== "swap") return made ? { level: made, swapped: false } : null;
  if (!canSwap) return null;
  const plain = decorateAs(lvl, level, "plain", shamrock, draw);
  return plain && plain !== "swap" ? { level: plain, swapped: true } : null;
}

/** decorateLevel's one try: the level, null (its reference or bonus line will not hold), or "swap" (the cloud or wind will not fit). */
function decorateAs(lvl: InkLevel, level: number, kind: InkKind, shamrock: boolean, draw: Draw): InkLevel | null | "swap" {
  const ink = inkBudgetFor(level, INK_REV_EXPAND);
  const finish = (L: InkLevel, b: Bonus): InkLevel | null => {
    const spots = pickupSpots(L, b.path, b.star, routeOf(L, ink), shamrock);
    if (!spots) return null;
    return { ...L, star: b.star, starRef: b.ref, starT0: b.t0, silver: spots.silver, ...(spots.shamrock ? { shamrock: spots.shamrock } : {}) };
  };
  // Level 1 is the warm-up: its easy line has twice a hand's usual margin.
  const r = steadyReference(lvl, ink, false, level < INK_WARMUP_LEVELS);
  if (!r) return null;
  const L: InkLevel = { ...lvl, ref: r.ref, refT0: r.t0 };
  if (kind === "cloud") {
    const c = cloudBonus(L, level, ink, draw);
    return c ? finish(c.level, c.bonus) ?? "swap" : "swap";
  }
  const route = routeOf(L, ink);
  const b = plainBonus(L, ink, draw, route);
  if (!b) return null;
  if (kind === "plain") return finish(L, b);
  // A wind level: the wind blows over part of the bonus line's flight; the reference line must still hold in it,
  // and the bonus line must still take its star and pot riding it.
  for (let k = 0; k < 8; k++) {
    const wind = windOn(L, b.path, draw);
    if (!wind) continue;
    const wl: InkLevel = { ...L, wind };
    if (landsUnaided(wl) || !steadyOwn(wl, ink)) continue;
    const pen = phoneSegs(b.ref, ink);
    const inside: Pt[] = [];
    if (dropWithHit({ ...wl, slideAmp: 0 }, pen.segs, 0, inside).result !== 1) continue;
    if (inside.filter((p) => p.x >= wind.x0 * FP && p.x <= wind.x1 * FP && p.y >= wind.y0 * FP && p.y <= wind.y1 * FP).length < WIND_RIDE) continue;
    const star = b.star;
    const need = (p: Pt[]) => passes(p, star);
    const t0 = steadyRelease(wl, pen.segs, need);
    if (t0 < 0 || !lineHolds(wl, b.ref, t0, ink, need)) continue;
    const real: Pt[] = [];
    dropWithHit(wl, pen.segs, t0, real);
    const done = finish(wl, { ref: b.ref, t0, star, path: real });
    if (done) return done;
  }
  return "swap";
}

/**
 * inkRev 10: a seeded wind zone over part of a bonus line's flight, never over the pot's mouth; or null.
 */
function windOn(lvl: InkLevel, path: readonly Pt[], draw: Draw): InkWind | null {
  const pts = path.filter((_, i) => i % 3 === 0).map((p) => ({ x: Math.trunc(p.x / FP), y: Math.trunc(p.y / FP) })).filter((p) => p.y > SPOUT_Y + 50 && p.y < lvl.bucketY - 100);
  if (pts.length === 0) return null;
  const at = pts[draw(pts.length)]!;
  const w = 90 + draw(111);
  const h = 70 + draw(81);
  const x0 = clampInt(at.x - draw(w), 0, INK_WORLD_W - w);
  const y0 = clampInt(at.y - draw(h), SPOUT_Y + 40, Math.max(SPOUT_Y + 40, lvl.bucketY - 90 - h));
  const wind: InkWind = { x0, y0, x1: x0 + w, y1: y0 + h, ax: 0 };
  // Push toward the side the pot is on from the zone, at a seeded strength.
  const mag = WIND_MIN + draw(WIND_SPAN + 1);
  const toward = lvl.bucketX >= (x0 + w / 2) ? 1 : -1;
  return { ...wind, ax: (draw(3) === 0 ? -toward : toward) * mag };
}

/** inkRev 10: the tall levels, every one of 1–8 carrying its features (the kinds drawn from their own seeded stream). */
function buildLevelsRev10(seed: number): { list: InkLevel[]; rng: number } {
  let frng = (seed ^ 0x9c10d5) | 0;
  const draw: Draw = (bound) => {
    const r = rngBelow(frng, Math.max(1, bound));
    frng = r.state;
    return r.value;
  };
  const order = Array.from({ length: INK_BONUS_LEVELS }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = draw(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const kinds: InkKind[] = order.map(() => "plain");
  for (const [k, level] of order.entries()) kinds[level] = k < INK_CLOUD_LEVELS ? "cloud" : k < INK_CLOUD_LEVELS + INK_WIND_LEVELS ? "wind" : "plain";
  const shamrockLevel = draw(INK_BONUS_LEVELS);
  return buildLevelsRev3(seed, INK_TALL_DROP, INK_REV_EXPAND, (lvl, level) => {
    if (level < INK_BONUS_LEVELS) {
      // A cloud or wind that will not fit this layout passes to the next level still plain (the counts never change).
      const later = kinds.findIndex((k, j) => j > level && k === "plain");
      const r = decorateLevel(lvl, level, kinds[level]!, level === shamrockLevel, draw, later >= 0);
      if (r?.swapped) {
        kinds[later] = kinds[level]!;
        kinds[level] = "plain";
      }
      return r?.level ?? null;
    }
    // Live levels: a layout is kept only with a hand-drawn solution (a stroke a finger can draw in time).
    const hand = handLive(lvl, level);
    return hand ? { ...lvl, liveHand: [hand] } : null;
  });
}

/** inkRev 10: the bonus line, on its own release (the pot moving), takes the star (after a bounce on a cloud level) and pots the coin. */
function starProved(lvl: InkLevel, level: number): boolean {
  if (!lvl.star || !lvl.starRef) return false;
  const pen = phoneSegs(lvl.starRef, inkBudgetFor(level, INK_REV_EXPAND));
  const path: { x: number; y: number }[] = [];
  const d = dropWithHit(lvl, pen.segs, lvl.starT0 ?? 0, path);
  return pen.penDown === 1 && d.result === 1 && (!lvl.clouds?.length || d.hitAt >= 0) && passes(path, lvl.star);
}

/** inkRev 10 proof of one level (ink-x200-check): every line as a phone draws it, within the level's ink, on its own release. */
export interface InkX200LevelProof {
  level: number;
  /** The reference pots (static levels: and holds, never touching a cloud; live: with its hand-drawn live stroke). */
  ref: boolean;
  /** The coin never pots with no line. */
  unaided: boolean;
  /** Levels 1–8: the bonus line pots and takes the star (after a cloud bounce on a cloud level). */
  bonus: boolean | null;
  /** Levels 1–8: how many of the level's silver coins the bonus line passes, and whether it passes the shamrock. */
  silverOnLine: number;
  silver: number;
  shamrock: boolean | null;
  /** A wind level: the ticks the bonus line spends inside the wind zone; and the reference still holding there. */
  windTicks: number | null;
  /** Live levels: the hand-drawn live stroke pots through the real step (and started 5 ticks late). */
  hand: boolean | null;
  kind: "plain" | "cloud" | "wind" | "live";
}

export function inkX200Proof(seed: number): InkX200LevelProof[] {
  const { list } = buildLevels(seed, INK_REV_EXPAND);
  return list.map((lvl, i) => {
    const ink = inkBudgetFor(i, INK_REV_EXPAND);
    const live = inkIsLive(i, INK_REV_EXPAND);
    const unaided = landsUnaided(lvl);
    if (live) {
      const hand = lvl.liveHand?.[0];
      const ok = Boolean(hand && handDrop(lvl, i, lvl.ref, [hand]).potted && handDrop(lvl, i, lvl.ref, [hand], 0, 0, 5).potted);
      return { level: i, ref: ok, unaided, bonus: null, silverOnLine: 0, silver: 0, shamrock: null, windTicks: null, hand: ok, kind: "live" as const };
    }
    const clear = (_: Pt[], hitAt: number) => hitAt < 0;
    const refPen = phoneSegs(lvl.ref, ink);
    const refDrop = dropWithHit(lvl, refPen.segs, lvl.refT0);
    const ref = refPen.penDown === 1 && refDrop.result === 1 && refDrop.hitAt < 0 && lineHolds(lvl, lvl.ref, lvl.refT0, ink, clear);
    const bonus = lvl.star && lvl.starRef ? starProved(lvl, i) : false;
    const path: Pt[] = [];
    if (lvl.starRef) dropWithHit(lvl, phoneSegs(lvl.starRef, ink).segs, lvl.starT0 ?? 0, path);
    const silverOnLine = (lvl.silver ?? []).filter((c) => passes(path, c, INK_SILVER_R)).length;
    const w = lvl.wind;
    const still: Pt[] = [];
    if (w && lvl.starRef) dropWithHit({ ...lvl, slideAmp: 0 }, phoneSegs(lvl.starRef, ink).segs, 0, still);
    return {
      level: i,
      ref,
      unaided,
      bonus,
      silverOnLine,
      silver: lvl.silver?.length ?? 0,
      shamrock: lvl.shamrock ? passes(path, lvl.shamrock, INK_SHAMROCK_R) : null,
      windTicks: w ? still.filter((p) => p.x >= w.x0 * FP && p.x <= w.x1 * FP && p.y >= w.y0 * FP && p.y <= w.y1 * FP).length : null,
      hand: null,
      kind: lvl.clouds?.length ? ("cloud" as const) : w ? ("wind" as const) : ("plain" as const),
    };
  });
}

/** Test hook: each rev-4 star's proved line pots the coin through the star within its ink. */
export function inkStarCheck(seed: number): { stars: number; proved: number; offRoute: number } {
  const { list } = buildLevels(seed, INK_REV4);
  let stars = 0, proved = 0, offRoute = 0;
  list.forEach((lvl, i) => {
    if (!lvl.star || !lvl.starRef) return;
    stars++;
    const pen = strokeSegs(lvl.starRef, inkBudgetFor(i, INK_REV4));
    const ball = spoutBall(lvl);
    let got = false;
    let result = 0;
    for (let t = 0; t < DROP_MAX && !result; t++) {
      result = moveBall(ball, pen.segs, lvl, (lvl.starT0 ?? 0) + t + 1);
      if ((ball.x / FP - lvl.star.x) ** 2 + (ball.y / FP - lvl.star.y) ** 2 <= (INK_STAR_R + BALL_R) ** 2) got = true;
    }
    if (pen.penDown === 1 && result === 1 && got) proved++;
    const refTrace = traceDrop({ ...lvl, slideAmp: 0 }, strokeSegs(lvl.ref, inkBudgetFor(i, INK_REV4)).segs);
    if (refTrace.every((r) => (r.x / FP - lvl.star!.x) ** 2 + (r.y / FP - lvl.star!.y) ** 2 >= (INK_STAR_OFF_ROUTE - 1) ** 2)) offRoute++;
  });
  return { stars, proved, offRoute };
}

function buildLevels(seed: number, rev?: number): { list: InkLevel[]; rng: number } {
  if (rev === INK_REV_EXPAND) return buildLevelsRev10(seed);
  if (rev === INK_REV4) return buildLevelsRev4(seed);
  if (rev === INK_REV3) return buildLevelsRev3(seed);
  const birds = rev === INK_REV;
  const counts = birds ? BIRD_COUNTS : BLOCK_COUNTS;
  const h = birds ? INK_BIRD_H_FP : undefined;
  let rng = seed | 0;
  const draw: Draw = (bound) => {
    const r = rngBelow(rng, Math.max(1, bound));
    rng = r.state;
    return r.value;
  };
  const list: InkLevel[] = [];
  for (let level = 0; level < INK_LEVELS; level++) {
    const full = counts[level]! + (level === INK_LEVELS - 1 ? draw(2) : 0);
    // Round 10 always has strictly more grey lines than round 9.
    const atLeast = level === INK_LEVELS - 1 ? list[level - 1]!.blocks.length + 1 : 1;
    let made: InkLevel | null = null;
    for (let attempt = 0; attempt < (atLeast > 1 ? 200 : 60) && !made; attempt++) {
      // After a run of failures, fewer extra blocks (never below the round-10 floor).
      const count = Math.max(atLeast, Math.max(1, full - Math.trunc(attempt / 20)));
      const lvl = layout(level, count, draw, h);
      if (lvl.blocks.length < atLeast) continue;
      if (landsUnaided(lvl)) continue;
      const found = findReference(lvl, inkBudget(level));
      if (found) made = { ...lvl, ref: found.ref, refT0: found.t0 };
    }
    if (!made) {
      // Last resort: the spout block only, bucket far to one side, low.
      const spoutX = 120;
      const lvl: InkLevel = {
        spoutX,
        bucketX: 300,
        bucketY: 540,
        blocks: [{ x0: 90, x1: 150, y: 200, ...(h ? { h } : {}) }],
        slideAmp: 0,
        slidePeriod: 1,
        slidePhase: 0,
        ref: [],
        refT0: 0,
      };
      const found = findReference(lvl, inkBudget(level));
      made = { ...lvl, ref: found?.ref ?? [[96, 78, 300, 526]], refT0: found?.t0 ?? 0 };
    }
    list.push(made);
  }
  return { list, rng };
}

/**
 * Test hook: drops a ball from (x, y) onto one line and reports whether its
 * centre ever crossed from one side of the line's span to the other.
 */
export function inkSingleLineDrop(
  x: number,
  y: number,
  vx: number,
  line: [number, number, number, number],
): { crossed: boolean; minDist: number } {
  const [x0, y0, x1, y1] = line;
  const len = isqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
  const segs: InkSeg[] = [{ x0, y0, x1, y1, len }];
  const lvl: InkLevel = {
    spoutX: x,
    bucketX: -1000,
    bucketY: 10_000,
    blocks: [],
    slideAmp: 0,
    slidePeriod: 1,
    slidePhase: 0,
    ref: [],
    refT0: 0,
  };
  const ball: InkBall = { x: x * FP, y: y * FP, vx: vx * FP, vy: 0, on: -1, u: 0, sp: 0, stall: 0 };
  const side = (bx: number, by: number) =>
    Math.sign((x1 - x0) * (by / FP - y0) - (y1 - y0) * (bx / FP - x0));
  const inSpan = (bx: number, by: number) => {
    const t = ((bx / FP - x0) * (x1 - x0) + (by / FP - y0) * (y1 - y0)) / (len * len);
    return t > 0.02 && t < 0.98;
  };
  let lastSide = side(ball.x, ball.y);
  let crossed = false;
  let minDist = Infinity;
  for (let t = 0; t < 400; t++) {
    const px = ball.x,
      py = ball.y;
    if (moveBall(ball, segs, lvl)) break;
    const now = side(ball.x, ball.y);
    // Crossing counts only when the move went through the line's body, not around an end.
    if (
      now !== 0 &&
      lastSide !== 0 &&
      now !== lastSide &&
      (inSpan(px, py) || inSpan(ball.x, ball.y))
    )
      crossed = true;
    if (now !== 0) lastSide = now;
    if (inSpan(ball.x, ball.y)) {
      const d = Math.abs((x1 - x0) * (ball.y / FP - y0) - (y1 - y0) * (ball.x / FP - x0)) / len;
      minDist = Math.min(minDist, d);
    }
  }
  return { crossed, minDist };
}

/** Test hook: does each level's stored reference solution land in the bucket within its ink? */
export function inkReferenceCheck(seed: number, rev?: number): {
  ok: number;
  blocks: number[];
  ink: number[];
  slides: number[];
} {
  const { list } = buildLevels(seed, rev);
  let ok = 0;
  const ink: number[] = [];
  list.forEach((lvl, i) => {
    const live = inkIsLive(i, rev);
    const gravity = live ? INK_LIVE_GRAVITY : GRAVITY;
    const budget = inkBudgetFor(i, rev);
    const pen = strokeSegs(lvl.ref, budget);
    ink.push(pen.segs.reduce((sum, seg) => sum + seg.len, 0));
    if (!live) {
      if (
        pen.penDown === 1 &&
        simulateDrop(lvl, pen.segs, lvl.refT0, gravity) === 1 &&
        !landsUnaided(lvl, gravity)
      )
        ok++;
      return;
    }
    // Live levels: the reference is the pre-release line plus mid-fall live strokes —
    // validate the whole staged route (never the pre-release line in isolation).
    let segs: InkSeg[] = pen.segs;
    let usedInk = pen.segs.reduce((sum, seg) => sum + seg.len, 0) * FP;
    let fits = pen.penDown === 1;
    const stages: { tick: number; segs: readonly InkSeg[] }[] = [{ tick: 0, segs }];
    for (const ev of lvl.liveRef ?? []) {
      const pen2 = strokeSegs([ev.pts], Math.trunc((budget * FP - usedInk) / FP));
      if (pen2.penDown !== 1) {
        fits = false;
        break;
      }
      segs = [...segs, ...pen2.segs];
      usedInk += pen2.segs.reduce((sum, seg) => sum + seg.len, 0) * FP;
      stages.push({ tick: ev.tick + 2, segs });
    }
    if (fits && simulateStaged(lvl, stages, gravity) === 1 && !landsUnaided(lvl, gravity)) ok++;
  });
  return { ok, blocks: list.map((l) => l.blocks.length), ink, slides: list.map((l) => l.slideAmp) };
}

/* ================================ State ================================ */

export interface InkState extends BandFields {
  tick: number;
  rng: number;
  list: InkLevel[];
  /** Current level (0-based) and levels completed. */
  level: number;
  levels: number;
  fails: number;
  segs: InkSeg[];
  strokeStarts: number[];
  penX: number;
  penY: number;
  penDown: number;
  ink: number;
  dropping: number;
  ball: InkBall;
  dropTicks: number;
  positions: { x: number; y: number }[];
  ended: number;
  endedTick: number;
  /** Render only: last drop result (1 bucket, 2 fail) and when. */
  flashKind: number;
  flashTick: number;
  failedBall: { x: number; y: number } | null;
  /** Revision this run was built under (for live-level checks in step/draw). */
  rev: number | undefined;
  /** Live levels: uncommitted strokes drawn since the last lift (faded, non-solid). */
  draftSegs: InkSeg[];
  draftStrokeStarts: number[];
  draftPenX: number;
  draftPenY: number;
  draftPenDown: number;
  /** Live levels: lifts (commits of the draft) made on the current drop (count only). */
  liveLifts: number;
  /** Live levels: ink spent on the pre-release line so far this drop, 1/256 px
   * (enforces INK_LIVE_PRE_CAP in real play, independent of the shared ink pool). */
  preInkUsed: number;
  /** Rev 4 only: stars potted, and whether the coin in this drop has touched the star. */
  stars?: number;
  starGot?: number;
  /** inkRev 6 only (Tuning C): 1 = scored on INK_V6_BAND_CURVE. Absent on every earlier round. */
  tunec?: number;
  /** inkRev 10 only: the world's height, trick shots potted, whether this drop has bounced off a
   * cloud, and the last bounce (tick and cloud index, for the art's squash). */
  worldH?: number;
  tricks?: number;
  cloudHit?: number;
  cloudTick?: number;
  cloudIdx?: number;
  /** inkRev 10 only: silver coins and shamrocks potted, and what this drop has picked up so far (a bit per silver
   * coin; 1 = the shamrock). Like the star, a pickup counts once the coin is potted. */
  silver?: number;
  silverGot?: number;
  shamrocks?: number;
  shamrockGot?: number;
}

const cache = new Map<string, ReturnType<typeof buildLevels>>();

function init(seed: number): InkState {
  return initWith(seed);
}

function initWith(seed: number, rev?: number): InkState {
  const key = `${rev ?? 0}:${seed | 0}`;
  let plan = cache.get(key);
  if (!plan) {
    plan = buildLevels(seed, rev);
    if (cache.size > 16) cache.clear();
    cache.set(key, plan);
  }
  return {
    tick: 0,
    rng: plan.rng,
    list: plan.list,
    level: 0,
    levels: 0,
    fails: 0,
    segs: [],
    strokeStarts: [],
    penX: 0,
    penY: 0,
    penDown: 0,
    ink: inkBudgetFor(0, rev) * FP,
    dropping: 0,
    ball: spoutBall(plan.list[0]!),
    dropTicks: 0,
    positions: [],
    ended: 0,
    endedTick: 0,
    flashKind: 0,
    flashTick: -100,
    failedBall: null,
    rev,
    draftSegs: [],
    draftStrokeStarts: [],
    draftPenX: 0,
    draftPenY: 0,
    draftPenDown: 0,
    liveLifts: 0,
    preInkUsed: 0,
    ...(rev === INK_REV4 ? { stars: 0, starGot: 0 } : {}),
    ...(rev === INK_REV_EXPAND ? { stars: 0, starGot: 0, worldH: INK_TALL_H, tricks: 0, cloudHit: 0, cloudTick: -100, cloudIdx: -1, silver: 0, silverGot: 0, shamrocks: 0, shamrockGot: 0 } : {}),
  };
}

function isOver(state: InkState): boolean {
  return state.ended !== 0;
}

function resetLevel(s: InkState): void {
  s.segs = [];
  s.strokeStarts = [];
  s.penDown = 0;
  s.ink = inkBudgetFor(s.level, s.rev) * FP;
  s.dropping = 0;
  s.ball = spoutBall(s.list[s.level]!);
  s.dropTicks = 0;
  s.positions = [];
  s.draftSegs = [];
  s.draftStrokeStarts = [];
  s.draftPenDown = 0;
  s.liveLifts = 0;
  s.preInkUsed = 0;
  if (s.rev === INK_REV4) s.starGot = 0;
  if (s.rev === INK_REV_EXPAND) {
    s.starGot = 0;
    s.cloudHit = 0;
    s.silverGot = 0;
    s.shamrockGot = 0;
  }
}

/** moveBall's cloud report for the live step (reset after every read). */
const bounce = { cloud: -1 };

function step(state: InkState, input: ArcadeInputEvent | null): InkState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: InkState = {
    ...state,
    tick,
    ball: { ...state.ball },
    segs: [...state.segs],
    strokeStarts: [...state.strokeStarts],
    positions: [...state.positions],
  };

  const live = inkIsLive(s.level, s.rev);
  const gravity = live ? INK_LIVE_GRAVITY : GRAVITY;

  if (input && !s.dropping) {
    if (input.k === INK_INPUT_STROKE) {
      // Live levels: only one pre-release line may be drawn (the rest comes mid-drop as lifts).
      if (live && input.c === 1 && s.strokeStarts.length >= 1) {
        // ignored: pre-release line cap reached
      } else if (live) {
        // Live levels: the pre-release line is capped at INK_LIVE_PRE_CAP px, separate
        // from (and well below) the shared ink pool, so it can never alone reach the
        // bucket — only the actual ink it uses is deducted from the shared pool.
        const beforeInk = s.ink;
        const capRemain = Math.max(0, INK_LIVE_PRE_CAP * FP - s.preInkUsed);
        s.ink = Math.min(s.ink, capRemain);
        addStroke(
          s,
          clampInt(input.a, 0, INK_WORLD_W),
          clampInt(input.b, 0, inkWorldH(s)),
          input.c === 1,
        );
        const used = Math.min(beforeInk, capRemain) - s.ink;
        s.preInkUsed += used;
        s.ink = beforeInk - used;
      } else {
        addStroke(
          s,
          clampInt(input.a, 0, INK_WORLD_W),
          clampInt(input.b, 0, inkWorldH(s)),
          input.c === 1,
        );
      }
    } else if (input.k === INK_INPUT_RELEASE) {
      s.dropping = 1;
      s.penDown = 0;
    } else if (input.k === INK_INPUT_UNDO) {
      const start = s.strokeStarts.pop();
      if (start !== undefined) {
        for (const seg of s.segs.splice(start)) {
          s.ink += seg.len * FP;
          // Live levels: the pre-release cap is refunded too, so the line can be redrawn.
          if (live) s.preInkUsed = Math.max(0, s.preInkUsed - seg.len * FP);
        }
        s.penDown = 0;
      }
    } else if (input.k === INK_INPUT_RESET) {
      resetLevel(s);
    }
  } else if (input && s.dropping && live) {
    if (input.k === INK_INPUT_STROKE) {
      const x = clampInt(input.a, 0, INK_WORLD_W);
      const y = clampInt(input.b, 0, inkWorldH(s));
      // No-draw zone: a point too close to the ball breaks the stroke instead of drawing to it.
      const tooClose =
        Math.hypot(x - s.ball.x / FP, y - s.ball.y / FP) < INK_NO_DRAW_ZONE_PX;
      if (tooClose) {
        s.draftPenDown = 0;
      } else {
        const draft: Pen = {
          segs: s.draftSegs,
          strokeStarts: s.draftStrokeStarts,
          penX: s.draftPenX,
          penY: s.draftPenY,
          penDown: s.draftPenDown,
          ink: s.ink,
        };
        addStroke(draft, x, y, input.c === 1);
        s.draftSegs = draft.segs;
        s.draftStrokeStarts = draft.strokeStarts;
        s.draftPenX = draft.penX;
        s.draftPenY = draft.penY;
        s.draftPenDown = draft.penDown;
        s.ink = draft.ink;
      }
    } else if (input.k === INK_INPUT_LIFT) {
      // Every lifted live stroke commits (there is no per-drop stroke limit: an
      // earlier two-stroke cap silently left later, lower strokes as dashed drafts).
      if (s.draftSegs.length > 0) {
        const offset = s.segs.length;
        s.segs = [...s.segs, ...s.draftSegs];
        s.strokeStarts = [...s.strokeStarts, ...s.draftStrokeStarts.map((i) => i + offset)];
        s.draftSegs = [];
        s.draftStrokeStarts = [];
        s.draftPenDown = 0;
        s.liveLifts += 1;
      }
    }
  }

  if (s.dropping) {
    s.dropTicks += 1;
    s.positions.push({ x: s.ball.x, y: s.ball.y });
    if (s.positions.length > PROGRESS_WINDOW) s.positions.shift();
    let result =
      input?.k === INK_INPUT_DROP_AGAIN
        ? 2
        : moveBall(s.ball, s.segs, s.list[s.level]!, tick, gravity, s.rev === INK_REV_EXPAND ? bounce : undefined);
    // inkRev 10: a cloud bounce marks this drop (a pot after it is a trick shot) and the art's squash.
    if (bounce.cloud >= 0) {
      s.cloudHit = 1;
      s.cloudTick = tick;
      s.cloudIdx = bounce.cloud;
      bounce.cloud = -1;
    }
    // Rev 4: the coin collects the level's star by passing over it; it counts once the coin is potted.
    const starLvl = starRev(s.rev) ? s.list[s.level]! : null;
    if (starLvl?.star && !s.starGot) {
      const dx = s.ball.x / FP - starLvl.star.x;
      const dy = s.ball.y / FP - starLvl.star.y;
      if (dx * dx + dy * dy <= (INK_STAR_R + BALL_R) * (INK_STAR_R + BALL_R)) s.starGot = 1;
    }
    // inkRev 10: silver coins and the shamrock, picked up the same way (they count once the coin is potted).
    if (s.rev === INK_REV_EXPAND) {
      const here = s.list[s.level]!;
      const bx = s.ball.x / FP;
      const by = s.ball.y / FP;
      const coins = here.silver ?? [];
      for (let i = 0; i < coins.length; i++) {
        if ((s.silverGot ?? 0) & (1 << i)) continue;
        const c = coins[i]!;
        if ((bx - c.x) ** 2 + (by - c.y) ** 2 <= (INK_SILVER_R + BALL_R) * (INK_SILVER_R + BALL_R)) s.silverGot = (s.silverGot ?? 0) | (1 << i);
      }
      const sh = here.shamrock;
      if (sh && !s.shamrockGot && (bx - sh.x) ** 2 + (by - sh.y) ** 2 <= (INK_SHAMROCK_R + BALL_R) * (INK_SHAMROCK_R + BALL_R)) s.shamrockGot = 1;
    }
    const old = s.positions[0];
    if (
      !result &&
      (s.dropTicks >= DROP_MAX ||
        (s.positions.length === PROGRESS_WINDOW &&
          old &&
          Math.hypot(s.ball.x - old.x, s.ball.y - old.y) <= PROGRESS_DISTANCE))
    )
      result = 2;
    if (result === 1) {
      s.levels += 1;
      if (starRev(s.rev) && s.starGot) s.stars = (s.stars ?? 0) + 1;
      if (s.rev === INK_REV_EXPAND && s.cloudHit) s.tricks = (s.tricks ?? 0) + 1;
      if (s.rev === INK_REV_EXPAND) {
        let got = s.silverGot ?? 0;
        while (got) {
          s.silver = (s.silver ?? 0) + (got & 1);
          got >>= 1;
        }
        s.shamrocks = (s.shamrocks ?? 0) + (s.shamrockGot ?? 0);
      }
      s.flashKind = 1;
      s.flashTick = tick;
      if (s.levels >= INK_LEVELS) {
        s.dropping = 0;
        s.ended = 1;
        s.endedTick = tick;
        return s;
      }
      s.level += 1;
      resetLevel(s);
    } else if (result === 2) {
      // inkRev 10: level 1 is a warm-up, its misses cost no fail (a player who keeps trying always gets a start).
      if (!(s.rev === INK_REV_EXPAND && s.level < INK_WARMUP_LEVELS)) s.fails += 1;
      s.flashKind = 2;
      s.flashTick = tick;
      s.failedBall = { x: s.ball.x, y: s.ball.y };
      if (s.fails >= INK_FAILS) {
        s.ended = 2;
        s.endedTick = tick;
        return s;
      }
      resetLevel(s);
    }
  }

  if (tick >= INK_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

export const INK_LEVEL_POINTS = 11;

/** 11 per level completed; all ten = 130 + round(20 × ticks left ÷ run). */
export function inkScoreOf(levels: number, tick: number): number {
  if (levels >= INK_LEVELS) return finishScore(INK_RUN_TICKS, tick);
  return clampInt(INK_LEVEL_POINTS * Math.max(0, levels), 0, 130);
}

function score(state: InkState): number {
  if (state.rev === INK_REV4) return inkRev4Score(state.levels, state.stars ?? 0, state.tick);
  return inkScoreOf(state.levels, state.tick);
}

/** Rev 4: 11 per level + 2 per star potted, up to 130; all ten = 130 + speed + stars, up to 150. */
export function inkRev4Score(levels: number, stars: number, tick: number): number {
  const bonus = INK_STAR_POINTS * clampInt(stars, 0, INK_STAR_LEVELS);
  if (levels >= INK_LEVELS) return clampInt(finishScore(INK_RUN_TICKS, tick) + bonus, 0, 150);
  return clampInt(INK_LEVEL_POINTS * Math.max(0, levels) + bonus, 0, 130);
}
/** Rev 4: the most a run short of all ten levels can score (nine levels, every star). */
export const INK_V4_PARTIAL_MAX = 9 * 11 + 2 * 4;

/* ============================= Checkpoints ============================= */

export const INK_CHECKPOINT_INTERVAL = 300;
export const INK_CHECKPOINT_KEYS = [
  "tick",
  "level",
  "levels",
  "fails",
  "segs",
  "ink",
  "penDown",
  "dropping",
  "ended",
  "rng",
  "checksum",
] as const;

export interface InkCheckpoint {
  tick: number;
  level: number;
  levels: number;
  fails: number;
  segs: number;
  ink: number;
  penDown: number;
  dropping: number;
  ended: number;
  rng: number;
  checksum: number;
}

export function inkCheckpoint(state: InkState): InkCheckpoint {
  const snap = {
    tick: state.tick,
    level: state.level,
    levels: state.levels,
    fails: state.fails,
    segs: state.segs.length,
    ink: state.ink,
    penDown: state.penDown,
    dropping: state.dropping,
    ended: state.ended,
    rng: state.rng | 0,
  };
  const b = state.ball;
  const values = [
    ...Object.values(snap),
    b.x,
    b.y,
    b.on,
    b.sp,
    b.stall,
    state.penX,
    state.penY,
    state.dropTicks,
    ...state.strokeStarts,
  ];
  for (const p of state.positions) values.push(p.x, p.y);
  // Rev 4 folds its own counters in; older states never have them, so their sums are unchanged.
  if (state.rev === INK_REV4) values.push(state.stars ?? 0, state.starGot ?? 0);
  // inkRev 10 folds its own fields in the same place; no older state has rev 10, so their sums are unchanged.
  if (state.rev === INK_REV_EXPAND) values.push(state.stars ?? 0, state.starGot ?? 0, state.tricks ?? 0, state.cloudHit ?? 0, state.cloudTick ?? 0, state.cloudIdx ?? 0, state.worldH ?? 0, state.silver ?? 0, state.silverGot ?? 0, state.shamrocks ?? 0, state.shamrockGot ?? 0);
  // inkRev 6 (Tuning C) adds its marker before the segments only when present, so older sums are unchanged.
  if (state.tunec) values.push(state.tunec);
  for (const seg of state.segs) values.push(seg.x0, seg.y0, seg.x1, seg.y1);
  let checksum = 0x811c9dc5;
  for (const value of values) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* =============================== Drawing =============================== */

export const INK_BG = "#07070D";
export const INK_GOLD = "#F5B82E";
export const INK_TEAL = "#2ED3B7";
export const INK_GREY = "#8A8F98";
export const INK_RED = "#FF4D5E";

function draw(ctx: CanvasRenderingContext2D, state: InkState, size: CanvasSize): void {
  const scale = Math.min(size.width / INK_WORLD_W, size.height / INK_WORLD_H);
  const ox = (size.width - INK_WORLD_W * scale) / 2;
  const oy = (size.height - INK_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = INK_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  const tick = state.tick;
  const lvl = state.list[Math.min(state.level, state.list.length - 1)]!;

  // Dispenser: a small hopper and nozzle just above the ball (y 33–43), clear of the HUD rows.
  {
    const x = lvl.spoutX;
    ctx.fillStyle = "rgba(245,184,46,0.55)";
    ctx.beginPath();
    ctx.moveTo(x - 10, SPOUT_Y - 17);
    ctx.lineTo(x + 10, SPOUT_Y - 17);
    ctx.lineTo(x + 4, SPOUT_Y - 11);
    ctx.lineTo(x - 4, SPOUT_Y - 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - 3, SPOUT_Y - 11, 6, 4);
  }

  // Grey blocks.
  ctx.fillStyle = INK_GREY;
  for (const b of lvl.blocks) ctx.fillRect(b.x0, b.y, b.x1 - b.x0, inkBlockH(b));

  // Bucket with a rim.
  const flash = tick - state.flashTick < 20 && state.flashKind === 1;
  ctx.fillStyle = flash ? "#FFFFFF" : INK_TEAL;
  const bx = inkBucketX(lvl, tick);
  const by = lvl.bucketY;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(bx - INK_BUCKET_W / 2, by, INK_BUCKET_W, INK_BUCKET_H);
  ctx.globalAlpha = 1;
  ctx.fillRect(bx - INK_BUCKET_W / 2 + 2, by - 2, INK_BUCKET_W - 4, 3);
  // Rim caps: the two collision circles on the lip.
  for (const cx of [bx - INK_BUCKET_W / 2, bx + INK_BUCKET_W / 2]) {
    ctx.beginPath();
    ctx.arc(cx, by, RIM_R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(bx - INK_BUCKET_W / 2, by, 3, INK_BUCKET_H);
  ctx.fillRect(bx + INK_BUCKET_W / 2 - 3, by, 3, INK_BUCKET_H);

  // Lines, straight from the sim's list.
  ctx.lineCap = "round";
  ctx.strokeStyle = INK_GOLD;
  for (const seg of state.segs) {
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(seg.x0, seg.y0);
    ctx.lineTo(seg.x1, seg.y1);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Ball.
  ctx.fillStyle = INK_GOLD;
  ctx.beginPath();
  ctx.arc(state.ball.x / FP, state.ball.y / FP, BALL_R, 0, Math.PI * 2);
  ctx.fill();

  // Live levels while dropping: faded, non-solid draft strokes (clipped off any birds) and a
  // no-draw ring where the next draft point would be rejected.
  if (inkIsLive(state.level, state.rev) && state.dropping) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, INK_WORLD_W, INK_WORLD_H);
    for (const b of lvl.blocks) if (b.h) ctx.rect(b.x0, b.y, b.x1 - b.x0, inkBlockH(b));
    ctx.clip("evenodd");
    ctx.strokeStyle = INK_GOLD;
    ctx.lineCap = "round";
    ctx.setLineDash([6, 6]);
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 4;
    for (const seg of state.draftSegs) {
      ctx.beginPath();
      ctx.moveTo(seg.x0, seg.y0);
      ctx.lineTo(seg.x1, seg.y1);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(state.ball.x / FP, state.ball.y / FP, INK_NO_DRAW_ZONE_PX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (state.failedBall && tick - state.flashTick < 30 && state.flashKind === 2) {
    ctx.save();
    ctx.globalAlpha = 1 - (tick - state.flashTick) / 30;
    ctx.fillStyle = INK_RED;
    ctx.beginPath();
    ctx.arc(state.failedBall.x / FP, state.failedBall.y / FP, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (tick - state.flashTick < 30 && state.flashKind === 2) {
    ctx.fillStyle = INK_RED;
    ctx.globalAlpha = 1 - (tick - state.flashTick) / 30;
    ctx.font = "bold 22px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Missed — try again", INK_WORLD_W / 2, 300);
    ctx.globalAlpha = 1;
  }

  // Ink bar, top right, for this level's budget.
  const budget = inkBudget(state.level) * FP;
  ctx.strokeStyle = "rgba(245,184,46,0.5)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(INK_WORLD_W - 120, 12, 104, 12);
  ctx.fillStyle = INK_GOLD;
  ctx.fillRect(INK_WORLD_W - 118, 14, (100 * state.ink) / budget, 8);
  // Failed attempts.
  for (let i = 0; i < INK_FAILS; i++) {
    ctx.fillStyle = i < state.fails ? INK_RED : "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.arc(INK_WORLD_W - 162 + i * 14, 18, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = INK_GOLD;
  ctx.font = "bold 16px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Level ${Math.min(state.level + 1, INK_LEVELS)} / ${INK_LEVELS}`, 12, 24);
  ctx.restore();
}

export const inkBridgeGame: ArcadeGame<InkState, ArcadeInputEvent | null> = {
  key: "inkbridge",
  runTicks: INK_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: INK_INPUT_RANGES,
};

/** Birds revision: thicker obstacles, fewer on levels 6–10. */
export const inkBridgeBirdsGame: ArcadeGame<InkState, ArcadeInputEvent | null> = { ...inkBridgeGame, init: (seed) => initWith(seed, INK_REV) };
/** Rainbow Bridge revision 3: reused levels plus the two live levels at the end. */
export const inkBridgeInkRev3Game: ArcadeGame<InkState, ArcadeInputEvent | null> = { ...inkBridgeGame, init: (seed) => initWith(seed, INK_REV3) };
export const inkBridgeInkRev4Game: ArcadeGame<InkState, ArcadeInputEvent | null> = { ...inkBridgeGame, init: (seed) => initWith(seed, INK_REV4) };
export function inkBridgeGameFor(rev?: number | null): ArcadeGame<InkState, ArcadeInputEvent | null> {
  if (rev === INK_REV_EXPAND) return inkBridgeExpandGame;
  if (rev === INK_REV_STRICT) return inkBridgeStrictGame;
  if (rev === INK_REV_TARGET) return inkBridgeTargetGame;
  if (rev === INK_REV_TUNEC) return inkBridgeTunecGame;
  if (rev === INK_REV_BAND) return inkBridgeBandGame;
  if (rev === INK_REV4) return inkBridgeInkRev4Game;
  if (rev === INK_REV3) return inkBridgeInkRev3Game;
  return rev === INK_REV ? inkBridgeBirdsGame : inkBridgeGame;
}

/* ================= Oct 2026 score bands (inkRev 5) ================= */

/** Levels count 10 and gold stars 2; 140 at all ten levels and every star; finishing adds up to 10 for speed. */
export const INK_BAND_CURVE = bandCurve([0, 10, 20, 40, 60, 80, 90, 108], [0, 35, 55, 85, 110, 128, 138, 140]);
export function inkBridgeBandParts(state: InkState): BandParts {
  if (state.rev === INK_REV_EXPAND) return inkExpandBandParts(state);
  const units = 10 * clampInt(state.levels, 0, INK_LEVELS) + INK_STAR_POINTS * clampInt(state.stars ?? 0, 0, INK_STAR_LEVELS);
  const finished = state.levels >= INK_LEVELS;
  return { units, points: bandPoints(bandCurveOf(state, state.tunec ? INK_V6_BAND_CURVE : INK_BAND_CURVE), units), bonus: finished ? speedBonusCurve(BAND_FINISH_BONUS, INK_RUN_TICKS - clampInt(state.endedTick || state.tick, 0, INK_RUN_TICKS), INK_RUN_TICKS) : 0, penalty: 0, finished, text: `${state.levels} / ${INK_LEVELS} levels · ${state.stars ?? 0} stars`, bonusText: "All ten levels" };
}

function scoreBand(state: InkState): number {
  if (state.rev === INK_REV_EXPAND) return bandTotal(inkBridgeBandParts(state), Boolean(state.acted), INK_EXPAND_MAX);
  return bandTotal(inkBridgeBandParts(state), Boolean(state.acted));
}

export const inkBridgeBandGame: ArcadeGame<InkState, ArcadeInputEvent | null> = { ...inkBridgeInkRev4Game, init: (seed) => bandInit(inkBridgeInkRev4Game.init(seed)) };

/* ================= Tuning C (inkRev 6, Oct 2026) ================= */

/**
 * inkRev 6 knots, refitted from Joe's phone runs rather than the bots: he scores
 * 110–124 on inkRev 5 (about 60–76 units: six or seven levels plus stars) and found
 * that slightly lenient, so every knot below the top keeps its units and drops to
 * about 93.5 % of its points (his runs now land about 103–116). All ten levels and
 * every star still reach 140, plus up to 10 for speed.
 */
export const INK_V6_BAND_CURVE = bandCurve([0, 10, 20, 40, 60, 80, 90, 108], [0, 33, 51, 79, 103, 120, 129, 140]);
export const inkBridgeTunecGame: ArcadeGame<InkState, ArcadeInputEvent | null> = { ...inkBridgeBandGame, init: (seed) => ({ ...inkBridgeBandGame.init(seed), tunec: 1 }) };

/* ================= Scoring targets (inkRev 7, 18 Oct 2026) ================= */

/**
 * inkRev 7 (scoring targets, docs/scoring-targets.md): inkRev 6 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const INK_REV_TARGET = 7;
export const inkBridgeTargetGame = bandTargetGame(inkBridgeTunecGame);
/** The curve new rounds score on: INK_V6_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const INK_V7_BAND_CURVE = bandRetarget(INK_V6_BAND_CURVE);


/* ================= Score bands (inkRev 8, 19 Oct 2026) ================= */

/**
 * inkRev 8 (score bands, docs/scoring-targets.md): inkRev 7 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const INK_REV_STRICT = 8;
export const inkBridgeStrictGame = bandStrictGame(inkBridgeTargetGame);
/** The curve new rounds score on: INK_V6_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const INK_V8_BAND_CURVE = bandStrict(INK_V6_BAND_CURVE);


/* ================= x200 (inkRev 10, 26 Oct 2026): scored to 200 ================= */

/** inkRev 10's round maximum (roundMax.ts inkbridge): the base's 150 plus INK_FEATURE_MAX. */
export const INK_EXPAND_MAX = 200;
/**
 * inkRev 10's base curve: levels only (10 a level; the stars moved to the feature bonus), fitted on the skill-band
 * bots' 60 tuning seeds (scripts/ink-x200-bands.ts --fit): every inkRev 10 line is proved for a hand, so every
 * player pots more levels than on inkRev 8 and the curve rises steeply to the last levels (the live ones), keeping a
 * good player within 10 % of their inkRev 8 score while all ten levels reach 140. Plus up to 10 for speed: the base
 * is at most 150.
 */
export const INK_V10_BAND_CURVE = bandCurve([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], [0, 22, 32, 40, 47, 54, 61, 72, 88, 110, 140]);

/** inkRev 10: the most the features' raw points can come to (every star, trick shot, silver coin and the shamrock). */
export const INK_FEATURE_RAW_MAX =
  INK_BONUS_LEVELS * INK_RAW_STAR + INK_CLOUD_LEVELS * INK_RAW_TRICK + INK_BONUS_LEVELS * INK_SILVER_PER_LEVEL * INK_RAW_SILVER + INK_RAW_SHAMROCK;
/**
 * inkRev 10's skill pay: the features' raw points paid on a rising scale, so a few incidental pickups pay little and
 * the full INK_FEATURE_MAX needs every star, trick shot, silver coin and the shamrock.
 */
export const INK_V10_SKILL_PAY = bandCurve([0, 20, 40, 60, 80, 100, 115, INK_FEATURE_RAW_MAX], [0, 4, 10, 18, 27, 35, 42, INK_FEATURE_MAX]);

/** inkRev 10: the features' raw points potted (ink stars 5, trick shots 5, silver coins 2, the shamrock 20). */
export function inkFeatureRaw(state: Pick<InkState, "stars" | "tricks" | "silver" | "shamrocks">): number {
  return (
    INK_RAW_STAR * clampInt(state.stars ?? 0, 0, INK_BONUS_LEVELS) +
    INK_RAW_TRICK * clampInt(state.tricks ?? 0, 0, INK_CLOUD_LEVELS) +
    INK_RAW_SILVER * clampInt(state.silver ?? 0, 0, INK_BONUS_LEVELS * INK_SILVER_PER_LEVEL) +
    INK_RAW_SHAMROCK * clampInt(state.shamrocks ?? 0, 0, 1)
  );
}

/** inkRev 10: the feature bonus the score adds (INK_V10_SKILL_PAY of the raw points, at most INK_FEATURE_MAX). */
export function inkFeaturePaid(raw: number): number {
  return Math.min(INK_FEATURE_MAX, bandPoints(INK_V10_SKILL_PAY, raw));
}

function inkExpandBandParts(state: InkState): BandParts {
  const units = 10 * clampInt(state.levels, 0, INK_LEVELS);
  const finished = state.levels >= INK_LEVELS;
  const speed = finished ? speedBonusCurve(BAND_FINISH_BONUS, INK_RUN_TICKS - clampInt(state.endedTick || state.tick, 0, INK_RUN_TICKS), INK_RUN_TICKS) : 0;
  const raw = inkFeatureRaw(state);
  const paid = inkFeaturePaid(raw);
  const featureText = `${state.stars ?? 0} stars · ${state.tricks ?? 0} trick shots · ${state.silver ?? 0} silver · ${state.shamrocks ? "shamrock" : "no shamrock"}: ${raw} → ${paid}`;
  return {
    units,
    points: bandPoints(INK_V10_BAND_CURVE, units),
    bonus: speed + paid,
    penalty: 0,
    finished,
    text: `${state.levels} / ${INK_LEVELS} levels`,
    bonusText: finished ? `All ten levels (speed ${speed}) and bonuses (${featureText})` : `Bonuses (${featureText})`,
  };
}

/** inkRev 10: the taller world with bounce clouds and stars, scored to 200 (band 3 marks the bands' rules: no input scores 0). */
export const inkBridgeExpandGame: ArcadeGame<InkState, ArcadeInputEvent | null> = {
  ...inkBridgeGame,
  init: (seed) => ({ ...initWith(seed, INK_REV_EXPAND), band: BAND_STRICT_MARK, acted: 0 }),
  inputRanges: INK_TALL_INPUT_RANGES,
};
