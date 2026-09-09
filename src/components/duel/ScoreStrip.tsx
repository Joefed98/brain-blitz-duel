import { AnimatedScore } from "./AnimatedScore";

interface ScoreStripProps {
  myName: string;
  opponentName: string;
  myTotal: number;
  opponentTotal: number;
}

export function ScoreStrip({ myName, opponentName, myTotal, opponentTotal }: ScoreStripProps) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex-1 rounded-lg border border-me/40 bg-me/10 px-3 py-2">
        <p className="truncate text-[11px] uppercase tracking-widest text-me">{myName}</p>
        <AnimatedScore
          value={myTotal}
          className="font-mono text-xl font-bold tabular-nums text-me"
        />
      </div>
      <div className="flex-1 rounded-lg border border-opponent/40 bg-opponent/10 px-3 py-2 text-right">
        <p className="truncate text-[11px] uppercase tracking-widest text-opponent">
          {opponentName}
        </p>
        <AnimatedScore
          value={opponentTotal}
          className="font-mono text-xl font-bold tabular-nums text-opponent"
        />
      </div>
    </div>
  );
}
