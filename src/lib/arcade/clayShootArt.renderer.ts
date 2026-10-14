/**
 * Pull! (clayshoot) art, Speed & Attention polish (13 Oct 2026). Presentation only: reads
 * ClayState and never writes it; the sim's own `draw` in clayShoot.ts stays as the legacy
 * reference. Static scenery is painted once per device-pixel size on an offscreen canvas;
 * clouds are pre-rendered sprites that drift from state.tick. No Math.random anywhere.
 *
 * Bounds (rule 3): a flying clay fills exactly the sim's drawn footprint (ellipse
 * rx = clayRadius, ry = 0.55 r) inside a shot-zone ring at the sim hit radius (orange 30, gold 24);
 * a bird stays inside CLAY_BIRD_RX × CLAY_BIRD_RY + 2 px, over a no-shoot zone at exactly that hit
 * ellipse. Flying clays and birds are drawn one tick
 * ahead, where the sim judges a tap made on this frame.
 */
import {
  clayGameFor,
  clayView,
  CLAY_BIRD_FLYING,
  CLAY_BIRD_RX,
  CLAY_BIRD_RY,
  CLAY_BIRD_STARTLED,
  CLAY_BIRD_STARTLED_TICKS,
  CLAY_CONFIG,
  CLAY_FLYING,
  CLAY_H,
  CLAY_HIT,
  CLAY_KIND_GOLD,
  CLAY_W,
  type ClayState,
} from "./clayShoot";
import type { CanvasSize } from "./engine";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { reducedMotion } from "./art.renderer";

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const W = CLAY_W;
const H = CLAY_H;
const R = CLAY_CONFIG.clayRadius;
const RY = R * 0.55;
const TAU = Math.PI * 2;
/** Horizon rows (world px). */
const GRASS_TOP = 356;

