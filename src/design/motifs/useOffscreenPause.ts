import { useEffect, type RefObject } from "react";

/**
 * Pauses a motif's animations while it is out of view (S1 PR 2): an IntersectionObserver marks the element
 * data-jz-offscreen, and motifs.css stops every animation inside it there. Where the browser has no observer
 * nothing is marked (the animation simply runs).
 */
export function useOffscreenPause(ref: RefObject<Element | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) entry.target.toggleAttribute("data-jz-offscreen", !entry.isIntersecting);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      el.removeAttribute("data-jz-offscreen");
    };
  }, [ref]);
}
