/**
 * Free Kick's art (display only; it observes the sim and never writes to it). A fixed 2.5-D camera behind the ball
 * (fkCamera: 6 m back, 2.2 m up, level, 800 px focal length) projects the 3-D scene by hand:
 *
 *  - cached once (any kick): the stadium panorama in angle space (night sky, the roof with its floodlight banks and
 *    haze, a packed two-tier crowd, the tier fascia), blitted at the kick's yaw;
 *  - cached once per kick and size: the pitch (criss-cross mowing stripes, the box markings), the LED boards behind
 *    the goal, the goal (posts, crossbar, a proper net), the referee's foam arc by the ball (no line under the wall
 *    since 31 Oct 2026), the wall's floodlight shadows; the play screen's scenery (freekickScene) paints the same
 *    layer on out to the arena box, so the stadium and the pitch fill the screen with no seam;
 *  - every frame: the keeper (hands down until the kick, raising them as it is struck, then diving from the sim's
 *    own position and speed), the wall (jumping on the sim's schedule), the ball and its shadow, the short flight
 *    trail after the kick, the target (a gold hoop in a top corner, or the crossbar lit), the fans on a goal (jumping,
 *    scarves and flags waving, camera flashes), the live stroke, the HUD chips and the result.
 *
 * Collision geometry the player can see is drawn to the sim's sizes: the ball 0.11 m, the posts and bar 0.12 m, the
 * wall players' bodies 0.55 m apart and 1.85 m tall (+ the jump), the hoop 0.55 m.
 */
import type { CanvasSize } from "./engine";
import {
  FK_AIM,
  FK_BALL_R,
  FK_FLIGHT,
  FK_GOAL_H,
  FK_GOAL_HALF_W,
  FK_GOAL_Z,
  FK_HOOP_R,
  FK_HOOP_X,
  FK_HOOP_Y,
  FK_KEEPER_VMAX,
  FK_KEEPER_Z,
  FK_M,
  FK_NET_Z,
  FK_OUT_GOAL,
  FK_OUT_SAVED,
  FK_OUT_SHORT,
  FK_OUT_UNTAKEN,
  FK_OUT_WALL,
  FK_OUT_WIDE,
  FK_POST_R,
  FK_SETTLE,
  FK_TARGET_BAR,
  FK_TARGET_LEFT,
  FK_TARGET_NONE,
  FK_WALL_DIST,
  FK_WALL_H,
  FK_WALL_SPACING,
  FREEKICK_FOCAL,
  FREEKICK_HORIZON,
  FREEKICK_KICKS,
  FREEKICK_REV_2,
  FREEKICK_REV_DEALT,
  FREEKICK_WORLD_H,
  FREEKICK_WORLD_W,
  fkCamSpace,
  fkCamera,
  fkKickOf,
  fkProject,
  fkSeedPlan,
  fkWallJump,
  fkWorld,
  freekickGameFor,
  type FkCamera,
  type FkKick,
  type FreekickState,
} from "./freekick";
import { sceneBelow, type ArenaSceneView } from "./arenaScene.renderer";
import { arcadeFx, ARCADE_FX_DISPLAY_FONT } from "./arcadeFx.renderer";
import { FREEKICK_FX } from "./sportsFx.renderer";

const W = FREEKICK_WORLD_W;
const H = FREEKICK_WORLD_H;
const F = FREEKICK_FOCAL;
const HZ = FREEKICK_HORIZON;
const MONO = "'Duelz Mono', 'JetBrains Mono', ui-monospace, monospace";
export const FREEKICK_ART_BG = "#05070B";
const GOLD = "#F2C75C";
const M = FK_M;

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Canvas = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(w: number, h: number): Canvas | null {
  const cw = Math.max(1, Math.round(w));
  const ch = Math.max(1, Math.round(h));
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(cw, ch);
  if (typeof document !== "undefined") return Object.assign(document.createElement("canvas"), { width: cw, height: ch });
  return null;
}

/** A small seeded stream for the art's scatter (the same crowd on every phone). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ================================ Projection helpers ================================ */

interface P3 {
  x: number;
  y: number;
  z: number;
}

