/**
 * The Retro overhaul's in-world effects (phase 2 step 4, stage 2, 15 Nov 2026; docs/design/retro-overhaul.md): the
 * small physical moments on the pieces themselves (a paddle's dip, a brick's crack, a thrust puff, a shield shattering)
 * that the shared success layer (arcadeFx.renderer.ts: pops, banners, edge pulses) does not draw. The effects kit
 * (src/lib/fx/kit.ts) is for DOM pieces; inside a canvas game the game's renderer draws its own (the kit's README).
 *
 * Display only, like every renderer: an event log per canvas and game remembers when a counter the sim already keeps
 * rose (in sim ticks, so a replay at any speed draws the same moment at the same place), and each effect is drawn from
 * its age. Nothing here reads a clock, writes a state or changes an input. Every primitive draws whole-pixel blocks, so
 * the effects stay retro; none draws over the HUD, and none lasts past half a second but a wall-clear payoff.
 *
 * Reduced motion: effects that travel (sparks, shards, streaks) draw a short still flash instead (`fx.still`); reduced
 * effects (a slow phone, the battery saver) halve the particles.
 */
import { reducedMotion } from "./art.renderer";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";

export interface RetroFxEvent {
  kind: string;
  /** The sim tick it happened on. */
  tick: number;
  x: number;
  y: number;
  /** A size, count or step for the effect (the combo step, the hit's strength…). */
  n: number;
  /** An optional colour. */
  c?: string;
  /** An optional second point (a streak's start, a bolt's direction). */
  x2?: number;
  y2?: number;
}

interface Memo {
  tick: number;
  counts: Map<string, number>;
  list: RetroFxEvent[];
  /** Any state the game's effects keep between frames (the last hit lane, a combo's step…). */
  keep: Map<string, number>;
}

/** The longest any logged effect is kept (ticks): the payoffs at the end are the longest. */
const KEEP_TICKS = 240;
const MAX_EVENTS = 48;

const memos = new WeakMap<CanvasRenderingContext2D, Map<string, Memo>>();

export interface RetroFx {
  /** The sim tick being drawn. */
  tick: number;
  /** Reduced motion: travelling effects draw still. */
  still: boolean;
  /** Reduced effects: fewer particles. */
  lite: boolean;
  /**
   * When `count` has risen since the last frame drawn, log one event (or the ones `make` returns) at this tick.
   * The first frame drawn only records the count, so a reveal or a joined-late frame logs nothing.
   */
  rise(name: string, count: number, make: (delta: number, before: number) => Omit<RetroFxEvent, "tick" | "kind"> | null): void;
  /** Log an event now (a moment found by comparing positions rather than a counter). */
  log(kind: string, e: Omit<RetroFxEvent, "tick" | "kind">): void;
  /** Each logged event of this kind younger than `life` ticks, with its age 0…1 and in ticks. */
  each(kind: string, life: number, draw: (e: RetroFxEvent, age: number, ticks: number) => void): void;
  /** The youngest logged event of this kind younger than `life`, or null. */
  latest(kind: string, life: number): { e: RetroFxEvent; age: number } | null;
  /** A number kept between frames (a combo step, a remembered position); `set` returns the value. */
  get(key: string, fallback: number): number;
  set(key: string, value: number): number;
}

/**
 * The effects log for one game on one canvas. A tick that goes backwards (a new run, practice's Play again, a reveal
 * drawn after the live round) starts a fresh log.
 */
export function retroFx(ctx: CanvasRenderingContext2D, game: string, tick: number): RetroFx {
  let games = memos.get(ctx);
  if (!games) {
    games = new Map();
    memos.set(ctx, games);
  }
  let memo = games.get(game);
  if (!memo || tick < memo.tick) {
    memo = { tick, counts: new Map(), list: [], keep: new Map() };
    games.set(game, memo);
  }
  const m = memo;
  const fresh = m.tick !== tick;
  m.tick = tick;
  if (fresh && m.list.length) m.list = m.list.filter((e) => tick - e.tick < KEEP_TICKS);
  const push = (e: RetroFxEvent) => {
    m.list.push(e);
    if (m.list.length > MAX_EVENTS) m.list.splice(0, m.list.length - MAX_EVENTS);
  };
  return {
    tick,
    still: reducedMotion(),
    lite: arcadeReducedEffects(),
    rise(name, count, make) {
      const before = m.counts.get(name);
      m.counts.set(name, count);
      if (before === undefined || count <= before) return;
      const e = make(count - before, before);
      if (e) push({ ...e, kind: name, tick });
    },
    log(kind, e) {
      push({ ...e, kind, tick });
    },
    each(kind, life, draw) {
      for (const e of m.list) {
        if (e.kind !== kind) continue;
        const t = tick - e.tick;
        if (t < 0 || t >= life) continue;
        draw(e, t / life, t);
      }
    },
    latest(kind, life) {
      for (let i = m.list.length - 1; i >= 0; i--) {
        const e = m.list[i]!;
        if (e.kind !== kind) continue;
        const t = tick - e.tick;
        if (t >= 0 && t < life) return { e, age: t / life };
        return null;
      }
      return null;
    },
    get(key, fallback) {
      return m.keep.get(key) ?? fallback;
    },
    set(key, value) {
      m.keep.set(key, value);
      return value;
    },
  };
}

