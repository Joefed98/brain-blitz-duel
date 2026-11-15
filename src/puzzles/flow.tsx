import { gameDisplayName } from "@/lib/duel/gameNames";
import { solutionProgress } from "@/lib/duel/progressFigures";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { FramePills } from "@/components/puzzles/pattern/framePills";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { gridCellCentre, useGridMetrics, useGridPointer } from "@/components/puzzles/GridDrag";
import { FLOW_COLOUR_HEX as GLYPH_COLOURS, encodeFlowPaths, flowCutsLines, flowDrawStep, flowTapClears, flowFilledCells, verifyFlow } from "@/lib/duel/flow";
import { useStageState } from "@/lib/duel/stageState";
import {
  FLOW_CELLS,
  FLOW_COLS,
  FLOW_TIME_MS,
  type FlowPair,
  type FlowPuzzleData,
} from "@/lib/duel/types";
import { soundCue } from "@/lib/fx/soundCues";

import { FLOW_CELL_URL, FLOW_WALL_URL, FlowBead, FlowTubes, shadeHex, useFlowJoins } from "@/components/puzzles/pattern/flowArt";
import { useSolveMoment } from "@/lib/fx/patternFx";

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

  const stroke = metrics ? Math.max(3, metrics.cellW * 0.4) : 0;
  // Presentation only: which pairs are joined end to end, for the tube caps,
  // the join pulse and the completion effect.
  const joined = pairs.map((pair, index) => {
    const path = paths[index] ?? [];
    const first = path[0];
    const last = path[path.length - 1];
    return path.length > 1 && ((first === pair.a && last === pair.b) || (first === pair.b && last === pair.a));
  });
  const pulse = useFlowJoins(joined, live, solved);
  const solveFx = useSolveMoment(live && solved, "flow.solve");

  return (
    <div className={`flow-board relative mx-auto aspect-square h-full max-h-full w-full max-w-full select-none ${solveFx ? "flow-board-solved" : ""}`}>
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
                className="flow-wall rounded-[3px]"
                style={{ backgroundImage: `url(${FLOW_WALL_URL})` }}
                aria-label="Wall"
              />
            );
          }
          return (
            <div
              key={cell}
              className="flow-cell flex items-center justify-center rounded-[3px]"
              style={{ backgroundImage: tint ? `linear-gradient(${tint}24, ${tint}24), url(${FLOW_CELL_URL})` : `url(${FLOW_CELL_URL})` }}
            >
              {/* The dot is a child of its own cell, so it is always dead centre,
                  and it sits above the path layer. */}
              {dot && (
                <span
                  className={`flow-dot relative block rounded-full ${joined[pairs.indexOf(dot)] ? "flow-dot-joined" : ""}`}
                  data-flow-colour={dot.colour}
                  style={{
                    width: "64%",
                    height: "64%",
                    zIndex: 2,
                    ["--dot" as string]: GLYPH_COLOURS[dot.colour],
                    ["--dot-rim" as string]: shadeHex(GLYPH_COLOURS[dot.colour], -0.5),
                  }}
                >
                  <FlowBead colour={dot.colour} />
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
            pulse={pulse}
            solved={solveFx}
          />
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
  /** flowRev 3: drawing over another line cuts it back, and a still tap on a dot leaves its line alone. */
  const cuts = flowCutsLines(puzzle);
  const tapClears = flowTapClears(puzzle);
  const verdict = useMemo(() => verifyFlow(pairs, paths, walls), [pairs, paths, walls]);
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
  const nearMiss = !verdict.solved && pairs.length > 1 && (verdict.pairsJoined === pairs.length - 1 || (verdict.pairsJoined === pairs.length && filled < FLOW_CELLS - walls.length));
  const wasNear = useRef(false);
  useEffect(() => {
    if (nearMiss && !wasNear.current && !locked) soundCue("flow.nearMiss");
    wasNear.current = nearMiss;
  }, [nearMiss, locked]);

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
        const step = flowDrawStep(current, active, cell, pairs, walls, from, cuts);
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
      if (grewTo) soundCue("flow.draw", Math.min(1.6, 1 + 0.04 * (grewTo - 2)));
      if (cutLine) soundCue("flow.cut");
    },
    [cuts, dotPair, locked, pairs, paths, setPaths, walls],
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
    <div data-polish="flow" data-stage-column="3" className="flex min-h-0 flex-1 flex-col gap-3">
      {inFrame ? null : (
        <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          cells filled <span className="text-primary">{filled}</span> / {FLOW_CELLS - walls.length} ·{" "}
          {verdict.pairsJoined} / {pairs.length} pairs
        </p>
      )}
      <div data-game-arena="board" className="flex min-h-0 flex-1 items-center justify-center">
        <FlowBoard
          pairs={pairs}
          paths={paths}
          walls={walls}
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
          { id: "filled", label: "Filled", value: `${filled} / ${FLOW_CELLS - walls.length}` },
        ]}
      />
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
    <div className="flow-reveal flex w-full min-h-0 flex-col items-center gap-3">
      <div className="flow-reveal-boards flex min-h-0 w-full flex-1 items-center justify-center gap-3">
        <div className="flow-reveal-board flex flex-col items-center gap-1">
          <FlowBoard pairs={puzzle.pairs} paths={solution} walls={puzzle.walls ?? []} />
          <span className="font-mono text-base uppercase tracking-widest text-muted-foreground">
            solved
          </span>
        </div>
        <div className="flow-reveal-board flex flex-col items-center gap-1">
          <FlowBoard pairs={puzzle.pairs} paths={mine} walls={puzzle.walls ?? []} />
          <span className="font-mono text-base uppercase tracking-widest text-muted-foreground">
            yours
          </span>
        </div>
      </div>
      {/* The player's own count: shown only under Yours (SolutionSwitch), never as if it described the solution. */}
      <p data-yours-only="" className="flow-reveal-line font-mono text-base uppercase tracking-widest text-muted-foreground">
        {myCorrect
          ? `You: solved${elapsed === null ? "" : ` · ${elapsed.toFixed(1)}s`}`
          : `You: ${solutionProgress(puzzle, myAnswer ?? "")?.text ?? `${verdict.pairsJoined}/${puzzle.pairs.length} pairs`}`}
      </p>
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