/** Deterministic hash → [0, 1). */
function hash(a: number, b = 0): number {
  let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be59b, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/* ============================== Scenery ============================== */

function paintScenery(c: Ctx2D): void {
  // Sky: deep blue overhead easing to a hazy pale horizon.
  const sky = c.createLinearGradient(0, 0, 0, GRASS_TOP);
  sky.addColorStop(0, "#1C4774");
  sky.addColorStop(0.42, "#3A78AE");
  sky.addColorStop(0.78, "#79AFD8");
  sky.addColorStop(0.92, "#B4D3E7");
  sky.addColorStop(1, "#CFE2EC");
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);

  // Soft sun, upper right: a wide warm glow and a pale core.
  const sx = 302;
  const sy = 58;
  const glow = c.createRadialGradient(sx, sy, 4, sx, sy, 120);
  glow.addColorStop(0, "rgba(255,240,200,0.42)");
  glow.addColorStop(0.25, "rgba(255,228,170,0.16)");
  glow.addColorStop(1, "rgba(255,220,160,0)");
  c.fillStyle = glow;
  c.fillRect(0, 0, W, 240);
  const core = c.createRadialGradient(sx, sy, 0, sx, sy, 15);
  core.addColorStop(0, "rgba(255,252,236,0.95)");
  core.addColorStop(0.75, "rgba(255,244,214,0.85)");
  core.addColorStop(1, "rgba(255,240,205,0)");
  c.fillStyle = core;
  c.beginPath();
  c.arc(sx, sy, 15, 0, TAU);
  c.fill();

  // Far hills: two hazy ridges.
  const ridge = (base: number, amp: number, f1: number, f2: number, ph: number, colour: string) => {
    c.fillStyle = colour;
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) {
      c.lineTo(x, base + amp * Math.sin(x / f1 + ph) + amp * 0.6 * Math.sin(x / f2 + ph * 2.3));
    }
    c.lineTo(W, H);
    c.closePath();
    c.fill();
  };
  ridge(324, 6, 41, 15, 0.4, "#8DADC0");
  ridge(334, 5, 29, 11, 2.1, "#6D9384");

  // Tree line: rounded canopies with a few conifers, lit from the upper right.
  c.fillStyle = "#284C36";
  c.fillRect(0, 344, W, GRASS_TOP - 344 + 2);
  for (let i = 0; i < 64; i++) {
    const x = i * 6 + hash(i, 1) * 5 - 4;
    const conifer = hash(i, 2) < 0.16;
    if (conifer) {
      const h = 16 + hash(i, 3) * 9;
      c.fillStyle = "#22432F";
      c.beginPath();
      c.moveTo(x - 5, 349);
      c.lineTo(x, 349 - h);
      c.lineTo(x + 5, 349);
      c.closePath();
      c.fill();
      c.fillStyle = "rgba(120,170,120,0.18)";
      c.beginPath();
      c.moveTo(x, 349 - h);
      c.lineTo(x + 5, 349);
      c.lineTo(x + 1.5, 349);
      c.closePath();
      c.fill();
    } else {
      const r = 5 + hash(i, 4) * 4.5;
      const y = 345 - hash(i, 5) * 5;
      c.fillStyle = i % 3 === 0 ? "#2D573B" : "#305D3F";
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
      c.fillStyle = "rgba(150,200,140,0.16)";
      c.beginPath();
      c.arc(x + r * 0.3, y - r * 0.3, r * 0.6, 0, TAU);
      c.fill();
    }
  }
  // Haze over the tree line so it sits back.
  const haze = c.createLinearGradient(0, 330, 0, GRASS_TOP);
  haze.addColorStop(0, "rgba(200,225,235,0.22)");
  haze.addColorStop(1, "rgba(200,225,235,0)");
  c.fillStyle = haze;
  c.fillRect(0, 316, W, GRASS_TOP - 316);

  // Grass: far band, mown stripes, blades and a few flowers.
  const grass = c.createLinearGradient(0, GRASS_TOP, 0, H);
  grass.addColorStop(0, "#557E3C");
  grass.addColorStop(0.35, "#4A7436");
  grass.addColorStop(1, "#2A4723");
  c.fillStyle = grass;
  c.fillRect(0, GRASS_TOP, W, H - GRASS_TOP);
  c.fillStyle = "rgba(20,45,20,0.28)";
  c.fillRect(0, GRASS_TOP, W, 3);
  for (let s = 0; s < 9; s++) {
    c.fillStyle = s % 2 ? "rgba(255,255,220,0.05)" : "rgba(0,30,0,0.06)";
    const x0 = s * 44 - 30;
    c.beginPath();
    c.moveTo(x0 + 18, GRASS_TOP);
    c.lineTo(x0 + 40, GRASS_TOP);
    c.lineTo(x0 + 66, H);
    c.lineTo(x0 + 22, H);
    c.closePath();
    c.fill();
  }
  c.lineCap = "round";
  for (let i = 0; i < 300; i++) {
    const x = hash(i, 11) * W;
    const depth = hash(i, 12);
    const y = GRASS_TOP + 3 + depth * (H - GRASS_TOP - 2);
    const len = 2 + depth * 4.5;
    const lean = (hash(i, 13) - 0.5) * 3;
    c.lineWidth = 0.6 + depth * 0.6;
    c.strokeStyle = i % 3 === 0 ? "rgba(170,205,120,0.32)" : i % 3 === 1 ? "rgba(15,45,20,0.34)" : "rgba(110,150,80,0.3)";
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + lean * 0.3, y - len * 0.6, x + lean, y - len);
    c.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = hash(i, 21) * W;
    const y = GRASS_TOP + 8 + hash(i, 22) * 34;
    c.fillStyle = i % 3 === 0 ? "rgba(255,230,120,0.7)" : "rgba(245,245,240,0.65)";
    c.beginPath();
    c.arc(x, y, 0.9, 0, TAU);
    c.fill();
  }

  // Post-and-rail fence along the field edge.
  c.fillStyle = "rgba(0,0,0,0.18)";
  c.fillRect(0, 361, W, 1.2);
  c.fillStyle = "#7B5B3B";
  c.fillRect(0, 351, W, 1.8);
  c.fillRect(0, 356.5, W, 1.8);
  c.fillStyle = "rgba(255,230,190,0.25)";
  c.fillRect(0, 351, W, 0.6);
  c.fillRect(0, 356.5, W, 0.6);
  for (let x = 12; x < W; x += 30) {
    c.fillStyle = "#6A4C30";
    c.fillRect(x - 1.5, 348, 3, 14);
    c.fillStyle = "rgba(255,230,190,0.3)";
    c.fillRect(x - 1.5, 348, 1, 14);
  }

  // Trap houses half off each edge: low concrete bunkers with the throwing slot.
  const trap = (x0: number, flip: boolean) => {
    c.save();
    c.translate(x0, 0);
    if (flip) c.scale(-1, 1);
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.beginPath();
    c.ellipse(14, 383, 30, 4, 0, 0, TAU);
    c.fill();
    const wall = c.createLinearGradient(0, 360, 0, 384);
    wall.addColorStop(0, "#B9B6AA");
    wall.addColorStop(1, "#7F7C72");
    c.fillStyle = wall;
    c.fillRect(-14, 362, 48, 21);
    c.fillStyle = "#D2CFC3";
    c.fillRect(-16, 358, 52, 5);
    c.fillStyle = "rgba(0,0,0,0.2)";
    c.fillRect(-16, 362.5, 52, 1);
    c.fillStyle = "#1E211F";
    c.fillRect(20, 368, 12, 5);
    c.fillStyle = "rgba(0,0,0,0.12)";
    for (let k = 0; k < 3; k++) c.fillRect(-14, 368 + k * 5, 48, 0.6);
    c.restore();
  };
  trap(0, false);
  trap(W, true);

  // Gentle vignette at the top corners for depth.
  const vig = c.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.85);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(5,15,35,0.22)");
  c.fillStyle = vig;
  c.fillRect(0, 0, W, H);
}

