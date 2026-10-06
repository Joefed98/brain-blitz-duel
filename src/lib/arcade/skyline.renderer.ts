/**
 * Skyline art (Real World construction site). Render only: reads SkylineState,
 * never mutates it. Blocks fill exactly the sim's block rectangles; the camera
 * is the same render-only eased zoom/scroll as skyline.ts.
 */
import { px, type CanvasSize } from "./engine";
import { skylineGame, SKYLINE_BLOCK_H, SKYLINE_MIN_ZOOM, SKYLINE_PERFECT_GROW, SKYLINE_WORLD_H, SKYLINE_WORLD_W, type SkylineState } from "./skyline";
import { artHash, reducedMotion } from "./art.renderer";
import { realClock, realCloud, realMemo, realNow, realSky, REAL_GOLD, REAL_INK, REAL_SHADOW } from "./realworld.renderer";

/** City glass tints, cycled per level. */
const GLASS = ["#7FB3D5", "#9CC9C2", "#A9B8D8", "#8FBCE0", "#B5C7D3", "#7FA8C9", "#A4C4B4", "#98AEC8"];
const STEEL = "#4A5563";
const STEEL_LIGHT = "#6B7684";
const JIB_Y = 30;
const CHUNK_MS = 900;
const SPARK_TICKS = 18;

const zoomMemo = new WeakMap<CanvasRenderingContext2D, number>();

interface Chunk { x: number; w: number; top: number; dir: number; at: number; colour: number }
interface Memory { tick: number; len: number; x: number; w: number; missed: boolean; chunks: Chunk[] }
const memories = new WeakMap<CanvasRenderingContext2D, Memory>();

function remember(ctx: CanvasRenderingContext2D, s: SkylineState): Memory {
  const m = realMemo(memories, ctx, s.tick, () => ({ tick: s.tick, len: s.blocks.length, x: s.x, w: s.w, missed: s.missed, chunks: [] }));
  const blockH = px(SKYLINE_BLOCK_H);
  const now = realNow();
  if (s.tick !== m.tick) {
    if (s.blocks.length > m.len && s.perfectTick !== s.tick) {
      const top = s.blocks[s.blocks.length - 1]!;
      const y = SKYLINE_WORLD_H - (s.blocks.length - 1) * blockH - blockH;
      const idx = s.blocks.length - 1;
      if (top.x > m.x) m.chunks.push({ x: m.x, w: top.x - m.x, top: y, dir: -1, at: now, colour: idx });
      const r0 = top.x + top.w;
      const r1 = m.x + m.w;
      if (r1 > r0) m.chunks.push({ x: r0, w: r1 - r0, top: y, dir: 1, at: now, colour: idx });
    }
    if (s.missed && !m.missed) {
      const y = SKYLINE_WORLD_H - s.blocks.length * blockH - blockH;
      m.chunks.push({ x: m.x, w: m.w, top: y, dir: s.dir, at: now, colour: s.blocks.length });
    }
    m.tick = s.tick;
    m.len = s.blocks.length;
    m.x = s.x;
    m.w = s.w;
    m.missed = s.missed;
  }
  m.chunks = m.chunks.filter((c) => now - c.at < CHUNK_MS);
  return m;
}

const BACKDROP = [
  [0, 34, 120], [30, 26, 180], [54, 40, 140], [92, 22, 210], [112, 36, 160], [146, 30, 240],
  [174, 44, 130], [216, 26, 200], [240, 38, 170], [276, 30, 230], [304, 42, 150], [344, 24, 190], [366, 30, 140],
] as const;

