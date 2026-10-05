/**
 * Retro Arcade theme layer: a phosphor screen inside a thin cabinet bezel.
 * Render only — never imported by sims, graders or scoring. Games call
 * `retroScreen` with their world size and the same fit/stretch transform their
 * original draw used, then draw in world coordinates with the pixel helpers.
 */
import { reducedMotion } from "./art.renderer";

export const RETRO_BLACK = "#000000";
export const RETRO_BEZEL = "#141418";
export const RETRO_BEZEL_EDGE = "#2A2A33";
export const RETRO_FONT = "'Press Start 2P', ui-monospace, monospace";

/** Neon versions of the game colours. */
const NEON: Record<string, string> = {
  "#2ED3B7": "#3DFFE0",
  "#F5B82E": "#FFD84A",
  "#8B7BF7": "#B49CFF",
  "#5AA9FF": "#5CD0FF",
  "#FF4D4D": "#FF3B5C",
  "#E0503C": "#FF3B5C",
  "#22C55E": "#4BFF7A",
  "#A78BFA": "#C59CFF",
  "#FF4D5E": "#FF3B5C",
};
export const RETRO_RED = "#FF3B5C";
export const RETRO_WHITE = "#F4FFF8";

export function retroNeon(hex: string): string {
  return NEON[hex.toUpperCase()] ?? hex;
}

/** Presentation clock in ms; frozen at 0 under reduced motion. */
export function retroClock(): number {
  if (reducedMotion()) return 0;
  return typeof performance === "undefined" ? 0 : performance.now();
}

/** Bloom strength for bright objects; a gentle pulse, static under reduced motion. */
export function retroBloom(): number {
  const t = retroClock();
  return t === 0 ? 8 : 7 + 2 * Math.sin(t / 420);
}

export interface RetroFrame {
  /** World-to-canvas transform used for the screen. */
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Draws the cabinet (letterbox margins only), a black screen, the world via
 * `drawWorld` clipped to the screen, then scanlines over the screen.
 * `mode: "fit"` keeps the aspect (centred letterbox), `"stretch"` fills.
 */
export function retroScreen(
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
  worldW: number,
  worldH: number,
  mode: "fit" | "stretch",
  drawWorld: (ctx: CanvasRenderingContext2D) => void,
): RetroFrame {
  let scaleX: number;
  let scaleY: number;
  if (mode === "fit") {
    const s = Math.min(size.width / worldW, size.height / worldH);
    scaleX = s;
    scaleY = s;
  } else {
    scaleX = size.width / worldW;
    scaleY = size.height / worldH;
  }
  const offsetX = (size.width - worldW * scaleX) / 2;
  const offsetY = (size.height - worldH * scaleY) / 2;
  const screenW = worldW * scaleX;
  const screenH = worldH * scaleY;

  ctx.save();
  // Cabinet: only the letterbox margins; zero size when the screen fills.
  ctx.fillStyle = RETRO_BEZEL;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.fillStyle = RETRO_BLACK;
  roundRect(ctx, offsetX, offsetY, screenW, screenH, 6);
  ctx.fill();
  if (offsetX >= 2 || offsetY >= 2) {
    ctx.strokeStyle = RETRO_BEZEL_EDGE;
    ctx.lineWidth = 1;
    roundRect(ctx, offsetX - 1, offsetY - 1, screenW + 2, screenH + 2, 7);
    ctx.stroke();
  }

  ctx.save();
  roundRect(ctx, offsetX, offsetY, screenW, screenH, 6);
  ctx.clip();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scaleX, scaleY);
  ctx.imageSmoothingEnabled = false;
  drawWorld(ctx);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();

  // Scanlines, in canvas pixels so they stay crisp at any scale.
  ctx.save();
  ctx.beginPath();
  ctx.rect(offsetX, offsetY, screenW, screenH);
  ctx.clip();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  const drift = Math.floor(retroClock() / 90) % 3;
  for (let y = offsetY + drift; y < offsetY + screenH; y += 3) {
    ctx.fillRect(offsetX, Math.floor(y), screenW, 1);
  }
  ctx.restore();
  ctx.restore();
  return { scaleX, scaleY, offsetX, offsetY };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** A crisp rect snapped to whole world pixels, optionally with bloom. */
export function pixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colour: string,
  glow = 0,
): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const x1 = Math.round(x + w);
  const y1 = Math.round(y + h);
  if (x1 <= x0 || y1 <= y0) return;
  ctx.fillStyle = colour;
  if (glow > 0) {
    ctx.shadowColor = colour;
    ctx.shadowBlur = glow;
  }
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (glow > 0) ctx.shadowBlur = 0;
}

/**
 * A shape rasterised in square blocks: `paint(dx, dy)` returns a colour for the
 * block centred at offset (dx, dy) from (cx, cy), or null. Blocks only fill
 * where the shape is, so the art never grows past the tested region.
 */
export function pixelShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  block: number,
  paint: (dx: number, dy: number) => string | null,
): void {
  const n = Math.ceil(radius / block);
  for (let by = -n; by < n; by++) {
    for (let bx = -n; bx < n; bx++) {
      const dx = (bx + 0.5) * block;
      const dy = (by + 0.5) * block;
      const colour = paint(dx, dy);
      if (!colour) continue;
      ctx.fillStyle = colour;
      ctx.fillRect(Math.round(cx + bx * block), Math.round(cy + by * block), block, block);
    }
  }
}

/** Pixel-font text. */
export function retroText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  px: number,
  colour: string,
  align: CanvasTextAlign = "left",
  glow = 0,
): void {
  ctx.font = `${Math.round(px)}px ${RETRO_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = colour;
  if (glow > 0) {
    ctx.shadowColor = colour;
    ctx.shadowBlur = glow;
  }
  ctx.fillText(text, Math.round(x), Math.round(y));
  ctx.shadowBlur = 0;
}

/** The "1UP" corner readout: a blinking label over a value. */
export function retroReadout(ctx: CanvasRenderingContext2D, x: number, y: number, value: string, colour: string): void {
  const t = retroClock();
  const on = t === 0 || Math.floor(t / 500) % 2 === 0;
  retroText(ctx, "1UP", x, y, 8, on ? RETRO_RED : "rgba(255,59,92,0.35)");
  retroText(ctx, value, x, y + 12, 10, colour, "left", 4);
}
