import { SequenceGrid } from "@/components/duel/SequenceGrid";
import { SequencePuzzle } from "@/components/puzzles/SequencePuzzle";
import { shuffled } from "@/lib/duel/random";
import {
  SEQUENCE_COLS,
  SEQUENCE_LENGTH,
  sequencePlaybackMs,
  type SequencePuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example sequence — seven tiles of the 4x4 grid, every time. */
const EXAMPLE = [0, 5, 10, 15, 3, 6, 9];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Watch the tiles light up, then tap them back in the same order.
      </p>
      <SequenceGrid order={EXAMPLE} cols={SEQUENCE_COLS} size="sm" />
      <p className="text-xs text-muted-foreground">
        Your timer starts after the sequence has played.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "sequence") return null;
  return (
    <SequencePuzzle
      puzzle={puzzle}
      playbackStartAt={phaseStartedAt}
      now={now}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}

function parseTaps(answer: string): number[] {
  return answer
    .split(",")
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "sequence") return null;
  return (
    <>
      <SequenceGrid order={puzzle.tiles} cols={SEQUENCE_COLS} />
      <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-card px-4 py-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your answer</p>
        {!myAnswer ? (
          <p className="font-display text-2xl font-bold text-warn">No answer</p>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <SequenceGrid
              order={parseTaps(myAnswer)}
              cols={SEQUENCE_COLS}
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
        )}
      </div>
    </>
  );
}

export const sequencePuzzle: PuzzleDefinition = {
  key: "sequence",
  name: "Sequence Recall",
  category: "memory",
  generate: () => {
    const cells = SEQUENCE_COLS * SEQUENCE_COLS;
    const tiles = shuffled(Array.from({ length: cells }, (_, index) => index)).slice(
      0,
      SEQUENCE_LENGTH,
    );
    return { type: "sequence", tiles } satisfies SequencePuzzleData;
  },
  check: (answer, puzzle) => {
    if (puzzle.type !== "sequence") return false;
    const taps = parseTaps(answer);
    return (
      taps.length === puzzle.tiles.length && taps.every((tap, index) => tap === puzzle.tiles[index])
    );
  },
  prepMs: () => sequencePlaybackMs(SEQUENCE_LENGTH),
  IntroExample,
  Stage,
  Reveal,
};
