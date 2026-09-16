import { useEffect, useMemo, useRef, useState } from "react";

import {
  decodeRotations,
  encodeRotations,
  pipesState,
  PIPE_E,
  PIPE_N,
  PIPE_S,
  PIPE_W,
} from "@/lib/duel/logic";
import {
  PIPES_CELLS,
  PIPES_COLS,
  PIPES_TIME_MS,
  type PipeShape,
  type PipeTile,
  type PipesPuzzleData,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const BASE_OPENINGS: Record<PipeShape, number> = {
  end: PIPE_N,
  straight: PIPE_N | PIPE_S,
  corner: PIPE_N | PIPE_E,
  tee: PIPE_N | PIPE_E | PIPE_S,
};

const ARMS: { bit: number; x: number; y: number }[] = [
  { bit: PIPE_N, x: 50, y: 0 },
  { bit: PIPE_E, x: 100, y: 50 },
  { bit: PIPE_S, x: 50, y: 100 },
  { bit: PIPE_W, x: 0, y: 50 },
];

/**
 * One pipe tile. The shape is drawn in its base orientation and the whole tile
 * is rotated, so a tap animates the turn over 120 ms.
 */
function PipeTileView({
  tile,
  turns,
  lit,
  source,
  leak,
  onTap,
}: {
  tile: PipeTile;
  turns: number;
  lit: boolean;
  source: boolean;
  leak?: boolean | undefined;
  onTap?: (() => void) | undefined;
}) {
  const mask = BASE_OPENINGS[tile.shape];
  const stroke = lit ? "var(--primary)" : "var(--muted-foreground)";
  return (
    <button
      type="button"
      disabled={!onTap}
      onClick={onTap}
      className={`relative rounded-lg border transition-colors duration-100 ${
        lit ? "border-primary/60 bg-primary/10" : "border-border bg-card"
      }`}
      aria-label="Pipe tile"
    >
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full"
        style={{
          transform: `rotate(${turns * 90}deg)`,
          transition: "transform 120ms ease-out",
        }}
        aria-hidden="true"
      >
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
  turns,
  source,
  connected,
  leaks,
  onTap,
  gap = 6,
  cols = PIPES_COLS,
}: {
  tiles: PipeTile[];
  turns: number[];
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
          tile={tile}
          turns={turns[cell] ?? tile.rot}
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
    { shape: "corner", rot: 1 },
    { shape: "straight", rot: 1 },
    { shape: "end", rot: 3 },
    { shape: "end", rot: 0 },
    { shape: "corner", rot: 0 },
    { shape: "end", rot: 1 },
    { shape: "end", rot: 0 },
    { shape: "end", rot: 0 },
    { shape: "end", rot: 0 },
  ];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Tap tiles to turn them. Connect every pipe to the source with no leaks.
      </p>
      <div style={{ width: 132 }}>
        <PipesBoard
          tiles={tiles}
          turns={tiles.map((t) => t.rot)}
          source={0}
          cols={3}
          connected={new Set([0, 1])}
          leaks={new Set([4])}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Every pipe must be connected. You have 60 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const startTiles = puzzle.type === "pipes" ? puzzle.tiles : [];
  const source = puzzle.type === "pipes" ? puzzle.source : 0;
  const [turns, setTurns] = useState<number[]>(() => startTiles.map((tile) => tile.rot));
  const submitted = useRef(false);

  const tiles = useMemo(
    () => startTiles.map((tile, index) => ({ shape: tile.shape, rot: turns[index] ?? tile.rot })),
    [startTiles, turns],
  );
  const state = useMemo(() => pipesState(tiles, source), [tiles, source]);

  useEffect(() => {
    onDraftAnswer?.(encodeRotations(tiles));
  }, [tiles, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !state.solved) return;
    submitted.current = true;
    onSubmit(encodeRotations(tiles));
  }, [state.solved, tiles, locked, onSubmit]);

  if (puzzle.type !== "pipes") return null;

  const rotate = (cell: number) => {
    if (locked || submitted.current) return;
    buzz(8);
    setTurns((current) => current.map((value, index) => (index === cell ? value + 1 : value)));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        connected <span className="text-primary">{state.connected.size}</span> / {PIPES_CELLS}
      </p>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <PipesBoard
          tiles={tiles}
          turns={turns}
          source={source}
          connected={state.connected}
          onTap={locked ? undefined : rotate}
        />
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "pipes") return null;
  const solved: PipeTile[] = puzzle.tiles.map((tile, index) => ({
    shape: tile.shape,
    rot: puzzle.solution?.[index] ?? tile.rot,
  }));
  const mine = decodeRotations(puzzle.tiles, myAnswer ?? encodeRotations(puzzle.tiles));
  const mineState = pipesState(mine, puzzle.source);
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((PIPES_TIME_MS - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex items-start justify-center gap-3">
        <div className="flex flex-col items-center gap-1" style={{ width: 132 }}>
          <PipesBoard
            tiles={solved}
            turns={solved.map((tile) => tile.rot)}
            source={puzzle.source}
            connected={new Set(solved.map((_, index) => index))}
            gap={4}
          />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            solved
          </span>
        </div>
        <div className="flex flex-col items-center gap-1" style={{ width: 132 }}>
          <PipesBoard
            tiles={mine}
            turns={mine.map((tile) => tile.rot)}
            source={puzzle.source}
            connected={mineState.connected}
            leaks={mineState.leaks}
            gap={4}
          />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            yours
          </span>
        </div>
      </div>
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        {myCorrect
          ? `✓ Solved${elapsed === null ? "" : ` · ${elapsed}s`}`
          : `✗ ${mineState.connected.size} / ${PIPES_CELLS} connected`}
      </p>
    </div>
  );
}

/** The solved rotations stay server-side; the server re-checks the flow itself. */
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
