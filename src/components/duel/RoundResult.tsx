import { VerdictLabel } from "./VerdictLabel";
import { MetaChips } from "@/components/app/MetaChips";
import { Panel } from "@/design/components";
import { useEffect, useRef, type ReactNode } from "react";

import { PLAYER_COLOURS, type PlayerLook } from "@/lib/duel/playerLook";
import { roundMaxFor } from "@/lib/duel/roundMax";
import { soundCue } from "@/lib/fx/soundCues";
import { cueDurationMs, playRoundWon, playVoice } from "@/lib/sound";
import {
  VERDICT_TONE,
  summaryWithoutTime,
  type RoundVerdict,
} from "@/lib/duel/resultPresentation";

import { AnimatedScore } from "./AnimatedScore";
import { ContinueFooter, type ContinueState } from "./ContinueFooter";
import { RoomMiniCard } from "./RoomPlayer";
import { youStyle } from "./Standings";

/** A player's own colour (their bar); neutral without one. */
const colourOf = (look: PlayerLook | undefined) => (look ? PLAYER_COLOURS[look.colour]?.hex : undefined) ?? "var(--ap-text-2)";

function SummaryLine({ verdict, summary }: { verdict: RoundVerdict; summary: string }) {
  const rest = summaryWithoutTime(summary);
  return (
    <p title={summary} className="mt-2 text-[12.5px] leading-snug text-[var(--ap-text-2)]">
      <span data-verdict={verdict} className={`font-bold ${VERDICT_TONE[verdict]}`}>
        <VerdictLabel verdict={verdict} />
      </span>
      {rest ? `, ${rest}` : ""}
    </p>
  );
}

interface RoundResultProps {
  /** The round and its game, shown as chips ("Round 3", "Gemstone"). */
  roundTitle: string | readonly string[];
  /** A short best-answer line ("Best: 17 moves"), when the game has one. */
  best?: string | null;
  myName: string;
  opponentName: string;
  myLook?: PlayerLook | undefined;
  /** The two players' slots, for their mini cards (one identity everywhere, 13 Nov 2026). */
  mySlot?: number;
  opponentSlot?: number;
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
  mySlot,
  opponentSlot,
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
    <div className="flex flex-1 flex-col justify-between gap-5 pt-1 animate-phase-in">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-0.5 text-left">
          <div className="rs-head">
            <h1 className="rs-title">{finalRound ? "Final round" : "Round results"}</h1>
            {best && <span className="rs-meta">{best}</span>}
          </div>
          <MetaChips data-round-title facts={typeof roundTitle === "string" ? [roundTitle] : roundTitle} />
        </header>

        {highlight}

        <div className="flex gap-3">
          <Panel
            data-you=""
            style={youStyle(myLook)}
            data-round-dim={theyWon ? "" : undefined}
            className="th-card min-w-0 flex-1 p-4" /* design-lint-ignore: the existing values; only the dimming changed (audit #3/#4) */
          >
            <p className="flex min-w-0 items-center gap-1.5 text-sm">
              <RoomMiniCard slot={mySlot} look={myLook} name={myName} size={24} />
              <span className="th-name truncate font-semibold">{myName}</span>
              <span className="rs-you shrink-0">(you)</span>
            </p>
            {/* Below the name only the time used (the buzzer shows the round's full clock). */}
            <p className="whitespace-nowrap text-[12.5px] tabular-nums text-muted-foreground">{myTime}</p>
            <p className="th-score mt-2 text-4xl tabular-nums text-foreground">
              <AnimatedScore value={myRoundScore} />
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: bar(myRoundScore), background: colourOf(myLook) }}
              />
            </div>
            <SummaryLine verdict={myVerdict} summary={mySummary} />
            {iWon && (
              <span className="rs-pill mt-3 animate-tag-slam">Round won</span>
            )}
          </Panel>
          <Panel
            data-round-dim={iWon ? "" : undefined}
            className="th-card min-w-0 flex-1 p-4 text-right" /* design-lint-ignore: the existing values; only the dimming changed (audit #3/#4) */
          >
            <p className="flex min-w-0 items-center justify-end gap-1.5 text-sm">
              <span className="th-name truncate font-semibold">{opponentName}</span>
              <RoomMiniCard slot={opponentSlot} look={opponentLook} name={opponentName} size={24} />
            </p>
            <p className="whitespace-nowrap text-[12.5px] tabular-nums text-muted-foreground">{opponentTime}</p>
            <p className="th-score mt-2 text-4xl tabular-nums text-foreground">
              <AnimatedScore value={opponentRoundScore} />
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-background">
              <div
                className="ml-auto h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: bar(opponentRoundScore), background: colourOf(opponentLook) }}
              />
            </div>
            <SummaryLine verdict={opponentVerdict} summary={opponentSummary} />
            {theyWon && (
              <span className="rs-pill mt-3 animate-tag-slam">Round won</span>
            )}
          </Panel>
        </div>
      </div>

      <ContinueFooter next={finalRound ? "Winner" : "Standings"} autoSeconds={autoSeconds} state={continueState} />
    </div>
  );
}
