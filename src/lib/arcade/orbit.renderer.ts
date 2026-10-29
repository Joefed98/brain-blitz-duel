import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { arcadeFx, drawFxGlow } from "./arcadeFx.renderer";
import { ORBIT_FX, orbit3FxFor } from "./arcadeFxGames.renderer";
/**
 * Orbit art pass. Render only: reads OrbitState and never mutates it. Every
 * body, path and hazard arc is drawn from the sim's own geometry (planet
 * centre, radius, path offsets) so the art cannot misrepresent a capture.
 */
import type { CanvasSize } from "./engine";
import {
  orbitGame,
  orbitBeltStart,
  orbitBeltOffset,
  ORBIT_BELT_SPAN,
  orbitLobes,
  phaseRate,
  ORBIT_BG,
  ORBIT_EIGHT,
  ORBIT_ELLIPSE,
  ORBIT_GOLD,
  ORBIT_RED,
  orbitXpRev,
  ORBIT_TOTAL,
  ORBIT_TRAIL_TICKS,
  ORBIT_WORLD_H,
  ORBIT_WORLD_W,
  type OrbitState,
  type Planet,
} from "./orbit";
import { icos, isin, TRIG_ONE } from "./trig";
import { reducedMotion as prefersReducedMotion } from "./art.renderer";

/** Rocket body + fins + soft glow, cached per dead state. */
const rocketCaches = new Map<string, HTMLCanvasElement>();
export function getRocketSprite(dead: boolean): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = dead ? "dead" : "alive";
  const hit = rocketCaches.get(key); if (hit) return hit;
  const size = 48, r = size / 2;
  const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
  const c = canvas.getContext("2d"); if (!c) return null;
  c.translate(r, r);
  paintRocket(c, dead, 1);
  rocketCaches.set(key, canvas); return canvas;
}

/** The rocket's art centred on (0, 0), nose to +x (the 48 px sprite above; the game icon paints it at its real size, `ratio` device px per sprite px). */
export function paintRocket(c: CanvasRenderingContext2D, dead: boolean, ratio: number): void {
  c.shadowColor = dead ? "rgba(255,77,77,0.4)" : "rgba(255,214,102,0.4)";
  c.shadowBlur = 6 * ratio;
  // Fins.
  c.fillStyle = dead ? "#8A2B33" : "#C8862A";
  c.beginPath(); c.moveTo(-6, -2); c.lineTo(-9, -6); c.lineTo(-2, -3); c.closePath();
  c.moveTo(-6, 2); c.lineTo(-9, 6); c.lineTo(-2, 3); c.closePath(); c.fill();
  // Body.
  c.fillStyle = dead ? "#FF4D4D" : "#F4F1EA";
  c.beginPath(); c.moveTo(10, 0); c.quadraticCurveTo(4, -4.5, -6, -3); c.lineTo(-6, 3); c.quadraticCurveTo(4, 4.5, 10, 0); c.closePath(); c.fill();
  c.shadowBlur = 0;
  c.fillStyle = dead ? "#5A1820" : "#F5C542";
  c.beginPath(); c.moveTo(10, 0); c.quadraticCurveTo(7, -2.6, 5, -2.6); c.lineTo(5, 2.6); c.quadraticCurveTo(7, 2.6, 10, 0); c.fill();
  c.fillStyle = "#4D8CFF"; c.beginPath(); c.arc(1, 0, 1.6, 0, Math.PI * 2); c.fill();
}


/* Mirrors of private sim constants, used only to trace the same paths. */
const FP = 256;
const ELLIPSE_B_PCT = 60;
const EIGHT_A_PCT = 150;
const EIGHT_B_PCT = 45;

/** Full-strength eight game colours for seeded planet surfaces and paths. */
const GAME_COLOURS = ["#FF4D4D", "#4D8CFF", "#3DDC84", "#B26BFF", "#FF6BD6", "#FF8A3D", "#8B5A2B", "#FFE600"];

/** Same offset maths as the sim's pathOffset. Exported for orbit-bounds-check.ts to compare against orbit.ts's own pathOffset. */
export function orbitRendererPathOffset(p: Planet, phase: number): { u: number; v: number } {
  if (p.kind === ORBIT_ELLIPSE) {
    const b = Math.trunc((p.ring * ELLIPSE_B_PCT) / 100);
    const u = Math.trunc((p.ring * icos(phase)) / TRIG_ONE);
    const v = Math.trunc((b * isin(phase)) / TRIG_ONE);
    return {
      u: Math.trunc((u * icos(p.rot) - v * isin(p.rot)) / TRIG_ONE),
      v: Math.trunc((u * isin(p.rot) + v * icos(p.rot)) / TRIG_ONE),
    };
  }
  if (p.kind === ORBIT_EIGHT) {
    const a = Math.trunc((p.ring * EIGHT_A_PCT) / 100);
    return {
      u: Math.trunc((a * icos(phase)) / TRIG_ONE),
      v: Math.trunc((Math.trunc((a * EIGHT_B_PCT) / 100) * isin((phase * 2) & 65535)) / TRIG_ONE),
    };
  }
  return { u: Math.trunc((p.ring * icos(phase)) / TRIG_ONE), v: Math.trunc((p.ring * isin(phase)) / TRIG_ONE) };
}

