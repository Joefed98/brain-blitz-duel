/** The eight strokes (in a 48 × 48 box round its centre): four long on the axes, four short on the diagonals. */
const RAYS: [number, number, number, number][] = [
  [24, 11, 24, 3],
  [24, 37, 24, 45],
  [11, 24, 3, 24],
  [37, 24, 45, 24],
  [15, 15, 10, 10],
  [33, 33, 38, 38],
  [33, 15, 38, 10],
  [15, 33, 10, 38],
];

export type SparkProps = {
  /** Where it bursts, in its positioned parent's pixels. */
  x: number;
  y: number;
  /** gold (default), or the current colour (a game's own colour inside its frame). */
  tone?: "gold" | "inherit";
  className?: string;
};

/**
 * Spark (S1 PR 2; DESIGN.md "Bolt motifs"): a short burst of eight strokes from a point, about 300 ms. One scale and
 * opacity animation on one group; its rest state is gone, so the owner mounts it for the moment (a new `key` bursts
 * again) and may unmount it after. Under reduced motion, a short fade in place.
 */
export function Spark({ x, y, tone = "gold", className }: SparkProps) {
  return (
    <svg
      className={`jz-motif jz-spark${className ? ` ${className}` : ""}`}
      style={{ left: x, top: y, ...(tone === "inherit" ? { color: "inherit" } : {}) }}
      width={48}
      height={48}
      viewBox="0 0 48 48"
      aria-hidden
    >
      <g className="jz-spark-rays">
        {RAYS.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
    </svg>
  );
}
