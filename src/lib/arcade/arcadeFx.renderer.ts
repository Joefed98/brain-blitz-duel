/**
 * The shared arcade success layer: particle bursts, screen shake, glow, flash,
 * score pops, combo/streak pop-ups and the big level / wave / full-clear
 * celebration, for every arcade game.
 *
 * Presentation only. A game declares its world (theme) and its success events
 * as plain reads of counters its sim already keeps; `arcadeFx` compares those
 * counters with the previous frame drawn on the same canvas and paints. It never
 * writes to state, never touches inputs, audio or scoring, and is never
 * imported by a sim or the server.
 *
 * Animation runs on a per-canvas presentation clock (like the pool-death sinks),
 * not the sim tick, so a celebration fired on a run's final tick still plays out
 * while the frozen last frame is on screen. Event detection keys off the sim
 * tick: a rewind (new run, replay, intro demo loop) resets the memory, and the
 * first frame a canvas sees never fires, so a one-frame reveal backdrop stays
 * still.
 *
 * Budget: at most ARCADE_FX_MAX_PARTICLES particles and ARCADE_FX_MAX_POPS text
 * pops per canvas, positions computed in closed form from age (no per-frame
 * integration or allocation), no shadowBlur, glow from one cached sprite per
 * colour. Shake is at most ARCADE_FX_SHAKE_PX world pixels and is reserved for
 * clear/final moments; reduced motion turns off shake, flash and movement.
 */
import { reducedMotion } from "./art.renderer";

export type ArcadeWorld =
  | "retro"
  | "space"
  | "realworld"
  | "kitchen"
  | "fairground"
  | "underwater"
  | "cavelava"
  | "orchard"
  | "toybox"
  | "gem";

export type FxParticleShape =
  "pixel" | "star" | "confetti" | "drop" | "bubble" | "ember" | "leaf" | "diamond";

