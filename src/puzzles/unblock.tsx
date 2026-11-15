import { gameDisplayName } from "@/lib/duel/gameNames";
import { solvedMovesText } from "@/lib/duel/scoring";
import { useEffect, useState } from "react";

import { UnblockBoard, UnblockPuzzle } from "@/components/puzzles/UnblockPuzzle";
import { applyMove, countedMoves, decodeMoves, position, replayUnblock, vehicleCells } from "@/lib/duel/unblock";
import { unblockCarSprite } from "@/components/puzzles/pattern/unblockArt";
import { usesPatternNov15 } from "@/lib/duel/patternNov15";
import "@/polish-layout/polish-nov3-pattern.css";
import { UNBLOCK_COLS, UNBLOCK_TIME_MS, type UnblockPuzzleData, type UnblockVehicle } from "@/lib/duel/types";

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
        Fewer moves earn a bonus; Undo gives a move back. You have 60 seconds.
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

const pct = (value: number) => `${(value * 100) / UNBLOCK_COLS}%`;

/** The cars standing in the gold car's lane, between its nose and the exit (an unfinished board's blockers). */
export function laneBlockers(vehicles: UnblockVehicle[]): number[] {
  const gold = vehicles.find((v) => v.id === 0);
  if (!gold || gold.axis !== "h") return [];
  const out: number[] = [];
  for (const v of vehicles) {
    if (v.id === 0) continue;
    const cells = vehicleCells(v);
    for (let col = gold.col + gold.len; col < UNBLOCK_COLS; col++) {
      if (cells.includes(gold.row * UNBLOCK_COLS + col)) {
        out.push(v.id);
        break;
      }
    }
  }
  return out;
}

/** One move of the par route as a chip: the car's own sprite, the way it slides and how far. */
export interface RouteChip {
  id: number;
  axis: "h" | "v";
  len: number;
  arrow: "←" | "→" | "↑" | "↓";
  bays: number;
}

/** The par route as chips, walked on the stored layout (null if the stored solution doesn't play). */
export function routeChips(start: UnblockVehicle[], moves: { id: number; to: number }[]): RouteChip[] | null {
  let state = start;
  const out: RouteChip[] = [];
  for (const m of moves) {
    const v = state.find((x) => x.id === m.id);
    const next = applyMove(state, m);
    if (!v || !next) return null;
    const from = position(v);
    const forward = m.to > from;
    out.push({ id: v.id, axis: v.axis, len: v.len, arrow: v.axis === "h" ? (forward ? "→" : "←") : forward ? "↓" : "↑", bays: Math.abs(m.to - from) });
    state = next;
  }
  return out;
}

/** Red outlines over an unfinished board's blockers (drawn inside the board's grid, on each car's box). */
function BlockerMarks({ vehicles, ids }: { vehicles: UnblockVehicle[]; ids: number[] }) {
  return (
    <>
      {vehicles
        .filter((v) => ids.includes(v.id))
        .map((v) => (
          <div
            key={v.id}
            aria-hidden="true"
            className="unblock-blocker pointer-events-none absolute"
            data-unblock-blocker={v.id}
            style={{
              left: pct(v.col),
              top: pct(v.row),
              width: pct(v.axis === "h" ? v.len : 1),
              height: pct(v.axis === "v" ? v.len : 1),
            }}
          />
        ))}
    </>
  );
}

