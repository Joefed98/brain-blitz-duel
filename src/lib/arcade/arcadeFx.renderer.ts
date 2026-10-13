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
 * Budget: at most ARCADE_FX_MAX_PARTICLES particles, ARCADE_FX_MAX_LIGHTS
 * lights and ARCADE_FX_MAX_POPS text pops per canvas, positions computed in closed form from age (no per-frame
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
 * Success-text colours, one per arcade game (keyed by puzzle type id), in that
 * game's own world colours: neon on the Retro screens, lava orange in Cave &
 * Lava, sea blues under water and so on. The fill is bright and the outline
 * near-black (contrast at least 7:1, checked by arcade-fx-check), so the text
 * reads on any part of the game's background. An event's own `colour` (a gold
 * star, a fireball) still wins for its text.
 */
export const ARCADE_FX_TEXT_COLOURS: Record<string, { fill: string; outline: string }> = {
  // Retro: neon.
  hover: { fill: "#3DFFE0", outline: "#000000" },
  breaker: { fill: "#7DF9FF", outline: "#000000" },
  rally: { fill: "#4BFF7A", outline: "#000000" },
  beat: { fill: "#FF6BFF", outline: "#000000" },
  snake: { fill: "#B6FF3D", outline: "#000000" },
  burst: { fill: "#FFE14A", outline: "#000000" },
  // Space: starlight and gold.
  wavefront: { fill: "#8FDFFF", outline: "#05081A" },
  orbit: { fill: "#FFE58A", outline: "#05081A" },
  // Real World: road-sign yellow, signal green, rainbow gold.
  skyline: { fill: "#FFC93C", outline: "#1B2433" },
  cross: { fill: "#FFE04A", outline: "#1B2433" },
  junction: { fill: "#5BE38E", outline: "#13241A" },
  inkbridge: { fill: "#FFD54B", outline: "#24333C" },
  // Kitchen: tomato and butter.
  slice: { fill: "#FF9F70", outline: "#2A170E" },
  // Fairground: bulb gold and candy pink.
  bintoss: { fill: "#FFD27A", outline: "#1B1330" },
  bullseye: { fill: "#FF9BB0", outline: "#1B1330" },
  // Underwater: sea blues.
  bubble: { fill: "#7FE3FF", outline: "#06172E" },
  // Cave & Lava: lava orange.
  flip: { fill: "#FF9A45", outline: "#1A0B06" },
  swing: { fill: "#FF8A3C", outline: "#1A0B06" },
  // Orchard: harvest gold.
  snip: { fill: "#F7CD5A", outline: "#2E3B1C" },
  // Toybox: polished brass and toy blue.
  tilt: { fill: "#FFCB5C", outline: "#2B1A0E" },
  balltrack: { fill: "#8CCBFF", outline: "#2B1A0E" },
  wordfall: { fill: "#FFCB5C", outline: "#2B1A0E" },
  // Gemstone: gem pink.
  matchup: { fill: "#FF8FE0", outline: "#1A1030" },
};

/**
 * The success-text colours for a spec's game id; revision ids carry a number
 * suffix (orbit3) and share their game's colours.
 */
export function arcadeFxTextColours(game: string): { fill: string; outline: string } | undefined {
  return ARCADE_FX_TEXT_COLOURS[game] ?? ARCADE_FX_TEXT_COLOURS[game.replace(/\d+$/, "")];
}

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
  /**
   * Text only at the event's place: no particle burst, ring or lights there
   * (Gemstone, where bursts over the gems read as bubbles). The pop or banner,
   * edge glow, arena glow and flash still play.
   */
  textOnly?: boolean;
  /**
   * Also release a short burst of soft coloured lights (glow orbs that spread
   * from `at` and fade within ARCADE_FX_LIGHTS_MS), cycling these colours.
   */
  lights?: readonly string[];
  /** Scale the pop/banner text (1 = the kind's default size). */
  textScale?: number;
  /**
   * While this event's text is up, give the arena a slight pulsing glow round
   * its edges, alternating these colours. Edge only, never over the play area.
   */
  arenaGlow?: readonly string[];
  /**
   * Polish G: cabinet lights round the arena border and in its corners (Retro
   * games). Small bulbs on the edge only, never over the play area.
   */
  bulbs?: ArcadeFxBulbs<S>;
}