const sceneryCache = new Map<string, ArtCanvas | null>();

function scenery(kx: number, ky: number): ArtCanvas | null {
  const pw = Math.max(1, Math.min(2048, Math.round(W * kx)));
  const ph = Math.max(1, Math.min(2048, Math.round(H * ky)));
  const key = `${pw}x${ph}`;
  if (sceneryCache.has(key)) return sceneryCache.get(key) ?? null;
  const surface = artCanvas(pw, ph);
  const c = surface ? artContext(surface) : null;
  if (surface && c) {
    c.scale(pw / W, ph / H);
    paintScenery(c);
  }
  if (sceneryCache.size > 4) sceneryCache.delete(sceneryCache.keys().next().value as string);
  sceneryCache.set(key, c ? surface : null);
  return c ? surface : null;
}

/* =============================== Sprites =============================== */

interface Sprite {
  canvas: ArtCanvas;
  w: number;
  h: number;
}

const spriteCache = new Map<string, Sprite | null>();

function sprite(name: string, k: number, w: number, h: number, paint: (c: Ctx2D) => void): Sprite | null {
  const key = `${name}@${k}`;
  if (spriteCache.has(key)) return spriteCache.get(key) ?? null;
  const surface = artCanvas(Math.max(1, Math.ceil(w * k)), Math.max(1, Math.ceil(h * k)));
  const c = surface ? artContext(surface) : null;
  let out: Sprite | null = null;
  if (surface && c) {
    c.scale(k, k);
    paint(c);
    out = { canvas: surface, w, h };
  }
  spriteCache.set(key, out);
  return out;
}

/** Cloud puffs: [dx, dy, r] relative to the sprite's bottom-left. */
const CLOUDS: readonly (readonly [number, number, number])[][] = [
  [[14, -10, 10], [30, -17, 15], [50, -14, 13], [66, -9, 9], [40, -8, 10]],
  [[12, -8, 8], [26, -14, 12], [42, -11, 10], [54, -7, 7]],
  [[16, -11, 11], [36, -20, 17], [60, -18, 15], [82, -12, 11], [98, -8, 7], [50, -9, 11]],
];
const CLOUD_SIZE: readonly (readonly [number, number])[] = [[80, 34], [64, 28], [110, 40]];

function cloudSprite(index: number, k: number): Sprite | null {
  const [w, h] = CLOUD_SIZE[index]!;
  return sprite(`cloud${index}`, k, w, h, (c) => {
    const puffs = CLOUDS[index]!;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.65, "rgba(240,246,252,0.9)");
    g.addColorStop(1, "rgba(196,214,232,0.85)");
    c.fillStyle = g;
    c.beginPath();
    for (const [dx, dy, r] of puffs) {
      c.moveTo(dx + r, h - 2 + dy);
      c.arc(dx, h - 2 + dy, r, 0, TAU);
    }
    c.rect(puffs[0]![0], h - 2 - 8, puffs[puffs.length - 1]![0] - puffs[0]![0], 8);
    c.fill();
    // Soft shaded underside.
    c.globalCompositeOperation = "source-atop";
    const under = c.createLinearGradient(0, h - 16, 0, h);
    under.addColorStop(0, "rgba(120,150,185,0)");
    under.addColorStop(1, "rgba(120,150,185,0.24)");
    c.fillStyle = under;
    c.fillRect(0, h - 16, w, 16);
    c.globalCompositeOperation = "source-over";
  });
}

/** Cloud lanes: sprite, y (bottom), world px per tick, start offset, alpha. */
const CLOUD_LANES: readonly { s: number; y: number; v: number; x0: number; a: number }[] = [
  { s: 2, y: 64, v: 0.05, x0: 40, a: 0.5 },
  { s: 0, y: 118, v: 0.075, x0: 230, a: 0.42 },
  { s: 1, y: 190, v: 0.1, x0: 120, a: 0.34 },
  { s: 0, y: 262, v: 0.065, x0: 330, a: 0.28 },
  { s: 1, y: 312, v: 0.04, x0: 10, a: 0.3 },
];

