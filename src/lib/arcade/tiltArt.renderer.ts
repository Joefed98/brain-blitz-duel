/**
 * Tilt in the Toybox world: a wooden labyrinth disc on an oak board. Render
 * only; mirrors the sim's private geometry (FP, centre, wall test, pit square
 * half-size cs/4) and reads state without writing it.
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import { drawArtSprite } from "./sprites.renderer";
import { arcadeFx, type ArcadeFxSpec } from "./arcadeFx.renderer";
import { TILT_FX } from "./arcadeFxGames.renderer";
import { TILT_DISC_R, TILT_MAX_MAZES, TILT_WORLD_H, TILT_WORLD_W, tiltBandGame, tiltGame, tiltRev2Game, tiltStarPoint, tiltTotalStars, tiltTunecGame, tiltTargetGame, tiltStrictGame, tiltExpandGame, tiltLiftGame, tiltStdGame, tiltParGame, tiltParLeftX, tiltIsExpand, TILT_REV, TILT_REV_PAR, TILT_REV_BAND, TILT_REV_TUNEC, TILT_REV_TARGET, TILT_REV_STRICT, TILT_REV_EXPAND, TILT_REV_LIFT, TILT_REV_STD, TILT_X_W, TILT_X_H, TILT_X_QUICK_TAIL, TILT_X_FALL_HOLD, tiltCellCentre, tiltQuickLeftX, tiltQuickFullLeftX, type Maze, type TiltState } from "./tilt";
import {
  TOY_BRASS, TOY_BRASS_DARK, TOY_INK, TOY_OAK_LIGHT, TOY_TABLE, TOY_TABLE_LIT, TOY_WOOD_DARK,
  toyBoard, toyChangeAge, toyGrain, toyMarble,
} from "./toybox.renderer";
import { reducedMotion } from "./art.renderer";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { artCanvas, artContext, deviceLayer, type ArtCanvas } from "./cache.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { tiltFill } from "./arenaFills.renderer";

const FP = 256;
const CX = 220;
const CY = 254;
const TILT_R0 = TILT_DISC_R;
/** drawTableDressing's defaults: the original world and disc centre (tiltRev 8 passes its own). */
const TILT_W0 = TILT_WORLD_W;
const TILT_H0 = TILT_WORLD_H;
const CX0 = CX;
const CY0 = CY;
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
export const TILT_MARBLE_BLUE = "#3E7BFA";
export const TILT_MARBLE_RED = "#E8394A";
/** tiltRev 2: the second marble and its cup. */
export const TILT_MARBLE_AMBER = "#F29A1F";
const CUP_AMBER_GLASS = "#FFD99A";
const STAR_GOLD = "#FFD23F";
const STAR_EDGE = "#9A6A10";
const STRIP = "#8C5A30";
const STRIP_TOP = "#B9824C";
export const CUP_GLASS = "#C4E9FA";
const CUP_BLUE = "#83C9EA";
const CUP_GLOW = "rgba(151,218,249,0.4)";

function openNeighbour(m: Maze, c: number, d: number): number {
  const i = (c % m.n) + DX[d]!;
  const j = Math.trunc(c / m.n) + DY[d]!;
  if (i < 0 || j < 0 || i >= m.n || j >= m.n) return -1;
  const nc = j * m.n + i;
  if (!m.inside[nc]) return -1;
  const wall = d === 0 ? m.wallR[c] : d === 1 ? m.wallD[c] : d === 2 ? m.wallR[nc] : m.wallD[nc];
  return wall ? -1 : nc;
}

function edge(ctx: CanvasRenderingContext2D, m: Maze, c: number, d: number, o: number, dx = 0, dy = 0) {
  const cs = m.cs / FP;
  const x = (c % m.n) * cs - o + dx;
  const y = Math.trunc(c / m.n) * cs - o + dy;
  if (d === 0) { ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs); }
  else if (d === 1) { ctx.moveTo(x, y + cs); ctx.lineTo(x + cs, y + cs); }
  else if (d === 2) { ctx.moveTo(x, y); ctx.lineTo(x, y + cs); }
  else { ctx.moveTo(x, y); ctx.lineTo(x + cs, y); }
}

/**
 * The cup just beyond an exit edge, in disc-centred maze coordinates. Original
 * rounds keep the marble-sized cup; rev 2 draws a larger cup (rim + colour) so
 * marble, dark hole and cup never read as three similar dots.
 */
export function cupOf(m: Maze, o: number, exit = m.exit, exitDir = m.exitDir, big = false) {
  const cs = m.cs / FP;
  const cx = (exit % m.n) * cs + cs / 2 - o + (DX[exitDir]! * cs) / 2;
  const cy = Math.trunc(exit / m.n) * cs + cs / 2 - o + (DY[exitDir]! * cs) / 2;
  const r = big ? Math.min(cs * 0.55, (m.br / FP) * 1.75) : m.br / FP;
  return { x: cx + DX[exitDir]! * r, y: cy + DY[exitDir]! * r, r };
}

/** tiltRev 2 cup: dark brass rim, coloured glass, a deep centre and a bright lip, in the marble's colour. */
export function drawBigCup(ctx: CanvasRenderingContext2D, cup: { x: number; y: number; r: number }, colour: string, glass: string, filled: boolean): void {
  ctx.fillStyle = TOY_BRASS_DARK;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r + 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TOY_BRASS;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = glass;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (!filled) {
    ctx.fillStyle = "rgba(20,10,4,0.55)";
    ctx.beginPath();
    ctx.arc(cup.x, cup.y + cup.r * 0.08, cup.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  // Polish G: a glass shine on the upper-left inside the cup, and a lit brass lip.
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r * 0.72, Math.PI * 1.05, Math.PI * 1.45);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,240,190,0.6)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r + 1.8, Math.PI * 0.95, Math.PI * 1.6);
  ctx.stroke();
}

/**
 * Polish G: the oak disc face (grain and growth rings) is one cached sprite,
 * drawn in the disc's rotating frame; a screen-fixed lamp gloss goes on top in
 * drawWorld, so the light stays put while the board turns.
 */
const DISC_SCALE = 2;
let discSprite: ArtCanvas | null | undefined;
export function paintDisc(c: CanvasRenderingContext2D, r = TILT_DISC_R): void {
  c.fillStyle = TOY_OAK_LIGHT;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.clip();
  toyGrain(c, -r, -r, r * 2, r * 2, 12);
  // Faint growth rings from an off-centre heart, and a few darker flecks.
  c.strokeStyle = "rgba(150,100,50,0.12)";
  c.lineWidth = 1;
  for (let k = 1; k < 9; k++) {
    c.beginPath();
    c.ellipse(-r * 0.9, r * 0.2, k * 26 * (r / TILT_DISC_R), k * 20 * (r / TILT_DISC_R), 0.3, 0, Math.PI * 2);
    c.stroke();
  }
  c.fillStyle = "rgba(110,70,35,0.25)";
  for (let k = 0; k < 40; k++) {
    const a = k * 2.399, d = (k * 37) % r;
    c.fillRect(Math.cos(a) * d, Math.sin(a) * d, 2, 0.8);
  }
  c.restore();
}
function drawDiscSurface(ctx: CanvasRenderingContext2D): void {
  if (discSprite === undefined) {
    const size = Math.ceil((TILT_DISC_R * 2 + 2) * DISC_SCALE);
    const canvas = artCanvas(size, size);
    const c = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
    if (canvas && c) {
      c.scale(DISC_SCALE, DISC_SCALE);
      c.translate(TILT_DISC_R + 1, TILT_DISC_R + 1);
      paintDisc(c);
    }
    discSprite = canvas && c ? canvas : null;
  }
  if (discSprite) ctx.drawImage(discSprite as CanvasImageSource, -TILT_DISC_R - 1, -TILT_DISC_R - 1, TILT_DISC_R * 2 + 2, TILT_DISC_R * 2 + 2);
  else paintDisc(ctx);
}

