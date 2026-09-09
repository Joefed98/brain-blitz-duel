import { puzzleDef } from "@/lib/duel/registry";
import { REVEAL_MS, TOTAL_ROUNDS, type PuzzleData } from "@/lib/duel/types";

interface AnswerRevealProps {
  round: number;
  puzzle: PuzzleData;
  /** The player's own submitted answer, or null if they never submitted. */
  myAnswer: string | null;
  myCorrect: boolean;
  myReactionAvgMs: number | null;
  startedAt: number;
  now: number;
}

export function AnswerReveal({
  round,
  puzzle,
  myAnswer,
  myCorrect,
  myReactionAvgMs,
  startedAt,
  now,
}: AnswerRevealProps) {
  const secondsLeft = Math.max(0, Math.ceil((REVEAL_MS - Math.max(0, now - startedAt)) / 1000));
  const def = puzzleDef(puzzle.type);
  const Reveal = def.Reveal;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Round {round} of {TOTAL_ROUNDS}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{secondsLeft}s</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {def.revealHeading ?? "The answer was"}
        </p>
        <Reveal
          puzzle={puzzle}
          myAnswer={myAnswer}
          myCorrect={myCorrect}
          myReactionAvgMs={myReactionAvgMs}
        />
      </div>
    </div>
  );
}