function clayBodySprite(gold: boolean, k: number): Sprite | null {
  // The sprite is exactly the footprint box; the ellipse fills it.
  return sprite(gold ? "clayGold" : "clayOrange", k, R * 2, RY * 2, (c) => {
    c.translate(R, RY);
    const body = c.createLinearGradient(0, -RY, 0, RY);
    if (gold) {
      body.addColorStop(0, "#FFE596");
      body.addColorStop(0.45, "#F7BE36");
      body.addColorStop(1, "#B98110");
    } else {
      body.addColorStop(0, "#FFA766");
      body.addColorStop(0.45, "#E8762C");
      body.addColorStop(1, "#A9481A");
    }
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(0, 0, R, RY, 0, 0, TAU);
    c.fill();
    // Rim edge, inside the footprint.
    c.strokeStyle = gold ? "rgba(110,70,0,0.55)" : "rgba(90,30,5,0.55)";
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(0, 0, R - 0.5, RY - 0.5, 0, 0, TAU);
    c.stroke();
    // Raised dome and its ring.
    c.fillStyle = gold ? "rgba(255,236,160,0.5)" : "rgba(255,170,110,0.45)";
    c.beginPath();
    c.ellipse(0, -0.8, R * 0.62, RY * 0.52, 0, 0, TAU);
    c.fill();
    c.strokeStyle = "rgba(60,20,0,0.22)";
    c.lineWidth = 0.8;
    c.beginPath();
    c.ellipse(0, -0.3, R * 0.68, RY * 0.6, 0, 0, Math.PI);
    c.stroke();
    // Glossy sheen.
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.beginPath();
    c.ellipse(-3.6, -2.4, R * 0.4, R * 0.15, -0.12, 0, TAU);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.beginPath();
    c.arc(-6.2, -2.6, 0.9, 0, TAU);
    c.fill();
  });
}

/* ================================ Pieces ================================ */

function star(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const t = s * 0.22;
  c.beginPath();
  c.moveTo(x, y - s);
  c.lineTo(x + t, y - t);
  c.lineTo(x + s, y);
  c.lineTo(x + t, y + t);
  c.lineTo(x, y + s);
  c.lineTo(x - t, y + t);
  c.lineTo(x - s, y);
  c.lineTo(x - t, y - t);
  c.closePath();
  c.fill();
}

function drawClay(c: CanvasRenderingContext2D, x: number, y: number, gold: boolean, i: number, tick: number, k: number, still: boolean): void {
  const body = clayBodySprite(gold, k);
  if (body) c.drawImage(body.canvas as CanvasImageSource, x - R, y - RY, R * 2, RY * 2);
  else {
    c.fillStyle = gold ? "#F5B82E" : "#E8762C";
    c.beginPath();
    c.ellipse(x, y, R, RY, 0, 0, TAU);
    c.fill();
  }
  // Spin mark: a small notch travelling round the rim.
  const a = still ? 0.8 : (tick + i * 11) * 0.42;
  const nx = Math.cos(a) * R * 0.8;
  const ny = Math.sin(a) * RY * 0.72;
  c.fillStyle = Math.sin(a) > 0 ? "rgba(70,25,0,0.32)" : "rgba(255,240,210,0.45)";
  c.beginPath();
  c.ellipse(x + nx, y + ny, 1.6, 0.9, 0, 0, TAU);
  c.fill();
  if (gold) {
    // Glint: a four-point star that flashes every ~2/3 s, inside the footprint + 2 px.
    const phase = (tick + i * 17) % 40;
    const s = still ? 4 : phase < 14 ? 6.5 * Math.sin((phase / 14) * Math.PI) : 0;
    if (s > 0.4) {
      c.fillStyle = "rgba(255,255,240,0.95)";
      star(c, x + 4, y - 2.5, s);
      c.fillStyle = "rgba(255,255,255,1)";
      c.beginPath();
      c.arc(x + 4, y - 2.5, 1.1, 0, TAU);
      c.fill();
    }
  }
}

/** Shot zone: a faint disc and rim at exactly the sim's hit radius (orange 30, gold 24). */
function drawShotZone(c: CanvasRenderingContext2D, x: number, y: number, gold: boolean): void {
  const r = gold ? CLAY_CONFIG.goldHitRadius : CLAY_CONFIG.orangeHitRadius;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = gold ? "rgba(255,222,120,0.10)" : "rgba(255,255,255,0.08)";
  c.fill();
  c.beginPath();
  c.arc(x, y, r - 0.6, 0, TAU);
  c.lineWidth = 1.2;
  c.strokeStyle = gold ? "rgba(255,226,140,0.55)" : "rgba(255,255,255,0.42)";
  c.stroke();
}