/** Seeded look: hashed from the planet's seeded position, identical for everyone. */
function planetLook(p: Planet, i: number, lobe: number) {
  let h = Math.imul((p.x | 0) ^ Math.imul(p.y | 0, 0x9e3779b1) ^ (i * 977 + lobe * 131), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return {
    type: h % 3, // 0 rocky, 1 gas giant, 2 icy
    colour: GAME_COLOURS[(h >>> 4) % 8] ?? ORBIT_GOLD,
    ring: ((h >>> 9) % 4) === 0,
    tilt: (((h >>> 12) % 60) - 30) * (Math.PI / 180),
    h,
  };
}

/** Mix a #RRGGBB colour towards white (amt > 0) or black (amt < 0). */
function tint(hex: string, amt: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const to = amt > 0 ? 255 : 0;
  const k = Math.abs(amt);
  const ch = (v: number) => Math.round(v + (to - v) * k);
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export function drawPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: ReturnType<typeof planetLook>): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  // Tuning D: a lit-to-shadow base instead of a flat fill.
  const base = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  base.addColorStop(0, tint(look.colour, 0.28));
  base.addColorStop(0.55, look.colour);
  base.addColorStop(1, tint(look.colour, -0.35));
  ctx.fillStyle = base;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  // Any ring detail stays inside the planet's collision circle.
  if (look.ring) drawRingHalf(ctx, x, y, r, look.tilt, true);
  if (look.type === 1) {
    // Gas bands: wavy, alternating light and dark, under the planet's tilt.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(look.tilt * 0.5);
    for (let b = 0; b < 7; b++) {
      const by = -r + ((b + 0.5) * 2 * r) / 7 + (((look.h >>> (b * 3)) % 5) - 2) * 0.6;
      const wave = r * 0.08 * ((((look.h >>> (b * 2 + 1)) % 3) - 1) || 1);
      ctx.globalAlpha = b % 2 ? 0.22 : 0.18;
      ctx.fillStyle = b % 2 ? tint(look.colour, -0.5) : tint(look.colour, 0.55);
      ctx.beginPath();
      ctx.moveTo(-r, by - r * 0.07);
      ctx.quadraticCurveTo(0, by - r * 0.07 + wave, r, by - r * 0.07);
      ctx.lineTo(r, by + r * 0.07);
      ctx.quadraticCurveTo(0, by + r * 0.07 + wave, -r, by + r * 0.07);
      ctx.closePath();
      ctx.fill();
    }
    // A storm eye on about half the gas giants.
    if ((look.h >>> 17) & 1) {
      const sx = r * ((((look.h >>> 19) % 7) - 3) / 8);
      const sy = r * (0.25 + ((look.h >>> 22) % 3) * 0.1);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = tint(look.colour, -0.45);
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * 0.24, r * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = tint(look.colour, 0.5);
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * 0.14, r * 0.055, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  } else if (look.type === 0) {
    // Mottled lowlands under the craters.
    ctx.fillStyle = tint(look.colour, -0.4);
    for (let c = 0; c < 3; c++) {
      const a = ((look.h >>> (c * 7 + 3)) % 64) * (Math.PI / 32);
      const d = r * (0.15 + ((look.h >>> (c * 5 + 1)) % 4) * 0.15);
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.42, r * 0.26, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Craters.
    for (let c = 0; c < 6; c++) {
      const a = ((look.h >>> (c * 5)) % 64) * (Math.PI / 32);
      const d = r * (0.2 + ((look.h >>> (c * 4 + 2)) % 5) * 0.12);
      const cr = r * (0.12 + ((look.h >>> (c * 3 + 1)) % 3) * 0.05);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, cr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d - cr * 0.25, y + Math.sin(a) * d - cr * 0.25, cr * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Polar caps.
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.98, r * 0.62, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 1.02, r * 0.5, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ice streaks.
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = Math.max(1, r * 0.08);
    for (let c = 0; c < 3; c++) {
      const yy = y - r * 0.5 + c * r * 0.45;
      ctx.beginPath();
      ctx.moveTo(x - r, yy);
      ctx.quadraticCurveTo(x, yy - r * 0.2, x + r, yy + r * 0.1);
      ctx.stroke();
    }
  }
  // Lit side (upper left) and dark limb.
  const shade = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.05);
  // Polish A4: clear sphere shading: a bright lit side, a soft terminator and a dark night side.
  shade.addColorStop(0, "rgba(255,255,255,0.55)");
  shade.addColorStop(0.3, "rgba(255,255,255,0.12)");
  shade.addColorStop(0.55, "rgba(0,0,0,0.12)");
  shade.addColorStop(0.8, "rgba(0,0,0,0.55)");
  shade.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  // Atmosphere: a thin lit rim just inside the edge, and a soft highlight.
  ctx.strokeStyle = tint(look.colour, 0.6);
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.beginPath();
  ctx.arc(x, y, r - ctx.lineWidth / 2, Math.PI * 0.75, Math.PI * 1.75);
  ctx.stroke();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.42, y - r * 0.48, r * 0.2, r * 0.1, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (look.ring) drawRingHalf(ctx, x, y, r, look.tilt, false);
  ctx.restore();
}

/* ===================== Tuning D: backdrop and ship effects ===================== */

/** World units per nebula tile; the tile is baked at 2× and tiles seamlessly. */
const NEBULA_TILE = 512;
let nebulaTile: HTMLCanvasElement | null | undefined;

/** A dust of faint far stars on black, baked once (the coloured clouds went on 27 Oct 2026). */
function nebulaSprite(): HTMLCanvasElement | null {
  if (nebulaTile !== undefined) return nebulaTile;
  if (typeof document === "undefined") return (nebulaTile = null);
  const canvas = document.createElement("canvas");
  canvas.width = NEBULA_TILE * 2;
  canvas.height = NEBULA_TILE * 2;
  const c = canvas.getContext("2d");
  if (!c) return (nebulaTile = null);
  c.scale(2, 2);
  const T = NEBULA_TILE;
  // Black space (Joe's phone notes, 27 Oct 2026; display only): the purple, magenta and teal clouds are gone,
  // so the tile is far star dust alone, a little denser.
  // Far star dust: tiny, dim, some faintly coloured.
  for (let i = 0; i < 420; i++) {
    const h = Math.imul(i * 2654435761 + 977, 0x85ebca6b) >>> 0;
    const x = h % T;
    const y = (h >>> 9) % T;
    c.globalAlpha = 0.15 + ((h >>> 3) % 40) / 100;
    c.fillStyle = h % 7 === 0 ? "#D6E4FF" : h % 11 === 0 ? "#FFF0D6" : "#FFFFFF";
    const size = (h >>> 20) % 5 === 0 ? 1 : 0.6;
    c.fillRect(x, y, size, size);
  }
  return (nebulaTile = canvas);
}

/** The nebula tiled over the view, parallaxed slower than the stars. */
function drawNebula(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number): void {
  const tile = nebulaSprite();
  if (!tile) return;
  const T = NEBULA_TILE;
  const ox = -(((camX * 0.12) % T) + T) % T;
  const oy = -(((camY * 0.12) % T) + T) % T;
  for (let x = ox; x < w; x += T) for (let y = oy; y < h; y += T) ctx.drawImage(tile, x, y, T, T);
}

/** A bright star's four-point glint with a soft glow (one cached sprite). */
function drawGlint(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawFxGlow(ctx, "#BFD8FF", x, y, size * 3, alpha * 0.5);
  ctx.globalAlpha = alpha * 0.8;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x - size * 2, y - 0.4, size * 4, 0.8);
  ctx.fillRect(x - 0.4, y - size * 2, 0.8, size * 4);
  ctx.restore();
}

interface ShipMemory {
  tick: number;
  captured: number;
  capturedAt: number;
  points: { x: number; y: number; tick: number }[];
}
const shipMemories = new WeakMap<object, ShipMemory>();
const TRAIL_POINTS = 22;
const CAPTURE_GLOW_MS = 700;

function presentationNow(): number {
  return typeof performance !== "undefined" ? performance.now() : 0;
}

/**
 * Per-canvas memory of the ship's last drawn world positions (for its trail)
 * and of the moment the capture counter last rose (for the catch glow). A
 * rewind or the first frame a canvas sees starts fresh and never fires.
 * Presentation only: never written to state.
 */
function observeShip(ctx: object, state: { tick: number; captured: number; x: number; y: number }): ShipMemory {
  let m = shipMemories.get(ctx);
  const x = state.x / FP;
  const y = state.y / FP;
  if (!m || state.tick < m.tick) {
    m = { tick: state.tick, captured: state.captured, capturedAt: -Infinity, points: [{ x, y, tick: state.tick }] };
    shipMemories.set(ctx, m);
    return m;
  }
  if (state.tick === m.tick) return m;
  if (state.captured > m.captured) m.capturedAt = presentationNow();
  m.captured = state.captured;
  m.tick = state.tick;
  const last = m.points[m.points.length - 1];
  // A respawn or a black-hole jump teleports the ship: start the trail again.
  if (last && Math.hypot(x - last.x, y - last.y) > 40) m.points = [];
  m.points.push({ x, y, tick: state.tick });
  while (m.points.length > TRAIL_POINTS || (m.points[0] && state.tick - m.points[0].tick > 32)) m.points.shift();
  return m;
}

/** A tapering cool-white trail through the ship's recent positions. */
function drawShipTrail(ctx: CanvasRenderingContext2D, m: ShipMemory, camX: number, camY: number, dead: boolean): void {
  const pts = m.points;
  if (pts.length < 2 || dead) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const k = i / (pts.length - 1);
    ctx.globalAlpha = 0.9 * k * k;
    ctx.strokeStyle = k > 0.85 ? "#FFE3B0" : k > 0.6 ? "#DDF0FF" : "#7FB8FF";
    ctx.lineWidth = 1 + 3.6 * k;
    ctx.beginPath();
    ctx.moveTo(a.x - camX, a.y - camY);
    ctx.lineTo(b.x - camX, b.y - camY);
    ctx.stroke();
  }
  ctx.restore();
}

/** The soft glow round the planet just caught: a bloom and a ring easing outwards. */
function drawCaptureGlow(ctx: CanvasRenderingContext2D, m: ShipMemory, x: number, y: number, r: number, colour: string, still: boolean): void {
  const age = presentationNow() - m.capturedAt;
  if (!(age >= 0 && age < CAPTURE_GLOW_MS)) return;
  const p = age / CAPTURE_GLOW_MS;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawFxGlow(ctx, colour, x, y, r * (still ? 2 : 1.6 + 0.8 * p), 0.55 * (1 - p));
  drawFxGlow(ctx, "#FFFFFF", x, y, r * 1.2, 0.25 * (1 - p));
  ctx.globalCompositeOperation = "source-over";
  if (!still) {
    ctx.globalAlpha = 0.6 * (1 - p);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 3 + 16 * (1 - (1 - p) * (1 - p)), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRingHalf(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tilt: number, back: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.strokeStyle = back ? "rgba(230,220,200,0.25)" : "rgba(230,220,200,0.55)";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.9, r * 0.3, 0, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  const corona = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.2);
  corona.addColorStop(0, "rgba(255,214,102,0.85)");
  corona.addColorStop(0.45, "rgba(255,150,40,0.25)");
  corona.addColorStop(1, "rgba(255,120,30,0)");
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,200,90,0.35)";
  ctx.lineWidth = 2;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + t * 0.15;
    const len = r * (1.25 + 0.15 * Math.sin(t * 1.3 + k));
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 1.02, y + Math.sin(a) * r * 1.02);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  body.addColorStop(0, "#FFF6D0");
  body.addColorStop(0.6, "#FFD666");
  body.addColorStop(1, "#F29A2E");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function tracePath(ctx: CanvasRenderingContext2D, p: Planet, px: number, py: number, from: number, span: number, steps: number): void {
  ctx.beginPath();
  for (let k = 0; k <= steps; k++) {
    const o = orbitRendererPathOffset(p, (from + Math.trunc((span * k) / steps)) & 65535);
    if (k === 0) ctx.moveTo(px + o.u / FP, py + o.v / FP);
    else ctx.lineTo(px + o.u / FP, py + o.v / FP);
  }
}

