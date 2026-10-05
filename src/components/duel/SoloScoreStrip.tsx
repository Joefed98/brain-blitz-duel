import { ordinal } from "@/lib/duel/ordinal";

import { ProgressStrip } from "./ProgressStrip";

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
    <ProgressStrip name={name} value={total} trailing={
      <span className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        {ordinal(position)} of {playerCount}
      </span>
    } />
  );
}
