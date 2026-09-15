import { useEffect, useState } from "react";

import { UnblockBoard, UnblockPuzzle } from "@/components/puzzles/UnblockPuzzle";
import { applyMove, decodeMoves } from "@/lib/duel/unblock";
import { UNBLOCK_TIME_MS, type UnblockPuzzleData, type UnblockVehicle } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example — never randomised. */
const EXAMPLE_VEHICLES: UnblockVehicle[] = [
  { id: 0, axis: "h", len: 2, row: 2, col: 0 },
  { id: 1, axis: "v", len: 3, row: 0, col: 3 },
  { id: 2, axis: "v", len: 2, row: 2, col: 5 },
];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Slide the cars out of the way. Get the gold car to the exit.
      </p>
      <div className="relative" style={{ width: 150 }}>
        <UnblockBoard vehicles={EXAMPLE_VEHICLES} size={150} />
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <line
            x1={33}
            y1={41.5}
            x2={94}
            y2={41.5}
            stroke="var(--primary)"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <polyline
            points="88,36 96,41.5 88,47"
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
          />
        </svg>
      </div>
      <p className="text-xs text-muted-foreground">
        Fewer moves earns a bonus. You have 90 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "unblock") return null;
  return (
    <UnblockPuzzle
      puzzle={puzzle}
      phaseStartedAt={phaseStartedAt}
      now={now}
      locked={locked}
      onSubmit={onSubmit}
    />
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  const solution = decodeMoves(puzzle.type === "unblock" ? (puzzle.solution ?? "") : "");
  const [step, setStep] = useState(0);

  // The shortest solution plays back over about three seconds.
  useEffect(() => {
    if (solution.length === 0) return;
    const gap = Math.max(220, Math.round(3000 / solution.length));
    const id = setInterval(() => {
      setStep((current) => (current >= solution.length ? current : current + 1));
    }, gap);
    return () => clearInterval(id);
  }, [solution.length]);

  if (puzzle.type !== "unblock") return null;

  let vehicles = puzzle.vehicles.map((vehicle) => ({ ...vehicle }));
  for (const move of solution.slice(0, step)) {
    vehicles = applyMove(vehicles, move) ?? vehicles;
  }

  const mine = decodeMoves(myAnswer ?? "").length;
  const min = puzzle.minMoves ?? 0;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div style={{ width: 220 }}>
        <UnblockBoard vehicles={vehicles} size={220} />
      </div>
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        {myCorrect ? "✓" : "✗"} your moves: <span className="text-primary">{mine}</span>
        {min > 0 ? ` · min ${min}` : ""}
      </p>
    </div>
  );
}

/** Layouts come from a verified bank; the minimum and its solution stay server-side. */
export const unblockPuzzle: PuzzleDefinition = {
  key: "unblock",
  name: "Unblock",
  category: "pattern",
  timeLimitMs: UNBLOCK_TIME_MS,
  generate: () => ({ type: "unblock", vehicles: [] }) satisfies UnblockPuzzleData,
  check: () => false,
  revealHeading: "The shortest solution",
  IntroExample,
  Stage,
  Reveal,
};
