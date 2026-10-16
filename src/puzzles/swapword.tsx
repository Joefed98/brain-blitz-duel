import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight } from "lucide-react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { useStageState } from "@/lib/duel/stageState";
import {
  SW_COLS,
  SW_ROWS,
  SW_TILES,
  SW_TILE_CELLS,
  decodeSwapword,
  encodeSwapword,
  replaySwapword,
  swapwordMarks,
  type SwMark,
  type SwSwap,
} from "@/lib/duel/swapword";
import { SWAPWORD_TIME_MS, type SwapwordPuzzleData } from "@/lib/duel/types";
import { completeFx, fx } from "@/lib/fx";
import { buzz } from "@/lib/motion";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { useMoveSync } from "@/components/puzzles/useMoveSync";
import { goldPulse, playFinish, useWordFinish, wordCue, type FinishStep } from "@/components/puzzles/wordFinish";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/**
 * Swapword's own palette: gold = in place, teal = needed elsewhere in a word
 * through the tile, slate = neither. Pending = waiting for the server's marks.
 */
const SW_GOLD = "var(--primary)";
const SW_TEAL = "#2ED3B7";
type TileLook = SwMark | "pending" | "missed";

function tileStyle(look: TileLook): React.CSSProperties {
  switch (look) {
    case 2:
      return { background: SW_GOLD, color: "var(--primary-foreground)", borderColor: "color-mix(in oklab, var(--primary) 70%, black)" };
    case 1:
      return { background: SW_TEAL, color: "#06231E", borderColor: "color-mix(in oklab, #2ED3B7 65%, black)" };
    case "missed":
      return { background: "var(--card)", color: "var(--muted-foreground)", borderColor: "var(--destructive)" };
    case "pending":
      return { background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)", opacity: 0.8 };
    default:
      return { background: "var(--puzzle-given)", color: "var(--foreground)", borderColor: "var(--puzzle-edge)" };
  }
}

