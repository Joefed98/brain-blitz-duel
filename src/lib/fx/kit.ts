/**
 * The game effects kit (phase 2 step 4, 15 Nov 2026; presentation only: nothing here reads or writes a sim, a
 * timer, an answer, a grade or a score). docs/design/game-fx/README.md is the guide; the showcase is /dev-design's
 * Effects section; fx-check proves the rules below.
 *
 * One call for every moment a game has in common:
 *
 *   gameFx("drop", element)                     a piece lands
 *   gameFx("combo", element, { count: 4 })      the fourth in a row (bigger, higher each step)
 *   gameFx("slide", element, { from: { x: -40, y: 0 } })   moved from 40 px to the left (FLIP)
 *   gameFx("win", element)                      the round-end payoff
 *
 * Each kind has (GAME_FX):
 *  - a visual: Web Animations keyframes on the element itself, transform and opacity only (never a layout
 *    property: the GPU composites them, nothing reflows), plus, for some kinds, a few particles drawn in one
 *    fixed layer (spans with transform and opacity, pointer-events none, at most KIT_PARTICLE_LIMIT alive);
 *  - a sound: a shared slot of the manifest played through playSound, so the player's effects volume, mute,
 *    the demo hush and the replay quiet all hold (escalating kinds raise the rate a step a count);
 *  - haptics where it is a main moment (a wrong move, a near miss, the payoff), through lib/haptics.ts's one
 *    adapter and its gates; never on taps, drags or routine moves.
 *
 * Variants, the first that applies (every one still shows the state change; only the flourish goes):
 *  - "reduced": prefers-reduced-motion. A 120 ms crossfade to the final state (opacity only, no movement,
 *    no particles). Sound and haptics stay.
 *  - "lite": reduced effects (a slow phone, lib/fx/lowEnd.ts) or the battery saver. The same movement,
 *    smaller and shorter, a third of the particles.
 *  - "calm": the celebrations switch off (FX_CELEBRATIONS), payoff kinds only (combo, win, new best, stars,
 *    count-up): the lite movement with no particles and only the plain sound.
 *  - "full".
 */
import { haptic, type HapticPattern } from "@/lib/haptics";
import { batterySaverOn } from "@/lib/battery";
import { prefersReducedMotion } from "@/lib/motion";
import { demoHushed, playSound } from "@/lib/sound";
import type { SoundId } from "./manifest";
import { celebrationsOn } from "./celebrations";
import { arcadeReducedEffects } from "./lowEnd";

export type GameFxKind =
  | "tap"
  | "pickUp"
  | "drop"
  | "slide"
  | "pour"
  | "match"
  | "wrong"
  | "combo"
  | "countUp"
  | "nearMiss"
  | "win"
  | "newBest"
  | "stars";

export type GameFxVariant = "full" | "lite" | "reduced" | "calm";

/** Keyframes as the kit writes them: only these properties may appear (fx-check). */
export type KitKeyframe = { transform?: string; opacity?: number; offset?: number; easing?: string };

export interface GameFxSpec {
  /** One line for the README and the showcase. */
  what: string;
  /** Keyframes and length for each variant ("calm" uses "lite"'s). */
  frames: { full: KitKeyframe[]; lite: KitKeyframe[]; reduced: KitKeyframe[] };
  ms: { full: number; lite: number; reduced: number };
  easing: string;
  /** The end state is kept (a picked-up piece stays lifted until it drops). */
  hold?: boolean;
  /** Particles from the element's centre (full; lite takes a third, reduced and calm none). */
  particles: number;
  /** A payoff kind: the celebrations switch turns it calm. */
  payoff: boolean;
  /** A shared manifest slot, its volume, and (escalating kinds) the rate step a count. */
  sound: { slot: SoundId; volume: number; rateStep?: number } | null;
  /** A main moment only (haptics rule: never taps, drags or routine moves). */
  haptic: HapticPattern | null;
}

/** The reduced-motion crossfade every kind ends with (style guide: "reduce motion 120 ms crossfade"). */
const FADE: KitKeyframe[] = [{ opacity: 0.55 }, { opacity: 1 }];
const REDUCED_MS = 120;

const s = (x: number, y = x) => (x === y ? `scale(${x})` : `scale(${x}, ${y})`);

