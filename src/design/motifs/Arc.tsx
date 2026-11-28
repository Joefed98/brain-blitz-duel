import { useMemo, useRef } from "react";

import { useOffscreenPause } from "./useOffscreenPause";

export type ArcProps = {
  /** The two points in the box's own pixels (the arc's parent is its box: it fills it, absolutely placed). */
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** The box's size, the svg's view box. */
  width: number;
  height: number;
  /** cyan (live moments, the default) or gold (wins). */
  tone?: "cyan" | "gold";
  /** Picks the jag pattern: the same seed draws the same arc on every phone. */
  seed?: number;
  className?: string;
};

/** A small fixed PRNG (mulberry32): display only, never a sim's. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The jagged points along +x from 0 to `length`: a jump every 10–16 px, up to a sixth of the length off the line. */
export function arcPoints(length: number, seed: number): string {
  const next = rng(seed);
  const amp = Math.min(14, Math.max(4, length / 6));
  const pts: string[] = ["0,0"];
  let x = 0;
  let side = next() < 0.5 ? -1 : 1;
  while (x < length - 14) {
    x += 10 + next() * 6;
    side = -side;
    pts.push(`${x.toFixed(1)},${(side * amp * (0.35 + next() * 0.65)).toFixed(1)}`);
  }
  pts.push(`${length.toFixed(1)},0`);
  return pts.join(" ");
}

/**
 * Arc (S1 PR 2; DESIGN.md "Bolt motifs"): a jagged line that jumps between two points, then flickers lit (it ends
 * visible). Cyan for live moments, gold for wins. The points are worked out once per prop change; the jump is a
 * scaleX and the flicker opacity. Under reduced motion it fades in and holds.
 */
export function Arc({ from, to, width, height, tone = "cyan", seed = 1, className }: ArcProps) {
  const ref = useRef<SVGSVGElement>(null);
  useOffscreenPause(ref);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const points = useMemo(() => arcPoints(length, seed), [length, seed]);
  return (
    <svg
      ref={ref}
      className={`jz-motif jz-arc${className ? ` ${className}` : ""}`}
      data-tone={tone === "gold" ? "gold" : undefined}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <g transform={`translate(${from.x} ${from.y}) rotate(${angle})`}>
        <g className="jz-arc-bolt">
          <polyline className="jz-arc-glow" points={points} />
          <polyline className="jz-arc-line" points={points} />
        </g>
      </g>
    </svg>
  );
}