/**
 * Polish A4 (25 Oct 2026, display only): the table round the maze board: plank seams across the oak
 * (kept 12 px clear of the world's top and bottom, so the board meets its scene with no line), a little
 * more grain and a warm pool of lamplight over the board's centre, fading out before the edges.
 */
function drawTableDressing(c: CanvasRenderingContext2D, TILT_WORLD_W = TILT_W0, TILT_WORLD_H = TILT_H0, CX = CX0, CY = CY0): void {
  c.save();
  for (let y = 58; y < TILT_WORLD_H - 12; y += 58) {
    c.fillStyle = "rgba(70,40,16,0.32)";
    c.fillRect(0, y, TILT_WORLD_W, 1.2);
    c.fillStyle = "rgba(255,230,190,0.16)";
    c.fillRect(0, y + 1.2, TILT_WORLD_W, 1);
    // A butt joint in each plank, staggered (none in the edge planks, so nothing reaches the world's edge).
    if (y - 58 >= 24) {
      const jx = 60 + ((y * 7) % 300);
      c.fillStyle = "rgba(70,40,16,0.28)";
      c.fillRect(jx, y - 57, 1, 56);
    }
  }
  for (let k = 0; k < 60; k++) {
    const h = Math.imul(k * 2654435761 + 97, 0x85ebca6b) >>> 0;
    const y = 14 + (h % (TILT_WORLD_H - 28));
    c.strokeStyle = h % 3 ? "rgba(110,66,30,0.12)" : "rgba(255,226,180,0.09)";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(0, y);
    c.bezierCurveTo(TILT_WORLD_W * 0.3, y + ((h >>> 5) % 7) - 3, TILT_WORLD_W * 0.7, y - ((h >>> 9) % 5) + 2, TILT_WORLD_W, y + 1);
    c.stroke();
  }
  // The lamplight and the vignette are painted on their own layer, which fades out over the 48 px
  // nearest the world's top and bottom edges: those edges meet the screen fill's plain oak, so the
  // board's box never shows.
  const K = 2;
  const layer = artCanvas(TILT_WORLD_W * K, TILT_WORLD_H * K);
  const l = layer && (artContext(layer) as CanvasRenderingContext2D | null);
  const target = l ?? c;
  if (l) l.scale(K, K);
  const pool = target.createRadialGradient(CX - 20, CY - 40, 20, CX - 20, CY - 40, 300);
  pool.addColorStop(0, "rgba(255,214,140,0.5)");
  pool.addColorStop(0.45, "rgba(255,200,120,0.26)");
  pool.addColorStop(0.8, "rgba(255,190,110,0.06)");
  pool.addColorStop(1, "rgba(255,190,110,0)");
  target.fillStyle = pool;
  target.fillRect(0, 0, TILT_WORLD_W, TILT_WORLD_H);
  // A darker vignette towards the sides (an ellipse taller than it is wide).
  target.save();
  target.translate(CX, CY);
  target.scale(1, 1.6);
  const vignette = target.createRadialGradient(0, 0, 120, 0, 0, 262);
  vignette.addColorStop(0, "rgba(40,20,6,0)");
  vignette.addColorStop(0.6, "rgba(40,20,6,0.12)");
  vignette.addColorStop(1, "rgba(40,20,6,0.38)");
  target.fillStyle = vignette;
  target.fillRect(-CX, -CY / 1.6, TILT_WORLD_W, TILT_WORLD_H / 1.6);
  target.restore();
  if (l && layer) {
    const fade = l.createLinearGradient(0, 0, 0, TILT_WORLD_H);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(48 / TILT_WORLD_H, "rgba(0,0,0,1)");
    fade.addColorStop(1 - 48 / TILT_WORLD_H, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    l.globalCompositeOperation = "destination-in";
    l.fillStyle = fade;
    l.fillRect(0, 0, TILT_WORLD_W, TILT_WORLD_H);
    c.drawImage(layer as CanvasImageSource, 0, 0, TILT_WORLD_W, TILT_WORLD_H);
  }
  c.restore();
}

/** The disc's carved groove and bevelled rim, about the disc's centre (static: in the cached board layer). */
export function drawDiscBed(ctx: CanvasRenderingContext2D, TILT_DISC_R = TILT_R0): void {
  // Polish G: the disc sits in a carved groove in the board, casting a soft shadow down-right.
  // Polish A4: a deeper drop shadow under it.
  const drop = ctx.createRadialGradient(8, 6, TILT_DISC_R - 12, 8, 6, TILT_DISC_R + 13);
  drop.addColorStop(0, "rgba(24,10,2,0.85)");
  drop.addColorStop(0.5, "rgba(24,10,2,0.4)");
  drop.addColorStop(1, "rgba(24,10,2,0)");
  ctx.fillStyle = drop;
  ctx.beginPath();
  ctx.arc(8, 6, TILT_DISC_R + 13, 0, Math.PI * 2);
  ctx.fill();
  const groove = ctx.createRadialGradient(3, 4, TILT_DISC_R - 4, 3, 4, TILT_DISC_R + 12);
  groove.addColorStop(0, "rgba(40,20,6,0.55)");
  groove.addColorStop(1, "rgba(40,20,6,0)");
  ctx.fillStyle = groove;
  ctx.beginPath();
  ctx.arc(3, 4, TILT_DISC_R + 12, 0, Math.PI * 2);
  ctx.fill();
  // Disc rim: darker wood ring just outside the sim's disc, bevelled (lit upper left).
  ctx.fillStyle = TOY_WOOD_DARK;
  ctx.beginPath();
  ctx.arc(0, 0, TILT_DISC_R + 6, 0, Math.PI * 2);
  ctx.fill();
  // The bevel: a bright lit face on the upper left, a dark one on the lower right.
  const bevel = ctx.createLinearGradient(-TILT_DISC_R, -TILT_DISC_R, TILT_DISC_R, TILT_DISC_R);
  bevel.addColorStop(0, "rgba(255,236,196,0.95)");
  bevel.addColorStop(0.35, "rgba(255,226,180,0.35)");
  bevel.addColorStop(0.6, "rgba(20,8,2,0.15)");
  bevel.addColorStop(1, "rgba(20,8,2,0.7)");
  ctx.strokeStyle = bevel;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, TILT_DISC_R + 3.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(255,246,220,0.85)";
  ctx.beginPath();
  ctx.arc(0, 0, TILT_DISC_R + 4.8, Math.PI * 0.95, Math.PI * 1.55);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(20,8,2,0.6)";
  ctx.beginPath();
  ctx.arc(0, 0, TILT_DISC_R + 0.6, 0, Math.PI * 2);
  ctx.stroke();
}

/** Polish A4: a soft marble shadow, cast down-right from the screen-fixed lamp (offset turned into the disc's frame). */
export function marbleShadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  const dx = 1.6 * Math.cos(-rot) - 2.4 * Math.sin(-rot);
  const dy = 1.6 * Math.sin(-rot) + 2.4 * Math.cos(-rot);
  const g = ctx.createRadialGradient(x + dx, y + dy, r * 0.4, x + dx, y + dy, r * 1.25);
  g.addColorStop(0, "rgba(30,14,4,0.45)");
  g.addColorStop(1, "rgba(30,14,4,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x + dx, y + dy, r * 1.25, 0, Math.PI * 2);
  ctx.fill();
}

/** Polish A4: a glossy window highlight and a soft rim light over a marble, screen-fixed (inside its circle). */
export function marbleGloss(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-rot);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.42, r * 0.34, r * 0.17, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = Math.max(0.6, r * 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.84, Math.PI * 0.2, Math.PI * 0.75);
  ctx.stroke();
  ctx.restore();
}