/**
 * Border-light patterns (Polish G), so no two Retro games light up alike:
 *  flash — every other bulb blinks, the two sets swapping, corners strongest;
 *          `heat` (0…1) lights more bulbs, brighter, blinking faster and longer.
 *  chase — bright heads with fading tails run once round the border, each
 *          corner pulsing as a head passes it.
 *  step  — the whole border flashes in one colour, the next colour of the
 *          cycle each time the counter rises (colour = count mod cycle).
 */
export interface ArcadeFxBulbs<S> {
  pattern: "flash" | "chase" | "step";
  colours: readonly string[];
  /** Read from state when the event fires: the tension, 0…1 (flash only). */
  heat?: (state: S) => number;
  /** A milestone: longer, stronger lights (and for chase, more heads). */
  strong?: boolean;
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
/** Light-burst budget per canvas and how long one burst lasts. */
export const ARCADE_FX_MAX_LIGHTS = 14;
export const ARCADE_FX_LIGHTS_MS = 750;
/** Border lights (Polish G): spacing between bulbs (world px) and how long each pattern runs. */
export const ARCADE_FX_BULB_GAP = 24;
export const ARCADE_FX_FLASH_MS = [480, 900] as const;
export const ARCADE_FX_CHASE_MS = 950;
export const ARCADE_FX_STEP_MS = [420, 900] as const;

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
  outline: string;
}

interface Light {
  x: number;
  y: number;
  dx: number;
  dy: number;
  born: number;
  radius: number;
  colour: string;
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
  lights: Light[];
  flashAt: number;
  flashAlpha: number;
  flashColour: string;
  shakeAt: number;
  shakeMs: number;
  edgeAt: number;
  edgeColour: string;
  neonAt: number;
  sweepAt: number;
  arenaAt: number;
  arenaMs: number;
  arenaColours: readonly string[];
  bulbsAt: number;
  bulbsMs: number;
  bulbs: { pattern: ArcadeFxBulbs<unknown>["pattern"]; colours: readonly string[]; heat: number; step: number; strong: boolean } | null;
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
    lights: [],
    flashAt: -Infinity,
    flashAlpha: 0,
    flashColour: "#FFFFFF",
    shakeAt: -Infinity,
    shakeMs: 0,
    edgeAt: -Infinity,
    edgeColour: "#FFFFFF",
    neonAt: -Infinity,
    sweepAt: -Infinity,
    arenaAt: -Infinity,
    arenaMs: 0,
    arenaColours: [],
    bulbsAt: -Infinity,
    bulbsMs: 0,
    bulbs: null,
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
  const textColours = arcadeFxTextColours(spec.game);

