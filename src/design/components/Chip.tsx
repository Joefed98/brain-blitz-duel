import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode, type Ref } from "react";

/**
 * A filter chip (DESIGN.md section 5): 36 px on an 8 px radius with a 44 px hit area; selected is the
 * light fill with dark text (never gold). `cat` adds the category diamond in that category's colour
 * (`data-cat`, theme.css); `tint` colours the whole chip in its category when selected (room settings).
 * `selected` sets aria-pressed (or aria-checked with role="radio").
 *
 * `variant="status"` (design foundation F3, 6 Nov 2026) is not a control: a 22 px `<span>` pill with a quiet
 * label and a bright value, for a game's live counts (the HUD pills, `HudPills`). It has no hover, pressed or focus
 * state and no hit area, and isn't in the tab order. `tone` colours the value only: `accent` the category colour
 * (a target or par), `good` cyan (done), `warn` red (a limit close).
 */
export type FilterChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "filter";
  selected?: boolean;
  cat?: string | undefined;
  tint?: boolean;
};

export type ChipTone = "accent" | "good" | "warn";

export type StatusChipProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  variant: "status";
  label?: ReactNode;
  value?: ReactNode;
  tone?: ChipTone | undefined;
  /** Extra classes on the label and value spans (a screen's own overrides). */
  labelClassName?: string;
  valueClassName?: string;
};

export type ChipProps = FilterChipProps | StatusChipProps;

export const Chip = forwardRef<HTMLElement, ChipProps>(function Chip(props, ref) {
  if (props.variant === "status") return <StatusChip {...props} ref={ref as Ref<HTMLSpanElement>} />;
  return <FilterChip {...props} ref={ref as Ref<HTMLButtonElement>} />;
});

const StatusChip = forwardRef<HTMLSpanElement, StatusChipProps>(function StatusChip(
  { variant: _variant, label, value, tone, labelClassName, valueClassName, className, ...rest },
  ref,
) {
  return (
    <span ref={ref} data-jz="chip" data-variant="status" data-tone={tone} className={`jz-status${className ? ` ${className}` : ""}`} {...rest}>
      {label !== undefined ? <span className={`jz-status-label${labelClassName ? ` ${labelClassName}` : ""}`}>{label}</span> : null}
      {value !== undefined ? <b className={`jz-status-value${valueClassName ? ` ${valueClassName}` : ""}`}>{value}</b> : null}
    </span>
  );
});

const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(function FilterChip(
  { variant: _variant, selected, cat, tint = false, className, children, type = "button", role, ...rest },
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
