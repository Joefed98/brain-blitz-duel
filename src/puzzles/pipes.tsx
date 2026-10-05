import { playCorrect } from "@/lib/sound";
import { useEffect, useMemo, useRef } from "react";

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
import { scorePipes } from "@/lib/duel/scoring";
import {
  PIPES_CELLS,
  PIPES_COLS,
  PIPES_TIME_MS,
  type PipeTile,
  type PipesPuzzleData,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const ARMS: { bit: number; x: number; y: number }[] = [
  { bit: PIPE_N, x: 50, y: 0 },
  { bit: PIPE_E, x: 100, y: 50 },
  { bit: PIPE_S, x: 50, y: 100 },
  { bit: PIPE_W, x: 0, y: 50 },
];

/** One pipe tile, drawn straight from its set of open sides. */
function PipeTileView({
  tile,
  lit,
  source,
  leak,
  onTap,
  label,
}: {
  tile: PipeTile;
  lit: boolean;
  source: boolean;
  leak?: boolean | undefined;
  onTap?: (() => void) | undefined;
  label?: string;
}) {
  const mask = tileOpenings(tile);
  const stroke = lit ? "var(--primary)" : "var(--muted-foreground)";
  return (
    <button
      type="button"
      disabled={!onTap}
      onClick={onTap}
      className={`relative rounded-lg border transition-colors duration-100 ${
        lit ? "border-primary/60 bg-primary/10" : "border-border bg-card"
      }`}
      aria-label={label ?? "Pipe tile"}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        {ARMS.filter((arm) => mask & arm.bit).map((arm) => (
          <line
            key={arm.bit}
            x1={50}
            y1={50}
            x2={arm.x}
            y2={arm.y}
            stroke={stroke}
            strokeWidth={22}
            strokeLinecap="round"
          />
        ))}
        <circle cx={50} cy={50} r={13} fill={stroke} />
      </svg>
      {source && (
        <span className="pointer-events-none absolute inset-[14%] rounded-full border-2 border-primary" />
      )}
      {leak && (
        <span className="pointer-events-none absolute right-[6%] top-[6%] h-[18%] w-[18%] rounded-full bg-destructive" />
      )}
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
}: {
  tiles: PipeTile[];
  source: number;
  connected: Set<number>;
  leaks?: Set<number> | undefined;
  onTap?: ((cell: number) => void) | undefined;
  gap?: number | undefined;
  cols?: number | undefined;
}) {
  return (
    <div
      className="mx-auto grid aspect-square h-full max-h-full w-full max-w-full"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${Math.ceil(tiles.length / cols)}, minmax(0, 1fr))`,
        gap,
      }}
    >
      {tiles.map((tile, cell) => (
        <PipeTileView
          key={cell}
          label={`Pipe tile ${cell + 1}`}
          tile={tile}
          lit={connected.has(cell)}
          source={cell === source}
          leak={leaks?.has(cell)}
          {...(onTap ? { onTap: () => onTap(cell) } : {})}
        />
      ))}
    </div>
  );
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
        All 49 = 100 + speed. 48 = 90, 47 = 85, then 5 less per 2 tiles. You have 120 seconds.
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        connected <span className="text-primary">{state.connected.size}</span> / {PIPES_CELLS}
      </p>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <PipesBoard
          tiles={tiles}
          source={source}
          connected={state.connected}
          onTap={locked ? undefined : rotate}
        />
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
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex items-start justify-center gap-3">
        <div className="flex flex-col items-center gap-1" style={{ width: 132 }}>
          <PipesBoard
            tiles={solved}
            source={puzzle.source}
            connected={new Set(solved.map((_, index) => index))}
            gap={4}
          />
          <span className="font-mono text-base uppercase tracking-widest text-muted-foreground">
            solved
          </span>
        </div>
        <div className="flex flex-col items-center gap-1" style={{ width: 132 }}>
          <PipesBoard
            tiles={mine}
            source={puzzle.source}
            connected={mineState.connected}
            leaks={mineState.leaks}
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
      <p className="font-mono text-base text-muted-foreground">
        {scorePipes(Boolean(myCorrect), mineState.connected.size, myMsRemaining ?? 0, timeLimitMs)} points
      </p>
    </div>
  );
}

/** The solved side-sets stay server-side; the server re-checks the flow itself. */
export const pipesPuzzle: PuzzleDefinition = {
  key: "pipes",
  name: "Pipes",
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
