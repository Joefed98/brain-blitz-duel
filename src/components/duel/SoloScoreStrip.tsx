import { ordinal } from "@/lib/duel/ordinal";

import { ProgressStrip } from "./ProgressStrip";

interface SoloScoreStripProps {
  name: string;
  total: number;
  position: number;
  playerCount: number;
  compact?: boolean;
  /** The arcade play header: the total on one 20px line, the place under it. */
  stacked?: boolean;
}

/**
 * In a room of three or more only the viewer's own total and place are shown —
 * nobody sees anyone else's progress during a round.
 */
export function SoloScoreStrip({ name, total, position, playerCount, compact = false, stacked = false }: SoloScoreStripProps) {
  if (stacked) return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <ProgressStrip name={name} value={total} stacked />
      <span className="truncate px-1.5 font-mono text-xs uppercase leading-5 tracking-wider text-muted-foreground">{ordinal(position)} of {playerCount}</span>
    </div>
  );
  return (
    <ProgressStrip name={name} value={total} trailing={
      <span className={`shrink-0 font-mono uppercase tracking-widest text-muted-foreground ${compact ? "text-[10px]" : "text-sm"}`}>
        {ordinal(position)} of {playerCount}
      </span>
    } compact={compact} />
  );
}
