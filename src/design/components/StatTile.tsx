import type { HTMLAttributes, ReactNode } from "react";

/**
 * A stat or rating tile (style guide round 2, 14 Nov 2026; components.png "Rating tile"): a panel with the art on
 * top (44 px), the value (24 / 30, 800, tabular) and its label (caption). A rating's value is the number alone; the
 * label names it ("Puzzles").
 */
export function StatTile({
  art,
  value,
  label,
  className,
  ...rest
}: { art?: ReactNode; value: ReactNode; label: ReactNode } & Omit<HTMLAttributes<HTMLDivElement>, "children">) {
  return (
    <div data-jz="stat-tile" className={`jz-stat${className ? ` ${className}` : ""}`} {...rest}>
      {art !== undefined ? (
        <span aria-hidden="true" className="jz-stat-art">
          {art}
        </span>
      ) : null}
      <span className="jz-stat-value">{value}</span>
      <span className="jz-stat-label">{label}</span>
    </div>
  );
}
