/**
 * Cue Ball's skins and world theme (wave 2, E1; docs/art/wave-2/items/game-skin/cue-ball--*.html,
 * items/world-theme/cue-ball--neon-table.html). Display only: every ball is painted inside its own draw radius
 * (POOL_BALL_DRAW_R, the sim's radius + 1.5), so sizes and hit areas are the default's; the table keeps every rail,
 * cushion, jaw and pocket where the default draws them.
 *
 * Spots and stripes stay told apart in every skin (a spot is the body with its spot, a stripe the body with a broad
 * band), so the set rule (poolRev 4) reads as it does by default.
 */
import type { ArenaSceneView } from "../arenaScene.renderer";
import { POOL_BAULK_Y, POOL_CB, POOL_CL, POOL_CR, POOL_CT, POOL_CUE, POOL_JAWS, POOL_POCKETS, POOL_RAIL, POOL_W, POOL_H } from "../pool";
import type { ContrastPair, GameLook } from "./look";

const FONT = "'Archivo', system-ui, sans-serif";
const px = (u: number) => u / 256;
const BLACK = 8;

export type PoolBallKind = "pixel" | "galaxy" | "neon" | "neontable";

/** The neon colour of each ball (Neon ball set and the Neon Table): the art's cue cyan, pink 8 and gold 5, the rest in their own hue. */
export const POOL_NEON: Readonly<Record<number, string>> = {
  1: "#FFF06A",
  2: "#4D7CFF",
  3: "#FF3D5A",
  4: "#B07CFF",
  5: "#F2C14E",
  6: "#3DFF9A",
  7: "#FF7A3D",
  8: "#FF3DCB",
};
const NEON_BODY = "#0A0820";
const CYAN = "#22E4FF";
const PINK = "#FF3DCB";

/** The pixel set's colours: the art's cue, black and red, the rest the default's hues. */
const PIXEL: Readonly<Record<number, string>> = {
  1: "#F2C230",
  2: "#1F4FBF",
  3: "#E5243F",
  4: "#5B2A86",
  5: "#E8752A",
  6: "#1E7A3E",
  7: "#7A1F2A",
  8: "#111318",
};

/** The painter a ball takes under a look, or null for the default ball. */
export function poolBallKind(look: GameLook, id: number): PoolBallKind | null {
  switch (look.skin) {
    case "game-skin.cue-ball.pixel-pool":
      return "pixel";
    case "game-skin.cue-ball.galaxy-set":
      return "galaxy";
    case "game-skin.cue-ball.neon-ball-set":
      return "neon";
    case "game-skin.cue-ball.neon-8-ball":
      if (id === BLACK) return "neon";
      break;
  }
  return look.world ? "neontable" : null;
}

const hueOf = (id: number) => (id > 8 ? id - 8 : id);

