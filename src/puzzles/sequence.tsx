import { SequenceGrid } from "@/components/duel/SequenceGrid";
import { SequencePuzzle } from "@/components/puzzles/SequencePuzzle";
import { randInt } from "@/lib/duel/random";
import {
  SEQUENCE_LENGTH,
  SEQUENCE_PLAYBACK_MS,
  type SequencePuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example sequence — tiles 1, 5, 9, 3, 7, every time. */
const EXAMPLE = [0, 4, 8, 2, 6];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Watch the tiles light up, then tap them back in the same order.
      </p>
      <SequenceGrid order={EXAMPLE} size="sm" />
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
      <SequenceGrid order={puzzle.tiles} />
      <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-card px-4 py-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your answer</p>
        {!myAnswer ? (
          <p className="font-display text-2xl font-bold text-warn">No answer</p>
        ) : (
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
    const tiles: number[] = [];
    while (tiles.length < SEQUENCE_LENGTH) {
      const next = randInt(0, 8);
      if (tiles[tiles.length - 1] === next) continue;
      tiles.push(next);
    }
    return { type: "sequence", tiles } satisfies SequencePuzzleData;
  },
  check: (answer, puzzle) => {
    if (puzzle.type !== "sequence") return false;
    const taps = parseTaps(answer);
    return (
      taps.length === puzzle.tiles.length &&
      taps.every((tap, index) => tap === puzzle.tiles[index])
    );
  },
  prepMs: () => SEQUENCE_PLAYBACK_MS,
  IntroExample,
  Stage,
  Reveal,
};
