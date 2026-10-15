import { ProgressStrip } from "./ProgressStrip";

interface ScoreStripProps {
  myName: string;
  opponentName: string;
  myTotal: number;
  opponentTotal: number;
  compact?: boolean;
  /** The arcade play header: the two totals on two 20px lines. */
  stacked?: boolean;
}

export function ScoreStrip({ myName, opponentName, myTotal, opponentTotal, compact = false, stacked = false }: ScoreStripProps) {
  if (stacked) return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <ProgressStrip name={myName} value={myTotal} stacked />
      <ProgressStrip name={opponentName} value={opponentTotal} opponent stacked />
    </div>
  );
  return (
    <div className={`flex min-w-0 items-stretch ${compact ? "gap-1" : "gap-2"}`}>
      <ProgressStrip name={myName} value={myTotal} compact={compact} />
      <ProgressStrip name={opponentName} value={opponentTotal} opponent alignRight compact={compact} />
    </div>
  );
}
