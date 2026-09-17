import { useCallback, useEffect, useMemo, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { useGridPointer } from "@/components/puzzles/GridDrag";
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

/** The dots and paths, drawn from cell centres so the board scales to any size. */
function FlowBoard({
  pairs,
  paths,
  cols = FLOW_COLS,
  cells = FLOW_CELLS,
  onCell,
  onRelease,
}: {
  pairs: FlowPair[];
  paths: number[][];
  cols?: number;
  cells?: number;
  onCell?: ((cell: number) => void) | undefined;
  onRelease?: (() => void) | undefined;
}) {
  const rows = Math.ceil(cells / cols) || cols;
  const total = cols * rows;
  const pointer = useGridPointer({ cols, rows, onCell, onRelease });

  const filled = new Map<number, string>();
  paths.forEach((path, index) => {
    const colour = pairs[index]?.colour;
    if (!colour) return;
    for (const cell of path) filled.set(cell, GLYPH_COLOURS[colour]);
  });

  const centre = (cell: number) => `${(cell % cols) + 0.5},${Math.floor(cell / cols) + 0.5}`;

  return (
    <div className="relative mx-auto aspect-square h-full max-h-full w-full max-w-full select-none">
      <div
        ref={pointer.ref}
        className="grid h-full w-full touch-none"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          gap: 2,
          ...pointer.handlers.style,
        }}
        onPointerDown={pointer.handlers.onPointerDown}
        onPointerMove={pointer.handlers.onPointerMove}
        onPointerUp={pointer.handlers.onPointerUp}
        onPointerCancel={pointer.handlers.onPointerCancel}
      >
        {Array.from({ length: total }, (_, cell) => {
          const tint = filled.get(cell);
          const dot = pairs.find((pair) => pair.a === cell || pair.b === cell);
          return (
            <div
              key={cell}
              className="flex items-center justify-center rounded-[3px] border border-border/60 bg-card"
              style={tint ? { backgroundColor: `${tint}22`, borderColor: `${tint}55` } : undefined}
            >
              {/* The dot is a child of its own cell, so it is always dead centre. */}
              {dot && (
                <span
                  className="block rounded-full"
                  style={{
                    width: "62%",
                    height: "62%",
                    backgroundColor: GLYPH_COLOURS[dot.colour],
                  }}
                />
              )}
            </div>
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
          return (
            <polyline
              key={index}
              points={path.map(centre).join(" ")}
              fill="none"
              stroke={GLYPH_COLOURS[colour]}
              strokeWidth={0.32}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  const pairs: FlowPair[] = [
    { colour: "RED", a: 0, b: 6 },
    { colour: "BLUE", a: 3, b: 15 },
    { colour: "ORANGE", a: 8, b: 11 },
  ];
  const paths = [[0, 1, 5, 6], [3, 7, 11, 15], []];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Join each pair of dots with a path. Paths can&apos;t cross, and every square must be filled.
      </p>
      <div style={{ width: 148 }}>
        <FlowBoard pairs={pairs} paths={paths} cols={4} cells={16} />
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
  /** The pair being drawn, and whether the finger has actually moved. */
  const drawing = useRef<number | null>(null);
  const moved = useRef(false);
  const startedOnDot = useRef<number | null>(null);
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
        // Once a colour has just been completed, the rest of this drag is ignored:
        // sliding on must never re-start the path from the dot it finished on.
        if (holding.current) return;
        holding.current = true;
        // A dot starts its own path afresh…
        const pair = dotPair(cell);
        if (pair !== -1) {
          drawing.current = pair;
          moved.current = false;
          startedOnDot.current = pair;
          setPaths((current) => current.map((path, index) => (index === pair ? [cell] : path)));
          return;
        }
        // …and the loose end of a path can be picked up to carry on from there.
        const loose = paths.findIndex((path) => path.length > 1 && path[path.length - 1] === cell);
        if (loose === -1) return;
        drawing.current = loose;
        moved.current = false;
        startedOnDot.current = null;
        return;
      }

      let completed = false;
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

        const pair = pairs[active]!;
        // Its own partner dot is welcome; any other colour's dot is refused.
        const ends = cell === pair.a || cell === pair.b;
        const otherDot = pairs.some(
          (other, index) => index !== active && (other.a === cell || other.b === cell),
        );
        if (otherDot) return current;
        // Another colour's path is refused too — it is never cut back.
        const crosses = current.some((value, index) => index !== active && value.includes(cell));
        if (crosses) return current;

        moved.current = true;
        const next = [...current];
        next[active] = [...path, cell];
        if (ends) {
          drawing.current = null;
          completed = true;
        }
        return next;
      });
      if (completed) playCorrect();
      buzz(4);
    },
    [dotPair, locked, pairs, paths, setPaths],
  );

  /** Lifting the finger without moving, on a dot, clears that colour. */
  const release = useCallback(() => {
    const pair = startedOnDot.current;
    const wasStill = !moved.current;
    drawing.current = null;
    startedOnDot.current = null;
    if (pair === null || !wasStill || locked || submitted.current) return;
    setPaths((current) => current.map((path, index) => (index === pair ? [] : path)));
  }, [locked, setPaths]);

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
        />
      </div>
      <p className="shrink-0 text-center text-[11px] text-muted-foreground">
        Drag dot to dot · drag from a loose end to carry on · tap a dot to clear it
      </p>
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
