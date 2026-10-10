import { gameDisplayName } from "@/lib/duel/gameNames";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { gridCellCentre, useGridMetrics, useGridPointer } from "@/components/puzzles/GridDrag";
import { FLOW_COLOUR_HEX as GLYPH_COLOURS, encodeFlowPaths, flowAdjacent, flowFilledCells, verifyFlow } from "@/lib/duel/flow";
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

/**
 * The dots are centred children of their own cells; the paths are one SVG layer
 * over the top, drawn through cell centres measured from the rendered grid, so
 * a line always runs dead through the middle of every square it covers and ends
 * exactly on the partner dot.
 */
function FlowBoard({
  pairs,
  paths,
  walls = [],
  cols = FLOW_COLS,
  cells = FLOW_CELLS,
  onCell,
  onRelease,
}: {
  pairs: FlowPair[];
  paths: number[][];
  walls?: readonly number[];
  cols?: number;
  cells?: number;
  onCell?: ((cell: number) => void) | undefined;
  onRelease?: (() => void) | undefined;
}) {
  const rows = Math.ceil(cells / cols) || cols;
  const total = cols * rows;
  const pointer = useGridPointer({ cols, rows, onCell, onRelease });
  const metrics = useGridMetrics(pointer.ref, cols, rows);

  const filled = new Map<number, string>();
  paths.forEach((path, index) => {
    const colour = pairs[index]?.colour;
    if (!colour) return;
    for (const cell of path) filled.set(cell, GLYPH_COLOURS[colour]);
  });

  const stroke = metrics ? Math.max(3, metrics.cellW * 0.68) : 0;

  return (
    <div className="relative mx-auto aspect-square h-full max-h-full w-full max-w-full select-none">
      <div
        ref={pointer.ref}
        className="puzzle-board grid h-full w-full touch-none"
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
          if (walls.includes(cell)) {
            return (
              <div
                key={cell}
                className="rounded-[3px] border border-foreground/30 bg-[repeating-linear-gradient(45deg,var(--background),var(--background)_3px,var(--muted)_3px,var(--muted)_6px)]"
                aria-label="Wall"
              />
            );
          }
          return (
            <div
              key={cell}
              className="flow-cell flex items-center justify-center rounded-[3px] border border-border bg-card"
              style={tint ? { backgroundColor: `${tint}22`, borderColor: `${tint}55` } : undefined}
            >
              {/* The dot is a child of its own cell, so it is always dead centre,
                  and it sits above the path layer. */}
              {dot && (
                <span
                  className="relative block rounded-full"
                  style={{
                    width: "64%",
                    height: "64%",
                    zIndex: 2,
                    backgroundColor: GLYPH_COLOURS[dot.colour],
                    boxShadow: "0 0 0 2px var(--background), 0 0 0 3px color-mix(in oklab, var(--foreground) 25%, transparent)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* One overlay exactly covering the grid, in the grid's own pixels. */}
      {metrics && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ zIndex: 1 }}
          aria-hidden="true"
        >
          {paths.map((path, index) => {
            const colour = pairs[index]?.colour;
            if (!colour || path.length < 2) return null;
            return (
              <polyline
                key={index}
                points={path
                  .map((cell) => {
                    const at = gridCellCentre(metrics, cell, cols);
                    return `${at.x},${at.y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke={GLYPH_COLOURS[colour]}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  const pairs: FlowPair[] = [
    { colour: "RED", a: 0, b: 6 },
    { colour: "BLUE", a: 3, b: 15 },
    { colour: "ORANGE", a: 8, b: 14 },
  ];
  const walls = [10];
  const paths = [[0, 1, 5, 6], [3, 7, 11, 15], []];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Join each pair of dots with a path. Paths can&apos;t cross, and every square must be filled.
      </p>
      <div style={{ width: 148 }}>
        <FlowBoard pairs={pairs} paths={paths} walls={walls} cols={4} cells={16} />
      </div>
      <p className="text-xs text-muted-foreground">
        Striped squares are walls - no path can enter them. Drag from a dot to its partner. You have 75 seconds.
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
  /** True from the first touch of a drag until the finger lifts. */
  const holding = useRef(false);
  const submitted = useRef(false);

  const walls = puzzle.type === "flow" ? (puzzle.walls ?? []) : [];
  const verdict = useMemo(() => verifyFlow(pairs, paths, walls), [pairs, paths, walls]);
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
        if (!flowAdjacent(last, cell)) { puzzleReject(); return current; }
        if (path.includes(cell) || walls.includes(cell)) { puzzleReject(); return current; }

        const pair = pairs[active]!;
        // Its own partner dot is welcome; any other colour's dot is refused.
        const ends = cell === pair.a || cell === pair.b;
        const otherDot = pairs.some(
          (other, index) => index !== active && (other.a === cell || other.b === cell),
        );
        if (otherDot) { puzzleReject(); return current; }
        // Another colour's path is refused too — it is never cut back.
        const crosses = current.some((value, index) => index !== active && value.includes(cell));
        if (crosses) { puzzleReject(); return current; }

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
    [dotPair, locked, pairs, paths, setPaths, walls],
  );

  /** Lifting the finger without moving, on a dot, clears that colour. */
  const release = useCallback(() => {
    const pair = startedOnDot.current;
    const wasStill = !moved.current;
    drawing.current = null;
    startedOnDot.current = null;
    holding.current = false;
    if (pair === null || !wasStill || locked || submitted.current) return;
    setPaths((current) => current.map((path, index) => (index === pair ? [] : path)));
  }, [locked, setPaths]);

  if (puzzle.type !== "flow") return null;

  return (
    <div data-polish="flow" data-stage-column="3" className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        cells filled <span className="text-primary">{filled}</span> / {FLOW_CELLS - walls.length} ·{" "}
        {verdict.pairsJoined} / {pairs.length} pairs
      </p>
      <div data-game-arena="board" className="flex min-h-0 flex-1 items-center justify-center">
        <FlowBoard
          pairs={pairs}
          paths={paths}
          walls={walls}
          onCell={locked ? undefined : touch}
          onRelease={release}
        />
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
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
  const verdict = verifyFlow(puzzle.pairs, mine, puzzle.walls ?? []);
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex items-start justify-center gap-3">
        <div className="flex flex-col items-center gap-1" style={{ width: 138 }}>
          <FlowBoard pairs={puzzle.pairs} paths={solution} walls={puzzle.walls ?? []} />
          <span className="font-mono text-base uppercase tracking-widest text-muted-foreground">
            solved
          </span>
        </div>
        <div className="flex flex-col items-center gap-1" style={{ width: 138 }}>
          <FlowBoard pairs={puzzle.pairs} paths={mine} walls={puzzle.walls ?? []} />
          <span className="font-mono text-base uppercase tracking-widest text-muted-foreground">
            yours
          </span>
        </div>
      </div>
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
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
  name: gameDisplayName("flow"),
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
