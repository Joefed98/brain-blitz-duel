/**
 * Matchup art pass and swap tween. Render only: reads MatchupState and never
 * mutates it. Gems sit on the sim's cell centres at the sim's symbol radius;
 * each colour keeps its own cut so shapes stay distinguishable.
 */
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import type { CanvasSize } from "./engine";
import { arcadeFx } from "./arcadeFx.renderer";
import { MATCHUP_FX } from "./arcadeFxGames.renderer";
import type { SoundId } from "@/lib/fx/manifest";
import {
  matchupFindSwap, matchupGame, matchupIndex, matchupShowHint, matchupTransform,
  MATCHUP_BOARD_H, MATCHUP_BOARD_W, MATCHUP_BOARD_X, MATCHUP_BOARD_Y, MATCHUP_BOMB, MATCHUP_CELL_PX,
  MATCHUP_CLEAR_MS, MATCHUP_COLOURS, MATCHUP_CROSS, MATCHUP_DETONATE_MS, MATCHUP_DROP_MS, MATCHUP_GOLD,
  MATCHUP_NEXT_H, MATCHUP_NEXT_Y, MATCHUP_QUEUE_LEN, MATCHUP_ROWS, MATCHUP_SHAPES, MATCHUP_SIZE, MATCHUP_STAR,
  MATCHUP_SYMBOL_PCT, MATCHUP_TEXT, MATCHUP_JACKPOT, MATCHUP_WORLD_H, MATCHUP_WORLD_W, matchupIsJackpot, matchupPending, matchupStepTiming,
  type MatchupAnimStep, type MatchupState,
} from "./matchup";
import { artHash, reducedMotion } from "./art.renderer";
import { sceneBelow, sceneFill, sceneSides, type ArenaSceneView } from "./arenaScene.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { successHud } from "./success.renderer";

/** Nine frames at 60 Hz, independent of simulation ticks. */
export const MATCHUP_SWAP_MS = 150;
const RADIUS = (MATCHUP_CELL_PX * MATCHUP_SYMBOL_PCT) / 200;
const SPECIAL_WHITE = "#FFFFFF";
const BOMB_OUTLINE = "#D5D7DF";

export interface MatchupSwapTween {
  before: MatchupState;
  a: number;
  b: number;
  rejected: boolean;
  startedAt: number;
}

export function matchupSwapProgress(elapsedMs: number, rejected: boolean): number {
  const leg = Math.max(0, Math.min(rejected ? 2 : 1, elapsedMs / MATCHUP_SWAP_MS));
  const p = leg <= 1 ? leg : 2 - leg;
  return p * p * (3 - 2 * p);
}

/** Start offsets (ms after the swap tween) of each cascade step's clear. */
export function matchupStepOffsets(steps: readonly MatchupAnimStep[]): number[] {
  const out: number[] = [];
  let at = 0;
  for (const step of steps) {
    out.push(at);
    at += MATCHUP_CLEAR_MS + Math.max(1, step.ticks) * MATCHUP_DROP_MS;
  }
  return out;
}

/** Sound for each cascade step: the special that went off, else the match chime. */
export function matchupStepSound(step: MatchupAnimStep): SoundId {
  const kinds = new Set<number>();
  for (const index of step.detonated) {
    const kind = step.before[index] ?? -1;
    if (kind === MATCHUP_BOMB || kind === MATCHUP_CROSS || kind === MATCHUP_STAR) kinds.add(kind);
    if (matchupIsJackpot(kind)) kinds.add(MATCHUP_JACKPOT);
  }
  if (kinds.has(MATCHUP_JACKPOT)) return "matchup.jackpotBlast";
  if (kinds.has(MATCHUP_BOMB)) return "arc_gem_bomb";
  if (kinds.has(MATCHUP_STAR)) return "arc_gem_star";
  if (kinds.has(MATCHUP_CROSS)) return "arc_gem_zap";
  return "arc_gem_match";
}

/* ================================ Gems ================================ */

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Outline points for each cut, matching the sim's symbol silhouettes. */
function cutPoints(shape: string, cx: number, cy: number, r: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const ring = (n: number, rot: number, rr: (k: number) => number) => {
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rr(k), cy + Math.sin(a) * rr(k)]);
    }
  };
  if (shape === "circle") ring(10, -Math.PI / 2, () => r);
  else if (shape === "square") {
    const s = r * 0.88;
    const c = s * 0.32;
    pts.push([cx - s + c, cy - s], [cx + s - c, cy - s], [cx + s, cy - s + c], [cx + s, cy + s - c],
      [cx + s - c, cy + s], [cx - s + c, cy + s], [cx - s, cy + s - c], [cx - s, cy - s + c]);
  } else if (shape === "triangle") pts.push([cx, cy - r], [cx + r, cy + r * 0.8], [cx - r, cy + r * 0.8]);
  else if (shape === "diamond") pts.push([cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]);
  else if (shape === "star") ring(10, -Math.PI / 2, (k) => (k % 2 === 0 ? r : r * 0.45));
  else ring(6, -Math.PI / 2, () => r);
  return pts;
}

