/**
 * Ink Bridge — balls drop from a spout; draw lines to roll them into a moving
 * bucket. Strokes arrive as k = 8 events: (a, b) a point in world px, c = 1 to
 * start a stroke there, c = 0 to draw a segment from the pen to that point.
 * All line geometry lives in the sim, built only from recorded events, and
 * every ball–line contact is resolved in integer fixed point.
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
export const INK_RUN_TICKS = 60 * TICKS_PER_SECOND;
export const INK_INPUT_STROKE = 8;
/** Stroke points closer than this to the pen are not sent. */
export const INK_STEP_PX = 12;
export const INK_MAX = 600 * FP;
/** 60 px of ink a second. */
const INK_REFILL = FP;
export const INK_LINE_LIFE = 4 * TICKS_PER_SECOND;
const MAX_SEGS = 160;

const BALL_R = 7;
const GRAVITY = 64; // 0.25 px/tick²
/** Friction while rolling: speed loses 3/256 a tick. */
const FRICTION_256 = 3;
const MAX_V = 16 * FP;
const SPOUT_X = 195;
const SPOUT_Y = 30;

const DROP_START = 90; // 1.5 s
const DROP_END = 48; // 0.8 s
const FIRST_DROP = 60;
/** Drops too late to land are not scheduled. */
const LAST_DROP = INK_RUN_TICKS - 110;

export const INK_BUCKET_W = 64;
export const INK_BUCKET_TOP = 574;
const BUCKET_EVERY = 6 * TICKS_PER_SECOND;
const BUCKET_SLIDE = 30;
const BUCKET_MIN_X = 50;
const BUCKET_MAX_X = 340;

export const INK_INPUT_RANGES: readonly InputRange[] = [
  inputRange(INK_INPUT_STROKE, [0, INK_WORLD_W], [0, INK_WORLD_H], [0, 1]),
];

/* =============================== Schedule =============================== */

function buildSchedule(seed: number) {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const drops: number[] = [];
  for (let t = FIRST_DROP; t <= LAST_DROP; ) {
    drops.push(t);
    t += DROP_START - Math.trunc(((DROP_START - DROP_END) * t) / INK_RUN_TICKS);
  }
  const bucket: number[] = [SPOUT_X + (draw(2) ? 90 : -90)];
  for (let t = BUCKET_EVERY; t < INK_RUN_TICKS; t += BUCKET_EVERY) {
    let x = BUCKET_MIN_X + draw(BUCKET_MAX_X - BUCKET_MIN_X + 1);
    if (Math.abs(x - bucket[bucket.length - 1]!) < 60) x = x < SPOUT_X ? x + 120 : x - 120;
    bucket.push(clampInt(x, BUCKET_MIN_X, BUCKET_MAX_X));
  }
  return { drops, bucket, rng };
}

/** Bucket centre (px) on a tick. */
export function inkBucketX(bucket: readonly number[], tick: number): number {
  const i = Math.trunc(tick / BUCKET_EVERY);
  const into = tick - i * BUCKET_EVERY;
  const to = bucket[clampInt(i, 0, bucket.length - 1)]!;
  if (i === 0 || into >= BUCKET_SLIDE) return to;
  const from = bucket[i - 1]!;
  return from + Math.trunc(((to - from) * into) / BUCKET_SLIDE);
}

/* ================================ State ================================ */

export interface InkSeg {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Length in px (integer). */
  len: number;
  born: number;
}

export interface InkBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Index into segs of the line it is rolling on, or −1. */
  on: number;
  /** Position along that line and speed along it, 1/256 px. */
  u: number;
  sp: number;
}

export interface InkState {
  tick: number;
  rng: number;
  drops: number[];
  bucket: number[];
  next: number;
  balls: InkBall[];
  segs: InkSeg[];
  segBase: number;
  penX: number;
  penY: number;
  penDown: number;
  ink: number;
  caught: number;
  lost: number;
  ended: number;
  endedTick: number;
  lastCatch: number;
}

const cache = new Map<number, ReturnType<typeof buildSchedule>>();

