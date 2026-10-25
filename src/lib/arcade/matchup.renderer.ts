/**
 * Matchup art pass and swap tween. Render only: reads MatchupState and never
 * mutates it. Gems sit on the sim's cell centres at the sim's symbol radius;
 * each colour keeps its own cut so shapes stay distinguishable.
 */
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import type { CanvasSize } from "./engine";
import { arcadeFx } from "./arcadeFx.renderer";
import { MATCHUP_FX, fxSpecAt } from "./arcadeFxGames.renderer";
import type { SoundId } from "@/lib/fx/manifest";
import {
  matchupGame, matchupIndex, matchupShowHint, matchupTransform,
  MATCHUP_BOARD_W, MATCHUP_BOARD_X, MATCHUP_BOARD_Y, MATCHUP_BOMB, MATCHUP_CELL_PX,
  MATCHUP_CLEAR_MS, MATCHUP_COLOURS, MATCHUP_CROSS, MATCHUP_DETONATE_MS, MATCHUP_DROP_MS, MATCHUP_GOLD,
  MATCHUP_NEXT_H, MATCHUP_NEXT_Y, MATCHUP_QUEUE_LEN, MATCHUP_ROWS, MATCHUP_SHAPES, MATCHUP_SIZE, MATCHUP_STAR,
  MATCHUP_SYMBOL_PCT, MATCHUP_TEXT, MATCHUP_JACKPOT, MATCHUP_WORLD_H, MATCHUP_WORLD_W, matchupIsJackpot, matchupPending, matchupStepTiming,
  matchupHintSwap, matchupRowsOf, matchupWorldH, MATCHUP_TREASURE, MATCHUP_V9_PANEL_Y, MATCHUP_V9_TREASURES,
  type MatchupAnimStep, type MatchupState,
} from "./matchup";
import { artHash, reducedMotion } from "./art.renderer";
import { sceneBelow, sceneFill, sceneSides, type ArenaSceneView } from "./arenaScene.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { successHud } from "./success.renderer";

/** Nine frames at 60 Hz, independent of simulation ticks. */
export const MATCHUP_SWAP_MS = 150;
const RADIUS = (MATCHUP_CELL_PX * MATCHUP_SYMBOL_PCT) / 200;

/**
 * The board this frame draws (matchupRev 9: ten rows in a 390 × 720 world; eight in 390 × 560 before it). Set
 * from the state at the start of every draw call; render only.
 */
interface BoardLayout { rows: number; boardH: number; worldH: number }
const layoutOf = (rows: number, worldH: number): BoardLayout => ({ rows, boardH: rows * MATCHUP_CELL_PX, worldH });
const LAYOUT_8 = layoutOf(MATCHUP_ROWS, MATCHUP_WORLD_H);
let L: BoardLayout = LAYOUT_8;
function useLayout(state: MatchupState): void {
  const rows = matchupRowsOf(state.cells);
  L = rows === MATCHUP_ROWS ? LAYOUT_8 : L.rows === rows ? L : layoutOf(rows, matchupWorldH(state));
}
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
  } else if (kind === MATCHUP_TREASURE) {
    // matchupRev 9's treasure gem: a gold octagon medallion (no colour gem's cut) round a ruby, in a bright rim.
    const pts: Array<[number, number]> = [];
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + Math.PI / 8 + (k * Math.PI) / 4;
      pts.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
    }
    facetedGem(ctx, pts, cx, cy, radius, "#FFCF4A");
    pathOf(ctx, pts);
    ctx.strokeStyle = "#FFF4C2";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    const ruby = cutPoints("circle", cx, cy, radius * 0.42);
    facetedGem(ctx, ruby, cx, cy, radius * 0.42, "#E0245E");
    ctx.fillStyle = "#7A4A00";
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI / 4 + (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * radius * 0.68, cy + Math.sin(a) * radius * 0.68, radius * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
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
const boardLayers = new WeakMap<CanvasRenderingContext2D, { canvas: ArtCanvas; cells: number[]; k: number; rows: number }>();

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
  const h = L.boardH + 10;
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
  for (let row = 0; row < L.rows; row++) {
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      drawSocket(ctx, MATCHUP_BOARD_X + col * MATCHUP_CELL_PX, MATCHUP_BOARD_Y + row * MATCHUP_CELL_PX, (row + col) % 2);
    }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(MATCHUP_BOARD_X + 1, MATCHUP_BOARD_Y + 1, MATCHUP_BOARD_W - 2, L.boardH - 2);
}

