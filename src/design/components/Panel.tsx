import { forwardRef, type HTMLAttributes } from "react";

/**
 * A panel (DESIGN.md section 5): the flat --jz-surface on 8 px corners, holding rows split by 1 px
 * dividers (Row), or padded content (`pad`). `striped` adds the stripe texture (daily cards and the
 * standings header only); `tone="cyan"` is the head-to-head / next-up panel.
 */
export type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "ul" | "ol" | "nav";
  pad?: boolean;
  striped?: boolean;
  tone?: "cyan";
};

export const Panel = forwardRef<HTMLElement, PanelProps>(function Panel(
  { as: Tag = "div", pad = false, striped = false, tone, className, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref as never}
      data-jz="panel"
      data-pad={pad ? "" : undefined}
      data-striped={striped ? "" : undefined}
      data-tone={tone}
      className={`jz-panel${className ? ` ${className}` : ""}`}
      {...rest}
    />
  );
});
