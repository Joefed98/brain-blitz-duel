/**
 * Home Run's art (display only; never imported by the sim or the server; redrawn 31 Oct 2026 for the Sports tuning
 * batch). A fixed camera behind the plate, just over the batter's right shoulder: the night park (sky, floodlight
 * banks with bloom, two packed tiers of fans with an LED ribbon, the radar board, the padded wall with its distance
 * markers, the foul poles, the seeded signs, the outfield, the infield, the mound and the plate's dirt) is painted once
 * per canvas size and seed (deviceLayer); per frame the pitcher, the pitch, the batter and his swing, the batted ball,
 * the crowd's flashes and cheers, the call with Early / Perfect / Late and the contact-height marker, the radar
 * board's reading and the HUD chips are drawn.
 *
 * homerunRev 3 (1 Nov 2026): the pitcher's tell for the last HOMERUN_TELL_TICKS of the wind-up (the arm slot on the
 * figure, a flash of the pitch's colour at the glove and a grip bubble beside him: `paintTell`), the swing chip
 * (CONTACT / POWER, the choice standing, locked at the release) and Early / Perfect / Late against the pitch kind's own
 * perfect tick (homerunPerfectOffset). Earlier revisions draw as before.
 *
 * The near field (plate, batter, mound) is a pinhole projection (`proj`, feet); the outfield wall and the stands use a
 * panoramic angle mapping (spray angle → screen x) so both foul poles stay in view. The strike zone and the pitch's
 * plate point are the sim's own world px (homerunBallAt, the plan); the batter is a jointed 3-D figure projected
 * through the same camera, and his swing reaches the plate on the sim's contact tick at the swipe's height, so a
 * mistimed swing visibly passes before or after the ball. The park is painted out to any extent, so the play screen's
 * scenery beyond the world (homerunScene) is the same park carried on with no seam.
 */
import { artHash, reducedMotion } from "./art.renderer";
import { deviceLayer } from "./cache.renderer";
import { arcadeFx, ARCADE_FX_DISPLAY_FONT } from "./arcadeFx.renderer";
import { HOMERUN_FX } from "./sportsFx.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import type { CanvasSize } from "./engine";
import {
  homerunBallAt,
  homerunCurrent,
  homerunFence,
  homerunGame,
  homerunPerfectOffset,
  homerunPlan,
  HOMERUN_MODE_POWER,
  HOMERUN_REV_3,
  HOMERUN_TELL_TICKS,
  PITCH_CHANGEUP,
  PITCH_CURVE,
  PITCH_DROP,
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
  type HomerunPitch,
  type HomerunPlan,
  type HomerunSign,
  type HomerunState,
} from "./homerun";

export const HOMERUN_ART_BG = "#04060D";

const W = HOMERUN_WORLD_W;
const H = HOMERUN_WORLD_H;
const MONO = "'Duelz Mono', 'JetBrains Mono', ui-monospace, monospace";

/* ------------------------------------------------------------ the camera */

/**
 * The camera: 16 ft behind the plate, 9 ft up, 1.21 ft toward the batter's side, looking level at centre field. The
 * strike zone (world px 212–304 × 446–566) is then 1.25–3.56 ft up over the plate, 52 px to the foot at its depth.
 */
const CX = 195;
const YH = 163;
const F = 832;
const CAM_H = 9;
const CAM_BACK = 16;
const CAM_X = -1.21;

interface Pt {
  x: number;
  y: number;
  s: number;
  d: number;
}

/** A field point (x toward first base, y up, z toward centre field, feet; the plate at the origin) on screen. */
function proj(x: number, z: number, y = 0): Pt {
  const d = Math.max(0.8, z + CAM_BACK);
  return { x: CX + (F * (x - CAM_X)) / d, y: YH + (F * (CAM_H - y)) / d, s: F / d, d };
}
type V3 = [number, number, number];
const P = (v: V3): Pt => proj(v[0], v[2], v[1]);

/** The plate plane (z = 0): a screen point back to field feet (x, height). */
function plateFeet(sx: number, sy: number): { x: number; h: number } {
  return { x: ((sx - CX) * CAM_BACK) / F + CAM_X, h: CAM_H - ((sy - YH) * CAM_BACK) / F };
}

/** The outfield's panoramic mapping: spray angle (tenths of a degree, + = left field) → screen x. */
export function homerunSprayX(spray: number): number {
  return CX - (spray / 10) * 4;
}
const sprayAt = (x: number) => ((CX - x) / 4) * 10;
/** The top of the outfield wall at a spray angle (deepest in centre, so highest on screen). */
function wallTop(spray: number): number {
  return 168 + (400 - homerunFence(spray)) * 0.08;
}
const WALL_H = 10;

