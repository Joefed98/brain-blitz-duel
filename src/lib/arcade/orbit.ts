/**
 * Orbit — planet hopping. The ship orbits its planet at a constant angular
 * speed; a tap (k = 0) releases it tangentially in a straight line. Crossing a
 * later planet's orbit ring captures it (pure geometry). Leaving the screen or
 * 150 ticks without capture ends the run, as does a capture onto a red arc.
 * A release that misses planet n + 1 but is caught by n + 2 skips n + 1 (it
 * counts as passed). Capture rings shrink every ten planets (×0.8, floor 45%);
 * red arcs appear on planets 31–40 only. Reaching planet 40 ends the run with a
 * time bonus. The course is built in full at init and every hop is checked to
 * have a safe release window.
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
import { ANG_QUARTER, iatan2, icos, isin, TRIG_ONE } from "./trig";

/* ============================== Constants ============================== */

const FP = 256;
export const ORBIT_WORLD_W = 390;
export const ORBIT_WORLD_H = 620;
export const ORBIT_RUN_TICKS = 60 * TICKS_PER_SECOND;
export const ORBIT_INPUT_TAP = 0;
export const ORBIT_TOTAL = 40;
const FLIGHT_MAX = 150;
/** The current planet sits this far down the screen. */
const VIEW_ANCHOR = 440 * FP;
const VIEW_BELOW = (ORBIT_WORLD_H * FP) - VIEW_ANCHOR;
const HAZARD_FROM = 31;
const HAZARD_SPAN = ANG_QUARTER;
/** Captures reach one planet past the next — a skip. */
const LOOKAHEAD = 2;
/** Off-screen margin above the view a skip may fly through. */
const ABOVE_VIEW = 160 * FP;
/** Minimum run of consecutive safe release samples per hop. */
const SAFE_RUN = 4;
export const ORBIT_TRAIL_TICKS = 10;

export const ORBIT_INPUT_RANGES: readonly InputRange[] = [inputRange(ORBIT_INPUT_TAP)];

/* ================================ Course =============================== */

/** Orbit shapes: a circle, an ellipse (from planet 11), a figure-eight round a pair (from planet 21). */
export const ORBIT_CIRCLE = 0;
export const ORBIT_ELLIPSE = 1;
export const ORBIT_EIGHT = 2;
const ELLIPSE_FROM = 11;
const EIGHT_FROM = 21;
/** Ellipse minor axis, % of the major. */
const ELLIPSE_B_PCT = 60;
/** Figure-eight: half-width = ring × this %, height = half-width × B %. */
const EIGHT_A_PCT = 150;
const EIGHT_B_PCT = 45;
/** Lobe centres and capture radius, % of the half-width. */
const LOBE_C_PCT = 55;
const LOBE_R_PCT = 50;
/** Releasing within this share of the half-width of the crossing hits the pair. */
const EIGHT_INNER_PCT = 30;
/** Lap length (ticks) for each five planets, and the release-flight speed in step. */
const LAPS = [110, 100, 90, 80, 72, 66, 60, 56];
const FLIGHT_SLOW = 1024; // 4.0 px/tick
const FLIGHT_FAST = 1408; // 5.5 px/tick

export interface Planet {
  x: number;
  y: number;
  r: number;
  /** Circle radius; ellipse major semi-axis; figure-eight half-width base. */
  ring: number;
  omega: number;
  dir: number;
  /** Hazard arc start phase, or -1. */
  hazard: number;
  colour: number;
  kind: number;
  /** Ellipse orientation (angle units). */
  rot: number;
  /** Release-flight speed, 1/256 px a tick. */
  speed: number;
}

/** Ring size in % for each band of ten planets (1–10, 11–20 …): ×0.8 per band, floor 45%. */
const RING_BANDS = [100, 80, 64, 51];
const RING_BASE = 98;

function tierOf(i: number): number {
  return Math.min(LAPS.length - 1, Math.trunc(i / 5));
}

function planetShape(i: number) {
  const r = (28 - Math.trunc((10 * i) / ORBIT_TOTAL)) * FP;
  const band = i === 0 ? 0 : Math.min(RING_BANDS.length - 1, Math.trunc((i - 1) / 10));
  const ring = Math.trunc((RING_BASE * RING_BANDS[band]! * FP) / 100);
  const tier = tierOf(i);
  return {
    r,
    ring,
    omega: Math.trunc(65536 / LAPS[tier]!),
    speed: FLIGHT_SLOW + Math.trunc(((FLIGHT_FAST - FLIGHT_SLOW) * tier) / (LAPS.length - 1)),
  };
}

