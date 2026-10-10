/**
 * Presentation only: a shooting star crosses Orbit's background each time the
 * existing capture counter reaches a multiple of ten. Drawn straight after the
 * starfield, so planets, rocket, HUD and edge arrow always paint over it.
 * Reads state only; per-canvas memory resets on rewind, so replays rebuild it.
 */
export const SHOOTING_STAR_TICKS = 48; // ~0.8 s
export const SHOOTING_STAR_REDUCED_TICKS = 24; // ~0.4 s, fainter
const EVERY = 10;

interface Memory { tick: number; tens: number; at: number; index: number }
const memories = new WeakMap<CanvasRenderingContext2D, Map<string, Memory>>();

export function drawShootingStar(
  c: CanvasRenderingContext2D,
  id: string,
  tick: number,
  captured: number,
  width: number,
  height: number,
  reduced: boolean,
): void {
  let map = memories.get(c);
  if (!map) memories.set(c, (map = new Map()));
  const tens = Math.floor(captured / EVERY);
  let m = map.get(id);
  if (!m || tick < m.tick || tens < m.tens) {
    m = { tick, tens, at: -Infinity, index: tens };
    map.set(id, m);
  }
  if (tens > m.tens) { m.at = tick; m.index = tens; }
  m.tens = tens;
  m.tick = tick;

  const life = reduced ? SHOOTING_STAR_REDUCED_TICKS : SHOOTING_STAR_TICKS;
  const age = tick - m.at;
  if (!(age >= 0 && age < life)) return;
  const p = age / life;
  // Alternate direction per milestone; path spans the upper background diagonally.
  const ltr = m.index % 2 === 1;
  const sx = ltr ? -0.1 * width : 1.1 * width;
  const ex = ltr ? 1.1 * width : -0.1 * width;
  const sy = 0.08 * height;
  const ey = 0.55 * height;
  const hx = sx + (ex - sx) * p;
  const hy = sy + (ey - sy) * p;
  const tail = reduced ? 0.12 : 0.22;
  const tx = hx - (ex - sx) * tail;
  const ty = hy - (ey - sy) * tail;
  const fade = Math.sin(Math.PI * p);
  const peak = reduced ? 0.35 : 0.85;

  c.save();
  const g = c.createLinearGradient(tx, ty, hx, hy);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(1, `rgba(255,246,214,${(peak * fade).toFixed(3)})`);
  c.strokeStyle = g;
  c.lineCap = "round";
  c.lineWidth = reduced ? 1.5 : 2.5;
  c.beginPath();
  c.moveTo(tx, ty);
  c.lineTo(hx, hy);
  c.stroke();
  c.globalAlpha = peak * fade;
  c.fillStyle = "#FFF6D6";
  c.beginPath();
  c.arc(hx, hy, reduced ? 1.5 : 2.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
