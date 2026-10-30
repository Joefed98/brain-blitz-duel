/**
 * Home Run Derby's art (display only; never imported by the sim or the server): the hitter's eye-level view of a
 * night ballpark. A fixed 2.5D camera: the park (sky, floodlight banks with bloom and beams, two packed tiers of lit
 * fans, the outfield wall with distance markers, yellow foul poles, the seeded signs beyond the fence, the warning
 * track and the field in perspective) is painted once per canvas size and seed (deviceLayer); per frame only the
 * pitcher, the pitch, the bat, the batted ball, the camera flashes and the HUD chips are drawn.
 *
 * The outfield uses a panoramic angle mapping (spray angle → screen x), so both foul poles stay in view; the near
 * field (mound, plate, chalk) uses an eye-level pinhole projection. The ball's path to the plate is the sim's own
 * (homerunBallAt) and every outcome (carry, spray, home run, sign) is the sim's; this file only animates it.
 */
import { artHash, reducedMotion } from "./art.renderer";
import { deviceLayer } from "./cache.renderer";
import { arcadeFx, ARCADE_FX_DISPLAY_FONT } from "./arcadeFx.renderer";
import { HOMERUN_FX } from "./sportsFx.renderer";
import { sceneBelow, sceneSides, type ArenaSceneView } from "./arenaScene.renderer";
import type { CanvasSize } from "./engine";
import {
  homerunBallAt,
  homerunCurrent,
  homerunFence,
  homerunGame,
  homerunPlan,
  HOMERUN_PITCHES,
  HOMERUN_PITCH_NAMES,
  HOMERUN_SIGNS,
  HOMERUN_SWING_TICKS,
  HOMERUN_WINDUP_TICKS,
  HOMERUN_WORLD_H,
  HOMERUN_WORLD_W,
  HOMERUN_ZONE_X0,
  HOMERUN_ZONE_X1,
  HOMERUN_ZONE_Y0,
  HOMERUN_ZONE_Y1,
  OUT_FAIR,
  OUT_FOUL,
  OUT_HOMER,
  OUT_TAKEN,
  OUT_WHIFF,
  type HomerunHit,
  type HomerunPlan,
  type HomerunSign,
  type HomerunState,
} from "./homerun";

export const HOMERUN_ART_BG = "#04060D";

const W = HOMERUN_WORLD_W;
const H = HOMERUN_WORLD_H;
/** The horizon (eye level) and the eye-level camera: focal length, height and the plate's depth (feet). */
const YH = 286;
const F = 682;
const CAM_H = 4.4;
const CAM_BACK = 9;
const CAM_SIDE = 1.8;
const CX = 169;
const MONO = "'Duelz Mono', 'JetBrains Mono', ui-monospace, monospace";

/** Eye-level projection of a field point (x right of the pitcher's line, z toward centre field from the plate, y up; feet). */
function proj(x: number, z: number, y = 0): { x: number; y: number; s: number } {
  const d = Math.max(0.6, z + CAM_BACK);
  return { x: CX + (F * (x + CAM_SIDE)) / d, y: YH + (F * (CAM_H - y)) / d, s: F / d };
}

/** The outfield's panoramic mapping: spray angle (tenths of a degree, + = left field) → screen x. */
export function homerunSprayX(spray: number): number {
  return W / 2 - (spray / 10) * 4;
}
/** The top of the outfield wall at a spray angle (it curves: deepest in centre, so highest on screen). */
function wallTop(spray: number): number {
  const fence = homerunFence(spray);
  return 279 + Math.round((400 - fence) * 0.16);
}
const WALL_H = 13;

/* ------------------------------------------------------------ the park */

function paintSky(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, 300);
  g.addColorStop(0, "#03050C");
  g.addColorStop(0.5, "#070C1C");
  g.addColorStop(1, "#111A33");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 300);
  for (let i = 0; i < 26; i++) {
    const h = artHash(i, 77);
    const x = h % W;
    const y = 6 + ((h >>> 9) % 70);
    ctx.fillStyle = `rgba(220,230,255,${0.25 + ((h >>> 20) % 50) / 100})`;
    ctx.fillRect(x, y, (h >>> 4) % 5 === 0 ? 1.6 : 1, (h >>> 4) % 5 === 0 ? 1.6 : 1);
  }
}