const eightA = (p: Planet) => Math.trunc((p.ring * EIGHT_A_PCT) / 100);
const ellipseB = (p: Planet) => Math.trunc((p.ring * ELLIPSE_B_PCT) / 100);

/** Furthest the path reaches from the planet's centre (for spacing and the screen edge). */
export function orbitExtent(p: { kind: number; ring: number }): number {
  return p.kind === ORBIT_EIGHT ? Math.trunc((p.ring * EIGHT_A_PCT) / 100) : p.ring;
}

function onArc(p: Planet, angle: number): boolean {
  return p.hazard >= 0 && ((angle - p.hazard) & 65535) < HAZARD_SPAN;
}

/** Offset of the path point at this phase from the planet centre, 1/256 px. */
function pathOffset(p: Planet, phase: number): { u: number; v: number } {
  if (p.kind === ORBIT_ELLIPSE) {
    const u = Math.trunc((p.ring * icos(phase)) / TRIG_ONE);
    const v = Math.trunc((ellipseB(p) * isin(phase)) / TRIG_ONE);
    return {
      u: Math.trunc((u * icos(p.rot) - v * isin(p.rot)) / TRIG_ONE),
      v: Math.trunc((u * isin(p.rot) + v * icos(p.rot)) / TRIG_ONE),
    };
  }
  if (p.kind === ORBIT_EIGHT) {
    const a = eightA(p);
    return {
      u: Math.trunc((a * icos(phase)) / TRIG_ONE),
      v: Math.trunc((Math.trunc((a * EIGHT_B_PCT) / 100) * isin((phase * 2) & 65535)) / TRIG_ONE),
    };
  }
  return { u: Math.trunc((p.ring * icos(phase)) / TRIG_ONE), v: Math.trunc((p.ring * isin(phase)) / TRIG_ONE) };
}

function orbitPos(p: Planet, phase: number) {
  const o = pathOffset(p, phase);
  return { x: p.x + o.u, y: p.y + o.v };
}

/** Phase advance this tick: constant, except an ellipse is fastest nearest the planet. */
function phaseRate(p: Planet, phase: number): number {
  if (p.kind !== ORBIT_ELLIPSE) return p.omega;
  const o = pathOffset(p, phase);
  const dist = Math.max(FP, isqrt(Math.trunc(o.u / 16) ** 2 + Math.trunc(o.v / 16) ** 2) * 16);
  const mean = Math.trunc((p.ring + ellipseB(p)) / 2);
  return clampInt(Math.trunc((p.omega * mean) / dist), 1, 4 * p.omega);
}

/** True when a figure-eight release is at the crossing between the pair (unsafe). */
function innerLobe(p: Planet, phase: number): boolean {
  if (p.kind !== ORBIT_EIGHT) return false;
  return Math.abs(pathOffset(p, phase).u) < Math.trunc((eightA(p) * EIGHT_INNER_PCT) / 100);
}

function releaseVel(p: Planet, angle: number) {
  // Tangent of the path at this phase, scaled to the planet's flight speed.
  const a = pathOffset(p, angle);
  const b = pathOffset(p, (angle + p.dir * 256) & 65535);
  const dx = b.u - a.u;
  const dy = b.v - a.v;
  const len = Math.max(1, isqrt(dx * dx + dy * dy));
  return { vx: Math.trunc((dx * p.speed) / len), vy: Math.trunc((dy * p.speed) / len) };
}

function outside(from: Planet, x: number, y: number): boolean {
  return x < 0 || x > ORBIT_WORLD_W * FP || y < from.y - VIEW_ANCHOR - ABOVE_VIEW || y > from.y + VIEW_BELOW;
}

/** Lobe centres of a figure-eight (the pair of planets), as offsets. */
export function orbitLobes(p: { ring: number }): number {
  return Math.trunc((Math.trunc((p.ring * EIGHT_A_PCT) / 100) * LOBE_C_PCT) / 100);
}

