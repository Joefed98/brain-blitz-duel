import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { SKYLINE_FX } from "./arcadeFxGames.renderer";
/**
 * Skyline art (Real World construction site). Render only: reads SkylineState,
 * never mutates it. Blocks fill exactly the sim's block rectangles; the camera
 * is the same render-only eased zoom/scroll as skyline.ts.
 */
import { px, type CanvasSize } from "./engine";
import { skylineFlagAt, skylineGustAt, SKYLINE_STREAK_FROM, SKYLINE_WIND_FROM } from "./skyline";
import { skylineGame, SKYLINE_BLOCK_H, SKYLINE_MIN_ZOOM, SKYLINE_PERFECT_GROW, SKYLINE_WORLD_H, SKYLINE_WORLD_W, type SkylineState } from "./skyline";
import { artHash, reducedMotion } from "./art.renderer";
import { APP_LOGO_URL } from "@/lib/brand";
import { realMemo, realNow, realNightSky, REAL_GOLD, REAL_SHADOW, REAL_NIGHT_BG, REAL_NIGHT_TEXT, REAL_LAMP, REAL_LAMP_WASH } from "./realworld.renderer";

/** City glass tints, cycled per level. */
const GLASS = ["#7FB3D5", "#9CC9C2", "#A9B8D8", "#8FBCE0", "#B5C7D3", "#7FA8C9", "#A4C4B4", "#98AEC8"];
const STEEL = "#788DA4";
const STEEL_LIGHT = "#A9BED0";
const TOWER_DARK = "#131D2C";
const TOWER_NEAR = "#202C3D";
const WINDOW_LIGHT = "#FFC966";
const PANE_GLOW = "rgba(216,243,255,0.18)";
const GROUND = "#424F60";
const JIB_Y = 30;
const CHUNK_MS = 900;
const SPARK_TICKS = 18;

const zoomMemo = new WeakMap<CanvasRenderingContext2D, number>();

interface Chunk { x: number; w: number; top: number; dir: number; at: number; colour: number }
interface Memory { tick: number; len: number; x: number; w: number; missed: boolean; chunks: Chunk[]; placementTicks: number[] }
const memories = new WeakMap<CanvasRenderingContext2D, Memory>();

