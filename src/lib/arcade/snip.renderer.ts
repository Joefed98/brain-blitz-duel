/**
 * Snip art: a pirate ship's rigging seen from the deck (High Seas world).
 * Render only. Uses the sim's own view transform and render-only camera;
 * ropes follow exactly the sim's node lines, the chest sits inside the sweet
 * radius, coins at star positions, spars on platform rectangles and the hatch
 * on the mouth circle. Mast, sails, sky and the gentle rock are background
 * only; nothing in the play area moves with them.
 */
import type { CanvasSize } from "./engine";
import {
  snipCamera,
  snipGame,
  snipView,
  SNIP_CONFIG,
  SNIP_EATEN,
  SNIP_H,
  SNIP_LOST,
  SNIP_W,
  type SnipState,
} from "./snip";
import { reducedMotion } from "./art.renderer";
import {
  paintCoin,
  seaClock,
  seaDeviceScale,
  seaNow,
  seaRope,
  seaSprite,
  SEA_BRASS,
  SEA_BRASS_DARK,
  SEA_FOAM,
  SEA_GOLD,
  SEA_SAIL,
  SEA_SKY_LOW,
  SEA_SKY_TOP,
  SEA_WOOD,
  SEA_WOOD_DARK,
  SEA_WOOD_LIGHT,
} from "./seas.renderer";

/** A recent swipe step in world px with the wall-clock time it was made. */
export interface SnipSwipe { a: number; b: number; c: number; d: number; at: number }

interface Burst { kind: "glint" | "splash"; x: number; y: number; born: number }
interface Memo { tick: number; endTick: number; template: number; sx: number; sy: number; cuts: number; cutAt: number; fx: Burst[] }
const memos = new WeakMap<object, Memo>();

function memoFor(ctx: CanvasRenderingContext2D, s: SnipState): Memo {
  let m = memos.get(ctx);
  if (!m || s.tick < m.tick) {
    m = { tick: s.tick, endTick: s.endTick, template: s.template, sx: s.sx, sy: s.sy, cuts: s.cuts, cutAt: -1e9, fx: [] };
    memos.set(ctx, m);
  }
  return m;
}

function background(ctx: CanvasRenderingContext2D, w: number, h: number, cameraX: number, scaleX: number): void {
  const t = seaClock();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SEA_SKY_TOP);
  g.addColorStop(1, SEA_SKY_LOW);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Gentle rock: the rigging backdrop tilts a little about the deck.
  ctx.save();
  ctx.translate(w / 2, h);
  ctx.rotate(Math.sin(t * 0.6) * 0.014);
  ctx.translate(-w / 2, -h);
  const par = -cameraX * scaleX * 0.35;
  ctx.globalAlpha = 0.55;
  for (let k = -1; k <= 3; k++) {
    const mx = par + k * w * 1.1 + w * 0.5;
    if (mx < -w || mx > w * 2) continue;
    // Mast.
    ctx.fillStyle = SEA_WOOD_DARK;
    ctx.fillRect(mx - w * 0.025, 0, w * 0.05, h);
    // Sails, billowing slightly.
    const belly = Math.sin(t * 0.8 + k) * w * 0.012;
    ctx.fillStyle = SEA_SAIL;
    for (const [top, bottom, half] of [[h * 0.04, h * 0.3, 0.34], [h * 0.34, h * 0.62, 0.4]] as const) {
      ctx.beginPath();
      ctx.moveTo(mx - w * half, top);
      ctx.lineTo(mx + w * half, top);
      ctx.quadraticCurveTo(mx + w * (half + 0.04) + belly, (top + bottom) / 2, mx + w * half, bottom);
      ctx.lineTo(mx - w * half, bottom);
      ctx.quadraticCurveTo(mx - w * (half + 0.04) + belly, (top + bottom) / 2, mx - w * half, top);
      ctx.fill();
      ctx.fillStyle = SEA_WOOD;
      ctx.fillRect(mx - w * (half + 0.03), top - h * 0.008, w * (half + 0.03) * 2, h * 0.016);
      ctx.fillStyle = SEA_SAIL;
    }
    // Shrouds.
    ctx.strokeStyle = "rgba(60,40,24,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -3; i <= 3; i++) {
      ctx.moveTo(mx, h * 0.02);
      ctx.lineTo(mx + i * w * 0.14, h);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  // Wash so the play area stays high-contrast.
  ctx.fillStyle = "rgba(14,30,52,0.45)";
  ctx.fillRect(0, 0, w, h);
}

