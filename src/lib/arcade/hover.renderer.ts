/** Hover in the Retro Arcade world. Render only; the sim and its bounds are untouched. */
import {
  hoverGame,
  hoverScroll,
  pillarX,
  HOVER_DISC_R,
  HOVER_DISC_X,
  HOVER_IMPULSE,
  HOVER_PILLAR_W,
  HOVER_SCROLL_MAX,
  HOVER_SCROLL_START,
  HOVER_WORLD_H,
  HOVER_WORLD_W,
  type HoverState,
} from "./hover";
import type { ArcadeGame, CanvasSize } from "./engine";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import {
  pixelRect,
  pixelShape,
  retroBloom,
  retroClock,
  retroReadout,
  retroScreen,
  RETRO_RED,
  RETRO_WHITE,
} from "./retro.renderer";

const FP = 256;
const px = (v: number) => v / FP;
const BARRIER_CYCLES = ["#FF4DFF", "#3DFFE0", "#FFD84A", "#4BFF7A", "#FF9A3C", "#B49CFF"];
const SAUCER = "#FFD84A";
const SAUCER_DARK = "#B8901C";
const DOME = "#5CD0FF";
const barrierCache = new Map<string, ArtCanvas>();

/** Two finite, full-height raster columns; cropped without scaling to each collision box. */
function barrierSprite(w: number, colour: string): ArtCanvas | null {
  const cached = barrierCache.get(colour);
  if (cached) return cached;
  const layer = artCanvas(w * 2, HOVER_WORLD_H * 2);
  const c = layer && artContext(layer);
  if (!layer || !c) return null;
  c.scale(2, 2);
  c.fillStyle = "#39114F"; c.fillRect(0, 0, w, HOVER_WORLD_H);
  // One baked glow pass, clipped by the raster's exact rectangular footprint.
  c.shadowColor = colour; c.shadowBlur = 3;
  for (let y = 0; y < HOVER_WORLD_H; y += 12) {
    c.fillStyle = Math.floor(y / 12) % 2 ? "#9E38D6" : "#C642CE";
    c.fillRect(0, y, w, 11);
  }
  c.shadowBlur = 0;
  for (let y = 0; y < HOVER_WORLD_H; y += 12) {
    c.fillStyle = colour; c.fillRect(2, y + 2, w - 4, 1);
    c.fillStyle = "#5A1D75"; c.fillRect(w / 2, y + 3, 1, 7);
  }
  barrierCache.set(colour, layer);
  return layer;
}

function draw(ctx: CanvasRenderingContext2D, state: HoverState, size: CanvasSize): void {
  retroScreen(ctx, size, HOVER_WORLD_W, HOVER_WORLD_H, "fit", (c) => drawWorld(c, state));
}
function drawReveal(ctx: CanvasRenderingContext2D, state: HoverState, size: CanvasSize): void {
  retroScreen(ctx, size, HOVER_WORLD_W, HOVER_WORLD_H, "fit", (c) => drawWorld(c, state, false));
}

function drawWorld(ctx: CanvasRenderingContext2D, state: HoverState, crashIndicator = true): void {
  const bloom = retroBloom();
  const discLeft = HOVER_DISC_X - HOVER_DISC_R;
  const width = px(HOVER_PILLAR_W);

  state.pillars.forEach((pillar, index) => {
    const left = px(pillarX(pillar, state.distance));
    if (left > HOVER_WORLD_W || left + width < 0) return;
    // Gates met at higher speed glow brighter (display only).
    const speedShare = (hoverScroll(index) - HOVER_SCROLL_START) / (HOVER_SCROLL_MAX - HOVER_SCROLL_START);
    const colour = BARRIER_CYCLES[Math.floor(index / 7) % 6] ?? "#FF4DFF";
    // A flash for the few pixels after the gate is passed, from geometry alone.
    const passedBy = px(state.distance - (pillar.x0 + HOVER_PILLAR_W - discLeft));
    const flash = index < state.gates && passedBy >= 0 && passedBy < 48 ? 1 - passedBy / 48 : 0;
    const top = px(pillar.gapTop);
    const bottom = top + px(pillar.gapH);
    drawPipe(ctx, left, 0, width, top, colour, bloom, flash, "bottom");
    drawPipe(ctx, left, bottom, width, HOVER_WORLD_H - bottom, colour, bloom, flash, "top");
  });

  drawSaucer(ctx, state, crashIndicator);
  retroReadout(ctx, 10, 10, `BARRIERS ${state.gates}/${state.totalGates}`, RETRO_WHITE);

  if (state.crashed && crashIndicator) {
    ctx.fillStyle = "rgba(255,59,92,0.2)";
    ctx.fillRect(0, 0, HOVER_WORLD_W, HOVER_WORLD_H);
  }
}