function remember(ctx: CanvasRenderingContext2D, s: SkylineState): Memory {
  const m = realMemo(memories, ctx, s.tick, () => ({ tick: s.tick, len: s.blocks.length, x: s.x, w: s.w, missed: s.missed, chunks: [], placementTicks: new Array(s.blocks.length).fill(-1e9) }));
  const blockH = px(SKYLINE_BLOCK_H);
  const now = realNow();
  if (s.tick !== m.tick) {
    if (s.blocks.length > m.len) {
      for (let i = m.len; i < s.blocks.length; i++) m.placementTicks[i] = s.tick;
    }
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
  ctx.globalAlpha = 0.65;
  ctx.translate(SKYLINE_WORLD_W / 2, SKYLINE_WORLD_H + scroll * 0.2 * zoom);
  ctx.scale(k, k);
  ctx.translate(-SKYLINE_WORLD_W / 2, -SKYLINE_WORLD_H);
  ctx.fillStyle = TOWER_DARK;
  for (const [x, w, h] of BACKDROP) ctx.fillRect(x - 40, SKYLINE_WORLD_H - h, w - 2, h);
  ctx.fillStyle = TOWER_NEAR;
  for (const [x, w, h] of BACKDROP) ctx.fillRect(x + 15, SKYLINE_WORLD_H - h * 0.6, w - 4, h * 0.6);
  ctx.fillStyle = WINDOW_LIGHT;
  ctx.globalAlpha = 0.24;
  for (const [x, w, h] of BACKDROP) {
    for (let wy = SKYLINE_WORLD_H - h * 0.6 + 8; wy < SKYLINE_WORLD_H - 6; wy += 14) {
      for (let wx = x + 19; wx < x + 15 + w - 8; wx += 8) {
        if (artHash(wx, wy) % 3 !== 0) ctx.fillRect(wx, wy, 3, 5);
      }
    }
  }
  ctx.restore();
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, top: number, w: number, h: number, index: number, age = Infinity): void {
  ctx.fillStyle = STEEL;
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = GLASS[index % GLASS.length]!;
  const inset = 3;
  const panes = Math.max(1, Math.round((w - inset * 2) / 16));
  const pw = (w - inset * 2) / panes;
  for (let p = 0; p < panes; p++) ctx.fillRect(x + inset + p * pw + 1, top + inset + 2, pw - 2, h - inset * 2 - 4);
  ctx.fillStyle = PANE_GLOW;
  for (let p = 0; p < panes; p++) ctx.fillRect(x + inset + p * pw + 1, top + inset + 2, pw - 2, h - inset * 2 - 4);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  for (let p = 0; p < panes; p++) ctx.fillRect(x + inset + p * pw + 1, top + inset + 2, Math.max(1, (pw - 2) * 0.3), h - inset * 2 - 4);
  ctx.fillStyle = STEEL_LIGHT;
  ctx.fillRect(x, top, w, 2);

  // Warm lit windows for placed floors (fade in over ~20 ticks after landing).
  if (age !== Infinity) {
    const fade = Math.max(0, Math.min(1, age / 20));
    for (let p = 0; p < panes; p++) {
      const lit = artHash(index * 31 + p, 7) % 5;
      if (lit === 0) continue;
      ctx.globalAlpha = fade * (lit === 1 ? 0.45 : 0.85);
      ctx.fillStyle = lit === 4 ? "#FFE3A3" : WINDOW_LIGHT;
      ctx.fillRect(x + inset + p * pw + 2, top + inset + 3, pw - 4, h - inset * 2 - 6);
    }
    ctx.globalAlpha = 1;
  }
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
  ctx.fillStyle = STEEL_LIGHT;
  ctx.fillRect(trolleyX - 8, JIB_Y + 11, 16, 5);
  ctx.fillStyle = REAL_LAMP_WASH;
  ctx.beginPath();
  ctx.moveTo(trolleyX, JIB_Y + 16);
  ctx.lineTo(trolleyX - 65, JIB_Y + 145);
  ctx.lineTo(trolleyX + 65, JIB_Y + 145);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = REAL_LAMP;
  ctx.fillRect(trolleyX - 4, JIB_Y + 16, 8, 3);
  void tick;
}

/** The app logo's black and bolt yellow, for the cloth before the logo file has loaded. */
const FLAG_BLACK = "#0B0B0F";
const FLAG_BOLT = "#FFD21F";
/** BoltGlyph's bolt (24-unit box), the stand-in until the logo file is ready. */
const FLAG_BOLT_PATH = [[14, 2], [5, 14], [11, 14], [9, 22], [19, 9], [13, 9], [14, 2]] as const;

/** The app logo (APP_LOGO_URL), loaded once per page; null until it is ready or if it fails. */
let flagLogo: HTMLImageElement | null = null;
let flagLogoStarted = false;
function flagLogoImage(): HTMLImageElement | null {
  if (!flagLogoStarted && typeof Image !== "undefined") {
    flagLogoStarted = true;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => (flagLogo = img);
    img.src = APP_LOGO_URL;
  }
  return flagLogo;
}

/**
 * The logo, `s` px square, centred at (cx, cy) inside the current clip: the app
 * logo file when it has loaded, else its black square and bolt drawn in code.
 */
function drawFlagLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  const img = flagLogoImage();
  if (img) {
    ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
    return;
  }
  ctx.fillStyle = FLAG_BOLT;
  ctx.beginPath();
  for (const [bx, by] of FLAG_BOLT_PATH) ctx.lineTo(cx + ((bx - 12) / 24) * s, cy + ((by - 12) / 24) * s);
  ctx.fill();
}

/**
 * skylineRev 2: the flag on the top block (pole at its centre, behind the
 * sliding block), showing the app logo (black with the yellow bolt). Hanging
 * still = calm; streaming and rippling = a gust is about to blow or is
 * blowing, toward `dir`. Presentation only.
 */
