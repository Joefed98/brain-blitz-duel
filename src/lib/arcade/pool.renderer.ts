/**
 * Speed Pool's art (display only; never imported by the sim or the server): a full-width table under three overhead
 * lamps, walnut rails with grain and mother-of-pearl sights, chrome-capped corner pockets with angled jaws and
 * half-round middle pockets with a chrome plate, the baulk line (no D), a blue chalk cube on the rail; spots 1–7 and
 * stripes 9–15 in their standard colours with numbers, the black and the cue ball, each shaded with a lamp's highlight.
 *
 * The table (everything that never moves) is painted once per canvas scale to an offscreen layer and blitted; ball
 * faces are cached per id and scale. The aim preview (the line to the ghost ball, the object ball's line and the cue
 * ball's path) is a cheap geometric guess for the player, never the sim.
 */
import type { ArenaSceneView } from "./arenaScene.renderer";
import { artHash } from "./art.renderer";
import {
  poolSecondsLeft,
  poolSpinOf,
  POOL_BALL_R,
  POOL_BAULK_Y,
  POOL_BLACK,
  POOL_CB,
  POOL_CL,
  POOL_CR,
  POOL_CT,
  POOL_CUE,
  POOL_H,
  POOL_JAWS,
  POOL_MID_Y,
  POOL_POCKETS,
  POOL_RAIL,
  POOL_SPOTS,
  POOL_W,
  type PoolBall,
  type PoolState,
} from "./pool";

export const POOL_BG = "#07070A";
const CLOTH = "#1F6B45";
const CLOTH_DEEP = "#0F3F28";
const FONT = "'Archivo', system-ui, sans-serif";

/** Standard ball colours, 1–7 (9–15 repeat them on stripes); 8 is the black. */
export const POOL_BALL_COLOURS: Record<number, string> = {
  1: "#F2C230",
  2: "#1F4FBF",
  3: "#D22B2B",
  4: "#5B2A86",
  5: "#E8752A",
  6: "#1E7A3E",
  7: "#7A1F2A",
  8: "#111114",
};
export const poolBallColour = (id: number): string => (id === POOL_CUE ? "#F4F1E8" : POOL_BALL_COLOURS[id > 8 ? id - 8 : id] ?? "#888");

/** What the player is lining up (display only). */
export interface PoolAim {
  dx: number;
  dy: number;
  /** 0…1, the pull on the panel. */
  power: number;
  /** The spin code (0…24). */
  spin: number;
}

const px = (u: number) => u / 256;
const R = POOL_BALL_R;

/* ============================== Cached layers ============================== */

