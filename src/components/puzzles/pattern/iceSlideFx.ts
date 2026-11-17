/**
 * Skid's effects (the Pattern overhaul stage 2, 15 Nov 2026; docs/design/game-fx/README.md). Presentation only: each
 * observes what the stage already decided (where the ball came to rest, a slide that went nowhere, ice that broke, a
 * portal passed, a fall, one slide from the exit) and animates that piece's own art layer (pointer-events none, inside
 * its cell). Nothing here reads or writes a slide, the answer, the clock or the grade, and nothing waits on an
 * animation: the next slide is taken as soon as the ball has stopped, whatever is still playing.
 *
 * Transform and opacity only (Web Animations), through the effects kit where it has the moment (the stop's settle is
 * the kit's drop, the near exit its nearMiss) and in the kit's variant otherwise: reduced motion is a 120 ms crossfade
 * to the new state (no movement), lite shorter and smaller, the rest as designed. Sounds are Skid's own slots (fired by
 * the stage), so every kit call here is silent.
 */
import { gameFx, gameFxVariant, type GameFxVariant } from "@/lib/fx/kit";
import type { SlideDir } from "@/lib/duel/types";

/** The variant every Skid effect plays in (the kit's rule: reduced motion first). */
export function iceFxVariant(): GameFxVariant {
  return gameFxVariant("slide");
}

/** The longest any Skid effect runs (the kit's rule: at most 900 ms a physical action). */
export const ICE_FX_MAX_MS = 450;
/** The bump's nudge toward the wall, in px (Joe: 2–3 px). */
export const ICE_BUMP_PX = { full: 3, lite: 2 } as const;

const REDUCED: Keyframe[] = [{ opacity: 0.55 }, { opacity: 1 }];
const REDUCED_MS = 120;

const running = new WeakMap<Element, Animation>();
function play(el: Element | null | undefined, frames: Keyframe[], options: KeyframeAnimationOptions): Animation | undefined {
  const node = el as HTMLElement | null | undefined;
  if (!node || typeof node.animate !== "function") return undefined;
  running.get(node)?.cancel();
  try {
    const animation = node.animate(frames, options);
    running.set(node, animation);
    return animation;
  } catch {
    return undefined;
  }
}
const crossfade = (el: Element | null | undefined) => play(el, REDUCED, { duration: REDUCED_MS, easing: "linear" });

const NUDGE: Record<string, [number, number]> = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };

/** The ball came to rest against what stopped it: the kit's drop (a small squash as it settles). */
export function iceSettle(ballArt: Element | null | undefined): Animation | undefined {
  return gameFx("drop", ballArt, { silent: true });
}

/** A slide straight into a wall: a 2–3 px nudge toward it and back (the slide went nowhere). */
export function iceBump(ballArt: Element | null | undefined, dir: SlideDir): Animation | undefined {
  const variant = iceFxVariant();
  if (variant === "reduced") return crossfade(ballArt);
  const [dx, dy] = NUDGE[dir] ?? [0, 0];
  const px = variant === "full" ? ICE_BUMP_PX.full : ICE_BUMP_PX.lite;
  return play(
    ballArt,
    [
      { transform: "translate(0, 0)" },
      { transform: `translate(${dx * px}px, ${dy * px}px)`, offset: 0.35 },
      { transform: "translate(0, 0)" },
    ],
    { duration: variant === "full" ? 150 : 100, easing: "cubic-bezier(.3,.8,.4,1)" },
  );
}

/** Thin ice giving way: the hole opens out of the cracked sheet. */
export function iceCrack(brokenArt: Element | null | undefined): Animation | undefined {
  const variant = iceFxVariant();
  if (variant === "reduced") return crossfade(brokenArt);
  return play(
    brokenArt,
    [
      { transform: "scale(0.35) rotate(-6deg)", opacity: 0.4 },
      { transform: "scale(1.06) rotate(2deg)", opacity: 1, offset: 0.7 },
      { transform: "scale(1) rotate(0deg)", opacity: 1 },
    ],
    { duration: variant === "full" ? 260 : 160, easing: "cubic-bezier(.2,.9,.3,1)" },
  );
}

/** A portal passed: both ends flare (the ring swells, its coloured light blooms and fades). */
export function icePortalFlare(ring: Element | null | undefined, glow: Element | null | undefined): void {
  const variant = iceFxVariant();
  if (variant === "reduced") {
    crossfade(ring);
    return;
  }
  const ms = variant === "full" ? 450 : 260;
  play(ring, [{ transform: "scale(1)" }, { transform: `scale(${variant === "full" ? 1.16 : 1.08})`, offset: 0.3 }, { transform: "scale(1)" }], { duration: ms, easing: "ease-out" });
  play(glow, [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 0.9, transform: "scale(1.15)", offset: 0.3 }, { opacity: 0, transform: "scale(1.3)" }], { duration: ms, easing: "ease-out" });
}

/** A hole: the ball spins down into it and is gone (the span carries the cell's translate(-50%, -50%)). */
export function iceFall(ball: Element | null | undefined): Animation | undefined {
  const variant = iceFxVariant();
  if (variant === "reduced") return play(ball, [{ opacity: 1 }, { opacity: 0 }], { duration: REDUCED_MS, easing: "linear", fill: "forwards" });
  return play(
    ball,
    [
      { transform: "translate(-50%, -50%) scale(1) rotate(0deg)", opacity: 1 },
      { transform: "translate(-50%, -50%) scale(0.15) rotate(160deg)", opacity: 0 },
    ],
    { duration: variant === "full" ? 400 : 240, easing: "cubic-bezier(.5,0,.9,.6)", fill: "forwards" },
  );
}

/** One slide from the exit at par: the kit's near miss on the exit plate (two soft pulses). */
export function iceNearExit(exitArt: Element | null | undefined): Animation | undefined {
  return gameFx("nearMiss", exitArt, { silent: true });
}
