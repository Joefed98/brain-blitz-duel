/**
 * Pipeline's effects (the Pattern overhaul stage 2, 15 Nov 2026; docs/design/game-fx/README.md). Presentation only:
 * these observe the board the stage already decided (which tiles turned, which pipes the water reaches) and animate the
 * pipes' own art layers (pointer-events none, inside each tile's box). Nothing here reads or writes a turn, the answer,
 * the clock or the grade, and nothing waits on an animation: the next turn is taken at once.
 *
 * Transform and opacity only (Web Animations). The variant comes from the effects kit (`gameFxVariant`): reduced motion
 * is a 120 ms crossfade to the new state (no movement, no bubbles), lite is shorter, the rest as designed.
 *
 *  - The turn (`pipeTurnFx`): a metallic ratchet, the new turn's sprite swinging in from where the tile was in two
 *    clicks with a small overshoot (190 ms), either way round.
 *  - Water in (`planWaterIn`, `runWater`): water runs into each newly joined pipe along the path, in order from the
 *    source: a wipe from the side it enters by, about 200 ms a pipe, every pipe full within 900 ms.
 *  - Draining (`planDrain`): a turn that cuts pipes off empties them back, the furthest first, each towards the side
 *    its water came from.
 *  - The solve's bubbles (`sourceBubbles`): a few bubbles well up out of the source valve.
 */
import { gameFx, gameFxVariant, type GameFxVariant } from "@/lib/fx/kit";

/** Water reaching a pipe: the wipe's length, and the most the whole run may take (Joe's spec). */
export const PIPE_FLOW_TILE_MS = 200;
export const PIPE_FLOW_TOTAL_MS = 900;
/** Draining: each pipe's wipe and the step between pipes (faster than filling). */
export const PIPE_DRAIN_TILE_MS = 170;
export const PIPE_DRAIN_STEP_MS = 110;
/** The ratchet turn's length. */
export const PIPE_TURN_MS = 190;

/** The variant every Pipeline effect plays in (the kit's rule: reduced motion first). */
export function pipeFxVariant(): GameFxVariant {
  return gameFxVariant("slide");
}

const running = new WeakMap<Element, Animation[]>();
function play(el: Element, frames: Keyframe[], options: KeyframeAnimationOptions): Animation | undefined {
  const node = el as HTMLElement;
  if (typeof node.animate !== "function") return undefined;
  try {
    const animation = node.animate(frames, options);
    running.set(el, [...(running.get(el) ?? []), animation]);
    animation.addEventListener?.("finish", () => running.set(el, (running.get(el) ?? []).filter((a) => a !== animation)));
    return animation;
  } catch {
    return undefined;
  }
}
/** Stops any Pipeline effect running on an element (a new one replaces it). */
function stop(el: Element): void {
  for (const animation of running.get(el) ?? []) animation.cancel();
  running.delete(el);
}

/** The turn: a two-click ratchet from where the tile was (dir 1 clockwise, -1 anticlockwise). */
export function pipeTurnFx(el: Element | null, dir: 1 | -1): Animation | undefined {
  if (!el) return undefined;
  const variant = pipeFxVariant();
  if (variant === "reduced") {
    stop(el);
    // The kit's crossfade (silent: the stage plays pipes.rotate).
    return gameFx("tap", el, { silent: true });
  }
  stop(el);
  const from = -90 * dir;
  const ms = variant === "lite" ? 140 : PIPE_TURN_MS;
  return play(
    el,
    [
      { transform: `rotate(${from}deg)`, easing: "cubic-bezier(.4,0,.6,1)" },
      // First click: half way, a hair's catch on the pawl.
      { transform: `rotate(${from * 0.52}deg)`, offset: 0.36, easing: "linear" },
      { transform: `rotate(${from * 0.48}deg)`, offset: 0.5, easing: "cubic-bezier(.3,.9,.4,1)" },
      // Second click: home, a small overshoot and back.
      { transform: `rotate(${dir * 4}deg)`, offset: 0.84, easing: "ease-out" },
      { transform: "rotate(0deg)" },
    ],
    { duration: ms },
  );
}

/** One pipe's water change: the cell, the side the water enters by (dx, dy into the tile), and its start. */
export interface WaterStep {
  cell: number;
  /** The direction the water travels across the tile (unit, x right, y down); 0, 0 for a plain fade. */
  dx: number;
  dy: number;
  delay: number;
}

/**
 * New water: the pipes that just joined, in order from the source (by depth), each starting a step after the depth
 * before it, a step of at most 200 ms and every pipe full within 900 ms.
 */
