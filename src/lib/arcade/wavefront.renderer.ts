import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { wavefrontFxFor } from "./arcadeFxGames.renderer";
/**
 * Wavefront art pass. Render only: reads WavState and never mutates it. Hulls
 * fill each shape's 28 px hit cell, armour fills its block, the saucer stays
 * inside its hit box and the fighter inside the ship's 40 x 24 box.
 */
import type { CanvasSize } from "./engine";
import {
  drawStars,
  wavefrontGame,
  wavefrontGameFor,
  wavDiverCentre,
  wavShapeBox,
  WAV_BOSS_H,
  WAV_BOSS_HP,
  WAV_BOSS_W,
  WAV_BOSS_Y,
  WAV_BREATHER_TICKS,
  WAV_REV,
  WAV_REV_BAND,
  WAV_REV_SHAPES,
  WAV_REV_TUNEC,
  wavWaves,
  WAV_V2_WAVES,
  WAV_ARMOUR_CODE,
  WAV_BOLT_H,
  WAV_BOLT_W,
  WAV_CELL,
  WAV_COLOURS,
  WAV_COLS,
  wavDragZoneTop,
  WAV_DROP_R,
  WAV_FIRE_EVERY,
  WAV_GOLD,
  WAV_LIVES,
  WAV_PURPLE,
  WAV_RED,
  WAV_SAUCER_R,
  WAV_SHIP_H,
  WAV_SHIP_W,
  wavShipY,
  wavWorldH,
  WAV_REV_TALL,
  WAV_REV_TARGET, WAV_REV_STRICT, WAV_REV_EXPAND, WAV_REV_PHONE, WAV_REV_STD,
  wavBossW,
  wavCannonX,
  wavCoreOpen,
  wavStreakMult,
  WAV_DROP_SHIELD,
  WAV_DROP_SPREAD,
  WAV_X_CANNON_HP,
  WAV_X_CANNON_W,
  WAV_X_CORE_W,
  WAV_X_SHIELD_TICKS,
  WAV_WORLD_W,
  type WavArmour,
  type WavState,
} from "./wavefront";
import { artHash, reducedMotion } from "./art.renderer";
import { arcadeReducedEffects } from "../fx/lowEnd";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";

/* Mirrors of private sim constants, used only to place art on the same geometry. */
const FP = 256;
const PITCH_X = 44;
const PITCH_Y = 36;
const SAUCER_Y = 62;

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/*
 * Enemy ships (3 Nov 2026, display only, every revision; Joe's mockups "Wavefront ships: A + B combined"): gunmetal
 * steel hulls, magenta neon edge lights, orange furnace seams, side cannons and fire exhaust with a blue-hot core,
 * the sleek darts and fighters of direction A with the heavier, blockier warships of direction B. Every hull stays in
 * its 28 px hit cell (x, y, s × s, nose down at the player): the exhaust burns in the cell's top fifth, the hull below
 * it, so what is drawn is what collides; the hit boxes are unchanged, so no stamp.
 *   kind 0 → Dart: a sleek arrowhead scout, swept wings, magenta edges, a cyan cockpit;
 *   kind 1 → Raptor: a fighter, a narrow body on broad wings with magenta wingtip cannons, orange seams;
 *   kind 2 → Bulwark: a blocky heavy, a furnace grid of orange seams, side cannons and a glowing furnace core.
 * A ship's colour picks its steel (WAV_COLOURS[0] light gunmetal, [1] mid, [2] dark); a few ships in each wave are
 * tinted maroon, navy or dark red (wavHullTint, fixed by cell and wave).
 */
interface HullFinish {
  hi: string;
  mid: string;
  lo: string;
  edge: string;
}
const FINISHES: readonly HullFinish[] = [
  { hi: "#8A93A3", mid: "#4C5361", lo: "#1C2027", edge: "#C9D0DC" },
  { hi: "#6D7584", mid: "#3A404C", lo: "#15181E", edge: "#AEB6C3" },
  { hi: "#555C69", mid: "#2A2F38", lo: "#0C0E12", edge: "#9AA2AF" },
];
const STEEL_DARK = "#14171C";
/** The neon edge lights, the furnace seams and the exhaust. */
export const WAV_NEON = "#FF3FD0";
export const WAV_FURNACE = "#FF8A2A";
const FURNACE_HOT = "#FFC46B";
const COCKPIT = "#5FF2FF";

