import { useCallback, useEffect, useMemo, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { encodeFlowPaths, flowAdjacent, flowFilledCells, verifyFlow } from "@/lib/duel/flow";
import { useStageState } from "@/lib/duel/stageState";
import {
  FLOW_CELLS,
  FLOW_COLS,
  FLOW_TIME_MS,
  type FlowPair,
  type FlowPuzzleData,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The dots and paths, drawn in cell units so the board scales to any size. */
function FlowBoard({
  pairs,
  paths,
  cols = FLOW_COLS,
  onCell,
  onRelease,
  onDot,
}: {
  pairs: FlowPair[];
  paths: number[][];
  cols?: number;
  onCell?: ((cell: number) => void) | undefined;
  onRelease?: (() => void) | undefined;
  onDot?: ((pair: number) => void) | undefined;
}) {
  const rows = Math.ceil(FLOW_CELLS / cols) || cols;
  const box = useRef<HTMLDivElement | null>(null);
  const total = cols * rows;

  const cellAt = (clientX: number, clientY: number): number | null => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const col = Math.floor(((clientX - rect.left) / rect.width) * cols);
    const row = Math.floor(((clientY - rect.top) / rect.height) * rows);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return row * cols + col;
  };

  const filled = new Map<number, string>();
  paths.forEach((path, index) => {
    const colour = pairs[index]?.colour;
    if (!colour) return;
    for (const cell of path) filled.set(cell, GLYPH_COLOURS[colour]);
  });

  return (
    <div
      ref={box}
      className="relative mx-auto aspect-square h-full max-h-full w-full max-w-full touch-none select-none"
      style={{ touchAction: "none" }}
      onPointerDown={(event) => {
        if (!onCell) return;
        event.preventDefault();
        const cell = cellAt(event.clientX, event.clientY);
        if (cell !== null) onCell(cell);
      }}
      onPointerMove={(event) => {
        if (!onCell || event.buttons === 0) return;
        const cell = cellAt(event.clientX, event.clientY);
        if (cell !== null) onCell(cell);
      }}
      onPointerUp={() => onRelease?.()}
      onPointerCancel={() => onRelease?.()}
    >
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          gap: 2,
        }}
      >
        {Array.from({ length: total }, (_, cell) => {
          const tint = filled.get(cell);
          return (
            <div
              key={cell}
              className="rounded-[3px] border border-border/60 bg-card"
              style={tint ? { backgroundColor: `${tint}22`, borderColor: `${tint}55` } : undefined}
            />
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${cols} ${rows}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {paths.map((path, index) => {
          const colour = pairs[index]?.colour;
          if (!colour || path.length < 2) return null;
          const points = path
            .map((cell) => `${(cell % cols) + 0.5},${Math.floor(cell / cols) + 0.5}`)
            .join(" ");
          return (
            <polyline
              key={index}
              points={points}
              fill="none"
              stroke={GLYPH_COLOURS[colour]}
              strokeWidth={0.34}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        {pairs.map((pair, index) =>
          [pair.a, pair.b].map((cell) => (
            <circle
              key={`${index}-${cell}`}
              cx={(cell % cols) + 0.5}
              cy={Math.floor(cell / cols) + 0.5}
              r={0.3}
              fill={GLYPH_COLOURS[pair.colour]}
            />
          )),
        )}
      </svg>

      {onDot &&
        pairs.map((pair, index) =>
          [pair.a, pair.b].map((cell) => (
            <button
              key={`tap-${index}-${cell}`}
              type="button"
              aria-label={`Clear the ${pair.colour.toLowerCase()} path`}
              className="absolute opacity-0"
              style={{
                left: `${((cell % cols) / cols) * 100}%`,
                top: `${(Math.floor(cell / cols) / rows) * 100}%`,
                width: `${100 / cols}%`,
                height: `${100 / rows}%`,
              }}
              onClick={() => onDot(index)}
            />
          )),
        )}
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  const pairs: FlowPair[] = [
    { colour: "RED", a: 0, b: 6 },
    { colour: "BLUE", a: 3, b: 15 },
    { colour: "GREEN", a: 8, b: 11 },
  ];
  const paths = [[0, 1, 5, 6], [3, 7, 11, 15], []];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Join each pair of dots with a path. Paths can&apos;t cross, and every square must be filled.
      </p>
      <div style={{ width: 148 }}>
        <FlowBoard pairs={pairs} paths={paths} cols={4} />
      </div>
      <p className="text-xs text-muted-foreground">
        Drag from a dot to its partner. You have 60 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "flow" }: PuzzleStageProps) {
  const pairs = puzzle.type === "flow" ? puzzle.pairs : [];
  const [paths, setPaths] = useStageState<number[][]>(stateKey, "flowPaths", () =>
    pairs.map(() => []),
  );
  const drawing = useRef<number | null>(null);
  const moved = useRef(false);
  const submitted = useRef(false);

  const verdict = useMemo(() => verifyFlow(pairs, paths), [pairs, paths]);
  const filled = flowFilledCells(paths);

  useEffect(() => {
    onDraftAnswer?.(encodeFlowPaths(paths));
  }, [paths, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !verdict.solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodeFlowPaths(paths));
  }, [verdict.solved, paths, locked, onSubmit]);

  const dotPair = useCallback(
    (cell: number) => pairs.findIndex((pair) => pair.a === cell || pair.b === cell),
    [pairs],
  );

  /** Handles one cell under the finger, whether the drag just began or moved. */
  const touch = useCallback(
    (cell: number) => {
      if (locked || submitted.current) return;
      const active = drawing.current;

      if (active === null) {
        const pair = dotPair(cell);
        if (pair === -1) return;
        drawing.current = pair;
        moved.current = false;
        setPaths((current) => current.map((path, index) => (index === pair ? [cell] : path)));
        return;
      }

      setPaths((current) => {
        const path = current[active] ?? [];
        const last = path[path.length - 1];
        if (last === undefined || cell === last) return current;
        // Backing up over the previous cell rubs the path out behind the finger.
        if (path.length > 1 && cell === path[path.length - 2]) {
          moved.current = true;
          return current.map((value, index) => (index === active ? path.slice(0, -1) : value));
        }
        if (!flowAdjacent(last, cell)) return current;
        if (path.includes(cell)) return current;
        // Another pair's dot is never walkable.
        const otherDot = pairs.some(
          (pair, index) => index !== active && (pair.a === cell || pair.b === cell),
        );
        if (otherDot) return current;

        const pair = pairs[active]!;
        const ends = cell === pair.a || cell === pair.b;
        // Crossing another colour cuts it back to the cell before.
        const next = current.map((value, index) => {
          if (index === active) return value;
          const at = value.indexOf(cell);
          return at === -1 ? value : value.slice(0, at);
        });
        moved.current = true;
        const extended = [...path, cell];
        next[active] = extended;
        if (ends) drawing.current = null;
        return next;
      });
      buzz(4);
    },
    [dotPair, locked, pairs, setPaths],
  );

  const release = useCallback(() => {
    drawing.current = null;
  }, []);

  /** A tap on a dot (no drag) clears that colour. */
  const clearPair = useCallback(
    (pair: number) => {
      if (locked || submitted.current || moved.current) return;
      setPaths((current) => current.map((path, index) => (index === pair ? [] : path)));
    },
    [locked, setPaths],
  );

  if (puzzle.type !== "flow") return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        cells filled <span className="text-primary">{filled}</span> / {FLOW_CELLS} ·{" "}
        {verdict.pairsJoined} / {pairs.length} pairs
      </p>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <FlowBoard
          pairs={pairs}
          paths={paths}
          onCell={locked ? undefined : touch}
          onRelease={release}
          onDot={locked ? undefined : clearPair}
        />
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "flow") return null;
  const solution = puzzle.solution ?? puzzle.pairs.map(() => []);
  const mine = myAnswer
    ? myAnswer.split("|").map((part) =>
        part
          .split(",")
          .map((value) => Number.parseInt(value, 10))
          .filter((cell) => Number.isInteger(cell)),
      )
    : puzzle.pairs.map(() => []);
  const verdict = verifyFlow(puzzle.pairs, mine);
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((FLOW_TIME_MS - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex items-start justify-center gap-3">
        <div className="flex flex-col items-center gap-1" style={{ width: 138 }}>
          <FlowBoard pairs={puzzle.pairs} paths={solution} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            solved
          </span>
        </div>
        <div className="flex flex-col items-center gap-1" style={{ width: 138 }}>
          <FlowBoard pairs={puzzle.pairs} paths={mine} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            yours
          </span>
        </div>
      </div>
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        {myCorrect
          ? `✓ Solved${elapsed === null ? "" : ` · ${elapsed.toFixed(1)}s`}`
          : `✗ ${verdict.pairsJoined} / ${puzzle.pairs.length} pairs`}
      </p>
    </div>
  );
}

/** The solved paths stay server-side; the server re-walks whatever a phone sends. */
export const flowPuzzle: PuzzleDefinition = {
  key: "flow",
  name: "Flow",
  category: "logic",
  timeLimitMs: FLOW_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "flow", pairs: [] }) satisfies FlowPuzzleData,
  check: () => false,
  revealHeading: "The joined board",
  IntroExample,
  Stage,
  Reveal,
};