/** tiltRev 2 bonus star: a gold five-point star filling most of its dead-end cell. */
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-rot);
  // Polish A4: a warm glow round the star (light only).
  const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.6);
  glow.addColorStop(0, "rgba(255,240,140,0.9)");
  glow.addColorStop(0.4, "rgba(255,220,80,0.45)");
  glow.addColorStop(1, "rgba(255,210,63,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  ctx.closePath();
  const face = ctx.createLinearGradient(0, -r, 0, r);
  face.addColorStop(0, "#FFF2A0");
  face.addColorStop(0.5, STAR_GOLD);
  face.addColorStop(1, "#E8A21E");
  ctx.fillStyle = face;
  ctx.fill();
  ctx.strokeStyle = STAR_EDGE;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.arc(-r * 0.16, -r * 0.2, Math.max(0.8, r * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function walls(ctx: CanvasRenderingContext2D, m: Maze, o: number, dx: number, dy: number) {
  ctx.beginPath();
  for (let c = 0; c < m.n * m.n; c++) {
    if (!m.inside[c]) continue;
    for (let d = 0; d < 4; d++) {
      if (c === m.exit && d === m.exitDir) continue;
      // tiltRev 2: the amber marble's exit is open too (it was drawn shut, so its cup looked sealed off).
      if (c === m.exit2 && d === m.exitDir2) continue;
      if (openNeighbour(m, c, d) >= 0) continue;
      const i = (c % m.n) + DX[d]!;
      const j = Math.trunc(c / m.n) + DY[d]!;
      const nIn = i >= 0 && j >= 0 && i < m.n && j < m.n && m.inside[j * m.n + i] === 1;
      if (nIn && d >= 2) continue;
      edge(ctx, m, c, d, o, dx, dy);
    }
  }
  ctx.stroke();
}

function padlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, open: number) {
  ctx.save();
  ctx.strokeStyle = TOY_BRASS_DARK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - w * 0.25 - open * w * 0.25, w * 0.32, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = TOY_BRASS;
  ctx.fillRect(x - w / 2, y - w * 0.25, w, w * 0.7);
  ctx.fillStyle = TOY_INK;
  ctx.fillRect(x - 1, y, 2, w * 0.25);
  ctx.restore();
}

/** The maze's pits, in the disc's rotating frame. */
export function drawPits(ctx: CanvasRenderingContext2D, m: Maze): void {
  const cs = m.cs / FP;
  const o = (m.n * cs) / 2;
  // Full square collision footprint; rounded bevel stays inside the dark cut.
  const pr = cs / 4;
  for (const p of m.pits) {
    const x = (p % m.n) * cs + cs / 2 - o;
    const y = Math.trunc(p / m.n) * cs + cs / 2 - o;
    ctx.fillStyle = "#120A05";
    ctx.fillRect(x - pr, y - pr, pr * 2, pr * 2);
    // Polish G: depth inside the square: black at the centre, warm wood showing at the sides.
    const deep = ctx.createRadialGradient(x, y, 0, x, y, pr * 1.3);
    deep.addColorStop(0, "#000000");
    deep.addColorStop(0.6, "#0E0703");
    deep.addColorStop(1, "#3A2210");
    ctx.fillStyle = deep;
    ctx.fillRect(x - pr, y - pr, pr * 2, pr * 2);
    // Polish A4: a deeper pit: its inner walls, shadowed at the top and left, the lit bottom wall showing.
    const wall = Math.max(1.5, pr * 0.32);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x - pr, y - pr, pr * 2, wall);
    ctx.fillRect(x - pr, y - pr, wall, pr * 2);
    ctx.fillStyle = "rgba(120,70,30,0.55)";
    ctx.fillRect(x - pr + wall, y + pr - wall, pr * 2 - wall, wall);
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(x - pr * 0.45, y - pr * 0.45, pr * 0.9, pr * 0.9);
    ctx.strokeStyle = TOY_WOOD_DARK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - pr + 0.75, y - pr + 0.75, pr * 2 - 1.5, pr * 2 - 1.5, 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,230,190,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - pr + 2, y + pr - 0.5);
    ctx.lineTo(x + pr - 2, y + pr - 0.5);
    ctx.stroke();
  }
}

/** Raised wooden strips with a slight shadow, in the disc's rotating frame. */
export function drawStrips(ctx: CanvasRenderingContext2D, m: Maze, lite: boolean): void {
  const o = (m.n * (m.cs / FP)) / 2;
  // Reduced effects (lib/fx/lowEnd.ts, slow devices only): the strips keep their shadow, body and
  // top edge; the soft outer shadow and the faint highlight are skipped (the strips' footprint is unchanged).
  ctx.lineCap = "round";
  if (!lite) {
    ctx.strokeStyle = "rgba(30,15,5,0.35)";
    ctx.lineWidth = 4.5;
    walls(ctx, m, o, 2.2, 2.9);
  }
  // Polish A4: deeper carving: a darker edge on the shadow side and a brighter lit edge.
  ctx.strokeStyle = "rgba(30,15,5,0.7)";
  ctx.lineWidth = 3;
  walls(ctx, m, o, 1.4, 1.9);
  ctx.strokeStyle = STRIP;
  ctx.lineWidth = 3;
  walls(ctx, m, o, 0, 0);
  ctx.strokeStyle = "rgba(50,24,8,0.8)";
  ctx.lineWidth = 1;
  walls(ctx, m, o, 0.9, 0.9);
  ctx.strokeStyle = STRIP_TOP;
  ctx.lineWidth = 1.2;
  walls(ctx, m, o, -0.5, -0.5);
  if (!lite) {
    ctx.strokeStyle = "rgba(255,240,210,0.85)";
    ctx.lineWidth = 0.9;
    walls(ctx, m, o, -1, -1);
  }
}

/** Reduced effects only: the disc, pits and strips of one maze at the canvas's scale (null without offscreen canvases). */
const mazeSprites = new WeakMap<Maze, { k: number; sprite: ArtCanvas | null }>();
function mazeSprite(ctx: CanvasRenderingContext2D, m: Maze): ArtCanvas | null {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const k = Math.round(Math.max(0.25, Math.min(2, t ? Math.hypot(t.a, t.b) : 1)) * 100) / 100;
  const old = mazeSprites.get(m);
  if (old && old.k === k) return old.sprite;
  const size = Math.ceil((TILT_DISC_R * 2 + 2) * k);
  const canvas = artCanvas(size, size);
  const c = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
  if (canvas && c) {
    c.scale(size / (TILT_DISC_R * 2 + 2), size / (TILT_DISC_R * 2 + 2));
    c.translate(TILT_DISC_R + 1, TILT_DISC_R + 1);
    c.save();
    c.beginPath();
    c.arc(0, 0, TILT_DISC_R + 1, 0, Math.PI * 2);
    c.clip();
    paintDisc(c);
    drawPits(c, m);
    drawStrips(c, m, true);
    c.restore();
  }
  const sprite = canvas && c ? canvas : null;
  mazeSprites.set(m, { k, sprite });
  return sprite;
}

/** The maze drawing through the shared success layer (presentation only). */
function draw(ctx: CanvasRenderingContext2D, state: TiltState, size: CanvasSize): void {
  // tiltRev 8 states (replays, reveals and icons reach this draw too) take the expansion's.
  if (state.xp) return drawX(ctx, state, size);
  arcadeFx(ctx, TILT_FX, state, () => drawWorld(ctx, state, size), size);
}

