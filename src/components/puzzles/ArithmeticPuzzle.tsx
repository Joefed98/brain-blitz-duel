import { useEffect, useRef, useState } from "react";

import type { ArithmeticPuzzleData } from "@/lib/duel/types";

interface ArithmeticPuzzleProps {
  puzzle: ArithmeticPuzzleData;
  locked: boolean;
  onSubmit: (answer: string) => void;
}

export function ArithmeticPuzzle({ puzzle, locked, onSubmit }: ArithmeticPuzzleProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue("");
    inputRef.current?.focus();
  }, [puzzle.expression]);

  const submit = () => {
    if (locked || value.trim().length === 0) return;
    onSubmit(value.trim());
  };

  return (
    <div className="flex flex-1 flex-col justify-between gap-8">
      <div className="flex flex-col items-center gap-5 pt-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Solve it fast</p>
        <div className="rounded-2xl bg-card px-6 py-8">
          <p className="font-mono text-4xl font-bold tabular-nums text-foreground">
            {puzzle.expression}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <input
          ref={inputRef}
          value={value}
          disabled={locked}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          placeholder="Answer"
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="tap-target w-full rounded-xl border border-border bg-card px-4 py-3 text-center font-mono text-2xl tabular-nums text-foreground placeholder:font-sans placeholder:text-base placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
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
