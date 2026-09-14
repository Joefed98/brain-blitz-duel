import { useEffect, useRef, useState, type ReactNode } from "react";

interface NumberEntryProps {
  /** Small caps label above the question. */
  label: string;
  /** Changing this clears the field — one entry per puzzle. */
  resetKey: string;
  locked: boolean;
  maxLength?: number;
  placeholder?: string;
  onSubmit: (value: string) => void;
  children: ReactNode;
}

/** Shared numeric answer field used by the typed puzzle types. */
export function NumberEntry({
  label,
  resetKey,
  locked,
  maxLength = 4,
  placeholder = "Answer",
  onSubmit,
  children,
}: NumberEntryProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue("");
    inputRef.current?.focus();
  }, [resetKey]);

  const submit = () => {
    if (locked || value.trim().length === 0) return;
    onSubmit(value.trim());
  };

  return (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <div className="flex flex-col items-center gap-5 pt-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        {children}
      </div>

      <div className="flex flex-col gap-3">
        <input
          ref={inputRef}
          value={value}
          disabled={locked}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={maxLength}
          placeholder={placeholder}
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
