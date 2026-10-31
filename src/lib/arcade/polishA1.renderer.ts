/**
 * Polish batch A1 (25 Oct 2026, display only; docs/polish-batches/a1.md): art helpers for five Retro
 * worlds only, Meteor, Fission, Tempo, Rally and Breaker. Never imported by a sim, a grader or the
 * server, and never by another game, so the other Retro worlds (Hover, Pinball) are untouched.
 *
 * - `backdrop`: a still scene painted once per world size into a 2x layer (never per frame and never
 *   per canvas size, so a resize allocates nothing new), then one blit a frame.
 * - `popText`: a pixel-font pop that rises and fades, outlined in near-black (no shadowBlur).
 * - `shatter`: a capped pixel burst blitted from cached squares, so a game's own rect count (which
 *   its renderer check budgets) is unchanged.
 * - `glowSprite`: a cached soft radial light for blits under bright objects.
 * Moving pieces run on the presentation clock and are skipped under reduced motion and reduced
 * effects (lib/fx/lowEnd.ts); nothing here plays a sound.
 */
import { reducedMotion } from "./art.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { RETRO_FONT } from "./retro.renderer";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { FX_PARTICLE_LIMIT } from "@/lib/fx/limits";

const RATIO = 2;
type Stops = ReadonlyArray<readonly [number, string]>;