  const n = event.textOnly ? 0 : still ? Math.min(3, t.particles) : t.particles;
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
      size: t.popSize * (event.textScale ?? 1),
      colour: event.colour?.(state) ?? textColours?.fill ?? (big ? theme.highlight : colour),
      banner,
      outline: textColours?.outline ?? theme.outline,
    });
    if (event.arenaGlow?.length) {
      m.arenaAt = now;
      m.arenaMs = t.popLife;
      m.arenaColours = event.arenaGlow;
    }
    // A banner replaces an older banner so pop-ups never stack into a wall of text.
    if (banner) {
      for (let i = m.pops.length - 2; i >= 0; i--) if (m.pops[i]!.banner) m.pops.splice(i, 1);
    }
    if (m.pops.length > ARCADE_FX_MAX_POPS) m.pops.splice(0, m.pops.length - ARCADE_FX_MAX_POPS);
  }
  if (t.ring && !event.textOnly) {
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
  if (event.lights?.length && !event.textOnly) {
    // Soft lights spread from the event in an even ring with a little seeded
    // jitter; with reduced motion they glow in place and fade.
    const lights = still ? 3 : 7;
    const reach = big ? 0.55 * Math.min(spec.width, spec.height) : 70;
    for (let i = 0; i < lights; i++) {
      const angle = (i / lights) * Math.PI * 2 + hash(seed, i + 811) * 0.7;
      const dist = still ? 0 : reach * (0.6 + hash(seed, i + 911) * 0.4);
      m.lights.push({
        x: point.x,
        y: point.y,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist * 0.8,
        born: now + (still ? 0 : hash(seed, i + 1011) * 90),
        radius: (big ? 26 : 16) * (0.8 + hash(seed, i + 1111) * 0.4),
        colour: event.lights[i % event.lights.length]!,
      });
    }
    if (m.lights.length > ARCADE_FX_MAX_LIGHTS)
      m.lights.splice(0, m.lights.length - ARCADE_FX_MAX_LIGHTS);
  }
  if (event.kind !== "pop") {
    m.edgeAt = now;
    m.edgeColour = event.kind === "perfect" ? colour : theme.primary;
  }
  if (event.neon) m.neonAt = now;
  if (event.sweep && !still) m.sweepAt = now;
  if (event.bulbs?.colours.length) {
    const b = event.bulbs;
    const heat = Math.max(0, Math.min(1, b.heat?.(state) ?? 0));
    const strong = !!b.strong;
    const ms = still
      ? 300
      : b.pattern === "chase"
        ? ARCADE_FX_CHASE_MS * (strong ? 1.25 : 1)
        : b.pattern === "step"
          ? ARCADE_FX_STEP_MS[strong ? 1 : 0]
          : ARCADE_FX_FLASH_MS[0] + (ARCADE_FX_FLASH_MS[1] - ARCADE_FX_FLASH_MS[0]) * Math.max(heat, strong ? 0.6 : 0);
    // A plain firing never cuts short a milestone that is less than half done.
    const current = m.bulbs;
    if (!(current?.strong && !strong && now - m.bulbsAt < m.bulbsMs / 2)) {
      m.bulbsAt = now;
      m.bulbsMs = ms;
      m.bulbs = { pattern: b.pattern, colours: b.colours, heat, step: Math.max(0, Math.floor(count)), strong };
    }
  }
}

interface Bulb {
  x: number;
  y: number;
  /** Distance along the border, clockwise from the top-left corner. */
  along: number;
  corner: boolean;
}

const bulbRings = new Map<string, { bulbs: Bulb[]; perimeter: number }>();

/** Bulb spots round a rectangle's edge (inset 3 px), corners first-class; cached per size. */
function bulbRing(clip: { x: number; y: number; w: number; h: number }): { bulbs: Bulb[]; perimeter: number } {
  const key = `${clip.x},${clip.y},${clip.w},${clip.h}`;
  const old = bulbRings.get(key);
  if (old) return old;
  const inset = 3;
  const x0 = clip.x + inset, y0 = clip.y + inset, x1 = clip.x + clip.w - inset, y1 = clip.y + clip.h - inset;
  const w = x1 - x0, h = y1 - y0;
  const bulbs: Bulb[] = [];
  const side = (ax: number, ay: number, bx: number, by: number, len: number, start: number) => {
    const n = Math.max(1, Math.round(len / ARCADE_FX_BULB_GAP));
    for (let i = 0; i < n; i++) {
      const f = i / n;
      bulbs.push({ x: ax + (bx - ax) * f, y: ay + (by - ay) * f, along: start + len * f, corner: i === 0 });
    }
  };
  side(x0, y0, x1, y0, w, 0);
  side(x1, y0, x1, y1, h, w);
  side(x1, y1, x0, y1, w, w + h);
  side(x0, y1, x0, y0, h, w * 2 + h);
  const ring = { bulbs, perimeter: 2 * (w + h) };
  if (bulbRings.size > 16) bulbRings.clear();
  bulbRings.set(key, ring);
  return ring;
}

/**
 * Paints the border lights for their age: a square pixel bulb 3 px inside the
 * edge with a soft glow, corners bigger. Edge only: nothing reaches more than
 * 20 px in from the border.
 */
