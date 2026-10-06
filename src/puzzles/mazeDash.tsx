import { useEffect, useMemo, useRef } from "react";

import { ArrowPad, gridCellAt } from "@/components/puzzles/GridDrag";

import {
  MAZE_E,
  MAZE_N,
  MAZE_S,
  MAZE_W,
  decodeMazePath,
  encodeMazePath,
  mazeOpen,
  verifyMazePath,
} from "@/lib/duel/maze";
import { useStageState } from "@/lib/duel/stageState";
import { MAZE_CELLS, MAZE_COLS, MAZE_TIME_MS, type MazePuzzleData } from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GOLD = "var(--primary)";

/** Thin wall lines on the card colour, with the drawn route over the top. */
function MazeBoard({
  cells,
  cols = MAZE_COLS,
  start,
  exit,
  path,
  ghost,
  onCell,
  onRelease,
}: {
  cells: number[];
  cols?: number;
  start: number;
  exit: number;
  path: number[];
  /** A second, grey route drawn underneath — the solution, on the reveal. */
  ghost?: number[] | undefined;
  onCell?: ((cell: number) => void) | undefined;
  onRelease?: (() => void) | undefined;
}) {
  const rows = Math.ceil(cells.length / cols) || cols;
  const box = useRef<HTMLDivElement | null>(null);

  // Measured from the live board on every event, so the finger tracks the corridor.
  const cellAt = (clientX: number, clientY: number): number | null =>
    gridCellAt(box.current, clientX, clientY, cols, rows);

  const centre = (cell: number) => `${(cell % cols) + 0.5},${Math.floor(cell / cols) + 0.5}`;

  const walls: { x1: number; y1: number; x2: number; y2: number }[] = [];
  cells.forEach((mask, cell) => {
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    if (!(mask & MAZE_N)) walls.push({ x1: col, y1: row, x2: col + 1, y2: row });
    if (!(mask & MAZE_W)) walls.push({ x1: col, y1: row, x2: col, y2: row + 1 });
    if (!(mask & MAZE_S) && row === rows - 1)
      walls.push({ x1: col, y1: row + 1, x2: col + 1, y2: row + 1 });
    if (!(mask & MAZE_E) && col === cols - 1)
      walls.push({ x1: col + 1, y1: row, x2: col + 1, y2: row + 1 });
  });

  return (
    <div
      ref={box}
      className="relative mx-auto aspect-square h-full max-h-full w-full max-w-full touch-none select-none rounded-lg bg-card p-1"
      style={{ touchAction: "none" }}
      onPointerDown={(event) => {
        if (!onCell) return;
        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Capture is a nicety; the drag still works without it.
        }
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
      <svg viewBox={`0 0 ${cols} ${rows}`} className="h-full w-full" aria-hidden="true">
        {ghost && ghost.length > 1 && (
          <polyline
            points={ghost.map(centre).join(" ")}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={0.22}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.45}
          />
        )}
        {path.length > 1 && (
          <polyline
            points={path.map(centre).join(" ")}
            fill="none"
            stroke={GOLD}
            strokeWidth={0.26}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {walls.map((wall, index) => (
          <line
            key={index}
            x1={wall.x1}
            y1={wall.y1}
            x2={wall.x2}
            y2={wall.y2}
            stroke="var(--muted-foreground)"
            strokeWidth={0.045}
            opacity={0.85}
            strokeLinecap="square"
          />
        ))}
        <circle
          cx={(start % cols) + 0.5}
          cy={Math.floor(start / cols) + 0.5}
          r={0.18}
          fill="var(--muted-foreground)"
        />
        <rect
          x={(exit % cols) + 0.24}
          y={Math.floor(exit / cols) + 0.2}
          width={0.5}
          height={0.6}
          rx={0.1}
          fill={GOLD}
        />
      </svg>
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  const cells = [
    MAZE_E | MAZE_S,
    MAZE_W | MAZE_E,
    MAZE_W | MAZE_S,
    MAZE_N | MAZE_E,
    MAZE_W | MAZE_S,
    MAZE_N | MAZE_S,
    MAZE_E,
    MAZE_W | MAZE_N,
    MAZE_N,
  ];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Draw your way from the start to the exit as fast as you can.
      </p>
      <div style={{ width: 120 }}>
        <MazeBoard cells={cells} cols={3} start={0} exit={8} path={[0, 3, 4]} />
      </div>
      <p className="text-xs text-muted-foreground">
        Wrong turns cost you time. You have 45 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "maze" }: PuzzleStageProps) {
  const isMaze = puzzle.type === "maze";
  const cells = isMaze ? puzzle.cells : [];
  const start = isMaze ? puzzle.start : 0;
  const exit = isMaze ? puzzle.exit : MAZE_CELLS - 1;
  const [path, setPath] = useStageState<number[]>(stateKey, "mazePath", () => [start]);
  const submitted = useRef(false);

  const solved = path[path.length - 1] === exit;
  const wasted = useMemo(() => {
    const seen = new Set<number>();
    let repeats = 0;
    for (const cell of path) {
      if (seen.has(cell)) repeats += 1;
      seen.add(cell);
    }
    return repeats;
  }, [path]);

  useEffect(() => {
    onDraftAnswer?.(encodeMazePath(path));
  }, [path, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodeMazePath(path));
  }, [solved, path, locked, onSubmit]);

  /**
   * One cell touched by the finger: the route grows only into a cell next to its
   * end with no wall between, and retraces when the finger goes back. Anything
   * else is ignored — the route is never reset by a stray touch.
   */
  const touch = (cell: number) => {
    if (locked || submitted.current || solved) return;
    setPath((current) => {
      const last = current[current.length - 1] ?? start;
      if (cell === last) return current;
      // Retracing one step backwards undoes a wrong turn.
      if (current.length > 1 && cell === current[current.length - 2]) return current.slice(0, -1);
      if (!mazeOpen(cells, last, cell)) return current;
      return [...current, cell];
    });
  };

  /** The arrows drive the very same route as the finger does. */
  const step = (dir: "U" | "D" | "L" | "R") => {
    const last = path[path.length - 1] ?? start;
    const col = last % MAZE_COLS;
    const row = Math.floor(last / MAZE_COLS);
    if (dir === "U" && row === 0) return;
    if (dir === "D" && row >= Math.floor((cells.length - 1) / MAZE_COLS)) return;
    if (dir === "L" && col === 0) return;
    if (dir === "R" && col === MAZE_COLS - 1) return;
    const next =
      dir === "U"
        ? last - MAZE_COLS
        : dir === "D"
          ? last + MAZE_COLS
          : dir === "L"
            ? last - 1
            : last + 1;
    touch(next);
  };

  if (!isMaze) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        squares <span className="text-primary">{path.length}</span> · wasted {wasted}
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <MazeBoard cells={cells} start={start} exit={exit} path={path} onCell={touch} />
      </div>

       <div className="flex shrink-0 flex-col items-center justify-center gap-1">
        <ArrowPad
          onPress={step}
          disabled={locked || solved}
          repeatMs={240}
          expanded
        />
      </div>
      <p className="shrink-0 text-center text-[11px] text-muted-foreground">
        Tap or hold an arrow · or draw with your finger · go back to undo
      </p>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "maze") return null;
  const mine = decodeMazePath(myAnswer ?? "");
  const verdict = verifyMazePath(
    puzzle.cells,
    puzzle.start,
    puzzle.exit,
    puzzle.solution ?? [],
    mine,
  );
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div style={{ width: 190 }}>
        <MazeBoard
          cells={puzzle.cells}
          start={puzzle.start}
          exit={puzzle.exit}
          path={mine.length > 1 ? mine : []}
          ghost={puzzle.solution ?? []}
        />
      </div>
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        {myCorrect
          ? `Solved${elapsed === null ? "" : ` · ${elapsed.toFixed(1)}s`}`
          : `${Math.round(verdict.progress * 100)}% of the way`}
      </p>
    </div>
  );
}

/** The maze and its one route are built server-side and stay there. */
export const mazeDashPuzzle: PuzzleDefinition = {
  key: "maze",
  name: "Maze Dash",
  category: "attention",
  timeLimitMs: MAZE_TIME_MS,
  revealMs: 5_000,
  generate: () =>
    ({
      type: "maze",
      cells: new Array<number>(MAZE_CELLS).fill(0),
      start: 0,
      exit: MAZE_CELLS - 1,
    }) satisfies MazePuzzleData,
  check: () => false,
  revealHeading: "The route",
  IntroExample,
  Stage,
  Reveal,
};