function drawWorld(ctx: CanvasRenderingContext2D, state: TiltState, size: CanvasSize): void {
  const scale = Math.min(size.width / TILT_WORLD_W, size.height / TILT_WORLD_H);
  const ox = (size.width - TILT_WORLD_W * scale) / 2;
  const oy = (size.height - TILT_WORLD_H * scale) / 2;
  const m = state.list[Math.min(state.level, state.list.length - 1)]!;
  const cs = m.cs / FP;
  const o = (m.n * cs) / 2;
  const cup = cupOf(m, o);
  // Rev 2 remembers both cups and which marbles were still out, so whichever finished last sinks into its own cup.
  const finish = toyChangeAge(
    ctx,
    "tilt-mazes",
    state.mazes,
    state.rev
      ? {
          blue: cupOf(m, o, m.exit, m.exitDir, true),
          amber: state.b && (m.exit2 ?? -1) >= 0 ? cupOf(m, o, m.exit2!, m.exitDir2!, true) : null,
          aHome: !!state.aHome,
          bHome: !!state.bHome,
          r: m.br / FP,
        }
      : cup,
  );
  const gate = toyChangeAge(ctx, "tilt-gate", state.level * 2 + state.gate);
  const rot = (state.angle / 65536) * Math.PI * 2;

  // Low-end performance (16 Oct 2026): the tabletop, board and the disc's groove and rim never move,
  // so they are one cached layer (cache.renderer deviceLayer; the same pixels). The maze text above
  // the groove is drawn after it, as before (they never overlap: the text ends 8 px above the groove).
  deviceLayer(ctx, `tilt-board:${ox},${oy},${scale}`, (c) => {
    // 17 Oct 2026 (screen fill-ins, display only): no table or rim round the board inside the canvas; any
    // sub-pixel margin is the board's edge oak, so the world meets the scene's oak with no dark line.
    c.fillStyle = "#9A7347";
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.save();
    c.translate(ox, oy);
    c.scale(scale, scale);
    toyBoard(c, 0, 0, TILT_WORLD_W, TILT_WORLD_H, 10, false);
    drawTableDressing(c);
    c.translate(CX, CY);
    drawDiscBed(c);
    c.restore();
  });
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  ctx.fillStyle = TOY_INK;
  ctx.font = "600 16px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Maze ${Math.min(TILT_MAX_MAZES, state.mazes + 1)} / ${TILT_MAX_MAZES}`, 14, 26);
  if (state.rev) {
    ctx.textAlign = "right";
    ctx.fillText(`Stars ${state.stars ?? 0} / ${tiltTotalStars(state)}`, TILT_WORLD_W - 14, 26);
    ctx.textAlign = "left";
  }

  ctx.translate(CX, CY);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, TILT_DISC_R + 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(rot);
  // Reduced effects (lib/fx/lowEnd.ts, slow devices only): the disc, its pits and its strips are one
  // sprite per maze, drawn rotated in one copy (no gloss; cups and stars then sit over the strips).
  // The sprite is the same geometry at the canvas's scale: nothing that collides moves.
  const baked = arcadeReducedEffects() ? mazeSprite(ctx, m) : null;
  if (baked) ctx.drawImage(baked as CanvasImageSource, -TILT_DISC_R - 1, -TILT_DISC_R - 1, TILT_DISC_R * 2 + 2, TILT_DISC_R * 2 + 2);
  else {
    drawDiscSurface(ctx);
    ctx.save();
    ctx.rotate(-rot);
    const gloss = ctx.createRadialGradient(-TILT_DISC_R * 0.45, -TILT_DISC_R * 0.5, 10, 0, 0, TILT_DISC_R);
    gloss.addColorStop(0, "rgba(255,236,196,0.46)");
    gloss.addColorStop(0.6, "rgba(255,246,220,0)");
    gloss.addColorStop(1, "rgba(60,30,10,0.32)");
    ctx.fillStyle = gloss;
    ctx.beginPath();
    ctx.arc(0, 0, TILT_DISC_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawPits(ctx, m);
  }

  if (state.rev) {
    // Rev 2: bigger rimmed cups in each marble's colour; a stars in dead-end detours.
    drawBigCup(ctx, cupOf(m, o, m.exit, m.exitDir, true), TILT_MARBLE_BLUE, CUP_GLASS, !!state.aHome);
    if ((m.exit2 ?? -1) >= 0) drawBigCup(ctx, cupOf(m, o, m.exit2!, m.exitDir2!, true), TILT_MARBLE_AMBER, CUP_AMBER_GLASS, !!state.bHome);
    (m.stars ?? []).forEach((_c, k) => {
      if ((state.starGot ?? [])[k]) return;
      // tiltRev 4 stars sit at their own point (a hole's mouth); earlier ones at their cell's centre.
      const p = tiltStarPoint(m, k);
      drawStar(ctx, p.x / FP - o, p.y / FP - o, cs * 0.3, rot);
    });
  } else {
  // Blue glass cup: the soft glow is contained in the existing outer ring.
  const cupGlow = ctx.createRadialGradient(cup.x, cup.y, cup.r * 0.5, cup.x, cup.y, cup.r + 2);
  cupGlow.addColorStop(0, CUP_GLASS);
  cupGlow.addColorStop(1, CUP_GLOW);
  ctx.fillStyle = cupGlow;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = CUP_GLASS;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TOY_BRASS;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = CUP_BLUE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, Math.max(1, cup.r - 1), 0, Math.PI * 2);
  ctx.stroke();
  }

  if (!baked) drawStrips(ctx, m, false);

  if (m.crevice >= 0) {
    const lx = (m.lock % m.n) * cs + cs / 2 - o;
    const ly = Math.trunc(m.lock / m.n) * cs + cs / 2 - o;
    const w = Math.max(6, cs * 0.34);
    const anim = state.gate === 1 && !reducedMotion() && gate.age < 450 ? gate.age / 450 : state.gate === 1 ? 1 : 0;
    if (state.gate === 0) {
      ctx.strokeStyle = TOY_BRASS;
      ctx.lineWidth = 4;
      ctx.beginPath();
      edge(ctx, m, m.crevice, m.gateDir, o);
      ctx.stroke();
      padlock(ctx, lx, ly, w, 0);
    } else if (anim < 1) {
      // Latch swings open about its first end and fades.
      const x = (m.crevice % m.n) * cs - o;
      const y = Math.trunc(m.crevice / m.n) * cs - o;
      const d = m.gateDir;
      const ax = d === 0 ? x + cs : x;
      const ay = d === 1 ? y + cs : y;
      const horizontal = d === 1 || d === 3;
      ctx.save();
      ctx.globalAlpha = 1 - anim;
      ctx.translate(ax, ay);
      ctx.rotate((horizontal ? -1 : 1) * anim * (Math.PI / 2));
      ctx.strokeStyle = TOY_BRASS;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      if (horizontal) ctx.lineTo(cs, 0);
      else ctx.lineTo(0, cs);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1 - anim;
      padlock(ctx, lx, ly, w, anim);
      ctx.globalAlpha = 1;
    }
    if (state.chaser) {
      marbleShadow(ctx, state.chaser.x / FP - o, state.chaser.y / FP - o, m.br / FP, rot);
      toyMarble(ctx, state.chaser.x / FP - o, state.chaser.y / FP - o, m.br / FP, TILT_MARBLE_RED, -rot, 2);
    }
  }

  // Finishing a maze: the marble sinks into the previous maze's cup.
  type Cup = { x: number; y: number; r: number };
  type Rev2Finish = { blue: Cup; amber: Cup | null; aHome: boolean; bHome: boolean; r: number };
  const prev2 = state.rev ? (finish.before as Rev2Finish | undefined) : undefined;
  if (prev2 && finish.age < 400 && !reducedMotion()) {
    // Rev 2: each marble that was still rolling when the maze ended (the last one home) sinks into its own cup.
    const u = finish.age / 400;
    ctx.globalAlpha = 1 - u;
    if (!prev2.aHome) toyMarble(ctx, prev2.blue.x, prev2.blue.y, prev2.r * (1 - 0.6 * u), TILT_MARBLE_BLUE, -rot);
    if (prev2.amber && !prev2.bHome) toyMarble(ctx, prev2.amber.x, prev2.amber.y, prev2.r * (1 - 0.6 * u), TILT_MARBLE_AMBER, -rot, 3);
    ctx.globalAlpha = 1;
  }
  const prevCup = state.rev ? undefined : (finish.before as Cup | undefined);
  if (prevCup && finish.age < 400 && !reducedMotion()) {
    const u = finish.age / 400;
    ctx.globalAlpha = 1 - u;
    toyMarble(ctx, prevCup.x, prevCup.y, prevCup.r * (1 - 0.6 * u), TILT_MARBLE_BLUE, -rot);
    ctx.globalAlpha = 1;
  }
  if (state.rev) {
    // Rev 2: a marble in its cup rests at the cup's centre; the amber marble is code art.
    const mr = m.br / FP;
    if (state.b) {
      const cup = cupOf(m, o, m.exit2!, m.exitDir2!, true);
      const at = state.bHome ? cup : { x: state.b.x / FP - o, y: state.b.y / FP - o };
      if (!(state.ended === 1 && state.mazes >= TILT_MAX_MAZES)) {
        if (!state.bHome) marbleShadow(ctx, at.x, at.y, mr, rot);
        toyMarble(ctx, at.x, at.y, mr, TILT_MARBLE_AMBER, -rot, 3);
      }
    }
    if (state.aHome) {
      const cup = cupOf(m, o, m.exit, m.exitDir, true);
      toyMarble(ctx, cup.x, cup.y, mr, TILT_MARBLE_BLUE, -rot);
    }
  }
  if (!(state.ended === 1 && state.mazes >= TILT_MAX_MAZES) && !state.aHome) {
    // Art pilot (Toybox): marble sprite fills the marble's collision circle; code art when absent.
    const mx = state.x / FP - o, my = state.y / FP - o, mr = m.br / FP;
    marbleShadow(ctx, mx, my, mr, rot);
    if (!drawArtSprite(ctx, "toybox", "marble", mx - mr, my - mr, mr * 2, mr * 2, { angle: -rot })) toyMarble(ctx, mx, my, mr, TILT_MARBLE_BLUE, -rot);
    marbleGloss(ctx, mx, my, mr, rot);
    // The marbles roll through each other, and pressed into the same corner they sit exactly on top of
    // each other (and then move as one). The blue one is drawn last, so it used to hide the amber one
    // completely: while their centres are within a marble radius, the amber marble's right half is drawn
    // over the blue one, so the pair reads as one half-blue, half-amber marble and neither disappears.
    if (state.b && !state.bHome) {
      const bx = state.b.x / FP - o, by = state.b.y / FP - o;
      if (Math.hypot(bx - mx, by - my) < mr) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, mr, -Math.PI / 2, Math.PI / 2);
        ctx.closePath();
        ctx.clip();
        toyMarble(ctx, bx, by, mr, TILT_MARBLE_AMBER, -rot, 3);
        ctx.restore();
      }
    }
  }
  ctx.restore();
  ctx.restore();
}