function init(seed: number): InkState {
  let plan = cache.get(seed | 0);
  if (!plan) {
    plan = buildSchedule(seed);
    if (cache.size > 16) cache.clear();
    cache.set(seed | 0, plan);
  }
  return {
    tick: 0,
    rng: plan.rng,
    drops: plan.drops,
    bucket: plan.bucket,
    next: 0,
    balls: [],
    segs: [],
    segBase: 0,
    penX: 0,
    penY: 0,
    penDown: 0,
    ink: INK_MAX,
    caught: 0,
    lost: 0,
    ended: 0,
    endedTick: 0,
    lastCatch: -100,
  };
}

function isOver(state: InkState): boolean {
  return state.ended !== 0;
}

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

function addStroke(s: InkState, x: number, y: number, start: boolean): void {
  if (start) {
    s.penX = x;
    s.penY = y;
    s.penDown = 1;
    return;
  }
  if (!s.penDown) return;
  let dx = x - s.penX;
  let dy = y - s.penY;
  let len = isqrt(dx * dx + dy * dy);
  if (len < 1) return;
  if (len * FP > s.ink) {
    // Out of ink: the stroke stops where the ink runs out.
    const have = Math.trunc(s.ink / FP);
    s.penDown = 0;
    if (have < INK_STEP_PX) return;
    dx = Math.trunc((dx * have) / len);
    dy = Math.trunc((dy * have) / len);
    len = isqrt(dx * dx + dy * dy);
    if (len < 1) return;
  }
  s.ink -= len * FP;
  s.segs = [...s.segs, { x0: s.penX, y0: s.penY, x1: s.penX + dx, y1: s.penY + dy, len, born: s.tick }];
  if (s.segs.length > MAX_SEGS) {
    const drop = s.segs.length - MAX_SEGS;
    s.segs = s.segs.slice(drop);
    s.segBase += drop;
    for (const ball of s.balls) if (ball.on >= 0) ball.on = ball.on - drop < 0 ? -1 : ball.on - drop;
  }
  s.penX += dx;
  s.penY += dy;
}