/** One floodlight tower: the mast, the bank of lamps, its bloom and a beam down onto the field. */
function paintFloodlight(ctx: CanvasRenderingContext2D, cx: number, top: number, w: number): void {
  ctx.fillStyle = "#0B0F18";
  ctx.fillRect(cx - 2, top + 18, 4, 150 - top);
  ctx.fillStyle = "#151B28";
  ctx.fillRect(cx - w / 2 - 3, top - 3, w + 6, 24);
  const rows = 3;
  const cols = Math.round(w / 7);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = cx - w / 2 + 2 + c * ((w - 4) / cols);
      const y = top + 1 + r * 6;
      ctx.fillStyle = "#FFF8E6";
      ctx.fillRect(x, y, 4.2, 4.2);
    }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const bloom = ctx.createRadialGradient(cx, top + 9, 2, cx, top + 9, w * 1.6);
  bloom.addColorStop(0, "rgba(255,246,220,0.85)");
  bloom.addColorStop(0.25, "rgba(255,236,190,0.35)");
  bloom.addColorStop(1, "rgba(255,230,180,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(cx - w * 1.6, top + 9 - w * 1.6, w * 3.2, w * 3.2);
  const beam = ctx.createLinearGradient(cx, top + 20, W / 2, 330);
  beam.addColorStop(0, "rgba(255,240,205,0.16)");
  beam.addColorStop(1, "rgba(255,240,205,0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, top + 20);
  ctx.lineTo(cx + w / 2, top + 20);
  ctx.lineTo(W / 2 + (cx - W / 2) * 0.15 + 70, 340);
  ctx.lineTo(W / 2 + (cx - W / 2) * 0.15 - 70, 340);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A packed tier of lit fans between y0 and y1 (rows of small shaded heads and shirts). */
function paintCrowd(ctx: CanvasRenderingContext2D, y0: number, y1: number, size: number, salt: number): void {
  const shirts = ["#C8CDD8", "#9BA6BC", "#5B6B8C", "#B8443A", "#E8D9B0", "#2E3A55", "#7A2C3A", "#D7B15A", "#3E6E7E", "#F0F0F0"];
  const rowH = size * 1.55;
  let row = 0;
  for (let y = y1 - rowH; y >= y0; y -= rowH, row++) {
    // Each row a shade darker going back (the light falls off), with a concrete step under it.
    const fade = 0.55 + 0.45 * ((y - y0) / Math.max(1, y1 - y0));
    ctx.fillStyle = `rgba(20,24,34,${0.9})`;
    ctx.fillRect(0, y + rowH - 1.2, W, 1.2);
    const step = size * 1.05;
    for (let x = (row % 2) * (step / 2) - 2; x < W + 2; x += step) {
      const h = artHash(Math.round(x * 10) + row * 997, salt);
      if (h % 11 === 0) continue;
      ctx.globalAlpha = fade;
      ctx.fillStyle = shirts[h % shirts.length]!;
      ctx.fillRect(x - size * 0.45, y + size * 0.55, size * 0.9, size * 0.85);
      ctx.fillStyle = (h >>> 5) % 3 === 0 ? "#3A2A20" : (h >>> 5) % 3 === 1 ? "#C69C7A" : "#8A5E44";
      ctx.beginPath();
      ctx.arc(x, y + size * 0.35, size * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // The floodlights wash the front rows warm.
  const wash = ctx.createLinearGradient(0, y0, 0, y1);
  wash.addColorStop(0, "rgba(6,9,18,0.35)");
  wash.addColorStop(1, "rgba(255,226,170,0.08)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, y0, W, y1 - y0);
}

function signText(i: number): string {
  return ["450 CLUB", "DEEP", "LIGHTS OUT", "JOULZ", "MOONSHOT"][i % 5]!;
}

/** Where sign `s` sits on screen (on the lower tier's facade, just above the wall). */
export function homerunSignBox(s: HomerunSign): { x: number; y: number; w: number; h: number } {
  const x0 = homerunSprayX(s.angle + s.half);
  const x1 = homerunSprayX(s.angle - s.half);
  const y = wallTop(s.angle) - 15 - Math.round((s.lift - 30) * 0.5);
  return { x: x0, y, w: x1 - x0, h: 13 };
}

function paintSign(ctx: CanvasRenderingContext2D, s: HomerunSign, i: number, lit: boolean): void {
  const b = homerunSignBox(s);
  ctx.save();
  ctx.fillStyle = "#06080E";
  ctx.fillRect(b.x - 1.5, b.y - 1.5, b.w + 3, b.h + 3);
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  g.addColorStop(0, lit ? "#2A2210" : "#14161E");
  g.addColorStop(1, lit ? "#120E05" : "#0B0C12");
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = lit ? "#F2C75C" : "rgba(242,199,92,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  ctx.fillStyle = lit ? "#FFE7A3" : "rgba(255,231,163,0.45)";
  ctx.font = `800 7.5px ${ARCADE_FX_DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(signText(i), b.x + b.w / 2, b.y + b.h / 2 + 0.5);
  ctx.restore();
}

function paintStands(ctx: CanvasRenderingContext2D): void {
  // Upper deck, its fascia, the lower bowl.
  ctx.fillStyle = "#0A0E19";
  ctx.fillRect(0, 128, W, 152);
  paintCrowd(ctx, 140, 196, 5.2, 11);
  // The upper deck's roof edge and the LED ribbon on the fascia between the tiers.
  ctx.fillStyle = "#121827";
  ctx.fillRect(0, 124, W, 8);
  ctx.fillStyle = "#1A2132";
  ctx.fillRect(0, 196, W, 10);
  const ribbon = ctx.createLinearGradient(0, 0, W, 0);
  ribbon.addColorStop(0, "#1C3F78");
  ribbon.addColorStop(0.5, "#2B6CD8");
  ribbon.addColorStop(1, "#1C3F78");
  ctx.fillStyle = ribbon;
  ctx.fillRect(0, 199, W, 4);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "rgba(80,150,255,0.18)";
  ctx.fillRect(0, 195, W, 12);
  ctx.restore();
  paintCrowd(ctx, 207, 268, 6.4, 23);
}

function paintWall(ctx: CanvasRenderingContext2D): void {
  // The wall: padded dark green, curving deepest in centre field, its top capped in a yellow home-run line.
  ctx.beginPath();
  for (let x = -2; x <= W + 2; x += 6) {
    const spray = ((W / 2 - x) / 4) * 10;
    const y = wallTop(spray);
    if (x === -2) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 2, 300);
  ctx.lineTo(-2, 300);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 278, 0, 300);
  g.addColorStop(0, "#1F4A33");
  g.addColorStop(1, "#0E2619");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#E8C547";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let x = -2; x <= W + 2; x += 6) {
    const y = wallTop(((W / 2 - x) / 4) * 10);
    if (x === -2) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Pad seams.
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  for (let x = 12; x < W; x += 24) {
    const y = wallTop(((W / 2 - x) / 4) * 10);
    ctx.beginPath();
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x, y + WALL_H);
    ctx.stroke();
  }
  // Distance markers.
  ctx.fillStyle = "#F4F6FA";
  ctx.font = `700 8px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const spray of [-420, -220, 0, 220, 420]) {
    const x = homerunSprayX(spray);
    ctx.fillText(String(homerunFence(spray)), x, wallTop(spray) + 7);
  }
  // Warning track.
  ctx.fillStyle = "#5A4130";
  ctx.beginPath();
  for (let x = -2; x <= W + 2; x += 6) {
    const y = wallTop(((W / 2 - x) / 4) * 10) + WALL_H;
    if (x === -2) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 2, 304);
  ctx.lineTo(-2, 304);
  ctx.closePath();
  ctx.fill();
}

function paintPole(ctx: CanvasRenderingContext2D, x: number): void {
  const g = ctx.createLinearGradient(x - 2, 0, x + 2, 0);
  g.addColorStop(0, "#9C7B12");
  g.addColorStop(0.5, "#FFE15A");
  g.addColorStop(1, "#B38E1A");
  ctx.fillStyle = g;
  ctx.fillRect(x - 1.6, 150, 3.2, 150);
  ctx.fillRect(x - (x < W / 2 ? 0 : 7), 160, 7, 46);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "rgba(255,225,90,0.12)";
  ctx.fillRect(x - 5, 150, 10, 150);
  ctx.restore();
}

function paintField(ctx: CanvasRenderingContext2D): void {
  // Outfield grass to the infield dirt, mowed in stripes that run toward the camera.
  const grass = ctx.createLinearGradient(0, 300, 0, H);
  grass.addColorStop(0, "#1D4A2B");
  grass.addColorStop(0.25, "#245C33");
  grass.addColorStop(1, "#173A22");
  ctx.fillStyle = grass;
  ctx.fillRect(0, 302, W, H - 302);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 302, W, H - 302);
  ctx.clip();
  for (let i = -12; i <= 12; i++) {
    if (i % 2) continue;
    const a = proj(i * 12, 420);
    const b = proj((i + 1) * 12, 420);
    const c = proj((i + 1) * 12, -6);
    const d = proj(i * 12, -6);
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  }
  // The infield arc: a dirt band past the bases.
  const ring = (r: number) => {
    ctx.beginPath();
    for (let a = -50; a <= 50; a += 4) {
      const t = (a * Math.PI) / 180;
      const p = proj(Math.sin(t) * r, 60.5 + Math.cos(t) * r * 0.98);
      if (a === -50) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
  };
  ctx.fillStyle = "#7A5638";
  ring(95);
  for (let a = 50; a >= -50; a -= 4) {
    const t = (a * Math.PI) / 180;
    const p = proj(Math.sin(t) * 78, 60.5 + Math.cos(t) * 76);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
  // Second base.
  const b2 = proj(0, 127, 0);
  ctx.fillStyle = "#EDEFF3";
  ctx.fillRect(b2.x - 3, b2.y - 1, 6, 2);
  // The mound.
  const m = proj(0, 60.5);
  const md = ctx.createRadialGradient(m.x, m.y, 2, m.x, m.y, 92);
  md.addColorStop(0, "#9A6E49");
  md.addColorStop(1, "#6E4C31");
  ctx.fillStyle = md;
  ctx.beginPath();
  ctx.ellipse(m.x, m.y + 1, 90, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F2F2EE";
  ctx.fillRect(m.x - 9, m.y - 1, 18, 1.6);
  // Home plate's dirt circle, the chalk, the plate.
  const p0 = proj(0, 0);
  const dirt = ctx.createRadialGradient(p0.x, p0.y, 10, p0.x, p0.y - 40, 330);
  dirt.addColorStop(0, "#8C6342");
  dirt.addColorStop(1, "#5E412A");
  ctx.fillStyle = dirt;
  ctx.beginPath();
  for (let a = 0; a <= 360; a += 6) {
    const t = (a * Math.PI) / 180;
    const p = proj(Math.sin(t) * 13, Math.cos(t) * 13);
    if (a === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
  // Raked dirt: fine seeded specks and a few darker footprint scuffs by the boxes, then the batter's long shadow.
  for (let i = 0; i < 900; i++) {
    const h = artHash(i, 4049);
    const x = h % W;
    const y = 420 + ((h >>> 9) % (H - 420));
    ctx.fillStyle = (h >>> 22) % 2 ? "rgba(255,225,190,0.06)" : "rgba(30,18,10,0.16)";
    ctx.fillRect(x, y, 1 + ((h >>> 3) % 2), 1);
  }
  ctx.fillStyle = "rgba(10,6,3,0.1)";
  for (let i = 0; i < 5; i++) {
    const f = proj(-3.2 + (i % 2) * 0.6, -1.2 + i * 0.5);
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, 7 + (i % 3), 2.4, 0.15 * (i % 2 ? 1 : -1), 0, Math.PI * 2);
    ctx.fill();
  }
  const sh = ctx.createLinearGradient(0, 560, 0, H);
  sh.addColorStop(0, "rgba(0,0,0,0)");
  sh.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.moveTo(W, 600);
  ctx.quadraticCurveTo(250, 640, 60, H);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  // Foul lines from the plate out past the edges.
  ctx.strokeStyle = "rgba(245,245,240,0.85)";
  ctx.lineWidth = 1.4;
  for (const side of [-1, 1]) {
    const a = proj(0, 0);
    const b = proj(side * 90, 90);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Batter's boxes.
  ctx.strokeStyle = "rgba(245,245,240,0.6)";
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    const pts = [proj(side * 1.2, -3), proj(side * 5.2, -3), proj(side * 5.2, 3), proj(side * 1.2, 3)];
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
  }
  const plate = [proj(-0.71, 0.0), proj(0.71, 0.0), proj(0.71, -0.71), proj(0, -1.42), proj(-0.71, -0.71)];
  ctx.fillStyle = "#F5F6F2";
  ctx.beginPath();
  plate.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Floodlight pools on the infield and a soft vignette to the corners.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pool = ctx.createRadialGradient(W / 2, 360, 10, W / 2, 360, 260);
  pool.addColorStop(0, "rgba(255,238,200,0.10)");
  pool.addColorStop(1, "rgba(255,238,200,0)");
  ctx.fillStyle = pool;
  ctx.fillRect(0, 300, W, 360);
  ctx.restore();
  const vig = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

/** The park behind everything (sky to plate), signs included; painted once per size and seed. */
export function paintHomerunPark(ctx: CanvasRenderingContext2D, plan: HomerunPlan | null): void {
  paintSky(ctx);
  paintStands(ctx);
  paintFloodlight(ctx, 34, 50, 44);
  paintFloodlight(ctx, 132, 30, 52);
  paintFloodlight(ctx, 258, 30, 52);
  paintFloodlight(ctx, 356, 50, 44);
  if (plan) plan.signs.forEach((s, i) => paintSign(ctx, s, i, true));
  paintWall(ctx);
  paintPole(ctx, homerunSprayX(450));
  paintPole(ctx, homerunSprayX(-450));
  paintField(ctx);
}

/* --------------------------------------------------------------- people */

/**
 * The pitcher on the mound: a clean shaded silhouette with a warm rim light. `phase` runs 0 (set) → 1 (release) → 2
 * (follow-through); drawn at its feet (x, y) and height h px.
 */
export function paintPitcher(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, phase: number): void {
  const u = h / 60;
  const lift = phase < 1 ? Math.sin(Math.min(1, phase / 0.6) * Math.PI) : 0;
  const lean = phase < 0.6 ? -0.1 * (phase / 0.6) : phase < 1 ? -0.1 + 0.45 * ((phase - 0.6) / 0.4) : 0.35 - 0.2 * Math.min(1, phase - 1);
  const arm = phase < 0.6 ? -2.4 * (phase / 0.6) : phase < 1 ? -2.4 + 4.4 * ((phase - 0.6) / 0.4) : 2 + 0.6 * Math.min(1, phase - 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u);
  // Shadow on the mound.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createLinearGradient(-10, 0, 10, 0);
  body.addColorStop(0, "#0C0F17");
  body.addColorStop(0.7, "#1B2232");
  body.addColorStop(1, "#3A4559");
  ctx.fillStyle = body;
  ctx.strokeStyle = body;
  ctx.lineCap = "round";
  // Legs (the front leg lifts in the wind-up).
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-3, -26);
  ctx.lineTo(-5, 0);
  ctx.moveTo(3, -26);
  ctx.lineTo(4 + 6 * lift, -12 * lift);
  ctx.lineTo(6 + 4 * lift, -2 - 10 * lift);
  ctx.stroke();
  // Torso.
  ctx.save();
  ctx.translate(0, -26);
  ctx.rotate(lean);
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(-8, -20);
  ctx.quadraticCurveTo(0, -25, 8, -20);
  ctx.lineTo(7, 0);
  ctx.closePath();
  ctx.fill();
  // Throwing arm and glove arm.
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(6, -18);
  ctx.lineTo(6 + Math.cos(arm) * 9, -18 + Math.sin(arm) * 9);
  ctx.lineTo(6 + Math.cos(arm) * 17, -18 + Math.sin(arm) * 17 - 2);
  ctx.moveTo(-6, -17);
  ctx.lineTo(-11, -9);
  ctx.stroke();
  ctx.fillStyle = "#3A2A1A";
  ctx.beginPath();
  ctx.arc(-11.5, -8, 3.4, 0, Math.PI * 2);
  ctx.fill();
  // Head and cap.
  ctx.fillStyle = "#1B2232";
  ctx.beginPath();
  ctx.arc(0, -28, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0A0D14";
  ctx.beginPath();
  ctx.arc(0, -29.5, 5.2, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-1, -30, 9, 1.8);
  // Rim light down the right side (the floodlights behind and to the right).
  ctx.strokeStyle = "rgba(255,232,190,0.75)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(0, -28, 5, -1.2, 0.9);
  ctx.moveTo(8, -20);
  ctx.lineTo(7, 0);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,232,190,0.55)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-1.5, -26);
  ctx.lineTo(-3.5, 0);
  ctx.stroke();
  ctx.restore();
}

/** The bat: dark lacquered ash, tapered from the knob (pivot side) to the barrel, at angle `a` from the pivot. */
export function paintBat(ctx: CanvasRenderingContext2D, px: number, py: number, a: number, len: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(px, py);
  ctx.rotate(a);
  const g = ctx.createLinearGradient(0, -8, 0, 8);
  g.addColorStop(0, "#5B3A22");
  g.addColorStop(0.35, "#2A170C");
  g.addColorStop(0.55, "#170B05");
  g.addColorStop(1, "#3D2614");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(len * 0.45, -3.2);
  ctx.quadraticCurveTo(len * 0.62, -7.4, len * 0.78, -7.8);
  ctx.lineTo(len - 4, -7.6);
  ctx.quadraticCurveTo(len, -7.4, len, 0);
  ctx.quadraticCurveTo(len, 7.4, len - 4, 7.6);
  ctx.lineTo(len * 0.78, 7.8);
  ctx.quadraticCurveTo(len * 0.62, 7.4, len * 0.45, 3.2);
  ctx.lineTo(0, 3);
  ctx.closePath();
  ctx.fill();
  // Rim light along the barrel's top edge, a specular streak.
  ctx.strokeStyle = "rgba(255,226,180,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(len * 0.5, -3.6);
  ctx.quadraticCurveTo(len * 0.64, -7.2, len * 0.8, -7.4);
  ctx.lineTo(len - 4, -7.2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,240,215,0.22)";
  ctx.fillRect(len * 0.66, -5.2, len * 0.28, 1.6);
  ctx.restore();
}

/* -------------------------------------------------------------- per frame */

const PITCHER_FEET = proj(0, 60.5);
const PITCHER_H = 46;

function pitcherPhase(state: HomerunState): number {
  const p = homerunCurrent(state);
  if (!p) return 2;
  const since = state.tick - (p.release - HOMERUN_WINDUP_TICKS);
  if (since < 0) {
    const prev = homerunPlan(state.seed).pitches[state.pitch - 1];
    return prev && state.tick - prev.release < 50 ? 1 + (state.tick - prev.release) / 50 : 0;
  }
  if (state.tick < p.release) return (since / HOMERUN_WINDUP_TICKS) * 1;
  return Math.min(2, 1 + (state.tick - p.release) / 40);
}

/** The bat's pivot and angle: resting up by the right edge, sweeping through the zone during a swing. */
function batPose(state: HomerunState): { x: number; y: number; a: number; alpha: number } {
  // At rest the barrel stands up by the right edge (the hands below the screen); a swing sweeps it down and round, flat
  // through the zone at the swipe's height (tilted by its angle), its sweet spot over the plate at contact.
  const rest = { x: 438, y: 650, a: -1.95, alpha: 1 };
  let tick0 = state.swingTick;
  let a = state.swingA;
  let b = state.swingB;
  if (tick0 < 0) {
    // The swing that decided the last pitch, as the sim stored it (its follow-through).
    const last = state.hits[state.hits.length - 1];
    if (!last || last.st < 0 || last.st + 60 < state.tick) return rest;
    tick0 = last.st;
    a = last.a;
    b = last.b;
  }
  const k = state.tick - tick0;
  const tilt = -(b / 10) * (Math.PI / 180) * 0.6;
  const contact = -Math.PI + tilt;
  const reach = BAT_LEN * 0.84;
  const px = (HOMERUN_ZONE_X0 + HOMERUN_ZONE_X1) / 2 - reach * Math.cos(contact);
  const py = a - reach * Math.sin(contact);
  if (k <= HOMERUN_SWING_TICKS) {
    const u = k / HOMERUN_SWING_TICKS;
    const e = u * u * (3 - 2 * u);
    return { x: rest.x + (px - rest.x) * e, y: rest.y + (py - rest.y) * e, a: rest.a + (contact - rest.a) * e, alpha: 1 };
  }
  if (k <= HOMERUN_SWING_TICKS + 8) {
    const u = (k - HOMERUN_SWING_TICKS) / 8;
    return { x: px - 60 * u, y: py - 50 * u, a: contact - 0.9 * u, alpha: 1 };
  }
  // The follow-through fades out and the bat is back up by the edge for the next pitch.
  const u = Math.min(1, (k - HOMERUN_SWING_TICKS - 8) / 30);
  return u < 0.5 ? { x: px - 60, y: py - 50, a: contact - 0.9, alpha: 1 - u * 2 } : { ...rest, alpha: (u - 0.5) * 2 };
}
const BAT_LEN = 250;

function paintBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number): void {
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, "#FFFFFF");
  g.addColorStop(0.7, "#ECEBE4");
  g.addColorStop(1, "#B9B6AA");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (r > 3) {
    ctx.strokeStyle = "#C2373A";
    ctx.lineWidth = Math.max(0.6, r * 0.12);
    ctx.beginPath();
    ctx.arc(x - r * 0.9, y, r * 0.75, -0.9 + spin, 0.9 + spin);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + r * 0.9, y, r * 0.75, Math.PI - 0.9 + spin, Math.PI + 0.9 + spin);
    ctx.stroke();
  }
  ctx.restore();
}

/** Where a batted ball is `k` ticks after contact: from the plate out to its landing (or the stands), shrinking. */
export function homerunFlight(hit: HomerunHit, from: { x: number; y: number }, k: number, sign?: HomerunSign): { x: number; y: number; r: number; done: boolean } {
  const dur = hit.out === OUT_FOUL ? 50 : 70 + Math.round(hit.feet / 10);
  const u = Math.min(1, k / dur);
  const landX = homerunSprayX(hit.out === OUT_FOUL ? (hit.spray < 0 ? -560 : 560) : hit.spray);
  const fence = homerunFence(hit.spray);
  const box = sign ? homerunSignBox(sign) : null;
  const landY = box ? box.y + box.h / 2 : hit.out === OUT_HOMER ? wallTop(hit.spray) - 8 - Math.min(110, (hit.feet - fence) * 1.2) : 300 + Math.max(0, fence - hit.feet) * 0.55;
  const peak = 90 + (hit.launch / 10) * 4.2;
  const e = 1 - (1 - u) * (1 - u);
  const x = from.x + (landX - from.x) * e;
  const yLine = from.y + (landY - from.y) * e;
  const y = yLine - peak * Math.sin(Math.PI * Math.min(1, u * (hit.out === OUT_HOMER && !box ? 0.62 : 1)));
  return { x, y, r: Math.max(1.2, 9 * (1 - e) + 1.4 * e), done: u >= 1 };
}

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, accent = false, align: "left" | "right" | "center" = "left"): number {
  ctx.save();
  ctx.font = `700 11px ${MONO}`;
  const w = Math.ceil(ctx.measureText(text).width) + 18;
  const x0 = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  ctx.fillStyle = "rgba(6,9,18,0.66)";
  ctx.beginPath();
  ctx.roundRect(x0, y, w, 22, 11);
  ctx.fill();
  ctx.strokeStyle = accent ? "rgba(242,199,92,0.75)" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = accent ? "#F2C75C" : "#F3F1EC";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, x0 + w / 2, y + 11.5);
  ctx.restore();
  return w;
}

function outcomeText(hit: HomerunHit): { big: string; small: string; gold: boolean } {
  if (hit.out === OUT_HOMER) return { big: hit.sign >= 0 ? "SIGN HIT!" : "HOME RUN", small: `${hit.feet} FT`, gold: true };
  if (hit.out === OUT_FAIR) return { big: `${hit.feet} FT`, small: hit.feet >= 300 ? "OFF THE WALL" : "IN PLAY", gold: false };
  if (hit.out === OUT_FOUL) return { big: "FOUL", small: "", gold: false };
  if (hit.out === OUT_WHIFF) return { big: "STRIKE", small: "SWING AND MISS", gold: false };
  return { big: "STRIKE", small: "LOOKING", gold: false };
}

/** The play screen's frame: the park and the run, under the shared success and miss effects (sportsFx.renderer.ts). */
export function drawHomerunArt(ctx: CanvasRenderingContext2D, state: HomerunState, size: CanvasSize): void {
  arcadeFx(ctx, HOMERUN_FX, state, () => drawHomerunWorld(ctx, state), size);
}

function drawHomerunWorld(ctx: CanvasRenderingContext2D, state: HomerunState): void {
  const plan = homerunPlan(state.seed);
  deviceLayer(ctx, `homerun-park:${state.seed}`, (c) => paintHomerunPark(c, plan));
  const still = reducedMotion();

  // Signs already struck dim (painted over the lit layer).
  plan.signs.forEach((s, i) => {
    if (state.signs & (1 << i)) paintSign(ctx, s, i, false);
  });

  // Camera flashes in the stands.
  if (!still) {
    for (let i = 0; i < 4; i++) {
      const h = artHash(state.tick >> 3, i * 31 + 7);
      if (h % 5 !== 0) continue;
      const x = h % W;
      const y = 145 + ((h >>> 10) % 120);
      const r = 3 + ((h >>> 20) % 4);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(1, "rgba(200,220,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
      ctx.restore();
    }
  }

  // The pitcher.
  paintPitcher(ctx, PITCHER_FEET.x + 4, PITCHER_FEET.y - 2, PITCHER_H, pitcherPhase(state));

  // The faint dashed strike zone.
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(HOMERUN_ZONE_X0 + 0.5, HOMERUN_ZONE_Y0 + 0.5, HOMERUN_ZONE_X1 - HOMERUN_ZONE_X0, HOMERUN_ZONE_Y1 - HOMERUN_ZONE_Y0);
  ctx.restore();

  // The pitch in flight (and a pitch taken or missed, carrying on past the plate).
  const p = homerunCurrent(state);
  if (p) {
    const b = homerunBallAt(p, state.tick);
    if (b) {
      const prev = homerunBallAt(p, Math.max(p.release, state.tick - 2));
      const r = 1.6 + 8.4 * b.u * b.u;
      if (prev && b.u > 0.3) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = r * 1.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
      }
      paintBall(ctx, b.x, b.y, r, state.tick * 0.9);
    }
  }

  // The last decided pitch: its batted ball, then the call.
  const last = state.hits[state.hits.length - 1];
  const lastPitch = plan.pitches[state.hits.length - 1];
  if (last && lastPitch) {
    const k = state.tick - last.at;
    if (last.out === OUT_FAIR || last.out === OUT_HOMER || last.out === OUT_FOUL) {
      const f = homerunFlight(last, { x: lastPitch.plateX, y: lastPitch.plateY }, k, last.sign >= 0 ? plan.signs[last.sign] : undefined);
      if (!f.done || k < 140) {
        if (k < 6 && !still) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const g = ctx.createRadialGradient(lastPitch.plateX, lastPitch.plateY, 0, lastPitch.plateX, lastPitch.plateY, 40);
          g.addColorStop(0, `rgba(255,240,200,${0.7 - k * 0.1})`);
          g.addColorStop(1, "rgba(255,240,200,0)");
          ctx.fillStyle = g;
          ctx.fillRect(lastPitch.plateX - 40, lastPitch.plateY - 40, 80, 80);
          ctx.restore();
        }
        if (!f.done) paintBall(ctx, f.x, f.y, f.r, k * 0.6);
        if (f.done && last.sign >= 0 && k < 140) {
          const sb = homerunSignBox(plan.signs[last.sign]!);
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = `rgba(255,214,110,${0.5 * (1 - (k % 20) / 20)})`;
          ctx.fillRect(sb.x - 4, sb.y - 4, sb.w + 8, sb.h + 8);
          ctx.restore();
        }
      }
    }
    if (k >= 0 && k < 120) {
      const t = outcomeText(last);
      const alpha = k < 100 ? 1 : (120 - k) / 20;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 30px ${ARCADE_FX_DISPLAY_FONT}`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeText(t.big, W / 2, 96);
      ctx.fillStyle = t.gold ? "#F2C75C" : "#F3F1EC";
      ctx.fillText(t.big, W / 2, 96);
      if (t.small) {
        ctx.font = `700 13px ${MONO}`;
        ctx.strokeText(t.small, W / 2, 124);
        ctx.fillStyle = "#E6E4DE";
        ctx.fillText(t.small, W / 2, 124);
      }
      ctx.restore();
    }
  }

  // The bat, last, nearest the camera.
  const pose = batPose(state);
  paintBat(ctx, pose.x, pose.y, pose.a, BAT_LEN, pose.alpha);

  // HUD chips along the top.
  const shown = Math.min(state.hits.length + 1, HOMERUN_PITCHES);
  let x = 10;
  x += chip(ctx, x, 10, `PITCH ${shown}/${HOMERUN_PITCHES}`) + 6;
  x += chip(ctx, x, 10, `HR ${state.homers}`, state.homers > 0) + 6;
  let signs = 0;
  for (let i = 0; i < HOMERUN_SIGNS; i++) if (state.signs & (1 << i)) signs++;
  chip(ctx, x, 10, `SIGNS ${signs}/${HOMERUN_SIGNS}`, signs > 0);
  if (p && state.tick >= p.release - HOMERUN_WINDUP_TICKS) chip(ctx, W - 10, 10, `${HOMERUN_PITCH_NAMES[p.kind]!.toUpperCase()} ${p.mph}`, false, "right");
}

export const homerunArtGame = { ...homerunGame, draw: drawHomerunArt };

/**
 * The play screen's scenery beyond the world (painted once per size, world units, the world's own transform): the
 * park's bands carried out to the sides (sky, stands, wall, grass, dirt), each a shade darker than the world's edge,
 * and the plate's dirt settling darker below it.
 */
export function homerunScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const bands: [number, string][] = [
    [0, "#03050B"],
    [0.17, "#060A16"],
    [0.19, "#080C16"],
    [0.38, "#0A0D17"],
    [0.4, "#0C2015"],
    [0.43, "#122B19"],
    [0.6, "#13301B"],
    [0.66, "#3C2A1A"],
    [1, "#2E1F12"],
  ];
  for (const side of sceneSides(view)) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    for (const [at, c] of bands) g.addColorStop(at, c);
    ctx.fillStyle = g;
    ctx.fillRect(side.x, Math.min(side.y, view.top), side.w, Math.max(side.h, H - view.top));
  }
  if (view.top < 0) {
    ctx.fillStyle = "#03050B";
    ctx.fillRect(view.left, view.top, view.right - view.left, -view.top + 2);
  }
  const below = sceneBelow(view);
  if (below) {
    const g = ctx.createLinearGradient(0, below.y, 0, below.y + below.h);
    g.addColorStop(0, "#33231A");
    g.addColorStop(Math.min(1, 40 / Math.max(1, below.h)), "#251810");
    g.addColorStop(1, "#140C07");
    ctx.fillStyle = g;
    ctx.fillRect(below.x, below.y, below.w, below.h);
  }
}

/** Tile icon helper: the park and a ball heading for the seats, at the icon's size (scripts/shots/tile-scenes). */
export function paintHomerunTile(ctx: CanvasRenderingContext2D, size: number, seed = 7): void {
  const plan = homerunPlan(seed);
  ctx.save();
  // A close crop: the lit wall, a sign and the pitcher, a ball climbing toward the seats.
  const s = size / 180;
  ctx.scale(s, s);
  ctx.translate(-92, -190);
  paintHomerunPark(ctx, plan);
  paintPitcher(ctx, PITCHER_FEET.x + 4, PITCHER_FEET.y - 2, PITCHER_H * 1.15, 1.2);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(250, 330);
  ctx.quadraticCurveTo(232, 262, 215, 238);
  ctx.stroke();
  ctx.restore();
  paintBall(ctx, 214, 236, 5.5, 0.4);
  ctx.restore();
}
