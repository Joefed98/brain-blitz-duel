import { useEffect, useRef } from "react";

import { MAX_ROUND_SCORE } from "@/lib/duel/scoring";
import { cueDurationMs, playRoundWon, playVoice } from "@/lib/sound";
import {
  VERDICT_LABEL,
  VERDICT_TONE,
  summaryWithoutTime,
  type RoundVerdict,
} from "@/lib/duel/resultPresentation";

import { AnimatedScore } from "./AnimatedScore";
import { ContinueFooter, type ContinueState } from "./ContinueFooter";

function SummaryLine({ verdict, summary }: { verdict: RoundVerdict; summary: string }) {
  const rest = summaryWithoutTime(summary);
  return (
    <p title={summary} className="mt-1 font-mono text-[11px] leading-snug text-foreground/80">
      <span data-verdict={verdict} className={`font-bold ${VERDICT_TONE[verdict]}`}>
        {VERDICT_LABEL[verdict]}
      </span>
      {rest ? ` · ${rest}` : ""}
    </p>
  );
}

interface RoundResultProps {
  roundTitle: string;
  myName: string;
  opponentName: string;
  myRoundScore: number;
  myVerdict: RoundVerdict;
  mySummary: string;
  myTime: string;
  opponentRoundScore: number;
  opponentVerdict: RoundVerdict;
  opponentSummary: string;
  opponentTime: string;
  autoSeconds: number;
  finalRound: boolean;
  continueState: ContinueState;
}

export function RoundResult({
  roundTitle,
  myName,
  opponentName,
  myRoundScore,
  myVerdict,
  mySummary,
  myTime,
  opponentRoundScore,
  opponentVerdict,
  opponentSummary,
  opponentTime,
  autoSeconds,
  finalRound,
  continueState,
}: RoundResultProps) {
  const iWon = myRoundScore > opponentRoundScore;
  const theyWon = opponentRoundScore > myRoundScore;
  const cued = useRef(false);

  // Winner: round-won cue then "round taken"; two-player loser: "round lost". Ties: neither.
  useEffect(() => {
    if (cued.current) return;
    cued.current = true;
    if (iWon) { playRoundWon(); playVoice("roundTaken", cueDurationMs("round_won")); }
    else if (theyWon) playVoice("roundLost");
  }, [iWon, theyWon]);

  const bar = (score: number) => `${Math.round((score / MAX_ROUND_SCORE) * 100)}%`;

  return (
    <div className="flex flex-1 flex-col justify-between gap-6 pt-4 animate-phase-in">
      <div className="flex flex-col gap-6">
        <div className="relative px-12 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Round results
          </p>
          <p className="mt-1 break-words font-display text-sm font-bold text-foreground">
            {roundTitle}
          </p>
          <span className="absolute right-0 top-0 font-mono text-[10px] uppercase text-muted-foreground">
            {finalRound ? "Final round" : "This round"}
          </span>
        </div>

        <div className="flex gap-3">
          <div
            className={`flex-1 rounded-2xl border p-4 transition-opacity ${
              iWon ? "border-me/60 bg-me/10" : "border-border bg-card"
            } ${theyWon ? "opacity-60" : ""}`}
          >
            <p className="truncate font-display text-sm text-me">{myName}</p>
            <p className="font-mono text-[11px] tabular-nums text-foreground/80">{myTime}</p>
            <SummaryLine verdict={myVerdict} summary={mySummary} />
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-me">
              <AnimatedScore value={myRoundScore} />
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-me transition-[width] duration-500 ease-out"
                style={{ width: bar(myRoundScore) }}
              />
            </div>
            {iWon && (
              <span className="mt-3 inline-block rounded-full bg-me px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground animate-tag-slam">
                Round won
              </span>
            )}
          </div>
          <div
            className={`flex-1 rounded-2xl border p-4 text-right transition-opacity ${
              theyWon ? "border-opponent/60 bg-opponent/10" : "border-border bg-card"
            } ${iWon ? "opacity-60" : ""}`}
          >
            <p className="truncate font-display text-sm text-opponent">{opponentName}</p>
            <p className="font-mono text-[11px] tabular-nums text-foreground/80">{opponentTime}</p>
            <SummaryLine verdict={opponentVerdict} summary={opponentSummary} />
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-opponent">
              <AnimatedScore value={opponentRoundScore} />
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-background">
              <div
                className="ml-auto h-full rounded-full bg-opponent transition-[width] duration-500 ease-out"
                style={{ width: bar(opponentRoundScore) }}
              />
            </div>
            {theyWon && (
              <span className="mt-3 inline-block rounded-full bg-opponent px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-background animate-tag-slam">
                Round won
              </span>
            )}
          </div>
        </div>
      </div>

      <ContinueFooter next={finalRound ? "Winner" : "Standings"} autoSeconds={autoSeconds} state={continueState} />
    </div>
  );
}
