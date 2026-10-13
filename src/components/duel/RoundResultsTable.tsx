import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  VERDICT_LABEL,
  VERDICT_TONE,
  formatElapsed,
  roundResultOrder,
  roundVerdict,
  summaryWithoutTime,
} from "@/lib/duel/resultPresentation";
import type { Standing } from "@/lib/duel/scoring";
import { buzz } from "@/lib/motion";
import { cueDurationMs, playRoundWon, playVoice } from "@/lib/sound";

import { AnimatedScore } from "./AnimatedScore";
import { ContinueFooter, type ContinueState } from "./ContinueFooter";

interface RoundResultsTableProps {
  roundTitle: string;
  rows: Standing[];
  times: ReadonlyMap<number, number | null>;
  mySlot: number;
  autoSeconds: number;
  finalRound: boolean;
  continueState: ContinueState;
  /** Replays: the round winner's highlight (display only; never blocks Continue). */
  highlight?: ReactNode;
}

export function RoundResultsTable({
  roundTitle,
  rows,
  times,
  mySlot,
  autoSeconds,
  finalRound,
  continueState,
  highlight,
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
      // A shared top score in a 3+ room is a tie: no voice line for anyone.
      const tied = ordered.filter((row) => row.roundScore === topScore).length > 1;
      if (!tied) playVoice("roundTaken", cueDurationMs("round_won"));
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
          {finalRound ? "Final round" : "This round"}
        </span>
      </header>

      {highlight}

      <ol
        className="grid min-h-0 flex-1 gap-1.5"
        style={{ gridTemplateRows: `repeat(${ordered.length}, minmax(0, 1fr))` }}
      >
        {ordered.map((row, index) => {
          const isMe = row.slot === mySlot;
          const won = row.roundScore > 0 && row.roundScore === topScore;
          const open = expanded === row.slot;
          const verdict = roundVerdict(row);
          const summary = summaryWithoutTime(row.summary);
          return (
            <li key={row.slot} className="min-h-0">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setExpanded((value) => (value === row.slot ? null : row.slot))}
                className={`grid h-full min-h-[38px] w-full ${finalRound ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[1.25rem_minmax(0,1fr)_auto]"} items-center gap-x-2 rounded-md border px-2 text-left ${
                  isMe ? "border-primary/70 bg-primary/10" : "border-border bg-card"
                } ${row.status === "inactive" ? "opacity-40" : ""}`}
              >
                {/* Last round: no positions, so the overall winner stays hidden until the reveal. */}
                {!finalRound && (
                  <span className="font-mono text-xs font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                )}
                <span className="min-w-0 self-center">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-display text-xs font-semibold text-foreground">
                      {row.name}
                    </span>
                    {won && (
                      <span className="shrink-0 rounded border border-primary px-1 py-0.5 font-mono text-[9px] font-bold uppercase leading-none text-primary">
                        Round won
                      </span>
                    )}
                    <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-foreground/80">
                      {formatElapsed(times.get(row.slot) ?? null)}
                    </span>
                  </span>
                  <span
                    className={`block font-mono text-[11px] leading-tight text-foreground/80 ${open ? "whitespace-normal" : "truncate"}`}
                  >
                    <span data-verdict={verdict} className={`font-bold ${VERDICT_TONE[verdict]}`}>
                      {VERDICT_LABEL[verdict]}
                    </span>
                    {summary ? ` · ${open ? [summary, ...row.detail].join(" · ") : summary}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <AnimatedScore
                    value={row.roundScore}
                    className={`w-12 text-right font-mono text-xl font-bold tabular-nums ${won ? "text-primary" : "text-foreground"}`}
                  />
                  <span aria-hidden="true" className="w-3 text-center font-mono text-[11px] text-muted-foreground">
                    {open ? "▴" : "▾"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <ContinueFooter next={finalRound ? "Winner" : "Standings"} autoSeconds={autoSeconds} state={continueState} />
    </div>
  );
}
