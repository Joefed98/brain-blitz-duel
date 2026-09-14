import { ordinal } from "@/lib/duel/ordinal";

import { AnimatedScore } from "./AnimatedScore";

interface SoloScoreStripProps {
  name: string;
  total: number;
  position: number;
  playerCount: number;
}

/**
 * In a room of three or more only the viewer's own total and place are shown —
 * nobody sees anyone else's progress during a round.
 */
export function SoloScoreStrip({ name, total, position, playerCount }: SoloScoreStripProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-3 py-2">
      <div>
        <p className="truncate text-[11px] uppercase tracking-widest text-primary">{name}</p>
        <AnimatedScore
          value={total}
          className="font-mono text-xl font-bold tabular-nums text-primary"
        />
      </div>
      <span className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        {ordinal(position)} of {playerCount}
      </span>
    </div>
  );
}
