import { pipelineDepths } from "@/components/puzzles/pipelineFlow";
import { PIPE_ARMS, PipeArt, PipeDefs, PipeSurge } from "@/components/puzzles/pattern/pipesArt";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { playCorrect } from "@/lib/sound";
import { useEffect, useId, useMemo, useRef, useState } from "react";

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

/** One pipe tile, drawn straight from its set of open sides. */
function PipeTileView({
  defsId,
  tile,
  lit,
  source,
  leak,
  onTap,
  label,
  inflow = 0,
  surge,
}: {
  defsId: string;
  tile: PipeTile;
  lit: boolean;
  source: boolean;
  leak?: boolean | undefined;
  onTap?: (() => void) | undefined;
  label?: string;
  inflow?: number;
  surge?: { delay: number; step: number } | undefined;
}) {
  const mask = tileOpenings(tile);
  const [turns, setTurns] = useState(0);
  return (
    <button
      type="button"
      disabled={!onTap}
      onClick={
        onTap &&
        (() => {
          setTurns((value) => value + 1);
          soundCue("pipes.rotate");
          onTap();
        })
      }
      className="pipe-tile relative rounded-[6px]"
      data-lit={lit ? "true" : undefined}
      aria-label={label ?? "Pipe tile"}
    >
      <PipeArt id={defsId} mask={mask} wet={lit} source={source} inflow={inflow} turnKey={turns} />
      {surge && <PipeSurge mask={mask} inflow={inflow} delay={surge.delay} step={surge.step} />}
      {leak && <span className="pipe-leak pointer-events-none absolute right-[5%] top-[5%] h-[22%] w-[22%]" />}
    </button>
  );
}

function PipesBoard({
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
          label={`Pipe tile ${cell + 1}`}
          tile={tile}
          lit={connected.has(cell)}
          source={cell === source}
          leak={leaks?.has(cell)}
          inflow={inflows[cell] ?? 0}
          surge={solvedFlow && depths.has(cell) ? { delay: (depths.get(cell) ?? 0) * stepMs, step: stepMs } : undefined}
          {...(onTap ? { onTap: () => onTap(cell) } : {})}
        />
      ))}
    </div>
  );
}

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
        All 49 connected = 130 + up to 20 for speed. You have 120 seconds.
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
  const wetCount = useRef(state.connected.size);
  useEffect(() => {
    // Water reaching more pipes after a turn (the solve has its own cue).
    if (state.connected.size > wetCount.current && !state.solved) soundCue("pipes.flow");
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

  if (puzzle.type !== "pipes") return null;

  /** A tap turns only the tapped tile, one quarter turn clockwise. */
  const rotate = (cell: number) => {
    if (locked || submitted.current) return;
    buzz(8);
    setSides((current) =>
      current.map((value, index) => (index === cell ? rotateMask(value, 1) : value)),
    );
  };

  return (
    <div data-stage-column="3" data-polish="pipes" className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        connected <span className="text-primary">{state.connected.size}</span> / {PIPES_CELLS}
      </p>
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
  if (puzzle.type !== "pipes") return null;
  const solved: PipeTile[] = puzzle.tiles.map((tile, index) => ({
    sides: puzzle.solution?.[index] ?? tileOpenings(tile),
  }));
  const mine = decodeSides(puzzle.tiles, myAnswer ?? encodeSides(puzzle.tiles));
  const mineState = pipesState(mine, puzzle.source);
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
            connected={new Set(solved.map((_, index) => index))}
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
  category: "logic",
  timeLimitMs: PIPES_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "pipes", tiles: [], source: 0 }) satisfies PipesPuzzleData,
  check: () => false,
  revealHeading: "The connected network",
  IntroExample,
  Stage,
  Reveal,
};
