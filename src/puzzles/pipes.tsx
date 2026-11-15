import { pipelineDepths } from "@/components/puzzles/pipelineFlow";
import { PIPE_ARMS, PipeArt, PipeSurge } from "@/components/puzzles/pattern/pipesArt";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { FramePills, parPills } from "@/components/puzzles/pattern/framePills";
import {
  decodePipesTurns,
  encodePipesTapAnswer,
  encodePipesTurnAnswer,
  pipesAfterTaps,
  pipesAfterTurns,
  type PipesTurn,
} from "@/lib/duel/depth4/pipesTaps";
import { usesPatternNov15 } from "@/lib/duel/patternNov15";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { playCorrect } from "@/lib/sound";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

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

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** pipesRev 5 (the Pattern overhaul): a press this long turns the tile anticlockwise. */
export const PIPES_LONG_PRESS_MS = 380;
/** pipesRev 5: a drag this far (css px) on a tile is a swipe, an anticlockwise turn. */
export const PIPES_SWIPE_PX = 14;
/** pipesRev 5: water reaching this many pipes in one turn plays the combo. */
export const PIPES_COMBO_JOIN = 6;

/** A turn's direction: 1 clockwise (a tap), -1 anticlockwise (a long press, a swipe or a right click). */
type TurnDir = 1 | -1;

/**
 * One pipe tile, drawn straight from its set of open sides. Memoised (its props are primitives,
 * the tile object kept while its sides are unchanged and a stable turn handler), so the page clock's
 * ticks never re-render the board's 49 tiles: at 4x CPU slowdown that re-render took 150-450 ms a
 * tick and held a practice round to two painted frames in its first 1.2 s (first-paint-check).
 */
const PipeTileView = memo(function PipeTileView({
  cell,
  tile,
  lit,
  source,
  leakArms = 0,
  onTurnCell,
  twoWay = false,
  label,
  inflow = 0,
  surgeDelay,
  surgeStep = 0,
}: {
  cell: number;
  tile: PipeTile;
  lit: boolean;
  source: boolean;
  leakArms?: number;
  onTurnCell?: ((cell: number, dir: TurnDir) => void) | undefined;
  /** pipesRev 5: long press, swipe and right click turn anticlockwise. */
  twoWay?: boolean;
  label?: string;
  inflow?: number;
  /** The solve rush's start for this tile (ms), or undefined for none. */
  surgeDelay?: number | undefined;
  surgeStep?: number;
}) {
  const mask = tileOpenings(tile);
  const [turn, setTurn] = useState<{ key: number; dir: TurnDir }>({ key: 0, dir: 1 });
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> | null; done: boolean } | null>(null);

  const turnTile = (dir: TurnDir) => {
    if (!onTurnCell) return;
    setTurn((value) => ({ key: value.key + 1, dir }));
    onTurnCell(cell, dir);
  };
  const endPress = () => {
    if (press.current?.timer) clearTimeout(press.current.timer);
    if (press.current) press.current.timer = null;
  };
  useEffect(() => () => endPress(), []);

  const gestures = twoWay && onTurnCell
    ? {
        onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
          endPress();
          if (e.button === 2) {
            // A right click (computers) is an anticlockwise turn; the click that follows is not a tap.
            press.current = { x: e.clientX, y: e.clientY, timer: null, done: true };
            turnTile(-1);
            return;
          }
          const p = { x: e.clientX, y: e.clientY, timer: null as ReturnType<typeof setTimeout> | null, done: false };
          p.timer = setTimeout(() => {
            p.timer = null;
            if (p.done) return;
            p.done = true;
            turnTile(-1);
          }, PIPES_LONG_PRESS_MS);
          press.current = p;
        },
        onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => {
          const p = press.current;
          if (!p || p.done || !p.timer) return;
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < PIPES_SWIPE_PX) return;
          endPress();
          p.done = true;
          turnTile(-1);
        },
        onPointerUp: endPress,
        onPointerCancel: endPress,
        onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
      }
    : {};

  return (
    <button
      type="button"
      disabled={!onTurnCell}
      {...gestures}
      onClick={
        onTurnCell &&
        (() => {
          // A long press or swipe already turned the tile anticlockwise: its click is not a tap.
          if (press.current?.done) {
            press.current = null;
            return;
          }
          press.current = null;
          turnTile(1);
        })
      }
      className="pipe-tile relative rounded-[6px]"
      data-lit={lit ? "true" : undefined}
      data-two-way={twoWay && onTurnCell ? "true" : undefined}
      data-pipe-cell={onTurnCell ? cell : undefined}
      aria-label={label ?? "Pipe tile"}
    >
      <PipeArt mask={mask} wet={lit} source={source} leakArms={leakArms} turnKey={turn.key} turnDir={turn.dir} />
      {surgeDelay !== undefined && <PipeSurge mask={mask} inflow={inflow} delay={surgeDelay} step={surgeStep} />}
    </button>
  );
});

