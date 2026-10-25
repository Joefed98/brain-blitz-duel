import { pipelineDepths } from "@/components/puzzles/pipelineFlow";
import { PIPE_ARMS, PipeArt, PipeDefs, PipeSurge } from "@/components/puzzles/pattern/pipesArt";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { playCorrect } from "@/lib/sound";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  decodeSides,
  encodeSides,
  pipesState,
  rotateMask,
  tileOpenings,
  PIPE_E,
  PIPE_N,
  PIPE_S,
  PIPE_W,
} from "@/lib/duel/logic";
import { useStageState } from "@/lib/duel/stageState";
import {
  PIPES_CELLS,
  PIPES_COLS,
  PIPES_TIME_MS,
  type PipeTile,
  type PipesPuzzleData,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/**
 * One pipe tile, drawn straight from its set of open sides. Memoised (its props are primitives,
 * the tile object kept while its sides are unchanged and a stable tap handler), so the page clock's
 * ticks never re-render the board's 49 tiles: at 4x CPU slowdown that re-render took 150-450 ms a
 * tick and held a practice round to two painted frames in its first 1.2 s (first-paint-check).
 */
const PipeTileView = memo(function PipeTileView({
  defsId,
  cell,
  tile,
  lit,
  source,
  leak,
  onTapCell,
  label,
  inflow = 0,
  surgeDelay,
  surgeStep = 0,
}: {
  defsId: string;
  cell: number;
  tile: PipeTile;
  lit: boolean;
  source: boolean;
  leak?: boolean | undefined;
  onTapCell?: ((cell: number) => void) | undefined;
  label?: string;
  inflow?: number;
  /** The solve rush's start for this tile (ms), or undefined for none. */
  surgeDelay?: number | undefined;
  surgeStep?: number;
}) {
  const mask = tileOpenings(tile);
  const [turns, setTurns] = useState(0);
  return (
    <button
      type="button"
      disabled={!onTapCell}
      onClick={
        onTapCell &&
        (() => {
          setTurns((value) => value + 1);
          soundCue("pipes.rotate");
          onTapCell(cell);
        })
      }
      className="pipe-tile relative rounded-[6px]"
      data-lit={lit ? "true" : undefined}
      data-pipe-cell={onTapCell ? cell : undefined}
      aria-label={label ?? "Pipe tile"}
    >
      <PipeArt id={defsId} mask={mask} wet={lit} source={source} inflow={inflow} turnKey={turns} />
      {surgeDelay !== undefined && <PipeSurge mask={mask} inflow={inflow} delay={surgeDelay} step={surgeStep} />}
      {leak && <span className="pipe-leak pointer-events-none absolute right-[5%] top-[5%] h-[22%] w-[22%]" />}
    </button>
  );
});

/** Memoised with its tiles: a clock tick above it (unchanged props) skips the whole board. */
const PipesBoard = memo(function PipesBoard({
  tiles,
  source,
  connected,
  leaks,
  onTap,
  gap = 6,
  cols = PIPES_COLS,
  solvedFlow = false,
}: {
  tiles: PipeTile[];
  source: number;
  connected: Set<number>;
  leaks?: Set<number> | undefined;
  onTap?: ((cell: number) => void) | undefined;
  gap?: number | undefined;
  cols?: number | undefined;
  /** Plays the water rush from the source through the network. */
  solvedFlow?: boolean;
}) {
  const defsId = useId().replace(/:/g, "");
  const depths = useMemo(() => pipelineDepths(tiles, source, cols), [tiles, source, cols]);
  const inflows = useMemo(() => pipeInflows(tiles, depths, cols), [tiles, depths, cols]);
  // The rush reaches the furthest pipe by 0.9 s, then fades by 1.2 s.
  const stepMs = 900 / (Math.max(0, ...depths.values()) + 1);
  return (
    <div
      className="pipes-board relative mx-auto grid aspect-square h-full max-h-full w-full max-w-full"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${Math.ceil(tiles.length / cols)}, minmax(0, 1fr))`,
        gap,
      }}
    >
      <PipeDefs id={defsId} />
      {tiles.map((tile, cell) => (
        <PipeTileView
          key={cell}
          defsId={defsId}
          cell={cell}
          label={`Pipe tile ${cell + 1}`}
          tile={tile}
          lit={connected.has(cell)}
          source={cell === source}
          leak={leaks?.has(cell)}
          inflow={inflows[cell] ?? 0}
          surgeDelay={solvedFlow && depths.has(cell) ? (depths.get(cell) ?? 0) * stepMs : undefined}
          surgeStep={stepMs}
          onTapCell={onTap}
        />
      ))}
    </div>
  );
});

/** Per tile, the open sides that face a mutually open neighbour one step nearer the source. */
function pipeInflows(tiles: PipeTile[], depths: Map<number, number>, cols: number): number[] {
  return tiles.map((tile, cell) => {
    const depth = depths.get(cell);
    if (depth === undefined || depth === 0) return 0;
    const mask = tileOpenings(tile);
    let inflow = 0;
    for (const arm of PIPE_ARMS) {
      if (!(mask & arm.bit)) continue;
      const x = (cell % cols) + arm.dx;
      const y = Math.floor(cell / cols) + arm.dy;
      const next = y * cols + x;
      if (x < 0 || x >= cols || y < 0 || !tiles[next] || depths.get(next) !== depth - 1) continue;
      if (tileOpenings(tiles[next]) & rotateMask(arm.bit, 2)) inflow |= arm.bit;
    }
    return inflow;
  });
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  const tiles: PipeTile[] = [
    { sides: PIPE_E | PIPE_S },
    { sides: PIPE_E | PIPE_W },
    { sides: PIPE_W },
    { sides: PIPE_N },
    { sides: PIPE_N | PIPE_E },
    { sides: PIPE_S },
    { sides: PIPE_N },
    { sides: PIPE_E },
    { sides: PIPE_N },
  ];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Tap tiles to turn them. Connect every pipe to the source with no leaks.
      </p>
      <div style={{ width: 132 }}>
        <PipesBoard
          tiles={tiles}
          source={0}
          cols={3}
          connected={new Set([0, 1])}
          leaks={new Set([4])}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        All 49 connected = 120 + up to 30 for speed. You have 120 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "pipes" }: PuzzleStageProps) {
  const startTiles = puzzle.type === "pipes" ? puzzle.tiles : [];
  const source = puzzle.type === "pipes" ? puzzle.source : 0;
  const [sides, setSides] = useStageState<number[]>(stateKey, "pipeSides", () =>
    startTiles.map((tile) => tileOpenings(tile)),
  );
  const submitted = useRef(false);

  const tiles = useMemo<PipeTile[]>(
    () => startTiles.map((tile, index) => ({ sides: sides[index] ?? tileOpenings(tile) })),
    [startTiles, sides],
  );
  const state = useMemo(() => pipesState(tiles, source), [tiles, source]);
  const solveFx = useSolveMoment(state.solved && tiles.length > 0, "pipes.solve");
  const inFrame = useFrameProgress(state.connected.size, PIPES_CELLS, "connected");
  const wetCount = useRef(state.connected.size);
  const lastTurned = useRef<number | null>(null);
  useEffect(() => {
    // Water reaching more pipes after a turn (the solve has its own cue).
    if (state.connected.size > wetCount.current && !state.solved) {
      soundCue("pipes.flow");
      // Batch P (display only): the turned tile that let the water on flashes the right-move ring.
      if (lastTurned.current !== null) {
        rightMoveFlash(document.querySelector(`[data-game-stage] [data-pipe-cell="${lastTurned.current}"]`));
      }
    }
    wetCount.current = state.connected.size;
  }, [state.connected.size, state.solved]);

  useEffect(() => {
    onDraftAnswer?.(encodeSides(tiles));
  }, [tiles, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !state.solved || !tiles.length) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodeSides(tiles));
  }, [state.solved, tiles, locked, onSubmit]);

  /** A tap turns only the tapped tile, one quarter turn clockwise (stable, so the memoised board keeps its tiles). */
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const rotate = useCallback(
    (cell: number) => {
      if (lockedRef.current || submitted.current) return;
      lastTurned.current = cell;
      buzz(8);
      setSides((current) =>
        current.map((value, index) => (index === cell ? rotateMask(value, 1) : value)),
      );
    },
    [setSides],
  );

  if (puzzle.type !== "pipes") return null;

  return (
    <div data-stage-column="3" data-polish="pipes" className="flex min-h-0 flex-1 flex-col gap-3">
      {inFrame ? null : (
        <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          connected <span className="text-primary">{state.connected.size}</span> / {PIPES_CELLS}
        </p>
      )}
      <div data-game-arena="board" className="puzzle-square-space flex min-h-0 flex-1 items-center justify-center">
        <div className="pipes-play-board aspect-square" data-solve-fx={solveFx ? "true" : undefined}>
        <PipesBoard
          tiles={tiles}
          source={source}
          connected={state.connected}
          solvedFlow={solveFx}
          onTap={locked ? undefined : rotate}
        />
        </div>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  // Kept per puzzle and answer, so the reveal clock's ticks leave both memoised boards alone.
  const boards = useMemo(() => {
    if (puzzle.type !== "pipes") return null;
    const solved: PipeTile[] = puzzle.tiles.map((tile, index) => ({
      sides: puzzle.solution?.[index] ?? tileOpenings(tile),
    }));
    const mine = decodeSides(puzzle.tiles, myAnswer ?? encodeSides(puzzle.tiles));
    return { solved, all: new Set(solved.map((_, index) => index)), mine, mineState: pipesState(mine, puzzle.source) };
  }, [puzzle, myAnswer]);
  if (puzzle.type !== "pipes" || !boards) return null;
  const { solved, all, mine, mineState } = boards;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3">
      <div className="pipes-reveal-space flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3">
      <div className="flex items-start justify-center gap-3">
        <div className="pipes-reveal-board flex flex-col items-center gap-1">
          <PipesBoard
            tiles={solved}
            source={puzzle.source}
            connected={all}
            solvedFlow
            gap={4}
          />
          <span className="font-mono text-base uppercase tracking-widest text-muted-foreground">
            solved
          </span>
        </div>
        <div className="pipes-reveal-board flex flex-col items-center gap-1">
          <PipesBoard
            tiles={mine}
            source={puzzle.source}
            connected={mineState.connected}
            leaks={mineState.leaks}
            solvedFlow={mineState.solved}
            gap={4}
          />
          <span className="font-mono text-base uppercase tracking-widest text-muted-foreground">
            yours
          </span>
        </div>
      </div>
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        {myCorrect
          ? `✓ Solved${elapsed === null ? "" : ` · ${elapsed.toFixed(1)}s`}`
          : `✗ ${mineState.connected.size} / ${PIPES_CELLS} connected`}
      </p>
      </div>
    </div>
  );
}

/** The solved side-sets stay server-side; the server re-checks the flow itself. */
export const pipesPuzzle: PuzzleDefinition = {
  key: "pipes",
  name: gameDisplayName("pipes"),
  category: "pattern",
  timeLimitMs: PIPES_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "pipes", tiles: [], source: 0 }) satisfies PipesPuzzleData,
  check: () => false,
  revealHeading: "The connected network",
  IntroExample,
  Stage,
  Reveal,
};
