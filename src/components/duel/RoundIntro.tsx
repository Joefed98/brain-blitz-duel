import { puzzleDef, puzzleName, typeTimeLimitMs, usesArcadeClock } from "@/lib/duel/registry";
import { INTRO_COUNTDOWN_MS, INTRO_MS, TOTAL_ROUNDS, type PuzzleType } from "@/lib/duel/types";
import type { Outcome } from "@/lib/duel/scoring";
import type { PuzzleData } from "@/lib/duel/types";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";
import { fx } from "@/lib/fx";
import { roundMusicFor } from "@/lib/fx/theme";
import { prepareRoundMusic, roundMusicClaimed, startRoundMusic, stopRoundMusic } from "@/lib/sound";

import { RoundPips } from "./RoundPips";
import { Dots } from "./Dots";
import { PuzzleInstructions } from "./PuzzleInstructions";
import { hasIntroDemo, IntroDemo } from "./IntroDemo";
import { PuzzleIntroDemo, usePuzzleDemo } from "./PuzzleDemo";

interface RoundIntroProps {
  round: number;
  type: PuzzleType;
  /** Shared timestamp the intro is timed from. */
  startedAt: number;
  now: number;
  outcomes: Outcome[];
  /** Ready state, driven by the server. Practice mode leaves these off. */
  ready?: boolean;
  readyCount?: number;
  activeCount?: number;
  onReady?: () => void;
  practice?: boolean;
  onBack?: () => void;
  /** This round's public puzzle, for puzzle-specific intro lines. */
  puzzle?: PuzzleData | null;
  /** The room's round count; its last round announces "final round". */
  totalRounds?: number;
}

export function RoundIntro({
  round,
  type,
  startedAt,
  now,
  outcomes,
  ready = false,
  readyCount = 0,
  activeCount = 0,
  onReady,
  practice = false,
  onBack,
  puzzle = null,
}: RoundIntroProps) {
  const elapsed = Math.max(0, now - startedAt);
  const remaining = Math.max(0, INTRO_MS - elapsed);
  const counting = remaining <= INTRO_COUNTDOWN_MS;
  const secondsLeft = Math.max(1, Math.ceil(remaining / 1000));
  const autoSeconds = Math.max(0, Math.ceil((remaining - INTRO_COUNTDOWN_MS) / 1000));
  const Example = puzzleDef(type).IntroExample;
  const savedPuzzleDemo = usePuzzleDemo(type);
  const puzzleDemo = hasIntroDemo(type) ? null : savedPuzzleDemo;
  const introLine = puzzle ? (puzzleDef(type).introLine?.(puzzle) ?? null) : null;
  // Arcade phases carry 3 s of invisible slack; show the run length only.
  const seconds = Math.round((typeTimeLimitMs(type) - (usesArcadeClock(type) ? 3000 : 0)) / 1000);
  const twoPlayer = activeCount === 2;
  const theme = puzzleDef(type).theme;
  const countdownCued = useRef("");
  useEffect(() => {
    if (!counting) return;
    const key = `${startedAt}-${secondsLeft}`;
    if (countdownCued.current === key) return;
    countdownCued.current = key;
    fx.onCountdown(secondsLeft, theme);
    // Read the puzzle-round switch now, so a change applies from the next round.
    startRoundMusic(roundMusicFor(type, puzzleDef(type).category));
  }, [counting, secondsLeft, startedAt, type]);

  // Rooms preload in starting/round_title; practice keeps its existing entry point.
  useEffect(() => {
    if (practice) prepareRoundMusic(roundMusicFor(type, puzzleDef(type).category));
  }, [type, practice]);

  // Leaving the intro without a round starting (practice Back) silences it.
  useEffect(
    () => () => {
      window.setTimeout(() => {
        if (!roundMusicClaimed()) stopRoundMusic();
      }, 2_000);
    },
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden animate-phase-in">
      <div className="category-header flex items-start justify-between">
        {practice && onBack ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="press h-8 shrink-0 px-2.5"
          >
            ← Back
          </Button>
        ) : null}
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {practice ? "Practice" : `Round ${round} of ${TOTAL_ROUNDS}`}{" "}
            <span className="category-tag">· {theme.accent}</span>
          </span>
          {!counting && onReady ? (
            <span className="font-mono text-[0.7rem] text-muted-foreground/70">
              auto-start in {autoSeconds}s
            </span>
          ) : null}
        </div>
        {!practice && <RoundPips currentRound={round} outcomes={outcomes} />}
      </div>

      <h1 className="text-center font-display text-[2.25rem] font-bold leading-none animate-pop-in sm:text-[2.75rem]">
        {puzzleName(type)}
      </h1>

      {counting ? (
        <div className="flex flex-1 items-center justify-center" aria-live="polite">
          <p
            key={secondsLeft}
            className="font-mono text-[min(40vh,18rem)] font-bold leading-none text-category-accent animate-countdown-number"
          >
            {secondsLeft}
          </p>
        </div>
      ) : (
        <>
          <div className="round-intro-content flex min-h-0 flex-1 flex-col items-center justify-start gap-2 overflow-y-auto overscroll-contain py-1">
            {hasIntroDemo(type) ? (
              <PuzzleInstructions
                type={type}
                beforeScore={
                  <div className="flex justify-center">
                    <IntroDemo type={type} puzzle={puzzle} />
                  </div>
                }
              />
            ) : puzzleDemo ? (
              <PuzzleInstructions type={type} beforeScore={<PuzzleIntroDemo demo={puzzleDemo} />} />
            ) : (
              <>
                <PuzzleInstructions type={type} />
                <div className="round-intro-example">
                  <Example />
                </div>
              </>
            )}
            {introLine ? (
              <p className="font-mono text-sm font-bold uppercase tracking-widest text-primary">
                {introLine}
              </p>
            ) : null}
            <p className="round-intro-time text-xs text-muted-foreground">
              You have {seconds} seconds
            </p>
          </div>

          <div className="sticky bottom-0 z-10 flex shrink-0 flex-col items-center gap-2 bg-background pt-1">
            <Button
              type="button"
              disabled={ready}
              onClick={onReady}
              className={`press h-[60px] w-full rounded-2xl font-display text-2xl font-bold uppercase tracking-[0.12em] disabled:opacity-100 ${
                ready ? "bg-opponent text-primary-foreground" : "bg-primary text-primary-foreground"
              }`}
            >
              {ready ? "Ready ✓" : "Ready"}
            </Button>

            <p className="flex h-5 items-center gap-1.5 font-mono text-xs text-muted-foreground">
              {activeCount > 1 ? (
                ready && twoPlayer && readyCount < activeCount ? (
                  <>
                    Waiting for opponent <Dots />
                  </>
                ) : (
                  <>
                    {readyCount} of {activeCount} ready
                  </>
                )
              ) : null}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