/**
 * Polish G: the world behind the board, painted once per device scale: deep
 * violet velvet fading to the arena fill at the bottom edge, a soft glow
 * behind the board and faint gem-coloured sparkles in the margins. No text.
 */
function paintBackdrop(c: CanvasRenderingContext2D): void {
  const W = MATCHUP_WORLD_W, H = L.worldH;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1B1131");
  g.addColorStop(0.55, "#130E21");
  g.addColorStop(1, "#0B0B0F");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const glow = c.createRadialGradient(W / 2, MATCHUP_BOARD_Y + L.boardH * 0.45, 40, W / 2, MATCHUP_BOARD_Y + L.boardH * 0.45, W * 0.75);
  glow.addColorStop(0, "rgba(120,80,200,0.22)");
  glow.addColorStop(1, "rgba(120,80,200,0)");
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);
  // Diagonal sheen bands, fading out before the world's bottom edge so they never end in a line (A3).
  c.save();
  const sheen = c.createLinearGradient(0, 0, 0, H);
  sheen.addColorStop(0, "rgba(255,255,255,0.05)");
  sheen.addColorStop(0.7, "rgba(255,255,255,0.035)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = sheen;
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
  paintTray(c);
  // Sparkles in the margins only (never behind a gem).
  const boardTop = TRAY_Y - 4, boardBottom = TRAY_Y + trayH() + 6;
  for (let k = 0; k < 46; k++) {
    const h = artHash(k, 431);
    const x = h % W;
    const y = (h >>> 9) % H;
    const inBoard = y > boardTop && y < boardBottom && x > TRAY_X - 4 && x < TRAY_X + TRAY_W + 4;
    // Clear of the HUD row too (the score and the collection bar, A3).
    if (inBoard || y < 46) continue;
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

/**
 * Polish A3 (display only): a velvet tray under the next strip and the board, lifted off the
 * backdrop by a soft purple glow. It sits in the world's margins round the board (inside the
 * world rectangle), painted into the cached backdrop; the board and gems draw over it unchanged.
 */
const TRAY_X = MATCHUP_BOARD_X - 13;
const TRAY_Y = MATCHUP_NEXT_Y - 9;
const TRAY_W = MATCHUP_BOARD_W + 26;
/** The tray's height for the board being drawn. */
const trayH = () => MATCHUP_BOARD_Y + L.boardH + 13 - TRAY_Y;
function paintTray(c: CanvasRenderingContext2D): void {
  const cx = TRAY_X + TRAY_W / 2;
  // The glow: wide and soft, strongest under the tray's lower half.
  const glow = c.createRadialGradient(cx, TRAY_Y + trayH() * 0.62, TRAY_W * 0.2, cx, TRAY_Y + trayH() * 0.62, trayH() * 0.72);
  glow.addColorStop(0, "rgba(150,90,255,0.30)");
  glow.addColorStop(0.55, "rgba(130,70,230,0.12)");
  glow.addColorStop(1, "rgba(120,60,220,0)");
  c.fillStyle = glow;
  c.fillRect(0, 0, MATCHUP_WORLD_W, L.worldH);
  // A soft drop shadow under the tray.
  c.save();
  c.beginPath();
  c.roundRect(TRAY_X + 2, TRAY_Y + 6, TRAY_W - 4, trayH(), 16);
  c.fillStyle = "rgba(4,2,10,0.45)";
  c.fill();
  c.restore();
  // The velvet: deep plum, lit from above, with a fine nap.
  c.save();
  c.beginPath();
  c.roundRect(TRAY_X, TRAY_Y, TRAY_W, trayH(), 16);
  const velvet = c.createLinearGradient(0, TRAY_Y, 0, TRAY_Y + trayH());
  velvet.addColorStop(0, "#3A2160");
  velvet.addColorStop(0.18, "#2A1748");
  velvet.addColorStop(0.75, "#1E1036");
  velvet.addColorStop(1, "#170C2A");
  c.fillStyle = velvet;
  c.fill();
  c.clip();
  const sheenV = c.createRadialGradient(cx, TRAY_Y, 10, cx, TRAY_Y, TRAY_W * 0.8);
  sheenV.addColorStop(0, "rgba(200,150,255,0.18)");
  sheenV.addColorStop(1, "rgba(200,150,255,0)");
  c.fillStyle = sheenV;
  c.fillRect(TRAY_X, TRAY_Y, TRAY_W, trayH());
  for (let k = 0; k < 900; k++) {
    const h = artHash(k, 613);
    c.fillStyle = h % 2 ? "rgba(255,230,255,0.035)" : "rgba(0,0,0,0.10)";
    c.fillRect(TRAY_X + (h % TRAY_W), TRAY_Y + ((h >>> 10) % trayH()), 1, 1);
  }
  // Inner shadow round the rim, so the tray reads as padded.
  c.lineWidth = 6;
  c.strokeStyle = "rgba(0,0,0,0.28)";
  c.beginPath();
  c.roundRect(TRAY_X + 1, TRAY_Y + 3, TRAY_W - 2, trayH() - 2, 15);
  c.stroke();
  c.restore();
  // Piping: a lit top lip and a thin gold cord.
  c.beginPath();
  c.roundRect(TRAY_X + 0.5, TRAY_Y + 0.5, TRAY_W - 1, trayH() - 1, 16);
  c.strokeStyle = "rgba(210,170,255,0.30)";
  c.lineWidth = 1;
  c.stroke();
  c.beginPath();
  c.roundRect(TRAY_X + 3.5, TRAY_Y + 3.5, TRAY_W - 7, trayH() - 7, 13);
  c.strokeStyle = "rgba(245,184,46,0.22)";
  c.stroke();
}

const backdrops = new WeakMap<CanvasRenderingContext2D, { key: string; layer: ArtCanvas }>();
function drawBackdrop(ctx: CanvasRenderingContext2D): void {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  // Reduced effects (lib/fx/lowEnd.ts, slow devices only): at the canvas's own scale even below 1, so it is copied 1:1.
  const scale = Math.min(3, Math.max(arcadeReducedEffects() ? 0.25 : 1, t ? Math.hypot(t.a, t.b) : 1));
  const key = `${scale.toFixed(3)}:${L.rows}`;
  let cached = backdrops.get(ctx);
  if (!cached || cached.key !== key) {
    const layer = artCanvas(Math.ceil(MATCHUP_WORLD_W * scale), Math.ceil(L.worldH * scale));
    const native = layer && artContext(layer);
    if (!layer || !native) {
      paintBackdrop(ctx);
      return;
    }
    native.scale(scale, scale);
    paintBackdrop(native as CanvasRenderingContext2D);
    backdrops.set(ctx, (cached = { key, layer }));
  }
  ctx.drawImage(cached.layer as CanvasImageSource, 0, 0, MATCHUP_WORLD_W, L.worldH);
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
  if (!layer||layer.k!==k||layer.rows!==L.rows) { const canvas=artCanvas(Math.round(MATCHUP_BOARD_W*k),Math.round(L.boardH*k)); layer=undefined; if(canvas){layer={canvas,cells:[],k,rows:L.rows};boardLayers.set(ctx,layer);} }
  const native=layer&&artContext(layer.canvas);
  if(layer&&native){const c=native as CanvasRenderingContext2D;c.save();c.scale(layer.canvas.width/MATCHUP_BOARD_W,layer.canvas.height/L.boardH);
   for(let i=0;i<cells.length;i++){if(layer.cells[i]===cells[i])continue;const x=(i%MATCHUP_SIZE)*MATCHUP_CELL_PX,y=Math.floor(i/MATCHUP_SIZE)*MATCHUP_CELL_PX;
    c.clearRect(x,y,MATCHUP_CELL_PX,MATCHUP_CELL_PX);drawSocket(c,x,y,(Math.floor(i/MATCHUP_SIZE)+i%MATCHUP_SIZE)%2);
    drawMatchupGem(c,cells[i]??0,x+MATCHUP_CELL_PX/2,y+MATCHUP_CELL_PX/2,RADIUS,time);layer.cells[i]=cells[i]??0;
   }c.restore();ctx.drawImage(layer.canvas,MATCHUP_BOARD_X,MATCHUP_BOARD_Y,MATCHUP_BOARD_W,L.boardH);
   ctx.strokeStyle="rgba(0,0,0,0.5)";ctx.lineWidth=2;ctx.strokeRect(MATCHUP_BOARD_X+1,MATCHUP_BOARD_Y+1,MATCHUP_BOARD_W-2,L.boardH-2);return;
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
      ctx.fillRect(x - 5, MATCHUP_BOARD_Y, 10, L.boardH);
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
      ctx.fillRect(x - 3, MATCHUP_BOARD_Y, 6, L.boardH);
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
      for (let index = 0; index < L.rows * MATCHUP_SIZE; index++) {
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
    for (let row = 0; row < L.rows; row++) {
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
    ctx.rect(MATCHUP_BOARD_X, MATCHUP_BOARD_Y, MATCHUP_BOARD_W, L.boardH);
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
 * The collection bar (Polish A3, presentation only): one small gem per colour with the number of
 * that colour cleared so far and a bar against the leading colour. Counted from the sim's own
 * animation steps (each new `lastAnimation`: the cleared cells' kinds in `before`), in memory per
 * canvas like the cascade labels; it shows only on a canvas that has watched the run from its
 * start (live play), never on a reveal or a demo joined part-way, and a rewind resets it.
 */
interface CollectMemory { tick: number; start: number; anim: MatchupAnimStep[]; counts: number[]; flash: number[] }
const collectMemories = new WeakMap<CanvasRenderingContext2D, CollectMemory>();
const COLLECT_X = 176;
const COLLECT_SLOT = (MATCHUP_WORLD_W - 10 - COLLECT_X) / 6;

function drawCollection(ctx: CanvasRenderingContext2D, state: MatchupState, time: number): void {
  let m = collectMemories.get(ctx);
  if (!m || state.tick < m.tick) {
    m = { tick: state.tick, start: state.tick, anim: state.lastAnimation, counts: [0, 0, 0, 0, 0, 0], flash: [-99, -99, -99, -99, -99, -99] };
    collectMemories.set(ctx, m);
  }
  if (state.lastAnimation !== m.anim) {
    m.anim = state.lastAnimation;
    for (const step of state.lastAnimation) {
      for (const index of new Set([...step.cleared, ...step.detonated])) {
        const kind = step.before[index] ?? -1;
        if (kind >= 0 && kind < 6) {
          m.counts[kind] = (m.counts[kind] ?? 0) + 1;
          m.flash[kind] = state.tick;
        }
      }
    }
  }
  m.tick = state.tick;
  if (m.start > 30) return;
  const lead = Math.max(10, ...m.counts);
  const still = reducedMotion();
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (let kind = 0; kind < 6; kind++) {
    const x = COLLECT_X + kind * COLLECT_SLOT;
    const n = m.counts[kind] ?? 0;
    const colour = MATCHUP_COLOURS[kind] ?? MATCHUP_GOLD;
    const since = state.tick - (m.flash[kind] ?? -99);
    // A just-collected colour glows for half a second.
    if (since >= 0 && since < 30) {
      const g = ctx.createRadialGradient(x + 8, 20, 0, x + 8, 20, 14);
      g.addColorStop(0, colour);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.45 * (1 - since / 30);
      ctx.fillStyle = g;
      ctx.fillRect(x - 6, 6, 28, 28);
      ctx.globalAlpha = 1;
    }
    drawMatchupGem(ctx, kind, x + 8, 20, still || since >= 12 || since < 0 ? 7 : 7 + (1 - since / 12) * 1.5, time);
    ctx.fillStyle = n > 0 ? MATCHUP_TEXT : "rgba(247,247,248,0.45)";
    // Three digits step down to 10 px so the count stays inside its slot.
    ctx.font = n >= 100 ? "700 10px 'JetBrains Mono', ui-monospace, monospace" : "700 12px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillText(`${n}`, x + 16.5, 21);
    // The progress bar: a dark well and the colour's share of the leader.
    const bw = COLLECT_SLOT - 6;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, 32, bw, 3);
    if (n > 0) {
      ctx.fillStyle = colour;
      ctx.fillRect(x, 32, Math.max(1.5, (bw * n) / lead), 3);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x, 32, Math.max(1.5, (bw * n) / lead), 1);
    }
  }
  ctx.restore();
}

/* ============================ matchupRev 9: ice, goals, banners ============================ */

/** A frozen cell: pale frosted glass over the gem, a white rim, two cracks and frost in the corners. */
function paintIce(c: CanvasRenderingContext2D, s: number): void {
  const inset = 2.5;
  c.beginPath();
  c.roundRect(inset, inset, s - inset * 2, s - inset * 2, 7);
  const glass = c.createLinearGradient(0, 0, s, s);
  glass.addColorStop(0, "rgba(220,245,255,0.52)");
  glass.addColorStop(0.5, "rgba(170,225,255,0.30)");
  glass.addColorStop(1, "rgba(140,205,255,0.42)");
  c.fillStyle = glass;
  c.fill();
  c.strokeStyle = "rgba(240,252,255,0.9)";
  c.lineWidth = 1.5;
  c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.75)";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(s * 0.18, s * 0.3);
  c.lineTo(s * 0.4, s * 0.46);
  c.lineTo(s * 0.36, s * 0.66);
  c.moveTo(s * 0.4, s * 0.46);
  c.lineTo(s * 0.62, s * 0.4);
  c.moveTo(s * 0.7, s * 0.72);
  c.lineTo(s * 0.84, s * 0.6);
  c.stroke();
  c.fillStyle = "rgba(255,255,255,0.85)";
  for (const [x, y] of [[0.16, 0.16], [0.84, 0.16], [0.16, 0.84], [0.84, 0.84]] as const) {
    c.beginPath();
    c.arc(s * x, s * y, 1.6, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "rgba(255,255,255,0.35)";
  c.fillRect(inset + 4, inset + 3, s * 0.36, 2);
}

let iceSprite: ArtCanvas | null = null;
function drawIce(ctx: CanvasRenderingContext2D, ice: readonly number[] | undefined): void {
  if (!ice) return;
  if (!iceSprite) {
    const canvas = artCanvas(MATCHUP_CELL_PX * 2, MATCHUP_CELL_PX * 2);
    const native = canvas && artContext(canvas);
    if (canvas && native) {
      native.scale(2, 2);
      paintIce(native as CanvasRenderingContext2D, MATCHUP_CELL_PX);
      iceSprite = canvas;
    }
  }
  for (let index = 0; index < ice.length; index++) {
    if (!ice[index]) continue;
    const x = MATCHUP_BOARD_X + (index % MATCHUP_SIZE) * MATCHUP_CELL_PX;
    const y = MATCHUP_BOARD_Y + Math.floor(index / MATCHUP_SIZE) * MATCHUP_CELL_PX;
    if (iceSprite) ctx.drawImage(iceSprite as CanvasImageSource, x, y, MATCHUP_CELL_PX, MATCHUP_CELL_PX);
    else {
      ctx.save();
      ctx.translate(x, y);
      paintIce(ctx, MATCHUP_CELL_PX);
      ctx.restore();
    }
  }
}

/** The goals panel under the board: the level, each goal colour's gems still to collect, ice left and treasure found. */
function drawGoalsPanel(ctx: CanvasRenderingContext2D, state: MatchupState, time: number): void {
  const x = MATCHUP_BOARD_X - 5, y = MATCHUP_V9_PANEL_Y, w = MATCHUP_BOARD_W + 10, h = 84;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  const tray = ctx.createLinearGradient(0, y, 0, y + h);
  tray.addColorStop(0, "rgba(10,8,16,0.78)");
  tray.addColorStop(1, "rgba(60,48,84,0.5)");
  ctx.fillStyle = tray;
  ctx.fill();
  ctx.strokeStyle = "rgba(245,184,46,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = "700 12px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = MATCHUP_GOLD;
  ctx.fillText(`LEVEL ${(state.level ?? 0) + 1}`, x + 12, y + 17);
  ctx.fillStyle = "rgba(247,247,248,0.62)";
  ctx.fillText("COLLECT", x + 12, y + 33);
  // Goal gems: a gem, then the count still needed (a tick once done).
  const goal = state.goalLeft ?? [];
  const need = state.plan?.need[Math.min(state.level ?? 0, (state.plan?.need.length ?? 1) - 1)] ?? 0;
  const colours = goal.flatMap((left, kind) => ((state.plan?.colours[Math.min(state.level ?? 0, (state.plan?.colours.length ?? 1) - 1)] ?? []).includes(kind) ? [{ kind, left }] : []));
  colours.forEach(({ kind, left }, i) => {
    const gx = x + 96 + i * 66;
    drawMatchupGem(ctx, kind, gx, y + 25, 11, time);
    ctx.font = "700 15px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillStyle = left === 0 ? "#7CF5A4" : MATCHUP_TEXT;
    ctx.fillText(left === 0 ? "✓" : `${left}`, gx + 15, y + 26);
    const bw = 50;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(gx - 11, y + 41, bw, 3);
    ctx.fillStyle = MATCHUP_COLOURS[kind] ?? MATCHUP_GOLD;
    ctx.fillRect(gx - 11, y + 41, need > 0 ? (bw * (need - left)) / need : 0, 3);
  });
  // Bottom line: ice still on the board, treasure collected, the cascade multiplier's extra points.
  const iceLeft = (state.ice ?? []).reduce((n, v) => n + (v ? 1 : 0), 0);
  ctx.font = "600 12px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "rgba(247,247,248,0.8)";
  if (iceSprite) ctx.drawImage(iceSprite as CanvasImageSource, x + 12, y + 54, 20, 20);
  ctx.fillText(`${iceLeft} left`, x + 37, y + 64);
  drawMatchupGem(ctx, MATCHUP_TREASURE, x + 120, y + 64, 9, time);
  ctx.fillText(`${state.treasures ?? 0}/${MATCHUP_V9_TREASURES}`, x + 134, y + 64);
  ctx.fillStyle = MATCHUP_GOLD;
  ctx.textAlign = "right";
  ctx.fillText(`cascades +${state.cascadeExtra ?? 0}`, x + w - 12, y + 64);
  ctx.restore();
}

/**
 * Banners for a goal met and a treasure collected (memory per canvas, keyed by the sim's counters; render only).
 * A deep cascade's multiplier already has the shared layer's "CASCADE ×n" banner.
 */
interface BannerMemory { tick: number; levels: number; treasures: number; mult: number; banners: { text: string; tick: number; gold: boolean }[] }
const bannerMemories = new WeakMap<CanvasRenderingContext2D, BannerMemory>();
function drawBanners(ctx: CanvasRenderingContext2D, state: MatchupState): void {
  let m = bannerMemories.get(ctx);
  if (!m || state.tick < m.tick) {
    m = { tick: state.tick, levels: state.levels ?? 0, treasures: state.treasures ?? 0, mult: state.swaps, banners: [] };
    bannerMemories.set(ctx, m);
  }
  if ((state.levels ?? 0) > m.levels) m.banners.push({ text: "GOAL!", tick: state.tick, gold: false });
  if ((state.treasures ?? 0) > m.treasures) m.banners.push({ text: "TREASURE!", tick: state.tick, gold: true });
  m.levels = state.levels ?? 0;
  m.treasures = state.treasures ?? 0;
  m.mult = state.swaps;
  m.tick = state.tick;
  const still = reducedMotion();
  const life = 60;
  m.banners = m.banners.filter((b) => state.tick - b.tick < life).slice(-2);
  m.banners.forEach((b, i) => {
    const p = (state.tick - b.tick) / life;
    const cy = MATCHUP_BOARD_Y + L.boardH * 0.42 + i * 34 - (still ? 0 : p * 14);
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - p) * 3);
    ctx.font = "800 26px Archivo, ui-sans-serif, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(8,4,16,0.85)";
    ctx.lineWidth = 6;
    ctx.strokeText(b.text, MATCHUP_WORLD_W / 2, cy);
    ctx.fillStyle = b.gold ? MATCHUP_GOLD : "#BFE9FF";
    ctx.fillText(b.text, MATCHUP_WORLD_W / 2, cy);
    ctx.restore();
  });
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
  ctx.rect(MATCHUP_BOARD_X, MATCHUP_BOARD_Y, MATCHUP_BOARD_W, L.boardH);
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
  // matchupRev 9: the shared layer spans the taller world (fxSpecAt, as the other taller worlds do).
  arcadeFx(ctx, fxSpecAt(MATCHUP_FX, matchupWorldH(state)), state, () => drawSceneWorld(ctx, state, size, options), size);
}

function drawSceneWorld(ctx: CanvasRenderingContext2D, state: MatchupState, size: CanvasSize, options: SceneOptions = {}): void {
  const time = reducedMotion() ? 0 : state.tick / 60;
  useLayout(state);
  const { scale, offsetX, offsetY } = matchupTransform(size, L.worldH);
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
  // matchupRev 9: frozen cells over the gems, and the goals panel under the board.
  if (state.goals) {
    drawIce(ctx, state.ice);
    drawGoalsPanel(ctx, state, time);
  }

  if (!animating && !options.cells && !matchupPending(state) && matchupShowHint(state)) {
    const hint = matchupHintSwap(state);
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
  // A bigger score (A3): the number large, "pts" small beside it, on a soft shadow.
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  successHud(ctx,'matchup',state.tick,12,12,()=>{
    const num = `${state.raw}`;
    ctx.font = "700 28px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(num, 13, 39);
    ctx.fillStyle = MATCHUP_TEXT;
    ctx.fillText(num, 12, 38);
    const w = ctx.measureText(num).width;
    ctx.font = "600 13px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillStyle = "rgba(247,247,248,0.62)";
    ctx.fillText("pts", 12 + w + 5, 37);
  });
  drawCollection(ctx, state, time);
  if (!options.cells) drawClearBursts(ctx, state);
  if (state.goals && !options.cells) drawBanners(ctx, state);
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
  const { scale, offsetX, offsetY } = matchupTransform(size, L.worldH);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  const x = MATCHUP_BOARD_X + col * MATCHUP_CELL_PX + 2;
  const y = MATCHUP_BOARD_Y + row * MATCHUP_CELL_PX + 2;
  const s = MATCHUP_CELL_PX - 4;
  // A3: a glowing gold frame: a warm wash in the cell, a soft outer glow, a metallic rim and a
  // bright inner line, inside the cell's own square.
  const wash = ctx.createRadialGradient(x + s / 2, y + s / 2, s * 0.2, x + s / 2, y + s / 2, s * 0.7);
  wash.addColorStop(0, "rgba(255,214,110,0)");
  wash.addColorStop(1, "rgba(255,200,80,0.22)");
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, 8);
  ctx.fill();
  ctx.shadowColor = "rgba(255,196,60,0.95)";
  ctx.shadowBlur = 14;
  const rim = ctx.createLinearGradient(x, y, x + s, y + s);
  rim.addColorStop(0, "#FFE9A3");
  rim.addColorStop(0.45, MATCHUP_GOLD);
  rim.addColorStop(1, "#C98A0E");
  ctx.strokeStyle = rim;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,246,214,0.75)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 2.5, y + 2.5, s - 5, s - 5, 6);
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
  const scene = { ...state, heads: tween.before.heads };
  const options = { cells: tween.before.cells, skip: new Set([tween.a, tween.b]) };
  // The two sliding gems are part of the world, so the shared layer's effects (a refused swap's
  // miss puff, Polish 1) paint over them, as over every other gem.
  arcadeFx(ctx, fxSpecAt(MATCHUP_FX, matchupWorldH(state)), scene, () => {
    drawSceneWorld(ctx, scene, size, options);
    const { scale, offsetX, offsetY } = matchupTransform(size, L.worldH);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    const a = centre(tween.a);
    const b = centre(tween.b);
    const p = matchupSwapProgress(elapsedMs, tween.rejected);
    drawMatchupGem(ctx, tween.before.cells[tween.a] ?? 0, a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, RADIUS);
    drawMatchupGem(ctx, tween.before.cells[tween.b] ?? 0, b.x + (a.x - b.x) * p, b.y + (a.y - b.y) * p, RADIUS);
    ctx.restore();
  }, size);
}

/** The sim with the art renderer swapped in; step/score are the sim's own. */
export const matchupArtGame = { ...matchupGame, draw: drawMatchupArt };

/**
 * Arena scene (15 Oct 2026, display only; arenaScene.renderer.ts): the velvet backdrop
 * continues past the world to the arena box's edges, starting from the world's own
 * bottom colour, with faint margin sparkles. No gems, sockets or anything that moves.
 */
export function matchupArenaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const W = MATCHUP_WORLD_W, H = view.worldH;
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
