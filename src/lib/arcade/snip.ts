/**
 * Snip — an arcade game on the shared deterministic engine.
 *
 * A sweet hangs from one to three ropes. Each rope is a verlet chain of
 * integer-position nodes anchored to a pin; the sweet is the chain's last
 * point. A swipe (kind 12, a/b → c/d in world px) is applied on the tick it
 * was recorded against the rope segments as they are on that tick; any rope
 * it crosses is cut. The level ends when the sweet enters the mouth, leaves
 * the arena through the top or bottom, rests on a platform for 0.5 s or
 * 12 s pass, and the next level starts at once. Ten levels in a fixed
 * rising order; the swing is undamped and the side walls are solid.
 * All physics is integer 1/256-pixel units; no floats in the sim.
 */

import { speedBonusCurve } from "../duel/speedPar";
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

/* ============================== Config ============================== */

export interface SnipTemplate {
  name: string;
  sweet: readonly [number, number];
  /** Pin x, pin y, extra slack in px over the start distance. */
  pins: readonly (readonly [number, number, number])[];
  /** x0, y0, x1, y1 (px). */
  platforms: readonly (readonly [number, number, number, number])[];
  mouth: readonly [number, number];
  stars: readonly (readonly [number, number])[];
}

export const SNIP_CONFIG = {
  runSeconds: 60,
  levelSeconds: 12,
  levels: 10,
  /** Ticks resting on a platform before the level fails. */
  restTicks: 30,
  /** Per-tick speed (1/256 px) below which the sweet counts as resting. */
  restSpeed: 48,
  worldW: 1260,
  viewW: 360,
  worldH: 560,
  /** Nodes per rope including the pin; the sweet is one more segment. */
  ropeNodes: 9,
  /** Constraint passes per tick. */
  iterations: 10,
  /** 1/256 px per tick². */
  gravity: 64,
  /** Velocity kept per tick, out of 256. */
  damping: 256,
  /** Out of 256: share of a rope correction taken by the sweet (the rest by its neighbour node). */
  sweetShare: 64,
  sweetRadius: 12,
  /** Sweet centre within this distance of the mouth centre = eaten. */
  mouthRadius: 32,
  /** Sweet centre within this distance of a star = collected. */
  starReach: 24,
  /** Bounce kept off walls and platforms, out of 256. */
  bounce: 112,
  /** Side walls reflect velocity without loss. Platforms keep their existing response. */
  wallBounce: 256,
  /** Sliding speed kept along a platform each contact tick, out of 256. */
  friction: 236,
  /** Seeded pin wobble per level, ± px. */
  pinJitter: 10,
  pointsPerSweet: 10,
  pointsPerStar: 3,
  /** Bonus for clearing all ten levels, scaled by time left. */
  finishBonus: 20,
  maxScore: 150,
  /** Ten levels in play order, easiest first. */
  templates: [
    { name: "Drop", sweet: [270, 170], pins: [[270, 60, 0]], platforms: [], mouth: [270, 480], stars: [[270, 260]] },
    { name: "Swing", sweet: [160, 150], pins: [[270, 50, 0]], platforms: [], mouth: [380, 490], stars: [[270, 200]] },
    { name: "Pair", sweet: [270, 180], pins: [[160, 60, 0], [380, 60, 0]], platforms: [], mouth: [390, 490], stars: [[340, 250]] },
    { name: "Long arc", sweet: [240, 80], pins: [[410, 50, 0]], platforms: [], mouth: [320, 490], stars: [[320, 380]] },
    { name: "Ledge", sweet: [170, 170], pins: [[290, 60, 0]], platforms: [[120, 330, 240, 346]], mouth: [380, 500], stars: [[360, 330]] },
    { name: "Triple", sweet: [270, 200], pins: [[150, 80, 0], [270, 40, 0], [390, 80, 0]], platforms: [[110, 430, 210, 446]], mouth: [270, 490], stars: [[270, 330]] },
    { name: "Anchor", sweet: [310, 150], pins: [[210, 50, 0], [390, 230, 0]], platforms: [[290, 420, 430, 436]], mouth: [170, 490], stars: [[178, 440]] },
    { name: "Shelf", sweet: [200, 170], pins: [[140, 60, 0], [260, 60, 0]], platforms: [[290, 300, 430, 316], [110, 440, 230, 456]], mouth: [380, 280], stars: [[340, 240]] },
    { name: "Gap", sweet: [270, 150], pins: [[130, 100, 30], [410, 100, 30]], platforms: [[120, 400, 240, 416], [300, 400, 420, 416]], mouth: [270, 500], stars: [[270, 260]] },
    { name: "Under", sweet: [270, 170], pins: [[150, 60, 0], [390, 60, 0], [270, 320, 0]], platforms: [[110, 380, 200, 396]], mouth: [380, 470], stars: [[340, 380]] },
  ].map((template): SnipTemplate => ({
    // Keep each layout intact, with 360 extra px of swing clearance on each side.
    name: template.name,
    sweet: [(template.sweet[0] ?? 0) + 360, template.sweet[1] ?? 0],
    pins: template.pins.map(([x = 0, y = 0, slack = 0]) => [x + 360, y, slack]),
    platforms: template.platforms.map(([x0 = 0, y0 = 0, x1 = 0, y1 = 0]) => [x0 + 360, y0, x1 + 360, y1]),
    mouth: [(template.mouth[0] ?? 0) + 360, template.mouth[1] ?? 0],
    stars: template.stars.map(([x = 0, y = 0]) => [x + 360, y]),
  })) as readonly SnipTemplate[],
} as const;

