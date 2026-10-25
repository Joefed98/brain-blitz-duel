import { gameDisplayName } from "@/lib/duel/gameNames";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { memo, useEffect, useId, useMemo, useRef } from "react";

import { registerFxPreview } from "@/components/puzzles/speedFx";

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

import { playMazeTrace } from "./labyrinthArt";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GOLD = "var(--primary)";

/** Five-point star polygon centred at (cx, cy), in SVG grid units. */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return points.join(" ");
}

type Wall = { x1: number; y1: number; x2: number; y2: number };

/**
 * The maze itself, memoised so a route step never redraws it: a flagstone floor
 * (pattern, deterministic), then every wall three times for depth — a drop shadow,
 * the stone body and a thin lit top edge. Walls sit on the same grid lines as before.
 */
const MazeWalls = memo(function MazeWalls({ cells, cols, rows }: { cells: number[]; cols: number; rows: number }) {
  const id = useId().replace(/:/g, "");
  const walls: Wall[] = [];
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
  const d = walls.map((w) => `M${w.x1} ${w.y1}L${w.x2} ${w.y2}`).join("");
  return (
    <g>
      <defs>
        <pattern id={`maze-floor-${id}`} width="2" height="2" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="var(--maze-floor)" />
          <rect width="1" height="1" fill="var(--maze-floor-alt)" />
          <rect x="1" y="1" width="1" height="1" fill="var(--maze-floor-alt)" />
          <circle cx="0.3" cy="0.7" r="0.05" fill="var(--maze-floor-speck)" />
          <circle cx="1.65" cy="0.35" r="0.06" fill="var(--maze-floor-speck)" />
          <circle cx="1.2" cy="1.6" r="0.04" fill="var(--maze-floor-speck)" />
        </pattern>
      </defs>
      <rect width={cols} height={rows} fill={`url(#maze-floor-${id})`} />
      {/* Polish batch S: a wide, faint ambient shadow under every wall for depth (display only). */}
      <path d={d} transform="translate(0.09 0.13)" stroke="rgba(0,0,0,0.28)" strokeWidth={0.3} strokeLinecap="round" fill="none" />
      <path d={d} transform="translate(0.05 0.07)" stroke="var(--maze-wall-shadow)" strokeWidth={0.17} strokeLinecap="square" fill="none" />
      <path d={d} stroke="var(--maze-wall)" strokeWidth={0.13} strokeLinecap="square" fill="none" />
      <path d={d} transform="translate(-0.018 -0.025)" stroke="var(--maze-wall-top)" strokeWidth={0.04} strokeLinecap="square" fill="none" opacity={0.85} />
    </g>
  );
});

