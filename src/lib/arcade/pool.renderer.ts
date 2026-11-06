/**
 * Cue Ball's art (`pool`; display only; never imported by the sim or the server): a full-width table under three overhead
 * lamps, walnut rails with grain and mother-of-pearl sights, chrome-capped corner pockets with angled jaws and
 * half-round middle pockets with a chrome plate, the baulk line (no D), a blue chalk cube on the rail; spots 1–7 and
 * stripes 9–15 in their standard colours with numbers, the black and the cue ball, each shaded with a lamp's highlight.
 *
 * The table (everything that never moves) is painted once per canvas scale to an offscreen layer and blitted; ball
 * faces are cached per id and scale. The aim preview (the line to the ghost ball, the object ball's line and the cue
 * ball's path) is a cheap geometric guess for the player, never the sim.
 *
 * poolRev 2 (31 Oct 2026): the cue lies behind the cue ball while aiming (drawn back by the pull), the power meter is a
 * framed bar of segmented bands green → yellow → orange → red with tick marks and the cue inside it, and a potted ball
 * rolls into the pocket's mouth and drops away (shrinking and darkening into the hole, from the sim's drop tick).
 */
import type { ArenaSceneView } from "./arenaScene.renderer";
import { artHash } from "./art.renderer";
import {
  poolSecondsLeft,
  poolSetName,
  poolShownId,
  POOL_SET_SPOTS,
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
  /** 0…1, the pull on the meter. */
  power: number;
  /** The spin dot: x side (right +), y top (+) or back (−), each −100…100. */
  spinX: number;
  spinY: number;
}

const px = (u: number) => u / 256;
const R = POOL_BALL_R;
/**
 * A table ball's drawn radius (3 Nov 2026, display only): 1.5 px over the sim's POOL_BALL_R, inside the bounds
 * rule's 2 px, so the balls read larger without moving any hitbox (no stamp; collisions are POOL_BALL_R).
 */
