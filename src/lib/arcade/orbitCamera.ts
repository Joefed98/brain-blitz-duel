/** Capture-only, tick-driven rev3 camera. No simulation state is written. */
import { orbitPos, type Planet } from "./orbit";
import type { OrbitRev3State } from "./orbitRev3";
const FP = 256;
export const ORBIT_CAM_VIEW_W = 390;
export const ORBIT_CAM_VIEW_H = 620;
/**
 * orbitRev 8 (taller worlds, batch 3): the view is ORBIT_TALL_VIEW_H tall and
 * every extra pixel goes above the framing line, so the course shows that much
 * further ahead (it runs up the screen). Earlier revisions keep the 620 view.
 */
export const ORBIT_TALL_VIEW_H = 650;
/** The view height (px) a state is framed in: orbitRev 8's taller view (its `worldH`), or 620. */
export function orbitViewH(state: { worldH?: number } | null | undefined): number {
  return state?.worldH ?? ORBIT_CAM_VIEW_H;
}
/** The view width (px) a state is framed in: orbitRev 12's wider view (its `viewW`), or 390. */
export function orbitViewW(state: { viewW?: number } | null | undefined): number {
  return state?.viewW ?? ORBIT_CAM_VIEW_W;
}
/** How far below the next planet's centre the framed view reaches: half the original 620 view, 360 on orbitRev 12's 782. */
function frameBelow(state: { viewW?: number }): number {
  return state.viewW ? 360 : FRAME_BELOW;
}
/** Pan for a normal hop (~0.45 s); longer pans scale up to double this (~0.9 s). */
export const ORBIT_CAPTURE_PAN_TICKS = 27;
export const ORBIT_REDUCED_PAN_TICKS = 15;
export const ORBIT_CAPTURE_PAN_MAX_TICKS = 54;
export const ORBIT_REDUCED_PAN_MAX_TICKS = 30;
/** Camera travel (world units) at or below which a pan takes the base duration. */
export const ORBIT_PAN_NORMAL_DIST = 160;
/** Camera travel at or above which a pan takes the maximum duration. */
export const ORBIT_PAN_LONG_DIST = 420;
/** Pan duration in sim ticks for a capture pan of `dist` world units. */
export function orbitPanTicks(dist: number, reducedMotion = false): number {
  const lo = reducedMotion ? ORBIT_REDUCED_PAN_TICKS : ORBIT_CAPTURE_PAN_TICKS;
  const hi = reducedMotion ? ORBIT_REDUCED_PAN_MAX_TICKS : ORBIT_CAPTURE_PAN_MAX_TICKS;
  const t = Math.max(0, Math.min(1, (dist - ORBIT_PAN_NORMAL_DIST) / (ORBIT_PAN_LONG_DIST - ORBIT_PAN_NORMAL_DIST)));
  return Math.round(lo + (hi - lo) * t);
}
/** Per-tick decay of an interrupted pan's glide during flight. */
export const ORBIT_GLIDE_DECAY = 0.7;
/** Largest per-tick flight catch-up toward the safe box (world units). */
export const ORBIT_FLIGHT_CATCH = 8;
/** Margin keeping the rocket fully on screen during a pan. */
export const ORBIT_ROCKET_ON_SCREEN = 14;
const ROCKET_ON_SCREEN = ORBIT_ROCKET_ON_SCREEN;
export const ORBIT_SAFE_INSET_X = 50;
const SAFE_INSET_X = ORBIT_SAFE_INSET_X;
const SAFE_INSET_Y = 120;
type Rev3Like = OrbitRev3State;
type PlanetLike = Planet;
export interface OrbitCamOffset {
  x: number;
  y: number;
}
function isRev3(s: Rev3Like): boolean {
  return s?.rev === 3 && Array.isArray(s.planets);
}
function curIndex(s: Rev3Like): number {
  return s.cur;
}
function nextIndex(s: Rev3Like): number {
  return Math.min(s.planets.length - 1, s.cur + 1);
}
function rocketOf(s: Rev3Like): OrbitCamOffset {
  return { x: s.x / FP, y: s.y / FP };
}
interface Entry extends OrbitCamOffset {
  tick: number;
  cur: number;
  captured: number;
  respawn: number;
  start: number;
  from: OrbitCamOffset;
  target: OrbitCamOffset;
  /** Duration of the current pan in ticks (scaled by its distance). */
  dur: number;
  /** Pan velocity carried into flight when a tap interrupts a pan; decays to zero. */
  glide: OrbitCamOffset;
  /** Last tick's pan velocity (for the glide). */
  panV: OrbitCamOffset;
}
let normal = new WeakMap<object, Entry>();
let reduced = new WeakMap<object, Entry>();
let frames = new WeakMap<object, { normal: OrbitCamOffset; reduced: OrbitCamOffset }>();
let envelopes = new WeakMap<object, { left: number; right: number; top: number; bottom: number }>();
let clampOverrideCount = 0;
let visibilityPans = 0;
/** Settled visibility corrections (each an eased pan) since the last reset. */
export function orbitCameraVisibilityPans(): number {
  return visibilityPans;
}
/** Is the camera mid-pan at this state (capture or visibility pan)? */
export function orbitCameraPanning(state: Rev3Like, opts?: { reducedMotion?: boolean }): boolean {
  orbitCameraObserve(state);
  const e = (opts?.reducedMotion ? reduced : normal).get(state.planets);
  return !!e && e.tick === state.tick && Number.isFinite(e.start);
}
const paths = new WeakMap<Planet, OrbitCamOffset[]>();
const shares = new WeakMap<Planet, Map<string, number>>();
function ringPath(p: Planet): OrbitCamOffset[] {
  let path = paths.get(p);
  if (!path) {
    path = Array.from({ length: 513 }, (_, k) => {
      const q = orbitPos(p, (k * 128) & 65535);
      return { x: q.x / FP, y: q.y / FP };
    });
    paths.set(p, path);
  }
  return path;
}
/** Arc-length share of the actual circular/elliptical/figure-eight path. */
export function orbitNextRingShare(s: Rev3Like, cam: OrbitCamOffset): number {
  const ORBIT_CAM_VIEW_H = orbitViewH(s);
  const ORBIT_CAM_VIEW_W = orbitViewW(s);
  const p = s.planets[nextIndex(s)];
  if (!p) return 1;
  let memo = shares.get(p);
  if (!memo) {
    memo = new Map();
    shares.set(p, memo);
  }
  const key = `${cam.x},${cam.y}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const path = ringPath(p);
  let total = 0,
    visible = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    if (!a || !b) continue;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy);
    total += length;
    let lo = 0,
      hi = 1;
    const axes: [number, number, number, number][] = [
      [a.x, dx, cam.x, cam.x + ORBIT_CAM_VIEW_W],
      [a.y, dy, cam.y, cam.y + ORBIT_CAM_VIEW_H],
    ];
    for (const [start, delta, min, max] of axes) {
      if (Math.abs(delta) < 1e-12) {
        if (start < min || start > max) hi = -1;
      } else {
        const t1 = (min - start) / delta,
          t2 = (max - start) / delta;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
      }
    }
    visible += length * Math.max(0, hi - lo);
  }
  const share = total ? visible / total : 1;
  if (memo.size >= 8) memo.clear();
  memo.set(key, share);
  return share;
}
export function orbitCameraClampOverrideCount(): number {
  return clampOverrideCount;
}
/** Full path bounds, not the circling rocket: this target never oscillates. */
function framedPlanet(s: Rev3Like): OrbitCamOffset {
  const ORBIT_CAM_VIEW_H = orbitViewH(s);
  const ORBIT_CAM_VIEW_W = orbitViewW(s);
  const p = s.planets[s.cur];
  if (!p) return pushSafe(rocketOf(s), { x: 0, y: 0 }, ORBIT_CAM_VIEW_H, ORBIT_CAM_VIEW_W);
  let b = envelopes.get(p);
  if (!b) {
    b = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (let phase = 0; phase < 65536; phase += 128) {
      const pos = orbitPos(p, phase);
      b.left = Math.min(b.left, pos.x / FP - 1);
      b.right = Math.max(b.right, pos.x / FP + 1);
      b.top = Math.min(b.top, pos.y / FP - 1);
      b.bottom = Math.max(b.bottom, pos.y / FP + 1);
    }
    envelopes.set(p, b);
  }
  const next = s.planets[nextIndex(s)] ?? p;
  const wantX = next.x / FP - ORBIT_CAM_VIEW_W / 2;
  // The next planet sits 310 px from the view's bottom; a taller view (orbitRev 8) adds its height above it.
  const wantY = next.y / FP - (ORBIT_CAM_VIEW_H - frameBelow(s));
  // Constrain the lean so the entire path remains in the safe box.
  const x = Math.max(
    b.right - (ORBIT_CAM_VIEW_W - SAFE_INSET_X),
    Math.min(b.left - SAFE_INSET_X, wantX),
  );
  const y = Math.max(
    b.bottom - (ORBIT_CAM_VIEW_H - SAFE_INSET_Y),
    Math.min(b.top - SAFE_INSET_Y, wantY),
  );
  return { x, y };
}
/** How far below the next planet's centre the view reaches when framed (half the original 620 view). */
const FRAME_BELOW = 310;
function pushInside(r: OrbitCamOffset, c: OrbitCamOffset, m: number, ORBIT_CAM_VIEW_H: number, ORBIT_CAM_VIEW_W: number): OrbitCamOffset {
  return {
    x: Math.max(r.x - (ORBIT_CAM_VIEW_W - m), Math.min(r.x - m, c.x)),
    y: Math.max(r.y - (ORBIT_CAM_VIEW_H - m), Math.min(r.y - m, c.y)),
  };
}
function pushSafe(r: OrbitCamOffset, c: OrbitCamOffset, ORBIT_CAM_VIEW_H: number, ORBIT_CAM_VIEW_W: number): OrbitCamOffset {
  return {
    x: Math.max(r.x - (ORBIT_CAM_VIEW_W - SAFE_INSET_X), Math.min(r.x - SAFE_INSET_X, c.x)),
    y: Math.max(r.y - (ORBIT_CAM_VIEW_H - SAFE_INSET_Y), Math.min(r.y - SAFE_INSET_Y, c.y)),
  };
}
function advance(s: Rev3Like, still: boolean): OrbitCamOffset {
  const viewH = orbitViewH(s);
  const viewW = orbitViewW(s);
  const map = still ? reduced : normal;
  const previous = map.get(s.planets);
  if (previous?.tick === s.tick) return { x: previous.x, y: previous.y };
  const target = framedPlanet(s);
  let e: Entry;
  if (!previous || s.tick < previous.tick) {
    const at = pushSafe(rocketOf(s), target, viewH, viewW);
    e = {
      ...at,
      tick: s.tick,
      cur: s.cur,
      captured: s.captured,
      respawn: s.respawnTick,
      start: -Infinity,
      from: at,
      target,
      dur: still ? ORBIT_REDUCED_PAN_TICKS : ORBIT_CAPTURE_PAN_TICKS,
      glide: { x: 0, y: 0 },
      panV: { x: 0, y: 0 },
    };
  } else {
    e = { ...previous, tick: s.tick };
    if (
      s.cur !== previous.cur ||
      s.captured !== previous.captured ||
      s.respawnTick !== previous.respawn
    ) {
      e = {
        ...e,
        cur: s.cur,
        captured: s.captured,
        respawn: s.respawnTick,
        start: s.tick,
        from: { x: previous.x, y: previous.y },
        target,
        // Every capture (including skipped planets) gets one eased pan whose
        // duration scales with how far the camera has to travel.
        dur: orbitPanTicks(Math.hypot(target.x - previous.x, target.y - previous.y), still),
      };
    }
    let at: OrbitCamOffset = { x: previous.x, y: previous.y };
    // Flight interrupts a pan: never chase the rocket or the next planet, but
    // let the interrupted pan glide to a stop over a few ticks instead of halting.
    if (s.flying > 0) {
      if (Number.isFinite(e.start)) e.glide = { ...e.panV };
      e.start = -Infinity;
      e.panV = { x: 0, y: 0 };
      e.glide = { x: e.glide.x * ORBIT_GLIDE_DECAY, y: e.glide.y * ORBIT_GLIDE_DECAY };
      if (Math.hypot(e.glide.x, e.glide.y) < 0.2) e.glide = { x: 0, y: 0 };
      at = { x: at.x + e.glide.x, y: at.y + e.glide.y };
    } else if (Number.isFinite(e.start)) {
      const p = Math.min(1, (s.tick - e.start) / Math.max(1, e.dur));
      const eased = p * p * (3 - 2 * p);
      at = {
        x: e.from.x + (e.target.x - e.from.x) * eased,
        y: e.from.y + (e.target.y - e.from.y) * eased,
      };
      e.panV = { x: at.x - previous.x, y: at.y - previous.y };
      if (p === 1) {
        e.start = -Infinity;
        e.panV = { x: 0, y: 0 };
      }
    } else e.glide = { x: 0, y: 0 };
    const panning = Number.isFinite(e.start);
    // Mid-pan the rocket only needs to stay on screen (a small margin), so the
    // pan starts exactly where the camera was — no correction step first. The
    // pan target frames the whole orbit inside the safe box, so it ends there.
    let safe: OrbitCamOffset;
    if (s.flying) {
      // Flight: hold, moving only toward the minimum safe-box push, at most
      // ORBIT_FLIGHT_CATCH units a tick (so a tap mid-pan cannot snap), while
      // the rocket always stays fully on screen.
      const wanted = pushSafe(rocketOf(s), at, viewH, viewW);
      const dx = wanted.x - at.x,
        dy = wanted.y - at.y,
        len = Math.hypot(dx, dy);
      const k = len > ORBIT_FLIGHT_CATCH ? ORBIT_FLIGHT_CATCH / len : 1;
      safe = pushInside(rocketOf(s), { x: at.x + dx * k, y: at.y + dy * k }, ROCKET_ON_SCREEN, viewH, viewW);
    } else if (panning) safe = pushInside(rocketOf(s), at, ROCKET_ON_SCREEN, viewH, viewW);
    else safe = pushSafe(rocketOf(s), at, viewH, viewW);
    // Capture visibility takes priority over easing, just like rocket safety.
    // Project only as far toward the safe whole-orbit target as necessary.
    // Visibility correction only once settled, and as an eased pan, never a jump.
    if (!panning && !s.flying && orbitNextRingShare(s, safe) < 0.32 && orbitNextRingShare(s, target) >= 0.32) {
      let lo = 0,
        hi = 1;
      for (let k = 0; k < 16; k++) {
        const m = (lo + hi) / 2;
        const candidate = {
          x: safe.x + (target.x - safe.x) * m,
          y: safe.y + (target.y - safe.y) * m,
        };
        if (orbitNextRingShare(s, candidate) >= 0.32) hi = m;
        else lo = m;
      }
      const goal = { x: safe.x + (target.x - safe.x) * hi, y: safe.y + (target.y - safe.y) * hi };
      e.from = safe;
      e.target = goal;
      e.start = s.tick;
      e.dur = orbitPanTicks(Math.hypot(goal.x - safe.x, goal.y - safe.y), still);
      visibilityPans++;
    }
    if (safe.x !== at.x || safe.y !== at.y) clampOverrideCount++;
    e.x = safe.x;
    e.y = safe.y;
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
  const ORBIT_CAM_VIEW_H = orbitViewH(state);
  const ORBIT_CAM_VIEW_W = orbitViewW(state);
  const planets = state.planets as PlanetLike[];
  const out: number[] = [];
  for (let i = Math.max(0, curIndex(state) - 2); i < planets.length; i++) {
    const p = planets[i];
    if (!p) continue;
    const extent = Math.max(p.ring ?? 0, p.r ?? 0) / FP + 8;
    const px = p.x / FP,
      py = p.y / FP;
    if (px + extent < cam.x - extent || px - extent > cam.x + ORBIT_CAM_VIEW_W + extent) continue;
    if (py + extent < cam.y - extent || py - extent > cam.y + ORBIT_CAM_VIEW_H + extent) continue;
    out.push(i);
  }
  return out;
}

/** Isolate a new replay/test without changing any game state. */
export function orbitCameraResetCache(): void {
  normal = new WeakMap();
  reduced = new WeakMap();
  frames = new WeakMap();
  envelopes = new WeakMap();
  clampOverrideCount = 0;
  visibilityPans = 0;
}