export const SNIP_RUN_TICKS = SNIP_CONFIG.runSeconds * TICKS_PER_SECOND;
export const SNIP_LEVEL_TICKS = SNIP_CONFIG.levelSeconds * TICKS_PER_SECOND;
export const SNIP_W = SNIP_CONFIG.worldW;
export const SNIP_H = SNIP_CONFIG.worldH;
export const SNIP_TEMPLATES = SNIP_CONFIG.templates.length;

/** A swipe step: kind 12, a/b = from (px), c/d = to (px). */
export const SNIP_INPUT_CUT = 12;
const PAD = 40;
export const SNIP_INPUT_RANGES: readonly InputRange[] = [
  inputRange(SNIP_INPUT_CUT, [-PAD, SNIP_W + PAD], [-PAD, SNIP_H + PAD], [-PAD, SNIP_W + PAD], [-PAD, SNIP_H + PAD]),
];

/** Level outcomes. */
export const SNIP_PLAYING = 0;
export const SNIP_EATEN = 1;
export const SNIP_LOST = 2;
export const SNIP_TIMEOUT = 3;
export const SNIP_LANDED = 4;

/* ================================ State ================================ */

export interface SnipRope {
  alive: number;
  len: number; // segment length, 1/256 px
  x: number[];
  y: number[];
  ox: number[];
  oy: number[];
}

export interface SnipState {
  tick: number;
  rng: number;
  /** Template per level (fixed rising order). */
  order: number[];
  /** Consecutive ticks the sweet has rested on a platform. */
  rest: number;
  /** Tick the tenth level was fed (0 = not yet). */
  finishTick: number;
  level: number;
  levelTick: number;
  template: number;
  ropes: SnipRope[];
  sx: number;
  sy: number;
  sox: number;
  soy: number;
  /** Star x, y (1/256 px) and collected flags for this level. */
  starX: number[];
  starY: number[];
  starGot: number[];
  outcome: number;
  /** Tick the last level ended (for the flash). */
  endTick: number;
  lastOutcome: number;
  eaten: number;
  stars: number;
  cuts: number;
  /** Recent cuts, packed tick·64 + level·4 + rope. */
  cutLog: number[];
  /** Sweet position every 300 ticks, packed x px · 1024 + y px. */
  trail: number[];
}

