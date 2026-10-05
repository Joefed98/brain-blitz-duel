/**
 * Orbit art pass. Render only: reads OrbitState and never mutates it. Every
 * body, path and hazard arc is drawn from the sim's own geometry (planet
 * centre, radius, path offsets) so the art cannot misrepresent a capture.
 */
import type { CanvasSize } from "./engine";
import {
  orbitGame,
  orbitLobes,
  ORBIT_BG,
  ORBIT_EIGHT,
  ORBIT_ELLIPSE,
  ORBIT_GOLD,
  ORBIT_RED,
  ORBIT_TOTAL,
  ORBIT_TRAIL_TICKS,
  ORBIT_WORLD_H,
  ORBIT_WORLD_W,
  type OrbitState,
  type Planet,
} from "./orbit";
import { ANG_QUARTER, icos, isin, TRIG_ONE } from "./trig";
import { reducedMotion as prefersReducedMotion } from "./art.renderer";

/* Mirrors of private sim constants, used only to trace the same paths. */
const FP = 256;
const ELLIPSE_B_PCT = 60;
const EIGHT_A_PCT = 150;
const EIGHT_B_PCT = 45;
const HAZARD_SPAN = ANG_QUARTER;

/** The eight game colours, muted toward slate for planet surfaces. */
const GAME_COLOURS = ["#FF4D4D", "#4D8CFF", "#3DDC84", "#B26BFF", "#FF6BD6", "#FF8A3D", "#8B5A2B", "#FFE600"];
const MUTED = GAME_COLOURS.map((hex) => mix(hex, "#5A6070", 0.38));

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${[ch(16), ch(8), ch(0)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** Same offset maths as the sim's pathOffset. */
function pathOffset(p: Planet, phase: number): { u: number; v: number } {
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
    colour: MUTED[(h >>> 4) % 8]!,
    ring: ((h >>> 9) % 4) === 0,
    tilt: (((h >>> 12) % 60) - 30) * (Math.PI / 180),
    h,
  };
}

function drawPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: ReturnType<typeof planetLook>): void {
  const base = look.type === 2 ? mix(look.colour, "#DDEBFF", 0.55) : look.colour;
  // Atmosphere glow.
  const glow = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.5);
  glow.addColorStop(0, look.type === 2 ? "rgba(190,225,255,0.28)" : "rgba(255,255,255,0.14)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Ring behind.
  if (look.ring) drawRingHalf(ctx, x, y, r, look.tilt, true);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = base;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (look.type === 1) {
    // Gas bands.
    ctx.globalAlpha = 0.22;
    for (let b = 0; b < 5; b++) {
      ctx.fillStyle = b % 2 ? "#000000" : "#FFFFFF";
      const by = y - r + ((b + 0.5) * 2 * r) / 5 + (((look.h >>> (b * 3)) % 5) - 2);
      ctx.fillRect(x - r, by - r * 0.12, r * 2, r * 0.2);
    }
    ctx.globalAlpha = 1;
  } else if (look.type === 0) {
    // Craters.
    for (let c = 0; c < 4; c++) {
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
  shade.addColorStop(0, "rgba(255,255,255,0.35)");
  shade.addColorStop(0.45, "rgba(255,255,255,0)");
  shade.addColorStop(0.8, "rgba(0,0,0,0.35)");
  shade.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  if (look.ring) drawRingHalf(ctx, x, y, r, look.tilt, false);
}

function drawRingHalf(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tilt: number, back: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.strokeStyle = back ? "rgba(230,220,200,0.25)" : "rgba(230,220,200,0.55)";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.55, r * 0.38, 0, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
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
}

function tracePath(ctx: CanvasRenderingContext2D, p: Planet, px: number, py: number, from: number, span: number, steps: number): void {
  ctx.beginPath();
  for (let k = 0; k <= steps; k++) {
    const o = pathOffset(p, (from + Math.trunc((span * k) / steps)) & 65535);
    if (k === 0) ctx.moveTo(px + o.u / FP, py + o.v / FP);
    else ctx.lineTo(px + o.u / FP, py + o.v / FP);
  }
}

function drawStars(ctx: CanvasRenderingContext2D, cam: number, t: number, still: boolean): void {
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
      }
    }
  });
  ctx.globalAlpha = 1;
}

