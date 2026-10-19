import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  VERDICT_LABEL,
  VERDICT_TONE,
  formatElapsed,
  roundResultOrder,
  roundVerdict,
  summaryWithoutTime,
} from "@/lib/duel/resultPresentation";
import type { PlayerLooks } from "@/lib/duel/playerLook";
import type { Standing } from "@/lib/duel/scoring";
import { buzz } from "@/lib/motion";
import { cueDurationMs, playRoundWon, playVoice } from "@/lib/sound";

import { AnimatedScore } from "./AnimatedScore";
import { ContinueFooter, type ContinueState } from "./ContinueFooter";
import { PlayerBadge } from "./PlayerBadge";

interface RoundResultsTableProps {
  roundTitle: string;
  /** A short best-answer line ("Best: 17 moves"), when the game has one. */
  best?: string | null;
  rows: Standing[];
  times: ReadonlyMap<number, number | null>;
  /** The round's own clock, ms: a player who reached the buzzer shows it in full ("90s"). */
  clockMs?: number;
  /** Arcade runs, Flash and Bang On: the verdict is the score alone (scoreOnlyVerdict). */
  scoreOnly?: boolean;
  /** Everyone's colour and icon. */
  looks?: PlayerLooks;
  mySlot: number;
  autoSeconds: number;
  finalRound: boolean;
  continueState: ContinueState;
  /** Replays: the round winner's highlight (display only; never blocks Continue). */
  highlight?: ReactNode;
}

export function RoundResultsTable({
  roundTitle,
  best,
  rows,
  times,
  clockMs,
  scoreOnly = false,
  looks,
  mySlot,
  autoSeconds,
  finalRound,
  continueState,
  highlight,
}: RoundResultsTableProps) {
  const ordered = roundResultOrder(rows, times);
  const topScore = Math.max(0, ...ordered.map((row) => row.roundScore));
  const [expanded, setExpanded] = useState<number | null>(null);
  // Summaries wrap to two lines while the rows still fit the screen; 9–10 players keep one line (tap for all).
  const twoLines = ordered.length <= 8;
  const cued = useRef(false);

  useEffect(() => {
    if (cued.current) return;
    cued.current = true;
    const mine = ordered.find((row) => row.slot === mySlot);
    if (mine && mine.roundScore > 0 && mine.roundScore === topScore) {
      playRoundWon();
      // A shared top score in a 3+ room is a tie: the players sharing it hear "tie" instead.
      const tied = ordered.filter((row) => row.roundScore === topScore).length > 1;
      playVoice(tied ? "voice.tie" : "roundTaken", cueDurationMs("round_won"));
      buzz(12);
    }
  }, [mySlot, ordered, topScore]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-2 animate-phase-in">
      <header className="relative shrink-0 px-12 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
          Round results
        </p>
        <h1 className="mt-1 break-words font-display text-sm font-bold text-foreground">
          {roundTitle}
        </h1>
        {best && <p className="font-mono text-[11px] text-foreground/80">{best}</p>}
        <span className="absolute right-0 top-0 font-mono text-[11px] uppercase text-muted-foreground">
          {finalRound ? "Final round" : "This round"}
        </span>
      </header>

      {highlight}

      {/* Rows take their content's height from the top; the list scrolls if a big room needs it. */}
      <ol className="grid min-h-0 flex-[1_1_0px] content-start gap-1.5 overflow-y-auto">
        {ordered.map((row, index) => {
          const isMe = row.slot === mySlot;
          const won = row.roundScore > 0 && row.roundScore === topScore;
          const open = expanded === row.slot;
          const verdict = roundVerdict(row, scoreOnly);
          const summary = summaryWithoutTime(row.summary);
          return (
            <li key={row.slot}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setExpanded((value) => (value === row.slot ? null : row.slot))}
                className={`grid min-h-[38px] w-full ${finalRound ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[1.25rem_minmax(0,1fr)_auto]"} items-center gap-x-2 rounded-md border px-2 py-1 text-left ${
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
                    <PlayerBadge look={looks?.get(row.slot)} name={row.name} size={18} />
                    <span className="truncate font-display text-xs font-semibold text-foreground">
                      {row.name}
                    </span>
                    {won && (
                      <span className="shrink-0 rounded border border-primary px-1 py-0.5 font-mono text-[11px] font-bold uppercase leading-none text-primary">
                        Round won
                      </span>
                    )}
                    <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-foreground/80">
                      {formatElapsed(times.get(row.slot) ?? null, clockMs)}
                    </span>
                  </span>
                  <span
                    className={`font-mono text-[11px] leading-tight text-foreground/80 ${open ? "block whitespace-normal" : twoLines ? "line-clamp-2" : "block truncate"}`}
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
