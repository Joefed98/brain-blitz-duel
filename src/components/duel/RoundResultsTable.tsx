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
import { Medal } from "./Medal";
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
        <p className="th-kicker text-primary">Round results</p>
        <h1 className="mt-1 break-words font-display text-sm font-bold text-foreground">
          {roundTitle}
        </h1>
        {best && <p className="font-mono text-[11px] text-foreground/80">{best}</p>}
        <span className="th-kicker absolute right-0 top-0 whitespace-nowrap text-[10px] tracking-[0.06em] text-muted-foreground">
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
                data-tint={isMe ? "me" : undefined}
                className={`th-card grid min-h-[44px] w-full ${finalRound ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[1.375rem_minmax(0,1fr)_auto]"} items-center gap-x-2 rounded-lg border px-2 py-1 text-left ${
                  isMe ? "border-primary/70 bg-primary/10" : "border-border bg-card"
                } ${row.status === "inactive" ? "opacity-40" : ""}`}
              >
                {/* Last round: no positions, so the overall winner stays hidden until the reveal. */}
                {!finalRound && <Medal place={index + 1} />}
                <span className="min-w-0 self-center">
                  <span className="flex min-w-0 items-center gap-2">
                    <PlayerBadge look={looks?.get(row.slot)} name={row.name} size={24} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="th-name truncate text-sm leading-tight text-foreground">
                          {row.name}
                        </span>
                        {won && (
                          <span data-tone="gold" className="th-pill shrink-0">
                            Round won
                          </span>
                        )}
                      </span>
                      {/* Below the name only the time used (the buzzer shows the round's full clock). */}
                      <span className="whitespace-nowrap font-mono text-[11px] leading-tight tabular-nums text-muted-foreground">
                        {formatElapsed(times.get(row.slot) ?? null, clockMs)}
                      </span>
                    </span>
                  </span>
                  {/* Tapped open: how the round went, in full. */}
                  {open && (
                    <span className="mt-1 block whitespace-normal font-mono text-[11px] leading-tight text-foreground/80">
                      <span data-verdict={verdict} className={`font-bold ${VERDICT_TONE[verdict]}`}>
                        {VERDICT_LABEL[verdict]}
                      </span>
                      {summary ? ` · ${[summary, ...row.detail].join(" · ")}` : ""}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <AnimatedScore
                    value={row.roundScore}
                    className={`th-score w-14 text-right font-mono text-2xl font-bold tabular-nums ${won ? "th-score-top text-primary" : "text-foreground"}`}
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