function paintBulbs(ctx: CanvasRenderingContext2D, m: Memory, clip: { x: number; y: number; w: number; h: number }, now: number, still: boolean): void {
  const b = m.bulbs;
  const age = now - m.bulbsAt;
  if (!b || age < 0 || age >= m.bulbsMs) return;
  const p = age / m.bulbsMs;
  const fade = still ? 0.7 : p < 0.08 ? p / 0.08 : p > 0.7 ? (1 - p) / 0.3 : 1;
  const ring = bulbRing(clip);
  const colours = b.colours;
  const bulbs = ring.bulbs;
  // Reused scratch per bulb: its colour and light level this frame (0 = dark).
  litColour.length = bulbs.length;
  litLevel.length = bulbs.length;
  litLevel.fill(0);
  if (b.pattern === "flash") {
    // Marquee blink: the two halves swap, faster and with more bulbs as the heat builds.
    const period = still ? Infinity : 150 - 80 * b.heat;
    const phase = Math.floor(age / period) % 2;
    const every = b.heat >= 0.66 || b.strong ? 1 : b.heat >= 0.33 ? 2 : 3;
    const level = (0.5 + 0.5 * Math.max(b.heat, b.strong ? 0.7 : 0)) * fade;
    for (let i = 0; i < bulbs.length; i++) {
      if (bulbs[i]!.corner) {
        litColour[i] = colours[phase % colours.length]!;
        litLevel[i] = Math.min(1, level * 1.25);
        continue;
      }
      const slot = Math.floor(i / every);
      if (i % every !== 0 || slot % 2 !== phase) continue;
      litColour[i] = colours[(slot >> 1) % colours.length]!;
      litLevel[i] = level;
    }
  } else if (b.pattern === "chase") {
    // Heads run clockwise once round; tails fade behind them; corners pulse as a head passes.
    const heads = b.strong ? 4 : 2;
    const tail = ring.perimeter * 0.14;
    const travel = still ? 0 : (1 - (1 - p) * (1 - p)) * ring.perimeter;
    for (let i = 0; i < bulbs.length; i++) {
      const bulb = bulbs[i]!;
      let best = Infinity;
      for (let k = 0; k < heads; k++) {
        const head = (travel + (k * ring.perimeter) / heads) % ring.perimeter;
        const behind = (head - bulb.along + ring.perimeter) % ring.perimeter;
        if (behind < best) best = behind;
      }
      if (best > tail) {
        if (bulb.corner) {
          litColour[i] = colours[colours.length - 1]!;
          litLevel[i] = 0.35 * fade;
        }
        continue;
      }
      const k = 1 - best / tail;
      litColour[i] = k > 0.75 ? colours[0]! : colours[1 % colours.length]!;
      litLevel[i] = (bulb.corner ? 1 : 0.85) * k * fade;
    }
  } else {
    // Step: the whole border in this step's colour; a milestone blinks three times.
    const colour = colours[b.step % colours.length]!;
    const blink = still || !b.strong ? 1 : Math.abs(Math.cos(Math.PI * 3 * p));
    const level = (b.strong ? 1 : 0.8) * fade * blink;
    ctx.globalAlpha = 0.55 * level;
    ctx.strokeStyle = colour;
    ctx.lineWidth = b.strong ? 4 : 3;
    ctx.strokeRect(clip.x + 1.5, clip.y + 1.5, clip.w - 3, clip.h - 3);
    litColour.fill(colour);
    litLevel.fill(level);
  }
  const previous = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < bulbs.length; i++) {
    const level = litLevel[i]!;
    if (level <= 0.02) continue;
    const bulb = bulbs[i]!;
    drawGlow(ctx, litColour[i]!, bulb.x, bulb.y, bulb.corner ? 17 : 11, level * 0.8);
  }
  ctx.globalCompositeOperation = previous;
  for (let i = 0; i < bulbs.length; i++) {
    const level = litLevel[i]!;
    if (level <= 0.02) continue;
    const bulb = bulbs[i]!;
    const s = bulb.corner ? 6 : 4;
    ctx.globalAlpha = Math.min(1, level * 1.1);
    ctx.fillStyle = litColour[i]!;
    ctx.fillRect(Math.round(bulb.x - s / 2), Math.round(bulb.y - s / 2), s, s);
  }
}
const litColour: string[] = [];
const litLevel: number[] = [];

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

/**
 * A soft round glow from the shared cached sprite (no shadowBlur), for
 * renderers' own light touches. Sets globalAlpha; callers save/restore.
 */