function drawFlag(ctx: CanvasRenderingContext2D, x: number, top: number, dir: number, tick: number, zoom: number): void {
  // Screen-sized whatever the camera zoom; the pole clears the sliding block (one block high) so the cloth is never hidden.
  const k = 1 / zoom;
  const poleH = px(SKYLINE_BLOCK_H) + 34 * k;
  const lw = 2 * k;
  ctx.save();
  ctx.strokeStyle = STEEL_LIGHT;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top - poleH);
  ctx.stroke();
  ctx.fillStyle = REAL_GOLD;
  ctx.beginPath();
  ctx.arc(x, top - poleH, 3 * k, 0, Math.PI * 2);
  ctx.fill();
  const still = dir === 0 || reducedMotion();
  // A little smaller than the old red-and-white flag (34 × 20).
  const len = 28 * k;
  const h = 17 * k;
  const phase = (tick / 60) * Math.PI * 2 * 2.2;
  const y0 = top - poleH + 2 * k;
  if (dir === 0) {
    // Hanging limp down the pole: the logo's black cloth with the bolt upright on it.
    const w = 8 * k;
    const drop = len * 0.75;
    ctx.fillStyle = FLAG_BLACK;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + w, y0 + 2 * k);
    ctx.lineTo(x + w - k, y0 + 2 * k + drop);
    ctx.lineTo(x, y0 + drop);
    ctx.closePath();
    ctx.fill();
    ctx.clip();
    drawFlagLogo(ctx, x + w / 2, y0 + drop / 2 + k, w * 1.9);
    ctx.restore();
    return;
  }
  const wave = (u: number) => (still ? 0 : Math.sin(phase - u * 5) * 4 * k * u);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    pts.push([x + dir * len * u, y0 + wave(u)]);
  }
  ctx.fillStyle = FLAG_BLACK;
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (const [px0, py0] of pts) ctx.lineTo(px0, py0);
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i]![0], pts[i]![1] + h);
  ctx.closePath();
  ctx.fill();
  // The logo rides the ripple: each eighth of the cloth draws its slice of the logo
  // shifted by that slice's wave, clipped to the slice (never mirrored, whichever way it flies).
  const s = h * 1.15;
  const cx = x + (dir * len) / 2;
  for (let i = 0; i < 8; i++) {
    const xa = Math.min(pts[i]![0], pts[i + 1]![0]);
    const xb = Math.max(pts[i]![0], pts[i + 1]![0]);
    const dy = (pts[i]![1] + pts[i + 1]![1]) / 2 - y0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(xa - 0.25 * k, y0 + dy, xb - xa + 0.5 * k, h);
    ctx.clip();
    drawFlagLogo(ctx, cx, y0 + dy + h / 2, s);
    ctx.restore();
  }
  ctx.restore();
}

/** skylineRev 2: faint streaks across the sky while a gust actually blows (presentation only). */
function drawGustLines(ctx: CanvasRenderingContext2D, dir: number, tick: number): void {
  if (dir === 0 || reducedMotion()) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = 0; k < 7; k++) {
    const y = 70 + ((k * 67) % 360);
    const span = SKYLINE_WORLD_W + 120;
    const x = ((tick * 9 + k * 113) % span) - 60;
    const sx = dir > 0 ? x : SKYLINE_WORLD_W - x;
    ctx.moveTo(sx, y);
    ctx.lineTo(sx - dir * (30 + (k % 3) * 14), y);
  }
  ctx.stroke();
  ctx.restore();
}

/** The game's drawing through the shared success layer (presentation only). */
export function drawSkylineArt(ctx: CanvasRenderingContext2D, state: SkylineState, size: CanvasSize, crashIndicator = true): void {
  arcadeFx(ctx, SKYLINE_FX, state, () => drawSkylineArtWorld(ctx, state, size, crashIndicator), size);
}