/** The par route: one chip a move, the chip of the move the board has just played lit. */
function RouteStrip({ chips, step }: { chips: RouteChip[]; step: number }) {
  return (
    <ol className="unblock-route" aria-label={`Par route, ${chips.length} moves`} data-unblock-route={chips.length}>
      {chips.map((c, i) => (
        <li key={i} className="unblock-route-chip" data-active={i === step - 1 ? "" : undefined} data-done={i < step - 1 ? "" : undefined}>
          <img
            src={unblockCarSprite(c.id, c.axis, c.len)}
            alt=""
            aria-hidden="true"
            className={`unblock-route-car unblock-route-car--${c.axis}`}
            draggable={false}
          />
          <span className="unblock-route-move">
            {c.arrow}
            {c.bays > 1 ? c.bays : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The answer reveal (the Pattern overhaul, 15 Nov 2026; Joe's reveal brief): the shortest solution large and playing
 * back, with the par route as a strip of move chips under it; Yours is the board the player left, its gold car's
 * blockers outlined red when unfinished; the key numbers (Par, the player's moves from the stored grade, time left on a
 * solve) as pills, the player's own only under Yours. Every stamp takes this look; older stamps count their moves as
 * their grader did (every slide; unblockRev 4 the slides left on the board).
 */
function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, scoreParts, myExtra }: PuzzleRevealProps) {
  const solution = decodeMoves(puzzle.type === "unblock" ? (puzzle.solution ?? "") : "");
  const [step, setStep] = useState(0);

  // The reveal plays the stored shortest solution back (about three seconds, after a short pause on the start).
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

  // Guarded: a missing or unreadable solution must never break the round (the player's own board stands in).
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
  const chips = solution.length > 0 && start.length > 0 ? routeChips(start, solution) : null;
  const available = chips !== null;
  const shown = available ? (playOut(solution.slice(0, step)) ?? start) : start;
  // The player's board as the grader left it (Undo -1:0 and Reset -2:0 replayed as replayUnblock does).
  const replay = start.length > 0 && myAnswer !== null ? safeReplay(start, myAnswer) : null;
  const overhaul = usesPatternNov15(puzzle, "unblock");
  const yours = replay?.vehicles ?? null;
  const blockers = yours && !myCorrect ? laneBlockers(yours) : [];

  // The key numbers from the stored grade (its `moves`, par and time left); the replay only stands in on a row
  // stored without them.
  const storedMoves = typeof myExtra?.["moves"] === "number" ? (myExtra["moves"] as number) : null;
  const mine = storedMoves ?? (replay ? countedMoves(replay, overhaul) : 0);
  const storedPar = typeof myExtra?.["par"] === "number" ? (myExtra["par"] as number) : null;
  const min = storedPar ?? puzzle.par ?? puzzle.minMoves ?? 0;
  const parLabel = (puzzle.unblockRev ?? 0) >= 1 ? "Par" : "Fewest";
  const timeLeft = myCorrect && typeof myMsRemaining === "number" ? Math.max(0, Math.round(myMsRemaining / 1000)) : null;

  const solutionBoard = (
    <div className="unblock-reveal-space">
      <div className="unblock-reveal-board" data-unblock-reveal-step={step}>
        <UnblockBoard vehicles={shown} />
      </div>
    </div>
  );
  const yoursBoard = yours ? (
    <div className="unblock-reveal-space">
      <div className="unblock-reveal-board" data-unblock-yours-board={myCorrect ? "solved" : "unfinished"}>
        <UnblockBoard vehicles={yours}>{blockers.length ? <BlockerMarks vehicles={yours} ids={blockers} /> : null}</UnblockBoard>
      </div>
    </div>
  ) : null;

  return (
    <div className="unblock-reveal flex w-full flex-col items-center gap-2">
      {available && yoursBoard ? (
        // Two labelled columns: the answer reveal's Solution / Yours switch (SolutionSwitch) shows one at a time, at
        // full size, the solution first; the time-lapse (data-timelapse) shows only the player's board.
        <div className="unblock-reveal-pair flex w-full items-start justify-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2" data-unblock-solution="">
            <span className="unblock-reveal-label">Solution</span>
            {solutionBoard}
            <RouteStrip chips={chips!} step={step} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2" data-unblock-yours="">
            <span className="unblock-reveal-label">Yours</span>
            {yoursBoard}
            {blockers.length ? (
              <p className="unblock-reveal-note" data-unblock-blockers={blockers.length}>
                {blockers.length === 1 ? "1 car" : `${blockers.length} cars`} still in the gold car’s way
              </p>
            ) : null}
          </div>
        </div>
      ) : available ? (
        <>
          {solutionBoard}
          <RouteStrip chips={chips!} step={step} />
        </>
      ) : yoursBoard ? (
        yoursBoard
      ) : start.length > 0 ? (
        <div className="unblock-reveal-space">
          <div className="unblock-reveal-board">
            <UnblockBoard vehicles={start} />
          </div>
        </div>
      ) : null}
      {!available && <p className="unblock-reveal-note">Solution unavailable</p>}
      <div className="unblock-reveal-keys" data-unblock-keys="">
        {min > 0 ? (
          <span className="unblock-key" data-unblock-key="par">
            {parLabel} <span className="unblock-key-value">{min}</span>
          </span>
        ) : null}
        {replay ? (
          <span className="unblock-key" data-unblock-key="you" data-yours-only="">
            your moves: <span className="unblock-key-value">{mine}</span>
          </span>
        ) : null}
        {timeLeft !== null ? (
          <span className="unblock-key" data-unblock-key="time" data-yours-only="">
            Time left <span className="unblock-key-value">{timeLeft} s</span>
          </span>
        ) : null}
      </div>
      {myCorrect && scoreParts?.kind !== "finish" ? (
        <p className="unblock-reveal-note" data-yours-only="">
          {solvedMovesText(mine, min, myMsRemaining, timeLimitMs, "B", scoreParts)}
        </p>
      ) : null}
    </div>
  );
}

/** The grader's own replay of a stored answer (undo and reset markers included); null if it can't be read. */
export function safeReplay(start: UnblockVehicle[], answer: string) {
  try {
    return replayUnblock(start, decodeMoves(answer));
  } catch {
    return null;
  }
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
