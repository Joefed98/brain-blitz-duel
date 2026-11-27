import { gameDisplayName } from "@/lib/duel/gameNames";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { FramePills } from "@/components/puzzles/pattern/framePills";
import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { useRevealViews } from "@/components/duel/RevealScreen";
import { useRevealBoardWidth } from "@/components/puzzles/pattern/revealBoard";

import { gridCellCentre, useGridMetrics, useGridPointer } from "@/components/puzzles/GridDrag";
import { HudPills } from "@/components/puzzles/HudPills";
import { FLOW_COLOUR_HEX as GLYPH_COLOURS, decodeFlowPaths, encodeFlowPaths, flowCellCount, flowCutsLines, flowDrawStep, flowGrid, flowTapClears, flowFilledCells, verifyFlow } from "@/lib/duel/flow";
import { useStageState } from "@/lib/duel/stageState";
import {
  FLOW_CELLS,
  FLOW_COLS,
  FLOW_MAX_PAIRS,
  FLOW_TIME_MS,
  type FlowPair,
  type FlowPuzzleData,
} from "@/lib/duel/types";
import { soundCue } from "@/lib/fx/soundCues";

import { FlowSymbol, FlowTubes, shadeHex, useFlowJoins } from "@/components/puzzles/pattern/flowArt";
import { useSolveMoment } from "@/lib/fx/patternFx";
import { gameFx } from "@/lib/fx/kit";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/**
 * The dots are centred children of their own cells; the paths are one SVG layer
 * over the top, drawn through cell centres measured from the rendered grid, so
 * a line always runs dead through the middle of every square it covers and ends
 * exactly on the partner dot.
 */
