import { playWrong } from "@/lib/sound";
import { useEffect, useMemo, useRef, useState } from "react";

import { buzz } from "@/lib/motion";
import {
  applyOperation,
  decodeSteps,
  encodeSteps,
  formatStep,
  generateTargetPuzzle,
  LARGE_TILES,
  replayTargetSteps,
  TARGET_OPERATORS,
} from "@/lib/duel/target";
import {
  TARGET_TIME_MS,
  type Operator,
  type TargetNumberPuzzleData,
  type TargetStep,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/* -------------------------------------------------------------------------- */
/*  Target Number — reach a three-digit target from six tiles.                 */
/*                                                                             */
/*  The client only renders and collects steps. Generating the puzzle, checking */
/*  each step and scoring the round all happen on the server.                   */
/* -------------------------------------------------------------------------- */

function isLarge(value: number): boolean {
  return LARGE_TILES.includes(value);
}

function tileClass(value: number, state: "idle" | "selected" | "consumed"): string {
  const base =
    "press flex h-16 items-center justify-center rounded-2xl border font-mono text-2xl font-bold tabular-nums transition-all duration-150";
  const colour = isLarge(value) ? "text-primary" : "text-foreground";
  if (state === "selected") return `${base} border-primary bg-primary/15 scale-105 ${colour}`;
  if (state === "consumed")
    return `${base} border-border/40 bg-card/40 text-muted-foreground opacity-35`;
  return `${base} border-border bg-card ${colour}`;
}

function IntroExample() {
  const tiles = [75, 4, 6, 2, 10, 3];
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Use the six numbers to reach the target. Each number once; every step must be a whole
        number.
      </p>
      <p className="font-mono text-5xl font-bold text-primary">462</p>
      <div className="grid w-full max-w-[260px] grid-cols-3 gap-2">
        {tiles.map((tile, index) => (
          <div
            key={`${tile}-${index}`}
            className={`flex h-12 items-center justify-center rounded-xl border border-border bg-card font-mono text-lg font-bold tabular-nums ${
              isLarge(tile) ? "text-primary" : "text-foreground"
            }`}
          >
            {tile}
          </div>
        ))}
      </div>
      <p className="text-center font-mono text-xs text-muted-foreground">
        75 × 6 = 450 · 450 + 10 = 460 · 460 + 2 = 462
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Exact hit scores full points; close counts for less.
      </p>
    </div>
  );
}

interface Tile {
  id: number;
  value: number;
  active: boolean;
}

interface HistoryEntry {
  step: TargetStep;
  before: Tile[];
}

function Stage(props: PuzzleStageProps) {
  if (props.puzzle.type !== "target") return null;
  return <TargetStage {...props} tiles={props.puzzle.tiles} target={props.puzzle.target} />;
}

