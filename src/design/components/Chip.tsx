import type { HTMLAttributes, ReactNode } from "react";

/**
 * Chip (DESIGN.md section 5; design foundation F3, 6 Nov 2026: first used by the game chrome's HUD pills).
 *
 * A quiet label and a bright value in one rounded pill (`--jz-round`), on a translucent `--jz-bg` so it reads over
 * any game backdrop. `selected` outlines it in gold; `diamond` puts the category diamond in front (the colour comes
 * from the nearest `--category-accent`). `tone` colours the value only: `accent` the category colour (a target or
 * par), `good` cyan (done, correct), `warn` red (a limit close, a cost). Colour is never the only signal: the value
 * itself says it.
 */
export type ChipTone = "accent" | "good" | "warn";

export interface ChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  label?: ReactNode;
  value?: ReactNode;
  tone?: ChipTone | undefined;
  selected?: boolean;
  diamond?: boolean;
  /** Extra classes on the label and value spans (a screen's own overrides). */
  labelClassName?: string;
  valueClassName?: string;
}

export function Chip({ label, value, tone, selected = false, diamond = false, className, labelClassName, valueClassName, ...rest }: ChipProps) {
  return (
    <span
      className={`jz-chip${className ? ` ${className}` : ""}`}
      data-tone={tone}
      data-selected={selected ? "" : undefined}
      {...rest}
    >
      {diamond ? <span aria-hidden="true" className="jz-chip-diamond" /> : null}
      {label !== undefined ? <span className={`jz-chip-label${labelClassName ? ` ${labelClassName}` : ""}`}>{label}</span> : null}
      {value !== undefined ? <b className={`jz-chip-value${valueClassName ? ` ${valueClassName}` : ""}`}>{value}</b> : null}
    </span>
  );
}
