import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { puzzleDef } from "@/lib/duel/registry";
import { INTRO_SCORE } from "@/lib/duel/introScore";
import { soundCue } from "@/lib/fx/soundCues";
import type { PuzzleType } from "@/lib/duel/types";

interface PuzzleInstructionsProps {
  type: PuzzleType;
  overlay?: boolean;
  /** Shown between HOW and SCORE (the intro's demo box, IntroStage, which takes the spare height). */
  beforeScore?: ReactNode;
}

export function PuzzleInstructions({ type, overlay = false, beforeScore }: PuzzleInstructionsProps) {
  const instructions = puzzleDef(type).instructions;

  return (
    <section
      className={
        overlay
          ? "flex w-full flex-col gap-4"
          : `round-instructions flex w-full flex-col gap-2 ${beforeScore ? "min-h-0 flex-1" : "shrink-0"}`
      }
      aria-label={`${puzzleDef(type).name} instructions`}
    >
      <div className="intro-goal shrink-0">
        <p className="font-mono text-[11px] font-bold uppercase text-category-accent">Goal</p>
        <p
          className={`font-display font-bold leading-tight text-foreground ${overlay ? "text-2xl" : "text-lg"}`}
        >
          {instructions.goal}
        </p>
      </div>
      <div className="intro-how shrink-0">
        <p className="font-mono text-[11px] font-bold uppercase text-category-accent">How</p>
        <div className="flex flex-col gap-0.5 text-sm leading-snug text-muted-foreground">
          {instructions.how.filter((line) => overlay || !line.helpOnly).map((line) => (
            <p key={`${line.action}-${line.detail}`}>
              <strong className="font-bold text-foreground">{line.action}</strong> {line.detail}
            </p>
          ))}
        </div>
      </div>
      {beforeScore}
      <div className="intro-score shrink-0">
        <p className="font-mono text-[11px] font-bold uppercase text-category-accent">Score</p>
        <p className="text-sm leading-snug text-muted-foreground">{overlay ? instructions.score : INTRO_SCORE[type]}</p>
      </div>
    </section>
  );
}

/** Puzzles whose "?" card repeats the intro's worked example. */
function HelpExample({ type }: { type: PuzzleType }) {
  const Example = puzzleDef(type).IntroExample;
  return (
    <div className="mt-3 flex justify-center">
      <Example />
    </div>
  );
}

interface PuzzleHelpProps {
  type: PuzzleType;
  open: boolean;
  onClose: () => void;
}

export function PuzzleHelp({ type, open, onClose }: PuzzleHelpProps) {
  useEffect(() => {
    if (!open) return;
    soundCue("shared.help.open");
    return () => soundCue("shared.help.close");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  // The sheet sits over the game region. Its body is its own scroll container
  // (help-sheet-scroll: pan-y, contained overscroll, data-scrollable for the
  // game screen's touch blockers), so an arena's touch-action none or a board's
  // touchmove guard never stops it scrolling, and the page and game behind never
  // move. The close button sits outside the scroller and is always on screen.
  return (
    <div
      role="presentation"
      data-help-sheet
      className="absolute inset-0 z-40 flex cursor-pointer flex-col items-stretch justify-start bg-background/90 px-3 pb-2 pt-2 backdrop-blur-sm"
      onClick={onClose}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${puzzleDef(type).name} help`}
        className="th-sheet flex max-h-full min-h-0 w-full cursor-default flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div data-help-header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          <p className="min-w-0 flex-1 text-sm font-bold text-foreground">The clock keeps running while this is open.</p>
          <button
            type="button"
            data-help-close
            aria-label="Close help"
            onClick={onClose}
            className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background font-display text-xl font-bold leading-none text-foreground"
          >
            ×
          </button>
        </div>
        <div data-help-scroll data-scrollable className="help-sheet-scroll min-h-0 flex-1 px-4 pb-4 pt-3">
          <PuzzleInstructions type={type} overlay />
          {type === "lightup" && <HelpExample type={type} />}
          <p className="mt-4 text-center font-mono text-xs uppercase text-muted-foreground">
            Tap outside or × to close
          </p>
        </div>
      </div>
    </div>
  );
}

interface PuzzleHelpButtonProps {
  onClick: () => void;
}

/**
 * The 28px circle is all that is drawn; an invisible ::before makes the hit area 44 x 44
 * (Batch 4 fix-up, 17 Oct 2026): 8px above and below the circle and 16px to its left (the
 * insets count from inside its 1px border), over the title or the empty side of the arcade
 * header, never the control after it. z-10 keeps the puzzle timer row under it from taking
 * its lower 8px. The button's box and the header's layout are unchanged.
 */
export function PuzzleHelpButton({ onClick }: PuzzleHelpButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Show puzzle instructions"
      title="Show puzzle instructions"
      onClick={onClick}
      className="relative z-10 h-7 w-7 shrink-0 rounded-full border-border bg-card p-0 font-display text-base font-bold text-foreground shadow-none before:absolute before:-inset-y-[9px] before:-left-[17px] before:-right-px before:content-['']"
    >
      ?
    </Button>
  );
}
