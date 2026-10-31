/**
 * Minigolf's art (display only; never imported by the sim or the server): a night garden terrace seen from above.
 * Stone tiles in warm lamp light, mown turf in stripes inside timber rails with brass studs, diagonal logs, boulders,
 * bushes in stone planters, ponds, and ramps drawn raised (a lit deck from a shaded toe to a bright crest lip, bold
 * chevrons uphill, the rail drawn taller towards the crest). golfRev 2's crazy-golf pieces: bunkers, hills, tunnel
 * entrances and exits (a colour per pair), striped banked curves, castle gates and brick windmill houses, and the
 * windmill's sails (drawn every frame from the sim tick). Every solid thing is drawn on the sim's own geometry (the
 * bounds rule: within 2 px of what the ball collides with); the windmill's overhead sails are see-through and only
 * their foot, solid, sits in the doorway where it collides.
 *
 * The terrace and the hole are painted once per hole and size into a cached canvas; a frame draws that, the flag,
 * the ball, the windmills' sails, the aim and the HUD chips.
 */
import { px } from "./engine";
import { ANG_FULL } from "./trig";
import {
  mgMillAngle,
  mgSails,
  MG_AIM,
  MG_GATE_R,
  MG_HUB_R,
  MG_MILL_H,
  MG_SAIL_LEN,
  MG_SAIL_W,
  MG_SAIL_R,
  MG_TUNNEL_R,
  MG_BALL_R,
  MG_CUP_R,
  MG_DONE,
  MG_PAUSE,
  MG_ROLL,
  MINIGOLF_H,
  MINIGOLF_HOLES,
  MINIGOLF_STROKE_LIMIT,
  MINIGOLF_W,
  type MgHole,
  type MinigolfState,
} from "./minigolf";
import type { ArenaSceneView } from "./arenaScene.renderer";

/** What the stage's drag shows (presentation only): the pull from the ball, as an aim and a power share. */
export interface MinigolfAim {
  /** Unit direction of the putt (world). */
  dx: number;
  dy: number;
  /** 0…1 of full power. */
  power: number;
}

export const MINIGOLF_BG = "#0B0F0C";

const TURF_A = "#2F7A3A";
const TURF_B = "#2A6F35";
const RAIL = "#6B4426";
const RAIL_HI = "#A8774B";
const BRASS = "#D8B25A";

