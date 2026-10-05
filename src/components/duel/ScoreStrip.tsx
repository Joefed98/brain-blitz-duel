import { ProgressStrip } from "./ProgressStrip";

interface ScoreStripProps {
  myName: string;
  opponentName: string;
  myTotal: number;
  opponentTotal: number;
}

export function ScoreStrip({ myName, opponentName, myTotal, opponentTotal }: ScoreStripProps) {
  return (
    <div className="flex items-stretch gap-2">
      <ProgressStrip name={myName} value={myTotal} />
      <ProgressStrip name={opponentName} value={opponentTotal} opponent alignRight />
    </div>
  );
}
