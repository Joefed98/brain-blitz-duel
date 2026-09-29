/**
 * Orbit — planet hopping. The ship orbits its planet at a constant angular
 * speed; a tap (k = 0) releases it tangentially in a straight line. Crossing a
 * later planet's orbit ring captures it (pure geometry). Leaving the screen or
 * 120 ticks without capture ends the run, as does a capture onto a red arc.
 * The course is built in full at init and every hop is checked to have a
 * safe release window.
 */

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
import { ANG_QUARTER, iatan2, icos, isin, TRIG_ONE } from "./trig";

/* ============================== Constants ============================== */

const FP = 256;
export const ORBIT_WORLD_W = 390;
export const ORBIT_WORLD_H = 620;
export const ORBIT_RUN_TICKS = 60 * TICKS_PER_SECOND;
export const ORBIT_INPUT_TAP = 0;
export const ORBIT_TOTAL = 30;
const SHIP_SPEED = 1152; // 4.5 px/tick
const FLIGHT_MAX = 120;
/** The current planet sits this far down the screen. */
const VIEW_ANCHOR = 440 * FP;
const VIEW_BELOW = (ORBIT_WORLD_H * FP) - VIEW_ANCHOR;
const HAZARD_FROM = 15;
const HAZARD_SPAN = ANG_QUARTER;
const LOOKAHEAD = 3;
/** Minimum run of consecutive safe release samples per hop. */
const SAFE_RUN = 4;
export const ORBIT_TRAIL_TICKS = 10;

export const ORBIT_INPUT_RANGES: readonly InputRange[] = [inputRange(ORBIT_INPUT_TAP)];

/* ================================ Course =============================== */

export interface Planet {
  x: number;
  y: number;
  r: number;
  ring: number;
  omega: number;
  dir: number;
  /** Hazard arc start angle, or -1. */
  hazard: number;
  colour: number;
}

function planetShape(i: number) {
  const r = (28 - Math.trunc((10 * i) / ORBIT_TOTAL)) * FP;
  const gap = (70 - Math.trunc((30 * i) / ORBIT_TOTAL)) * FP;
  const lap = 90 - Math.trunc((30 * i) / ORBIT_TOTAL);
  return { r, ring: r + gap, omega: Math.trunc(65536 / lap) };
}

function onArc(p: Planet, angle: number): boolean {
  return p.hazard >= 0 && ((angle - p.hazard) & 65535) < HAZARD_SPAN;
}

function orbitPos(p: Planet, angle: number) {
  return {
    x: p.x + Math.trunc((p.ring * icos(angle)) / TRIG_ONE),
    y: p.y + Math.trunc((p.ring * isin(angle)) / TRIG_ONE),
  };
}

function releaseVel(p: Planet, angle: number) {
  return {
    vx: Math.trunc((-p.dir * SHIP_SPEED * isin(angle)) / TRIG_ONE),
    vy: Math.trunc((p.dir * SHIP_SPEED * icos(angle)) / TRIG_ONE),
  };
}

function outside(from: Planet, x: number, y: number): boolean {
  return x < 0 || x > ORBIT_WORLD_W * FP || y < from.y - VIEW_ANCHOR || y > from.y + VIEW_BELOW;
}

/** First later planet whose ring contains the point, or -1. */
function captureAt(planets: readonly Planet[], cur: number, x: number, y: number): number {
  for (let j = cur + 1; j <= cur + LOOKAHEAD && j < planets.length; j++) {
    const p = planets[j]!;
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy <= p.ring * p.ring) return j;
  }
  return -1;
}

/** Does releasing from planet i at this angle reach planet i + 1 safely? */
function hopOk(planets: readonly Planet[], i: number, angle: number): boolean {
  const from = planets[i]!;
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
    return !onArc(to, iatan2(y - to.y, x - to.x));
  }
  return false;
}

