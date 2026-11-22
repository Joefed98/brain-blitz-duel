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
  mgChipLaunch,
  mgPuttVelocity,
  mgRollTickV3,
  MG_CHIP_PEAK_PX,
  MG_END_NONE,
  MG_LEVELS,
  mgMillAngle,
  mgSails,
  MG_AIM,
  MG_GATE_R,
  MG_HUB_R,
  MG_MILL_H,
  MG_MILL_PHI,
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
  mgStrokeLimit,
  MINIGOLF_W,
  type MgHole,
  type MinigolfState,
} from "./minigolf";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { NO_LOOK, type GameLook } from "./skins/look";
import { paintBallArt } from "./skins/ballArt";
import { minigolfBallArt, neonCourseCacheTag, neonCourseCup, neonCourseFlag, neonCourseHole, neonCourseScene, NEON_COURSE } from "./skins/minigolf.skins";
import { courseArt, courseArtKey, type CourseArt } from "./skins/minigolfCourse";
import { sceneImage } from "./skins/sceneImages";
import { paintBunkersV3, paintGroundLight, paintPlainTurf, paintPondsV3 } from "./minigolfV3Ground.renderer";

/** The look this draw uses (wave 2 skins): set by the public draw calls for their length, the default otherwise. */
let L: GameLook = NO_LOOK;