function buildLevel(state: SnipState, level: number, fixedJitter?: number): SnipState {
  const c = SNIP_CONFIG;
  let rng = state.rng;
  const t = state.order[Math.min(level, state.order.length - 1)]!;
  const tpl = c.templates[t]!;
  const ropes: SnipRope[] = [];
  const sx = tpl.sweet[0] * 256;
  const sy = tpl.sweet[1] * 256;
  for (const [px, py, slack] of tpl.pins) {
    const r = rngBelow(rng, 2 * c.pinJitter + 1);
    rng = r.state;
    const x0 = (px + (fixedJitter ?? r.value - c.pinJitter)) * 256;
    const y0 = py * 256;
    const n = c.ropeNodes;
    const dist = isqrt((sx - x0) * (sx - x0) + (sy - y0) * (sy - y0)) + slack * 256;
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      x.push(x0 + Math.trunc(((sx - x0) * i) / n));
      y.push(y0 + Math.trunc(((sy - y0) * i) / n));
    }
    ropes.push({ alive: 1, len: Math.trunc(dist / n), x, y, ox: [...x], oy: [...y] });
  }
  return {
    ...state,
    rng,
    level,
    levelTick: 0,
    template: t,
    ropes,
    sx,
    sy,
    sox: sx,
    soy: sy,
    starX: tpl.stars.map((s) => s[0] * 256),
    starY: tpl.stars.map((s) => s[1] * 256),
    starGot: tpl.stars.map(() => 0),
    outcome: SNIP_PLAYING,
    rest: 0,
  };
}

function init(seed: number): SnipState {
  let rng = seed | 0;
  const order = Array.from({ length: SNIP_CONFIG.levels }, (_, i) => i % SNIP_TEMPLATES);
  const base: SnipState = {
    tick: 0,
    rng,
    order,
    rest: 0,
    finishTick: 0,
    level: 0,
    levelTick: 0,
    template: 0,
    ropes: [],
    sx: 0,
    sy: 0,
    sox: 0,
    soy: 0,
    starX: [],
    starY: [],
    starGot: [],
    outcome: SNIP_PLAYING,
    endTick: -1000,
    lastOutcome: SNIP_PLAYING,
    eaten: 0,
    stars: 0,
    cuts: 0,
    cutLog: [],
    trail: [],
  };
  return buildLevel(base, 0);
}

/** Scripts only: one level of a template with every pin moved by `jitter` px. */
export function snipTestLevel(template: number, jitter: number): SnipState {
  const s = init(1);
  return buildLevel({ ...s, order: [template] }, 0, jitter);
}

function isOver(state: SnipState): boolean {
  return state.tick >= SNIP_RUN_TICKS || state.level >= SNIP_CONFIG.levels;
}

/** Sign of the cross product (b − a) × (p − a). */
function orient(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const v = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Proper or touching intersection of two segments, integer only. */
export function segmentsCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  return false;
}

function ropeCut(rope: SnipRope, sx: number, sy: number, a: number, b: number, c: number, d: number): boolean {
  const n = rope.x.length;
  for (let i = 0; i < n; i++) {
    const x0 = rope.x[i]!;
    const y0 = rope.y[i]!;
    const x1 = i + 1 < n ? rope.x[i + 1]! : sx;
    const y1 = i + 1 < n ? rope.y[i + 1]! : sy;
    if (segmentsCross(x0, y0, x1, y1, a, b, c, d)) return true;
  }
  return false;
}

/** Pulls two points together to at most `len`; wa/wb are shares out of 256. */
function satisfy(
  xs: number[], ys: number[], i: number, j: number, len: number, wa: number, wb: number,
): void {
  const dx = xs[j]! - xs[i]!;
  const dy = ys[j]! - ys[i]!;
  const d = isqrt(dx * dx + dy * dy);
  if (d <= len || d === 0) return;
  const over = d - len;
  const mx = Math.trunc((dx * over) / d);
  const my = Math.trunc((dy * over) / d);
  xs[i] = xs[i]! + ((mx * wa) >> 8);
  ys[i] = ys[i]! + ((my * wa) >> 8);
  xs[j] = xs[j]! - ((mx * wb) >> 8);
  ys[j] = ys[j]! - ((my * wb) >> 8);
}

