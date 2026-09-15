import { MAX_ROUND_SCORE } from "@/lib/duel/scoring";

import { AnimatedScore } from "./AnimatedScore";
import { Dots } from "./Dots";

interface RoundResultProps {
  round: number;
  roundTitle: string;
  myName: string;
  opponentName: string;
  myRoundScore: number;
  mySummary: string;
  opponentRoundScore: number;
  opponentSummary: string;
  myTotal: number;
  opponentTotal: number;
  autoSeconds: number;
  ready: boolean;
  onNext: () => void;
}

export function RoundResult({
  round,
  roundTitle,
  myName,
  opponentName,
  myRoundScore,
  mySummary,
  opponentRoundScore,
  opponentSummary,
  myTotal,
  opponentTotal,
  autoSeconds,
  ready,
  onNext,
}: RoundResultProps) {
  const iWon = myRoundScore > opponentRoundScore;
  const theyWon = opponentRoundScore > myRoundScore;

  const bar = (score: number) => `${Math.round((score / MAX_ROUND_SCORE) * 100)}%`;

  return (
    <div className="flex flex-1 flex-col justify-between gap-8 pt-6 animate-phase-in">
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <p className="break-words font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{roundTitle}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Round {round} result</p>
        </div>

        <div className="flex gap-3">
          <div
            className={`flex-1 rounded-2xl border p-4 transition-opacity ${
              iWon ? "border-me/60 bg-me/10" : "border-border bg-card"
            } ${theyWon ? "opacity-60" : ""}`}
          >
            <p className="truncate font-display text-sm text-me">{myName}</p>
            <p className="mt-1 truncate font-mono text-[10px] text-primary/80">{mySummary}</p>
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
            <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{opponentSummary}</p>
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

        <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Total</span>
          <span className="font-mono text-lg font-bold tabular-nums">
            <AnimatedScore value={myTotal} className="text-me" />
            <span className="mx-2 text-muted-foreground">–</span>
            <AnimatedScore value={opponentTotal} className="text-opponent" />
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onNext}
          disabled={ready}
          className="press tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground"
        >
          {ready ? (
            <>
              <span>Waiting for opponent</span>
              <Dots className="bg-primary-foreground" />
            </>
          ) : (
            "Next round"
          )}
        </button>
        <p className="text-center font-mono text-xs text-muted-foreground">
          Continues automatically in {autoSeconds}s
        </p>
      </div>
    </div>
  );
}
