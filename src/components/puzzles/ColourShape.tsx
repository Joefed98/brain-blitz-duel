import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { boxSize, SHAPE_COLS as N } from "@/lib/duel/shapes";
import type { MirrorShape } from "@/lib/duel/types";

/**
 * One coloured shape drawn from its filled 5x5 cells, with an optional dashed
 * mirror line down the right edge (vertical) or along the bottom (horizontal).
 */
export function ColourShape({
  shape,
  size = 84,
  axis,
  faded = false,
  box,
}: {
  shape: MirrorShape;
  size?: number;
  axis?: "vertical" | "horizontal";
  faded?: boolean;
  /** Shared box side, so shapes drawn side by side sit on one baseline. */
  box?: number;
}) {
  const own = boxSize(shape);
  const m = Math.max(own, box ?? 0);
  // Sit the shape on the bottom of the shared box.
  const drop = m - own;
  const pad = axis ? 0.45 : 0.12;
  const span = m + pad * 2;

  let line: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (axis === "vertical") line = { x1: m + 0.2, y1: -0.1, x2: m + 0.2, y2: m + 0.1 };
  if (axis === "horizontal") line = { x1: -0.1, y1: m + 0.2, x2: m + 0.1, y2: m + 0.2 };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-pad} ${-pad} ${span} ${span}`}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      {shape.cells.map((i, k) => (
        <rect
          key={i}
          x={(i % N) + 0.06}
          y={Math.floor(i / N) + drop + 0.06}
          width={0.88}
          height={0.88}
          rx={0.14}
          fill={GLYPH_COLOURS[shape.colours[k]!]}
          opacity={faded ? 0.45 : 1}
        />
      ))}
      {line && (
        <line
          {...line}
          stroke="var(--primary)"
          strokeWidth={0.09}
          strokeLinecap="round"
          strokeDasharray="0.3 0.22"
        />
      )}
    </svg>
  );
}

/** The run progress bar: one segment per item, filled as items are answered. */
export function RunProgress({ total, done }: { total: number; done: number }) {
  return (
    <div className="flex w-full items-center gap-1" aria-label={`${done} of ${total} answered`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-primary" : "bg-border"}`}
        />
      ))}
    </div>
  );
}
