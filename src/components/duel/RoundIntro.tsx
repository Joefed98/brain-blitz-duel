import { puzzleDef, puzzleName } from "@/lib/duel/registry";
import {
  INTRO_COUNTDOWN_MS,
  INTRO_MS,
  TOTAL_ROUNDS,
  type PuzzleType,
} from "@/lib/duel/types";

interface RoundIntroProps {
  round: number;
  type: PuzzleType;
  /** Shared timestamp the intro is timed from. */
  startedAt: number;
  now: number;
}

export function RoundIntro({ round, type, startedAt, now }: RoundIntroProps) {
  const elapsed = Math.max(0, now - startedAt);
  const remaining = Math.max(0, INTRO_MS - elapsed);
  const counting = remaining <= INTRO_COUNTDOWN_MS;
  const progress = Math.min(100, (elapsed / (INTRO_MS - INTRO_COUNTDOWN_MS)) * 100);
  const secondsLeft = Math.max(1, Math.ceil(remaining / 1000));
  const Example = puzzleDef(type).IntroExample;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Round {round} of {TOTAL_ROUNDS}
        </span>
        <span className="font-display text-sm font-bold text-foreground">Get ready</span>
      </div>

      <h1 className="text-center font-display text-3xl font-bold">{puzzleName(type)}</h1>

      <div className="flex flex-1 flex-col items-center justify-center">
        <Example />
      </div>

      <div className="flex h-24 items-center justify-center">
        {counting ? (
          <p className="font-mono text-7xl font-bold leading-none text-primary">{secondsLeft}</p>
        ) : (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-card">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-100 ease-linear"
              style={{ width: `${100 - progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