export interface ArcadeWorldTheme {
  label: string;
  /** Main celebration colour. */
  primary: string;
  /** Second colour mixed into bursts and confetti. */
  secondary: string;
  /** Light accent for rings, flashes and text highlights. */
  highlight: string;
  /** Text fill for pops and banners. */
  text: string;
  /** Text outline for legibility on any background. */
  outline: string;
  particle: FxParticleShape;
  font: string;
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const DISPLAY = "'Fredoka', 'Nunito', ui-rounded, system-ui, sans-serif";

/** One theme per arcade world; colours echo each world's existing renderer palette. */
export const ARCADE_WORLD_THEMES: Record<ArcadeWorld, ArcadeWorldTheme> = {
  retro: {
    label: "Retro",
    primary: "#3DFFE0",
    secondary: "#FF4DFF",
    highlight: "#FFD84A",
    text: "#F4FFF8",
    outline: "#000000",
    particle: "pixel",
    font: "'Press Start 2P', ui-monospace, monospace",
  },
  space: {
    label: "Space",
    primary: "#7FD8FF",
    secondary: "#B98CFF",
    highlight: "#FFE58A",
    text: "#F2F6FF",
    outline: "#05081A",
    particle: "star",
    font: MONO,
  },
  realworld: {
    label: "Real World",
    primary: "#FFC93C",
    secondary: "#3DDC84",
    highlight: "#FFFFFF",
    text: "#FFFFFF",
    outline: "#1B2433",
    particle: "confetti",
    font: DISPLAY,
  },
  kitchen: {
    label: "Kitchen",
    primary: "#FF6B4A",
    secondary: "#FFD166",
    highlight: "#FFF4E0",
    text: "#F6EEE2",
    outline: "#3A2418",
    particle: "drop",
    font: DISPLAY,
  },
  fairground: {
    label: "Fairground",
    primary: "#FFD27A",
    secondary: "#D9363E",
    highlight: "#F4EDE0",
    text: "#F7F7F8",
    outline: "#1B1330",
    particle: "confetti",
    font: DISPLAY,
  },
  underwater: {
    label: "Underwater",
    primary: "#F5C542",
    secondary: "#7FE3FF",
    highlight: "#CFE8F5",
    text: "#EAF4FA",
    outline: "#06172E",
    particle: "bubble",
    font: DISPLAY,
  },
  cavelava: {
    label: "Cave & Lava",
    primary: "#FF8A3C",
    secondary: "#FFD84A",
    highlight: "#FFF1C2",
    text: "#FFF4E8",
    outline: "#1A0B06",
    particle: "ember",
    font: DISPLAY,
  },
  orchard: {
    label: "Orchard",
    primary: "#F2C14E",
    secondary: "#E2483D",
    highlight: "#FFF6D6",
    text: "#FFFDF2",
    outline: "#2E3B1C",
    particle: "leaf",
    font: DISPLAY,
  },
  toybox: {
    label: "Toybox",
    primary: "#D4A84A",
    secondary: "#4FA3E0",
    highlight: "#FFF1CF",
    text: "#FFF8EC",
    outline: "#2B1A0E",
    particle: "star",
    font: DISPLAY,
  },
  gem: {
    label: "Gemstone",
    primary: "#FFD84A",
    secondary: "#FF6FD8",
    highlight: "#FFFFFF",
    text: "#FFFFFF",
    outline: "#1A1030",
    particle: "diamond",
    font: DISPLAY,
  },
};

/**
 * pop      — a single success: small burst and a rising "+1" style pop.
 * perfect  — a precise success (perfect drop, bullseye): bigger burst, ring glow.
 * streak   — a run of successes reached a milestone: banner pop-up and edge glow.
 * combo    — a multiplier/cascade grew: banner pop-up "COMBO ×n".
 * clear    — a level, maze, wave or board stage completed: flash, shake, big burst, banner.
 * final    — the whole run cleared (every level / wave / target): the biggest moment, with confetti.
 */
export type ArcadeFxKind = "pop" | "perfect" | "streak" | "combo" | "clear" | "final";

export interface ArcadeFxPoint {
  x: number;
  y: number;
}

export interface ArcadeFxEvent<S> {
  kind: ArcadeFxKind;
  /** A counter the sim already keeps; the event fires when it rises. Read only. */
  count: (state: S) => number;
  /** Where it happened, in the coordinates the wrapped draw uses; default: the centre. */
  at?: (state: S) => ArcadeFxPoint | null | undefined;
  /** Pop/banner text; null for none. Default by kind ("+n", "COMBO ×n", "CLEAR!"…). */
  label?: (state: S, count: number, delta: number) => string | null;
  /** Fire only when the counter crosses a multiple of this (streak milestones). */
  every?: number;
  /** Fire only once the counter is at least this. */
  min?: number;
  /** Fire only when the counter rose by at least this much in one frame (a big pop or drop). */
  minDelta?: number;
  /** Extra gate read from state at the moment the counter rises. */
  when?: (state: S) => boolean;
  /** Override the theme colour for this event. */
  colour?: (state: S) => string | undefined;
  /**
   * Also blink a two-colour neon border round the edge of the world (three
   * quick pulses). Edge only, never over the play area.
   */
  neon?: boolean;
  /**
   * Also race a colour band along the top and bottom edges (a light chase) for
   * a wave or stage clear. Edge only, never over the play area.
   */
  sweep?: boolean;
}

export interface ArcadeFxSpec<S> {
  /** Stable game id; also the memory key on the canvas. */
  game: string;
  world: ArcadeWorld;
  /** Size of the coordinate space the wrapped draw paints in. */
  width: number;
  height: number;
  events: readonly ArcadeFxEvent<S>[];
  /** False for aim/draw games where even a 2 px shake would mislead a finger. */
  shake?: boolean;
  /** Clip effects to this rectangle (default: the whole width × height). */
  clip?: { x: number; y: number; w: number; h: number };
  /**
   * How width × height maps onto the canvas size passed to the wrapped draw:
   * centred uniform "fit" (default), "stretch" per axis, or "world" when the
   * caller has already applied the world transform.
   */
  fit?: "fit" | "stretch" | "world";
}

export const ARCADE_FX_MAX_PARTICLES = 40;
export const ARCADE_FX_MAX_POPS = 4;
export const ARCADE_FX_SHAKE_PX = 2;

interface FxTiming {
  particles: number;
  spread: number;
  life: number;
  popSize: number;
  popLife: number;
  flash: number;
  shake: number;
  ring: boolean;
  banner: boolean;
}

const KIND: Record<ArcadeFxKind, FxTiming> = {
  pop: {
    particles: 6,
    spread: 26,
    life: 520,
    popSize: 13,
    popLife: 700,
    flash: 0,
    shake: 0,
    ring: false,
    banner: false,
  },
  perfect: {
    particles: 10,
    spread: 38,
    life: 650,
    popSize: 16,
    popLife: 900,
    flash: 0,
    shake: 0,
    ring: true,
    banner: false,
  },
  streak: {
    particles: 8,
    spread: 34,
    life: 650,
    popSize: 18,
    popLife: 1000,
    flash: 0,
    shake: 0,
    ring: false,
    banner: true,
  },
  combo: {
    particles: 8,
    spread: 34,
    life: 650,
    popSize: 18,
    popLife: 900,
    flash: 0,
    shake: 0,
    ring: true,
    banner: true,
  },
  clear: {
    particles: 22,
    spread: 70,
    life: 900,
    popSize: 24,
    popLife: 1300,
    flash: 0.26,
    shake: 260,
    ring: true,
    banner: true,
  },
  final: {
    particles: 30,
    spread: 95,
    life: 1300,
    popSize: 28,
    popLife: 1800,
    flash: 0.34,
    shake: 320,
    ring: true,
    banner: true,
  },
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  born: number;
  life: number;
  size: number;
  colour: string;
  spin: number;
}

interface Pop {
  text: string;
  x: number;
  y: number;
  born: number;
  life: number;
  size: number;
  colour: string;
  banner: boolean;
}

interface Ring {
  x: number;
  y: number;
  born: number;
  life: number;
  radius: number;
  colour: string;
}

interface Memory {
  tick: number;
  counts: number[];
  particles: Particle[];
  pops: Pop[];
  rings: Ring[];
  flashAt: number;
  flashAlpha: number;
  flashColour: string;
  shakeAt: number;
  shakeMs: number;
  edgeAt: number;
  edgeColour: string;
  neonAt: number;
  sweepAt: number;
  seed: number;
}

const memories = new WeakMap<object, Map<string, Memory>>();

let clock: () => number = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

/** Test hook: drive the presentation clock by hand. Returns a restore function. */
export function setArcadeFxClock(next: () => number): () => void {
  const previous = clock;
  clock = next;
  return () => {
    clock = previous;
  };
}

/** Small integer hash, so particle spreads repeat for the same event (no Math.random). */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function memoryFor(ctx: object): Map<string, Memory> {
  let map = memories.get(ctx);
  if (!map) {
    map = new Map();
    memories.set(ctx, map);
  }
  return map;
}

function freshMemory(tick: number, counts: number[]): Memory {
  return {
    tick,
    counts,
    particles: [],
    pops: [],
    rings: [],
    flashAt: -Infinity,
    flashAlpha: 0,
    flashColour: "#FFFFFF",
    shakeAt: -Infinity,
    shakeMs: 0,
    edgeAt: -Infinity,
    edgeColour: "#FFFFFF",
    neonAt: -Infinity,
    sweepAt: -Infinity,
    seed: 1,
  };
}

function defaultLabel(kind: ArcadeFxKind, count: number, delta: number): string | null {
  switch (kind) {
    case "pop":
      return `+${delta}`;
    case "perfect":
      return "PERFECT";
    case "streak":
      return `STREAK ${count}`;
    case "combo":
      return `COMBO ×${count}`;
    case "clear":
      return "CLEAR!";
    case "final":
      return "FULL CLEAR!";
  }
}

function spawn<S>(
  m: Memory,
  spec: ArcadeFxSpec<S>,
  event: ArcadeFxEvent<S>,
  state: S,
  count: number,
  delta: number,
  now: number,
  still: boolean,
): void {
  const theme = ARCADE_WORLD_THEMES[spec.world];
  const t = KIND[event.kind];
  const point = event.at?.(state) ?? { x: spec.width / 2, y: spec.height / 2 };
  const colour = event.colour?.(state) ?? (event.kind === "pop" ? theme.primary : theme.highlight);
  const seed = (m.seed = (m.seed + 1) | 0);
  const big = event.kind === "clear" || event.kind === "final";

  const n = still ? Math.min(3, t.particles) : t.particles;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + hash(seed, i) * 0.9;
    const speed = (0.45 + hash(seed, i + 97) * 0.55) * t.spread;
    m.particles.push({
      x: point.x,
      y: point.y,
      vx: still ? 0 : Math.cos(angle) * speed,
      vy: still ? 0 : Math.sin(angle) * speed - (big ? 20 : 8),
      gravity: still ? 0 : big ? 60 : 40,
      born: now,
      life: t.life * (0.75 + hash(seed, i + 31) * 0.25),
      size: (big ? 3 : 2) + hash(seed, i + 7) * 2,
      colour: i % 3 === 2 ? theme.secondary : i % 3 === 1 ? colour : theme.primary,
      spin: hash(seed, i + 53) * 6 - 3,
    });
  }
  if (event.kind === "final" && !still) {
    // Confetti falls from the top edge across the width.
    const pieces = 18;
    for (let i = 0; i < pieces; i++) {
      m.particles.push({
        x: ((i + hash(seed, i + 201)) / pieces) * spec.width,
        y: -6,
        vx: (hash(seed, i + 301) - 0.5) * 30,
        vy: 30 + hash(seed, i + 401) * 50,
        gravity: 40,
        born: now + hash(seed, i + 501) * 250,
        life: 1600,
        size: 3 + hash(seed, i + 601) * 2,
        colour: i % 2 ? theme.secondary : theme.primary,
        spin: hash(seed, i + 701) * 8 - 4,
      });
    }
  }
  if (m.particles.length > ARCADE_FX_MAX_PARTICLES)
    m.particles.splice(0, m.particles.length - ARCADE_FX_MAX_PARTICLES);

