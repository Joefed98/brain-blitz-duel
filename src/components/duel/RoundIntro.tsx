import { SequenceGrid } from "./SequenceGrid";
import {
  INTRO_COUNTDOWN_MS,
  INTRO_MS,
  PUZZLE_LABELS,
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

/** Fixed example tiles for the anagram intro — never randomised. */
const ANAGRAM_EXAMPLE = ["T", "A", "P", "L", "N", "E"];
/** Fixed example sequence for the sequence intro (tiles 1, 5, 9, 3, 7). */
const SEQUENCE_EXAMPLE = [0, 4, 8, 2, 6];

function Example({ type }: { type: PuzzleType }) {
  if (type === "anagram") {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">Unscramble the letters to make a word.</p>
        <div className="flex gap-2">
          {ANAGRAM_EXAMPLE.map((letter, index) => (
            <span
              key={index}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card font-display text-lg font-bold"
            >
              {letter}
            </span>
          ))}
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          answer <span className="font-bold text-primary">PLANET</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Type the word and hit Submit. Faster = more points.
        </p>
      </div>
    );
  }

  if (type === "arithmetic") {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">Solve the sum as fast as you can.</p>
        <p className="font-mono text-4xl font-bold">36 + 27 = ?</p>
        <p className="font-mono text-sm text-muted-foreground">
          answer <span className="font-bold text-primary">63</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Type the number and hit Submit. Faster = more points.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Watch the tiles light up, then tap them back in the same order.
      </p>
      <SequenceGrid order={SEQUENCE_EXAMPLE} size="sm" />
      <p className="text-xs text-muted-foreground">
        Your timer starts after the sequence has played.
      </p>
    </div>
  );
}

export function RoundIntro({ round, type, startedAt, now }: RoundIntroProps) {
  const elapsed = Math.max(0, now - startedAt);
  const remaining = Math.max(0, INTRO_MS - elapsed);
  const counting = remaining <= INTRO_COUNTDOWN_MS;
  const progress = Math.min(
    100,
    (elapsed / (INTRO_MS - INTRO_COUNTDOWN_MS)) * 100,
  );
  const secondsLeft = Math.max(1, Math.ceil(remaining / 1000));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Round {round} of {TOTAL_ROUNDS}
        </span>
        <span className="font-display text-sm font-bold text-foreground">Get ready</span>
      </div>

      <h1 className="text-center font-display text-3xl font-bold">{PUZZLE_LABELS[type]}</h1>

      <div className="flex flex-1 flex-col items-center justify-center">
        <Example type={type} />
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
