import { useRef, useState, type ReactNode } from "react";
import "@/polish-word/word-look.css";
import "@/polish-word/keypad.css";
import { wordCue } from "@/components/puzzles/wordFinish";

import { NO_SCROLL_STYLE } from "@/components/puzzles/noScroll";
import { useGameKeys } from "@/lib/desktop";

/**
 * Shared on-screen QWERTY keypad (Strikeout, Cryptogrid). Plain buttons only:
 * no text input is ever focused, so the phone keyboard never opens and the
 * page never scrolls to make room for it.
 *
 * The Word overhaul (15 Nov 2026): rendered keycaps (public/word-art/key.webp) about 52 px tall in thumb reach, a
 * pop-up preview of the letter above the key while it is pressed (as a phone keyboard does), and a soft typewriter
 * click on every key press (the named cue `word.key`, docs/sound-cues/word-elevenlabs.md).
 */

/** The overhaul's key height (the stage may pass a smaller one where the height is short). */
export const KEY_HEIGHT = 52;
/** Each keyboard's key-press cue (`<game>.key`; a placeholder file behind NEW_GAME_SOUNDS until Joe's recording). */
export type KeyCue = "strikeout.key" | "codeword.key";

export type KeyTone = "plain" | "gold" | "red" | "used" | "pending";

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] as const;

/** Each tone's rendered material (word-look.css). */
const WA_TONE: Record<KeyTone, string | undefined> = { plain: undefined, gold: "gold", red: "red", used: "dim", pending: "pending" };

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
  /** The game's key-press cue (the Word overhaul: a soft typewriter click on every key). */
  keyCue?: KeyCue;
}

export function LetterKeypad({ onLetter, tone, disabled, locked = false, left, right, keyHeight = KEY_HEIGHT, keyFontPx, keyCue }: LetterKeypadProps) {
  const box = useRef<HTMLDivElement>(null);
  // The pop-up preview: the pressed key's letter, drawn above it while the finger is down.
  const [preview, setPreview] = useState<{ letter: string; x: number; y: number; w: number } | null>(null);
  const press = (letter: string) => {
    if (keyCue) wordCue(keyCue);
    onLetter(letter);
  };
  // Desktop keys: typing a letter presses its key; Backspace (or Delete) presses the action left of the
  // bottom row (Delete, Clear) and Enter the one right of it (Solve, Next), exactly as a tap on them.
  useGameKeys((kind, key, event) => {
    if (/^[a-z]$/.test(key)) {
      const letter = key.toUpperCase();
      if (kind === "down" && !locked && !(disabled?.(letter) ?? false)) press(letter);
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
      data-word-keypad=""
      className="relative flex w-full shrink-0 select-none flex-col gap-1.5 px-0.5"
      style={NO_SCROLL_STYLE}
      // Keep focus where it is: a tapped key must never pull focus or scroll.
      onPointerDown={(event) => event.preventDefault()}
      onPointerUp={() => setPreview(null)}
      onPointerCancel={() => setPreview(null)}
      onPointerLeave={() => setPreview(null)}
    >
      {preview ? (
        <span
          aria-hidden="true"
          data-key-preview={preview.letter}
          className="key-preview pointer-events-none absolute z-20"
          style={{ left: preview.x, top: preview.y, width: Math.max(44, preview.w + 12) }}
        >
          {preview.letter}
        </span>
      ) : null}
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
                data-wa="key"
                data-wa-tone={WA_TONE[tone?.(letter) ?? "plain"]}
                onPointerDown={(event) => {
                  if (off) return;
                  const k = event.currentTarget.getBoundingClientRect();
                  const b = box.current?.getBoundingClientRect();
                  if (b) setPreview({ letter, x: k.left - b.left + k.width / 2, y: k.top - b.top, w: k.width });
                }}
                onClick={() => press(letter)}
                className={`flex min-w-0 flex-1 items-center justify-center rounded-md font-display text-xl font-bold transition-colors disabled:cursor-default ${TONE[tone?.(letter) ?? "plain"]} ${off ? "opacity-70" : ""}`}
                style={{ height: keyHeight, maxWidth: 44, touchAction: "manipulation", ...(keyFontPx ? { fontSize: keyFontPx } : {}) }}
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
  keyHeight = KEY_HEIGHT,
  fontPx,
  keyCue,
}: {
  /** The game's key-press cue (as LetterKeypad's). */
  keyCue?: KeyCue;
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
      onClick={() => {
        if (keyCue) wordCue(keyCue);
        onPress();
      }}
      data-wa-btn={emphasis ? "gold" : "navy"}
      className={`flex shrink-0 items-center justify-center rounded-md px-2 font-mono font-bold uppercase ${fontPx ? "" : "text-[12px] tracking-wider"} disabled:opacity-50 ${emphasis ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
      style={{ height: keyHeight, minWidth: 52, touchAction: "manipulation", ...(fontPx ? { fontSize: fontPx } : {}) }}
    >
      {children}
    </button>
  );
}