export const POOL_BALL_DRAW_R = POOL_BALL_R + 1.5;

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
  // 3 Nov 2026 (display only; Joe's audit): spots and stripes told apart at a glance, the set being the
  // game's rule since poolRev 4. A spot is the solid colour with a small white spot; a stripe the colour
  // with a broad, clean white band through its middle (the number sits in the band).
  ctx.fillStyle = id === POOL_CUE ? "#F4F1E8" : colour;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (stripe) {
    ctx.fillStyle = "#FBFAF5";
    ctx.fillRect(x - r, y - r * 0.36, r * 2, r * 0.72);
  }
  if (id !== POOL_CUE) {
    const spotR = stripe ? r * 0.3 : r * 0.36;
    if (!stripe) {
      ctx.fillStyle = "#FBFAF5";
      ctx.beginPath();
      ctx.arc(x, y, spotR, 0, Math.PI * 2);
      ctx.fill();
    }
    // The number only where it can be read (the HUD's small rack balls show the pattern alone).
    if (r >= 7) {
      ctx.fillStyle = "#111";
      ctx.font = `800 ${Math.max(4, r * (stripe ? 0.6 : 0.5))}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (numberTurn) {
        // Cue Ball's turned desktop table: the number turned back to read upright on screen.
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(numberTurn);
        ctx.fillText(String(id), r * 0.04, 0);
        ctx.restore();
      } else ctx.fillText(String(id), x, y + r * 0.04);
    }
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

function drawBall(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, r = POOL_BALL_DRAW_R): void {
  // Contact shadow.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + 1.6, y + 2.2, r * 1.02, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  drawBallSprite(ctx, id, x, y, r);
}

/** A ball's face at (x, y) and radius `drawR`, from the sprite cached at radius `r` (no shadow). */
function drawBallSprite(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, drawR: number, r = drawR): void {
  const k = drawR / r;
  const scale = scaleOf(ctx);
  const key = `${id}:${r}:${scale.toFixed(2)}`;
  let sprite = ballCache.get(key);
  if (!sprite) {
    const size = (r * 2 + 2) * scale;
    const c = offscreen(size, size);
    if (!c) {
      paintBall(ctx, id, x, y, drawR);
      return;
    }
    const cc = c.getContext("2d")!;
    cc.scale(scale, scale);
    paintBall(cc, id, r + 1, r + 1, r);
    if (ballCache.size > 200) ballCache.clear();
    ballCache.set(key, c);
    sprite = c;
  }
  const h = (r + 1) * k;
  ctx.drawImage(sprite, x - h, y - h, h * 2, h * 2);
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
    // poolRev 3's follow and draw are 1.75× poolRev 2's, so its preview bends 1.75× as far.
    const tb = (aim.spinY / 50) * (s.rev >= 3 ? 1.75 : 1);
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

/* ================================ The cue ================================ */

/** The cue's length (world px) and how far back a full pull draws it from the ball. */
const CUE_LEN = 300;
const CUE_PULL = 46;

/**
 * The cue stick behind the cue ball, along the aim (ux, uy) and drawn back by the pull: the blue chalked tip, a white
 * ferrule, the maple shaft, a gold joint ring and the dark wrapped butt, over its own soft shadow on the cloth.
 */
function drawCueStick(ctx: CanvasRenderingContext2D, cx: number, cy: number, ux: number, uy: number, pull: number): void {
  const gap = R + 3 + CUE_PULL * Math.max(0, Math.min(1, pull));
  const tipX = cx - ux * gap;
  const tipY = cy - uy * gap;
  const angle = Math.atan2(-uy, -ux);
  ctx.save();
  // The shadow, offset away from the lamps.
  ctx.save();
  ctx.translate(tipX + 3, tipY + 4);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.moveTo(0, -1.8);
  ctx.lineTo(CUE_LEN, -4.6);
  ctx.lineTo(CUE_LEN, 4.6);
  ctx.lineTo(0, 1.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.translate(tipX, tipY);
  ctx.rotate(angle);
  // Butt (dark wood with a wrap), joint ring, maple shaft, ferrule and tip; x runs from the tip back.
  const half = (x: number) => 1.8 + (2.8 * x) / CUE_LEN;
  const body = (x0: number, x1: number, fill: string | CanvasGradient) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x0, -half(x0));
    ctx.lineTo(x1, -half(x1));
    ctx.lineTo(x1, half(x1));
    ctx.lineTo(x0, half(x0));
    ctx.closePath();
    ctx.fill();
  };
  const maple = ctx.createLinearGradient(0, -3, 0, 3);
  maple.addColorStop(0, "#F7EBD2");
  maple.addColorStop(0.5, "#E6D1A8");
  maple.addColorStop(1, "#BFA67A");
  body(4, CUE_LEN * 0.55, maple);
  body(CUE_LEN * 0.55, CUE_LEN * 0.55 + 3, "#E3B341");
  const butt = ctx.createLinearGradient(0, -5, 0, 5);
  butt.addColorStop(0, "#5A2E16");
  butt.addColorStop(0.5, "#2B140A");
  butt.addColorStop(1, "#130905");
  body(CUE_LEN * 0.55 + 3, CUE_LEN * 0.78, butt);
  body(CUE_LEN * 0.78, CUE_LEN, "#16161A");
  // Wrap lines on the grip.
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 0.6;
  for (let x = CUE_LEN * 0.8; x < CUE_LEN - 4; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, -half(x));
    ctx.lineTo(x + 1.5, half(x));
    ctx.stroke();
  }
  // Ferrule and the chalked tip.
  body(1.2, 4, "#F8F8F6");
  body(0, 1.2, "#2E6FD8");
  // A highlight down the shaft.
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(6, -0.8);
  ctx.lineTo(CUE_LEN * 0.54, -1.9);
  ctx.stroke();
  ctx.restore();
}

/* ============================ Potted balls ============================ */

/** A potted ball's drop: this many ticks rolling into the mouth, shrinking and darkening into the hole. */
const DROP_TICKS = 18;
/** The roll into the mouth runs this much faster than the drop: the ball reaches the mouth at 1 / DROP_ROLL of it. */
const DROP_ROLL = 1.8;
/** The drop's tick (from the sim's `downAt`) the ball reaches the pocket's mouth: the pocket sound starts here. */
export const POOL_DROP_MOUTH_TICKS = Math.ceil(DROP_TICKS / DROP_ROLL);

/** The pocket a ball dropped into: the nearest one to where it went down. */
function pocketOf(b: PoolBall): { x: number; y: number; r: number } {
  let best = POOL_POCKETS[0]!;
  let bestD = Infinity;
  for (const p of POOL_POCKETS) {
    const d = (p.x - b.x) * (p.x - b.x) + (p.y - b.y) * (p.y - b.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return { x: px(best.x), y: px(best.y), r: px(best.r) };
}

/** Balls dropping (poolRev 2's drop tick): each rolls on into its pocket and sinks, drawn under the pocket's shade. */
function drawDropping(ctx: CanvasRenderingContext2D, s: PoolState): void {
  for (const b of s.balls) {
    if (!b.down || b.downAt === undefined) continue;
    const age = s.tick - b.downAt;
    if (age < 0 || age >= DROP_TICKS) continue;
    const t = age / DROP_TICKS;
    const p = pocketOf(b);
    const roll = Math.min(1, t * DROP_ROLL);
    const ease = 1 - (1 - roll) * (1 - roll);
    const x = px(b.x) + (p.x - px(b.x)) * ease;
    const y = px(b.y) + (p.y - px(b.y)) * ease;
    const r = POOL_BALL_DRAW_R * (1 - 0.55 * t);
    ctx.save();
    // Keep the sinking ball inside the hole once it reaches the mouth (it falls below the cloth, not over the rail).
    if (roll >= 1) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 1, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.globalAlpha = 1 - 0.35 * t;
    drawBallSprite(ctx, poolShownId(b.id, s.set ?? POOL_SET_SPOTS), x, y, r, POOL_BALL_DRAW_R);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(0,0,0,${(0.85 * t).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r + 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
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
  // The rack: the player's seven, lit once potted. poolRev 4 names the set (SPOTS or STRIPES) inside the pill, in gold.
  const set = s.set ?? POOL_SET_SPOTS;
  const named = s.rev >= 4;
  const label = poolSetName(set).toUpperCase();
  ctx.font = `800 9px ${FONT}`;
  const lw = named ? Math.ceil(ctx.measureText(label).width) + 10 : 0;
  ctx.fillStyle = "rgba(14,14,18,0.82)";
  roundRect(ctx, 8, y, 7 * 15 + 10 + lw, 20, 10);
  ctx.fill();
  if (named) {
    ctx.strokeStyle = "rgba(242,199,92,0.8)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#F2C75C";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 8 + 9, y + 10.5);
  }
  for (let id = 1; id <= POOL_SPOTS; id++) {
    const down = s.balls.find((b) => b.id === id)?.down === 1;
    ctx.globalAlpha = down ? 1 : 0.28;
    drawBall(ctx, poolShownId(id, set), 8 + lw + 5 + 7.5 + (id - 1) * 15, y + 10, 5.5);
    ctx.globalAlpha = 1;
  }
  let x = 8 + lw + 7 * 15 + 16;
  const allDown = s.spotsDown >= POOL_SPOTS;
  if (allDown && s.black === 0) {
    chip(ctx, x, y, 64, "THE BLACK", "gold");
    x += 70;
  }
  if (s.streak >= 2 && x + 76 <= POOL_W - 8) {
    chip(ctx, x, y, 76, `${s.streak} IN A ROW`, "gold");
    x += 82;
  }
  if (s.fouls > 0 && x + 62 <= POOL_W - 8) {
    chip(ctx, x, y, 62, `FOULS ${s.fouls}`, s.tick - s.foulTick < 60 ? "red" : "plain");
    x += 68;
  }
  if (s.scratches > 0 && s.tick - s.scratchTick < 120) chip(ctx, POOL_W - 70, y, 62, "−5 S", "red");
  void poolSecondsLeft;
}

/* ================================ Public ================================ */

/**
 * The desktop rotate mode (31 Oct 2026, display only): the table is drawn into a rotor turned a quarter turn
 * clockwise, so ball numbers are turned back by this (and the HUD chips drawn upright on their own strip,
 * drawPoolHud). 0 on every other screen.
 */
let numberTurn = 0;

/** The HUD chips alone, in world px, for the upright strip beside a turned table (ArcadeCanvasStage `hud`). */
export function drawPoolHud(ctx: CanvasRenderingContext2D, s: PoolState): void {
  drawHud(ctx, s);
}

/**
 * The table, the balls, the aim preview (while aiming) and the HUD chips, in world px. `turned` (the desktop
 * rotate mode): ball numbers drawn turned back to read upright, and no HUD chips (drawn upright on their strip).
 */
export function drawPool(ctx: CanvasRenderingContext2D, s: PoolState, aim: PoolAim | null, turned = false): void {
  numberTurn = turned ? -Math.PI / 2 : 0;
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
  drawDropping(ctx, s);
  const set = s.set ?? POOL_SET_SPOTS;
  for (const b of s.balls) if (!b.down && b.id !== POOL_CUE) drawBall(ctx, poolShownId(b.id, set), px(b.x), px(b.y));
  const cue = s.balls.find((b) => b.id === POOL_CUE && !b.down);
  const aiming = aim && s.phase === 0 && !s.over;
  if (aiming) drawAim(ctx, s, aim);
  if (cue) drawBall(ctx, POOL_CUE, px(cue.x), px(cue.y));
  if (aiming && cue) {
    const l = Math.hypot(aim.dx, aim.dy);
    if (l > 1e-6) drawCueStick(ctx, px(cue.x), px(cue.y), aim.dx / l, aim.dy / l, aim.power);
  }
  if (!turned) drawHud(ctx, s);
  // poolRev 4: the deal's set, shown big over the table until the first shot (never on the turned desktop table: its
  // HUD strip names the set upright).
  if (!turned && s.rev >= 4) drawSetBanner(ctx, s);
  numberTurn = 0;
  void POOL_BLACK;
}

/** poolRev 4's opening banner: YOU'RE STRIPES (or SPOTS) and your seven, until the first shot or 4 s, then a fade. */
export const POOL_SET_BANNER_TICKS = 240;
function drawSetBanner(ctx: CanvasRenderingContext2D, s: PoolState): void {
  if (s.shots > 0 && s.phase !== 0) return;
  const age = s.shots > 0 ? POOL_SET_BANNER_TICKS : s.tick;
  if (age >= POOL_SET_BANNER_TICKS) return;
  const a = age < 200 ? 1 : (POOL_SET_BANNER_TICKS - age) / 40;
  const set = s.set ?? POOL_SET_SPOTS;
  const cx = POOL_W / 2;
  const cy = 300;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(8,10,14,0.86)";
  roundRect(ctx, cx - 132, cy - 44, 264, 88, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(242,199,92,0.85)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#F2C75C";
  ctx.font = `800 22px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`YOU’RE ${poolSetName(set).toUpperCase()}`, cx, cy - 18);
  for (let id = 1; id <= POOL_SPOTS; id++) drawBall(ctx, poolShownId(id, set), cx - 3 * 22 + (id - 1) * 22, cy + 18, 8);
  ctx.restore();
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

/* ============================== The power meter ============================== */

/** The meter's bands, soft to full: green, yellow, orange, red. */
const BANDS: readonly [number, number, number][] = [
  [63, 178, 90],
  [143, 201, 62],
  [233, 210, 58],
  [239, 165, 44],
  [232, 105, 42],
  [216, 50, 46],
];
/** The meter's segments. */
const SEGMENTS = 20;

/** The band colour at f (0 soft … 1 full), blended between the stops. */
function bandColour(f: number, alpha: number): string {
  const x = Math.max(0, Math.min(1, f)) * (BANDS.length - 1);
  const i = Math.min(BANDS.length - 2, Math.floor(x));
  const t = x - i;
  const a = BANDS[i]!;
  const b = BANDS[i + 1]!;
  const c = (k: number) => Math.round(a[k]! + (b[k]! - a[k]!) * t);
  return `rgba(${c(0)},${c(1)},${c(2)},${alpha})`;
}

/**
 * The power meter (CSS px, its own canvas), after the classic pool games' meter: a framed bar of segmented bands from
 * green (soft, on the right) through yellow and orange to red (full, on the left), tick marks above and below, and the
 * cue lying inside it. `pull` (0…1) draws the cue back to the left; every segment its tip has passed lights up.
 */
export function drawPoolPowerPanel(ctx: CanvasRenderingContext2D, w: number, h: number, pull: number, _spin?: unknown): void {
  ctx.clearRect(0, 0, w, h);
  const p = Math.max(0, Math.min(1, pull));
  // The frame: a dark body inside a brushed-metal rim.
  const rim = ctx.createLinearGradient(0, 0, 0, h);
  rim.addColorStop(0, "#9AA0A7");
  rim.addColorStop(0.5, "#3C4046");
  rim.addColorStop(1, "#7D838A");
  ctx.fillStyle = rim;
  roundRect(ctx, 0, 0, w, h, 14);
  ctx.fill();
  const bodyFill = ctx.createLinearGradient(0, 2, 0, h - 2);
  bodyFill.addColorStop(0, "#1C1C23");
  bodyFill.addColorStop(1, "#0B0B0F");
  ctx.fillStyle = bodyFill;
  roundRect(ctx, 2, 2, w - 4, h - 4, 12);
  ctx.fill();
  // The track.
  const left = 12;
  const right = w - 12;
  const trackW = Math.max(10, right - left);
  const top = Math.round(h * 0.27);
  const bh = Math.max(12, Math.round(h * 0.46));
  ctx.fillStyle = "#050507";
  roundRect(ctx, left - 2, top - 2, trackW + 4, bh + 4, 6);
  ctx.fill();
  // Segments: index 0 at the right (soft) to SEGMENTS − 1 at the left (full).
  const seg = trackW / SEGMENTS;
  const lit = Math.ceil(p * SEGMENTS - 1e-6);
  for (let k = 0; k < SEGMENTS; k++) {
    const x = right - (k + 1) * seg;
    const on = k < lit;
    ctx.fillStyle = bandColour(k / (SEGMENTS - 1), on ? 1 : 0.2);
    ctx.fillRect(x + 1, top, seg - 2, bh);
    if (on) {
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x + 1, top, seg - 2, bh * 0.4);
    }
  }
  // Glass over the track.
  const glass = ctx.createLinearGradient(0, top, 0, top + bh);
  glass.addColorStop(0, "rgba(255,255,255,0.10)");
  glass.addColorStop(0.5, "rgba(255,255,255,0)");
  glass.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = glass;
  ctx.fillRect(left, top, trackW, bh);
  // Tick marks above and below: one a segment, longer every fifth.
  ctx.strokeStyle = "rgba(243,241,236,0.45)";
  ctx.lineWidth = 1;
  for (let k = 0; k <= SEGMENTS; k++) {
    const x = Math.round(right - k * seg) + 0.5;
    const len = k % 5 === 0 ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(x, top - 4 - len);
    ctx.lineTo(x, top - 4);
    ctx.moveTo(x, top + bh + 4);
    ctx.lineTo(x, top + bh + 4 + len);
    ctx.stroke();
  }
  // The cue inside the track: tip at the right end drawn back by the pull, the shaft running off the left.
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, trackW, bh);
  ctx.clip();
  const cy = top + bh / 2;
  const tip = right - 2 - p * (trackW - 8);
  const len = Math.max(w, 260);
  const half = (x: number) => 2.2 + ((tip - x) / len) * 3.4;
  const body = (x0: number, x1: number, fill: string | CanvasGradient) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x0, cy - half(x0));
    ctx.lineTo(x1, cy - half(x1));
    ctx.lineTo(x1, cy + half(x1));
    ctx.lineTo(x0, cy + half(x0));
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(tip - len, cy + 2, len, 4);
  const maple = ctx.createLinearGradient(0, cy - 4, 0, cy + 4);
  maple.addColorStop(0, "#F7EBD2");
  maple.addColorStop(0.5, "#E6D1A8");
  maple.addColorStop(1, "#B39B70");
  body(tip - 4, tip - len * 0.5, maple);
  body(tip - len * 0.5, tip - len * 0.5 - 3, "#E3B341");
  const butt = ctx.createLinearGradient(0, cy - 5, 0, cy + 5);
  butt.addColorStop(0, "#5A2E16");
  butt.addColorStop(1, "#1A0C06");
  body(tip - len * 0.5 - 3, tip - len, butt);
  body(tip - 1.4, tip - 4, "#F8F8F6");
  body(tip, tip - 1.4, "#2E6FD8");
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(tip - 6, cy - 1);
  ctx.lineTo(tip - len * 0.48, cy - 2.6);
  ctx.stroke();
  ctx.restore();
}
