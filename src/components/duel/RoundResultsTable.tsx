import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatElapsed, roundResultOrder } from "@/lib/duel/resultPresentation";
import type { Standing } from "@/lib/duel/scoring";
import { buzz } from "@/lib/motion";
import { cueDurationMs, playRoundWon, playVoice } from "@/lib/sound";

import { AnimatedScore } from "./AnimatedScore";

interface RoundResultsTableProps {
  roundTitle: string;
  rows: Standing[];
  times: ReadonlyMap<number, number | null>;
  mySlot: number;
  autoSeconds: number;
  isHost: boolean;
  finalRound: boolean;
  onNext: () => void;
}

export function RoundResultsTable({
  roundTitle,
  rows,
  times,
  mySlot,
  autoSeconds,
  isHost,
  finalRound,
  onNext,
}: RoundResultsTableProps) {
  const ordered = roundResultOrder(rows, times);
  const topScore = Math.max(0, ...ordered.map((row) => row.roundScore));
  const [expanded, setExpanded] = useState<number | null>(null);
  const cued = useRef(false);

  useEffect(() => {
    if (cued.current) return;
    cued.current = true;
    const mine = ordered.find((row) => row.slot === mySlot);
    if (mine && mine.roundScore > 0 && mine.roundScore === topScore) {
      playRoundWon();
      playVoice("roundTaken", cueDurationMs("round_won"));
      buzz(12);
    }
  }, [mySlot, ordered, topScore]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-2 animate-phase-in">
      <header className="relative shrink-0 px-12 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          Round results
        </p>
        <h1 className="mt-1 break-words font-display text-sm font-bold text-foreground">
          {roundTitle}
        </h1>
        <span className="absolute right-0 top-0 font-mono text-[10px] uppercase text-muted-foreground">
          {finalRound ? "Final round" : "1 of 2"}
        </span>
      </header>

      <ol
        className="grid min-h-0 flex-1 gap-1.5"
        style={{ gridTemplateRows: `repeat(${ordered.length}, minmax(0, 1fr))` }}
      >
        {ordered.map((row, index) => {
          const isMe = row.slot === mySlot;
          const won = row.roundScore > 0 && row.roundScore === topScore;
          const open = expanded === row.slot;
          return (
            <li key={row.slot} className="min-h-0">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setExpanded((value) => (value === row.slot ? null : row.slot))}
                className={`grid h-full min-h-[38px] w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md border px-2 text-left ${
                  isMe ? "border-primary/70 bg-primary/10" : "border-border bg-card"
                } ${row.status === "inactive" ? "opacity-40" : ""}`}
              >
                <span className="font-mono text-xs font-bold text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0 self-center">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-display text-xs font-semibold text-foreground">
                      {row.name}
                    </span>
                    {won && (
                      <span className="shrink-0 rounded border border-primary px-1 py-0.5 font-mono text-[7px] font-bold uppercase text-primary">
                        Round won
                      </span>
                    )}
                    <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground">
                      {formatElapsed(times.get(row.slot) ?? null)}
                    </span>
                  </span>
                  <span
                    className={`block font-mono text-[9px] leading-tight text-muted-foreground ${open ? "whitespace-normal" : "truncate"}`}
                  >
                    {open ? [row.summary, ...row.detail].join(" · ") : row.summary}
                  </span>
                </span>
                <AnimatedScore
                  value={row.roundScore}
                  className={`w-12 text-right font-mono text-xl font-bold tabular-nums ${won ? "text-primary" : "text-foreground"}`}
                />
              </button>
            </li>
          );
        })}
      </ol>

      <footer className="shrink-0 pt-1">
        {isHost ? (
          <Button
            className="press tap-target w-full font-display font-bold uppercase"
            onClick={onNext}
          >
            {finalRound ? `Podium (${autoSeconds}s)` : `Next (${autoSeconds}s)`}
          </Button>
        ) : (
          <p className="text-center font-mono text-xs uppercase text-muted-foreground">
            {finalRound ? "Podium" : "Standings"} in {autoSeconds}s
          </p>
        )}
      </footer>
    </div>
  );
}
