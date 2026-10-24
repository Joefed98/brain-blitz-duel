import { useRef, type ReactNode } from "react";

import { NO_SCROLL_STYLE } from "@/components/puzzles/noScroll";
import { useGameKeys } from "@/lib/desktop";

/**
 * Shared on-screen QWERTY keypad (Strikeout, Cryptogrid). Plain buttons only:
 * no text input is ever focused, so the phone keyboard never opens and the
 * page never scrolls to make room for it.
 */

export type KeyTone = "plain" | "gold" | "red" | "used" | "pending";

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] as const;

const TONE: Record<KeyTone, string> = {
  plain: "bg-secondary text-foreground",
  gold: "bg-primary text-primary-foreground",
  red: "bg-destructive/80 text-destructive-foreground",
  used: "bg-muted text-muted-foreground",
  pending: "bg-secondary text-muted-foreground animate-pulse",
};

export interface LetterKeypadProps {
  onLetter: (letter: string) => void;
  tone?: (letter: string) => KeyTone;
  /** A disabled key cannot be pressed (Strikeout's used letters). */
  disabled?: (letter: string) => boolean;
  /** Whole keypad off (round over). */
  locked?: boolean;
  /** Buttons either side of the bottom row (Delete, Solve, Clear…). */
  left?: ReactNode;
  right?: ReactNode;
  /** Key height in px (44 by default). */
  keyHeight?: number;
  /** Letter size in px (16 by default; display only). */
  keyFontPx?: number;
}

export function LetterKeypad({ onLetter, tone, disabled, locked = false, left, right, keyHeight = 44, keyFontPx }: LetterKeypadProps) {
  const box = useRef<HTMLDivElement>(null);
  // Desktop keys: typing a letter presses its key; Backspace (or Delete) presses the action left of the
  // bottom row (Delete, Clear) and Enter the one right of it (Solve, Next), exactly as a tap on them.
  useGameKeys((kind, key, event) => {
    if (/^[a-z]$/.test(key)) {
      const letter = key.toUpperCase();
      if (kind === "down" && !locked && !(disabled?.(letter) ?? false)) onLetter(letter);
      return true;
    }
    if (key !== "Backspace" && key !== "Delete" && key !== "Enter") return false;
    if (kind === "down" && !event.repeat) {
      const actions = [...(box.current?.querySelectorAll<HTMLButtonElement>("[data-key-action]") ?? [])];
      const target = key === "Enter" ? actions[actions.length - 1] : actions[0];
      if (target && !target.disabled) target.click();
    }
    return true;
  });
  return (
    <div
      ref={box}
      data-game-controls="keypad"
      className="flex w-full shrink-0 select-none flex-col gap-1.5 px-0.5"
      style={NO_SCROLL_STYLE}
      // Keep focus where it is: a tapped key must never pull focus or scroll.
      onPointerDown={(event) => event.preventDefault()}
    >
      {ROWS.map((row, r) => (
        <div key={row} className="flex w-full justify-center gap-1">
          {r === 2 && left}
          {[...row].map((letter) => {
            const off = locked || (disabled?.(letter) ?? false);
            return (
              <button
                key={letter}
                type="button"
                tabIndex={-1}
                data-key={letter}
                aria-label={letter}
                disabled={off}
                onClick={() => onLetter(letter)}
                className={`flex min-w-0 flex-1 items-center justify-center rounded-md font-display text-base font-bold transition-colors disabled:cursor-default ${TONE[tone?.(letter) ?? "plain"]} ${off ? "opacity-70" : "active:brightness-125"}`}
                style={{ height: keyHeight, maxWidth: 40, touchAction: "manipulation", ...(keyFontPx ? { fontSize: keyFontPx } : {}) }}
              >
                {letter}
              </button>
            );
          })}
          {r === 2 && right}
        </div>
      ))}
    </div>
  );
}

/** A wide action key for the keypad's bottom row. */
export function KeypadAction({
  label,
  onPress,
  disabled,
  children,
  emphasis = false,
  keyHeight = 44,
  fontPx,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
  emphasis?: boolean;
  keyHeight?: number;
  /** Label size in px (11 px with wide tracking by default; a size here drops the tracking). */
  fontPx?: number;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      data-key-action=""
      disabled={disabled}
      onClick={onPress}
      className={`flex shrink-0 items-center justify-center rounded-md px-2 font-mono font-bold uppercase ${fontPx ? "" : "text-[11px] tracking-wider"} disabled:opacity-50 ${emphasis ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
      style={{ height: keyHeight, minWidth: 52, touchAction: "manipulation", ...(fontPx ? { fontSize: fontPx } : {}) }}
    >
      {children}
    </button>
  );
}
