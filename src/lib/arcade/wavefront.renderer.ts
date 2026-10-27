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
  WAV_REV_TARGET, WAV_REV_STRICT, WAV_REV_EXPAND, WAV_REV_PHONE,
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
 * Phone notes (27 Oct 2026, display only, every revision): the three enemy kinds restyled as sleek craft in
 * silver, black and grey: no neon trim and no red eyes. The same outlines at the same places and sizes (every
 * hull still fills its 28 px hit cell, x, y, s × s, nose down at the player); a ship's old colour now picks its
 * finish (WAV_COLOURS[0] polished silver, [1] steel grey, [2] black chrome), and the eyes are dark glass canopies
 * with a silver glint.
 *   kind 0 → a pincer fighter: bat-wing hull, two forward claws, twin canopies;
 *   kind 1 → a delta-wing interceptor: wing struts, a long canopy;
 *   kind 2 → an armoured gunship: plated hull, side cannons, a round glass core.
 */
interface HullFinish {
  hi: string;
  mid: string;
  lo: string;
  edge: string;
}
const FINISHES: readonly HullFinish[] = [
  { hi: "#F4F6F9", mid: "#B9BFC8", lo: "#6A717C", edge: "#FFFFFF" },
  { hi: "#C9CDD3", mid: "#7D838D", lo: "#3A3F47", edge: "#E6E9EE" },
  { hi: "#6B717B", mid: "#2A2E35", lo: "#0B0C0F", edge: "#C9CED6" },
];
const GLASS = "#06070A";
const STEEL_DARK = "#1B1E23";

function finishFor(colour: string): HullFinish {
  const k = WAV_COLOURS.indexOf(colour);
  return FINISHES[k < 0 ? 0 : k]!;
}

/** The hull's outline for each kind, filling the cell box (x, y, s x s); nose points down at the player. */
function hullPath(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, s: number): void {
  const P = (u: number, v: number) => ctx.lineTo(x + u * s, y + v * s);
  ctx.beginPath();
  if (kind === 0) {
    // Pincer fighter: scalloped bat wings across the top, a narrow body between the claws.
    ctx.moveTo(x, y + s * 0.2);
    P(0.16, 0.04); P(0.27, 0.2); P(0.38, 0.1); P(0.5, 0.18); P(0.62, 0.1); P(0.73, 0.2); P(0.84, 0.04);
    P(1, 0.2); P(0.95, 0.5); P(0.84, 0.44); P(0.74, 0.56); P(0.62, 0.52); P(0.58, 0.72); P(0.5, 0.78);
    P(0.42, 0.72); P(0.38, 0.52); P(0.26, 0.56); P(0.16, 0.44); P(0.05, 0.5);
    ctx.closePath();
  } else if (kind === 1) {
    // Delta-wing interceptor: a long nose, swept wings to the corners, two engine pods at the rear.
    ctx.moveTo(x + s * 0.5, y + s);
    P(1, 0.24); P(0.88, 0.13); P(0.64, 0.24); P(0.6, 0); P(0.4, 0); P(0.36, 0.24); P(0.12, 0.13); P(0, 0.24);
    ctx.closePath();
  } else {
    // Armoured gunship: a heavy octagon set in from the sides (the cannons take the edges).
    ctx.moveTo(x + s * 0.32, y + s * 0.02);
    P(0.68, 0.02); P(0.88, 0.2); P(0.88, 0.76); P(0.68, 0.98); P(0.32, 0.98); P(0.12, 0.76); P(0.12, 0.2);
    ctx.closePath();
  }
}

