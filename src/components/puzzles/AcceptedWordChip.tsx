import { useEffect, useState } from "react";

/**
 * Always reserves a row; only server-accepted words can fill it. `tracing` (Forage) shows the letters being
 * traced in the same row, in a plain outline, until the trace ends.
 */
export function AcceptedWordChip({ word, hidden = false, tracing = null }: { word: string | null; hidden?: boolean; tracing?: string | null }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!word) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 700);
    return () => clearTimeout(timer);
  }, [word]);
  return (
    <div className="flex h-8 w-full shrink-0 items-center justify-center" role="status" aria-live="polite">
      {tracing ? (
        <span data-traced-word className="max-w-full truncate rounded-md border border-primary/60 bg-card px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest text-primary">
          {tracing}
        </span>
      ) : word && visible && !hidden ? (
        <span key={word} className="accepted-word-chip max-w-full truncate rounded-md bg-primary px-3 py-1 font-mono text-xs font-bold uppercase text-accepted-word-foreground">
          {word}
        </span>
      ) : null}
    </div>
  );
}