const SHARD_TICKS = 26;

function drawShatter(c: CanvasRenderingContext2D, state: ClayState, i: number, age: number, still: boolean): void {
  const x0 = state.x[i]! / 256;
  const y0 = state.y[i]! / 256;
  const gold = state.schedule.kind[i] === CLAY_KIND_GOLD;
  const drift = state.schedule.vx[i]! / 256;
  const p = age / SHARD_TICKS;
  const t = still ? Math.min(age, 4) : age;
  // Flash ring and dust puff.
  if (age < 6) {
    c.globalAlpha = (1 - age / 6) * 0.8;
    c.strokeStyle = gold ? "#FFF3C2" : "#FFE6CF";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x0, y0, 8 + t * 3, 0, TAU);
    c.stroke();
  }
  if (age < 16) {
    c.globalAlpha = (1 - age / 16) * 0.32;
    c.fillStyle = gold ? "#FFE9A8" : "#F2D2B4";
    c.beginPath();
    c.arc(x0 + drift * 0.2 * t, y0 + t * 0.15, 5 + t * 1.2, 0, TAU);
    c.fill();
  }
  // Shards: seeded triangles with momentum, spin and gravity.
  const light = gold ? "#FFD66A" : "#F58C45";
  const dark = gold ? "#B5810F" : "#9C4316";
  c.globalAlpha = Math.max(0, 1 - Math.pow(p, 1.6));
  for (let n = 0; n < 10; n++) {
    const a = (n / 10) * TAU + hash(i, n) * 0.6;
    const v = 1.1 + hash(i, n + 20) * 1.7;
    const size = 2.2 + hash(i, n + 40) * 2.8;
    const px = x0 + Math.cos(a) * v * t + drift * 0.3 * t;
    const py = y0 + Math.sin(a) * v * t * 0.75 + 0.085 * t * t;
    const rot = a + t * (0.25 + hash(i, n + 60) * 0.35) * (n % 2 ? 1 : -1);
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    c.fillStyle = n % 3 === 0 ? dark : light;
    c.beginPath();
    c.moveTo(px + cr * size, py + sr * size);
    c.lineTo(px - sr * size * 0.6 - cr * size * 0.4, py + cr * size * 0.6 - sr * size * 0.4);
    c.lineTo(px + sr * size * 0.5 - cr * size * 0.7, py - cr * size * 0.5 - sr * size * 0.7);
    c.closePath();
    c.fill();
  }
  if (gold) {
    c.fillStyle = "#FFF6CF";
    for (let n = 0; n < 5; n++) {
      const a = n * 1.2566 + 0.3;
      const d = 6 + t * 1.6;
      const s = 3.5 * (1 - p) * (0.6 + 0.4 * Math.sin(t * 0.8 + n));
      if (s > 0.3) star(c, x0 + Math.cos(a) * d, y0 + Math.sin(a) * d * 0.8, s);
    }
  }
  c.globalAlpha = 1;
}

function drawMissPuff(c: CanvasRenderingContext2D, state: ClayState, age: number, still: boolean): void {
  const x = state.shotX / 256;
  const y = state.shotY / 256;
  const f = 1 - age / 14;
  const t = still ? 2 : age;
  c.globalAlpha = f * 0.5;
  c.fillStyle = "#DCDCD6";
  c.beginPath();
  c.arc(x, y, 5 + t * 0.8, 0, TAU);
  c.fill();
  c.globalAlpha = f * 0.35;
  c.fillStyle = "#F2F2EE";
  c.beginPath();
  c.arc(x - 2 - t * 0.2, y - 2 - t * 0.25, 3 + t * 0.55, 0, TAU);
  c.fill();
  c.globalAlpha = f * 0.8;
  c.fillStyle = "#4B4B48";
  for (let n = 0; n < 6; n++) {
    const a = n * 1.047 + 0.5;
    const d = 3 + t * 1.3;
    c.fillRect(x + Math.cos(a) * d - 0.6, y + Math.sin(a) * d - 0.6, 1.2, 1.2);
  }
  c.globalAlpha = 1;
}