/** A dark glass canopy (ellipse) with a thin silver rim and a soft glint: no colour. */
function paintCanopy(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rim: string): void {
  const g = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
  g.addColorStop(0, "#2C323C");
  g.addColorStop(0.55, GLASS);
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = Math.max(0.5, rx * 0.25);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.35, y - ry * 0.35, rx * 0.32, ry * 0.2, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** A crisp edge: a thin dark keyline, then the lit edge just inside it. */
function edgeLine(ctx: CanvasRenderingContext2D, f: HullFinish, width: number): void {
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = width * 1.8;
  ctx.stroke();
  ctx.strokeStyle = f.edge;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = width * 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** The static hull (cached): a metal body in its finish, dark seams, a lit edge and glass canopies. */
function paintHull(ctx: CanvasRenderingContext2D, kind: number, colour: string, x: number, y: number, s: number): void {
  const f = finishFor(colour);
  const P = (u: number, v: number) => [x + u * s, y + v * s] as const;
  const line = (pts: (readonly [number, number])[]) => {
    ctx.beginPath();
    pts.forEach(([px, py], k) => (k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, s, s);
  ctx.clip();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (kind === 2) {
    // Side cannons first, under the hull: dark steel barrels pointing down, a silver band at each muzzle.
    for (const side of [0, 1]) {
      const cx = x + (side ? 0.94 : 0.06) * s;
      const g = ctx.createLinearGradient(cx - s * 0.06, 0, cx + s * 0.06, 0);
      g.addColorStop(0, f.hi);
      g.addColorStop(1, STEEL_DARK);
      ctx.fillStyle = g;
      ctx.fillRect(cx - s * 0.06, y + s * 0.3, s * 0.12, s * 0.58);
      ctx.fillStyle = STEEL_DARK;
      ctx.fillRect(cx - s * 0.035, y + s * 0.84, s * 0.07, s * 0.1);
      ctx.fillStyle = f.edge;
      ctx.fillRect(cx - s * 0.06, y + s * 0.8, s * 0.12, s * 0.03);
    }
  }
  if (kind === 0) {
    // Two forward claws curling in towards the nose, under the hull: black steel with a silver edge.
    for (const side of [-1, 1]) {
      const cx = x + s / 2;
      ctx.beginPath();
      ctx.moveTo(cx + side * s * 0.12, y + s * 0.5);
      ctx.quadraticCurveTo(cx + side * s * 0.36, y + s * 0.62, cx + side * s * 0.24, y + s * 0.98);
      ctx.quadraticCurveTo(cx + side * s * 0.2, y + s * 0.8, cx + side * s * 0.06, y + s * 0.8);
      ctx.quadraticCurveTo(cx + side * s * 0.18, y + s * 0.72, cx + side * s * 0.12, y + s * 0.5);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, y + s * 0.5, 0, y + s);
      g.addColorStop(0, f.mid);
      g.addColorStop(1, STEEL_DARK);
      ctx.fillStyle = g;
      ctx.fill();
      edgeLine(ctx, f, 0.6);
    }
  }
  // The metal body: a brushed gradient lit from the upper left, with a bright specular band.
  const body = ctx.createLinearGradient(x, y, x + s * 0.7, y + s);
  body.addColorStop(0, f.hi);
  body.addColorStop(0.35, f.mid);
  body.addColorStop(0.5, f.hi);
  body.addColorStop(0.62, f.mid);
  body.addColorStop(1, f.lo);
  hullPath(ctx, kind, x, y, s);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Panel seams, dark and fine.
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 0.6;
  if (kind === 0) {
    line([P(0.5, 0.18), P(0.5, 0.74)]); ctx.stroke();
    line([P(0.16, 0.06), P(0.3, 0.42)]); ctx.stroke();
    line([P(0.84, 0.06), P(0.7, 0.42)]); ctx.stroke();
    // Black wing tips.
    ctx.fillStyle = STEEL_DARK;
    for (const [u0, u1] of [[0, 0.12], [0.88, 1]] as const) ctx.fillRect(x + u0 * s, y, (u1 - u0) * s, s * 0.55);
  } else if (kind === 1) {
    const struts: [readonly [number, number], readonly [number, number]][] = [[P(0.42, 0.3), P(0.12, 0.2)], [P(0.58, 0.3), P(0.88, 0.2)], [P(0.44, 0.44), P(0.24, 0.36)], [P(0.56, 0.44), P(0.76, 0.36)]];
    ctx.lineWidth = 1;
    for (const st of struts) { line(st); ctx.stroke(); }
    // A black spine down the fuselage.
    ctx.strokeStyle = STEEL_DARK;
    ctx.lineWidth = s * 0.08;
    line([P(0.5, 0.02), P(0.5, 0.42)]); ctx.stroke();
  } else {
    for (const v of [0.34, 0.66]) { line([P(0.12, v), P(0.88, v)]); ctx.stroke(); }
    for (const u of [0.34, 0.66]) { line([P(u, 0.02), P(u, 0.34)]); ctx.stroke(); line([P(u, 0.66), P(u, 0.98)]); ctx.stroke(); }
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (const [u, v] of [[0.24, 0.26], [0.76, 0.26], [0.24, 0.74], [0.76, 0.74], [0.5, 0.1], [0.5, 0.9]] as const) ctx.fillRect(x + u * s - 0.5, y + v * s - 0.5, 1, 1);
  }
  // A lit upper-left rim and a shadowed lower-right one.
  const rim = ctx.createLinearGradient(x, y, x + s, y + s);
  rim.addColorStop(0, "rgba(255,255,255,0.55)");
  rim.addColorStop(0.5, "rgba(255,255,255,0)");
  rim.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.6;
  hullPath(ctx, kind, x, y, s);
  ctx.stroke();
  ctx.restore();
  hullPath(ctx, kind, x, y, s);
  edgeLine(ctx, f, 0.8);
  if (kind === 2) {
    // A black collar round the glass core.
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s * 0.5, s * 0.21, 0, Math.PI * 2);
    ctx.fillStyle = STEEL_DARK;
    ctx.fill();
  }
  // Canopies: dark glass, never a coloured eye.
  if (kind === 0) {
    paintCanopy(ctx, x + s * 0.4, y + s * 0.36, s * 0.07, s * 0.055, f.edge);
    paintCanopy(ctx, x + s * 0.6, y + s * 0.36, s * 0.07, s * 0.055, f.edge);
  } else if (kind === 1) {
    paintCanopy(ctx, x + s * 0.5, y + s * 0.6, s * 0.07, s * 0.14, f.edge);
  } else {
    paintCanopy(ctx, x + s * 0.5, y + s * 0.5, s * 0.14, s * 0.14, f.edge);
  }
  ctx.restore();
}

const HULL_SCALE = 3;
const hullSprites = new Map<string, ArtCanvas | null>();

/** One enemy hull filling the cell box (x, y, s x s): a cached sprite plus the live engine glints. */
function drawHull(ctx: CanvasRenderingContext2D, kind: number, colour: string, x: number, y: number, s: number, t: number): void {
  const key = `s5:${kind}:${colour}:${s}`;
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
  if (sprite) ctx.drawImage(sprite as CanvasImageSource, x, y, s, s);
  else paintHull(ctx, kind, colour, x, y, s);
  // Engine glints at the rear (top), inside the box: a cool white, twin for the interceptor.
  const pulse = 0.6 + 0.4 * Math.sin(t * 9 + x * 0.1);
  ctx.fillStyle = `rgba(225,235,250,${0.6 * pulse})`;
  for (const u of kind === 1 ? [0.44, 0.56] : [0.5]) {
    ctx.beginPath();
    ctx.ellipse(x + s * u, y + s * (kind === 1 ? 0.06 : 0.12), s * (kind === 1 ? 0.05 : 0.1), s * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }
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
  // Silver spaceship silhouette; the dark frame shows through missing plates.
  const cx = box.x + w / 2;
  ctx.beginPath();
  ctx.moveTo(cx, box.y + h);
  ctx.lineTo(cx + w * 0.18, box.y + h * 0.72);
  ctx.lineTo(box.x + w, box.y + h * 0.85);
  ctx.lineTo(box.x + w, box.y + h * 0.24);
  ctx.lineTo(cx + w * 0.2, box.y + h * 0.38);
  ctx.lineTo(cx + w * 0.12, box.y);
  ctx.lineTo(cx - w * 0.12, box.y);
  ctx.lineTo(cx - w * 0.2, box.y + h * 0.38);
  ctx.lineTo(box.x, box.y + h * 0.24);
  ctx.lineTo(box.x, box.y + h * 0.85);
  ctx.lineTo(cx - w * 0.18, box.y + h * 0.72);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#454B54";
  ctx.fill();
  ctx.strokeStyle = "#D8DDE5";
  ctx.lineWidth = 1.5;
  ctx.stroke();
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
      // Exposed frame with a crack.
      ctx.strokeStyle = "#242830";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.2, py + ph * 0.2);
      ctx.lineTo(px + pw * 0.5, py + ph * 0.55);
      ctx.lineTo(px + pw * 0.4, py + ph * 0.8);
      ctx.moveTo(px + pw * 0.5, py + ph * 0.55);
      ctx.lineTo(px + pw * 0.8, py + ph * 0.6);
      ctx.stroke();
      continue;
    }
    const g = ctx.createLinearGradient(px, py, px, py + ph);
    g.addColorStop(0, "#D2D5DA");
    g.addColorStop(0.5, "#AEB3BC");
    g.addColorStop(1, "#777E89");
    ctx.fillStyle = g;
    ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
    ctx.strokeStyle = "#353B45";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1.5, py + 1.5, pw - 3, ph - 3);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(px + 2, py + 2, 1.5, 1.5);
    ctx.fillRect(px + pw - 3.5, py + 2, 1.5, 1.5);
  }
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
  // Phone notes (27 Oct 2026, display only): both bosses in black and silver (the gunship a lighter graphite).
  const hull = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  const gunship = Boolean(boss.mid);
  hull.addColorStop(0, gunship ? "#4A5059" : "#2A2E35");
  hull.addColorStop(0.45, gunship ? "#22262C" : "#0E1013");
  hull.addColorStop(0.55, gunship ? "#3A3F47" : "#1E2228");
  hull.addColorStop(1, "#050608");
  ctx.fillStyle = hull;
  ctx.strokeStyle = "#D8DDE5";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Swept wings to the full width, a heavy centre hull, the nose at the bottom edge.
  ctx.moveTo(x, y + h * 0.3);
  ctx.lineTo(cx - w * 0.22, y);
  ctx.lineTo(cx + w * 0.22, y);
  ctx.lineTo(x + w, y + h * 0.3);
  ctx.lineTo(x + w, y + h * 0.62);
  ctx.lineTo(cx + w * 0.16, y + h * 0.78);
  ctx.lineTo(cx, y + h);
  ctx.lineTo(cx - w * 0.16, y + h * 0.78);
  ctx.lineTo(x, y + h * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Silver panel lines along the wings.
  ctx.strokeStyle = "rgba(216,221,229,0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.06, y + h * 0.42);
  ctx.lineTo(cx - w * 0.18, y + h * 0.14);
  ctx.moveTo(x + w * 0.94, y + h * 0.42);
  ctx.lineTo(cx + w * 0.18, y + h * 0.14);
  ctx.stroke();
  // Gun pods (where the pattern's bolts leave) and a pulsing core.
  ctx.fillStyle = "#050608";
  for (const gx of [8, w / 2, w - 8]) ctx.fillRect(x + gx - 4, y + h * 0.62 - 2, 8, 8);
  if (state.x10) drawWeakPoints(ctx, state, boss, x, y, w, h, t);
  else {
    const pulse = 0.6 + 0.4 * Math.sin(t * 6);
    const core = ctx.createRadialGradient(cx, y + h * 0.45, 1, cx, y + h * 0.45, 12);
    core.addColorStop(0, `rgba(230,236,245,${pulse})`);
    core.addColorStop(1, "rgba(200,210,225,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.45, 12, 0, Math.PI * 2);
    ctx.fill();
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
      bloom.addColorStop(0.5, `rgba(190,215,255,${0.8 * pulse})`);
      bloom.addColorStop(1, "rgba(160,190,255,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(cx - r - 4, cy - r - 4, 2 * r + 8, 2 * r + 8);
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#C9D6FF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#2B2F38";
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
function drawShipFlame(ctx: CanvasRenderingContext2D, cx: number, bottom: number, moving: boolean, t: number, still: boolean): void {
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

function drawSaucer(ctx: CanvasRenderingContext2D, x: number, t: number): void {
  const y = SAUCER_Y;
  const rx = WAV_SAUCER_R + 2;
  // Dome.
  const dome = ctx.createRadialGradient(x - 2, y - 7, 1, x, y - 4, 7);
  dome.addColorStop(0, "rgba(255,255,255,0.95)");
  dome.addColorStop(1, "rgba(167,139,250,0.35)");
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.ellipse(x, y - 3, 6, 7, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // Disc.
  const disc = ctx.createLinearGradient(0, y - 4, 0, y + 5);
  disc.addColorStop(0, "#D9CCFF");
  disc.addColorStop(1, "#5B3FB8");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rotating light ring.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + t * 3;
    const lit = Math.sin(a) > 0;
    ctx.fillStyle = lit ? (k % 2 ? "#FFE600" : "#FF6BD6") : "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * (rx - 2), y + Math.sin(a) * 2 + 1, 1.4, 0, Math.PI * 2);
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
    const colour = WAV_COLOURS[(code - 1) % 3] ?? WAV_GOLD;
    drawHull(ctx, kind, colour, box.x, box.y, WAV_CELL, t);
    if (state.r11 && (state.carry?.[i] ?? -1) >= 0) drawCarrierMark(ctx, box.x + WAV_CELL / 2, box.y + WAV_CELL / 2, state.carry![i]!, t);
  });
  if (state.armour) drawArmourHull(ctx, state, state.armour);
  // wavRev 2 divers: the same hull in its 28 px box, with a short fading wake.
  for (const d of state.divers ?? []) {
    const code = state.shapes[d.cell] ?? 0;
    if (code === 0) continue;
    const c = wavDiverCentre(d);
    const colour = WAV_COLOURS[(code - 1) % 3] ?? WAV_GOLD;
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
/** The art game for a stored wavRev; one cached object per revision. */
export function wavefrontArtGameFor(rev?: number | null): typeof wavefrontArtGame {
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