/** Rocks and dust stay inside a 3.8px ribbon, with butt ends on the collision arc. */
function drawBelt(ctx: CanvasRenderingContext2D, p: Planet, tick: number, cam: number, still: boolean): void {
  const start = orbitBeltStart(p, tick);
  if (start < 0) return;
  const points = Array.from({ length: 129 }, (_, k) => {
    const o = orbitBeltOffset(p, (start + Math.trunc(ORBIT_BELT_SPAN * k / 128)) & 65535);
    return { x: (p.x + o.u) / FP, y: (p.y + o.v) / FP - cam };
  });
  ctx.save();
  ctx.beginPath();
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1], b = points[k];
    if (!a || !b) continue;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) * 1.9 / length, ny = (b.x - a.x) * 1.9 / length;
    ctx.moveTo(a.x + nx, a.y + ny);
    ctx.lineTo(b.x + nx, b.y + ny);
    ctx.lineTo(b.x - nx, b.y - ny);
    ctx.lineTo(a.x - nx, a.y - ny);
    ctx.closePath();
  }
  ctx.clip();
  // The belt's faint track line is gone (Joe's phone notes, 27 Oct 2026): the rocks alone show it.
  for (let k = 1; k < 64; k++) {
    const phase = (start + Math.trunc(ORBIT_BELT_SPAN * k / 64)) & 65535;
    const o = orbitBeltOffset(p, phase);
    const hash = Math.imul((p.hazard ^ p.x ^ p.y) + k * 977, 0x85ebca6b) >>> 0;
    const r = 1.1 + (hash % 8) / 10;
    ctx.save();
    ctx.translate((p.x + o.u) / FP, (p.y + o.v) / FP - cam);
    ctx.rotate((hash % 360) * Math.PI / 180 + (still ? 0 : tick / 180) * (hash & 1 ? 1 : -1));
    ctx.fillStyle = k % 3 === 0 ? "#756455" : k % 3 === 1 ? "#A29989" : "#68645D";
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.35);
    ctx.lineTo(-r * 0.25, -r);
    ctx.lineTo(r * 0.8, -r * 0.6);
    ctx.lineTo(r, r * 0.2);
    ctx.lineTo(r * 0.2, r);
    ctx.lineTo(-r * 0.8, r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#C0B7A7";
    ctx.fillRect(-r * 0.4, -r * 0.5, r * 0.6, r * 0.3);
    ctx.restore();
  }
  ctx.restore();
}


/* ===================== Polish A4 (25 Oct 2026, display only) ===================== */

/**
 * Every visible orbit as a glowing dashed line: a soft wide stroke in the planet's colour under a
 * dashed one (the current orbit brighter, its dashes drifting the way the rocket goes round).
 * The same traced path as before; the glow pass is skipped with reduced effects.
 */
