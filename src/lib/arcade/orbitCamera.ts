/** Capture-only, tick-driven rev3 camera. No simulation state is written. */
import { orbitPos, type Planet } from "./orbit";
import type { OrbitRev3State } from "./orbitRev3";
const FP = 256;
export const ORBIT_CAM_VIEW_W = 390;
export const ORBIT_CAM_VIEW_H = 620;
export const ORBIT_CAPTURE_PAN_TICKS = 27;
export const ORBIT_REDUCED_PAN_TICKS = 15;
const SAFE_INSET_X = 70;
const SAFE_INSET_Y = 120;
export const ORBIT_ARROW_GOLD = "#F5B82E";
type Rev3Like = OrbitRev3State;
type PlanetLike = Planet;
export interface OrbitCamOffset { x: number; y: number }
export interface OrbitCamArrow { angle: number; off: number }
function isRev3(s: Rev3Like): boolean { return s?.rev === 3 && Array.isArray(s.planets); }
function curIndex(s: Rev3Like): number { return s.cur; }
function nextIndex(s: Rev3Like): number { return Math.min(s.planets.length - 1, s.cur + 1); }
function rocketOf(s: Rev3Like): OrbitCamOffset { return { x: s.x / FP, y: s.y / FP }; }
interface Entry extends OrbitCamOffset { tick: number; cur: number; captured: number; respawn: number; start: number; from: OrbitCamOffset; target: OrbitCamOffset }
let normal = new WeakMap<object, Entry>();
let reduced = new WeakMap<object, Entry>();
let frames = new WeakMap<object, { normal: OrbitCamOffset; reduced: OrbitCamOffset }>();
let envelopes = new WeakMap<object, { left: number; right: number; top: number; bottom: number }>();
let clampOverrideCount = 0;
export function orbitCameraClampOverrideCount(): number { return clampOverrideCount; }
/** Full path bounds, not the circling rocket: this target never oscillates. */
function framedPlanet(s: Rev3Like): OrbitCamOffset {
  const p = s.planets[s.cur];
  if (!p) return pushSafe(rocketOf(s), { x: 0, y: 0 });
  let b = envelopes.get(p);
  if (!b) {
    b = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (let phase = 0; phase < 65536; phase += 128) {
      const pos = orbitPos(p, phase);
      b.left = Math.min(b.left, pos.x / FP - 1); b.right = Math.max(b.right, pos.x / FP + 1);
      b.top = Math.min(b.top, pos.y / FP - 1); b.bottom = Math.max(b.bottom, pos.y / FP + 1);
    }
    envelopes.set(p, b);
  }
  const next = s.planets[nextIndex(s)] ?? p;
  const cx = p.x / FP, cy = p.y / FP;
  const wantX = cx + Math.max(-35, Math.min(35, (next.x / FP - cx) * 0.12)) - ORBIT_CAM_VIEW_W / 2;
  const wantY = cy + Math.max(-45, Math.min(45, (next.y / FP - cy) * 0.12)) - ORBIT_CAM_VIEW_H / 2;
  // Constrain the lean so the entire path remains in the safe box.
  const x = Math.max(b.right - (ORBIT_CAM_VIEW_W - SAFE_INSET_X), Math.min(b.left - SAFE_INSET_X, wantX));
  const y = Math.max(b.bottom - (ORBIT_CAM_VIEW_H - SAFE_INSET_Y), Math.min(b.top - SAFE_INSET_Y, wantY));
  return { x, y };
}
function pushSafe(r: OrbitCamOffset, c: OrbitCamOffset): OrbitCamOffset {
  return {
    x: Math.max(r.x - (ORBIT_CAM_VIEW_W - SAFE_INSET_X), Math.min(r.x - SAFE_INSET_X, c.x)),
    y: Math.max(r.y - (ORBIT_CAM_VIEW_H - SAFE_INSET_Y), Math.min(r.y - SAFE_INSET_Y, c.y)),
  };
}
function advance(s: Rev3Like, still: boolean): OrbitCamOffset {
  const map = still ? reduced : normal;
  const previous = map.get(s.planets);
  if (previous?.tick === s.tick) return { x: previous.x, y: previous.y };
  const target = framedPlanet(s);
  let e: Entry;
  if (!previous || s.tick < previous.tick) {
    const at = pushSafe(rocketOf(s), target);
    e = { ...at, tick: s.tick, cur: s.cur, captured: s.captured, respawn: s.respawnTick, start: -Infinity, from: at, target };
  } else {
    e = { ...previous, tick: s.tick };
    if (s.cur !== previous.cur || s.captured !== previous.captured || s.respawnTick !== previous.respawn) {
      e = { ...e, cur: s.cur, captured: s.captured, respawn: s.respawnTick, start: s.tick, from: { x: previous.x, y: previous.y }, target };
    }
    let at: OrbitCamOffset = { x: previous.x, y: previous.y };
    // Flight interrupts a pan: never chase the rocket or the next planet.
    if (s.flying > 0) e.start = -Infinity;
    else if (Number.isFinite(e.start)) {
      const p = Math.min(1, (s.tick - e.start) / (still ? ORBIT_REDUCED_PAN_TICKS : ORBIT_CAPTURE_PAN_TICKS));
      const eased = p * p * (3 - 2 * p);
      at = { x: e.from.x + (e.target.x - e.from.x) * eased, y: e.from.y + (e.target.y - e.from.y) * eased };
      if (p === 1) e.start = -Infinity;
    }
    const safe = pushSafe(rocketOf(s), at);
    if (safe.x !== at.x || safe.y !== at.y) clampOverrideCount++;
    e.x = safe.x; e.y = safe.y;
  }
  map.set(s.planets, e);
  return { x: e.x, y: e.y };
}
/** Art wrappers observe EVERY tick, even when drawing skips frames. */
export function orbitCameraObserve(state: Rev3Like): void {
  if (!isRev3(state) || frames.has(state)) return;
  frames.set(state, { normal: advance(state, false), reduced: advance(state, true) });
}
export function orbitCamera(state: Rev3Like, opts?: { reducedMotion?: boolean }): OrbitCamOffset {
  if (!isRev3(state)) return { x: 0, y: 0 };
  orbitCameraObserve(state);
  const frame = frames.get(state);
  return (opts?.reducedMotion ? frame?.reduced : frame?.normal) ?? framedPlanet(state);
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
  const offX = Math.max(0, r - px, px + r - ORBIT_CAM_VIEW_W);
  const offY = Math.max(0, r - py, py + r - ORBIT_CAM_VIEW_H);
  const diameter = r * 2;
  const offFrac = Math.max(offX, offY) / diameter;
  if (offFrac <= 0.3) return null;
  const angle = Math.atan2(py - ORBIT_CAM_VIEW_H / 2, px - ORBIT_CAM_VIEW_W / 2);
  return { angle, off: Math.min(1, offFrac) };
}

/** Isolate a new replay/test without changing any game state. */
export function orbitCameraResetCache(): void {
  normal = new WeakMap(); reduced = new WeakMap(); frames = new WeakMap();
  envelopes = new WeakMap(); clampOverrideCount = 0;
}
