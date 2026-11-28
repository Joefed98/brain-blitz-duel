import { useRef, type CSSProperties, type ReactNode } from "react";

import { useOffscreenPause } from "./useOffscreenPause";

/**
 * The current (S1 PR 2; DESIGN.md hard rule 5): a very faint, slow drift of thin electric lines over a metal surface
 * only (tier emblems, the podium, trophies). Wrap the metal art in it; CSS only (one translate on a pseudo-element,
 * blended so it shows on bright metal, not on the dark panel round it). Off under Battery saver and reduced motion,
 * paused off screen. `radius` clips it to the art's corners (a medal or emblem: round).
 */
export function Current({ children, radius, className }: { children: ReactNode; radius?: number | "round"; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useOffscreenPause(ref);
  const r = radius === "round" ? "var(--jz-round)" : radius !== undefined ? `${radius}px` : undefined;
  return (
    <span ref={ref} className={`jz-current${className ? ` ${className}` : ""}`} style={r ? ({ "--jz-current-radius": r } as CSSProperties) : undefined}>
      {children}
    </span>
  );
}
