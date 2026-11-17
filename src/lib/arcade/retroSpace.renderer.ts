/**
 * Retro space scenery (the Retro overhaul, stage 2, 15 Nov 2026; display only): the shared pieces behind the space
 * games' worlds, kept pixel and retro. A nebula in dithered pixel blocks (value noise quantised into a palette's steps
 * with a 4 × 4 ordered dither between them, never a soft photo), a lit pixel planet, and star layers that drift at
 * different speeds for depth. Seeded: every phone and the reveal draw the same sky. The static parts are painted into a
 * game's cached sky layer; only the drifting stars draw each frame, and they hold still under reduced motion.
 */
import { artHash, reducedMotion } from "./art.renderer";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

function noise(x: number, y: number, cell: number, seed: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const v = (i: number, j: number) => (artHash(gx + i + seed * 977, gy + j + seed * 131) % 1000) / 1000;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = v(0, 0) + (v(1, 0) - v(0, 0)) * sx;
  const bottom = v(0, 1) + (v(1, 1) - v(0, 1)) * sx;
  return top + (bottom - top) * sy;
}

export interface PixelNebula {
  x: number;
  y: number;
  w: number;
  h: number;
  seed: number;
  /** Colours darkest first; a block takes the step its gas reaches. */
  steps: readonly string[];
  /** Where the gas gathers (0…1 at a point); default everywhere. */
  band?: (x: number, y: number) => number;
  /** The gas below this is empty space (default 0.24). */
  threshold?: number;
  /** How quickly the gas climbs through the steps (default 10). */
  gain?: number;
  /** Block size (px, default 3). */
  block?: number;
  /** A second palette for a second hue, picked by a coarse noise (default none). */
  steps2?: readonly string[];
  /** Bright young stars inside the brightest gas (default true). */
  stars?: boolean;
}

/** Paints a pixel nebula into `c` (a cached sky layer). */
export function paintPixelNebula(c: CanvasRenderingContext2D, n: PixelNebula): void {
  const B = n.block ?? 3;
  const threshold = n.threshold ?? 0.24;
  const gain = n.gain ?? 10;
  for (let y = Math.floor(n.y / B) * B; y < n.y + n.h; y += B) {
    for (let x = Math.floor(n.x / B) * B; x < n.x + n.w; x += B) {
      const gas = 0.5 * noise(x, y, 150, n.seed) + 0.32 * noise(x, y, 60, n.seed + 1) + 0.18 * noise(x, y, 22, n.seed + 2);
      const dust = 0.55 + 0.45 * Math.min(1, Math.max(0, (noise(x, y, 90, n.seed + 3) - 0.25) * 2.2));
      const level = Math.max(0, (gas * (n.band ? n.band(x, y) : 1) * dust - threshold) * gain);
      const step = Math.floor(level);
      const k = step + ((level - step) * 16 > BAYER[(((y / B) & 3) * 4 + ((x / B) & 3))]! ? 1 : 0);
      if (k <= 0) continue;
      const palette = n.steps2 && noise(x, y, 260, n.seed + 4) < 0.45 ? n.steps2 : n.steps;
      c.fillStyle = palette[Math.min(palette.length, k) - 1]!;
      c.fillRect(x, y, B, B);
      if (n.stars !== false && k >= palette.length - 1 && artHash(x * 7 + n.seed, y * 13 + 1) % 13 === 0) {
        c.fillStyle = "#FFFFFF";
        c.fillRect(x + 1, y + 1, 1, 1);
      }
    }
  }
}

/**
 * A pixel planet lit from the top left, in 2 px blocks: four shades by the light, faint bands across it, and an optional
 * ring drawn in front and behind. Painted into a cached sky layer.
 */
export function paintPixelPlanet(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  shades: readonly [string, string, string, string],
  ring?: string,
): void {
  const ringPass = (front: boolean) => {
    if (!ring) return;
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      const x = Math.cos(a) * r * 1.75;
      const y = Math.sin(a) * r * 0.36;
      const rx = x * Math.cos(-0.3) - y * Math.sin(-0.3);
      const ry = x * Math.sin(-0.3) + y * Math.cos(-0.3);
      if (front !== ry > 0) continue;
      if (!front && rx * rx + ry * ry < r * r) continue;
      c.fillStyle = ring;
      c.fillRect(Math.round(cx + rx), Math.round(cy + ry), 2, 2);
    }
  };
  ringPass(false);
  for (let dy = -r; dy < r; dy += 2) {
    for (let dx = -r; dx < r; dx += 2) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r * r) continue;
      const light = -(dx + dy) / (r * 1.5) + 0.12 * Math.sin(dy / (r * 0.18));
      c.fillStyle = light > 0.42 ? shades[3] : light > 0.12 ? shades[2] : light > -0.22 ? shades[1] : shades[0];
      c.fillRect(Math.round(cx + dx), Math.round(cy + dy), 2, 2);
    }
  }
  ringPass(true);
}

export interface StarLayer {
  count: number;
  /** Drift (px a second) down the screen. */
  speed: number;
  size: number;
  colour: string;
  seed: number;
}

/**
 * Drifting star layers (drawn each frame, behind the play): the far layer slow and faint, the near one quicker and
 * brighter, so space has depth. `t` is the presentation clock in seconds (the sim tick ÷ 60, so a replay matches). Still
 * under reduced motion.
 */
export function drawStarLayers(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, layers: readonly StarLayer[]): void {
  const still = reducedMotion();
  ctx.save();
  for (const layer of layers) {
    ctx.fillStyle = layer.colour;
    for (let i = 0; i < layer.count; i++) {
      const r = artHash(i, layer.seed);
      const x = r % w;
      const y = (((r >>> 10) % h) + (still ? 0 : t * layer.speed)) % h;
      ctx.fillRect(Math.round(x), Math.round(y), layer.size, layer.size);
    }
  }
  ctx.restore();
}