/** Is the point inside planet p's capture region (the region the path encloses)? */
function inside(p: Planet, x: number, y: number): boolean {
  const dx = x - p.x;
  const dy = y - p.y;
  if (p.kind === ORBIT_ELLIPSE) {
    const u = Math.trunc((dx * icos(p.rot) + dy * isin(p.rot)) / TRIG_ONE / 16);
    const v = Math.trunc((-dx * isin(p.rot) + dy * icos(p.rot)) / TRIG_ONE / 16);
    const A = Math.trunc(p.ring / 16);
    const B = Math.trunc(ellipseB(p) / 16);
    return u * u * B * B + v * v * A * A <= A * A * B * B;
  }
  if (p.kind === ORBIT_EIGHT) {
    const c = orbitLobes(p);
    const r = Math.trunc((eightA(p) * LOBE_R_PCT) / 100);
    const l = (dx + c) ** 2 + dy * dy;
    const rr = (dx - c) ** 2 + dy * dy;
    return Math.min(l, rr) <= r * r;
  }
  return dx * dx + dy * dy <= p.ring * p.ring;
}

/** Phase on planet p's path for a captured point. */
function phaseAt(p: Planet, x: number, y: number): number {
  const dx = x - p.x;
  const dy = y - p.y;
  if (p.kind === ORBIT_ELLIPSE) {
    const u = Math.trunc((dx * icos(p.rot) + dy * isin(p.rot)) / TRIG_ONE);
    const v = Math.trunc((-dx * isin(p.rot) + dy * icos(p.rot)) / TRIG_ONE);
    return iatan2(Math.trunc((v * p.ring) / Math.max(1, ellipseB(p))), u);
  }
  if (p.kind === ORBIT_EIGHT) {
    // Nearest of 64 sample points on the path.
    let best = 0;
    let bestD = Infinity;
    for (let k = 0; k < 64; k++) {
      const o = pathOffset(p, k * 1024);
      const d = Math.trunc((o.u - dx) / 16) ** 2 + Math.trunc((o.v - dy) / 16) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k * 1024;
      }
    }
    return best;
  }
  return iatan2(dy, dx);
}

/** First later planet whose capture region contains the point, or -1. */
function captureAt(planets: readonly Planet[], cur: number, x: number, y: number): number {
  for (let j = cur + 1; j <= cur + LOOKAHEAD && j < planets.length; j++) {
    if (inside(planets[j]!, x, y)) return j;
  }
  return -1;
}

/** Does releasing from planet i at this phase reach planet i + 1 safely? */
function hopOk(planets: readonly Planet[], i: number, angle: number): boolean {
  const from = planets[i]!;
  if (innerLobe(from, angle)) return false;
  let { x, y } = orbitPos(from, angle);
  const { vx, vy } = releaseVel(from, angle);
  for (let t = 1; t <= FLIGHT_MAX; t++) {
    x += vx;
    y += vy;
    if (outside(from, x, y)) return false;
    const j = captureAt(planets, i, x, y);
    if (j < 0) continue;
    if (j !== i + 1) return false;
    const to = planets[j]!;
    return !onArc(to, phaseAt(to, x, y));
  }
  return false;
}

/** Every phase the ship actually occupies over one lap, in order. */
function lapPhases(p: Planet): number[] {
  const out: number[] = [];
  let phase = 0;
  let travelled = 0;
  while (travelled < 65536 && out.length < 1000) {
    out.push(phase);
    const r = phaseRate(p, phase);
    travelled += r;
    phase = (phase + p.dir * r) & 65535;
  }
  return out;
}

function hasWindow(planets: readonly Planet[], i: number): boolean {
  const good = lapPhases(planets[i]!).map((phase) => hopOk(planets, i, phase));
  const samples = good.length;
  let run = 0;
  for (let k = 0; k < samples * 2; k++) {
    run = good[k % samples] ? run + 1 : 0;
    if (run >= SAFE_RUN) return true;
  }
  return false;
}

/** Test hook: shapes in the course and how many hops have a verified safe window. */
export function orbitCourseCheck(seed: number): { hops: number; safe: number; ellipses: number; eights: number; laps: number[]; speeds: number[] } {
  const { planets } = buildCourse(seed);
  let safe = 0;
  for (let i = 0; i < ORBIT_TOTAL; i++) if (hasWindow(planets, i)) safe++;
  return {
    hops: ORBIT_TOTAL,
    safe,
    ellipses: planets.filter((p) => p.kind === ORBIT_ELLIPSE).length,
    eights: planets.filter((p) => p.kind === ORBIT_EIGHT).length,
    laps: planets.map((p) => Math.round(65536 / p.omega)),
    speeds: planets.map((p) => p.speed / FP),
  };
}