function drawOrbitPaths(ctx: CanvasRenderingContext2D, state: { planets: Planet[]; cur: number }, visible: number[], camX: number, camY: number, t: number): void {
  const lite = arcadeReducedEffects();
  ctx.save();
  ctx.lineCap = "round";
  for (const i of visible) {
    const p = state.planets[i]!;
    const sun = i === ORBIT_TOTAL;
    const cur = i === state.cur;
    ctx.strokeStyle = sun ? ORBIT_GOLD : planetLook(p, i, 0).colour;
    if (!lite) {
      ctx.setLineDash([]);
      ctx.globalAlpha = cur ? 0.2 : 0.08;
      ctx.lineWidth = cur ? 7 : 4;
      tracePath(ctx, p, p.x / FP - camX, p.y / FP - camY, 0, 65536, 72);
      ctx.stroke();
    }
    ctx.setLineDash(cur ? [7, 5] : [4, 6]);
    ctx.lineDashOffset = cur ? -t * 14 * p.dir : 0;
    ctx.lineWidth = cur ? 2 : 1.2;
    ctx.globalAlpha = cur ? 0.95 : 0.5;
    tracePath(ctx, p, p.x / FP - camX, p.y / FP - camY, 0, 65536, 72);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A planet's soft atmosphere: a glow in its colour just past the disc, behind it (one cached glow sprite).
 * `strength` scales it (Joe's phone notes, 28 Oct 2026: some planets full glow, some slight, some none;
 * `orbitGlowStrength`); 0 draws nothing.
 */
export function drawAtmosphere(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string, strength = 1): void {
  if (strength <= 0) return;
  drawFxGlow(ctx, colour, x, y, r * 1.9 + 10, 0.85 * strength);
  drawFxGlow(ctx, colour, x, y, r * 1.3 + 4, 0.55 * strength);
  drawFxGlow(ctx, "#DDEBFF", x, y, r * 1.15 + 3, 0.25 * strength);
  ctx.globalAlpha = 1;
}

/** The glow levels planets wear: full, slight, none. */
export const ORBIT_GLOW_LEVELS = [1, 0.35, 0] as const;
/**
 * A planet's glow level (display only, every revision), fixed by its index and place on the stored course, so
 * every player sees the same sky: a hash picks full, slight or none, about a third each.
 */
export function orbitGlowStrength(p: { x: number; y: number }, index: number): number {
  let h = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul((p.x >> 8) + 3, 0x85ebca6b) ^ Math.imul((p.y >> 8) + 5, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = (h ^ (h >>> 15)) >>> 0;
  return ORBIT_GLOW_LEVELS[h % ORBIT_GLOW_LEVELS.length]!;
}

/**
 * Now and then a faint shooting star crosses the far sky (one every 8 s, at a seeded moment, place
 * and direction from the tick). Fainter and thinner than the milestone star; none under reduced
 * motion or reduced effects.
 */
const AMBIENT_STAR_EVERY = 480;
const AMBIENT_STAR_TICKS = 42;
function drawAmbientShootingStar(ctx: CanvasRenderingContext2D, tick: number, w: number, h: number): void {
  const n = Math.floor(tick / AMBIENT_STAR_EVERY);
  const hash = Math.imul(n * 2654435761 + 41, 0x85ebca6b) >>> 0;
  const age = tick - n * AMBIENT_STAR_EVERY - (hash % 300);
  if (age < 0 || age >= AMBIENT_STAR_TICKS) return;
  const p = age / AMBIENT_STAR_TICKS;
  const dir = hash & 1 ? 1 : -1;
  const x0 = w * (0.2 + ((hash >>> 4) % 60) / 100);
  const y0 = h * (0.08 + ((hash >>> 11) % 45) / 100);
  const x = x0 + dir * p * 170;
  const y = y0 + p * 70;
  const tail = 46;
  const tx = x - dir * tail;
  const ty = y - tail * 0.41;
  ctx.save();
  ctx.globalAlpha = Math.sin(Math.PI * p) * 0.55;
  const g = ctx.createLinearGradient(tx, ty, x, y);
  g.addColorStop(0, "rgba(200,220,255,0)");
  g.addColorStop(1, "rgba(235,245,255,1)");
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(x, y, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The rocket's flame, in its frame (nose to +x): a small steady flame while it is alive, longer in
 * flight and longest just after a release, with a warm glow at the nozzle. Behind the body.
 */
export function drawRocketFlame(ctx: CanvasRenderingContext2D, flying: number, since: number, tick: number, still: boolean, sling = false): void {
  const flicker = still ? 1 : 0.8 + 0.2 * Math.sin(tick * 2.3);
  // orbitRev 12: a slingshot flight burns longest, with a teal glow round the gold.
  const boost = sling ? 9 : flying > 0 && since >= 0 && since < 24 ? (24 - since) * 0.35 : 0;
  const flame = ((flying > 0 ? 13 : 9) + boost) * flicker;
  if (!arcadeReducedEffects()) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (sling) drawFxGlow(ctx, "#5CE1E6", -12, 0, 18, 0.7);
    drawFxGlow(ctx, "#FF9A3C", -8, 0, 10 + boost * 0.5, 0.85);
    ctx.restore();
  }
  const fire = ctx.createLinearGradient(-6, 0, -6 - flame, 0);
  fire.addColorStop(0, "rgba(255,240,180,0.95)");
  fire.addColorStop(0.4, "rgba(255,140,50,0.85)");
  fire.addColorStop(1, "rgba(255,77,77,0)");
  ctx.fillStyle = fire;
  ctx.beginPath();
  ctx.moveTo(-5, -3.6);
  ctx.quadraticCurveTo(-6 - flame * 0.6, 0, -6 - flame, 0);
  ctx.quadraticCurveTo(-6 - flame * 0.6, 0, -5, 3.6);
  ctx.closePath();
  ctx.fill();
  // A white-hot core in the flame's root.
  ctx.fillStyle = "rgba(255,255,235,0.85)";
  ctx.beginPath();
  ctx.ellipse(-6.5, 0, 1.6 + flame * 0.08, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawStars(ctx: CanvasRenderingContext2D, cam: number, t: number, still: boolean): void {
  drawNebula(ctx, 0, cam, ORBIT_WORLD_W, ORBIT_WORLD_H);
  const layers = [
    { par: 0.15, gap: 60, size: 1, alpha: 0.35 },
    { par: 0.4, gap: 40, size: 1.5, alpha: 0.55 },
    { par: 0.7, gap: 90, size: 2, alpha: 0.75 },
  ];
  ctx.fillStyle = "#FFFFFF";
  layers.forEach((layer, li) => {
    const par = cam * layer.par;
    const band = Math.floor(par / layer.gap);
    const rows = Math.ceil(ORBIT_WORLD_H / layer.gap) + 2;
    for (let row = band - 1; row < band + rows; row++) {
      for (let k = 0; k < 2; k++) {
        const h = Math.imul(row * 2 + k + 7 + li * 7919, 2654435761) >>> 0;
        const sx = h % ORBIT_WORLD_W;
        const sy = row * layer.gap + ((h >>> 12) % layer.gap) - par;
        const twinkle = still ? 1 : 0.75 + 0.25 * Math.sin(t * 2 + (h % 97));
        ctx.globalAlpha = layer.alpha * (0.5 + ((h >>> 20) % 50) / 100) * twinkle;
        ctx.fillRect(sx, sy, layer.size, layer.size);
        if (li === 2 && h % 3 === 0) {
          drawGlint(ctx, sx + 1, sy + 1, 1.6, twinkle);
          ctx.fillStyle = "#FFFFFF";
        }
      }
    }
  });
  ctx.globalAlpha = 1;
}

/** Orbit drawing through the shared success layer (presentation only). */
export function drawOrbitArt(ctx: CanvasRenderingContext2D, state: OrbitState, size: CanvasSize): void {
  arcadeFx(ctx, ORBIT_FX, state, () => drawOrbitArtWorld(ctx, state, size), size);
}

function drawOrbitArtWorld(ctx: CanvasRenderingContext2D, state: OrbitState, size: CanvasSize): void {
  const still = prefersReducedMotion();
  const t = still ? 0 : state.tick / 60;
  const scale = Math.min(size.width / ORBIT_WORLD_W, size.height / ORBIT_WORLD_H);
  const ox = (size.width - ORBIT_WORLD_W * scale) / 2;
  const oy = (size.height - ORBIT_WORLD_H * scale) / 2;
  ctx.save();
  // Transparent so the shared layered background shows through; a faint wash keeps contrast.
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = "rgba(6,6,15,0.55)";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, ORBIT_WORLD_W, ORBIT_WORLD_H);
  ctx.clip();
  const cam = state.camY / FP;
  const capturePlanet=state.planets[state.cur];
  drawStars(ctx, cam, t, still);
  if (!still && !arcadeReducedEffects()) drawAmbientShootingStar(ctx, state.tick, ORBIT_WORLD_W, ORBIT_WORLD_H);

  const visible: number[] = [];
  for (let i = Math.max(0, state.cur - 2); i < state.planets.length; i++) {
    const p = state.planets[i]!;
    const py = p.y / FP - cam;
    if (py < -200) break;
    if (py > ORBIT_WORLD_H + 200) continue;
    visible.push(i);
  }

  // Planet-coloured glowing dashed paths; the current orbit is emphasized.
  drawOrbitPaths(ctx, state, visible, 0, cam, t);
  ctx.globalAlpha = 1;

  for (const i of visible) {
    const p = state.planets[i]!;
    const px = p.x / FP;
    const py = p.y / FP - cam;
    if (i === ORBIT_TOTAL) drawSun(ctx, px, py, p.r / FP, t);
    else {
      const eight = p.kind === ORBIT_EIGHT;
      const bodies = eight ? [-orbitLobes(p) / FP, orbitLobes(p) / FP] : [0];
      if (!arcadeReducedEffects()) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        bodies.forEach((bx, lobe) => drawAtmosphere(ctx, px + bx, py, (eight ? p.r * 0.8 : p.r) / FP, planetLook(p, i, lobe).colour, orbitGlowStrength(p, i)));
        ctx.restore();
      }
      bodies.forEach((bx, lobe) => drawPlanet(ctx, px + bx, py, (eight ? p.r * 0.8 : p.r) / FP, planetLook(p, i, lobe)));
    }
    if (i === state.checkpoint && state.respawns > 0) {
      const r = p.r / FP;
      const pulse = still ? 0 : Math.sin(t * 4) * 1.5;
      ctx.strokeStyle = ORBIT_GOLD;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, r + 6 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(px, py, r + 6 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    drawBelt(ctx, p, state.tick, cam, still);
  }

  // Release guide, faintly, for a moment after the tap.
  const since = state.tick - state.releaseTick;
  if (since >= 0 && since < ORBIT_TRAIL_TICKS && state.flying > 0) {
    ctx.strokeStyle = ORBIT_GOLD;
    ctx.globalAlpha = 0.2 * (1 - since / ORBIT_TRAIL_TICKS);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(state.releaseX / FP, state.releaseY / FP - cam);
    ctx.lineTo(state.releaseX / FP + (state.vx / FP) * 90, state.releaseY / FP - cam + (state.vy / FP) * 90);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Heading: flight velocity, or the path tangent while orbiting.
  const here = state.planets[state.cur]!;
  let hx = state.vx;
  let hy = state.vy;
  if (state.flying === 0) {
    const a = orbitRendererPathOffset(here, state.angle);
    const b = orbitRendererPathOffset(here, (state.angle + here.dir * 256) & 65535);
    hx = b.u - a.u;
    hy = b.v - a.v;
  }
  const len = Math.hypot(hx, hy) || 1;
  const ux = hx / len;
  const uy = hy / len;
  const sx = state.x / FP;
  const sy = state.y / FP - cam;
  const ship = observeShip(ctx, state);
  drawCaptureGlow(ctx, ship, here.x / FP, here.y / FP - cam, here.r / FP, state.cur === ORBIT_TOTAL ? ORBIT_GOLD : planetLook(here, state.cur, 0).colour, still);
  drawShipTrail(ctx, ship, 0, cam, state.ended === 2);

  // Trail along the straight flight already flown.
  if (state.flying > 0) {
    const back = Math.min(state.flying, 20) * (Math.hypot(state.vx, state.vy) / FP);
    const trail = ctx.createLinearGradient(sx, sy, sx - ux * back, sy - uy * back);
    trail.addColorStop(0, "rgba(255,209,102,0.8)");
    trail.addColorStop(1, "rgba(255,209,102,0)");
    ctx.strokeStyle = trail;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - ux * back, sy - uy * back);
    ctx.stroke();
    ctx.lineCap = "butt";
  }

    // Rocket, nose at the ship's point heading forward.
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(Math.atan2(uy, ux));
  const dead = state.ended === 2;
  if (!dead) drawRocketFlame(ctx, state.flying, since, state.tick, still);
  const rocket = getRocketSprite(dead);
  if (rocket) ctx.drawImage(rocket, -rocket.width / 2, -rocket.height / 2);
  ctx.restore();

  if(capturePlanet)successFrame(ctx,{id:'orbit',tick:state.tick,count:state.captured,enabled:state.captured%5===0,misses:1-state.respawns,colour:ORBIT_GOLD,width:ORBIT_WORLD_W,height:ORBIT_WORLD_H,point:{x:110,y:26,shape:'spark'},hud:{x:14,y:12,text:`Planets ${state.best} / ${ORBIT_TOTAL}`}});
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "left";
  successHud(ctx,'orbit',state.tick,14,26,()=>ctx.fillText(`Planets ${state.best} / ${ORBIT_TOTAL}`,14,26));
  if (state.checkpoint >= 0) {
    ctx.fillStyle = state.respawns > 0 ? ORBIT_GOLD : "rgba(255,255,255,0.4)";
    ctx.font = "600 14px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillText(state.respawns > 0 ? `Checkpoint ${state.checkpoint} · 1 respawn` : `Checkpoint used`, 14, 44);
  }
  if (state.tick - state.respawnTick < 45) {
    ctx.globalAlpha = 1 - (state.tick - state.respawnTick) / 45;
    ctx.fillStyle = ORBIT_GOLD;
    ctx.font = "700 22px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("RESPAWN", ORBIT_WORLD_W / 2, ORBIT_WORLD_H / 2);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** The sim with the art renderer swapped in; step/score are the sim's own. */
export const orbitArtGame = { ...orbitGame, draw: drawOrbitArt };
export { ORBIT_BG };

/* ============================ Rev 3 (camera) ============================ */
/**
 * Rev3 world-scroll art: same geometry helpers as rev1/2 (tracePath,
 * drawPlanet, drawSun, drawBelt, planetLook) but translated by the shared,
 * render-only orbitCamera (sim-tick deterministic capture pans and minimum
 * safe-box flight pushes) instead of the
 * fixed camY scroll. Rev1/2 drawing above is untouched. Why: one camera
 * module keeps play, reveal and intro-demo frames identical without the sim
 * knowing about the viewport.
 */
import {
  orbitCamera,
  orbitCameraObserve,
  orbitVisiblePlanets,
  orbitViewH,
  orbitViewW,
  type OrbitCamOffset,
} from "./orbitCamera";
import { orbitHoleLive, orbitRev3Game, orbitWorldHFor, orbitXpCounts, ORBIT_DUST_R, ORBIT_HOLE_R, ORBIT_MOON_ASSIST, ORBIT_MOON_R, ORBIT_REV3_BG, ORBIT_REV3_RED, type OrbitRev3State } from "./orbitRev3";
import { devDisplayAllowed } from "@/lib/devDisplay";
import { orbitRewardObserve, drawOrbitShootingStar } from './orbitRewards.renderer';

/** One baked sprite per (planet index, lobe, radius) — drawPlanet has no time dependence. */
const rev3SpriteCaches = new WeakMap<Planet[], Map<string, HTMLCanvasElement>>();

function rev3PlanetSprite(planets: Planet[], p: Planet, i: number, lobe: number, r: number): HTMLCanvasElement | null {
  if (typeof document === "undefined" || r <= 0) return null;
  let cache = rev3SpriteCaches.get(planets);
  if (!cache) {
    cache = new Map();
    rev3SpriteCaches.set(planets, cache);
  }
  const key = `${i}:${lobe}:${Math.round(r * 4)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pad = 4;
  const size = Math.ceil(r * 2 + pad * 2);
  const off = document.createElement("canvas");
  off.width = size;
  off.height = size;
  const octx = off.getContext("2d");
  if (!octx) return null;
  drawPlanet(octx, size / 2, size / 2, r, planetLook(p, i, lobe));
  cache.set(key, off);
  return off;
}

function rev3Starfield(ctx: CanvasRenderingContext2D, cam: OrbitCamOffset, t: number, still: boolean, ORBIT_CAM_VIEW_H: number, ORBIT_CAM_VIEW_W: number): void {
  // Same seeded hashed layout as rev1/2's drawStars, parallaxed at 0.3x in both axes
  // since rev3 scrolls sideways as well as vertically.
  // Reduced effects (lib/fx/lowEnd.ts, slow devices only): no nebula tiles and no star glints.
  const lite = arcadeReducedEffects();
  if (!lite) drawNebula(ctx, cam.x, cam.y, ORBIT_CAM_VIEW_W, ORBIT_CAM_VIEW_H);
  const par = 0.3;
  const gap = 46;
  const camX = cam.x * par;
  const camY = cam.y * par;
  const bandX = Math.floor(camX / gap);
  const bandY = Math.floor(camY / gap);
  ctx.fillStyle = "#FFFFFF";
  const cols = Math.ceil(ORBIT_CAM_VIEW_W / gap) + 2;
  const rows = Math.ceil(ORBIT_CAM_VIEW_H / gap) + 2;
  for (let row = bandY - 1; row < bandY + rows; row++) {
    for (let col = bandX - 1; col < bandX + cols; col++) {
      const h = Math.imul(row * 92821 + col * 7919 + 11, 2654435761) >>> 0;
      const sx = col * gap + ((h >>> 12) % gap) - camX;
      const sy = row * gap + ((h >>> 18) % gap) - camY;
      // Polish A4: one star in four twinkles deeply and a little faster.
      const deep = h % 4 === 0;
      const twinkle = still ? 1 : deep ? 0.6 + 0.4 * Math.sin(t * 3.1 + (h % 97)) : 0.75 + 0.25 * Math.sin(t * 2 + (h % 97));
      ctx.globalAlpha = (0.25 + ((h >>> 20) % 60) / 100) * twinkle;
      const size = 1 + ((h >>> 2) % 2) * 0.5;
      ctx.fillRect(sx, sy, size, size);
      if (h % 13 === 0 && !lite) {
        drawGlint(ctx, sx + size / 2, sy + size / 2, 1.5, twinkle);
        ctx.fillStyle = "#FFFFFF";
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** One additive pass drawing every near-glow (sun corona + current-planet halo) together. */
function rev3GlowLayer(ctx: CanvasRenderingContext2D, state: OrbitRev3State, visible: number[], cam: OrbitCamOffset, t: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const i of visible) {
    const p = state.planets[i]!;
    const px = p.x / FP - cam.x;
    const py = p.y / FP - cam.y;
    const sun = i === ORBIT_TOTAL;
    const r = p.r / FP;
    if (sun) {
      const glow = ctx.createRadialGradient(px, py, r * 0.6, px, py, r * 2.2);
      glow.addColorStop(0, "rgba(255,214,102,0.55)");
      glow.addColorStop(1, "rgba(255,150,40,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Polish A4: every planet's soft atmosphere in its own colour.
      const eight = p.kind === ORBIT_EIGHT;
      const bodies = eight ? [-orbitLobes(p) / FP, orbitLobes(p) / FP] : [0];
      bodies.forEach((bx, lobe) => drawAtmosphere(ctx, px + bx, py, (eight ? p.r * 0.8 : p.r) / FP, planetLook(p, i, lobe).colour, orbitGlowStrength(p, i)));
    }
    if (!sun && i === state.cur) {
      const glow = ctx.createRadialGradient(px, py, r * 0.8, px, py, r * 1.6);
      glow.addColorStop(0, "rgba(255,255,255,0.18)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawOrbitRev3Art(ctx: CanvasRenderingContext2D, state: OrbitRev3State, size: CanvasSize): void {
  arcadeFx(ctx, orbit3FxFor(state), state, () => drawOrbitRev3ArtWorld(ctx, state, size), size);
}

/**
 * Rev 4 black hole: a dark disc exactly the capture radius, with a swirling
 * accretion spiral inside it and a violet rim. `armed` (orbiting the planet it
 * belongs to) brightens the rim; `since` is ticks since the last jump, for a
 * brief gold flash. Render only.
 */
function drawBlackHole(ctx: CanvasRenderingContext2D, x: number, y: number, armed: boolean, t: number, since: number, ORBIT_CAM_VIEW_H: number, ORBIT_CAM_VIEW_W: number): void {
  const r = ORBIT_HOLE_R / FP;
  if (x < -r - 4 || y < -r - 4 || x > ORBIT_CAM_VIEW_W + r + 4 || y > ORBIT_CAM_VIEW_H + r + 4) return;
  ctx.save();
  const core = ctx.createRadialGradient(x, y, 0, x, y, r);
  core.addColorStop(0, "#000000");
  core.addColorStop(0.55, "#05010D");
  core.addColorStop(0.85, "#2A0E4A");
  core.addColorStop(1, "#8B5CF6");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // Two spiral arms turning inside the disc.
  ctx.beginPath();
  ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(196,170,255,0.75)";
  ctx.lineWidth = 1.5;
  for (const arm of [0, Math.PI]) {
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const u = k / 16;
      const a = arm + t * 2.4 + u * 3.2;
      const rr = r * (0.2 + 0.75 * u);
      if (k === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = since >= 0 && since < 30 ? ORBIT_GOLD : armed ? "#C4B5FD" : "rgba(139,92,246,0.7)";
  ctx.lineWidth = armed ? 2 : 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * The height (px) Orbit is drawn in for a stored orbitRev (display only; Joe's phone notes, 27 Oct 2026). orbitRev 12
 * frames its course in a 450 × 782 view (the sim's `worldH`, the camera's frame); the play screen draws ORBIT_XP_DRAW_H:
 * ORBIT_XP_AHEAD more rows above that frame (the course further ahead, as orbitRev 8's taller view did), so the frame's
 * bottom is the world's bottom and the world reaches the screen's 16 px strip on the iPhone 11 home-screen app. In the
 * top-right corner of those rows sits ORBIT_XP_ZONE, where nothing in play is ever drawn (everything but the starfield is
 * clipped out of it) and SET CHECKPOINT is laid; the camera keeps the rocket inside its frame, below the rows, so
 * nothing the rocket can meet is ever under the button. The camera, its framing and every input are unchanged.
 * Earlier revisions keep their view (and SET CHECKPOINT's row under it).
 */
export const ORBIT_XP_AHEAD = 80;
export const ORBIT_XP_DRAW_H = 782 + ORBIT_XP_AHEAD;
/**
 * The reserved empty zone (view px, from the drawn view's top-right corner): 210 wide and 74 tall, inside the rows above
 * the frame and 6 px clear of it (the camera keeps the rocket's centre 14 px inside its frame, so its 11 px body never
 * reaches the zone; play-control-clearance-check proves it on every course).
 */
export const ORBIT_XP_ZONE = { w: 210, h: ORBIT_XP_AHEAD - 6 } as const;
export function orbitDrawHFor(rev?: number | null): number {
  return orbitXpRev(rev) ? ORBIT_XP_DRAW_H : orbitWorldHFor(rev);
}
/** The drawn height for a state: orbitRev 12's states carry the wider view (`viewW`). */
function orbitDrawH(state: OrbitRev3State): number {
  return state.viewW ? ORBIT_XP_DRAW_H : orbitViewH(state);
}
/** Clips everything drawn until the matching restore out of ORBIT_XP_ZONE (orbitRev 12 only; a no-op save otherwise). */
function clipOutZone(ctx: CanvasRenderingContext2D, state: OrbitRev3State, W: number, H: number): void {
  ctx.save();
  if (!state.viewW) return;
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(W - ORBIT_XP_ZONE.w, 0, ORBIT_XP_ZONE.w, ORBIT_XP_ZONE.h);
  ctx.clip("evenodd");
}

function drawOrbitRev3ArtWorld(ctx: CanvasRenderingContext2D, state: OrbitRev3State, size: CanvasSize): void {
  // orbitRev 8: the taller view (620 otherwise); orbitRev 12 drawn taller still, ORBIT_XP_AHEAD rows above its frame.
  const ORBIT_CAM_VIEW_H = orbitDrawH(state);
  // orbitRev 12: the wider view (390 otherwise).
  const ORBIT_CAM_VIEW_W = orbitViewW(state);
  const still = prefersReducedMotion();
  const t = still ? 0 : state.tick / 60;
  const ahead = ORBIT_CAM_VIEW_H - orbitViewH(state);
  // The drawn view's top-left in the world: the camera's frame, raised by the rows drawn above it.
  const framed = orbitCamera(state, { reducedMotion: still });
  const cam = { x: framed.x, y: framed.y - ahead };
  const scale = Math.min(size.width / ORBIT_CAM_VIEW_W, size.height / ORBIT_CAM_VIEW_H);
  const ox = (size.width - ORBIT_CAM_VIEW_W * scale) / 2;
  const oy = (size.height - ORBIT_CAM_VIEW_H * scale) / 2;
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = ORBIT_REV3_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, ORBIT_CAM_VIEW_W, ORBIT_CAM_VIEW_H);
  ctx.clip();

  const capturePlanet=state.planets[state.cur];
  rev3Starfield(ctx, cam, t, still, ORBIT_CAM_VIEW_H, ORBIT_CAM_VIEW_W);
  // orbitRev 12: from here to the HUD nothing is drawn in ORBIT_XP_ZONE (SET CHECKPOINT's reserved corner).
  clipOutZone(ctx, state, ORBIT_CAM_VIEW_W, ORBIT_CAM_VIEW_H);
  if (!still && !arcadeReducedEffects()) drawAmbientShootingStar(ctx, state.tick, ORBIT_CAM_VIEW_W, ORBIT_CAM_VIEW_H);
   drawOrbitShootingStar(ctx, state, cam, still);

  // Cull to the drawn view plus one ring's margin either side (orbitVisiblePlanets).
  const visible = orbitVisiblePlanets(state, cam, ahead);

  drawOrbitPaths(ctx, state, visible, cam.x, cam.y, t);
  ctx.globalAlpha = 1;
  // orbitRev 12: the rest of the first lap (a release on it is a perfect orbit).
  drawFirstLap(ctx, state, cam);

  // Reduced effects: the additive corona and halo pass is skipped (the sun and planets still draw).
  if (!arcadeReducedEffects()) rev3GlowLayer(ctx, state, visible, cam, t);

  for (const i of visible) {
    const p = state.planets[i]!;
    const px = p.x / FP - cam.x;
    const py = p.y / FP - cam.y;
    if (i === ORBIT_TOTAL) drawSun(ctx, px, py, p.r / FP, t);
    else {
      const eight = p.kind === ORBIT_EIGHT;
      const bodies = eight ? [-orbitLobes(p) / FP, orbitLobes(p) / FP] : [0];
      bodies.forEach((bx, lobe) => {
        const r = (eight ? p.r * 0.8 : p.r) / FP;
        const sprite = rev3PlanetSprite(state.planets, p, i, lobe, r);
        if (sprite) ctx.drawImage(sprite, px + bx - sprite.width / 2, py - sprite.height / 2);
        else drawPlanet(ctx, px + bx, py, r, planetLook(p, i, lobe));
      });
    }
    if (i === state.checkpoint && state.respawns > 0) {
      const r = p.r / FP;
      const pulse = still ? 0 : Math.sin(t * 4) * 1.5;
      ctx.strokeStyle = ORBIT_GOLD;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, r + 6 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawBelt(ctx, p, state.tick, cam.y, still);
  }

  // Rev 4: black holes in view. orbitRev 7: every hole ahead is live (bright rim); one behind is spent and fades.
  for (const hole of state.holes ?? []) {
    const live = state.swept ? orbitHoleLive(state, hole) : hole.from === state.cur;
    if (state.swept && !live) {
      ctx.save();
      ctx.globalAlpha = 0.35;
    }
    drawBlackHole(ctx, hole.x / FP - cam.x, hole.y / FP - cam.y, live && state.flying === 0, t, state.tick - (state.holeTick ?? -100), ORBIT_CAM_VIEW_H, ORBIT_CAM_VIEW_W);
    if (state.swept && !live) ctx.restore();
  }
  // orbitRev 12: asteroid fields, slingshot moons and stardust.
  const xpMemory = state.xp ? observeXp(ctx, state) : null;
  if (state.xp) drawXpFeatures(ctx, state, cam, t, still, ORBIT_CAM_VIEW_W, ORBIT_CAM_VIEW_H);

  const since = state.tick - state.releaseTick;
  if (since >= 0 && since < ORBIT_TRAIL_TICKS && state.flying > 0) {
    ctx.strokeStyle = ORBIT_GOLD;
    ctx.globalAlpha = 0.2 * (1 - since / ORBIT_TRAIL_TICKS);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(state.releaseX / FP - cam.x, state.releaseY / FP - cam.y);
    ctx.lineTo(state.releaseX / FP - cam.x + (state.vx / FP) * 90, state.releaseY / FP - cam.y + (state.vy / FP) * 90);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  const here = state.planets[state.cur]!;
  let hx = state.vx;
  let hy = state.vy;
  if (state.flying === 0) {
    const a = orbitRendererPathOffset(here, state.angle);
    const b = orbitRendererPathOffset(here, (state.angle + here.dir * 256) & 65535);
    hx = b.u - a.u;
    hy = b.v - a.v;
  }
  const len = Math.hypot(hx, hy) || 1;
  const ux = hx / len;
  const uy = hy / len;
  const sx = state.x / FP - cam.x;
  const sy = state.y / FP - cam.y;
  const ship = observeShip(ctx, state);
  drawCaptureGlow(ctx, ship, here.x / FP - cam.x, here.y / FP - cam.y, here.r / FP, state.cur === ORBIT_TOTAL ? ORBIT_GOLD : planetLook(here, state.cur, 0).colour, still);
  drawShipTrail(ctx, ship, cam.x, cam.y, state.ended === 2);

  if (state.flying > 0) {
    const back = Math.min(state.flying, 20) * (Math.hypot(state.vx, state.vy) / FP);
    const trail = ctx.createLinearGradient(sx, sy, sx - ux * back, sy - uy * back);
    trail.addColorStop(0, "rgba(255,209,102,0.8)");
    trail.addColorStop(1, "rgba(255,209,102,0)");
    ctx.strokeStyle = trail;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - ux * back, sy - uy * back);
    ctx.stroke();
    ctx.lineCap = "butt";
  }

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(Math.atan2(uy, ux));
  const dead = state.ended === 2;
  if (!dead) drawRocketFlame(ctx, state.flying, since, state.tick, still, Boolean(state.boost && state.flying > 0));
  ctx.fillStyle = dead ? "#8A2B33" : "#C8862A";
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.lineTo(-9, -6);
  ctx.lineTo(-2, -3);
  ctx.closePath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(-9, 6);
  ctx.lineTo(-2, 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dead ? ORBIT_REV3_RED : "#F4F1EA";
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.quadraticCurveTo(4, -4.5, -6, -3);
  ctx.lineTo(-6, 3);
  ctx.quadraticCurveTo(4, 4.5, 10, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dead ? "#5A1820" : ORBIT_GOLD;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.quadraticCurveTo(7, -2.6, 5, -2.6);
  ctx.lineTo(5, 2.6);
  ctx.quadraticCurveTo(7, 2.6, 10, 0);
  ctx.fill();
  ctx.fillStyle = "#4D8CFF";
  ctx.beginPath();
  ctx.arc(1, 0, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The end of ORBIT_XP_ZONE's clip (clipOutZone): the HUD and the success layer's HUD burst are top left.
  ctx.restore();
  if(capturePlanet)successFrame(ctx,{id:'orbit3',tick:state.tick,count:state.captured,enabled:state.captured%5===0,misses:1-state.respawns,colour:ORBIT_GOLD,width:ORBIT_CAM_VIEW_W,height:ORBIT_CAM_VIEW_H,point:{x:110,y:26,shape:'spark'},hud:{x:14,y:12,text:`Planets ${state.best} / ${ORBIT_TOTAL}`}});
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "left";
  successHud(ctx,'orbit3',state.tick,14,26,()=>ctx.fillText(`Planets ${state.best} / ${ORBIT_TOTAL}`,14,26));
  // orbitRev 12: what the run has taken of the features, under the planets.
  if (state.xp) {
    const c = orbitXpCounts(state);
    ctx.font = "600 12px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillStyle = "#FFE9A8";
    // Two short lines (since 27 Oct 2026), left of SET CHECKPOINT's reserved corner (ORBIT_XP_ZONE).
    ctx.fillText(`Dust ${c.dust}/${c.dustTotal} · Sling ${c.slings}/${c.slingsTotal}`, 14, 44);
    ctx.fillText(`Thread ${c.threads}/${c.threadsTotal} · Perfect ${c.perfect}`, 14, 60);
  }
  if (state.checkpoint >= 0) {
    ctx.fillStyle = state.respawns > 0 ? ORBIT_GOLD : "rgba(255,255,255,0.4)";
    ctx.font = "600 14px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillText(state.respawns > 0 ? `Checkpoint ${state.checkpoint} · 1 respawn` : `Checkpoint used`, 14, state.xp ? 78 : 44);
  }
  if (xpMemory) {
    clipOutZone(ctx, state, ORBIT_CAM_VIEW_W, ORBIT_CAM_VIEW_H);
    drawXpPops(ctx, xpMemory, cam, still);
    ctx.restore();
  }
  if (state.tick - state.respawnTick < 45) {
    ctx.globalAlpha = 1 - (state.tick - state.respawnTick) / 45;
    ctx.fillStyle = ORBIT_GOLD;
    ctx.font = "700 22px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("RESPAWN", ORBIT_CAM_VIEW_W / 2, ORBIT_CAM_VIEW_H / 2);
    ctx.globalAlpha = 1;
  }

  // Dev-only frame readout (?dev=1 + accepted key): camera position and visible-planet count.
  if (devDisplayAllowed()) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "500 10px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`cam ${cam.x.toFixed(1)}, ${cam.y.toFixed(1)} · visible ${visible.length}`, 14, ORBIT_CAM_VIEW_H - 10);
  }
  ctx.restore();
}

/** The rev3 sim with its camera-scrolled renderer swapped in. */
export const orbitRev3ArtGame = {
  ...orbitRev3Game,
  init: (seed: number) => { const state = orbitRev3Game.init(seed); orbitCameraObserve(state); orbitRewardObserve(state); return state; },
  step: (state: OrbitRev3State, input: Parameters<typeof orbitRev3Game.step>[1]) => {
    orbitCameraObserve(state);
    orbitRewardObserve(state);
    const next = orbitRev3Game.step(state, input);
    orbitCameraObserve(next);
    orbitRewardObserve(next);
    return next;
  },
  draw: drawOrbitRev3Art,
};

/**
 * Dispatches on the replayed state's own `rev` field rather than puzzle data,
 * so a single reveal/intro-demo config keeps working once rev3 is wired into
 * the server puzzle type: rev-1/2 states draw exactly as before.
 */
export function orbitArtGameFor(state: object): { draw: typeof drawOrbitArt } {
  return (state && (state as { rev?: number }).rev === 3 ? orbitRev3ArtGame : orbitArtGame) as unknown as { draw: typeof drawOrbitArt };
}

/* ===================== World expansion (orbitRev 12, display only) ===================== */
/*
 * The features are drawn from the sim's own geometry: a rock's outline sits inside its collision radius, a moon's
 * body is exactly its crash radius, a mote's glow is centred on its pickup point, and the slingshot ring is the
 * assist reach itself. Presentation memory (pops, sparkles) is per canvas and never written to state.
 */
const XP_TEAL = "#5CE1E6";
const XP_DUST = "#FFE9A8";

interface XpMemory {
  tick: number;
  dustGot: number;
  slung: number;
  threaded: number;
  perfect: number;
  /** Recent moments: kind, world point, presentation time. */
  pops: { text: string; x: number; y: number; at: number; colour: string }[];
  sparks: { x: number; y: number; at: number }[];
}
const xpMemories = new WeakMap<object, XpMemory>();
const XP_POP_MS = 900;
const XP_SPARK_MS = 380;

function observeXp(ctx: object, s: OrbitRev3State): XpMemory {
  let m = xpMemories.get(ctx);
  if (!m || s.tick < m.tick) {
    m = { tick: s.tick, dustGot: s.dustGot ?? 0, slung: s.slung ?? 0, threaded: s.threaded ?? 0, perfect: s.perfect ?? 0, pops: [], sparks: [] };
    xpMemories.set(ctx, m);
    return m;
  }
  if (s.tick === m.tick) return m;
  const now = presentationNow();
  const rx = s.x / FP, ry = s.y / FP;
  const got = (s.dustGot ?? 0) & ~m.dustGot;
  (s.dust ?? []).forEach((d, i) => {
    if (got & (1 << i)) m!.sparks.push({ x: d.x / FP, y: d.y / FP, at: now });
  });
  if ((s.slung ?? 0) !== m.slung) m.pops.push({ text: "SLINGSHOT! +4", x: rx, y: ry - 26, at: now, colour: XP_TEAL });
  if ((s.threaded ?? 0) !== m.threaded) m.pops.push({ text: "THREADED! +4", x: rx, y: ry - 26, at: now, colour: ORBIT_GOLD });
  if ((s.perfect ?? 0) > m.perfect) {
    const n = s.perfect ?? 0;
    const p = s.planets[s.cur];
    m.pops.push({ text: n % 3 === 0 ? `PERFECT ORBIT ×${n} +1` : `PERFECT ORBIT ×${n}`, x: p ? p.x / FP : rx, y: p ? (p.y - p.ring) / FP - 14 : ry - 30, at: now, colour: "#FFF3C4" });
  }
  m.tick = s.tick;
  m.dustGot = s.dustGot ?? 0;
  m.slung = s.slung ?? 0;
  m.threaded = s.threaded ?? 0;
  m.perfect = s.perfect ?? 0;
  m.pops = m.pops.filter((p) => now - p.at < XP_POP_MS).slice(-3);
  m.sparks = m.sparks.filter((p) => now - p.at < XP_SPARK_MS).slice(-8);
  return m;
}

/** A rough asteroid inside radius r (every vertex at 0.8–1.0 r), the belt rocks' palette. */
function drawXpRock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hash: number, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((hash % 360) * Math.PI) / 180 + spin);
  const n = 7;
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = r * (0.8 + (((hash >>> (k * 3)) & 7) / 7) * 0.2);
    if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#EDE3D2");
  g.addColorStop(0.45, hash & 1 ? "#B9AC98" : "#A89A86");
  g.addColorStop(1, "#5E554B");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,214,160,0.75)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.arc(r * 0.25, r * 0.15, r * 0.24, 0, Math.PI * 2);
  ctx.arc(-r * 0.3, r * 0.35, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A small grey-violet moon exactly its crash radius, lit from the upper left like the planets. */
function drawXpMoon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  const base = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  base.addColorStop(0, "#E6E2F2");
  base.addColorStop(0.55, "#A7A2C2");
  base.addColorStop(1, "#4E4A66");
  ctx.fillStyle = base;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = "rgba(40,36,60,0.35)";
  for (const [cx, cy, cr] of [[0.2, 0.1, 0.28], [-0.35, 0.3, 0.18], [0.1, -0.45, 0.14]] as const) {
    ctx.beginPath();
    ctx.arc(x + cx * r, y + cy * r, cr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Asteroid fields, slingshot moons and stardust in view. */
function drawXpFeatures(ctx: CanvasRenderingContext2D, s: OrbitRev3State, cam: OrbitCamOffset, t: number, still: boolean, W: number, H: number): void {
  const lite = arcadeReducedEffects();
  const inView = (x: number, y: number, m: number) => x > -m && y > -m && x < W + m && y < H + m;
  // Asteroid fields: the rocks.
  (s.fields ?? []).forEach((f, i) => {
    const ax = f.ax / FP - cam.x, ay = f.ay / FP - cam.y, bx = f.bx / FP - cam.x, by = f.by / FP - cam.y;
    if (!inView((ax + bx) / 2, (ay + by) / 2, 120)) return;
    // No dotted guide line through the gap (Joe's phone notes, 27 Oct 2026): the rocks alone show the field.
    f.rocks.forEach((r, k) => {
      const x = r.x / FP - cam.x, y = r.y / FP - cam.y;
      const hash = Math.imul((r.x ^ (r.y * 31)) + k * 977, 0x85ebca6b) >>> 0;
      drawXpRock(ctx, x, y, r.r / FP, hash, still ? 0 : (t * 0.4 * (hash & 1 ? 1 : -1)));
    });
  });
  // Slingshot moons: a soft glow (gold once slung) and the moon.
  (s.moons ?? []).forEach((m, i) => {
    const x = m.x / FP - cam.x, y = m.y / FP - cam.y;
    if (!inView(x, y, 60)) return;
    const used = ((s.slung ?? 0) >> i) & 1;
    // No dashed ring round the moon (Joe's phone notes, 27 Oct 2026): a soft halo of light fading out exactly at the
    // assist's reach shows where a pass slings (teal, gold once slung; light only, under reduced effects too).
    {
      const reach = ORBIT_MOON_ASSIST / FP;
      const halo = ctx.createRadialGradient(x, y, ORBIT_MOON_R / FP, x, y, reach);
      const tone = used ? "255,209,102" : "92,225,230";
      halo.addColorStop(0, `rgba(${tone},${used ? 0.1 : 0.16})`);
      halo.addColorStop(0.75, `rgba(${tone},${used ? 0.05 : 0.08})`);
      halo.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, reach, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!lite) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      drawFxGlow(ctx, used ? ORBIT_GOLD : XP_TEAL, x, y, ORBIT_MOON_R / FP + 10, 0.4);
      ctx.restore();
    }
    drawXpMoon(ctx, x, y, ORBIT_MOON_R / FP);
  });
  // Stardust: a soft glow and a bright core on each mote still to take.
  ctx.save();
  (s.dust ?? []).forEach((d, i) => {
    if (((s.dustGot ?? 0) >> i) & 1) return;
    const x = d.x / FP - cam.x, y = d.y / FP - cam.y;
    if (!inView(x, y, 12)) return;
    const tw = still ? 1 : 0.8 + 0.2 * Math.sin(t * 5 + i * 1.7);
    if (!lite) {
      ctx.globalCompositeOperation = "lighter";
      drawFxGlow(ctx, XP_DUST, x, y, ORBIT_DUST_R / FP + 6, 0.55 * tw);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = tw;
    ctx.fillStyle = XP_DUST;
    ctx.beginPath();
    ctx.arc(x, y, ORBIT_DUST_R / FP - 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x - 0.6, y - ORBIT_DUST_R / FP, 1.2, (ORBIT_DUST_R / FP) * 2);
    ctx.fillRect(x - ORBIT_DUST_R / FP, y - 0.6, (ORBIT_DUST_R / FP) * 2, 1.2);
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}

/** While the first lap round the current planet lasts: that part of the orbit, ahead of the rocket, in gold. */
function drawFirstLap(ctx: CanvasRenderingContext2D, s: OrbitRev3State, cam: OrbitCamOffset): void {
  const left = s.lapLeft ?? 0;
  if (!s.xp || s.flying > 0 || (s.warp ?? 0) > 0 || left <= 0 || s.ended) return;
  const p = s.planets[s.cur];
  if (!p) return;
  const px = p.x / FP - cam.x, py = p.y / FP - cam.y;
  ctx.save();
  ctx.strokeStyle = ORBIT_GOLD;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  let phase = s.angle;
  const step = Math.max(1, Math.ceil(left / 48));
  for (let k = 0; k <= left; k += step) {
    const o = orbitRendererPathOffset(p, phase);
    if (k === 0) ctx.moveTo(px + o.u / FP, py + o.v / FP);
    else ctx.lineTo(px + o.u / FP, py + o.v / FP);
    for (let j = 0; j < step; j++) phase = (phase + p.dir * phaseRate(p, phase)) & 65535;
  }
  ctx.stroke();
  ctx.restore();
}

/** Collection sparkles and the feature pops (SLINGSHOT!, THREADED!, PERFECT ORBIT); a still fade under reduced motion. */
function drawXpPops(ctx: CanvasRenderingContext2D, m: XpMemory, cam: OrbitCamOffset, still: boolean): void {
  const now = presentationNow();
  ctx.save();
  for (const sp of m.sparks) {
    const p = (now - sp.at) / XP_SPARK_MS;
    if (p < 0 || p >= 1) continue;
    const x = sp.x - cam.x, y = sp.y - cam.y;
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = XP_DUST;
    ctx.lineWidth = 1.4;
    const r = still ? 6 : 4 + 10 * p;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.stroke();
    }
  }
  ctx.font = "800 15px Archivo, 'JetBrains Mono', ui-monospace, sans-serif";
  ctx.textAlign = "center";
  for (const pop of m.pops) {
    const p = (now - pop.at) / XP_POP_MS;
    if (p < 0 || p >= 1) continue;
    ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    const y = pop.y - cam.y - (still ? 0 : 18 * p);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(6,6,15,0.85)";
    ctx.strokeText(pop.text, pop.x - cam.x, y);
    ctx.fillStyle = pop.colour;
    ctx.fillText(pop.text, pop.x - cam.x, y);
  }
  ctx.restore();
}