/** The figure-eight board: 6 × 6 cells, 21 of them tiles. */
function Board({
  letters,
  looks,
  selected,
  lifted,
  boardRef,
  onPointerDown,
  side,
}: {
  letters: string;
  looks: readonly TileLook[];
  selected?: number | null;
  lifted?: number | null;
  boardRef?: React.RefObject<HTMLDivElement | null>;
  onPointerDown?: (event: React.PointerEvent) => void;
  /** Board side: px or a CSS length. */
  side: number | string;
}) {
  const size = typeof side === "number" ? `${side}px` : side;
  return (
    <div
      ref={boardRef}
      onPointerDown={onPointerDown}
      className="grid shrink-0"
      style={{
        width: size,
        height: size,
        gridTemplateColumns: `repeat(${SW_COLS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${SW_ROWS}, minmax(0, 1fr))`,
        gap: `calc(${size} / 60)`,
        containerType: "size",
        ...(onPointerDown ? NO_SCROLL_STYLE : {}),
      }}
      aria-label={`${gameDisplayName("swapword")} board`}
    >
      {Array.from({ length: SW_COLS * SW_ROWS }, (_, cell) => {
        const tile = SW_TILE_CELLS.indexOf(cell);
        if (tile < 0) return <div key={cell} aria-hidden="true" />;
        const look = looks[tile] ?? 0;
        return (
          <div
            key={cell}
            data-sw-tile={tile}
            className={`flex items-center justify-center rounded-[22%] border-b-4 font-display font-bold transition-transform ${
              selected === tile ? "-translate-y-0.5 ring-2 ring-foreground" : ""
            } ${lifted === tile ? "opacity-30" : ""}`}
            style={{ ...tileStyle(look), fontSize: `calc(100cqw / ${SW_COLS} * 0.5)` }}
          >
            {letters[tile]}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The figure-eight as one loop of cells (row × 6 + col), crossing at cell 21;
 * the two spurs (17, 32) join the wave beside their neighbours.
 */
const FIGURE_EIGHT: readonly (readonly number[])[] = [
  [18], [19], [20], [21], [22], [23, 17], [29], [35], [34], [33, 32], [27], [15], [9], [3], [2], [1], [0], [6], [12],
];

/** Fixed example: one word row, two tiles to swap. */
function IntroExample() {
  const row = (letters: string, looks: TileLook[]) => (
    <div className="flex shrink-0 gap-1">
      {[...letters].map((ch, i) => (
        <span key={i} className="flex h-8 w-8 items-center justify-center rounded-[22%] border-b-4 font-display text-base font-bold" style={tileStyle(looks[i] ?? 0)}>
          {ch}
        </span>
      ))}
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-2">
      {row("NEMOL", [1, 2, 2, 2, 1])}
      <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      {row("LEMON", [2, 2, 2, 2, 2])}
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">
        Gold is in place; teal belongs elsewhere in its word. Swap N and L to finish LEMON.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, checkMoves, stateKey }: PuzzleStageProps) {
  const data: SwapwordPuzzleData | null = puzzle.type === "swapword" ? puzzle : null;
  const key = stateKey ?? "swapword";
  const [swaps, setSwaps] = useStageState<SwSwap[]>(key, "swSwaps", () => []);
  const [marks, setMarks] = useStageState<(SwMark | null)[] | null>(key, "swMarks", () => null);
  const [result, setResult] = useStageState<{ solved: boolean; over: boolean }>(key, "swResult", () => ({ solved: false, over: false }));
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ tile: number; x: number; y: number } | null>(null);
  const submitted = useRef(false);
  const root = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const press = useRef<{ tile: number; x: number; y: number; moved: boolean } | null>(null);
  useNoTouchScroll(root);

  const encoded = encodeSwapword(swaps);
  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  const latestSwaps = useRef(swaps);
  latestSwaps.current = swaps;
  const sync = useMoveSync(checkMoves, "swapword", (view, sentMoves) => {
    if (sentMoves !== encodeSwapword(latestSwaps.current)) return;
    setMarks((prev) => {
      const newlyPlaced = view.marks.filter((m, t) => m === 2 && prev?.[t] !== 2).length;
      if (newlyPlaced > 0 && !view.solved) {
        fx.onPlace();
        buzz(10);
      }
      return view.marks;
    });
    if (view.solved || view.over) setResult({ solved: view.solved, over: view.over });
  });

  // First marks for the starting board (and again after a remount).
  useEffect(() => {
    if (!marks || marks.some((m) => m === null)) sync(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxSwaps = data?.maxSwaps ?? 0;
  const left = Math.max(0, maxSwaps - swaps.length);

  useEffect(() => {
    if (submitted.current || locked) return;
    if (result.solved || result.over) {
      submitted.current = true;
      if (result.solved) completeFx("swapword.finish");
      onSubmit(encoded);
      return;
    }
    // Out of swaps: wait briefly for the last marks, then lock in.
    if (data && left === 0) {
      const timer = window.setTimeout(() => {
        if (submitted.current) return;
        submitted.current = true;
        onSubmit(encodeSwapword(latestSwaps.current));
      }, 2000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, locked, left]);

  // Solved: a gold wave runs once round the figure-eight (display only).
  useWordFinish(result.solved, () => {
    wordCue("swapword.finish");
    const steps: FinishStep[] = FIGURE_EIGHT.flatMap((cells, i) =>
      cells.map((cell) => ({
        el: boardRef.current?.querySelector(`[data-sw-tile="${SW_TILE_CELLS.indexOf(cell)}"]`),
        keyframes: goldPulse(1.12),
        delay: i * 48,
        duration: 300,
      })),
    );
    return playFinish(steps);
  });

  if (!data) return null;
  const board = replaySwapword(data.start, swaps, data.maxSwaps).board;
  const done = locked || submitted.current || result.solved || result.over || left === 0;
  const looks: TileLook[] = Array.from({ length: SW_TILES }, (_, t) => marks?.[t] ?? "pending");

  const doSwap = (a: number, b: number) => {
    if (done || a === b) return;
    const next: SwSwap[] = [...swaps, [a, b]];
    setSwaps(next);
    setMarks((m) => (m ? m.map((v, t) => (t === a || t === b ? null : v)) : m));
    setSelected(null);
    fx.onMove();
    buzz(6);
    sync(encodeSwapword(next));
  };

  const tileAt = (x: number, y: number): number | null => {
    const box = boardRef.current?.getBoundingClientRect();
    if (!box) return null;
    const col = Math.floor(((x - box.left) / box.width) * SW_COLS);
    const row = Math.floor(((y - box.top) / box.height) * SW_ROWS);
    if (col < 0 || col >= SW_COLS || row < 0 || row >= SW_ROWS) return null;
    const tile = SW_TILE_CELLS.indexOf(row * SW_COLS + col);
    return tile < 0 ? null : tile;
  };
  const movable = (tile: number | null): tile is number => tile !== null && marks?.[tile] !== 2;

  const onPointerDown = (event: React.PointerEvent) => {
    if (done) return;
    const tile = tileAt(event.clientX, event.clientY);
    if (!movable(tile)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { tile, x: event.clientX, y: event.clientY, moved: false };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const p = press.current;
    if (!p) return;
    if (!p.moved && Math.hypot(event.clientX - p.x, event.clientY - p.y) < 8) return;
    p.moved = true;
    setDrag({ tile: p.tile, x: event.clientX, y: event.clientY });
  };
  const onPointerUp = (event: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    setDrag(null);
    if (!p || done) return;
    if (p.moved) {
      const target = tileAt(event.clientX, event.clientY);
      if (movable(target) && target !== p.tile) doSwap(p.tile, target);
      return;
    }
    if (selected === null) setSelected(p.tile);
    else if (selected === p.tile) setSelected(null);
    else doSwap(selected, p.tile);
  };

  // As large as the arena allows (to 400px on big phones).
  const boardSide = "min(100cqw, 100cqh, 400px)";
  const ghostLook = drag ? looks[drag.tile] ?? 0 : 0;

  return (
    <div ref={root} data-stage-column="2" data-word-polish="swapword" className="flex min-h-0 flex-1 flex-col items-center gap-2 py-1" style={NO_SCROLL_STYLE}>
      <div className="flex h-10 shrink-0 items-center gap-2" aria-live="polite">
        <span
          className={`flex items-center gap-2 rounded-full border-2 px-4 py-1 font-display text-lg font-bold ${left <= 3 ? "border-destructive text-destructive" : "border-primary text-primary"}`}
          aria-label={`${left} swaps left`}
        >
          <ArrowLeftRight className="h-4 w-4" />
          {left}
          <span className="font-mono text-[10px] font-normal uppercase tracking-widest text-muted-foreground">swaps left</span>
        </span>
      </div>
      <div
        data-game-arena="swapword"
        className="flex min-h-0 w-full flex-1 items-center justify-center"
        style={{ containerType: "size" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          press.current = null;
          setDrag(null);
        }}
      >
        <Board
          letters={board}
          looks={looks}
          selected={selected}
          lifted={drag?.tile ?? null}
          boardRef={boardRef}
          onPointerDown={onPointerDown}
          side={boardSide}
        />
      </div>
      <div className="flex h-8 w-full shrink-0 items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: SW_GOLD }} />in place</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: SW_TEAL }} />elsewhere</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: "var(--puzzle-given)" }} />neither</span>
      </div>
      {drag ? (
        <div
          className="pointer-events-none fixed z-40 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[22%] border-b-4 font-display text-2xl font-bold shadow-lg"
          style={{ left: drag.x, top: drag.y, ...tileStyle(ghostLook) }}
          aria-hidden="true"
        >
          {board[drag.tile]}
        </div>
      ) : null}
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myMsRemaining, timeLimitMs }: PuzzleRevealProps) {
  if (puzzle.type !== "swapword") return null;
  const solution = puzzle.solution ?? "";
  const run = replaySwapword(puzzle.start, decodeSwapword(myAnswer ?? ""), puzzle.maxSwaps, solution);
  const marks = swapwordMarks(run.board, solution);
  const looks: TileLook[] = marks.map((m) => (m === 2 ? 2 : "missed"));
  const inPlace = marks.filter((m) => m === 2).length;
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  return (
    <div data-word-reveal="swapword" className="flex w-full flex-col items-center gap-2">
      <Board letters={solution} looks={looks} side={252} />
      <p className="font-mono text-base text-primary">
        {run.solved
          ? `Solved · ${run.swaps} swaps (min ${puzzle.minSwaps}) · ${(elapsed / 1000).toFixed(1)}s`
          : `${inPlace} / ${SW_TILES} in place · ${run.swaps} swaps`}
      </p>
      {!run.solved ? <p className="text-sm text-muted-foreground">Red-edged tiles were not in place on your board.</p> : null}
    </div>
  );
}

export const swapwordPuzzle: PuzzleDefinition = {
  key: "swapword",
  name: gameDisplayName("swapword"),
  category: "word",
  timeLimitMs: SWAPWORD_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "swapword", swapwordRev: 1, start: "A".repeat(SW_TILES), minSwaps: 9, maxSwaps: 14 }) satisfies SwapwordPuzzleData,
  check: (answer, puzzle) => {
    if (puzzle.type !== "swapword") return false;
    return replaySwapword(puzzle.start, decodeSwapword(answer), puzzle.maxSwaps, puzzle.solution).solved;
  },
  revealHeading: "The six words",
  IntroExample,
  Stage,
  Reveal,
};
