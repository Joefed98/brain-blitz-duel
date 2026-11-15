/**
 * Orbit's answer reveal: the run on a course map (the Action overhaul, stage 2, 15 Nov 2026; display only). The course is
 * about 800 px wide and 9,000 tall, so it is folded into four columns of ten planets each (read bottom to top, left to
 * right, the sun at the top of the last), all at one scale: every planet in its seeded colour (filled once reached, a
 * faint ring if not), the flights flown in gold, where the tank ran dry (a red cross) or the rocket crashed (an orange
 * star), and the stardust and slingshot moons (bright where taken). Drawn from traceOrbitRun's replay of the stored run.
 */
import { ORBIT_TOTAL } from "./orbit";
import { orbitPlanetColour } from "./orbit.renderer";
import type { OrbitRunTrace } from "@/lib/duel/orbitRunTrace";

const FP = 256;
export const ORBIT_MAP_COLUMNS = 4;
const PER_COLUMN = ORBIT_TOTAL / ORBIT_MAP_COLUMNS;
const LABEL_H = 22;
const GAP = 8;
export const ORBIT_MAP_COLOURS = {
  flight: "#F5B82E",
  fuel: "#FF4D5E",
  crash: "#FF9A3C",
  dust: "#9FE8FF",
  moon: "#5CE1E6",
} as const;

export interface OrbitMapColumn {
  /** The column's box on the canvas (CSS px). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The world window it shows (world px): planets from..to inclusive. */
  from: number;
  to: number;
  top: number;
  bottom: number;
}

/** The four columns' boxes and world windows, and the one world-to-map scale they share. */
export function orbitMapLayout(trace: Pick<OrbitRunTrace, "planets">, w: number, h: number): { scale: number; left: number; right: number; columns: OrbitMapColumn[] } {
  const ps = trace.planets;
  const pad = 70;
  let left = Infinity, right = -Infinity;
  for (const p of ps) {
    left = Math.min(left, p.x / FP - pad);
    right = Math.max(right, p.x / FP + pad);
  }
  const colW = (w - GAP * (ORBIT_MAP_COLUMNS - 1)) / ORBIT_MAP_COLUMNS;
  const colH = h - LABEL_H;
  const windows = Array.from({ length: ORBIT_MAP_COLUMNS }, (_, k) => {
    const from = k * PER_COLUMN;
    const to = Math.min(ps.length - 1, (k + 1) * PER_COLUMN);
    const bottom = ps[from]!.y / FP + pad;
    const top = ps[to]!.y / FP - pad;
    return { from, to, top, bottom };
  });
  const scale = Math.min(colW / (right - left), ...windows.map((c) => colH / (c.bottom - c.top)));
  const columns = windows.map((c, k) => ({ ...c, x: k * (colW + GAP), y: 0, w: colW, h: colH }));
  return { scale, left, right, columns };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** Draws the run's course map into a w × h (CSS px) area at the origin. */
export function drawOrbitRunMap(ctx: CanvasRenderingContext2D, trace: OrbitRunTrace, w: number, h: number): void {
  const { scale, left, right, columns } = orbitMapLayout(trace, w, h);
  const ps = trace.planets;
  for (const col of columns) {
    // Centre the course across the column, and the column's window down it (the bottom planet low, the top one high).
    const ox = col.x + (col.w - (right - left) * scale) / 2 - left * scale;
    const oy = col.y + col.h - (col.bottom - (col.bottom - col.top - col.h / scale) / 2) * scale;
    const at = (x: number, y: number): [number, number] => [ox + x * scale, oy + y * scale];
    ctx.save();
    roundRect(ctx, col.x, col.y, col.w, col.h, 10);
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.clip();
    // The course: a faint dotted line planet to planet.
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    for (let i = Math.max(0, col.from - 1); i <= Math.min(ps.length - 1, col.to + 1); i++) {
      const [x, y] = at(ps[i]!.x / FP, ps[i]!.y / FP);
      if (i === Math.max(0, col.from - 1)) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Stardust: faint where missed, bright where taken.
    for (const d of trace.dust) {
      const [x, y] = at(d.x, d.y);
      ctx.fillStyle = d.got ? ORBIT_MAP_COLOURS.dust : "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.arc(x, y, d.got ? 2.6 : 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Slingshot moons: a small grey moon, ringed in teal where slung.
    for (const m of trace.moons) {
      const [x, y] = at(m.x, m.y);
      ctx.fillStyle = "rgba(200,205,215,0.55)";
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      if (m.got) {
        ctx.strokeStyle = ORBIT_MAP_COLOURS.moon;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // The flights flown.
    ctx.strokeStyle = ORBIT_MAP_COLOURS.flight;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const f of trace.flights) {
      ctx.beginPath();
      f.forEach(([fx, fy], k) => {
        const [x, y] = at(fx, fy);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    // The planets: filled in their colour once reached, a faint ring if not; the sun gold.
    for (let i = Math.max(0, col.from - 1); i <= Math.min(ps.length - 1, col.to + 1); i++) {
      const p = ps[i]!;
      const [x, y] = at(p.x / FP, p.y / FP);
      const r = Math.max(i === ORBIT_TOTAL ? 8 : 5, (p.r / FP) * scale);
      const reached = i <= trace.best;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (i === ORBIT_TOTAL) {
        ctx.fillStyle = reached ? "#FFD166" : "rgba(255,209,102,0.35)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,209,102,0.7)";
        ctx.lineWidth = 1.2;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2));
          ctx.lineTo(x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5));
          ctx.stroke();
        }
        continue;
      }
      if (reached) {
        ctx.fillStyle = orbitPlanetColour(p, i);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.32)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    // The slips: a red cross where the tank ran dry, an orange star where the rocket crashed.
    for (const s of trace.slips) {
      const [x, y] = at(s.x, s.y);
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 5;
      const mark = () => {
        ctx.beginPath();
        if (s.kind === "fuel") {
          ctx.moveTo(x - 6, y - 6);
          ctx.lineTo(x + 6, y + 6);
          ctx.moveTo(x + 6, y - 6);
          ctx.lineTo(x - 6, y + 6);
        } else {
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI + Math.PI / 8;
            ctx.moveTo(x - Math.cos(a) * 7, y - Math.sin(a) * 7);
            ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
          }
        }
        ctx.stroke();
      };
      mark();
      ctx.strokeStyle = s.kind === "fuel" ? ORBIT_MAP_COLOURS.fuel : ORBIT_MAP_COLOURS.crash;
      ctx.lineWidth = 2.6;
      mark();
    }
    ctx.restore();
    // The column's planets, under it.
    ctx.fillStyle = "rgba(245,245,247,0.78)";
    ctx.font = "600 13px 'Archivo', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const last = col.to >= ORBIT_TOTAL ? "sun" : String(col.to);
    ctx.fillText(`${col.from === 0 ? "Start" : col.from}–${last}`, col.x + col.w / 2, col.y + col.h + 16);
  }
}