function pathOf(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function facetedGem(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, cx: number, cy: number, r: number, colour: string): void {
  const body = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  body.addColorStop(0, colour);
  body.addColorStop(0.5, colour);
  body.addColorStop(1, shade(colour, -0.2));
  ctx.save();
  pathOf(ctx, pts);
  ctx.clip();
  ctx.fillStyle = body;
  ctx.fill();
  // Table facet and spokes.
  const inner = pts.map(([x, y]) => [cx + (x - cx) * 0.52, cy + (y - cy) * 0.52 - r * 0.06] as [number, number]);
  ctx.strokeStyle = shade(colour, -0.25);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    ctx.moveTo(x, y);
    const point = inner[i];
    if (point) ctx.lineTo(point[0], point[1]);
  });
  ctx.stroke();
  pathOf(ctx, inner);
  ctx.fillStyle = colour;
  ctx.fill();
  // Darker base edge and a crisp rim.
  pathOf(ctx, pts);
  ctx.strokeStyle = shade(colour, -0.6);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  gemGlint(ctx, pts, cx, cy, r);
  ctx.restore();
}

/** Flat table and bevel planes: fixed per cut, with three own-colour shades. */
function flatGem(ctx: CanvasRenderingContext2D, shape: string, cx: number, cy: number, r: number, colour: string): void {
  const pts = cutPoints(shape, cx, cy, r);
  const inner = pts.map(([x, y]) => [cx + (x - cx) * 0.5, cy + (y - cy) * 0.5 - r * 0.12] as [number, number]);
  const light = shade(colour, 0.28);
  const dark = shade(colour, -0.3);
  ctx.save();
  pathOf(ctx, pts);
  ctx.clip();
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k]; const b = pts[(k + 1) % pts.length];
    const ia = inner[k]; const ib = inner[(k + 1) % inner.length];
    if (!a || !b || !ia || !ib) continue;
    const height = ((a[1] + b[1]) / 2 - cy) / r;
    ctx.fillStyle = height < -0.3 ? light : height > 0.3 ? dark : colour;
    pathOf(ctx, [a, b, ib, ia]);
    ctx.fill();
  }
  pathOf(ctx, inner);
  ctx.fillStyle = light;
  ctx.fill();
  ctx.strokeStyle = light;
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k]; const b = inner[k];
    if (!a || !b) continue;
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  pathOf(ctx, inner); ctx.stroke();
  pathOf(ctx, pts); ctx.lineWidth = 1; ctx.stroke();
  // Own-colour inner light is baked once into the clipped gem sprite.
  const shine = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, 0, cx, cy, r * 0.9);
  shine.addColorStop(0, shade(colour, 0.42));
  shine.addColorStop(1, colour);
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = shine;
  pathOf(ctx, pts); ctx.fill();
  ctx.globalAlpha = 1;
  gemGlint(ctx, pts, cx, cy, r);
  ctx.restore();
}

/**
 * Polish G: a lit upper-left rim, a shaded lower-right rim and a small white
 * glint on the table, all inside the cut's own outline (the caller clips to it).
 */