function buildCourse(seed: number): { planets: Planet[]; rng: number } {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const first = planetShape(0);
  const planets: Planet[] = [
    { x: 195 * FP, y: 0, ...first, dir: draw(2) ? 1 : -1, hazard: -1, colour: 0, kind: ORBIT_CIRCLE, rot: 0 },
  ];
  for (let i = 1; i <= ORBIT_TOTAL; i++) {
    const prev = planets[i - 1]!;
    const shape = planetShape(i);
    let placed = false;
    for (let attempt = 0; attempt < 160 && !placed; attempt++) {
      // Shape from the seed: figure-eights from 21 (one in four), ellipses from 11 (one in three).
      const roll = draw(12);
      const kind = i >= EIGHT_FROM && roll < 3 ? ORBIT_EIGHT : i >= ELLIPSE_FROM && roll < 7 && roll >= 3 ? ORBIT_ELLIPSE : ORBIT_CIRCLE;
      const rot = kind === ORBIT_ELLIPSE ? draw(16) * 4096 : 0;
      const extent = orbitExtent({ kind, ring: shape.ring });
      const lo = extent + 8 * FP;
      const hi = ORBIT_WORLD_W * FP - extent - 8 * FP;
      const x = lo + draw(Math.max(1, Math.trunc((hi - lo) / FP))) * FP;
      // Spacing is 1.15× the original 150–230 px.
      const y = prev.y - Math.trunc(((150 + draw(81)) * 115) / 100) * FP;
      const dx = x - prev.x;
      const dy = y - prev.y;
      const min = orbitExtent(prev) + extent + 24 * FP;
      if (dx * dx + dy * dy < min * min) continue;
      const hazard = i >= HAZARD_FROM && draw(2) === 1 ? draw(64) * 1024 : -1;
      const candidate: Planet = { x, y, ...shape, dir: draw(2) ? 1 : -1, hazard, colour: i % 4, kind, rot };
      planets.push(candidate);
      if (hasWindow(planets, i - 1)) placed = true;
      else planets.pop();
    }
    if (!placed) {
      // Fallback: a plain circle straight above the previous path's side edge.
      const lo = shape.ring + 8 * FP;
      const hi = ORBIT_WORLD_W * FP - shape.ring - 8 * FP;
      const reach = orbitExtent(prev);
      const dir = draw(2) ? 1 : -1;
      // Try both sides and a few heights; keep the first one with a proven window.
      let chosen: Planet | null = null;
      for (const side of [-1, 1]) {
        for (const lift of [200, 230, 264, 300]) {
          const c: Planet = { x: clampInt(prev.x + side * reach, lo, hi), y: prev.y - lift * FP, ...shape, dir, hazard: -1, colour: i % 4, kind: ORBIT_CIRCLE, rot: 0 };
          planets.push(c);
          const ok = hasWindow(planets, i - 1);
          planets.pop();
          if (ok && !chosen) chosen = c;
        }
      }
      planets.push(chosen ?? { x: clampInt(prev.x + -1 * reach, lo, hi), y: prev.y - 264 * FP, ...shape, dir, hazard: -1, colour: i % 4, kind: ORBIT_CIRCLE, rot: 0 });
    }
  }
  return { planets, rng };
}

/* ================================ State ================================ */

export interface OrbitState {
  tick: number;
  rng: number;
  cur: number;
  angle: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Ticks since release; 0 while orbiting. */
  flying: number;
  captured: number;
  camY: number;
  releaseTick: number;
  releaseX: number;
  releaseY: number;
  /** 1 once planet 40 is reached. */
  finished: number;
  ended: number;
  endedTick: number;
  planets: Planet[];
}

const cache = new Map<number, { planets: Planet[]; rng: number }>();

function init(seed: number): OrbitState {
  let course = cache.get(seed | 0);
  if (!course) {
    course = buildCourse(seed);
    if (cache.size > 16) cache.clear();
    cache.set(seed | 0, course);
  }
  const p = course.planets[0]!;
  const angle = 3 * ANG_QUARTER;
  const pos = orbitPos(p, angle);
  return {
    tick: 0,
    rng: course.rng,
    cur: 0,
    angle,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    flying: 0,
    captured: 0,
    camY: p.y - VIEW_ANCHOR,
    releaseTick: -100,
    releaseX: 0,
    releaseY: 0,
    finished: 0,
    ended: 0,
    endedTick: 0,
    planets: course.planets,
  };
}

function isOver(state: OrbitState): boolean {
  return state.ended !== 0;
}