function step(state: InkState, input: ArcadeInputEvent | null): InkState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: InkState = { ...state, tick, balls: state.balls.map((ball) => ({ ...ball })) };
  s.ink = Math.min(INK_MAX, s.ink + INK_REFILL);

  if (input && input.k === INK_INPUT_STROKE) {
    addStroke(s, clampInt(input.a, 0, INK_WORLD_W), clampInt(input.b, 0, INK_WORLD_H), input.c === 1);
  }

  // Faded lines vanish; balls on them fall.
  let gone = 0;
  while (gone < s.segs.length && tick - s.segs[gone]!.born >= INK_LINE_LIFE) gone += 1;
  if (gone) {
    s.segs = s.segs.slice(gone);
    s.segBase += gone;
    for (const ball of s.balls) if (ball.on >= 0) ball.on = ball.on - gone < 0 ? -1 : ball.on - gone;
  }

  while (s.next < s.drops.length && s.drops[s.next]! <= tick) {
    s.balls.push({ id: s.next, x: SPOUT_X * FP, y: SPOUT_Y * FP, vx: 0, vy: 0, on: -1, u: 0, sp: 0 });
    s.next += 1;
  }

  const bucketX = inkBucketX(s.bucket, tick);
  const kept: InkBall[] = [];
  for (const ball of s.balls) {
    const seg = ball.on >= 0 ? s.segs[ball.on] : undefined;
    if (seg) {
      // Rolling: gravity along the line, fixed friction, fall off either end.
      ball.sp += Math.trunc((GRAVITY * (seg.y1 - seg.y0)) / seg.len);
      ball.sp -= Math.trunc((ball.sp * FRICTION_256) / 256);
      ball.sp = clampInt(ball.sp, -MAX_V, MAX_V);
      ball.u += ball.sp;
      if (ball.u < 0 || ball.u > seg.len * FP) {
        ball.u = clampInt(ball.u, 0, seg.len * FP);
        placeOn(ball, seg);
        ball.vx = Math.trunc(((seg.x1 - seg.x0) * ball.sp) / seg.len);
        ball.vy = Math.trunc(((seg.y1 - seg.y0) * ball.sp) / seg.len);
        ball.on = -1;
      } else placeOn(ball, seg);
    } else {
      ball.on = -1;
      const px = ball.x;
      const py = ball.y;
      ball.vy = Math.min(MAX_V, ball.vy + GRAVITY);
      ball.x += ball.vx;
      ball.y += ball.vy;
      if (ball.x < BALL_R * FP || ball.x > (INK_WORLD_W - BALL_R) * FP) {
        ball.x = clampInt(ball.x, BALL_R * FP, (INK_WORLD_W - BALL_R) * FP);
        ball.vx = 0;
      }
      // Land on the first line crossed: it was above it and is now within a radius of it.
      for (let i = 0; i < s.segs.length; i++) {
        const line = s.segs[i]!;
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
      // Into the bucket, or past the bottom.
      if (py < INK_BUCKET_TOP * FP && ball.y >= INK_BUCKET_TOP * FP) {
        const x = Math.trunc(ball.x / FP);
        if (Math.abs(x - bucketX) <= INK_BUCKET_W / 2 - BALL_R) {
          s.caught += 1;
          s.lastCatch = tick;
          continue;
        }
      }
      if (ball.y > (INK_WORLD_H + BALL_R) * FP) {
        s.lost += 1;
        continue;
      }
    }
    kept.push(ball);
  }
  s.balls = kept;

  if (tick >= INK_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** round(150 × caught ÷ total), cap 150. */
export function inkScoreOf(caught: number, total: number): number {
  if (total <= 0) return 0;
  return clampInt(Math.trunc((300 * caught + total) / (2 * total)), 0, 150);
}

function score(state: InkState): number {
  return inkScoreOf(state.caught, state.drops.length);
}

/* ============================= Checkpoints ============================= */

export const INK_CHECKPOINT_INTERVAL = 300;
export const INK_CHECKPOINT_KEYS = [
  "tick", "next", "segs", "ink", "penDown", "caught", "lost", "ended", "rng", "checksum",
] as const;

export interface InkCheckpoint {
  tick: number;
  next: number;
  segs: number;
  ink: number;
  penDown: number;
  caught: number;
  lost: number;
  ended: number;
  rng: number;
  checksum: number;
}

export function inkCheckpoint(state: InkState): InkCheckpoint {
  const snap = {
    tick: state.tick,
    next: state.next,
    segs: state.segs.length,
    ink: state.ink,
    penDown: state.penDown,
    caught: state.caught,
    lost: state.lost,
    ended: state.ended,
    rng: state.rng | 0,
  };
  const values = [...Object.values(snap)];
  for (const ball of state.balls) values.push(ball.id, ball.x, ball.y, ball.on, ball.sp);
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

  // Spout.
  ctx.fillStyle = "rgba(245,184,46,0.4)";
  ctx.fillRect(SPOUT_X - 14, 0, 28, SPOUT_Y - 8);

  // Lines, fading with age.
  ctx.lineCap = "round";
  for (const seg of state.segs) {
    const life = 1 - (tick - seg.born) / INK_LINE_LIFE;
    ctx.strokeStyle = INK_GOLD;
    ctx.globalAlpha = Math.max(0, life) * 0.25;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(seg.x0, seg.y0);
    ctx.lineTo(seg.x1, seg.y1);
    ctx.stroke();
    ctx.globalAlpha = Math.max(0.1, life);
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Bucket with a rim.
  const bx = inkBucketX(state.bucket, tick);
  const flash = tick - state.lastCatch < 10;
  ctx.fillStyle = flash ? "#FFFFFF" : INK_TEAL;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(bx - INK_BUCKET_W / 2, INK_BUCKET_TOP, INK_BUCKET_W, 36);
  ctx.globalAlpha = 1;
  ctx.fillRect(bx - INK_BUCKET_W / 2 - 4, INK_BUCKET_TOP - 3, INK_BUCKET_W + 8, 5);
  ctx.fillRect(bx - INK_BUCKET_W / 2, INK_BUCKET_TOP, 3, 36);
  ctx.fillRect(bx + INK_BUCKET_W / 2 - 3, INK_BUCKET_TOP, 3, 36);

  // Balls.
  ctx.fillStyle = INK_GOLD;
  for (const ball of state.balls) {
    ctx.beginPath();
    ctx.arc(ball.x / FP, ball.y / FP, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ink bar, top right.
  ctx.strokeStyle = "rgba(245,184,46,0.5)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(INK_WORLD_W - 120, 16, 104, 12);
  ctx.fillStyle = INK_GOLD;
  ctx.fillRect(INK_WORLD_W - 118, 18, (100 * state.ink) / INK_MAX, 8);

  ctx.fillStyle = INK_GOLD;
  ctx.font = "bold 18px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Caught ${state.caught} / ${state.drops.length}`, 16, 30);
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
