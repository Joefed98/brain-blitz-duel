import { useEffect, useRef, useState, type ReactNode } from "react";

interface NumberEntryProps {
  /** Small caps label above the question. */
  label: string;
  /** Changing this clears the field — one entry per puzzle. */
  resetKey: string;
  locked: boolean;
  maxLength?: number;
  placeholder?: string;
  /** Use the on-screen keypad instead of the phone keyboard. */
  keypad?: boolean;
  onSubmit: (value: string) => void;
  children: ReactNode;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "ENTER"];

/** Shared numeric answer field used by the typed puzzle types. */
export function NumberEntry({
  label,
  resetKey,
  locked,
  maxLength = 4,
  placeholder = "Answer",
  keypad = false,
  onSubmit,
  children,
}: NumberEntryProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue("");
    if (!keypad) inputRef.current?.focus();
  }, [resetKey, keypad]);

  const submit = () => {
    if (locked || value.trim().length === 0) return;
    onSubmit(value.trim());
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col items-center gap-3 pt-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        {children}
      </div>

      <div className="flex shrink-0 flex-col gap-2" style={{ touchAction: "manipulation" }}>
        <input
          ref={inputRef}
          value={value}
          disabled={locked}
          readOnly={keypad}
          inputMode={keypad ? "none" : "numeric"}
          pattern="[0-9]*"
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="tap-target w-full rounded-xl border border-border bg-card px-4 py-3 text-center font-mono text-2xl tabular-nums text-foreground placeholder:font-sans placeholder:text-base placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
        />

        {keypad ? (
          <div className="grid grid-cols-3 gap-1.5">
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                disabled={locked || (key === "ENTER" && value.length === 0)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  if (locked) return;
                  if (key === "ENTER") {
                    submit();
                    return;
                  }
                  if (key === "⌫") {
                    setValue((prev) => prev.slice(0, -1));
                    return;
                  }
                  setValue((prev) => (prev.length >= maxLength ? prev : prev + key));
                }}
                className={`h-12 rounded-xl font-display text-lg font-bold uppercase tracking-wide disabled:opacity-40 ${
                  key === "ENTER"
                    ? "bg-primary text-sm text-primary-foreground"
                    : "border border-border bg-card text-foreground"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={locked || value.trim().length === 0}
            className="tap-target w-full rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground transition-opacity disabled:opacity-40"
          >
            Submit
          </button>
        )}
      </div>
    </div>
  );
}