/** How far the static park is painted (the world, or the play screen's whole box for the scenery). */
interface Extent {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
const WORLD_EXTENT: Extent = { x0: -24, x1: W + 24, y0: -8, y1: H + 8 };

/* ------------------------------------------------------------ the park */

function paintSky(ctx: CanvasRenderingContext2D, e: Extent): void {
  const g = ctx.createLinearGradient(0, -60, 0, 60);
  g.addColorStop(0, "#02040A");
  g.addColorStop(0.6, "#060B1A");
  g.addColorStop(1, "#0C1430");
  ctx.fillStyle = g;
  ctx.fillRect(e.x0, e.y0, e.x1 - e.x0, 60 - e.y0);
  const sx0 = Math.floor(e.x0 / 20) * 20;
  for (let x = sx0; x < e.x1; x += 20) {
    const h = artHash(Math.round(x), 77);
    if (h % 3) continue;
    ctx.fillStyle = `rgba(220,230,255,${0.25 + ((h >>> 20) % 50) / 100})`;
    ctx.fillRect(x + ((h >>> 4) % 20), -2 + ((h >>> 9) % 26), (h >>> 6) % 5 === 0 ? 1.6 : 1, (h >>> 6) % 5 === 0 ? 1.6 : 1);
  }
}

/** One floodlight bank on its gantry above the roof: the lamps, their bloom and a soft beam down onto the field. */
function paintFloodlight(ctx: CanvasRenderingContext2D, cx: number, top: number, w: number): void {
  ctx.fillStyle = "#0A0E17";
  ctx.fillRect(cx - 1.5, top + 16, 3, 32 - top);
  ctx.fillStyle = "#161C2A";
  ctx.fillRect(cx - w / 2 - 3, top - 3, w + 6, 19);
  const cols = Math.round(w / 6.5);
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (c + r) % 5 === 0 ? "#FFE9C4" : "#FFF9EC";
      ctx.fillRect(cx - w / 2 + 1.5 + c * ((w - 3) / cols), top + 1 + r * 6.5, 4, 4.4);
    }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const bloom = ctx.createRadialGradient(cx, top + 6, 2, cx, top + 6, w * 1.5);
  bloom.addColorStop(0, "rgba(255,246,222,0.9)");
  bloom.addColorStop(0.22, "rgba(255,236,196,0.32)");
  bloom.addColorStop(1, "rgba(255,230,180,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(cx - w * 1.5, top + 6 - w * 1.5, w * 3, w * 3);
  const beam = ctx.createLinearGradient(0, top + 14, 0, 420);
  beam.addColorStop(0, "rgba(255,240,205,0.10)");
  beam.addColorStop(1, "rgba(255,240,205,0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, top + 14);
  ctx.lineTo(cx + w / 2, top + 14);
  ctx.lineTo(CX + (cx - CX) * 0.35 + 90, 420);
  ctx.lineTo(CX + (cx - CX) * 0.35 - 90, 420);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const SHIRTS = ["#E9ECF2", "#1F2E5C", "#F2C75C", "#B8443A", "#2B4C8C", "#D9D2BC", "#7A2C3A", "#3E6E7E", "#F4F4F4", "#18223F", "#C9A24A", "#5B6B8C"];
const SKIN = ["#3A2A20", "#C69C7A", "#8A5E44", "#E2B596", "#5C3F2C"];

/**
 * A packed tier of fans between y0 and y1: rows of shaded heads (some capped) and shirts, a concrete step under each,
 * a few standing; lit warm from the floodlights at the front and falling off toward the back.
 */
function paintCrowd(ctx: CanvasRenderingContext2D, e: Extent, y0: number, y1: number, size: number, salt: number): void {
  const rowH = size * 1.45;
  const step = size * 1.02;
  let row = 0;
  for (let y = y1 - rowH; y >= y0 - rowH * 0.5; y -= rowH, row++) {
    const depth = (y - y0) / Math.max(1, y1 - y0);
    ctx.fillStyle = "#0B0F19";
    ctx.fillRect(e.x0, y + rowH - 1.1, e.x1 - e.x0, 1.1);
    const start = Math.floor(e.x0 / step) * step + (row % 2) * (step / 2);
    for (let x = start; x < e.x1 + step; x += step) {
      const h = artHash(Math.round(x * 10) + row * 997, salt);
      if (h % 13 === 0) continue;
      const stand = h % 17 === 1 ? size * 0.5 : 0;
      const lit = 0.5 + 0.5 * depth;
      ctx.globalAlpha = 0.55 + 0.45 * lit;
      ctx.fillStyle = SHIRTS[(h >>> 3) % SHIRTS.length]!;
      ctx.beginPath();
      ctx.roundRect(x - size * 0.46, y + size * 0.55 - stand, size * 0.92, size * 0.95 + stand, size * 0.25);
      ctx.fill();
      ctx.fillStyle = SKIN[(h >>> 7) % SKIN.length]!;
      ctx.beginPath();
      ctx.arc(x, y + size * 0.33 - stand, size * 0.31, 0, Math.PI * 2);
      ctx.fill();
      if ((h >>> 11) % 4 === 0) {
        ctx.fillStyle = (h >>> 13) % 2 ? "#1F2E5C" : "#B8443A";
        ctx.fillRect(x - size * 0.33, y + size * 0.08 - stand, size * 0.66, size * 0.22);
      }
    }
  }
  ctx.globalAlpha = 1;
  const wash = ctx.createLinearGradient(0, y0, 0, y1);
  wash.addColorStop(0, "rgba(4,7,16,0.45)");
  wash.addColorStop(1, "rgba(255,226,170,0.07)");
  ctx.fillStyle = wash;
  ctx.fillRect(e.x0, y0 - rowH, e.x1 - e.x0, y1 - y0 + rowH);
}

function signText(i: number): string {
  return ["450 CLUB", "DEEP", "LIGHTS OUT", "JOULZ", "MOONSHOT"][i % 5]!;
}

/** Where sign `s` sits on screen (on the lower tier's front, just above the wall). */
export function homerunSignBox(s: HomerunSign): { x: number; y: number; w: number; h: number } {
  const x0 = homerunSprayX(s.angle + s.half);
  const x1 = homerunSprayX(s.angle - s.half);
  const y = wallTop(s.angle) - 21 - Math.round((s.lift - 30) * 0.3);
  return { x: x0, y, w: x1 - x0, h: 12 };
}

function paintSign(ctx: CanvasRenderingContext2D, s: HomerunSign, i: number, lit: boolean): void {
  const b = homerunSignBox(s);
  ctx.save();
  ctx.fillStyle = "#05070D";
  ctx.fillRect(b.x - 1.5, b.y - 1.5, b.w + 3, b.h + 3);
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  g.addColorStop(0, lit ? "#2E2510" : "#14161E");
  g.addColorStop(1, lit ? "#140F05" : "#0B0C12");
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = lit ? "#F2C75C" : "rgba(242,199,92,0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  ctx.fillStyle = lit ? "#FFE7A3" : "rgba(255,231,163,0.4)";
  ctx.font = `800 7px ${ARCADE_FX_DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(signText(i), b.x + b.w / 2, b.y + b.h / 2 + 0.5);
  if (lit) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(242,199,92,0.08)";
    ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  }
  ctx.restore();
}

/** The radar board in the upper deck (right field side), its LED face dark until a pitch is read out. */
const RADAR = { x: 286, y: 40, w: 92, h: 34 };
function paintRadarBoard(ctx: CanvasRenderingContext2D): void {
  const b = RADAR;
  ctx.fillStyle = "#06080E";
  ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
  ctx.fillStyle = "#11151F";
  ctx.fillRect(b.x + b.w / 2 - 2, b.y + b.h + 3, 4, 10);
  ctx.fillStyle = "#020306";
  ctx.fillRect(b.x, b.y, b.w, b.h);
  // The unlit LED matrix.
  ctx.fillStyle = "rgba(255,140,40,0.06)";
  for (let y = b.y + 2; y < b.y + b.h - 1; y += 2.4) for (let x = b.x + 2; x < b.x + b.w - 1; x += 2.4) ctx.fillRect(x, y, 1.4, 1.4);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
}

function paintStands(ctx: CanvasRenderingContext2D, e: Extent): void {
  // The roof's underside, the upper deck, its fascia with the LED ribbon, the lower bowl and the front rail.
  ctx.fillStyle = "#0A0E19";
  ctx.fillRect(e.x0, 26, e.x1 - e.x0, 142);
  ctx.fillStyle = "#121827";
  ctx.fillRect(e.x0, 24, e.x1 - e.x0, 7);
  for (let x = Math.floor(e.x0 / 26) * 26; x < e.x1; x += 26) {
    ctx.fillStyle = "#0E1320";
    ctx.fillRect(x, 31, 2, 6);
  }
  paintCrowd(ctx, e, 36, 90, 4.4, 11);
  ctx.fillStyle = "#171E2F";
  ctx.fillRect(e.x0, 90, e.x1 - e.x0, 11);
  const ribbon = ctx.createLinearGradient(-200, 0, W + 200, 0);
  ribbon.addColorStop(0, "#1C3F78");
  ribbon.addColorStop(0.3, "#2B6CD8");
  ribbon.addColorStop(0.5, "#F2C75C");
  ribbon.addColorStop(0.7, "#2B6CD8");
  ribbon.addColorStop(1, "#1C3F78");
  ctx.fillStyle = ribbon;
  ctx.fillRect(e.x0, 93.5, e.x1 - e.x0, 3.5);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "rgba(80,150,255,0.16)";
  ctx.fillRect(e.x0, 89, e.x1 - e.x0, 12);
  ctx.restore();
  paintCrowd(ctx, e, 101, 160, 5.6, 23);
  ctx.fillStyle = "#0D121C";
  ctx.fillRect(e.x0, 159, e.x1 - e.x0, 12);
  ctx.fillStyle = "rgba(200,210,230,0.35)";
  ctx.fillRect(e.x0, 160, e.x1 - e.x0, 0.8);
}

function wallPath(ctx: CanvasRenderingContext2D, e: Extent, dy: number): void {
  for (let x = Math.floor(e.x0 / 4) * 4; x <= e.x1 + 4; x += 4) {
    const y = wallTop(sprayAt(x)) + dy;
    if (x === Math.floor(e.x0 / 4) * 4) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

function paintWall(ctx: CanvasRenderingContext2D, e: Extent): void {
  ctx.beginPath();
  wallPath(ctx, e, 0);
  ctx.lineTo(e.x1 + 4, 200);
  ctx.lineTo(e.x0, 200);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 166, 0, 184);
  g.addColorStop(0, "#22543A");
  g.addColorStop(1, "#0E2619");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#E8C547";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  wallPath(ctx, e, 0);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  for (let x = Math.floor(e.x0 / 18) * 18 + 9; x < e.x1; x += 18) {
    const y = wallTop(sprayAt(x));
    ctx.beginPath();
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x, y + WALL_H);
    ctx.stroke();
  }
  ctx.fillStyle = "#F4F6FA";
  ctx.font = `700 6.5px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const spray of [-420, -220, 0, 220, 420]) ctx.fillText(String(homerunFence(spray)), homerunSprayX(spray), wallTop(spray) + 5.5);
  // Warning track.
  ctx.fillStyle = "#5A4130";
  ctx.beginPath();
  wallPath(ctx, e, WALL_H);
  ctx.lineTo(e.x1 + 4, 189);
  ctx.lineTo(e.x0, 189);
  ctx.closePath();
  ctx.fill();
}

function paintPole(ctx: CanvasRenderingContext2D, x: number): void {
  const g = ctx.createLinearGradient(x - 2, 0, x + 2, 0);
  g.addColorStop(0, "#9C7B12");
  g.addColorStop(0.5, "#FFE15A");
  g.addColorStop(1, "#B38E1A");
  ctx.fillStyle = g;
  ctx.fillRect(x - 1.4, 92, 2.8, 92);
  ctx.fillRect(x - (x < CX ? 0 : 6), 100, 6, 40);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "rgba(255,225,90,0.12)";
  ctx.fillRect(x - 5, 92, 10, 92);
  ctx.restore();
}

function polyFill(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
}

function paintField(ctx: CanvasRenderingContext2D, e: Extent): void {
  // The outfield, mowed in bands across and stripes toward the plate.
  const grass = ctx.createLinearGradient(0, 186, 0, 460);
  grass.addColorStop(0, "#1A4528");
  grass.addColorStop(0.4, "#24603A");
  grass.addColorStop(1, "#1E5131");
  ctx.fillStyle = grass;
  ctx.fillRect(e.x0, 188, e.x1 - e.x0, e.y1 - 188);
  ctx.save();
  ctx.beginPath();
  ctx.rect(e.x0, 188.5, e.x1 - e.x0, e.y1 - 188.5);
  ctx.clip();
  for (let i = -30; i <= 30; i += 2) {
    polyFill(ctx, [proj(i * 14, 420), proj((i + 1) * 14, 420), proj((i + 1) * 14, 2), proj(i * 14, 2)], "rgba(255,255,255,0.03)");
  }
  for (let z = 120; z < 400; z += 40) {
    polyFill(ctx, [proj(-600, z + 20), proj(600, z + 20), proj(600, z), proj(-600, z)], "rgba(0,0,0,0.05)");
  }
  // The infield's dirt arc beyond the bases (radius 95 ft round the mound, out to the foul lines).
  const arc: Pt[] = [];
  for (let a = -46; a <= 46; a += 2) {
    const t = (a * Math.PI) / 180;
    arc.push(proj(Math.sin(t) * 155, Math.cos(t) * 155));
  }
  for (let a = 46; a >= -46; a -= 2) {
    const t = (a * Math.PI) / 180;
    arc.push(proj(Math.sin(t) * 98, Math.cos(t) * 98));
  }
  polyFill(ctx, arc, "#7C5839");
  // The infield grass's cut edge (the diamond inside the base paths).
  polyFill(ctx, [proj(0, 6), proj(57, 63.5), proj(0, 121), proj(-57, 63.5)], "#26663D");
  polyFill(ctx, [proj(0, 10), proj(54, 63.5), proj(0, 117), proj(-54, 63.5)], "rgba(255,255,255,0.025)");
  // Second base.
  const b2 = proj(0, 127);
  ctx.fillStyle = "#EDEFF3";
  ctx.fillRect(b2.x - 2.5, b2.y - 0.8, 5, 1.6);
  // The mound.
  const m = proj(0, 60.5);
  const mr = 9 * m.s;
  const md = ctx.createRadialGradient(m.x, m.y - 2, 2, m.x, m.y, mr);
  md.addColorStop(0, "#A07250");
  md.addColorStop(1, "#6E4C31");
  ctx.fillStyle = md;
  ctx.beginPath();
  ctx.ellipse(m.x, m.y, mr, 9 * (proj(0, 51.5).y - proj(0, 69.5).y) / 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F2F2EE";
  ctx.fillRect(m.x - 7, m.y - 1, 14, 1.4);
  // The home plate's dirt circle (radius 13 ft) and the base paths' cut-outs.
  const circle: Pt[] = [];
  for (let a = 0; a <= 360; a += 4) {
    const t = (a * Math.PI) / 180;
    circle.push(proj(Math.sin(t) * 13, Math.cos(t) * 13));
  }
  const p0 = proj(0, 0);
  const dirt = ctx.createRadialGradient(p0.x, p0.y - 40, 10, p0.x, p0.y, 520);
  dirt.addColorStop(0, "#94694A");
  dirt.addColorStop(1, "#5E412A");
  polyFill(ctx, circle, dirt);
  ctx.fillStyle = dirt;
  ctx.fillRect(e.x0, proj(0, -2).y, e.x1 - e.x0, e.y1 - proj(0, -2).y);
  for (const side of [-1, 1]) {
    polyFill(ctx, [proj(side * 1.5, 0), proj(side * 64, 62), proj(side * 60, 66), proj(side * 4, 4)], "#7C5839");
  }
  // Raked dirt: fine seeded specks and footprint scuffs by the boxes.
  for (let gy = 410; gy < e.y1; gy += 14) {
    for (let gx = Math.floor(e.x0 / 14) * 14; gx < e.x1; gx += 14) {
      const h = artHash(gx * 7 + gy * 131, 4049);
      for (let k = 0; k < 3; k++) {
        const hh = artHash(h + k, 17);
        ctx.fillStyle = (hh >>> 22) % 2 ? "rgba(255,225,190,0.07)" : "rgba(30,18,10,0.16)";
        ctx.fillRect(gx + (hh % 14), gy + ((hh >>> 5) % 14), 1 + ((hh >>> 3) % 2), 1);
      }
    }
  }
  ctx.fillStyle = "rgba(10,6,3,0.12)";
  for (let i = 0; i < 6; i++) {
    const f = proj(-2.6 - (i % 2) * 0.9, -1.2 + i * 0.5);
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, 0.5 * f.s, 0.12 * f.s, 0.1 * (i % 2 ? 1 : -1), 0, Math.PI * 2);
    ctx.fill();
  }
  // Chalk: the foul lines out past the edges and the batter's boxes.
  ctx.strokeStyle = "rgba(245,245,240,0.85)";
  ctx.lineCap = "butt";
  for (const side of [-1, 1]) {
    const a = proj(side * 0.7, 0.7);
    const b = proj(side * 300, 300);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(245,245,240,0.6)";
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    const pts = [proj(side * 1.2, -3), proj(side * 5.2, -3), proj(side * 5.2, 3), proj(side * 1.2, 3)];
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
  }
  // The plate, with its black bevel.
  const plate = [proj(-0.71, 0.0), proj(0.71, 0.0), proj(0.71, -0.71), proj(0, -1.42), proj(-0.71, -0.71)];
  polyFill(ctx, plate.map((p) => ({ ...p, y: p.y + 2 })), "#2A2016");
  polyFill(ctx, plate, "#F5F6F2");
  ctx.restore();
  // Floodlight pools on the infield and the plate, and the night closing in at the far sides.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pool = ctx.createRadialGradient(CX + 30, 300, 10, CX + 30, 300, 300);
  pool.addColorStop(0, "rgba(255,238,200,0.09)");
  pool.addColorStop(1, "rgba(255,238,200,0)");
  ctx.fillStyle = pool;
  ctx.fillRect(e.x0, 188, e.x1 - e.x0, e.y1 - 188);
  const plateLight = ctx.createRadialGradient(p0.x - 40, p0.y - 40, 10, p0.x - 40, p0.y - 40, 260);
  plateLight.addColorStop(0, "rgba(255,232,190,0.10)");
  plateLight.addColorStop(1, "rgba(255,232,190,0)");
  ctx.fillStyle = plateLight;
  ctx.fillRect(e.x0, 380, e.x1 - e.x0, e.y1 - 380);
  ctx.restore();
  const vig = ctx.createRadialGradient(CX, 420, 260, CX, 420, 640);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vig;
  ctx.fillRect(e.x0, e.y0, e.x1 - e.x0, e.y1 - e.y0);
}

/** The park behind everything (sky to the plate), signs and the radar board included; painted once per size and seed. */
export function paintHomerunPark(ctx: CanvasRenderingContext2D, plan: HomerunPlan | null, extent: Extent = WORLD_EXTENT): void {
  const e = extent;
  paintSky(ctx, e);
  paintStands(ctx, e);
  for (let cx = Math.floor((e.x0 - 120) / 130) * 130 + 65; cx < e.x1 + 120; cx += 130) paintFloodlight(ctx, cx, 4 + (artHash(cx, 5) % 6), 46);
  paintRadarBoard(ctx);
  if (plan) plan.signs.forEach((s, i) => paintSign(ctx, s, i, true));
  paintWall(ctx, e);
  paintPole(ctx, homerunSprayX(450));
  paintPole(ctx, homerunSprayX(-450));
  paintField(ctx, e);
}

/* --------------------------------------------------------------- people */

/**
 * The pitcher on the mound: a clean shaded figure with a warm rim light. `phase` runs 0 (set) → 1 (release) → 2
 * (follow-through); drawn at its feet (x, y) and height h px.
 */
export function paintPitcher(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, phase: number, tell?: { kind: number; k: number }): void {
  const u = h / 60;
  const lift = phase < 1 ? Math.sin(Math.min(1, phase / 0.6) * Math.PI) : 0;
  const lean = phase < 0.6 ? -0.1 * (phase / 0.6) : phase < 1 ? -0.1 + 0.45 * ((phase - 0.6) / 0.4) : 0.35 - 0.2 * Math.min(1, phase - 1);
  let arm = phase < 0.6 ? -2.4 * (phase / 0.6) : phase < 1 ? -2.4 + 4.4 * ((phase - 0.6) / 0.4) : 2 + 0.6 * Math.min(1, phase - 1);
  // homerunRev 3's tell: the arm held in its slot (fastball high over the top, changeup low, curve and drop between)
  // while the tell shows, then the delivery from there.
  if (tell && phase < 1) arm = arm * (1 - tell.k) + TELL_ARM[tell.kind]! * tell.k;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = "round";
  // Legs: grey road pants, the front leg lifting in the wind-up.
  ctx.strokeStyle = "#9AA2B2";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-3, -26);
  ctx.lineTo(-5, 0);
  ctx.moveTo(3, -26);
  ctx.lineTo(4 + 6 * lift, -12 * lift);
  ctx.lineTo(6 + 4 * lift, -2 - 10 * lift);
  ctx.stroke();
  ctx.save();
  ctx.translate(0, -26);
  ctx.rotate(lean);
  const body = ctx.createLinearGradient(-9, 0, 9, 0);
  body.addColorStop(0, "#4A1820");
  body.addColorStop(0.7, "#8C2C36");
  body.addColorStop(1, "#B8505A");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(-8, -20);
  ctx.quadraticCurveTo(0, -25, 8, -20);
  ctx.lineTo(7, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8C2C36";
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
  if (tell && tell.k > 0) {
    // The throwing hand: a flash of the pitch's colour (the glove side lights too), and the curve's hooked wrist.
    const hx = 6 + Math.cos(arm) * 17;
    const hy = -18 + Math.sin(arm) * 17 - 2;
    const c = TELL_COLOUR[tell.kind]!;
    ctx.save();
    ctx.globalAlpha = tell.k;
    ctx.globalCompositeOperation = "lighter";
    for (const [cx, cy, r] of [[hx, hy, 7], [-11.5, -8, 5.5]] as const) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, c);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = tell.k;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(hx, hy, 2.4, 0, Math.PI * 2);
    ctx.fill();
    if (tell.kind === PITCH_CURVE) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo(hx + 4, hy - 1, hx + 3, hy + 4);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle = "#C69C7A";
  ctx.beginPath();
  ctx.arc(0, -28, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3A121A";
  ctx.beginPath();
  ctx.arc(0, -29.5, 5, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-1, -30, 8.5, 1.8);
  ctx.strokeStyle = "rgba(255,232,190,0.75)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(0, -28, 4.6, -1.2, 0.9);
  ctx.moveTo(8, -20);
  ctx.lineTo(7, 0);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/* ------------------------------------------------------------- the tell */

/** homerunRev 3: each pitch kind's tell colour (fastball red, curve blue, drop purple, changeup green). */
export const TELL_COLOUR: Record<number, string> = { 0: "#FF5A4E", [PITCH_CURVE]: "#4EA8FF", [PITCH_DROP]: "#B784FF", [PITCH_CHANGEUP]: "#5BE38A" };
/** The arm's slot while the tell shows (radians, as paintPitcher's arm): high for the fastball, low for the changeup. */
const TELL_ARM: Record<number, number> = { 0: -1.85, [PITCH_CURVE]: -2.35, [PITCH_DROP]: -2.25, [PITCH_CHANGEUP]: -2.85 };
/** Where the grip bubble sits (beside the pitcher, clear of the pitch's path to the plate). */
export const TELL_BUBBLE = { x: 158, y: 212, r: 26 } as const;

/** How strongly the tell shows at tick `t` for pitch `p` (0 when hidden; fades in over 4 ticks, out 8 after the release). */
export function homerunTellAlpha(p: HomerunPitch, t: number): number {
  const from = p.release - HOMERUN_TELL_TICKS;
  if (t < from || t > p.release + 8) return 0;
  if (t < from + 4) return (t - from) / 4;
  if (t > p.release) return 1 - (t - p.release) / 8;
  return 1;
}

/**
 * The grip bubble: the ball in the pitcher's fingers, close up, ringed in the pitch's colour. Fastball: two fingers
 * across the top of the seams. Curve: the fingers hooked along a seam, the wrist cocked. Drop: two fingers split wide
 * either side. Changeup: a circle of thumb and forefinger on the side.
 */
export function paintTellBubble(ctx: CanvasRenderingContext2D, kind: number, alpha: number, bx: number = TELL_BUBBLE.x, by: number = TELL_BUBBLE.y, r: number = TELL_BUBBLE.r): void {
  if (alpha <= 0) return;
  const c = TELL_COLOUR[kind] ?? "#FFFFFF";
  ctx.save();
  ctx.globalAlpha = alpha;
  // Glow and the dark disc.
  const glow = ctx.createRadialGradient(bx, by, r * 0.8, bx, by, r * 1.6);
  glow.addColorStop(0, c);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha * 0.45;
  ctx.fillStyle = glow;
  ctx.fillRect(bx - r * 1.6, by - r * 1.6, r * 3.2, r * 3.2);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(6,9,18,0.9)";
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // The ball.
  const br = r * 0.56;
  const g = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.35, br * 0.1, bx, by, br);
  g.addColorStop(0, "#FFFFFF");
  g.addColorStop(1, "#C9C6BA");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#C2373A";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(bx - br * 0.95, by, br * 0.7, -0.95, 0.95);
  ctx.moveTo(bx + br * 0.95 + Math.cos(Math.PI - 0.95) * br * 0.7, by + Math.sin(Math.PI - 0.95) * br * 0.7);
  ctx.arc(bx + br * 0.95, by, br * 0.7, Math.PI - 0.95, Math.PI + 0.95);
  ctx.stroke();
  // The fingers (skin, outlined in the pitch's colour so the shape reads at a glance).
  const finger = (x0: number, y0: number, x1: number, y1: number, cx?: number, cy?: number) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    if (cx !== undefined && cy !== undefined) ctx.quadraticCurveTo(cx, cy, x1, y1);
    else ctx.lineTo(x1, y1);
    ctx.lineCap = "round";
    ctx.strokeStyle = c;
    ctx.lineWidth = 6.4;
    ctx.stroke();
    ctx.strokeStyle = "#E2B596";
    ctx.lineWidth = 3.8;
    ctx.stroke();
  };
  const u = br;
  if (kind === PITCH_CURVE) {
    finger(bx - u * 0.9, by - u * 0.9, bx + u * 0.55, by + u * 0.2, bx + u * 0.4, by - u * 1.0);
    finger(bx - u * 0.9, by - u * 0.45, bx + u * 0.3, by + u * 0.55, bx + u * 0.25, by - u * 0.45);
  } else if (kind === PITCH_DROP) {
    finger(bx - u * 0.4, by - u * 1.15, bx - u * 0.75, by + u * 0.5);
    finger(bx + u * 0.4, by - u * 1.15, bx + u * 0.75, by + u * 0.5);
  } else if (kind === PITCH_CHANGEUP) {
    ctx.strokeStyle = c;
    ctx.lineWidth = 6.4;
    ctx.beginPath();
    ctx.arc(bx - u * 0.35, by + u * 0.1, u * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#E2B596";
    ctx.lineWidth = 3.8;
    ctx.stroke();
    finger(bx + u * 0.25, by - u * 1.1, bx + u * 0.35, by + u * 0.2);
    finger(bx + u * 0.7, by - u * 0.95, bx + u * 0.75, by + u * 0.25);
  } else {
    finger(bx - u * 0.28, by - u * 1.15, bx - u * 0.28, by + u * 0.15);
    finger(bx + u * 0.28, by - u * 1.15, bx + u * 0.28, by + u * 0.15);
  }
  ctx.restore();
}

/* ------------------------------------------------------------ the batter */

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const mix = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const ease = (t: number) => t * t * (3 - 2 * t);

/** The bat: 34 in (2.85 ft); its sweet spot at four fifths of its length. */
const BAT_L = 2.85;
const SWEET = 0.8;

interface Pose {
  /** Body turn (radians: 0 = chest to the plate, π/2 = chest to the pitcher) for the shoulders and the hips. */
  turn: number;
  hips: number;
  /** Hands (the bottom hand on the knob) and the bat's direction from them. */
  hands: V3;
  bat: V3;
  /** The back heel's lift and pivot (0…1) and the stride (front foot forward, feet). */
  heel: number;
  stride: number;
  /** How far down the knees bend (feet). */
  sink: number;
}

const STANCE: Pose = { turn: -0.25, hips: -0.12, hands: [-2.75, 4.95, -0.75], bat: norm([0.25, 0.85, -0.45]), heel: 0, stride: 0, sink: 0.05 };
const FINISH = (h: number): Pose => ({ turn: 1.75, hips: 1.25, hands: [-3.05, 4.9, 0.75], bat: norm([-0.8, 0.45, 0.35]), heel: 1, stride: 0.35, sink: 0.12 - (h - 2.4) * 0.05 });

/** The contact pose for a swing at plate height `h` (feet) toward screen x `sx`, aimed by the swipe angle `b`. */
function contactPose(sx: number, h: number, b: number): Pose {
  // A pulled ball is met out in front (the barrel ahead of the hands), an opposite-field one deeper (the barrel behind).
  const theta = Math.max(-0.6, Math.min(0.6, (b / 10) * (Math.PI / 180) * 0.8));
  const bat = norm([Math.cos(theta), -0.04 - (h < 2 ? (2 - h) * 0.18 : 0), Math.sin(theta)]);
  const sweet: V3 = [plateFeet(sx, 0).x, h, 0.15];
  const hands = add(sweet, mul(bat, -SWEET * BAT_L));
  return { turn: 0.85 + theta * 0.4, hips: 0.75, hands, bat, heel: 0.6, stride: 0.35, sink: 0.12 + Math.max(0, 2.6 - h) * 0.22 };
}

function blend(a: Pose, b: Pose, t: number): Pose {
  return {
    turn: a.turn + (b.turn - a.turn) * t,
    hips: a.hips + (b.hips - a.hips) * t,
    hands: mix(a.hands, b.hands, t),
    bat: norm(mix(a.bat, b.bat, t)),
    heel: a.heel + (b.heel - a.heel) * t,
    stride: a.stride + (b.stride - a.stride) * t,
    sink: a.sink + (b.sink - a.sink) * t,
  };
}

/** The swing at `k` ticks after it started (contact on HOMERUN_SWING_TICKS), with the swipe's height and angle. */
function swingPose(k: number, a: number, b: number, sx: number): Pose {
  const h = Math.max(0.6, Math.min(4.2, plateFeet(sx, a).h));
  const c = contactPose(sx, h, b);
  // The load into the lag (the bat laid flat behind, the hands dropped to the zone), then the barrel whipped through.
  const lag: Pose = { turn: 0.25, hips: 0.45, hands: mix(STANCE.hands, add(c.hands, [-0.35, 0.35, -0.55]), 0.85), bat: norm([-0.25, 0.25, -1]), heel: 0.3, stride: 0.35, sink: (STANCE.sink + c.sink) / 2 };
  const through: Pose = { ...blend(c, FINISH(h), 0.45), bat: norm([0.05, 0.2, 1]), hands: add(c.hands, [0.15, 0.25, 0.8]) };
  const T = HOMERUN_SWING_TICKS;
  if (k <= 0) return STANCE;
  if (k <= T / 2) return blend(STANCE, lag, ease(k / (T / 2)));
  if (k <= T) return blend(lag, c, (k - T / 2) / (T / 2));
  if (k <= T + 4) return blend(c, through, (k - T) / 4);
  if (k <= T + 12) return blend(through, FINISH(h), ease((k - T - 4) / 8));
  if (k <= 70) return FINISH(h);
  if (k <= 100) return blend(FINISH(h), STANCE, ease((k - 70) / 30));
  return STANCE;
}

/** A tapered limb (a capsule) from a to b, radii in feet at each end. */
function limb(ctx: CanvasRenderingContext2D, a: V3, b: V3, ra: number, rb: number, fill: string | CanvasGradient): void {
  const p = P(a);
  const q = P(b);
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  const wa = ra * p.s;
  const wb = rb * q.s;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(p.x + nx * wa, p.y + ny * wa);
  ctx.lineTo(q.x + nx * wb, q.y + ny * wb);
  ctx.arc(q.x, q.y, wb, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
  ctx.lineTo(p.x - nx * wa, p.y - ny * wa);
  ctx.arc(p.x, p.y, wa, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true);
  ctx.closePath();
  ctx.fill();
}

/** The convex hull of projected points (the torso's silhouette from its box corners). */
function hull(pts: Pt[]): Pt[] {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of s) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (const p of s.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** The bat from its knob along `dir`: ash, tapered from the handle to the barrel, with a rim light. */
function paintBat3(ctx: CanvasRenderingContext2D, knob: V3, dir: V3, alpha: number): void {
  const stations: [number, number][] = [
    [0, 0.085],
    [0.04, 0.05],
    [0.42, 0.055],
    [0.62, 0.1],
    [0.97, 0.115],
    [1, 0.09],
  ];
  const pts = stations.map(([t, r]) => ({ p: P(add(knob, mul(dir, t * BAT_L))), r }));
  const a = pts[0]!.p;
  const b = pts[pts.length - 1]!.p;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (l < 3) {
    ctx.fillStyle = "#C79A62";
    ctx.beginPath();
    ctx.arc(b.x, b.y, 0.115 * b.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const nx = -dy / l;
  const ny = dx / l;
  const g = ctx.createLinearGradient(a.x + nx * 8, a.y + ny * 8, a.x - nx * 8, a.y - ny * 8);
  g.addColorStop(0, "#E9C48E");
  g.addColorStop(0.45, "#C08A52");
  g.addColorStop(1, "#6E4524");
  ctx.fillStyle = g;
  ctx.beginPath();
  pts.forEach(({ p, r }, i) => (i ? ctx.lineTo(p.x + nx * r * p.s, p.y + ny * r * p.s) : ctx.moveTo(p.x + nx * r * p.s, p.y + ny * r * p.s)));
  for (let i = pts.length - 1; i >= 0; i--) {
    const { p, r } = pts[i]!;
    ctx.lineTo(p.x - nx * r * p.s, p.y - ny * r * p.s);
  }
  ctx.closePath();
  ctx.fill();
  // The end cap and the knob's tape.
  ctx.fillStyle = "#8A5A30";
  ctx.beginPath();
  ctx.ellipse(b.x, b.y, 0.09 * b.s, 0.09 * b.s * 0.55, Math.atan2(dy, dx), 0, Math.PI * 2);
  ctx.fill();
  const k1 = P(add(knob, mul(dir, 0.16 * BAT_L)));
  ctx.strokeStyle = "#1A1A22";
  ctx.lineWidth = Math.max(1, 0.1 * a.s);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(k1.x, k1.y);
  ctx.stroke();
  const r0 = pts[3]!.p;
  const r1 = pts[4]!.p;
  ctx.strokeStyle = "rgba(255,240,215,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r0.x + nx * 0.07 * r0.s, r0.y + ny * 0.07 * r0.s);
  ctx.lineTo(r1.x + nx * 0.08 * r1.s, r1.y + ny * 0.08 * r1.s);
  ctx.stroke();
  ctx.restore();
}

const NAVY = "#17244A";
const NAVY_LIT = "#2C4282";
const PANTS = "#E7E9EF";
const PANTS_SHADE = "#A9AFBE";

/** The batter (a right-hander in the left box, seen from behind his right shoulder) in `pose`, at full or `ghost` alpha. */
function paintBatter(ctx: CanvasRenderingContext2D, pose: Pose, blur: Pose[] = []): void {
  const base: V3 = [-2.95, 0, 0.15];
  const sink = pose.sink;
  const rot = (r: number, v: V3): V3 => [v[0] * Math.cos(r) - v[2] * Math.sin(r), v[1], v[0] * Math.sin(r) + v[2] * Math.cos(r)];
  // Hips and shoulders: the axis from the right (back) side to the left (front) side, turning with the body.
  const hipC: V3 = add(base, [0.05 + pose.stride * 0.15, 3.05 - sink, 0.05 + pose.stride * 0.2]);
  const shC: V3 = add(hipC, [0.22 + pose.turn * 0.05, 1.75, 0.02]);
  const hipAxis = rot(pose.hips, [0, 0, 1]);
  const shAxis = rot(pose.turn, [0, 0, 1]);
  const chest = rot(pose.turn, [1, 0, 0]);
  const hipR = add(hipC, mul(hipAxis, -0.45));
  const hipL = add(hipC, mul(hipAxis, 0.45));
  const shR = add(shC, mul(shAxis, -0.68));
  const shL = add(shC, mul(shAxis, 0.68));
  const head = add(shC, add([0.08, 0.68, 0.05], mul(chest, 0.08)));
  // Feet: the back foot planted (its heel turning up through the swing), the front foot striding toward the pitcher.
  const footB: V3 = add(base, [-0.05, 0.05 + 0.18 * pose.heel, -1.1]);
  const footF: V3 = add(base, [0.15, 0.05, 1.05 + pose.stride]);
  const kneeB: V3 = add(mix(hipR, footB, 0.5), [0.42 + 0.25 * pose.heel, -0.05, 0.1 * pose.heel]);
  const kneeF: V3 = add(mix(hipL, footF, 0.5), [0.32, 0.05, 0.05]);
  // Hands: the bottom (left) hand on the knob, the top (right) hand just above it on the handle.
  const handL = pose.hands;
  const handR = add(pose.hands, mul(pose.bat, 0.32));
  const elbow = (sh: V3, hand: V3, out: number): V3 => add(mix(sh, hand, 0.5), [-0.12, -0.32 * out, -0.2 * out]);
  const elbowR = elbow(shR, handR, 1);
  const elbowL = elbow(shL, handL, 0.6);

  // Shadow under him.
  const sh = proj(base[0] + 0.1, base[2]);
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(sh.x + 6, sh.y, 1.8 * sh.s, 0.42 * sh.s, 0, 0, Math.PI * 2);
  ctx.fill();

  const pantsG = (a: V3, b: V3) => {
    const p = P(a);
    const q = P(b);
    const g = ctx.createLinearGradient(p.x - 12, p.y, p.x + 12, q.y);
    g.addColorStop(0, PANTS_SHADE);
    g.addColorStop(0.55, PANTS);
    g.addColorStop(1, PANTS_SHADE);
    return g;
  };
  const batBehind = pose.bat[2] > 0.3 || add(pose.hands, mul(pose.bat, BAT_L))[2] > 1.1;
  const drawBat = () => {
    blur.forEach((g, i) => paintBat3(ctx, g.hands, g.bat, 0.14 + 0.12 * i));
    paintBat3(ctx, pose.hands, pose.bat, 1);
  };
  if (batBehind) drawBat();
  // Front (far) leg and arm first.
  limb(ctx, hipL, kneeF, 0.36, 0.26, pantsG(hipL, kneeF));
  limb(ctx, kneeF, add(footF, [0.05, 0.35, 0]), 0.24, 0.18, NAVY);
  limb(ctx, footF, add(footF, [0.55, -0.02, 0.05]), 0.16, 0.14, "#0B0B10");
  limb(ctx, shL, elbowL, 0.2, 0.17, NAVY);
  limb(ctx, elbowL, handL, 0.16, 0.13, NAVY);
  // Torso: the silhouette of its box (hips to shoulders, chest-to-back depth), navy with a lit edge and gold trim.
  const corners: V3[] = [];
  for (const [c, axis, half, depth] of [
    [hipC, hipAxis, 0.52, 0.42],
    [shC, shAxis, 0.74, 0.46],
  ] as const) {
    const f = rot(c === hipC ? pose.hips : pose.turn, [1, 0, 0]);
    for (const s of [-1, 1]) for (const t of [-1, 1]) corners.push(add(c, add(mul(axis, s * half), mul(f, t * depth))));
  }
  const torso = hull(corners.map(P));
  const tb = P(hipC);
  const tt = P(shC);
  const tg = ctx.createLinearGradient(tb.x - 30, tt.y, tb.x + 30, tb.y);
  tg.addColorStop(0, "#0E1530");
  tg.addColorStop(0.55, NAVY);
  tg.addColorStop(1, NAVY_LIT);
  polyFill(ctx, torso, tg);
  ctx.save();
  ctx.beginPath();
  torso.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  // The number on his back (seen past the right shoulder) and the belt.
  const back = P(add(mix(hipC, shC, 0.62), mul(chest, -0.44)));
  ctx.fillStyle = "#F2C75C";
  ctx.font = `800 ${Math.round(0.62 * back.s)}px ${ARCADE_FX_DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = Math.max(0, Math.min(1, -chest[0] * 1.5 + 0.9));
  ctx.fillText("7", back.x, back.y);
  ctx.globalAlpha = 1;
  const belt = P(add(hipC, [0, 0.22, 0]));
  ctx.fillStyle = "#0A0E1C";
  ctx.fillRect(belt.x - 0.9 * belt.s, belt.y - 0.06 * belt.s, 1.8 * belt.s, 0.13 * belt.s);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,226,180,0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  torso.slice(0, Math.ceil(torso.length / 2)).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  // Back (near) leg.
  limb(ctx, hipR, kneeB, 0.38, 0.27, pantsG(hipR, kneeB));
  limb(ctx, kneeB, add(footB, [0, 0.35, 0]), 0.25, 0.19, NAVY);
  limb(ctx, footB, add(footB, [0.5, -0.04 - 0.15 * pose.heel, 0.1]), 0.17, 0.14, "#0B0B10");
  // Neck, head and helmet: a glossy navy shell, its brim toward his chest, a gold logo, the lights on top.
  const hp = P(head);
  const r = 0.43 * hp.s;
  ctx.fillStyle = "#B88A68";
  const neck = P(add(shC, [0.05, 0.3, 0]));
  ctx.fillRect(neck.x - 0.16 * neck.s, neck.y - 0.25 * neck.s, 0.32 * neck.s, 0.32 * neck.s);
  const brim = P(add(head, add(mul(chest, 0.48), [0, -0.05, 0])));
  ctx.fillStyle = "#0C1430";
  ctx.beginPath();
  ctx.ellipse(brim.x, brim.y, 0.26 * brim.s, 0.07 * brim.s, Math.atan2(brim.y - hp.y, brim.x - hp.x), 0, Math.PI * 2);
  ctx.fill();
  const hg = ctx.createRadialGradient(hp.x - r * 0.35, hp.y - r * 0.45, r * 0.1, hp.x, hp.y, r * 1.05);
  hg.addColorStop(0, "#5D78C2");
  hg.addColorStop(0.35, NAVY_LIT);
  hg.addColorStop(1, "#0A1129");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(hp.x - r * 0.3, hp.y - r * 0.55, r * 0.32, r * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();
  const logo = P(add(head, add(mul(chest, -0.3), [0, 0.08, -0.2])));
  ctx.fillStyle = "#F2C75C";
  ctx.globalAlpha = Math.max(0, Math.min(1, -chest[0] + 0.8));
  ctx.beginPath();
  ctx.arc(logo.x, logo.y, 0.07 * logo.s, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Back (near) arm, the gloves, then the bat when it is nearer the camera than he is.
  limb(ctx, shR, elbowR, 0.22, 0.18, NAVY_LIT);
  limb(ctx, elbowR, handR, 0.17, 0.13, NAVY_LIT);
  if (!batBehind) drawBat();
  for (const hnd of [handL, handR]) {
    const q = P(hnd);
    ctx.fillStyle = "#F2C75C";
    ctx.beginPath();
    ctx.arc(q.x, q.y, 0.14 * q.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(60,40,10,0.6)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

/* -------------------------------------------------------------- per frame */

const PITCHER_FEET = proj(0, 60.5);
const PITCHER_H = 62;

function pitcherPhase(state: HomerunState): number {
  const p = homerunCurrent(state);
  if (!p) return 2;
  const since = state.tick - (p.release - HOMERUN_WINDUP_TICKS);
  if (since < 0) {
    const prev = homerunPlan(state.seed).pitches[state.pitch - 1];
    return prev && state.tick - prev.release < 50 ? 1 + (state.tick - prev.release) / 50 : 0;
  }
  if (state.tick < p.release) return since / HOMERUN_WINDUP_TICKS;
  return Math.min(2, 1 + (state.tick - p.release) / 40);
}

/** The swing being shown: the current pitch's (once started) or the one that decided the last pitch. */
function shownSwing(state: HomerunState, plan: HomerunPlan): { st: number; a: number; b: number; pitch: HomerunPitch } | null {
  const cur = homerunCurrent(state);
  if (state.swingTick >= 0 && cur) return { st: state.swingTick, a: state.swingA, b: state.swingB, pitch: cur };
  const last = state.hits[state.hits.length - 1];
  const pitch = plan.pitches[state.hits.length - 1];
  if (last && pitch && last.st >= 0 && state.tick - last.st < 110) return { st: last.st, a: last.a, b: last.b, pitch };
  return null;
}

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

/** The pitch's screen radius as it comes in (u: 0 at release, 1 at the plate). */
const pitchR = (u: number) => 1.3 + 5.2 * u * u;

/** Where a batted ball is `k` ticks after contact: from the plate out to its landing (or the stands), shrinking. */
export function homerunFlight(hit: HomerunHit, from: { x: number; y: number }, k: number, sign?: HomerunSign): { x: number; y: number; r: number; done: boolean } {
  const dur = hit.out === OUT_FOUL ? 50 : 70 + Math.round(hit.feet / 10);
  const u = Math.min(1, k / dur);
  const landX = homerunSprayX(hit.out === OUT_FOUL ? (hit.spray < 0 ? -560 : 560) : hit.spray);
  const fence = homerunFence(hit.spray);
  const box = sign ? homerunSignBox(sign) : null;
  const landY = box
    ? box.y + box.h / 2
    : hit.out === OUT_HOMER
      ? wallTop(hit.spray) - 10 - Math.min(100, (hit.feet - fence) * 1.1)
      : YH + (F * CAM_H) / (Math.max(30, hit.feet) * Math.cos((hit.spray / 1800) * Math.PI) + CAM_BACK);
  const peak = 60 + (hit.launch / 10) * 3.2;
  const e = 1 - (1 - u) * (1 - u);
  const x = from.x + (landX - from.x) * e;
  const yLine = from.y + (landY - from.y) * e;
  const y = yLine - peak * Math.sin(Math.PI * Math.min(1, u * (hit.out === OUT_HOMER && !box ? 0.62 : 1)));
  return { x, y, r: Math.max(1.1, 6.5 * (1 - e) + 1.2 * e), done: u >= 1 };
}

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, accent = false, align: "left" | "right" | "center" = "left"): number {
  ctx.save();
  ctx.font = `700 11px ${MONO}`;
  const w = Math.ceil(ctx.measureText(text).width) + 18;
  const x0 = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  ctx.fillStyle = "rgba(6,9,18,0.7)";
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

/**
 * Early / Perfect / Late: how many ticks the bat reached the plate before or after the perfect tick (null when not
 * swung). The perfect tick is the ball's arrival, on homerunRev 3 moved by the pitch kind (homerunPerfectOffset).
 */
export function homerunTimingCall(hit: HomerunHit, pitch: HomerunPitch, rev?: number | null): { label: string; ms: number; perfect: boolean } | null {
  if (hit.st < 0) return null;
  const dt = hit.st + HOMERUN_SWING_TICKS - pitch.arrive - homerunPerfectOffset(pitch.kind, rev);
  const ms = Math.round((Math.abs(dt) * 1000) / 60);
  if (dt === 0) return { label: "PERFECT", ms: 0, perfect: true };
  return { label: dt < 0 ? "EARLY" : "LATE", ms, perfect: false };
}

/** The call, the timing word and, over the zone, where the bat met against where the ball crossed. */
function paintCall(ctx: CanvasRenderingContext2D, hit: HomerunHit, pitch: HomerunPitch, k: number, rev: number): void {
  const t = outcomeText(hit);
  const alpha = k < 100 ? 1 : (120 - k) / 20;
  const cx = 250;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 30px ${ARCADE_FX_DISPLAY_FONT}`;
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.strokeText(t.big, cx, 318);
  ctx.fillStyle = t.gold ? "#F2C75C" : "#F3F1EC";
  ctx.fillText(t.big, cx, 318);
  if (t.small) {
    ctx.font = `700 13px ${MONO}`;
    ctx.strokeText(t.small, cx, 345);
    ctx.fillStyle = "#E6E4DE";
    ctx.fillText(t.small, cx, 345);
  }
  const timing = homerunTimingCall(hit, pitch, rev);
  if (timing) {
    const text = timing.perfect ? "PERFECT" : `${timing.label} · ${timing.ms} MS`;
    ctx.font = `800 12px ${MONO}`;
    const w = ctx.measureText(text).width + 22;
    ctx.fillStyle = timing.perfect ? "rgba(242,199,92,0.95)" : "rgba(8,11,20,0.78)";
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, 362, w, 22, 11);
    ctx.fill();
    ctx.strokeStyle = timing.perfect ? "rgba(255,240,200,0.9)" : "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = timing.perfect ? "#1A1206" : "#F3F1EC";
    ctx.fillText(text, cx, 373.5);
    // The timing meter: early ← centre → late, its notch where the bat met.
    const mx = cx;
    const my = 394;
    ctx.fillStyle = "rgba(8,11,20,0.7)";
    ctx.fillRect(mx - 60, my - 2, 120, 4);
    ctx.fillStyle = "#F2C75C";
    ctx.fillRect(mx - 1.5, my - 5, 3, 10);
    const dt = hit.st + HOMERUN_SWING_TICKS - pitch.arrive - homerunPerfectOffset(pitch.kind, rev);
    const nx = mx + Math.max(-1, Math.min(1, dt / 8)) * 58;
    ctx.fillStyle = timing.perfect ? "#FFF1C2" : "#FF8A6B";
    ctx.beginPath();
    ctx.moveTo(nx, my - 4);
    ctx.lineTo(nx - 4, my - 10);
    ctx.lineTo(nx + 4, my - 10);
    ctx.closePath();
    ctx.fill();
    ctx.font = `700 8px ${MONO}`;
    ctx.fillStyle = "rgba(243,241,236,0.7)";
    ctx.fillText("EARLY", mx - 74, my + 0.5);
    ctx.fillText("LATE", mx + 72, my + 0.5);
    // Contact height: the ball's crossing (ring) and the bat's line at the swipe's height.
    if (k < 110) {
      const zx0 = HOMERUN_ZONE_X0 - 8;
      const zx1 = HOMERUN_ZONE_X1 + 8;
      const close = Math.abs(hit.a - pitch.plateY) <= (rev >= HOMERUN_REV_3 ? (hit.m === HOMERUN_MODE_POWER ? 4 : 8) : 4);
      ctx.strokeStyle = close ? "rgba(242,199,92,0.95)" : "rgba(255,138,107,0.95)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(zx0, hit.a);
      ctx.lineTo(zx1, hit.a);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = `800 9px ${MONO}`;
      ctx.textAlign = "left";
      ctx.fillText("BAT", zx1 + 4, hit.a + 0.5);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pitch.plateX, pitch.plateY, 6.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText("BALL", zx1 + 4, pitch.plateY + (Math.abs(pitch.plateY - hit.a) < 12 ? (pitch.plateY < hit.a ? -10 : 10) : 0) + 0.5);
    }
  }
  ctx.restore();
}

/** The radar board's reading for the last pitch thrown, once it is decided (never before). */
function paintRadarReading(ctx: CanvasRenderingContext2D, pitch: HomerunPitch, k: number): void {
  if (k < 0 || k > 170) return;
  const b = RADAR;
  const a = k < 6 ? k / 6 : k > 150 ? (170 - k) / 20 : 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255,150,40,0.8)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#FFB347";
  ctx.font = `800 10px ${MONO}`;
  ctx.fillText(HOMERUN_PITCH_NAMES[pitch.kind]!.toUpperCase(), b.x + b.w / 2, b.y + 10);
  ctx.fillStyle = "#FFD27A";
  ctx.font = `800 14px ${MONO}`;
  ctx.fillText(`${pitch.mph} MPH`, b.x + b.w / 2, b.y + 24);
  ctx.restore();
}

/** The play screen's frame: the park and the run, under the shared success and miss effects (sportsFx.renderer.ts). */
export function drawHomerunArt(ctx: CanvasRenderingContext2D, state: HomerunState, size: CanvasSize): void {
  arcadeFx(ctx, HOMERUN_FX, state, () => drawHomerunWorld(ctx, state), size);
}

function drawHomerunWorld(ctx: CanvasRenderingContext2D, state: HomerunState): void {
  const plan = homerunPlan(state.seed);
  deviceLayer(ctx, `homerun-park2:${state.seed}`, (c) => paintHomerunPark(c, plan));
  const still = reducedMotion();

  plan.signs.forEach((s, i) => {
    if (state.signs & (1 << i)) paintSign(ctx, s, i, false);
  });

  const last = state.hits[state.hits.length - 1];
  const lastPitch = plan.pitches[state.hits.length - 1];
  const sinceLast = last ? state.tick - last.at : 1e9;
  const cheering = last && last.out === OUT_HOMER && sinceLast >= 20 && sinceLast < 150;

  // The crowd: camera flashes (a storm of them after a home run) and fans on their feet, arms up.
  if (!still) {
    const n = cheering ? 14 : 4;
    for (let i = 0; i < n; i++) {
      const h = artHash(state.tick >> (cheering ? 1 : 3), i * 31 + 7);
      if (!cheering && h % 5 !== 0) continue;
      const x = h % W;
      const y = 40 + ((h >>> 10) % 118);
      const r = 2.5 + ((h >>> 20) % 4);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(1, "rgba(200,220,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
      ctx.restore();
    }
    if (cheering) {
      const bounce = Math.abs(Math.sin(state.tick * 0.35));
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 70; i++) {
        const h = artHash(i, 911);
        const x = (h % (W + 20)) - 10;
        const y = 108 + ((h >>> 9) % 50) - bounce * ((h >>> 3) % 3);
        ctx.strokeStyle = SKIN[(h >>> 13) % SKIN.length]!;
        ctx.beginPath();
        ctx.moveTo(x - 2, y + 3);
        ctx.lineTo(x - 3.5, y - 3);
        ctx.moveTo(x + 2, y + 3);
        ctx.lineTo(x + 3.5, y - 3);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // The radar board reads out the last pitch once it is decided.
  if (last && lastPitch) paintRadarReading(ctx, lastPitch, sinceLast);

  // The pitcher (homerunRev 3: his tell late in the wind-up, and the grip bubble beside him).
  const cur = homerunCurrent(state);
  const tellK = state.rev >= HOMERUN_REV_3 && cur ? homerunTellAlpha(cur, state.tick) : 0;
  paintPitcher(ctx, PITCHER_FEET.x, PITCHER_FEET.y, PITCHER_H, pitcherPhase(state), tellK > 0 && cur ? { kind: cur.kind, k: tellK } : undefined);
  if (tellK > 0 && cur) paintTellBubble(ctx, cur.kind, tellK);

  // The faint dashed strike zone.
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "rgba(255,255,255,0.26)";
  ctx.lineWidth = 1;
  ctx.strokeRect(HOMERUN_ZONE_X0 + 0.5, HOMERUN_ZONE_Y0 + 0.5, HOMERUN_ZONE_X1 - HOMERUN_ZONE_X0, HOMERUN_ZONE_Y1 - HOMERUN_ZONE_Y0);
  ctx.restore();

  // The batter and his swing (the pitch is drawn over him: it is nearer the plate than he is once it arrives).
  const sw = shownSwing(state, plan);
  if (sw) {
    const k = state.tick - sw.st;
    const blur = !still && k > 0 && k <= HOMERUN_SWING_TICKS + 3 ? [swingPose(k - 0.66, sw.a, sw.b, sw.pitch.plateX), swingPose(k - 0.33, sw.a, sw.b, sw.pitch.plateX)] : [];
    paintBatter(ctx, swingPose(k, sw.a, sw.b, sw.pitch.plateX), blur);
  } else paintBatter(ctx, STANCE);

  // The pitch in flight (and a pitch taken or missed, carrying on past the plate).
  const p = homerunCurrent(state);
  if (p) {
    const b = homerunBallAt(p, state.tick);
    if (b) {
      const prev = homerunBallAt(p, Math.max(p.release, state.tick - 2));
      const r = pitchR(b.u);
      if (prev && b.u > 0.3) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
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

  // The last decided pitch: its batted ball (or the missed pitch carrying on), then the call.
  if (last && lastPitch) {
    const k = sinceLast;
    if (last.out === OUT_FAIR || last.out === OUT_HOMER || last.out === OUT_FOUL) {
      const f = homerunFlight(last, { x: lastPitch.plateX, y: lastPitch.plateY }, k, last.sign >= 0 ? plan.signs[last.sign] : undefined);
      if (!f.done || k < 140) {
        if (k < 6 && !still) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const g = ctx.createRadialGradient(lastPitch.plateX, lastPitch.plateY, 0, lastPitch.plateX, lastPitch.plateY, 36);
          g.addColorStop(0, `rgba(255,240,200,${0.75 - k * 0.11})`);
          g.addColorStop(1, "rgba(255,240,200,0)");
          ctx.fillStyle = g;
          ctx.fillRect(lastPitch.plateX - 36, lastPitch.plateY - 36, 72, 72);
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
    } else if (k < 20) {
      // Missed or taken: the ball carries on past the plate, down and out of the picture.
      const u = k / 20;
      paintBall(ctx, lastPitch.plateX + lastPitch.breakX * 0.3 * u, lastPitch.plateY + 140 * u + 60 * u * u, pitchR(1) * (1 + 0.8 * u), state.tick * 0.9);
    }
    if (k >= 0 && k < 120) paintCall(ctx, last, lastPitch, k, state.rev);
  }

  // HUD chips along the top (nothing names the pitch before it is thrown).
  const shown = Math.min(state.hits.length + 1, HOMERUN_PITCHES);
  let x = 10;
  x += chip(ctx, x, 10, `PITCH ${shown}/${HOMERUN_PITCHES}`) + 6;
  x += chip(ctx, x, 10, `HR ${state.homers}`, state.homers > 0) + 6;
  let signs = 0;
  for (let i = 0; i < HOMERUN_SIGNS; i++) if (state.signs & (1 << i)) signs++;
  chip(ctx, x, 10, `SIGNS ${signs}/${HOMERUN_SIGNS}`, signs > 0);
  // homerunRev 3: the swing this pitch is played with (the choice standing until the release, then locked).
  if (state.rev >= HOMERUN_REV_3 && cur) {
    const locked = state.tick >= cur.release;
    const m = locked ? state.pmode : state.mode;
    chip(ctx, W - 10, 10, `${locked ? "" : "NEXT "}${m === HOMERUN_MODE_POWER ? "POWER" : "CONTACT"}`, m === HOMERUN_MODE_POWER, "right");
  }
}

export const homerunArtGame = { ...homerunGame, draw: drawHomerunArt };

/**
 * The play screen's scenery beyond the world (painted once per size, world units, the world's own transform): the park
 * itself carried on out to the box (sky, lights, stands, wall, field, the plate's dirt), so every edge continues with
 * no seam, settling a little darker far below the world.
 */
export function homerunScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const e: Extent = { x0: view.left - 2, x1: view.right + 2, y0: Math.min(view.top, 0) - 2, y1: view.bottom + 2 };
  ctx.fillStyle = "#3E2B1C";
  ctx.fillRect(e.x0, e.y0, e.x1 - e.x0, e.y1 - e.y0);
  paintHomerunPark(ctx, null, e);
  if (view.bottom > H + 60) {
    const g = ctx.createLinearGradient(0, H + 60, 0, view.bottom);
    g.addColorStop(0, "rgba(10,6,3,0)");
    g.addColorStop(1, "rgba(10,6,3,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(e.x0, H + 60, e.x1 - e.x0, view.bottom - H - 60);
  }
}

/** Tile icon helper: the batter driving the ball toward the lit seats, at the icon's size (scripts/shots/tile-scenes). */
export function paintHomerunTile(ctx: CanvasRenderingContext2D, size: number, seed = 7): void {
  const plan = homerunPlan(seed);
  ctx.save();
  const s = size / 300;
  ctx.scale(s, s);
  ctx.translate(-30, -300);
  paintHomerunPark(ctx, plan, { x0: 0, x1: 360, y0: 280, y1: 620 });
  const pose = swingPose(HOMERUN_SWING_TICKS + 3, 470, 150, 258);
  paintBatter(ctx, pose, [swingPose(HOMERUN_SWING_TICKS + 1, 470, 150, 258), swingPose(HOMERUN_SWING_TICKS + 2, 470, 150, 258)]);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(262, 468);
  ctx.quadraticCurveTo(262, 380, 236, 330);
  ctx.stroke();
  ctx.restore();
  paintBall(ctx, 236, 328, 7, 0.4);
  ctx.restore();
}
