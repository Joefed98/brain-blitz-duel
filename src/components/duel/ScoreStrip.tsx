import { ProgressStrip } from "./ProgressStrip";

interface ScoreStripProps {
  myName: string;
  opponentName: string;
  myTotal: number;
  opponentTotal: number;
  compact?: boolean;
}

export function ScoreStrip({ myName, opponentName, myTotal, opponentTotal, compact = false }: ScoreStripProps) {
  return (
    <div className={`flex min-w-0 items-stretch ${compact ? "gap-1" : "gap-2"}`}>
      <ProgressStrip name={myName} value={myTotal} compact={compact} />
      <ProgressStrip name={opponentName} value={opponentTotal} opponent alignRight compact={compact} />
    </div>
  );
}
