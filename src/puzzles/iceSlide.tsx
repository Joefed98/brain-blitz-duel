import { solvedMovesText } from "@/lib/duel/scoring";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowPad, useSwipe } from "@/components/puzzles/GridDrag";
import {
  encodeSlideMoves,
  replaySlide,
  slideBoard,
  slideOutcome,
  slideSearch,
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

const PORTAL_COLOURS = ["#2FD4C4", "#B26BFF"] as const;

/** Thin ice: a cracked tile that breaks after one crossing. */
function Crack() {
  return (
    <svg viewBox="0 0 10 10" aria-label="Thin ice" className="block h-[80%] w-[80%]">
      <polyline
        points="1,2 4,5 3,7 6,9"
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity={0.75}
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
      <path d="M4,5 L7,4 L9,1" fill="none" stroke="var(--foreground)" strokeOpacity={0.75} strokeWidth={0.9} />
    </svg>
  );
}

function Board({
  walls,
  holes = [],
  arrows = [],
  portals = [],
  thin = [],
  broken = 0,
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
  portals?: [number, number][];
  thin?: number[];
  /** Broken thin-ice mask (bit i = thin[i] is now a hole). */
  broken?: number;
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
  const portalColour = new Map<number, string>();
  portals.forEach(([a, b], index) => {
    const colour = index === 0 ? PORTAL_COLOURS[0] : PORTAL_COLOURS[1];
    portalColour.set(a, colour);
    portalColour.set(b, colour);
  });
  const thinBit = new Map(thin.map((cell, bit) => [cell, bit]));

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
          const bit = thinBit.get(cell);
          const brokenHole = bit !== undefined && (broken & (1 << bit)) !== 0;
          const ring = portalColour.get(cell);
          const piece = isBall ? (
            <span
              aria-label="Ball"
              className="block rounded-full"
              style={{ width: "80%", height: "80%", backgroundColor: GOLD }}
            />
          ) : pit.has(cell) || brokenHole ? (
            <span
              aria-label="Hole"
              className="block rounded-full bg-background"
              style={{ width: "72%", height: "72%", border: "2px solid var(--foreground)" }}
            />
          ) : ring ? (
            <span
              aria-label="Portal"
              className="block rounded-full"
              style={{ width: "76%", height: "76%", border: `3px solid ${ring}` }}
            />
          ) : bit !== undefined ? (
            <Crack />
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
        in and you start again. A chevron turns the ball. Portals carry you across the board.
        Cracked ice breaks after you cross it once.
      </p>
      <div style={{ width: 132 }}>
        <Board
          cols={4}
          cells={16}
          walls={[6, 12]}
          holes={[9]}
          arrows={[{ cell: 5, dir: "D" }]}
          portals={[[3, 10]]}
          thin={[14]}
          start={0}
          exit={15}
          ball={0}
          route={[0, 4, 5, 13, 14, 15]}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Fewer moves earns a bonus. You have 90 seconds.
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
  const data = puzzle.type === "iceslide" ? puzzle : null;
  const board = useMemo(
    () => slideBoard(data ?? { walls: [], start: 0, exit: 0 }),
    [data],
  );
  const [moves, setMoves] = useStageState<SlideDir[]>(stateKey, "slideMoves", () => []);
  const submitted = useRef(false);
  const [flash, setFlash] = useState(false);
  const fallsSeen = useRef(0);

  const replay = useMemo(() => replaySlide(board, moves), [board, moves]);

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
    const outcome = slideOutcome(board, replay.cell, replay.mask, dir);
    if (!outcome.path.length) return;
    setMoves((current) => [...current, dir]);
  };

  const swipe = useSwipe(slide, { disabled: locked || replay.solved });

  if (!data) return null;

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
          walls={data.walls}
          holes={data.holes ?? []}
          arrows={data.arrows ?? []}
          portals={data.portals ?? []}
          thin={data.thin ?? []}
          broken={replay.mask}
          start={data.start}
          exit={data.exit}
          ball={replay.cell}
        />
      </div>
        <ArrowPad onPress={slide} disabled={locked || replay.solved} />
      <div className="flex shrink-0 justify-center gap-2">
        <button
          type="button"
          disabled={locked || !moves.length}
          onClick={() => setMoves((current) => [...current, "X"])}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={locked || !moves.length}
          onClick={() => setMoves((current) => [...current, "Y"])}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "iceslide") return null;
  const board = slideBoard(puzzle);
  const best = puzzle.solution
    ? (puzzle.solution.split("") as SlideDir[])
    : (slideSearch(board)?.route ?? []);
  const bestReplay = replaySlide(board, best);
  const route = [puzzle.start, ...bestReplay.paths.flat()];
  const replay = replaySlide(board, (myAnswer ?? "").split("") as SlideDir[]);
  const min = puzzle.minMoves ?? best.length;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div style={{ width: 176 }}>
        <Board
          walls={puzzle.walls}
          holes={puzzle.holes ?? []}
          arrows={puzzle.arrows ?? []}
          portals={puzzle.portals ?? []}
          thin={puzzle.thin ?? []}
          start={puzzle.start}
          exit={puzzle.exit}
          ball={puzzle.start}
          route={route}
        />
      </div>
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        shortest route · {min} move{min === 1 ? "" : "s"}
      </p>
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
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
