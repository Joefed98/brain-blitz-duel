import type { PlayerLooks } from "@/lib/duel/playerLook";
import type { Standing } from "@/lib/duel/scoring";
import { TOTAL_ROUNDS } from "@/lib/duel/types";
import { positionChange } from "@/lib/duel/resultPresentation";
import { AnimatedScore } from "./AnimatedScore";
import { ContinueFooter, type ContinueState } from "./ContinueFooter";
import { PlayerBadge } from "./PlayerBadge";

interface DuelOverallProps {
  round: number;
  /** The room's own round count; older rooms default to six. */
  totalRounds?: number;
  rows: Standing[];
  /** Everyone's colour and icon. */
  looks?: PlayerLooks;
  mySlot: number;
  autoSeconds: number;
  continueState: ContinueState;
}

export function DuelOverall({
  round,
  totalRounds = TOTAL_ROUNDS,
  rows,
  looks,
  mySlot,
  autoSeconds,
  continueState,
}: DuelOverallProps) {
  const ordered = [...rows].sort((a, b) => a.position - b.position || a.slot - b.slot);
  return (
    <div className="flex flex-1 flex-col justify-between gap-6 pt-8 animate-phase-in">
      <div>
        <header className="relative px-12 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            Overall standings
          </p>
          <h1 className="mt-1 font-display text-lg font-bold text-foreground">
            After round {round} of {totalRounds}
          </h1>
          <span className="absolute right-0 top-0 font-mono text-[11px] uppercase text-muted-foreground">
            Overall
          </span>
        </header>
        <div className="mt-12 flex items-center gap-3">
          {ordered.map((row, index) => {
            const isMe = row.slot === mySlot;
            return (
              <div
                key={row.slot}
                className={`min-w-0 flex-1 rounded-md border p-4 text-center ${isMe ? "border-primary/70 bg-primary/10" : "border-border bg-card"} ${row.status === "inactive" ? "opacity-40" : ""}`}
              >
                <p className="flex min-w-0 items-center justify-center gap-1.5 font-display text-sm font-semibold text-foreground">
                  <PlayerBadge look={looks?.get(row.slot)} name={row.name} size={20} />
                  <span className="truncate">{row.name}</span>
                </p>
                <p className="mt-3 font-mono text-4xl font-bold tabular-nums text-foreground">
                  <AnimatedScore value={row.total} />
                </p>
                <p className="mt-2 font-mono text-xs text-foreground/80">
                  +{row.roundScore} this round · {positionChange(row)}
                </p>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  #{index + 1}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      <ContinueFooter next="Next round" autoSeconds={autoSeconds} state={continueState} />
    </div>
  );
}
