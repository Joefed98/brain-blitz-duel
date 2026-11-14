import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";

/**
 * The one button (DESIGN.md section 5; style guide round 2, 14 Nov 2026). Variants:
 * - `gold`: the flat champagne face on a 4 px gold ledge inside the angled cut (cut lg; `small` cut sm); the action
 *   that plays. At most one a screen.
 * - `secondary`: surface 2 on a 4 px dark ledge, 12 px corners.
 * - `quiet`: text only.
 * - `icon`: a 44 × 44 target, an icon alone (give it an aria-label); `raised` draws the guide's icon button, a
 *   secondary square on its ledge.
 * `size` is the height in px: 60 / 48 / 36 the guide's, 44–58 today's screens' heights (kept until step 3);
 * `block` fills the width. Pressed (the face sinks 4 px onto its ledge in 70 ms, the click fires on release), hover,
 * focus-visible (a 3 px live ring 3 px out; a cut frame on gold), disabled and the 44 px minimum come from
 * components.css. `loading` disables it and says so (aria-busy).
 */
export type ButtonVariant = "gold" | "secondary" | "quiet" | "icon";
export type ButtonSize = 36 | 44 | 46 | 48 | 50 | 52 | 58 | 60;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** The gold button's small cut (--jz-cut-sm), for a small primary button. */
  small?: boolean;
  /** An icon button drawn as the guide's raised square. */
  raised?: boolean;
  /** Working: disabled, aria-busy, a quiet spinner before the label. */
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size, block = false, small = false, raised = false, loading = false, className, type = "button", disabled, children, ...rest },
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
      data-raised={raised ? "" : undefined}
      data-loading={loading ? "" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading || undefined}
      className={`jz-btn${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {loading ? <span className="jz-btn-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
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