export const tiltArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltGame, draw };
/** tiltRev 2 with the same art (the drawing reads the revision from the state). */
export const tiltRev2ArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltRev2Game, draw };
const tiltBandArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltBandGame, draw };
const tiltTunecArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltTunecGame, draw };
const tiltTargetArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltTargetGame, draw };
const tiltStrictArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltStrictGame, draw };
export function tiltArtGameFor(rev?: number | null): ArcadeGame<TiltState, ArcadeInputEvent | null> {
  if (rev === TILT_REV_PAR) return tiltParArtGame;
  if (rev === TILT_REV_STD) return tiltStdArtGame;
  if (rev === TILT_REV_LIFT) return tiltLiftArtGame;
  if (rev === TILT_REV_EXPAND) return tiltExpandArtGame;
  if (rev === TILT_REV_STRICT) return tiltStrictArtGame;
  if (rev === TILT_REV_TARGET) return tiltTargetArtGame;
  if (rev === TILT_REV_TUNEC) return tiltTunecArtGame;
  if (rev === TILT_REV_BAND) return tiltBandArtGame;
  return rev === TILT_REV ? tiltRev2ArtGame : tiltArtGame;
}

/**
 * Arena scene (15 Oct 2026, display only; arenaScene.renderer.ts): more of the lamp-lit
 * table round the board (above and below it: the stage centres Tilt's world in its box). The board's own dark rim (just outside the world, as toyBoard
 * draws it) sits on wooden table planks; the board, disc and maze are unchanged.
 */
export function tiltArenaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  // 17 Oct 2026 (screen fill-ins, display only): the board's oak runs on to the screen's edges with no
  // rim, so the maze and its surroundings are one wooden scene (arenaFills.renderer.ts, tiltFill).
  tiltFill(ctx, view, TILT_WORLD_W, TILT_WORLD_H);
}

/** The arena scene for a stored round's revision (tiltRev 8: the taller world). */
export function tiltArenaSceneFor(rev?: number | null): (ctx: CanvasRenderingContext2D, view: ArenaSceneView) => void {
  if (!tiltIsExpand(rev)) return tiltArenaScene;
  return (ctx, view) => tiltFill(ctx, view, TILT_X_W, TILT_X_H);
}

/* ================= Expansion (tiltRev 8, 25 Oct 2026) ================= */

/*
 * tiltRev 8 draws its bigger mazes through a fixed camera (display only; until 27 Oct 2026 it followed the
 * marbles): the disc's centre stands at the screen's centre, scaled so the whole disc fits the width
 * (tiltFixedZoom), and the drawing turns about it. The sim never reads it: gravity is turned into the maze
 * frame by the angle alone. The table is screen-fixed (as the board always was); the disc turns with the maze.
 * Ice is frosted cells, keys are brass (or verdigris) keys with a matching gate across the route, quick
 * stars carry a draining ring for their window, and a marble the camera cannot show gets an edge arrow.
 */

// Subtler since 27 Oct 2026 (Joe's phone notes): a light frost, so the maze's walls and openings read through it.
const ICE_FROST = "rgba(214,240,255,0.2)";
const ICE_EDGE = "rgba(255,255,255,0.26)";
const ICE_GLINT = "rgba(255,255,255,0.5)";
/** Key and gate colours, by key: brass, then verdigris. */
const KEY_COLOURS = [
  { body: TOY_BRASS, dark: TOY_BRASS_DARK, lit: "#FFE9A8" },
  { body: "#3FA79A", dark: "#1E5E57", lit: "#B5F0E6" },
] as const;
const QUICK_RING = "#FFF1B0";
const QUICK_RING_LATE = "#FF9A3D";

/** The disc's radius for a maze (px): its grid's half-width and a rim's margin. */
function discRadiusX(m: Maze): number {
  return (m.n * (m.cs / FP)) / 2 + 16;
}

/** The last view any canvas drew: its turn and zoom (the success layer's pops read it to place themselves). */
let lastView = { rot: 0, zoom: 1 };

/**
 * The fixed camera's zoom for a maze (display only; Joe's phone notes, 27 Oct 2026: the view no longer pans with
 * the marbles): the disc, its rim and groove fill the world's width, centred, so the whole maze is always on
 * screen and only the board turns. Mazes 1–3 draw at about 0.98, 0.86 and 0.77 of their size; tiltRev 10's fourth maze
 * (19 cells of 16 px, a 336 px disc) at full size, a smaller disc on screen than maze 3's.
 */
function tiltFixedZoom(R: number): number {
  return Math.min(1, (TILT_X_W / 2 - 4) / (R + 10));
}

/** The disc face for a radius (cached sprite per radius). */
const discSpritesX = new Map<number, ArtCanvas | null>();
function drawDiscSurfaceX(ctx: CanvasRenderingContext2D, r: number): void {
  let sprite = discSpritesX.get(r);
  if (sprite === undefined) {
    const size = Math.ceil((r * 2 + 2) * DISC_SCALE);
    const canvas = artCanvas(size, size);
    const c = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
    if (canvas && c) {
      c.scale(DISC_SCALE, DISC_SCALE);
      c.translate(r + 1, r + 1);
      paintDisc(c, r);
    }
    sprite = canvas && c ? canvas : null;
    discSpritesX.set(r, sprite);
  }
  if (sprite) ctx.drawImage(sprite as CanvasImageSource, -r - 1, -r - 1, r * 2 + 2, r * 2 + 2);
  else paintDisc(ctx, r);
}

