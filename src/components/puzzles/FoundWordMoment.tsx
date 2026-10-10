import { useEffect, useState } from "react";

export interface AcceptedWordMoment {
  word: string;
  points: number;
  serial: number;
}
/** New chips only; existing AcceptedWordChip duration and content remain intact. */
export function FoundWordMoment({ value }: { value: AcceptedWordMoment | null }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!value) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(timer);
  }, [value]);
  return (
    <div
      className="flex h-8 w-full shrink-0 items-center justify-center"
      role="status"
      aria-live="polite"
    >
      {value && visible ? (
        <span
          key={value.serial}
          className="accepted-word-chip found-word-moment max-w-full truncate rounded-md bg-primary px-3 py-1 font-mono text-xs font-bold uppercase text-accepted-word-foreground"
        >
          {value.word}
        </span>
      ) : null}
    </div>
  );
}