/** Projects a polygon in world metres, clipped to the near plane (camera space w ≥ 0.4). */
function polyPath(ctx: Ctx, cam: FkCamera, pts: P3[]): boolean {
  const NEAR = 0.4;
  const cs = pts.map((p) => fkCamSpace(cam, p.x, p.y, p.z));
  const out: { u: number; w: number; h: number }[] = [];
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i]!;
    const b = cs[(i + 1) % cs.length]!;
    const ain = a.w >= NEAR;
    const bin = b.w >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a.w) / (b.w - a.w);
      out.push({ u: a.u + (b.u - a.u) * t, w: NEAR, h: a.h + (b.h - a.h) * t });
    }
  }
  if (out.length < 3) return false;
  ctx.beginPath();
  out.forEach((c, i) => {
    const sx = W / 2 + (c.u * F) / c.w;
    const sy = HZ - (c.h * F) / c.w;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  return true;
}

/** A line on the pitch (metres), cut into pieces so its width follows the distance. */
function groundLine(ctx: Ctx, cam: FkCamera, x0: number, z0: number, x1: number, z1: number, widthM = 0.12): void {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.ceil(len / 1.5));
  for (let i = 0; i < n; i++) {
    const ax = x0 + ((x1 - x0) * i) / n;
    const az = z0 + ((z1 - z0) * i) / n;
    const bx = x0 + ((x1 - x0) * (i + 1)) / n;
    const bz = z0 + ((z1 - z0) * (i + 1)) / n;
    const a = fkProject(cam, ax, 0, az);
    const b = fkProject(cam, bx, 0, bz);
    if (!a || !b) continue;
    ctx.lineWidth = Math.max(0.5, Math.min(5, widthM * ((a.s + b.s) / 2)));
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

/** A line in the air (metres), constant px width. */
function airLine(ctx: Ctx, cam: FkCamera, a: P3, b: P3): void {
  const p = fkProject(cam, a.x, a.y, a.z);
  const q = fkProject(cam, b.x, b.y, b.z);
  if (!p || !q) return;
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(q.x, q.y);
}

/* ================================ The stadium panorama ================================ */

/** The panorama covers yaw −PANO_SPAN…PANO_SPAN radians, one radian = F px (linear in angle). */
const PANO_SPAN = 0.95;
const PANO_W = Math.ceil(2 * PANO_SPAN * F);
const PANO_H = 372;
let pano: { canvas: Canvas; scale: number } | null = null;

const KIT_COLOURS = ["#C8102E", "#F4F4F4", "#1D3F8F", "#E9E2CF", "#7A1022", "#2A2F3A", "#E6B422", "#0F5A3A"];

function paintCrowd(ctx: Ctx, rand: () => number, y0: number, y1: number, rowH: number, sizeAt: (y: number) => number): void {
  for (let y = y0; y < y1; y += rowH) {
    const s = sizeAt(y);
    // A shadowed step behind each row.
    ctx.fillStyle = "rgba(8,10,16,0.55)";
    ctx.fillRect(0, y + s * 1.4, PANO_W, Math.max(0.6, rowH - s * 1.4));
    for (let x = rand() * s; x < PANO_W; x += s * (1.05 + rand() * 0.5)) {
      const c = rand();
      const shirt = c < 0.45 ? KIT_COLOURS[0]! : c < 0.62 ? KIT_COLOURS[1]! : KIT_COLOURS[2 + Math.floor(rand() * 6)]!;
      ctx.globalAlpha = 0.55 + rand() * 0.4;
      ctx.fillStyle = shirt;
      ctx.fillRect(x, y + s * 0.62, s * 0.92, s * 0.8);
      ctx.fillStyle = rand() < 0.75 ? "#D9A88A" : "#6B4A36";
      ctx.fillRect(x + s * 0.2, y + s * 0.12, s * 0.52, s * 0.52);
      if (rand() < 0.06) {
        // A raised scarf or arm.
        ctx.fillStyle = shirt;
        ctx.fillRect(x + s * 0.3, y - s * 0.45, s * 0.22, s * 0.6);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function paintPano(scale: number): Canvas | null {
  const c = makeCanvas(PANO_W * scale, PANO_H * scale);
  if (!c) return null;
  const ctx = c.getContext("2d") as Ctx | null;
  if (!ctx) return null;
  ctx.scale(scale, scale);
  const rand = lcg(0x51a7);
  // Night sky above the roof's edge.
  const sky = ctx.createLinearGradient(0, 0, 0, 40);
  sky.addColorStop(0, "#020309");
  sky.addColorStop(1, "#0A1020");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, PANO_W, 40);
  // The roof's underside, its trusses.
  const roof = ctx.createLinearGradient(0, 20, 0, 92);
  roof.addColorStop(0, "#0B0F19");
  roof.addColorStop(1, "#151B28");
  ctx.fillStyle = roof;
  ctx.fillRect(0, 22, PANO_W, 70);
  ctx.strokeStyle = "rgba(120,135,160,0.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < PANO_W; x += 34) {
    ctx.moveTo(x, 24);
    ctx.lineTo(x + 17, 90);
    ctx.moveTo(x + 34, 24);
    ctx.lineTo(x + 17, 90);
  }
  ctx.moveTo(0, 24.5);
  ctx.lineTo(PANO_W, 24.5);
  ctx.moveTo(0, 89.5);
  ctx.lineTo(PANO_W, 89.5);
  ctx.stroke();
  // Upper tier.
  const upperBack = ctx.createLinearGradient(0, 92, 0, 196);
  upperBack.addColorStop(0, "#151821");
  upperBack.addColorStop(1, "#232633");
  ctx.fillStyle = upperBack;
  ctx.fillRect(0, 92, PANO_W, 104);
  paintCrowd(ctx, rand, 94, 194, 6.2, (y) => 3.3 + ((y - 94) / 100) * 1.2);
  // Tier fascia: concrete band with lit hospitality glass.
  ctx.fillStyle = "#2C303B";
  ctx.fillRect(0, 196, PANO_W, 13);
  ctx.fillStyle = "rgba(255,214,150,0.35)";
  for (let x = 4; x < PANO_W; x += 22) ctx.fillRect(x, 200, 16, 5);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, 196, PANO_W, 1);
  // Lower tier.
  const lowerBack = ctx.createLinearGradient(0, 209, 0, PANO_H);
  lowerBack.addColorStop(0, "#181B24");
  lowerBack.addColorStop(1, "#262A35");
  ctx.fillStyle = lowerBack;
  ctx.fillRect(0, 209, PANO_W, PANO_H - 209);
  paintCrowd(ctx, rand, 211, PANO_H - 4, 7.4, (y) => 4.0 + ((y - 211) / (PANO_H - 211)) * 2.4);
  // Floodlight banks on the roof's edge, their haze cones (painted once, so soft gradients are fine here).
  for (let x = 60; x < PANO_W; x += 230) {
    const haze = ctx.createRadialGradient(x + 40, 60, 4, x + 40, 120, 190);
    haze.addColorStop(0, "rgba(220,232,255,0.20)");
    haze.addColorStop(0.45, "rgba(180,200,240,0.07)");
    haze.addColorStop(1, "rgba(180,200,240,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(x - 160, 30, 400, 300);
    for (let r = 0; r < 2; r++)
      for (let i = 0; i < 8; i++) {
        const lx = x + i * 10;
        const ly = 50 + r * 8;
        const glow = ctx.createRadialGradient(lx + 3, ly + 2.5, 0, lx + 3, ly + 2.5, 9);
        glow.addColorStop(0, "rgba(255,255,255,0.9)");
        glow.addColorStop(0.3, "rgba(225,236,255,0.35)");
        glow.addColorStop(1, "rgba(225,236,255,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(lx - 7, ly - 7, 20, 19);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(lx, ly, 6, 5);
      }
  }
  // A faint haze over the whole bowl.
  const mist = ctx.createLinearGradient(0, 80, 0, PANO_H);
  mist.addColorStop(0, "rgba(160,180,220,0.10)");
  mist.addColorStop(1, "rgba(160,180,220,0.02)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, 80, PANO_W, PANO_H - 80);
  return c;
}

/** The panorama (painted once per device scale). */
function panoFor(scale: number): Canvas | null {
  if (!pano || pano.scale !== scale) {
    const canvas = paintPano(scale);
    if (!canvas) return null;
    pano = { canvas, scale };
  }
  return pano.canvas;
}

/* ================================ The pitch layer (per kick) ================================ */

const LED_COLOURS = ["#FFB21E", "#00E1FF", "#FF2E7A", "#7CFF4F", "#FFFFFF", "#9B5CFF"];
const BOARD_Z = 3.6;

function paintBoards(ctx: Ctx, cam: FkCamera): void {
  for (let i = -6; i < 6; i++) {
    const x0 = i * 7;
    const x1 = x0 + 7;
    const col = LED_COLOURS[(i + 12) % LED_COLOURS.length]!;
    if (!polyPath(ctx, cam, [{ x: x0, y: 0, z: BOARD_Z }, { x: x1, y: 0, z: BOARD_Z }, { x: x1, y: 0.9, z: BOARD_Z }, { x: x0, y: 0.9, z: BOARD_Z }])) continue;
    const a = fkProject(cam, x0, 0.9, BOARD_Z);
    const b = fkProject(cam, x0, 0, BOARD_Z);
    const g = ctx.createLinearGradient(0, a?.y ?? 330, 0, b?.y ?? 350);
    g.addColorStop(0, col);
    g.addColorStop(0.5, "#0B0D14");
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    // Glowing bars on the board (the "lettering").
    for (let j = 0; j < 4; j++) {
      const bx = x0 + 0.8 + j * 1.6;
      if (polyPath(ctx, cam, [{ x: bx, y: 0.3, z: BOARD_Z - 0.01 }, { x: bx + 1.1, y: 0.3, z: BOARD_Z - 0.01 }, { x: bx + 1.1, y: 0.6, z: BOARD_Z - 0.01 }, { x: bx, y: 0.6, z: BOARD_Z - 0.01 }])) {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fill();
      }
    }
  }
  // The boards' light on the grass in front of them.
  if (polyPath(ctx, cam, [{ x: -42, y: 0, z: BOARD_Z }, { x: 42, y: 0, z: BOARD_Z }, { x: 42, y: 0, z: BOARD_Z - 1.6 }, { x: -42, y: 0, z: BOARD_Z - 1.6 }])) {
    ctx.fillStyle = "rgba(255,220,160,0.06)";
    ctx.fill();
  }
}

function paintGround(ctx: Ctx, cam: FkCamera): void {
  if (polyPath(ctx, cam, [{ x: -60, y: 0, z: BOARD_Z }, { x: 60, y: 0, z: BOARD_Z }, { x: 60, y: 0, z: -60 }, { x: -60, y: 0, z: -60 }])) {
    const top = HZ + (F * 2.2) / 40;
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, "#1E5A2C");
    g.addColorStop(1, "#2D7A3A");
    ctx.fillStyle = g;
    ctx.fill();
  }
  // Criss-cross mowing: bands across (every 5 m in z) and along (every 5 m in x).
  for (let z = -60; z < BOARD_Z; z += 5) {
    if ((Math.floor(z / 5) & 1) === 0) continue;
    if (polyPath(ctx, cam, [{ x: -60, y: 0, z }, { x: 60, y: 0, z }, { x: 60, y: 0, z: Math.min(BOARD_Z, z + 5) }, { x: -60, y: 0, z: Math.min(BOARD_Z, z + 5) }])) {
      ctx.fillStyle = "rgba(190,255,170,0.07)";
      ctx.fill();
    }
  }
  for (let x = -60; x < 60; x += 5) {
    if ((Math.floor(x / 5) & 1) === 0) continue;
    if (polyPath(ctx, cam, [{ x, y: 0, z: BOARD_Z }, { x: x + 5, y: 0, z: BOARD_Z }, { x: x + 5, y: 0, z: -60 }, { x, y: 0, z: -60 }])) {
      ctx.fillStyle = "rgba(0,30,8,0.10)";
      ctx.fill();
    }
  }
  // Markings: goal line, the boxes, the spot, the D.
  ctx.strokeStyle = "rgba(245,248,240,0.82)";
  ctx.lineCap = "round";
  groundLine(ctx, cam, -34, 0, 34, 0);
  for (const [hw, d] of [[20.16, 16.5], [9.16, 5.5]] as const) {
    groundLine(ctx, cam, -hw, 0, -hw, -d);
    groundLine(ctx, cam, hw, 0, hw, -d);
    groundLine(ctx, cam, -hw, -d, hw, -d);
  }
  const arcFrom = Math.acos(5.5 / 9.15);
  let prev: [number, number] | null = null;
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI / 2 - arcFrom + ((2 * arcFrom) * i) / 16;
    const pt: [number, number] = [9.15 * Math.cos(a + Math.PI), -11 - 9.15 * Math.sin(a + Math.PI)];
    if (prev) groundLine(ctx, cam, prev[0], prev[1], pt[0], pt[1]);
    prev = pt;
  }
  const spot = fkProject(cam, 0, 0, -11);
  if (spot) {
    ctx.fillStyle = "rgba(245,248,240,0.85)";
    ctx.beginPath();
    ctx.ellipse(spot.x, spot.y, 0.12 * spot.s, 0.05 * spot.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The goal: the net (back, roof, sides), then the posts and crossbar. */
function paintNet(ctx: Ctx, cam: FkCamera): void {
  const hw = FK_GOAL_HALF_W / M;
  const gh = FK_GOAL_H / M;
  const back = FK_NET_Z / M;
  const backH = 1.9;
  // A faint fill so the net reads against the boards.
  if (polyPath(ctx, cam, [{ x: -hw, y: 0, z: back }, { x: hw, y: 0, z: back }, { x: hw, y: backH, z: back }, { x: -hw, y: backH, z: back }])) {
    ctx.fillStyle = "rgba(230,236,245,0.08)";
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(235,240,248,0.38)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  const step = 0.3;
  for (let x = -hw; x <= hw + 0.01; x += step) {
    airLine(ctx, cam, { x, y: 0, z: back }, { x, y: backH, z: back });
    airLine(ctx, cam, { x, y: backH, z: back }, { x, y: gh, z: FK_POST_R / M });
  }
  for (let y = 0; y <= backH + 0.01; y += step) airLine(ctx, cam, { x: -hw, y, z: back }, { x: hw, y, z: back });
  for (let t = 0; t <= 1.001; t += 0.15) {
    const z = FK_POST_R / M + (back - FK_POST_R / M) * t;
    const y = gh + (backH - gh) * t;
    airLine(ctx, cam, { x: -hw, y, z }, { x: hw, y, z });
    for (const sx of [-hw, hw]) airLine(ctx, cam, { x: sx, y: 0, z }, { x: sx, y, z });
  }
  for (const sx of [-hw, hw]) for (let y = 0; y <= gh; y += step) airLine(ctx, cam, { x: sx, y, z: FK_POST_R / M }, { x: sx, y: Math.min(y, backH), z: back });
  ctx.stroke();
  // Back stanchions.
  ctx.strokeStyle = "rgba(220,226,236,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const sx of [-hw, hw]) {
    airLine(ctx, cam, { x: sx, y: 0, z: back }, { x: sx, y: backH, z: back });
    airLine(ctx, cam, { x: sx, y: backH, z: back }, { x: sx, y: gh, z: FK_POST_R / M });
  }
  ctx.stroke();
}

/** Posts and crossbar, drawn to the sim's 0.12 m (also redrawn over a ball inside the goal). */
function paintFrame(ctx: Ctx, cam: FkCamera, barGlow: number): void {
  const pr = FK_POST_R / M;
  const px = FK_GOAL_HALF_W / M + pr;
  const gh = FK_GOAL_H / M;
  for (const sx of [-px, px]) {
    if (polyPath(ctx, cam, [{ x: sx - pr, y: 0, z: pr }, { x: sx + pr, y: 0, z: pr }, { x: sx + pr, y: gh + 2 * pr, z: pr }, { x: sx - pr, y: gh + 2 * pr, z: pr }])) {
      const a = fkProject(cam, sx - pr, 1, pr);
      const b = fkProject(cam, sx + pr, 1, pr);
      const g = ctx.createLinearGradient(a?.x ?? 0, 0, b?.x ?? 1, 0);
      g.addColorStop(0, "#AEB4BE");
      g.addColorStop(0.45, "#FFFFFF");
      g.addColorStop(1, "#C9CED6");
      ctx.fillStyle = g;
      ctx.fill();
    }
  }
  if (polyPath(ctx, cam, [{ x: -px - pr, y: gh, z: pr }, { x: px + pr, y: gh, z: pr }, { x: px + pr, y: gh + 2 * pr, z: pr }, { x: -px - pr, y: gh + 2 * pr, z: pr }])) {
    ctx.fillStyle = barGlow > 0 ? `rgba(255,${Math.round(213 + 42 * (1 - barGlow))},${Math.round(75 + 180 * (1 - barGlow))},1)` : "#F4F6F8";
    ctx.fill();
    if (barGlow > 0) {
      ctx.save();
      ctx.shadowColor = "rgba(255,213,75,0.9)";
      ctx.shadowBlur = 10 * barGlow;
      ctx.fill();
      ctx.restore();
    }
  }
}

/** Foam: the referee's arc by the ball (the line under the wall was removed on 31 Oct 2026, display only). */
function paintFoam(ctx: Ctx, cam: FkCamera, k: FkKick): void {
  ctx.fillStyle = "rgba(250,252,255,0.85)";
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI * 0.15 + (Math.PI * 0.7 * i) / 18;
    const u = Math.round(Math.cos(a) * 0.5 * M);
    const w = Math.round(Math.sin(a) * 0.5 * M);
    const p = fkWorld(k, u, w);
    const q = fkProject(cam, p.x / M, 0, p.z / M);
    if (!q) continue;
    ctx.beginPath();
    ctx.ellipse(q.x, q.y, 0.05 * q.s, 0.022 * q.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Floodlight positions (metres): the four roof corners. */
const LIGHTS = [
  { x: -45, y: 34, z: -48 },
  { x: 45, y: 34, z: -48 },
  { x: -45, y: 34, z: 22 },
  { x: 45, y: 34, z: 22 },
];

function wallPlayers(k: FkKick): { x: number; z: number; u: number }[] {
  const out: { x: number; z: number; u: number }[] = [];
  for (let i = 0; i < k.wallN; i++) {
    const u = k.wallL + Math.round(((2 * i + 1) * FK_WALL_SPACING) / 2);
    const p = fkWorld(k, u, FK_WALL_DIST);
    out.push({ x: p.x / M, z: p.z / M, u });
  }
  return out;
}

/** Each wall player's floodlight shadows, one faint one per light (static on the grass). */
function paintWallShadows(ctx: Ctx, cam: FkCamera, k: FkKick): void {
  ctx.fillStyle = "rgba(0,8,2,0.16)";
  for (const p of wallPlayers(k)) {
    for (const L of LIGHTS) {
      const dx = p.x - L.x;
      const dz = p.z - L.z;
      const d = Math.hypot(dx, dz);
      const len = (1.85 * d) / (L.y - 1.85);
      const ux = dx / d;
      const uz = dz / d;
      const sx = -uz * 0.2;
      const sz = ux * 0.2;
      if (polyPath(ctx, cam, [
        { x: p.x + sx, y: 0, z: p.z + sz },
        { x: p.x - sx, y: 0, z: p.z - sz },
        { x: p.x - sx * 0.6 + ux * len, y: 0, z: p.z - sz * 0.6 + uz * len },
        { x: p.x + sx * 0.6 + ux * len, y: 0, z: p.z + sz * 0.6 + uz * len },
      ]))
        ctx.fill();
    }
  }
}

interface PitchCache {
  key: string;
  canvas: Canvas;
}
const pitchCache = new Map<string, PitchCache>();

function yawOf(cam: FkCamera): number {
  return Math.atan2(cam.fx, cam.fz);
}

/**
 * The kick's static layer over world x0…x1 (world px; the world is 0…W, the play screen's scenery paints wider):
 * the stadium panorama at the kick's yaw, the boards, the pitch, the net, the wall's shadows, the foam by the ball.
 */
function paintPitchLayer(ctx: Ctx, scale: number, k: FkKick, cam: FkCamera, x0: number, x1: number): void {
  const p = panoFor(scale);
  if (p) {
    // Panorama x of world x 0: (yaw − half view) in angle space; held inside the panorama.
    const left = (yawOf(cam) + PANO_SPAN) * F - W / 2;
    const a = Math.max(0, left + x0);
    const b = Math.min(PANO_W, left + x1);
    if (b > a) ctx.drawImage(p, a * scale, 0, (b - a) * scale, PANO_H * scale, a - left, 0, b - a, PANO_H);
  }
  paintBoards(ctx, cam);
  paintGround(ctx, cam);
  paintNet(ctx, cam);
  paintWallShadows(ctx, cam, k);
  paintFoam(ctx, cam, k);
}

function paintPitch(scale: number, k: FkKick, cam: FkCamera): Canvas | null {
  const c = makeCanvas(W * scale, H * scale);
  if (!c) return null;
  const ctx = c.getContext("2d") as Ctx | null;
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = FREEKICK_ART_BG;
  ctx.fillRect(0, 0, W, H);
  paintPitchLayer(ctx, scale, k, cam, 0, W);
  return c;
}

function pitchFor(scale: number, seed: number, rev: number, index: number, k: FkKick, cam: FkCamera): Canvas | null {
  const key = `${seed}:${rev}:${index}:${scale}`;
  const hit = pitchCache.get(key);
  if (hit) return hit.canvas;
  const canvas = paintPitch(scale, k, cam);
  if (!canvas) return null;
  if (pitchCache.size > 4) pitchCache.clear();
  pitchCache.set(key, { key, canvas });
  return canvas;
}

/* ================================ People ================================ */

/** A wall player (facing the camera): socks, shorts, shirt with a number, crossed arms, head; rim lit on one side. */
function paintWallPlayer(ctx: Ctx, x: number, footY: number, s: number, number: number, lift: number): void {
  const h = 1.85 * s;
  const w = 0.5 * s;
  const y = footY - lift;
  // Legs and socks.
  ctx.fillStyle = "#0E1117";
  ctx.fillRect(x - w * 0.36, y - h * 0.26, w * 0.26, h * 0.26);
  ctx.fillRect(x + w * 0.1, y - h * 0.26, w * 0.26, h * 0.26);
  ctx.fillStyle = "#C8102E";
  ctx.fillRect(x - w * 0.36, y - h * 0.2, w * 0.26, h * 0.12);
  ctx.fillRect(x + w * 0.1, y - h * 0.2, w * 0.26, h * 0.12);
  ctx.fillStyle = "#D6A684";
  ctx.fillRect(x - w * 0.34, y - h * 0.4, w * 0.22, h * 0.14);
  ctx.fillRect(x + w * 0.12, y - h * 0.4, w * 0.22, h * 0.14);
  // Shorts.
  ctx.fillStyle = "#F2F2F2";
  ctx.fillRect(x - w * 0.42, y - h * 0.52, w * 0.84, h * 0.14);
  // Shirt: shaded across the chest.
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, "#6E0A1C");
  g.addColorStop(0.55, "#C8102E");
  g.addColorStop(1, "#E23A52");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.52);
  ctx.lineTo(x - w * 0.52, y - h * 0.8);
  ctx.quadraticCurveTo(x, y - h * 0.87, x + w * 0.52, y - h * 0.8);
  ctx.lineTo(x + w * 0.5, y - h * 0.52);
  ctx.closePath();
  ctx.fill();
  // Crossed arms (protecting).
  ctx.fillStyle = "#A50D27";
  ctx.fillRect(x - w * 0.42, y - h * 0.6, w * 0.84, h * 0.07);
  ctx.fillStyle = "#D6A684";
  ctx.fillRect(x - w * 0.18, y - h * 0.565, w * 0.36, h * 0.05);
  // Number.
  if (s > 20) {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `800 ${Math.max(6, 0.22 * s)}px ${ARCADE_FX_DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(number), x, y - h * 0.7);
  }
  // Head and hair.
  ctx.fillStyle = "#D6A684";
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.91, w * 0.2, h * 0.065, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1A120D";
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.945, w * 0.2, h * 0.035, 0, Math.PI, 0);
  ctx.fill();
  // Rim light from the floodlights on the right.
  ctx.strokeStyle = "rgba(235,242,255,0.55)";
  ctx.lineWidth = Math.max(0.6, s * 0.018);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y - h * 0.53);
  ctx.lineTo(x + w * 0.52, y - h * 0.8);
  ctx.moveTo(x + w * 0.19, y - h * 0.94);
  ctx.lineTo(x + w * 0.2, y - h * 0.88);
  ctx.stroke();
}

/**
 * The keeper (neon kit) at his sim position. `raise` 0…1: hands down at his sides while the kick is set, lifting out
 * to his reach as the ball is struck (always up by the time he can save: the ball takes longer to reach him). Then he
 * leans, lifts and stretches into the dive from his sim speed.
 */
function paintKeeper(ctx: Ctx, cam: FkCamera, kx: number, kv: number, saving: boolean, raise = 1): void {
  const base = fkProject(cam, kx, 0, FK_KEEPER_Z / M);
  if (!base) return;
  const s = base.s;
  const lean = Math.max(-1, Math.min(1, kv / FK_KEEPER_VMAX));
  const dive = Math.abs(lean);
  const ang = lean * (1.05 + 0.35 * dive);
  const lift = dive * (0.55 + 0.35 * dive) * s;
  // Shadow.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, 0.55 * s, 0.08 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(base.x, base.y - 1.0 * s - lift * 0.5);
  ctx.rotate(ang);
  const kit = ctx.createLinearGradient(-0.3 * s, 0, 0.3 * s, 0);
  kit.addColorStop(0, "#7FA412");
  kit.addColorStop(0.6, "#C8F03C");
  kit.addColorStop(1, "#E4FF8A");
  // Legs.
  ctx.fillStyle = "#121418";
  const legSpread = 0.18 + Math.abs(lean) * 0.12;
  ctx.fillRect(-legSpread * s - 0.07 * s, 0.05 * s, 0.14 * s, 0.95 * s);
  ctx.fillRect(legSpread * s - 0.07 * s, 0.05 * s, 0.14 * s, 0.95 * s);
  // Body.
  ctx.fillStyle = kit;
  ctx.beginPath();
  ctx.roundRect(-0.24 * s, -0.62 * s, 0.48 * s, 0.7 * s, 0.08 * s);
  ctx.fill();
  // Arms: from hanging at his sides (set) out wide (the reach the sim checks: about 0.95 m from his centre); in a
  // dive the leading arm stretches higher.
  const reach = 0.95 * s;
  const r = Math.max(0, Math.min(1, raise));
  const e = r * r * (3 - 2 * r);
  ctx.strokeStyle = "#B4DB2C";
  ctx.lineWidth = 0.11 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  const armUp = saving ? -0.9 : -0.35 - dive * 0.5;
  const hands = [-1, 1].map((sx) => {
    const lead = Math.sign(lean) === sx ? dive * 0.25 : 0;
    const upX = sx * reach * 0.92;
    const upY = (armUp - lead) * s;
    const downX = sx * 0.3 * s;
    const downY = 0.02 * s;
    return { x: downX + (upX - downX) * e, y: downY + (upY - downY) * e };
  });
  for (const [i, sx] of [-1, 1].entries()) {
    ctx.moveTo(sx * 0.2 * s, -0.5 * s);
    ctx.lineTo(hands[i]!.x, hands[i]!.y);
  }
  ctx.stroke();
  ctx.fillStyle = "#F7F7F7";
  for (const h of hands) {
    ctx.beginPath();
    ctx.arc(h.x * 1.03, h.y, 0.08 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Head.
  ctx.fillStyle = "#C99877";
  ctx.beginPath();
  ctx.arc(0, -0.78 * s, 0.12 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#15100C";
  ctx.beginPath();
  ctx.arc(0, -0.82 * s, 0.12 * s, Math.PI, 0);
  ctx.fill();
  // Rim light.
  ctx.strokeStyle = "rgba(240,255,200,0.6)";
  ctx.lineWidth = Math.max(0.6, 0.02 * s);
  ctx.beginPath();
  ctx.moveTo(0.24 * s, -0.6 * s);
  ctx.lineTo(0.24 * s, 0.05 * s);
  ctx.stroke();
  ctx.restore();
}

/** The ball at (metres) with its spin: a shaded sphere and a few dark panels, radius 0.11 m. */
export function paintBall(ctx: Ctx, x: number, y: number, r: number, spin: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, "#FFFFFF");
  g.addColorStop(0.65, "#E4E7EC");
  g.addColorStop(1, "#8D939C");
  ctx.fillStyle = g;
  ctx.fill();
  if (r > 3) {
    ctx.clip();
    ctx.fillStyle = "rgba(20,24,32,0.82)";
    for (let i = 0; i < 4; i++) {
      const a = spin + (i * Math.PI) / 2;
      const px = x + Math.cos(a) * r * 0.62;
      const py = y + Math.sin(a * 0.7) * r * 0.45;
      ctx.beginPath();
      for (let j = 0; j < 5; j++) {
        const b = (j * 2 * Math.PI) / 5 + a;
        const qx = px + Math.cos(b) * r * 0.26;
        const qy = py + Math.sin(b) * r * 0.26;
        if (j === 0) ctx.moveTo(qx, qy);
        else ctx.lineTo(qx, qy);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ================================ The fans on a goal (display only) ================================ */

const FAN_SHIRTS = ["#C8102E", "#C8102E", "#F4F4F4", "#C8102E", "#1D3F8F", "#E6B422", "#F4F4F4"];
interface Fan {
  x: number;
  y: number;
  s: number;
  ph: number;
  shirt: string;
}
let fanCache: Fan[] | null = null;

/** The jumping fans' places in the stands (world px; the same on every phone), scarves and flags among them. */
function fanSpots(): Fan[] {
  if (fanCache) return fanCache;
  const rand = lcg(0xfa75);
  const out: Fan[] = [];
  for (let i = 0; i < 340; i++) {
    const upper = rand() < 0.42;
    const y = upper ? 100 + rand() * 88 : 216 + rand() * 120;
    const s = 1.15 * (upper ? 3.3 + ((y - 94) / 100) * 1.2 : 4.0 + ((y - 211) / 161) * 2.4);
    out.push({ x: -12 + rand() * (W + 24), y, s, ph: rand() * Math.PI * 2, shirt: FAN_SHIRTS[Math.floor(rand() * FAN_SHIRTS.length)]! });
  }
  fanCache = out.sort((a, b) => a.y - b.y);
  return fanCache;
}

/** A small hash for the flashes (display only; the same frame draws the same flashes). */
function hash01(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * The crowd on a goal (`age` ticks into the settle): fans spring up and jump, scarves held overhead and flags wave,
 * camera flashes pop round the bowl. Drawn over the stands only: below the boards' top and the goal (its frame and
 * net) are clipped out, so the pitch, the net and the players stay in front.
 */
function paintFans(ctx: Ctx, cam: FkCamera, age: number, tick: number): void {
  const env = Math.min(1, age / 6) * Math.min(1, Math.max(0, (70 - age) / 14));
  if (env <= 0) return;
  let low = HZ + 40;
  for (const x of [-40, -20, 0, 20, 40]) {
    const q = fkProject(cam, x, 0.9, BOARD_Z);
    if (q && q.x > -40 && q.x < W + 40) low = Math.min(low, q.y);
  }
  // The goal's screen box (frame and net), clipped out.
  const hw = FK_GOAL_HALF_W / M + 0.2;
  let gx0 = Infinity;
  let gx1 = -Infinity;
  let gy0 = Infinity;
  for (const [x, y, z] of [[-hw, 2.6, 0], [hw, 2.6, 0], [-hw, 2.0, FK_NET_Z / M], [hw, 2.0, FK_NET_Z / M], [-hw, 0, 0], [hw, 0, 0]] as const) {
    const q = fkProject(cam, x, y, z);
    if (!q) continue;
    gx0 = Math.min(gx0, q.x);
    gx1 = Math.max(gx1, q.x);
    gy0 = Math.min(gy0, q.y);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(-40, 90, W + 80, low - 92);
  if (gx1 > gx0) ctx.rect(gx0, gy0 - 2, gx1 - gx0, low);
  ctx.clip("evenodd");
  ctx.globalAlpha = env;
  const fans = fanSpots();
  fans.forEach((f, i) => {
    if (f.y > low - 2) return;
    const s = f.s;
    const hop = Math.abs(Math.sin(age * 0.33 + f.ph)) * s * 1.5;
    const x = f.x;
    const y = f.y - hop;
    ctx.fillStyle = f.shirt;
    ctx.fillRect(x, y + s * 0.62, s * 0.92, s * 0.8);
    ctx.fillStyle = i % 4 === 0 ? "#6B4A36" : "#D9A88A";
    ctx.fillRect(x + s * 0.2, y + s * 0.12, s * 0.52, s * 0.52);
    // Arms up, waving.
    const wave = Math.sin(age * 0.5 + f.ph) * s * 0.35;
    ctx.strokeStyle = f.shirt;
    ctx.lineWidth = Math.max(0.6, s * 0.22);
    ctx.beginPath();
    ctx.moveTo(x + s * 0.05, y + s * 0.7);
    ctx.lineTo(x - s * 0.3 + wave, y - s * 0.55);
    ctx.moveTo(x + s * 0.87, y + s * 0.7);
    ctx.lineTo(x + s * 1.2 + wave, y - s * 0.55);
    ctx.stroke();
    // Every thirteenth fan holds a scarf overhead; every twenty-ninth waves a flag.
    if (i % 13 === 3) {
      const len = s * 7;
      const n = 8;
      ctx.lineWidth = Math.max(0.8, s * 0.55);
      for (let j = 0; j < n; j++) {
        const ax = x + s * 0.45 - len / 2 + (len * j) / n;
        const bx = ax + len / n;
        const ay = y - s * 0.7 + Math.sin(age * 0.42 + f.ph + j * 0.8) * s * 0.55;
        const by = y - s * 0.7 + Math.sin(age * 0.42 + f.ph + (j + 1) * 0.8) * s * 0.55;
        ctx.strokeStyle = j % 2 === 0 ? "#C8102E" : "#F4F4F4";
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    } else if (i % 29 === 7) {
      const px = x + s * 1.2 + wave;
      const top = y - s * 6;
      ctx.strokeStyle = "#D8D2C4";
      ctx.lineWidth = Math.max(0.6, s * 0.18);
      ctx.beginPath();
      ctx.moveTo(px, y - s * 0.4);
      ctx.lineTo(px, top);
      ctx.stroke();
      const fw = s * 5;
      const fh = s * 3.2;
      const n = 6;
      for (let band = 0; band < 2; band++) {
        ctx.fillStyle = band === 0 ? "#C8102E" : "#F4F4F4";
        ctx.beginPath();
        for (let j = 0; j <= n; j++) {
          const u = j / n;
          const off = Math.sin(age * 0.45 + f.ph - u * 3) * s * 0.9 * u;
          const yy = top + off + (band * fh) / 2;
          if (j === 0) ctx.moveTo(px + u * fw, yy);
          else ctx.lineTo(px + u * fw, yy);
        }
        for (let j = n; j >= 0; j--) {
          const u = j / n;
          const off = Math.sin(age * 0.45 + f.ph - u * 3) * s * 0.9 * u;
          ctx.lineTo(px + u * fw, top + off + ((band + 1) * fh) / 2);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  });
  // Camera flashes: a few each frame, each a frame or two long.
  for (let i = 0; i < 9; i++) {
    const h = hash01(Math.floor(tick / 2) * 31 + i);
    if (h > 0.7) continue;
    const fx = -10 + hash01(tick * 7 + i * 131) * (W + 20);
    const fy = 96 + hash01(tick * 13 + i * 71) * Math.max(10, low - 104);
    const r = 2.5 + hash01(tick * 3 + i) * 3.5;
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * 2.4);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.35, "rgba(235,242,255,0.45)");
    g.addColorStop(1, "rgba(235,242,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(fx - r * 2.4, fy - r * 2.4, r * 4.8, r * 4.8);
  }
  ctx.restore();
}

/* ================================ The live stroke (the phone writes, display only) ================================ */

/** The finger's stroke in world px while it is drawn (and a short fade after release). The phone sets it. */
export const freekickStroke: { pts: { x: number; y: number }[]; releasedAt: number | null } = { pts: [], releasedAt: null };

/* ================================ Per-frame ================================ */

const trails = new WeakMap<object, { kickTick: number; tick: number; pts: { x: number; y: number; z: number }[] }>();

function chip(ctx: Ctx, x: number, y: number, text: string, accent = false, align: "left" | "right" | "center" = "left", minW = 0): number {
  ctx.save();
  ctx.font = `700 11px ${MONO}`;
  const w = Math.max(minW, Math.ceil(ctx.measureText(text).width) + 18);
  const x0 = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  ctx.fillStyle = "rgba(6,9,18,0.66)";
  ctx.beginPath();
  ctx.roundRect(x0, y, w, 22, 11);
  ctx.fill();
  ctx.strokeStyle = accent ? "rgba(242,199,92,0.75)" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = accent ? GOLD : "#F3F1EC";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, x0 + w / 2, y + 11.5);
  ctx.restore();
  return w;
}

/** freekickRev 1's wind chip (rev 2 has no wind: its centre chip names the spot's distance). */
function windChip(ctx: Ctx, wind: number): void {
  const w = 74;
  const x0 = W / 2 - w / 2;
  ctx.save();
  ctx.fillStyle = "rgba(6,9,18,0.66)";
  ctx.beginPath();
  ctx.roundRect(x0, 10, w, 22, 11);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#F3F1EC";
  ctx.font = `700 11px ${MONO}`;
  ctx.textBaseline = "middle";
  if (wind === 0) {
    ctx.textAlign = "center";
    ctx.fillText("CALM", W / 2, 21.5);
  } else {
    const dir = Math.sign(wind);
    ctx.textAlign = "center";
    ctx.fillText(String(Math.abs(wind)), W / 2 + dir * 18, 21.5);
    // The arrow: longer with the strength.
    const len = 10 + Math.abs(wind) * 3;
    const cx = W / 2 - dir * 8;
    ctx.strokeStyle = "#9FD8FF";
    ctx.fillStyle = "#9FD8FF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - (dir * len) / 2, 21);
    ctx.lineTo(cx + (dir * len) / 2, 21);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + (dir * len) / 2 + dir * 3, 21);
    ctx.lineTo(cx + (dir * len) / 2 - dir * 3, 17);
    ctx.lineTo(cx + (dir * len) / 2 - dir * 3, 25);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function resultText(state: FreekickState): { big: string; small: string; gold: boolean } | null {
  const o = state.outs[state.k];
  if (o === undefined || o < 0) return null;
  const f = state.fl;
  const flags = state.flags[state.k] ?? 0;
  if (o === FK_OUT_GOAL) {
    const k = fkKickOf(state);
    const small = flags & 1 ? (k.target === FK_TARGET_BAR ? "IN OFF THE BAR" : "TOP BINS") : flags & 2 ? "ROUND THE WALL" : f?.post ? "IN OFF THE POST" : "";
    return { big: "GOAL!", small, gold: true };
  }
  if (o === FK_OUT_SAVED) return { big: "SAVED", small: "", gold: false };
  if (o === FK_OUT_WALL) return { big: "BLOCKED", small: "THE WALL", gold: false };
  if (o === FK_OUT_WIDE) return { big: f && f.crossY >= FK_GOAL_H ? "OVER" : "WIDE", small: f?.bar || f?.post ? "OFF THE WOODWORK" : "", gold: false };
  if (o === FK_OUT_SHORT) return { big: "NO GOAL", small: "", gold: false };
  if (o === FK_OUT_UNTAKEN) return { big: "TIME", small: "KICK MISSED", gold: false };
  return null;
}

/** The play screen's frame. */
/** The play screen's frame, under the shared success and miss effects (sportsFx.renderer.ts). */
export function drawFreekickArt(ctx: CanvasRenderingContext2D, state: FreekickState, size: CanvasSize): void {
  arcadeFx(ctx, FREEKICK_FX, state, () => drawFreekickWorld(ctx, state, size), size);
}

function drawFreekickWorld(ctx: CanvasRenderingContext2D, state: FreekickState, size: CanvasSize): void {
  void size;
  const plan = fkSeedPlan(state.seed, state.freekickRev);
  const index = Math.min(state.k, FREEKICK_KICKS - 1);
  const k = plan.kicks[index]!;
  const cam = fkCamera(k);
  const scale = Math.max(1, Math.min(4, Math.abs(ctx.getTransform().a) || 1));
  const pitch = pitchFor(Math.round(scale * 4) / 4, state.seed, state.freekickRev, index, k, cam);
  if (pitch) ctx.drawImage(pitch as CanvasImageSource, 0, 0, W, H);
  else {
    ctx.fillStyle = FREEKICK_ART_BG;
    ctx.fillRect(0, 0, W, H);
  }
  const f = state.fl;
  const t = f?.t ?? 0;
  const pulse = 0.5 + 0.5 * Math.sin(state.tick / 9);

  // The fans on a goal: up on their feet, scarves and flags waving, camera flashes (behind everything on the pitch).
  if (state.phase === FK_SETTLE && state.outs[index] === FK_OUT_GOAL) paintFans(ctx, cam, state.tick - state.phaseTick, state.tick);

  // The target: a gold hoop in the top corner, or the crossbar lit.
  const hitFlags = state.flags[index] ?? 0;
  const targetDone = (hitFlags & 1) === 1;
  if (k.target !== FK_TARGET_NONE && k.target !== FK_TARGET_BAR) {
    const hx = (k.target === FK_TARGET_LEFT ? -FK_HOOP_X : FK_HOOP_X) / M;
    const c = fkProject(cam, hx, FK_HOOP_Y / M, 0);
    if (c) {
      const r = (FK_HOOP_R / M) * c.s;
      ctx.save();
      ctx.fillStyle = targetDone ? "rgba(255,213,75,0.35)" : `rgba(255,213,75,${0.08 + 0.08 * pulse})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#FFD54B";
      ctx.lineWidth = Math.max(1.5, 0.06 * c.s);
      ctx.shadowColor = "rgba(255,213,75,0.8)";
      ctx.shadowBlur = 6 + 4 * pulse;
      ctx.stroke();
      ctx.restore();
    }
  }
  const ballBehindLine = f !== null && f.z > FK_POST_R * 2;
  const barGlow = k.target === FK_TARGET_BAR ? (targetDone ? 1 : 0.55 + 0.45 * pulse) : 0;
  if (!ballBehindLine) paintFrame(ctx, cam, barGlow);

  // Depth-sorted dynamic objects: the ball (and its trail), the keeper, the wall.
  type Item = { w: number; draw: () => void; ball?: boolean };
  const items: Item[] = [];
  const kx = (f?.kx ?? k.keeperX) / M;
  // Hands down until the kick; up within 12 ticks of it (the ball reaches his line no sooner than the wall's line plus
  // the keeper's reaction delay, so they are always up by then).
  const raise = !f ? 0 : Math.min(1, f.t / 12);
  items.push({ w: fkCamSpace(cam, kx, 0, FK_KEEPER_Z / M).w, draw: () => paintKeeper(ctx, cam, kx, f?.kv ?? 0, f?.out === FK_OUT_SAVED, raise) });
  const lift = f ? fkWallJump(t) : 0;
  const players = wallPlayers(k);
  const wallW = players.length ? fkCamSpace(cam, players[0]!.x, 0, players[0]!.z).w : 0;
  items.push({
    w: wallW,
    draw: () => {
      // Far to near across the wall so overlaps read right.
      const order = players.map((p, i) => ({ p, i, w: fkCamSpace(cam, p.x, 0, p.z).w })).sort((a, b) => b.w - a.w);
      for (const { p, i } of order) {
        const q = fkProject(cam, p.x, 0, p.z);
        if (!q) continue;
        const jump = (lift / M) * q.s;
        if (jump > 0.5) {
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, 0.25 * q.s, 0.05 * q.s, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        paintWallPlayer(ctx, q.x, q.y, q.s, [4, 8, 6, 10, 5][i % 5]!, jump);
      }
      void FK_WALL_H;
    },
  });
  const ball = f ? { x: f.x / M, y: f.y / M, z: f.z / M } : { x: k.bx / M, y: FK_BALL_R / M, z: k.bz / M };
  items.push({ w: fkCamSpace(cam, ball.x, ball.y, ball.z).w, draw: () => drawBall(ctx, cam, state, ball), ball: true });
  items.sort((a, b) => b.w - a.w);
  // A ball inside the goal sits behind the frame.
  if (ballBehindLine) {
    items.find((i) => i.ball)?.draw();
    paintFrame(ctx, cam, barGlow);
    for (const it of items) if (!it.ball) it.draw();
  } else for (const it of items) it.draw();

  // Aim: a soft ring round the ball while the kick can be taken, a countdown in the last two seconds.
  if (state.phase === FK_AIM) {
    const q = fkProject(cam, k.bx / M, FK_BALL_R / M, k.bz / M);
    if (q) {
      const r = (FK_BALL_R / M) * q.s;
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${0.18 + 0.22 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r * 2.2 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      const left = state.deadline - state.tick;
      if (left < 120) {
        ctx.strokeStyle = left < 45 ? "#FF6A5C" : GOLD;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * 2.9, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * left) / 120);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // The live stroke.
  const st = freekickStroke;
  if (st.pts.length > 1) {
    const age = st.releasedAt === null ? 0 : (typeof performance === "undefined" ? 0 : performance.now()) - st.releasedAt;
    const alpha = st.releasedAt === null ? 0.7 : Math.max(0, 0.7 - age / 300);
    if (alpha > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      st.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
    }
  }

  // HUD: kick, wind, score; the kicks' results under the kick chip.
  const shown = Math.min(state.k + 1, FREEKICK_KICKS);
  chip(ctx, 10, 10, `KICK ${shown}/${FREEKICK_KICKS}`, false, "left", 92);
  if (state.freekickRev >= FREEKICK_REV_2) chip(ctx, W / 2, 10, `${k.yards ?? 0} YDS`, false, "center", 74);
  else windChip(ctx, k.wind);
  chip(ctx, W - 10, 10, String(freekickGameFor(state.freekickRev).score(state)), true, "right", 52);
  for (let i = 0; i < FREEKICK_KICKS; i++) {
    const o = state.outs[i]!;
    ctx.fillStyle = o === FK_OUT_GOAL ? GOLD : o >= 0 ? "rgba(255,110,96,0.85)" : i === state.k ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.arc(18 + i * 8.4, 41, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // The result, high over the stands (clear of the HUD).
  if (state.phase === FK_SETTLE) {
    const r = resultText(state);
    if (r) {
      const age = state.tick - state.phaseTick;
      const a = Math.min(1, age / 8);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 34px ${ARCADE_FX_DISPLAY_FONT}`;
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(4,6,12,0.85)";
      ctx.strokeText(r.big, W / 2, 132);
      ctx.fillStyle = r.gold ? GOLD : "#F3F1EC";
      ctx.fillText(r.big, W / 2, 132);
      if (r.small) {
        ctx.font = `700 13px ${MONO}`;
        ctx.lineWidth = 4;
        ctx.strokeText(r.small, W / 2, 162);
        ctx.fillStyle = "#F3F1EC";
        ctx.fillText(r.small, W / 2, 162);
      }
      ctx.restore();
    }
  }
}

function drawBall(ctx: CanvasRenderingContext2D, cam: FkCamera, state: FreekickState, ball: P3): void {
  const f = state.fl;
  // Trail: the last few positions after the kick.
  let tr = trails.get(ctx);
  if (!tr || tr.kickTick !== state.kickTick || !f) {
    tr = { kickTick: state.kickTick, tick: -1, pts: [] };
    trails.set(ctx, tr);
  }
  if (f && state.tick !== tr.tick && (state.phase === FK_FLIGHT || state.phase === FK_SETTLE)) {
    tr.tick = state.tick;
    tr.pts.push({ ...ball });
    if (tr.pts.length > 14) tr.pts.shift();
  }
  if (tr.pts.length > 1 && f && f.t < 140) {
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 1; i < tr.pts.length; i++) {
      const a = fkProject(cam, tr.pts[i - 1]!.x, tr.pts[i - 1]!.y, tr.pts[i - 1]!.z);
      const b = fkProject(cam, tr.pts[i]!.x, tr.pts[i]!.y, tr.pts[i]!.z);
      if (!a || !b) continue;
      const k = i / tr.pts.length;
      ctx.strokeStyle = `rgba(255,236,190,${0.42 * k})`;
      ctx.lineWidth = Math.max(0.8, (FK_BALL_R / M) * b.s * 1.2 * k);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Shadow on the grass (smaller and fainter as the ball rises).
  const sh = fkProject(cam, ball.x, 0, ball.z);
  const q = fkProject(cam, ball.x, ball.y, ball.z);
  if (sh) {
    const hgt = ball.y;
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.08, 0.4 - hgt * 0.1)})`;
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, (FK_BALL_R / M) * sh.s * 1.2, (FK_BALL_R / M) * sh.s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (q) paintBall(ctx, q.x, q.y, Math.max(1.2, (FK_BALL_R / M) * q.s), f ? (f.t * (0.25 + Math.abs(f.b) / 220)) * Math.sign(f.b || 1) : 0.4);
}

/** The play and reveal art for a stamp (the sim's game with the art's draw). */
export function freekickArtGameFor(rev?: number | null) {
  return { ...freekickGameFor(rev), draw: drawFreekickArt };
}
/** The art game on freekickRev 1 (its draw follows each state's own stamp, so it draws any revision). */
export const freekickArtGame = freekickArtGameFor(1);

/**
 * The play screen's scenery beyond the world (display only; painted per kick, sceneKey freekickSceneKey, never per
 * frame): the kick's own static layer (the stadium panorama at its yaw, the boards, the pitch and its markings, the
 * net) carried on out to the arena box, so the stands and the grass run across every edge of the world with no seam
 * (the width at 375×667, the bottom at 414×896); the grass settles a little darker below the world, from nothing at
 * its edge.
 */
export function freekickScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView, state?: FreekickState): void {
  const rev = state?.freekickRev ?? FREEKICK_REV_DEALT;
  const seed = state?.seed ?? 1;
  const index = Math.min(state?.k ?? 0, FREEKICK_KICKS - 1);
  const k = fkSeedPlan(seed, rev).kicks[index]!;
  const cam = fkCamera(k);
  ctx.fillStyle = "#03050A";
  ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
  const scale = Math.max(1, Math.min(4, Math.abs(ctx.getTransform().a) || 1));
  paintPitchLayer(ctx, Math.round(scale * 4) / 4, k, cam, view.left, view.right);
  const below = sceneBelow(view);
  if (below) {
    const g = ctx.createLinearGradient(0, below.y, 0, below.y + below.h);
    g.addColorStop(0, "rgba(4,14,7,0)");
    g.addColorStop(1, "rgba(4,14,7,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(below.x, below.y, below.w, below.h);
  }
}

/** The scenery's key: it repaints for each kick (its camera and wall). */
export function freekickSceneKey(state: FreekickState): string {
  return `${state.seed}:${state.freekickRev}:${Math.min(state.k, FREEKICK_KICKS - 1)}`;
}

/* ================================ Tile and intro painters ================================ */

/** The tile icon's scene (scripts/shots/tile-scenes): the goal, a 3-man wall, the keeper and the ball, at `size` px square. */
export function paintFreekickTile(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.save();
  const s = size / 104;
  ctx.scale(s, s);
  // Night pitch.
  const g = ctx.createLinearGradient(0, 0, 0, 104);
  g.addColorStop(0, "#0B0F18");
  g.addColorStop(0.42, "#141925");
  g.addColorStop(0.43, "#1E5A2C");
  g.addColorStop(1, "#2D7A3A");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 104, 104);
  ctx.fillStyle = "rgba(190,255,170,0.08)";
  for (let i = 0; i < 4; i++) ctx.fillRect(0, 50 + i * 14, 104, 7);
  // Floodlights.
  ctx.fillStyle = "#FFFFFF";
  for (const x of [10, 78]) {
    ctx.globalAlpha = 0.12;
    ctx.fillRect(x - 3, 4, 22, 9);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++) ctx.fillRect(x + i * 4.4, 7, 3, 2.4);
  }
  // Goal and net.
  ctx.strokeStyle = "rgba(235,240,248,0.35)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let x = 24; x <= 80; x += 4) {
    ctx.moveTo(x, 26);
    ctx.lineTo(x + (x - 52) * 0.08, 46);
  }
  for (let y = 28; y <= 46; y += 4) {
    ctx.moveTo(24, y);
    ctx.lineTo(80, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#F4F6F8";
  ctx.fillRect(22, 24, 60, 2.6);
  ctx.fillRect(22, 24, 2.6, 23);
  ctx.fillRect(79.4, 24, 2.6, 23);
  // Gold hoop, top corner.
  ctx.strokeStyle = "#FFD54B";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(73, 32, 5.5, 0, Math.PI * 2);
  ctx.stroke();
  // Keeper.
  ctx.fillStyle = "#C8F03C";
  ctx.fillRect(38, 33, 6, 9);
  ctx.strokeStyle = "#B4DB2C";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(38, 35);
  ctx.lineTo(32, 31);
  ctx.moveTo(44, 35);
  ctx.lineTo(50, 31);
  ctx.stroke();
  ctx.fillStyle = "#121418";
  ctx.fillRect(38.5, 42, 2, 5);
  ctx.fillRect(41.5, 42, 2, 5);
  // The wall.
  for (let i = 0; i < 3; i++) paintWallPlayer(ctx, 54 + i * 8, 76, 18, 4 + i * 2, 0);
  // Ball with its curl trail.
  ctx.strokeStyle = "rgba(255,236,190,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 92);
  ctx.quadraticCurveTo(40, 64, 50, 52);
  ctx.stroke();
  paintBall(ctx, 40, 93, 6, 0.6);
  ctx.restore();
}

/** Backdrop painter for other surfaces (the intro still, the share card): the pitch view of a seed's first kick. */
export function paintFreekickBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, seed = 1, rev: number = FREEKICK_REV_DEALT): void {
  const k = fkSeedPlan(seed, rev).kicks[0]!;
  const cam = fkCamera(k);
  const c = paintPitch(1, k, cam);
  ctx.save();
  ctx.scale(w / W, h / H);
  if (c) ctx.drawImage(c as CanvasImageSource, 0, 0, W, H);
  ctx.restore();
}

export { FREEKICK_WORLD_W, FREEKICK_WORLD_H };
void FK_GOAL_Z;
