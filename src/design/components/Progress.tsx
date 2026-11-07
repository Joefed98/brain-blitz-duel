/**
 * A thin progress bar (practice goals, 6 Nov 2026): 6 px, the empty step's surface, filled in the secondary text
 * colour, cyan once done (DESIGN.md: cyan for done). A plain picture: the figure beside it carries the number, so the
 * bar is hidden from screen readers unless given a `label`.
 */
export function Progress({ value, done = false, label, className }: { value: number; done?: boolean; label?: string; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100);
  return (
    <span
      data-jz="progress"
      data-done={done ? "" : undefined}
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuenow={label ? pct : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-hidden={label ? undefined : true}
      className={`jz-progress${className ? ` ${className}` : ""}`}
    >
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}
