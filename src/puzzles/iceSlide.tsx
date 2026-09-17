import { useEffect, useMemo, useRef } from "react";

import { ArrowPad, useSwipe } from "@/components/puzzles/GridDrag";
import { encodeSlideMoves, replaySlide, shortestSlideRoute, slidePath } from "@/lib/duel/slide";
import { useStageState } from "@/lib/duel/stageState";
import {
  SLIDE_CELLS,
  SLIDE_COLS,
  SLIDE_TIME_MS,
  type SlideDir,
  type SlidePuzzleData,
} from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GOLD = "var(--primary)";

function Board({
  walls,
  start,
  exit,
  ball,
  cols = SLIDE_COLS,
  cells = SLIDE_CELLS,
  route,
  dotted,
}: {
  walls: number[];
  start: number;
  exit: number;
  ball: number;
  cols?: number;
  cells?: number;
  /** Cells of a route to draw as a dotted gold line. */
  route?: number[] | undefined;
  dotted?: boolean;
}) {
  const rows = Math.ceil(cells / cols);
  const wall = new Set(walls);

  return (
    <div className="relative mx-auto aspect-square h-full max-h-full w-full max-w-full">
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          gap: 2,
        }}
      >
        {/* The ball is a centred child of the cell it occupies — never drawn from
            pointer or pixel maths — so a slide moves it whole cells at a time. */}
        {Array.from({ length: cols * rows }, (_, cell) => {
          const isBall = cell === ball;
          const piece = isBall ? (
            <span
              aria-label="Ball"
              className="block rounded-full"
              style={{ width: "80%", height: "80%", backgroundColor: GOLD }}
            />
          ) : cell === start ? (
            <span
              className="block rounded-full bg-muted-foreground"
              style={{ width: "28%", height: "28%" }}
            />
          ) : null;

          if (wall.has(cell)) {
            return <div key={cell} className="rounded-md bg-foreground/70" />;
          }
          const className = "flex items-center justify-center " + (cell === exit
            ? "rounded-md border-2 border-primary bg-primary/20"
            : "rounded-[3px] bg-secondary/60");
          return (
            <div key={cell} className={className} aria-label={cell === exit ? "Exit" : undefined}>
              {piece}
            </div>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${cols} ${rows}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {route && route.length > 1 && (
          <polyline
            points={route
              .map((cell) => `${(cell % cols) + 0.5},${Math.floor(cell / cols) + 0.5}`)
              .join(" ")}
            fill="none"
            stroke={GOLD}
            strokeWidth={0.12}
            strokeLinecap="round"
            strokeDasharray={dotted === false ? undefined : "0.25 0.2"}
          />
        )}
      </svg>
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Swipe to slide the ball. It won&apos;t stop until it hits something. Reach the exit in the
        fewest moves.
      </p>
      <div style={{ width: 132 }}>
        <Board
          cols={4}
          cells={16}
          walls={[6, 12]}
          start={0}
          exit={15}
          ball={0}
          route={[0, 4, 5, 13, 14, 15]}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Fewer moves earns a bonus. You have 60 seconds.
      </p>
    </div>
  );
}

function Stage({
  puzzle,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "iceslide",
}: PuzzleStageProps) {
  const walls = puzzle.type === "iceslide" ? puzzle.walls : [];
  const start = puzzle.type === "iceslide" ? puzzle.start : 0;
  const exit = puzzle.type === "iceslide" ? puzzle.exit : 0;
  const [moves, setMoves] = useStageState<SlideDir[]>(stateKey, "slideMoves", () => []);
  const submitted = useRef(false);

  const replay = useMemo(() => replaySlide(walls, start, exit, moves), [walls, start, exit, moves]);

  useEffect(() => {
    onDraftAnswer?.(encodeSlideMoves(moves));
  }, [moves, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !replay.solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodeSlideMoves(moves));
  }, [replay.solved, moves, locked, onSubmit]);

  const slide = (dir: SlideDir) => {
    if (locked || submitted.current || replay.solved) return;
    const blocked = new Set(walls);
    if (!slidePath(replay.cell, dir, blocked, exit).length) return;
    setMoves((current) => [...current, dir]);
  };

  const swipe = useSwipe(slide, { disabled: locked || replay.solved });

  if (puzzle.type !== "iceslide") return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        moves <span className="text-primary">{replay.moves}</span>
      </p>
      <div
        className="flex min-h-0 flex-1 items-center justify-center touch-none"
        style={{ touchAction: "none" }}
        {...swipe}
      >
        <Board walls={walls} start={start} exit={exit} ball={replay.cell} />
      </div>
      <ArrowPad onPress={slide} disabled={locked || replay.solved} />
      <div className="flex shrink-0 justify-center gap-2">
        <button
          type="button"
          disabled={locked || !moves.length}
          onClick={() => setMoves((current) => current.slice(0, -1))}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={locked || !moves.length}
          onClick={() => setMoves([])}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/** Walks a move list into the cells the ball passes through. */
function routeCells(walls: number[], start: number, exit: number, moves: SlideDir[]): number[] {
  const blocked = new Set(walls);
  const cells = [start];
  let cell = start;
  for (const dir of moves) {
    const path = slidePath(cell, dir, blocked, exit);
    if (!path.length) continue;
    cells.push(...path);
    cell = path[path.length - 1]!;
    if (cell === exit) break;
  }
  return cells;
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "iceslide") return null;
  const best = puzzle.solution
    ? (puzzle.solution.split("") as SlideDir[])
    : shortestSlideRoute(puzzle.walls, puzzle.start, puzzle.exit);
  const route = routeCells(puzzle.walls, puzzle.start, puzzle.exit, best);
  const mine = (myAnswer ?? "").split("") as SlideDir[];
  const replay = replaySlide(puzzle.walls, puzzle.start, puzzle.exit, mine);
  const min = puzzle.minMoves ?? best.length;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((SLIDE_TIME_MS - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div style={{ width: 176 }}>
        <Board
          walls={puzzle.walls}
          start={puzzle.start}
          exit={puzzle.exit}
          ball={puzzle.start}
          route={route}
        />
      </div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        shortest route · {min} move{min === 1 ? "" : "s"}
      </p>
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        {myCorrect
          ? `✓ ${replay.moves} move${replay.moves === 1 ? "" : "s"}${elapsed === null ? "" : ` · ${elapsed.toFixed(1)}s`}`
          : "✗ Not solved"}
      </p>
    </div>
  );
}

/** The minimum and the shortest route stay server-side until the reveal. */
export const iceSlidePuzzle: PuzzleDefinition = {
  key: "iceslide",
  name: "Ice Slide",
  category: "pattern",
  timeLimitMs: SLIDE_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "iceslide", walls: [], start: 0, exit: 0 }) satisfies SlidePuzzleData,
  check: () => false,
  revealHeading: "The shortest route",
  IntroExample,
  Stage,
  Reveal,
};
