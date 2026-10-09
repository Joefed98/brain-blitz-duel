/**
 * Orbit rev 3 camera — render-only. Pure function of sim state (never the
 * frame clock): target = rocket + 35% toward the next planet, rocket held in
 * a central safe box, eased with a critically-damped spring evaluated per sim
 * tick. While in flight the camera locks straight to the rocket (no cap, no
 * spring) so a fast hop can never outrun the view. Assumed rev-3 field names
 * (per spec, orbit.ts rev 3 is being built concurrently and does not yet
 * exist): state.rev, state.worldW, state.planets[{x,y,ring}], state.rocket
 * {x,y} (falls back to state.x/state.y), state.current/state.cur,
 * state.next, state.inFlight (falls back to state.flying > 0). Coordinates
 * are the sim's 1/256 px fixed point, like the rest of orbit.ts; this module
 * returns plain world px (already divided by FP), matching how
 * orbit.renderer.ts already consumes `camY`.
 */

const FP = 256;
export const ORBIT_CAM_VIEW_W = 390;
export const ORBIT_CAM_VIEW_H = 620;
const SAFE_INSET_X = 70;
const SAFE_INSET_Y = 120;
const LEAD_PCT = 0.35;
const ORBIT_SPEED_CAP = 6;
const SPRING_OMEGA = 0.35;
export const ORBIT_ARROW_GOLD = "#F5B82E";
const REDUCED_SLIDE_MS = 250;
const TICK_MS = 1000 / 60;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rev3Like = any;

interface PlanetLike {
  x: number;
  y: number;
  ring?: number;
  r?: number;
}

export interface OrbitCamOffset {
  x: number;
  y: number;
}

export interface OrbitCamArrow {
  /** Screen-space angle (radians) from the view centre toward the next planet. */
  angle: number;
  /** 0 (fully visible) .. 1 (far off-screen), used to fade/scale the arrow. */
  off: number;
}

function isRev3(state: Rev3Like): boolean {
  return !!state && state.rev === 3 && Array.isArray(state.planets);
}

function rocketOf(state: Rev3Like): { x: number; y: number } {
  const r = state.rocket;
  if (r && typeof r.x === "number" && typeof r.y === "number") return { x: r.x / FP, y: r.y / FP };
  return { x: (state.x ?? 0) / FP, y: (state.y ?? 0) / FP };
}

function curIndex(state: Rev3Like): number {
  return typeof state.current === "number" ? state.current : typeof state.cur === "number" ? state.cur : 0;
}

function nextIndex(state: Rev3Like): number {
  if (typeof state.next === "number") return state.next;
  const planets = state.planets as PlanetLike[];
  return Math.min(planets.length - 1, curIndex(state) + 1);
}

function inFlight(state: Rev3Like): boolean {
  if (typeof state.inFlight === "boolean") return state.inFlight;
  return (state.flying ?? 0) > 0;
}

function worldWidth(state: Rev3Like): number {
  return typeof state.worldW === "number" ? state.worldW : ORBIT_CAM_VIEW_W;
}

/** Raw (unsprung) camera top-left for this instant: lead toward the next planet, rocket boxed. */
function rawCamera(state: Rev3Like): OrbitCamOffset {
  const planets = state.planets as PlanetLike[];
  const rocket = rocketOf(state);
  const next = planets[nextIndex(state)] ?? planets[curIndex(state)] ?? rocket;
  const nx = next.x / FP;
  const ny = next.y / FP;
  const focusX = rocket.x + (nx - rocket.x) * LEAD_PCT;
  const focusY = rocket.y + (ny - rocket.y) * LEAD_PCT;
  let camX = focusX - ORBIT_CAM_VIEW_W / 2;
  let camY = focusY - ORBIT_CAM_VIEW_H / 2;
  const left = camX + SAFE_INSET_X;
  const right = camX + ORBIT_CAM_VIEW_W - SAFE_INSET_X;
  const top = camY + SAFE_INSET_Y;
  const bottom = camY + ORBIT_CAM_VIEW_H - SAFE_INSET_Y;
  if (rocket.x < left) camX -= left - rocket.x;
  else if (rocket.x > right) camX += rocket.x - right;
  if (rocket.y < top) camY -= top - rocket.y;
  else if (rocket.y > bottom) camY += rocket.y - bottom;
  const ww = worldWidth(state);
  camX = Math.max(0, Math.min(Math.max(0, ww - ORBIT_CAM_VIEW_W), camX));
  return { x: camX, y: camY };
}

/** Exact critically-damped spring step (constant-target closed form for one tick). */
function springStep(x: number, v: number, target: number, dt: number): { x: number; v: number } {
  const omega = SPRING_OMEGA;
  const exp = Math.exp(-omega * dt);
  const temp = (v + omega * (x - target)) * dt;
  return { x: target + (x - target + temp) * exp, v: (v - omega * omega * temp * dt) * exp };
}

interface CacheEntry { tick: number; x: number; y: number; vx: number; vy: number }
const cache = new Map<object, CacheEntry>();

function clampStep(prevX: number, prevY: number, x: number, y: number, cap: number): OrbitCamOffset {
  const dx = x - prevX, dy = y - prevY;
  const len = Math.hypot(dx, dy);
  if (len <= cap || len === 0) return { x, y };
  const k = cap / len;
  return { x: prevX + dx * k, y: prevY + dy * k };
}

