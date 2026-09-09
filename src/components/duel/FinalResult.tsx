import { puzzleName } from "@/lib/duel/registry";
import type { PuzzleType } from "@/lib/duel/types";
import type { Outcome } from "@/lib/duel/scoring";

interface FinalResultProps {
  outcome: Outcome;
  myName: string;
  opponentName: string;
  myTotal: number;
  opponentTotal: number;
  breakdown: { round: number; mine: number; theirs: number }[];
  roundOrder: PuzzleType[];
  busy: boolean;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function FinalResult({
  outcome,
  myName,
  opponentName,
  myTotal,
  opponentTotal,
  breakdown,
  roundOrder,
  busy,
  onPlayAgain,
  onHome,
}: FinalResultProps) {
  const headline = outcome === "win" ? "WIN" : outcome === "loss" ? "LOSS" : "DRAW";
  const headlineColor =
    outcome === "win" ? "text-me" : outcome === "loss" ? "text-warn" : "text-foreground";

  return (
    <div className="flex flex-1 flex-col justify-between gap-8 pt-8">
      <div className="flex flex-col gap-8">
        <h1 className={`text-center font-display text-6xl font-bold ${headlineColor}`}>
          {headline}
        </h1>

        <div className="flex items-end justify-center gap-4">
          <div className="text-center">
            <p className="max-w-[110px] truncate text-xs uppercase tracking-widest text-me">
              {myName}
            </p>
            <p className="font-mono text-4xl font-bold tabular-nums text-me">{myTotal}</p>
          </div>
          <span className="pb-2 font-mono text-2xl text-muted-foreground">–</span>
          <div className="text-center">
            <p className="max-w-[110px] truncate text-xs uppercase tracking-widest text-opponent">
              {opponentName}
            </p>
            <p className="font-mono text-4xl font-bold tabular-nums text-opponent">
              {opponentTotal}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-card">
          {breakdown.map((row) => (
            <div
              key={row.round}
              className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0"
            >
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {puzzleName(roundOrder[row.round - 1] ?? "anagram")}
              </span>
              <span className="font-mono text-sm font-bold tabular-nums">
                <span className="text-me">{row.mine}</span>
                <span className="mx-2 text-muted-foreground">–</span>
                <span className="text-opponent">{row.theirs}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onPlayAgain}
          disabled={busy}
          className="tap-target w-full rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
        >
          {busy ? "Setting up…" : "Play again"}
        </button>
        <button
          type="button"
          onClick={onHome}
          className="tap-target w-full rounded-xl border border-border font-display text-base font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Home
        </button>
      </div>
    </div>
  );
}