/**
 * Per tile, the open sides of the water's network that nothing joins (the edge, or a neighbour that doesn't open
 * back): where the water leaks out. Only pipes the water reaches leak (presentation only, from the board shown).
 */
export function networkLeakArms(tiles: PipeTile[], connected: ReadonlySet<number>, cols: number): number[] {
  return tiles.map((tile, cell) => {
    if (!connected.has(cell)) return 0;
    const mask = tileOpenings(tile);
    let arms = 0;
    for (const arm of PIPE_ARMS) {
      if (!(mask & arm.bit)) continue;
      const x = (cell % cols) + arm.dx;
      const y = Math.floor(cell / cols) + arm.dy;
      const next = y * cols + x;
      const inside = x >= 0 && x < cols && y >= 0 && next < tiles.length;
      if (!inside || !(tileOpenings(tiles[next]!) & rotateMask(arm.bit, 2))) arms |= arm.bit;
    }
    return arms;
  });
}

/** Memoised with its tiles: a clock tick above it (unchanged props) skips the whole board. */
export const PipesBoard = memo(function PipesBoard({
  tiles,
  source,
  connected,
  showLeaks = false,
  onTurn,
  twoWay = false,
  gap = 6,
  cols = PIPES_COLS,
  solvedFlow = false,
}: {
  tiles: PipeTile[];
  source: number;
  connected: Set<number>;
  /** Draws the water spilling from every open end of the network. */
  showLeaks?: boolean;
  onTurn?: ((cell: number, dir: TurnDir) => void) | undefined;
  twoWay?: boolean;
  gap?: number | undefined;
  cols?: number | undefined;
  /** Plays the water rush from the source through the network. */
  solvedFlow?: boolean;
}) {
  const depths = useMemo(() => pipelineDepths(tiles, source, cols), [tiles, source, cols]);
  const inflows = useMemo(() => pipeInflows(tiles, depths, cols), [tiles, depths, cols]);
  const leakArms = useMemo(() => (showLeaks ? networkLeakArms(tiles, connected, cols) : null), [showLeaks, tiles, connected, cols]);
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
      {tiles.map((tile, cell) => (
        <PipeTileView
          key={cell}
          cell={cell}
          label={`Pipe tile ${cell + 1}`}
          tile={tile}
          lit={connected.has(cell)}
          source={cell === source}
          leakArms={leakArms?.[cell] ?? 0}
          inflow={inflows[cell] ?? 0}
          surgeDelay={solvedFlow && depths.has(cell) ? (depths.get(cell) ?? 0) * stepMs : undefined}
          surgeStep={stepMs}
          onTurnCell={onTurn}
          twoWay={twoWay}
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

/** The fixed intro example's tiles (3 × 3; the source top left), never randomised. */
const INTRO_TILES: PipeTile[] = [
  { sides: PIPE_E | PIPE_S },
  { sides: PIPE_E | PIPE_W },
  { sides: PIPE_W },
  { sides: PIPE_N | PIPE_E },
  { sides: PIPE_N | PIPE_E },
  { sides: PIPE_S },
  { sides: PIPE_N },
  { sides: PIPE_E },
  { sides: PIPE_N },
];

/** Water flows from the source; the open end it reaches below shows its leak. */
function IntroExample() {
  const connected = useMemo(() => pipesStateOn(INTRO_TILES, 0, 3).connected, []);
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Tap a tile to turn it clockwise; hold or swipe it to turn it back. Join every pipe to the source with no leaks.
      </p>
      <div style={{ width: 132 }}>
        <PipesBoard tiles={INTRO_TILES} source={0} cols={3} connected={connected} showLeaks />
      </div>
      <p className="text-xs text-muted-foreground">
        Connect all 49 to finish. Faster and fewer turns score more. You have 120 seconds.
      </p>
    </div>
  );
}

/** The water's network on a board of any width (the game's own pipesState is for 7 × 7 boards). */
function pipesStateOn(tiles: PipeTile[], source: number, cols: number): { connected: Set<number> } {
  return { connected: new Set(pipelineDepths(tiles, source, cols).keys()) };
}

/** A logged turn as kept in stage state: a cell for clockwise, -(cell + 1) for anticlockwise (pipesRev 5). */
function turnOfLogged(value: number): PipesTurn {
  return value >= 0 ? { cell: value, turn: 1 } : { cell: -value - 1, turn: 3 };
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "pipes" }: PuzzleStageProps) {
  const startTiles = puzzle.type === "pipes" ? puzzle.tiles : [];
  const source = puzzle.type === "pipes" ? puzzle.source : 0;
  const [sides, setSides] = useStageState<number[]>(stateKey, "pipeSides", () =>
    startTiles.map((tile) => tileOpenings(tile)),
  );
  // pipesRev 1 (depth batch 4): every tap is logged (the server takes the board from the taps) for par turns.
  const parTurns = puzzle.type === "pipes" && (puzzle.pipesRev ?? 0) >= 1 ? (puzzle.par ?? 0) : 0;
  const tapLog = puzzle.type === "pipes" && (puzzle.pipesRev ?? 0) >= 1;
  // pipesRev 5 (the Pattern overhaul, patternNov15.ts): tiles turn both ways; the log carries "-cell" for anticlockwise.
  const twoWay = usesPatternNov15(puzzle, "pipes");
  const [taps, setTaps] = useStageState<number[]>(stateKey, "pipeTaps", () => []);
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
    const joined = state.connected.size - wetCount.current;
    if (joined > 0 && !state.solved) {
      // Water reaching more pipes after a turn: a gurgle, the combo for a big join (the solve has its own cue).
      soundCue(twoWay && joined >= PIPES_COMBO_JOIN ? "pipes.combo" : "pipes.flow");
      // Batch P (display only): the turned tile that let the water on flashes the right-move ring.
      if (lastTurned.current !== null) {
        rightMoveFlash(document.querySelector(`[data-game-stage] [data-pipe-cell="${lastTurned.current}"]`));
      }
    } else if (joined < 0 && twoWay) {
      // A turn that cut pipes off the water: the drain.
      soundCue("pipes.drain");
    }
    wetCount.current = state.connected.size;
  }, [state.connected.size, state.solved, twoWay]);
  useEffect(() => {
    // The solve: the rush fills the network (pipes.solve) and the source bubbles.
    if (solveFx && twoWay) soundCue("pipes.bubble");
  }, [solveFx, twoWay]);

  const answer = !tapLog
    ? encodeSides(tiles)
    : twoWay
      ? encodePipesTurnAnswer(tiles, taps.map(turnOfLogged))
      : encodePipesTapAnswer(tiles, taps);
  useEffect(() => {
    onDraftAnswer?.(answer);
  }, [answer, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !state.solved || !tiles.length) return;
    submitted.current = true;
    playCorrect();
    onSubmit(answer);
  }, [state.solved, tiles, locked, onSubmit, answer]);

  /** A turn turns only that tile, a quarter turn (stable, so the memoised board keeps its tiles). */
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const rotate = useCallback(
    (cell: number, dir: TurnDir) => {
      if (lockedRef.current || submitted.current) return;
      const d: TurnDir = twoWay ? dir : 1;
      lastTurned.current = cell;
      soundCue("pipes.rotate");
      setSides((current) =>
        current.map((value, index) => (index === cell ? rotateMask(value, d === 1 ? 1 : 3) : value)),
      );
      if (tapLog) setTaps((current) => [...current, d === 1 ? cell : -cell - 1]);
    },
    [setSides, setTaps, tapLog, twoWay],
  );

  if (puzzle.type !== "pipes") return null;

  return (
    <div data-stage-column="3" data-polish="pipes" className="flex min-h-0 flex-1 flex-col gap-3">
      {inFrame ? null : (
        <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          connected <span className="text-primary">{state.connected.size}</span> / {PIPES_CELLS}
        </p>
      )}
      <div data-game-arena="board" className="puzzle-square-space pipes-arena flex min-h-0 flex-1 flex-col items-center justify-center">
        <div
          className="pipes-play-board aspect-square"
          data-solve-fx={solveFx ? "true" : undefined}
          data-with-pills={parTurns > 0 && inFrame ? "true" : undefined}
        >
          <PipesBoard
            tiles={tiles}
            source={source}
            connected={state.connected}
            showLeaks={twoWay}
            solvedFlow={solveFx}
            twoWay={twoWay}
            onTurn={locked ? undefined : rotate}
          />
        </div>
        {parTurns > 0 ? (
          <FramePills inArena testId="pipes" items={parPills(twoWay ? "Turns" : "Taps", taps.length, parTurns, "turns")} />
        ) : null}
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
    // pipesRev 1: the board is the tap log's, as the server graded it (pipesRev 5: both ways).
    const mine = (puzzle.pipesRev ?? 0) >= 1
      ? usesPatternNov15(puzzle, "pipes")
        ? pipesAfterTurns(puzzle.tiles, decodePipesTurns(myAnswer ?? "", puzzle.tiles.length, true))
        : pipesAfterTaps(puzzle.tiles, decodePipesTurns(myAnswer ?? "", puzzle.tiles.length, false).map((t) => t.cell))
      : decodeSides(puzzle.tiles, myAnswer ?? encodeSides(puzzle.tiles));
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
            showLeaks
            solvedFlow={mineState.solved}
            gap={4}
          />
          <span className="font-mono text-base uppercase tracking-widest text-muted-foreground">
            yours
          </span>
        </div>
      </div>
      {/* The player's own line: shown only under Yours (SolutionSwitch's data-yours-only). */}
      <p data-yours-only="" className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        {myCorrect
          ? `You: solved${elapsed === null ? "" : ` · ${elapsed.toFixed(1)}s`}`
          : `You: ${mineState.connected.size} / ${PIPES_CELLS} connected`}
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
