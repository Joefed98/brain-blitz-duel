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

/* ============================== Constants ============================== */

const FP = 256;
export const INK_WORLD_W = 390;
export const INK_WORLD_H = 620;
export const INK_RUN_TICKS = 120 * TICKS_PER_SECOND;
export const INK_INPUT_STROKE = 8;
export const INK_INPUT_RELEASE = 13;
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
/** Rolling slower than this for STALL_TICKS is a stall. */
const STALL_SPEED = 24;
const STALL_TICKS = 60;

export const INK_BUCKET_W = 64;
export const INK_BUCKET_H = 36;
export const INK_BLOCK_H = 4;
const BLOCK_COUNTS = [1, 2, 3, 3, 4, 5, 6, 7, 7, 8];

export const INK_INPUT_RANGES: readonly InputRange[] = [
  inputRange(INK_INPUT_STROKE, [0, INK_WORLD_W], [0, INK_WORLD_H], [0, 1]),
  inputRange(INK_INPUT_RELEASE, [0, 255]),
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
  /** Reference solution: strokes as flat [x, y, x, y …] point lists. */
  ref: number[][];
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
  ball.x = seg.x0 * FP + Math.trunc(((seg.x1 - seg.x0) * ball.u) / seg.len) + Math.trunc((n[0] * BALL_R * FP) / seg.len);
  ball.y = seg.y0 * FP + Math.trunc(((seg.y1 - seg.y0) * ball.u) / seg.len) + Math.trunc((n[1] * BALL_R * FP) / seg.len);
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

/** One tick of the ball: 0 still going, 1 in the bucket, 2 failed. Mutates ball. */
function moveBall(ball: InkBall, segs: readonly InkSeg[], lvl: InkLevel): number {
  const px = ball.x;
  const py = ball.y;
  const seg = ball.on >= 0 ? segs[ball.on] : undefined;
  if (seg) {
    // Rolling: gravity along the line, fixed friction, onward along the stroke or off the end.
    ball.sp += Math.trunc((GRAVITY * (seg.y1 - seg.y0)) / seg.len);
    ball.sp -= Math.trunc((ball.sp * FRICTION_256) / 256);
    ball.sp = clampInt(ball.sp, -MAX_V, MAX_V);
    ball.u += ball.sp;
    ball.stall = Math.abs(ball.sp) < STALL_SPEED ? ball.stall + 1 : 0;
    if (ball.stall >= STALL_TICKS) return 2;
    if (ball.u < 0 || ball.u > seg.len * FP) {
      const forward = ball.u > 0;
      const j = joined(segs, ball.on, forward);
      const next = j >= 0 ? segs[j]! : null;
      const dot = next ? (seg.x1 - seg.x0) * (next.x1 - next.x0) + (seg.y1 - seg.y0) * (next.y1 - next.y0) : 0;
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
    ball.x += ball.vx;
    ball.y += ball.vy;
    if (ball.x < BALL_R * FP || ball.x > (INK_WORLD_W - BALL_R) * FP) {
      ball.x = clampInt(ball.x, BALL_R * FP, (INK_WORLD_W - BALL_R) * FP);
      ball.vx = 0;
    }
    // Land on the first line crossed: it was above it and is now within a radius of it.
    for (let i = 0; i < segs.length; i++) {
      const line = segs[i]!;
      const n = upNormal(line);
      if (!n) continue;
      const before = relate(line, px, py, n);
      const after = relate(line, ball.x, ball.y, n);
      if (before.height < BALL_R * FP - FP) continue;
      if (after.height > BALL_R * FP) continue;
      if (after.along < 0 || after.along > line.len * FP) continue;
      ball.on = i;
      ball.u = after.along;
      ball.sp = Math.trunc((ball.vx * (line.x1 - line.x0) + ball.vy * (line.y1 - line.y0)) / line.len);
      placeOn(ball, line);
      break;
    }
  }
  for (const b of lvl.blocks) if (touchesBlock(ball, b)) return 2;
  // Into the bucket through its rim, or past the bottom.
  if (py < lvl.bucketY * FP && ball.y >= lvl.bucketY * FP) {
    const x = Math.trunc(ball.x / FP);
    if (Math.abs(x - lvl.bucketX) <= INK_BUCKET_W / 2 - BALL_R) return 1;
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
  penX: number;
  penY: number;
  penDown: number;
  ink: number;
}

function addStroke(p: Pen, x: number, y: number, start: boolean): void {
  if (start) {
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

/** Runs a drop with fixed lines: 1 bucket, 2 failed. */
function simulateDrop(lvl: InkLevel, segs: readonly InkSeg[]): number {
  const ball = spoutBall(lvl);
  for (let t = 0; t < DROP_MAX; t++) {
    const r = moveBall(ball, segs, lvl);
    if (r) return r;
  }
  return 2;
}

function strokeSegs(ref: readonly number[][], ink: number): Pen {
  const pen: Pen = { segs: [], penX: 0, penY: 0, penDown: 0, ink: ink * FP };
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
  if (Math.abs(bucketX - spoutX) < 100) bucketX = spoutX < 195 ? Math.min(340, spoutX + 100 + draw(60)) : Math.max(50, spoutX - 100 - draw(60));
  const bucketY = 470 + draw(81);
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
    if (by > bucketY - 60 && bx < bucketX + INK_BUCKET_W / 2 + 10 && bx + len > bucketX - INK_BUCKET_W / 2 - 10) continue;
    if (blocks.some((o) => blockOverlaps(o, b))) continue;
    blocks.push(b);
    k++;
  }
  return { spoutX, bucketX, bucketY, blocks, ref: [] };
}

/** Candidate reference strokes: a ramp under the spout to above the bucket, optionally via a waypoint. */
function findReference(lvl: InkLevel, ink: number): number[][] | null {
  const dir = lvl.bucketX > lvl.spoutX ? 1 : -1;
  const sx = lvl.spoutX - dir * 24;
  const sy = SPOUT_Y + 28;
  const ends: number[] = [];
  for (const off of [0, -12, 12, -24, 24, -36, 36, -48]) ends.push(lvl.bucketX - dir * off);
  const lifts = [14, 26, 44, 70];
  const way: (readonly [number, number])[] = [];
  for (const fy of [25, 45, 65]) for (const fx of [-60, -20, 20, 60, 110]) {
    way.push([lvl.spoutX + dir * fx, sy + Math.trunc(((lvl.bucketY - sy) * fy) / 100)]);
  }
  for (const w of [null, ...way]) {
    for (const lift of lifts) {
      for (const ex of ends) {
        const ey = lvl.bucketY - lift;
        const pts = w ? [sx, sy, w[0], w[1], ex, ey] : [sx, sy, ex, ey];
        if (w && (w[0] < 4 || w[0] > INK_WORLD_W - 4 || w[1] >= ey - 10)) continue;
        const ref = [pts];
        const pen = strokeSegs(ref, ink);
        if (pen.penDown === 0) continue; // ran out of ink
        if (simulateDrop(lvl, pen.segs) === 1) return ref;
      }
    }
  }
  return null;
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
    let made: InkLevel | null = null;
    for (let attempt = 0; attempt < 60 && !made; attempt++) {
      // After a run of failures, fewer extra blocks.
      const count = Math.max(1, full - Math.trunc(attempt / 20));
      const lvl = layout(level, count, draw);
      if (simulateDrop(lvl, []) === 1) continue;
      const ref = findReference(lvl, inkBudget(level));
      if (ref) made = { ...lvl, ref };
    }
    if (!made) {
      // Last resort: the spout block only, bucket far to one side, low.
      const spoutX = 120;
      const lvl: InkLevel = { spoutX, bucketX: 300, bucketY: 540, blocks: [{ x0: 90, x1: 150, y: 200 }], ref: [] };
      made = { ...lvl, ref: findReference(lvl, inkBudget(level)) ?? [[96, 78, 300, 526]] };
    }
    list.push(made);
  }
  return { list, rng };
}

/** Test hook: does each level's stored reference solution land in the bucket within its ink? */
export function inkReferenceCheck(seed: number): { ok: number; blocks: number[]; ink: number[] } {
  const { list } = buildLevels(seed);
  let ok = 0;
  const ink: number[] = [];
  list.forEach((lvl, i) => {
    const pen = strokeSegs(lvl.ref, inkBudget(i));
    ink.push(pen.segs.reduce((sum, seg) => sum + seg.len, 0));
    if (pen.penDown === 1 && simulateDrop(lvl, pen.segs) === 1 && simulateDrop(lvl, []) !== 1) ok++;
  });
  return { ok, blocks: list.map((l) => l.blocks.length), ink };
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
  penX: number;
  penY: number;
  penDown: number;
  ink: number;
  dropping: number;
  ball: InkBall;
  ended: number;
  endedTick: number;
  /** Render only: last drop result (1 bucket, 2 fail) and when. */
  flashKind: number;
  flashTick: number;
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
    penX: 0,
    penY: 0,
    penDown: 0,
    ink: inkBudget(0) * FP,
    dropping: 0,
    ball: spoutBall(plan.list[0]!),
    ended: 0,
    endedTick: 0,
    flashKind: 0,
    flashTick: -100,
  };
}

function isOver(state: InkState): boolean {
  return state.ended !== 0;
}

function resetLevel(s: InkState): void {
  s.segs = [];
  s.penDown = 0;
  s.ink = inkBudget(s.level) * FP;
  s.dropping = 0;
  s.ball = spoutBall(s.list[s.level]!);
}

function step(state: InkState, input: ArcadeInputEvent | null): InkState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: InkState = { ...state, tick, ball: { ...state.ball } };

  if (input && !s.dropping) {
    if (input.k === INK_INPUT_STROKE) {
      addStroke(s, clampInt(input.a, 0, INK_WORLD_W), clampInt(input.b, 0, INK_WORLD_H), input.c === 1);
    } else if (input.k === INK_INPUT_RELEASE) {
      s.dropping = 1;
      s.penDown = 0;
    }
  }

  if (s.dropping) {
    const result = moveBall(s.ball, s.segs, s.list[s.level]!);
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
  const bonus = levels >= INK_LEVELS ? Math.round((40 * Math.max(0, INK_RUN_TICKS - tick)) / INK_RUN_TICKS) : 0;
  return clampInt(levels * (levels + 1) + bonus, 0, 150);
}

function score(state: InkState): number {
  return inkScoreOf(state.levels, state.tick);
}

/* ============================= Checkpoints ============================= */

export const INK_CHECKPOINT_INTERVAL = 300;
export const INK_CHECKPOINT_KEYS = [
  "tick", "level", "levels", "fails", "segs", "ink", "penDown", "dropping", "ended", "rng", "checksum",
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
  const values = [...Object.values(snap), b.x, b.y, b.on, b.sp, b.stall, state.penX, state.penY];
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

  // Spout.
  ctx.fillStyle = "rgba(245,184,46,0.4)";
  ctx.fillRect(lvl.spoutX - 14, SPOUT_Y - 26, 28, 16);

  // Grey blocks.
  ctx.fillStyle = INK_GREY;
  for (const b of lvl.blocks) ctx.fillRect(b.x0, b.y, b.x1 - b.x0, INK_BLOCK_H);

  // Bucket with a rim.
  const flash = tick - state.flashTick < 20 && state.flashKind === 1;
  ctx.fillStyle = flash ? "#FFFFFF" : INK_TEAL;
  const bx = lvl.bucketX;
  const by = lvl.bucketY;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(bx - INK_BUCKET_W / 2, by, INK_BUCKET_W, INK_BUCKET_H);
  ctx.globalAlpha = 1;
  ctx.fillRect(bx - INK_BUCKET_W / 2 - 4, by - 3, INK_BUCKET_W + 8, 5);
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
    ctx.arc(INK_WORLD_W - 110 + i * 16, 36, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = INK_GOLD;
  ctx.font = "bold 18px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Level ${Math.min(state.level + 1, INK_LEVELS)} / ${INK_LEVELS}`, 16, 26);
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