export function planWaterIn(cells: { cell: number; depth: number; dx: number; dy: number }[]): WaterStep[] {
  if (!cells.length) return [];
  const depths = [...new Set(cells.map((c) => c.depth))].sort((a, b) => a - b);
  const span = depths.length - 1;
  const step = span > 0 ? Math.min(PIPE_FLOW_TILE_MS, (PIPE_FLOW_TOTAL_MS - PIPE_FLOW_TILE_MS) / span) : 0;
  return cells
    .map((c) => ({ cell: c.cell, dx: c.dx, dy: c.dy, delay: Math.round(depths.indexOf(c.depth) * step) }))
    .sort((a, b) => a.delay - b.delay || a.cell - b.cell);
}

/** Drained pipes: the furthest from the source first, each a step after the one beyond it, within 900 ms. */
export function planDrain(cells: { cell: number; depth: number; dx: number; dy: number }[]): WaterStep[] {
  if (!cells.length) return [];
  const depths = [...new Set(cells.map((c) => c.depth))].sort((a, b) => b - a);
  const span = depths.length - 1;
  const step = span > 0 ? Math.min(PIPE_DRAIN_STEP_MS, (PIPE_FLOW_TOTAL_MS - PIPE_DRAIN_TILE_MS) / span) : 0;
  return cells
    .map((c) => ({ cell: c.cell, dx: c.dx, dy: c.dy, delay: Math.round(depths.indexOf(c.depth) * step) }))
    .sort((a, b) => a.delay - b.delay || a.cell - b.cell);
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const shift = (dx: number, dy: number) => `translate(${pct(dx)}, ${pct(dy)})`;

/**
 * Plays one pipe's water change on its wet layer: `outer` is the clipping box (`.pipe-wet`), `inner` its content
 * (`.pipe-wet-in`). Filling, the box slides in from the side the water enters by while its content holds still, so the
 * water front runs across the pipe; draining runs it back out the same side. Only the wet layer moves.
 */
export function runWater(outer: Element | null, inner: Element | null, step: WaterStep, fill: boolean): void {
  if (!outer || !inner) return;
  stop(outer);
  stop(inner);
  const variant = pipeFxVariant();
  const { dx, dy } = step;
  if (variant === "reduced" || (dx === 0 && dy === 0)) {
    // The state change as a 120 ms crossfade (reduced motion), or a pipe with no side to enter by.
    play(outer, fill ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], {
      duration: 120,
      delay: variant === "reduced" ? 0 : step.delay,
      fill: "backwards",
      easing: "linear",
    });
    return;
  }
  const lite = variant === "lite";
  const ms = fill ? (lite ? 140 : PIPE_FLOW_TILE_MS) : lite ? 120 : PIPE_DRAIN_TILE_MS;
  const delay = lite ? Math.round(step.delay * 0.7) : step.delay;
  // Filling: from behind the entry side to in place. Draining: from in place back behind the entry side.
  const away = shift(-dx, -dy);
  const back = shift(dx, dy);
  const outerFrames = fill
    ? [{ transform: away, opacity: 1 }, { transform: "translate(0, 0)", opacity: 1 }]
    : [{ transform: "translate(0, 0)", opacity: 1 }, { transform: away, opacity: 1 }];
  const innerFrames = fill
    ? [{ transform: back }, { transform: "translate(0, 0)" }]
    : [{ transform: "translate(0, 0)" }, { transform: back }];
  const options: KeyframeAnimationOptions = { duration: ms, delay, fill: "backwards", easing: fill ? "cubic-bezier(.35,.1,.55,1)" : "cubic-bezier(.45,0,.75,.6)" };
  play(outer, outerFrames, options);
  play(inner, innerFrames, options);
}

/** The solve: three or four bubbles well up out of the source valve and pop (none under reduced motion). */
export function sourceBubbles(host: Element | null): void {
  if (!host || typeof document === "undefined") return;
  const variant = pipeFxVariant();
  if (variant === "reduced") return;
  const count = variant === "lite" ? 2 : 4;
  for (let i = 0; i < count; i++) {
    const bubble = document.createElement("span");
    bubble.className = "pipe-bubble";
    bubble.setAttribute("aria-hidden", "true");
    const x = [-14, 9, -3, 15][i]!;
    const size = [0.2, 0.15, 0.24, 0.13][i]!;
    bubble.style.setProperty("--bubble-x", `${50 + x}%`);
    bubble.style.setProperty("--bubble-size", `${Math.round(size * 100)}%`);
    host.appendChild(bubble);
    const animation = play(
      bubble,
      [
        { transform: "translate(-50%, 0) scale(0.3)", opacity: 0 },
        { transform: "translate(-50%, -40%) scale(1)", opacity: 1, offset: 0.25 },
        { transform: "translate(-50%, -150%) scale(1.05)", opacity: 0.9, offset: 0.8 },
        { transform: "translate(-50%, -180%) scale(1.35)", opacity: 0 },
      ],
      { duration: variant === "lite" ? 520 : 760, delay: i * 130, fill: "backwards", easing: "ease-out" },
    );
    const remove = () => bubble.remove();
    if (animation) animation.addEventListener?.("finish", remove);
    else remove();
    setTimeout(remove, 1500);
  }
}
