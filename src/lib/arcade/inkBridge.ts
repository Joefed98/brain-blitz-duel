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
  inputRange,
  isqrt,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
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
];

/** Ink for a level (0-based), px: 500 at level 1 rising to 1,400 at level 10. */
export function inkBudget(level: number): number {
  return 500 + Math.trunc((900 * clampInt(level, 0, INK_LEVELS - 1)) / (INK_LEVELS - 1));
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
}

export interface InkLevel {
  spoutX: number;
  bucketX: number;
  /** Bucket rim, px. */
  bucketY: number;
  blocks: InkBlock[];
  /** Slide amplitude (px, 0 = still), period (ticks) and phase (angle units). */
  slideAmp: number;
  slidePeriod: number;
  slidePhase: number;
  /** Reference solution: strokes as flat [x, y, x, y …] point lists, and a release tick that lands it. */
  ref: number[][];
  refT0: number;
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
  const candidates: number[] = [];
  // Infinite strip: solve the crossing of either parallel offset line.
  const cross0 = (x0 - ax) * sy - (y0 - ay) * sx;
  const crossV = dx * sy - dy * sx;
  if (crossV !== 0)
    for (const sign of [-1, 1]) {
      const t = (sign * radius * Math.sqrt(lengthSq) - cross0) / crossV;
      if (t >= 0 && t <= 1) candidates.push(t);
    }
  // Rounded caps: solve the moving-point vs circle quadratic, including vertical lines.
  for (const [cx, cy] of [
    [ax, ay],
    [bx, by],
  ] as const) {
    const ox = x0 - cx,
      oy = y0 - cy,
      a = dx * dx + dy * dy;
    if (a === 0) continue;
    const b = 2 * (ox * dx + oy * dy),
      c = ox * ox + oy * oy - radius * radius;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) candidates.push((-b - Math.sqrt(disc)) / (2 * a));
  }
  for (const t of candidates.filter((v) => v >= 0 && v <= 1).sort((a, b) => a - b)) {
    if (distanceSq(Math.min(1, t + 0.00001)) <= radius * radius + 1) return t;
  }
  return null;
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
  const cy = clampInt(ball.y, b.y * FP, (b.y + INK_BLOCK_H) * FP);
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