/** Bird facing +x, centred on its collision ellipse (±15 × ±9; art within ±17 × ±11). */
function drawBird(c: CanvasRenderingContext2D, flap: number): void {
  const outline = "rgba(14,20,32,0.82)";
  const wing = (f: number, fill: string, tipFill: string) => {
    const r1x = 3;
    const r1y = -1;
    const m1x = 0.5;
    const m1y = -1 - 7 * f;
    const tx = -6.5;
    const ty = f >= 0 ? -10 * f : -9 * f;
    const m2x = -3.5;
    const m2y = -0.5 - 4.5 * f;
    c.beginPath();
    c.moveTo(r1x, r1y);
    c.quadraticCurveTo(m1x, m1y, tx, ty);
    c.quadraticCurveTo(m2x, m2y, -3, 0.5);
    c.closePath();
    c.lineWidth = 2;
    c.strokeStyle = outline;
    c.stroke();
    c.fillStyle = fill;
    c.fill();
    // Dark wingtip.
    c.fillStyle = tipFill;
    c.beginPath();
    c.moveTo(tx, ty);
    c.lineTo(tx + (m1x - tx) * 0.38, ty + (m1y - ty) * 0.38);
    c.lineTo(tx + (m2x - tx) * 0.42, ty + (m2y - ty) * 0.42);
    c.closePath();
    c.fill();
  };
  // Far wing behind the body.
  c.save();
  c.translate(1.5, -0.5);
  wing(flap * 0.8, "#C9D0DA", "#2A2F38");
  c.restore();
  // Body, head and forked tail as one silhouette: stroke under, fill over.
  c.beginPath();
  c.ellipse(0, 0.5, 8.5, 4.2, 0, 0, TAU);
  c.moveTo(12.1, -1.5);
  c.arc(8.5, -1.5, 3.6, 0, TAU);
  c.moveTo(-7, -1.6);
  c.lineTo(-15, -3.6);
  c.lineTo(-12.8, 0.6);
  c.lineTo(-15, 4);
  c.lineTo(-7, 2.4);
  c.closePath();
  c.lineWidth = 2.2;
  c.strokeStyle = outline;
  c.stroke();
  c.fillStyle = "#F8F9FB";
  c.fill();
  // Grey belly shade and tail tip.
  c.fillStyle = "rgba(150,162,180,0.5)";
  c.beginPath();
  c.ellipse(-0.5, 2.8, 6.5, 1.5, 0, 0, TAU);
  c.fill();
  c.fillStyle = "rgba(90,100,118,0.55)";
  c.beginPath();
  c.moveTo(-15, -3.6);
  c.lineTo(-13.6, -0.8);
  c.lineTo(-13.6, 1.4);
  c.lineTo(-15, 4);
  c.closePath();
  c.fill();
  // Beak and eye.
  c.fillStyle = "#EFA531";
  c.strokeStyle = "rgba(110,60,0,0.85)";
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(11.4, -2.6);
  c.lineTo(15.6, -0.9);
  c.lineTo(11.4, 0.2);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "#0B0B0F";
  c.beginPath();
  c.arc(9.4, -2.4, 1.05, 0, TAU);
  c.fill();
  c.fillStyle = "#FFFFFF";
  c.beginPath();
  c.arc(9.75, -2.75, 0.35, 0, TAU);
  c.fill();
  // Near wing over the body.
  wing(flap, "#FFFFFF", "#1E222A");
}

/**
 * A flying bird's no-shoot zone: a faint red wash and rim at exactly the sim's hit ellipse
 * (CLAY_BIRD_RX × CLAY_BIRD_RY), so the drawn edge is the edge a tap startles it from,
 * whatever the wings are doing. Display only, like the clays' shot zones.
 */
function drawBirdZone(c: CanvasRenderingContext2D, x: number, y: number): void {
  c.beginPath();
  c.ellipse(x, y, CLAY_BIRD_RX, CLAY_BIRD_RY, 0, 0, TAU);
  c.fillStyle = "rgba(255,90,90,0.10)";
  c.fill();
  c.beginPath();
  c.ellipse(x, y, CLAY_BIRD_RX - 0.6, CLAY_BIRD_RY - 0.6, 0, 0, TAU);
  c.lineWidth = 1.2;
  c.strokeStyle = "rgba(255,110,110,0.5)";
  c.stroke();
}