/** What the stage's drag shows (presentation only): the pull from the ball, as an aim and a power share. */
export interface MinigolfAim {
  /** Unit direction of the putt (world). */
  dx: number;
  dy: number;
  /** 0…1 of full power. */
  power: number;
  /** golfRev 3: the shot being aimed is a chip (else a putt). */
  chip?: boolean;
  /** golfRev 3: where the finger is (world px), for the rubber band; absent from the keyboard. */
  hx?: number;
  hy?: number;
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
function paintSlopes(ctx: CanvasRenderingContext2D, h: MgHole, chevrons = true): void {
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
    if (!chevrons) {
      // golfRev 3: no arrows (the slope reads through its light); kerbs of red and white along its sides instead.
      const lx = cx - across.x * span / 2;
      const ly = cy - across.y * span / 2;
      for (const side of [0, 1]) {
        const ox = lx + across.x * span * side;
        const oy = ly + across.y * span * side;
        ctx.save();
        ctx.lineCap = "butt";
        ctx.setLineDash([7, 7]);
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#E8E2D6";
        ctx.beginPath();
        ctx.moveTo(ox + dx * hw * 2 * 0 + (lowX - cx), oy + (lowY - cy));
        ctx.lineTo(ox + (crestX - cx), oy + (crestY - cy));
        ctx.stroke();
        ctx.lineDashOffset = 7;
        ctx.strokeStyle = "#C8283A";
        ctx.stroke();
        ctx.restore();
      }
      continue;
    }
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
  // golfRev 3's mills stand taller with broader sails (m.h, m.sw); the sails' length keeps golfRev 2's proportion.
  const H = m.h ?? MG_MILL_H;
  const SW = m.sw ?? MG_SAIL_W;
  const big = m.h !== undefined;
  // A sail just past the angle where its foot leaves the ground reaches no lower than the line (bounds rule).
  const LEN = big ? Math.floor(H / Math.cos((MG_MILL_PHI / ANG_FULL) * Math.PI * 2)) + 1 : MG_SAIL_LEN;
  ctx.save();
  ctx.translate(hx0, hy0);
  if (!m.across) ctx.rotate(-Math.PI / 2);
  // Clip to the far side of the line (plus the foot's thickness): the sails above the doorway.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-LEN - 10, -H - LEN - 10, (LEN + 10) * 2, H + LEN + 10 + MG_SAIL_R);
  ctx.clip();
  ctx.translate(0, -H);
  for (let k = 0; k < 4; k++) {
    // φ = 0 points straight down (towards the line); the sail's foot sits at H·tan φ along the line.
    const phi = base + (k * Math.PI) / 2;
    ctx.save();
    ctx.rotate(-phi * (m.across ? 1 : -1));
    ctx.globalAlpha = big ? 0.92 : 0.55;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-SW / 2 + 2, 2, SW, LEN);
    ctx.fillStyle = L.world ? NEON_COURSE.millArm : "#6B4426";
    ctx.fillRect(big ? -2.2 : -1.5, 0, big ? 4.4 : 3, LEN);
    ctx.fillStyle = L.world ? NEON_COURSE.sail : "#EFE6D2";
    ctx.fillRect(-SW / 2, MG_HUB_R + 2, SW, LEN - MG_HUB_R - 2);
    if (big) {
      ctx.strokeStyle = L.world ? NEON_COURSE.millArm : "#5A3A22";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(-SW / 2, MG_HUB_R + 2, SW, LEN - MG_HUB_R - 2);
      ctx.beginPath();
      ctx.moveTo(-SW / 2, MG_HUB_R + 2);
      ctx.lineTo(SW / 2, LEN);
      ctx.stroke();
    }
    ctx.strokeStyle = L.world ? NEON_COURSE.millLine : "#6B4426";
    ctx.lineWidth = 0.8;
    for (let t = MG_HUB_R + 6; t < LEN; t += 5) {
      ctx.beginPath();
      ctx.moveTo(-SW / 2, t);
      ctx.lineTo(SW / 2, t);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = big ? 1 : 0.85;
  const hg = ctx.createRadialGradient(-2, -2, 0.5, 0, 0, MG_HUB_R);
  hg.addColorStop(0, L.world ? NEON_COURSE.millLine : "#F2C75C");
  hg.addColorStop(1, L.world ? NEON_COURSE.millArm : "#7A5A1E");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, 0, big ? MG_HUB_R + 2 : MG_HUB_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.restore();
  // The feet in the doorway: solid, exactly the sim's capsules.
  for (const f of mgSails(m, tick)) {
    const s = f.seg;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = L.world ? NEON_COURSE.millLine : "#4A2E18";
    ctx.lineWidth = MG_SAIL_R * 2;
    ctx.beginPath();
    ctx.moveTo(px(s.ax), px(s.ay));
    ctx.lineTo(px(s.bx), px(s.by));
    ctx.stroke();
    ctx.strokeStyle = L.world ? NEON_COURSE.millArm : "#EFE6D2";
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
  if (L.world) {
    neonCourseHole(ctx, h, {
      floor: () => paintFloorPieces(ctx, h),
      slopes: () => paintSlopes(ctx, h),
      pieces: () => {
        for (const p of h.ponds) paintPond(ctx, px(p.x), px(p.y), px(p.r));
        paintRampRails(ctx, h);
        h.logs.forEach((l) => paintLog(ctx, px(l.ax), px(l.ay), px(l.bx), px(l.by), px(l.r)));
        (h.curves ?? []).forEach((c) => paintCurve(ctx, c));
        (h.gates ?? []).forEach((g) => paintGate(ctx, g));
        h.rocks.forEach((c, i) => paintBoulder(ctx, px(c.x), px(c.y), px(c.r), i + h.index * 7));
        h.planters.forEach((c, i) => paintPlanter(ctx, px(c.x), px(c.y), px(c.r), i + h.index));
      },
    });
    return;
  }
  const art = courseArt();
  if (h.rev === 3) {
    paintHoleV3(ctx, h, salt, art);
    return;
  }
  if (art) {
    paintHoleRedrawn(ctx, h, salt, art);
    return;
  }
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

/* ===================== The redrawn default course (behind its switch) ===================== */

/** A repeating pattern of a rendered tile, drawn at `scale` world px per image px (the tiles are rendered at 2×). */
function tilePattern(ctx: CanvasRenderingContext2D, img: HTMLImageElement, scale = 0.5, dx = 0, dy = 0): CanvasPattern | null {
  const p = ctx.createPattern(img, "repeat");
  if (p && typeof DOMMatrix !== "undefined") p.setTransform(new DOMMatrix().translateSelf(dx, dy).scaleSelf(scale, scale));
  return p;
}

/** The garden round the course: sandstone paving, planted beds with flowering shrubs, warm lamp pools. */
function paintGardenRedrawn(ctx: CanvasRenderingContext2D, w: number, h: number, salt: number, art: CourseArt): void {
  ctx.fillStyle = tilePattern(ctx, art.paving, 0.5, (salt % 7) * 23, 0) ?? "#2A241E";
  ctx.fillRect(0, 0, w, h);
  // A warm evening grade on the stone, so the lit course is the brightest thing.
  ctx.fillStyle = "rgba(26,16,8,0.42)";
  ctx.fillRect(0, 0, w, h);
  const beds: [number, number, number, number][] = [
    [0, 0, w, 26],
    [0, h - 26, w, 26],
    [0, 0, 18, h],
    [w - 18, 0, 18, h],
  ];
  for (const [x, y, bw, bh] of beds) {
    ctx.fillStyle = "#1A120C";
    ctx.fillRect(x, y, bw, bh);
  }
  // A stone kerb along each bed's inner edge.
  ctx.strokeStyle = "rgba(205,190,165,0.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 26, w - 36, h - 52);
  for (let i = 0; i < 64; i++) {
    const side = i % 4;
    const t = hash(i * 17 + salt);
    const u = hash(i * 29 + 3 + salt);
    const x = side === 0 || side === 1 ? t * w : side === 2 ? 6 + u * 6 : w - 12 + u * 6;
    const y = side === 2 || side === 3 ? t * h : side === 0 ? 6 + u * 12 : h - 18 + u * 12;
    const size = 22 + hash(i * 41 + salt) * 14;
    const img = art.shrubs[i % art.shrubs.length]!;
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  }
}

/** The fairway: rendered turf, mowing stripes along the hole, a soft shade under the rails. */
function paintTurfRedrawn(ctx: CanvasRenderingContext2D, h: MgHole, art: CourseArt): void {
  ctx.save();
  polyPath(ctx, h.poly);
  ctx.clip();
  const b = h.box;
  ctx.fillStyle = tilePattern(ctx, art.turf, 0.5, h.index * 37, h.index * 53) ?? TURF_A;
  ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  const stripe = 18;
  for (let y = b.y - 4, k = 0; y < b.y + b.h + 8; y += stripe, k++) {
    ctx.fillStyle = k & 1 ? "rgba(0,30,6,0.10)" : "rgba(225,255,190,0.09)";
    ctx.fillRect(b.x - 4, y, b.w + 8, stripe);
  }
  // Light falling from the top left across the green, then a soft shade along its edges (under the coping).
  const lg = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
  lg.addColorStop(0, "rgba(255,240,190,0.10)");
  lg.addColorStop(1, "rgba(0,12,4,0.10)");
  ctx.fillStyle = lg;
  ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  // A richer green through the blades (soft light keeps the texture and the stripes).
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = "rgba(70,170,40,0.55)";
  ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 9;
  polyPath(ctx, h.poly);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();
}

/** The rails as dressed-stone coping on exactly today's line and width, lit from the top left. */
function paintRailsRedrawn(ctx: CanvasRenderingContext2D, h: MgHole, art: CourseArt): void {
  const p = h.poly;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.save();
  ctx.translate(1.5, 2);
  polyPath(ctx, p);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.restore();
  polyPath(ctx, p);
  ctx.strokeStyle = tilePattern(ctx, art.stone, 0.5) ?? "#8A7A62";
  ctx.lineWidth = 8;
  ctx.stroke();
  // The coping's bevel: a lit upper-left lip, a shaded lower-right one.
  ctx.save();
  ctx.translate(-0.8, -0.8);
  polyPath(ctx, p);
  ctx.strokeStyle = "rgba(255,244,222,0.38)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(0.9, 1);
  polyPath(ctx, p);
  ctx.strokeStyle = "rgba(30,20,10,0.35)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  // The inner face on the collision line, crisp.
  ctx.save();
  polyPath(ctx, p);
  ctx.clip();
  polyPath(ctx, p);
  ctx.strokeStyle = "rgba(18,14,8,0.7)";
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.restore();
}

/** A bunker: rendered sand inside a turf lip, shaded from the top left (the sim's circle). */
function paintSandRedrawn(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, art: CourseArt): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(40,28,8,0.6)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r - 1.2, 0, Math.PI * 2);
  ctx.fillStyle = tilePattern(ctx, art.sand, 0.5, x, y) ?? "#DCC07E";
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.2, x, y, r);
  g.addColorStop(0, "rgba(255,248,225,0.18)");
  g.addColorStop(0.75, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(60,38,10,0.4)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/** A sprite drawn round a collision circle (its rendered footprint is 80 % of its frame), turned by `k`. */
function drawFootprint(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, r: number, k: number): void {
  const s = r * 2.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(k * 1.3);
  ctx.drawImage(img, -s / 2, -s / 2, s, s);
  ctx.restore();
}

/** The cup: a white liner, a deep hole shaded from the top left, a short-cut collar. */
function paintCupRedrawn(ctx: CanvasRenderingContext2D, h: MgHole): void {
  const x = px(h.cup.x);
  const y = px(h.cup.y);
  const collar = ctx.createRadialGradient(x, y, MG_CUP_R, x, y, MG_CUP_R + 14);
  collar.addColorStop(0, "rgba(190,250,160,0.28)");
  collar.addColorStop(1, "rgba(190,250,160,0)");
  ctx.fillStyle = collar;
  ctx.beginPath();
  ctx.arc(x, y, MG_CUP_R + 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F2F4EE";
  ctx.beginPath();
  ctx.arc(x, y, MG_CUP_R, 0, Math.PI * 2);
  ctx.fill();
  const hole = ctx.createRadialGradient(x + 1.6, y + 1.8, 0.5, x, y, MG_CUP_R - 1);
  hole.addColorStop(0, "#000000");
  hole.addColorStop(0.7, "#0A0806");
  hole.addColorStop(1, "#3A342C");
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(x, y, MG_CUP_R - 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function paintHoleRedrawn(ctx: CanvasRenderingContext2D, h: MgHole, salt: number, art: CourseArt): void {
  paintGardenRedrawn(ctx, MINIGOLF_W, MINIGOLF_H, salt + h.index * 101, art);
  ctx.save();
  ctx.translate(3, 5);
  polyPath(ctx, h.poly);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fill();
  ctx.restore();
  paintTurfRedrawn(ctx, h, art);
  paintSlopes(ctx, h);
  (h.sands ?? []).forEach((c) => paintSandRedrawn(ctx, px(c.x), px(c.y), px(c.r), art));
  (h.hills ?? []).forEach((c) => paintHill(ctx, px(c.x), px(c.y), px(c.r)));
  (h.tunnels ?? []).forEach((t, i) => {
    const colour = TUNNEL_COLOURS[i % TUNNEL_COLOURS.length]!;
    paintTunnelIn(ctx, px(t.x), px(t.y), colour);
    paintTunnelOut(ctx, px(t.ox), px(t.oy), t.dx, t.dy, colour);
  });
  paintTee(ctx, h);
  for (const p of h.ponds) paintPond(ctx, px(p.x), px(p.y), px(p.r));
  paintCupRedrawn(ctx, h);
  paintRailsRedrawn(ctx, h, art);
  paintRampRails(ctx, h);
  h.logs.forEach((l) => paintLog(ctx, px(l.ax), px(l.ay), px(l.bx), px(l.by), px(l.r)));
  (h.curves ?? []).forEach((c) => paintCurve(ctx, c));
  (h.gates ?? []).forEach((g) => paintGate(ctx, g));
  h.rocks.forEach((c, i) => drawFootprint(ctx, art.boulders[(i + h.index) % art.boulders.length]!, px(c.x), px(c.y), px(c.r), i + h.index * 7));
  h.planters.forEach((c, i) => drawFootprint(ctx, art.planter, px(c.x), px(c.y), px(c.r), i + h.index));
  paintLamps(ctx, MINIGOLF_W, MINIGOLF_H);
}

/**
 * golfRev 3's hole (the Crazy Golf overhaul, 15 Nov 2026): the redrawn garden and turf (or the plain ones without the
 * rendered art), then the ground's light and mowing (minigolfV3Ground.renderer.ts: slopes, hills and swells shown by
 * light and shadow and by the stripes bending over them, no arrows), raked bunkers and stone-edged ponds in their
 * natural shapes, and the same rails, walls, gates, boulders and planters as golfRev 2, each on the sim's geometry.
 */
function paintHoleV3(ctx: CanvasRenderingContext2D, h: MgHole, salt: number, art: CourseArt | null): void {
  if (art) paintGardenRedrawn(ctx, MINIGOLF_W, MINIGOLF_H, salt + h.index * 101, art);
  else paintTerrace(ctx, MINIGOLF_W, MINIGOLF_H, salt + h.index * 101);
  ctx.save();
  ctx.translate(3, 5);
  polyPath(ctx, h.poly);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fill();
  ctx.restore();
  if (art) {
    ctx.save();
    polyPath(ctx, h.poly);
    ctx.clip();
    const b = h.box;
    ctx.fillStyle = tilePattern(ctx, art.turf, 0.5, h.index * 37, h.index * 53) ?? TURF_A;
    ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = "rgba(70,170,40,0.55)";
    ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.restore();
  } else paintPlainTurf(ctx, h);
  paintGroundLight(ctx, h);
  // The edges' soft shade under the coping.
  ctx.save();
  polyPath(ctx, h.poly);
  ctx.clip();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 9;
  polyPath(ctx, h.poly);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();
  paintSlopes(ctx, h, false);
  paintBunkersV3(ctx, h, art ? tilePattern(ctx, art.sand, 0.5) : null);
  (h.tunnels ?? []).forEach((t, i) => {
    const colour = TUNNEL_COLOURS[i % TUNNEL_COLOURS.length]!;
    paintTunnelInV3(ctx, px(t.x), px(t.y), colour);
    paintTunnelOutV3(ctx, px(t.ox), px(t.oy), t.dx, t.dy, colour);
  });
  paintTee(ctx, h);
  paintPondsV3(ctx, h, art ? tilePattern(ctx, art.stone, 0.5) : null);
  (h.bridges ?? []).forEach((b) => paintBridge(ctx, b));
  (h.swells ?? []).filter((w) => w.bowl).forEach((w) => paintBowlRim(ctx, px(w.x), px(w.y), px(w.r)));
  if (art) paintCupRedrawn(ctx, h);
  else paintCup(ctx, h);
  if (art) paintRailsRedrawn(ctx, h, art);
  else paintRails(ctx, h);
  paintRampRails(ctx, h);
  h.logs.forEach((l) => paintLog(ctx, px(l.ax), px(l.ay), px(l.bx), px(l.by), px(l.r)));
  (h.curves ?? []).forEach((c) => paintCurve(ctx, c));
  // Round 2: the buildings. A castle's towers are the last of the planters (the sim meets them as planters).
  const towers = h.towers ?? [];
  const ownPlanters = h.planters.slice(0, h.planters.length - towers.length);
  let tw = 0;
  (h.gates ?? []).forEach((g, k) => {
    if (g.kind === "mill") paintMillHouseV3(ctx, g, k + h.index * 3);
    else {
      paintCastleV3(ctx, g, towers.slice(tw, tw + 2), k + h.index * 3);
      tw += 2;
    }
  });
  (h.loops ?? []).forEach((l) => paintLoopV3(ctx, l));
  if (art) {
    h.rocks.forEach((c, i) => drawFootprint(ctx, art.boulders[(i + h.index) % art.boulders.length]!, px(c.x), px(c.y), px(c.r), i + h.index * 7));
    ownPlanters.forEach((c, i) => drawFootprint(ctx, art.planter, px(c.x), px(c.y), px(c.r), i + h.index));
  } else {
    h.rocks.forEach((c, i) => paintBoulder(ctx, px(c.x), px(c.y), px(c.r), i + h.index * 7));
    ownPlanters.forEach((c, i) => paintPlanter(ctx, px(c.x), px(c.y), px(c.r), i + h.index));
  }
  paintLamps(ctx, MINIGOLF_W, MINIGOLF_H);
}

/**
 * A bridge over water (golfRev 3): its shadow on the water, a deck of oiled planks laid across it (grain, joints, the
 * near edge lit and the far edge shaded), the low timber rails along its long sides drawn by the logs pass on their own
 * segments.
 */
function paintBridge(ctx: CanvasRenderingContext2D, b: NonNullable<MgHole["bridges"]>[number]): void {
  const x0 = px(b.x0);
  const y0 = px(b.y0);
  const w = px(b.x1) - x0;
  const hgt = px(b.y1) - y0;
  const along = w >= hgt;
  ctx.save();
  ctx.fillStyle = "rgba(0,12,20,0.45)";
  ctx.fillRect(x0 + 2.5, y0 + 3.5, w, hgt);
  const g = along ? ctx.createLinearGradient(0, y0, 0, y0 + hgt) : ctx.createLinearGradient(x0, 0, x0 + w, 0);
  g.addColorStop(0, "#B98A55");
  g.addColorStop(0.5, "#9C6C3C");
  g.addColorStop(1, "#7A5129");
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, w, hgt);
  // Planks across the deck: a dark joint and a lit edge each, and a fine grain.
  const n = Math.max(3, Math.round((along ? w : hgt) / 7));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    ctx.strokeStyle = "rgba(48,28,10,0.55)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    if (along) {
      ctx.moveTo(x0 + w * t, y0);
      ctx.lineTo(x0 + w * t, y0 + hgt);
    } else {
      ctx.moveTo(x0, y0 + hgt * t);
      ctx.lineTo(x0 + w, y0 + hgt * t);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,226,180,0.30)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    if (along) {
      ctx.moveTo(x0 + w * t + 0.9, y0);
      ctx.lineTo(x0 + w * t + 0.9, y0 + hgt);
    } else {
      ctx.moveTo(x0, y0 + hgt * t + 0.9);
      ctx.lineTo(x0 + w, y0 + hgt * t + 0.9);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(60,36,14,0.22)";
  ctx.lineWidth = 0.5;
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    if (along) {
      const yy = y0 + hgt * (0.15 + k * 0.14);
      ctx.moveTo(x0, yy);
      ctx.bezierCurveTo(x0 + w * 0.3, yy - 1, x0 + w * 0.6, yy + 1, x0 + w, yy);
    } else {
      const xx = x0 + w * (0.15 + k * 0.14);
      ctx.moveTo(xx, y0);
      ctx.bezierCurveTo(xx - 1, y0 + hgt * 0.3, xx + 1, y0 + hgt * 0.6, xx, y0 + hgt);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A loop-the-loop (golfRev 3): the lane between its rails a dark steel trough, the rails polished chrome on posts (the
 * sim's tall rail segments, within the bounds rule), and the loop itself standing over the lane's middle: a glossy red
 * tube in a tall ellipse with a crisp white highlight down its near side, casting its shadow to the lower right.
 */
function paintLoop(ctx: CanvasRenderingContext2D, l: NonNullable<MgHole["loops"]>[number]): void {
  const ax = px(l.ax);
  const ay = px(l.ay);
  const bx = px(l.bx);
  const by = px(l.by);
  const dx = l.dx / 4096;
  const dy = l.dy / 4096;
  const len = Math.hypot(bx - ax, by - ay);
  const half = 13;
  const nx = -dy;
  const ny = dx;
  ctx.save();
  // The trough.
  ctx.fillStyle = "rgba(20,24,28,0.55)";
  ctx.beginPath();
  ctx.moveTo(ax + nx * half, ay + ny * half);
  ctx.lineTo(bx + nx * half, by + ny * half);
  ctx.lineTo(bx - nx * half, by - ny * half);
  ctx.lineTo(ax - nx * half, ay - ny * half);
  ctx.closePath();
  ctx.fill();
  // The chrome rails (their posts first).
  for (const side of [-1, 1]) {
    const sx = nx * half * side;
    const sy = ny * half * side;
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.arc(ax + (bx - ax) * t + sx + 1.2, ay + (by - ay) * t + sy + 1.6, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createLinearGradient(ax + sx - nx * 3, ay + sy - ny * 3, ax + sx + nx * 3, ay + sy + ny * 3);
    g.addColorStop(0, "#5E666E");
    g.addColorStop(0.45, "#F4F7FA");
    g.addColorStop(1, "#7C858E");
    ctx.strokeStyle = g;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax + sx, ay + sy);
    ctx.lineTo(bx + sx, by + sy);
    ctx.stroke();
  }
  // The loop standing over the middle of the lane.
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const rot = Math.atan2(dy, dx);
  const rx = len * 0.32;
  const ry = half + 9;
  ctx.translate(mx, my);
  ctx.rotate(rot);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(4, 6, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  const tube = ctx.createLinearGradient(0, -ry - 4, 0, ry + 4);
  tube.addColorStop(0, "#7A0E14");
  tube.addColorStop(0.35, "#D7262E");
  tube.addColorStop(0.65, "#B81B23");
  tube.addColorStop(1, "#5A0A0E");
  ctx.strokeStyle = tube;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  // The gloss: a crisp highlight along the near (upper-left) side of the tube.
  ctx.strokeStyle = "rgba(255,240,236,0.85)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(-0.8, -1.2, rx - 1.6, ry - 1.6, 0, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  ctx.restore();
}

/** A bowl's rim (golfRev 3): the light pass shades the hollow; the rim's crest is a fine lit line on its far side. */
function paintBowlRim(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(230,255,200,0.30)";
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,24,8,0.30)";
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.restore();
}

/** Beyond the world: more of the paved garden, darker towards the edges. */
function paintSceneRedrawn(ctx: CanvasRenderingContext2D, view: ArenaSceneView, art: CourseArt): void {
  const { left, top, right, bottom } = view;
  ctx.fillStyle = tilePattern(ctx, art.paving, 0.5) ?? "#2A241E";
  ctx.fillRect(left, top, right - left, bottom - top);
  ctx.fillStyle = "rgba(26,16,8,0.5)";
  ctx.fillRect(left, top, right - left, bottom - top);
  const cx = view.worldW / 2;
  const cy = view.worldH / 2;
  const g = ctx.createRadialGradient(cx, cy, Math.min(view.worldW, view.worldH) * 0.4, cx, cy, Math.max(right - left, bottom - top) * 0.8);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(left, top, right - left, bottom - top);
}

/* ================================= Frames ================================= */

const holeCache: { key: string; canvas: HTMLCanvasElement | OffscreenCanvas | null } = { key: "", canvas: null };

function cachedHole(ctx: CanvasRenderingContext2D, h: MgHole, seed: number): CanvasImageSource | null {
  const m = ctx.getTransform();
  const scale = Math.max(0.5, Math.min(4, Math.hypot(m.a, m.b)));
  const key = `${h.rev ?? 1}:${h.holeId ?? ""}:${seed}:${h.index}:${scale.toFixed(3)}${L.world ? `:${L.world}${neonCourseCacheTag()}` : courseArtKey()}`;
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
  if (L.world) neonCourseCup(ctx, x, y);
  if (lowered) return;
  if (L.world) {
    neonCourseFlag(ctx, x, y, tick);
    return;
  }
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

/** The ball's drawn radius: 1.5 px over the sim's MG_BALL_R (3 Nov 2026, display only; inside the bounds rule's 2 px). */
const MG_BALL_DRAW_R = MG_BALL_R + 1.5;
function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, alpha = 1): void {
  const MG_BALL_R = MG_BALL_DRAW_R;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(x + 1.6, y + 2.2, MG_BALL_R, MG_BALL_R * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  const art = minigolfBallArt(L);
  if (art) {
    paintBallArt(ctx, art, x, y, MG_BALL_R);
    ctx.globalAlpha = 1;
    return;
  }
  if (L.world) {
    // The Neon Course's ball: the art's glowing white ball (no skin equipped).
    ctx.fillStyle = NEON_COURSE.ball;
    ctx.beginPath();
    ctx.arc(x, y, MG_BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
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
export function drawMinigolf(ctx: CanvasRenderingContext2D, s: MinigolfState, aim: MinigolfAim | null, look: GameLook = NO_LOOK): void {
  drawMinigolfCourse(ctx, s, aim, look);
  drawMinigolfHud(ctx, s);
}

/**
 * The play screen's view (3 Nov 2026, display only; Joe's audit): the stage is 390 × MINIGOLF_VIEW_H, so the
 * course reaches down over what was a band of bare terrace, and each hole is zoomed to fill it (the early, smaller
 * holes most). The camera is fixed per hole (from the hole's own box, never the ball), and a putt is a pull
 * relative to where the finger went down, so no input maps differently and the sim is untouched.
 */
export const MINIGOLF_VIEW_H = 720;
const MG_CAM_MARGIN = 10;
export interface MinigolfCamera { k: number; x: number; y: number }
export function minigolfCamera(s: Pick<MinigolfState, "course" | "hole">, viewH = MINIGOLF_VIEW_H): MinigolfCamera {
  const h = s.course[Math.min(s.hole, MINIGOLF_HOLES - 1)]!;
  const b = h.box;
  const k = Math.max(1, Math.min(MINIGOLF_W / (b.w + 2 * MG_CAM_MARGIN), viewH / (b.h + 2 * MG_CAM_MARGIN), 1.3));
  return { k, x: MINIGOLF_W / 2 - (b.x + b.w / 2) * k, y: viewH / 2 - (b.y + b.h / 2) * k };
}

/** The live round: the terrace over the whole view, the hole under its camera (effects too), the HUD unzoomed. */
export function drawMinigolfPlay(
  ctx: CanvasRenderingContext2D,
  s: MinigolfState,
  drawWorld: () => void,
  viewH = MINIGOLF_VIEW_H,
  look: GameLook = NO_LOOK,
): void {
  const cam = minigolfCamera(s, viewH);
  paintMinigolfScene(ctx, { worldW: MINIGOLF_W, worldH: viewH, left: 0, top: 0, right: MINIGOLF_W, bottom: viewH, scale: 1 }, look);
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.k, cam.k);
  drawWorld();
  ctx.restore();
  if (s.rev >= 3) paintViewSideFade(ctx, viewH);
  drawMinigolfHud(ctx, s);
}

/** How far in from the view's sides golfRev 3's fade reaches (px), and its darkness at the very edge. */
const SIDE_FADE_W = 24;
const SIDE_FADE_A = 0.38;

/**
 * golfRev 3's holes fill the view's width (the camera stays at 1×), so the paving at its sides would meet the darker
 * terrace beyond as a seam and the course's kerb would read as a frame line: a soft fade to the terrace's shade over
 * the outer 24 px of either side (display only).
 */
function paintViewSideFade(ctx: CanvasRenderingContext2D, viewH: number): void {
  for (const [x0, x1] of [[0, SIDE_FADE_W], [MINIGOLF_W, MINIGOLF_W - SIDE_FADE_W]] as const) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, `rgba(14,9,5,${SIDE_FADE_A})`);
    g.addColorStop(1, "rgba(14,9,5,0)");
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x1), 0, SIDE_FADE_W, viewH);
  }
}

/** The hole, flag, ball, sails and aim in world px (no HUD). */
export function drawMinigolfCourse(ctx: CanvasRenderingContext2D, s: MinigolfState, aim: MinigolfAim | null, look: GameLook = NO_LOOK): void {
  L = look;
  try {
    drawCourseLooked(ctx, s, aim);
  } finally {
    L = NO_LOOK;
  }
}

function drawCourseLooked(ctx: CanvasRenderingContext2D, s: MinigolfState, aim: MinigolfAim | null): void {
  if (s.rev >= 3) {
    drawCourseV3(ctx, s, aim);
    return;
  }
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
}

/** The HUD chips at the top corners (world px, never under the hole's camera). */
export function drawMinigolfHud(ctx: CanvasRenderingContext2D, s: MinigolfState): void {
  if (s.rev >= 3) {
    drawHudV3(ctx, s);
    return;
  }
  const holedNow = s.holed[s.hole] === 1 && (s.phase === MG_PAUSE || s.phase === MG_DONE);
  // HUD chips at the top corners (inside the garden beds).
  const par = s.pars[Math.min(s.hole, MINIGOLF_HOLES - 1)]!;
  chip(ctx, 8, 6, `Hole ${Math.min(s.hole + 1, MINIGOLF_HOLES)}/${MINIGOLF_HOLES} · Par ${par}`, "left");
  const strokes = holedNow ? s.taken[s.hole]! : s.strokes;
  const limit = mgStrokeLimit(s.rev, par);
  chip(ctx, MINIGOLF_W - 8, 6, `Stroke ${Math.min(strokes + (s.phase === MG_AIM ? 1 : 0), limit)}/${limit}`, "right", strokes >= limit - 1);
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
  paintMinigolfScene(ctx, view, NO_LOOK);
}

/** The scene in a look (wave 2 skins): the live stage's, the player's own. */
export function minigolfSceneFor(look: GameLook): (ctx: CanvasRenderingContext2D, view: ArenaSceneView) => void {
  return look.world ? (ctx, view) => paintMinigolfScene(ctx, view, look) : minigolfScene;
}

function paintMinigolfScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView, look: GameLook): void {
  const { left, top, right, bottom } = view;
  if (look.world) {
    neonCourseScene(ctx, view);
    return;
  }
  const art = courseArt();
  if (art) {
    paintSceneRedrawn(ctx, view, art);
    return;
  }
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
/**
 * The tile (15 Nov 2026, the overhaul's look): a golfRev 3 corner built for the tile in a 208-unit square and drawn by
 * the game's own painters: the lit turf, a stone-edged pond under a plank bridge, a red loop-the-loop over its chrome
 * rails, the cup in its bowl with the flag, and the ball with Captain Joulz addressing it.
 */
export function paintMinigolfTileV3(c: CanvasRenderingContext2D, size: number): void {
  const f = (v: number) => v * 256;
  const poly = [10, 12, 198, 12, 198, 198, 10, 198].map(f);
  const segs = [];
  for (let i = 0; i < poly.length; i += 2) {
    const j = (i + 2) % poly.length;
    segs.push({ ax: poly[i]!, ay: poly[i + 1]!, bx: poly[j]!, by: poly[j + 1]!, r: 0 });
  }
  // A windmill (round 3: the house either side of the doorway, its sails over it) across the right of the green.
  const wy = f(124);
  const cxm = f(140);
  const halfM = f(24);
  const mill = {
    kind: "mill",
    ax: f(86), ay: wy, bx: f(198), by: wy, cx: cxm, cy: wy, half: halfM, across: true,
    segs: [
      { ax: f(86), ay: wy, bx: cxm - halfM, by: wy, r: f(5) },
      { ax: cxm + halfM, ay: wy, bx: f(198), by: wy, r: f(5) },
    ],
    boxes: [
      { x0: cxm - halfM - f(22), y0: wy - f(40), x1: cxm - halfM, y1: wy },
      { x0: cxm + halfM, y0: wy - f(40), x1: cxm + halfM + f(22), y1: wy },
    ],
  };
  const bridge = { x0: f(55), y0: f(116), x1: f(79), y1: f(190) };
  const hole = {
    index: 0,
    shape: "straight",
    poly,
    tee: { x: f(118), y: f(186) },
    cup: { x: f(146), y: f(50) },
    logs: [
      { ax: bridge.x0, ay: bridge.y0, bx: bridge.x0, by: bridge.y1, r: f(2) },
      { ax: bridge.x1, ay: bridge.y0, bx: bridge.x1, by: bridge.y1, r: f(2) },
    ],
    rocks: [{ x: f(108), y: f(84), r: f(9) }],
    planters: [],
    ponds: [
      { x: f(30), y: f(146), r: f(22) },
      { x: f(64), y: f(154), r: f(24) },
      { x: f(98), y: f(162), r: f(20) },
    ],
    pondGroups: [0, 0, 0],
    sands: [
      { x: f(52), y: f(56), r: f(14) },
      { x: f(70), y: f(66), r: f(11) },
    ],
    sandGroups: [0, 0],
    slopes: [],
    swells: [{ x: f(146), y: f(54), r: f(34), k: -14, bowl: true }],
    segs,
    reach: 1,
    box: { x: 10, y: 12, w: 188, h: 186 },
    rev: 3,
    gates: [mill],
    bridges: [bridge],
  } as unknown as MgHole;
  c.save();
  c.scale(size / 208, size / 208);
  paintHoleV3(c, hole, 7, courseArt());
  drawFlag(c, hole, 9, false);
  drawWindmill(c, { x: cxm, y: wy, spin: 0, phase: 4600, w4096: 0, across: true, h: 34, sw: 15 }, 0);
  for (let i = 0; i < 5; i++) {
    c.fillStyle = `rgba(255,255,255,${0.88 - i * 0.14})`;
    c.beginPath();
    c.arc(121 + i * 3.2, 172 - i * 12, 2.2, 0, Math.PI * 2);
    c.fill();
  }
  drawCaptain(c, 118, 186, 0.26, -0.97, "address", 1);
  drawBall(c, 118, 186);
  c.restore();
}

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

/* ========================= golfRev 3: the overhaul's frame ========================= */

/**
 * golfRev 3's frame (the Crazy Golf overhaul, 15 Nov 2026; display only): the cached hole, then Captain Joulz beside
 * the ball (a top-down sprite from the approved 3D Captain, docs/design/cosmetics-redraws/blender/captain/
 * golf_sprites.py: addressing the ball while aiming, his follow-through after the strike; always to the side of the
 * line, never over the aim or the pull), the ball (lifted over its shadow while a chip is in the air), the windmills,
 * the aim (the pull-back handle behind the ball and the level's preview: Easy's line to its first bounce, Normal's
 * full line, Hard's and Expert's shorter ones; a chip's arc to its landing) and the moments: a white flash on a rail,
 * a rattle and wobble over the cup's lip, the ball dropping as the flag lifts (confetti on a birdie or better), a
 * splash ring in water, a puff of sand, a ring where a chip lands.
 */

/**
 * The Captain sprite's world size (px) and where the ball sits in it (sprite px of 256: ahead of the club's face). The
 * polish plan's C4.2 (Joe, 20 Nov 2026): half the size (was 120 on a 390 px course), re-rendered at a 28° camera tip
 * (was 38°), so the ball's point in the sprite moved up (was 152, 198).
 */
export const MG_CAPTAIN_PX = 60;
const CAPTAIN_BALL = { x: 152, y: 183 };
const CAPTAIN_HOLD = 70;

interface FrameMemory {
  tick: number;
  x: number;
  y: number;
  strokes: number;
  strikeDx: number;
  strikeDy: number;
  strikeTick: number;
  bounces: number;
  flashX: number;
  flashY: number;
  waters: number;
  splashX: number;
  splashY: number;
  splashTick: number;
  inSand: boolean;
  puffTick: number;
  puffX: number;
  puffY: number;
  landX: number;
  landY: number;
}
const memory = new WeakMap<object, FrameMemory>();

function memOf(s: MinigolfState): FrameMemory {
  let m = memory.get(s.course);
  if (!m || s.tick < m.tick) {
    m = { tick: s.tick, x: s.x, y: s.y, strokes: s.strokes, strikeDx: 0, strikeDy: -1, strikeTick: -999, bounces: s.bounces, flashX: 0, flashY: 0, waters: s.waters, splashX: 0, splashY: 0, splashTick: -999, inSand: false, puffTick: -999, puffX: 0, puffY: 0, landX: 0, landY: 0 };
    memory.set(s.course, m);
  }
  return m;
}

function inSandAt(h: MgHole, x: number, y: number): boolean {
  return (h.sands ?? []).some((c) => (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) < c.r * c.r);
}

/** Updates the frame memory from the state (the strike's direction, where a splash or puff happened). */
function noteFrame(s: MinigolfState, h: MgHole): FrameMemory {
  const m = memOf(s);
  if (s.tick !== m.tick) {
    if (s.strokes > m.strokes && s.phase === MG_ROLL) {
      const l = Math.hypot(s.vx, s.vy) || 1;
      m.strikeDx = s.vx / l;
      m.strikeDy = s.vy / l;
      m.strikeTick = s.tick;
    }
    if (s.bounces > m.bounces) {
      m.flashX = px(s.x);
      m.flashY = px(s.y);
    }
    if (s.waters > m.waters) {
      m.splashX = px(m.x);
      m.splashY = px(m.y);
      m.splashTick = s.tick;
    }
    const sandy = s.air === 0 && inSandAt(h, s.x, s.y);
    if (sandy && !m.inSand && s.phase === MG_ROLL) {
      m.puffTick = s.tick;
      m.puffX = px(s.x);
      m.puffY = px(s.y);
    }
    if (s.landTick === s.tick) {
      m.landX = px(s.x);
      m.landY = px(s.y);
    }
    m.inSand = sandy;
    m.tick = s.tick;
    m.x = s.x;
    m.y = s.y;
    m.strokes = s.strokes;
    m.bounces = s.bounces;
    m.waters = s.waters;
  }
  return m;
}

type CaptainPose = "address" | "back" | "putt" | "chipback" | "chip";
function captainImage(pose: CaptainPose): HTMLImageElement | null {
  return sceneImage(`mg.captain-${pose}`);
}

/** The Captain beside a ball at (bx, by), the shot's line `dir`, in a pose, at `alpha`. */
function drawCaptain(ctx: CanvasRenderingContext2D, bx: number, by: number, dx: number, dy: number, pose: CaptainPose, alpha: number): void {
  const img = captainImage(pose);
  if (!img || alpha <= 0) return;
  const th = Math.atan2(dy, dx);
  const k = MG_CAPTAIN_PX / 256;
  // The sprite's +X is the shot's line and its +Y points at the ball; the ball sits at CAPTAIN_BALL in the sprite.
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(bx, by);
  ctx.rotate(th);
  ctx.drawImage(img, -CAPTAIN_BALL.x * k, -CAPTAIN_BALL.y * k, 256 * k, 256 * k);
  ctx.restore();
}

/** A deterministic 0–1 hash (confetti, puffs). */
function h01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawCourseV3(ctx: CanvasRenderingContext2D, s: MinigolfState, aim: MinigolfAim | null): void {
  const h = s.course[Math.min(s.hole, MINIGOLF_HOLES - 1)]!;
  const img = cachedHole(ctx, h, s.seed);
  if (img) ctx.drawImage(img, 0, 0, MINIGOLF_W, MINIGOLF_H);
  else paintMinigolfHole(ctx, h, s.seed & 1023);
  const m = noteFrame(s, h);
  const holedNow = s.holed[s.hole] === 1 && (s.phase === MG_PAUSE || s.phase === MG_DONE);
  const bx = px(s.x);
  const by = px(s.y);
  const t = s.tick;

  // The Captain, under the ball and the aim: addressing it while aiming, following through after the strike.
  if (!holedNow && s.phase === MG_AIM) {
    let dx = aim?.dx ?? 0;
    let dy = aim?.dy ?? 0;
    if (!aim) {
      const l = Math.hypot(h.cup.x - s.x, h.cup.y - s.y) || 1;
      dx = (h.cup.x - s.x) / l;
      dy = (h.cup.y - s.y) / l;
    }
    // The stroke (round 2, Joe: "performing the stroke"): addressing the ball, then the backswing as the pull grows.
    const pose: CaptainPose = aim && aim.power >= 0.15 ? (aim.chip ? "chipback" : "back") : "address";
    drawCaptain(ctx, bx, by, dx, dy, pose, 0.96);
  } else if (s.phase === MG_ROLL || holedNow) {
    const since = t - m.strikeTick;
    if (since >= 0 && since < CAPTAIN_HOLD) {
      const fade = since < CAPTAIN_HOLD - 20 ? 0.96 : 0.96 * ((CAPTAIN_HOLD - since) / 20);
      drawCaptain(ctx, px(s.fromX), px(s.fromY), m.strikeDx, m.strikeDy, s.shot === 2 ? "chip" : "putt", fade);
    }
  }

  // Chip landing ring and the sand puff (under the ball).
  if (t - s.landTick < 22 && s.landTick > 0) {
    const k = (t - s.landTick) / 22;
    ctx.strokeStyle = `rgba(240,255,220,${0.6 * (1 - k)})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(m.landX, m.landY, 4 + k * 14, (4 + k * 14) * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (t - m.puffTick < 24 || t - s.sandTick < 24) {
    const at = t - m.puffTick < 24 ? m.puffTick : s.sandTick;
    const x0 = t - m.puffTick < 24 ? m.puffX : bx;
    const y0 = t - m.puffTick < 24 ? m.puffY : by;
    const k = (t - at) / 24;
    for (let i = 0; i < 9; i++) {
      const a = h01(at * 13 + i) * Math.PI * 2;
      const d = 3 + k * (8 + h01(i * 7 + at) * 8);
      ctx.fillStyle = `rgba(230,205,150,${0.55 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(x0 + Math.cos(a) * d, y0 + Math.sin(a) * d - k * 3, 1.6 + k * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Water: a splash ring and droplets where the ball went in (it is already back where it was played from).
  if (t - m.splashTick < 40) {
    const k = (t - m.splashTick) / 40;
    for (const r0 of [0, 0.35]) {
      const kk = Math.max(0, k - r0);
      ctx.strokeStyle = `rgba(210,240,255,${0.75 * (1 - kk)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(m.splashX, m.splashY, 3 + kk * 18, (3 + kk * 18) * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (k < 0.5)
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (h01(m.splashTick + i) - 0.5) * 2.2;
        const d = k * 30;
        ctx.fillStyle = `rgba(220,245,255,${0.8 * (1 - k * 2)})`;
        ctx.beginPath();
        ctx.arc(m.splashX + Math.cos(a) * d, m.splashY + Math.sin(a) * d * 0.7, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
  }

  if (holedNow) {
    // The ball drops into the cup (shrinking as it goes) and the flag is lifted out.
    const k = Math.min(1, (t - s.holedTick) / 16);
    drawBall(ctx, bx, by, 1 - k);
    const lift = Math.min(1, (t - s.holedTick) / 20);
    drawFlagLifted(ctx, h, t, lift);
    // Confetti on a birdie or better.
    const hole = Math.min(s.hole, MINIGOLF_HOLES - 1);
    if (s.taken[hole]! < s.pars[hole]! && t - s.holedTick < 40) {
      const kk = (t - s.holedTick) / 40;
      const colours = ["#F2C75C", "#7FD58A", "#5FD3E8", "#F28CB0", "#FFFFFF"];
      for (let i = 0; i < 24; i++) {
        const a = h01(i * 3.3) * Math.PI * 2;
        const v = 14 + h01(i * 5.1) * 26;
        const x = bx + Math.cos(a) * v * kk;
        const y = by + Math.sin(a) * v * kk + kk * kk * 22;
        ctx.fillStyle = colours[i % colours.length]!;
        ctx.globalAlpha = 1 - kk;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + kk * 6);
        ctx.fillRect(-1.6, -0.8, 3.2, 1.6);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  } else {
    drawFlag(ctx, h, t, false);
    // The rail flash.
    if (t - s.bounceTick < 8 && s.bounceTick > 0) {
      const k = (t - s.bounceTick) / 8;
      const g = ctx.createRadialGradient(m.flashX, m.flashY, 0, m.flashX, m.flashY, 10 + k * 6);
      g.addColorStop(0, `rgba(255,255,255,${0.8 * (1 - k)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(m.flashX, m.flashY, 10 + k * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.air > 0) {
      // A chip in the air: its shadow on the ground (the sim's position), the ball lifted and larger above it.
      const T = Math.max(1, s.airTotal);
      const u = (T - s.air) / T;
      const z = 4 * MG_CHIP_PEAK_PX * u * (1 - u);
      ctx.fillStyle = `rgba(0,0,0,${0.42 - z / 120})`;
      ctx.beginPath();
      ctx.ellipse(bx + z * 0.25, by + z * 0.3, MG_BALL_R + 1, MG_BALL_R * 0.8 + 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(bx - z * 0.3, by - z * 0.75);
      const sc = 1 + z / 70;
      ctx.scale(sc, sc);
      drawBall(ctx, 0, 0);
      ctx.restore();
    } else {
      if (s.phase === MG_ROLL) {
        const sp = Math.hypot(s.vx, s.vy);
        if (sp > 0) {
          const tx = (-s.vx / sp) * Math.min(18, sp / 50);
          const ty = (-s.vy / sp) * Math.min(18, sp / 50);
          const g = ctx.createLinearGradient(bx, by, bx + tx, by + ty);
          g.addColorStop(0, "rgba(255,255,255,0.32)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = g;
          ctx.lineWidth = MG_BALL_R * 1.5;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + tx, by + ty);
          ctx.stroke();
        }
      }
      // Over the lip: a quick wobble for a third of a second.
      const lip = t - s.lipTick < 20 && s.lipTick > 0 ? Math.sin((t - s.lipTick) * 1.9) * 1.6 * (1 - (t - s.lipTick) / 20) : 0;
      drawBall(ctx, bx + lip, by - Math.abs(lip) * 0.4);
    }
  }
  for (const w of h.windmills ?? []) drawWindmill(ctx, w, t);
  // A loop gone round: a white streak running round its tube for a quarter second; stalled: a scuff at its mouth.
  if (s.loopTick > 0 && t - s.loopTick < 16 && (h.loops ?? []).length) {
    const l = (h.loops ?? []).reduce((a, b) => (Math.hypot(px(b.bx) - bx, px(b.by) - by) < Math.hypot(px(a.bx) - bx, px(a.by) - by) ? b : a));
    const k = (t - s.loopTick) / 16;
    const mx = (px(l.ax) + px(l.bx)) / 2;
    const my = (px(l.ay) + px(l.by)) / 2;
    const len = Math.hypot(px(l.bx) - px(l.ax), px(l.by) - px(l.ay));
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(Math.atan2(l.dy, l.dx));
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    const a0 = Math.PI + k * Math.PI * 2;
    ctx.ellipse(0, 0, len * 0.32, 22, 0, a0, a0 + 1.2);
    ctx.stroke();
    ctx.restore();
  }
  if (aim && s.phase === MG_AIM) drawAimV3(ctx, s, h, bx, by, aim);
}

/** The flag being lifted out of the cup (lift 0 → 1): it rises off the cup, tilting, and fades. */
function drawFlagLifted(ctx: CanvasRenderingContext2D, h: MgHole, tick: number, lift: number): void {
  if (lift >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - lift;
  ctx.translate(0, -lift * 16);
  drawFlag(ctx, h, tick, false);
  ctx.restore();
}

/**
 * The aim: the old pull-back handle behind the ball (C4.1, 20 Nov 2026; golfRev 3 had a rubber band to the finger)
 * and the level's preview. A putt's preview is its line (Easy: rolled on a copy of the sim to its first bounce and a little past it;
 * Normal its full length; Hard 60 %; Expert 35 %); a chip's is its arc to the landing (the landing ring on Easy and
 * Normal). Display only: the sim never sees any of it.
 */
function drawAimV3(ctx: CanvasRenderingContext2D, s: MinigolfState, h: MgHole, bx: number, by: number, aim: MinigolfAim): void {
  const rules = MG_LEVELS[s.level];
  ctx.save();
  ctx.lineCap = "round";
  // The polish plan's C4.1 (Joe, 20 Nov 2026: "the new aiming is worse"): the old aim again: no rubber band, a short
  // pull-back handle behind the ball (where the finger is), the dotted line ahead and the power pill. The finger mapping
  // is unchanged; each level's preview still sets how much of the line shows, and Chip keeps its arc and landing ring.
  ctx.strokeStyle = aim.chip ? "rgba(95,211,232,0.6)" : "rgba(242,199,92,0.6)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(bx - aim.dx * 8, by - aim.dy * 8);
  ctx.lineTo(bx - aim.dx * (8 + aim.power * 60), by - aim.dy * (8 + aim.power * 60));
  ctx.stroke();

  const c = Math.max(1, Math.round(aim.power * 1000));
  const a = Math.round(aim.dx * 4000);
  const b = Math.round(aim.dy * 4000);
  if (aim.chip) {
    const launch = mgChipLaunch(a, b, c);
    const carry = Math.hypot(launch.vx, launch.vy) * launch.air / 256;
    const shown = carry * rules.preview;
    for (let d = 8; d < shown; d += 7) {
      const u = d / carry;
      const z = 4 * MG_CHIP_PEAK_PX * u * (1 - u);
      ctx.fillStyle = `rgba(200,245,255,${0.9 - 0.5 * u})`;
      ctx.beginPath();
      ctx.arc(bx + aim.dx * d - z * 0.3, by + aim.dy * d - z * 0.75, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (rules.preview >= 1) {
      ctx.strokeStyle = "rgba(200,245,255,0.8)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(bx + aim.dx * carry, by + aim.dy * carry, 7, 5.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (rules.bounce) {
    // Easy: the putt rolled on a copy of the sim (its own tick) to its first bounce, then a little past it.
    const v = mgPuttVelocity(a, b, c, 2);
    const ball = { x: s.x, y: s.y, vx: v.vx, vy: v.vy, air: 0 };
    let after = -1;
    const pts: { x: number; y: number; after: boolean }[] = [];
    for (let k = 1; k <= 240; k++) {
      const r = mgRollTickV3(h, ball, k, s.tick + k);
      if (r.hits > 0 && after < 0) after = 0;
      pts.push({ x: px(ball.x), y: px(ball.y), after: after >= 0 });
      if (after >= 0 && ++after > 14) break;
      if (r.end !== MG_END_NONE) break;
    }
    let last = { x: bx, y: by };
    let acc = 0;
    for (const p of pts) {
      acc += Math.hypot(p.x - last.x, p.y - last.y);
      last = p;
      if (acc < 9) continue;
      acc = 0;
      ctx.fillStyle = p.after ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.88)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const len = (24 + aim.power * 150) * rules.preview;
    for (let d = 10; d < len; d += 9) {
      const al = 0.88 * (1 - d / (len + 30));
      ctx.fillStyle = `rgba(255,255,255,${al})`;
      ctx.beginPath();
      ctx.arc(bx + aim.dx * d, by + aim.dy * d, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The power pill.
  const pct = `${Math.round(aim.power * 100)}%`;
  ctx.font = "700 13px Archivo, system-ui, sans-serif";
  const pw = ctx.measureText(pct).width + 14;
  let x = bx + 14;
  let y = by - 34;
  if (x + pw > MINIGOLF_W - 4) x = bx - 14 - pw;
  if (y < 30) y = by + 14;
  ctx.fillStyle = "rgba(10,12,10,0.82)";
  ctx.beginPath();
  ctx.roundRect(x, y, pw, 21, 10.5);
  ctx.fill();
  ctx.strokeStyle = `hsl(${120 - aim.power * 120} 80% 55%)`;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.fillStyle = "#F5F5F0";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(pct, x + 7, y + 11);
  ctx.restore();
}

/** A larger HUD chip (golfRev 3: 14 px type, the review's 9 px complaint). */
function chipV3(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, align: "left" | "right", accent = false): void {
  ctx.font = "700 14px Archivo, system-ui, sans-serif";
  const w = ctx.measureText(text).width + 18;
  const left = align === "left" ? x : x - w;
  ctx.fillStyle = "rgba(10,12,10,0.76)";
  ctx.beginPath();
  ctx.roundRect(left, y, w, 26, 13);
  ctx.fill();
  ctx.strokeStyle = accent ? "rgba(242,199,92,0.8)" : "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = accent ? "#F2C75C" : "#F2F0EA";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, left + 9, y + 13.5);
}

function drawHudV3(ctx: CanvasRenderingContext2D, s: MinigolfState): void {
  const hole = Math.min(s.hole, MINIGOLF_HOLES - 1);
  const holedNow = s.holed[s.hole] === 1 && (s.phase === MG_PAUSE || s.phase === MG_DONE);
  const par = s.pars[hole]!;
  chipV3(ctx, 8, 6, `Hole ${hole + 1} of ${MINIGOLF_HOLES} · Par ${par}`, "left");
  const strokes = holedNow ? s.taken[s.hole]! : s.strokes;
  const limit = mgStrokeLimit(s.rev, par, s.level);
  chipV3(ctx, MINIGOLF_W - 8, 6, `Stroke ${Math.min(strokes + (s.phase === MG_AIM ? 1 : 0), limit)} of ${limit}`, "right", strokes >= limit - 1);
}

/* ========================= The reveal's hole map (the redesigned reveal) ========================= */

/** A stroke as the reveal map draws it (world px; minigolf.ts minigolfShotTrace). */
export interface MinigolfRevealStroke {
  kind: "putt" | "chip";
  path: readonly { x: number; y: number; air: boolean }[];
  end: { x: number; y: number };
  water: boolean;
  holed: boolean;
  sand: boolean;
}

/**
 * One hole for the reveal, filling a `w × h` canvas (display only, 15 Nov 2026): the hole as it was played (the
 * default look), then every stroke drawn over it: a putt's roll a white line, a chip's flight a cyan dotted arc that
 * turns white where it rolled on, each stroke's resting spot numbered in order, a holed stroke ending in a gold ring,
 * a stroke into water a red ring where the ball went in and a sand stop a sand ring. The camera fits the hole's box.
 */
export function drawMinigolfRevealHole(ctx: CanvasRenderingContext2D, hole: MgHole, strokes: readonly MinigolfRevealStroke[], w: number, h: number, salt = 0): void {
  const b = hole.box;
  const margin = 6;
  const k = Math.min(w / (b.w + margin * 2), h / (b.h + margin * 2));
  ctx.save();
  ctx.fillStyle = MINIGOLF_BG;
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2 - (b.x + b.w / 2) * k, h / 2 - (b.y + b.h / 2) * k);
  ctx.scale(k, k);
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x - margin, b.y - margin, b.w + margin * 2, b.h + margin * 2);
  ctx.clip();
  paintMinigolfHole(ctx, hole, salt & 1023);
  ctx.restore();
  drawFlag(ctx, hole, 0, false);
  const lw = 2.2 / Math.max(0.6, k) + 1.2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  strokes.forEach((st) => {
    // The path: a dark casing, then white rolls and a cyan dotted flight.
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = lw + 2;
    ctx.beginPath();
    st.path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    for (let i = 1; i < st.path.length; i++) {
      const a = st.path[i - 1]!;
      const p = st.path[i]!;
      ctx.strokeStyle = p.air ? "#5FD3E8" : "#FFFFFF";
      ctx.setLineDash(p.air ? [lw * 1.2, lw * 1.6] : []);
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  });
  // The ends on top, numbered in play order.
  const r = 7.5 / Math.max(0.7, k) + 3;
  strokes.forEach((st, i) => {
    const { x, y } = st.end;
    if (st.holed) {
      ctx.strokeStyle = "#F2C75C";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(x, y, MG_CUP_R + 3, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = st.water ? "#E5484D" : st.sand ? "#C9A35A" : "#101410";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = st.water ? "#FFD6D6" : "#FFFFFF";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `800 ${Math.round(r * 1.25)}px Archivo, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), x, y + 0.5);
  });
  ctx.restore();
}

/* ======================= golfRev 3, round 2: the buildings (Joe, 15 Nov 2026) ======================= */

/** Rough stone: a base fill, then courses of lit and shaded blocks (deterministic from a salt). */
function stoneFill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hgt: number, salt: number, light = "#EAD9B6", mid = "#C3A77C", dark = "#7E6A4C"): void {
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + hgt);
  g.addColorStop(0, light);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, hgt);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, hgt);
  ctx.clip();
  const row = 5;
  for (let r = 0, yy = y; yy < y + hgt; r++, yy += row) {
    for (let xx = x - ((r % 2) * 4), k = 0; xx < x + w; k++, xx += 8) {
      const v = hash(salt + r * 31 + k * 7);
      ctx.fillStyle = v > 0.5 ? `rgba(255,250,240,${0.08 + v * 0.1})` : `rgba(30,24,18,${0.08 + v * 0.12})`;
      ctx.fillRect(xx + 0.6, yy + 0.6, 6.8, row - 1.2);
    }
  }
  ctx.restore();
}

/**
 * A castle (golfRev 3): its curtain wall on the sim's own pieces (stone, battlements), a round tower either side of the
 * gate on the sim's tower circles (a conical slate roof inside the tower's footprint, a pennant), the gatehouse's
 * arch over the opening (overhead, the ball rolls under it: see-through below the portcullis's teeth), and the keep on
 * its sim box where there is one (a square tower with battlements round its roof and a flag).
 */
function paintCastleV3(ctx: CanvasRenderingContext2D, g: NonNullable<MgHole["gates"]>[number], towers: NonNullable<MgHole["towers"]>, salt: number): void {
  const wall = g.segs.slice(0, 2);
  for (const s of wall) {
    const ax = px(s.ax);
    const ay = px(s.ay);
    const bx = px(s.bx);
    const by = px(s.by);
    const r = px(s.r);
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.5) continue;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(Math.atan2(by - ay, bx - ax));
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(-r + 2, -r + 4, len + r * 2, r * 2);
    stoneFill(ctx, -r, -r, len + r * 2, r * 2, salt + Math.round(ax));
    // The wall walk: a darker sunk band along the middle, then big merlons along both edges (the far row lit, the
    // near row in its own shade), each a raised stone block with a crisp lit top and a dark joint.
    ctx.fillStyle = "rgba(70,56,38,0.55)";
    ctx.fillRect(-r + 2, -r * 0.3, len + r * 2 - 4, r * 0.6);
    const mw = 7;
    for (let t = -r + 2; t + mw <= len + r - 2; t += mw * 2) {
      for (const [y0, hgt, face] of [[-r, r * 0.7, "#F1E2C3"], [r * 0.3, r * 0.7, "#B39469"]] as const) {
        ctx.fillStyle = face;
        ctx.fillRect(t, y0, mw, hgt);
        ctx.fillStyle = "rgba(255,248,230,0.75)";
        ctx.fillRect(t, y0, mw, 1.4);
        ctx.strokeStyle = "rgba(40,30,18,0.7)";
        ctx.lineWidth = 0.9;
        ctx.strokeRect(t + 0.45, y0 + 0.45, mw - 0.9, hgt - 0.9);
      }
    }
    ctx.strokeStyle = "rgba(20,16,12,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-r + 0.5, -r + 0.5, len + r * 2 - 1, r * 2 - 1);
    ctx.restore();
  }
  // The keep.
  for (const b of g.boxes ?? []) {
    const x0 = px(b.x0);
    const y0 = px(b.y0);
    const w = px(b.x1) - x0;
    const hgt = px(b.y1) - y0;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x0 + 4, y0 + 6, w, hgt);
    stoneFill(ctx, x0, y0, w, hgt, salt + 77, "#F0E1C2", "#C9AE84", "#806C4E");
    // The roof's walk, sunk inside the battlements, and the merlons round it.
    ctx.fillStyle = "#5E564C";
    ctx.fillRect(x0 + 5, y0 + 5, w - 10, hgt - 10);
    ctx.fillStyle = "rgba(255,240,220,0.12)";
    ctx.fillRect(x0 + 5, y0 + 5, w - 10, 3);
    for (let t = x0 + 1; t < x0 + w - 3; t += 7) {
      ctx.fillStyle = "#E6DECF";
      ctx.fillRect(t, y0, 4, 3);
      ctx.fillStyle = "#7E7468";
      ctx.fillRect(t, y0 + hgt - 3, 4, 3);
    }
    for (let t = y0 + 1; t < y0 + hgt - 3; t += 7) {
      ctx.fillStyle = "#D9D0C1";
      ctx.fillRect(x0, t, 3, 4);
      ctx.fillStyle = "#8A8074";
      ctx.fillRect(x0 + w - 3, t, 3, 4);
    }
    ctx.strokeStyle = "rgba(20,16,12,0.7)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x0 + 0.6, y0 + 0.6, w - 1.2, hgt - 1.2);
    // A flag on the roof.
    const fx = x0 + w / 2;
    const fy = y0 + hgt / 2;
    ctx.strokeStyle = "#2A2420";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(fx, fy + 4);
    ctx.lineTo(fx, fy - 16);
    ctx.stroke();
    ctx.fillStyle = "#C8283A";
    ctx.beginPath();
    ctx.moveTo(fx, fy - 16);
    ctx.lineTo(fx + 15, fy - 11.5);
    ctx.lineTo(fx, fy - 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#F2C75C";
    ctx.beginPath();
    ctx.arc(fx + 5, fy - 11.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // The gatehouse's arch over the opening, then the towers either side.
  const half = px(g.half);
  const cx = px(g.cx);
  const cy = px(g.cy);
  ctx.save();
  ctx.translate(cx, cy);
  if (!g.across) ctx.rotate(Math.PI / 2);
  const r = px(g.segs[0]?.r ?? 0) || MG_GATE_R;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(-half + 2, -r + 4, half * 2, r * 2);
  stoneFill(ctx, -half, -r - 2, half * 2, 6, salt + 5);
  ctx.strokeStyle = "rgba(20,16,12,0.65)";
  ctx.lineWidth = 1;
  ctx.strokeRect(-half + 0.5, -r - 1.5, half * 2 - 1, 5);
  // C4.3: the archway's shadow under the gatehouse, darker, so the gate reads as a way through the wall.
  ctx.fillStyle = "rgba(18,14,10,0.62)";
  ctx.fillRect(-half + 1, -r + 3, half * 2 - 2, 5);
  // The portcullis's teeth hanging under the arch (overhead).
  ctx.fillStyle = "#2E2722";
  for (let t = -half + 3; t < half - 2; t += 5) ctx.fillRect(t, -r + 3, 1.6, 3.5);
  ctx.restore();
  for (const t of towers) {
    const tx = px(t.x);
    const ty = px(t.y);
    const tr = px(t.r);
    // The polish plan's C4.3 (Joe, 20 Nov 2026: castles that read as castles from above): a tower casts a long shadow
    // across the green away from the light, so it stands up off the course (display only; the tower is the sim's circle).
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.beginPath();
    ctx.ellipse(tx + tr * 0.55, ty + tr * 0.75, tr * 1.05, tr * 0.8, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(tx + tr * 1.05, ty + tr * 1.35, tr * 0.7, tr * 0.5, 0.6, 0, Math.PI * 2);
    ctx.fill();
    // The tower's wall ring and its battlements.
    const rg = ctx.createRadialGradient(tx - tr * 0.4, ty - tr * 0.4, 1, tx, ty, tr);
    rg.addColorStop(0, "#F2E3C4");
    rg.addColorStop(0.7, "#C2A67B");
    rg.addColorStop(1, "#7A6548");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(tx, ty, tr, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      ctx.fillStyle = Math.cos(a - Math.PI * 1.25) > 0 ? "#EEE6D8" : "#7A7064";
      ctx.beginPath();
      ctx.arc(tx + Math.cos(a) * (tr - 2.2), ty + Math.sin(a) * (tr - 2.2), 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // The conical slate roof, lit from the upper left, with a crisp highlight.
    const rr = tr - 3.5;
    // C4.3: a cone you can see: twelve slate faces running up to a point leaning towards the viewer's upper left, each
    // face lit by how it faces the light (bright upper left, deep lower right), with a dark ridge between faces.
    const apx = tx - rr * 0.22, apy = ty - rr * 0.3;
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * Math.PI * 2, a1 = ((k + 1) / 12) * Math.PI * 2;
      const mid = (a0 + a1) / 2;
      const lit = 0.5 + 0.5 * Math.cos(mid - Math.PI * 1.25);
      const cr = Math.round(30 + 110 * lit), cg = Math.round(38 + 120 * lit), cb = Math.round(68 + 130 * lit);
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.beginPath();
      ctx.moveTo(apx, apy);
      ctx.lineTo(tx + Math.cos(a0) * rr, ty + Math.sin(a0) * rr);
      ctx.arc(tx, ty, rr, a0, a1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(10,12,24,0.5)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(apx, apy);
      ctx.lineTo(tx + Math.cos(a0) * rr, ty + Math.sin(a0) * rr);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(235,242,255,0.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(tx, ty, rr - 1.2, Math.PI * 1.05, Math.PI * 1.45);
    ctx.stroke();
    // The pennant on the roof's point.
    ctx.fillStyle = "#F2C75C";
    ctx.beginPath();
    ctx.moveTo(apx, apy - 1);
    ctx.lineTo(apx + 8, apy - 4);
    ctx.lineTo(apx, apy - 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2A2420";
    ctx.fillRect(apx - 0.6, apy - 8, 1.2, 8);
  }
}

/**
 * A windmill's house (golfRev 3): the two solid blocks either side of its doorway (the sim's boxes) under one body:
 * whitewashed walls with timber framing, a red tiled roof pitched along the wall with its ridge lit, and the doorway as
 * a dark arched passage through the house (the ball rolls through it; the sails turn in front of it every frame).
 */
function paintMillHouseV3(ctx: CanvasRenderingContext2D, g: NonNullable<MgHole["gates"]>[number], salt: number): void {
  for (const s of g.segs.slice(0, 2)) paintWallPiece(ctx, px(s.ax), px(s.ay), px(s.bx), px(s.by), px(s.r), "mill");
  const bs = g.boxes ?? [];
  if (bs.length < 2) return;
  const x0 = Math.min(...bs.map((b) => px(b.x0)));
  const y0 = Math.min(...bs.map((b) => px(b.y0)));
  const x1 = Math.max(...bs.map((b) => px(b.x1)));
  const y1 = Math.max(...bs.map((b) => px(b.y1)));
  const w = x1 - x0;
  const hgt = y1 - y0;
  const across = g.across;
  ctx.save();
  // The house's shadow.
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x0 + 5, y0 + 7, w, hgt);
  // The passage through the house: a dark floor between the blocks, deepest in the middle.
  const half = px(g.half);
  const cx = px(g.cx);
  const cy = px(g.cy);
  const pass = across ? ctx.createLinearGradient(cx - half, 0, cx + half, 0) : ctx.createLinearGradient(0, cy - half, 0, cy + half);
  pass.addColorStop(0, "#2A1D14");
  pass.addColorStop(0.5, "#130D09");
  pass.addColorStop(1, "#2A1D14");
  ctx.fillStyle = pass;
  if (across) ctx.fillRect(cx - half, y0, half * 2, hgt);
  else ctx.fillRect(x0, cy - half, w, half * 2);
  // Each block: whitewash and timber, under the roof.
  for (const b of bs) {
    const bx = px(b.x0);
    const by = px(b.y0);
    const bw = px(b.x1) - bx;
    const bh = px(b.y1) - by;
    const wg = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    wg.addColorStop(0, "#F4EEE2");
    wg.addColorStop(1, "#BDB3A2");
    ctx.fillStyle = wg;
    ctx.fillRect(bx, by, bw, bh);
  }
  // The roof over the whole house (blocks and passage alike: the passage runs under it), its ridge along the wall.
  const ridge = across ? y0 + hgt * 0.42 : x0 + w * 0.42;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 - 2, y0 - 2, w + 4, hgt + 4);
  ctx.clip();
  const tiles = (a0: number, a1: number, lightSide: boolean) => {
    const tg = across ? ctx.createLinearGradient(0, a0, 0, a1) : ctx.createLinearGradient(a0, 0, a1, 0);
    tg.addColorStop(0, lightSide ? "#D9603F" : "#8E3121");
    tg.addColorStop(1, lightSide ? "#A8422A" : "#5E1E14");
    ctx.fillStyle = tg;
    if (across) ctx.fillRect(x0, a0, w, a1 - a0);
    else ctx.fillRect(a0, y0, a1 - a0, hgt);
    ctx.strokeStyle = "rgba(40,10,4,0.4)";
    ctx.lineWidth = 0.8;
    for (let t = a0 + 4; t < a1; t += 4) {
      ctx.beginPath();
      if (across) {
        ctx.moveTo(x0, t);
        ctx.lineTo(x0 + w, t);
      } else {
        ctx.moveTo(t, y0);
        ctx.lineTo(t, y0 + hgt);
      }
      ctx.stroke();
    }
    for (let t = (across ? x0 : y0) + 3, k = 0; t < (across ? x1 : y1); t += 6, k++) {
      ctx.strokeStyle = "rgba(40,10,4,0.22)";
      ctx.beginPath();
      if (across) {
        ctx.moveTo(t, a0);
        ctx.lineTo(t, a1);
      } else {
        ctx.moveTo(a0, t);
        ctx.lineTo(a1, t);
      }
      ctx.stroke();
    }
  };
  // The roof stops short of the front wall: the whitewashed front shows below its eaves, with the doorway's arch.
  const eaves = across ? y1 - 12 : x1 - 12;
  tiles(across ? y0 : x0, ridge, true);
  tiles(ridge, eaves, false);
  ctx.strokeStyle = "rgba(255,226,200,0.85)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (across) {
    ctx.moveTo(x0, ridge);
    ctx.lineTo(x1, ridge);
  } else {
    ctx.moveTo(ridge, y0);
    ctx.lineTo(ridge, y1);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  if (across) ctx.fillRect(x0, eaves, w, 2.5);
  else ctx.fillRect(eaves, y0, 2.5, hgt);
  ctx.restore();
  // The front: whitewash with timber posts, the doorway's dark arch in the middle.
  if (across) {
    const fy = eaves + 2.5;
    const fg = ctx.createLinearGradient(0, fy, 0, y1);
    fg.addColorStop(0, "#F7F2E8");
    fg.addColorStop(1, "#CFC4B2");
    ctx.fillStyle = fg;
    ctx.fillRect(x0, fy, w, y1 - fy);
    ctx.fillStyle = "#5A3A22";
    for (const tx of [x0 + 2, cx - half - 4, cx + half + 2, x1 - 4]) ctx.fillRect(tx, fy, 2.2, y1 - fy);
    ctx.fillStyle = "#130D09";
    ctx.beginPath();
    ctx.moveTo(cx - half, y1);
    ctx.lineTo(cx - half, fy + 3);
    ctx.quadraticCurveTo(cx, fy - 2, cx + half, fy + 3);
    ctx.lineTo(cx + half, y1);
    ctx.closePath();
    ctx.fill();
    // A small window either side.
    for (const wx of [x0 + (cx - half - x0) / 2, cx + half + (x1 - cx - half) / 2]) {
      ctx.fillStyle = "#F2C75C";
      ctx.fillRect(wx - 2.5, fy + 2, 5, 4);
      ctx.strokeStyle = "#5A3A22";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(wx - 2.5, fy + 2, 5, 4);
    }
  }
  ctx.strokeStyle = "rgba(30,18,10,0.7)";
  ctx.lineWidth = 1;
  for (const b of bs) ctx.strokeRect(px(b.x0) + 0.5, px(b.y0) + 0.5, px(b.x1) - px(b.x0) - 1, px(b.y1) - px(b.y0) - 1);
  ctx.restore();
  void salt;
}

/** A tunnel's mouth (golfRev 3): a stone portal round a deep, dark hole (the sim's entrance radius), its pair's colour on the keystone. */
function paintTunnelInV3(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string): void {
  const R = MG_TUNNEL_R + 7;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.arc(x + 2.5, y + 3.5, R, 0, Math.PI * 2);
  ctx.fill();
  // Voussoirs: a ring of lit and shaded stones.
  for (let k = 0; k < 12; k++) {
    const a0 = (k / 12) * Math.PI * 2;
    const a1 = ((k + 0.92) / 12) * Math.PI * 2;
    const lit = Math.cos((a0 + a1) / 2 - Math.PI * 1.25);
    ctx.fillStyle = lit > 0.3 ? "#E3D9C8" : lit > -0.3 ? "#B2A695" : "#766C60";
    ctx.beginPath();
    ctx.arc(x, y, R, a0, a1);
    ctx.arc(x, y, MG_TUNNEL_R + 0.5, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y - R + 3.2, 2.6, 0, Math.PI * 2);
  ctx.fill();
  const hole = ctx.createRadialGradient(x + 2, y + 3, 1, x, y, MG_TUNNEL_R + 0.5);
  hole.addColorStop(0, "#000");
  hole.addColorStop(0.75, "#0A0705");
  hole.addColorStop(1, "#2B2119");
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(x, y, MG_TUNNEL_R + 0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** A tunnel's exit (golfRev 3): a half-round stone portal facing the way out, its pair's colour, its dark mouth. */
function paintTunnelOutV3(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, colour: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.arc(-1, 3, 15, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 7; k++) {
    const a0 = Math.PI / 2 + (k / 7) * Math.PI;
    const a1 = Math.PI / 2 + ((k + 0.9) / 7) * Math.PI;
    ctx.fillStyle = k % 2 ? "#C9BFAE" : "#9E9383";
    ctx.beginPath();
    ctx.arc(-3, 0, 15, a0, a1);
    ctx.arc(-3, 0, 9.5, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(-16, 0, 2.6, 0, Math.PI * 2);
  ctx.fill();
  const mouth = ctx.createLinearGradient(-12, 0, 0, 0);
  mouth.addColorStop(0, "#000");
  mouth.addColorStop(1, "#2B2119");
  ctx.fillStyle = mouth;
  ctx.beginPath();
  ctx.arc(-3, 0, 9.5, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * A loop-the-loop (golfRev 3) that reads as one: the lane between its chrome rails (the sim's rails), and over its middle
 * a tall vertical loop of red track standing up from the lane, seen from above and in front: the far half of the loop
 * rising behind (darker), the near half sweeping over the top (lit, with a crisp highlight), cross-ties along the track,
 * and its shadow on the turf.
 */
function paintLoopV3(ctx: CanvasRenderingContext2D, l: NonNullable<MgHole["loops"]>[number]): void {
  const ax = px(l.ax);
  const ay = px(l.ay);
  const bx = px(l.bx);
  const by = px(l.by);
  const dx = l.dx / 4096;
  const dy = l.dy / 4096;
  const len = Math.hypot(bx - ax, by - ay);
  const half = 13;
  const nx = -dy;
  const ny = dx;
  ctx.save();
  // The lane: a steel trough with the red track laid in it.
  ctx.fillStyle = "#3A3F45";
  ctx.beginPath();
  ctx.moveTo(ax + nx * half, ay + ny * half);
  ctx.lineTo(bx + nx * half, by + ny * half);
  ctx.lineTo(bx - nx * half, by - ny * half);
  ctx.lineTo(ax - nx * half, ay - ny * half);
  ctx.closePath();
  ctx.fill();
  const tr = ctx.createLinearGradient(ax + nx * 9, ay + ny * 9, ax - nx * 9, ay - ny * 9);
  tr.addColorStop(0, "#8E141B");
  tr.addColorStop(0.5, "#D02A31");
  tr.addColorStop(1, "#8E141B");
  ctx.strokeStyle = tr;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  for (const side of [-1, 1]) {
    const sx = nx * half * side;
    const sy = ny * half * side;
    const g = ctx.createLinearGradient(ax + sx - nx * 3, ay + sy - ny * 3, ax + sx + nx * 3, ay + sy + ny * 3);
    g.addColorStop(0, "#5E666E");
    g.addColorStop(0.45, "#F4F7FA");
    g.addColorStop(1, "#7C858E");
    ctx.strokeStyle = g;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax + sx, ay + sy);
    ctx.lineTo(bx + sx, by + sy);
    ctx.stroke();
  }
  // The loop: a circle standing on the lane's middle, seen from above at a slant (squashed along the lane's normal).
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const R = Math.min(len * 0.44, 46);
  ctx.translate(mx, my);
  ctx.rotate(Math.atan2(dy, dx));
  // In this frame x runs along the lane; the loop rises towards −y (up the screen when the lane runs across it).
  const ell = (rx: number, ry: number, a0: number, a1: number) => {
    ctx.beginPath();
    ctx.ellipse(0, -ry, rx, ry, 0, a0, a1);
  };
  const rx = R * 0.62;
  const ry = R;
  // The shadow on the turf beside the lane.
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.beginPath();
  ctx.ellipse(6, 10 + ry * 0.4, rx + 2, ry * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The far half (behind): darker track.
  ctx.lineCap = "round";
  ctx.strokeStyle = "#6A0C12";
  ctx.lineWidth = 9;
  ell(rx, ry, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  for (let k = 1; k < 10; k++) {
    const a = Math.PI * 0.5 + (k / 10) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (rx - 4), -ry + Math.sin(a) * (ry - 4));
    ctx.lineTo(Math.cos(a) * (rx + 4), -ry + Math.sin(a) * (ry + 4));
    ctx.stroke();
  }
  // Supports from the lane up to the loop's sides.
  ctx.strokeStyle = "#9AA2AA";
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * rx, -ry);
    ctx.lineTo(side * (rx + 4), 4);
    ctx.stroke();
  }
  // The near half (in front): bright, glossy track with its highlight.
  const near = ctx.createLinearGradient(-rx, 0, rx, 0);
  near.addColorStop(0, "#E2353C");
  near.addColorStop(0.5, "#B81B23");
  near.addColorStop(1, "#7A0E14");
  ctx.strokeStyle = near;
  ctx.lineWidth = 10;
  ell(rx, ry, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();
  ctx.strokeStyle = "rgba(30,0,0,0.35)";
  ctx.lineWidth = 1;
  for (let k = 1; k < 10; k++) {
    const a = -Math.PI * 0.5 + (k / 10) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (rx - 5), -ry + Math.sin(a) * (ry - 5));
    ctx.lineTo(Math.cos(a) * (rx + 5), -ry + Math.sin(a) * (ry + 5));
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,238,232,0.85)";
  ctx.lineWidth = 1.4;
  ell(rx - 2.5, ry - 2.5, -Math.PI * 0.42, Math.PI * 0.05);
  ctx.stroke();
  ctx.restore();
}