/**
 * tiltRev 8 sprites (presentation only): pieces drawn every frame about a fixed point (the rim's bevel and drop
 * shadow, the lamp's gloss, a star), baked once per size and canvas scale and blitted. At 4× CPU slowdown their
 * gradients and paths cost most of the frame.
 */
const spritesX = new Map<string, ArtCanvas | null>();
function blitX(ctx: CanvasRenderingContext2D, key: string, half: number, paint: (c: CanvasRenderingContext2D) => void): void {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const k = Math.round(Math.max(0.25, Math.min(3, t ? Math.hypot(t.a, t.b) : 1)) * 20) / 20;
  const id = `${key}@${k}`;
  let sprite = spritesX.get(id);
  if (sprite === undefined) {
    const size = Math.ceil(half * 2 * k);
    const canvas = artCanvas(size, size);
    const c = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
    if (canvas && c) {
      c.scale(size / (half * 2), size / (half * 2));
      c.translate(half, half);
      paint(c);
    }
    sprite = canvas && c ? canvas : null;
    if (spritesX.size > 64) spritesX.clear();
    spritesX.set(id, sprite);
  }
  if (sprite) ctx.drawImage(sprite as CanvasImageSource, -half, -half, half * 2, half * 2);
  else paint(ctx);
}
/** A star upright on the screen at (x, y) in the disc's frame, from its sprite. */
function drawStarX(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-rot);
  blitX(ctx, `star:${r.toFixed(2)}`, r * 2.7, (c) => drawStar(c, 0, 0, r, 0));
  ctx.restore();
}

/** Frosted ice over a maze's iced cells (in the disc's frame, under the strips). */
function drawIce(ctx: CanvasRenderingContext2D, m: Maze, o: number): void {
  if (!m.ice) return;
  const cs = m.cs / FP;
  for (let c = 0; c < m.n * m.n; c++) {
    if (m.ice[c] !== 1) continue;
    const x = (c % m.n) * cs - o;
    const y = Math.trunc(c / m.n) * cs - o;
    ctx.fillStyle = ICE_FROST;
    ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
    // A pale rim and two glints per cell (fixed per cell), so the patch reads as ice, not paint.
    ctx.strokeStyle = ICE_EDGE;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
    const h = Math.imul(c + 17, 2654435761) >>> 0;
    ctx.strokeStyle = ICE_GLINT;
    ctx.lineWidth = 1.1;
    for (let k = 0; k < 2; k++) {
      const gx = x + 5 + ((h >>> (k * 7)) % Math.max(1, cs - 14));
      const gy = y + 5 + ((h >>> (k * 7 + 3)) % Math.max(1, cs - 14));
      ctx.beginPath();
      ctx.moveTo(gx, gy + 5);
      ctx.lineTo(gx + 5, gy);
      ctx.stroke();
    }
  }
}

/** The disc, its pits, its ice and its strips for one maze, at the canvas's scale (one sprite per maze and scale). */
const mazeSpritesX = new WeakMap<Maze, { k: number; sprite: ArtCanvas | null }>();
function mazeSpriteX(ctx: CanvasRenderingContext2D, m: Maze, lite: boolean): ArtCanvas | null {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const k = Math.round(Math.max(0.25, Math.min(2.5, t ? Math.hypot(t.a, t.b) : 1)) * 100) / 100 + (lite ? 1000 : 0);
  const old = mazeSpritesX.get(m);
  if (old && old.k === k) return old.sprite;
  const R = discRadiusX(m);
  const scale = k % 1000;
  const size = Math.ceil((R * 2 + 2) * scale);
  const canvas = artCanvas(size, size);
  const c = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
  if (canvas && c) {
    c.scale(size / (R * 2 + 2), size / (R * 2 + 2));
    c.translate(R + 1, R + 1);
    c.save();
    c.beginPath();
    c.arc(0, 0, R + 1, 0, Math.PI * 2);
    c.clip();
    drawDiscSurfaceX(c, R);
    drawIce(c, m, (m.n * (m.cs / FP)) / 2);
    drawPits(c, m);
    drawStrips(c, m, lite);
    c.restore();
  }
  const sprite = canvas && c ? canvas : null;
  mazeSpritesX.set(m, { k, sprite });
  return sprite;
}

/** A small brass key, upright on the screen (rot undoes the disc's turn). */
function drawKey(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number, colour: (typeof KEY_COLOURS)[number], lite: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-rot);
  if (!lite) {
    const glow = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 1.5);
    glow.addColorStop(0, "rgba(255,236,170,0.7)");
    glow.addColorStop(1, "rgba(255,236,170,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.rotate(-0.6);
  ctx.fillStyle = colour.dark;
  ctx.strokeStyle = colour.dark;
  ctx.lineWidth = size * 0.22;
  ctx.lineCap = "round";
  // Shank and teeth.
  ctx.beginPath();
  ctx.moveTo(-size * 0.2, 0);
  ctx.lineTo(size * 0.75, 0);
  ctx.moveTo(size * 0.55, 0);
  ctx.lineTo(size * 0.55, size * 0.28);
  ctx.moveTo(size * 0.75, 0);
  ctx.lineTo(size * 0.75, size * 0.32);
  ctx.stroke();
  ctx.strokeStyle = colour.body;
  ctx.lineWidth = size * 0.13;
  ctx.stroke();
  // Bow: a ring.
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = colour.dark;
  ctx.beginPath();
  ctx.arc(-size * 0.42, 0, size * 0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = size * 0.12;
  ctx.strokeStyle = colour.body;
  ctx.stroke();
  ctx.strokeStyle = colour.lit;
  ctx.lineWidth = Math.max(0.6, size * 0.05);
  ctx.beginPath();
  ctx.arc(-size * 0.42, 0, size * 0.28, Math.PI * 1.05, Math.PI * 1.6);
  ctx.stroke();
  ctx.restore();
}

/** A shut gate: a bar along the cell edge in its key's colour with a keyhole plate (the old gate's latch). */
function drawGateBar(ctx: CanvasRenderingContext2D, m: Maze, c: number, d: number, o: number, colour: (typeof KEY_COLOURS)[number], open: number): void {
  const cs = m.cs / FP;
  const x = (c % m.n) * cs - o;
  const y = Math.trunc(c / m.n) * cs - o;
  const ax = d === 0 ? x + cs : x;
  const ay = d === 1 ? y + cs : y;
  const horizontal = d === 1 || d === 3;
  ctx.save();
  ctx.globalAlpha = 1 - open;
  ctx.translate(ax, ay);
  // Opening swings it about its first end, as the old padlock gate did.
  ctx.rotate((horizontal ? -1 : 1) * open * (Math.PI / 2));
  const len = cs;
  ctx.lineCap = "round";
  ctx.strokeStyle = colour.dark;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  if (horizontal) ctx.lineTo(len, 0);
  else ctx.lineTo(0, len);
  ctx.stroke();
  ctx.strokeStyle = colour.body;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = colour.lit;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (horizontal) {
    ctx.moveTo(1, -1);
    ctx.lineTo(len - 1, -1);
  } else {
    ctx.moveTo(-1, 1);
    ctx.lineTo(-1, len - 1);
  }
  ctx.stroke();
  // The keyhole plate at the bar's middle.
  const px = horizontal ? len / 2 : 0;
  const py = horizontal ? 0 : len / 2;
  ctx.fillStyle = colour.body;
  ctx.strokeStyle = colour.dark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(px, py, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = TOY_INK;
  ctx.beginPath();
  ctx.arc(px, py - 0.8, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(px - 0.6, py - 0.5, 1.2, 2.6);
  ctx.restore();
}

/** A quick star: the bonus star, and round it a ring that drains as its window runs out. */
function drawQuickStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, left: number, life: number, full: boolean, lite: boolean): void {
  const share = left / Math.max(1, life);
  // The last two seconds it fades away with its ring.
  const fade = Math.min(1, left / 120);
  ctx.save();
  ctx.globalAlpha = fade;
  drawStarX(ctx, x, y, r, rot);
  ctx.translate(x, y);
  ctx.rotate(-rot);
  ctx.strokeStyle = "rgba(60,30,8,0.45)";
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.75, 0, Math.PI * 2);
  ctx.stroke();
  // Full points while the ring is pale gold; amber once they start to fall.
  ctx.strokeStyle = full ? QUICK_RING : QUICK_RING_LATE;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share);
  ctx.stroke();
  if (!lite) {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.05, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share);
    ctx.stroke();
  }
  ctx.restore();
}