function drawBirds(c: CanvasRenderingContext2D, state: ClayState, still: boolean, ahead: number): void {
  const birds = state.birds;
  if (!birds || !state.birdX || !state.birdY || !state.birdStatus || !state.birdDoneTick) return;
  const tick = state.tick;
  for (let i = 0; i < birds.launch.length; i++) {
    const status = state.birdStatus[i];
    if (status !== CLAY_BIRD_FLYING && status !== CLAY_BIRD_STARTLED) continue;
    // A flying bird is drawn where the next tick judges a tap (see drawClayArt).
    const lead = status === CLAY_BIRD_FLYING && ahead ? 1 : 0;
    const px = (state.birdX[i]! + birds.vx[i]! * lead) / 256;
    const py = (state.birdY[i]! + birds.vy[i]! * lead) / 256;
    const startledAge = status === CLAY_BIRD_STARTLED ? tick - state.birdDoneTick[i]! : -1;
    const period = startledAge >= 0 ? 7 : 14;
    const flap = still ? 0.6 : Math.cos((((tick + i * 7) % period) / period) * TAU);
    if (status === CLAY_BIRD_FLYING) drawBirdZone(c, px, py);
    c.save();
    c.translate(px, py);
    if (birds.side[i] === 1) c.scale(-1, 1);
    drawBird(c, flap);
    if (startledAge >= 0) {
      // Loose feathers drifting out and down.
      const f = Math.max(0, 1 - startledAge / CLAY_BIRD_STARTLED_TICKS);
      const t = still ? 6 : startledAge;
      c.globalAlpha = f;
      for (let n = 0; n < 6; n++) {
        const a = (n * Math.PI) / 3 + 0.4;
        const d = 8 + t * 0.8;
        const fx = Math.cos(a) * d;
        const fy = Math.sin(a) * d + t * 0.35;
        const rot = a + t * 0.15 * (n % 2 ? 1 : -1);
        c.fillStyle = "#F7F7F8";
        c.strokeStyle = "rgba(14,20,32,0.5)";
        c.lineWidth = 0.6;
        c.beginPath();
        c.ellipse(fx, fy, 3, 1.2, rot, 0, TAU);
        c.fill();
        c.stroke();
      }
      c.globalAlpha = 1;
      // The −10 pop exactly as before.
      c.scale(birds.side[i] === 1 ? -1 : 1, 1);
      c.fillStyle = "#FF4D4D";
      c.font = "700 14px 'JetBrains Mono', monospace";
      c.textAlign = "center";
      c.fillText("−10", 0, -16 - startledAge * 0.35);
    }
    c.restore();
  }
}

/* ================================ Draw ================================ */

export function drawClayArt(ctx: CanvasRenderingContext2D, state: ClayState, size: CanvasSize): void {
  const { scaleX, scaleY } = clayView(size);
  const tr = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const devX = tr ? Math.hypot(tr.a, tr.b) || 1 : 1;
  const devY = tr ? Math.hypot(tr.c, tr.d) || 1 : 1;
  const kx = devX * scaleX;
  const ky = devY * scaleY;
  const k = Math.max(1, Math.round(Math.max(kx, ky) * 4) / 4);
  const still = reducedMotion();
  const tick = state.tick;

  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.scale(scaleX, scaleY);

  const bg = scenery(kx, ky);
  if (bg) ctx.drawImage(bg as CanvasImageSource, 0, 0, W, H);
  else {
    ctx.fillStyle = "#3A78AE";
    ctx.fillRect(0, 0, W, H);
  }

  // Drifting clouds (pre-rendered sprites, position from the sim tick).
  for (const lane of CLOUD_LANES) {
    const s = cloudSprite(lane.s, k);
    if (!s) continue;
    const span = W + s.w;
    const x = (((lane.x0 + (still ? 0 : tick * lane.v)) % span) + span) % span - s.w;
    ctx.globalAlpha = lane.a;
    ctx.drawImage(s.canvas as CanvasImageSource, x, lane.y - s.h, s.w, s.h);
  }
  ctx.globalAlpha = 1;

  const ahead = clayGameFor(state.rev).isOver(state) ? 0 : 1;
  drawBirds(ctx, state, still, ahead);

  // Clays are drawn where the next sim tick will judge a tap made now (a tap is applied on
  // the tick after the frame it was made on), each with its shot zone: the sim's hit
  // radius, so the drawn edge is the hit edge.
  for (let i = 0; i < state.status.length; i++) {
    if (state.status[i] !== CLAY_FLYING) continue;
    const gold = state.schedule.kind[i] === CLAY_KIND_GOLD;
    const vy = state.vy[i]! + CLAY_CONFIG.gravity * ahead;
    drawShotZone(ctx, (state.x[i]! + state.schedule.vx[i]! * ahead) / 256, (state.y[i]! + vy * ahead) / 256, gold);
  }
  for (let i = 0; i < state.status.length; i++) {
    const st = state.status[i];
    if (st === CLAY_FLYING) {
      const vy = state.vy[i]! + CLAY_CONFIG.gravity * ahead;
      drawClay(ctx, (state.x[i]! + state.schedule.vx[i]! * ahead) / 256, (state.y[i]! + vy * ahead) / 256, state.schedule.kind[i] === CLAY_KIND_GOLD, i, tick, k, still);
    } else if (st === CLAY_HIT) {
      const age = tick - state.doneTick[i]!;
      if (age >= 0 && age < SHARD_TICKS) drawShatter(ctx, state, i, age, still);
    }
  }

  const shotAge = tick - state.shotTick;
  if (shotAge >= 0 && shotAge < 14 && state.shotHit === 0) drawMissPuff(ctx, state, shotAge, still);
  ctx.restore();
}