function gemGlint(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, cx: number, cy: number, r: number): void {
  ctx.save();
  pathOf(ctx, pts);
  ctx.clip();
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.6;
  const rim = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  rim.addColorStop(0, "rgba(255,255,255,0.55)");
  rim.addColorStop(0.45, "rgba(255,255,255,0)");
  rim.addColorStop(0.6, "rgba(0,0,0,0)");
  rim.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.strokeStyle = rim;
  pathOf(ctx, pts.map(([x, y]) => [cx + (x - cx) * 0.9, cy + (y - cy) * 0.9] as [number, number]));
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  const gx = cx - r * 0.28, gy = cy - r * 0.34, g = r * 0.2;
  ctx.beginPath();
  ctx.moveTo(gx, gy - g);
  ctx.lineTo(gx + g * 0.3, gy - g * 0.3);
  ctx.lineTo(gx + g, gy);
  ctx.lineTo(gx + g * 0.3, gy + g * 0.3);
  ctx.lineTo(gx, gy + g);
  ctx.lineTo(gx - g * 0.3, gy + g * 0.3);
  ctx.lineTo(gx - g, gy);
  ctx.lineTo(gx - g * 0.3, gy - g * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.arc(cx + r * 0.3, cy + r * 0.22, r * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** One gem centred on (cx, cy) at the sim's symbol radius (vector; the game icon paints it at its real size). */
export function paintMatchupGem(ctx: CanvasRenderingContext2D, kind: number, cx: number, cy: number, radius: number, time = 0): void {
  ctx.save();
  // Includes special fuse details: never exceed the symbol's bounds.
  ctx.beginPath();
  ctx.rect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.clip();
  if (kind === MATCHUP_BOMB) {
    const pts = cutPoints("hexagon", cx, cy + radius * 0.06, radius * 0.86);
    facetedGem(ctx, pts, cx, cy + radius * 0.06, radius * 0.86, "#2A2A33");
    pathOf(ctx, pts);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = BOMB_OUTLINE;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
    const pulse = 0.65 + 0.35 * Math.sin(time * 8);
    const spark = ctx.createRadialGradient(cx + radius * 0.55, cy - radius * 0.72, 0, cx + radius * 0.55, cy - radius * 0.72, radius * 0.5);
    spark.addColorStop(0, `rgba(255,220,120,${pulse})`);
    spark.addColorStop(0.4, `rgba(255,120,40,${0.7 * pulse})`);
    spark.addColorStop(1, "rgba(255,80,20,0)");
    ctx.strokeStyle = "#B88A4A";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.2, cy - radius * 0.6);
    ctx.quadraticCurveTo(cx + radius * 0.3, cy - radius * 0.95, cx + radius * 0.55, cy - radius * 0.72);
    ctx.stroke();
    ctx.fillStyle = spark;
    ctx.beginPath();
    ctx.arc(cx + radius * 0.55, cy - radius * 0.72, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === MATCHUP_CROSS) {
    const pts = cutPoints("square", cx, cy, radius);
    facetedGem(ctx, pts, cx, cy, radius, SPECIAL_WHITE);
    ctx.fillStyle = shade(MATCHUP_GOLD, -0.55);
    const w = radius * 0.22;
    ctx.fillRect(cx - radius * 0.85, cy - w / 2, radius * 1.7, w);
    ctx.fillRect(cx - w / 2, cy - radius * 0.85, w, radius * 1.7);
  } else if (matchupIsJackpot(kind)) {
    // Jackpot (matchupRev 2): a round brilliant in its colour inside a rainbow rim, a white star at its heart.
    const colour = MATCHUP_COLOURS[kind - MATCHUP_JACKPOT] ?? MATCHUP_GOLD;
    MATCHUP_COLOURS.forEach((rim, i) => {
      const a0 = -Math.PI / 2 + (i * Math.PI * 2) / MATCHUP_COLOURS.length;
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, a0, a0 + (Math.PI * 2) / MATCHUP_COLOURS.length);
      ctx.closePath();
      ctx.fill();
    });
    const pts = cutPoints("circle", cx, cy, radius * 0.74);
    facetedGem(ctx, pts, cx, cy, radius * 0.74, colour);
    ctx.fillStyle = SPECIAL_WHITE;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 4;
      const d = k % 2 === 0 ? radius * 0.42 : radius * 0.14;
      ctx.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = SPECIAL_WHITE;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 0.8, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === MATCHUP_STAR) {
    const pts = cutPoints("star", cx, cy, radius);
    facetedGem(ctx, pts, cx, cy, radius, SPECIAL_WHITE);
    pathOf(ctx, pts);
    ctx.clip();
    ctx.strokeStyle = MATCHUP_GOLD;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else {
    const shape = MATCHUP_SHAPES[kind] ?? "circle";
    const colour = MATCHUP_COLOURS[kind] ?? MATCHUP_GOLD;
    flatGem(ctx, shape, cx, cy, radius, colour);
  }
  ctx.restore();
}

const gemSprites = new Map<string, ArtCanvas>();
export function drawMatchupGem(ctx: CanvasRenderingContext2D, kind: number, cx: number, cy: number, radius: number, time = 0): void {
 const key = `${kind}:${radius}`; let stamp = gemSprites.get(key);
 if (!stamp) { const canvas = artCanvas(Math.ceil(radius * 4 + 4), Math.ceil(radius * 4 + 4)); const native = canvas && artContext(canvas);
  if (canvas && native) { native.scale(2, 2); paintMatchupGem(native as CanvasRenderingContext2D, kind, radius + 1, radius + 1, radius, 0); stamp = canvas; if(gemSprites.size>=64){const oldest=gemSprites.keys().next().value;if(oldest!==undefined)gemSprites.delete(oldest);}gemSprites.set(key, stamp); }
 }
 if (stamp) ctx.drawImage(stamp, cx-radius-1, cy-radius-1, stamp.width/2, stamp.height/2);
 else paintMatchupGem(ctx, kind, cx, cy, radius, time);
}
const boardLayers = new WeakMap<CanvasRenderingContext2D, { canvas: ArtCanvas; cells: number[]; k: number }>();

/* ================================ Board =============================== */

const centre = (index: number) => ({
  x: MATCHUP_BOARD_X + ((index % MATCHUP_SIZE) + 0.5) * MATCHUP_CELL_PX,
  y: MATCHUP_BOARD_Y + (Math.floor(index / MATCHUP_SIZE) + 0.5) * MATCHUP_CELL_PX,
});

/**
 * Polish G: each cell is a recessed velvet socket (shadow on the upper-left
 * inner edge, a faint lit lip lower-right), filling exactly its cell.
 */
function paintSocket(c: CanvasRenderingContext2D, x: number, y: number, parity: number): void {
  const s = MATCHUP_CELL_PX;
  c.fillStyle = parity === 0 ? "#15151C" : "#101017";
  c.fillRect(x, y, s, s);
  const well = c.createRadialGradient(x + s * 0.5, y + s * 0.56, s * 0.08, x + s * 0.5, y + s * 0.5, s * 0.62);
  well.addColorStop(0, parity === 0 ? "rgba(70,52,110,0.30)" : "rgba(60,44,96,0.26)");
  well.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = well;
  c.fillRect(x, y, s, s);
  c.fillStyle = "rgba(0,0,0,0.45)";
  c.fillRect(x, y, s, 2);
  c.fillRect(x, y, 2, s);
  c.fillStyle = "rgba(255,255,255,0.05)";
  c.fillRect(x, y + s - 1, s, 1);
  c.fillRect(x + s - 1, y, 1, s);
}

const sockets = new Map<number, ArtCanvas>();
function drawSocket(c: CanvasRenderingContext2D, x: number, y: number, parity: number): void {
  let sprite = sockets.get(parity);
  if (!sprite) {
    const canvas = artCanvas(MATCHUP_CELL_PX * 2, MATCHUP_CELL_PX * 2);
    const native = canvas && artContext(canvas);
    if (canvas && native) {
      native.scale(2, 2);
      paintSocket(native as CanvasRenderingContext2D, 0, 0, parity);
      sockets.set(parity, (sprite = canvas));
    }
  }
  if (sprite) c.drawImage(sprite as CanvasImageSource, x, y, MATCHUP_CELL_PX, MATCHUP_CELL_PX);
  else paintSocket(c, x, y, parity);
}

function drawFrame(ctx: CanvasRenderingContext2D): void {
  const x = MATCHUP_BOARD_X - 5;
  const y = MATCHUP_BOARD_Y - 5;
  const w = MATCHUP_BOARD_W + 10;
  const h = MATCHUP_BOARD_H + 10;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  const bevel = ctx.createLinearGradient(0, y, 0, y + h);
  bevel.addColorStop(0, "#4A4258");
  bevel.addColorStop(0.08, "#2C2638");
  bevel.addColorStop(1, "#121017");
  ctx.fillStyle = bevel;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // A thin gold inlay just inside the rim, and a diamond stud at each corner.
  // The board's edge is real (gems stay on it): a soft inlay, not a bright frame (17 Oct 2026, display only).
  ctx.strokeStyle = "rgba(245,184,46,0.2)";
  ctx.beginPath();
  ctx.roundRect(x + 2.5, y + 2.5, w - 5, h - 5, 8);
  ctx.stroke();
  ctx.fillStyle = "rgba(245,184,46,0.35)";
  for (const [sx, sy] of [[x + 2.5, y + 2.5], [x + w - 2.5, y + 2.5], [x + 2.5, y + h - 2.5], [x + w - 2.5, y + h - 2.5]] as const) {
    ctx.beginPath();
    ctx.moveTo(sx, sy - 2.5);
    ctx.lineTo(sx + 2.5, sy);
    ctx.lineTo(sx, sy + 2.5);
    ctx.lineTo(sx - 2.5, sy);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  for (let row = 0; row < MATCHUP_ROWS; row++) {
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      drawSocket(ctx, MATCHUP_BOARD_X + col * MATCHUP_CELL_PX, MATCHUP_BOARD_Y + row * MATCHUP_CELL_PX, (row + col) % 2);
    }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(MATCHUP_BOARD_X + 1, MATCHUP_BOARD_Y + 1, MATCHUP_BOARD_W - 2, MATCHUP_BOARD_H - 2);
}

/**
 * Polish G: the world behind the board, painted once per device scale: deep
 * violet velvet fading to the arena fill at the bottom edge, a soft glow
 * behind the board and faint gem-coloured sparkles in the margins. No text.
 */
function paintBackdrop(c: CanvasRenderingContext2D): void {
  const W = MATCHUP_WORLD_W, H = MATCHUP_WORLD_H;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1B1131");
  g.addColorStop(0.55, "#130E21");
  g.addColorStop(1, "#0B0B0F");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const glow = c.createRadialGradient(W / 2, MATCHUP_BOARD_Y + MATCHUP_BOARD_H * 0.45, 40, W / 2, MATCHUP_BOARD_Y + MATCHUP_BOARD_H * 0.45, W * 0.75);
  glow.addColorStop(0, "rgba(120,80,200,0.22)");
  glow.addColorStop(1, "rgba(120,80,200,0)");
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);
  // Diagonal sheen bands.
  c.save();
  c.globalAlpha = 0.05;
  c.fillStyle = "#FFFFFF";
  for (const [x0, wBand] of [[60, 34], [150, 14], [300, 26]] as const) {
    c.beginPath();
    c.moveTo(x0, 0);
    c.lineTo(x0 + wBand, 0);
    c.lineTo(x0 + wBand - 160, H);
    c.lineTo(x0 - 160, H);
    c.closePath();
    c.fill();
  }
  c.restore();
  // Sparkles in the margins only (never behind a gem).
  const boardTop = MATCHUP_NEXT_Y - 6, boardBottom = MATCHUP_BOARD_Y + MATCHUP_BOARD_H + 8;
  for (let k = 0; k < 46; k++) {
    const h = artHash(k, 431);
    const x = h % W;
    const y = (h >>> 9) % H;
    const inBoard = y > boardTop && y < boardBottom && x > MATCHUP_BOARD_X - 8 && x < MATCHUP_BOARD_X + MATCHUP_BOARD_W + 8;
    if (inBoard || (y < 40 && x < 150)) continue;
    const colour = MATCHUP_COLOURS[k % MATCHUP_COLOURS.length] ?? MATCHUP_GOLD;
    const r = 0.8 + ((h >>> 20) % 3) * 0.6;
    c.globalAlpha = 0.35 + ((h >>> 4) % 4) * 0.1;
    c.fillStyle = colour;
    c.beginPath();
    c.moveTo(x, y - r * 2.2);
    c.lineTo(x + r * 0.5, y - r * 0.5);
    c.lineTo(x + r * 2.2, y);
    c.lineTo(x + r * 0.5, y + r * 0.5);
    c.lineTo(x, y + r * 2.2);
    c.lineTo(x - r * 0.5, y + r * 0.5);
    c.lineTo(x - r * 2.2, y);
    c.lineTo(x - r * 0.5, y - r * 0.5);
    c.closePath();
    c.fill();
  }
  c.globalAlpha = 1;
}

const backdrops = new WeakMap<CanvasRenderingContext2D, { key: string; layer: ArtCanvas }>();
function drawBackdrop(ctx: CanvasRenderingContext2D): void {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  // Reduced effects (lib/fx/lowEnd.ts, slow devices only): at the canvas's own scale even below 1, so it is copied 1:1.
  const scale = Math.min(3, Math.max(arcadeReducedEffects() ? 0.25 : 1, t ? Math.hypot(t.a, t.b) : 1));
  const key = scale.toFixed(3);
  let cached = backdrops.get(ctx);
  if (!cached || cached.key !== key) {
    const layer = artCanvas(Math.ceil(MATCHUP_WORLD_W * scale), Math.ceil(MATCHUP_WORLD_H * scale));
    const native = layer && artContext(layer);
    if (!layer || !native) {
      paintBackdrop(ctx);
      return;
    }
    native.scale(scale, scale);
    paintBackdrop(native as CanvasRenderingContext2D);
    backdrops.set(ctx, (cached = { key, layer }));
  }
  ctx.drawImage(cached.layer as CanvasImageSource, 0, 0, MATCHUP_WORLD_W, MATCHUP_WORLD_H);
}

function drawNextStrip(ctx: CanvasRenderingContext2D, state: MatchupState, time: number): void {
  ctx.beginPath();
  ctx.roundRect(MATCHUP_BOARD_X, MATCHUP_NEXT_Y, MATCHUP_BOARD_W, MATCHUP_NEXT_H, 12);
  const tray = ctx.createLinearGradient(0, MATCHUP_NEXT_Y, 0, MATCHUP_NEXT_Y + MATCHUP_NEXT_H);
  tray.addColorStop(0, "rgba(10,8,16,0.75)");
  tray.addColorStop(1, "rgba(60,48,84,0.45)");
  ctx.fillStyle = tray;
  ctx.fill();
  ctx.strokeStyle = "rgba(245,184,46,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(MATCHUP_BOARD_X + 10, MATCHUP_NEXT_Y + MATCHUP_NEXT_H - 1.5);
  ctx.lineTo(MATCHUP_BOARD_X + MATCHUP_BOARD_W - 10, MATCHUP_NEXT_Y + MATCHUP_NEXT_H - 1.5);
  ctx.stroke();
  for (let col = 0; col < MATCHUP_SIZE; col++) {
    const queue = state.queues[col] ?? [];
    const head = state.heads[col] ?? 0;
    drawMatchupGem(ctx, queue[head % MATCHUP_QUEUE_LEN] ?? 0,
      MATCHUP_BOARD_X + col * MATCHUP_CELL_PX + MATCHUP_CELL_PX / 2, MATCHUP_NEXT_Y + MATCHUP_NEXT_H / 2, 9, time);
  }
}

function drawSettled(ctx: CanvasRenderingContext2D, cells: readonly number[], time: number, skip?: ReadonlySet<number>): void {
 if (!skip) {
  // The settled board is a 2× layer; in reduced effects (lib/fx/lowEnd.ts, slow devices only) it is
  // painted at the canvas's own scale instead, so it is copied 1:1 rather than resampled every frame.
  const t=typeof ctx.getTransform==="function"&&arcadeReducedEffects()?ctx.getTransform():null;
  const k=t?Math.round(Math.max(0.25,Math.min(2,Math.hypot(t.a,t.b)))*1000)/1000:2;
  let layer=boardLayers.get(ctx);
  if (!layer||layer.k!==k) { const canvas=artCanvas(Math.round(MATCHUP_BOARD_W*k),Math.round(MATCHUP_BOARD_H*k)); layer=undefined; if(canvas){layer={canvas,cells:[],k};boardLayers.set(ctx,layer);} }
  const native=layer&&artContext(layer.canvas);
  if(layer&&native){const c=native as CanvasRenderingContext2D;c.save();c.scale(layer.canvas.width/MATCHUP_BOARD_W,layer.canvas.height/MATCHUP_BOARD_H);
   for(let i=0;i<cells.length;i++){if(layer.cells[i]===cells[i])continue;const x=(i%MATCHUP_SIZE)*MATCHUP_CELL_PX,y=Math.floor(i/MATCHUP_SIZE)*MATCHUP_CELL_PX;
    c.clearRect(x,y,MATCHUP_CELL_PX,MATCHUP_CELL_PX);drawSocket(c,x,y,(Math.floor(i/MATCHUP_SIZE)+i%MATCHUP_SIZE)%2);
    drawMatchupGem(c,cells[i]??0,x+MATCHUP_CELL_PX/2,y+MATCHUP_CELL_PX/2,RADIUS,time);layer.cells[i]=cells[i]??0;
   }c.restore();ctx.drawImage(layer.canvas,MATCHUP_BOARD_X,MATCHUP_BOARD_Y,MATCHUP_BOARD_W,MATCHUP_BOARD_H);
   ctx.strokeStyle="rgba(0,0,0,0.5)";ctx.lineWidth=2;ctx.strokeRect(MATCHUP_BOARD_X+1,MATCHUP_BOARD_Y+1,MATCHUP_BOARD_W-2,MATCHUP_BOARD_H-2);return;
  }
 }
  drawGrid(ctx);
  for (let index = 0; index < cells.length; index++) {
    if (skip?.has(index)) continue;
    const { x, y } = centre(index);
    drawMatchupGem(ctx, cells[index] ?? 0, x, y, RADIUS, time);
  }
}

function animatedKind(step: MatchupAnimStep, index: number): number {
  return step.created.find((item) => item.index === index)?.kind ?? step.before[index] ?? 0;
}

function shatter(ctx: CanvasRenderingContext2D, kind: number, index: number, p: number, still: boolean, shards = 4, cascade = 1): void {
  const { x, y } = centre(index);
  if (still) {
    ctx.globalAlpha = 1 - p;
    drawMatchupGem(ctx, kind, x, y, RADIUS);
    ctx.globalAlpha = 1;
    return;
  }
  const colour = kind < MATCHUP_COLOURS.length ? (MATCHUP_COLOURS[kind] ?? MATCHUP_GOLD) : MATCHUP_GOLD;
  ctx.globalAlpha = Math.max(0, 1 - p * 2.2);
  drawMatchupGem(ctx, kind, x, y, RADIUS);
  ctx.globalAlpha = 1;
  const ease = 1 - (1 - p) * (1 - p);
  for (let k = 0; k < shards; k++) {
    const h = artHash(index * 31 + k, 5);
    const a = (k / 7) * Math.PI * 2 + (h % 100) / 60;
    const d = ease * (14 + (h >>> 8) % 12) * Math.min(1.6, 1 + (cascade-1)*0.2);
    const s = 2.5 + ((h >>> 4) % 3);
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = colour;
    ctx.save();
    ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d + ease * ease * 6);
    ctx.rotate(a + p * 4);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.7, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawDetonations(ctx: CanvasRenderingContext2D, step: MatchupAnimStep, progress: number): void {
  for (const index of step.detonated) {
    const kind = step.before[index] ?? -1;
    const { x, y } = centre(index);
    ctx.save();
    ctx.globalAlpha = 1 - progress * 0.7;
    ctx.strokeStyle = MATCHUP_GOLD;
    ctx.lineWidth = 2;
    if (matchupIsJackpot(kind)) {
      // Jackpot: a white cross sweep plus a ring on every gem of its colour.
      const colour = MATCHUP_COLOURS[kind - MATCHUP_JACKPOT] ?? MATCHUP_GOLD;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(MATCHUP_BOARD_X, y - 5, MATCHUP_BOARD_W, 10);
      ctx.fillRect(x - 5, MATCHUP_BOARD_Y, 10, MATCHUP_BOARD_H);
      ctx.strokeStyle = colour;
      ctx.lineWidth = 3;
      for (let target = 0; target < step.before.length; target++) {
        if (step.before[target] !== kind - MATCHUP_JACKPOT) continue;
        const c = centre(target);
        ctx.beginPath();
        ctx.arc(c.x, c.y, RADIUS * (0.6 + progress * 0.9), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.arc(x, y, 8 + progress * MATCHUP_CELL_PX * 1.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === MATCHUP_STAR) {
      const spread = MATCHUP_CELL_PX * (0.5 + progress * MATCHUP_SIZE);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - spread, y - spread);
      ctx.lineTo(x + spread, y + spread);
      ctx.moveTo(x + spread, y - spread);
      ctx.lineTo(x - spread, y + spread);
      ctx.stroke();
      ctx.fillStyle = "rgba(247, 247, 248, 0.5)";
      ctx.beginPath();
      ctx.arc(x, y, 6 + progress * MATCHUP_CELL_PX, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === MATCHUP_CROSS) {
      const spread = MATCHUP_CELL_PX * (0.5 + progress * MATCHUP_SIZE);
      ctx.fillStyle = "rgba(245, 184, 46, 0.18)";
      ctx.fillRect(MATCHUP_BOARD_X, y - 3, MATCHUP_BOARD_W, 6);
      ctx.fillRect(x - 3, MATCHUP_BOARD_Y, 6, MATCHUP_BOARD_H);
      ctx.beginPath();
      ctx.moveTo(x - spread, y);
      ctx.lineTo(x + spread, y);
      ctx.moveTo(x, y - spread);
      ctx.lineTo(x, y + spread);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 8 + progress * MATCHUP_CELL_PX * 1.8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawAnimated(ctx: CanvasRenderingContext2D, state: MatchupState, elapsedMs: number, time: number): void {
  const still = reducedMotion();
  let remaining = elapsedMs;
  for (const [stepOffset, step] of state.lastAnimation.entries()) {
    // matchupRev 2 animates one step at a time; its chain depth is the sim's own count.
    const stepIndex = state.rev ? Math.max(0, state.lastSteps - 1) : stepOffset;
    const { clear: clearMs, drop: dropMs } = matchupStepTiming(step, state);
    if (remaining >= clearMs + dropMs) {
      remaining -= clearMs + dropMs;
      continue;
    }
    const cleared = new Set(step.cleared);
    if (remaining < clearMs) {
      const p = remaining / clearMs;
      drawGrid(ctx);
      for (let index = 0; index < MATCHUP_ROWS * MATCHUP_SIZE; index++) {
        if (cleared.has(index)) continue;
        const { x, y } = centre(index);
        drawMatchupGem(ctx, animatedKind(step, index), x, y, RADIUS, time);
      }
      let budget=16;
      for (const index of cleared) {const shards=Math.min(4,budget);budget-=shards;shatter(ctx,animatedKind(step,index),index,p,still,shards,stepIndex+1);}
      if(stepIndex>0){ctx.save();ctx.globalAlpha=1-p;ctx.fillStyle=MATCHUP_GOLD;ctx.font="700 20px 'JetBrains Mono', monospace";ctx.textAlign="right";ctx.textBaseline="top";ctx.fillText(`×${stepIndex+1}`,MATCHUP_BOARD_X+MATCHUP_BOARD_W-8,12);ctx.restore();}
      drawDetonations(ctx, step, Math.min(1, remaining / Math.min(MATCHUP_DETONATE_MS, clearMs * 1.25)));
      return;
    }
    const p = Math.min(1, (remaining - clearMs) / dropMs);
    drawGrid(ctx);
    for (let row = 0; row < MATCHUP_ROWS; row++) {
      for (let col = 0; col < MATCHUP_SIZE; col++) {
        const index = matchupIndex(row, col);
        if (cleared.has(index)) continue;
        if (step.moves.some((move) => move.fromRow === row && move.fromCol === col)) continue;
        const { x, y } = centre(index);
        drawMatchupGem(ctx, animatedKind(step, index), x, y, RADIUS, time);
      }
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(MATCHUP_BOARD_X, MATCHUP_BOARD_Y, MATCHUP_BOARD_W, MATCHUP_BOARD_H);
    ctx.clip();
    for (const move of step.moves) {
      const from = centre(matchupIndex(move.fromRow, move.fromCol));
      const to = centre(matchupIndex(move.toRow, move.toCol));
      drawMatchupGem(ctx, move.kind, from.x + (to.x - from.x) * p, from.y + (to.y - from.y) * p, RADIUS, time);
    }
    ctx.restore();
    return;
  }
  drawSettled(ctx, state.cells, time);
}

interface SceneOptions {
  animationMs?: number | null;
  cells?: readonly number[];
  skip?: ReadonlySet<number>;
}

/**
 * Cascade labels (presentation only): each clear (a swap's or a cascade
 * step's) labels its chain count on the first cell it cleared, read from the
 * sim's lastCleared (Tuning C removed the sparks and rings over the gems). Memory per canvas, keyed by the sim's clear
 * counters; a rewind (new run, replay, demo loop) resets it, and the first
 * frame a canvas sees never fires. Replaces the old ambient glints, which
 * sparkled on random gems and read as stray cascade effects.
 */
interface ClearBurst { tick: number; cells: number[]; steps: number }
interface ClearMemory { tick: number; key: string; bursts: ClearBurst[] }
const clearMemories = new WeakMap<CanvasRenderingContext2D, ClearMemory>();
const CLEAR_BURST_TICKS = 30;

function clearKey(state: MatchupState): string {
  return `${state.lastScoreTick}:${state.cascades}:${state.resolveSerial ?? 0}`;
}

function drawClearBursts(ctx: CanvasRenderingContext2D, state: MatchupState): void {
  let m = clearMemories.get(ctx);
  const key = clearKey(state);
  if (!m || state.tick < m.tick) {
    m = { tick: state.tick, key, bursts: [] };
    clearMemories.set(ctx, m);
  }
  if (key !== m.key && state.tick !== m.tick && state.lastCleared.length > 0) {
    m.bursts.push({ tick: state.tick, cells: state.lastCleared.slice(0, 24), steps: state.lastSteps });
    if (m.bursts.length > 3) m.bursts.shift();
  }
  m.key = key;
  m.tick = state.tick;
  const still = reducedMotion();
  const life = still ? 10 : CLEAR_BURST_TICKS;
  m.bursts = m.bursts.filter((burst) => state.tick - burst.tick >= 0 && state.tick - burst.tick < life);
  if (m.bursts.length === 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(MATCHUP_BOARD_X, MATCHUP_BOARD_Y, MATCHUP_BOARD_W, MATCHUP_BOARD_H);
  ctx.clip();
  for (const burst of m.bursts) {
    const p = (state.tick - burst.tick) / life;
    // Tuning C: no sparks or rings over the cleared gems (they read as bubbles); only the chain count text.
    // The chain count sits on the first cleared gem, as before.
    if (burst.steps > 1 && burst.cells.length > 0) {
      const { x, y } = centre(burst.cells[0]!);
      ctx.globalAlpha = Math.max(0, 1 - p);
      ctx.font = "700 16px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = MATCHUP_GOLD;
      ctx.fillText(`×${burst.steps}`, x, y - RADIUS * 0.6 - (still ? 0 : p * 6));
    }
  }
  ctx.restore();
}

/** The board drawing through the shared success layer (presentation only). */
function drawScene(ctx: CanvasRenderingContext2D, state: MatchupState, size: CanvasSize, options: SceneOptions = {}): void {
  arcadeFx(ctx, MATCHUP_FX, state, () => drawSceneWorld(ctx, state, size, options), size);
}

function drawSceneWorld(ctx: CanvasRenderingContext2D, state: MatchupState, size: CanvasSize, options: SceneOptions = {}): void {
  const time = reducedMotion() ? 0 : state.tick / 60;
  const { scale, offsetX, offsetY } = matchupTransform(size);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = "rgba(11,11,15,0.6)";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  drawBackdrop(ctx);
  drawNextStrip(ctx, state, time);
  drawFrame(ctx);
  const animationMs = options.animationMs;
  const animating = animationMs != null && state.lastAnimation.length > 0;
  if (animating && animationMs != null) drawAnimated(ctx, state, animationMs, time);
  else drawSettled(ctx, options.cells ?? state.cells, time, options.skip);

  if (!animating && !options.cells && !matchupPending(state) && matchupShowHint(state)) {
    const hint = matchupFindSwap(state.cells);
    if (hint) {
      ctx.strokeStyle = MATCHUP_GOLD;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      for (const cell of [{ row: hint.row1, col: hint.col1 }, { row: hint.row2, col: hint.col2 }]) {
        ctx.strokeRect(MATCHUP_BOARD_X + cell.col * MATCHUP_CELL_PX + 3, MATCHUP_BOARD_Y + cell.row * MATCHUP_CELL_PX + 3,
          MATCHUP_CELL_PX - 6, MATCHUP_CELL_PX - 6);
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.font = "600 20px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = MATCHUP_TEXT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  successHud(ctx,'matchup',state.tick,12,12,()=>{ctx.fillText(`${state.raw} pts`, 12, 12);});
  if (!options.cells) drawClearBursts(ctx, state);
  ctx.restore();
}

export function drawMatchupArt(ctx: CanvasRenderingContext2D, state: MatchupState, size: CanvasSize): void {
  drawScene(ctx, state, size);
}

export function drawMatchupArtAnimated(ctx: CanvasRenderingContext2D, state: MatchupState, size: CanvasSize, elapsedMs: number): void {
  drawScene(ctx, state, size, { animationMs: elapsedMs });
}

/** Selected gem glows gold. */
export function drawMatchupArtSelection(ctx: CanvasRenderingContext2D, size: CanvasSize, row: number, col: number): void {
  const { scale, offsetX, offsetY } = matchupTransform(size);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.shadowColor = "rgba(245,184,46,0.9)";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = MATCHUP_GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(MATCHUP_BOARD_X + col * MATCHUP_CELL_PX + 2, MATCHUP_BOARD_Y + row * MATCHUP_CELL_PX + 2,
    MATCHUP_CELL_PX - 4, MATCHUP_CELL_PX - 4, 8);
  ctx.stroke();
  ctx.restore();
}

/** Draw the original gems moving; never interpolate or mutate sim cells. */
export function drawMatchupSwap(
  ctx: CanvasRenderingContext2D,
  state: MatchupState,
  size: CanvasSize,
  tween: MatchupSwapTween,
  elapsedMs: number,
): void {
  drawScene(ctx, { ...state, heads: tween.before.heads }, size, {
    cells: tween.before.cells, skip: new Set([tween.a, tween.b]),
  });
  const { scale, offsetX, offsetY } = matchupTransform(size);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  const a = centre(tween.a);
  const b = centre(tween.b);
  const p = matchupSwapProgress(elapsedMs, tween.rejected);
  drawMatchupGem(ctx, tween.before.cells[tween.a] ?? 0, a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, RADIUS);
  drawMatchupGem(ctx, tween.before.cells[tween.b] ?? 0, b.x + (a.x - b.x) * p, b.y + (a.y - b.y) * p, RADIUS);
  ctx.restore();
}

/** The sim with the art renderer swapped in; step/score are the sim's own. */
export const matchupArtGame = { ...matchupGame, draw: drawMatchupArt };

/**
 * Arena scene (15 Oct 2026, display only; arenaScene.renderer.ts): the velvet backdrop
 * continues past the world to the arena box's edges, starting from the world's own
 * bottom colour, with faint margin sparkles. No gems, sockets or anything that moves.
 */
export function matchupArenaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const W = MATCHUP_WORLD_W, H = MATCHUP_WORLD_H;
  for (const side of sceneSides(view))
    sceneFill(ctx, side, 0, H, [[0, "#1B1131"], [0.55, "#130E21"], [1, "#0B0B0F"]]);
  const below = sceneBelow(view);
  if (!below) return;
  sceneFill(ctx, below, H, view.bottom, [[0, "#0B0B0F"], [Math.min(0.5, 90 / below.h), "#120D1F"], [1, "#160F28"]]);
  const glow = ctx.createRadialGradient(W / 2, view.bottom, 10, W / 2, view.bottom, Math.max(below.h, W * 0.6));
  glow.addColorStop(0, "rgba(120,80,200,0.14)");
  glow.addColorStop(1, "rgba(120,80,200,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(below.x, below.y, below.w, below.h);
  // Sparkles at the backdrop's own density, clear of the world's edge.
  const count = Math.round((below.w * below.h) / 4700);
  for (let k = 0; k < count; k++) {
    const h = artHash(k, 977);
    const x = below.x + (h % 10007) / 10007 * below.w;
    const y = below.y + 10 + ((h >>> 14) % 10009) / 10009 * Math.max(0, below.h - 14);
    const r = 0.8 + ((h >>> 20) % 3) * 0.6;
    ctx.globalAlpha = 0.25 + ((h >>> 4) % 4) * 0.08;
    ctx.fillStyle = MATCHUP_COLOURS[k % MATCHUP_COLOURS.length] ?? MATCHUP_GOLD;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 2.2);
    ctx.lineTo(x + r * 0.5, y - r * 0.5);
    ctx.lineTo(x + r * 2.2, y);
    ctx.lineTo(x + r * 0.5, y + r * 0.5);
    ctx.lineTo(x, y + r * 2.2);
    ctx.lineTo(x - r * 0.5, y + r * 0.5);
    ctx.lineTo(x - r * 2.2, y);
    ctx.lineTo(x - r * 0.5, y - r * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
