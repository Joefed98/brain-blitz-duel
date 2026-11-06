/**
 * The LIVE (red) / NEXT (cyan) tag (DESIGN.md section 5), on the small angled cut. Capitals come from
 * CSS (hard rule 6), so the text is written "Live" / "Next".
 */
export function LiveTag({ kind = "live", className }: { kind?: "live" | "next"; className?: string }) {
  return (
    <span data-jz="live-tag" data-kind={kind} className={`jz-live${className ? ` ${className}` : ""}`}>
      {kind === "live" ? "Live" : "Next"}
    </span>
  );
}
