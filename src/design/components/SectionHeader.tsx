import type { ReactNode } from "react";

/**
 * A section heading (DESIGN.md sections 3 and 5): the title (18/22, 800) over a 2 px rule, with an
 * optional meta line or link on the right.
 */
export function SectionHeader({
  title,
  right,
  level = 2,
  id,
  className,
}: {
  title: ReactNode;
  right?: ReactNode;
  level?: 2 | 3;
  id?: string;
  className?: string;
}) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div data-jz="section-header" className={`jz-section-head${className ? ` ${className}` : ""}`}>
      <H id={id}>{title}</H>
      {right ?? null}
    </div>
  );
}