function hatch(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  const frame = (radius: number) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.closePath();
  };
  frame(r);
  ctx.fillStyle = SEA_WOOD_DARK;
  ctx.fill();
  frame(r * 0.86);
  ctx.fillStyle = SEA_WOOD_LIGHT;
  ctx.fill();
  frame(r * 0.72);
  ctx.fillStyle = "#0B0806";
  ctx.fill();
  ctx.fillStyle = "rgba(245,197,66,0.12)";
  ctx.beginPath();
  ctx.arc(0, r * 0.15, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function spar(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const h = y1 - y0;
  ctx.fillStyle = SEA_WOOD_DARK;
  ctx.beginPath();
  ctx.roundRect(x0, y0, x1 - x0, h, h / 2);
  ctx.fill();
  ctx.fillStyle = SEA_WOOD;
  ctx.beginPath();
  ctx.roundRect(x0 + 1, y0 + 1, x1 - x0 - 2, h * 0.55, h / 3);
  ctx.fill();
  ctx.fillStyle = SEA_BRASS_DARK;
  for (let x = x0 + 18; x < x1 - 10; x += 36) ctx.fillRect(x, y0, 3, h);
}

function chest(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // 20 × 16 box: corners stay inside the sweet radius (12) plus 1 px.
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = SEA_WOOD_DARK;
  ctx.fillRect(-10, -8, 20, 16);
  ctx.fillStyle = SEA_WOOD;
  ctx.fillRect(-9, -2, 18, 9);
  ctx.fillStyle = SEA_WOOD_LIGHT;
  ctx.beginPath();
  ctx.roundRect(-9, -7, 18, 5, 2);
  ctx.fill();
  ctx.fillStyle = SEA_BRASS;
  ctx.fillRect(-7, -8, 2.5, 16);
  ctx.fillRect(4.5, -8, 2.5, 16);
  ctx.fillRect(-2, -3, 4, 5);
  ctx.fillStyle = "#2A1A0C";
  ctx.fillRect(-0.6, -1.5, 1.2, 2.2);
  ctx.restore();
}

export function drawSnipArt(
  ctx: CanvasRenderingContext2D,
  state: SnipState,
  size: CanvasSize,
  trail?: readonly (readonly [number, number])[],
  cameraX = snipCamera(state, state.sx / 256 - SNIP_CONFIG.viewW / 2, 1),
  swipes: readonly SnipSwipe[] = [],
): void {
  const { scaleX, scaleY } = snipView(size);
  const c = SNIP_CONFIG;
  const m = memoFor(ctx, state);
  const now = seaNow();
  if (state.tick !== m.tick) {
    if (state.endTick !== m.endTick) {
      const old = c.templates[m.template]!;
      if (state.lastOutcome === SNIP_EATEN) m.fx.push({ kind: "glint", x: old.mouth[0], y: old.mouth[1], born: now });
      else if (state.lastOutcome === SNIP_LOST && m.sy > SNIP_H * 128) m.fx.push({ kind: "splash", x: m.sx / 256, y: SNIP_H - 4, born: now });
    }
    if (state.cuts > m.cuts) m.cutAt = now;
    m.tick = state.tick;
    m.endTick = state.endTick;
    m.template = state.template;
    m.sx = state.sx;
    m.sy = state.sy;
    m.cuts = state.cuts;
  }
  m.fx = m.fx.filter((f) => now - f.born < 700);
  if (m.fx.length > 8) m.fx.splice(0, m.fx.length - 8);

  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.beginPath();
  ctx.rect(0, 0, size.width, size.height);
  ctx.clip();
  background(ctx, size.width, size.height, cameraX, scaleX);

  ctx.scale(scaleX, scaleY);
  ctx.translate(-cameraX, 0);

  // Side walls as the ship's bulwarks.
  ctx.fillStyle = SEA_WOOD_DARK;
  ctx.fillRect(0, 0, 3, SNIP_H);
  ctx.fillRect(SNIP_W - 3, 0, 3, SNIP_H);

  // Deck edge at the bottom: a thin gunwale, sea below (the chest can fall past it).
  ctx.fillStyle = "rgba(20,60,100,0.55)";
  ctx.fillRect(0, SNIP_H - 8, SNIP_W, 8);
  ctx.fillStyle = "rgba(207,232,245,0.25)";
  const wave = seaClock() * 20;
  for (let x = -40 + (wave % 40); x < SNIP_W; x += 40) ctx.fillRect(x, SNIP_H - 8, 18, 1.5);

  const tpl = c.templates[state.template]!;
  for (const [x0, y0, x1, y1] of tpl.platforms) spar(ctx, x0, y0, x1, y1);

  hatch(ctx, tpl.mouth[0], tpl.mouth[1], c.mouthRadius);

  // Coins at star positions (cached sprite, 24 px across = drawn star size).
  const dpr = seaDeviceScale(ctx);
  const coin = seaSprite("coin", 24 * Math.max(scaleX, scaleY) * dpr, paintCoin);
  state.starX.forEach((x, i) => {
    if (state.starGot[i] || !coin) return;
    ctx.drawImage(coin as CanvasImageSource, x / 256 - 12, state.starY[i]! / 256 - 12, 24, 24);
  });

  // Ropes on the sim's node lines; belaying pins at the anchors.
  for (const rope of state.ropes) {
    const pts: [number, number][] = [];
    for (let i = 0; i < rope.x.length; i++) pts.push([rope.x[i]! / 256, rope.y[i]! / 256]);
    if (rope.alive) pts.push([state.sx / 256, state.sy / 256]);
    seaRope(ctx, pts, 3.5, rope.alive ? 1 : 0.6);
    if (!rope.alive && pts.length > 1) {
      // Frayed end.
      const [ex, ey] = pts[pts.length - 1]!;
      const [px, py] = pts[pts.length - 2]!;
      const a = Math.atan2(ey - py, ex - px);
      ctx.strokeStyle = "rgba(168,131,88,0.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const da of [-0.6, -0.2, 0.25, 0.65]) {
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + Math.cos(a + da) * 5, ey + Math.sin(a + da) * 5);
      }
      ctx.stroke();
    }
    const [bx, by] = [rope.x[0]! / 256, rope.y[0]! / 256];
    ctx.fillStyle = SEA_WOOD_DARK;
    ctx.beginPath();
    ctx.ellipse(bx, by, 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SEA_WOOD_LIGHT;
    ctx.beginPath();
    ctx.ellipse(bx, by, 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SEA_BRASS;
    ctx.fillRect(bx - 1, by - 7, 2, 4);
  }

  chest(ctx, state.sx / 256, state.sy / 256);

  if (trail && trail.length > 1) {
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(trail[0]![0], trail[0]![1]);
    for (const [x, y] of trail) ctx.lineTo(x, y);
    ctx.stroke();
  }

  // Cutlass flash along recent swipes; brighter just after a cut.
  const cutGlow = Math.max(0, 1 - (now - m.cutAt) / 220);
  for (const sw of swipes) {
    const k = 1 - (now - sw.at) / 200;
    if (k <= 0) continue;
    ctx.strokeStyle = `rgba(225,235,245,${(0.35 + 0.55 * cutGlow) * k})`;
    ctx.lineWidth = 2 + 2 * cutGlow;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sw.a, sw.b);
    ctx.lineTo(sw.c, sw.d);
    ctx.stroke();
  }

  // Landing glints and overboard splashes.
  for (const f of m.fx) {
    const k = (now - f.born) / 700;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    if (f.kind === "glint") {
      ctx.strokeStyle = SEA_GOLD;
      ctx.lineWidth = 2;
      const r = 6 + k * 18;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        ctx.moveTo(f.x + Math.cos(a) * r * 0.3, f.y + Math.sin(a) * r * 0.3);
        ctx.lineTo(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r);
      }
      ctx.stroke();
    } else if (!reducedMotion() || k < 0.5) {
      ctx.fillStyle = SEA_FOAM;
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        const d = 6 + k * 26;
        ctx.beginPath();
        ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 1.3, 2.5 * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

export const snipArtGame = { ...snipGame, draw: (ctx: CanvasRenderingContext2D, s: SnipState, size: CanvasSize) => drawSnipArt(ctx, s, size) };