  const text = event.label
    ? event.label(state, count, delta)
    : defaultLabel(event.kind, count, delta);
  if (text) {
    const banner = t.banner;
    m.pops.push({
      text,
      x: banner ? spec.width / 2 : point.x,
      y: banner ? spec.height * (big ? 0.4 : 0.24) : point.y - 10,
      born: now,
      life: t.popLife,
      size: t.popSize,
      colour: big ? theme.highlight : colour,
      banner,
    });
    // A banner replaces an older banner so pop-ups never stack into a wall of text.
    if (banner) {
      for (let i = m.pops.length - 2; i >= 0; i--) if (m.pops[i]!.banner) m.pops.splice(i, 1);
    }
    if (m.pops.length > ARCADE_FX_MAX_POPS) m.pops.splice(0, m.pops.length - ARCADE_FX_MAX_POPS);
  }
  if (t.ring) {
    m.rings.push({
      x: point.x,
      y: point.y,
      born: now,
      life: big ? 700 : 450,
      radius: big ? 80 : 28,
      colour,
    });
    if (m.rings.length > 3) m.rings.shift();
  }
  if (t.flash > 0 && !still) {
    m.flashAt = now;
    m.flashAlpha = t.flash;
    m.flashColour = theme.highlight;
  }
  if (t.shake > 0 && !still && spec.shake !== false) {
    m.shakeAt = now;
    m.shakeMs = t.shake;
  }
  if (event.kind !== "pop") {
    m.edgeAt = now;
    m.edgeColour = event.kind === "perfect" ? colour : theme.primary;
  }
  if (event.neon) m.neonAt = now;
  if (event.sweep && !still) m.sweepAt = now;
}

