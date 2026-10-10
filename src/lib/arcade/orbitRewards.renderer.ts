/** Orbit-only capture observations. Visual memory, never simulation state. */
import type { OrbitRev3State } from './orbitRev3';
import type { OrbitCamOffset } from './orbitCamera';
import { ORBIT_CAM_VIEW_W, ORBIT_CAM_VIEW_H } from './orbitCamera';
export const ORBIT_STAR_TICKS = 48;
type Star = { tick: number; milestone: number };
let histories = new WeakMap<object, { tick: number; count: number; star: Star | null }>();
let frames = new WeakMap<object, Star | null>();
export function orbitRewardObserve(s: OrbitRev3State): void {
  if (frames.has(s)) return;
  let h = histories.get(s.planets);
  if (!h || s.tick < h.tick) h = { tick: s.tick, count: s.captured, star: null };
  if (s.captured > h.count && s.captured % 10 === 0 && s.captured <= 40) h.star = { tick: s.tick, milestone: s.captured };
  h.tick = s.tick; h.count = s.captured;
  histories.set(s.planets, h); frames.set(s, h.star);
}
export function orbitStarAge(s: OrbitRev3State): number {
  orbitRewardObserve(s);
  const star = frames.get(s);
  return star ? s.tick - star.tick : Infinity;
}
export function orbitRewardReset(): void { histories = new WeakMap(); frames = new WeakMap(); }
/** Background streak, clipped out of protected silhouettes (including its tail). */
export function drawOrbitShootingStar(c: CanvasRenderingContext2D, s: OrbitRev3State, cam: OrbitCamOffset, still: boolean): void {
  const age = orbitStarAge(s), duration = still ? 15 : ORBIT_STAR_TICKS;
  if (age < 0 || age >= duration) return;
  const p = age / duration, x = -40 + p * (ORBIT_CAM_VIEW_W + 100), y = 70 + p * 160;
  const tail = still ? 24 : 75, alpha = Math.sin(Math.PI * p) * (still ? 0.25 : 0.8);
  c.save();
  c.beginPath(); c.rect(0, 0, ORBIT_CAM_VIEW_W, ORBIT_CAM_VIEW_H);
  for (const i of [s.cur, Math.min(s.cur + 1, s.planets.length - 1)]) {
    const planet = s.planets[i]; if (!planet) continue;
    const r = Math.max(planet.r / 256 * 1.6, planet.kind === 2 ? planet.ring / 256 * 1.5 + planet.r / 256 : planet.r / 256 + 12);
    const px = planet.x / 256 - cam.x, py = planet.y / 256 - cam.y;
    c.moveTo(px + r, py); c.arc(px, py, r, 0, Math.PI * 2);
  }
  const rx = s.x / 256 - cam.x, ry = s.y / 256 - cam.y;
  c.moveTo(rx + 26, ry); c.arc(rx, ry, 26, 0, Math.PI * 2);
  c.clip('evenodd');
  const gradient = c.createLinearGradient(x - tail, y - tail * .36, x, y);
  gradient.addColorStop(0, 'rgba(220,237,255,0)'); gradient.addColorStop(1, 'rgba(240,249,255,1)');
  c.strokeStyle = gradient; c.globalAlpha = alpha; c.lineCap = 'round';
  c.lineWidth = still ? 1 : 3;
  c.beginPath(); c.moveTo(x - tail, y - tail * .36); c.lineTo(x, y); c.stroke();
  c.fillStyle = '#F0F9FF'; c.beginPath(); c.arc(x, y, still ? 1 : 2, 0, Math.PI * 2); c.fill();
  c.restore();
}