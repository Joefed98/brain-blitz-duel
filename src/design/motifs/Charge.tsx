import { useRef, type CSSProperties } from "react";

import { useOffscreenPause } from "./useOffscreenPause";

/** The bolt's outline (24 × 34), the brand mark's shape; the fill builds inside it. */
const BOLT = "M14 1 L3 19 H11 L8 33 L21 13 H13 Z";

export type ChargeProps = {
  /** bolt (default) or a horizontal bar. */
  shape?: "bolt" | "bar";
  /** How full, 0–1, held (a change slides there over --jz-dur-count). Ignored while `run` builds it. */
  level?: number;
  /** Builds from empty to full once, over `ms` (a remount or a new key runs it again). */
  run?: boolean;
  /** The build's length in ms (default --jz-dur-count). */
  ms?: number;
  /** Full and crackling: the outline flickers, always resting lit. */
  crackle?: boolean;
  /** Width in px (a bolt keeps its 24 : 34 shape; a bar is 8 px tall unless `height`). */
  size?: number;
  height?: number;
  className?: string;
  label?: string;
};

/**
 * Charge (S1 PR 2; DESIGN.md "Bolt motifs"): a fill that builds inside a shape. Gold. Transforms only: the fill is
 * scaled, never redrawn, and React sets the level once, not each frame. Under reduced motion a build runs in four
 * even steps and ends full.
 */
export function Charge({ shape = "bolt", level = 0, run = false, ms, crackle = false, size, height, className, label }: ChargeProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useOffscreenPause(ref);
  const style = {
    "--jz-charge-level": Math.max(0, Math.min(1, level)),
    ...(ms ? { "--jz-charge-ms": `${ms}ms` } : {}),
  } as CSSProperties;
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  if (shape === "bar") {
    const w = size ?? 160;
    const h = height ?? 8;
    return (
      <span
        ref={ref}
        className={`jz-motif jz-charge${className ? ` ${className}` : ""}`}
        data-shape="bar"
        data-run={run ? "" : undefined}
        data-crackle={crackle ? "" : undefined}
        style={style}
        {...a11y}
      >
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect className="jz-charge-fill" x={0} y={0} width={w} height={h} rx={h / 2} />
          <rect className="jz-charge-outline" x={0.5} y={0.5} width={w - 1} height={h - 1} rx={(h - 1) / 2} />
        </svg>
      </span>
    );
  }
  const w = size ?? 24;
  const clip = `jz-charge-clip-${w}`;
  return (
    <span
      ref={ref}
      className={`jz-motif jz-charge${className ? ` ${className}` : ""}`}
      data-shape="bolt"
      data-run={run ? "" : undefined}
      data-crackle={crackle ? "" : undefined}
      style={style}
      {...a11y}
    >
      <svg width={w} height={(w * 34) / 24} viewBox="0 0 24 34">
        <defs>
          <clipPath id={clip}>
            <path d={BOLT} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect className="jz-charge-fill" x={0} y={0} width={24} height={34} />
        </g>
        <path className="jz-charge-outline" d={BOLT} />
      </svg>
    </span>
  );
}
