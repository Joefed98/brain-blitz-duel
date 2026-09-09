import { AnagramPuzzle } from "@/components/puzzles/AnagramPuzzle";
import { ArithmeticPuzzle } from "@/components/puzzles/ArithmeticPuzzle";
import { SequencePuzzle } from "@/components/puzzles/SequencePuzzle";
import type { PuzzleData } from "@/lib/duel/types";

interface PuzzleStageProps {
  puzzle: PuzzleData;
  roundStartedAt: number;
  now: number;
  locked: boolean;
  onSubmit: (answer: string) => void;
}

/** Routes a stored puzzle to its component. Add new puzzle types here. */
export function PuzzleStage({
  puzzle,
  roundStartedAt,
  now,
  locked,
  onSubmit,
}: PuzzleStageProps) {
  switch (puzzle.type) {
    case "anagram":
      return <AnagramPuzzle puzzle={puzzle} locked={locked} onSubmit={onSubmit} />;
    case "arithmetic":
      return <ArithmeticPuzzle puzzle={puzzle} locked={locked} onSubmit={onSubmit} />;
    case "sequence":
      return (
        <SequencePuzzle
          puzzle={puzzle}
          playbackStartAt={roundStartedAt}
          now={now}
          locked={locked}
          onSubmit={onSubmit}
        />
      );
    default:
      return null;
  }
}
