import type { HTMLAttributes, ReactNode } from "react";

/**
 * LiveTag (DESIGN.md section 5; design foundation F3, 6 Nov 2026).
 *
 * The small cut tag: LIVE in red (a round being played now), NEXT in cyan (what comes up). The text is written in
 * sentence case and shown in capitals by CSS (hard rule 6), so screen readers read the word. Built with the game
 * chrome (F3), which has no live or next tag of its own yet; the tab pages and room screens adopt it.
 */
export type LiveTagKind = "live" | "next";

export interface LiveTagProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  kind?: LiveTagKind;
  children?: ReactNode;
}

export function LiveTag({ kind = "live", className, children, ...rest }: LiveTagProps) {
  return (
    <span className={`jz-live-tag jz-cut-sm${className ? ` ${className}` : ""}`} data-kind={kind} {...rest}>
      {children ?? (kind === "live" ? "Live" : "Next")}
    </span>
  );
}
