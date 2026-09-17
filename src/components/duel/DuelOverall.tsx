import type { Standing } from "@/lib/duel/scoring";
import { TOTAL_ROUNDS } from "@/lib/duel/types";
import { positionChange } from "@/lib/duel/resultPresentation";
import { Button } from "@/components/ui/button";

import { AnimatedScore } from "./AnimatedScore";

interface DuelOverallProps {
  round: number;
  rows: Standing[];
  mySlot: number;
  autoSeconds: number;
  isHost: boolean;
  onNext: () => void;
}

export function DuelOverall({
  round,
  rows,
  mySlot,
  autoSeconds,
  isHost,
  onNext,
}: DuelOverallProps) {
  const ordered = [...rows].sort((a, b) => a.position - b.position || a.slot - b.slot);
  return (
    <div className="flex flex-1 flex-col justify-between gap-6 pt-8 animate-phase-in">
      <div>
        <header className="relative px-12 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Overall standings
          </p>
          <h1 className="mt-1 font-display text-lg font-bold text-foreground">
            After round {round} of {TOTAL_ROUNDS}
          </h1>
          <span className="absolute right-0 top-0 font-mono text-[10px] uppercase text-muted-foreground">
            2 of 2
          </span>
        </header>
        <div className="mt-12 flex items-center gap-3">
          {ordered.map((row, index) => {
            const isMe = row.slot === mySlot;
            return (
              <div
                key={row.slot}
                className={`min-w-0 flex-1 rounded-md border p-4 text-center ${isMe ? "border-primary/70 bg-primary/10" : "border-border bg-card"} ${row.status === "inactive" ? "opacity-40" : ""}`}
              >
                <p className="truncate font-display text-sm font-semibold text-foreground">
                  {row.name}
                </p>
                <p className="mt-3 font-mono text-4xl font-bold tabular-nums text-foreground">
                  <AnimatedScore value={row.total} />
                </p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  +{row.roundScore} · {positionChange(row)}
                </p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  #{index + 1}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      {isHost ? (
        <Button
          className="press tap-target w-full font-display font-bold uppercase"
          onClick={onNext}
        >
          Next round ({autoSeconds}s)
        </Button>
      ) : (
        <p className="text-center font-mono text-xs uppercase text-muted-foreground">
          Next round in {autoSeconds}s
        </p>
      )}
    </div>
  );
}
