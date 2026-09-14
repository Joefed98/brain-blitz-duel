import { useEffect, useRef, useState } from "react";

import type { AnagramPuzzleData } from "@/lib/duel/types";

interface AnagramPuzzleProps {
  puzzle: AnagramPuzzleData;
  locked: boolean;
  onSubmit: (answer: string) => void;
}

export function AnagramPuzzle({ puzzle, locked, onSubmit }: AnagramPuzzleProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue("");
    inputRef.current?.focus();
  }, [puzzle.scrambled]);

  const submit = () => {
    if (locked || value.trim().length === 0) return;
    onSubmit(value.trim().toUpperCase());
  };

  return (
    <div className="flex flex-1 flex-col justify-between gap-8">
      <div className="flex flex-col items-center gap-5 pt-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Unscramble the word
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {puzzle.scrambled.split("").map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              className="flex h-14 w-9 items-center justify-center rounded-lg bg-card font-display text-xl font-bold text-foreground"
            >
              {letter}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <input
          ref={inputRef}
          value={value}
          disabled={locked}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          placeholder="Your answer"
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="tap-target w-full rounded-xl border border-border bg-card px-4 py-3 text-center font-mono text-2xl uppercase tracking-[0.2em] text-foreground placeholder:tracking-normal placeholder:font-sans placeholder:text-base placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={locked || value.trim().length === 0}
          className="tap-target w-full rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground transition-opacity disabled:opacity-40"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
