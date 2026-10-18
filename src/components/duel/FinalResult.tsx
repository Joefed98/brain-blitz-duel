import { useEffect, useRef, type ReactNode } from "react";

import { puzzleName } from "@/lib/duel/registry";
import type { StoredPuzzleType } from "@/lib/duel/types";
import type { Outcome } from "@/lib/duel/scoring";
import type { PlayerLook, PlayerLooks } from "@/lib/duel/playerLook";
import type { PodiumAward } from "@/lib/duel/podiumAwards";
import { buzz } from "@/lib/motion";
import { playVoice } from "@/lib/sound";
import { fx } from "@/lib/fx";

import { AnimatedScore } from "./AnimatedScore";
import { Dots } from "./Dots";
import { PlayerBadge } from "./PlayerBadge";
import { PodiumAwards } from "./PodiumAwards";

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
  roundOrder: StoredPuzzleType[];
  busy: boolean;
  onPlayAgain: () => void;
  isHost: boolean;
  onHome: () => void;
  /** Replays: the play of the game panel (display only; never blocks Play again or Home). */
  playOfTheGame?: ReactNode;
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
  roundOrder,
  busy,
  onPlayAgain,
  isHost,
  onHome,
  playOfTheGame,
}: FinalResultProps) {
  const headline = outcome === "win" ? "WIN" : outcome === "loss" ? "LOSS" : "DRAW";
  const headlineColor =
    outcome === "win" ? "text-me" : outcome === "loss" ? "text-warn" : "text-foreground";
  const cued = useRef(false);

  useEffect(() => {
    if (cued.current) return;
    cued.current = true;
    // No music on the final screen — just the one cue.
    fx.onPodium();
    playVoice(outcome === "win" ? "voice.youWin" : outcome === "draw" ? "voice.tie" : "gg");
    if (outcome === "win") {

      buzz([25, 50, 25]);
    } else {

      if (outcome === "loss") buzz(30);
    }
  }, [outcome]);

  return (
    <div className="relative flex flex-1 flex-col justify-between gap-8 pt-8 animate-phase-in">
      <div className="flex flex-col gap-8">
        <h1
          className={`relative text-center font-display text-6xl font-bold animate-word-scale-in ${headlineColor}`}
        >
          {headline}
        </h1>
        {note && (
          <p data-forfeit-note className="-mt-6 text-center text-sm text-foreground/80">
            {note}
          </p>
        )}

        <div className="flex items-end justify-center gap-4">
          <div className="text-center">
            <PlayerBadge look={myLook} name={myName} size={28} className="mx-auto mb-1" />
            <p className="max-w-[110px] truncate text-xs uppercase tracking-widest text-me">
              {myName}
            </p>
            <p className="font-mono text-4xl font-bold tabular-nums text-me">
              <AnimatedScore value={myTotal} />
            </p>
          </div>
          <span className="pb-2 font-mono text-2xl text-muted-foreground">–</span>
          <div className="text-center">
            <PlayerBadge look={opponentLook} name={opponentName} size={28} className="mx-auto mb-1" />
            <p className="max-w-[110px] truncate text-xs uppercase tracking-widest text-opponent">
              {opponentName}
            </p>
            <p className="font-mono text-4xl font-bold tabular-nums text-opponent">
              <AnimatedScore value={opponentTotal} />
            </p>
          </div>
        </div>

        <PodiumAwards awards={awards} looks={looks} names={names} mySlot={mySlot} />

        {playOfTheGame}

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {breakdown.map((row, i) => (
            <div
              key={row.round}
              className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0 animate-row-stagger"
              style={{ animationDelay: `${240 + i * 110}ms` }}
            >
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {puzzleName(roundOrder[row.round - 1] ?? "wordsmith")}
              </span>
              <span className="font-mono text-sm font-bold tabular-nums">
                <span className={row.mine > row.theirs ? "text-me" : "text-muted-foreground"}>
                  {row.mine}
                </span>
                <span className="mx-2 text-muted-foreground">–</span>
                <span className={row.theirs > row.mine ? "text-opponent" : "text-muted-foreground"}>
                  {row.theirs}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {isHost ? (
          <button
            type="button"
            onClick={onPlayAgain}
            disabled={busy}
            className="press tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground"
          >
            {busy ? (
              <>
                <span>Setting up</span>
                <Dots className="bg-primary-foreground" />
              </>
            ) : (
              "Play again"
            )}
          </button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Waiting for the host to play again
          </p>
        )}
        <button
          type="button"
          onClick={onHome}
          className="press tap-target w-full rounded-xl border border-border font-display text-base font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Home
        </button>
      </div>
    </div>
  );
}
