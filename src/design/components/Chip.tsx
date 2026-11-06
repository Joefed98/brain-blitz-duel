import { forwardRef, type ButtonHTMLAttributes } from "react";

/**
 * A filter chip (DESIGN.md section 5): 36 px on an 8 px radius with a 44 px hit area; selected is the
 * light fill with dark text (never gold). `cat` adds the category diamond in that category's colour
 * (`data-cat`, theme.css); `tint` colours the whole chip in its category when selected (room settings).
 * `selected` sets aria-pressed (or aria-checked with role="radio").
 */
export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  cat?: string | undefined;
  tint?: boolean;
};

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected, cat, tint = false, className, children, type = "button", role, ...rest },
  ref,
) {
  const state = selected === undefined ? {} : role === "radio" ? { "aria-checked": selected } : { "aria-pressed": selected };
  return (
    <button
      ref={ref}
      type={type}
      role={role}
      data-jz="chip"
      data-cat={cat}
      data-tint={tint ? "" : undefined}
      className={`jz-chip${className ? ` ${className}` : ""}`}
      {...state}
      {...rest}
    >
      {cat ? <span aria-hidden="true" className="jz-diamond" /> : null}
      {children}
    </button>
  );
});