/** Stacked energy blocks fill the exact pillar rectangle, without a cap or lip. */
function drawPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colour: string,
  bloom: number,
  flash: number,
  capAt: "top" | "bottom",
): void {
  if (h <= 0) return;
  const stamp = barrierSprite(w, colour);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (stamp) ctx.drawImage(stamp, 0, 0, w * 2, h * 2, x, y, w, h);
  else {
    pixelRect(ctx, x, y, w, h, "#39114F");
    for (let row = 0; row < h; row += 12)
      pixelRect(ctx, x, y + row, w, Math.min(11, h - row), colour);
  }
  // A thin jagged energy trace remains inside the flat facing block edge.
  const edge = capAt === "bottom" ? y + h - 1 : y;
  pixelRect(ctx, x, edge, w, 1, colour);
  for (let column = 2; column < w; column += 6)
    pixelRect(ctx, x + column, capAt === "bottom" ? edge - 1 : edge + 1, Math.min(3, w - column), 1, RETRO_WHITE);
  if (flash > 0) {
    ctx.globalAlpha = flash * 0.85;
    pixelRect(ctx, x, y, w, h, RETRO_WHITE);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Saucer drawn in 2 px blocks, every block inside the sim's disc. */
function drawSaucer(ctx: CanvasRenderingContext2D, state: HoverState, crashIndicator: boolean): void {
  const cx = px(HOVER_DISC_X);
  const cy = px(state.y);
  const r = px(HOVER_DISC_R);
  // Thruster puff for a few ticks after a tap; background decoration under the saucer.
  const sinceTap = Math.round((state.vy - HOVER_IMPULSE) / 90);
  if (!state.crashed && sinceTap >= 0 && sinceTap < 8) {
    ctx.globalAlpha = 0.6 * (1 - sinceTap / 8);
    pixelRect(ctx, cx - 4, cy + r * 0.5 + sinceTap, 8, 4, "#FF9A3C", 6);
    pixelRect(ctx, cx - 2, cy + r * 0.5 + sinceTap + 4, 4, 3, "#FFE08A");
    ctx.globalAlpha = 1;
  }
  const t = retroClock();
  const blink = Math.floor(t / 160) % 3;
  const body = state.crashed && crashIndicator ? RETRO_RED : SAUCER;
  pixelShape(ctx, cx, cy, r, 2, (dx, dy) => {
    if (dx * dx + dy * dy > r * r) return null;
    // Dome above the hull.
    const domeY = dy + r * 0.1;
    if (domeY < 0 && dx * dx + domeY * domeY <= (r * 0.5) ** 2) return state.crashed && crashIndicator ? RETRO_RED : DOME;
    // Flat hull ellipse.
    const ey = (dy - r * 0.2) / (r * 0.38);
    const ex = dx / r;
    if (ex * ex + ey * ey > 1) return null;
    if (ey > 0.35) {
      const slot = Math.floor((dx + r) / 4);
      return slot % 3 === blink ? RETRO_WHITE : SAUCER_DARK;
    }
    return body;
  });
}

export const hoverArtGame: ArcadeGame<HoverState> = { ...hoverGame, draw };
/** Preserve the actual final state and live death art, but omit the reveal's red indicator. */
export const hoverRevealGame = { draw: drawReveal };