/** Neon border pulse and edge colour sweep: how long each runs, ms. */
export const ARCADE_FX_NEON_MS = 900;
export const ARCADE_FX_SWEEP_MS = 800;

/** Reads the declared counters and fires whatever rose since the last frame on this canvas. */
function observe<S extends { tick: number }>(
  ctx: object,
  spec: ArcadeFxSpec<S>,
  state: S,
  now: number,
  still: boolean,
): Memory {
  const map = memoryFor(ctx);
  const counts = spec.events.map((event) => {
    const value = event.count(state);
    return Number.isFinite(value) ? value : 0;
  });
  let m = map.get(spec.game);
  if (!m || state.tick < m.tick) {
    m = freshMemory(state.tick, counts);
    map.set(spec.game, m);
    return m;
  }
  if (state.tick !== m.tick) {
    spec.events.forEach((event, i) => {
      const before = m!.counts[i] ?? 0;
      const after = counts[i] ?? 0;
      if (after <= before) return;
      if (event.min !== undefined && after < event.min) return;
      if (
        event.every !== undefined &&
        Math.floor(after / event.every) <= Math.floor(before / event.every)
      )
        return;
      if (event.minDelta !== undefined && after - before < event.minDelta) return;
      if (event.when && !event.when(state)) return;
      spawn(m!, spec, event, state, after, after - before, now, still);
    });
  }
  m.tick = state.tick;
  m.counts = counts;
  return m;
}

