import { prefersReducedMotion } from "@/lib/motion";
import { playRejectWrong } from "@/lib/sound";

const last = new WeakMap<Element, number>();
/**
 * Paint the existing rejection and sound the quiet `wrong` with it (silent in intro demos); never validate,
 * penalise or submit. Every shake sounds once (the November game reviews): playRejectWrong leaves the sound out when
 * the move's own `wrong` already started, and a game's `wrong` just after it is left out (sound.ts), so `_sound` no
 * longer changes anything. It was `false` where the move already played `wrong`, and the shared shake paint
 * (usePuzzleRejections) passed `false` for every game's own shake, so Shikaku's, Tents', Trail's… were silent; the
 * rest played `shared.reject`, beside `wrong` in Forage and Brimful.
 */
export function puzzleReject(element?: Element | null, _sound = true): void {
  if (typeof document === "undefined") return;
  const target =
    element ??
    document.querySelector(
      "[data-game-stage] [data-play-area], [data-game-stage] .puzzle-board, [data-game-stage]",
    );
  if (!target) return;
  const now = Date.now();
  if (now - (last.get(target) ?? 0) < 340) return;
  last.set(target, now);
  // A shake a game marks as harmless (an element inside `[data-quiet-shake]`, e.g. a repeat that costs nothing) stays silent.
  if (!target.closest?.("[data-quiet-shake]")) playRejectWrong();
  target.setAttribute("data-puzzle-rejected", "true");
  if (!prefersReducedMotion() && typeof target.animate === "function") {
    target.animate(
      [0, -3, 3, -2, 2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
      { duration: 200, easing: "ease-out", composite: "add" },
    );
  }
  setTimeout(() => target.removeAttribute("data-puzzle-rejected"), 240);
}
