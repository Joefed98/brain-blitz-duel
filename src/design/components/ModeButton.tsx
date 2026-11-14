import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Icon } from "./Icon";

/**
 * A mode button (style guide round 2, 14 Nov 2026; components.png "Mode button"): a secondary button 64 px tall on
 * its 4 px ledge, the art (44 px) on the left, the label, a quiet detail on the right ("Next at 20:00") and a
 * chevron. The whole button is the target; pressed it sinks onto its ledge, like every raised button.
 */
export type ModeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  art?: ReactNode;
  label: ReactNode;
  detail?: ReactNode;
};

export const ModeButton = forwardRef<HTMLButtonElement, ModeButtonProps>(function ModeButton(
  { art, label, detail, className, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} data-jz="mode-button" className={`jz-mode${className ? ` ${className}` : ""}`} {...rest}>
      {art !== undefined ? (
        <span aria-hidden="true" className="jz-mode-art">
          {art}
        </span>
      ) : null}
      <span className="jz-mode-label">{label}</span>
      {detail !== undefined ? <span className="jz-mode-detail">{detail}</span> : null}
      <Icon name="chevron-right" size={20} className="jz-chevron" />
    </button>
  );
});