/** An arrow on the screen's edge toward a marble the camera cannot show. */
function edgeArrow(ctx: CanvasRenderingContext2D, x: number, y: number, W: number, H: number, colour: string): void {
  const pad = 22;
  if (x > pad && x < W - pad && y > pad + 40 && y < H - pad) return;
  const cx = W / 2;
  const cy = H / 2;
  const dx = x - cx;
  const dy = y - cy;
  const s = Math.min((W / 2 - pad) / Math.max(1e-6, Math.abs(dx)), (H / 2 - pad - 20) / Math.max(1e-6, Math.abs(dy)));
  const ex = cx + dx * s;
  const ey = cy + dy * s;
  const a = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = "rgba(30,14,4,0.55)";
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-4, -6);
  ctx.lineTo(-4, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawX(ctx: CanvasRenderingContext2D, state: TiltState, size: CanvasSize): void {
  arcadeFx(ctx, TILT_X_FX, state, () => drawWorldX(ctx, state, size), size);
}

function drawWorldX(ctx: CanvasRenderingContext2D, state: TiltState, size: CanvasSize): void {
  const W = TILT_X_W;
  const H = TILT_X_H;
  const scale = Math.min(size.width / W, size.height / H);
  const ox = (size.width - W * scale) / 2;
  const oy = (size.height - H * scale) / 2;
  const m = state.list[Math.min(state.level, state.list.length - 1)]!;
  const cs = m.cs / FP;
  const o = (m.n * cs) / 2;
  const R = discRadiusX(m);
  const lite = arcadeReducedEffects();
  const rot = (state.angle / 65536) * Math.PI * 2;
  const finish = toyChangeAge(ctx, "tilt-mazes", state.mazes, {
    blue: cupOf(m, o, m.exit, m.exitDir, true),
    amber: state.b && (m.exit2 ?? -1) >= 0 ? cupOf(m, o, m.exit2!, m.exitDir2!, true) : null,
    aHome: !!state.aHome,
    bHome: !!state.bHome,
    r: m.br / FP,
    level: state.level,
  });
  const keyAge = toyChangeAge(ctx, "tilt-keys", state.level * 8 + (state.keysGot ?? 0));

  // The table: screen-fixed, one cached layer (the oak board, its planks and the lamplight pool).
  deviceLayer(ctx, `tilt-x-board:${ox},${oy},${scale}`, (c) => {
    c.fillStyle = "#9A7347";
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.save();
    c.translate(ox, oy);
    c.scale(scale, scale);
    toyBoard(c, 0, 0, W, H, 10, false);
    drawTableDressing(c, W, H, W / 2, H / 2);
    c.restore();
  });
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();

  // The camera stays on the disc's centre (display only): screen = centre + zoom · rotate(angle) · maze point.
  const cam = { x: 0, y: 0 };
  const zoom = tiltFixedZoom(R);
  lastView = { rot, zoom };
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.rotate(rot);

  // The groove and rim, turned with the disc (their light stays screen-fixed: drawn unrotated about the centre).
  ctx.save();
  ctx.rotate(-rot);
  blitX(ctx, `bed:${R}`, R + 26, (c) => drawDiscBed(c, R));
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R + 2, 0, Math.PI * 2);
  ctx.clip();
  const baked = mazeSpriteX(ctx, m, lite);
  if (baked) ctx.drawImage(baked as CanvasImageSource, -R - 1, -R - 1, R * 2 + 2, R * 2 + 2);
  else {
    drawDiscSurfaceX(ctx, R);
    drawIce(ctx, m, o);
    drawPits(ctx, m);
    drawStrips(ctx, m, lite);
  }
  if (!lite) {
    // The lamp's gloss over the disc, screen-fixed.
    ctx.save();
    ctx.rotate(-rot);
    blitX(ctx, `gloss:${R}`, R + 1, (c) => {
      const gloss = c.createRadialGradient(-R * 0.45, -R * 0.5, 10, 0, 0, R);
      gloss.addColorStop(0, "rgba(255,236,196,0.4)");
      gloss.addColorStop(0.6, "rgba(255,246,220,0)");
      gloss.addColorStop(1, "rgba(60,30,10,0.3)");
      c.fillStyle = gloss;
      c.beginPath();
      c.arc(0, 0, R, 0, Math.PI * 2);
      c.fill();
    });
    ctx.restore();
  }

  drawBigCup(ctx, cupOf(m, o, m.exit, m.exitDir, true), TILT_MARBLE_BLUE, CUP_GLASS, !!state.aHome);
  if ((m.exit2 ?? -1) >= 0) drawBigCup(ctx, cupOf(m, o, m.exit2!, m.exitDir2!, true), TILT_MARBLE_AMBER, CUP_AMBER_GLASS, !!state.bHome);
  (m.stars ?? []).forEach((_c, k) => {
    if ((state.starGot ?? [])[k]) return;
    const p = tiltStarPoint(m, k);
    drawStarX(ctx, p.x / FP - o, p.y / FP - o, cs * 0.3, rot);
  });
  // Quick stars: each ring drains over the star's life (pale gold while it scores in full, amber after).
  const quickLife = (k: number) => (m.quickAt?.[k] ?? 0) + TILT_X_QUICK_TAIL;
  (m.quick ?? []).forEach((c, k) => {
    const left = tiltQuickLeftX(state, k);
    if ((state.quickGot ?? [])[k] || left <= 0) return;
    const p = tiltCellCentre(m, c);
    drawQuickStar(ctx, p.x / FP - o, p.y / FP - o, cs * 0.27, rot, left, quickLife(k), tiltQuickFullLeftX(state, k) > 0, lite);
  });
  // Keys and gates: a gate swings open (and its key fades) as the key is taken.
  const gates = m.gates ?? [];
  (m.keys ?? []).forEach((c, k) => {
    const colour = KEY_COLOURS[k % KEY_COLOURS.length]!;
    const got = ((state.keysGot ?? 0) >> k) & 1;
    const just = got && keyAge.age < 450 && !reducedMotion() ? keyAge.age / 450 : got ? 1 : 0;
    if (just < 1) {
      const p = tiltCellCentre(m, c);
      ctx.save();
      ctx.globalAlpha = 1 - just;
      drawKey(ctx, p.x / FP - o, p.y / FP - o, cs * 0.42, rot, colour, lite);
      ctx.restore();
      drawGateBar(ctx, m, gates[2 * k]!, gates[2 * k + 1]!, o, colour, just);
    }
  });

  // Marbles: a marble in its cup rests there; the last one home sinks into its cup when a maze ends.
  type Cup = { x: number; y: number; r: number };
  type Finish = { blue: Cup; amber: Cup | null; aHome: boolean; bHome: boolean; r: number; level: number };
  const mr = m.br / FP;
  // The run's last maze: 3 on tiltRev 8 and 9, 4 on tiltRev 10 (each state lists its own mazes).
  const all = state.list.length;
  const done = state.ended === 1 && state.mazes >= all;
  const prev = finish.before as Finish | undefined;
  if (prev && finish.age < 400 && !reducedMotion() && prev.level !== state.level) {
    // The previous maze is gone from view; its cup's marble sinks at the screen's centre instead.
    const u = finish.age / 400;
    ctx.save();
    ctx.globalAlpha = 1 - u;
    toyMarble(ctx, cam.x, cam.y, prev.r * (1 - 0.6 * u), TILT_MARBLE_BLUE, -rot);
    ctx.restore();
  }
  // A marble back at its start after a black hole fades in over its hold (still: no fade).
  const holdAlpha = (hold: number | undefined) => {
    const left = (hold ?? 0) - state.tick;
    return left <= 0 || reducedMotion() ? 1 : 0.25 + 0.75 * (1 - left / TILT_X_FALL_HOLD);
  };
  if (state.b) {
    const cup = cupOf(m, o, m.exit2!, m.exitDir2!, true);
    const at = state.bHome ? cup : { x: state.b.x / FP - o, y: state.b.y / FP - o };
    if (!done) {
      ctx.save();
      if (!state.bHome) ctx.globalAlpha = holdAlpha(state.holdB);
      if (!state.bHome) marbleShadow(ctx, at.x, at.y, mr, rot);
      toyMarble(ctx, at.x, at.y, mr, TILT_MARBLE_AMBER, -rot, 3);
      ctx.restore();
    }
  }
  if (state.aHome) {
    const cup = cupOf(m, o, m.exit, m.exitDir, true);
    toyMarble(ctx, cup.x, cup.y, mr, TILT_MARBLE_BLUE, -rot);
  } else if (!done) {
    const mx = state.x / FP - o, my = state.y / FP - o;
    ctx.save();
    ctx.globalAlpha = holdAlpha(state.holdA);
    marbleShadow(ctx, mx, my, mr, rot);
    if (!drawArtSprite(ctx, "toybox", "marble", mx - mr, my - mr, mr * 2, mr * 2, { angle: -rot })) toyMarble(ctx, mx, my, mr, TILT_MARBLE_BLUE, -rot);
    marbleGloss(ctx, mx, my, mr, rot);
    ctx.restore();
    if (state.b && !state.bHome) {
      const bx = state.b.x / FP - o, by = state.b.y / FP - o;
      if (Math.hypot(bx - mx, by - my) < mr) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, mr, -Math.PI / 2, Math.PI / 2);
        ctx.closePath();
        ctx.clip();
        toyMarble(ctx, bx, by, mr, TILT_MARBLE_AMBER, -rot, 3);
        ctx.restore();
      }
    }
  }
  ctx.restore();
  ctx.restore();

  // Edge arrows for a marble out of view, then the counts.
  const toScreen = (x: number, y: number) => {
    const dx = (x - cam.x) * zoom;
    const dy = (y - cam.y) * zoom;
    return { x: W / 2 + Math.cos(rot) * dx - Math.sin(rot) * dy, y: H / 2 + Math.sin(rot) * dx + Math.cos(rot) * dy };
  };
  if (!state.aHome && !done) {
    const p = toScreen(state.x / FP - o, state.y / FP - o);
    edgeArrow(ctx, p.x, p.y, W, H, TILT_MARBLE_BLUE);
  }
  if (state.b && !state.bHome && !done) {
    const p = toScreen(state.b.x / FP - o, state.b.y / FP - o);
    edgeArrow(ctx, p.x, p.y, W, H, TILT_MARBLE_AMBER);
  }
  ctx.fillStyle = TOY_INK;
  ctx.font = "600 16px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Maze ${Math.min(all, state.mazes + 1)} / ${all}`, 14, 26);
  ctx.textAlign = "right";
  if (state.parClean) {
    // tiltRev 11: no gold stars; the seconds left to this maze's par (or the pars made once the run is over), and
    // "Clean" while no marble has fallen into a black hole.
    const left = tiltParLeftX(state);
    ctx.fillText(done ? `Par ${state.parsMet ?? 0} / ${all}` : left > 0 ? `Par ${Math.ceil(left / 60)} s` : "Over par", W - 14, 26);
    if (!(state.falls ?? 0)) {
      ctx.font = "600 13px ui-monospace, monospace";
      ctx.fillText("Clean", W - 14, 46);
      ctx.font = "600 16px ui-monospace, monospace";
    }
  } else ctx.fillText(`Stars ${state.stars ?? 0} / ${tiltTotalStars(state)}`, W - 14, 26);
  // Quick stars left in this maze, with the window's ring.
  const quickOn = (m.quick ?? []).map((_c, k) => k).filter((k) => !(state.quickGot ?? [])[k] && tiltQuickLeftX(state, k) > 0);
  const quickLeft = quickOn.length;
  if (quickLeft > 0 && !done) {
    const k = quickOn[0]!;
    ctx.textAlign = "left";
    drawQuickStar(ctx, 24, 50, 7, 0, tiltQuickLeftX(state, k), quickLife(k), tiltQuickFullLeftX(state, k) > 0, true);
    ctx.fillStyle = TOY_INK;
    ctx.fillText(`×${quickLeft}`, 40, 56);
  }
  ctx.restore();
}