function step(state: SnipState, input: ArcadeInputEvent | null): SnipState {
  if (isOver(state)) return state;
  const c = SNIP_CONFIG;
  const tick = state.tick + 1;
  let next: SnipState = { ...state, tick, levelTick: state.levelTick + 1 };
  const ropes = state.ropes.map((r) => ({ ...r, x: [...r.x], y: [...r.y], ox: [...r.ox], oy: [...r.oy] }));
  next.ropes = ropes;
  let { sx, sy, sox, soy } = state;

  // 1. Cuts, against the rope positions as they are on this tick.
  if (input && input.k === SNIP_INPUT_CUT) {
    const a = input.a * 256;
    const b = input.b * 256;
    const cc = input.c * 256;
    const d = input.d * 256;
    for (let i = 0; i < ropes.length; i++) {
      const rope = ropes[i]!;
      if (!rope.alive || !ropeCut(rope, sx, sy, a, b, cc, d)) continue;
      rope.alive = 0;
      next.cuts += 1;
      const log = [...next.cutLog, tick * 64 + (state.level % 16) * 4 + i];
      next.cutLog = log.length > 16 ? log.slice(log.length - 16) : log;
    }
  }

  // 2. Verlet integration.
  const vx = ((sx - sox) * c.damping) >> 8;
  const vy = ((sy - soy) * c.damping) >> 8;
  sox = sx;
  soy = sy;
  sx += vx;
  sy += vy + c.gravity;
  for (const rope of ropes) {
    for (let i = 1; i < rope.x.length; i++) {
      const rx = ((rope.x[i]! - rope.ox[i]!) * c.damping) >> 8;
      const ry = ((rope.y[i]! - rope.oy[i]!) * c.damping) >> 8;
      rope.ox[i] = rope.x[i]!;
      rope.oy[i] = rope.y[i]!;
      rope.x[i] = rope.x[i]! + rx;
      rope.y[i] = rope.y[i]! + ry + c.gravity;
    }
  }

  // 3. Rope constraints (a rope only pulls; slack is free). Cut ropes dangle from their pins.
  const sxa = [sx];
  const sya = [sy];
  for (let it = 0; it < c.iterations; it++) {
    for (const rope of ropes) {
      const n = rope.x.length;
      for (let i = 0; i + 1 < n; i++) satisfy(rope.x, rope.y, i, i + 1, rope.len, i === 0 ? 0 : 128, i === 0 ? 256 : 128);
      if (rope.alive) {
        const xs = [rope.x[n - 1]!, sxa[0]!];
        const ys = [rope.y[n - 1]!, sya[0]!];
        satisfy(xs, ys, 0, 1, rope.len, 256 - c.sweetShare, c.sweetShare);
        rope.x[n - 1] = xs[0]!;
        rope.y[n - 1] = ys[0]!;
        sxa[0] = xs[1]!;
        sya[0] = ys[1]!;
      }
    }
  }
  sx = sxa[0]!;
  sy = sya[0]!;

  // 4. Walls and platforms.
  const r = c.sweetRadius * 256;
  const W = c.worldW * 256;
  if (sx < r || sx > W - r) {
    const pvx = sx - sox;
    sx = sx < r ? r : W - r;
    sox = sx + ((pvx * c.wallBounce) >> 8);
  }
  for (const rope of ropes) {
    for (let i = 1; i < rope.x.length; i++) {
      const x = rope.x[i]!;
      if (x >= 0 && x <= W) continue;
      const pvx = x - rope.ox[i]!;
      rope.x[i] = x < 0 ? 0 : W;
      rope.ox[i] = rope.x[i]! + ((pvx * c.wallBounce) >> 8);
    }
  }
  let resting = false;
  const tpl = c.templates[state.template]!;
  for (const [x0p, y0p, x1p, y1p] of tpl.platforms) {
    const x0 = x0p * 256, y0 = y0p * 256, x1 = x1p * 256, y1 = y1p * 256;
    const cx = clampInt(sx, x0, x1);
    const cy = clampInt(sy, y0, y1);
    const dx = sx - cx;
    const dy = sy - cy;
    if (dx * dx + dy * dy >= r * r) continue;
    const pvx = sx - sox;
    const pvy = sy - soy;
    const inside = dx === 0 && dy === 0;
    if (inside || (dy !== 0 && Math.abs(dy) >= Math.abs(dx))) {
      // Vertical contact: land on top (or hit the underside).
      const top = inside ? sy <= (y0 + y1) >> 1 : dy < 0;
      sy = top ? y0 - r : y1 + r;
      if (top && Math.abs(pvx) < c.restSpeed && Math.abs(pvy) < c.restSpeed * 4) resting = true;
      soy = sy + ((pvy * c.bounce) >> 8);
      sox = sx - ((pvx * c.friction) >> 8);
    } else {
      sx = dx < 0 ? x0 - r : x1 + r;
      sox = sx + ((pvx * c.bounce) >> 8);
    }
  }
  next = { ...next, sx, sy, sox, soy, rest: resting ? state.rest + 1 : 0 };

  // 5. Stars, mouth, out of the arena, timeout.
  const reach = c.starReach * 256;
  if (next.starX.length) {
    const got = [...next.starGot];
    for (let i = 0; i < got.length; i++) {
      if (got[i]) continue;
      const dx = sx - next.starX[i]!;
      const dy = sy - next.starY[i]!;
      if (dx * dx + dy * dy < reach * reach) got[i] = 1;
    }
    next.starGot = got;
  }
  const mx = tpl.mouth[0] * 256 - sx;
  const my = tpl.mouth[1] * 256 - sy;
  const mr = c.mouthRadius * 256;
  let outcome = SNIP_PLAYING;
  if (mx * mx + my * my < mr * mr) outcome = SNIP_EATEN;
  else if (sy > (c.worldH + c.sweetRadius * 2) * 256 || sy < -c.sweetRadius * 2 * 256) outcome = SNIP_LOST;
  else if (next.rest >= c.restTicks) outcome = SNIP_LANDED;
  else if (next.levelTick >= SNIP_LEVEL_TICKS) outcome = SNIP_TIMEOUT;

  if (tick % 300 === 0) {
    next.trail = [...next.trail, clampInt(sx >> 8, 0, SNIP_W) * 1024 + clampInt(sy >> 8, 0, 1023)];
  }

  if (outcome !== SNIP_PLAYING) {
    next.stars += Math.min(1, next.starGot.reduce((n, g) => n + g, 0));
    if (outcome === SNIP_EATEN) {
      next.eaten += 1;
      if (next.eaten >= c.levels) next.finishTick = tick;
    }
    next.lastOutcome = outcome;
    next.endTick = tick;
    next = buildLevel(next, state.level + 1);
  }
  return next;
}