/**
 * Deterministic camera offset for this sim state. Determinism relies only on
 * `state.planets` (the seeded, stable course array — the same reference
 * across a course's lifetime) and `state.tick`; a tick visited twice with the
 * same state values reproduces the same offset, and sequential ticks (play,
 * reveal replay, intro demo) ease smoothly through the cached spring.
 * Non-sequential jumps (e.g. a reveal built straight at its final tick) snap
 * to the raw target for that one frame rather than paying for a full replay.
 */
export function orbitCamera(state: Rev3Like, opts?: { reducedMotion?: boolean }): OrbitCamOffset {
  if (!isRev3(state)) return { x: 0, y: 0 };
  const raw = rawCamera(state);
  const flying = inFlight(state);
  const key = state.planets as object;
  const prev = cache.get(key);
  const reduced = opts?.reducedMotion ?? false;

  if (flying && !reduced) {
    // Locked to the rocket: no spring, no cap, never outrun.
    cache.set(key, { tick: state.tick, x: raw.x, y: raw.y, vx: 0, vy: 0 });
    return raw;
  }

  if (reduced) {
    if (flying) {
      // Hold during flight.
      const held = prev ?? { tick: state.tick, x: raw.x, y: raw.y, vx: 0, vy: 0 };
      cache.set(key, { ...held, tick: state.tick });
      return { x: held.x, y: held.y };
    }
    // Re-centre while orbiting with a short slide.
    const slideTicks = Math.max(1, Math.round(REDUCED_SLIDE_MS / TICK_MS));
    if (!prev || prev.tick === state.tick) {
      const out = prev && prev.tick === state.tick ? { x: prev.x, y: prev.y } : raw;
      cache.set(key, { tick: state.tick, x: out.x, y: out.y, vx: 0, vy: 0 });
      return out;
    }
    const t = prev.tick === state.tick - 1 ? 1 / slideTicks : 1;
    const x = prev.x + (raw.x - prev.x) * Math.min(1, t);
    const y = prev.y + (raw.y - prev.y) * Math.min(1, t);
    cache.set(key, { tick: state.tick, x, y, vx: 0, vy: 0 });
    return { x, y };
  }

  if (!prev || prev.tick === state.tick) {
    // Cold start or repeat call for the same tick: snap (repeat calls stay identical — determinism).
    const out = prev && prev.tick === state.tick ? { x: prev.x, y: prev.y, vx: prev.vx, vy: prev.vy } : { x: raw.x, y: raw.y, vx: 0, vy: 0 };
    cache.set(key, { tick: state.tick, x: out.x, y: out.y, vx: out.vx, vy: out.vy });
    return { x: out.x, y: out.y };
  }

  if (prev.tick !== state.tick - 1) {
    // Non-sequential jump: snap rather than pay for an unbounded replay.
    cache.set(key, { tick: state.tick, x: raw.x, y: raw.y, vx: 0, vy: 0 });
    return raw;
  }

  const sx = springStep(prev.x, prev.vx, raw.x, 1);
  const sy = springStep(prev.y, prev.vy, raw.y, 1);
  const capped = clampStep(prev.x, prev.y, sx.x, sy.x === sx.x ? sy.x : sx.x, ORBIT_SPEED_CAP); // placeholder, replaced below
  const out = clampStep(prev.x, prev.y, sx.x, sy.x, ORBIT_SPEED_CAP);
  cache.set(key, { tick: state.tick, x: out.x, y: out.y, vx: sx.v, vy: sy.v });
  return out;
}

/** Visible planet indices for the current camera (view rect + one ring margin either side). */
export function orbitVisiblePlanets(state: Rev3Like, cam: OrbitCamOffset): number[] {
  if (!isRev3(state)) return [];
  const planets = state.planets as PlanetLike[];
  const out: number[] = [];
  for (let i = Math.max(0, curIndex(state) - 2); i < planets.length; i++) {
    const p = planets[i];
    if (!p) continue;
    const extent = Math.max(p.ring ?? 0, p.r ?? 0) / FP + 8;
    const px = p.x / FP, py = p.y / FP;
    if (px + extent < cam.x - extent || px - extent > cam.x + ORBIT_CAM_VIEW_W + extent) continue;
    if (py + extent < cam.y - extent || py - extent > cam.y + ORBIT_CAM_VIEW_H + extent) continue;
    out.push(i);
  }
  return out;
}

/** Gold edge arrow geometry when the next planet's ring is more than 30% off-screen; null otherwise. */
export function orbitCameraArrow(state: Rev3Like, cam: OrbitCamOffset): OrbitCamArrow | null {
  if (!isRev3(state)) return null;
  const planets = state.planets as PlanetLike[];
  const next = planets[nextIndex(state)];
  if (!next) return null;
  const r = Math.max(next.ring ?? 0, next.r ?? 0) / FP || 1;
  const px = next.x / FP - cam.x;
  const py = next.y / FP - cam.y;
  const left = px + r, right = ORBIT_CAM_VIEW_W - (px - r);
  const top = py + r, bottom = ORBIT_CAM_VIEW_H - (py - r);
  const offX = Math.max(0, -left, -right);
  const offY = Math.max(0, -top, -bottom);
  const diameter = r * 2;
  const offFrac = Math.max(offX, offY) / diameter;
  if (offFrac <= 0.3) return null;
  const angle = Math.atan2(py - ORBIT_CAM_VIEW_H / 2, px - ORBIT_CAM_VIEW_W / 2);
  return { angle, off: Math.min(1, offFrac) };
}

/** Test/dev hook: drops cached spring state (new course, or isolating test runs). */
export function orbitCameraResetCache(): void {
  cache.clear();
}