function step(state: OrbitState, input: ArcadeInputEvent | null): OrbitState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: OrbitState = { ...state, tick };
  const here = s.planets[s.cur]!;
  const die = () => {
    s.ended = 2;
    s.endedTick = tick;
  };
  if (s.flying === 0) {
    if (input !== null && input.k === ORBIT_INPUT_TAP && innerLobe(here, s.angle)) {
      // Let go at a figure-eight's crossing: straight into the pair.
      die();
      return s;
    }
    if (input !== null && input.k === ORBIT_INPUT_TAP) {
      const v = releaseVel(here, s.angle);
      s.vx = v.vx;
      s.vy = v.vy;
      s.flying = 1;
      s.releaseTick = tick;
      s.releaseX = s.x;
      s.releaseY = s.y;
    } else {
      s.angle = (s.angle + here.dir * phaseRate(here, s.angle)) & 65535;
      const pos = orbitPos(here, s.angle);
      s.x = pos.x;
      s.y = pos.y;
    }
  }
  if (s.flying > 0) {
    s.x += s.vx;
    s.y += s.vy;
    const j = captureAt(s.planets, s.cur, s.x, s.y);
    if (j >= 0) {
      const to = s.planets[j]!;
      s.cur = j;
      s.angle = phaseAt(to, s.x, s.y);
      const pos = orbitPos(to, s.angle);
      s.x = pos.x;
      s.y = pos.y;
      s.flying = 0;
      s.captured += 1;
      if (onArc(to, s.angle)) die();
      else if (j >= ORBIT_TOTAL) {
        s.ended = 1;
        s.endedTick = tick;
        s.finished = 1;
      }
    } else if (outside(here, s.x, s.y) || s.flying >= FLIGHT_MAX) die();
    else s.flying += 1;
  }
  if (s.ended) return s;
  const target = s.planets[s.cur]!.y - VIEW_ANCHOR;
  s.camY += Math.trunc((target - s.camY) / 10);
  if (!s.ended && tick >= ORBIT_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

function score(state: OrbitState): number {
  // 3 per planet passed (captured or skipped) + round(30 × ms left ÷ 60000) for finishing.
  const bonus = state.finished ? Math.round((30 * Math.max(0, ORBIT_RUN_TICKS - state.tick)) / ORBIT_RUN_TICKS) : 0;
  return clampInt(3 * state.cur + bonus, 0, 150);
}

export function orbitExtra(s: OrbitState) {
  return {
    passed: s.cur,
    captured: s.captured,
    total: ORBIT_TOTAL,
    survived: s.ended !== 2,
    survivedSeconds: s.tick / 60,
    finished: s.finished === 1,
    secondsLeft: s.finished ? Math.max(0, ORBIT_RUN_TICKS - s.tick) / 60 : 0,
  };
}

/* ============================= Checkpoints ============================= */

export const ORBIT_CHECKPOINT_INTERVAL = 300;
export const ORBIT_CHECKPOINT_KEYS = [
  "tick",
  "cur",
  "angle",
  "x",
  "y",
  "flying",
  "captured",
  "ended",
  "rng",
  "checksum",
] as const;

export interface OrbitCheckpoint {
  tick: number;
  cur: number;
  angle: number;
  x: number;
  y: number;
  flying: number;
  captured: number;
  ended: number;
  rng: number;
  checksum: number;
}

export function orbitCheckpoint(state: OrbitState): OrbitCheckpoint {
  const snap = {
    tick: state.tick,
    cur: state.cur,
    angle: state.angle,
    x: state.x,
    y: state.y,
    flying: state.flying,
    captured: state.captured,
    ended: state.ended,
    rng: state.rng | 0,
  };
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snap)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* =============================== Drawing =============================== */

export const ORBIT_BG = "#06060F";
export const ORBIT_GOLD = "#F5B82E";
export const ORBIT_RED = "#FF4D5E";
export const ORBIT_COLOURS = ["#2EC4B6", "#8B5CF6", "#3B82F6", "#22C55E"];

function draw(ctx: CanvasRenderingContext2D, state: OrbitState, size: CanvasSize): void {
  const scale = Math.min(size.width / ORBIT_WORLD_W, size.height / ORBIT_WORLD_H);
  const ox = (size.width - ORBIT_WORLD_W * scale) / 2;
  const oy = (size.height - ORBIT_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = ORBIT_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, ORBIT_WORLD_W, ORBIT_WORLD_H);
  ctx.clip();
  const cam = state.camY / FP;

  // Starfield with slow parallax.
  ctx.fillStyle = "#FFFFFF";
  const par = cam * 0.4;
  const band = Math.floor(par / 40);
  for (let row = band - 1; row < band + 18; row++) {
    for (let k = 0; k < 2; k++) {
      const h = Math.imul(row * 2 + k + 7, 2654435761) >>> 0;
      const sx = h % ORBIT_WORLD_W;
      const sy = row * 40 + ((h >>> 12) % 40) - par;
      ctx.globalAlpha = 0.25 + ((h >>> 20) % 50) / 100;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
  }
  ctx.globalAlpha = 1;

  for (let i = Math.max(0, state.cur - 2); i < state.planets.length; i++) {
    const p = state.planets[i]!;
    const px = p.x / FP;
    const py = p.y / FP - cam;
    if (py < -120) break;
    if (py > ORBIT_WORLD_H + 120) continue;
    const colour = ORBIT_COLOURS[p.colour]!;
    // The capture ring follows the path the ship will fly.
    ctx.strokeStyle = colour;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k <= 64; k++) {
      const o = pathOffset(p, (k * 1024) & 65535);
      if (k === 0) ctx.moveTo(px + o.u / FP, py + o.v / FP);
      else ctx.lineTo(px + o.u / FP, py + o.v / FP);
    }
    ctx.stroke();
    if (p.kind === ORBIT_EIGHT) {
      // The crossing between the pair: never let go here.
      const inner = (eightA(p) * EIGHT_INNER_PCT) / 100 / FP;
      ctx.fillStyle = ORBIT_RED;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(px - inner, py - (eightA(p) * EIGHT_B_PCT) / 100 / FP - 4, inner * 2, ((eightA(p) * EIGHT_B_PCT) / 100 / FP) * 2 + 8);
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 5;
    const bodies = p.kind === ORBIT_EIGHT ? [-orbitLobes(p) / FP, orbitLobes(p) / FP] : [0];
    for (const bx of bodies) {
      ctx.beginPath();
      ctx.arc(px + bx, py, (p.kind === ORBIT_EIGHT ? p.r * 0.8 : p.r) / FP - 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.hazard >= 0) {
      ctx.strokeStyle = ORBIT_RED;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) {
        const o = pathOffset(p, (p.hazard + Math.trunc((HAZARD_SPAN * k) / 16)) & 65535);
        if (k === 0) ctx.moveTo(px + o.u / FP, py + o.v / FP);
        else ctx.lineTo(px + o.u / FP, py + o.v / FP);
      }
      ctx.stroke();
    }
  }

  // Release path, faintly, for a moment after the tap.
  const since = state.tick - state.releaseTick;
  if (since >= 0 && since < ORBIT_TRAIL_TICKS && state.flying > 0) {
    ctx.strokeStyle = ORBIT_GOLD;
    ctx.globalAlpha = 0.25 * (1 - since / ORBIT_TRAIL_TICKS);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(state.releaseX / FP, state.releaseY / FP - cam);
    ctx.lineTo(state.releaseX / FP + (state.vx / FP) * 90, state.releaseY / FP - cam + (state.vy / FP) * 90);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Ship heading and trail.
  const here = state.planets[state.cur]!;
  let hx: number;
  let hy: number;
  if (state.flying > 0) {
    hx = state.vx;
    hy = state.vy;
  } else {
    const v = releaseVel(here, state.angle);
    hx = v.vx;
    hy = v.vy;
  }
  const len = Math.hypot(hx, hy) || 1;
  const ux = hx / len;
  const uy = hy / len;
  const sx = state.x / FP;
  const sy = state.y / FP - cam;
  ctx.strokeStyle = ORBIT_GOLD;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx - ux * 18, sy - uy * 18);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = state.ended === 2 ? ORBIT_RED : ORBIT_GOLD;
  ctx.beginPath();
  ctx.moveTo(sx + ux * 10, sy + uy * 10);
  ctx.lineTo(sx - ux * 6 - uy * 6, sy - uy * 6 + ux * 6);
  ctx.lineTo(sx - ux * 6 + uy * 6, sy - uy * 6 - ux * 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 16px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Planets ${state.cur} / ${ORBIT_TOTAL}`, 14, 26);
  ctx.restore();
}

export const orbitGame: ArcadeGame<OrbitState, ArcadeInputEvent | null> = {
  key: "orbit",
  runTicks: ORBIT_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: ORBIT_INPUT_RANGES,
};
