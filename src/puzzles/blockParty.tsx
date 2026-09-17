import { BlockBoard, BlockPartyPuzzle } from "@/components/puzzles/BlockPartyPuzzle";
import { decodePlacements } from "@/lib/duel/blockParty";
import { BLOCK_FREE_CELLS, BLOCK_TIME_MS, type BlockPartyPuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example — never randomised. */
const EXAMPLE_BLOCKERS = [3, 7, 12, 16, 21, 28, 33];
const EXAMPLE_PLACED = [
  { piece: 4, cells: [24, 25, 30, 31] },
  { piece: 2, cells: [18, 19, 20] },
  { piece: 1, cells: [13, 14] },
];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Fit all nine pieces around the pegs. Rotate with a tap, flip with a double tap.
      </p>
      <BlockBoard blockers={EXAMPLE_BLOCKERS} placements={EXAMPLE_PLACED} size={150} />
      <p className="text-xs text-muted-foreground">
        Fill every free square to finish. You have 60 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "blockparty") return null;
  return (
    <BlockPartyPuzzle
      puzzle={puzzle}
      phaseStartedAt={phaseStartedAt}
      now={now}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "blockparty") return null;
  const mine = decodePlacements(myAnswer ?? "");
  const covered = mine.reduce((sum, entry) => sum + entry.cells.length, 0);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex items-start justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <BlockBoard blockers={puzzle.blockers} placements={puzzle.solution ?? []} size={140} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            one solution
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <BlockBoard blockers={puzzle.blockers} placements={mine} size={140} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            your board
          </span>
        </div>
      </div>
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        {myCorrect ? (
          <span className="text-primary">Solved</span>
        ) : (
          `${covered} / ${BLOCK_FREE_CELLS} covered`
        )}
      </p>
    </div>
  );
}

/** Layouts are solver-verified on the server; the solution stays server-side. */
export const blockPartyPuzzle: PuzzleDefinition = {
  key: "blockparty",
  name: "Block Party",
  category: "pattern",
  timeLimitMs: BLOCK_TIME_MS,
  generate: () => ({ type: "blockparty", blockers: [] }) satisfies BlockPartyPuzzleData,
  check: () => false,
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
