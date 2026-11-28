import { useMomentEnter } from "@/components/fx/useMomentEnter";
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
import { useGameFxOnce } from "@/components/fx/GameFx";
import { ContinueFooter, type ContinueState } from "./ContinueFooter";
import { RoomMiniCard } from "./RoomPlayer";
import { youStyle } from "./Standings";

/** A player's own colour (their bar); neutral without one. */
const colourOf = (look: PlayerLook | undefined) => (look ? PLAYER_COLOURS[look.colour]?.hex : undefined) ?? "var(--jz-text-3)";

function SummaryLine({ verdict, summary }: { verdict: RoundVerdict; summary: string }) {
  const rest = summaryWithoutTime(summary);
  return (
    <p title={summary} className="mt-2 jz-text-caption leading-snug jz-em-detail">
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
  const enter = useMomentEnter("rise");
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

  // The bars fill by scale (fx-bar, polish-layout/game-fx.css), never by width: no layout animation.
  const bar = (score: number) => ({ ["--fx-bar" as string]: Math.max(0, Math.min(1, score / roundMaxFor(gameType))).toFixed(3) });
  const mine = useRef<HTMLDivElement>(null);
  // The kit's payoff on the round's winner (its own round_won cue already plays, so silent).
  useGameFxOnce("win", mine, iWon, { silent: true, noHaptic: true });

  return (
    <div className="flex flex-1 flex-col justify-between gap-5 pt-1 animate-phase-in" {...enter}>
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
            ref={mine}
            data-you=""
            style={youStyle(myLook)}
            data-round-dim={theyWon ? "" : undefined}
            className="jz-card min-w-0 flex-1 p-4" /* design-lint-ignore: the existing values; only the dimming changed (audit #3/#4) */
          >
            <p className="flex min-w-0 items-center gap-1.5 text-sm">
              <RoomMiniCard slot={mySlot} look={myLook} name={myName} size={24} />
              <span className="jz-name truncate font-semibold">{myName}</span>
              <span className="rs-you shrink-0">(you)</span>
            </p>
            {/* Below the name only the time used (the buzzer shows the round's full clock). */}
            <p className="whitespace-nowrap jz-text-caption tabular-nums text-muted-foreground">{myTime}</p>
            <p className="jz-score mt-2 text-4xl tabular-nums text-foreground">
              <AnimatedScore value={myRoundScore} />
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-background">
              <span className="fx-bar" style={{ ...bar(myRoundScore), background: colourOf(myLook) }} />
            </div>
            <SummaryLine verdict={myVerdict} summary={mySummary} />
            {iWon && (
              <span className="rs-pill mt-3 animate-tag-slam">Round won</span>
            )}
          </Panel>
          <Panel
            data-round-dim={iWon ? "" : undefined}
            className="jz-card min-w-0 flex-1 p-4 text-right" /* design-lint-ignore: the existing values; only the dimming changed (audit #3/#4) */
          >
            <p className="flex min-w-0 items-center justify-end gap-1.5 text-sm">
              <span className="jz-name truncate font-semibold">{opponentName}</span>
              <RoomMiniCard slot={opponentSlot} look={opponentLook} name={opponentName} size={24} />
            </p>
            <p className="whitespace-nowrap jz-text-caption tabular-nums text-muted-foreground">{opponentTime}</p>
            <p className="jz-score mt-2 text-4xl tabular-nums text-foreground">
              <AnimatedScore value={opponentRoundScore} />
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-background">
              <span data-from-right="" className="fx-bar" style={{ ...bar(opponentRoundScore), background: colourOf(opponentLook) }} />
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
