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
const PIPE = "#3DFFE0";
const PIPE_FAST = "#B6FFF3";
const SAUCER = "#FFD84A";
const SAUCER_DARK = "#B8901C";
const DOME = "#5CD0FF";
const CAP_H = 8;

function draw(ctx: CanvasRenderingContext2D, state: HoverState, size: CanvasSize): void {
  retroScreen(ctx, size, HOVER_WORLD_W, HOVER_WORLD_H, "fit", (c) => drawWorld(c, state));
}

function drawWorld(ctx: CanvasRenderingContext2D, state: HoverState): void {
  const bloom = retroBloom();
  const discLeft = HOVER_DISC_X - HOVER_DISC_R;
  const width = px(HOVER_PILLAR_W);

  state.pillars.forEach((pillar, index) => {
    const left = px(pillarX(pillar, state.distance));
    if (left > HOVER_WORLD_W || left + width < 0) return;
    // Gates met at higher speed glow brighter (display only).
    const speedShare = (hoverScroll(index) - HOVER_SCROLL_START) / (HOVER_SCROLL_MAX - HOVER_SCROLL_START);
    const colour = speedShare > 0.5 ? PIPE_FAST : PIPE;
    // A flash for the few pixels after the gate is passed, from geometry alone.
    const passedBy = px(state.distance - (pillar.x0 + HOVER_PILLAR_W - discLeft));
    const flash = index < state.gates && passedBy >= 0 && passedBy < 48 ? 1 - passedBy / 48 : 0;
    const top = px(pillar.gapTop);
    const bottom = top + px(pillar.gapH);
    drawPipe(ctx, left, 0, width, top, colour, bloom, flash, "bottom");
    drawPipe(ctx, left, bottom, width, HOVER_WORLD_H - bottom, colour, bloom, flash, "top");
  });

  drawSaucer(ctx, state);
  retroReadout(ctx, 10, 10, `GATES ${state.gates}/${state.totalGates}`, RETRO_WHITE);

  if (state.crashed) {
    ctx.fillStyle = "rgba(255,59,92,0.2)";
    ctx.fillRect(0, 0, HOVER_WORLD_W, HOVER_WORLD_H);
  }
}

/** A neon pipe filling exactly the pillar box, with a pixel cap at the gap end. */
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
  pixelRect(ctx, x, y, w, h, "#06302A");
  pixelRect(ctx, x, y, 2, h, colour, bloom);
  pixelRect(ctx, x + w - 2, y, 2, h, colour, bloom);
  pixelRect(ctx, x + 8, y, 4, h, `${colour}55`);
  const capY = capAt === "bottom" ? y + h - Math.min(CAP_H, h) : y;
  pixelRect(ctx, x, capY, w, Math.min(CAP_H, h), colour, bloom);
  pixelRect(ctx, x + 4, capY + 2, w - 8, Math.max(0, Math.min(CAP_H, h) - 4), "#06302A");
  if (flash > 0) {
    ctx.globalAlpha = flash * 0.85;
    pixelRect(ctx, x, y, w, h, RETRO_WHITE, bloom * 1.5);
    ctx.globalAlpha = 1;
  }
}

/** Saucer drawn in 2 px blocks, every block inside the sim's disc. */
function drawSaucer(ctx: CanvasRenderingContext2D, state: HoverState): void {
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
  const body = state.crashed ? RETRO_RED : SAUCER;
  pixelShape(ctx, cx, cy, r, 2, (dx, dy) => {
    if (dx * dx + dy * dy > r * r) return null;
    // Dome above the hull.
    const domeY = dy + r * 0.1;
    if (domeY < 0 && dx * dx + domeY * domeY <= (r * 0.5) ** 2) return state.crashed ? RETRO_RED : DOME;
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
