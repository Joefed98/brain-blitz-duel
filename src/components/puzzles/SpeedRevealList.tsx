import type { ReactNode } from "react";

import "@/polish-layout/polish-nov3-speedatt.css";

/**
 * Puzzle polish (3 Nov 2026, Joe's audit; display only): Flash's and Bang On's per-reaction / per-watch results as a
 * tidy two-column list (1–5 down the left, 6–10 down the right), each row its number and its figure, under or over
 * the reveal's big average. The figures are exactly the ones the reveal listed one per line before.
 */
export interface SpeedRevealItem {
  /** The row's figure ("243 ms", "Missed"). */
  value: ReactNode;
  /** A missed or failed row: the figure in the warning colour. */
  missed?: boolean;
  /** The row read in full by a screen reader ("Watch 3 - 27 ms off"), the reveal's old line. */
  label?: string;
  /** Extra data hook (Bang On's zone / dead-centre mark). */
  mark?: string | undefined;
}

export function SpeedRevealList({ items, label, testId }: { items: readonly SpeedRevealItem[]; label: string; testId: string }) {
  const rows = Math.ceil(items.length / 2);
  return (
    <ol data-speed-reveal-list={testId} aria-label={label} className="speed-reveal-list" style={{ gridTemplateRows: `repeat(${Math.max(1, rows)}, auto)` }}>
      {items.map((item, index) => (
        <li key={index} aria-label={item.label} className="speed-reveal-row" data-missed={item.missed ? "" : undefined} data-bangon-mark={item.mark}>
          <span className="speed-reveal-n">{index + 1}</span>
          <span className="speed-reveal-v">{item.value}</span>
        </li>
      ))}
    </ol>
  );
}
