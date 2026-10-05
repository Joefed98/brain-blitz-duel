import { useEffect, useState } from "react";

/** Always reserves a row; only server-accepted words can fill it. */
export function AcceptedWordChip({ word, hidden = false }: { word: string | null; hidden?: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!word) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 700);
    return () => clearTimeout(timer);
  }, [word]);
  return (
    <div className="flex h-8 w-full shrink-0 items-center justify-center" role="status" aria-live="polite">
      {word && visible && !hidden ? (
        <span key={word} className="accepted-word-chip max-w-full truncate rounded-md bg-primary px-3 py-1 font-mono text-xs font-bold uppercase text-accepted-word-foreground">
          {word}
        </span>
      ) : null}
    </div>
  );
}