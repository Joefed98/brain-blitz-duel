import { useGameKeys } from "@/lib/desktop";
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
  compactKeypad?: boolean;
  onSubmit: (value: string) => void;
  children: ReactNode;
}

/** The digits then backspace: one row, or two rows of six in the compact keypad (44 px keys). ENTER sits beside the field there, else its own bar beneath. */
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "⌫"];

/** Shared numeric answer field used by the typed puzzle types. */
export function NumberEntry({
  label,
  resetKey,
  locked,
  maxLength = 4,
  placeholder = "Answer",
  keypad = false,
  compactKeypad = false,
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

  // Desktop keys (keypad mode; a typed field takes keys itself): digits, Backspace and Enter press the keypad's keys.
  useGameKeys((kind, key) => {
    if (!/^[0-9]$/.test(key) && key !== "Backspace" && key !== "Enter") return false;
    if (kind !== "down" || locked) return true;
    if (key === "Enter") submit();
    else if (key === "Backspace") setValue((prev) => prev.slice(0, -1));
    else setValue((prev) => (prev.length >= maxLength ? prev : prev + key));
    return true;
  }, keypad);

  return (
    <div data-stage-column="3" className="flex min-h-0 flex-1 flex-col gap-3">
      <div data-game-arena="countup" className="flex min-h-0 flex-1 flex-col items-center gap-3 pt-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        {children}
      </div>

      <div data-game-controls="input" className="flex shrink-0 flex-col gap-2" style={{ touchAction: "manipulation" }}>
        <div className={compactKeypad ? "flex gap-2" : "contents"}>
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
          className={`${compactKeypad ? "h-11 min-w-0 flex-1 py-1" : "tap-target w-full py-3"} rounded-xl border border-border bg-card px-4 text-center font-mono text-2xl tabular-nums text-foreground placeholder:font-sans placeholder:text-base placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50`}
        />
        {keypad && compactKeypad && (
          <button
            type="button"
            disabled={locked || value.length === 0}
            onPointerDown={(event) => { event.preventDefault(); submit(); }}
            className="h-11 rounded-lg bg-primary px-4 font-display text-sm font-bold uppercase text-primary-foreground disabled:opacity-40"
          >
            Enter
          </button>
        )}
        </div>

        {keypad ? (
          <div className="flex flex-col gap-1.5">
            <div className={compactKeypad ? "grid grid-cols-6 gap-1" : "grid grid-cols-11 gap-1"}>
              {KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={locked}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    if (locked) return;
                    if (key === "⌫") {
                      setValue((prev) => prev.slice(0, -1));
                      return;
                    }
                    setValue((prev) => (prev.length >= maxLength ? prev : prev + key));
                  }}
                  className={`${compactKeypad ? "h-11" : "h-10"} rounded-lg border border-border bg-card font-display text-base font-bold text-foreground disabled:opacity-40`}
                >
                  {key}
                </button>
              ))}
            </div>
            {!compactKeypad && <button
              type="button"
              disabled={locked || value.length === 0}
              onPointerDown={(event) => {
                event.preventDefault();
                if (locked) return;
                submit();
              }}
              className="h-10 w-full rounded-lg bg-primary font-display text-sm font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
            >
              Enter
            </button>}
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
