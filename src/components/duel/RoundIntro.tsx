import { puzzleDef, puzzleName, typeTimeLimitMs } from "@/lib/duel/registry";
import { INTRO_COUNTDOWN_MS, INTRO_MS, TOTAL_ROUNDS, type PuzzleType } from "@/lib/duel/types";
import type { Outcome } from "@/lib/duel/scoring";

import { RoundPips } from "./RoundPips";
import { Dots } from "./Dots";
import { PuzzleInstructions } from "./PuzzleInstructions";

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
}: RoundIntroProps) {
  const elapsed = Math.max(0, now - startedAt);
  const remaining = Math.max(0, INTRO_MS - elapsed);
  const counting = remaining <= INTRO_COUNTDOWN_MS;
  const secondsLeft = Math.max(1, Math.ceil(remaining / 1000));
  const autoSeconds = Math.max(0, Math.ceil((remaining - INTRO_COUNTDOWN_MS) / 1000));
  const Example = puzzleDef(type).IntroExample;
  const seconds = Math.round(typeTimeLimitMs(type) / 1000);
  const twoPlayer = activeCount === 2;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 animate-phase-in">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {practice ? "Practice" : `Round ${round} of ${TOTAL_ROUNDS}`}
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
            className="font-mono text-[min(40vh,18rem)] font-bold leading-none text-primary animate-countdown-number"
          >
            {secondsLeft}
          </p>
        </div>
      ) : (
        <>
          <div className="round-intro-content flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-hidden">
            <PuzzleInstructions type={type} />
            <div className="round-intro-example">
              <Example />
            </div>
            <p className="round-intro-time text-xs text-muted-foreground">
              You have {seconds} seconds
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              disabled={ready}
              onClick={onReady}
              className={`press h-[60px] w-full rounded-2xl font-display text-2xl font-bold uppercase tracking-[0.12em] disabled:opacity-100 ${
                ready ? "bg-opponent text-primary-foreground" : "bg-primary text-primary-foreground"
              }`}
            >
              {ready ? "Ready ✓" : "Ready"}
            </button>

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