/** Phone notes (28 Oct 2026, display only): a few ships tinted dark maroon, navy or dark red (now on gunmetal). */
const TINT_FINISHES: Readonly<Record<string, HullFinish>> = {
  maroon: { hi: "#8E5662", mid: "#4E2530", lo: "#1E0B10", edge: "#D9AEB8" },
  navy: { hi: "#5B6C93", mid: "#28345A", lo: "#0B1028", edge: "#B4C2E6" },
  darkred: { hi: "#9E554D", mid: "#5E211C", lo: "#260907", edge: "#E6B2AA" },
};
const TINTS = ["maroon", "navy", "darkred"] as const;
/** The coloured finish for the ship in this cell on this wave, or null (its gunmetal finish): 3 in 16. */
export function wavHullTint(cell: number, wave: number): (typeof TINTS)[number] | null {
  let h = Math.imul(cell + 1, 0x9e3779b1) ^ Math.imul(wave + 7, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = (h ^ (h >>> 13)) >>> 0;
  const k = h % 16;
  return k < TINTS.length ? TINTS[k]! : null;
}

function finishFor(colour: string): HullFinish {
  const tinted = TINT_FINISHES[colour];
  if (tinted) return tinted;
  const k = WAV_COLOURS.indexOf(colour);
  return FINISHES[k < 0 ? 0 : k]!;
}

/** The exhaust's top, as a share of the cell: the hull starts below it. */
const EXHAUST_V = 0.2;

/** The hull's outline for each kind inside the cell box (x, y, s × s) below the exhaust band; nose points down. */
function hullPath(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, s: number): void {
  const P = (u: number, v: number) => ctx.lineTo(x + u * s, y + v * s);
  ctx.beginPath();
  if (kind === 0) {
    // Dart: an arrowhead, the nose at the bottom, wings swept back to the corners.
    ctx.moveTo(x + s * 0.5, y + s);
    P(0.6, 0.62); P(0.98, 0.4); P(0.92, 0.32); P(0.64, 0.38); P(0.6, 0.2); P(0.4, 0.2); P(0.36, 0.38); P(0.08, 0.32); P(0.02, 0.4); P(0.4, 0.62);
    ctx.closePath();
  } else if (kind === 1) {
    // Raptor: a narrow body on broad straight wings, cannons at the tips (painted separately), a short nose.
    ctx.moveTo(x + s * 0.5, y + s * 0.96);
    P(0.62, 0.74); P(0.62, 0.62); P(0.92, 0.56); P(0.92, 0.4); P(0.62, 0.36); P(0.6, 0.2); P(0.4, 0.2); P(0.38, 0.36); P(0.08, 0.4); P(0.08, 0.56); P(0.38, 0.62); P(0.38, 0.74);
    ctx.closePath();
  } else {
    // Bulwark: a heavy, blocky warship, set in from the sides (its cannons take the edges).
    ctx.moveTo(x + s * 0.24, y + s * 0.2);
    P(0.76, 0.2); P(0.88, 0.32); P(0.88, 0.78); P(0.74, 0.96); P(0.26, 0.96); P(0.12, 0.78); P(0.12, 0.32);
    ctx.closePath();
  }
}

/** A neon edge: a soft magenta glow, then a bright line. */
function neonLine(ctx: CanvasRenderingContext2D, width: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = 0.35 * alpha;
  ctx.strokeStyle = WAV_NEON;
  ctx.lineWidth = width * 3;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/** An orange furnace seam: a hot core line in a darker glow. */
function seam(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], width: number): void {
  ctx.beginPath();
  pts.forEach(([px, py], k) => (k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.strokeStyle = "rgba(255,110,30,0.45)";
  ctx.lineWidth = width * 2.4;
  ctx.stroke();
  ctx.strokeStyle = WAV_FURNACE;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** A glowing core (cockpit or furnace): a halo, a bright disc and a white-hot centre. */
function glowCore(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, colour: string): void {
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry) * 1.8);
  halo.addColorStop(0, `${colour}AA`);
  halo.addColorStop(1, `${colour}00`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 1.8, ry * 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(cx, cy - ry * 0.15, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** A dark steel cannon barrel pointing down (the muzzle at `y1`), with a lit band and a neon tip. */
function cannon(ctx: CanvasRenderingContext2D, f: HullFinish, cx: number, y0: number, y1: number, w: number): void {
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, f.hi);
  g.addColorStop(0.5, f.mid);
  g.addColorStop(1, STEEL_DARK);
  ctx.fillStyle = g;
  ctx.fillRect(cx - w / 2, y0, w, y1 - y0);
  ctx.fillStyle = STEEL_DARK;
  ctx.fillRect(cx - w * 0.3, y1 - w * 0.6, w * 0.6, w * 0.6);
  ctx.fillStyle = WAV_NEON;
  ctx.fillRect(cx - w / 2, y1 - w * 1.1, w, Math.max(0.6, w * 0.22));
}

/** The static hull (cached): gunmetal plating, furnace seams, neon edges, cannons and a glowing core. */
function paintHull(ctx: CanvasRenderingContext2D, kind: number, colour: string, x: number, y: number, s: number): void {
  const f = finishFor(colour);
  const P = (u: number, v: number) => [x + u * s, y + v * s] as const;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, s, s);
  ctx.clip();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Under the hull: the engine nozzles at the rear (the flames are live, drawHull) and the cannons.
  const nozzles = kind === 2 ? [0.32, 0.5, 0.68] : [0.42, 0.58];
  ctx.fillStyle = STEEL_DARK;
  for (const u of nozzles) ctx.fillRect(x + (u - 0.06) * s, y + s * (EXHAUST_V - 0.02), s * 0.12, s * 0.08);
  if (kind === 1) for (const u of [0.08, 0.92]) cannon(ctx, f, x + u * s, y + s * 0.34, y + s * 0.8, s * 0.1);
  if (kind === 2) for (const u of [0.07, 0.93]) cannon(ctx, f, x + u * s, y + s * 0.36, y + s * 0.92, s * 0.12);
  // Gunmetal plating lit from the upper left.
  const body = ctx.createLinearGradient(x, y + s * EXHAUST_V, x + s * 0.8, y + s);
  body.addColorStop(0, f.hi);
  body.addColorStop(0.4, f.mid);
  body.addColorStop(0.55, f.hi);
  body.addColorStop(0.7, f.mid);
  body.addColorStop(1, f.lo);
  hullPath(ctx, kind, x, y, s);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Dark panel lines, then the furnace seams.
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  if (kind === 0) {
    ctx.moveTo(...P(0.5, 0.22)); ctx.lineTo(...P(0.5, 0.94));
  } else if (kind === 1) {
    ctx.moveTo(...P(0.38, 0.48)); ctx.lineTo(...P(0.1, 0.48));
    ctx.moveTo(...P(0.62, 0.48)); ctx.lineTo(...P(0.9, 0.48));
  } else {
    for (const v of [0.44, 0.7]) { ctx.moveTo(...P(0.12, v)); ctx.lineTo(...P(0.88, v)); }
  }
  ctx.stroke();
  const sw = Math.max(0.5, s * 0.03);
  if (kind === 0) {
    seam(ctx, [P(0.12, 0.36), P(0.36, 0.44)], sw);
    seam(ctx, [P(0.88, 0.36), P(0.64, 0.44)], sw);
  } else if (kind === 1) {
    seam(ctx, [P(0.14, 0.44), P(0.38, 0.44)], sw);
    seam(ctx, [P(0.86, 0.44), P(0.62, 0.44)], sw);
    seam(ctx, [P(0.44, 0.26), P(0.44, 0.34)], sw);
    seam(ctx, [P(0.56, 0.26), P(0.56, 0.34)], sw);
  } else {
    // The furnace grid: two decks and three bays.
    seam(ctx, [P(0.16, 0.38), P(0.84, 0.38)], sw);
    seam(ctx, [P(0.16, 0.62), P(0.84, 0.62)], sw);
    seam(ctx, [P(0.36, 0.24), P(0.36, 0.9)], sw);
    seam(ctx, [P(0.64, 0.24), P(0.64, 0.9)], sw);
  }
  // A lit rim at the upper left, shadow at the lower right.
  const rim = ctx.createLinearGradient(x, y, x + s, y + s);
  rim.addColorStop(0, "rgba(255,255,255,0.45)");
  rim.addColorStop(0.5, "rgba(255,255,255,0)");
  rim.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.4;
  hullPath(ctx, kind, x, y, s);
  ctx.stroke();
  ctx.restore();
  // A dark keyline, then the magenta neon on the leading edges.
  hullPath(ctx, kind, x, y, s);
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = WAV_NEON;
  ctx.beginPath();
  if (kind === 0) {
    ctx.moveTo(...P(0.03, 0.39)); ctx.lineTo(...P(0.4, 0.61)); ctx.lineTo(...P(0.5, 0.97)); ctx.lineTo(...P(0.6, 0.61)); ctx.lineTo(...P(0.97, 0.39));
  } else if (kind === 1) {
    ctx.moveTo(...P(0.09, 0.55)); ctx.lineTo(...P(0.38, 0.61)); ctx.lineTo(...P(0.38, 0.74)); ctx.lineTo(...P(0.5, 0.94)); ctx.lineTo(...P(0.62, 0.74)); ctx.lineTo(...P(0.62, 0.61)); ctx.lineTo(...P(0.91, 0.55));
  } else {
    ctx.moveTo(...P(0.13, 0.78)); ctx.lineTo(...P(0.26, 0.95)); ctx.lineTo(...P(0.74, 0.95)); ctx.lineTo(...P(0.87, 0.78));
  }
  neonLine(ctx, Math.max(0.6, s * 0.035));
  // The core: a cyan cockpit on the light ships, the orange furnace on the heavy.
  if (kind === 0) glowCore(ctx, x + s * 0.5, y + s * 0.62, s * 0.055, s * 0.11, COCKPIT);
  else if (kind === 1) glowCore(ctx, x + s * 0.5, y + s * 0.56, s * 0.06, s * 0.1, COCKPIT);
  else {
    ctx.fillStyle = STEEL_DARK;
    ctx.beginPath();
    ctx.arc(x + s * 0.5, y + s * 0.78, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
    glowCore(ctx, x + s * 0.5, y + s * 0.78, s * 0.08, s * 0.08, FURNACE_HOT);
  }
  ctx.restore();
}

/**
 * Fire exhaust with a blue-hot core: an orange-red flame licking up from (cx, top) with a pale blue core, flickering
 * (still under reduced motion). `len` is the flame's length upward; nothing is drawn above `top - len`.
 */
export function drawExhaust(ctx: CanvasRenderingContext2D, cx: number, top: number, w: number, len: number, t: number, still: boolean, seed = 0): void {
  const flick = still ? 0.9 : 0.78 + 0.22 * Math.sin(t * 23 + seed * 1.7) * Math.sin(t * 11 + seed);
  const l = len * flick;
  const outer = ctx.createLinearGradient(0, top, 0, top - l);
  outer.addColorStop(0, "rgba(255,150,50,0.95)");
  outer.addColorStop(0.55, "rgba(255,80,30,0.75)");
  outer.addColorStop(1, "rgba(255,40,20,0)");
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, top);
  ctx.quadraticCurveTo(cx - w * 0.45, top - l * 0.5, cx, top - l);
  ctx.quadraticCurveTo(cx + w * 0.45, top - l * 0.5, cx + w / 2, top);
  ctx.closePath();
  ctx.fill();
  const core = ctx.createLinearGradient(0, top, 0, top - l * 0.6);
  core.addColorStop(0, "rgba(235,250,255,1)");
  core.addColorStop(0.4, "rgba(120,200,255,0.9)");
  core.addColorStop(1, "rgba(80,150,255,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.22, top);
  ctx.quadraticCurveTo(cx - w * 0.18, top - l * 0.3, cx, top - l * 0.6);
  ctx.quadraticCurveTo(cx + w * 0.18, top - l * 0.3, cx + w * 0.22, top);
  ctx.closePath();
  ctx.fill();
}

const HULL_SCALE = 3;
const hullSprites = new Map<string, ArtCanvas | null>();

/** One enemy hull filling the cell box (x, y, s × s): a cached sprite plus the live exhaust in the cell's top fifth. */
export function drawHull(ctx: CanvasRenderingContext2D, kind: number, colour: string, x: number, y: number, s: number, t: number): void {
  const key = `s6:${kind}:${colour}:${s}`;
  let sprite = hullSprites.get(key);
  if (sprite === undefined) {
    const canvas = artCanvas(Math.ceil(s * HULL_SCALE), Math.ceil(s * HULL_SCALE));
    const c = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
    if (canvas && c) {
      c.scale(HULL_SCALE, HULL_SCALE);
      paintHull(c, kind, colour, 0, 0, s);
    }
    sprite = canvas && c ? canvas : null;
    hullSprites.set(key, sprite);
  }
  // The exhaust first, behind the nozzles: inside the cell (its top fifth).
  const still = reducedMotion();
  const nozzles = kind === 2 ? [0.32, 0.5, 0.68] : [0.42, 0.58];
  nozzles.forEach((u, k) => drawExhaust(ctx, x + s * u, y + s * (EXHAUST_V + 0.02), s * (kind === 2 ? 0.13 : 0.12), s * (EXHAUST_V + 0.01), t, still, x * 0.07 + k));
  if (sprite) ctx.drawImage(sprite as CanvasImageSource, x, y, s, s);
  else paintHull(ctx, kind, colour, x, y, s);
}

/**
 * Polish G: deep space painted once per device scale: a violet-to-black sky
 * (ending in the arena fill colour), two soft nebulae, three sizes of stars
 * with a few cross glints, and a dim ringed planet low in a corner.
 */
function paintSpace(c: CanvasRenderingContext2D, H: number): void {
  const W = WAV_WORLD_W;
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0D0B22");
  sky.addColorStop(0.6, "#08081A");
  sky.addColorStop(1, "#07070C");
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  // Polish A4 (25 Oct 2026): a richer blue and purple nebula, each cloud with a brighter heart.
  for (const [nx, ny, nr, colour] of [
    [300, 150, 220, "rgba(150,70,220,0.2)"],
    [70, 380, 200, "rgba(50,100,235,0.18)"],
    [230, 290, 140, "rgba(110,80,240,0.12)"],
    [350, 480, 170, "rgba(80,60,210,0.12)"],
    [110, 110, 120, "rgba(180,80,230,0.1)"],
    [220, 260, 110, "rgba(220,90,170,0.05)"],
  ] as const) {
    const g = c.createRadialGradient(nx, ny, 0, nx, ny, nr);
    g.addColorStop(0, colour);
    g.addColorStop(0.45, colour.replace(/[\d.]+\)$/, (a) => `${(Number.parseFloat(a) * 0.45).toFixed(3)})`));
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
  }
  let v = 91;
  const next = () => {
    v = (Math.imul(v, 1103515245) + 12345) | 0;
    return ((v >>> 8) % 10000) / 10000;
  };
  for (let i = 0; i < 150; i++) {
    const x = next() * W, y = next() * H, k = next();
    c.fillStyle = k > 0.9 ? "rgba(255,240,220,0.9)" : k > 0.6 ? "rgba(200,220,255,0.55)" : "rgba(255,255,255,0.28)";
    const sz = k > 0.9 ? 2 : k > 0.6 ? 1.4 : 1;
    c.fillRect(x, y, sz, sz);
  }
  c.strokeStyle = "rgba(220,235,255,0.22)";
  c.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    const x = next() * W, y = next() * H * 0.8, r = 2 + next() * 1.5;
    c.beginPath();
    c.moveTo(x - r, y);
    c.lineTo(x + r, y);
    c.moveTo(x, y - r);
    c.lineTo(x, y + r);
    c.stroke();
  }
  // A dim ringed planet low on the left, behind everything.
  const px = 34, py = 470 + (H - 620), pr = 26;
  const planet = c.createRadialGradient(px - 9, py - 9, 2, px, py, pr);
  planet.addColorStop(0, "#3A3060");
  planet.addColorStop(1, "#120E24");
  c.fillStyle = planet;
  c.beginPath();
  c.arc(px, py, pr, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(180,160,255,0.16)";
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(px, py, pr * 1.7, pr * 0.42, -0.35, 0, Math.PI * 2);
  c.stroke();
}

const spaceLayers = new WeakMap<CanvasRenderingContext2D, { key: string; layer: ArtCanvas | null }>();
function drawSpace(ctx: CanvasRenderingContext2D, t: number, WAV_WORLD_H: number): void {
  const tr = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const scale = Math.min(3, Math.max(1, tr ? Math.hypot(tr.a, tr.b) : 1));
  // wavRev 6: the world height is part of the key (the taller world has its own layer).
  const key = `${scale.toFixed(3)}:${WAV_WORLD_H}`;
  let cached = spaceLayers.get(ctx);
  if (!cached || cached.key !== key) {
    const layer = artCanvas(Math.ceil(WAV_WORLD_W * scale), Math.ceil(WAV_WORLD_H * scale));
    const c = layer && (artContext(layer) as CanvasRenderingContext2D | null);
    if (layer && c) {
      c.scale(scale, scale);
      paintSpace(c, WAV_WORLD_H);
    }
    spaceLayers.set(ctx, (cached = { key, layer: layer && c ? layer : null }));
  }
  if (cached.layer) ctx.drawImage(cached.layer as CanvasImageSource, 0, 0, WAV_WORLD_W, WAV_WORLD_H);
  else drawStars(ctx, WAV_WORLD_W, WAV_WORLD_H, 91);
  // A few stars twinkle (presentation clock; still under reduced motion).
  for (let k = 0; k < 8; k++) {
    const h = artHash(k, 707);
    const a = 0.25 + 0.55 * Math.max(0, Math.sin(t * (1.3 + (h % 7) * 0.2) + k));
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    ctx.fillRect(h % WAV_WORLD_W, (h >>> 10) % (WAV_WORLD_H - 120), 1.5, 1.5);
  }
}

function drawArmourHull(ctx: CanvasRenderingContext2D, state: WavState, a: WavArmour): void {
  const box = wavShapeBox(state, a.row * WAV_COLS + a.col);
  const w = (a.w - 1) * PITCH_X + WAV_CELL;
  const h = (a.h - 1) * PITCH_Y + WAV_CELL;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, w, h);
  ctx.clip();
  // 3 Nov 2026 (display only): a gunmetal warship with fire exhaust at the rear (inside the box's top), magenta neon
  // on its edges; missing plates show the furnace glowing through the frame.
  const cx = box.x + w / 2;
  const still = reducedMotion();
  const tt = state.tick / 60;
  for (const u of [-0.07, 0.07]) drawExhaust(ctx, cx + u * w, box.y + h * 0.16, Math.min(8, w * 0.08), h * 0.16, tt, still, u * 10);
  const silhouette = () => {
    ctx.beginPath();
    ctx.moveTo(cx, box.y + h);
    ctx.lineTo(cx + w * 0.18, box.y + h * 0.72);
    ctx.lineTo(box.x + w, box.y + h * 0.85);
    ctx.lineTo(box.x + w, box.y + h * 0.3);
    ctx.lineTo(cx + w * 0.2, box.y + h * 0.4);
    ctx.lineTo(cx + w * 0.13, box.y + h * 0.14);
    ctx.lineTo(cx - w * 0.13, box.y + h * 0.14);
    ctx.lineTo(cx - w * 0.2, box.y + h * 0.4);
    ctx.lineTo(box.x, box.y + h * 0.3);
    ctx.lineTo(box.x, box.y + h * 0.85);
    ctx.lineTo(cx - w * 0.18, box.y + h * 0.72);
    ctx.closePath();
  };
  silhouette();
  ctx.save();
  ctx.clip();
  const frame = ctx.createLinearGradient(box.x, box.y, box.x + w * 0.6, box.y + h);
  frame.addColorStop(0, "#3A404C");
  frame.addColorStop(1, "#14171C");
  ctx.fillStyle = frame;
  ctx.fillRect(box.x, box.y, w, h);
  // One plate per hit point; each hit removes the next plate in a fixed order.
  const cols = Math.ceil(a.maxHp / 2);
  const pw = (w - 6) / cols;
  const ph = (h - 6) / 2;
  const order = Array.from({ length: a.maxHp }, (_, k) => k).sort((p, q) => artHash(p, a.maxHp) - artHash(q, a.maxHp));
  const gone = new Set(order.slice(0, a.maxHp - a.hp));
  for (let k = 0; k < a.maxHp; k++) {
    const px = box.x + 3 + (k % cols) * pw;
    const py = box.y + 3 + Math.trunc(k / cols) * ph;
    if (gone.has(k)) {
      // The furnace glowing through the exposed frame, with a crack.
      ctx.fillStyle = "rgba(255,120,40,0.28)";
      ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
      ctx.strokeStyle = WAV_FURNACE;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.2, py + ph * 0.2);
      ctx.lineTo(px + pw * 0.5, py + ph * 0.55);
      ctx.lineTo(px + pw * 0.4, py + ph * 0.8);
      ctx.moveTo(px + pw * 0.5, py + ph * 0.55);
      ctx.lineTo(px + pw * 0.8, py + ph * 0.6);
      ctx.stroke();
      continue;
    }
    // A gunmetal plate, its seams glowing orange.
    const g = ctx.createLinearGradient(px, py, px + pw * 0.4, py + ph);
    g.addColorStop(0, "#8A93A3");
    g.addColorStop(0.5, "#545B69");
    g.addColorStop(1, "#262A33");
    ctx.fillStyle = g;
    ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
    ctx.strokeStyle = "rgba(255,138,42,0.85)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(px + 2.5, py + 2.5, 1.5, 1.5);
    ctx.fillRect(px + pw - 4, py + 2.5, 1.5, 1.5);
  }
  ctx.restore();
  silhouette();
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = WAV_NEON;
  neonLine(ctx, 1);
  ctx.restore();
}

/** wavRev 2 boss: a mothership filling its 128 × 48 hit box, health bar just above it. */
function drawBoss(ctx: CanvasRenderingContext2D, state: WavState, t: number, lastHit: number): void {
  const boss = state.boss;
  if (!boss || boss.hp <= 0) return;
  const x = boss.x;
  const y = WAV_BOSS_Y;
  // wavRev 10: the gunship is narrower (and crimson); the mothership keeps its 128 px.
  const w = state.x10 ? wavBossW(boss) : WAV_BOSS_W;
  const h = WAV_BOSS_H;
  const cx = x + w / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // 3 Nov 2026 (display only, Joe's mockups' Leviathan): a broad gunmetal warship, a row of fire exhausts along its
  // rear (inside the box's top), an orange furnace grid, magenta neon on its lower edges, dark gun pods and a glowing
  // weak core; the gunship (wavRev 10) a lighter steel.
  const still = reducedMotion();
  const gunship = Boolean(boss.mid);
  const top = y + h * 0.2;
  const flames = Math.max(3, Math.round(w / 26));
  for (let k = 0; k < flames; k++) drawExhaust(ctx, x + (w * (k + 0.5)) / flames, top + 1, Math.min(9, w / flames / 2.2), h * 0.2, t, still, k * 3.1);
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(x, top + h * 0.16);
    ctx.lineTo(x + w * 0.12, top);
    ctx.lineTo(x + w * 0.88, top);
    ctx.lineTo(x + w, top + h * 0.16);
    ctx.lineTo(x + w, y + h * 0.62);
    ctx.lineTo(cx + w * 0.22, y + h * 0.8);
    ctx.lineTo(cx + w * 0.1, y + h);
    ctx.lineTo(cx - w * 0.1, y + h);
    ctx.lineTo(cx - w * 0.22, y + h * 0.8);
    ctx.lineTo(x, y + h * 0.62);
    ctx.closePath();
  };
  const hull = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  hull.addColorStop(0, gunship ? "#7E8797" : "#646C7A");
  hull.addColorStop(0.45, gunship ? "#454C59" : "#363C47");
  hull.addColorStop(0.6, gunship ? "#5A6270" : "#4A515E");
  hull.addColorStop(1, "#14171C");
  outline();
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // The furnace grid: two decks, bays across the wings.
  const seamW = 1.1;
  seam(ctx, [[x + 4, top + h * 0.22], [x + w - 4, top + h * 0.22]], seamW);
  seam(ctx, [[x + 2, y + h * 0.56], [x + w - 2, y + h * 0.56]], seamW);
  for (const u of [0.24, 0.38, 0.62, 0.76]) seam(ctx, [[x + w * u, top + 2], [x + w * u, y + h * 0.56]], seamW);
  ctx.restore();
  outline();
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Neon on the lower edges.
  ctx.strokeStyle = WAV_NEON;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + h * 0.62);
  ctx.lineTo(cx - w * 0.22, y + h * 0.8);
  ctx.lineTo(cx - w * 0.1, y + h - 1);
  ctx.lineTo(cx + w * 0.1, y + h - 1);
  ctx.lineTo(cx + w * 0.22, y + h * 0.8);
  ctx.lineTo(x + w - 1, y + h * 0.62);
  neonLine(ctx, 1.2);
  // Gun pods (where the pattern's bolts leave) and the weak core.
  ctx.fillStyle = STEEL_DARK;
  for (const gx of [8, w / 2, w - 8]) ctx.fillRect(x + gx - 4, y + h * 0.62 - 2, 8, 8);
  if (state.x10) drawWeakPoints(ctx, state, boss, x, y, w, h, t);
  else {
    // The weak core: a magenta-white heart in an orange halo, pulsing.
    const pulse = still ? 0.9 : 0.6 + 0.4 * Math.sin(t * 6);
    const cy = y + h * 0.45;
    const halo = ctx.createRadialGradient(cx, cy, 1, cx, cy, 14);
    halo.addColorStop(0, `rgba(255,236,250,${pulse})`);
    halo.addColorStop(0.35, `rgba(255,63,208,${0.85 * pulse})`);
    halo.addColorStop(0.7, `rgba(255,138,42,${0.45 * pulse})`);
    halo.addColorStop(1, "rgba(255,138,42,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = STEEL_DARK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  // A white flash on the frame a hit lands.
  const hitAge = state.tick - lastHit;
  if (hitAge >= 0 && hitAge < 4) {
    ctx.globalAlpha = 0.5 * (1 - hitAge / 4);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // Health bar: one segment per hit left.
  const barY = y - 9;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x, barY, w, 5);
  const maxHp = boss.maxHp ?? WAV_BOSS_HP;
  ctx.fillStyle = boss.hp * 3 > maxHp ? "#E6E9EE" : WAV_RED;
  ctx.fillRect(x, barY, (w * boss.hp) / maxHp, 5);
}

/**
 * wavRev 10 weak points, inside the boss's box: each cannon still firing glows amber in its 16 px column
 * (one pip per hit left; destroyed, a dark smoking stub), and the core is an iris that opens (bright,
 * pulsing pink-white, the hit box's 24 px) for half of each cycle and closes behind grey shutters.
 */
function drawWeakPoints(ctx: CanvasRenderingContext2D, state: WavState, boss: NonNullable<WavState["boss"]>, x: number, y: number, w: number, h: number, t: number): void {
  const still = reducedMotion();
  const light = !arcadeReducedEffects();
  const guns = boss.guns ?? [0, 0];
  for (const side of [0, 1]) {
    const gx = x + wavCannonX(boss, side);
    const half = WAV_X_CANNON_W / 2;
    if (guns[side]! > 0) {
      if (light) {
        const glow = ctx.createLinearGradient(0, y + h * 0.3, 0, y + h);
        glow.addColorStop(0, "rgba(255,180,60,0)");
        glow.addColorStop(1, `rgba(255,180,60,${still ? 0.45 : 0.35 + 0.15 * Math.sin(t * 5 + side)})`);
        ctx.fillStyle = glow;
        ctx.fillRect(gx - half, y + h * 0.3, WAV_X_CANNON_W, h * 0.7);
      }
      ctx.fillStyle = "#2A1206";
      ctx.fillRect(gx - 4, y + h * 0.62 - 2, 8, 10);
      ctx.fillStyle = "#FFB43A";
      ctx.fillRect(gx - 3, y + h * 0.62 + 6, 6, 2);
      // One pip per hit the cannon can still take.
      for (let k = 0; k < WAV_X_CANNON_HP; k++) {
        ctx.fillStyle = k < guns[side]! ? "#FFD27A" : "rgba(255,255,255,0.15)";
        ctx.fillRect(gx - half + 1 + k * 3.6, y + h - 5, 2.4, 2.4);
      }
    } else {
      ctx.fillStyle = "#120808";
      ctx.fillRect(gx - 5, y + h * 0.6, 10, h * 0.4);
      ctx.fillStyle = "rgba(160,160,170,0.35)";
      const puff = still ? 0 : (t * 14) % 10;
      ctx.beginPath();
      ctx.arc(gx, y + h * 0.6 - puff * 0.4, 3 + puff * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const cx = x + w / 2;
  const cy = y + h * 0.45;
  const r = WAV_X_CORE_W / 2;
  const open = wavCoreOpen(boss, state.tick);
  if (open) {
    const pulse = still ? 1 : 0.75 + 0.25 * Math.sin(t * 9);
    if (light) {
      const bloom = ctx.createRadialGradient(cx, cy, 2, cx, cy, r + 4);
      bloom.addColorStop(0, `rgba(255,255,255,${0.95 * pulse})`);
      bloom.addColorStop(0.5, `rgba(255,63,208,${0.8 * pulse})`);
      bloom.addColorStop(1, "rgba(255,138,42,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(cx - r - 4, cy - r - 4, 2 * r + 8, 2 * r + 8);
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FF9BE8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#2E333D";
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8C93A0";
    ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1));
      ctx.stroke();
    }
  }
}

/** wavRev 10: a power-up's diamond in its kind's colour, with its glyph (the hit box's 8 px radius). */
function drawDrop(ctx: CanvasRenderingContext2D, dx: number, dy: number, kind: number, t: number): void {
  const colour = kind === WAV_DROP_SPREAD ? "#7CF29A" : kind === WAV_DROP_SHIELD ? "#4FD8FF" : WAV_PURPLE;
  const R = WAV_DROP_R;
  if (!arcadeReducedEffects()) {
    const glow = ctx.createRadialGradient(dx, dy, 1, dx, dy, R + 2);
    glow.addColorStop(0, `${colour}AA`);
    glow.addColorStop(1, `${colour}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(dx - R - 2, dy - R - 2, 2 * R + 4, 2 * R + 4);
  }
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(dx, dy - R);
  ctx.lineTo(dx + R, dy);
  ctx.lineTo(dx, dy + R);
  ctx.lineTo(dx - R, dy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#0B0B14";
  ctx.strokeStyle = "#0B0B14";
  if (kind === WAV_DROP_SPREAD) {
    // Three prongs fanning up.
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const dir of [-1, 0, 1]) {
      ctx.moveTo(dx, dy + 3);
      ctx.lineTo(dx + dir * 3.5, dy - 3.5);
    }
    ctx.stroke();
  } else if (kind === WAV_DROP_SHIELD) {
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#F7F7F8";
    ctx.fillRect(dx - 1, dy - 5, 2, 10);
  }
  void t;
}

/**
 * wavRev 11: a carrier's mark, inside its 28 px cell: a small diamond in its power-up's colour (green spread, cyan
 * shield) on the hull's centre, with a soft pulsing halo, so a player can pick the carriers out of the formation.
 */
function drawCarrierMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, kind: number, t: number): void {
  const colour = kind === WAV_DROP_SPREAD ? "#7CF29A" : kind === WAV_DROP_SHIELD ? "#4FD8FF" : WAV_PURPLE;
  const r = 5;
  if (!arcadeReducedEffects()) {
    const pulse = reducedMotion() ? 0.7 : 0.55 + 0.3 * Math.sin(t * 6);
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 11);
    g.addColorStop(0, `${colour}${Math.round(pulse * 200).toString(16).padStart(2, "0")}`);
    g.addColorStop(1, `${colour}00`);
    ctx.fillStyle = g;
    ctx.fillRect(cx - 11, cy - 11, 22, 22);
  }
  ctx.fillStyle = colour;
  ctx.strokeStyle = "#06070A";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** wavRev 10: the shield round the ship (light, not a body): a soft cyan bubble, fading in its last 2 s. */
function drawShield(ctx: CanvasRenderingContext2D, x: number, y: number, left: number, t: number, still: boolean): void {
  const fade = Math.min(1, left / 120);
  const pulse = still ? 1 : 0.85 + 0.15 * Math.sin(t * 4);
  ctx.save();
  ctx.globalAlpha = 0.9 * fade * pulse;
  if (!arcadeReducedEffects()) {
    const g = ctx.createRadialGradient(x, y, WAV_SHIP_W * 0.25, x, y, WAV_SHIP_W * 0.62);
    g.addColorStop(0, "rgba(79,216,255,0)");
    g.addColorStop(0.8, "rgba(79,216,255,0.22)");
    g.addColorStop(1, "rgba(79,216,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, WAV_SHIP_W * 0.62, WAV_SHIP_H * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#8BE7FF";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, WAV_SHIP_W * 0.6, WAV_SHIP_H * 0.9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Per-canvas render memory of the boss's last hit tick (flash only). */
const bossHitMemo = new WeakMap<object, { tick: number; hits: number }>();

export function drawFighter(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, moving: boolean, recoil: number, t: number): void {
  // Art pilot (Space): the ship sprite fills the ship's hit box; code art when absent.
  if (drawArtSprite(ctx, "space", "player", cx - w / 2, cy - h / 2 + recoil, w, h)) return;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, top, w, h);
  ctx.clip();
  if (moving) {
    const flick = 0.75 + 0.25 * Math.sin(t * 30);
    const fire = ctx.createLinearGradient(0, bottom - 4, 0, bottom + 6 * flick);
    fire.addColorStop(0, "rgba(255,230,160,0.95)");
    fire.addColorStop(1, "rgba(255,90,40,0)");
    ctx.fillStyle = fire;
    ctx.beginPath();
    ctx.moveTo(cx - 4, bottom - 4);
    ctx.lineTo(cx, bottom + 6 * flick);
    ctx.lineTo(cx + 4, bottom - 4);
    ctx.fill();
  }
  // Wings to the full 40 px width, nose at the box top.
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, "#FFF3D0");
  g.addColorStop(1, "#E6A830");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx + 5, top + h * 0.4);
  ctx.lineTo(cx + w / 2, bottom - 3);
  ctx.lineTo(cx + w / 2, bottom);
  ctx.lineTo(cx + 6, bottom - 3);
  ctx.lineTo(cx - 6, bottom - 3);
  ctx.lineTo(cx - w / 2, bottom);
  ctx.lineTo(cx - w / 2, bottom - 3);
  ctx.lineTo(cx - 5, top + h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = WAV_GOLD;
  ctx.fillRect(cx - w / 2, bottom - 7, 2.5, 7);
  ctx.fillRect(cx + w / 2 - 2.5, bottom - 7, 2.5, 7);
  ctx.fillStyle = "#4D8CFF";
  ctx.beginPath();
  ctx.ellipse(cx, top + h * 0.45, 2.4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (recoil > 0) {
    ctx.globalAlpha = recoil;
    const flash = ctx.createRadialGradient(cx, top, 0, cx, top, 9);
    flash.addColorStop(0, "rgba(255,255,255,1)");
    flash.addColorStop(1, "rgba(255,210,100,0)");
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(cx, top, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/**
 * All three beam styles stay inside the sim's identical 4 × 12 projectile box; Polish A4 gives each a
 * soft glow in its colour (at most 2 px past the box) and a bright core.
 */
export function drawWavefrontBeam(ctx: CanvasRenderingContext2D, x: number, y: number, kind: "player" | "enemy" | "piercing"): void {
  const piercing = kind === "piercing";
  const w = Math.min(WAV_BOLT_W, piercing ? 3 : 2);
  const h = Math.min(WAV_BOLT_H, piercing ? 12 : 8);
  const colour = piercing ? WAV_PURPLE : kind === "enemy" ? WAV_RED : "#3DDC84";
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x - w / 2 - 2, y - 2, w + 4, h + 4, 3);
  ctx.fill();
  ctx.globalAlpha = 0.45;
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
  ctx.globalAlpha = 1;
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = kind === "enemy" ? "#FFD0C8" : "#F0FFF6";
  ctx.fillRect(x - 0.5, y + 1, 1, h - 2);
  ctx.restore();
}

/**
 * Polish A4: the player ship's engine flame, under its box (exhaust light, not a body): always a small
 * flickering flame, longer while the ship moves.
 */
export function drawShipFlame(ctx: CanvasRenderingContext2D, cx: number, bottom: number, moving: boolean, t: number, still: boolean): void {
  const flick = still ? 1 : 0.75 + 0.25 * Math.sin(t * 30);
  const len = (moving ? 11 : 6) * flick;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#FF8A3D";
  ctx.beginPath();
  ctx.ellipse(cx, bottom + len * 0.4, 5, len * 0.6 + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const fire = ctx.createLinearGradient(0, bottom - 3, 0, bottom + len);
  fire.addColorStop(0, "rgba(255,245,200,0.95)");
  fire.addColorStop(0.4, "rgba(255,170,70,0.9)");
  fire.addColorStop(1, "rgba(255,80,40,0)");
  ctx.fillStyle = fire;
  ctx.beginPath();
  ctx.moveTo(cx - 3.5, bottom - 3);
  ctx.quadraticCurveTo(cx - 2, bottom + len * 0.6, cx, bottom + len);
  ctx.quadraticCurveTo(cx + 2, bottom + len * 0.6, cx + 3.5, bottom - 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Per-canvas render memory of hits (shape kills and armour hits) for the hit sparkle. */
const hitSparkMemo = new WeakMap<object, { tick: number; count: number; marks: { x: number; y: number; t: number }[] }>();
const SPARK_TICKS = 20;

/** Polish A4: a four-point sparkle where each shape is hit, growing and turning as it fades. */
function drawHitSparkles(ctx: CanvasRenderingContext2D, state: WavState, still: boolean): void {
  let memo = hitSparkMemo.get(ctx);
  const count = state.shapesDown + state.armourHits;
  if (!memo || state.tick < memo.tick) {
    memo = { tick: state.tick, count, marks: [] };
    hitSparkMemo.set(ctx, memo);
  }
  if (count > memo.count) {
    // The new kills' bursts (shape colours 0–2, armour 4); never more marks than hits.
    const fresh = state.bursts.filter((b) => b.t > memo!.tick && b.c !== 3).slice(-(count - memo.count));
    for (const b of fresh) memo.marks.push({ x: b.x, y: b.y, t: b.t });
  }
  memo.count = count;
  memo.tick = state.tick;
  memo.marks = memo.marks.filter((m) => state.tick - m.t < SPARK_TICKS).slice(-8);
  for (const m of memo.marks) {
    const p = (state.tick - m.t) / SPARK_TICKS;
    const r = still ? 7 : 4 + 9 * Math.sin(Math.min(1, p * 1.6) * Math.PI * 0.5);
    ctx.save();
    ctx.translate(m.x, m.y - (still ? 0 : p * 6));
    ctx.rotate(still ? 0 : p * 1.2);
    ctx.globalAlpha = (1 - p) * 0.95;
    ctx.fillStyle = "#FFF4C8";
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const d = k % 2 === 0 ? r : r * 0.22;
      ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.8, r * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * The UFO (3 Nov 2026, display only): a gunmetal disc with an orange furnace band underneath, a blue-hot glass dome and
 * magenta rim lights chasing round; inside its hit box (12 px either side, 16 up and down).
 */
function drawSaucer(ctx: CanvasRenderingContext2D, x: number, t: number): void {
  const y = SAUCER_Y;
  const rx = WAV_SAUCER_R + 2;
  // The furnace glow underneath.
  const under = ctx.createRadialGradient(x, y + 4, 1, x, y + 4, rx);
  under.addColorStop(0, "rgba(255,170,80,0.85)");
  under.addColorStop(1, "rgba(255,90,30,0)");
  ctx.fillStyle = under;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, rx - 1, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // The dome: blue-hot glass.
  const dome = ctx.createRadialGradient(x - 2, y - 7, 1, x, y - 4, 7);
  dome.addColorStop(0, "rgba(240,252,255,0.98)");
  dome.addColorStop(0.5, "rgba(120,200,255,0.75)");
  dome.addColorStop(1, "rgba(60,120,255,0.35)");
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.ellipse(x, y - 3, 6, 7, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // The disc: gunmetal, lit from above, with a keyline.
  const disc = ctx.createLinearGradient(0, y - 4, 0, y + 5);
  disc.addColorStop(0, "#9AA3B2");
  disc.addColorStop(0.5, "#4C5361");
  disc.addColorStop(1, "#1A1D23");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // The furnace band on its underside.
  ctx.strokeStyle = WAV_FURNACE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y + 1.5, rx - 3, 2.2, 0, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // Magenta rim lights chasing round.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + t * 3;
    const lit = Math.sin(a) > 0;
    ctx.fillStyle = lit ? WAV_NEON : "rgba(255,63,208,0.25)";
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * (rx - 2), y + Math.sin(a) * 2 + 1, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBursts(ctx: CanvasRenderingContext2D, state: WavState, palette: string[], still: boolean): void {
  let budget=16;
  for (const b of state.bursts) {
    const age = state.tick - b.t;
    if (age >= (still?10:24)) continue;
    const p = age / 24;
    const colour = palette[b.c] ?? "#FFFFFF";
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4 + p * 18, 0, Math.PI * 2);
    ctx.stroke();
    if (!still) {
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(0, 6 * (1 - p * 2)), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colour;
      for (let k = 0; k < 4 && budget>0; k++,budget--) {
        const a = (k / 9) * Math.PI * 2 + (artHash(b.t, k) % 100) / 80;
        const d = 3 + age * (1.1 + (artHash(k, b.t) % 6) / 10);
        ctx.fillRect(b.x + Math.cos(a) * d - 1.5, b.y + Math.sin(a) * d - 1.5, 3, 3);
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** Render-side memory of recent ship movement, for the engine flame only. */
const motion = { tick: -1, shipX: 0, movedTick: -100 };

/** The game's drawing through the shared success layer (presentation only). */
export function drawWavefrontArt(ctx: CanvasRenderingContext2D, state: WavState, size: CanvasSize): void {
  arcadeFx(ctx, wavefrontFxFor(state), state, () => drawWavefrontArtWorld(ctx, state, size), size);
}

function drawWavefrontArtWorld(ctx: CanvasRenderingContext2D, state: WavState, size: CanvasSize): void {
  const still = reducedMotion();
  const t = still ? 0 : state.tick / 60;
  // wavRev 6: the taller world's height and ship line (620 / 554 otherwise).
  const WAV_WORLD_H = wavWorldH(state);
  const WAV_SHIP_Y = wavShipY(state);
  const WAV_DRAG_ZONE_TOP = wavDragZoneTop(WAV_WORLD_H);
  const scale = Math.min(size.width / WAV_WORLD_W, size.height / WAV_WORLD_H);
  const ox = (size.width - WAV_WORLD_W * scale) / 2;
  const oy = (size.height - WAV_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = "#07070C";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  drawSpace(ctx, t, WAV_WORLD_H);

  const latest=state.bursts.at(-1);
  successFrame(ctx,{id:'wavefront-hit',tick:state.tick,count:state.shapesDown+state.armourHits,eventTick:latest?.t,misses:WAV_LIVES-state.lives,colour:WAV_GOLD,width:WAV_WORLD_W,height:WAV_WORLD_H,point:{x:latest?.x??state.shipX,y:latest?.y??WAV_SHIP_Y,shape:'pixel'},hud:{x:14,y:14,text:`Wave ${state.wave}`}});
  const clear=successFrame(ctx,{id:'wavefront-clear',tick:state.tick,count:state.wavesCleared,colour:WAV_PURPLE,width:WAV_WORLD_W,height:WAV_WORLD_H,point:{x:WAV_WORLD_W/2,y:80,shape:'spark'}});
  if(!still&&clear.age<24){ctx.save();ctx.globalAlpha=.35*(1-clear.age/24);ctx.strokeStyle=SUCCESS_ACCENTS.white;ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<12;i++){const x=15+(i*73)%360,y=60+(i*47)%450;ctx.moveTo(x,y);ctx.lineTo(x+(x-195)*.08,y+10+clear.age*.7);}ctx.stroke();ctx.restore();}
  const away = new Set((state.divers ?? []).map((d) => d.cell));
  state.shapes.forEach((code, i) => {
    if (code === 0 || code === WAV_ARMOUR_CODE || away.has(i)) return;
    const box = wavShapeBox(state, i);
    const kind = Math.trunc((code - 1) / 3);
    const colour = wavHullTint(i, state.wave) ?? WAV_COLOURS[(code - 1) % 3] ?? WAV_GOLD;
    drawHull(ctx, kind, colour, box.x, box.y, WAV_CELL, t);
    if (state.r11 && (state.carry?.[i] ?? -1) >= 0) drawCarrierMark(ctx, box.x + WAV_CELL / 2, box.y + WAV_CELL / 2, state.carry![i]!, t);
  });
  if (state.armour) drawArmourHull(ctx, state, state.armour);
  // wavRev 2 divers: the same hull in its 28 px box, with a short fading wake.
  for (const d of state.divers ?? []) {
    const code = state.shapes[d.cell] ?? 0;
    if (code === 0) continue;
    const c = wavDiverCentre(d);
    const colour = wavHullTint(d.cell, state.wave) ?? WAV_COLOURS[(code - 1) % 3] ?? WAV_GOLD;
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#C9CED6";
    ctx.fillRect(c.x - 2, c.y - WAV_CELL / 2 - 10, 4, 10);
    ctx.globalAlpha = 1;
    drawHull(ctx, Math.trunc((code - 1) / 3), colour, c.x - WAV_CELL / 2, c.y - WAV_CELL / 2, WAV_CELL, t);
    if (state.r11 && (state.carry?.[d.cell] ?? -1) >= 0) drawCarrierMark(ctx, c.x, c.y, state.carry![d.cell]!, t);
  }
  if (state.boss) {
    let hit = bossHitMemo.get(ctx);
    if (!hit || state.tick < hit.tick) hit = { tick: -100, hits: state.bossHits ?? 0 };
    if ((state.bossHits ?? 0) > hit.hits) hit.tick = state.tick;
    hit.hits = state.bossHits ?? 0;
    bossHitMemo.set(ctx, hit);
    drawBoss(ctx, state, t, hit.tick);
  }

  // wavRev 11: the power-ups falling from carriers and saucers.
  for (const p of state.pickups ?? []) drawDrop(ctx, p.x / FP, p.y / FP, p.k, t);
  if (state.drop && state.drop.wait === 0 && state.x10) drawDrop(ctx, state.drop.x / FP, state.drop.y / FP, state.drop.k ?? 0, t);
  else if (state.drop && state.drop.wait === 0) {
    const dx = state.drop.x / FP;
    const dy = state.drop.y / FP;
    ctx.shadowBlur = 0;
    ctx.fillStyle = WAV_PURPLE;
    ctx.beginPath();
    ctx.moveTo(dx, dy - WAV_DROP_R);
    ctx.lineTo(dx + WAV_DROP_R, dy);
    ctx.lineTo(dx, dy + WAV_DROP_R);
    ctx.lineTo(dx - WAV_DROP_R, dy);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#F7F7F8";
    ctx.fillRect(dx - 1, dy - 5, 2, 10);
  }

  if (state.saucerDir !== 0) drawSaucer(ctx, state.saucerX / FP, t);

  for (const b of state.bolts) {
    drawWavefrontBeam(ctx, b.x / FP, b.y / FP, b.p ? "piercing" : "player");
  }
  for (const b of state.reds) {
    drawWavefrontBeam(ctx, b.x / FP, b.y / FP, "enemy");
  }

  drawBursts(ctx, state, [...WAV_COLOURS, WAV_PURPLE, "#9AA3B2"], still);
  drawHitSparkles(ctx, state, still);

  if (state.tick < motion.tick) motion.movedTick = -100;
  if (state.tick !== motion.tick && state.shipX !== motion.shipX) motion.movedTick = state.tick;
  motion.tick = state.tick;
  motion.shipX = state.shipX;
  const moving = !still && state.tick - motion.movedTick < 8 && state.ended === 0;
  const recoil = state.fireIn > WAV_FIRE_EVERY - 5 ? (state.fireIn - (WAV_FIRE_EVERY - 5)) / 5 : 0;
  const flashing = state.invuln > 0 && state.tick % 8 < 4;
  if (state.ended === 2) {
    ctx.globalAlpha = 0.4;
    drawFighter(ctx, state.shipX, WAV_SHIP_Y, WAV_SHIP_W, WAV_SHIP_H, false, 0, t);
    ctx.globalAlpha = 1;
  } else if (!flashing) {
    drawShipFlame(ctx, state.shipX, WAV_SHIP_Y + WAV_SHIP_H / 2, moving, t, still);
    drawFighter(ctx, state.shipX, WAV_SHIP_Y, WAV_SHIP_W, WAV_SHIP_H, moving, recoil, t);
  }
  if ((state.shield ?? 0) > 0 && state.ended === 0) drawShield(ctx, state.shipX, WAV_SHIP_Y, state.shield ?? 0, t, still);

  // Polish A4: the shield line glows faintly, a slow shimmer running along it.
  ctx.save();
  ctx.strokeStyle = "rgba(245,184,46,0.05)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(8, WAV_DRAG_ZONE_TOP);
  ctx.lineTo(WAV_WORLD_W - 8, WAV_DRAG_ZONE_TOP);
  ctx.stroke();
  ctx.strokeStyle = "rgba(245,184,46,0.18)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (!still) {
    const sx = 8 + ((t * 60) % (WAV_WORLD_W + 64)) - 32;
    const shimmer = ctx.createLinearGradient(sx - 32, 0, sx + 32, 0);
    shimmer.addColorStop(0, "rgba(255,226,140,0)");
    shimmer.addColorStop(0.5, "rgba(255,226,140,0.45)");
    shimmer.addColorStop(1, "rgba(255,226,140,0)");
    ctx.strokeStyle = shimmer;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(Math.max(8, sx - 32), WAV_DRAG_ZONE_TOP);
    ctx.lineTo(Math.min(WAV_WORLD_W - 8, sx + 32), WAV_DRAG_ZONE_TOP);
    ctx.stroke();
  }
  ctx.restore();

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const head = state.boss?.mid ? "Gunship" : state.boss ? "Boss" : `Wave ${state.wave}`;
  successHud(ctx,'wavefront-hit',state.tick,14,14,()=>ctx.fillText(`${head} · ${wavefrontGame.score(state)}`,14,14));
  // wavRev 2: "WAVE n" (or "BOSS") while the next formation flies in.
  if ((state.enter ?? 0) > 0 && state.ended === 0) {
    const k = state.enter ?? 0;
    const fade = Math.min(1, k / 20, (WAV_BREATHER_TICKS - k + 1) / 12);
    ctx.globalAlpha = Math.max(0, fade);
    ctx.font = "800 34px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = state.boss ? "#E6E9EE" : WAV_GOLD;
    ctx.fillText(state.boss?.mid ? "GUNSHIP" : state.boss ? "BOSS" : `WAVE ${state.wave}`, WAV_WORLD_W / 2, 300);
    ctx.font = "600 13px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillStyle = "#F7F7F8";
    ctx.fillText(state.boss && state.x10 ? "Hit the cannons and the open core" : state.boss ? "Shoot it down" : state.wave === wavWaves(state) ? "Last wave" : `of ${wavWaves(state)}`, WAV_WORLD_W / 2, 332);
    ctx.globalAlpha = 1;
    ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }
  if (state.x10) drawExpandHud(ctx, state);
  else if (state.pierce > 0) {
    ctx.fillStyle = WAV_PURPLE;
    ctx.fillText(`Laser ×${state.pierce}`, 14, 34);
  }
  for (let i = 0; i < WAV_LIVES; i++) {
    ctx.globalAlpha = i < state.lives ? 1 : 0.2;
    drawFighter(ctx, WAV_WORLD_W - 24 - i * 26, 22, 18, 11, false, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * wavRev 10 HUD, second line: the power-up held on the left (laser shots, spread volleys or the shield's
 * seconds) and, on wavRev 10, the hit streak on the right ("STREAK 17 ×3", gold from ×2; wavRev 11 has no streak).
 * Counter facts only, never points.
 */
function drawExpandHud(ctx: CanvasRenderingContext2D, state: WavState): void {
  ctx.save();
  ctx.font = "600 13px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textBaseline = "top";
  let x = 14;
  const tag = (text: string, colour: string) => {
    ctx.fillStyle = colour;
    ctx.textAlign = "left";
    ctx.fillText(text, x, 36);
    x += ctx.measureText(text).width + 10;
  };
  if (state.pierce > 0) tag(`Laser ×${state.pierce}`, WAV_PURPLE);
  if ((state.spread ?? 0) > 0) tag(`Spread ×${state.spread}`, "#7CF29A");
  if ((state.shield ?? 0) > 0) tag(`Shield ${Math.ceil((state.shield ?? 0) / 60)}s`, "#4FD8FF");
  const streak = state.streak ?? 0;
  const mult = wavStreakMult(streak);
  if (streak > 0) {
    ctx.textAlign = "right";
    ctx.fillStyle = mult > 1 ? WAV_GOLD : "rgba(247,247,248,0.75)";
    ctx.fillText(mult > 1 ? `STREAK ${streak} ×${mult}` : `STREAK ${streak}`, WAV_WORLD_W - 14, 36);
  }
  ctx.restore();
}

/** The sim with the art renderer swapped in; step/score are the sim's own. */
export const wavefrontArtGame = { ...wavefrontGame, draw: drawWavefrontArt };
const wavefrontArtGameV2 = { ...wavefrontGameFor(WAV_REV), draw: drawWavefrontArt };
const wavefrontArtGameBand = { ...wavefrontGameFor(WAV_REV_BAND), draw: drawWavefrontArt };
const wavefrontArtGameShapes = { ...wavefrontGameFor(WAV_REV_SHAPES), draw: drawWavefrontArt };
const wavefrontArtGameTunec = { ...wavefrontGameFor(WAV_REV_TUNEC), draw: drawWavefrontArt };
const wavefrontArtGameTall = { ...wavefrontGameFor(WAV_REV_TALL), draw: drawWavefrontArt };
const wavefrontArtGameTarget = { ...wavefrontGameFor(WAV_REV_TARGET), draw: drawWavefrontArt };
const wavefrontArtGameStrict = { ...wavefrontGameFor(WAV_REV_STRICT), draw: drawWavefrontArt };
const wavefrontArtGameExpand = { ...wavefrontGameFor(WAV_REV_EXPAND), draw: drawWavefrontArt };
const wavefrontArtGamePhone = { ...wavefrontGameFor(WAV_REV_PHONE), draw: drawWavefrontArt };
const wavefrontArtGameStd = { ...wavefrontGameFor(WAV_REV_STD), draw: drawWavefrontArt };
/** The art game for a stored wavRev; one cached object per revision. */
export function wavefrontArtGameFor(rev?: number | null): typeof wavefrontArtGame {
  if (rev === WAV_REV_STD) return wavefrontArtGameStd;
  if (rev === WAV_REV_PHONE) return wavefrontArtGamePhone;
  if (rev === WAV_REV_EXPAND) return wavefrontArtGameExpand;
  if (rev === WAV_REV_STRICT) return wavefrontArtGameStrict;
  if (rev === WAV_REV_TARGET) return wavefrontArtGameTarget;
  if (rev === WAV_REV_TALL) return wavefrontArtGameTall;
  if (rev === WAV_REV_TUNEC) return wavefrontArtGameTunec;
  if (rev === WAV_REV_SHAPES) return wavefrontArtGameShapes;
  if (rev === WAV_REV_BAND) return wavefrontArtGameBand;
  return rev === WAV_REV ? wavefrontArtGameV2 : wavefrontArtGame;
}

/** The UFO's painter, for wavefront-ships-check (its art inside the saucer's hit box). */
export { drawSaucer as drawWavefrontSaucer };