/* ======================= End-of-run overlay burst ======================= */

const BURST_CENTRES: readonly (readonly [number, number])[] = [
  [0.24, 0.3], [0.72, 0.22], [0.5, 0.46], [0.28, 0.64], [0.78, 0.58],
];

/**
 * Final burst for a strong run (overlay canvas, CSS px): clays shatter across the sky
 * and their fragments turn into gold sparkle. Main motion 0–900 ms, gone by 1100 ms.
 */
export function drawClayFinalBurst(c: CanvasRenderingContext2D, ms: number, width: number, height: number, reduced: boolean): void {
  const fade = ms < 850 ? 1 : Math.max(0, 1 - (ms - 850) / 250);
  if (fade <= 0) return;
  const scale = Math.min(width / W, height / H) || 1;
  if (reduced) {
    // Still sparkle field with a plain fade in and out.
    const a = Math.sin(Math.PI * Math.min(1, ms / 1100));
    c.fillStyle = "#FFD84A";
    for (let n = 0; n < 26; n++) {
      c.globalAlpha = a * (0.55 + 0.45 * hash(n, 91));
      star(c, hash(n, 92) * width, hash(n, 93) * height * 0.85, (3 + hash(n, 94) * 4) * scale);
    }
    c.globalAlpha = 1;
    return;
  }
  for (let b = 0; b < BURST_CENTRES.length; b++) {
    const start = b * 70;
    const s = (ms - start) / 1000;
    if (s < 0) continue;
    const [fx, fy] = BURST_CENTRES[b]!;
    const cx = fx * width;
    const cy = fy * height;
    // Clay flash at the moment of the shot.
    if (s < 0.16) {
      c.globalAlpha = (1 - s / 0.16) * 0.85 * fade;
      c.fillStyle = "#FFF1DC";
      c.beginPath();
      c.arc(cx, cy, (10 + s * 140) * scale, 0, TAU);
      c.fill();
    }
    const morph = Math.max(0, Math.min(1, (s - 0.28) / 0.32));
    for (let n = 0; n < 14; n++) {
      const a = (n / 14) * TAU + hash(b, n) * 0.5;
      const dist = (34 + hash(b, n + 30) * 60) * scale;
      const travel = 1 - Math.pow(1 - Math.min(1, s / 0.75), 3);
      const px = cx + Math.cos(a) * dist * travel;
      const py = cy + Math.sin(a) * dist * travel * 0.85 + 70 * scale * s * s * (1 - morph * 0.85);
      if (morph < 1) {
        const size = (3 + hash(b, n + 50) * 3) * scale;
        const rot = a + s * 9 * (n % 2 ? 1 : -1);
        const cr = Math.cos(rot);
        const sr = Math.sin(rot);
        c.globalAlpha = (1 - morph) * fade;
        c.fillStyle = n % 3 === 0 ? "#A9481A" : morph > 0.4 ? "#F5B82E" : "#E8762C";
        c.beginPath();
        c.moveTo(px + cr * size, py + sr * size);
        c.lineTo(px - sr * size * 0.6 - cr * size * 0.4, py + cr * size * 0.6 - sr * size * 0.4);
        c.lineTo(px + sr * size * 0.5 - cr * size * 0.7, py - cr * size * 0.5 - sr * size * 0.7);
        c.closePath();
        c.fill();
      }
      if (morph > 0) {
        const tw = 0.6 + 0.4 * Math.sin(ms / 55 + n * 1.7 + b);
        c.globalAlpha = morph * fade * tw;
        c.fillStyle = n % 4 === 0 ? "#FFF6CF" : "#FFD84A";
        star(c, px, py, (2.5 + 3.5 * tw) * scale);
      }
    }
  }
  // Gold sparkle settling across the whole sky.
  if (ms > 380) {
    for (let n = 0; n < 30; n++) {
      const appear = 380 + hash(n, 81) * 380;
      if (ms < appear) continue;
      const life = Math.min(1, (ms - appear) / 160);
      const tw = 0.5 + 0.5 * Math.sin(ms / 70 + n * 2.1);
      c.globalAlpha = life * fade * (0.45 + 0.55 * tw);
      c.fillStyle = n % 3 === 0 ? "#FFF6CF" : "#FFD84A";
      star(c, hash(n, 82) * width, hash(n, 83) * height * 0.86, (2 + 4 * tw) * scale);
    }
  }
  c.globalAlpha = 1;
}