/** 10 per level fed + 3 per star; all ten fed adds round(20 × ms left ÷ 60 s); cap 150. */
export function snipScore(eaten: number, stars: number, finishTick = 0): number {
  const c = SNIP_CONFIG;
  const bonus = eaten >= c.levels && finishTick > 0
    ? speedBonusCurve(c.finishBonus, SNIP_RUN_TICKS - finishTick, SNIP_RUN_TICKS)
    : 0;
  return clampInt(eaten * c.pointsPerSweet + stars * c.pointsPerStar + bonus, 0, c.maxScore);
}

function score(state: SnipState): number {
  return snipScore(state.eaten, state.stars, state.finishTick);
}

export function unpackSnipCut(entry: number): { tick: number; level: number; rope: number } {
  return { tick: Math.floor(entry / 64), level: Math.floor(entry / 4) % 16, rope: entry % 4 };
}

/* ============================= Checkpoints ============================= */

export const SNIP_CHECKPOINT_INTERVAL = 300;

export interface SnipCheckpointState {
  tick: number;
  level: number;
  eaten: number;
  stars: number;
  cuts: number;
  posHash: number;
}

export interface SnipCheckpoint extends SnipCheckpointState {
  checksum: number;
}

export const SNIP_CHECKPOINT_FIELDS = ["tick", "level", "eaten", "stars", "cuts", "posHash"] as const;

export function snipCheckpoint(state: SnipState): SnipCheckpoint {
  let posHash = (Math.imul(state.sx, 31) + state.sy) | 0;
  for (const rope of state.ropes) {
    posHash = (Math.imul(posHash, 31) + rope.alive) | 0;
    for (let i = 0; i < rope.x.length; i++) posHash = (Math.imul(posHash, 31) + rope.x[i]! + Math.imul(rope.y[i]!, 3)) | 0;
  }
  const snapshot: SnipCheckpointState = {
    tick: state.tick,
    level: state.level,
    eaten: state.eaten,
    stars: state.stars,
    cuts: state.cuts,
    posHash,
  };
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snapshot)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const SNIP_SWEET = "#E84A7F";
export const SNIP_MOUTH = "#5FBF4A";
export const SNIP_STAR = "#F5C542";

export function snipView(size: CanvasSize): { scaleX: number; scaleY: number } {
  return { scaleX: size.width / SNIP_CONFIG.viewW, scaleY: size.height / SNIP_H };
}

