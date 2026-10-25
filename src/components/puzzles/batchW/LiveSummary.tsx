import type { ReactNode } from "react";

import "@/polish-layout/batch-w.css";

/**
 * Polish batch W (25 Oct 2026, display only): the one-line live summary just above a game's dock
 * ("3 found · 2 misses · 2 vowels left"). Always drawn at its fixed 18px height, empty or not, so
 * nothing moves when the text arrives or changes; it reads only what the game already shows.
 * `parts` are joined with a faint dot; falsy parts are skipped.
 */
export function LiveSummary({ parts, testId }: { parts: ReadonlyArray<ReactNode | false | null | undefined>; testId?: string }) {
  const shown = parts.filter((p): p is ReactNode => p !== false && p !== null && p !== undefined && p !== "");
  return (
    <div data-live-summary={testId ?? ""} className="bw-summary" aria-live="polite">
      {shown.map((part, i) => (
        <span key={i}>
          {i > 0 ? <span className="bw-sep" aria-hidden="true">·&nbsp;</span> : null}
          {part}
        </span>
      ))}
    </div>
  );
}