function drawBackdrop(ctx: CanvasRenderingContext2D, zoom: number, scroll: number): void {
  const k = 1 - (1 - zoom) * 0.2;
  ctx.save();
  ctx.translate(SKYLINE_WORLD_W / 2, SKYLINE_WORLD_H + scroll * 0.2 * zoom);
  ctx.scale(k, k);
  ctx.translate(-SKYLINE_WORLD_W / 2, -SKYLINE_WORLD_H);
  ctx.fillStyle = "#B9C9D8";
  for (const [x, w, h] of BACKDROP) ctx.fillRect(x - 40, SKYLINE_WORLD_H - h, w - 2, h);
  ctx.fillStyle = "#A3B5C7";
  for (const [x, w, h] of BACKDROP) ctx.fillRect(x + 15, SKYLINE_WORLD_H - h * 0.6, w - 4, h * 0.6);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (const [x, w, h] of BACKDROP) {
    for (let wy = SKYLINE_WORLD_H - h * 0.6 + 8; wy < SKYLINE_WORLD_H - 6; wy += 14) {
      for (let wx = x + 19; wx < x + 15 + w - 8; wx += 8) ctx.fillRect(wx, wy, 3, 5);
    }
  }
  ctx.restore();
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, top: number, w: number, h: number, index: number): void {
  ctx.fillStyle = STEEL;
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = GLASS[index % GLASS.length]!;
  const inset = 3;
  const panes = Math.max(1, Math.round((w - inset * 2) / 16));
  const pw = (w - inset * 2) / panes;
  for (let p = 0; p < panes; p++) ctx.fillRect(x + inset + p * pw + 1, top + inset + 2, pw - 2, h - inset * 2 - 4);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  for (let p = 0; p < panes; p++) ctx.fillRect(x + inset + p * pw + 1, top + inset + 2, Math.max(1, (pw - 2) * 0.3), h - inset * 2 - 4);
  ctx.fillStyle = STEEL_LIGHT;
  ctx.fillRect(x, top, w, 2);
}

function drawCrane(ctx: CanvasRenderingContext2D, trolleyX: number, tick: number): void {
  // Lattice jib across the top, from a mast stub at the right.
  ctx.fillStyle = REAL_GOLD;
  ctx.fillRect(0, JIB_Y, SKYLINE_WORLD_W, 3);
  ctx.fillRect(0, JIB_Y + 9, SKYLINE_WORLD_W, 3);
  ctx.strokeStyle = REAL_GOLD;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x < SKYLINE_WORLD_W; x += 12) {
    ctx.moveTo(x, JIB_Y + 3);
    ctx.lineTo(x + 6, JIB_Y + 9);
    ctx.lineTo(x + 12, JIB_Y + 3);
  }
  ctx.stroke();
  // Trolley.
  ctx.fillStyle = REAL_INK;
  ctx.fillRect(trolleyX - 8, JIB_Y + 11, 16, 5);
  void tick;
}

