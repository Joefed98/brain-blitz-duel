import { SequenceGrid } from "@/components/duel/SequenceGrid";
import { SequencePuzzle } from "@/components/puzzles/SequencePuzzle";
import { shuffled } from "@/lib/duel/random";
import {
  REVERSE_LENGTH,
  SEQUENCE_COLS,
  sequencePlaybackMs,
  type SequencePuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example — six tiles of the 4x4 grid, every time. */
const EXAMPLE_SHOWN = [1, 6, 11, 12, 3, 9];
const EXAMPLE_TAPS = [...EXAMPLE_SHOWN].reverse();

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Watch the tiles light up, then tap them back in reverse order — last one first.
      </p>
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-2">
          <SequenceGrid order={EXAMPLE_SHOWN} cols={SEQUENCE_COLS} size="xs" />
          <span className="font-mono text-[10px] uppercase text-muted-foreground">Shown</span>
        </div>
        <span className="text-xl text-muted-foreground">→</span>
        <div className="flex flex-col items-center gap-2">
          <SequenceGrid order={EXAMPLE_TAPS} cols={SEQUENCE_COLS} tone="opponent" size="xs" />
          <span className="font-mono text-[10px] uppercase text-opponent">Tap</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Your timer starts after the sequence has played.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "reverse") return null;
  return (
    <SequencePuzzle
      puzzle={puzzle}
      playbackStartAt={phaseStartedAt}
      now={now}
      locked={locked}
      onSubmit={onSubmit}
      reverse
    />
  );
}

function parseTaps(answer: string): number[] {
  return answer
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite);
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "reverse") return null;
  const correctOrder = puzzle.answerOrder ?? [...puzzle.tiles].reverse();
  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-2">
          <SequenceGrid order={correctOrder} cols={SEQUENCE_COLS} size="xs" />
          <span className="font-mono text-[10px] uppercase text-muted-foreground">Correct</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <SequenceGrid
            order={myAnswer ? parseTaps(myAnswer) : []}
            cols={SEQUENCE_COLS}
            tone={myCorrect ? "primary" : "warn"}
            size="xs"
          />
          <span
            className={`font-mono text-[10px] uppercase ${myCorrect ? "text-primary" : "text-warn"}`}
          >
            {myAnswer ? `Yours ${myCorrect ? "✓" : "✗"}` : "No answer"}
          </span>
        </div>
      </div>
    </>
  );
}

export const reverseRecallPuzzle: PuzzleDefinition = {
  key: "reverse",
  name: "Reverse Recall",
  category: "memory",
  timeLimitMs: 30_000,
  generate: () => {
    const cells = SEQUENCE_COLS * SEQUENCE_COLS;
    // Distinct tiles, so the reverse order is never the same as the shown order.
    const tiles = shuffled(Array.from({ length: cells }, (_, index) => index)).slice(
      0,
      REVERSE_LENGTH,
    );
    return {
      type: "reverse",
      tiles,
      answerOrder: [...tiles].reverse(),
    } satisfies SequencePuzzleData;
  },
  check: (answer, puzzle) => {
    if (puzzle.type !== "reverse") return false;
    const taps = parseTaps(answer);
    const expected = puzzle.answerOrder ?? [...puzzle.tiles].reverse();
    return taps.length === expected.length && taps.every((tap, index) => tap === expected[index]);
  },
  prepMs: () => sequencePlaybackMs(REVERSE_LENGTH),
  IntroExample,
  Stage,
  Reveal,
};
