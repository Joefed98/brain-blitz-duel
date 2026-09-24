import { solvedMovesText } from "@/lib/duel/scoring";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowPad, useSwipe } from "@/components/puzzles/GridDrag";
import {
  arrowMap,
  encodeSlideMoves,
  replaySlide,
  shortestSlideRoute,
  slideOutcome,
} from "@/lib/duel/slide";
import { useStageState } from "@/lib/duel/stageState";
import {
  SLIDE_CELLS,
  SLIDE_COLS,
  SLIDE_TIME_MS,
  type SlideArrow,
  type SlideDir,
  type SlidePuzzleData,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GOLD = "var(--primary)";

/** A one-way cell wears a chevron pointing the way the ball is sent. */
function Chevron({ dir }: { dir: SlideDir }) {
  const turn = dir === "U" ? 270 : dir === "D" ? 90 : dir === "L" ? 180 : 0;
  return (
    <svg
      viewBox="0 0 10 10"
      aria-label={`One way ${dir}`}
      className="block"
      style={{ width: "78%", height: "78%", transform: `rotate(${turn}deg)` }}
    >
      <polyline
        points="3,2 7,5 3,8"
        fill="none"
        stroke="var(--primary)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Board({
  walls,
  holes = [],
  arrows = [],
  start,
  exit,
  ball,
  cols = SLIDE_COLS,
  cells = SLIDE_CELLS,
  route,
  dotted,
}: {
  walls: number[];
  holes?: number[];
  arrows?: SlideArrow[];
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
  const pit = new Set(holes);
  const turns = new Map(arrows.map((arrow) => [arrow.cell, arrow.dir]));

  return (
    <div className="relative mx-auto aspect-square h-full max-h-full w-full max-w-full">
      <div
        className="puzzle-board grid h-full w-full"
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
          const turn = turns.get(cell);
          const piece = isBall ? (
            <span
              aria-label="Ball"
              className="block rounded-full"
              style={{ width: "80%", height: "80%", backgroundColor: GOLD }}
            />
          ) : pit.has(cell) ? (
            <span
              aria-label="Hole"
              className="block rounded-full bg-background"
              style={{ width: "72%", height: "72%", border: "2px solid var(--foreground)" }}
            />
          ) : turn ? (
            <Chevron dir={turn} />
          ) : cell === start ? (
            <span
              className="block rounded-full bg-muted-foreground"
              style={{ width: "28%", height: "28%" }}
            />
          ) : null;

          if (wall.has(cell)) {
            return <div key={cell} className="rounded-md bg-foreground/70" />;
          }
          const className =
            "flex items-center justify-center " +
            (cell === exit
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
        Swipe to slide the ball. It won&apos;t stop until it hits something. Avoid the holes — fall
        in and you start again. A chevron is one-way: it turns the ball as it passes.
      </p>
      <div style={{ width: 132 }}>
        <Board
          cols={4}
          cells={16}
          walls={[6, 12]}
          holes={[9]}
          arrows={[{ cell: 5, dir: "D" }]}
          start={0}
          exit={15}
          ball={0}
          route={[0, 4, 5, 13, 14, 15]}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Fewer moves earns a bonus. You have 75 seconds.
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
  const holes = puzzle.type === "iceslide" ? (puzzle.holes ?? []) : [];
  const arrows = puzzle.type === "iceslide" ? (puzzle.arrows ?? []) : [];
  const start = puzzle.type === "iceslide" ? puzzle.start : 0;
  const exit = puzzle.type === "iceslide" ? puzzle.exit : 0;
  const [moves, setMoves] = useStageState<SlideDir[]>(stateKey, "slideMoves", () => []);
  const submitted = useRef(false);
  const [flash, setFlash] = useState(false);
  const fallsSeen = useRef(0);

  const replay = useMemo(
    () => replaySlide(walls, holes, start, exit, moves, arrows),
    [walls, holes, arrows, start, exit, moves],
  );

  useEffect(() => {
    onDraftAnswer?.(encodeSlideMoves(moves));
  }, [moves, onDraftAnswer]);

  // A fall flashes the board red and buzzes; the move still counts.
  useEffect(() => {
    if (replay.falls <= fallsSeen.current) {
      fallsSeen.current = replay.falls;
      return;
    }
    fallsSeen.current = replay.falls;
    setFlash(true);
    buzz(25);
    playWrong();
    const timer = setTimeout(() => setFlash(false), 320);
    return () => clearTimeout(timer);
  }, [replay.falls]);

  useEffect(() => {
    if (locked || submitted.current || !replay.solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodeSlideMoves(moves));
  }, [replay.solved, moves, locked, onSubmit]);

  const slide = (dir: SlideDir) => {
    if (locked || submitted.current || replay.solved) return;
    const outcome = slideOutcome(
      replay.cell,
      dir,
      new Set(walls),
      new Set(holes),
      exit,
      start,
      arrowMap(arrows),
    );
    if (!outcome.path.length) return;
    setMoves((current) => [...current, dir]);
  };

  const swipe = useSwipe(slide, { disabled: locked || replay.solved });

  if (puzzle.type !== "iceslide") return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        moves <span className="text-primary">{replay.moves}</span>
        {replay.falls > 0 ? ` · ${replay.falls} fall${replay.falls === 1 ? "" : "s"}` : ""}
      </p>
      <div
        className="flex min-h-0 flex-1 items-center justify-center touch-none rounded-lg transition-colors"
        style={{
          touchAction: "none",
          backgroundColor: flash ? "color-mix(in srgb, var(--warn) 35%, transparent)" : undefined,
        }}
        {...swipe}
      >
        <Board
          walls={walls}
          holes={holes}
          arrows={arrows}
          start={start}
          exit={exit}
          ball={replay.cell}
        />
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
function routeCells(
  walls: number[],
  holes: number[],
  start: number,
  exit: number,
  moves: SlideDir[],
  arrows: SlideArrow[],
): number[] {
  const blocked = new Set(walls);
  const pits = new Set(holes);
  const turns = arrowMap(arrows);
  const cells = [start];
  let cell = start;
  for (const dir of moves) {
    const outcome = slideOutcome(cell, dir, blocked, pits, exit, start, turns);
    if (!outcome.path.length) continue;
    cells.push(...outcome.path);
    cell = outcome.cell;
    if (cell === exit) break;
  }
  return cells;
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "iceslide") return null;
  const holes = puzzle.holes ?? [];
  const arrows = puzzle.arrows ?? [];
  const best = puzzle.solution
    ? (puzzle.solution.split("") as SlideDir[])
    : shortestSlideRoute(puzzle.walls, holes, puzzle.start, puzzle.exit, arrows);
  const route = routeCells(puzzle.walls, holes, puzzle.start, puzzle.exit, best, arrows);
  const mine = (myAnswer ?? "").split("") as SlideDir[];
  const replay = replaySlide(puzzle.walls, holes, puzzle.start, puzzle.exit, mine, arrows);
  const min = puzzle.minMoves ?? best.length;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((SLIDE_TIME_MS - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div style={{ width: 176 }}>
        <Board
          walls={puzzle.walls}
          holes={holes}
          arrows={arrows}
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
          ? `✓ ${solvedMovesText(replay.moves, min, myMsRemaining, SLIDE_TIME_MS)}`
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
  generate: () =>
    ({ type: "iceslide", walls: [], holes: [], start: 0, exit: 0 }) satisfies SlidePuzzleData,
  check: () => false,
  revealHeading: "The shortest route",
  IntroExample,
  Stage,
  Reveal,
};