export function drawOrbitArt(ctx: CanvasRenderingContext2D, state: OrbitState, size: CanvasSize): void {
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
  drawStars(ctx, cam, t, still);

  const visible: number[] = [];
  for (let i = Math.max(0, state.cur - 2); i < state.planets.length; i++) {
    const p = state.planets[i]!;
    const py = p.y / FP - cam;
    if (py < -200) break;
    if (py > ORBIT_WORLD_H + 200) continue;
    visible.push(i);
  }

  // Orbit paths first, faint dashes; the current orbit a touch brighter.
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 6]);
  for (const i of visible) {
    const p = state.planets[i]!;
    const sun = i === ORBIT_TOTAL;
    ctx.strokeStyle = sun ? ORBIT_GOLD : "#CFE3FF";
    ctx.globalAlpha = i === state.cur ? 0.5 : 0.2;
    tracePath(ctx, p, p.x / FP, p.y / FP - cam, 0, 65536, 72);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  for (const i of visible) {
    const p = state.planets[i]!;
    const px = p.x / FP;
    const py = p.y / FP - cam;
    if (i === ORBIT_TOTAL) drawSun(ctx, px, py, p.r / FP, t);
    else {
      const eight = p.kind === ORBIT_EIGHT;
      const bodies = eight ? [-orbitLobes(p) / FP, orbitLobes(p) / FP] : [0];
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
    if (p.hazard >= 0) {
      // Hazard arc on the exact path, with a hot glow.
      ctx.strokeStyle = ORBIT_RED;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 9;
      tracePath(ctx, p, px, py, p.hazard, HAZARD_SPAN, 16);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 4;
      tracePath(ctx, p, px, py, p.hazard, HAZARD_SPAN, 16);
      ctx.stroke();
      ctx.lineCap = "butt";
    }
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
    const a = pathOffset(here, state.angle);
    const b = pathOffset(here, (state.angle + here.dir * 256) & 65535);
    hx = b.u - a.u;
    hy = b.v - a.v;
  }
  const len = Math.hypot(hx, hy) || 1;
  const ux = hx / len;
  const uy = hy / len;
  const sx = state.x / FP;
  const sy = state.y / FP - cam;

  // Trail along the straight flight already flown.
  if (state.flying > 0) {
    const back = Math.min(state.flying, 14) * (Math.hypot(state.vx, state.vy) / FP);
    const trail = ctx.createLinearGradient(sx, sy, sx - ux * back, sy - uy * back);
    trail.addColorStop(0, "rgba(255,209,102,0.55)");
    trail.addColorStop(1, "rgba(255,209,102,0)");
    ctx.strokeStyle = trail;
    ctx.lineWidth = 3;
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
  if (state.flying > 0 && !dead && since < 24) {
    const flicker = still ? 1 : 0.8 + 0.2 * Math.sin(state.tick * 2.3);
    const flame = (10 + (24 - since) * 0.35) * flicker;
    const fire = ctx.createLinearGradient(-6, 0, -6 - flame, 0);
    fire.addColorStop(0, "rgba(255,240,180,0.95)");
    fire.addColorStop(0.4, "rgba(255,140,50,0.85)");
    fire.addColorStop(1, "rgba(255,77,77,0)");
    ctx.fillStyle = fire;
    ctx.beginPath();
    ctx.moveTo(-5, -3);
    ctx.quadraticCurveTo(-6 - flame * 0.6, 0, -6 - flame, 0);
    ctx.quadraticCurveTo(-6 - flame * 0.6, 0, -5, 3);
    ctx.closePath();
    ctx.fill();
  }
  // Fins.
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
  // Body.
  ctx.fillStyle = dead ? ORBIT_RED : "#F4F1EA";
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

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Planets ${state.best} / ${ORBIT_TOTAL}`, 14, 26);
  if (state.checkpoint >= 0) {
    ctx.fillStyle = state.respawns > 0 ? ORBIT_GOLD : "rgba(255,255,255,0.4)";
    ctx.font = "600 12px 'JetBrains Mono', ui-monospace, monospace";
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
