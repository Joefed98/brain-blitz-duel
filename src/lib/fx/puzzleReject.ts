import { prefersReducedMotion } from "@/lib/motion";

const last = new WeakMap<Element, number>();
/** Paint the existing rejection; never validate, penalise, submit or play audio. */
export function puzzleReject(element?: Element | null): void {
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
  target.setAttribute("data-puzzle-rejected", "true");
  if (!prefersReducedMotion() && typeof target.animate === "function") {
    target.animate(
      [0, -3, 3, -2, 2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
      { duration: 200, easing: "ease-out", composite: "add" },
    );
  }
  setTimeout(() => target.removeAttribute("data-puzzle-rejected"), 240);
}
