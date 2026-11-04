import type { ReactNode } from "react";

import "@/polish-layout/hud-pills.css";

/**
 * Puzzle polish (3 Nov 2026, Joe's audit; display only): a status line as separate label-and-value pills
 * ("Moves 12" "Par 14"), never one pill with dots inside it. Each item is one pill: an optional quiet label and a
 * bright value (either may be omitted). Falsy items are skipped. The row keeps one line and a fixed 24 px height,
 * empty or not, so nothing moves when values change.
 */
export interface HudPillItem {
  label?: ReactNode | undefined;
  value?: ReactNode | undefined;
  /** "warn" (red value), "good" (green), "gold" (the category accent: a target or par). */
  tone?: "warn" | "good" | "gold" | undefined;
  /** Stable key and a data hook for checks (`data-hud-pill`). */
  id?: string | undefined;
  /** A move-limit counter's limit (`data-move-limit`, read by move-limits-check: keep it on a limit counter's pill). */
  limit?: number | undefined;
}

export function HudPills({ items, testId, className }: { items: ReadonlyArray<HudPillItem | false | null | undefined>; testId?: string; className?: string }) {
  const shown = items.filter((p): p is HudPillItem => !!p && (p.label !== undefined || p.value !== undefined));
  return (
    <div data-hud-pills={testId ?? ""} className={`hud-pills${className ? ` ${className}` : ""}`} aria-live="polite">
      {shown.map((p, i) => (
        <span key={p.id ?? i} className="hud-pill" data-hud-pill={p.id ?? ""} data-tone={p.tone ?? undefined} data-move-limit={p.limit}>
          {p.label !== undefined ? <span className="hud-pill-label">{p.label}</span> : null}
          {p.value !== undefined ? <b className="hud-pill-value">{p.value}</b> : null}
        </span>
      ))}
    </div>
  );
}
