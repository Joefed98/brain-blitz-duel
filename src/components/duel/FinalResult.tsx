import { useEffect, useRef, type ReactNode } from "react";

import { puzzleName } from "@/lib/duel/registry";
import type { PuzzleType, StoredPuzzleType } from "@/lib/duel/types";
import { GameIcon, hasGameIcon } from "@/components/app/GameIcon";
import type { Outcome } from "@/lib/duel/scoring";
import { PLAYER_COLOURS, type PlayerLook, type PlayerLooks } from "@/lib/duel/playerLook";
import type { PodiumAward } from "@/lib/duel/podiumAwards";
import { haptic } from "@/lib/haptics";
import { playVoice, queueVoice } from "@/lib/sound";
import { isPhotoFinish } from "@/lib/fx/roomVoices";
import { fx } from "@/lib/fx";
import { COUNT_UP_MS } from "@/lib/fx/celebrations";
import { useCelebrationsOn, useTapToSkip } from "@/components/fx/useCelebration";

import { FeedbackLink } from "@/components/beta/FeedbackLink";

import { AnimatedScore } from "./AnimatedScore";
import { Dots } from "./Dots";
import { PlayerBadge } from "./PlayerBadge";
import { PodiumAwards } from "./PodiumAwards";
import { RoomFooter } from "./RoomFooter";
import { Button } from "@/design/components";

interface FinalResultProps {
  outcome: Outcome;
  /** Why the game ended early ("Sam left the game. You win."), if it did. */
  note?: string | null;
  myName: string;
  opponentName: string;
  myLook?: PlayerLook | undefined;
  opponentLook?: PlayerLook | undefined;
  /** The final screen's awards (podiumAwards.ts) and what they draw. */
  awards?: PodiumAward[];
  looks?: PlayerLooks;
  names?: ReadonlyMap<number, string>;
  mySlot?: number;
  myTotal: number;
  opponentTotal: number;
  breakdown: { round: number; mine: number; theirs: number }[];
  /**
   * Placings rooms (scoringMode.ts): each player's placing points (1 a round won, 1 each for a level round) and
   * the last round's, shown in place of the totals; the rounds list keeps the scores.
   */
  placings?: { mine: number; theirs: number; lastMine: number; lastTheirs: number } | null;
  roundOrder: StoredPuzzleType[];
  busy: boolean;
  onPlayAgain: () => void;
  isHost: boolean;
  /** Leave: the header's "⋯" menu (the room route, Polish batch R). */
  onHome?: () => void;
  /** Replays: the play of the game panel (display only; never blocks Play again or Home). */
  playOfTheGame?: ReactNode;
  /** The Share button (RoomShareButton), beside Play again. */
  share?: ReactNode;
  /** "Challenge a friend" (RoomChallengeButton), its own row under Play again and Share. */
  challenge?: ReactNode;
}

