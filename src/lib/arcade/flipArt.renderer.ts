/**
 * Flip art pass. Render only: reads FlipState and never mutates it. Rails follow
 * the sim's warped surfaces; crystals stay inside each hazard's x-span and the
 * old drawn heights; the runner stays inside the sim's 24 x 28 box.
 */
import type { CanvasSize } from "./engine";
import {
  flipGame,
  flipWarpAt,
  FLIP_ARC_TICKS,
  FLIP_CEIL_Y,
  FLIP_FLOOR_Y,
  FLIP_GAP,
  FLIP_GOLD,
  FLIP_RED,
  FLIP_SPIKE,
  FLIP_WORLD_H,
  FLIP_WORLD_W,
  type FlipState,
} from "./flip";
import { drawFlipHazard, flipSurfaceLine } from "./flip.renderer";
import { artHash, reducedMotion } from "./art.renderer";

/* Mirrors of private sim constants, used only to place art on the same geometry. */
const FP = 256;
const RUNNER_X = 90;
const SPIKE_HEIGHT = 22;
const OVERHANG_DEPTH = 34;

function runnerY(side: number, flipT: number): number {
  const target = side === 0 ? FLIP_FLOOR_Y - 14 : FLIP_CEIL_Y + 14;
  if (flipT <= 0) return target;
  const from = side === 0 ? FLIP_CEIL_Y + 14 : FLIP_FLOOR_Y - 14;
  const f = 1 - Math.min(FLIP_ARC_TICKS, flipT) / FLIP_ARC_TICKS;
  const eased = f * f * (3 - 2 * f);
  return from + (target - from) * eased;
}

