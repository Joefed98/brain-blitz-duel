/**
 * Ricochet's ninja wall-climb art (ricoRev 2; display only, never imported by the sim or server): night over two
 * temple walls of dark stone, a moon and a distant pagoda behind, the ninja (a clean black silhouette with a red
 * headband and sash), katanas in the walls (a gold guard and a steel blade that glints), spinning shurikens, moss and
 * ice patches, coins, gold lanterns and scrolls. Every object is drawn inside its sim bounds (within 2 px: the
 * arcade bounds rule). The sky is painted once per canvas size (deviceLayer); only the walls, the objects in view and
 * the HUD are drawn each frame.
 */
import { deviceLayer } from "./cache.renderer";
import { drawHero, heroPose, type HeroPose } from "./hero.renderer";
import { artHash } from "./art.renderer";
import { arcadeFx, ARCADE_FX_DISPLAY_FONT, type ArcadeFxSpec } from "./arcadeFx.renderer";
import type { CanvasSize } from "./engine";
import {
  KATANA_HALF,
  KATANA_LEN,
  lanternAt,
  LANTERN_R,
  MODE_FLIGHT,
  MODE_STUN,
  NINJA_CORE_FULL_M,
  NINJA_HANG,
  NINJA_PX_PER_M,
  NINJA_HH,
  NINJA_HW,
  NINJA_START,
  NINJA_WALL_L,
  NINJA_WALL_R,
  NINJA_WORLD_H,
  NINJA_WORLD_W,
  ninjaGame,
  ninjaMetres,
  SCROLL_R,
  COIN_R,
  SHURIKEN_R,
  SHURIKEN_X0,
  SHURIKEN_X1,
  shurikenAt,
  SURF_ICE,
  SURF_MOSS,
  type NinjaState,
} from "./ricochetNinja";

export const NINJA_BG = "#0A0D1C";
export const NINJA_RED = "#E0283A";
export const NINJA_GOLD = "#F2C75C";
const STONE = "#2B2C38";
const STONE_LIT = "#363746";
const STONE_DARK = "#1C1D27";
const MORTAR = "#14151D";
const MOSS = "#4E8A3A";
const ICE = "#BFE6F5";
const STEEL = "#D8DEE8";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/** The camera: the ninja two thirds down; the floor never above the bottom. */
const EYE = Math.round(NINJA_WORLD_H * 0.62);
export function ninjaCamera(state: Pick<NinjaState, "y">): number {
  return Math.max(state.y >> 8, NINJA_WORLD_H - 24 - EYE);
}
/** World height (px above the floor) to the world's screen y for this camera. */
export function ninjaScreenY(cam: number, ypx: number): number {
  return EYE - (ypx - cam);
}

/* ================================ The sky ================================ */

