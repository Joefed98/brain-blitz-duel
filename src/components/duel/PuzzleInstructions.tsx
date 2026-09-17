import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { puzzleDef } from "@/lib/duel/registry";
import type { PuzzleType } from "@/lib/duel/types";

interface PuzzleInstructionsProps {
  type: PuzzleType;
  overlay?: boolean;
}

export function PuzzleInstructions({ type, overlay = false }: PuzzleInstructionsProps) {
  const instructions = puzzleDef(type).instructions;

  return (
    <section
      className={
        overlay ? "flex w-full flex-col gap-4" : "round-instructions flex w-full flex-col gap-2"
      }
      aria-label={`${puzzleDef(type).name} instructions`}
    >
      <div>
        <p className="font-mono text-[10px] font-bold uppercase text-primary">Goal</p>
        <p
          className={`font-display font-bold leading-tight text-foreground ${overlay ? "text-2xl" : "text-lg"}`}
        >
          {instructions.goal}
        </p>
      </div>
      <div>
        <p className="font-mono text-[10px] font-bold uppercase text-primary">How</p>
        <div className="flex flex-col gap-0.5 text-sm leading-snug text-muted-foreground">
          {instructions.how.map((line) => (
            <p key={`${line.action}-${line.detail}`}>
              <strong className="font-bold text-foreground">{line.action}</strong> {line.detail}
            </p>
          ))}
        </div>
      </div>
      <div>
        <p className="font-mono text-[10px] font-bold uppercase text-primary">Score</p>
        <p className="text-sm leading-snug text-muted-foreground">{instructions.score}</p>
      </div>
    </section>
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
