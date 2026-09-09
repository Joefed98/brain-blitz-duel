import { SequenceGrid } from "./SequenceGrid";
import { REVEAL_MS, TOTAL_ROUNDS, type PuzzleData } from "@/lib/duel/types";

interface AnswerRevealProps {
  round: number;
  puzzle: PuzzleData;
  /** The player's own submitted answer, or null if they never submitted. */
  myAnswer: string | null;
  myCorrect: boolean;
  startedAt: number;
  now: number;
}

function parseTaps(answer: string): number[] {
  return answer
    .split(",")
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));
}

function correctAnswerDisplay(puzzle: PuzzleData) {
  if (puzzle.type === "anagram") {
    return <p className="font-display text-5xl font-bold text-primary">{puzzle.word}</p>;
  }
  if (puzzle.type === "arithmetic") {
    return <p className="font-mono text-6xl font-bold text-primary">{puzzle.answer}</p>;
  }
  return <SequenceGrid order={puzzle.tiles} />;
}

export function AnswerReveal({
  round,
  puzzle,
  myAnswer,
  myCorrect,
  startedAt,
  now,
}: AnswerRevealProps) {
  const secondsLeft = Math.max(
    0,
    Math.ceil((REVEAL_MS - Math.max(0, now - startedAt)) / 1000),
  );
  const answered = !!myAnswer && myAnswer.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Round {round} of {TOTAL_ROUNDS}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{secondsLeft}s</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            The answer was
          </p>
          {correctAnswerDisplay(puzzle)}
        </div>

        <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-card px-4 py-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your answer</p>
          {!answered ? (
            <p className="font-display text-2xl font-bold text-warn">No answer</p>
          ) : puzzle.type === "sequence" ? (
            <div className="flex flex-col items-center gap-2">
              <SequenceGrid
                order={parseTaps(myAnswer)}
                tone={myCorrect ? "primary" : "warn"}
                size="sm"
              />
              <span
                className={`font-display text-xl font-bold ${
                  myCorrect ? "text-primary" : "text-warn"
                }`}
              >
                {myCorrect ? "✓" : "✗"}
              </span>
            </div>
          ) : (
            <p
              className={`font-display text-3xl font-bold ${
                myCorrect ? "text-primary" : "text-warn"
              }`}
            >
              {myAnswer} {myCorrect ? "✓" : "✗"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