function hasWindow(planets: readonly Planet[], i: number): boolean {
  const p = planets[i]!;
  const samples = Math.trunc(65536 / p.omega) + 1;
  const good: boolean[] = [];
  for (let k = 0; k < samples; k++) good.push(hopOk(planets, i, k * p.omega));
  let run = 0;
  for (let k = 0; k < samples * 2; k++) {
    run = good[k % samples] ? run + 1 : 0;
    if (run >= SAFE_RUN) return true;
  }
  return false;
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
    { x: 195 * FP, y: 0, ...first, dir: draw(2) ? 1 : -1, hazard: -1, colour: 0 },
  ];
  for (let i = 1; i <= ORBIT_TOTAL; i++) {
    const prev = planets[i - 1]!;
    const shape = planetShape(i);
    const lo = shape.ring + 8 * FP;
    const hi = ORBIT_WORLD_W * FP - shape.ring - 8 * FP;
    let placed = false;
    for (let attempt = 0; attempt < 40 && !placed; attempt++) {
      const x = lo + draw(Math.max(1, Math.trunc((hi - lo) / FP))) * FP;
      const y = prev.y - (150 + draw(81)) * FP;
      const dx = x - prev.x;
      const dy = y - prev.y;
      const min = prev.ring + shape.ring + 24 * FP;
      if (dx * dx + dy * dy < min * min) continue;
      const hazard = i >= HAZARD_FROM && draw(2) === 1 ? draw(64) * 1024 : -1;
      const candidate: Planet = { x, y, ...shape, dir: draw(2) ? 1 : -1, hazard, colour: i % 4 };
      planets.push(candidate);
      if (hasWindow(planets, i - 1)) placed = true;
      else planets.pop();
    }
    if (!placed) {
      // Fallback: straight above the orbit's side edge — a vertical release always lands.
      const side = prev.x - prev.ring >= lo ? -1 : 1;
      planets.push({
        x: clampInt(prev.x + side * prev.ring, lo, hi),
        y: prev.y - 230 * FP,
        ...shape,
        dir: draw(2) ? 1 : -1,
        hazard: -1,
        colour: i % 4,
      });
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
    if (input !== null && input.k === ORBIT_INPUT_TAP) {
      const v = releaseVel(here, s.angle);
      s.vx = v.vx;
      s.vy = v.vy;
      s.flying = 1;
      s.releaseTick = tick;
      s.releaseX = s.x;
      s.releaseY = s.y;
    } else {
      s.angle = (s.angle + here.dir * here.omega) & 65535;
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
      s.angle = iatan2(s.y - to.y, s.x - to.x);
      const pos = orbitPos(to, s.angle);
      s.x = pos.x;
      s.y = pos.y;
      s.flying = 0;
      s.captured += 1;
      if (onArc(to, s.angle)) die();
    } else if (outside(here, s.x, s.y) || s.flying >= FLIGHT_MAX) die();
    else s.flying += 1;
  }
  const target = s.planets[s.cur]!.y - VIEW_ANCHOR;
  s.camY += Math.trunc((target - s.camY) / 10);
  if (!s.ended && tick >= ORBIT_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

function score(state: OrbitState): number {
  return clampInt(Math.round((150 * state.captured) / ORBIT_TOTAL), 0, 150);
}

export function orbitExtra(s: OrbitState) {
  return {
    captured: s.captured,
    total: ORBIT_TOTAL,
    survived: s.ended !== 2,
    survivedSeconds: s.tick / 60,
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
    ctx.strokeStyle = colour;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, p.ring / FP, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(px, py, p.r / FP - 3, 0, Math.PI * 2);
    ctx.stroke();
    if (p.hazard >= 0) {
      const a0 = (p.hazard / 65536) * Math.PI * 2;
      ctx.strokeStyle = ORBIT_RED;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(px, py, p.ring / FP, a0, a0 + Math.PI / 2);
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
  ctx.fillText(`Planets ${state.captured}`, 14, 26);
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
