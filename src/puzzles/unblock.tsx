import { solvedMovesText } from "@/lib/duel/scoring";
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
        Fewer moves earns a bonus. You have 60 seconds.
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

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
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

  // Guarded: a missing or unreadable solution must never break the round.
  let vehicles = (puzzle.vehicles ?? []).map((vehicle) => ({ ...vehicle }));
  let available = solution.length > 0 && vehicles.length > 0;
  try {
    for (const move of solution.slice(0, step)) {
      const next = applyMove(vehicles, move);
      if (!next) {
        available = false;
        break;
      }
      vehicles = next;
    }
  } catch {
    available = false;
  }

  const mine = decodeMoves(myAnswer ?? "").length;
  const min = puzzle.minMoves ?? 0;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {vehicles.length > 0 && (
        <div style={{ width: 220 }}>
          <UnblockBoard vehicles={vehicles} size={220} />
        </div>
      )}
      {!available && (
        <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
          Solution unavailable
        </p>
      )}
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        {myCorrect ? "✓" : "✗"} your moves: <span className="text-primary">{mine}</span>
        {min > 0 ? ` · min ${min}` : ""}
      </p>
      {myCorrect ? (
        <p className="font-mono text-base text-primary">
          {solvedMovesText(mine, min, myMsRemaining, timeLimitMs)}
        </p>
      ) : null}
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