/** Crystal cluster growing from the surface, within [a, b] and maxH. */
function drawCrystals(ctx: CanvasRenderingContext2D, a: number, b: number, dirY: number, surfaceAt: (x: number) => number,
  maxH: number, seed: number, pulse: number): void {
  const width = b - a;
  if (width <= 1) return;
  const count = Math.max(1, Math.round(width / 11));
  const slot = width / count;
  // Danger glow, kept at the surface inside the span.
  const mid = (a + b) / 2;
  const base = surfaceAt(mid);
  const glow = ctx.createRadialGradient(mid, base, 0, mid, base, Math.max(width / 2, maxH));
  glow.addColorStop(0, `rgba(255,77,94,${0.22 + 0.12 * pulse})`);
  glow.addColorStop(1, "rgba(255,77,94,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(a, Math.min(base, base + dirY * maxH), width, maxH);
  for (let k = 0; k < count; k++) {
    const h = artHash(seed, k);
    const x0 = a + k * slot;
    const x1 = x0 + slot;
    const tipX = x0 + slot * (0.35 + ((h % 30) / 100));
    const height = maxH * (0.7 + ((h >>> 5) % 30) / 100);
    const s0 = surfaceAt(x0);
    const s1 = surfaceAt(x1);
    const tipY = surfaceAt(tipX) + dirY * height;
    const g = ctx.createLinearGradient(0, surfaceAt(tipX), 0, tipY);
    g.addColorStop(0, "#5A0A14");
    g.addColorStop(0.6, "#C21E33");
    g.addColorStop(1, "#FF8A96");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, s0);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(x1, s1);
    ctx.closePath();
    ctx.fill();
    // Facet line and a pulsing core.
    ctx.strokeStyle = "rgba(255,200,205,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo((x0 + tipX) / 2 + 1, (s0 + surfaceAt(tipX)) / 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,230,120,${0.45 + 0.45 * pulse})`;
    ctx.beginPath();
    ctx.arc(tipX, surfaceAt(tipX) + dirY * height * 0.35, Math.min(2.2, slot * 0.18), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawFlipArt(ctx: CanvasRenderingContext2D, state: FlipState, size: CanvasSize): void {
  const still = reducedMotion();
  const t = still ? 0 : state.tick / 60;
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 6);
  const scale = Math.min(size.width / FLIP_WORLD_W, size.height / FLIP_WORLD_H);
  const ox = (size.width - FLIP_WORLD_W * scale) / 2;
  const oy = (size.height - FLIP_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = "#07070D";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  const toScreen = (wx: number) => RUNNER_X + (wx - state.x) / FP;
  const toWorld = (sx: number) => state.x + (sx - RUNNER_X) * FP;
  const wy = (side: number, sx: number) => flipWarpAt(state, side, toWorld(sx));
  const floorAt = (x: number) => FLIP_FLOOR_Y + wy(0, x);
  const ceilAt = (x: number) => FLIP_CEIL_Y + wy(1, x);

  // Dark band between the rails.
  ctx.beginPath();
  flipSurfaceLine(ctx, ceilAt, 0, FLIP_WORLD_W);
  flipSurfaceLine(ctx, floorAt, 0, FLIP_WORLD_W, false);
  ctx.closePath();
  ctx.fillStyle = "#0C0B12";
  ctx.fill();

  // Gold rails, broken where a gap is, with a soft outer glow.
  for (const [side, at] of [[0, floorAt], [1, ceilAt]] as const) {
    const rail = () => {
      ctx.beginPath();
      let from = 0;
      for (let i = state.cursor; i < state.segs.length; i++) {
        const seg = state.segs[i]!;
        const a = toScreen(seg.x0);
        if (a > FLIP_WORLD_W) break;
        if (seg.side !== side || seg.kind !== FLIP_GAP) continue;
        flipSurfaceLine(ctx, at, from, Math.max(from, a));
        from = Math.max(from, toScreen(seg.x1));
      }
      flipSurfaceLine(ctx, at, from, FLIP_WORLD_W);
    };
    rail();
    ctx.strokeStyle = "rgba(245,184,46,0.18)";
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = FLIP_GOLD;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,240,200,0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (let i = Math.max(0, state.cursor - 1); i < state.segs.length; i++) {
    const seg = state.segs[i]!;
    const a = toScreen(seg.x0);
    const b = toScreen(seg.x1);
    if (a > FLIP_WORLD_W) break;
    if (b < 0) continue;
    const dirY = seg.side === 0 ? -1 : 1;
    const at = seg.side === 0 ? floorAt : ceilAt;
    if (seg.kind === FLIP_GAP) drawFlipHazard(ctx, "gap", a, b, dirY, at, FLIP_RED);
    else drawCrystals(ctx, a, b, dirY, at, seg.kind === FLIP_SPIKE ? SPIKE_HEIGHT : OVERHANG_DEPTH, seg.x0 | 0, pulse);
  }

  // Runner: trail of earlier arc positions, then a small figure that rotates through each flip.
  const y = runnerY(state.side, state.flipT) + state.warpY;
  const dead = state.ended === 2;
  if (!still && !dead) {
    for (let k = 1; k <= 4; k++) {
      const ty = state.flipT > 0 ? runnerY(state.side, state.flipT + k) + state.warpY : y;
      ctx.globalAlpha = 0.22 * (1 - k / 5);
      ctx.fillStyle = FLIP_GOLD;
      ctx.beginPath();
      ctx.roundRect(RUNNER_X - 12 - k * 7, ty - 9, 14, 18, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const f = state.flipT > 0 ? 1 - state.flipT / FLIP_ARC_TICKS : 1;
  const upright = state.side === 0 ? 0 : Math.PI;
  const angle = state.flipT > 0 && !still ? upright + (state.side === 0 ? -1 : 1) * Math.PI * (1 - f) : upright;
  const run = still ? 0 : Math.sin(state.tick * 0.5);
  ctx.save();
  ctx.translate(RUNNER_X, y);
  ctx.rotate(angle);
  ctx.strokeStyle = dead ? FLIP_RED : FLIP_GOLD;
  ctx.fillStyle = dead ? FLIP_RED : FLIP_GOLD;
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(1, -9, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(-1, 4);
  ctx.moveTo(0, -2);
  ctx.lineTo(6 * run, 3);
  ctx.moveTo(0, -2);
  ctx.lineTo(-6 * run, 3);
  ctx.moveTo(-1, 4);
  ctx.lineTo(-1 + 6 * run, 13);
  ctx.moveTo(-1, 4);
  ctx.lineTo(-1 - 6 * run, 13);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** The sim with the art renderer swapped in; step/score are the sim's own. */
export const flipArtGame = { ...flipGame, draw: drawFlipArt };