function numberText(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, r: number, colour: string, stripe: boolean, turn: number, weight = 800): void {
  if (r < 7) return;
  ctx.fillStyle = colour;
  ctx.font = `${weight} ${Math.max(4, r * (stripe ? 0.6 : 0.5))}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (turn) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(turn);
    ctx.fillText(String(id), r * 0.04, 0);
    ctx.restore();
  } else ctx.fillText(String(id), x, y + r * 0.04);
}

/** The art's soft highlight: a white disc up and to the left (r 4 of 19 at −6, −7). */
function highlight(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha = 0.4): void {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.arc(x - (r * 6) / 19, y - (r * 7) / 19, (r * 4) / 19, 0, Math.PI * 2);
  ctx.fill();
}

/** A neon ring ball: the dark body, its neon rim (2 of 19) and a faint halo just inside the draw radius. */
function neonBall(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, r: number, turn: number, tableBalls: boolean): void {
  const cue = id === POOL_CUE;
  const stripe = id >= 9;
  if (cue && tableBalls) {
    // The Neon Table's cue ball: bright, with a white glow.
    const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
    g.addColorStop(0, "#E8FFFF");
    g.addColorStop(1, "#BFF6FF");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    highlight(ctx, x, y, r, 0.6);
    return;
  }
  const black = id === BLACK && tableBalls;
  const neon = cue ? CYAN : black ? "#FFFFFF" : POOL_NEON[hueOf(id)]!;
  const lw = Math.max(1, (r * 2.5) / 11);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = black ? "#000000" : NEON_BODY;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (stripe) {
    ctx.fillStyle = neon;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x - r, y - r * 0.36, r * 2, r * 0.72);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // The halo, then the rim (inside the radius, so the art stays inside the ball's draw circle).
  ctx.strokeStyle = neon;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = lw * 1.6;
  ctx.beginPath();
  ctx.arc(x, y, r - lw * 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(x, y, r - lw / 2, 0, Math.PI * 2);
  ctx.stroke();
  if (!cue) numberText(ctx, id, x, y, r, stripe ? NEON_BODY : neon, stripe, turn, 900);
  highlight(ctx, x, y, r);
}

const GOLD_STOPS: readonly [number, string][] = [
  [0, "#FFF3C4"],
  [0.35, "#F2C14E"],
  [0.7, "#C8902A"],
  [1, "#FFE08A"],
];

function galaxyBall(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, r: number, turn: number): void {
  const cue = id === POOL_CUE;
  const stripe = id >= 9;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (cue) {
    ctx.fillStyle = "#E8E4FF";
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  } else {
    const gx = x - r + 0.4 * 2 * r;
    const gy = y - r + 0.35 * 2 * r;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 0.8 * 2 * r);
    if (id === BLACK) {
      g.addColorStop(0, "#2A2440");
      g.addColorStop(0.6, "#07060F");
      g.addColorStop(1, "#000000");
    } else {
      g.addColorStop(0, "#FF8FD6");
      g.addColorStop(0.55, "#9D2B9A");
      g.addColorStop(1, "#2A0838");
    }
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    // Stars (the art's 0.9 specks), fixed per ball.
    ctx.fillStyle = "#FFFFFF";
    for (const [dx, dy] of [[-0.42, 0.21], [0.42, 0.53], [0.21, -0.63], [-0.32, 0.74]] as const) {
      ctx.beginPath();
      ctx.arc(x + dx * r, y + dy * r, Math.max(0.35, (r * 0.9) / 19), 0, Math.PI * 2);
      ctx.fill();
    }
    if (stripe) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x - r, y - r * 0.36, r * 2, r * 0.72);
    } else {
      const sr = (r * 8.5) / 19;
      if (id === BLACK) {
        const gg = ctx.createLinearGradient(x - sr, y - sr, x - sr + 0.4 * 2 * sr, y + sr);
        for (const [o, c] of GOLD_STOPS) gg.addColorStop(o, c);
        ctx.fillStyle = gg;
      } else ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(x, y, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  const lw = Math.max(0.8, (r * 2) / 19);
  ctx.strokeStyle = id === BLACK ? "#F2C14E" : "#06080F";
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(x, y, r - lw / 2, 0, Math.PI * 2);
  ctx.stroke();
  if (!cue) numberText(ctx, id, x, y, r, "#06080F", stripe, turn, 900);
  highlight(ctx, x, y, r);
}

/* The pixel set: a 10 × 10 disc (the art's mask), a white 4 × 4 spot, a pale corner pixel. */
const MASK: readonly (readonly [number, number])[] = [
  [3, 6],
  [1, 8],
  [1, 8],
  [0, 9],
  [0, 9],
  [0, 9],
  [0, 9],
  [1, 8],
  [1, 8],
  [3, 6],
];
/** 3 × 5 pixel digits. */
const DIGITS: Readonly<Record<string, readonly string[]>> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "011", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
};

function pixelBall(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, r: number, turn: number): void {
  const p = (r * 2) / 10;
  const x0 = x - r;
  const y0 = y - r;
  const cue = id === POOL_CUE;
  const stripe = id >= 9;
  const body = cue ? "#F5F5F0" : PIXEL[hueOf(id)]!;
  for (let row = 0; row < 10; row++) {
    const [a, b] = MASK[row]!;
    ctx.fillStyle = stripe && row >= 3 && row <= 6 ? "#F5F5F0" : body;
    ctx.fillRect(x0 + a * p, y0 + row * p, (b - a + 1) * p, p);
  }
  if (!cue && !stripe) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x0 + 3 * p, y0 + 3 * p, 4 * p, 4 * p);
  }
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(x0 + 1 * p, y0 + 2 * p, p, p);
  if (cue || r < 7) return;
  const text = String(id);
  const u = text.length === 1 ? p * 0.7 : p * 0.5;
  const w = text.length * 3 * u + (text.length - 1) * u;
  ctx.save();
  ctx.translate(x, y);
  if (turn) ctx.rotate(turn);
  ctx.fillStyle = "#06080F";
  for (let k = 0; k < text.length; k++) {
    const g = DIGITS[text[k]!]!;
    for (let gy = 0; gy < 5; gy++)
      for (let gx = 0; gx < 3; gx++) if (g[gy]![gx] === "1") ctx.fillRect(-w / 2 + k * 4 * u + gx * u, -2.5 * u + gy * u, u, u);
  }
  ctx.restore();
}

/** One ball's face under a skin or the theme (r: its draw radius). */
export function paintPoolSkinBall(ctx: CanvasRenderingContext2D, kind: PoolBallKind, id: number, x: number, y: number, r: number, turn: number): void {
  if (kind === "pixel") pixelBall(ctx, id, x, y, r, turn);
  else if (kind === "galaxy") galaxyBall(ctx, id, x, y, r, turn);
  else neonBall(ctx, id, x, y, r, turn, kind === "neontable");
}

/* ============================== The Neon Table ============================== */

type RoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => void;

/** The table under the Neon Table theme: a black table, a faint cyan grid, neon rails and glowing pockets. */
export function paintNeonTable(ctx: CanvasRenderingContext2D, roundRect: RoundRect): void {
  const rl = POOL_CL - POOL_RAIL;
  const rr = POOL_CR + POOL_RAIL;
  const rt = POOL_CT - POOL_RAIL;
  const rb = POOL_CB + POOL_RAIL;
  ctx.fillStyle = "#05040F";
  ctx.fillRect(0, 0, POOL_W, POOL_H);
  ctx.fillStyle = NEON_BODY;
  roundRect(ctx, rl, rt, rr - rl, rb - rt, 16);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 6;
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 3;
  roundRect(ctx, rl + 1.5, rt + 1.5, rr - rl - 3, rb - rt - 3, 15);
  ctx.stroke();
  ctx.restore();
  // The cloth with its faint grid.
  ctx.fillStyle = "#06242C";
  ctx.fillRect(POOL_CL - 6, POOL_CT - 6, POOL_CR - POOL_CL + 12, POOL_CB - POOL_CT + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(POOL_CL, POOL_CT, POOL_CR - POOL_CL, POOL_CB - POOL_CT);
  ctx.clip();
  ctx.strokeStyle = "rgba(34,228,255,0.12)";
  ctx.lineWidth = 0.6;
  for (let x = POOL_CL + 24; x < POOL_CR; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, POOL_CT);
    ctx.lineTo(x, POOL_CB);
    ctx.stroke();
  }
  for (let y = POOL_CT + 24; y < POOL_CB; y += 24) {
    ctx.beginPath();
    ctx.moveTo(POOL_CL, y);
    ctx.lineTo(POOL_CR, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(34,228,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(POOL_CL, POOL_BAULK_Y);
  ctx.lineTo(POOL_CR, POOL_BAULK_Y);
  ctx.stroke();
  ctx.restore();
  // The cushions' edge.
  ctx.strokeStyle = "rgba(34,228,255,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(POOL_CL + 0.5, POOL_CT + 0.5, POOL_CR - POOL_CL - 1, POOL_CB - POOL_CT - 1);
  // Pockets: black with a glowing pink ring, the shapes the default draws.
  for (const p of POOL_POCKETS) {
    const x = px(p.x);
    const y = px(p.y);
    const r = px(p.r);
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    if (p.corner) ctx.arc(x, y, r, 0, Math.PI * 2);
    else {
      const sx = x < POOL_W / 2 ? -1 : 1;
      ctx.arc(x, y, r, sx < 0 ? Math.PI / 2 : -Math.PI / 2, sx < 0 ? Math.PI * 1.5 : Math.PI / 2);
      ctx.lineTo(x, y - r);
    }
    ctx.fill();
    ctx.save();
    ctx.shadowColor = PINK;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = PINK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }
  // The jaws, in cyan (where the cushions meet the pockets).
  ctx.strokeStyle = "rgba(34,228,255,0.7)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const j of POOL_JAWS) {
    ctx.beginPath();
    ctx.moveTo(px(j.ax), px(j.ay));
    ctx.lineTo(px(j.bx), px(j.by));
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

/** The Neon Table's cue: a glowing gold shaft and a cyan tip (the art's 6 px cue, tapered as the default). */
export function drawNeonCue(ctx: CanvasRenderingContext2D, tipX: number, tipY: number, angle: number, len: number): void {
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(angle);
  const half = (x: number) => 1.8 + (2.8 * x) / len;
  const body = (x0: number, x1: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x0, -half(x0));
    ctx.lineTo(x1, -half(x1));
    ctx.lineTo(x1, half(x1));
    ctx.lineTo(x0, half(x0));
    ctx.closePath();
    ctx.fill();
  };
  ctx.shadowColor = "#F2C14E";
  ctx.shadowBlur = 5;
  body(16, len, "#F2C14E");
  ctx.shadowBlur = 0;
  body(0, 16, CYAN);
  ctx.restore();
}

/** The room round the Neon Table: deep night with a faint cyan spill. */
export function POOL_NEON_SCENE(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const w = view.right - view.left;
  const h = view.bottom - view.top;
  ctx.fillStyle = "#05040F";
  ctx.fillRect(view.left, view.top, w, h);
  const cx = POOL_W / 2;
  const cy = POOL_H / 2;
  const g = ctx.createRadialGradient(cx, cy, 80, cx, cy, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(34,228,255,0.10)");
  g.addColorStop(1, "rgba(34,228,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(view.left, view.top, w, h);
}

/* ============================== The contrast check ============================== */

const CLOTH = ["#1F6B45", "#1A5E3C"];
const NEON_CLOTH = ["#06242C"];

/** What each Cue Ball look must keep visible: the cue ball, the black and a spot and a stripe, on the cloth. */
export function poolContrast(look: GameLook): ContrastPair[] {
  const bg = look.world ? NEON_CLOTH : CLOTH;
  const out: ContrastPair[] = [];
  for (const id of [POOL_CUE, BLACK, 3, 11]) {
    const kind = poolBallKind(look, id);
    let colours: string[];
    if (kind === null) colours = id === POOL_CUE ? ["#F4F1E8"] : id === BLACK ? ["#111114", "#FBFAF5"] : ["#D22B2B", "#FBFAF5"];
    else if (kind === "pixel") colours = id === POOL_CUE ? ["#F5F5F0"] : [PIXEL[hueOf(id)]!, "#FFFFFF", "#F5F5F0"];
    else if (kind === "galaxy") colours = id === POOL_CUE ? ["#E8E4FF"] : id === BLACK ? ["#F2C14E"] : ["#FF8FD6", "#FFFFFF"];
    else if (kind === "neontable" && id === POOL_CUE) colours = ["#E8FFFF"];
    else colours = [id === POOL_CUE ? CYAN : kind === "neontable" && id === BLACK ? "#FFFFFF" : POOL_NEON[hueOf(id)]!];
    out.push({ object: id === POOL_CUE ? "cue ball" : `ball ${id}`, colours, backgrounds: bg });
  }
  return out;
}