/** Seeded 32-bit hash (no Math.random), so every phone draws the same sky. */
export function a1Hash(i: number, seed: number): number {
  let t = (Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(seed + 7, 0x85ebca6b)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/*
 * Battery (31 Oct 2026, display only): a gradient with the same geometry and stops on the same context is
 * the same paint, so it is built once and reused frame to frame instead of rebuilt every frame. Each
 * context keeps at most GRADIENT_CACHE entries (moving pieces make new keys; the oldest go first).
 */
const GRADIENT_CACHE = 96;
const gradients = new WeakMap<object, Map<string, CanvasGradient>>();
function cachedGradient(c: CanvasRenderingContext2D, key: string, make: () => CanvasGradient | null, stops: Stops): CanvasGradient | null {
  let cache = gradients.get(c);
  if (!cache) gradients.set(c, (cache = new Map()));
  const id = `${key}|${stops.map(([at, colour]) => `${at}:${colour}`).join(",")}`;
  const kept = cache.get(id);
  if (kept) return kept;
  const g = make();
  if (!g || typeof g.addColorStop !== "function") return null;
  for (const [at, colour] of stops) g.addColorStop(at, colour);
  if (cache.size >= GRADIENT_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(id, g);
  return g;
}

/** A radial gradient, or the last stop's colour where the context has none (Node check stubs). */
export function radial(c: CanvasRenderingContext2D, x: number, y: number, r: number, stops: Stops, sy = 1): CanvasGradient | string {
  const g =
    typeof c.createRadialGradient === "function"
      ? cachedGradient(c, `r${x},${y / sy},${r}`, () => c.createRadialGradient(x, y / sy, 0, x, y / sy, r), stops)
      : null;
  return g ?? stops[stops.length - 1]?.[1] ?? "transparent";
}

/** A linear gradient from (x0, y0) to (x1, y1), with the same fallback. */
export function linear(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: Stops): CanvasGradient | string {
  const g =
    typeof c.createLinearGradient === "function"
      ? cachedGradient(c, `l${x0},${y0},${x1},${y1}`, () => c.createLinearGradient(x0, y0, x1, y1), stops)
      : null;
  return g ?? stops[stops.length - 1]?.[1] ?? "transparent";
}

/** A soft elliptical glow blob (a radial gradient squashed by `sy`). */
export function blob(c: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string, alpha: number, sy = 1): void {
  c.save();
  c.scale(1, sy);
  c.globalAlpha = alpha;
  c.fillStyle = radial(c, x, y, r, [[0, colour], [0.45, `${colour}88`], [1, `${colour}00`]], sy);
  c.fillRect(x - r, y / sy - r, r * 2, r * 2);
  c.restore();
}

/** Seeded pixel stars (1 and 2 px squares, a few with a cross), inside a rect. */
export function pixelStars(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, count: number, seed: number, colours: readonly string[], alpha = 1): void {
  for (let i = 0; i < count; i++) {
    const k = a1Hash(i, seed);
    const sx = Math.round(x + ((k % 10007) / 10007) * w);
    const sy = Math.round(y + (((k >>> 13) % 10009) / 10009) * h);
    const big = (k >>> 27) % 9 === 0;
    c.globalAlpha = alpha * (0.3 + ((k >>> 5) % 6) * 0.12);
    c.fillStyle = colours[i % colours.length]!;
    c.fillRect(sx, sy, big ? 2 : 1, big ? 2 : 1);
    if (big && (k >>> 9) % 3 === 0) {
      c.globalAlpha *= 0.45;
      c.fillRect(sx - 2, sy, 1, 2);
      c.fillRect(sx + 3, sy, 1, 2);
      c.fillRect(sx, sy - 2, 2, 1);
      c.fillRect(sx, sy + 3, 2, 1);
    }
  }
  c.globalAlpha = 1;
}

const backdrops = new Map<string, ArtCanvas | null>();
/**
 * Paints `paint` (world units, w x h) once into a 2x layer keyed by `key` and the size, and blits it at
 * (0, 0). Where no offscreen canvas exists (SSR, Node checks) nothing is drawn: the screen stays black,
 * exactly as before this batch.
 */
export function backdrop(ctx: CanvasRenderingContext2D, key: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void): void {
  const id = `${key}:${w}x${h}`;
  let layer = backdrops.get(id);
  if (layer === undefined) {
    const canvas = artCanvas(Math.ceil(w * RATIO), Math.ceil(h * RATIO));
    const c = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
    if (canvas && c) {
      c.scale(RATIO, RATIO);
      paint(c);
    }
    layer = canvas && c ? canvas : null;
    backdrops.set(id, layer);
  }
  if (layer) ctx.drawImage(layer as CanvasImageSource, 0, 0, w, h);
}

const glows = new Map<string, ArtCanvas | null>();
/** A soft round light in `colour`, 64 px across at 2x; blit it at any size (cached once per colour). */
export function glowSprite(colour: string): ArtCanvas | null {
  let layer = glows.get(colour);
  if (layer !== undefined) return layer;
  const canvas = artCanvas(66, 66);
  const c = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
  if (canvas && c) {
    c.fillStyle = radial(c, 33, 33, 33, [[0, `${colour}FF`], [0.25, `${colour}AA`], [0.6, `${colour}33`], [1, `${colour}00`]]);
    c.fillRect(0, 0, 66, 66);
  }
  layer = canvas && c ? canvas : null;
  glows.set(colour, layer);
  return layer;
}

/** Blits a glow centred on (x, y), rx by ry world px in radius, at `alpha`; skipped under reduced effects. */
export function glow(ctx: CanvasRenderingContext2D, colour: string, x: number, y: number, rx: number, ry: number, alpha: number): void {
  if (alpha <= 0.01 || arcadeReducedEffects()) return;
  const sprite = glowSprite(colour);
  if (!sprite) return;
  const before = ctx.globalAlpha;
  ctx.globalAlpha = before * Math.min(1, alpha);
  ctx.drawImage(sprite as CanvasImageSource, x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalAlpha = before;
}

/* ============================== Pops and shatters ============================== */

type Pop = { at: number; x: number; y: number; text: string; colour: string; px: number };
type Shard = { at: number; x: number; y: number; colours: readonly string[]; count: number; spread: number };
type Lists = { pops: Pop[]; shards: Shard[] };
const lists = new WeakMap<object, Lists>();
const POP_MS = 720;
const SHATTER_MS = 420;
const now = () => (typeof performance === "undefined" ? 0 : performance.now());
function listsOf(key: object): Lists {
  let l = lists.get(key);
  if (!l) lists.set(key, (l = { pops: [], shards: [] }));
  return l;
}

/** Forgets every pop and shatter on a canvas (a rewind: a new run or a replay restarting). */
export function clearPops(key: object): void {
  lists.delete(key);
}

/** Queues a pop at (x, y), world px; at most `max` at once (the oldest go first). */
export function addPop(key: object, x: number, y: number, text: string, colour: string, px = 10, max = 4): void {
  const l = listsOf(key);
  l.pops.push({ at: now(), x, y, text, colour, px });
  while (l.pops.length > max) l.pops.shift();
}

/** Queues a pixel shatter of `count` squares (the total live is capped at FX_PARTICLE_LIMIT). */
export function addShatter(key: object, x: number, y: number, colours: readonly string[], count = 10, spread = 22): void {
  if (reducedMotion() || arcadeReducedEffects()) return;
  const l = listsOf(key);
  const t = now();
  l.shards = l.shards.filter((s) => t - s.at < SHATTER_MS);
  let live = l.shards.reduce((n, s) => n + s.count, 0);
  while (l.shards.length && live + count > FX_PARTICLE_LIMIT) live -= l.shards.shift()!.count;
  l.shards.push({ at: t, x, y, colours, count: Math.min(count, FX_PARTICLE_LIMIT), spread });
}

const squares = new Map<string, ArtCanvas | null>();
/** A 4 x 4 pixel square with a lit corner, at 2x (cached once per colour). */
function square(colour: string): ArtCanvas | null {
  let s = squares.get(colour);
  if (s !== undefined) return s;
  const canvas = artCanvas(8, 8);
  const c = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
  if (canvas && c) {
    c.fillStyle = colour;
    c.fillRect(0, 0, 8, 8);
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.fillRect(0, 0, 4, 4);
    c.fillStyle = "rgba(0,0,0,0.3)";
    c.fillRect(4, 4, 4, 4);
  }
  s = canvas && c ? canvas : null;
  squares.set(colour, s);
  return s;
}

/**
 * Draws this canvas's live pops and shatters, pops clamped inside [8, worldW - 8]. Under reduced
 * motion a pop stands still at full strength for its time, then goes; shatters are never queued.
 */
export function drawPops(ctx: CanvasRenderingContext2D, key: object, worldW: number): void {
  const l = lists.get(key);
  if (!l) return;
  const t = now();
  const still = reducedMotion();
  l.shards = l.shards.filter((s) => t - s.at < SHATTER_MS && t >= s.at);
  for (const s of l.shards) {
    const k = (t - s.at) / SHATTER_MS;
    const ease = 1 - (1 - k) * (1 - k);
    ctx.globalAlpha = 1 - k * k;
    for (let i = 0; i < s.count; i++) {
      const h = a1Hash(i, Math.round(s.x * 31 + s.y));
      const a = (i / s.count) * Math.PI * 2 + ((h % 100) / 100) * 0.6;
      const d = 3 + s.spread * (0.55 + ((h >>> 8) % 50) / 100) * ease;
      const size = (h >>> 16) % 3 === 0 ? 4 : 2;
      const sprite = square(s.colours[i % s.colours.length]!);
      if (!sprite) continue;
      // A little gravity: the squares fall as they fly.
      ctx.drawImage(sprite as CanvasImageSource, Math.round(s.x + Math.cos(a) * d - size / 2), Math.round(s.y + Math.sin(a) * d + 10 * k * k - size / 2), size, size);
    }
  }
  l.pops = l.pops.filter((p) => t - p.at < POP_MS && t >= p.at);
  for (const p of l.pops) {
    const k = (t - p.at) / POP_MS;
    const grow = still ? 1 : k < 0.12 ? 0.7 + (k / 0.12) * 0.45 : k < 0.24 ? 1.15 - ((k - 0.12) / 0.12) * 0.15 : 1;
    const size = Math.max(6, Math.round(p.px * grow));
    const y = Math.round(p.y - (still ? 0 : 18 * (1 - (1 - k) * (1 - k))));
    const half = (p.text.length * size) / 2;
    const x = Math.round(Math.min(worldW - 8 - half, Math.max(8 + half, p.x)));
    ctx.globalAlpha = still ? 1 : k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
    ctx.font = `${size}px ${RETRO_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#07060C";
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]] as const) ctx.fillText(p.text, x + dx, y + dy);
    ctx.fillStyle = p.colour;
    ctx.fillText(p.text, x, y);
  }
  ctx.globalAlpha = 1;
}

/**
 * Tracks a counter per canvas and reports how much it rose since the last frame; a rewind (the tick
 * going back) or the first frame reports 0 and clears the canvas's pops.
 */
const counters = new WeakMap<object, Map<string, { tick: number; value: number }>>();
export function rise(key: object, name: string, tick: number, value: number): number {
  let m = counters.get(key);
  if (!m) counters.set(key, (m = new Map()));
  const old = m.get(name);
  m.set(name, { tick, value });
  if (!old) return 0;
  if (tick < old.tick) {
    clearPops(key);
    return 0;
  }
  return tick > old.tick && value > old.value ? value - old.value : 0;
}
