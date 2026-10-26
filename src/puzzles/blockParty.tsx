import { gameDisplayName } from "@/lib/duel/gameNames";
import { solutionProgress } from "@/lib/duel/progressFigures";
import { BlockBoard, BlockPartyPuzzle } from "@/components/puzzles/BlockPartyPuzzle";
import { blockGeometry, decodePlacements } from "@/lib/duel/blockParty";
import { BLOCK_TIME_MS, type BlockPartyPuzzleData } from "@/lib/duel/types";

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
        Fit every piece around the pegs. Tap to rotate.
      </p>
      <BlockBoard blockers={EXAMPLE_BLOCKERS} placements={EXAMPLE_PLACED} size={150} />
      <p className="text-xs text-muted-foreground">
        Fill every free square to finish. You have 60 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  if (puzzle.type !== "blockparty") return null;
  return (
    <BlockPartyPuzzle
      puzzle={puzzle}
      phaseStartedAt={phaseStartedAt}
      now={now}
      locked={locked}
      onSubmit={onSubmit}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "blockparty") return null;
  const mine = decodePlacements(myAnswer ?? "");
  const geo = blockGeometry(puzzle);
  const covered = mine.reduce((sum, entry) => sum + entry.cells.length, 0);

  return (
    <div className="bp-reveal flex w-full flex-col items-center gap-3">
      <div className="bp-reveal-space">
        <div className="bp-reveal-pair">
          <div className="flex flex-col items-center gap-1">
            <div className="bp-reveal-board">
              <BlockBoard blockers={puzzle.blockers} placements={puzzle.solution ?? []} cols={geo.cols} />
            </div>
            <span className="font-mono text-base uppercase tracking-widest text-muted-foreground">
              one solution
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="bp-reveal-board">
              <BlockBoard blockers={puzzle.blockers} placements={mine} cols={geo.cols} />
            </div>
            <span className="font-mono text-base uppercase tracking-widest text-muted-foreground">
              your board
            </span>
          </div>
        </div>
      </div>
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        {myCorrect ? (
          <span className="text-primary">Solved</span>
        ) : (
          (solutionProgress(puzzle, myAnswer ?? "")?.text ?? `${covered} / ${geo.free} covered`)
        )}
      </p>
    </div>
  );
}

/** Layouts are solver-verified on the server; the solution stays server-side. */
export const blockPartyPuzzle: PuzzleDefinition = {
  key: "blockparty",
  name: gameDisplayName("blockparty"),
  category: "pattern",
  timeLimitMs: BLOCK_TIME_MS,
  generate: () => ({ type: "blockparty", blockers: [] }) satisfies BlockPartyPuzzleData,
  check: () => false,
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
