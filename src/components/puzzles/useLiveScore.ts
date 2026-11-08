import { useEffect, useRef } from "react";

/** How often the live score line may change (a screen reader hears at most one score this often). */
export const LIVE_SCORE_MS = 4000;

/**
 * A canvas game's score for screen readers (7 Nov 2026, accessibility audit #15): the HUD is drawn on the canvas,
 * so the score was never in the DOM. The returned ref goes on a visually hidden polite live region; every
 * LIVE_SCORE_MS, while the page is visible, its text is set to "Score N" when N has changed. Written straight to the
 * node (no React render), nothing runs per frame, and nothing at all while hidden or disabled. Display only: it reads
 * the sim's score and never writes to the sim.
 */
export function useLiveScore(read: () => number, enabled: boolean) {
  const node = useRef<HTMLParagraphElement | null>(null);
  const readRef = useRef(read);
  readRef.current = read;
  useEffect(() => {
    if (!enabled) return;
    let last: number | null = null;
    const tick = () => {
      const el = node.current;
      if (!el || (typeof document !== "undefined" && document.hidden)) return;
      const score = readRef.current();
      if (!Number.isFinite(score) || score === last) return;
      last = score;
      el.textContent = `Score ${score}`;
    };
    const id = setInterval(tick, LIVE_SCORE_MS);
    return () => clearInterval(id);
  }, [enabled]);
  return node;
}