const glowCache = new Map<string, CanvasImageSource | null>();

/** One soft radial sprite per colour, so glows never need shadowBlur. */
function glowSprite(colour: string): CanvasImageSource | null {
  if (glowCache.has(colour)) return glowCache.get(colour) ?? null;
  let sprite: CanvasImageSource | null = null;
  try {
    const size = 64;
    const canvas: HTMLCanvasElement | OffscreenCanvas | null =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(size, size)
        : typeof document !== "undefined"
          ? Object.assign(document.createElement("canvas"), { width: size, height: size })
          : null;
    const g = canvas?.getContext("2d") as
      CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined;
    if (canvas && g) {
      const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, colour);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gradient;
      g.fillRect(0, 0, size, size);
      sprite = canvas;
    }
  } catch {
    sprite = null;
  }
  if (glowCache.size > 24) glowCache.clear();
  glowCache.set(colour, sprite);
  return sprite;
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  colour: string,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  if (alpha <= 0.01) return;
  const sprite = glowSprite(colour);
  ctx.globalAlpha = alpha;
  if (sprite) ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  else {
    ctx.fillStyle = colour;
    ctx.globalAlpha = alpha * 0.35;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  shape: FxParticleShape,
  p: Particle,
  x: number,
  y: number,
  age: number,
): void {
  const s = p.size;
  ctx.fillStyle = p.colour;
  ctx.strokeStyle = p.colour;
  switch (shape) {
    case "pixel":
      ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), Math.ceil(s), Math.ceil(s));
      return;
    case "star":
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x + s, y);
      ctx.moveTo(x, y - s);
      ctx.lineTo(x, y + s);
      ctx.stroke();
      return;
    case "bubble":
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case "drop":
    case "ember":
      ctx.beginPath();
      ctx.arc(x, y, s * (shape === "ember" ? 0.6 : 0.75), 0, Math.PI * 2);
      ctx.fill();
      return;
    case "confetti":
    case "leaf":
    case "diamond": {
      const a = p.spin * age;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      if (shape === "confetti") ctx.fillRect(-s / 2, -s / 4, s, s / 2);
      else {
        ctx.beginPath();
        if (shape === "leaf") ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2);
        else {
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.7, 0);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.7, 0);
          ctx.closePath();
        }
        ctx.fill();
      }
      ctx.restore();
      return;
    }
  }
}

