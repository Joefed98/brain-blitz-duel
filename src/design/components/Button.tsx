import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * Button (DESIGN.md section 5; design foundation F3, 6 Nov 2026: first used by the game chrome).
 *
 * - `gold`: the one action that plays (metal fill, the large angled cut). At most one a screen.
 * - `secondary`: surface-2 fill, the 8 px radius.
 * - `quiet`: text only.
 * - `icon`: 44 × 44, no fill.
 *
 * The cut is on the inner face, never the button itself, so the focus ring (on the button) is never clipped
 * (section 4). Pressed: scale 0.97 over --jz-fast; reduced motion: no scale (components.css).
 * `size` sets the height: `l` 56 px (the gold default), `m` 44 px (two small actions side by side).
 */
export type ButtonVariant = "gold" | "secondary" | "quiet" | "icon";
export type ButtonSize = "l" | "m";

export interface JzButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the row's free width (flex: 1). */
  grow?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, JzButtonProps>(function Button(
  { variant = "secondary", size, grow = false, className, children, type = "button", ...rest },
  ref,
) {
  const height = size ?? (variant === "gold" ? "l" : "m");
  const classes = ["jz-btn", `jz-btn-${variant}`, `jz-btn-${height}`, grow ? "jz-btn-grow" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} type={type} className={classes} data-jz-button={variant} {...rest}>
      <span className={`jz-btn-face${variant === "gold" ? " jz-cut-lg" : ""}`}>{children}</span>
    </button>
  );
});
