import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { puzzleDef } from "@/lib/duel/registry";
import { INTRO_SCORE } from "@/lib/duel/introScore";
import type { PuzzleType } from "@/lib/duel/types";

interface PuzzleInstructionsProps {
  type: PuzzleType;
  overlay?: boolean;
  /** Shown between HOW and SCORE (intro demo). */
  beforeScore?: ReactNode;
}

export function PuzzleInstructions({ type, overlay = false, beforeScore }: PuzzleInstructionsProps) {
  const instructions = puzzleDef(type).instructions;

  return (
    <section
      className={
        overlay ? "flex w-full flex-col gap-4" : "round-instructions flex w-full flex-col gap-2"
      }
      aria-label={`${puzzleDef(type).name} instructions`}
    >
      <div>
        <p className="font-mono text-[10px] font-bold uppercase text-category-accent">Goal</p>
        <p
          className={`font-display font-bold leading-tight text-foreground ${overlay ? "text-2xl" : "text-lg"}`}
        >
          {instructions.goal}
        </p>
      </div>
      <div>
        <p className="font-mono text-[10px] font-bold uppercase text-category-accent">How</p>
        <div className="flex flex-col gap-0.5 text-sm leading-snug text-muted-foreground">
          {instructions.how.map((line) => (
            <p key={`${line.action}-${line.detail}`}>
              <strong className="font-bold text-foreground">{line.action}</strong> {line.detail}
            </p>
          ))}
        </div>
      </div>
      {beforeScore}
      <div>
        <p className="font-mono text-[10px] font-bold uppercase text-category-accent">Score</p>
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
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="absolute inset-0 z-40 flex cursor-pointer items-start justify-center bg-background/90 px-3 pt-2 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${puzzleDef(type).name} help`}
        className="w-full rounded-lg border border-border bg-card p-4 shadow-xl"
      >
        <PuzzleInstructions type={type} overlay />
        {type === "lightup" && <HelpExample type={type} />}
        <p className="mt-4 text-center font-mono text-[10px] uppercase text-muted-foreground">
          Tap anywhere to close
        </p>
      </div>
    </div>
  );
}

interface PuzzleHelpButtonProps {
  onClick: () => void;
}

export function PuzzleHelpButton({ onClick }: PuzzleHelpButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Show puzzle instructions"
      title="Show puzzle instructions"
      onClick={onClick}
      className="h-7 w-7 shrink-0 rounded-full border-border bg-card p-0 font-display text-base font-bold text-foreground shadow-none"
    >
      ?
    </Button>
  );
}