export function FlowBoard({
  pairs,
  paths,
  walls = [],
  cols = FLOW_COLS,
  cells = FLOW_CELLS,
  onCell,
  onRelease,
  live = false,
  solved = false,
  marks = null,
}: {
  pairs: FlowPair[];
  paths: number[][];
  walls?: readonly number[];
  cols?: number;
  cells?: number;
  onCell?: ((cell: number) => void) | undefined;
  onRelease?: (() => void) | undefined;
  /** The playable stage board (join pulses and cues); intro and reveal boards are still. */
  live?: boolean;
  /** Every pair joined and every cell filled (starts the completion effect). */
  solved?: boolean;
  /** The reveal's highlights on the player's board: dots of pairs left unjoined, and squares left empty. */
  marks?: FlowMarks | null;
}) {
  const rows = Math.ceil(cells / cols) || cols;
  const total = cols * rows;
  // Levels (16 Nov 2026): Expert's 9 × 12 board is taller than wide; every square board keeps its class as before.
  const square = rows === cols;
  const pointer = useGridPointer({ cols, rows, onCell, onRelease });
  const metrics = useGridMetrics(pointer.ref, cols, rows);

  // The old look (Joe's pick of 20 Nov 2026, earlier E1.3): each filled square takes a soft tint of its line's colour.
  const filled = new Map<number, string>();
  paths.forEach((path, index) => {
    const colour = pairs[index]?.colour;
    if (!colour) return;
    for (const cell of path) filled.set(cell, GLYPH_COLOURS[colour]);
  });
  const stroke = metrics ? Math.max(3, metrics.cellW * 0.4) : 0;
  // Presentation only: which pairs are joined end to end, for the tube caps,
  // the join pulse and the completion effect.
  const joined = pairs.map((pair, index) => {
    const path = paths[index] ?? [];
    const first = path[0];
    const last = path[path.length - 1];
    return path.length > 1 && ((first === pair.a && last === pair.b) || (first === pair.b && last === pair.a));
  });
  useFlowJoins(joined, live, solved);
  const solveFx = useSolveMoment(live && solved, "flow.solve");

  return (
    <div
      className={`flow-board relative mx-auto ${square ? "aspect-square " : ""}h-full max-h-full w-full max-w-full select-none`}
      style={square ? undefined : { aspectRatio: `${cols} / ${rows}` }}
      data-flow-grid={square ? undefined : `${cols}x${rows}`}
    >
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
          const dot = pairs.find((pair) => pair.a === cell || pair.b === cell);
          const tint = filled.get(cell);
          if (walls.includes(cell)) {
            return (
              <div key={cell} className="flow-wall rounded-[3px]" aria-label="Wall" />
            );
          }
          return (
            <div
              key={cell}
              data-flow-empty={marks?.empty.has(cell) ? "" : undefined}
              className="flow-cell flex items-center justify-center rounded-[3px] border border-border bg-card"
              style={tint ? { backgroundColor: `${tint}22`, borderColor: `${tint}55` } : undefined}
            >
              {/* The dot is a child of its own cell, so it is always dead centre,
                  and it sits above the path layer. */}
              {dot && (
                <span
                  className={`flow-dot relative block rounded-full ${joined[pairs.indexOf(dot)] ? "flow-dot-joined" : ""}`}
                  data-flow-pair={pairs.indexOf(dot)}
                  data-flow-missed={marks?.missed.has(cell) ? "" : undefined}
                  data-flow-colour={dot.colour}
                  style={{
                    width: "64%",
                    height: "64%",
                    zIndex: 2,
                    backgroundColor: GLYPH_COLOURS[dot.colour],
                    ["--dot" as string]: GLYPH_COLOURS[dot.colour],
                    ["--dot-rim" as string]: shadeHex(GLYPH_COLOURS[dot.colour], -0.5),
                  }}
                >
                  <FlowSymbol colour={dot.colour} />
                </span>
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
          <FlowTubes
            tubes={paths.map((path, index) => {
              const colour = pairs[index]?.colour;
              return {
                colour: colour ? GLYPH_COLOURS[colour] : "#888888",
                points: colour ? path.map((cell) => gridCellCentre(metrics, cell, cols)) : [],
                joined: joined[index] ?? false,
              };
            })}
            width={stroke}
            live={live}
            solved={solved}
            solveFx={solveFx}
          />
        </svg>
      )}
    </div>
  );
}

/** The reveal's highlights: dots of pairs the player left unjoined, and squares no line of theirs covers. */
export interface FlowMarks {
  missed: ReadonlySet<number>;
  empty: ReadonlySet<number>;
}

export type FlowPairState = "route" | "other" | "open";

/**
 * What the reveal shows of the player's answer (display only): their paths, the highlights, each pair's state (joined
 * along the solution's route, joined another way, or not joined) and the numbers from the stored grade (`myExtra`:
 * pairsJoined, filled, redraws), read again from the answer only for a round stored without them.
 */
export function flowRevealView(puzzle: FlowPuzzleData, answer: string, extra: Record<string, unknown> | null | undefined) {
  const walls = puzzle.walls ?? [];
  const grid = flowGrid(puzzle);
  const cellCount = flowCellCount(grid);
  const paths = decodeFlowPaths(answer, puzzle.pairs.length || FLOW_MAX_PAIRS, cellCount);
  const verdict = verifyFlow(puzzle.pairs, paths, walls, grid);
  const solution = puzzle.solution ?? [];
  const key = (cells: readonly number[]) => [...cells].sort((a, b) => a - b).join(",");
  const states: FlowPairState[] = puzzle.pairs.map((_, i) =>
    !verdict.joined[i] ? "open" : solution[i] && key(paths[i] ?? []) === key(solution[i]!) ? "route" : "other",
  );
  const covered = new Set<number>();
  paths.forEach((path, i) => {
    if (verdict.joined[i]) for (const c of path) covered.add(c);
  });
  const dots = new Set(puzzle.pairs.flatMap((pr) => [pr.a, pr.b]));
  const wallSet = new Set(walls);
  const missed = new Set<number>();
  puzzle.pairs.forEach((pr, i) => {
    if (!verdict.joined[i]) {
      missed.add(pr.a);
      missed.add(pr.b);
    }
  });
  const empty = new Set<number>();
  for (let c = 0; c < cellCount; c++) if (!covered.has(c) && !dots.has(c) && !wallSet.has(c)) empty.add(c);
  const num = (k: string): number | null => {
    const v = extra?.[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  return {
    paths,
    states,
    marks: { missed, empty } satisfies FlowMarks,
    pairsJoined: num("pairsJoined") ?? verdict.pairsJoined,
    filled: num("filled") ?? verdict.filled,
    redraws: num("redraws"),
    squares: cellCount - walls.length,
  };
}

/** One pair's chip in the reveal's strip: its bead and whether the player joined it (on route, another way, not). */
function PairChip({ colour, state }: { colour: FlowPair["colour"]; state: FlowPairState }) {
  const word = state === "route" ? "joined on the solution’s route" : state === "other" ? "joined another way" : "not joined";
  return (
    <span className="flow-pair-chip" data-state={state} aria-label={`${colour.toLowerCase()}: ${word}`} title={word}>
      <span className="flow-pair-bead flow-dot" style={{ backgroundColor: GLYPH_COLOURS[colour], ["--dot-rim" as string]: shadeHex(GLYPH_COLOURS[colour], -0.5) } as CSSProperties}>
        <FlowSymbol colour={colour} />
      </span>
      <span className="flow-pair-mark" aria-hidden="true">
        {state === "open" ? "!" : "✓"}
      </span>
    </span>
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
        Join each pair of dots with a path. Paths can’t cross, and every square must be filled.
      </p>
      <div style={{ width: 148 }}>
        <FlowBoard pairs={pairs} paths={paths} walls={walls} cols={4} cells={16} />
      </div>
      <p className="text-xs text-muted-foreground">
        Striped squares are walls – no path can enter them. Drag from a dot to its partner; drawing over another line
        cuts it back. You have 75 seconds.
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
  /** The dot a drag began on: its path restarts from it on the drag's first real step. */
  const restartFrom = useRef<number | null>(null);
  /** True from the first touch of a drag until the finger lifts. */
  const holding = useRef(false);
  const submitted = useRef(false);

  const walls = puzzle.type === "flow" ? (puzzle.walls ?? []) : [];
  const grid = useMemo(() => flowGrid(puzzle.type === "flow" ? puzzle : null), [puzzle]);
  const cellCount = flowCellCount(grid);
  /** flowRev 3: drawing over another line cuts it back, and a still tap on a dot leaves its line alone. */
  const cuts = flowCutsLines(puzzle);
  const tapClears = flowTapClears(puzzle);
  const verdict = useMemo(() => verifyFlow(pairs, paths, walls, grid), [pairs, paths, walls, grid]);
  const filled = flowFilledCells(paths);
  const inFrame = useFrameProgress(verdict.pairsJoined, pairs.length, "pairs");

  useEffect(() => {
    onDraftAnswer?.(encodeFlowPaths(paths));
  }, [paths, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !verdict.solved) return;
    submitted.current = true;
    // One sound for the solve: the board's own `flow.solve` (FlowBoard), no extra generic `correct`.
    onSubmit(encodeFlowPaths(paths));
  }, [verdict.solved, paths, locked, onSubmit]);

  // A near miss (presentation only): the first time the board is one pair short, or every pair is joined with
  // squares still empty, a soft hint sounds; it sounds again only after the board has left that state.
  const nearMiss = !verdict.solved && pairs.length > 1 && (verdict.pairsJoined === pairs.length - 1 || (verdict.pairsJoined === pairs.length && filled < cellCount - walls.length));
  const wasNear = useRef(false);
  const arena = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (nearMiss && !wasNear.current && !locked) {
      soundCue("flow.nearMiss");
      // The two dots still to join pulse softly (kit nearMiss; the sound is the game's own cue).
      const open = verdict.pairsJoined === pairs.length - 1 ? verdict.joined.findIndex((j) => !j) : -1;
      if (open !== -1) {
        const dots = arena.current?.querySelectorAll(`.flow-dot[data-flow-pair="${open}"]`) ?? [];
        dots.forEach((dot, i) => gameFx("nearMiss", dot, { silent: true, noHaptic: i > 0 }));
      }
    }
    wasNear.current = nearMiss;
  }, [nearMiss, locked, verdict, pairs.length]);

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
        // A dot starts its own path afresh, but only once the finger drags off it (pattern review fixes,
        // 15 Nov 2026): a touch alone leaves a finished pair as it is; a still tap clears it on release.
        const pair = dotPair(cell);
        if (pair !== -1) {
          drawing.current = pair;
          moved.current = false;
          startedOnDot.current = pair;
          restartFrom.current = cell;
          return;
        }
        // …and the loose end of a path can be picked up to carry on from there.
        const loose = paths.findIndex((path) => path.length > 1 && path[path.length - 1] === cell);
        if (loose === -1) return;
        drawing.current = loose;
        moved.current = false;
        startedOnDot.current = null;
        restartFrom.current = null;
        return;
      }

      const from = restartFrom.current;
      let grewTo = 0;
      let cutLine = false;
      setPaths((current) => {
        const step = flowDrawStep(current, active, cell, pairs, walls, from, cuts, grid);
        if (step.rejected) puzzleReject();
        if (!step.moved) return current;
        moved.current = true;
        restartFrom.current = null;
        if (step.completed) drawing.current = null;
        const before = from !== null ? 1 : (current[active]?.length ?? 0);
        const after = step.paths[active]?.length ?? 0;
        if (after > before && !step.completed) grewTo = after;
        if (step.cut !== null) cutLine = true;
        return step.paths;
      });
      // The line growing: a soft liquid tone, a little higher with every square (the join itself is `flow.connect`,
      // one sound, from the board).
      // A fluid slide: the pitch rises smoothly and levels off (at most half again), so a long line never squeaks.
      if (grewTo) soundCue("flow.draw", 1 + 0.5 * (1 - Math.exp(-(grewTo - 2) / 12)));
      if (cutLine) soundCue("flow.cut");
    },
    [cuts, dotPair, grid, locked, pairs, paths, setPaths, walls],
  );

  /**
   * Lifting the finger without moving, on a dot, clears that colour on the stamps before flowRev 3; from it a still
   * touch leaves the line as it is (a stray touch must never wipe a finished pair; a drag restarts it).
   */
  const release = useCallback(() => {
    const pair = startedOnDot.current;
    const wasStill = !moved.current;
    drawing.current = null;
    startedOnDot.current = null;
    restartFrom.current = null;
    holding.current = false;
    if (!tapClears || pair === null || !wasStill || locked || submitted.current) return;
    setPaths((current) => current.map((path, index) => (index === pair ? [] : path)));
  }, [tapClears, locked, setPaths]);

  if (puzzle.type !== "flow") return null;

  return (
    <div
      data-polish="flow"
      data-stage-column="3"
      className="flex min-h-0 flex-1 flex-col gap-3"
      // Levels (16 Nov 2026): a board taller than wide (Expert's 9 × 12) sizes its arena by its own aspect (flow.css).
      data-flow-grid={grid.cols === grid.rows ? undefined : `${grid.cols}x${grid.rows}`}
      style={grid.cols === grid.rows ? undefined : ({ ["--flow-tall" as string]: String(grid.rows / grid.cols) } as CSSProperties)}
    >
      {inFrame ? null : (
        <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          cells filled <span className="text-primary">{filled}</span> / {cellCount - walls.length} ·{" "}
          {verdict.pairsJoined} / {pairs.length} pairs
        </p>
      )}
      <div ref={arena} data-game-arena="board" className="flex min-h-0 flex-1 items-center justify-center">
        <FlowBoard
          pairs={pairs}
          paths={paths}
          walls={walls}
          cols={grid.cols}
          cells={cellCount}
          onCell={locked ? undefined : touch}
          onRelease={release}
          live
          solved={verdict.solved}
        />
      </div>
      <FramePills
        testId="flow"
        items={[
          { id: "pairs", label: "Pairs", value: `${verdict.pairsJoined} / ${pairs.length}` },
          { id: "filled", label: "Filled", value: `${filled} / ${cellCount - walls.length}` },
        ]}
      />
    </div>
  );
}