/** A seeded-looking but fixed scatter for decoration (display only; never the sim's dice). */
function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function polyPath(ctx: CanvasRenderingContext2D, poly: readonly number[]): void {
  ctx.beginPath();
  for (let i = 0; i < poly.length; i += 2) {
    const x = px(poly[i]!);
    const y = px(poly[i + 1]!);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/* ============================== The terrace ============================== */

/** Stone tiles, lamp pools and garden beds round the course (world px). */
function paintTerrace(ctx: CanvasRenderingContext2D, w: number, h: number, salt: number): void {
  ctx.fillStyle = "#1A1714";
  ctx.fillRect(0, 0, w, h);
  // Flagstones: staggered slabs with slightly varied tone and dark grout.
  const tile = 46;
  for (let row = -1; row * tile < h + tile; row++) {
    const off = (row & 1) * (tile / 2);
    for (let col = -1; col * tile < w + tile; col++) {
      const x = col * tile + off;
      const y = row * tile;
      const k = hash(row * 131 + col * 7 + salt);
      const l = 17 + Math.round(k * 7);
      ctx.fillStyle = `hsl(28 9% ${l}%)`;
      ctx.fillRect(x + 1.5, y + 1.5, tile - 3, tile - 3);
      // A faint worn highlight on each slab.
      ctx.fillStyle = `rgba(255,236,210,${0.025 + k * 0.03})`;
      ctx.fillRect(x + 4, y + 4, tile * 0.5, tile * 0.3);
    }
  }
  // Garden beds along both sides and the ends: dark soil with shrubs and small flowers.
  const beds: [number, number, number, number][] = [
    [0, 0, w, 26],
    [0, h - 26, w, 26],
    [0, 0, 18, h],
    [w - 18, 0, 18, h],
  ];
  for (const [x, y, bw, bh] of beds) {
    ctx.fillStyle = "#1E1611";
    ctx.fillRect(x, y, bw, bh);
  }
  for (let i = 0; i < 70; i++) {
    const side = i % 4;
    const t = hash(i * 17 + salt);
    const u = hash(i * 29 + 3 + salt);
    const x = side === 0 || side === 1 ? t * w : side === 2 ? 4 + u * 10 : w - 14 + u * 10;
    const y = side === 2 || side === 3 ? t * h : side === 0 ? 4 + u * 16 : h - 22 + u * 16;
    const r = 5 + hash(i * 41 + salt) * 7;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    g.addColorStop(0, "#3F6B34");
    g.addColorStop(1, "#16301A");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (hash(i * 53 + salt) > 0.55) {
      const hue = [338, 48, 280, 8, 200][i % 5]!;
      ctx.fillStyle = `hsl(${hue} 70% 68%)`;
      for (let p = 0; p < 4; p++) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(p * 1.7 + i) * r * 0.55, y + Math.sin(p * 1.7 + i) * r * 0.55, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/** Warm lamp light pools (drawn over everything static, additive). */
function paintLamps(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const lamps: [number, number, number][] = [
    [w * 0.12, h * 0.18, 210],
    [w * 0.9, h * 0.42, 230],
    [w * 0.18, h * 0.78, 220],
    [w * 0.85, h * 0.92, 160],
  ];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [x, y, r] of lamps) {
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, "rgba(255,196,120,0.20)");
    g.addColorStop(0.45, "rgba(255,170,90,0.07)");
    g.addColorStop(1, "rgba(255,160,80,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
  // A cool night wash at the far corners.
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(4,8,18,0.45)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/* ================================ The hole ================================ */

function paintTurf(ctx: CanvasRenderingContext2D, h: MgHole): void {
  ctx.save();
  polyPath(ctx, h.poly);
  ctx.clip();
  const b = h.box;
  ctx.fillStyle = TURF_A;
  ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  // Mown stripes along the hole's length.
  const stripe = 18;
  ctx.fillStyle = TURF_B;
  for (let y = b.y - 4; y < b.y + b.h + 8; y += stripe * 2) ctx.fillRect(b.x - 4, y, b.w + 8, stripe);
  // Fine grain: short blades of lighter and darker green.
  for (let i = 0; i < (b.w * b.h) / 60; i++) {
    const x = b.x + hash(i * 3 + h.index * 977) * b.w;
    const y = b.y + hash(i * 5 + 11 + h.index * 977) * b.h;
    ctx.fillStyle = hash(i * 7 + h.index) > 0.5 ? "rgba(140,210,120,0.08)" : "rgba(0,30,0,0.10)";
    ctx.fillRect(x, y, 1, 2);
  }
  ctx.restore();
}

/** A slope's geometry in world px: its box, the downhill unit vector, the low and crest edges' centres. */
function slopeGeom(s: MgHole["slopes"][number]) {
  const x0 = px(s.x0);
  const y0 = px(s.y0);
  const x1 = px(s.x1);
  const y1 = px(s.y1);
  const len = Math.hypot(s.ax, s.ay) || 1;
  const dx = s.ax / len;
  const dy = s.ay / len;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  // Half the box's extent along the slope, and its full width across it.
  const hw = (Math.abs(dx) * (x1 - x0) + Math.abs(dy) * (y1 - y0)) / 2;
  const span = Math.abs(dy) * (x1 - x0) + Math.abs(dx) * (y1 - y0);
  return { x0, y0, x1, y1, dx, dy, cx, cy, hw, span, strength: len };
}

/**
 * A ramp drawn as a raised slope (art only; the pull is the sim's box): the deck lit from the crest down to a shaded
 * toe, boards across it closing up towards the bottom, a bright lip and a cast shadow at the crest, and bold chevrons
 * pointing uphill. Its side rails (raised where the ramp runs along the course's rails) are drawn by paintRampRails.
 */
function paintSlopes(ctx: CanvasRenderingContext2D, h: MgHole): void {
  ctx.save();
  polyPath(ctx, h.poly);
  ctx.clip();
  for (const s of h.slopes) {
    const g0 = slopeGeom(s);
    const { x0, y0, x1, y1, dx, dy, cx, cy, hw, span } = g0;
    const lowX = cx + dx * hw;
    const lowY = cy + dy * hw;
    const crestX = cx - dx * hw;
    const crestY = cy - dy * hw;
    // The deck: a darker toe rising to a lit crest.
    const g = ctx.createLinearGradient(lowX, lowY, crestX, crestY);
    g.addColorStop(0, "#1D4F25");
    g.addColorStop(0.5, "#3A8A43");
    g.addColorStop(1, "#6FC172");
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Boards across the slope, closer together at the toe (foreshortened), lighter towards the crest.
    const across = { x: -dy, y: dx };
    const n = 9;
    for (let i = 1; i < n; i++) {
      const t = Math.pow(i / n, 0.8);
      const bx = lowX - dx * hw * 2 * t;
      const by = lowY - dy * hw * 2 * t;
      ctx.strokeStyle = `rgba(${t > 0.5 ? "230,255,220" : "0,20,4"},${0.1 + Math.abs(t - 0.5) * 0.18})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx - across.x * span / 2, by - across.y * span / 2);
      ctx.lineTo(bx + across.x * span / 2, by + across.y * span / 2);
      ctx.stroke();
    }
    // The toe: a dark crease where the ramp meets the flat.
    const edge = (ex: number, ey: number, colour: string, w: number) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(ex - across.x * span / 2, ey - across.y * span / 2);
      ctx.lineTo(ex + across.x * span / 2, ey + across.y * span / 2);
      ctx.stroke();
    };
    edge(lowX, lowY, "rgba(0,0,0,0.45)", 3);
    // The crest: a soft shadow cast onto the flat beyond it, then the bright lip.
    const sh = ctx.createLinearGradient(crestX, crestY, crestX - dx * 12, crestY - dy * 12);
    sh.addColorStop(0, "rgba(0,0,0,0.35)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.fillStyle = sh;
    ctx.beginPath();
    const ax = across.x * span / 2;
    const ay = across.y * span / 2;
    ctx.moveTo(crestX - ax, crestY - ay);
    ctx.lineTo(crestX + ax, crestY + ay);
    ctx.lineTo(crestX + ax - dx * 12, crestY + ay - dy * 12);
    ctx.lineTo(crestX - ax - dx * 12, crestY - ay - dy * 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    edge(crestX + dx * 1.5, crestY + dy * 1.5, "rgba(240,255,230,0.9)", 2.5);
    // Bold chevrons pointing uphill, brighter the higher they sit.
    const cols = Math.max(2, Math.floor(span / 48));
    for (let i = 0; i < cols; i++) {
      const t = (i + 0.5) / cols - 0.5;
      for (let k = 0; k < 3; k++) {
        const along = -hw * 0.5 + k * hw * 0.5;
        const ax2 = cx + across.x * t * span - dx * along;
        const ay2 = cy + across.y * t * span - dy * along;
        ctx.strokeStyle = `rgba(245,255,235,${0.28 + k * 0.22})`;
        ctx.lineWidth = 2.6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(ax2 + across.x * 7 + dx * 5, ay2 + across.y * 7 + dy * 5);
        ctx.lineTo(ax2 - dx * 3, ay2 - dy * 3);
        ctx.lineTo(ax2 - across.x * 7 + dx * 5, ay2 - across.y * 7 + dy * 5);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/**
 * A ramp's side rails, raised where a side of the ramp runs along the course's rail: the rail drawn taller (wider,
 * outwards, off the fairway) from the toe to the crest, a lit top and a shaded face, so the climb reads at a glance.
 * Art only and never on the fairway: the ball's rail stays on the course outline.
 */
function paintRampRails(ctx: CanvasRenderingContext2D, h: MgHole): void {
  for (const s of h.slopes) {
    const { x0, y0, x1, y1, dx, dy, cx, cy, hw } = slopeGeom(s);
    const across = { x: -dy, y: dx };
    for (const side of [-1, 1]) {
      // The side's line, from the toe to the crest, and its outward direction.
      const half = Math.abs(across.x) * (x1 - x0) / 2 + Math.abs(across.y) * (y1 - y0) / 2;
      const sx = cx + across.x * half * side;
      const sy = cy + across.y * half * side;
      const toe = { x: sx + dx * hw, y: sy + dy * hw };
      const crest = { x: sx - dx * hw, y: sy - dy * hw };
      const out = { x: across.x * side, y: across.y * side };
      // Only where the side sits on the course outline: just outside it is off the fairway, just inside on it.
      const mid = { x: (toe.x + crest.x) / 2, y: (toe.y + crest.y) / 2 };
      if (pointInPoly(h.poly, mid.x + out.x * 4, mid.y + out.y * 4) || !pointInPoly(h.poly, mid.x - out.x * 4, mid.y - out.y * 4)) continue;
      const face = ctx.createLinearGradient(toe.x, toe.y, crest.x, crest.y);
      face.addColorStop(0, "#4A2E18");
      face.addColorStop(1, "#8A5A33");
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.moveTo(toe.x, toe.y);
      ctx.lineTo(crest.x, crest.y);
      ctx.lineTo(crest.x + out.x * 11, crest.y + out.y * 11);
      ctx.lineTo(toe.x + out.x * 4, toe.y + out.y * 4);
      ctx.closePath();
      ctx.fill();
      // The rail's lit top edge, rising with the ramp.
      ctx.strokeStyle = "#D9A56C";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toe.x + out.x * 3, toe.y + out.y * 3);
      ctx.lineTo(crest.x + out.x * 10, crest.y + out.y * 10);
      ctx.stroke();
      // Posts down the face.
      ctx.strokeStyle = "rgba(30,16,6,0.7)";
      ctx.lineWidth = 1.5;
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        const w = 4 + 6 * t;
        const qx = toe.x + (crest.x - toe.x) * t;
        const qy = toe.y + (crest.y - toe.y) * t;
        ctx.beginPath();
        ctx.moveTo(qx + out.x, qy + out.y);
        ctx.lineTo(qx + out.x * w, qy + out.y * w);
        ctx.stroke();
      }
    }
  }
}

function paintPond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  // Stone edge, then dark water with a moonlit sheen.
  ctx.fillStyle = "#5B5650";
  ctx.beginPath();
  ctx.arc(x, y, r + 4, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, "#2F5D74");
  g.addColorStop(0.6, "#173847");
  g.addColorStop(1, "#0B1E28");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(200,230,255,0.18)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(x - r * 0.15, y - r * 0.2, r * 0.22 * i, r * 0.12 * i, -0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Lily pads.
  ctx.fillStyle = "#2E5A2A";
  ctx.beginPath();
  ctx.arc(x + r * 0.45, y + r * 0.35, r * 0.13, 0.3, Math.PI * 2 - 0.2);
  ctx.lineTo(x + r * 0.45, y + r * 0.35);
  ctx.fill();
}

function paintBoulder(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number): void {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + 2.5, y + 3, r, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.15, x, y, r);
  g.addColorStop(0, "#A7A39C");
  g.addColorStop(0.6, "#6E6A64");
  g.addColorStop(1, "#3D3A37");
  ctx.fillStyle = g;
  ctx.beginPath();
  // A slightly irregular outline that never strays more than a pixel from the collision circle.
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rr = r + (hash(i + k * 31) - 0.5) * 1.6;
    const px2 = x + Math.cos(a) * rr;
    const py2 = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px2, py2);
    else ctx.lineTo(px2, py2);
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(40,36,32,0.6)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.3, y - r * 0.1);
  ctx.lineTo(x + r * 0.1, y + r * 0.2);
  ctx.lineTo(x + r * 0.35, y + r * 0.05);
  ctx.stroke();
}

function paintPlanter(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number): void {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.arc(x + 2.5, y + 3, r, 0, Math.PI * 2);
  ctx.fill();
  // Stone rim.
  const rim = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.3, x, y, r);
  rim.addColorStop(0, "#BDB4A6");
  rim.addColorStop(1, "#7A7266");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2A1E15";
  ctx.beginPath();
  ctx.arc(x, y, r - 3, 0, Math.PI * 2);
  ctx.fill();
  // The bush: clumps of leaves, shaded.
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + k;
    const rr = (r - 4) * (i === 0 ? 0 : 0.45);
    const bx = x + Math.cos(a) * rr;
    const by = y + Math.sin(a) * rr;
    const br = (r - 4) * (i === 0 ? 0.65 : 0.5);
    const g = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.35, 0.5, bx, by, br);
    g.addColorStop(0, "#5E9A4A");
    g.addColorStop(1, "#1C3D1E");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintLog(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, r: number): void {
  const ang = Math.atan2(by - ay, bx - ax);
  const len = Math.hypot(bx - ax, by - ay);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.roundRect(-r + 2, -r + 3, len + r * 2, r * 2, r);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, "#9A6A3F");
  g.addColorStop(0.5, "#6E4527");
  g.addColorStop(1, "#3E2614");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-r, -r, len + r * 2, r * 2, r);
  ctx.fill();
  // Bark lines and end rings.
  ctx.strokeStyle = "rgba(30,16,6,0.55)";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(2 + i * 3, -r * 0.5 + i * 1.6);
    ctx.lineTo(len - 2 - i * 4, -r * 0.4 + i * 1.6);
    ctx.stroke();
  }
  for (const ex of [-r * 0.15, len + r * 0.15]) {
    ctx.fillStyle = "#C79A62";
    ctx.beginPath();
    ctx.ellipse(ex, 0, r * 0.45, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90,55,25,0.8)";
    ctx.beginPath();
    ctx.ellipse(ex, 0, r * 0.22, r * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Timber rails just outside the fairway's edges, with brass studs. */
function paintRails(ctx: CanvasRenderingContext2D, h: MgHole): void {
  const p = h.poly;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  polyPath(ctx, p);
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 11;
  ctx.stroke();
  polyPath(ctx, p);
  ctx.strokeStyle = RAIL;
  ctx.lineWidth = 8;
  ctx.stroke();
  polyPath(ctx, p);
  ctx.strokeStyle = RAIL_HI;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Turf back over the rail's inner half, so the rail's inner face sits on the collision line.
  ctx.restore();
  ctx.save();
  polyPath(ctx, p);
  ctx.clip();
  polyPath(ctx, p);
  ctx.strokeStyle = "rgba(10,30,12,0.55)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  // Studs every ~40 px along each rail.
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    const ax = px(p[i]!);
    const ay = px(p[i + 1]!);
    const bx = px(p[j]!);
    const by = px(p[j + 1]!);
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1) continue;
    const nx = (by - ay) / len;
    const ny = -(bx - ax) / len;
    const n = Math.max(1, Math.round(len / 40));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const sx = ax + (bx - ax) * t;
      const sy = ay + (by - ay) * t;
      // The stud sits on the rail's outer half (whichever side of the edge is off the fairway).
      const o = 2.5;
      for (const sgn of [1, -1]) {
        const qx = sx + nx * o * sgn;
        const qy = sy + ny * o * sgn;
        // Only on the outside.
        if (pointInPoly(p, qx, qy)) continue;
        const g = ctx.createRadialGradient(qx - 0.6, qy - 0.6, 0.2, qx, qy, 1.9);
        g.addColorStop(0, "#FFF2C4");
        g.addColorStop(0.5, BRASS);
        g.addColorStop(1, "#7A5A1E");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(qx, qy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function pointInPoly(p: readonly number[], x: number, y: number): boolean {
  let inside = false;
  const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = px(p[i * 2]!);
    const yi = px(p[i * 2 + 1]!);
    const xj = px(p[j * 2]!);
    const yj = px(p[j * 2 + 1]!);
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function paintCup(ctx: CanvasRenderingContext2D, h: MgHole): void {
  const x = px(h.cup.x);
  const y = px(h.cup.y);
  // A lighter collar of short-cut green, the cup's white liner and the dark hole.
  const g = ctx.createRadialGradient(x, y, MG_CUP_R, x, y, MG_CUP_R + 14);
  g.addColorStop(0, "rgba(160,230,140,0.30)");
  g.addColorStop(1, "rgba(160,230,140,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, MG_CUP_R + 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#E9EDE6";
  ctx.beginPath();
  ctx.arc(x, y, MG_CUP_R, 0, Math.PI * 2);
  ctx.fill();
  const hole = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, MG_CUP_R - 1);
  hole.addColorStop(0, "#000");
  hole.addColorStop(1, "#14110E");
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(x, y, MG_CUP_R - 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function paintTee(ctx: CanvasRenderingContext2D, h: MgHole): void {
  const x = px(h.tee.x);
  const y = px(h.tee.y);
  ctx.fillStyle = "rgba(20,60,26,0.6)";
  ctx.beginPath();
  ctx.roundRect(x - 18, y - 12, 36, 24, 5);
  ctx.fill();
  ctx.strokeStyle = "rgba(230,240,220,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

/* ======================= golfRev 2: the crazy-golf pieces ======================= */

/** A bunker: pale sand inside a darker lip, raked lines (the sim's circle: the friction starts at its edge). */
function paintSand(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number): void {
  ctx.fillStyle = "rgba(60,40,10,0.55)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r - 1.5);
  g.addColorStop(0, "#F3DFA6");
  g.addColorStop(0.7, "#DCC07E");
  g.addColorStop(1, "#B8975A");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r - 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 3, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(120,90,40,0.35)";
  ctx.lineWidth = 1;
  const a = hash(k) * Math.PI;
  for (let i = -r; i <= r; i += 4) {
    ctx.beginPath();
    for (let t = -r; t <= r; t += 3) {
      const wob = Math.sin((t + k * 7) / 5) * 0.8;
      const px2 = x + Math.cos(a) * t - Math.sin(a) * (i + wob);
      const py2 = y + Math.sin(a) * t + Math.cos(a) * (i + wob);
      if (t === -r) ctx.moveTo(px2, py2);
      else ctx.lineTo(px2, py2);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** A hill: a dome lit from the top left, contour rings and a soft shadow round its foot (the sim's circle). */
function paintHill(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const sh = ctx.createRadialGradient(x + r * 0.25, y + r * 0.3, r * 0.4, x + r * 0.1, y + r * 0.12, r);
  sh.addColorStop(0, "rgba(0,20,4,0)");
  sh.addColorStop(1, "rgba(0,20,4,0.45)");
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
  g.addColorStop(0, "#9BE08F");
  g.addColorStop(0.45, "#4FA154");
  g.addColorStop(1, "#24622C");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = sh;
  ctx.fill();
  ctx.strokeStyle = "rgba(225,255,215,0.22)";
  ctx.lineWidth = 1;
  for (const f of [0.75, 0.5, 0.25]) {
    ctx.beginPath();
    ctx.arc(x - r * (1 - f) * 0.12, y - r * (1 - f) * 0.14, r * f, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The crest: a small bright cap.
  ctx.fillStyle = "rgba(240,255,230,0.55)";
  ctx.beginPath();
  ctx.arc(x - r * 0.1, y - r * 0.12, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

/** Tunnel pairs' colours, so a player can tell which entrance leads where. */
const TUNNEL_COLOURS = ["#F2C75C", "#5FD3E8", "#F28CB0"];

/** A tunnel's entrance: a dark hole in a stone ring (the sim's capture circle) and its pair's colour. */
function paintTunnelIn(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string): void {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.arc(x + 1.5, y + 2, MG_TUNNEL_R + 4, 0, Math.PI * 2);
  ctx.fill();
  const ring = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, MG_TUNNEL_R + 4);
  ring.addColorStop(0, "#CFC6B8");
  ring.addColorStop(1, "#6E665C");
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(x, y, MG_TUNNEL_R + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, MG_TUNNEL_R + 2.6, 0, Math.PI * 2);
  ctx.stroke();
  const hole = ctx.createRadialGradient(x + 2, y + 2, 1, x, y, MG_TUNNEL_R);
  hole.addColorStop(0, "#000");
  hole.addColorStop(1, "#1B1612");
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(x, y, MG_TUNNEL_R, 0, Math.PI * 2);
  ctx.fill();
}

/** A tunnel's exit: a dark outlet flush with the turf, its pair's colour and chevrons the way the ball comes out. */
function paintTunnelOut(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, colour: string): void {
  const ang = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  // The outlet behind the ball's exit point: a half-round mouth facing the way out.
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.arc(-2, 0, 8, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-2, 0, 9.5, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.55 - k * 0.15})`;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(8 + k * 7, -4);
    ctx.lineTo(12 + k * 7, 0);
    ctx.lineTo(8 + k * 7, 4);
    ctx.stroke();
  }
  ctx.restore();
}

/** A banked curved wall: a stone kerb on the sim's own segments (its width the segments' thickness), lit on its face. */
function paintCurve(ctx: CanvasRenderingContext2D, c: NonNullable<MgHole["curves"]>[number]): void {
  const r = px(c.segs[0]?.r ?? 0);
  const path = () => {
    ctx.beginPath();
    c.segs.forEach((s, i) => {
      if (i === 0) ctx.moveTo(px(s.ax), px(s.ay));
      ctx.lineTo(px(s.bx), px(s.by));
    });
  };
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.translate(2, 3);
  path();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = r * 2;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  path();
  ctx.strokeStyle = "#8F8576";
  ctx.lineWidth = r * 2;
  ctx.stroke();
  path();
  ctx.strokeStyle = "#D8CFBF";
  ctx.lineWidth = r * 0.9;
  ctx.stroke();
  // Red and white banking stripes along the kerb.
  ctx.setLineDash([6, 6]);
  path();
  ctx.strokeStyle = "rgba(200,40,58,0.85)";
  ctx.lineWidth = r * 0.9;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** One piece of a gate's wall as a capsule on the sim's segment: stone (castle) or whitewashed brick (windmill house). */
function paintWallPiece(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, r: number, kind: "castle" | "mill"): void {
  const ang = Math.atan2(by - ay, bx - ax);
  const len = Math.hypot(bx - ax, by - ay);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.roundRect(-r + 2, -r + 3, len + r * 2, r * 2, r);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -r, 0, r);
  if (kind === "castle") {
    g.addColorStop(0, "#C9C0B2");
    g.addColorStop(0.5, "#9C9284");
    g.addColorStop(1, "#5E574E");
  } else {
    g.addColorStop(0, "#C8714E");
    g.addColorStop(0.5, "#9E4A30");
    g.addColorStop(1, "#5E2A1A");
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-r, -r, len + r * 2, r * 2, r);
  ctx.fill();
  if (kind === "castle") {
    // Battlements: merlons along the wall's top.
    ctx.fillStyle = "rgba(60,54,46,0.75)";
    for (let t = 2; t < len - 2; t += 8) ctx.fillRect(t, -r + 1.5, 4, r * 2 - 3);
    ctx.fillStyle = "rgba(230,224,214,0.6)";
    for (let t = 2; t < len - 2; t += 8) ctx.fillRect(t, -r + 1.5, 4, 1.5);
  } else {
    // Brick courses with pale mortar, and a slate coping along the top.
    ctx.strokeStyle = "rgba(240,220,200,0.35)";
    ctx.lineWidth = 0.7;
    for (const row of [-r * 0.5, r * 0.5]) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, row);
      ctx.lineTo(len + r * 0.6, row);
      ctx.stroke();
    }
    for (let t = 0, k = 0; t < len; t += 6, k++) {
      for (const [y0, y1] of [[-r * 0.5, r * 0.5], [r * 0.5, r * 0.95], [-r * 0.95, -r * 0.5]] as const) {
        const tt = t + ((k + (y0 > 0 ? 1 : 0)) % 2) * 3;
        ctx.beginPath();
        ctx.moveTo(tt, y0);
        ctx.lineTo(tt, y1);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#4E5560";
    ctx.beginPath();
    ctx.roundRect(-r * 0.5, -r * 0.22, len + r, r * 0.44, r * 0.22);
    ctx.fill();
  }
  ctx.restore();
}

/** A gate: its two wall pieces, round turrets at the archway (castle) and a stone lintel across it. */
function paintGate(ctx: CanvasRenderingContext2D, g: NonNullable<MgHole["gates"]>[number]): void {
  for (const s of g.segs) paintWallPiece(ctx, px(s.ax), px(s.ay), px(s.bx), px(s.by), px(s.r), g.kind);
  if (g.kind !== "castle") return;
  const r = MG_GATE_R;
  const half = px(g.half);
  const cx = px(g.cx);
  const cy = px(g.cy);
  const along = g.across ? { x: 1, y: 0 } : { x: 0, y: 1 };
  for (const side of [-1, 1]) {
    const tx = cx + along.x * half * side;
    const ty = cy + along.y * half * side;
    const tg = ctx.createRadialGradient(tx - 2, ty - 2, 1, tx, ty, r);
    tg.addColorStop(0, "#E2DACD");
    tg.addColorStop(1, "#7A7165");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4C4038";
    ctx.beginPath();
    ctx.arc(tx, ty, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  // The arch overhead: a thin stone span with a pennant (above the ball's path, so light and see-through).
  ctx.strokeStyle = "rgba(210,200,186,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - along.x * half, cy - along.y * half);
  ctx.lineTo(cx + along.x * half, cy + along.y * half);
  ctx.stroke();
  ctx.fillStyle = "#C8283A";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 7, cy - 4);
  ctx.lineTo(cx, cy - 7);
  ctx.closePath();
  ctx.fill();
}

/**
 * The windmill at a sim tick (drawn every frame). Its sails turn upright over the doorway, so from above they are drawn
 * as a cross whose hub stands MG_MILL_H beyond the wall (the house's far side) — the lower sail crosses the wall's line
 * exactly where the sim puts its foot. Everything beyond the line is overhead (the ball rolls under it), so it is drawn
 * see-through, and nothing of the sails is drawn on the near side but the foot itself, solid, on the sim's own capsule.
 */
export function drawWindmill(ctx: CanvasRenderingContext2D, m: NonNullable<MgHole["windmills"]>[number], tick: number): void {
  const hx0 = px(m.x);
  const hy0 = px(m.y);
  // Work in the wall's frame: x along the line, the house (and the hub above it) on the −y side.
  const base = (mgMillAngle(m, tick) / ANG_FULL) * Math.PI * 2;
  ctx.save();
  ctx.translate(hx0, hy0);
  if (!m.across) ctx.rotate(-Math.PI / 2);
  // Clip to the far side of the line (plus the foot's thickness): the sails above the doorway.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-MG_SAIL_LEN - 10, -MG_MILL_H - MG_SAIL_LEN - 10, (MG_SAIL_LEN + 10) * 2, MG_MILL_H + MG_SAIL_LEN + 10 + MG_SAIL_R);
  ctx.clip();
  ctx.translate(0, -MG_MILL_H);
  for (let k = 0; k < 4; k++) {
    // φ = 0 points straight down (towards the line); the sail's foot sits at H·tan φ along the line.
    const phi = base + (k * Math.PI) / 2;
    ctx.save();
    ctx.rotate(-phi * (m.across ? 1 : -1));
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-MG_SAIL_W / 2 + 2, 2, MG_SAIL_W, MG_SAIL_LEN);
    ctx.fillStyle = "#6B4426";
    ctx.fillRect(-1.5, 0, 3, MG_SAIL_LEN);
    ctx.fillStyle = "#EFE6D2";
    ctx.fillRect(-MG_SAIL_W / 2, MG_HUB_R + 2, MG_SAIL_W, MG_SAIL_LEN - MG_HUB_R - 2);
    ctx.strokeStyle = "#6B4426";
    ctx.lineWidth = 0.8;
    for (let t = MG_HUB_R + 6; t < MG_SAIL_LEN; t += 5) {
      ctx.beginPath();
      ctx.moveTo(-MG_SAIL_W / 2, t);
      ctx.lineTo(MG_SAIL_W / 2, t);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 0.85;
  const hg = ctx.createRadialGradient(-2, -2, 0.5, 0, 0, MG_HUB_R);
  hg.addColorStop(0, "#F2C75C");
  hg.addColorStop(1, "#7A5A1E");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, 0, MG_HUB_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.restore();
  // The feet in the doorway: solid, exactly the sim's capsules.
  for (const f of mgSails(m, tick)) {
    const s = f.seg;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#4A2E18";
    ctx.lineWidth = MG_SAIL_R * 2;
    ctx.beginPath();
    ctx.moveTo(px(s.ax), px(s.ay));
    ctx.lineTo(px(s.bx), px(s.by));
    ctx.stroke();
    ctx.strokeStyle = "#EFE6D2";
    ctx.lineWidth = MG_SAIL_R;
    ctx.beginPath();
    ctx.moveTo(px(s.ax), px(s.ay));
    ctx.lineTo(px(s.bx), px(s.by));
    ctx.stroke();
    ctx.restore();
  }
}

/** golfRev 2's static pieces under the rails: ramps' rails aside, the bunkers, hills and tunnel mouths. */
function paintFloorPieces(ctx: CanvasRenderingContext2D, h: MgHole): void {
  (h.sands ?? []).forEach((c, i) => paintSand(ctx, px(c.x), px(c.y), px(c.r), i + h.index * 13));
  (h.hills ?? []).forEach((c) => paintHill(ctx, px(c.x), px(c.y), px(c.r)));
  (h.tunnels ?? []).forEach((t, i) => {
    const colour = TUNNEL_COLOURS[i % TUNNEL_COLOURS.length]!;
    paintTunnelIn(ctx, px(t.x), px(t.y), colour);
    paintTunnelOut(ctx, px(t.ox), px(t.oy), t.dx, t.dy, colour);
  });
}

/** The whole static picture of a hole (terrace, lamps, turf, slopes, rails, hazards, cup), world px. */
export function paintMinigolfHole(ctx: CanvasRenderingContext2D, h: MgHole, salt: number): void {
  paintTerrace(ctx, MINIGOLF_W, MINIGOLF_H, salt + h.index * 101);
  // A soft shadow under the course.
  ctx.save();
  ctx.translate(3, 5);
  polyPath(ctx, h.poly);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fill();
  ctx.restore();
  paintTurf(ctx, h);
  paintSlopes(ctx, h);
  paintFloorPieces(ctx, h);
  paintTee(ctx, h);
  for (const p of h.ponds) paintPond(ctx, px(p.x), px(p.y), px(p.r));
  paintCup(ctx, h);
  paintRails(ctx, h);
  paintRampRails(ctx, h);
  h.logs.forEach((l) => paintLog(ctx, px(l.ax), px(l.ay), px(l.bx), px(l.by), px(l.r)));
  (h.curves ?? []).forEach((c) => paintCurve(ctx, c));
  (h.gates ?? []).forEach((g) => paintGate(ctx, g));
  h.rocks.forEach((c, i) => paintBoulder(ctx, px(c.x), px(c.y), px(c.r), i + h.index * 7));
  h.planters.forEach((c, i) => paintPlanter(ctx, px(c.x), px(c.y), px(c.r), i + h.index));
  paintLamps(ctx, MINIGOLF_W, MINIGOLF_H);
}

/* ================================= Frames ================================= */

const holeCache: { key: string; canvas: HTMLCanvasElement | OffscreenCanvas | null } = { key: "", canvas: null };

function cachedHole(ctx: CanvasRenderingContext2D, h: MgHole, seed: number): CanvasImageSource | null {
  const m = ctx.getTransform();
  const scale = Math.max(0.5, Math.min(4, Math.hypot(m.a, m.b)));
  const key = `${h.rev ?? 1}:${seed}:${h.index}:${scale.toFixed(3)}`;
  if (holeCache.key === key && holeCache.canvas) return holeCache.canvas;
  const w = Math.ceil(MINIGOLF_W * scale);
  const hh = Math.ceil(MINIGOLF_H * scale);
  let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  if (typeof OffscreenCanvas !== "undefined") canvas = new OffscreenCanvas(w, hh);
  else if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = hh;
    canvas = c;
  }
  const c2 = canvas?.getContext("2d") as CanvasRenderingContext2D | null;
  if (!canvas || !c2) return null;
  c2.scale(scale, scale);
  paintMinigolfHole(c2, h, seed & 1023);
  holeCache.key = key;
  holeCache.canvas = canvas;
  return canvas;
}

function drawFlag(ctx: CanvasRenderingContext2D, h: MgHole, tick: number, lowered: boolean): void {
  const x = px(h.cup.x);
  const y = px(h.cup.y);
  if (lowered) return;
  // Seen from above: the pin's shadow across the turf and a small cloth flag catching the lamp light.
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 16, y + 20);
  ctx.stroke();
  ctx.strokeStyle = "#E8E2D2";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 3, y - 22);
  ctx.stroke();
  const wave = Math.sin(tick / 9) * 1.5;
  ctx.fillStyle = "#C8283A";
  ctx.beginPath();
  ctx.moveTo(x + 3, y - 22);
  ctx.quadraticCurveTo(x + 10, y - 22 + wave, x + 16, y - 19 + wave);
  ctx.lineTo(x + 3, y - 14);
  ctx.closePath();
  ctx.fill();
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(x + 1.6, y + 2.2, MG_BALL_R, MG_BALL_R * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - 1.6, y - 1.8, 0.4, x, y, MG_BALL_R);
  g.addColorStop(0, "#FFFFFF");
  g.addColorStop(0.7, "#E4E7EA");
  g.addColorStop(1, "#A9AFB5");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, MG_BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, align: "left" | "right", accent = false): void {
  ctx.font = "600 11px Archivo, system-ui, sans-serif";
  const w = ctx.measureText(text).width + 14;
  const left = align === "left" ? x : x - w;
  ctx.fillStyle = "rgba(10,12,10,0.72)";
  ctx.beginPath();
  ctx.roundRect(left, y, w, 20, 10);
  ctx.fill();
  ctx.strokeStyle = accent ? "rgba(242,199,92,0.7)" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = accent ? "#F2C75C" : "#EDEBE4";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, left + 7, y + 10.5);
}

/** A frame: the cached hole, the flag, the ball, the aim (when dragging) and the chips. */
export function drawMinigolf(ctx: CanvasRenderingContext2D, s: MinigolfState, aim: MinigolfAim | null): void {
  const h = s.course[Math.min(s.hole, MINIGOLF_HOLES - 1)]!;
  const img = cachedHole(ctx, h, s.seed);
  if (img) ctx.drawImage(img, 0, 0, MINIGOLF_W, MINIGOLF_H);
  else paintMinigolfHole(ctx, h, s.seed & 1023);
  const holedNow = s.holed[s.hole] === 1 && (s.phase === MG_PAUSE || s.phase === MG_DONE);
  // The ball first when it sits in the cup (the flag is lifted out).
  const bx = px(s.x);
  const by = px(s.y);
  if (holedNow) {
    const t = Math.min(1, (s.tick - s.holedTick) / 18);
    drawBall(ctx, bx, by, 1 - t * 0.7);
    // A gold ring rising from the cup.
    ctx.strokeStyle = `rgba(242,199,92,${0.9 * (1 - t)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by, MG_CUP_R + t * 18, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawFlag(ctx, h, s.tick, holedNow);
  if (!holedNow) {
    if (s.phase === MG_ROLL) {
      // A faint trail behind a rolling ball.
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 0) {
        const tx = (-s.vx / sp) * Math.min(14, sp / 60);
        const ty = (-s.vy / sp) * Math.min(14, sp / 60);
        const g = ctx.createLinearGradient(bx, by, bx + tx, by + ty);
        g.addColorStop(0, "rgba(255,255,255,0.35)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = MG_BALL_R * 1.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + tx, by + ty);
        ctx.stroke();
      }
    }
    drawBall(ctx, bx, by);
  }
  // golfRev 2: the windmills' sails turn on the sim tick, over the ball.
  for (const m of h.windmills ?? []) drawWindmill(ctx, m, s.tick);
  // Water: a brief ripple where the ball went in is drawn by the effects layer; here the ball is already back.
  if (aim && s.phase === MG_AIM) drawAim(ctx, bx, by, aim);
  // HUD chips at the top corners (inside the garden beds).
  const par = s.pars[Math.min(s.hole, MINIGOLF_HOLES - 1)]!;
  chip(ctx, 8, 6, `Hole ${Math.min(s.hole + 1, MINIGOLF_HOLES)}/${MINIGOLF_HOLES} · Par ${par}`, "left");
  const strokes = holedNow ? s.taken[s.hole]! : s.strokes;
  chip(ctx, MINIGOLF_W - 8, 6, `Stroke ${Math.min(strokes + (s.phase === MG_AIM ? 1 : 0), MINIGOLF_STROKE_LIMIT)}/${MINIGOLF_STROKE_LIMIT}`, "right", strokes >= MINIGOLF_STROKE_LIMIT - 1);
}

/** The dotted aim line (its length the power) and the power pill beside the ball. */
function drawAim(ctx: CanvasRenderingContext2D, bx: number, by: number, aim: MinigolfAim): void {
  const len = 24 + aim.power * 150;
  ctx.save();
  ctx.lineCap = "round";
  for (let d = 10; d < len; d += 9) {
    const a = 0.85 * (1 - d / (len + 30));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(bx + aim.dx * d, by + aim.dy * d, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // The pull-back handle behind the ball (where the finger is).
  ctx.strokeStyle = "rgba(242,199,92,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx - aim.dx * 8, by - aim.dy * 8);
  ctx.lineTo(bx - aim.dx * (8 + aim.power * 60), by - aim.dy * (8 + aim.power * 60));
  ctx.stroke();
  // Power pill.
  const pct = `${Math.round(aim.power * 100)}%`;
  ctx.font = "700 11px Archivo, system-ui, sans-serif";
  const w = ctx.measureText(pct).width + 12;
  let x = bx + 12;
  let y = by - 28;
  if (x + w > MINIGOLF_W - 4) x = bx - 12 - w;
  if (y < 30) y = by + 12;
  ctx.fillStyle = "rgba(10,12,10,0.8)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, 18, 9);
  ctx.fill();
  const hue = 120 - aim.power * 120;
  ctx.strokeStyle = `hsl(${hue} 80% 55%)`;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#F5F5F0";
  ctx.textBaseline = "middle";
  ctx.fillText(pct, x + 6, y + 9.5);
  ctx.restore();
}

/** The arena scene beyond the world (display only, world units): more of the night terrace, darker towards the edges. */
export function minigolfScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const { left, top, right, bottom } = view;
  ctx.fillStyle = "#14110F";
  ctx.fillRect(left, top, right - left, bottom - top);
  const tile = 46;
  for (let row = Math.floor(top / tile) - 1; row * tile < bottom; row++) {
    const off = (row & 1) * (tile / 2);
    for (let col = Math.floor(left / tile) - 1; col * tile < right; col++) {
      const k = hash(row * 131 + col * 7);
      ctx.fillStyle = `hsl(28 8% ${11 + k * 5}%)`;
      ctx.fillRect(col * tile + off + 1.5, row * tile + 1.5, tile - 3, tile - 3);
    }
  }
  const cx = view.worldW / 2;
  const cy = view.worldH / 2;
  const g = ctx.createRadialGradient(cx, cy, Math.min(view.worldW, view.worldH) * 0.4, cx, cy, Math.max(right - left, bottom - top) * 0.8);
  g.addColorStop(0, "rgba(0,0,0,0.1)");
  g.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = g;
  ctx.fillRect(left, top, right - left, bottom - top);
}

/**
 * The game tile's scene (scripts/shots/tile-scenes/sports.tsx; display only): a corner of a hole on the night
 * terrace, its striped turf inside a timber rail, a boulder, the cup and flag, and the ball with its dotted aim.
 */
export function paintMinigolfTile(c: CanvasRenderingContext2D, size: number): void {
  const k = size / 104;
  c.save();
  c.scale(k, k);
  paintTerrace(c, 104, 104, 7);
  const fp256 = (v: number) => v * 256;
  const poly = [8, 10, 96, 10, 96, 96, 8, 96].map(fp256);
  const hole = {
    index: 0,
    poly,
    box: { x: 8, y: 10, w: 88, h: 86 },
    slopes: [],
  } as unknown as MgHole;
  c.save();
  c.translate(2, 3);
  polyPath(c, poly);
  c.fillStyle = "rgba(0,0,0,0.5)";
  c.fill();
  c.restore();
  paintTurf(c, hole);
  paintRails(c, hole);
  paintBoulder(c, 30, 40, 9, 3);
  paintCup(c, { cup: { x: fp256(70), y: fp256(32) } } as unknown as MgHole);
  drawFlag(c, { cup: { x: fp256(70), y: fp256(32) } } as unknown as MgHole, 9, false);
  for (let i = 0; i < 6; i++) {
    c.fillStyle = `rgba(255,255,255,${0.85 - i * 0.12})`;
    c.beginPath();
    c.arc(42 + i * 4.6, 74 - i * 6.2, 1.3, 0, Math.PI * 2);
    c.fill();
  }
  drawBall(c, 36, 80);
  paintLamps(c, 104, 104);
  c.restore();
}
