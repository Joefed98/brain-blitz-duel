import { useEffect, useRef } from "react";

import { MAX_ROUND_SCORE } from "@/lib/duel/scoring";
import { playRoundWon } from "@/lib/sound";
import { Button } from "@/components/ui/button";

import { AnimatedScore } from "./AnimatedScore";

interface RoundResultProps {
  roundTitle: string;
  myName: string;
  opponentName: string;
  myRoundScore: number;
  mySummary: string;
  myTime: string;
  opponentRoundScore: number;
  opponentSummary: string;
  opponentTime: string;
  autoSeconds: number;
  finalRound: boolean;
  isHost: boolean;
  onNext: () => void;
}

export function RoundResult({
  roundTitle,
  myName,
  opponentName,
  myRoundScore,
  mySummary,
  myTime,
  opponentRoundScore,
  opponentSummary,
  opponentTime,
  autoSeconds,
  finalRound,
  isHost,
  onNext,
}: RoundResultProps) {
  const iWon = myRoundScore > opponentRoundScore;
  const theyWon = opponentRoundScore > myRoundScore;
  const cued = useRef(false);

  // Only the round's top scorer hears the round-won cue.
  useEffect(() => {
    if (cued.current) return;
    cued.current = true;
    if (iWon) playRoundWon();
  }, [iWon]);

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
            {finalRound ? "Final round" : "1 of 2"}
          </span>
        </div>

        <div className="flex gap-3">
          <div
            className={`flex-1 rounded-2xl border p-4 transition-opacity ${
              iWon ? "border-me/60 bg-me/10" : "border-border bg-card"
            } ${theyWon ? "opacity-60" : ""}`}
          >
            <p className="truncate font-display text-sm text-me">{myName}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{myTime}</p>
            <p
              title={mySummary}
              className="mt-1 font-mono text-[10px] leading-snug text-primary/80"
            >
              {mySummary}
            </p>
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
            <p className="font-mono text-[10px] text-muted-foreground">{opponentTime}</p>
            <p
              title={opponentSummary}
              className="mt-1 font-mono text-[10px] leading-snug text-muted-foreground"
            >
              {opponentSummary}
            </p>
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

      <div className="flex flex-col gap-2">
        {isHost && (
          <Button
            onClick={onNext}
            className="press tap-target w-full font-display font-bold uppercase"
          >
            {finalRound ? "Podium" : "Next"} ({autoSeconds}s)
          </Button>
        )}
        <p className="text-center font-mono text-xs text-muted-foreground">
          {finalRound ? "Podium" : "Standings"} in {autoSeconds}s
        </p>
      </div>
    </div>
  );
}