function TargetStage({
  tiles: startTiles,
  target,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
}: PuzzleStageProps & { tiles: number[]; target: number }) {
  const [pool, setPool] = useState<Tile[]>(() =>
    startTiles.map((value, id) => ({ id, value, active: true })),
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [shake, setShake] = useState(0);
  const [lockedHere, setLockedHere] = useState(false);
  const submitted = useRef(false);

  const steps = history.map((h) => h.step);

  const send = (list: TargetStep[]) => {
    if (submitted.current) return;
    submitted.current = true;
    setLockedHere(true);
    onSubmit(encodeSteps(list));
  };

  const refuse = () => {
    setShake((n) => n + 1);
    playWrong();
    buzz(20);
    setSelectedId(null);
    setOperator(null);
  };

  const reset = () => {
    if (locked || lockedHere) return;
    setPool(startTiles.map((value, id) => ({ id, value, active: true })));
    setHistory([]);
    setSelectedId(null);
    setOperator(null);
  };

  const undo = () => {
    if (locked || lockedHere) return;
    const last = history[history.length - 1];
    if (!last) return;
    setPool(last.before);
    setHistory((current) => current.slice(0, -1));
    setSelectedId(null);
    setOperator(null);
  };

  const tapTile = (tile: Tile) => {
    if (locked || lockedHere || !tile.active) return;
    if (selectedId === null) {
      setSelectedId(tile.id);
      return;
    }
    if (tile.id === selectedId) {
      setSelectedId(null);
      setOperator(null);
      return;
    }
    if (operator === null) {
      setSelectedId(tile.id);
      return;
    }
    const first = pool.find((t) => t.id === selectedId);
    if (!first) return refuse();
    const result = applyOperation(first.value, tile.value, operator);
    if (result === null) return refuse();

    const step: TargetStep = { a: first.value, b: tile.value, operator, result };
    const before = pool.map((entry) => ({ ...entry }));
    const nextHistory = [...history, { step, before }];
    setPool((current) =>
      current.map((entry) => {
        if (entry.id === first.id) return { ...entry, value: result, active: true };
        if (entry.id === tile.id) return { ...entry, active: false };
        return entry;
      }),
    );
    setHistory(nextHistory);
    setSelectedId(first.id);
    setOperator(null);
    buzz(10);

    // Hitting the target locks the answer at once.
    if (result === target) send(nextHistory.map((h) => h.step));
  };

  // Out of time: the closest tile goes in automatically.
  useEffect(() => {
    if (locked || lockedHere || submitted.current) return;
    if (now < phaseStartedAt + TARGET_TIME_MS - 400) return;
    send(steps);
  });

  const closest = pool
    .filter((tile) => tile.active)
    .reduce<number | null>(
      (best, tile) =>
        best === null || Math.abs(tile.value - target) < Math.abs(best - target)
          ? tile.value
          : best,
      null,
    );
  const away = closest === null ? null : Math.abs(closest - target);
  const isLockedNow = locked || lockedHere;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col justify-between gap-2">
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Target</p>
        <p className="font-mono text-5xl font-bold leading-none text-primary tabular-nums">
          {target}
        </p>
      </div>

      <div className="flex max-h-[3.75rem] min-h-10 flex-col items-center gap-0.5 overflow-y-auto rounded-lg px-2">
        {steps.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">No steps yet</p>
        ) : (
          steps.map((step, index) => (
            <p
              key={`${index}-${step.result}`}
              className="font-mono text-xs tabular-nums text-muted-foreground"
            >
              {formatStep(step)}
            </p>
          ))
        )}
      </div>

      <div key={shake} className={shake > 0 ? "animate-shake" : ""}>
        <div className="grid grid-cols-3 gap-2">
          {pool.map((tile) => (
            <button
              key={tile.id}
              type="button"
              disabled={isLockedNow || !tile.active}
              onClick={() => tapTile(tile)}
              className={tileClass(
                tile.value,
                !tile.active ? "consumed" : selectedId === tile.id ? "selected" : "idle",
              )}
            >
              {tile.value}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {TARGET_OPERATORS.map((op) => (
          <button
            key={op}
            type="button"
            disabled={isLockedNow}
            onClick={() => setOperator(op)}
            className={`press flex h-12 items-center justify-center rounded-xl border font-mono text-xl font-bold ${
              operator === op
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card text-foreground"
            }`}
          >
            {op === "-" ? "−" : op}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={undo}
            disabled={isLockedNow || history.length === 0}
            className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={isLockedNow || history.length === 0}
            className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground disabled:opacity-40"
          >
            Reset
          </button>
        </div>
        <button
          type="button"
          onClick={() => send(steps)}
          disabled={isLockedNow}
          className="press tap-target rounded-xl bg-primary px-6 font-display text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
        >
          Lock{steps.length > 0 && away !== null && away > 0 ? ` · ${away} away` : ""}
        </button>
      </div>

      {isLockedNow && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="animate-stamp-in rounded-xl border-2 border-primary px-6 py-2 font-display text-2xl font-bold uppercase tracking-[0.2em] text-primary">
            Locked
          </p>
        </div>
      )}
    </div>
  );
}

function Reveal(props: PuzzleRevealProps) {
  if (props.puzzle.type !== "target") return null;
  return <TargetReveal {...props} puzzle={props.puzzle} />;
}

function TargetReveal({
  puzzle,
  myAnswer,
  myCorrect,
}: PuzzleRevealProps & { puzzle: TargetNumberPuzzleData }) {
  const replay = useMemo(
    () => replayTargetSteps(puzzle.tiles, puzzle.target, decodeSteps(myAnswer ?? "")),
    [puzzle.tiles, puzzle.target, myAnswer],
  );
  const away = replay.distance;
  return (
    <div className="flex w-full flex-col items-center gap-3 text-center font-mono text-base">
      <p className="text-muted-foreground">Target {puzzle.target}</p>
      <p className="text-5xl font-bold text-primary tabular-nums">{replay.value ?? "—"}</p>
      <p className="font-bold text-foreground">{myCorrect || away === 0 ? "Target Number Achieved" : away === null ? "No number locked" : `${away} away from the target`}</p>
      {(puzzle.solution ?? []).length > 0 && (
        <div className="flex flex-col gap-1 text-muted-foreground"><p>One way:</p>{puzzle.solution.map((step, index) => <p key={index}>{formatStep(step)}</p>)}</div>
      )}
    </div>
  );
}

export const targetNumberPuzzle: PuzzleDefinition = {
  key: "target",
  name: "Target Number",
  category: "number",
  timeLimitMs: TARGET_TIME_MS,
  generate: generateTargetPuzzle,
  check: (answer, puzzle) => {
    if (puzzle.type !== "target") return false;
    const replay = replayTargetSteps(puzzle.tiles, puzzle.target, decodeSteps(answer));
    return replay.distance === 0;
  },
  IntroExample,
  Stage,
  Reveal,
};
