import { successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { arcadeFx } from "./arcadeFx.renderer";
import { flipFxFor } from "./arcadeFxGames.renderer";
/** Lava-tube artwork only. Never mutates the simulation or changes its geometry. */
import type { CanvasSize } from "./engine";
import {
  flipCrackTick, flipGame, flipSpeed, flipGameFor, flipWarpAt, FLIP_ARC_TICKS, FLIP_CEIL_Y, FLIP_CRUMBLE, FLIP_CRUMBLE_TICKS,
  FLIP_FLOOR_Y, FLIP_GAP, FLIP_RED, FLIP_REV, FLIP_RUNNER_H_PX, FLIP_RUNNER_H_PX_V2, FLIP_RUNNER_HALF_PX,
  FLIP_RUNNER_HALF_PX_V2, FLIP_SPIKE, FLIP_STAR_R, FLIP_WORLD_H, FLIP_WORLD_W,
  FLIP_V8_CHECKPOINTS, FLIP_V8_TRAIL_STARS, flipRunnerX, FLIP_V8_WORLD_H, flipWorldHFor, flipRunnerBaseY, flipSegShift, flipSurfaceBase, flipV8InZone, flipWorldH,
  type FlipSeg, type FlipState,
} from "./flip";
import { flipSurfaceLine } from "./flip.renderer";
import { artHash, reducedMotion } from "./art.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { sceneBelow, sceneFill, sceneSides, type ArenaSceneView } from "./arenaScene.renderer";
import { drawHero, heroPose, type HeroPose } from "./hero.renderer";

const FP = 256;
/** The runner's x in the view: 90, or flipRev 8's FLIP_V8_RUNNER_X (set per frame from the state; display only). */
let RUNNER_X = 90;
const SPIKE_HEIGHT = 22;
const OVERHANG_DEPTH = 34;
/** Canvas-only material tokens shared by every part of this renderer. */
export const MATERIAL = {
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

/** The runner's drawn y before the bend (flipRunnerBaseY: the fixed corridor, or rev 8's cave at the runner). */
function runnerY(state: FlipState, side: number, flipT: number, lift = 14): number {
  return flipRunnerBaseY(state, side, flipT, lift);
}

/** Reverse sampling closes curved regions without a diagonal across the band. */
function reverseLine(ctx: CanvasRenderingContext2D, at: Surface, a: number, b: number): void {
  ctx.lineTo(b, at(b));
  for (let x = Math.floor(b / 3) * 3; x > a; x -= 3) ctx.lineTo(x, at(x));
  ctx.lineTo(a, at(a));
}
/** The world's height this frame (rev 8's taller cave, else the original 620). */
let worldH = FLIP_WORLD_H;
function bandPath(ctx: CanvasRenderingContext2D, ceilAt: Surface, floorAt: Surface): void {
  ctx.beginPath();
  flipSurfaceLine(ctx, ceilAt, 0, FLIP_WORLD_W);
  reverseLine(ctx, floorAt, 0, FLIP_WORLD_W);
  ctx.closePath();
}
/** Background decoration and rail glow are clipped to rock, never the tunnel. */
function rockPath(ctx: CanvasRenderingContext2D, side: number, at: Surface): void {
  const edge = side === 0 ? worldH : 0;
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
  // Glowing lava veins deep in the rock (Polish A4: five seams, with a wider molten glow and a hot core).
  for (let v = 0; v < 5; v++) {
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
      for (const [width, colour] of [[12, "rgba(255,74,36,0.08)"], [6, "rgba(255,84,36,0.16)"], [2.8, "rgba(255,96,40,0.6)"], [1.1, "rgba(255,206,120,0.9)"]] as const) {
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
  const tall = Boolean(state.exp);
  // Rev 8's taller cave: the rock's lit edge follows the cave (its height and bend at the runner) and the deeper
  // rock beyond the tile is the tile's own darkest shade, so the rock reaches the world's edge without a seam.
  const bend = tall ? state.warpY : 0;
  const edge = side === 0 ? flipSurfaceBase(state, 0, state.x) - 24 + bend : flipSurfaceBase(state, 1, state.x) + 24 + bend;
  if (tile) {
    if (tall) {
      ctx.fillStyle = "#111115";
      ctx.fillRect(0, 0, FLIP_WORLD_W, worldH);
    }
    const off = (still ? 0 : cam * 0.4) % ROCK_TILE_W;
    // Rev 8: the deeper rock repeats the tile mirrored (dark edge to dark edge, so no seam) and faint.
    if (tall) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      for (let x = -off; x < FLIP_WORLD_W; x += ROCK_TILE_W) {
        ctx.save();
        ctx.translate(0, side === 0 ? edge + ROCK_TILE_H * 2 : edge - ROCK_TILE_H * 2);
        ctx.scale(1, side === 0 ? -1 : 1);
        ctx.drawImage(tile as CanvasImageSource, x + ROCK_TILE_W * 0.61, 0, ROCK_TILE_W, ROCK_TILE_H);
        ctx.drawImage(tile as CanvasImageSource, x + ROCK_TILE_W * 0.61 - ROCK_TILE_W, 0, ROCK_TILE_W, ROCK_TILE_H);
        ctx.restore();
      }
      ctx.restore();
    }
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
    ctx.fillRect(0, 0, FLIP_WORLD_W, worldH);
  }
  // Reduced effects (lib/fx/lowEnd.ts, slow devices only): the rock wall keeps its tiled texture;
  // the near outcrops, lava spouts and drifting dust behind the action are skipped.
  const lite = arcadeReducedEffects();
  // One near layer of dark jagged outcrops at a faster parallax, for depth.
  if (!lite) {
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
  if (!lite) for (let k = Math.floor(cam / 115) - 1; k < Math.floor(cam / 115) + 5; k++) {
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
  if (!lite) for (let k = 0; k < 16; k++) {
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
export function drawRockObstacle(ctx: CanvasRenderingContext2D, a: number, b: number, inward: number, at: Surface,
  maxH: number, seed: number, pulse: number): void {
  if (b - a <= 1) return;
  // Polish A4: a soft lava glow behind the hazard (light only, drawn before its silhouette).
  if (!arcadeReducedEffects()) {
    const mid = (a + b) / 2;
    const gy = at(mid) + inward * maxH * 0.5;
    const reach = Math.max(maxH * 1.1, (b - a) * 0.6);
    const glow = ctx.createRadialGradient(mid, gy, 2, mid, gy, reach);
    glow.addColorStop(0, `rgba(255,96,36,${0.22 + pulse * 0.12})`);
    glow.addColorStop(1, "rgba(255,96,36,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(mid - reach, gy - reach, reach * 2, reach * 2);
  }
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
    // Polish A4: shading: the face away from the runner in shadow, a lit edge on the near face.
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = MATERIAL.obsidian;
    ctx.beginPath();
    ctx.moveTo(tip, at(tip) + inward * height);
    ctx.lineTo(x1, at(x1));
    ctx.lineTo(x1, at(x1) - inward * 3);
    ctx.lineTo(tip, at(tip) - inward * 3);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = "rgba(255,214,150,0.8)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x0 + 0.5, at(x0));
    ctx.lineTo(tip, at(tip) + inward * height);
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

/**
 * Opens the runner's frame (saved; the caller restores): the clip to its collision box, rev 2's
 * lamp-lit backing, then the translate, flip rotation and rev 2's 1.65 scale both figures use.
 */
function runnerFrame(ctx: CanvasRenderingContext2D, state: FlipState, y: number, sink: number | null, dead: boolean, angle: number): boolean {
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
  return big;
}

/** Roofbound's hero pose (the stick figure's joints, 3.4 px head, 2.4 px stick), refilled every frame. */
const runnerHero = Object.assign(heroPose(), { headR: 3.4, stick: 2.4 });

/**
 * The Joulz hero on drawFigure's joints, stride and flip (same frame, clip and backing). The
 * cape trails the run (the tube's speed and the flip's arc, turned into the figure's frame), so
 * it hangs towards the surface the runner stands on and stays inside the runner box.
 */
export function drawRunnerHero(ctx: CanvasRenderingContext2D, state: FlipState, y: number, still: boolean, sink: number | null, pose: HeroPose = runnerHero): void {
  // Called on its own too (the game icons): the runner's x follows the state it is given.
  RUNNER_X = flipRunnerX(state);
  const dead = state.ended === 2;
  const progress = state.flipT > 0 ? 1 - state.flipT / FLIP_ARC_TICKS : 1;
  const upright = state.side === 0 ? 0 : Math.PI;
  const angle = !still && state.flipT > 0 ? upright + (state.side === 0 ? -1 : 1) * Math.PI * (1 - progress) : upright;
  const big = runnerFrame(ctx, state, y, sink, dead, angle);
  const stride = still || state.flipT > 0 || dead ? 0 : Math.sin(state.tick * 0.5) * 1.5;
  const h = pose;
  h.scale = big ? 1.65 : 1;
  h.headX = 0; h.headY = -6.5;
  h.neckX = 0; h.neckY = -3;
  h.hipX = 0; h.hipY = 3;
  h.shoulderX = 0; h.shoulderY = -3;
  h.handAX = -5; h.handAY = 2 + stride;
  h.handBX = 5; h.handBY = 1 - stride;
  h.footAX = -3 + stride; h.footAY = 9;
  h.footBX = 3 - stride; h.footBY = 9;
  // World velocity (px a tick): the run to the right, plus the flip's arc between surfaces.
  const lift = runnerBox(state).h / 2;
  const vx = dead ? 0 : flipSpeed(state.tick) / FP;
  const vy = dead || state.flipT <= 0 ? 0 : runnerY(state, state.side, state.flipT - 1, lift) - runnerY(state, state.side, state.flipT, lift);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  h.moveX = vx * cos + vy * sin;
  h.moveY = vy * cos - vx * sin;
  h.speed = Math.min(1, Math.hypot(vx, vy) / 9);
  h.face = h.moveX > 0.01 ? 1 : h.moveX < -0.01 ? -1 : 0;
  h.core = dead && sink === null ? FLIP_RED : null;
  h.gentle = still;
  drawHero(ctx, h);
  ctx.restore();
}

/** Rev 2 star: glowing yellow (never orange like the spikes), centred where the runner stands. */
export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number, still: boolean): void {
  const r = FLIP_STAR_R;
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(tick / 8);
  const glow = ctx.createRadialGradient(x, y, 1, x, y, r * 2.2);
  glow.addColorStop(0, `rgba(255,236,110,${0.45 + pulse * 0.25})`);
  glow.addColorStop(1, "rgba(255,236,110,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  // Polish A4: a halo ring and four soft rays turning slowly round the star (light only).
  ctx.save();
  ctx.strokeStyle = `rgba(255,244,170,${0.35 + pulse * 0.25})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.translate(x, y);
  ctx.rotate(still ? 0 : tick / 60);
  ctx.fillStyle = `rgba(255,240,150,${0.18 + pulse * 0.14})`;
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-1.2, r * 1.1);
    ctx.lineTo(0, r * 2.4);
    ctx.lineTo(1.2, r * 1.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
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

/**
 * The cave's depths behind the tunnel (Joe's phone notes, 27 Oct 2026; was a far city skyline): dark
 * stalactites hanging from the ceiling and stalagmites rising from the floor, two layers at a sixth and a tenth
 * of the run's speed, very dark, with a few faint cold-glowing crystals on them and a pale mist drifting low over
 * the floor. Scenery only, clipped to the tunnel and behind every hazard and the runner; nothing in it collides.
 */
function drawCaveDepths(ctx: CanvasRenderingContext2D, run: number, tick: number, still: boolean,
  floorY: (x: number) => number = () => FLIP_FLOOR_Y, ceilY: (x: number) => number = () => FLIP_CEIL_Y, rows = 1): void {
  for (let row = rows - 1; row >= 0; row--) {
    const par = run / (row ? 10 : 6);
    const stride = row ? 52 : 38;
    const k0 = Math.floor(par / stride) - 1;
    ctx.fillStyle = row ? "rgba(4,6,8,0.34)" : "rgba(5,7,9,0.5)";
    for (let k = k0; k < k0 + Math.ceil(FLIP_WORLD_W / stride) + 3; k++) {
      const h = artHash(k + row * 7919, 1709);
      const x = k * stride - par + (h % 12);
      const w = 12 + (h % 14) + row * 6;
      const gap = floorY(x + w / 2) - ceilY(x + w / 2);
      for (const down of [true, false]) {
        const hh = artHash(k, row * 2 + (down ? 0 : 1) + 1801);
        if (hh % 3 === 0) continue;
        const len = gap * (0.12 + ((hh >>> 5) % 24) / 100);
        const base = down ? ceilY(x + w / 2) - 30 : floorY(x + w / 2) + 30;
        const tip = down ? base + 30 + len : base - 30 - len;
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x + w, base);
        ctx.lineTo(x + w * (0.5 + (((hh >>> 9) % 20) - 10) / 100), tip);
        ctx.closePath();
        ctx.fill();
        // A faint cold crystal glinting on one in five.
        if (row === 0 && hh % 5 === 1) {
          const cy = base + (tip - base) * 0.55;
          const cx = x + w * 0.5;
          const glow = still ? 0.5 : 0.35 + 0.25 * Math.sin((tick + (hh % 200)) / 50);
          ctx.save();
          ctx.globalAlpha = glow * 0.5;
          ctx.fillStyle = "#6FE3C8";
          ctx.beginPath();
          ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = glow;
          ctx.fillStyle = "#C8FFF0";
          ctx.fillRect(cx - 0.8, cy - 1.6, 1.6, 3.2);
          ctx.restore();
        }
      }
    }
  }
  // A pale mist drifting low over the floor (still under reduced motion).
  const drift = still ? 0 : (tick * 0.15) % FLIP_WORLD_W;
  for (let k = 0; k < 4; k++) {
    const h = artHash(k, 2311);
    const x = ((((h % FLIP_WORLD_W) + drift * (k % 2 ? 1 : 0.6)) % (FLIP_WORLD_W + 160)) + FLIP_WORLD_W + 160) % (FLIP_WORLD_W + 160) - 80;
    const y = floorY(x) - 14 - ((h >>> 8) % 18);
    const mist = ctx.createRadialGradient(x, y, 4, x, y, 90);
    mist.addColorStop(0, "rgba(150,190,185,0.07)");
    mist.addColorStop(1, "rgba(150,190,185,0)");
    ctx.fillStyle = mist;
    ctx.fillRect(x - 90, y - 90, 180, 180);
  }
}

/** Polish A4: spores (were embers) drifting slowly up through the tunnel, each with a faint glow; still under reduced motion. */
function drawTunnelEmbers(ctx: CanvasRenderingContext2D, tick: number, still: boolean,
  floorY: (x: number) => number = () => FLIP_FLOOR_Y, ceilY: (x: number) => number = () => FLIP_CEIL_Y): void {
  for (let k = 0; k < 14; k++) {
    const h = artHash(k, 2203);
    const life = 240 + (h % 160);
    const age = still ? (h >>> 3) % life : (tick + (h % life)) % life;
    const x = ((((h >>> 6) % FLIP_WORLD_W) - age * 0.25) % FLIP_WORLD_W + FLIP_WORLD_W) % FLIP_WORLD_W + (still ? 0 : Math.sin((tick + k * 37) / 40) * 6);
    const y = floorY(x) - 6 - age * ((floorY(x) - ceilY(x)) / life);
    const fade = Math.sin((age / life) * Math.PI);
    // Pale, cold spores (since 27 Oct 2026; were warm embers): the cave is eerie, the lava alone is warm.
    ctx.globalAlpha = fade * 0.22;
    ctx.fillStyle = "#7FD9C4";
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = fade * 0.7;
    ctx.fillStyle = k % 3 ? "#BFEFE2" : "#E8FFF8";
    ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;
}

/** The game's drawing through the shared success layer (presentation only). */
export function drawFlipArt(ctx: CanvasRenderingContext2D, state: FlipState, size: CanvasSize): void {
  arcadeFx(ctx, flipFxFor(state), state, () => drawFlipArtWorld(ctx, state, size), size);
}

function drawFlipArtWorld(ctx: CanvasRenderingContext2D, state: FlipState, size: CanvasSize): void {
  const still = reducedMotion();
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(state.tick / 10);
  worldH = flipWorldH(state);
  RUNNER_X = flipRunnerX(state);
  const FLIP_WORLD_H = worldH;
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
  const floorBase = (x: number) => flipSurfaceBase(state, 0, toWorld(x));
  const ceilBase = (x: number) => flipSurfaceBase(state, 1, toWorld(x));
  const floorAt = (x: number) => floorBase(x) + flipWarpAt(state, 0, toWorld(x));
  const ceilAt = (x: number) => ceilBase(x) + flipWarpAt(state, 1, toWorld(x));
  drawCave(ctx, state, 0, floorAt, still);
  drawCave(ctx, state, 1, ceilAt, still);
  bandPath(ctx, ceilAt, floorAt);
  // Polish G: the tunnel air is darkest in the middle and warmed by the lava rails at both edges.
  // Rev 8 lights the air from the bent rails at the runner (the corridor bends further in the taller cave).
  const air = state.exp
    ? ctx.createLinearGradient(0, ceilAt(RUNNER_X) - 30, 0, floorAt(RUNNER_X) + 30)
    : ctx.createLinearGradient(0, ceilBase(RUNNER_X) - 30, 0, floorBase(RUNNER_X) + 30);
  // Darker and colder since 27 Oct 2026 (the eerie cave), with only a hint of the lava's warmth at the rails.
  air.addColorStop(0, "#1E1412");
  air.addColorStop(0.16, "#0E1113");
  air.addColorStop(0.5, "#080A0C");
  air.addColorStop(0.84, "#0E1113");
  air.addColorStop(1, "#1E1412");
  ctx.fillStyle = air;
  ctx.fill();
  // Display only: the cave's depths (stalactites, stalagmites, cold crystals, mist; until 27 Oct 2026 a far city)
  // and spores drifting up through them, clipped to the tunnel, behind every hazard and the runner. Nothing collides.
  if (!arcadeReducedEffects()) {
    ctx.save();
    bandPath(ctx, ceilAt, floorAt);
    ctx.clip();
    // Rev 8: two layers on the bent rails; earlier revisions keep one on the fixed lines.
    drawCaveDepths(ctx, still ? 0 : state.x / FP, state.tick, still, state.exp ? floorAt : floorBase, state.exp ? ceilAt : ceilBase, state.exp ? 2 : 1);
    drawTunnelEmbers(ctx, state.tick, still, floorBase, ceilBase);
    ctx.restore();
  }
  // Rev 8: speed zones light the tunnel air and the rails rush past.
  if (state.exp) drawSpeedZones(ctx, state, toScreen, ceilAt, floorAt, still);

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
    // Reduced effects: the soft glow strokes into the rock are skipped (the rail lines stay).
    if (!arcadeReducedEffects()) {
      ctx.save();
      rockPath(ctx, side, at);
      ctx.clip();
      rail();
      ctx.strokeStyle = "rgba(255,69,24,0.14)";
      ctx.lineWidth = 30;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,80,26,0.28)";
      ctx.lineWidth = 14;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,130,50,0.35)";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    }
    // Polish A4: a brighter roof edge, a hot white-gold core on the lava line.
    rail();
    ctx.strokeStyle = MATERIAL.lava;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.strokeStyle = MATERIAL.hot;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,240,200,0.7)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // flipRev 8: the sweet spots on the roofs (a faint strip on the rail; the runner's centre lands inside it).
  if (state.exp) drawSweetSpots(ctx, state, toScreen, ceilAt, floorAt, still);

  const y = runnerY(state, state.side, state.flipT, runnerBox(state).h / 2) + state.warpY;
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
      const previousY = runnerY(state, state.side, Math.min(state.exp ? state.arcN || FLIP_ARC_TICKS : FLIP_ARC_TICKS, state.flipT + k), runnerBox(state).h / 2) + state.warpY;
      ctx.fillRect(RUNNER_X - 7 - k * 3, previousY + (k % 3 - 1) * 2, 1.3, 1.3);
    }
  }
  ctx.restore();
  for (let i = Math.max(0, state.cursor - 1); i < state.segs.length; i++) {
    const seg = state.segs[i];
    if (!seg) continue;
    const a = toScreen(seg.x0);
    const b = toScreen(seg.x1);
    // Rev 8's moving spikes reach up to 70 px either side of their place, so the scan runs that much past the edge.
    if (a > FLIP_WORLD_W + (state.exp ? 72 : 0)) break;
    if (a > FLIP_WORLD_W && !seg.amp) continue;
    if (b + (seg.amp ?? 0) / FP < 0) continue;
    const inward = seg.side === 0 ? -1 : 1;
    const at = seg.side === 0 ? floorAt : ceilAt;
    if (seg.amp) {
      // Rev 8 moving spike: its groove (the stretch it slides along) under the rock, then the spike where the sim has it.
      const shift = flipSegShift(seg, state.tick) / FP;
      drawSlideGroove(ctx, a - seg.amp / FP, b + seg.amp / FP, inward, at, pulse);
      drawRockObstacle(ctx, a + shift, b + shift, inward, at, SPIKE_HEIGHT, seg.x0 ^ state.warpFloor, pulse);
      continue;
    }
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
  // Rev 8: checkpoint gates and the star trails (light and pickups only; nothing here collides).
  if (state.exp) {
    drawCheckpoints(ctx, state, toScreen, ceilAt, floorAt, pulse, still);
    drawTrails(ctx, state, toScreen, ceilAt, floorAt, still);
    // The save a checkpoint gives, while it is ready: a small gold shield at the tunnel's left edge, mid-height
    // (hazards stand on the surfaces, so the middle of the tunnel is always clear there).
    drawSaveBadge(ctx, state, 8, (ceilAt(15) + floorAt(15)) / 2 - 8);
  }
  ctx.save();
  // Pool deaths sink behind the opening; no new player or hazard geometry.
  if (sink !== null) { bandPath(ctx, ceilAt, floorAt); ctx.clip(); }
  drawRunnerHero(ctx, state, y, still, sink);
  if (state.exp && (state.inv ?? 0) > 0 && state.ended === 0) drawShield(ctx, state, y, still);
  successFrame(ctx,{id:'flip',tick:state.tick,count:0,eventTick:state.flipT>0?state.tick-((state.exp?state.arcN||FLIP_ARC_TICKS:FLIP_ARC_TICKS)-state.flipT):0,enabled:state.ended===0,colour:MATERIAL.hot,width:FLIP_WORLD_W,height:FLIP_WORLD_H,point:{x:RUNNER_X,y:y+(state.side===0?-1:1)*runnerBox(state).h/2,shape:'pixel'}});
  ctx.restore();
  ctx.restore();
}

/* ====================== flipRev 8 features (art only) ====================== */

/** A sweet landing's glint lasts this many ticks. */
const SWEET_GLINT_TICKS = 24;

/**
 * flipRev 8 sweet spots: each is a short, faint pale-gold strip laid on its rail exactly over the stretch the
 * runner's centre must land in (its x-span, so what you see is what counts), with a tiny notch at each end. A spot
 * already landed on fades to a ghost; a sweet landing glints once along its strip (held still under reduced motion).
 */
function drawSweetSpots(ctx: CanvasRenderingContext2D, state: FlipState, toScreen: (wx: number) => number,
  ceilAt: Surface, floorAt: Surface, still: boolean): void {
  const sweets = state.v8?.sweets;
  if (!sweets?.length) return;
  const got = state.sweetGot ?? 0;
  const since = state.tick - (state.sweetT ?? 0);
  ctx.save();
  ctx.lineCap = "butt";
  sweets.forEach((sweet, i) => {
    const a = toScreen(sweet.x0);
    const b = toScreen(sweet.x1);
    if (b < -4 || a > FLIP_WORLD_W + 4) return;
    const at = sweet.side === 0 ? floorAt : ceilAt;
    const inward = sweet.side === 0 ? -1 : 1;
    const taken = (got & (1 << i)) !== 0;
    const landedX = state.sweetT ? state.v8!.xs[state.sweetT]! : -1;
    const glint = taken && since >= 0 && since < SWEET_GLINT_TICKS && landedX >= sweet.x0 && landedX <= sweet.x1;
    // The strip, a hair inside the rock so the lava line stays readable.
    const strip = () => {
      ctx.beginPath();
      for (let x = a; x <= b; x += Math.max(1, (b - a) / 6)) {
        const y = at(x) - inward * 2;
        if (x === a) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(b, at(b) - inward * 2);
    };
    const alpha = taken ? (glint ? 1 : 0.18) : 0.82;
    // A soft pale glow on the strip only (butt caps: never past its ends), then the strip itself.
    if (!taken && !arcadeReducedEffects()) {
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = "#FFE7A8";
      ctx.lineWidth = 6;
      strip();
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = glint ? "#FFF6D8" : "rgba(255,242,204,0.95)";
    ctx.lineWidth = 2.4;
    strip();
    ctx.stroke();
    // End notches into the rock.
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const x of [a, b]) {
      ctx.moveTo(x, at(x) - inward * 0.5);
      ctx.lineTo(x, at(x) - inward * 6);
    }
    ctx.stroke();
    if (glint && !arcadeReducedEffects()) {
      // A small star of light running along the strip once.
      const p = still ? 0.5 : since / SWEET_GLINT_TICKS;
      const gx = a + (b - a) * p;
      const gy = at(gx) - inward * 2;
      ctx.globalAlpha = still ? 0.8 : 1 - p * 0.7;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(gx, gy - 5);
      ctx.lineTo(gx + 1.2, gy - 1.2);
      ctx.lineTo(gx + 5, gy);
      ctx.lineTo(gx + 1.2, gy + 1.2);
      ctx.lineTo(gx, gy + 5);
      ctx.lineTo(gx - 1.2, gy + 1.2);
      ctx.lineTo(gx - 5, gy);
      ctx.lineTo(gx - 1.2, gy - 1.2);
      ctx.closePath();
      ctx.fill();
    }
  });
  ctx.restore();
}

/** The stretch a moving spike slides along: a faint hot groove in the rail with stops at both ends. */
function drawSlideGroove(ctx: CanvasRenderingContext2D, a: number, b: number, inward: number, at: Surface, pulse: number): void {
  if (b <= a) return;
  ctx.save();
  ctx.globalAlpha = 0.35 + pulse * 0.2;
  ctx.strokeStyle = MATERIAL.hot;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  flipSurfaceLine(ctx, (x) => at(x) - inward * 4, a, b);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = MATERIAL.lava;
  ctx.lineWidth = 2;
  for (const x of [a, b]) {
    ctx.beginPath();
    ctx.moveTo(x, at(x) - inward * 1);
    ctx.lineTo(x, at(x) - inward * 8);
    ctx.stroke();
  }
  ctx.restore();
}

/** Speed zones: warm air and rushing light between the zone's two glowing gates. */
function drawSpeedZones(ctx: CanvasRenderingContext2D, state: FlipState, toScreen: (wx: number) => number,
  ceilAt: Surface, floorAt: Surface, still: boolean): void {
  const v8 = state.v8;
  if (!v8) return;
  const z = v8.zones;
  const live = flipV8InZone(v8, state.tick) && state.ended === 0;
  ctx.save();
  bandPath(ctx, ceilAt, floorAt);
  ctx.clip();
  for (let i = 0; i < z.length; i += 2) {
    const xa = toScreen(v8.xs[z[i]!]!);
    const xb = toScreen(v8.xs[z[i + 1]!]!);
    if (xb < -20 || xa > FLIP_WORLD_W + 20) continue;
    const a = Math.max(-4, xa);
    const b = Math.min(FLIP_WORLD_W + 4, xb);
    ctx.fillStyle = "rgba(255,170,70,0.07)";
    ctx.fillRect(a, 0, b - a, worldH);
    // Chevrons down the middle of the zone, fixed to the tunnel (so they rush past at the zone's speed).
    ctx.strokeStyle = "rgba(255,214,150,0.32)";
    ctx.lineWidth = 2;
    const first = Math.ceil((a - xa) / 46) * 46 + xa;
    for (let x = first; x < b; x += 46) {
      const mid = (ceilAt(x) + floorAt(x)) / 2;
      for (const dy of [-34, 34]) {
        ctx.beginPath();
        ctx.moveTo(x - 6, mid + dy - 8);
        ctx.lineTo(x + 4, mid + dy);
        ctx.lineTo(x - 6, mid + dy + 8);
        ctx.stroke();
      }
    }
    // The gates: a bright lava-gold line across the tunnel where the zone starts and ends.
    for (const [x, strong] of [[xa, true], [xb, false]] as const) {
      if (x < -6 || x > FLIP_WORLD_W + 6) continue;
      const g = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
      g.addColorStop(0, "rgba(255,170,70,0)");
      g.addColorStop(0.5, strong ? "rgba(255,214,150,0.55)" : "rgba(255,170,70,0.3)");
      g.addColorStop(1, "rgba(255,170,70,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 6, ceilAt(x) - 2, 12, floorAt(x) - ceilAt(x) + 4);
    }
  }
  // Inside a zone: thin speed streaks through the air, faster than the scroll (skipped under reduced effects).
  if (live && !arcadeReducedEffects()) {
    for (let k = 0; k < 9; k++) {
      const h = artHash(k, 3301);
      const len = 30 + (h % 40);
      const x = still ? h % FLIP_WORLD_W : FLIP_WORLD_W - ((state.tick * (11 + (h % 6)) + h) % (FLIP_WORLD_W + len));
      const t = ((h >>> 8) % 100) / 100;
      const y = ceilAt(x) + (floorAt(x) - ceilAt(x)) * (0.12 + t * 0.76);
      ctx.strokeStyle = k % 3 ? "rgba(255,214,150,0.22)" : "rgba(255,240,200,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Checkpoint gates: two obsidian posts with hot caps and a light curtain; lit gold once passed. */
function drawCheckpoints(ctx: CanvasRenderingContext2D, state: FlipState, toScreen: (wx: number) => number,
  ceilAt: Surface, floorAt: Surface, pulse: number, still: boolean): void {
  const v8 = state.v8;
  if (!v8) return;
  FLIP_V8_CHECKPOINTS.forEach((tick, i) => {
    const x = toScreen(v8.xs[tick]!);
    if (x < -20 || x > FLIP_WORLD_W + 20) return;
    const passed = (state.cpPassed ?? 0) > i;
    const top = ceilAt(x);
    const bottom = floorAt(x);
    ctx.save();
    // Light curtain (no collision): shimmering gold dashes from roof to floor.
    ctx.globalAlpha = passed ? 0.3 : 0.45 + pulse * 0.25;
    ctx.strokeStyle = passed ? MATERIAL.figure : MATERIAL.lamp;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = still ? 0 : -state.tick * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, top + 14);
    ctx.lineTo(x, bottom - 14);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // Posts on both rails.
    for (const [y, dir] of [[top, 1], [bottom, -1]] as const) {
      ctx.fillStyle = MATERIAL.obsidian;
      ctx.fillRect(x - 3, Math.min(y, y + dir * 14), 6, 14);
      ctx.fillStyle = passed ? MATERIAL.figure : MATERIAL.hot;
      ctx.fillRect(x - 3, y + dir * 12 - (dir < 0 ? 2 : 0), 6, 2);
    }
    // A pennant on the top post: gold once passed, else hot orange.
    ctx.fillStyle = passed ? MATERIAL.figure : MATERIAL.lava;
    ctx.beginPath();
    ctx.moveTo(x + 3, top + 14);
    ctx.lineTo(x + 15, top + 18);
    ctx.lineTo(x + 3, top + 22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

/** A bonus trail: small pale-gold stars on a flip's arc, a dotted guide and a launch chevron on its surface. */
function drawTrails(ctx: CanvasRenderingContext2D, state: FlipState, toScreen: (wx: number) => number,
  ceilAt: Surface, floorAt: Surface, still: boolean): void {
  const v8 = state.v8;
  if (!v8) return;
  const lift = runnerBox(state).h / 2;
  const yAt = (x: number, f: number) => {
    const low = floorAt(x) - lift;
    const high = ceilAt(x) + lift;
    return low + ((high - low) * f) / 1000;
  };
  v8.trails.forEach((trail, i) => {
    const bits = state.trailGot?.[i] ?? 0;
    if (bits === (1 << FLIP_V8_TRAIL_STARS) - 1) return;
    const lx = toScreen(trail.launch);
    const last = toScreen(trail.x[FLIP_V8_TRAIL_STARS - 1]!);
    if (last < -20 || lx > FLIP_WORLD_W + 20) return;
    const missed = state.tick > trail.t1;
    ctx.save();
    // Dotted guide through the stars (from the launch point).
    ctx.globalAlpha = missed ? 0.12 : 0.3;
    ctx.strokeStyle = MATERIAL.lamp;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(lx, yAt(lx, trail.from === 0 ? 0 : 1000));
    trail.x.forEach((wx, k) => ctx.lineTo(toScreen(wx), yAt(toScreen(wx), trail.f[k]!)));
    ctx.stroke();
    ctx.setLineDash([]);
    // Launch chevron on the surface the trail rises from.
    ctx.globalAlpha = missed ? 0.25 : 0.9;
    ctx.fillStyle = MATERIAL.hot;
    const sy = trail.from === 0 ? floorAt(lx) : ceilAt(lx);
    const dir = trail.from === 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(lx - 7, sy + dir * 2);
    ctx.lineTo(lx, sy + dir * 9);
    ctx.lineTo(lx + 7, sy + dir * 2);
    ctx.lineTo(lx, sy + dir * 5);
    ctx.closePath();
    ctx.fill();
    // The stars not yet taken.
    ctx.globalAlpha = missed ? 0.3 : 1;
    trail.x.forEach((wx, k) => {
      if (bits & (1 << k)) return;
      const x = toScreen(wx);
      if (x < -10 || x > FLIP_WORLD_W + 10) return;
      drawTrailStar(ctx, x, yAt(x, trail.f[k]!), state.tick + k * 9, still);
    });
    ctx.restore();
  });
}

function drawTrailStar(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number, still: boolean): void {
  const r = 6;
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(tick / 7);
  if (!arcadeReducedEffects()) {
    const glow = ctx.createRadialGradient(x, y, 0.5, x, y, r * 2);
    glow.addColorStop(0, `rgba(255,244,190,${0.35 + pulse * 0.25})`);
    glow.addColorStop(1, "rgba(255,244,190,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
  }
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const reach = k % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    if (k === 0) ctx.moveTo(x + Math.cos(a) * reach, y + Math.sin(a) * reach);
    else ctx.lineTo(x + Math.cos(a) * reach, y + Math.sin(a) * reach);
  }
  ctx.closePath();
  ctx.fillStyle = "#FFF1A8";
  ctx.fill();
  ctx.strokeStyle = "#FFFBE0";
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

/** A checkpoint's save in use: the runner box outlined in flickering gold while the shield lasts. */
function drawShield(ctx: CanvasRenderingContext2D, state: FlipState, y: number, still: boolean): void {
  const box = runnerBox(state);
  ctx.save();
  ctx.globalAlpha = still ? 0.7 : 0.45 + 0.4 * Math.abs(Math.sin(state.tick / 3));
  ctx.strokeStyle = MATERIAL.lamp;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(RUNNER_X - box.half + 1, y - box.h / 2 + 1, box.half * 2 - 2, box.h - 2, 8);
  ctx.stroke();
  ctx.restore();
}

/** HUD: a small gold shield beside the score while a checkpoint's save is ready. */
function drawSaveBadge(ctx: CanvasRenderingContext2D, state: FlipState, x: number, y: number): void {
  if (!state.save) return;
  ctx.save();
  ctx.fillStyle = "rgba(245,184,46,0.25)";
  ctx.strokeStyle = MATERIAL.figure;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 7, y + 1);
  ctx.lineTo(x + 13, y + 3.5);
  ctx.lineTo(x + 12, y + 10);
  ctx.lineTo(x + 7, y + 15);
  ctx.lineTo(x + 2, y + 10);
  ctx.lineTo(x + 1, y + 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
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

/**
 * Arena scene (15 Oct 2026, display only; arenaScene.renderer.ts): more rock past the
 * world, out to the arena box's edges: deep basalt under the floor's rock, held still
 * (the world's rock scrolls; this is the far, unmoving bedrock), with faint joints,
 * strata and speckle. No lava rails, pools, spikes, stars or tunnel air, so the run
 * corridor ends where it always did. Beside the world (a wide screen) it is all rock.
 */
export function flipArenaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView, H = FLIP_WORLD_H): void {
  const paintRock = (r: { x: number; y: number; w: number; h: number }, seed: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    // Basalt joints: slanted seams with a faint lit edge.
    for (let x = r.x - 20, k = 0; x < r.x + r.w; k++) {
      const h = artHash(k, seed);
      const w = 22 + (h % 20);
      const lean = ((h >>> 5) % 9) - 4;
      ctx.fillStyle = h % 3 === 0 ? "rgba(255,255,255,0.018)" : "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.moveTo(x, r.y);
      ctx.lineTo(x + w, r.y);
      ctx.lineTo(x + w + lean * (r.h / 260), r.y + r.h);
      ctx.lineTo(x + lean * (r.h / 260), r.y + r.h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, r.y);
      ctx.lineTo(x + lean * (r.h / 260), r.y + r.h);
      ctx.stroke();
      x += w;
    }
    for (let band = 0, y = r.y + 30; y < r.y + r.h; band++, y += 56) {
      ctx.strokeStyle = band % 2 ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.03)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let px = r.x; px <= r.x + r.w + 12; px += 12) {
        const yy = y + Math.sin((px / 390) * Math.PI * 4 + band) * 5;
        if (px === r.x) ctx.moveTo(px, yy);
        else ctx.lineTo(px, yy);
      }
      ctx.stroke();
    }
    const specks = Math.round((r.w * r.h) / 300);
    for (let k = 0; k < specks; k++) {
      const h = artHash(k, seed + 1);
      ctx.fillStyle = h % 5 === 0 ? "rgba(255,190,150,0.06)" : "rgba(0,0,0,0.3)";
      ctx.fillRect(r.x + ((h >>> 3) % 10007) / 10007 * r.w, r.y + ((h >>> 15) % 9973) / 9973 * r.h, 1 + ((h >>> 28) & 1), 1);
    }
    ctx.restore();
  };
  for (const side of sceneSides(view)) {
    sceneFill(ctx, side, 0, H, [[0, "#111115"], [0.5, "#1A191F"], [1, "#111115"]]);
    paintRock(side, 911);
  }
  const below = sceneBelow(view);
  if (!below) return;
  sceneFill(ctx, below, H, view.bottom, [[0, "#121216"], [Math.min(1, 160 / below.h), "#100F13"], [1, "#0F0E12"]]);
  paintRock(below, 907);
}

/** flipRev 8's taller cave: the same bedrock scene under its 730 px world. */
export function flipArenaSceneTall(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  flipArenaScene(ctx, view, FLIP_V8_WORLD_H);
}
/** The arena scene for a stored puzzle.flipRev (one function per world height, so the stage keeps its identity). */
export function flipArenaSceneFor(rev?: number | null): (ctx: CanvasRenderingContext2D, view: ArenaSceneView) => void {
  return flipWorldHFor(rev) === FLIP_V8_WORLD_H ? flipArenaSceneTall : flipArenaScene;
}