export function drawFxGlow(
  ctx: CanvasRenderingContext2D,
  colour: string,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  drawGlow(ctx, colour, x, y, radius, alpha);
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
  if (m.lights.length) m.lights = m.lights.filter((l) => now - l.born < ARCADE_FX_LIGHTS_MS);
  const flashAge = now - m.flashAt;
  const edgeAge = now - m.edgeAt;
  const neonAge = now - m.neonAt;
  const sweepAge = now - m.sweepAt;
  const arenaAge = now - m.arenaAt;
  const bulbsAge = now - m.bulbsAt;
  if (
    !m.particles.length && !m.pops.length && !m.rings.length && !m.lights.length && flashAge > 260 && edgeAge > 600 &&
    neonAge > ARCADE_FX_NEON_MS && sweepAge > ARCADE_FX_SWEEP_MS &&
    arenaAge > m.arenaMs && bulbsAge > m.bulbsMs
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
  // Arena glow: a slight pulsing glow inside the arena's edges while a success
  // text is up, alternating its colours; under reduced motion it holds steady.
  if (arenaAge >= 0 && arenaAge < m.arenaMs && m.arenaColours.length) {
    const p = arenaAge / m.arenaMs;
    const fade = p < 0.1 ? p / 0.1 : p > 0.7 ? (1 - p) / 0.3 : 1;
    const pulse = still ? 0.6 : 0.55 + 0.45 * Math.sin(arenaAge / 110);
    const colour = still ? m.arenaColours[0]! : m.arenaColours[Math.floor(arenaAge / 220) % m.arenaColours.length]!;
    ctx.strokeStyle = colour;
    for (const [inset, width, alpha] of [[7, 14, 0.07], [4, 8, 0.12], [1.5, 3, 0.3]] as const) {
      ctx.globalAlpha = alpha * pulse * fade;
      ctx.lineWidth = width;
      ctx.strokeRect(clip.x + inset, clip.y + inset, clip.w - inset * 2, clip.h - inset * 2);
    }
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

  paintBulbs(ctx, m, clip, now, still);

  const previous = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  for (const r of m.rings) {
    const p = (now - r.born) / r.life;
    drawGlow(ctx, r.colour, r.x, r.y, r.radius * (still ? 0.8 : 0.5 + p * 0.7), 0.55 * (1 - p));
  }
  for (const l of m.lights) {
    const p = (now - l.born) / ARCADE_FX_LIGHTS_MS;
    if (p < 0) continue;
    // Ease out: the lights fly fast, then hang and fade.
    const e = 1 - (1 - p) * (1 - p);
    const alpha = (p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85) * 0.85;
    const x = l.x + l.dx * e;
    const y = l.y + l.dy * e;
    drawGlow(ctx, l.colour, x, y, l.radius * (1 + p * 0.5), alpha);
    drawGlow(ctx, "#FFFFFF", x, y, l.radius * 0.35, alpha * 0.7);
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
    ctx.strokeStyle = pop.outline;
    // Keep the whole text inside the arena, wherever the event happened (an edge or the top).
    const half = ctx.measureText(pop.text).width / 2 + ctx.lineWidth;
    const x = Math.min(Math.max(pop.x, clip.x + half), clip.x + clip.w - half);
    const y = Math.min(Math.max(pop.y - rise, clip.y + size / 2 + ctx.lineWidth), clip.y + clip.h - size / 2 - ctx.lineWidth);
    ctx.strokeText(pop.text, x, y);
    ctx.fillStyle = pop.colour;
    ctx.fillText(pop.text, x, y);
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
): { particles: number; pops: number; rings: number; lights: number; shaking: boolean; bulbs?: string } {
  const m = memories.get(ctx)?.get(game);
  if (!m) return { particles: 0, pops: 0, rings: 0, lights: 0, shaking: false };
  const now = clock();
  const bulbs = m.bulbs && now - m.bulbsAt >= 0 && now - m.bulbsAt < m.bulbsMs ? m.bulbs.pattern : undefined;
  return {
    ...(bulbs ? { bulbs } : {}),
    lights: m.lights.filter((l) => now - l.born < ARCADE_FX_LIGHTS_MS).length,
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