export const GAME_FX: Readonly<Record<GameFxKind, GameFxSpec>> = {
  tap: {
    what: "A press that registered: the piece sinks a touch and springs back.",
    frames: { full: [{ transform: s(1) }, { transform: s(0.94), offset: 0.4 }, { transform: s(1) }], lite: [{ transform: s(1) }, { transform: s(0.97) }, { transform: s(1) }], reduced: FADE },
    ms: { full: 160, lite: 110, reduced: REDUCED_MS },
    easing: "ease-out",
    particles: 0,
    payoff: false,
    sound: { slot: "tick", volume: 0.45 },
    haptic: null,
  },
  pickUp: {
    what: "A piece lifted to move: it rises and grows slightly, and stays up until it drops.",
    frames: {
      full: [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-8px) scale(1.07)" }],
      lite: [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-4px) scale(1.04)" }],
      reduced: [{ opacity: 0.7 }, { opacity: 0.85 }],
    },
    ms: { full: 120, lite: 90, reduced: REDUCED_MS },
    easing: "ease-out",
    hold: true,
    particles: 0,
    payoff: false,
    sound: { slot: "move", volume: 0.5 },
    haptic: null,
  },
  drop: {
    what: "A piece placed: it comes down with a small squash and settles.",
    frames: {
      full: [{ transform: "translateY(-8px) scale(1.07)" }, { transform: "translateY(0) scale(1.06, 0.94)", offset: 0.55 }, { transform: "translateY(0) scale(1)" }],
      lite: [{ transform: "translateY(-4px) scale(1.04)" }, { transform: "translateY(0) scale(1)" }],
      reduced: FADE,
    },
    ms: { full: 220, lite: 140, reduced: REDUCED_MS },
    easing: "cubic-bezier(.2,.9,.25,1)",
    particles: 0,
    payoff: false,
    sound: { slot: "place", volume: 0.7 },
    haptic: null,
  },
  slide: {
    what: "A piece moved to its new place: drawn from where it was (pass `from`, FLIP), so the layout changes at once.",
    frames: {
      full: [{ transform: "translate(var(--fx-from-x), var(--fx-from-y))" }, { transform: "translate(0, 0)" }],
      lite: [{ transform: "translate(var(--fx-from-x), var(--fx-from-y))" }, { transform: "translate(0, 0)" }],
      reduced: FADE,
    },
    ms: { full: 180, lite: 120, reduced: REDUCED_MS },
    easing: "cubic-bezier(.2,.9,.25,1)",
    particles: 0,
    payoff: false,
    sound: { slot: "move", volume: 0.45 },
    haptic: null,
  },
  pour: {
    what: "Something poured or flowing: the source tilts over, holds while it pours, and comes back.",
    frames: {
      full: [{ transform: "rotate(0deg)" }, { transform: "rotate(var(--fx-tilt))", offset: 0.25 }, { transform: "rotate(var(--fx-tilt))", offset: 0.75 }, { transform: "rotate(0deg)" }],
      lite: [{ transform: "rotate(0deg)" }, { transform: "rotate(calc(var(--fx-tilt) / 2))", offset: 0.4 }, { transform: "rotate(0deg)" }],
      reduced: FADE,
    },
    ms: { full: 760, lite: 420, reduced: REDUCED_MS },
    easing: "ease-in-out",
    particles: 0,
    payoff: false,
    sound: { slot: "move", volume: 0.5, rateStep: 0 },
    haptic: null,
  },
  match: {
    what: "Pieces matched or cleared: a quick swell, then they fade out with a few sparks.",
    frames: {
      full: [{ transform: s(1), opacity: 1 }, { transform: s(1.14), opacity: 1, offset: 0.35 }, { transform: s(0.6), opacity: 0 }],
      lite: [{ transform: s(1), opacity: 1 }, { transform: s(0.85), opacity: 0 }],
      reduced: [{ opacity: 1 }, { opacity: 0 }],
    },
    ms: { full: 280, lite: 180, reduced: REDUCED_MS },
    easing: "ease-out",
    hold: true,
    particles: 8,
    payoff: false,
    sound: { slot: "correct", volume: 0.6 },
    haptic: null,
  },
  wrong: {
    what: "A move refused: a short shake and a muted tone. Reduced motion: a dim flicker, no shake.",
    frames: {
      full: [0, -6, 5, -4, 3, 0].map((x) => ({ transform: `translateX(${x}px)` })),
      lite: [0, -3, 3, 0].map((x) => ({ transform: `translateX(${x}px)` })),
      reduced: [{ opacity: 0.45 }, { opacity: 1 }],
    },
    ms: { full: 260, lite: 160, reduced: 160 },
    easing: "ease-out",
    particles: 0,
    payoff: false,
    sound: { slot: "wrong", volume: 0.45 },
    haptic: "error",
  },
  combo: {
    what: "A streak: a pop that grows with the count (to the eighth), the tone a step higher each time.",
    frames: {
      full: [{ transform: s(1) }, { transform: "scale(var(--fx-pop))", offset: 0.4 }, { transform: s(1) }],
      lite: [{ transform: s(1) }, { transform: s(1.06) }, { transform: s(1) }],
      reduced: FADE,
    },
    ms: { full: 260, lite: 160, reduced: REDUCED_MS },
    easing: "cubic-bezier(.2,.9,.25,1)",
    particles: 6,
    payoff: true,
    sound: { slot: "combo", volume: 0.6, rateStep: 0.06 },
    haptic: null,
  },
  countUp: {
    what: "A score counting up (countUpText or <FxCountUp>): ticks as it climbs, a pop when it lands.",
    frames: {
      full: [{ transform: s(1) }, { transform: s(1.12), offset: 0.4 }, { transform: s(1) }],
      lite: [{ transform: s(1) }, { transform: s(1.05) }, { transform: s(1) }],
      reduced: FADE,
    },
    ms: { full: 240, lite: 160, reduced: REDUCED_MS },
    easing: "ease-out",
    particles: 0,
    payoff: true,
    sound: { slot: "reveal_score", volume: 0.6 },
    haptic: null,
  },
  nearMiss: {
    what: "So close: two soft pulses on the thing just missed, and a light tick.",
    frames: {
      full: [{ transform: s(1), opacity: 1 }, { transform: s(1.06), opacity: 0.75, offset: 0.25 }, { transform: s(1), opacity: 1, offset: 0.5 }, { transform: s(1.04), opacity: 0.8, offset: 0.75 }, { transform: s(1), opacity: 1 }],
      lite: [{ opacity: 1 }, { opacity: 0.7 }, { opacity: 1 }],
      reduced: [{ opacity: 0.6 }, { opacity: 1 }],
    },
    ms: { full: 420, lite: 260, reduced: 160 },
    easing: "ease-in-out",
    particles: 0,
    payoff: false,
    sound: { slot: "tick", volume: 0.6, rateStep: 0 },
    haptic: "tick",
  },
  win: {
    what: "The round-end payoff: the result scales in (0.9 to 1) and fades up, with a gold burst.",
    frames: {
      full: [{ transform: s(0.9), opacity: 0.4 }, { transform: s(1.02), opacity: 1, offset: 0.6 }, { transform: s(1), opacity: 1 }],
      lite: [{ transform: s(0.96), opacity: 0.6 }, { transform: s(1), opacity: 1 }],
      reduced: FADE,
    },
    ms: { full: 900, lite: 360, reduced: REDUCED_MS },
    easing: "cubic-bezier(.2,.9,.25,1)",
    particles: 18,
    payoff: true,
    sound: { slot: "complete", volume: 0.8 },
    haptic: "success",
  },
  newBest: {
    what: "A new best: the badge drops 16 px and lands with a squash (style guide \"reward land\").",
    frames: {
      full: [{ transform: "translateY(-16px) scale(1)", opacity: 0 }, { transform: "translateY(0) scale(1.08, 0.92)", opacity: 1, offset: 0.6 }, { transform: "translateY(0) scale(1)", opacity: 1 }],
      lite: [{ transform: "translateY(-6px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }],
      reduced: [{ opacity: 0 }, { opacity: 1 }],
    },
    ms: { full: 420, lite: 220, reduced: REDUCED_MS },
    easing: "cubic-bezier(.2,.9,.25,1)",
    particles: 10,
    payoff: true,
    sound: { slot: "shared.momentcard", volume: 0.8 },
    haptic: "celebrate",
  },
  stars: {
    what: "Stars landing one by one where they are counted (call once a star, count = its number).",
    frames: {
      full: [{ transform: "translateY(-16px) scale(0.6)", opacity: 0 }, { transform: "translateY(0) scale(1.08)", opacity: 1, offset: 0.6 }, { transform: "translateY(0) scale(1)", opacity: 1 }],
      lite: [{ transform: s(0.8), opacity: 0 }, { transform: s(1), opacity: 1 }],
      reduced: [{ opacity: 0 }, { opacity: 1 }],
    },
    ms: { full: 420, lite: 200, reduced: REDUCED_MS },
    easing: "cubic-bezier(.2,.9,.25,1)",
    particles: 5,
    payoff: true,
    sound: { slot: "stage_complete", volume: 0.6, rateStep: 0.08 },
    haptic: null,
  },
};

export const GAME_FX_KINDS = Object.keys(GAME_FX) as GameFxKind[];

/** At most this many kit particles alive at once (the shared budget, lib/fx/limits.ts). */
export const KIT_PARTICLE_LIMIT = 32;
/** The escalation stops growing here (a combo of 20 looks like a combo of 8). */
export const COMBO_CAP = 8;

let forced: GameFxVariant | null = null;
/** The showcase (/dev-design's Effects) and checks: play every kind in one variant; null is the device's own. */
export function forceGameFxVariant(variant: GameFxVariant | null): void {
  forced = variant;
}

/** The variant a kind plays in right now. */
export function gameFxVariant(kind: GameFxKind): GameFxVariant {
  if (forced) return forced === "calm" && !GAME_FX[kind].payoff ? "full" : forced;
  if (prefersReducedMotion()) return "reduced";
  if (GAME_FX[kind].payoff && !celebrationsOn()) return "calm";
  if (arcadeReducedEffects() || batterySaverOn()) return "lite";
  return "full";
}

export interface GameFxOptions {
  /** Combo, stars: the count (escalation). */
  count?: number;
  /** Slide: where the element was, relative to where it is now (px). */
  from?: { x: number; y: number };
  /** Pour: the tilt in degrees (default -35, towards the left). */
  tilt?: number;
  /** In a live round (haptics only with a live board on screen; lib/haptics.ts). Default true. */
  inGame?: boolean;
  /** Leave the sound out (the game already played its own). */
  silent?: boolean;
  /** Leave the haptic out (the screen already has its own moment, e.g. the final screen's celebrate). */
  noHaptic?: boolean;
  /** Start after this many ms (stars landing in turn). */
  delayMs?: number;
}

export interface GameFxRecord {
  kind: GameFxKind;
  variant: GameFxVariant;
  frames: KitKeyframe[];
  ms: number;
  sound: { slot: SoundId; volume: number; rate: number } | null;
  haptic: HapticPattern | null;
  particles: number;
}

let sink: ((record: GameFxRecord) => void) | null = null;
/** Checks: record every call (and its variant, sound, haptic and particles) instead of only playing it. */
export function setGameFxSink(next: ((record: GameFxRecord) => void) | null): void {
  sink = next;
}

const clampCount = (count: number | undefined) => Math.max(1, Math.min(COMBO_CAP, Math.floor(count ?? 1)));

/** What a call would do, worked out without touching the page (gameFx plays it; the checks read it). */
export function planGameFx(kind: GameFxKind, options: GameFxOptions = {}): GameFxRecord {
  const spec = GAME_FX[kind];
  const variant = gameFxVariant(kind);
  const key = variant === "calm" ? "lite" : variant;
  const n = clampCount(options.count);
  const particles = variant === "full" ? spec.particles + (kind === "combo" ? n : 0) : variant === "lite" ? Math.ceil(spec.particles / 3) : 0;
  const sound = spec.sound && !options.silent ? { slot: spec.sound.slot, volume: spec.sound.volume, rate: 1 + (spec.sound.rateStep ?? 0) * (n - 1) } : null;
  // Concrete values for the per-call placeholders (written out, not CSS variables: every engine animates them).
  const tilt = options.tilt ?? -35;
  const fill = (v: string) =>
    v
      .replace("var(--fx-from-x)", `${options.from?.x ?? 0}px`)
      .replace("var(--fx-from-y)", `${options.from?.y ?? 0}px`)
      .replace("calc(var(--fx-tilt) / 2)", `${tilt / 2}deg`)
      .replace("var(--fx-tilt)", `${tilt}deg`)
      .replace("scale(var(--fx-pop))", `scale(${(1 + 0.04 * n).toFixed(2)})`);
  const frames = spec.frames[key].map((f) => (f.transform ? { ...f, transform: fill(f.transform) } : f));
  return { kind, variant, frames, ms: spec.ms[key], sound, haptic: options.noHaptic ? null : spec.haptic, particles };
}

const running = new WeakMap<Element, Animation>();

/**
 * Plays one effect on an element (or with no element, only its sound and haptics). Returns the animation, so a
 * caller can await `.finished`; never throws. A new effect on the same element replaces the one running there.
 */
export function gameFx(kind: GameFxKind, target: Element | null | undefined, options: GameFxOptions = {}): Animation | undefined {
  if (typeof window === "undefined") return undefined;
  const plan = planGameFx(kind, options);
  if (sink) sink(plan);
  if (demoHushed()) return undefined;
  if (plan.sound) playSound(plan.sound.slot, plan.sound.volume, plan.sound.rate);
  if (plan.haptic) haptic(plan.haptic, { inGame: options.inGame ?? true });
  if (!target || typeof (target as HTMLElement).animate !== "function") return undefined;
  const el = target as HTMLElement;
  running.get(el)?.cancel();
  let animation: Animation | undefined;
  try {
    animation = el.animate(plan.frames as Keyframe[], {
      duration: plan.ms,
      delay: options.delayMs ?? 0,
      easing: GAME_FX[kind].easing,
      fill: GAME_FX[kind].hold ? "forwards" : "backwards",
    });
  } catch {
    return undefined;
  }
  // A replaced effect is cancelled (above), which rejects its `finished`; nobody need await it, so the rejection is
  // handled here (browsers already treat it as handled; happy-dom reported it as unhandled in the checks).
  animation.finished.catch(() => {});
  running.set(el, animation);
  if (plan.particles > 0) {
    const fire = () => sparks(el, plan.particles, kind === "wrong" ? "loss" : "gold");
    if (options.delayMs) window.setTimeout(fire, options.delayMs);
    else fire();
  }
  return animation;
}

/** Puts a held effect (pickUp, match) back to the element's own look. */
export function releaseGameFx(target: Element | null | undefined): void {
  if (!target) return;
  running.get(target)?.cancel();
  running.delete(target);
}

/* ------------------------------------------------------------------ particles */

let layer: HTMLDivElement | null = null;
let alive = 0;

function particleLayer(): HTMLDivElement {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement("div");
  layer.setAttribute("data-fx-kit-layer", "");
  layer.setAttribute("aria-hidden", "true");
  layer.className = "fx-kit-layer";
  document.body.appendChild(layer);
  return layer;
}

/** A few sparks from an element's centre: transform and opacity only, removed when done. */
function sparks(el: Element, count: number, tone: "gold" | "loss"): void {
  const room = KIT_PARTICLE_LIMIT - alive;
  if (room <= 0) return;
  const box = el.getBoundingClientRect();
  const host = particleLayer();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const reach = Math.max(28, Math.min(90, Math.max(box.width, box.height) * 0.7));
  const n = Math.min(room, count);
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    p.className = "fx-kit-spark";
    p.dataset["tone"] = tone;
    // An even spread with a fixed twist: the same call draws the same sparks.
    const angle = (i / n) * Math.PI * 2 + 0.4;
    const r = reach * (0.7 + 0.3 * ((i * 7) % 5) / 4);
    host.appendChild(p);
    alive += 1;
    const anim = p.animate(
      [
        { transform: `translate(${cx}px, ${cy}px) scale(1)`, opacity: 1 },
        { transform: `translate(${cx + Math.cos(angle) * r}px, ${cy + Math.sin(angle) * r}px) scale(0.4)`, opacity: 0 },
      ],
      { duration: 520, easing: "cubic-bezier(.2,.9,.25,1)" },
    );
    const done = () => {
      if (!p.isConnected) return;
      p.remove();
      alive = Math.max(0, alive - 1);
    };
    anim.onfinish = done;
    window.setTimeout(done, 700);
  }
}

/* ------------------------------------------------------------------ count-up */

/** The count-up's length (style guide "count up": 600 ms, ease-out). */
export const KIT_COUNT_UP_MS = 600;

/**
 * Counts an element's text from `from` to `to` (textContent only: no layout animation), ticking as it climbs and
 * landing with the countUp pop. Reduced motion writes the final number at once. Returns a stop function.
 */
export function countUpText(el: HTMLElement, from: number, to: number, options: { ms?: number; silent?: boolean; format?: (n: number) => string } = {}): () => void {
  const format = options.format ?? ((n: number) => String(n));
  const variant = gameFxVariant("countUp");
  if (variant === "reduced" || from === to || typeof requestAnimationFrame !== "function") {
    el.textContent = format(to);
    if (from !== to) gameFx("countUp", el, { silent: options.silent === true, inGame: false });
    return () => {};
  }
  const ms = variant === "full" ? (options.ms ?? KIT_COUNT_UP_MS) : Math.min(options.ms ?? KIT_COUNT_UP_MS, 360);
  const start = performance.now();
  let frame = 0;
  let lastTick = -Infinity;
  let shown = from;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    const value = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
    if (value !== shown) {
      shown = value;
      el.textContent = format(value);
      // Ticks at most 12 a second, on the effects channel at a low level.
      if (!options.silent && t < 1 && now - lastTick > 83 && !demoHushed()) {
        lastTick = now;
        playSound("tick", 0.25, 1 + 0.4 * t);
      }
    }
    if (t < 1) frame = requestAnimationFrame(step);
    else gameFx("countUp", el, { silent: options.silent === true, inGame: false });
  };
  el.textContent = format(from);
  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    el.textContent = format(to);
  };
}