/** Stone walls on a flagstone floor, with the drawn route over the top. */
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
  const gid = useId().replace(/:/g, "");

  // Measured from the live board on every event, so the finger tracks the corridor.
  const cellAt = (clientX: number, clientY: number): number | null =>
    gridCellAt(box.current, clientX, clientY, cols, rows);

  const centre = (cell: number) => `${(cell % cols) + 0.5},${Math.floor(cell / cols) + 0.5}`;

  return (
    <div
      ref={box}
      className="maze-board relative mx-auto aspect-square h-full max-h-full w-full max-w-full touch-none select-none rounded-lg bg-card p-1"
      data-maze-board=""
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
        {/* Polish batch S (display only): the glossy ball, the exit's glow and the star's light. */}
        <defs>
          <radialGradient id={`maze-ball-${gid}`} cx="0.36" cy="0.32" r="0.75">
            <stop offset="0" stopColor="#FFF6D8" />
            <stop offset="0.35" stopColor="var(--primary)" />
            <stop offset="1" stopColor="#9A6508" />
          </radialGradient>
          <radialGradient id={`maze-halo-${gid}`}>
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`maze-star-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFF1C2" />
            <stop offset="0.55" stopColor="var(--primary)" />
            <stop offset="1" stopColor="#C98A12" />
          </linearGradient>
        </defs>
        <MazeWalls cells={cells} cols={cols} rows={rows} />
        {/* Start pad and exit tile: clear ends, drawn on the floor under the route. */}
        <rect x={(start % cols) + 0.08} y={Math.floor(start / cols) + 0.08} width={0.84} height={0.84} rx={0.16} fill="var(--maze-start-floor)" stroke="var(--maze-start)" strokeWidth={0.05} />
        <rect className="maze-exit-glow" x={(exit % cols) + 0.08} y={Math.floor(exit / cols) + 0.08} width={0.84} height={0.84} rx={0.16} fill="var(--maze-exit-floor)" stroke={GOLD} strokeWidth={0.05} />
        {ghost && ghost.length > 1 && (
          <polyline
            points={ghost.map(centre).join(" ")}
            fill="none"
            stroke="var(--maze-start)"
            strokeWidth={0.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0.35 0.25"
            opacity={0.75}
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
        <circle
          cx={(start % cols) + 0.5}
          cy={Math.floor(start / cols) + 0.5}
          r={0.18}
          fill="var(--maze-start)"
        />
        {/* Goal: a gold star flag marking the exit cell, lit by a soft halo inside its cell. */}
        <circle
          className="maze-exit-glow"
          cx={(exit % cols) + 0.5}
          cy={Math.floor(exit / cols) + 0.5}
          r={0.5}
          fill={`url(#maze-halo-${gid})`}
        />
        <polygon
          points={starPoints((exit % cols) + 0.5, Math.floor(exit / cols) + 0.5, 0.32, 0.14)}
          fill={`url(#maze-star-${gid})`}
          stroke="#7A4E06"
          strokeWidth={0.025}
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 0.12px var(--primary))" }}
        />
        {/* Player: current route head, a larger glowing gold dot. */}
        {(() => {
          const head = path.length ? path[path.length - 1]! : start;
          return (
            <g data-maze-ball="">
              <circle cx={(head % cols) + 0.5} cy={Math.floor(head / cols) + 0.5} r={0.42} fill={`url(#maze-halo-${gid})`} />
              <ellipse cx={(head % cols) + 0.53} cy={Math.floor(head / cols) + 0.7} rx={0.2} ry={0.07} fill="rgba(0,0,0,0.45)" />
              <circle
                cx={(head % cols) + 0.5}
                cy={Math.floor(head / cols) + 0.5}
                r={0.24}
                fill={`url(#maze-ball-${gid})`}
                stroke="rgba(90,55,0,0.6)"
                strokeWidth={0.02}
                style={{ filter: "drop-shadow(0 0 0.14px var(--primary)) drop-shadow(0 0 0.28px var(--primary))" }}
              />
              <ellipse cx={(head % cols) + 0.43} cy={Math.floor(head / cols) + 0.41} rx={0.08} ry={0.05} fill="rgba(255,255,255,0.85)" />
            </g>
          );
        })()}
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
        Wrong turns cost you time.
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
  const arenaRef = useRef<HTMLDivElement>(null);
  const trace = useRef<(route: number[]) => void>(() => undefined);
  trace.current = (route) => {
    const board = arenaRef.current?.querySelector("[data-maze-board]");
    if (board) playMazeTrace(board, route, MAZE_COLS, Math.ceil(cells.length / MAZE_COLS) || MAZE_COLS);
  };
  useEffect(() => registerFxPreview("maze", () => trace.current(path.length > 1 ? path : (puzzle.type === "maze" ? puzzle.solution ?? [] : []))), [path, puzzle]);

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
    // Finish effect: a glowing line traces the route (display only, never awaited).
    trace.current(path);
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
      if (!mazeOpen(cells, last, cell)) { puzzleReject(); return current; }
      return [...current, cell];
    });
  };

  /** The arrows drive the very same route as the finger does. */
  const step = (dir: "U" | "D" | "L" | "R") => {
    const last = path[path.length - 1] ?? start;
    const col = last % MAZE_COLS;
    const row = Math.floor(last / MAZE_COLS);
    if (dir === "U" && row === 0) return puzzleReject();
    if (dir === "D" && row >= Math.floor((cells.length - 1) / MAZE_COLS)) return puzzleReject();
    if (dir === "L" && col === 0) return puzzleReject();
    if (dir === "R" && col === MAZE_COLS - 1) return puzzleReject();
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
    <div data-stage-column="1" data-polish="maze" className="flex min-h-0 flex-1 flex-col gap-1">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        squares <span className="text-primary">{path.length}</span> · wasted {wasted}
      </p>

      <div ref={arenaRef} data-game-arena="board" className="flex min-h-0 flex-1 items-center justify-center">
        <MazeBoard cells={cells} start={start} exit={exit} path={path} onCell={touch} />
      </div>

       <div data-game-controls="pad" className="flex shrink-0 flex-col items-center justify-center">
        <ArrowPad
          onPress={step}
          disabled={locked || solved}
          repeatMs={240}
          expanded
        />
      </div>
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
      <div className="maze-reveal-board">
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
  name: gameDisplayName("maze"),
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
