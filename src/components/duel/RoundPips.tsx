import { TOTAL_ROUNDS } from "@/lib/duel/types";

interface RoundPipsProps {
  currentRound: number;
  /** One entry per finished round: did I win it? */
  outcomes: ("win" | "loss" | "draw")[];
}

/** Three pips: gold for rounds won, teal for lost, outlined for the current. */
export function RoundPips({ currentRound, outcomes }: RoundPipsProps) {
  return (
    <div className="flex items-center gap-1.5" aria-label="Round progress">
      {Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
        const round = i + 1;
        const outcome = outcomes[i];
        const cls =
          outcome === "win"
            ? "bg-me border-me"
            : outcome === "loss"
              ? "bg-opponent border-opponent"
              : outcome === "draw"
                ? "bg-muted-foreground border-muted-foreground"
                : round === currentRound
                  ? "border-primary"
                  : "border-border";
        return <span key={round} className={`h-2 w-2 rounded-full border ${cls}`} />;
      })}
    </div>
  );
}