function paint<S>(
  ctx: CanvasRenderingContext2D,
  spec: ArcadeFxSpec<S>,
  m: Memory,
  now: number,
  still: boolean,
): void {
  const theme = ARCADE_WORLD_THEMES[spec.world];
  const clip = spec.clip ?? { x: 0, y: 0, w: spec.width, h: spec.height };
  if (m.particles.length) m.particles = m.particles.filter((p) => now - p.born < p.life);
  if (m.pops.length) m.pops = m.pops.filter((p) => now - p.born < p.life);
  if (m.rings.length) m.rings = m.rings.filter((r) => now - r.born < r.life);
  const flashAge = now - m.flashAt;
  const edgeAge = now - m.edgeAt;
  const neonAge = now - m.neonAt;
  const sweepAge = now - m.sweepAt;
  if (
    !m.particles.length && !m.pops.length && !m.rings.length && flashAge > 260 && edgeAge > 600 &&
    neonAge > ARCADE_FX_NEON_MS && sweepAge > ARCADE_FX_SWEEP_MS
  )
    return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(clip.x, clip.y, clip.w, clip.h);
  ctx.clip();
  ctx.shadowBlur = 0;
  ctx.setLineDash?.([]);

  if (!still && flashAge >= 0 && flashAge < 260) {
    ctx.globalAlpha = m.flashAlpha * (1 - flashAge / 260);
    ctx.fillStyle = m.flashColour;
    ctx.fillRect(clip.x, clip.y, clip.w, clip.h);
  }
  if (edgeAge >= 0 && edgeAge < 600) {
    const p = edgeAge / 600;
    ctx.strokeStyle = m.edgeColour;
    for (let i = 0; i < 2; i++) {
      ctx.globalAlpha = Math.sin(Math.PI * p) * 0.22 * (1 - i / 2);
      ctx.lineWidth = 3 + i * 4;
      ctx.strokeRect(clip.x + 3, clip.y + 3, clip.w - 6, clip.h - 6);
    }
  }

  // Neon border pulse: three quick blinks alternating the world's two neon
  // colours, a thin bright line with a softer halo, inside the edge only.
  if (neonAge >= 0 && neonAge < (still ? 300 : ARCADE_FX_NEON_MS)) {
    const p = neonAge / ARCADE_FX_NEON_MS;
    const blink = still ? 0.5 : Math.abs(Math.sin(Math.PI * 3 * p)) * (1 - p * 0.6);
    const colour = still || Math.floor(p * 3) % 2 === 0 ? theme.primary : theme.secondary;
    ctx.strokeStyle = colour;
    ctx.globalAlpha = 0.28 * blink;
    ctx.lineWidth = 8;
    ctx.strokeRect(clip.x + 4, clip.y + 4, clip.w - 8, clip.h - 8);
    ctx.globalAlpha = 0.85 * blink;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(clip.x + 2, clip.y + 2, clip.w - 4, clip.h - 4);
  }
  // Colour sweep: a three-colour band races left to right along the top edge
  // and right to left along the bottom edge, 5 px deep.
  if (!still && sweepAge >= 0 && sweepAge < ARCADE_FX_SWEEP_MS) {
    const p = sweepAge / ARCADE_FX_SWEEP_MS;
    const band = clip.w * 0.45;
    const colours = [theme.primary, theme.secondary, theme.highlight];
    const head = -band + p * (clip.w + band);
    ctx.globalAlpha = 0.9 * Math.sin(Math.PI * p);
    for (let i = 0; i < colours.length; i++) {
      ctx.fillStyle = colours[i]!;
      const seg = band / colours.length;
      const x = head + i * seg;
      ctx.fillRect(clip.x + x, clip.y, seg + 1, 5);
      ctx.fillRect(clip.x + clip.w - x - seg, clip.y + clip.h - 5, seg + 1, 5);
    }
  }

  const previous = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  for (const r of m.rings) {
    const p = (now - r.born) / r.life;
    drawGlow(ctx, r.colour, r.x, r.y, r.radius * (still ? 0.8 : 0.5 + p * 0.7), 0.55 * (1 - p));
  }
  ctx.globalCompositeOperation = previous;
  for (const r of m.rings) {
    const p = (now - r.born) / r.life;
    ctx.globalAlpha = 0.8 * (1 - p);
    ctx.strokeStyle = r.colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius * (still ? 0.6 : 0.25 + p * 0.75), 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const p of m.particles) {
    const age = (now - p.born) / 1000;
    if (age < 0) continue;
    const life = p.life / 1000;
    ctx.globalAlpha = Math.max(0, Math.min(1, 1.2 * (1 - age / life)));
    drawParticle(
      ctx,
      theme.particle,
      p,
      p.x + p.vx * age,
      p.y + p.vy * age + 0.5 * p.gravity * age * age,
      age,
    );
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const pop of m.pops) {
    const p = (now - pop.born) / pop.life;
    const rise = still ? 0 : pop.banner ? 0 : p * 18;
    const scale =
      still || !pop.banner
        ? 1
        : p < 0.15
          ? 0.6 + (p / 0.15) * 0.5
          : p < 0.25
            ? 1.1 - ((p - 0.15) / 0.1) * 0.1
            : 1;
    const size = Math.round(pop.size * scale);
    ctx.globalAlpha = p < 0.75 ? 1 : Math.max(0, 1 - (p - 0.75) / 0.25);
    ctx.font = `700 ${size}px ${theme.font}`;
    ctx.lineWidth = Math.max(2, size / 5);
    ctx.strokeStyle = theme.outline;
    ctx.strokeText(pop.text, pop.x, pop.y - rise);
    ctx.fillStyle = pop.colour;
    ctx.fillText(pop.text, pop.x, pop.y - rise);
  }
  ctx.restore();
}

