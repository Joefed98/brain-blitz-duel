import { successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { FLIP_FX } from "./arcadeFxGames.renderer";
/** Lava-tube artwork only. Never mutates the simulation or changes its geometry. */
import type { CanvasSize } from "./engine";
import {
  flipCrackTick, flipGame, flipGameFor, flipWarpAt, FLIP_ARC_TICKS, FLIP_CEIL_Y, FLIP_CRUMBLE, FLIP_CRUMBLE_TICKS,
  FLIP_FLOOR_Y, FLIP_GAP, FLIP_RED, FLIP_REV, FLIP_RUNNER_H_PX, FLIP_RUNNER_H_PX_V2, FLIP_RUNNER_HALF_PX,
  FLIP_RUNNER_HALF_PX_V2, FLIP_SPIKE, FLIP_STAR_R, FLIP_WORLD_H, FLIP_WORLD_W,
  type FlipSeg, type FlipState,
} from "./flip";
import { flipSurfaceLine } from "./flip.renderer";
import { artHash, reducedMotion } from "./art.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";

const FP = 256;
const RUNNER_X = 90;
const SPIKE_HEIGHT = 22;
const OVERHANG_DEPTH = 34;
/** Canvas-only material tokens shared by every part of this renderer. */
const MATERIAL = {
  wash: "rgba(8,7,10,0.76)", tunnel: "#121418", basalt: "#1E1E24",
  nearRock: "#2A2A32", farRock: "#181A20", seam: "#303039",
  lava: "#FF4A24", hot: "#FFAA46", core: "#E73720", obsidian: "#090A0D",
  figure: "#F5B82E", boot: "#59636D", mineral: "#C98760",
  lamp: "#FFE4A1", dust: "rgba(161,153,147,0.22)",
};
type Surface = (x: number) => number;
const POOL_DEPTH = 40;
const SINK_MS = 420;
const sinkFrames = new WeakMap<CanvasRenderingContext2D, { segs: FlipState["segs"]; endedTick: number; startedAt: number }>();

/** The runner box (half-width and height, px) for the state's revision; art stays inside it. */
function runnerBox(state: FlipState): { half: number; h: number } {
  return state.rev === FLIP_REV
    ? { half: FLIP_RUNNER_HALF_PX_V2, h: FLIP_RUNNER_H_PX_V2 }
    : { half: FLIP_RUNNER_HALF_PX, h: FLIP_RUNNER_H_PX };
}

/** A crumble tile that has broken by this tick (render reads of sim state only). */
function crumbleBroken(state: FlipState, index: number): boolean {
  const first = flipCrackTick(state, index);
  return first !== null && state.tick - first >= FLIP_CRUMBLE_TICKS;
}

/** Presentation clock only: the ended simulation tick deliberately stays frozen. */
export function flipPoolSink(ctx: CanvasRenderingContext2D, state: FlipState, still: boolean, now = performance.now()): number | null {
  const half = runnerBox(state).half * FP;
  const index = state.ended === 2 && state.flipT === 0 ? state.segs.findIndex(seg =>
    seg.side === state.side && state.x + half >= seg.x0 && state.x - half <= seg.x1 &&
    (seg.kind !== FLIP_CRUMBLE || crumbleBroken(state, state.segs.indexOf(seg)))) : -1;
  const hit = index >= 0 ? state.segs[index] : undefined;
  if (hit?.kind !== FLIP_GAP && hit?.kind !== FLIP_CRUMBLE) {
    sinkFrames.delete(ctx);
    return null;
  }
  if (still) return 1;
  let frame = sinkFrames.get(ctx);
  if (!frame || frame.segs !== state.segs || frame.endedTick !== state.endedTick) {
    frame = { segs: state.segs, endedTick: state.endedTick, startedAt: now };
    sinkFrames.set(ctx, frame);
  }
  return Math.max(0, Math.min(1, (now - frame.startedAt) / SINK_MS));
}

function runnerY(side: number, flipT: number, lift = 14): number {
  const target = side === 0 ? FLIP_FLOOR_Y - lift : FLIP_CEIL_Y + lift;
  if (flipT <= 0) return target;
  const from = side === 0 ? FLIP_CEIL_Y + lift : FLIP_FLOOR_Y - lift;
  const f = 1 - Math.min(FLIP_ARC_TICKS, flipT) / FLIP_ARC_TICKS;
  return from + (target - from) * f * f * (3 - 2 * f);
}

/** Reverse sampling closes curved regions without a diagonal across the band. */
function reverseLine(ctx: CanvasRenderingContext2D, at: Surface, a: number, b: number): void {
  ctx.lineTo(b, at(b));
  for (let x = Math.floor(b / 3) * 3; x > a; x -= 3) ctx.lineTo(x, at(x));
  ctx.lineTo(a, at(a));
}
function bandPath(ctx: CanvasRenderingContext2D, ceilAt: Surface, floorAt: Surface): void {
  ctx.beginPath();
  flipSurfaceLine(ctx, ceilAt, 0, FLIP_WORLD_W);
  reverseLine(ctx, floorAt, 0, FLIP_WORLD_W);
  ctx.closePath();
}
/** Background decoration and rail glow are clipped to rock, never the tunnel. */
function rockPath(ctx: CanvasRenderingContext2D, side: number, at: Surface): void {
  const edge = side === 0 ? FLIP_WORLD_H : 0;
  ctx.beginPath();
  ctx.moveTo(0, edge);
  ctx.lineTo(FLIP_WORLD_W, edge);
  reverseLine(ctx, at, 0, FLIP_WORLD_W);
  ctx.closePath();
}

/**
 * Polish G: one cached basalt tile (columns, strata, speckle, glowing lava
 * veins, warm light along its tunnel edge), painted once per device scale and
 * repeated across the rock at a slow parallax. y = 0 is the edge nearest the
 * tunnel; the ceiling side draws it mirrored. Rock scenery only, never hazards.
 */
const ROCK_TILE_W = 480;
const ROCK_TILE_H = 260;
function paintRockTile(c: CanvasRenderingContext2D): void {
  const W = ROCK_TILE_W, H = ROCK_TILE_H;
  const base = c.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#34313B");
  base.addColorStop(0.35, "#25232B");
  base.addColorStop(1, "#111115");
  c.fillStyle = base;
  c.fillRect(0, 0, W, H);
  // Basalt columns: slanted joints with a lit left face, wrapping at the tile's edges.
  let x = 0;
  for (let k = 0; x < W; k++) {
    const h = artHash(k, 907);
    const w = 22 + (h % 20);
    const lean = ((h >>> 5) % 9) - 4;
    for (const dx of [0, W]) {
      const x0 = x + dx - W * (dx > 0 ? 1 : 0);
      c.fillStyle = h % 3 === 0 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.08)";
      c.beginPath();
      c.moveTo(x0, 0);
      c.lineTo(x0 + w, 0);
      c.lineTo(x0 + w + lean, H);
      c.lineTo(x0 + lean, H);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(0,0,0,0.28)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x0, 0);
      c.lineTo(x0 + lean, H);
      c.stroke();
      c.strokeStyle = "rgba(255,230,210,0.06)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x0 + 1.5, 0);
      c.lineTo(x0 + lean + 1.5, H);
      c.stroke();
    }
    x += w;
  }
  // Strata: soft wavy bands across the columns.
  for (let band = 0; band < 4; band++) {
    const y = 40 + band * 52;
    c.strokeStyle = band % 2 ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.04)";
    c.lineWidth = 2 + (band % 2);
    c.beginPath();
    for (let px = 0; px <= W; px += 12) {
      const yy = y + Math.sin((px / W) * Math.PI * 4 + band) * 5;
      if (px === 0) c.moveTo(px, yy);
      else c.lineTo(px, yy);
    }
    c.stroke();
  }
  // Speckle.
  for (let k = 0; k < 420; k++) {
    const h = artHash(k, 433);
    c.fillStyle = h % 4 === 0 ? "rgba(255,190,150,0.10)" : "rgba(0,0,0,0.28)";
    c.fillRect(h % W, (h >>> 9) % H, 1 + ((h >>> 20) & 1), 1);
  }
  // Glowing lava veins deep in the rock.
  for (let v = 0; v < 3; v++) {
    const h = artHash(v, 619);
    let vx = (h % W);
    let vy = 70 + ((h >>> 8) % 120);
    const pts: Array<[number, number]> = [[vx, vy]];
    for (let k = 0; k < 6; k++) {
      vx += 14 + (artHash(v, k) % 18);
      vy += ((artHash(k, v) % 21) - 10);
      pts.push([vx, vy]);
    }
    for (const dx of [0, -W]) {
      for (const [width, colour] of [[6, "rgba(255,74,36,0.10)"], [2.5, "rgba(255,90,36,0.45)"], [1, "rgba(255,190,90,0.7)"]] as const) {
        c.strokeStyle = colour;
        c.lineWidth = width;
        c.lineJoin = "round";
        c.beginPath();
        pts.forEach(([px, py], i) => (i === 0 ? c.moveTo(px + dx, py) : c.lineTo(px + dx, py)));
        c.stroke();
      }
    }
  }
  // Warm lava light along the tunnel edge, fading into the rock.
  const warm = c.createLinearGradient(0, 0, 0, 70);
  warm.addColorStop(0, "rgba(255,90,40,0.16)");
  warm.addColorStop(1, "rgba(255,90,40,0)");
  c.fillStyle = warm;
  c.fillRect(0, 0, W, 70);
}