function offscreen(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

let tableCache: { scale: number; canvas: HTMLCanvasElement } | null = null;
const ballCache = new Map<string, HTMLCanvasElement>();

/** The device pixels per world px the context draws at. */
function scaleOf(ctx: CanvasRenderingContext2D): number {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  return t ? Math.max(0.5, Math.min(4, Math.hypot(t.a, t.b))) : 1;
}

function paintTable(ctx: CanvasRenderingContext2D): void {
  const rl = POOL_CL - POOL_RAIL;
  const rr = POOL_CR + POOL_RAIL;
  const rt = POOL_CT - POOL_RAIL;
  const rb = POOL_CB + POOL_RAIL;
  // Shadow under the table.
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, rl - 3, rt + 4, rr - rl + 6, rb - rt + 4, 18);
  ctx.fill();
  // Walnut rails: a warm gradient, then fine grain lines.
  const wood = ctx.createLinearGradient(rl, 0, rr, 0);
  wood.addColorStop(0, "#3A1E0F");
  wood.addColorStop(0.5, "#5A3019");
  wood.addColorStop(1, "#3A1E0F");
  ctx.fillStyle = wood;
  roundRect(ctx, rl, rt, rr - rl, rb - rt, 16);
  ctx.fill();
  ctx.save();
  roundRect(ctx, rl, rt, rr - rl, rb - rt, 16);
  ctx.clip();
  // Grain runs along each rail: across the ends, down the long sides.
  const grain = (x0: number, y0: number, x1: number, y1: number, along: "x" | "y", salt: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    for (let i = 0; i < 26; i++) {
      const h = artHash(i, salt);
      ctx.strokeStyle = `rgba(${h % 3 ? "24,10,3" : "130,78,42"},${0.1 + ((h >> 4) % 10) / 110})`;
      ctx.lineWidth = 0.5 + ((h >> 8) % 3) * 0.3;
      ctx.beginPath();
      const f = ((h >> 3) % 1000) / 1000;
      const wob = 1 + ((h >> 12) % 3);
      if (along === "x") {
        const y = y0 + f * (y1 - y0);
        ctx.moveTo(x0, y);
        ctx.bezierCurveTo(x0 + (x1 - x0) * 0.33, y + wob, x0 + (x1 - x0) * 0.66, y - wob, x1, y);
      } else {
        const x = x0 + f * (x1 - x0);
        ctx.moveTo(x, y0);
        ctx.bezierCurveTo(x + wob, y0 + (y1 - y0) * 0.33, x - wob, y0 + (y1 - y0) * 0.66, x, y1);
      }
      ctx.stroke();
    }
    ctx.restore();
  };
  grain(rl, rt, rr, POOL_CT, "x", 71);
  grain(rl, POOL_CB, rr, rb, "x", 72);
  grain(rl, POOL_CT, POOL_CL, POOL_CB, "y", 73);
  grain(POOL_CR, POOL_CT, rr, POOL_CB, "y", 74);
  // A lacquer sheen along the top of the rails.
  const sheen = ctx.createLinearGradient(0, rt, 0, rt + 18);
  sheen.addColorStop(0, "rgba(255,220,180,0.18)");
  sheen.addColorStop(1, "rgba(255,220,180,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(rl, rt, rr - rl, 18);
  ctx.restore();
  // The cushions' rubber nose (a slightly darker cloth band) and the bed.
  ctx.fillStyle = CLOTH_DEEP;
  ctx.fillRect(POOL_CL - 6, POOL_CT - 6, POOL_CR - POOL_CL + 12, POOL_CB - POOL_CT + 12);
  const bed = ctx.createLinearGradient(0, POOL_CT, 0, POOL_CB);
  bed.addColorStop(0, "#1A5E3C");
  bed.addColorStop(0.5, CLOTH);
  bed.addColorStop(1, "#1A5E3C");
  ctx.fillStyle = bed;
  ctx.fillRect(POOL_CL, POOL_CT, POOL_CR - POOL_CL, POOL_CB - POOL_CT);
  // Cloth nap: a faint weave.
  ctx.save();
  ctx.beginPath();
  ctx.rect(POOL_CL, POOL_CT, POOL_CR - POOL_CL, POOL_CB - POOL_CT);
  ctx.clip();
  for (let i = 0; i < 900; i++) {
    const h = artHash(i, 13);
    ctx.fillStyle = h % 2 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(POOL_CL + (h % (POOL_CR - POOL_CL)), POOL_CT + ((h >> 9) % (POOL_CB - POOL_CT)), 1.2, 1.2);
  }
  // Three overhead lamps' pools of light.
  for (const f of [0.2, 0.5, 0.8]) {
    const cy = POOL_CT + (POOL_CB - POOL_CT) * f;
    const cx = (POOL_CL + POOL_CR) / 2;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 190);
    g.addColorStop(0, "rgba(255,246,214,0.22)");
    g.addColorStop(0.55, "rgba(255,246,214,0.07)");
    g.addColorStop(1, "rgba(255,246,214,0)");
    ctx.fillStyle = g;
    ctx.fillRect(POOL_CL, cy - 200, POOL_CR - POOL_CL, 400);
  }
  // The table's edges fall into shade.
  const edge = ctx.createLinearGradient(POOL_CL, 0, POOL_CR, 0);
  edge.addColorStop(0, "rgba(0,0,0,0.28)");
  edge.addColorStop(0.12, "rgba(0,0,0,0)");
  edge.addColorStop(0.88, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = edge;
  ctx.fillRect(POOL_CL, POOL_CT, POOL_CR - POOL_CL, POOL_CB - POOL_CT);
  // The baulk line (no D).
  ctx.strokeStyle = "rgba(240,240,230,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(POOL_CL, POOL_BAULK_Y);
  ctx.lineTo(POOL_CR, POOL_BAULK_Y);
  ctx.stroke();
  // The black's spot.
  ctx.fillStyle = "rgba(240,240,230,0.35)";
  ctx.beginPath();
  ctx.arc((POOL_CL + POOL_CR) / 2, POOL_CT + (POOL_CB - POOL_CT) * 0.22, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Cushion lips: a light bevel on the cloth side.
  ctx.strokeStyle = "rgba(170,230,190,0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(POOL_CL + 0.5, POOL_CT + 0.5, POOL_CR - POOL_CL - 1, POOL_CB - POOL_CT - 1);
  // Pockets: corner pockets with chrome caps, middle pockets half-round with a chrome plate.
  for (const p of POOL_POCKETS) {
    const x = px(p.x);
    const y = px(p.y);
    const r = px(p.r);
    if (p.corner) {
      const sx = x < POOL_W / 2 ? -1 : 1;
      const sy = y < POOL_MID_Y ? -1 : 1;
      // Chrome cap round the outside of the corner (on the rails only, never over the cloth).
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, POOL_W, POOL_H);
      ctx.rect(POOL_CL - 6, POOL_CT - 6, POOL_CR - POOL_CL + 12, POOL_CB - POOL_CT + 12);
      ctx.clip("evenodd");
      const chrome = ctx.createLinearGradient(x - 22, y - 22, x + 22, y + 22);
      chrome.addColorStop(0, "#F4F6F8");
      chrome.addColorStop(0.45, "#8E959C");
      chrome.addColorStop(0.6, "#DADFE3");
      chrome.addColorStop(1, "#5F666C");
      ctx.fillStyle = chrome;
      ctx.beginPath();
      ctx.arc(x + sx * 2, y + sy * 2, r + 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      const sx = x < POOL_W / 2 ? -1 : 1;
      const chrome = ctx.createLinearGradient(x, y - 20, x, y + 20);
      chrome.addColorStop(0, "#5F666C");
      chrome.addColorStop(0.5, "#EEF1F3");
      chrome.addColorStop(1, "#5F666C");
      ctx.fillStyle = chrome;
      ctx.fillRect(x + sx * 2 - (sx > 0 ? 0 : 12), y - 21, 12, 42);
    }
    const hole = ctx.createRadialGradient(x, y, 1, x, y, r + 1);
    hole.addColorStop(0, "#000");
    hole.addColorStop(0.75, "#050505");
    hole.addColorStop(1, "#1A1A1A");
    ctx.fillStyle = hole;
    ctx.beginPath();
    if (p.corner) ctx.arc(x, y, r, 0, Math.PI * 2);
    else {
      const sx = x < POOL_W / 2 ? -1 : 1;
      ctx.arc(x, y, r, sx < 0 ? Math.PI / 2 : -Math.PI / 2, sx < 0 ? Math.PI * 1.5 : Math.PI / 2);
      ctx.lineTo(x, y - r);
    }
    ctx.fill();
  }
  // The jaws: the cushions' rubber noses angled into each pocket.
  ctx.strokeStyle = "#0B3321";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const j of POOL_JAWS) {
    ctx.beginPath();
    ctx.moveTo(px(j.ax), px(j.ay));
    ctx.lineTo(px(j.bx), px(j.by));
    ctx.stroke();
  }
  // Mother-of-pearl sights: three a side between pockets on the long rails, three on each end.
  const sight = (x: number, y: number) => {
    const g = ctx.createRadialGradient(x - 0.6, y - 0.6, 0.2, x, y, 3);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(0.5, "#E6E2F2");
    g.addColorStop(1, "#B7C7D2");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x + 2, y);
    ctx.lineTo(x, y + 3);
    ctx.lineTo(x - 2, y);
    ctx.closePath();
    ctx.fill();
  };
  const half = (POOL_CB - POOL_CT) / 2;
  for (const k of [1, 2, 3]) {
    for (const y of [POOL_CT + (half * k) / 4, POOL_MID_Y + (half * k) / 4]) {
      sight(POOL_CL - POOL_RAIL / 2 - 2, y);
      sight(POOL_CR + POOL_RAIL / 2 + 2, y);
    }
    const x = POOL_CL + ((POOL_CR - POOL_CL) * k) / 4;
    sight(x, POOL_CT - POOL_RAIL / 2 - 2);
    sight(x, POOL_CB + POOL_RAIL / 2 + 2);
  }
  // The blue chalk cube on the bottom-right rail.
  const cx = POOL_CR - 40;
  const cy = POOL_CB + POOL_RAIL / 2 + 1;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(cx - 4, cy - 2, 10, 9);
  ctx.fillStyle = "#2E6FD8";
  ctx.fillRect(cx - 5, cy - 5, 10, 10);
  ctx.fillStyle = "#5C95F0";
  ctx.fillRect(cx - 5, cy - 5, 10, 3);
  ctx.fillStyle = "#1B4FA6";
  ctx.fillRect(cx - 2, cy - 2, 4, 4);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTable(ctx: CanvasRenderingContext2D): void {
  const scale = scaleOf(ctx);
  if (!tableCache || Math.abs(tableCache.scale - scale) > 0.01) {
    const c = offscreen(POOL_W * scale, POOL_H * scale);
    if (!c) {
      paintTable(ctx);
      return;
    }
    const cc = c.getContext("2d")!;
    cc.scale(scale, scale);
    paintTable(cc);
    tableCache = { scale, canvas: c };
  }
  ctx.drawImage(tableCache.canvas, 0, 0, POOL_W, POOL_H);
}

/* ================================= Balls ================================= */

function paintBall(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, r: number): void {
  const colour = poolBallColour(id);
  const stripe = id >= 9;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = stripe ? "#F4F1E8" : colour;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (stripe) {
    ctx.fillStyle = colour;
    ctx.fillRect(x - r, y - r * 0.55, r * 2, r * 1.1);
  }
  // Number disc.
  if (id !== POOL_CUE) {
    ctx.fillStyle = "#F7F5EE";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.font = `800 ${Math.max(4, r * 0.66)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(id), x, y + r * 0.04);
  }
  // Shading from the lamp above: a soft dark rim and a sharp highlight.
  const shade = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  shade.addColorStop(0, "rgba(255,255,255,0.32)");
  shade.addColorStop(0.35, "rgba(255,255,255,0.04)");
  shade.addColorStop(0.8, "rgba(0,0,0,0.18)");
  shade.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.2, r * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, r = R): void {
  // Contact shadow.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + 1.6, y + 2.2, r * 1.02, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  const scale = scaleOf(ctx);
  const key = `${id}:${r}:${scale.toFixed(2)}`;
  let sprite = ballCache.get(key);
  if (!sprite) {
    const size = (r * 2 + 2) * scale;
    const c = offscreen(size, size);
    if (!c) {
      paintBall(ctx, id, x, y, r);
      return;
    }
    const cc = c.getContext("2d")!;
    cc.scale(scale, scale);
    paintBall(cc, id, r + 1, r + 1, r);
    if (ballCache.size > 200) ballCache.clear();
    ballCache.set(key, c);
    sprite = c;
  }
  ctx.drawImage(sprite, x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2);
}

/* ================================ Aim ================================ */

/** Where the aim's line first meets a ball (ghost ball centre) or a cushion. Geometry only. */
function aimHit(balls: readonly PoolBall[], cx: number, cy: number, ux: number, uy: number): { x: number; y: number; ball: PoolBall | null } {
  let best = Infinity;
  let ball: PoolBall | null = null;
  const D = 2 * R;
  for (const b of balls) {
    if (b.down || b.id === POOL_CUE) continue;
    const bx = px(b.x) - cx;
    const by = px(b.y) - cy;
    const along = bx * ux + by * uy;
    if (along <= 0) continue;
    const perp2 = bx * bx + by * by - along * along;
    if (perp2 > D * D) continue;
    const t = along - Math.sqrt(D * D - perp2);
    if (t < best) {
      best = t;
      ball = b;
    }
  }
  // The cushion line the cue ball's centre would meet.
  const tx = ux > 0 ? (POOL_CR - R - cx) / ux : ux < 0 ? (POOL_CL + R - cx) / ux : Infinity;
  const ty = uy > 0 ? (POOL_CB - R - cy) / uy : uy < 0 ? (POOL_CT + R - cy) / uy : Infinity;
  const wall = Math.min(tx, ty);
  if (wall < best) return { x: cx + ux * wall, y: cy + uy * wall, ball: null };
  return { x: cx + ux * best, y: cy + uy * best, ball };
}

function drawAim(ctx: CanvasRenderingContext2D, s: PoolState, aim: PoolAim): void {
  const cue = s.balls.find((b) => b.id === POOL_CUE && !b.down);
  if (!cue) return;
  const l = Math.hypot(aim.dx, aim.dy);
  if (l < 1e-6) return;
  const ux = aim.dx / l;
  const uy = aim.dy / l;
  const cx = px(cue.x);
  const cy = px(cue.y);
  const hit = aimHit(s.balls, cx, cy, ux, uy);
  ctx.save();
  ctx.lineCap = "round";
  // The dotted line to the ghost ball.
  ctx.setLineDash([2, 5]);
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx + ux * (R + 2), cy + uy * (R + 2));
  ctx.lineTo(hit.x, hit.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(hit.x, hit.y, R, 0, Math.PI * 2);
  ctx.stroke();
  const reach = 30 + 70 * Math.max(0.2, aim.power);
  if (hit.ball) {
    const bx = px(hit.ball.x);
    const by = px(hit.ball.y);
    const nx = (bx - hit.x) / (2 * R);
    const ny = (by - hit.y) / (2 * R);
    // The object ball's line (along the line of centres), short.
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx + nx * R, by + ny * R);
    ctx.lineTo(bx + nx * (R + reach * 0.6), by + ny * (R + reach * 0.6));
    ctx.stroke();
    // The cue ball's path: the tangent line, bent by follow or draw.
    const dot = ux * nx + uy * ny;
    let tx = ux - dot * nx;
    let ty = uy - dot * ny;
    const tb = poolSpinOf(aim.spin).topBack;
    tx += (tb * 0.2) * ux;
    ty += (tb * 0.2) * uy;
    const tl = Math.hypot(tx, ty);
    if (tl > 0.02) {
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(hit.x, hit.y);
      ctx.lineTo(hit.x + (tx / tl) * reach * 0.5, hit.y + (ty / tl) * reach * 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else {
    // Off the cushion: a faint reflected line.
    const vertical = Math.abs(hit.x - (POOL_CL + R)) < 0.5 || Math.abs(hit.x - (POOL_CR - R)) < 0.5;
    const rx = vertical ? -ux : ux;
    const ry = vertical ? uy : -uy;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(hit.x, hit.y);
    ctx.lineTo(hit.x + rx * reach * 0.5, hit.y + ry * reach * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/* ================================= HUD ================================= */

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, tone: "plain" | "gold" | "red" = "plain"): void {
  ctx.fillStyle = tone === "red" ? "rgba(120,20,24,0.85)" : "rgba(14,14,18,0.82)";
  roundRect(ctx, x, y, w, 20, 10);
  ctx.fill();
  ctx.strokeStyle = tone === "gold" ? "rgba(242,199,92,0.8)" : tone === "red" ? "rgba(255,120,120,0.6)" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = tone === "gold" ? "#F2C75C" : "#F3F1EC";
  ctx.font = `700 10.5px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + 10.5);
}

function drawHud(ctx: CanvasRenderingContext2D, s: PoolState): void {
  const y = 6;
  // The rack: seven spots, lit once potted.
  ctx.fillStyle = "rgba(14,14,18,0.82)";
  roundRect(ctx, 8, y, 7 * 15 + 10, 20, 10);
  ctx.fill();
  for (let id = 1; id <= POOL_SPOTS; id++) {
    const down = s.balls.find((b) => b.id === id)?.down === 1;
    ctx.globalAlpha = down ? 1 : 0.28;
    drawBall(ctx, id, 8 + 5 + 7.5 + (id - 1) * 15, y + 10, 5.5);
    ctx.globalAlpha = 1;
  }
  let x = 8 + 7 * 15 + 16;
  const allDown = s.spotsDown >= POOL_SPOTS;
  if (allDown && s.black === 0) {
    chip(ctx, x, y, 64, "THE BLACK", "gold");
    x += 70;
  }
  if (s.streak >= 2) {
    chip(ctx, x, y, 76, `${s.streak} IN A ROW`, "gold");
    x += 82;
  }
  if (s.fouls > 0) {
    chip(ctx, x, y, 62, `FOULS ${s.fouls}`, s.tick - s.foulTick < 60 ? "red" : "plain");
    x += 68;
  }
  if (s.scratches > 0 && s.tick - s.scratchTick < 120) chip(ctx, POOL_W - 70, y, 62, "−5 S", "red");
  void poolSecondsLeft;
}

/* ================================ Public ================================ */

/** The table, the balls, the aim preview (while aiming) and the HUD chips, in world px. */
export function drawPool(ctx: CanvasRenderingContext2D, s: PoolState, aim: PoolAim | null): void {
  ctx.fillStyle = POOL_BG;
  ctx.fillRect(0, 0, POOL_W, POOL_H);
  drawTable(ctx);
  // A pot lights its pocket briefly.
  if (s.potTick > 0 && s.tick - s.potTick < 24) {
    const a = 1 - (s.tick - s.potTick) / 24;
    for (const p of POOL_POCKETS) {
      const near = s.balls.some((b) => b.down && b.id !== POOL_CUE && Math.hypot(b.x - p.x, b.y - p.y) < p.r * 1.2);
      if (!near) continue;
      const g = ctx.createRadialGradient(px(p.x), px(p.y), 2, px(p.x), px(p.y), 30);
      g.addColorStop(0, `rgba(255,236,170,${0.55 * a})`);
      g.addColorStop(1, "rgba(255,236,170,0)");
      ctx.fillStyle = g;
      ctx.fillRect(px(p.x) - 30, px(p.y) - 30, 60, 60);
    }
  }
  for (const b of s.balls) if (!b.down && b.id !== POOL_CUE) drawBall(ctx, b.id, px(b.x), px(b.y));
  const cue = s.balls.find((b) => b.id === POOL_CUE && !b.down);
  if (aim && s.phase === 0 && !s.over) drawAim(ctx, s, aim);
  if (cue) drawBall(ctx, POOL_CUE, px(cue.x), px(cue.y));
  drawHud(ctx, s);
  void POOL_BLACK;
}

/** The room round the table on the play screen: a dark floor under the lamps' spill (display only). */
export function poolScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const w = view.right - view.left;
  const h = view.bottom - view.top;
  ctx.fillStyle = "#0A0807";
  ctx.fillRect(view.left, view.top, w, h);
  const cx = POOL_W / 2;
  const cy = POOL_H / 2;
  const g = ctx.createRadialGradient(cx, cy, 80, cx, cy, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(70,48,30,0.55)");
  g.addColorStop(0.6, "rgba(30,20,14,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(view.left, view.top, w, h);
  // Floorboards, faint.
  ctx.strokeStyle = "rgba(255,220,180,0.04)";
  ctx.lineWidth = 1;
  for (let x = Math.floor(view.left / 26) * 26; x < view.right; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, view.top);
    ctx.lineTo(x, view.bottom);
    ctx.stroke();
  }
}

/** The zones' colours, left (full power) to right (soft). */
const ZONES = ["#D8322E", "#E8692A", "#EFA52C", "#E9D23A", "#8FC93E", "#3FB25A"];

/**
 * The power panel (CSS px, its own canvas): coloured zones from red (left, full power) to green (right, soft) with
 * tick marks, and the cue lying along it. `pull` (0…1) slides the cue left; every zone its tip has passed lights up.
 */
export function drawPoolPowerPanel(ctx: CanvasRenderingContext2D, w: number, h: number, pull: number, spin: number): void {
  ctx.clearRect(0, 0, w, h);
  const pad = 8;
  const top = h * 0.22;
  const bh = h * 0.56;
  ctx.fillStyle = "rgba(14,14,18,0.9)";
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();
  const zw = (w - pad * 2) / ZONES.length;
  const tip = pad + (w - pad * 2) * (1 - Math.max(0, Math.min(1, pull)));
  ZONES.forEach((c, i) => {
    const x = pad + i * zw;
    const lit = x + zw > tip + 0.5;
    ctx.globalAlpha = lit ? 0.95 : 0.22;
    ctx.fillStyle = c;
    ctx.fillRect(x + 1, top, zw - 2, bh);
    ctx.globalAlpha = 1;
  });
  // Tick marks every tenth.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const x = pad + ((w - pad * 2) * i) / 10;
    ctx.beginPath();
    ctx.moveTo(x, top - 4);
    ctx.lineTo(x, top + (i % 5 === 0 ? 4 : 1));
    ctx.stroke();
  }
  // The cue: ferrule and tip on the right end, a maple shaft into a dark butt off the left.
  const cy = top + bh / 2;
  const len = w * 0.95;
  const butt = tip - len;
  const shaft = ctx.createLinearGradient(butt, 0, tip, 0);
  shaft.addColorStop(0, "#1A0F08");
  shaft.addColorStop(0.42, "#3B2212");
  shaft.addColorStop(0.43, "#E9D7B4");
  shaft.addColorStop(1, "#F3E7CF");
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.moveTo(butt, cy - 4);
  ctx.lineTo(tip, cy - 1.5);
  ctx.lineTo(tip, cy + 3.5);
  ctx.lineTo(butt, cy + 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(butt, cy - 5.5);
  ctx.lineTo(tip - 6, cy - 2.2);
  ctx.lineTo(tip - 6, cy + 2.2);
  ctx.lineTo(butt, cy + 5.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#F8F8F6";
  ctx.fillRect(tip - 6, cy - 2.2, 4, 4.4);
  ctx.fillStyle = "#2E6FD8";
  ctx.fillRect(tip - 2, cy - 2, 2, 4);
  // A thin highlight down the shaft.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(butt + len * 0.45, cy - 2.2);
  ctx.lineTo(tip - 6, cy - 1.1);
  ctx.stroke();
  void spin;
}