interface FxView {
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}

function viewOf<S>(
  spec: ArcadeFxSpec<S>,
  size: { width: number; height: number } | undefined,
): FxView {
  const fit = spec.fit ?? "fit";
  if (!size || fit === "world") return { sx: 1, sy: 1, ox: 0, oy: 0 };
  if (fit === "stretch")
    return { sx: size.width / spec.width, sy: size.height / spec.height, ox: 0, oy: 0 };
  const s = Math.min(size.width / spec.width, size.height / spec.height);
  return {
    sx: s,
    sy: s,
    ox: (size.width - spec.width * s) / 2,
    oy: (size.height - spec.height * s) / 2,
  };
}

/**
 * Draws one frame of a game through the shared success layer: applies the
 * current shake (if any) around `drawWorld`, then paints bursts, rings, pops,
 * banners and flashes on top. `drawWorld` is the game's own unchanged drawing.
 * With `size`, effect coordinates (spec width × height) are mapped onto the
 * canvas the same way the game maps its world (see `fit`).
 */
export function arcadeFx<S extends { tick: number }>(
  ctx: CanvasRenderingContext2D,
  spec: ArcadeFxSpec<S>,
  state: S,
  drawWorld: () => void,
  size?: { width: number; height: number },
): void {
  const now = clock();
  const still = reducedMotion();
  let m: Memory;
  try {
    m = observe(ctx, spec, state, now, still);
  } catch {
    // A presentation fault must never cost the game its frame.
    drawWorld();
    return;
  }
  const view = viewOf(spec, size);
  const shakeAge = now - m.shakeAt;
  if (!still && shakeAge >= 0 && shakeAge < m.shakeMs) {
    const fade = 1 - shakeAge / m.shakeMs;
    const dx = Math.sin(shakeAge * 0.11) * ARCADE_FX_SHAKE_PX * fade * view.sx;
    const dy = Math.cos(shakeAge * 0.13) * ARCADE_FX_SHAKE_PX * fade * 0.6 * view.sy;
    ctx.save();
    ctx.translate(dx, dy);
    try {
      drawWorld();
    } finally {
      ctx.restore();
    }
  } else drawWorld();
  ctx.save();
  try {
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.sx, view.sy);
    paint(ctx, spec, m, now, still);
  } catch {
    /* Presentation only: a failed effect frame is skipped. */
  } finally {
    ctx.restore();
  }
}

/**
 * Wraps a game's top-level draw (ctx, state, size, ...rest) with the shared
 * success layer. Same signature, same drawing; effects on top.
 */
export function withArcadeFx<S extends { tick: number }, R extends unknown[]>(
  spec: ArcadeFxSpec<S>,
  draw: (
    ctx: CanvasRenderingContext2D,
    state: S,
    size: { width: number; height: number },
    ...rest: R
  ) => void,
): (
  ctx: CanvasRenderingContext2D,
  state: S,
  size: { width: number; height: number },
  ...rest: R
) => void {
  return (ctx, state, size, ...rest) =>
    arcadeFx(ctx, spec, state, () => draw(ctx, state, size, ...rest), size);
}

/** Diagnostics for checks: live effect counts on a canvas for one game. */
export function arcadeFxStats(
  ctx: object,
  game: string,
): { particles: number; pops: number; rings: number; shaking: boolean } {
  const m = memories.get(ctx)?.get(game);
  if (!m) return { particles: 0, pops: 0, rings: 0, shaking: false };
  const now = clock();
  return {
    particles: m.particles.filter((p) => now - p.born < p.life).length,
    pops: m.pops.filter((p) => now - p.born < p.life).length,
    rings: m.rings.filter((r) => now - r.born < r.life).length,
    shaking: now - m.shakeAt >= 0 && now - m.shakeAt < m.shakeMs,
  };
}

/** Text of the pops currently on screen, for checks. */
export function arcadeFxPopTexts(ctx: object, game: string): string[] {
  const m = memories.get(ctx)?.get(game);
  const now = clock();
  return m ? m.pops.filter((p) => now - p.born < p.life).map((p) => p.text) : [];
}