/** tiltRev 8's success layer: the old one's moments for three mazes, plus quick stars and keys. */
export const TILT_X_FX: ArcadeFxSpec<TiltState> = {
  ...TILT_FX,
  width: TILT_X_W,
  height: TILT_X_H,
  // The old moments first, in their order (the replay moments read them by index), then the new ones.
  events: [
    // Each state lists its own mazes (3 on tiltRev 8 and 9, 4 on tiltRev 10).
    { kind: "clear", count: (s) => s.mazes, when: (s) => s.mazes < s.list.length, label: (_s, n) => `MAZE ${n} DONE!` },
    { kind: "final", count: (s) => (s.mazes >= s.list.length ? 1 : 0), label: (s) => `ALL ${s.list.length} MAZES!` },
    { kind: "pop", count: (s) => s.stars ?? 0, at: (s) => tiltMarbleAtX(s), label: () => "BONUS STAR!" },
    {
      kind: "pop",
      count: (s) => (s.b ? (s.aHome ?? 0) + (s.bHome ?? 0) : 0),
      when: (s) => !(s.aHome && s.bHome),
      at: () => ({ x: TILT_X_W / 2, y: 90 }),
      label: (s) => (s.aHome ? "BLUE IN! NOW THE AMBER" : "AMBER IN! NOW THE BLUE"),
    },
    { kind: "pop", count: (s) => s.quickTaken ?? 0, at: (s) => tiltMarbleAtX(s), label: () => "QUICK STAR!" },
    { kind: "pop", count: (s) => s.keysTaken ?? 0, at: (s) => tiltMarbleAtX(s), label: () => "GATE OPEN!" },
    // tiltRev 11 (appended, so the moments above keep their indices): a maze finished within its par.
    { kind: "pop", count: (s) => s.parsMet ?? 0, at: () => ({ x: TILT_X_W / 2, y: 130 }), label: () => "UNDER PAR!" },
  ],
  // tiltRev 8: a fall into a black hole sends the marble back to its start (the run goes on).
  misses: [{ count: (s) => s.falls ?? 0, at: (s) => tiltMarbleAtX(s) }],
};

/** Where the marble nearest the last moment is on the screen (the last view drawn). */
function tiltMarbleAtX(s: TiltState): { x: number; y: number } {
  const m = s.list[Math.min(s.level, s.list.length - 1)]!;
  const o = (m.n * m.cs) / 2;
  const ball = !s.aHome || !s.b ? { x: s.x, y: s.y } : s.b;
  const dx = ((ball.x - o) / FP) * lastView.zoom;
  const dy = ((ball.y - o) / FP) * lastView.zoom;
  const a = lastView.rot;
  return { x: TILT_X_W / 2 + Math.cos(a) * dx - Math.sin(a) * dy, y: TILT_X_H / 2 + Math.sin(a) * dx + Math.cos(a) * dy };
}

const tiltExpandArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltExpandGame, draw: drawX };
const tiltLiftArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltLiftGame, draw: drawX };
const tiltStdArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltStdGame, draw: drawX };
const tiltParArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltParGame, draw: drawX };
