import { AnimatedScore } from "./AnimatedScore";

interface RoundResultProps {
  round: number;
  myName: string;
  opponentName: string;
  myRoundScore: number;
  opponentRoundScore: number;
  myTotal: number;
  opponentTotal: number;
  autoSeconds: number;
  ready: boolean;
  onNext: () => void;
}

export function RoundResult({
  round,
  myName,
  opponentName,
  myRoundScore,
  opponentRoundScore,
  myTotal,
  opponentTotal,
  autoSeconds,
  ready,
  onNext,
}: RoundResultProps) {
  const iWon = myRoundScore > opponentRoundScore;
  const theyWon = opponentRoundScore > myRoundScore;

  return (
    <div className="flex flex-1 flex-col justify-between gap-8 pt-6">
      <div className="flex flex-col gap-6">
        <p className="text-center text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Round {round} result
        </p>

        <div className="flex gap-3">
          <div className="flex-1 rounded-2xl border border-me/40 bg-me/10 p-4">
            <p className="truncate font-display text-sm text-me">{myName}</p>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-me">
              {myRoundScore}
            </p>
            {iWon && (
              <span className="mt-3 inline-block rounded-full bg-me px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                Round won
              </span>
            )}
          </div>
          <div className="flex-1 rounded-2xl border border-opponent/40 bg-opponent/10 p-4 text-right">
            <p className="truncate font-display text-sm text-opponent">{opponentName}</p>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-opponent">
              {opponentRoundScore}
            </p>
            {theyWon && (
              <span className="mt-3 inline-block rounded-full bg-opponent px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-background">
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
          className="tap-target w-full rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
        >
          {ready ? "Waiting for opponent…" : "Next round"}
        </button>
        <p className="text-center font-mono text-xs text-muted-foreground">
          Continues automatically in {autoSeconds}s
        </p>
      </div>
    </div>
  );
}