function drawSkylineArtWorld(ctx: CanvasRenderingContext2D, state: SkylineState, size: CanvasSize, crashIndicator = true): void {
  const scale = Math.min(size.width / SKYLINE_WORLD_W, size.height / SKYLINE_WORLD_H);
  const offsetX = (size.width - SKYLINE_WORLD_W * scale) / 2;
  const offsetY = (size.height - SKYLINE_WORLD_H * scale) / 2;
  const blockH = px(SKYLINE_BLOCK_H);
  const mem = remember(ctx, state);

  ctx.save();
  realNightSky(ctx, size.width, size.height);
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

  drawBackdrop(ctx, zoom, camScroll);

  ctx.save();
  ctx.translate(SKYLINE_WORLD_W / 2, SKYLINE_WORLD_H);
  ctx.scale(zoom, zoom);
  ctx.translate(-SKYLINE_WORLD_W / 2, -SKYLINE_WORLD_H + camScroll);

  // Ground slab under the base.
  ctx.fillStyle = GROUND;
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
    drawBlock(ctx, px(block.x), top, px(block.w), blockH, index, state.tick - (mem.placementTicks[index] ?? state.tick));
  });

  const hangTop = SKYLINE_WORLD_H - state.blocks.length * blockH - blockH;
  // skylineRev 2: the flag flies from the top block once the wind can blow.
  if (state.rev && state.placed >= SKYLINE_WIND_FROM && !state.missed) {
    const top = state.blocks[state.blocks.length - 1]!;
    drawFlag(ctx, px(top.x + top.w / 2), hangTop + blockH, skylineFlagAt(state, state.tick), state.tick, zoom);
  }
  let hookX = SKYLINE_WORLD_W / 2;
  if (!state.missed) {
    const bx = px(state.x);
    const bw = px(state.w);
    hookX = bx + bw / 2;
    // Cable and slings from far above down to the hook.
    ctx.strokeStyle = STEEL_LIGHT;
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
      for (let k = 0; k < 4; k++) {
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

  if (state.rev && !state.missed) drawGustLines(ctx, skylineGustAt(state, state.tick), state.tick);

  const perfectTop=state.blocks.at(-1);
  if(perfectTop)successFrame(ctx,{id:'skyline',tick:state.tick,count:state.perfects,eventTick:state.perfectTick,colour:REAL_GOLD,width:SKYLINE_WORLD_W,height:SKYLINE_WORLD_H,point:{x:(px(perfectTop.x+perfectTop.w/2)-SKYLINE_WORLD_W/2)*zoom+SKYLINE_WORLD_W/2,y:SKYLINE_WORLD_H+(-(state.blocks.length-1)*blockH+camScroll)*zoom,shape:'spark',label:'PERFECT'},hud:{x:12,y:12,text:`Blocks ${state.placed}`}});
  // Crane jib at the top, trolley above the hook's screen x.
  drawCrane(ctx, (hookX - SKYLINE_WORLD_W / 2) * zoom + SKYLINE_WORLD_W / 2, state.tick);

  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = REAL_NIGHT_TEXT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  successHud(ctx,'skyline',state.tick,12,12,()=>{ctx.fillText(`Blocks ${state.placed}`, 12, 12);});
  // skylineRev 2: the perfect-streak counter, gold once it is scoring.
  if (state.rev && (state.streak ?? 0) > 0) {
    const streak = state.streak ?? 0;
    ctx.textAlign = "right";
    ctx.fillStyle = streak >= SKYLINE_STREAK_FROM ? REAL_GOLD : REAL_NIGHT_TEXT;
    ctx.fillText(`Streak ×${streak}`, SKYLINE_WORLD_W - 12, 12);
    ctx.textAlign = "left";
  }

  if (state.missed && crashIndicator) {
    ctx.fillStyle = "rgba(229, 72, 77, 0.18)";
    ctx.fillRect(0, 0, SKYLINE_WORLD_W, SKYLINE_WORLD_H);
  }
  ctx.restore();
}

export const skylineArtGame = { ...skylineGame, draw: drawSkylineArt };
export const skylineRevealGame = { draw: (ctx: CanvasRenderingContext2D, state: SkylineState, size: CanvasSize) => drawSkylineArt(ctx, state, size, false) };
export const SKYLINE_ART_BG = REAL_NIGHT_BG;