export function FinalResult({
  outcome,
  note = null,
  myName,
  opponentName,
  myLook,
  opponentLook,
  awards = [],
  looks = new Map(),
  names = new Map(),
  mySlot = 0,
  myTotal,
  opponentTotal,
  breakdown,
  placings = null,
  roundOrder,
  busy,
  onPlayAgain,
  isHost,
  playOfTheGame,
  share,
  challenge,
}: FinalResultProps) {
  // Large and in white, not all caps (Polish batch R): "You win!", "Priya wins", "Draw".
  const headline = outcome === "win" ? "You win!" : outcome === "loss" ? `${opponentName} wins` : "Draw";
  const myColour = colourOf(myLook);
  const theirColour = colourOf(opponentLook);
  const cued = useRef(false);
  // Celebrations (src/lib/fx/celebrations.ts): both totals count up from the round before; a tap skips.
  const celebrate = useCelebrationsOn();
  const skipped = useTapToSkip(celebrate);
  const last = breakdown[breakdown.length - 1];
  const countUp = (total: number, round: number | undefined) =>
    celebrate ? { from: Math.max(0, total - (round ?? 0)), durationMs: COUNT_UP_MS, quiet: true, skip: skipped, countSound: true } : {};
  // Counting, a total's box keeps its final width, so the centred pair never shifts sideways.
  const hold = (total: number) => (celebrate ? { minWidth: `${String(total).length}ch` } : undefined);

  useEffect(() => {
    if (cued.current) return;
    cued.current = true;
    // No music on the final screen — just the one cue.
    fx.onPodium();
    playVoice(outcome === "win" ? "voice.youWin" : outcome === "draw" ? "voice.draw" : "gg");
    // The room's end (3 Nov 2026, roomVoices.ts): totals 1–5 apart are a photo finish; else one player taking every
    // round outright is a clean sweep.
    if (outcome !== "draw" && isPhotoFinish([myTotal, opponentTotal])) queueVoice("voice.photoFinish");
    else if (breakdown.length >= 2 && (breakdown.every((r) => r.mine > r.theirs) || breakdown.every((r) => r.theirs > r.mine))) queueVoice("voice.cleanSweep");
    // Haptics (lib/haptics.ts): the winner's phone celebrates (the two-player final is this room's podium).
    if (outcome === "win") haptic("celebrate");
  }, [outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const side = (name: string, look: PlayerLook | undefined, colour: string, total: number, from: number | undefined, you: boolean) => (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
      <PlayerBadge look={look} name={name} size={30} className="mb-1" />
      <p className="flex min-w-0 max-w-full items-baseline justify-center gap-1 text-sm">
        <span className="th-name truncate font-semibold">{name}</span>
        {you ? <span className="rs-you shrink-0">(you)</span> : null}
      </p>
      {/* Each player's total underlined in their own colour. */}
      <p style={hold(total)} className="th-score mt-0.5 text-[40px] leading-none tabular-nums text-foreground">
        <AnimatedScore value={total} {...countUp(total, from)} />
      </p>
      <span aria-hidden="true" className="mt-2 block h-[3px] w-14 rounded-full" style={{ background: colour }} />
    </div>
  );

  return (
    <div className="relative flex flex-1 flex-col gap-5 pt-4 text-left animate-phase-in">
      <h1 data-names className="relative truncate text-center text-[40px] font-extrabold leading-tight text-foreground animate-word-scale-in">
        {headline}
      </h1>
      {note && (
        <p data-forfeit-note className="-mt-3 text-center text-sm text-foreground/80">
          {note}
        </p>
      )}

      <div className="flex items-start justify-center gap-3">
        {placings ? (
          <>
            {side(myName, myLook, myColour, placings.mine, placings.lastMine, true)}
            <span className="pt-14 text-2xl text-muted-foreground">–</span>
            {side(opponentName, opponentLook, theirColour, placings.theirs, placings.lastTheirs, false)}
          </>
        ) : (
          <>
            {side(myName, myLook, myColour, myTotal, last?.mine, true)}
            <span className="pt-14 text-2xl text-muted-foreground">–</span>
            {side(opponentName, opponentLook, theirColour, opponentTotal, last?.theirs, false)}
          </>
        )}
      </div>
      {placings ? (
        <p data-scoring-note className="rs-gain -mt-2 text-center">
          Placings · {myTotal}–{opponentTotal} on score
        </p>
      ) : null}

      <ul className="rs-list" aria-label="Rounds">
        {breakdown.map((row, i) => {
          const type = roundOrder[row.round - 1] ?? "wordsmith";
          return (
            <li
              key={row.round}
              className="rs-row min-h-[52px] animate-row-stagger"
              style={{ animationDelay: `${240 + i * 110}ms` }}
            >
              {hasGameIcon(type) ? <GameIcon type={type as PuzzleType} size={34} /> : <span className="h-[34px] w-[34px]" />}
              <span className="rs-name min-w-0 flex-1 text-[14px]">{puzzleName(type)}</span>
              {/* The winning score bright, the losing one grey. */}
              <span className="th-score shrink-0 whitespace-nowrap text-[17px] tabular-nums">
                <span className={row.mine >= row.theirs ? "text-foreground" : "text-[var(--ap-faint)]"}>{row.mine}</span>
                <span className="mx-2 text-[var(--ap-faint)]">–</span>
                <span className={row.theirs >= row.mine ? "text-foreground" : "text-[var(--ap-faint)]"}>{row.theirs}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <PodiumAwards awards={awards} looks={looks} names={names} mySlot={mySlot} />

      {playOfTheGame}

      {challenge}

      {/* SEND FEEDBACK (the beta's form; nothing while TALLY_URL is empty). */}
      <FeedbackLink small />

      {/* The room footer: chat, Share (secondary) and Play again (gold, the host's). Leave is in the "⋯" menu. */}
      <RoomFooter className="mt-auto">
        <div data-podium-actions className="flex min-w-0 flex-1 items-center gap-2">
          {isHost ? (
            <Button
              variant="gold"
              size={52}
              onClick={onPlayAgain}
              disabled={busy}
            >
              {busy ? (
                <>
                  <span>Setting up</span>
                  <Dots className="bg-primary-foreground" />
                </>
              ) : (
                "Play again"
              )}
            </Button>
          ) : (
            <p className="rs-status h-[52px]">Waiting for the host</p>
          )}
            {share}
        </div>
      </RoomFooter>
    </div>
  );
}

/** A player's own colour; neutral without one. */
const colourOf = (look: PlayerLook | undefined) => (look ? PLAYER_COLOURS[look.colour]?.hex : undefined) ?? "var(--ap-text-2)";