/** A small seeded hash for scattering particles the same way every frame of one event. */
function scatter(seed: number, i: number): number {
  let h = Math.imul((seed | 0) ^ Math.imul(i + 1, 0x9e3779b1), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function block(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
}

/** Pixel sparks flying out from a point (under reduced motion, a still star of blocks that fades). */
export function fxSparks(
  fx: RetroFx,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  age: number,
  colour: string,
  opts: { n?: number; spread?: number; seed?: number; size?: number; up?: boolean } = {},
): void {
  if (age < 0 || age >= 1) return;
  const n = Math.max(2, Math.round((opts.n ?? 6) * (fx.lite ? 0.5 : 1)));
  const spread = opts.spread ?? 14;
  const size = opts.size ?? 2;
  ctx.save();
  ctx.fillStyle = colour;
  ctx.globalAlpha = 1 - age;
  for (let i = 0; i < n; i++) {
    const a = opts.up ? -Math.PI * (0.15 + 0.7 * scatter(opts.seed ?? 0, i)) : 2 * Math.PI * scatter(opts.seed ?? 0, i);
    const d = fx.still ? spread * 0.35 : (2 + spread * (0.6 + 0.4 * scatter((opts.seed ?? 0) + 7, i))) * Math.sqrt(age);
    block(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d + (fx.still ? 0 : 6 * age * age), size);
  }
  ctx.restore();
}

/** A soft puff: a ring of blocks that grows and thins (a thrust, a jet, a landing's dust). */
export function fxPuff(fx: RetroFx, ctx: CanvasRenderingContext2D, x: number, y: number, age: number, colour: string, r = 6): void {
  if (age < 0 || age >= 1) return;
  const rr = fx.still ? r * 0.7 : r * (0.4 + 0.8 * age);
  ctx.save();
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.55 * (1 - age);
  const n = fx.lite ? 5 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    block(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6, 2);
  }
  ctx.restore();
}

/** A ring that opens from r0 to r1 and fades (a pickup, a power-up, a lock lamp). */
export function fxRing(fx: RetroFx, ctx: CanvasRenderingContext2D, x: number, y: number, r0: number, r1: number, age: number, colour: string, width = 2): void {
  if (age < 0 || age >= 1) return;
  const r = fx.still ? (r0 + r1) / 2 : r0 + (r1 - r0) * (1 - (1 - age) * (1 - age));
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.globalAlpha = 0.9 * (1 - age);
  ctx.beginPath();
  ctx.arc(Math.round(x), Math.round(y), Math.max(1, r), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** A straight streak from (x0, y0) to (x1, y1) that fades from its start (a hard drop, a dash, a shot's column). */
export function fxStreak(
  fx: RetroFx,
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  age: number,
  colour: string,
  width = 2,
): void {
  if (age < 0 || age >= 1) return;
  ctx.save();
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, colour);
  ctx.strokeStyle = g;
  ctx.globalAlpha = (fx.still ? 0.5 : 0.85) * (1 - age);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(Math.round(x0), Math.round(y0));
  ctx.lineTo(Math.round(x1), Math.round(y1));
  ctx.stroke();
  ctx.restore();
}

/** A rectangle washed with a colour that fades (a flipper face, a hit flash on a ship, a lit deck). */
export function fxFlash(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, age: number, colour: string, peak = 0.8): void {
  if (age < 0 || age >= 1) return;
  ctx.save();
  ctx.globalAlpha = peak * (1 - age);
  ctx.fillStyle = colour;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.restore();
}

/**
 * A crack drawn inside a rectangle, deeper by `level` (1…4): jagged 1 px pixel lines from a seeded point, so a 2- or
 * 3-hit brick reads its state at a glance. Never past the rectangle.
 */
export function fxCrack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, level: number, seed: number, colour = "rgba(0,0,0,0.55)"): void {
  if (level <= 0 || w < 4 || h < 4) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = colour;
  const ox = x + w * (0.3 + 0.4 * scatter(seed, 0));
  const oy = y + h * (0.3 + 0.4 * scatter(seed, 1));
  const arms = Math.min(4, 1 + level);
  for (let a = 0; a < arms; a++) {
    let cx = ox;
    let cy = oy;
    const dir = (a / arms) * Math.PI * 2 + scatter(seed, 10 + a);
    const len = Math.min(w, h * 3) * (0.25 + 0.12 * level);
    const steps = Math.max(2, Math.round(len / 2));
    for (let i = 0; i < steps; i++) {
      const wob = (scatter(seed, 20 + a * 16 + i) - 0.5) * 1.6;
      cx += Math.cos(dir + wob) * 2;
      cy += Math.sin(dir + wob) * 1.2;
      ctx.fillRect(Math.round(cx), Math.round(cy), 1, 1);
    }
  }
  ctx.restore();
}

/** Shards: blocks breaking outward and falling (a shield shattering, the comet breaking up, a life icon breaking). */
export function fxShards(
  fx: RetroFx,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  age: number,
  colour: string,
  opts: { n?: number; r?: number; seed?: number; size?: number } = {},
): void {
  if (age < 0 || age >= 1) return;
  const n = Math.max(3, Math.round((opts.n ?? 10) * (fx.lite ? 0.5 : 1)));
  const r = opts.r ?? 10;
  const size = opts.size ?? 3;
  ctx.save();
  ctx.fillStyle = colour;
  ctx.globalAlpha = 1 - age * age;
  for (let i = 0; i < n; i++) {
    const a = 2 * Math.PI * ((i + scatter(opts.seed ?? 0, i) * 0.6) / n);
    const d = fx.still ? r : r + 18 * age * (0.6 + 0.4 * scatter((opts.seed ?? 0) + 3, i));
    const fall = fx.still ? 0 : 22 * age * age;
    block(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d + fall, size);
  }
  ctx.restore();
}
