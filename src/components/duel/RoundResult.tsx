import { useEffect, useRef, type ReactNode } from "react";

import type { PlayerLook } from "@/lib/duel/playerLook";
import { roundMaxFor } from "@/lib/duel/roundMax";
import { soundCue } from "@/lib/fx/soundCues";
import { cueDurationMs, playRoundWon, playVoice } from "@/lib/sound";
import {
  VERDICT_LABEL,
  VERDICT_TONE,
  summaryWithoutTime,
  type RoundVerdict,
} from "@/lib/duel/resultPresentation";

import { AnimatedScore } from "./AnimatedScore";
import { ContinueFooter, type ContinueState } from "./ContinueFooter";
import { PlayerBadge } from "./PlayerBadge";

function SummaryLine({ verdict, summary }: { verdict: RoundVerdict; summary: string }) {
  const rest = summaryWithoutTime(summary);
  return (
    <p title={summary} className="mt-2 font-mono text-[11px] leading-snug text-foreground/80">
      <span data-verdict={verdict} className={`font-bold ${VERDICT_TONE[verdict]}`}>
        {VERDICT_LABEL[verdict]}
      </span>
      {rest ? ` · ${rest}` : ""}
    </p>
  );
}

interface RoundResultProps {
  roundTitle: string;
  /** A short best-answer line ("Best: 17 moves"), when the game has one. */
  best?: string | null;
  myName: string;
  opponentName: string;
  myLook?: PlayerLook | undefined;
  opponentLook?: PlayerLook | undefined;
  myRoundScore: number;
  myVerdict: RoundVerdict;
  mySummary: string;
  myTime: string;
  opponentRoundScore: number;
  opponentVerdict: RoundVerdict;
  opponentSummary: string;
  opponentTime: string;
  autoSeconds: number;
  finalRound: boolean;
  continueState: ContinueState;
  /** Replays: the round winner's highlight (display only; never blocks Continue). */
  highlight?: ReactNode;
  /** The round's game: its maximum (roundMax.ts) is the score bars' full width. */
  gameType?: string | null | undefined;
}

export function RoundResult({
  roundTitle,
  best,
  myName,
  opponentName,
  myLook,
  opponentLook,
  myRoundScore,
  myVerdict,
  mySummary,
  myTime,
  opponentRoundScore,
  opponentVerdict,
  opponentSummary,
  opponentTime,
  autoSeconds,
  finalRound,
  continueState,
  highlight,
  gameType,
}: RoundResultProps) {
  const iWon = myRoundScore > opponentRoundScore;
  const theyWon = opponentRoundScore > myRoundScore;
  const cued = useRef(false);

  // Winner: round-won cue then "round taken"; everyone else: the screen's own sting
  // (shared.roundResults), then "round lost" (two-player loser) or "tie". Never both stings.
  useEffect(() => {
    if (cued.current) return;
    cued.current = true;
    if (iWon) { playRoundWon(); playVoice("roundTaken", cueDurationMs("round_won")); return; }
    soundCue("shared.roundResults");
    playVoice(theyWon ? "roundLost" : "voice.tie", cueDurationMs("shared.roundResults"));
  }, [iWon, theyWon]);

  const bar = (score: number) => `${Math.round((score / roundMaxFor(gameType)) * 100)}%`;

  return (
    <div className="flex flex-1 flex-col justify-between gap-6 pt-4 animate-phase-in">
      <div className="flex flex-col gap-6">
        <div className="relative px-12 text-center">
          <p className="th-kicker text-primary">Round results</p>
          <p className="mt-1 break-words font-display text-sm font-bold uppercase text-foreground">
            {roundTitle}
          </p>
          {best && <p className="font-mono text-[11px] text-foreground/80">{best}</p>}
          <span className="th-kicker absolute right-0 top-0 whitespace-nowrap text-[10px] tracking-[0.06em] text-muted-foreground">
            {finalRound ? "Final round" : "This round"}
          </span>
        </div>

        {highlight}

        <div className="flex gap-3">
          <div
            data-tint={iWon ? "gold" : undefined}
            className={`th-card min-w-0 flex-1 rounded-2xl border p-4 transition-opacity ${
              iWon ? "border-me/60 bg-me/10" : "border-border bg-card"
            } ${theyWon ? "opacity-60" : ""}`}
          >
            <p className="flex min-w-0 items-center gap-1.5 text-sm text-me">
              <PlayerBadge look={myLook} name={myName} size={24} />
              <span className="th-name truncate">{myName}</span>
            </p>
            {/* Below the name only the time used (the buzzer shows the round's full clock). */}
            <p className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">{myTime}</p>
            <p className={`th-score mt-2 font-mono text-4xl font-bold tabular-nums text-me ${iWon ? "th-score-top" : ""}`}>
              <AnimatedScore value={myRoundScore} />
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-me transition-[width] duration-500 ease-out"
                style={{ width: bar(myRoundScore) }}
              />
            </div>
            <SummaryLine verdict={myVerdict} summary={mySummary} />
            {iWon && (
              <span className="th-btn-gold mt-3 inline-block whitespace-nowrap rounded-full bg-me px-2 py-1 font-display text-[11px] font-bold uppercase tracking-wider text-primary-foreground animate-tag-slam">
                Round won
              </span>
            )}
          </div>
          <div
            data-tint={theyWon ? "teal" : undefined}
            className={`th-card min-w-0 flex-1 rounded-2xl border p-4 text-right transition-opacity ${
              theyWon ? "border-opponent/60 bg-opponent/10" : "border-border bg-card"
            } ${iWon ? "opacity-60" : ""}`}
          >
            <p className="flex min-w-0 items-center justify-end gap-1.5 text-sm text-opponent">
              <span className="th-name truncate">{opponentName}</span>
              <PlayerBadge look={opponentLook} name={opponentName} size={24} />
            </p>
            <p className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">{opponentTime}</p>
            <p className="th-score mt-2 font-mono text-4xl font-bold tabular-nums text-opponent">
              <AnimatedScore value={opponentRoundScore} />
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-background">
              <div
                className="ml-auto h-full rounded-full bg-opponent transition-[width] duration-500 ease-out"
                style={{ width: bar(opponentRoundScore) }}
              />
            </div>
            <SummaryLine verdict={opponentVerdict} summary={opponentSummary} />
            {theyWon && (
              <span className="th-btn-teal mt-3 inline-block whitespace-nowrap rounded-full bg-opponent px-2 py-1 font-display text-[11px] font-bold uppercase tracking-wider text-background animate-tag-slam">
                Round won
              </span>
            )}
          </div>
        </div>
      </div>

      <ContinueFooter next={finalRound ? "Winner" : "Standings"} autoSeconds={autoSeconds} state={continueState} />
    </div>
  );
}
