import type { CSSProperties, ReactNode } from "react";

/**
 * A loading placeholder for a layout we know (DESIGN.md section 5): `line` (14 px text), `row` (a
 * 62 px panel row), `card` (120 px) or `tile` (56 px game tile). A slow sheen passes over it; under
 * reduced motion it is still. Hidden from screen readers: give the region aria-busy and a label.
 * Short waits ("Scoring…") keep the dots.
 */
export function Skeleton({
  kind = "line",
  width,
  height,
  className,
}: {
  kind?: "line" | "row" | "card" | "tile";
  width?: number | string;
  height?: number;
  className?: string;
}) {
  const style: CSSProperties = {};
  if (width !== undefined) style.width = width;
  if (height !== undefined) style.height = height;
  return <span aria-hidden="true" data-jz="skeleton" data-kind={kind} className={`jz-skel${className ? ` ${className}` : ""}`} style={style} />;
}

/** A screen's loading state: a labelled, busy column of skeletons. */
export function SkeletonScreen({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} data-skeleton-screen className={`jz-skel-stack${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

/**
 * A page still loading whose shape we know: a title line, an optional card, then a panel of rows (a room's
 * players, a board's lines, a list of rounds). Fills the column from the top, as the page will.
 */
export function SkeletonPage({
  label,
  rows = 4,
  card = false,
  className,
}: {
  label: string;
  rows?: number;
  card?: boolean;
  className?: string;
}) {
  return (
    <SkeletonScreen label={label} className={`w-full flex-1 pt-2${className ? ` ${className}` : ""}`}>
      <Skeleton kind="line" width="45%" height={24} />
      {card ? <Skeleton kind="card" /> : null}
      <span className="jz-skel-stack" style={{ gap: 2 }}>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} kind="row" />
        ))}
      </span>
    </SkeletonScreen>
  );
}
