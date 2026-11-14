import type { ReactNode } from "react";

/**
 * A section heading (DESIGN.md sections 3 and 5; style guide round 2): the title in the Heading role (20 / 26,
 * 800), no rule, with an optional quiet "See all" link or meta line on the right in text 2.
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