function paintSky(ctx: CanvasRenderingContext2D): void {
  const W = NINJA_WORLD_W;
  const H = NINJA_WORLD_H;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#070A18");
  g.addColorStop(0.55, "#121A36");
  g.addColorStop(1, "#1E2240");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Stars.
  for (let i = 0; i < 70; i++) {
    const h = artHash(i, 41);
    ctx.globalAlpha = 0.25 + ((h >>> 9) % 6) * 0.1;
    ctx.fillStyle = "#E8ECFF";
    ctx.fillRect(NINJA_WALL_L + (h % (NINJA_WALL_R - NINJA_WALL_L)), (h >>> 12) % Math.round(H * 0.7), (h >>> 28) % 5 === 0 ? 2 : 1, 1);
  }
  ctx.globalAlpha = 1;
  // The moon, with a soft halo.
  const mx = 238;
  const my = 132;
  const halo = ctx.createRadialGradient(mx, my, 20, mx, my, 110);
  halo.addColorStop(0, "rgba(255,240,205,0.30)");
  halo.addColorStop(1, "rgba(255,240,205,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(mx - 110, my - 110, 220, 220);
  ctx.fillStyle = "#FBF1D6";
  ctx.beginPath();
  ctx.arc(mx, my, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(205,190,160,0.35)";
  for (const [x, y, r] of [[-10, -6, 7], [9, 8, 5], [4, -14, 4], [-6, 14, 3]] as const) {
    ctx.beginPath();
    ctx.arc(mx + x, my + y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // A far ridge and the pagoda, in silhouette.
  ctx.fillStyle = "#151A33";
  ctx.beginPath();
  ctx.moveTo(0, H * 0.88);
  for (let x = 0; x <= W; x += 30) ctx.lineTo(x, H * 0.86 + 14 * Math.sin(x / 47) + 8 * Math.sin(x / 13));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  drawPagoda(ctx, 160, Math.round(H * 0.86), 0.8);
  // Mist over the ridge.
  const mist = ctx.createLinearGradient(0, H * 0.8, 0, H);
  mist.addColorStop(0, "rgba(120,130,190,0)");
  mist.addColorStop(1, "rgba(120,130,190,0.16)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, H * 0.8, W, H * 0.2);
}

/** A five-roof pagoda silhouette, its base at (x, base), with a few lit windows. */
export function drawPagoda(ctx: CanvasRenderingContext2D, x: number, base: number, s: number): void {
  ctx.fillStyle = "#0E1226";
  const tiers = 5;
  let y = base;
  for (let i = 0; i < tiers; i++) {
    const w = (54 - i * 8) * s;
    const h = 16 * s;
    ctx.fillRect(x - w * 0.32, y - h, w * 0.64, h);
    // The roof: wide, swept up at its ends.
    ctx.beginPath();
    ctx.moveTo(x - w * 0.62, y - h + 1 * s);
    ctx.quadraticCurveTo(x - w * 0.42, y - h - 2 * s, x - w * 0.3, y - h - 6 * s);
    ctx.lineTo(x + w * 0.3, y - h - 6 * s);
    ctx.quadraticCurveTo(x + w * 0.42, y - h - 2 * s, x + w * 0.62, y - h + 1 * s);
    ctx.closePath();
    ctx.fill();
    if (i < 3) {
      ctx.fillStyle = "rgba(255,190,90,0.55)";
      ctx.fillRect(x - 2 * s, y - h * 0.7, 3 * s, 5 * s);
      ctx.fillStyle = "#0E1226";
    }
    y -= h + 6 * s;
  }
  ctx.fillRect(x - 1 * s, y - 14 * s, 2 * s, 14 * s);
}

/* ================================ Walls ================================ */

export const NINJA_STONE_ROW = 30;
const ROW = NINJA_STONE_ROW;
function drawWall(ctx: CanvasRenderingContext2D, wall: number, cam: number): void {
  const x0 = wall === 0 ? 0 : NINJA_WALL_R;
  const x1 = wall === 0 ? NINJA_WALL_L : NINJA_WORLD_W;
  const w = x1 - x0;
  ctx.fillStyle = MORTAR;
  ctx.fillRect(x0, 0, w, NINJA_WORLD_H);
  // Courses of stone scroll with the climb; each block's shade comes from its own place.
  const topPx = cam + EYE;
  const firstRow = Math.floor((topPx - NINJA_WORLD_H - ROW) / ROW);
  for (let r = firstRow; r <= Math.ceil(topPx / ROW) + 1; r++) {
    if (r < 0) continue;
    const sy = ninjaScreenY(cam, (r + 1) * ROW);
    const off = r % 2 === 0 ? 0 : 22;
    for (let bx = x0 - off; bx < x1; bx += 44) {
      const h = artHash(r * 7 + wall, Math.round(bx));
      ctx.fillStyle = h % 5 === 0 ? STONE_LIT : h % 7 === 0 ? STONE_DARK : STONE;
      const a = Math.max(x0, bx + 1);
      const b = Math.min(x1, bx + 43);
      if (b > a) ctx.fillRect(a, sy + 1, b - a, ROW - 2);
    }
  }
  // The inner face: a lit edge on the stone towards the gap and a shadow.
  const edge = wall === 0 ? NINJA_WALL_L - 3 : NINJA_WALL_R;
  ctx.fillStyle = "rgba(160,170,220,0.16)";
  ctx.fillRect(edge, 0, 3, NINJA_WORLD_H);
}

function drawFloor(ctx: CanvasRenderingContext2D, cam: number): void {
  const sy = ninjaScreenY(cam, (NINJA_START >> 8) - NINJA_HH);
  if (sy > NINJA_WORLD_H) return;
  ctx.fillStyle = "#3A2E22";
  ctx.fillRect(0, sy, NINJA_WORLD_W, NINJA_WORLD_H - sy + 2);
  ctx.fillStyle = "#5A4630";
  ctx.fillRect(0, sy, NINJA_WORLD_W, 3);
}

/* ================================ Objects ================================ */

/**
 * A moss or ice patch on a wall, 14 px into the stone with a lip at the face. Moss: green with lighter tufts and drips.
 * Ice: pale blue and frosted (white speckles, crystal streaks, a glint running down it) with icicles off its lower
 * edge, so it reads as plainly as the moss.
 */
export function drawPatch(ctx: CanvasRenderingContext2D, wall: number, kind: number, top: number, bottom: number, tick: number): void {
  const face = wall === 0 ? NINJA_WALL_L : NINJA_WALL_R;
  const depth = 14;
  const x = wall === 0 ? face - depth : face;
  const h = bottom - top;
  const inward = wall === 0 ? 1 : -1;
  if (kind === SURF_MOSS) {
    ctx.fillStyle = MOSS;
    ctx.fillRect(x, top, depth, h);
    ctx.fillStyle = "#6FB04E";
    for (let y = top + 4; y < bottom - 2; y += 9) ctx.fillRect(wall === 0 ? face - 4 : face + 1, y, 3, 4);
    ctx.fillStyle = "#86C861";
    ctx.fillRect(wall === 0 ? face - 2 : face, top, 2, h);
    // Drips into the gap.
    ctx.fillStyle = "#3C6E2C";
    for (let i = 0; i < 3; i++) ctx.fillRect(wall === 0 ? face : face - 2, top + ((i + 1) * h) / 4, 2, 5);
  } else {
    const g = ctx.createLinearGradient(x, 0, x + depth, 0);
    g.addColorStop(0, wall === 0 ? "#9FD3EC" : "#E4F6FF");
    g.addColorStop(1, wall === 0 ? "#E4F6FF" : "#9FD3EC");
    ctx.fillStyle = g;
    ctx.fillRect(x, top, depth, h);
    // Frost: white speckles and slanted crystal streaks, from the patch's own place.
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i * 7 < h; i++) {
      const hh = artHash(i, Math.round(top) * 3 + wall);
      ctx.fillRect(x + 1 + (hh % (depth - 3)), top + i * 7 + ((hh >>> 8) % 5), 2, 1.5);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = top + 6; y < bottom - 6; y += 16) {
      ctx.moveTo(x + 2, y);
      ctx.lineTo(x + depth - 2, y - 6);
    }
    ctx.stroke();
    // The lip at the face and a glint running down it.
    ctx.fillStyle = "#F4FBFF";
    ctx.fillRect(wall === 0 ? face - 2 : face, top, 2, h);
    const shine = (tick * 2 + top) % Math.max(1, Math.round(h + 40));
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(wall === 0 ? face - 5 : face + 2, top + shine - 20, 3, 14);
    // Icicles off the lower edge, along the face.
    ctx.fillStyle = "#D6F0FC";
    for (const [dx, len] of [[1, 9], [5, 6], [9, 8]] as const) {
      const ix = face - inward * dx;
      ctx.beginPath();
      ctx.moveTo(ix - 2, bottom);
      ctx.lineTo(ix + 2, bottom);
      ctx.lineTo(ix, bottom + len);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export function drawKatana(ctx: CanvasRenderingContext2D, wall: number, sy: number, tick: number, seed: number): void {
  const dir = wall === 0 ? 1 : -1;
  const face = wall === 0 ? NINJA_WALL_L : NINJA_WALL_R;
  // The blade: steel, edge-lit, the tip angled.
  ctx.fillStyle = STEEL;
  ctx.beginPath();
  ctx.moveTo(face + dir * 6, sy - KATANA_HALF + 1);
  ctx.lineTo(face + dir * (KATANA_LEN - 6), sy - KATANA_HALF + 1);
  ctx.lineTo(face + dir * KATANA_LEN, sy + KATANA_HALF - 1);
  ctx.lineTo(face + dir * 6, sy + KATANA_HALF - 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8D97A8";
  ctx.fillRect(Math.min(face + dir * 6, face + dir * (KATANA_LEN - 6)), sy + 1, KATANA_LEN - 12, KATANA_HALF - 2);
  // A glint running along it every couple of seconds.
  const p = (tick + (seed % 97)) % 130;
  if (p < 24) {
    const gx = face + dir * (8 + (p * (KATANA_LEN - 14)) / 24);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(gx - 2, sy - KATANA_HALF + 1, 4, 3);
  }
  // The gold guard at the wall.
  ctx.fillStyle = NINJA_GOLD;
  ctx.fillRect(wall === 0 ? face + 2 : face - 6, sy - 6, 4, 12);
  ctx.fillStyle = "#9A6B1E";
  ctx.fillRect(wall === 0 ? face : face - 2, sy - 2, 2, 4);
}

/** A shuriken: steel grey with a dark outline and a red centre ring, its four points turning (the sim's radius at the points). */
export function drawShuriken(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((tick % 20) * ((Math.PI * 2) / 20));
  const r = SHURIKEN_R - 0.5;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a + Math.PI / 4) * 3.6, Math.sin(a + Math.PI / 4) * 3.6);
  }
  ctx.closePath();
  ctx.fillStyle = "#8E97A6";
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#14161E";
  ctx.stroke();
  // A bright bevel on one side of each point, so the turning reads.
  ctx.fillStyle = "#D7DDE8";
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (r - 1.5), Math.sin(a) * (r - 1.5));
    ctx.lineTo(Math.cos(a + Math.PI / 4) * 3, Math.sin(a + Math.PI / 4) * 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = NINJA_RED;
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#14161E";
  ctx.beginPath();
  ctx.arc(0, 0, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A shuriken's seeded path across the gap: a faint dotted line from wall to wall. */
function drawShurikenPath(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255,120,120,0.28)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 6]);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number): void {
  const squash = 0.55 + 0.45 * Math.abs(Math.cos((tick + x) / 14));
  ctx.fillStyle = "#B8862A";
  ctx.beginPath();
  ctx.ellipse(x, y, COIN_R * squash, COIN_R, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFD86B";
  ctx.beginPath();
  ctx.ellipse(x, y, (COIN_R - 2) * squash, COIN_R - 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8A5E16";
  ctx.fillRect(x - 1.5 * squash, y - 2, 3 * squash, 4);
}

export function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number): void {
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 26);
  glow.addColorStop(0, `rgba(255,200,90,${0.42 + 0.08 * Math.sin(tick / 9)})`);
  glow.addColorStop(1, "rgba(255,200,90,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 26, y - 26, 52, 52);
  ctx.fillStyle = "#3A2A10";
  ctx.fillRect(x - 5, y - LANTERN_R, 10, 2);
  ctx.fillRect(x - 5, y + LANTERN_R - 2, 10, 2);
  ctx.fillStyle = NINJA_GOLD;
  ctx.beginPath();
  ctx.ellipse(x, y, LANTERN_R - 2, LANTERN_R - 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(150,90,20,0.7)";
  ctx.lineWidth = 1;
  for (const dx of [-4, 0, 4]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y - LANTERN_R + 3);
    ctx.lineTo(x + dx, y + LANTERN_R - 3);
    ctx.stroke();
  }
}

export function drawScroll(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number): void {
  const bob = Math.round(Math.sin(tick / 12));
  ctx.fillStyle = "rgba(255,240,200,0.28)";
  ctx.beginPath();
  ctx.arc(x, y + bob, SCROLL_R + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F3E6C4";
  ctx.fillRect(x - SCROLL_R + 2, y - 5 + bob, 2 * SCROLL_R - 4, 10);
  ctx.fillStyle = "#7A4B22";
  ctx.fillRect(x - SCROLL_R, y - 6 + bob, 3, 12);
  ctx.fillRect(x + SCROLL_R - 3, y - 6 + bob, 3, 12);
  ctx.fillStyle = NINJA_RED;
  ctx.fillRect(x - 1, y - 5 + bob, 3, 10);
}

/**
 * The ninja: the Joulz hero (hero.renderer.ts, the figure the score celebrations draw: its gold cape, gold-outlined black
 * limbs, chest bolt, gold gloves and boots, black head with the gold ring, mask band and eye slits) in ninja gear: a
 * dark wrap round the head that leaves the hero's face showing, a red headband with trailing tails, a red sash and a
 * small katana on the back. Every pose sits inside the sim's body box (NINJA_HW × NINJA_HH either side of (x, y)),
 * so what you see is what is hit. `pose`: 0 clinging (hands and feet on the wall behind, `face` +1 facing right),
 * 1 leaping (stretched along the arc), 2 double jump (a tuck turning through `spin`), 3 stunned (arms dropped,
 * swaying). `scale` draws it larger or smaller (the tile icon); the game draws at 1.
 */
const ninjaPoseMemo = heroPose();
const NINJA_WRAP = "#2A2D45";
const NINJA_WRAP_EDGE = "#6B72A8";

function setPose(p: HeroPose, pose: number, face: number, tick: number): void {
  const f = face;
  const at = (k: keyof HeroPose, v: number) => {
    (p as unknown as Record<string, number>)[k] = v;
  };
  p.stick = 3.4;
  p.headR = 7;
  p.scale = 1;
  p.detailScale = NaN;
  p.core = null;
  p.gentle = false;
  p.face = 0.7 * f;
  if (pose === 0) {
    // Clinging: crouched to the wall behind, hands up on the stone, feet braced.
    const wall = -f * 11;
    at("headX", f * 1); at("headY", -18);
    at("neckX", 0); at("neckY", -11);
    at("shoulderX", 0); at("shoulderY", -8);
    at("hipX", -f * 2); at("hipY", 7);
    at("handAX", wall); at("handAY", -20);
    at("handBX", wall); at("handBY", -1);
    at("footAX", wall); at("footAY", 23);
    at("footBX", f * 5); at("footBY", 23);
    p.moveX = 0; p.moveY = 1; p.speed = 0.15;
  } else if (pose === 1) {
    // Leaping: stretched up along the arc, the leading arm reaching, the legs trailing.
    at("headX", f * 5); at("headY", -18);
    at("neckX", f * 3); at("neckY", -11);
    at("shoulderX", f * 3); at("shoulderY", -8);
    at("hipX", -f * 2); at("hipY", 7);
    at("handAX", f * 11); at("handAY", -22);
    at("handBX", -f * 9); at("handBY", -3);
    at("footAX", -f * 8); at("footAY", 23);
    at("footBX", f * 2); at("footBY", 21);
    p.moveX = f; p.moveY = -1; p.speed = 0.3;
  } else if (pose === 2) {
    // The double jump: tucked into a ball (turned by the caller).
    at("headX", f * 2); at("headY", -10);
    at("neckX", 0); at("neckY", -4);
    at("shoulderX", 0); at("shoulderY", -2);
    at("hipX", 0); at("hipY", 7);
    at("handAX", f * 8); at("handAY", 4);
    at("handBX", -f * 7); at("handBY", 5);
    at("footAX", f * 6); at("footAY", 12);
    at("footBX", -f * 4); at("footBY", 13);
    p.moveX = 0; p.moveY = 0; p.speed = 0;
  } else {
    // Stunned: upright, arms dropped wide, swaying.
    const sway = Math.sin(tick / 5) * 2;
    at("headX", sway); at("headY", -18);
    at("neckX", sway * 0.6); at("neckY", -11);
    at("shoulderX", sway * 0.6); at("shoulderY", -8);
    at("hipX", 0); at("hipY", 7);
    at("handAX", -11); at("handAY", 3);
    at("handBX", 11); at("handBY", 3);
    at("footAX", -6); at("footAY", 24);
    at("footBX", 6); at("footBY", 24);
    p.moveX = 0; p.moveY = 0; p.speed = 0;
  }
}

export function drawNinja(ctx: CanvasRenderingContext2D, x: number, y: number, pose: number, face: number, tick: number, spin = 0, scale = 1): void {
  const p = ninjaPoseMemo;
  setPose(p, pose, face, tick);
  ctx.save();
  ctx.translate(x, y);
  if (scale !== 1) ctx.scale(scale, scale);
  const f = face;
  // A soft moonlit glow behind the figure (inside its body box), so it reads on the night sky.
  ctx.fillStyle = "rgba(170,190,255,0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 0, NINJA_HW + 1, NINJA_HH + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  if (pose === 2) ctx.rotate(spin * face);
  // The katana on the back, behind the hero: a dark scabbard and a gold-wrapped hilt over the far shoulder.
  ctx.save();
  ctx.translate(p.neckX - f * 5, p.neckY + 2);
  ctx.rotate(f * 0.5);
  ctx.fillStyle = "#3B2A4A";
  ctx.fillRect(-1.8, -1, 3.6, 13);
  ctx.strokeStyle = "#0A0B12";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-1.8, -1, 3.6, 13);
  ctx.fillStyle = NINJA_GOLD;
  ctx.fillRect(-3, -2.4, 6, 1.8);
  // The hilt over the shoulder: red wrap with a steel pommel.
  ctx.fillStyle = NINJA_RED;
  ctx.fillRect(-1.4, -10.5, 2.8, 8);
  ctx.fillStyle = "#0A0B12";
  for (let k = 0; k < 3; k++) ctx.fillRect(-1.4, -9.5 + k * 2.6, 2.8, 0.7);
  ctx.fillStyle = STEEL;
  ctx.fillRect(-1.8, -12, 3.6, 1.6);
  ctx.restore();
  // The ninja wrap round the head: a dark hood larger than the head, peaked behind, with the face left open.
  ctx.fillStyle = NINJA_WRAP;
  ctx.beginPath();
  ctx.arc(p.headX, p.headY, p.headR + 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(p.headX - f * (p.headR + 1), p.headY - 3);
  ctx.lineTo(p.headX - f * (p.headR + 5), p.headY + 5);
  ctx.lineTo(p.headX - f * 1, p.headY + p.headR + 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = NINJA_WRAP_EDGE;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(p.headX, p.headY, p.headR + 2.6, 0, Math.PI * 2);
  ctx.stroke();
  // The hero itself (cape, limbs, bolt, gloves and boots, head with its face).
  drawHero(ctx, p);
  // The red sash at the waist, its knot's ends trailing.
  const tx = p.hipX - p.neckX;
  const ty = p.hipY - p.neckY;
  const sx = p.neckX + tx * 0.82;
  const sy = p.neckY + ty * 0.82;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(Math.atan2(ty, tx) - Math.PI / 2);
  ctx.fillStyle = NINJA_RED;
  ctx.fillRect(-5.2, -1.6, 10.4, 3.4);
  ctx.beginPath();
  ctx.moveTo(-f * 4, 1.5);
  ctx.lineTo(-f * 8, 6 + Math.sin(tick / 4));
  ctx.lineTo(-f * 5.5, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // The red headband across the brow (over the wrap, above the gold mask band), its two tails streaming behind.
  ctx.save();
  ctx.translate(p.headX, p.headY);
  ctx.fillStyle = NINJA_RED;
  ctx.fillRect(-p.headR - 1.6, -p.headR * 0.78, (p.headR + 1.6) * 2, 2.6);
  const flap = Math.sin(tick / 3) * 1.6;
  const back = -f * (p.headR + 1);
  ctx.beginPath();
  ctx.moveTo(back, -p.headR * 0.7);
  ctx.lineTo(back - f * 6, -p.headR * 0.7 - 2 + flap);
  ctx.lineTo(back - f * 5.5, -p.headR * 0.7 + 1 + flap);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(back, -p.headR * 0.55);
  ctx.lineTo(back - f * 5, -p.headR * 0.4 + 2 - flap);
  ctx.lineTo(back - f * 4, -p.headR * 0.3 + 3 - flap);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/* ================================ The frame ================================ */

/** The HUD: "Height N m" top left, the items top right. */
function drawHud(ctx: CanvasRenderingContext2D, s: NinjaState): void {
  const chip = (x: number, w: number) => {
    ctx.fillStyle = "rgba(6,8,18,0.62)";
    ctx.beginPath();
    ctx.roundRect(x, 10, w, 26, 8);
    ctx.fill();
  };
  const m = ninjaMetres(s);
  chip(10, 128);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `700 11px ${MONO}`;
  ctx.fillStyle = "#BFC4DA";
  ctx.fillText("HEIGHT", 18, 23);
  ctx.font = `800 15px ${ARCADE_FX_DISPLAY_FONT}`;
  ctx.fillStyle = m >= NINJA_CORE_FULL_M ? NINJA_GOLD : "#F5F5F7";
  ctx.fillText(`${m} m`, 70, 23.5);
  // Coins, lanterns and scrolls.
  chip(NINJA_WORLD_W - 150, 140);
  const base = NINJA_WORLD_W - 140;
  drawCoin(ctx, base + 6, 23, 0);
  drawLantern(ctx, base + 52, 23, 0);
  drawScroll(ctx, base + 100, 23, 0);
  ctx.font = `700 12px ${MONO}`;
  ctx.fillStyle = "#F5F5F7";
  ctx.fillText(String(s.coins), base + 16, 24);
  ctx.fillText(String(s.lanterns), base + 66, 24);
  ctx.fillText(String(s.scrolls), base + 113, 24);
}

/** Where the ninja is drawn this frame (world px): the sim's own x and height. */
export function ninjaDrawPoint(s: NinjaState): { x: number; y: number } {
  return { x: s.x, y: ninjaScreenY(ninjaCamera(s), s.y >> 8) };
}

export function drawNinjaWorld(ctx: CanvasRenderingContext2D, s: NinjaState): void {
  const W = NINJA_WORLD_W;
  const H = NINJA_WORLD_H;
  const cam = ninjaCamera(s);
  const t = s.tick;
  deviceLayer(ctx, "ninja-sky", paintSky);
  drawWall(ctx, 0, cam);
  drawWall(ctx, 1, cam);
  drawFloor(ctx, cam);
  const lo = cam - (H - EYE) - 40;
  const hi = cam + EYE + 40;
  const tower = s.tower;
  for (const p of tower.patches) {
    if (p.hi < lo) continue;
    if (p.lo > hi) break;
    drawPatch(ctx, p.wall, p.kind, ninjaScreenY(cam, p.hi), ninjaScreenY(cam, p.lo), t);
  }
  // Each shuriken's seeded path, faint and dotted, under everything else in the gap.
  for (const sh of tower.shurikens) {
    if (Math.max(sh.y0, sh.y0 + sh.dy) < lo) continue;
    if (Math.min(sh.y0, sh.y0 + sh.dy) > hi) break;
    drawShurikenPath(ctx, SHURIKEN_X0, ninjaScreenY(cam, sh.y0), SHURIKEN_X1, ninjaScreenY(cam, sh.y0 + sh.dy));
  }
  for (const k of tower.katanas) {
    if (k.y < lo) continue;
    if (k.y > hi) break;
    drawKatana(ctx, k.wall, ninjaScreenY(cam, k.y), t, k.y);
  }
  tower.lanterns.forEach((l, i) => {
    if (s.gotLanterns[i]) return;
    const p = lanternAt(l, t);
    if (p.y < lo || p.y > hi) return;
    drawLantern(ctx, p.x, ninjaScreenY(cam, p.y), t);
  });
  tower.coins.forEach((c, i) => {
    if (s.gotCoins[i] || c.y < lo || c.y > hi) return;
    drawCoin(ctx, c.x, ninjaScreenY(cam, c.y), t);
  });
  tower.scrolls.forEach((c, i) => {
    if (s.gotScrolls[i] || c.y < lo || c.y > hi) return;
    drawScroll(ctx, c.x, ninjaScreenY(cam, c.y), t);
  });
  for (const sh of tower.shurikens) {
    if (Math.max(sh.y0, sh.y0 + sh.dy) < lo) continue;
    if (Math.min(sh.y0, sh.y0 + sh.dy) > hi) break;
    const p = shurikenAt(sh, t);
    drawShuriken(ctx, p.x, ninjaScreenY(cam, p.y), t);
  }
  // The ninja: blinking while stunned or in its grace.
  const at = ninjaDrawPoint(s);
  const blink = s.safe > 0 && s.mode !== MODE_STUN && Math.trunc(t / 4) % 2 === 0;
  const face = s.mode === MODE_FLIGHT ? (s.wall === 1 ? 1 : -1) : s.wall === 0 ? 1 : -1;
  const pose = s.mode === MODE_STUN ? 3 : s.mode === MODE_FLIGHT ? (s.dj && s.hang > 0 ? 2 : 1) : 0;
  if (blink) ctx.globalAlpha = 0.4;
  drawNinja(ctx, at.x, at.y, pose, face, t, s.dj ? ((NINJA_HANG - s.hang) / NINJA_HANG) * Math.PI * 2 : 0);
  ctx.globalAlpha = 1;
  if (s.mode === MODE_STUN) {
    // Stars round the head.
    ctx.fillStyle = NINJA_GOLD;
    for (let i = 0; i < 3; i++) {
      const a = t / 6 + (i * Math.PI * 2) / 3;
      ctx.fillRect(at.x + Math.cos(a) * 11 - 1.5, at.y - NINJA_HH - 2 + Math.sin(a) * 3 - 1.5, 3, 3);
    }
  }
  // A red wash on a hit.
  if (t - s.hitTick < 12) {
    ctx.fillStyle = `rgba(224,40,58,${0.22 * (1 - (t - s.hitTick) / 12)})`;
    ctx.fillRect(0, 0, W, H);
  }
  drawHud(ctx, s);
}

/** The shared success layer: coins, lanterns and scrolls taken, every 50 m, and the core's full height. */
export const NINJA_FX: ArcadeFxSpec<NinjaState> = {
  game: "ricochet",
  world: "realworld",
  width: NINJA_WORLD_W,
  height: NINJA_WORLD_H,
  shake: true,
  textInset: 40,
  events: [
    { kind: "pop", count: (s) => s.coins, at: (s) => ninjaDrawPoint(s), label: () => "+COIN" },
    { kind: "combo", count: (s) => s.lanterns, at: (s) => ninjaDrawPoint(s), label: () => "LANTERN!", colour: () => NINJA_GOLD },
    { kind: "perfect", count: (s) => s.scrolls, at: (s) => ninjaDrawPoint(s), label: () => "SCROLL!", colour: () => "#FFF3C9" },
    { kind: "streak", count: (s) => ninjaMetres(s), every: 50, min: 50, label: (_s, n) => `${Math.floor(n / 50) * 50} m` },
    { kind: "final", count: (s) => (ninjaMetres(s) >= NINJA_CORE_FULL_M ? 1 : 0), label: () => "FULL HEIGHT!" },
  ],
  misses: [{ count: (s) => s.hits, at: (s) => ninjaDrawPoint(s) }],
};

export function drawNinjaFrame(ctx: CanvasRenderingContext2D, state: NinjaState, size: CanvasSize): void {
  arcadeFx(ctx, NINJA_FX, state, () => {
    ctx.save();
    ctx.scale(size.width / NINJA_WORLD_W, size.height / NINJA_WORLD_H);
    drawNinjaWorld(ctx, state);
    ctx.restore();
  }, size);
}

/** The game with its art (the stage, the reveal's frame and the replay player draw through it). */
export const ninjaArtGame = { ...ninjaGame, draw: drawNinjaFrame };

/** The metres to px factor, for the reveal. */
export const NINJA_M = NINJA_PX_PER_M;