/** One tick of the ball: 0 still going, 1 in the bucket, 2 failed. Mutates ball. */
function moveBall(ball: InkBall, segs: readonly InkSeg[], lvl: InkLevel, tick = 0): number {
  const bucketX = inkBucketX(lvl, tick);
  const px = ball.x;
  const py = ball.y;
  const seg = ball.on >= 0 ? segs[ball.on] : undefined;
  if (seg) {
    // Rolling: gravity along the line, fixed friction, onward along the stroke or off the end.
    ball.sp += Math.trunc((GRAVITY * (seg.y1 - seg.y0)) / seg.len);
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
    ball.vy = Math.min(MAX_V, ball.vy + GRAVITY);
    const steps = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) / ((BALL_R * FP) / 2)));
    for (let sub = 1; sub <= steps; sub++) {
      const startX = ball.x,
        startY = ball.y;
      const endX = px + Math.trunc((ball.vx * sub) / steps);
      const endY = py + Math.trunc((ball.vy * sub) / steps);
      let first = 2,
        firstIndex = -1;
      for (let i = 0; i < segs.length; i++) {
        const contact = capsuleContact(startX, startY, endX, endY, segs[i]!);
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
  for (const b of lvl.blocks) if (touchesBlock(ball, b)) return 2;
  if (rimBounce(ball, bucketX, lvl.bucketY)) return 0;
  // Into the bucket between its rim caps, or past the bottom.
  if (py < lvl.bucketY * FP && ball.y >= lvl.bucketY * FP) {
    const x = Math.trunc(ball.x / FP);
    if (Math.abs(x - bucketX) <= INK_BUCKET_W / 2 - BALL_R) return 1;
  }
  if (ball.y > (INK_WORLD_H + BALL_R) * FP) return 2;
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

function addStroke(p: Pen, x: number, y: number, start: boolean): void {
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
  p.segs = [...p.segs, { x0: p.penX, y0: p.penY, x1: p.penX + dx, y1: p.penY + dy, len }];
  p.penX += dx;
  p.penY += dy;
}

/** Runs a drop with fixed lines released on tick t0: 1 bucket, 2 failed. */
function simulateDrop(lvl: InkLevel, segs: readonly InkSeg[], t0 = 0): number {
  const ball = spoutBall(lvl);
  for (let t = 0; t < DROP_MAX; t++) {
    const r = moveBall(ball, segs, lvl, t0 + t + 1);
    if (r) return r;
  }
  return 2;
}

function strokeSegs(ref: readonly number[][], ink: number): Pen {
  const pen: Pen = { segs: [], strokeStarts: [], penX: 0, penY: 0, penDown: 0, ink: ink * FP };
  for (const pts of ref) {
    addStroke(pen, pts[0]!, pts[1]!, true);
    for (let i = 2; i < pts.length; i += 2) addStroke(pen, pts[i]!, pts[i + 1]!, false);
  }
  return pen;
}

/* =============================== Levels ================================ */

type Draw = (bound: number) => number;

function blockOverlaps(a: InkBlock, b: InkBlock): boolean {
  return a.x0 < b.x1 + 16 && b.x0 < a.x1 + 16 && Math.abs(a.y - b.y) < 30;
}

function layout(level: number, count: number, draw: Draw): InkLevel {
  const spoutX = 60 + draw(271);
  let bucketX = 50 + draw(291);
  if (Math.abs(bucketX - spoutX) < 100)
    bucketX =
      spoutX < 195 ? Math.min(340, spoutX + 100 + draw(60)) : Math.max(50, spoutX - 100 - draw(60));
  const bucketY = 470 + draw(81);
  let slideAmp = 0;
  let slidePeriod = 1;
  let slidePhase = 0;
  if (level >= SLIDE_FROM) {
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
  blocks.push({ x0, x1: x0 + len0, y: SPOUT_Y + 90 + draw(Math.min(160, 60 + level * 12)) });
  for (let k = 1, tries = 0; k < count && tries < 60; tries++) {
    const len = 60 + draw(141);
    const bx = draw(INK_WORLD_W - len + 1);
    const by = 130 + draw(Math.max(1, bucketY - 50 - 130));
    const b = { x0: bx, x1: bx + len, y: by };
    // Keep the bucket mouth and the spout column above block 0 clear.
    if (by > bucketY - 60 && bx < bucketX + mouth && bx + len > bucketX - mouth) continue;
    if (blocks.some((o) => blockOverlaps(o, b))) continue;
    blocks.push(b);
    k++;
  }
  return { spoutX, bucketX, bucketY, blocks, slideAmp, slidePeriod, slidePhase, ref: [], refT0: 0 };
}

/** Candidate reference strokes: a ramp under the spout to above the bucket, optionally via a waypoint. */
function findReference(lvl: InkLevel, ink: number): { ref: number[][]; t0: number } | null {
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
  const phases = lvl.slideAmp ? 4 : 1;
  for (let k = 0; k < phases; k++) {
    const t0 = Math.trunc((k * lvl.slidePeriod) / phases);
    for (const w of [null, ...way]) {
      for (const lift of lifts) {
        for (const ex of ends) {
          const ey = lvl.bucketY - lift;
          const pts = w ? [sx, sy, w[0], w[1], ex, ey] : [sx, sy, ex, ey];
          if (w && (w[0] < 4 || w[0] > INK_WORLD_W - 4 || w[1] >= ey - 10)) continue;
          const ref = [pts];
          const pen = strokeSegs(ref, ink);
          if (pen.penDown === 0) continue; // ran out of ink
          if (simulateDrop(lvl, pen.segs, t0) === 1) return { ref, t0 };
        }
      }
    }
  }
  return null;
}

/** First of 16 evenly spaced release ticks over one slide period that lands; −1 if none. */
function landingRelease(lvl: InkLevel, segs: readonly InkSeg[]): number {
  const tries = lvl.slideAmp ? 16 : 1;
  for (let k = 0; k < tries; k++) {
    const t0 = Math.trunc((k * lvl.slidePeriod) / tries);
    if (simulateDrop(lvl, segs, t0) === 1) return t0;
  }
  return -1;
}

/** Does any release over one slide period land with no lines? */
function landsUnaided(lvl: InkLevel): boolean {
  return landingRelease(lvl, []) >= 0;
}

function buildLevels(seed: number): { list: InkLevel[]; rng: number } {
  let rng = seed | 0;
  const draw: Draw = (bound) => {
    const r = rngBelow(rng, Math.max(1, bound));
    rng = r.state;
    return r.value;
  };
  const list: InkLevel[] = [];
  for (let level = 0; level < INK_LEVELS; level++) {
    const full = BLOCK_COUNTS[level]! + (level === INK_LEVELS - 1 ? draw(2) : 0);
    // Round 10 always has strictly more grey lines than round 9.
    const atLeast = level === INK_LEVELS - 1 ? list[level - 1]!.blocks.length + 1 : 1;
    let made: InkLevel | null = null;
    for (let attempt = 0; attempt < (atLeast > 1 ? 200 : 60) && !made; attempt++) {
      // After a run of failures, fewer extra blocks (never below the round-10 floor).
      const count = Math.max(atLeast, Math.max(1, full - Math.trunc(attempt / 20)));
      const lvl = layout(level, count, draw);
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
        blocks: [{ x0: 90, x1: 150, y: 200 }],
        slideAmp: 0,
        slidePeriod: 1,
        slidePhase: 0,
        ref: [],
        refT0: 0,
      };
      const found = findReference(lvl, inkBudget(level));
      made = { ...lvl, ref: found?.ref ?? [[96, 78, 300, 526]], refT0: found?.t0 ?? 0 };
    }
    if ((globalThis as { INKDBG?: number }).INKDBG) console.log("level", level, Math.round(performance.now()));
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
export function inkReferenceCheck(seed: number): {
  ok: number;
  blocks: number[];
  ink: number[];
  slides: number[];
} {
  const { list } = buildLevels(seed);
  let ok = 0;
  const ink: number[] = [];
  list.forEach((lvl, i) => {
    const pen = strokeSegs(lvl.ref, inkBudget(i));
    ink.push(pen.segs.reduce((sum, seg) => sum + seg.len, 0));
    if (pen.penDown === 1 && simulateDrop(lvl, pen.segs, lvl.refT0) === 1 && !landsUnaided(lvl))
      ok++;
  });
  return { ok, blocks: list.map((l) => l.blocks.length), ink, slides: list.map((l) => l.slideAmp) };
}

/* ================================ State ================================ */

export interface InkState {
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
}

const cache = new Map<number, ReturnType<typeof buildLevels>>();

function init(seed: number): InkState {
  let plan = cache.get(seed | 0);
  if (!plan) {
    plan = buildLevels(seed);
    if (cache.size > 16) cache.clear();
    cache.set(seed | 0, plan);
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
    ink: inkBudget(0) * FP,
    dropping: 0,
    ball: spoutBall(plan.list[0]!),
    dropTicks: 0,
    positions: [],
    ended: 0,
    endedTick: 0,
    flashKind: 0,
    flashTick: -100,
    failedBall: null,
  };
}

function isOver(state: InkState): boolean {
  return state.ended !== 0;
}

function resetLevel(s: InkState): void {
  s.segs = [];
  s.strokeStarts = [];
  s.penDown = 0;
  s.ink = inkBudget(s.level) * FP;
  s.dropping = 0;
  s.ball = spoutBall(s.list[s.level]!);
  s.dropTicks = 0;
  s.positions = [];
}

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

  if (input && !s.dropping) {
    if (input.k === INK_INPUT_STROKE) {
      addStroke(
        s,
        clampInt(input.a, 0, INK_WORLD_W),
        clampInt(input.b, 0, INK_WORLD_H),
        input.c === 1,
      );
    } else if (input.k === INK_INPUT_RELEASE) {
      s.dropping = 1;
      s.penDown = 0;
    } else if (input.k === INK_INPUT_UNDO) {
      const start = s.strokeStarts.pop();
      if (start !== undefined) {
        for (const seg of s.segs.splice(start)) s.ink += seg.len * FP;
        s.penDown = 0;
      }
    } else if (input.k === INK_INPUT_RESET) {
      resetLevel(s);
    }
  }

  if (s.dropping) {
    s.dropTicks += 1;
    s.positions.push({ x: s.ball.x, y: s.ball.y });
    if (s.positions.length > PROGRESS_WINDOW) s.positions.shift();
    let result =
      input?.k === INK_INPUT_DROP_AGAIN ? 2 : moveBall(s.ball, s.segs, s.list[s.level]!, tick);
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
      s.fails += 1;
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

/** Level n complete = 2 × n; all ten add round(40 × time left ÷ run); cap 150. */
export function inkScoreOf(levels: number, tick: number): number {
  const bonus =
    levels >= INK_LEVELS ? Math.round((40 * Math.max(0, INK_RUN_TICKS - tick)) / INK_RUN_TICKS) : 0;
  return clampInt(levels * (levels + 1) + bonus, 0, 150);
}

function score(state: InkState): number {
  return inkScoreOf(state.levels, state.tick);
}

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
  for (const b of lvl.blocks) ctx.fillRect(b.x0, b.y, b.x1 - b.x0, INK_BLOCK_H);

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
  step,
  isOver,
  score,
  draw,
  inputRanges: INK_INPUT_RANGES,
};
