import { gameDisplayName } from "@/lib/duel/gameNames";
import { solvedMovesText } from "@/lib/duel/scoring";
import { useEffect, useState } from "react";

import { UnblockBoard, UnblockPuzzle } from "@/components/puzzles/UnblockPuzzle";
import { applyMove, decodeMoves } from "@/lib/duel/unblock";
import "@/polish-layout/polish-nov3-pattern.css";
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
        Slide the blocks out of the way. Get the gold block to the exit.
      </p>
      <div className="relative" style={{ width: 150 }}>
        <UnblockBoard vehicles={EXAMPLE_VEHICLES} size={150} />
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <line
            x1={31}
            y1={37}
            x2={94}
            y2={37}
            stroke="var(--primary)"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <polyline
            points="88,31.5 96,37 88,42.5"
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
          />
        </svg>
      </div>
      <p className="text-xs text-muted-foreground">
        Fewer moves earn a bonus. You have 60 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  if (puzzle.type !== "unblock") return null;
  return (
    <UnblockPuzzle
      puzzle={puzzle}
      phaseStartedAt={phaseStartedAt}
      now={now}
      locked={locked}
      onSubmit={onSubmit}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, scoreParts }: PuzzleRevealProps) {
  const solution = decodeMoves(puzzle.type === "unblock" ? (puzzle.solution ?? "") : "");
  const [step, setStep] = useState(0);

  // Puzzle polish (3 Nov 2026, display only): the reveal is headed "The shortest solution", so it always plays the
  // stored shortest solution back (about three seconds, after a short pause on the start), solved or not; a solved
  // player's own board is the "Yours" side of the Solution / Yours switch.
  useEffect(() => {
    if (solution.length === 0) return;
    setStep(0);
    const gap = Math.max(220, Math.round(3000 / solution.length));
    let id: ReturnType<typeof setInterval> | null = null;
    const wait = setTimeout(() => {
      id = setInterval(() => {
        setStep((current) => (current >= solution.length ? current : current + 1));
      }, gap);
    }, 600);
    return () => {
      clearTimeout(wait);
      if (id !== null) clearInterval(id);
    };
  }, [solution.length]);

  if (puzzle.type !== "unblock") return null;

  // Guarded: a missing or unreadable solution must never break the round (a solved player's own board stands in).
  const start = (puzzle.vehicles ?? []).map((vehicle) => ({ ...vehicle }));
  const playOut = (moves: ReturnType<typeof decodeMoves>) => {
    let vehicles = start;
    try {
      for (const move of moves) {
        const next = applyMove(vehicles, move);
        if (!next) return null;
        vehicles = next;
      }
    } catch {
      return null;
    }
    return vehicles;
  };
  const shortest = solution.length > 0 && start.length > 0 ? playOut(solution) : null;
  const available = shortest !== null;
  const shown = available ? (playOut(solution.slice(0, step)) ?? start) : start;
  // A solved player's own final board (the results screen's time-lapse plays the winner's moves through it).
  const yours = myCorrect ? (playOut(decodeMoves(myAnswer ?? "")) ?? start) : null;

  const mine = decodeMoves(myAnswer ?? "").length;
  const min = puzzle.minMoves ?? 0;

  return (
    <div className="unblock-reveal flex w-full flex-col items-center gap-3">
      {yours && available ? (
        // Two labelled columns: the answer reveal's Solution / Yours switch (SolutionSwitch) shows one at a time,
        // the solution first; the time-lapse (data-timelapse) shows only the player's board (polish-nov3-pattern.css).
        <div className="unblock-reveal-pair flex w-full items-start justify-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1" data-unblock-solution="">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
            <div className="unblock-reveal-space">
              <div className="unblock-reveal-board" data-unblock-reveal-step={step}>
                <UnblockBoard vehicles={shown} />
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1" data-unblock-yours="">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
            <div className="unblock-reveal-space">
              <div className="unblock-reveal-board">
                <UnblockBoard vehicles={yours} />
              </div>
            </div>
          </div>
        </div>
      ) : (yours ?? shown).length > 0 ? (
        <div className="unblock-reveal-space">
          <div className="unblock-reveal-board" data-unblock-reveal-step={available ? step : undefined}>
            <UnblockBoard vehicles={yours ?? shown} />
          </div>
        </div>
      ) : null}
      {!available && (
        <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
          Solution unavailable
        </p>
      )}
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        {myCorrect ? "✓" : "✗"} your moves: <span className="text-primary">{mine}</span>
        {min > 0 ? ` · ${(puzzle.unblockRev ?? 0) >= 1 ? "par" : "min"} ${min}` : ""}
      </p>
      {myCorrect ? (
        <p className="font-mono text-base text-primary">
          {solvedMovesText(mine, min, myMsRemaining, timeLimitMs, "B", scoreParts)}
        </p>
      ) : null}
    </div>
  );
}

/** Layouts come from a verified bank; the minimum and its solution stay server-side. */
export const unblockPuzzle: PuzzleDefinition = {
  key: "unblock",
  name: gameDisplayName("unblock"),
  category: "pattern",
  timeLimitMs: UNBLOCK_TIME_MS,
  generate: () => ({ type: "unblock", vehicles: [] }) satisfies UnblockPuzzleData,
  check: () => false,
  revealHeading: "The shortest solution",
  IntroExample,
  Stage,
  Reveal,
};