export function drawSkylineArt(ctx: CanvasRenderingContext2D, state: SkylineState, size: CanvasSize): void {
  const scale = Math.min(size.width / SKYLINE_WORLD_W, size.height / SKYLINE_WORLD_H);
  const offsetX = (size.width - SKYLINE_WORLD_W * scale) / 2;
  const offsetY = (size.height - SKYLINE_WORLD_H * scale) / 2;
  const blockH = px(SKYLINE_BLOCK_H);
  const mem = remember(ctx, state);
  const t = realClock();

  ctx.save();
  realSky(ctx, 0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const towerH = state.blocks.length * blockH;
  const middle = SKYLINE_WORLD_H / 2;
  const target = towerH + blockH <= middle ? 1 : Math.max(SKYLINE_MIN_ZOOM, middle / (towerH + blockH));
  const prev = zoomMemo.get(ctx);
  const zoom = prev === undefined || state.tick < 2 ? target : prev + (target - prev) * 0.12;
  zoomMemo.set(ctx, zoom);
  const visibleH = SKYLINE_WORLD_H / zoom;
  const camScroll = Math.max(0, towerH + blockH - visibleH * 0.5);

  // Clouds drift slowly (frozen under reduced motion).
  for (let c = 0; c < 4; c++) {
    const h = artHash(c, 41);
    const span = SKYLINE_WORLD_W + 160;
    const x = ((h % span) + t * (6 + (h % 5))) % span - 80;
    realCloud(ctx, x, 70 + c * 55 + ((h >>> 8) % 30), 22 + ((h >>> 4) % 14), 0.8);
  }
  drawBackdrop(ctx, zoom, camScroll);

  ctx.save();
  ctx.translate(SKYLINE_WORLD_W / 2, SKYLINE_WORLD_H);
  ctx.scale(zoom, zoom);
  ctx.translate(-SKYLINE_WORLD_W / 2, -SKYLINE_WORLD_H + camScroll);

  // Ground slab under the base.
  ctx.fillStyle = "#8C8F94";
  ctx.fillRect(-SKYLINE_WORLD_W, SKYLINE_WORLD_H, SKYLINE_WORLD_W * 3, 400);

  state.blocks.forEach((block, index) => {
    const top = SKYLINE_WORLD_H - index * blockH - blockH;
    if (index > 0) {
      const below = state.blocks[index - 1]!;
      // Soft shadow on the block below, inside its own rectangle.
      const l = Math.max(px(block.x), px(below.x));
      const r = Math.min(px(block.x + block.w), px(below.x + below.w));
      ctx.fillStyle = REAL_SHADOW;
      if (r > l) ctx.fillRect(l, top + blockH, r - l, 3);
    }
    drawBlock(ctx, px(block.x), top, px(block.w), blockH, index);
  });

  const hangTop = SKYLINE_WORLD_H - state.blocks.length * blockH - blockH;
  let hookX = SKYLINE_WORLD_W / 2;
  if (!state.missed) {
    const bx = px(state.x);
    const bw = px(state.w);
    hookX = bx + bw / 2;
    // Cable and slings from far above down to the hook.
    ctx.strokeStyle = REAL_INK;
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(hookX, hangTop - 4000);
    ctx.lineTo(hookX, hangTop - 14);
    ctx.moveTo(hookX, hangTop - 14);
    ctx.lineTo(bx + 3, hangTop);
    ctx.moveTo(hookX, hangTop - 14);
    ctx.lineTo(bx + bw - 3, hangTop);
    ctx.stroke();
    ctx.fillStyle = REAL_GOLD;
    ctx.fillRect(hookX - 3, hangTop - 18, 6, 5);
    drawBlock(ctx, bx, hangTop, bw, blockH, state.blocks.length);
  }

  // Perfect drop: sparks at the two seam ends (tick-driven, deterministic).
  const age = state.tick - state.perfectTick;
  if (state.perfectTick > 0 && age < SPARK_TICKS && !reducedMotion()) {
    const top = state.blocks[state.blocks.length - 1]!;
    const seamY = SKYLINE_WORLD_H - (state.blocks.length - 1) * blockH;
    ctx.fillStyle = REAL_GOLD;
    for (const ex of [px(top.x), px(top.x + top.w)]) {
      for (let k = 0; k < 6; k++) {
        const h = artHash(state.perfectTick, k + (ex > 195 ? 10 : 0));
        const vx = ((h % 9) - 4) * 0.4 + (ex > px(top.x) ? 0.8 : -0.8);
        const vy = -1.2 - ((h >>> 5) % 5) * 0.3;
        ctx.fillRect(ex + vx * age, seamY + vy * age + 0.06 * age * age, 2, 2);
      }
    }
  } else if (state.perfectTick > 0 && age < SPARK_TICKS) {
    const seamY = SKYLINE_WORLD_H - (state.blocks.length - 1) * blockH;
    ctx.fillStyle = REAL_GOLD;
    ctx.fillRect(-SKYLINE_WORLD_W, seamY - 1, SKYLINE_WORLD_W * 3, 2);
  }
  void SKYLINE_PERFECT_GROW;

  // Overhangs (and a missed block) fall away as chunks.
  const now = realNow();
  for (const c of mem.chunks) {
    const k = (now - c.at) / CHUNK_MS;
    const fall = 900 * k * k;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.translate(px(c.x) + px(c.w) / 2 + c.dir * 40 * k, c.top + blockH / 2 + fall);
    ctx.rotate(c.dir * k * 1.4);
    drawBlock(ctx, -px(c.w) / 2, -blockH / 2, px(c.w), blockH, c.colour);
    ctx.restore();
  }
  ctx.restore();

  // Crane jib at the top, trolley above the hook's screen x.
  drawCrane(ctx, (hookX - SKYLINE_WORLD_W / 2) * zoom + SKYLINE_WORLD_W / 2, state.tick);

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = REAL_INK;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`Blocks ${state.placed}`, 12, 12);

  if (state.missed) {
    ctx.fillStyle = "rgba(229, 72, 77, 0.18)";
    ctx.fillRect(0, 0, SKYLINE_WORLD_W, SKYLINE_WORLD_H);
  }
  ctx.restore();
}

export const skylineArtGame = { ...skylineGame, draw: drawSkylineArt };
export const SKYLINE_ART_BG = "#BFDDF2";
