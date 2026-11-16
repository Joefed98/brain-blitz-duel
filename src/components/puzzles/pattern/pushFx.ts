/**
 * Heave's effects (the Pattern overhaul stage 2, 15 Nov 2026; docs/design/game-fx/README.md). Presentation only: each
 * observes what the shared push rules already decided (a crate landing on a mark, the gold crate pushed off its gold
 * mark, the solve) and animates a piece's own art layer or the floor's own light layers (pointer-events none, inside
 * the board's box). Nothing here reads or writes a move, the answer, the clock or the grade, and nothing waits on an
 * animation: every step is taken at once (the stage applies each move as it comes; the effects only follow).
 *
 * Transform and opacity only (Web Animations), through the effects kit where it has the moment (a crate home is the
 * kit's drop) and in the kit's variant otherwise: reduced motion is a 120 ms crossfade (no movement, no dust), lite
 * shorter, the rest as designed. Sounds are Heave's own slots (fired by the stage), so the kit calls are silent.
 */
import { gameFx, gameFxVariant, type GameFxVariant } from "@/lib/fx/kit";

/** The variant every Heave effect plays in (the kit's rule: reduced motion first). */
export function pushFxVariant(): GameFxVariant {
  return gameFxVariant("slide");
}

/** How far behind the worker a pushed crate starts its glide (Joe: the crate moves a beat behind). */
export const PUSH_CRATE_LAG_MS = 60;
/** The mark's glow and the gold mark's dim (each well under the kit's 900 ms a physical action). */
export const PUSH_MARK_GLOW_MS = 640;
export const PUSH_GOLD_DIM_MS = 420;

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

/** A crate home: it comes down on the mark with a small squash (the kit's drop; push.home is the stage's). */
export function pushCrateHome(crateArt: Element | null | undefined): Animation | undefined {
  return gameFx("drop", crateArt, { silent: true });
}

/** The mark under a crate that just landed glows up and fades back (its own glow layer, held hidden after). */
export function pushMarkGlow(glow: Element | null | undefined): Animation | undefined {
  const variant = pushFxVariant();
  if (variant === "reduced") return play(glow, [{ opacity: 0.6 }, { opacity: 0 }], { duration: 120, easing: "linear", fill: "forwards" });
  return play(
    glow,
    [
      { opacity: 0, transform: "scale(0.8)" },
      { opacity: 1, transform: "scale(1.04)", offset: 0.3 },
      { opacity: 0, transform: "scale(1.1)" },
    ],
    { duration: variant === "full" ? PUSH_MARK_GLOW_MS : 380, easing: "ease-out", fill: "forwards" },
  );
}

/** The gold crate pushed off its gold mark: the mark dims for a moment (a shade over it; no shake). */
export function pushGoldDim(shade: Element | null | undefined): Animation | undefined {
  const variant = pushFxVariant();
  if (variant === "reduced") return play(shade, [{ opacity: 0.55 }, { opacity: 0 }], { duration: 120, easing: "linear", fill: "forwards" });
  return play(shade, [{ opacity: 0 }, { opacity: 0.6, offset: 0.3 }, { opacity: 0 }], {
    duration: variant === "full" ? PUSH_GOLD_DIM_MS : 260,
    easing: "ease-out",
    fill: "forwards",
  });
}