const rockTiles = new WeakMap<CanvasRenderingContext2D, { key: string; tile: ArtCanvas | null }>();
function rockTile(ctx: CanvasRenderingContext2D): ArtCanvas | null {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const scale = Math.min(2, Math.max(1, t ? Math.hypot(t.a, t.b) : 1));
  const key = scale.toFixed(3);
  const old = rockTiles.get(ctx);
  if (old && old.key === key) return old.tile;
  const tile = artCanvas(Math.ceil(ROCK_TILE_W * scale), Math.ceil(ROCK_TILE_H * scale));
  const c = tile && artContext(tile);
  if (tile && c) {
    c.scale(scale, scale);
    paintRockTile(c as CanvasRenderingContext2D);
  }
  rockTiles.set(ctx, { key, tile: tile && c ? tile : null });
  return tile && c ? tile : null;
}

function drawCave(ctx: CanvasRenderingContext2D, state: FlipState, side: number, at: Surface, still: boolean): void {
  const cam = state.x / FP;
  const time = still ? 0 : state.tick / 60;
  const outward = side === 0 ? 1 : -1;
  ctx.save();
  rockPath(ctx, side, at);
  ctx.clip();
  const tile = rockTile(ctx);
  const edge = side === 0 ? FLIP_FLOOR_Y - 24 : FLIP_CEIL_Y + 24;
  if (tile) {
    const off = (still ? 0 : cam * 0.4) % ROCK_TILE_W;
    for (let x = -off; x < FLIP_WORLD_W; x += ROCK_TILE_W) {
      if (side === 0) ctx.drawImage(tile as CanvasImageSource, x, edge, ROCK_TILE_W, ROCK_TILE_H);
      else {
        ctx.save();
        ctx.translate(0, edge);
        ctx.scale(1, -1);
        ctx.drawImage(tile as CanvasImageSource, x + ROCK_TILE_W * 0.37, 0, ROCK_TILE_W, ROCK_TILE_H);
        ctx.drawImage(tile as CanvasImageSource, x + ROCK_TILE_W * 0.37 - ROCK_TILE_W, 0, ROCK_TILE_W, ROCK_TILE_H);
        ctx.restore();
      }
    }
  } else {
    ctx.fillStyle = MATERIAL.basalt;
    ctx.fillRect(0, 0, FLIP_WORLD_W, FLIP_WORLD_H);
  }
  // One near layer of dark jagged outcrops at a faster parallax, for depth.
  {
    const par = still ? 0 : cam * 0.6;
    const stride = 118;
    const start = Math.floor(par / stride) - 1;
    for (let k = start; k < start + 6; k++) {
      const hash = artHash(k, side * 41 + 137);
      const x = k * stride - par;
      const y = at(x) + outward * (70 + hash % 40);
      ctx.fillStyle = "rgba(10,10,14,0.55)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + stride * 0.35, y - outward * (14 + hash % 22));
      ctx.lineTo(x + stride * 0.7, y + outward * 6);
      ctx.lineTo(x + stride, y - outward * (6 + (hash >>> 4) % 14));
      ctx.lineTo(x + stride * 1.05, y + outward * 200);
      ctx.lineTo(x - 12, y + outward * 200);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,120,60,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + stride * 0.35, y - outward * (14 + hash % 22));
      ctx.lineTo(x + stride * 0.7, y + outward * 6);
      ctx.stroke();
    }
  }
  // Spouts sit only between all obstacle spans, and erupt away from the band.
  for (let k = Math.floor(cam / 115) - 1; k < Math.floor(cam / 115) + 5; k++) {
    const h = artHash(k, side + 411);
    if (h % 3 !== 0) continue;
    const worldX = k * 115 + h % 40;
    const x = RUNNER_X + worldX - cam;
    if (x < -12 || x > FLIP_WORLD_W + 12) continue;
    if (state.segs.some(seg => worldX * FP >= seg.x0 - 16 * FP && worldX * FP <= seg.x1 + 16 * FP)) continue;
    const phase = still ? 0.35 : ((state.tick + h % 150) % 150) / 150;
    const height = 8 + Math.sin(phase * Math.PI) * 24;
    const y = at(x) + outward * 4;
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = MATERIAL.lava;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.quadraticCurveTo(x - 8, y + outward * height, x + 3, y + outward * (height - 6));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Low-contrast particles behind the action; reduced motion fixes their phase.
  for (let k = 0; k < 16; k++) {
    const h = artHash(k, side + 702);
    const x = h % FLIP_WORLD_W + (still ? 0 : Math.sin(time * 0.4 + k) * 5);
    const age = still ? h % 120 : (state.tick + h % 120) % 120;
    const offset = 12 + ((h >>> 7) % 90) + age * 0.3;
    const y = at(x) + outward * offset;
    ctx.fillStyle = k % 3 === 0 ? "rgba(255,112,48,0.35)" : MATERIAL.dust;
    ctx.fillRect(x, y, k % 3 === 0 ? 1.5 : 1, 1.5);
    if (side === 1 && k % 4 === 0) {
      ctx.fillStyle = "rgba(255,92,37,0.3)";
      ctx.beginPath();
      ctx.ellipse(x + 8, at(x + 8) - 58 + age * 0.3, 1, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Jagged obsidian joins the rail continuously; all hot cores are silhouette-clipped. */
function drawRockObstacle(ctx: CanvasRenderingContext2D, a: number, b: number, inward: number, at: Surface,
  maxH: number, seed: number, pulse: number): void {
  if (b - a <= 1) return;
  ctx.save();
  // Exact curve-following envelope, not a mid-point-height rectangle.
  ctx.beginPath();
  flipSurfaceLine(ctx, at, a, b);
  reverseLine(ctx, x => at(x) + inward * maxH, a, b);
  ctx.closePath();
  ctx.clip();
  const count = Math.max(2, Math.round((b - a) / 13));
  const slot = (b - a) / count;
  for (let k = 0; k < count; k++) {
    const h = artHash(seed, k);
    const x0 = a + slot * k;
    const x1 = x0 + slot;
    const tip = x0 + slot * (0.28 + (h % 40) / 100);
    const height = maxH * (0.65 + ((h >>> 6) % 36) / 100);
    const profile = (x: number) => height * Math.max(0, x <= tip ? (x - x0) / (tip - x0) : (x1 - x) / (x1 - tip));
    ctx.save();
    ctx.beginPath();
    // Base extends into rock, then is envelope-clipped, with no flat base stroke.
    flipSurfaceLine(ctx, x => at(x) - inward * 3, x0, x1);
    reverseLine(ctx, x => at(x) + inward * profile(x), x0, x1);
    ctx.closePath();
    ctx.clip();
    const body = ctx.createLinearGradient(0, at(tip), 0, at(tip) + inward * height);
    body.addColorStop(0, MATERIAL.obsidian);
    body.addColorStop(0.4, MATERIAL.core);
    body.addColorStop(0.8, MATERIAL.lava);
    body.addColorStop(1, MATERIAL.hot);
    ctx.fillStyle = body;
    ctx.fillRect(x0, Math.min(at(x0), at(x1)) - maxH, slot, Math.abs(at(x0) - at(x1)) + maxH * 2);
    const core = ctx.createLinearGradient(0, at(tip), 0, at(tip) + inward * height);
    core.addColorStop(0, MATERIAL.core);
    core.addColorStop(1, MATERIAL.hot);
    ctx.strokeStyle = core;
    ctx.globalAlpha = 0.6 + pulse * 0.35;
    ctx.lineWidth = 1.5 + (h % 2);
    ctx.beginPath();
    ctx.moveTo(tip - slot * 0.12, at(tip) + inward * 2);
    ctx.lineTo(tip + slot * 0.1, at(tip) + inward * height * 0.4);
    ctx.lineTo(tip, at(tip) + inward * height * 0.86);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = MATERIAL.mineral;
    ctx.lineWidth = 0.7;
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(tip + sign * slot * 0.24, at(tip) + inward * height * 0.2);
      ctx.lineTo(tip + sign * slot * 0.13, at(tip) + inward * height * 0.48);
      ctx.lineTo(tip + sign * slot * 0.06, at(tip) + inward * height * 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Gap has no simulated depth: the 40px basin is exterior scenery in its exact x-span. */
export function drawFlipPool(ctx: CanvasRenderingContext2D, a: number, b: number, inward: number, at: Surface, time: number, seed: number): void {
  if (b <= a) return;
  ctx.save();
  ctx.beginPath();
  flipSurfaceLine(ctx, at, a, b);
  reverseLine(ctx, x => at(x) - inward * POOL_DEPTH, a, b);
  ctx.closePath();
  ctx.clip();
  const mid = (a + b) / 2;
  const lava = ctx.createLinearGradient(0, at(mid), 0, at(mid) - inward * POOL_DEPTH);
  lava.addColorStop(0, MATERIAL.hot);
  lava.addColorStop(0.18, MATERIAL.lava);
  lava.addColorStop(0.65, MATERIAL.core);
  lava.addColorStop(1, MATERIAL.obsidian);
  ctx.fillStyle = lava;
  ctx.fillRect(a, Math.min(at(a), at(b), at(mid)) - POOL_DEPTH - 145, b - a, POOL_DEPTH * 2 + 290);
  ctx.strokeStyle = MATERIAL.hot;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    flipSurfaceLine(ctx, x => at(x) - inward * (4 + k * 7 + Math.sin((x - a) * 0.07 + time * 0.65 + k) * 1.1), a + 2, b - 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.7;
  for (let k = 0; k < 4; k++) {
    const h = artHash(seed, k + 67);
    const x = a + (b - a) * (0.12 + (h % 76) / 100);
    const age = ((time * 0.25 + (h % 100) / 100) % 1);
    ctx.fillStyle = MATERIAL.lamp;
    ctx.fillRect(x, at(x) - inward * (3 + age * 15), 1.2, 1.2);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = MATERIAL.obsidian;
  ctx.lineWidth = 3;
  ctx.beginPath();
  flipSurfaceLine(ctx, at, a, b);
  ctx.moveTo(a, at(a));
  ctx.lineTo(a, at(a) - inward * POOL_DEPTH);
  ctx.moveTo(b, at(b));
  ctx.lineTo(b, at(b) - inward * POOL_DEPTH);
  ctx.stroke();
  ctx.restore();
}

function drawFigure(ctx: CanvasRenderingContext2D, state: FlipState, y: number, still: boolean, sink: number | null): void {
  const dead = state.ended === 2;
  const progress = state.flipT > 0 ? 1 - state.flipT / FLIP_ARC_TICKS : 1;
  const upright = state.side === 0 ? 0 : Math.PI;
  const angle = !still && state.flipT > 0 ? upright + (state.side === 0 ? -1 : 1) * Math.PI * (1 - progress) : upright;
  const box = runnerBox(state);
  const big = state.rev === FLIP_REV;
  ctx.save();
  // Clip before rotation so tumbling limbs never enlarge the runner's collision box.
  ctx.beginPath();
  ctx.rect(RUNNER_X - box.half, y - box.h / 2, box.half * 2, box.h);
  ctx.clip();
  if (big && !(dead && sink === null)) {
    // Rev 2: a soft lamp-lit backing inside the box so the runner stands out from the rock.
    const halo = ctx.createRadialGradient(RUNNER_X, y, 2, RUNNER_X, y, box.h / 2);
    halo.addColorStop(0, "rgba(255,228,161,0.32)");
    halo.addColorStop(1, "rgba(255,228,161,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(RUNNER_X - box.half, y - box.h / 2, box.half * 2, box.h);
  }
  ctx.translate(RUNNER_X, y + (sink ?? 0) * 32 * (state.side === 0 ? 1 : -1));
  ctx.rotate(angle);
  // The original figure was drawn for a 24 × 28 box; rev 2 scales it up to fill its 32 × 36 box.
  if (big) ctx.scale(1.65, 1.65);
  if (big) {
    // Dark outline pass first so the gold reads against lava and rock alike.
    ctx.strokeStyle = MATERIAL.obsidian;
    ctx.lineWidth = 4.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, -6.5, 3.4, 0, Math.PI * 2);
    ctx.moveTo(0, -3); ctx.lineTo(0, 3);
    ctx.moveTo(0, -3); ctx.lineTo(-5, 2);
    ctx.moveTo(0, -3); ctx.lineTo(5, 1);
    ctx.moveTo(0, 3); ctx.lineTo(-3, 9);
    ctx.moveTo(0, 3); ctx.lineTo(3, 9);
    ctx.stroke();
  }
  // Swing's small gold head/torso/limbs, with compact gravity boots.
  ctx.strokeStyle = dead && sink === null ? FLIP_RED : MATERIAL.figure;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, -6.5, 3.4, 0, Math.PI * 2);
  ctx.fill();
  const stride = still || state.flipT > 0 || dead ? 0 : Math.sin(state.tick * 0.5) * 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -3); ctx.lineTo(0, 3);
  ctx.moveTo(0, -3); ctx.lineTo(-5, 2 + stride);
  ctx.moveTo(0, -3); ctx.lineTo(5, 1 - stride);
  ctx.moveTo(0, 3); ctx.lineTo(-3 + stride, 9);
  ctx.moveTo(0, 3); ctx.lineTo(3 - stride, 9);
  ctx.stroke();
  ctx.strokeStyle = "rgba(210, 238, 240, 0.8)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = MATERIAL.boot;
  ctx.fillRect(-5 + stride, 8, 4, 2.5);
  ctx.fillRect(1 - stride, 8, 4, 2.5);
  ctx.fillStyle = MATERIAL.hot;
  ctx.globalAlpha = 0.65;
  ctx.fillRect(-5 + stride, 10.5, 4, 0.8);
  ctx.fillRect(1 - stride, 10.5, 4, 0.8);
  ctx.globalAlpha = 1;
  ctx.fillStyle = MATERIAL.lamp;
  ctx.fillRect(2, -8, 2, 1.5);
  ctx.restore();
}

/** Rev 2 star: glowing yellow (never orange like the spikes), centred where the runner stands. */
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number, still: boolean): void {
  const r = FLIP_STAR_R;
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(tick / 8);
  const glow = ctx.createRadialGradient(x, y, 1, x, y, r * 2.2);
  glow.addColorStop(0, `rgba(255,236,110,${0.45 + pulse * 0.25})`);
  glow.addColorStop(1, "rgba(255,236,110,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const reach = k % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    if (k === 0) ctx.moveTo(x + Math.cos(a) * reach, y + Math.sin(a) * reach);
    else ctx.lineTo(x + Math.cos(a) * reach, y + Math.sin(a) * reach);
  }
  ctx.closePath();
  ctx.fillStyle = "#FFE84A";
  ctx.fill();
  ctx.strokeStyle = "#FFFBE0";
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/**
 * Rev 2 crumbling tile, on the rock side of the rail in its exact x-span: intact
 * stone slabs, then (after first contact) growing cracks and a shiver, then gone
 * (drawn as the lava pool beneath, with chunks falling away).
 */
function drawCrumble(ctx: CanvasRenderingContext2D, state: FlipState, index: number, seg: FlipSeg, a: number, b: number,
  inward: number, at: Surface, still: boolean): void {
  const first = flipCrackTick(state, index);
  const age = first === null ? -1 : state.tick - first;
  if (age >= FLIP_CRUMBLE_TICKS) {
    drawFlipPool(ctx, a, b, inward, at, still ? 0 : state.tick / 60, seg.x0);
    const fall = age - FLIP_CRUMBLE_TICKS;
    if (!still && fall < 40) {
      ctx.save();
      ctx.globalAlpha = 1 - fall / 40;
      ctx.fillStyle = "#8C8178";
      for (let k = 0; k < 6; k++) {
        const h = artHash(seg.x0 >> 8, k + 11);
        const x = a + ((b - a) * ((h % 90) + 5)) / 100;
        ctx.fillRect(x, at(x) - inward * (4 + fall * (0.8 + (h % 5) * 0.2)), 4, 3);
      }
      ctx.restore();
    }
    return;
  }
  const p = age < 0 ? 0 : age / FLIP_CRUMBLE_TICKS;
  const shake = still || age < 0 ? 0 : Math.sin(state.tick * 2.3) * p * 1.2;
  ctx.save();
  ctx.beginPath();
  flipSurfaceLine(ctx, at, a, b);
  reverseLine(ctx, (x) => at(x) - inward * 12, a, b);
  ctx.closePath();
  ctx.clip();
  ctx.translate(shake, 0);
  const slab = 22;
  for (let x = a - 2; x < b + 2; x += slab) {
    const h = artHash(seg.x0 >> 8, Math.round((x - a) / slab));
    const y0 = Math.min(at(x), at(x + slab)) - 14;
    ctx.fillStyle = h % 2 ? "#6E655E" : "#7C726A";
    ctx.fillRect(x, y0, slab - 1.5, 30);
    // Polish G: dressed stone: a lit face along the rail, a shaded far face and a few pits.
    ctx.fillStyle = "rgba(255,240,220,0.22)";
    ctx.fillRect(x, at(x + slab / 2) - inward * 1.5 - 0.75, slab - 1.5, 1.5);
    ctx.fillStyle = "rgba(20,14,10,0.35)";
    ctx.fillRect(x + slab - 3.5, y0, 2, 30);
    ctx.fillStyle = "rgba(40,30,24,0.5)";
    ctx.fillRect(x + 4 + (h % 9), at(x + slab / 2) - inward * (5 + (h >>> 4) % 4), 1.5, 1.5);
    ctx.fillRect(x + 12 + ((h >>> 7) % 6), at(x + slab / 2) - inward * (8 + (h >>> 9) % 3), 1.2, 1.2);
  }
  // Cracks: faint hairlines before contact so the tile reads as fragile, then glowing and growing.
  ctx.strokeStyle = age < 0 ? "rgba(30,24,20,0.55)" : `rgba(255,140,60,${0.5 + p * 0.5})`;
  ctx.lineWidth = age < 0 ? 0.8 : 1 + p;
  ctx.beginPath();
  for (let x = a + 8; x < b - 4; x += 18) {
    const h = artHash(seg.x0 >> 8, Math.round(x));
    const len = 4 + (age < 0 ? 2 : p * 10);
    ctx.moveTo(x, at(x) - inward * 1);
    ctx.lineTo(x + ((h % 7) - 3), at(x) - inward * len);
  }
  ctx.stroke();
  ctx.restore();
}

/** The game's drawing through the shared success layer (presentation only). */
export function drawFlipArt(ctx: CanvasRenderingContext2D, state: FlipState, size: CanvasSize): void {
  arcadeFx(ctx, FLIP_FX, state, () => drawFlipArtWorld(ctx, state, size), size);
}

function drawFlipArtWorld(ctx: CanvasRenderingContext2D, state: FlipState, size: CanvasSize): void {
  const still = reducedMotion();
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(state.tick / 10);
  const scale = Math.min(size.width / FLIP_WORLD_W, size.height / FLIP_WORLD_H);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = MATERIAL.wash;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate((size.width - FLIP_WORLD_W * scale) / 2, (size.height - FLIP_WORLD_H * scale) / 2);
  ctx.scale(scale, scale);
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "#F7F7F8";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`${flipGame.score(state)}`, 14, 14);
  ctx.beginPath();
  ctx.rect(0, 0, FLIP_WORLD_W, FLIP_WORLD_H);
  ctx.clip();
  const toScreen = (wx: number) => RUNNER_X + (wx - state.x) / FP;
  const toWorld = (x: number) => state.x + (x - RUNNER_X) * FP;
  const floorAt = (x: number) => FLIP_FLOOR_Y + flipWarpAt(state, 0, toWorld(x));
  const ceilAt = (x: number) => FLIP_CEIL_Y + flipWarpAt(state, 1, toWorld(x));
  drawCave(ctx, state, 0, floorAt, still);
  drawCave(ctx, state, 1, ceilAt, still);
  bandPath(ctx, ceilAt, floorAt);
  // Polish G: the tunnel air is darkest in the middle and warmed by the lava rails at both edges.
  const air = ctx.createLinearGradient(0, FLIP_CEIL_Y - 30, 0, FLIP_FLOOR_Y + 30);
  air.addColorStop(0, "#2A1714");
  air.addColorStop(0.18, "#161518");
  air.addColorStop(0.5, MATERIAL.tunnel);
  air.addColorStop(0.82, "#161518");
  air.addColorStop(1, "#2A1714");
  ctx.fillStyle = air;
  ctx.fill();

  for (const [side, at] of [[0, floorAt], [1, ceilAt]] as const) {
    const rail = () => {
      ctx.beginPath();
      let from = 0;
      for (let i = Math.max(0, state.cursor - 1); i < state.segs.length; i++) {
        const seg = state.segs[i];
        if (!seg) continue;
        const a = toScreen(seg.x0);
        if (a > FLIP_WORLD_W) break;
        const open = seg.kind === FLIP_GAP || (seg.kind === FLIP_CRUMBLE && crumbleBroken(state, i));
        if (seg.side !== side || !open) continue;
        flipSurfaceLine(ctx, at, from, Math.max(from, a));
        from = Math.max(from, toScreen(seg.x1));
      }
      flipSurfaceLine(ctx, at, from, FLIP_WORLD_W);
    };
    ctx.save();
    rockPath(ctx, side, at);
    ctx.clip();
    rail();
    ctx.strokeStyle = "rgba(255,69,24,0.1)";
    ctx.lineWidth = 26;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,76,24,0.2)";
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.restore();
    rail();
    ctx.strokeStyle = MATERIAL.lava;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = MATERIAL.hot;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  const y = runnerY(state.side, state.flipT, runnerBox(state).h / 2) + state.warpY;
  const sink = flipPoolSink(ctx, state, still);
  // Headlamp and tiny flip sparks are non-colliding light, behind solid objects.
  ctx.save();
  bandPath(ctx, ceilAt, floorAt);
  ctx.clip();
  const light = ctx.createLinearGradient(RUNNER_X + 7, 0, RUNNER_X + 110, 0);
  light.addColorStop(0, "rgba(255,224,151,0.13)");
  light.addColorStop(1, "rgba(255,224,151,0)");
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(RUNNER_X + 7, y - (state.side === 0 ? 8 : -8));
  for (let x = RUNNER_X + 16; x <= RUNNER_X + 110; x += 6) {
    ctx.lineTo(x, y + (floorAt(x) - floorAt(RUNNER_X)) - (x - RUNNER_X) * 0.22);
  }
  for (let x = RUNNER_X + 110; x >= RUNNER_X + 16; x -= 6) {
    ctx.lineTo(x, y + (floorAt(x) - floorAt(RUNNER_X)) + (x - RUNNER_X) * 0.22);
  }
  ctx.closePath();
  ctx.globalAlpha = sink === null ? 1 : 1 - sink;
  ctx.fill();
  ctx.globalAlpha = 1;
  if (!still && state.flipT > 0 && state.ended === 0) {
    for (let k = 1; k <= 6; k++) {
      ctx.globalAlpha = 0.45 * (1 - k / 7);
      ctx.fillStyle = MATERIAL.hot;
      const previousY = runnerY(state.side, Math.min(FLIP_ARC_TICKS, state.flipT + k), runnerBox(state).h / 2) + state.warpY;
      ctx.fillRect(RUNNER_X - 7 - k * 3, previousY + (k % 3 - 1) * 2, 1.3, 1.3);
    }
  }
  ctx.restore();
  for (let i = Math.max(0, state.cursor - 1); i < state.segs.length; i++) {
    const seg = state.segs[i];
    if (!seg) continue;
    const a = toScreen(seg.x0);
    const b = toScreen(seg.x1);
    if (a > FLIP_WORLD_W) break;
    if (b < 0) continue;
    const inward = seg.side === 0 ? -1 : 1;
    const at = seg.side === 0 ? floorAt : ceilAt;
    if (seg.kind === FLIP_CRUMBLE) drawCrumble(ctx, state, i, seg, a, b, inward, at, still);
    else if (seg.kind === FLIP_GAP) drawFlipPool(ctx, a, b, inward, at, still ? 0 : state.tick / 60, seg.x0);
    else drawRockObstacle(ctx, a, b, inward, at, seg.kind === FLIP_SPIKE ? SPIKE_HEIGHT : OVERHANG_DEPTH, seg.x0 ^ state.warpFloor, pulse);
  }
  // Rev 2 stars not yet taken, at the runner's standing height on their surface.
  if (state.stars) {
    const lift = runnerBox(state).h / 2;
    state.stars.forEach((star, i) => {
      if ((state.got ?? 0) & (1 << i)) return;
      const x = toScreen(star.x);
      if (x < -20 || x > FLIP_WORLD_W + 20) return;
      const surface = star.side === 0 ? floorAt(x) - lift : ceilAt(x) + lift;
      drawStar(ctx, x, surface, state.tick, still);
    });
  }
  ctx.save();
  // Pool deaths sink behind the opening; no new player or hazard geometry.
  if (sink !== null) { bandPath(ctx, ceilAt, floorAt); ctx.clip(); }
  drawFigure(ctx, state, y, still, sink);
  successFrame(ctx,{id:'flip',tick:state.tick,count:0,eventTick:state.flipT>0?state.tick-(FLIP_ARC_TICKS-state.flipT):0,enabled:state.ended===0,colour:MATERIAL.hot,width:FLIP_WORLD_W,height:FLIP_WORLD_H,point:{x:RUNNER_X,y:y+(state.side===0?-1:1)*runnerBox(state).h/2,shape:'pixel'}});
  ctx.restore();
  ctx.restore();
}

/** Play, intro demo and stored-run reveal share this renderer. */
export const flipArtGame = { ...flipGame, draw: drawFlipArt };
/** The art game for a stored puzzle.flipRev (play, demos and reveals). */
const flipArtGames = new Map<number, typeof flipArtGame>();
/**
 * One cached object per revision: stages reset the run whenever their `game` prop
 * changes identity, so a fresh object per render would restart the sim every frame.
 */
export function flipArtGameFor(rev?: number | null): typeof flipArtGame {
  const key = rev ?? 0;
  let game = flipArtGames.get(key);
  if (!game) flipArtGames.set(key, (game = { ...flipGameFor(rev), draw: drawFlipArt }));
  return game;
}
