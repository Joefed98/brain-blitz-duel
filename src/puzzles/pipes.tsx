import { pipelineDepths } from "@/components/puzzles/pipelineFlow";
import { PIPE_ARMS, PipeArt, PipeDefs, PipeSurge } from "@/components/puzzles/pattern/pipesArt";
import { planDrain, planWaterIn, runWater, sourceBubbles } from "@/components/puzzles/pattern/pipesFx";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";
import { soundCue as soundCueAt } from "@/lib/fx/soundCues";
import { gameFx } from "@/lib/fx/kit";
import { useRevealViews } from "@/components/duel/RevealScreen";
import { useRevealBoardWidth } from "@/components/puzzles/pattern/revealBoard";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { FramePills, parPills } from "@/components/puzzles/pattern/framePills";
import { HudPills } from "@/components/puzzles/HudPills";
import {
  decodePipesTurns,
  encodePipesTapAnswer,
  encodePipesTurnAnswer,
  pipesAfterTurns,
  type PipesTurn,
} from "@/lib/duel/depth4/pipesTaps";
import { usesPatternNov15 } from "@/lib/duel/patternNov15";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { playCorrect } from "@/lib/sound";
import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

import {
  decodeSides,
  encodeSides,
  pipesDims,
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
  wrong = false,
  untouched = false,
  onTurnCell,
  twoWay = false,
  label,
  inflow = 0,
  surgeDelay,
  surgeStep = 0,
  defs,
}: {
  /** The board's PipeDefs id. */
  defs: string;
  cell: number;
  tile: PipeTile;
  lit: boolean;
  source: boolean;
  leakArms?: number;
  /** The reveal's highlight: the tile is not turned as in the solution. */
  wrong?: boolean;
  /** The reveal: left as dealt and still to turn (dimmed). */
  untouched?: boolean;
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
      data-wrong={wrong ? "true" : undefined}
      data-untouched={untouched ? "true" : undefined}
      data-two-way={twoWay && onTurnCell ? "true" : undefined}
      data-pipe-cell={onTurnCell ? cell : undefined}
      data-pipe-index={cell}
      aria-label={label ?? "Pipe tile"}
    >
      <PipeArt defs={defs} inflow={inflow} mask={mask} wet={lit} source={source} leakArms={leakArms} turnKey={turn.key} turnDir={turn.dir} />
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
  wrong,
  untouched,
  onTurn,
  twoWay = false,
  gap = 6,
  cols = PIPES_COLS,
  solvedFlow = false,
  animateWater = false,
}: {
  tiles: PipeTile[];
  source: number;
  connected: Set<number>;
  /** Draws the water spilling from every open end of the network. */
  showLeaks?: boolean;
  /** Tiles to outline red (the reveal: not as in the solution). */
  wrong?: ReadonlySet<number> | undefined;
  /** Tiles to dim (the reveal: left as dealt, still to turn). */
  untouched?: ReadonlySet<number> | undefined;
  onTurn?: ((cell: number, dir: TurnDir) => void) | undefined;
  twoWay?: boolean;
  gap?: number | undefined;
  cols?: number | undefined;
  /** Plays the water rush from the source through the network. */
  solvedFlow?: boolean;
  /** The live round (stage 2's effects): water runs into newly joined pipes and drains out of cut-off ones. */
  animateWater?: boolean;
}) {
  const depths = useMemo(() => pipelineDepths(tiles, source, cols), [tiles, source, cols]);
  const inflows = useMemo(() => pipeInflows(tiles, depths, cols), [tiles, depths, cols]);
  const boardRef = useRef<HTMLDivElement>(null);
  const defsId = `pipes${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const water = useRef<{ connected: ReadonlySet<number>; depths: Map<number, number>; inflows: number[] } | null>(null);
  // Before paint, so a newly joined pipe never shows full for a frame before its water runs in (presentation only:
  // reads the board drawn, never a turn or the answer).
  useLayoutEffect(() => {
    const last = water.current;
    water.current = { connected, depths, inflows };
    if (!animateWater || !last || !boardRef.current) return;
    const travel = (cell: number, from: number[], depth: Map<number, number>) => {
      const arm = PIPE_ARMS.find((a) => (from[cell] ?? 0) & a.bit);
      return { cell, depth: depth.get(cell) ?? 0, dx: arm ? -arm.dx : 0, dy: arm ? -arm.dy : 0 };
    };
    const joined = [...connected].filter((cell) => !last.connected.has(cell)).map((cell) => travel(cell, inflows, depths));
    const cut = [...last.connected].filter((cell) => !connected.has(cell)).map((cell) => travel(cell, last.inflows, last.depths));
    const layer = (cell: number) => boardRef.current?.querySelector(`[data-pipe-index="${cell}"] .pipe-wet`) ?? null;
    for (const step of planWaterIn(joined)) runWater(layer(step.cell), layer(step.cell)?.firstElementChild ?? null, step, true);
    for (const step of planDrain(cut)) runWater(layer(step.cell), layer(step.cell)?.firstElementChild ?? null, step, false);
  }, [animateWater, connected, depths, inflows]);
  const leakArms = useMemo(() => (showLeaks ? networkLeakArms(tiles, connected, cols) : null), [showLeaks, tiles, connected, cols]);
  // The rush reaches the furthest pipe by 0.9 s, then fades by 1.2 s.
  const stepMs = 900 / (Math.max(0, ...depths.values()) + 1);
  return (
    <div
      ref={boardRef}
      className="pipes-board relative mx-auto grid aspect-square h-full max-h-full w-full max-w-full"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${Math.ceil(tiles.length / cols)}, minmax(0, 1fr))`,
        // Expert's taller board (difficulty levels): its own shape; square boards keep the class's 1 : 1.
        ...(Math.ceil(tiles.length / cols) !== cols ? { aspectRatio: `${cols} / ${Math.ceil(tiles.length / cols)}` } : {}),
        gap,
        // The pipework runs into half the gap each side, so tubes join across it (presentation only).
        "--pipe-gap": `${gap}px`,
      } as CSSProperties}
    >
      <PipeDefs id={defsId} />
      {tiles.map((tile, cell) => (
        <PipeTileView
          key={cell}
          defs={defsId}
          cell={cell}
          label={`Pipe tile ${cell + 1}`}
          tile={tile}
          lit={connected.has(cell)}
          source={cell === source}
          leakArms={leakArms?.[cell] ?? 0}
          wrong={wrong?.has(cell) ?? false}
          untouched={untouched?.has(cell) ?? false}
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

/** The gurgle's pitch by how many pipes one turn joined: one a little brighter, five or more a little lower. */
export function pipeFlowRate(joined: number): number {
  return Math.round((1.12 - 0.05 * (Math.min(5, Math.max(1, joined)) - 1)) * 100) / 100;
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
  // Difficulty levels (pipes.levels.ts): a level board's size and whether its leaks show; every board before levels is
  // 7 × 7 with leaks shown on pipesRev 5.
  const dims = pipesDims(puzzle.type === "pipes" ? puzzle : null);
  const hideLeaks = puzzle.type === "pipes" && puzzle.hideLeaks === true;
  const state = useMemo(() => pipesState(tiles, source, dims.cols), [tiles, source, dims.cols]);
  const solveFx = useSolveMoment(state.solved && tiles.length > 0, "pipes.solve");
  const inFrame = useFrameProgress(state.connected.size, dims.cells, "connected");
  const wetCount = useRef(state.connected.size);
  const lastTurned = useRef<number | null>(null);
  useEffect(() => {
    const joined = state.connected.size - wetCount.current;
    if (joined > 0 && !state.solved) {
      // Water reaching more pipes after a turn: a gurgle sized to the join (one pipe brighter and quicker, five lower
      // and fuller), the combo for a big join (the solve has its own cue). The water itself runs in on the board.
      const turned = lastTurned.current === null ? null : document.querySelector(`[data-game-stage] [data-pipe-cell="${lastTurned.current}"]`);
      if (twoWay && joined >= PIPES_COMBO_JOIN) {
        soundCue("pipes.combo");
        // The kit's combo on the turned pipe's own art (its sound is pipes.combo, so silent).
        gameFx("combo", turned?.querySelector(".pipe-art"), { count: joined - PIPES_COMBO_JOIN + 2, silent: true });
      } else {
        soundCueAt("pipes.flow", pipeFlowRate(joined));
      }
      // Batch P (display only): the turned tile that let the water on flashes the right-move ring.
      if (turned) rightMoveFlash(turned);
    } else if (joined < 0 && twoWay) {
      // A turn that cut pipes off the water: the drain.
      soundCue("pipes.drain");
    }
    wetCount.current = state.connected.size;
  }, [state.connected.size, state.solved, twoWay]);
  useEffect(() => {
    // The solve: the rush fills the network (pipes.solve) and the source bubbles.
    if (!solveFx) return;
    if (twoWay) soundCue("pipes.bubble");
    sourceBubbles(document.querySelector(`[data-game-stage] [data-pipe-index="${source}"] .pipe-art`));
  }, [solveFx, twoWay, source]);

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
          connected <span className="text-primary">{state.connected.size}</span> / {dims.cells}
        </p>
      )}
      <div data-game-arena="board" className="puzzle-square-space pipes-arena flex min-h-0 flex-1 flex-col items-center justify-center">
        <div
          className="pipes-play-board aspect-square"
          data-solve-fx={solveFx ? "true" : undefined}
          data-with-pills={parTurns > 0 && inFrame ? "true" : undefined}
          data-pipes-tall={dims.rows !== dims.cols ? "true" : undefined}
          style={dims.rows !== dims.cols ? ({ "--pipes-ar": `${dims.cols / dims.rows}` } as CSSProperties) : undefined}
        >
          <PipesBoard
            tiles={tiles}
            source={source}
            cols={dims.cols}
            connected={state.connected}
            showLeaks={twoWay && !hideLeaks}
            solvedFlow={solveFx}
            animateWater
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

/**
 * What the reveal shows of the player's own board (the Pattern overhaul's reveal, 15 Nov 2026), read the way the server
 * graded it: from pipesRev 1 the tap log cut at the stored `turns` (the grader stops counting at the solve; pipesRev 5
 * reads "-cell" as anticlockwise), before that the side-sets sent.
 */
export function pipesRevealView(
  puzzle: PipesPuzzleData,
  myAnswer: string | null,
  myExtra?: Record<string, unknown> | null,
): {
  mine: PipeTile[];
  connected: Set<number>;
  solved: boolean;
  /** Tiles the player turned that are not as in the solution (only on an unfinished board: any solved layout counts). */
  wrong: Set<number>;
  /** Tiles left as dealt that still needed turning (unfinished boards only). */
  untouched: Set<number>;
  /** The open ends of the water's network (spills). */
  leaks: number;
  /** Turns the grader counted (stored), or null on stamps that log none. */
  turns: number | null;
} {
  const logged = (puzzle.pipesRev ?? 0) >= 1;
  const twoWay = usesPatternNov15(puzzle, "pipes");
  let mine: PipeTile[];
  let turns: number | null = null;
  let turned: Set<number>;
  if (logged) {
    const log = decodePipesTurns(myAnswer ?? "", puzzle.tiles.length, twoWay);
    const stored = typeof myExtra?.["turns"] === "number" ? (myExtra["turns"] as number) : null;
    turns = stored ?? log.length;
    const used = log.slice(0, Math.min(log.length, turns));
    mine = pipesAfterTurns(puzzle.tiles, used);
    turned = new Set(used.map((t) => t.cell));
  } else {
    mine = decodeSides(puzzle.tiles, myAnswer ?? encodeSides(puzzle.tiles));
    turned = new Set(mine.flatMap((tile, cell) => (tileOpenings(tile) !== tileOpenings(puzzle.tiles[cell]!) ? [cell] : [])));
  }
  const dims = pipesDims(puzzle);
  const state = pipesState(mine, puzzle.source, dims.cols);
  const wrong = new Set<number>();
  const untouched = new Set<number>();
  if (!state.solved && puzzle.solution?.length === puzzle.tiles.length) {
    mine.forEach((tile, cell) => {
      if (tileOpenings(tile) === ((puzzle.solution![cell] ?? 0) & 15)) return;
      if (turned.has(cell)) wrong.add(cell);
      else untouched.add(cell);
    });
  }
  const leaks = networkLeakArms(mine, state.connected, dims.cols).reduce((sum, arms) => sum + PIPE_ARMS.filter((a) => arms & a.bit).length, 0);
  return { mine, connected: state.connected, solved: state.solved, wrong, untouched, leaks, turns };
}

/** The reveal's two views on the template's control (G4). */
const PIPES_REVEAL_VIEWS = [
  { id: "solution", label: "Solution" },
  { id: "yours", label: "Yours" },
] as const;

/** Turns against par as a bar (the visual summary): the par mark in gold, the player's turns over it. */
function TurnsBar({ turns, par }: { turns: number; par: number }) {
  const span = Math.max(par * 2, turns, 1);
  return (
    <span className="pipes-turns-bar" data-pipes-turns-bar="" role="img" aria-label={`${turns} turns against a par of ${par}`}>
      <span className="pipes-turns-fill" data-over={turns > par ? "true" : undefined} style={{ width: `${(100 * Math.min(turns, span)) / span}%` }} />
      <span className="pipes-turns-par" style={{ left: `${(100 * par) / span}%` }} />
    </span>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, myExtra, onWin }: PuzzleRevealProps) {
  // The solve's payoff: the reveal's win moment, once (the template plays the effects kit's win; the polish plan's G4,
  // 27 Nov 2026: a callback, so the board never reaches outside its own reveal).
  const winRef = useRef<HTMLDivElement>(null);
  const won = Boolean(myCorrect && puzzle.type === "pipes");
  const onWinRef = useRef(onWin);
  onWinRef.current = onWin;
  useEffect(() => {
    if (won) onWinRef.current?.();
  }, [won]);
  // Solution and Yours on the template's views control (G4), one board at a time, each at the stage's size.
  const shown = useRevealViews(PIPES_REVEAL_VIEWS);
  const colRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dimsForFit = puzzle.type === "pipes" ? pipesDims(puzzle) : { cols: 1, rows: 1 };
  const fitWidth = useRevealBoardWidth(colRef, boardRef, { aspect: dimsForFit.cols / dimsForFit.rows });
  // Kept per puzzle and answer, so the reveal clock's ticks leave both memoised boards alone.
  const boards = useMemo(() => {
    if (puzzle.type !== "pipes") return null;
    const solved: PipeTile[] = puzzle.tiles.map((tile, index) => ({
      sides: puzzle.solution?.[index] ?? tileOpenings(tile),
    }));
    return { solved, all: new Set(solved.map((_, index) => index)), view: pipesRevealView(puzzle, myAnswer, myExtra) };
  }, [puzzle, myAnswer, myExtra]);
  if (puzzle.type !== "pipes" || !boards) return null;
  const { solved, all, view } = boards;
  void timeLimitMs;
  // The numbers come from the stored grade: connected and turns from its extra, time left from the stored time.
  const connected = typeof myExtra?.["connected"] === "number" ? (myExtra["connected"] as number) : view.connected.size;
  const par = (puzzle.pipesRev ?? 0) >= 1 ? (puzzle.par ?? 0) : 0;
  const timeLeft = myCorrect && myMsRemaining !== undefined ? Math.round(myMsRemaining / 1000) : null;
  const twoWay = usesPatternNov15(puzzle, "pipes");
  // Difficulty levels: the board's own size (7 × 7 on every board before levels).
  const { cols: revealCols, rows: revealRows } = pipesDims(puzzle);
  const revealTall = revealRows !== revealCols;
  const revealShape = {
    ...(revealTall ? { "--pipes-ar": `${revealCols / revealRows}` } : {}),
    ...(fitWidth ? { width: fitWidth } : {}),
  } as CSSProperties;
  const result = myCorrect
    ? `You: every pipe joined${timeLeft === null ? "" : `, ${timeLeft} s left`}`
    : myAnswer === null || myAnswer === ""
      ? "You: no turns"
      : `You: ${connected} of ${pipesDims(puzzle).cells} joined to the source`;

  return (
    <div ref={winRef} className="pipes-reveal flex w-full min-h-0 flex-col items-center gap-2" data-pipes-reveal="">
      <div className="pipes-reveal-boards flex min-h-0 w-full flex-1 items-start justify-center gap-3">
        <div ref={shown === "solution" ? colRef : undefined} hidden={shown !== "solution"} className="pipes-reveal-col flex min-w-0 flex-1 flex-col items-center gap-1" data-pipes-solution="">
          <div ref={shown === "solution" ? boardRef : undefined} className="pipes-reveal-board aspect-square" data-pipes-tall={revealTall ? "true" : undefined} style={revealShape}>
            <PipesBoard tiles={solved} source={puzzle.source} cols={revealCols} connected={all} solvedFlow gap={4} />
          </div>
          <span className="pipes-reveal-label sr-only">Solution</span>
          <span className="pipes-reveal-caption">Every pipe joined to the source, no leaks</span>
        </div>
        <div ref={shown === "yours" ? colRef : undefined} hidden={shown !== "yours"} className="pipes-reveal-col flex min-w-0 flex-1 flex-col items-center gap-1" data-pipes-yours="">
          <div ref={shown === "yours" ? boardRef : undefined} className="pipes-reveal-board aspect-square" data-pipes-tall={revealTall ? "true" : undefined} style={revealShape}>
            <PipesBoard
              cols={revealCols}
              tiles={view.mine}
              source={puzzle.source}
              connected={view.connected}
              showLeaks
              wrong={view.wrong}
              untouched={view.untouched}
              solvedFlow={view.solved}
              gap={4}
            />
          </div>
          <span className="pipes-reveal-label sr-only">Yours</span>
          <span className="pipes-reveal-caption" data-pipes-result="">{result}</span>
          {/* The numbers that explain the score, from the stored grade (the player's own, so under Yours). */}
          <HudPills
            testId="pipes-reveal"
            className="pipes-reveal-pills"
            items={[
              view.turns !== null ? { id: "turns", label: twoWay ? "Turns" : "Taps", value: view.turns, tone: myCorrect && par > 0 && view.turns > par ? "warn" : undefined } : null,
              par > 0 ? { id: "par", label: "Par", value: par, tone: "gold" } : null,
              { id: "connected", label: "Joined", value: `${connected}/${pipesDims(puzzle).cells}`, tone: myCorrect ? "good" : undefined },
              timeLeft !== null ? { id: "time", label: "Time left", value: `${timeLeft} s` } : null,
            ]}
          />
          {myCorrect && par > 0 && view.turns !== null ? <TurnsBar turns={view.turns} par={par} /> : null}
          {view.wrong.size || view.untouched.size || view.leaks ? (
            <span className="pipes-reveal-key" data-pipes-key="">
              {view.wrong.size ? <span data-key="wrong">Red outline: turned, not as in the solution ({view.wrong.size})</span> : null}
              {view.untouched.size ? <span data-key="untouched">Dimmed: still to turn ({view.untouched.size})</span> : null}
              {view.leaks ? <span data-key="leak">Spray: an open end ({view.leaks})</span> : null}
            </span>
          ) : null}
        </div>
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