/** The reveal's two views on the template's control (the polish plan's G4). */
const FLOW_REVEAL_VIEWS = [
  { id: "solution", label: "Solution" },
  { id: "yours", label: "Yours" },
] as const;

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, myExtra }: PuzzleRevealProps) {
  // Solution and Yours on the template's views control (G4, 27 Nov 2026), one board at a time, each at the stage's size.
  const shown = useRevealViews(FLOW_REVEAL_VIEWS);
  const colRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fitGrid = puzzle.type === "flow" ? flowGrid(puzzle) : { cols: 1, rows: 1 };
  const fitWidth = useRevealBoardWidth(colRef, boardRef, { aspect: fitGrid.cols / fitGrid.rows });
  if (puzzle.type !== "flow") return null;
  const solution = puzzle.solution ?? puzzle.pairs.map(() => []);
  const walls = puzzle.walls ?? [];
  const grid = flowGrid(puzzle);
  const square = grid.cols === grid.rows;
  const boardBox = square ? "aspect-square" : "";
  const boardStyle = {
    ...(square ? {} : { aspectRatio: `${grid.cols} / ${grid.rows}` }),
    ...(fitWidth ? { width: fitWidth } : {}),
  };
  const view = flowRevealView(puzzle, myAnswer ?? "", myExtra);
  const total = puzzle.pairs.length;
  const timeLeft = myCorrect && myMsRemaining !== undefined ? Math.max(0, Math.round(myMsRemaining / 1000)) : null;
  const elapsed = myCorrect && myMsRemaining !== undefined ? Math.round((timeLimitMs - myMsRemaining) / 100) / 10 : null;
  const open = view.states.filter((st) => st === "open").length;
  const other = view.states.filter((st) => st === "other").length;
  const result = myCorrect
    ? `You: every pair joined${elapsed === null ? "" : ` in ${elapsed.toFixed(1)} s`}`
    : myAnswer
      ? `You: ${view.pairsJoined} of ${total} pairs, ${view.filled} of ${view.squares} squares`
      : "You: no lines drawn";

  return (
    <div className="flow-reveal flex w-full min-h-0 flex-col items-center gap-2" data-flow-reveal="">
      <div className="flow-reveal-boards flex min-h-0 w-full flex-1 items-start justify-center gap-3">
        <div ref={shown === "solution" ? colRef : undefined} hidden={shown !== "solution"} className="flow-reveal-col flex min-w-0 flex-1 flex-col items-center gap-1" data-flow-solution="">
          <div ref={shown === "solution" ? boardRef : undefined} className={`flow-reveal-board ${boardBox}`.trim()} style={boardStyle}>
            <FlowBoard pairs={puzzle.pairs} paths={solution} walls={walls} cols={grid.cols} cells={grid.cols * grid.rows} />
          </div>
          <span className="flow-reveal-label sr-only">Solution</span>
          <span className="flow-reveal-caption">The one way to join all {total} pairs and fill every square</span>
        </div>
        <div ref={shown === "yours" ? colRef : undefined} hidden={shown !== "yours"} className="flow-reveal-col flex min-w-0 flex-1 flex-col items-center gap-1" data-flow-yours="">
          <div ref={shown === "yours" ? boardRef : undefined} className={`flow-reveal-board flow-reveal-board-yours ${boardBox}`.trim()} style={boardStyle}>
            <FlowBoard pairs={puzzle.pairs} paths={view.paths} walls={walls} cols={grid.cols} cells={grid.cols * grid.rows} marks={myCorrect ? null : view.marks} />
          </div>
          <span className="flow-reveal-label sr-only">Yours</span>
          <span className="flow-reveal-caption" data-flow-result="">{result}</span>
          {/* The numbers that explain the score, from the stored grade (the player's own, so under Yours). */}
          <HudPills
            testId="flow-reveal"
            className="flow-reveal-pills"
            items={[
              { id: "pairs", label: "Pairs", value: `${view.pairsJoined}/${total}`, tone: view.pairsJoined === total ? "good" : undefined },
              { id: "filled", label: "Filled", value: `${view.filled}/${view.squares}` },
              view.redraws !== null ? { id: "redraws", label: "Redraws", value: view.redraws, tone: view.redraws > 0 ? "warn" : "good" } : null,
              timeLeft !== null ? { id: "time", label: "Time left", value: `${timeLeft} s` } : null,
            ]}
          />
          <span className="flow-pair-strip" aria-label="Your pairs">
            {puzzle.pairs.map((pair, i) => (
              <PairChip key={i} colour={pair.colour} state={view.states[i]!} />
            ))}
          </span>
          {!myCorrect && (open || view.marks.empty.size || other) ? (
            <span className="flow-reveal-key" data-flow-key="">
              {open ? <span data-key="missed">Red ring: pair not joined</span> : null}
              {view.marks.empty.size ? <span data-key="empty">Red dot: square left empty</span> : null}
              {other ? <span data-key="other">Amber tick: pair joined another way</span> : null}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The solved paths stay server-side; the server re-walks whatever a phone sends. */
export const flowPuzzle: PuzzleDefinition = {
  key: "flow",
  name: gameDisplayName("flow"),
  category: "pattern",
  timeLimitMs: FLOW_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "flow", pairs: [] }) satisfies FlowPuzzleData,
  check: () => false,
  revealHeading: "The joined board",
  IntroExample,
  Stage,
  Reveal,
};