/** Render-only camera: soft velocity lead with a hard visibility guard. */
export function snipCamera(state: SnipState, previous: number, dtSeconds = 1 / 60): number {
  const x = state.sx / 256;
  const velocity = (state.sx - state.sox) / 256;
  const viewW = SNIP_CONFIG.viewW;
  const target = clampInt(x + Math.max(-54, Math.min(54, velocity * 8)) - viewW / 2, 0, SNIP_W - viewW);
  const eased = previous + (target - previous) * (1 - Math.exp(-8 * Math.max(0, dtSeconds)));
  const safe = 36;
  return Math.max(0, Math.min(SNIP_W - viewW, Math.max(x - viewW + safe, Math.min(x - safe, eased))));
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawSnip(
  ctx: CanvasRenderingContext2D,
  state: SnipState,
  size: CanvasSize,
  trail?: readonly (readonly [number, number])[],
  cameraX = snipCamera(state, state.sx / 256 - SNIP_CONFIG.viewW / 2, 1),
): void {
  const { scaleX, scaleY } = snipView(size);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.beginPath();
  ctx.rect(0, 0, size.width, size.height);
  ctx.clip();
  ctx.scale(scaleX, scaleY);
  ctx.translate(-cameraX, 0);
  ctx.fillStyle = "#1E2433";
  ctx.fillRect(0, 0, SNIP_W, SNIP_H);
  ctx.strokeStyle = "#6A7280";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1.5, 0); ctx.lineTo(1.5, SNIP_H);
  ctx.moveTo(SNIP_W - 1.5, 0); ctx.lineTo(SNIP_W - 1.5, SNIP_H);
  ctx.stroke();
  const tpl = SNIP_CONFIG.templates[state.template]!;

  ctx.fillStyle = "#6B5B4B";
  for (const [x0, y0, x1, y1] of tpl.platforms) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Mouth.
  const [mxp, myp] = tpl.mouth;
  ctx.fillStyle = SNIP_MOUTH;
  ctx.beginPath();
  ctx.arc(mxp, myp, SNIP_CONFIG.mouthRadius * 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1E2433";
  ctx.beginPath();
  ctx.ellipse(mxp, myp - SNIP_CONFIG.mouthRadius * 0.1, SNIP_CONFIG.mouthRadius * 0.55, SNIP_CONFIG.mouthRadius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = SNIP_STAR;
  state.starX.forEach((sx, i) => {
    if (!state.starGot[i]) star(ctx, sx / 256, state.starY[i]! / 256, 12);
  });

  // Ropes.
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const rope of state.ropes) {
    ctx.strokeStyle = rope.alive ? "#C9A66B" : "rgba(201,166,107,0.45)";
    ctx.beginPath();
    ctx.moveTo(rope.x[0]! / 256, rope.y[0]! / 256);
    for (let i = 1; i < rope.x.length; i++) ctx.lineTo(rope.x[i]! / 256, rope.y[i]! / 256);
    if (rope.alive) ctx.lineTo(state.sx / 256, state.sy / 256);
    ctx.stroke();
    ctx.fillStyle = "#D9D9D9";
    ctx.beginPath();
    ctx.arc(rope.x[0]! / 256, rope.y[0]! / 256, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = SNIP_SWEET;
  ctx.beginPath();
  ctx.arc(state.sx / 256, state.sy / 256, SNIP_CONFIG.sweetRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.arc(state.sx / 256 - 4, state.sy / 256 - 4, 4, 0, Math.PI * 2);
  ctx.fill();

  if (trail && trail.length > 1) {
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(trail[0]![0], trail[0]![1]);
    for (const [x, y] of trail) ctx.lineTo(x, y);
    ctx.stroke();
  }

  const age = state.tick - state.endTick;
  if (age >= 0 && age < 30) {
    ctx.globalAlpha = 1 - age / 30;
    ctx.fillStyle = state.lastOutcome === SNIP_EATEN ? SNIP_MOUTH : "#D9534F";
    ctx.fillRect(0, 0, SNIP_W, 6);
    ctx.fillRect(0, SNIP_H - 6, SNIP_W, 6);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export const snipGame: ArcadeGame<SnipState, ArcadeInputEvent | null> = {
  key: "snip",
  runTicks: SNIP_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw: (ctx, state, size) => drawSnip(ctx, state, size),
  inputRanges: SNIP_INPUT_RANGES,
};
