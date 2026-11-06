import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";

/**
 * The one button (DESIGN.md section 5). Variants:
 * - `gold`: the metal face on a 4 px ledge inside the angled cut; the action that plays. At most one a screen.
 * - `secondary`: the surface with a 1.5 px --jz-surface-2 edge, 8 px radius.
 * - `quiet`: text only.
 * - `icon`: 44 × 44, an icon alone (give it an aria-label).
 * `size` is the height in px (the screens keep their heights: 44, 46, 48, 50, 52 or 58); `block` fills the
 * width. Hover, pressed (0.97) and focus-visible states and the 44 px minimum come from components.css.
 */
export type ButtonVariant = "gold" | "secondary" | "quiet" | "icon";
export type ButtonSize = 44 | 46 | 48 | 50 | 52 | 58;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** The gold button's small cut (--jz-cut-sm), for a small primary button. */
  small?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size, block = false, small = false, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-jz="button"
      data-variant={variant}
      data-size={variant === "icon" ? undefined : size}
      data-block={block ? "" : undefined}
      data-small={small ? "" : undefined}
      className={`jz-btn${className ? ` ${className}` : ""}`}
      {...rest}
    />
  );
});

/** The same button as a link (an external page, a download). */
export const ButtonLink = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean }
>(function ButtonLink({ variant = "secondary", size, block = false, className, ...rest }, ref) {
  return (
    <a
      ref={ref}
      data-jz="button"
      data-variant={variant}
      data-size={variant === "icon" ? undefined : size}
      data-block={block ? "" : undefined}
      className={`jz-btn${className ? ` ${className}` : ""}`}
      {...rest}
    />
  );
});
