import { puzzleDef, puzzleName, typeTimeLimitMs } from "@/lib/duel/registry";
import {
  INTRO_COUNTDOWN_MS,
  INTRO_MS,
  TOTAL_ROUNDS,
  type PuzzleType,
} from "@/lib/duel/types";
import type { Outcome } from "@/lib/duel/scoring";

import { RoundPips } from "./RoundPips";

interface RoundIntroProps {
  round: number;
  type: PuzzleType;
  /** Shared timestamp the intro is timed from. */
  startedAt: number;
  now: number;
  outcomes: Outcome[];
}

export function RoundIntro({ round, type, startedAt, now, outcomes }: RoundIntroProps) {
  const elapsed = Math.max(0, now - startedAt);
  const remaining = Math.max(0, INTRO_MS - elapsed);
  const counting = remaining <= INTRO_COUNTDOWN_MS;
  const progress = Math.min(100, (elapsed / (INTRO_MS - INTRO_COUNTDOWN_MS)) * 100);
  const secondsLeft = Math.max(1, Math.ceil(remaining / 1000));
  const Example = puzzleDef(type).IntroExample;
  const seconds = Math.round(typeTimeLimitMs(type) / 1000);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 animate-phase-in">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Round {round} of {TOTAL_ROUNDS}
        </span>
        <RoundPips currentRound={round} outcomes={outcomes} />
      </div>

      <h1 className="text-center font-display text-5xl font-bold leading-none animate-pop-in">
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
          <div className="round-intro-content flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
            <div className="round-intro-example">
              <Example />
            </div>
            <p className="round-intro-time text-xs text-muted-foreground">
              You have {seconds} seconds
            </p>
          </div>

          <div className="flex h-12 items-center justify-center">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-card">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-100 ease-linear"
                style={{ width: `${100 - progress}%` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
