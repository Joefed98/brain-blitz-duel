import { ordinal } from "@/lib/duel/ordinal";

import { ProgressStrip } from "./ProgressStrip";

interface SoloScoreStripProps {
  name: string;
  total: number;
  position: number;
  playerCount: number;
  compact?: boolean;
}

/**
 * In a room of three or more only the viewer's own total and place are shown —
 * nobody sees anyone else's progress during a round.
 */
export function SoloScoreStrip({ name, total, position, playerCount, compact = false }: SoloScoreStripProps) {
  return (
    <ProgressStrip name={name} value={total} trailing={
      <span className={`shrink-0 font-mono uppercase tracking-widest text-muted-foreground ${compact ? "text-[10px]" : "text-sm"}`}>
        {ordinal(position)} of {playerCount}
      </span>
    } compact={compact} />
  );
}
