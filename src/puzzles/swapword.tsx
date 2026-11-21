import { useEffect, useRef, useState } from "react";
import { solutionProgress } from "@/lib/duel/progressFigures";
import { ArrowLeftRight } from "lucide-react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { useStageState } from "@/lib/duel/stageState";
import {
  SWAPWORD_REV_PAR,
  SW_COLS,
  SW_ROWS,
  SW_TILES,
  SW_TILE_CELLS,
  SW_NORMAL_LATTICE,
  decodeSwapwordFor,
  encodeSwapword,
  swGeometry,
  swLatticeOf,
  type SwLattice,
  replaySwapword,
  swapwordMarks,
  type SwMark,
  type SwSwap,
} from "@/lib/duel/swapword";
import { SWAPWORD_TIME_MS, type SwapwordPuzzleData } from "@/lib/duel/types";
import { completeFx, fx } from "@/lib/fx";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { useMoveSync } from "@/components/puzzles/useMoveSync";
import { goldPulse, playFinish, useWordFinish, wordCue, type FinishStep } from "@/components/puzzles/wordFinish";
import { effectCue, flyFrom, wordFx } from "@/components/puzzles/wordFx";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";
import "@/polish-word/word-look.css";
import "@/polish-word/swapword.css";
import { BoardPair, RevealKey, RevealNumbers } from "@/components/puzzles/WordReveal";
import { overhaulReveal } from "@/lib/duel/wordOverhaul";

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

/** The Word overhaul: each look's rendered glaze (gold, teal and grey are the game's clue colours and stay). */
const WA_LOOK: Record<string, string> = { "2": "gold", "1": "teal", "0": "grey", pending: "dim", missed: "red" };

/** The figure-eight board: 6 × 6 cells, 21 of them tiles. */
export function Board({
  letters,
  looks,
  selected,
  lifted,
  boardRef,
  onPointerDown,
  side,
  lattice = SW_NORMAL_LATTICE,
}: {
  letters: string;
  looks: readonly TileLook[];
  selected?: number | null;
  lifted?: number | null;
  boardRef?: React.RefObject<HTMLDivElement | null>;
  onPointerDown?: (event: React.PointerEvent) => void;
  /** Board side: px or a CSS length. */
  side: number | string;
  /** swapwordRev 8 (D1): the stored lattice (today's figure eight when absent). */
  lattice?: SwLattice;
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
        gridTemplateColumns: `repeat(${lattice.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${lattice.rows}, minmax(0, 1fr))`,
        gap: `calc(${size} / 60)`,
        containerType: "size",
        ...(onPointerDown ? NO_SCROLL_STYLE : {}),
      }}
      aria-label={`${gameDisplayName("swapword")} board`}
    >
      {Array.from({ length: lattice.cols * lattice.rows }, (_, cell) => {
        const tile = lattice.cells.indexOf(cell);
        if (tile < 0) return <div key={cell} aria-hidden="true" />;
        const look = looks[tile] ?? 0;
        return (
          <div
            key={cell}
            data-sw-tile={tile}
            data-wa="tile"
            data-wa-tone={WA_LOOK[String(look)]}
            className={`flex items-center justify-center rounded-[22%] border-b-4 font-display font-bold transition-transform ${
              selected === tile ? "-translate-y-0.5 ring-2 ring-foreground" : ""
            } ${lifted === tile ? "opacity-30" : ""}`}
            style={{ ...tileStyle(look), fontSize: `calc(100cqw / ${lattice.cols} * 0.5)` }}
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

/**
 * Fixed example: one word row, one swap (the Word overhaul, 15 Nov 2026: the intro shows a swap turning two tiles gold).
 * N and L slide past each other in the top row (a looping demo, still under reduced motion), and the row below shows
 * the result: both tiles gold, LEMON done.
 */
function IntroExample() {
  const row = (letters: string, looks: TileLook[], swap?: readonly number[]) => (
    <div className="flex shrink-0 gap-1">
      {[...letters].map((ch, i) => (
        <span
          key={i}
          data-wa="tile"
          data-wa-tone={WA_LOOK[String(looks[i] ?? 0)]}
          data-sw-demo-swap={swap?.includes(i) ? (i === swap[0] ? "a" : "b") : undefined}
          className="flex h-8 w-8 items-center justify-center rounded-[22%] font-display text-base font-bold"
          style={tileStyle(looks[i] ?? 0)}
        >
          {ch}
        </span>
      ))}
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-2" data-sw-intro-swap="">
      {row("NEMOL", [1, 2, 2, 2, 1], [0, 4])}
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <ArrowLeftRight className="h-4 w-4 shrink-0" /> Swap N and L: both turn gold
      </p>
      {row("LEMON", [2, 2, 2, 2, 2])}
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">
        Gold is in place; teal belongs elsewhere in its word; grey fits neither.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, checkMoves, stateKey }: PuzzleStageProps) {
  const data: SwapwordPuzzleData | null = puzzle.type === "swapword" ? puzzle : null;
  const lattice = swLatticeOf(data);
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
  const lastCounts = useRef<number[] | null>(null);
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
        // Stage 2: a tile turning gold is a bright plink; two in one swap a combo.
        if (prev) {
          effectCue("swapword.gold");
          if (newlyPlaced >= 2) wordFx("combo", boardRef.current?.querySelector(`[data-sw-tile="${view.marks.findIndex((m, t) => m === 2 && prev[t] !== 2)}"]`), "swapword.combo", { count: newlyPlaced });
        }
        // Batch W: the toolkit's right-move glow on each tile that just turned gold (display only; prev
        // is null only for the starting board's first marks, which are not a move).
        if (prev) {
          const fresh = view.marks.flatMap((m, t) => (m === 2 && prev[t] !== 2 ? [t] : []));
          window.requestAnimationFrame(() => fresh.forEach((t) => rightMoveFlash(boardRef.current?.querySelector(`[data-sw-tile="${t}"]`))));
        }
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

  const counterRef = useRef<HTMLSpanElement | null>(null);
  const maxSwaps = data?.maxSwaps ?? 0;
  const left = Math.max(0, maxSwaps - swaps.length);
  const parOn = (data?.swapwordRev ?? 0) >= SWAPWORD_REV_PAR;
  const withinPar = !!data && swaps.length <= data.minSwaps;

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

  // Stage 2: three swaps left pulses the counter; out of swaps, a closing clunk as the board greys.
  useEffect(() => {
    if (!data || locked || result.solved || swaps.length === 0) return;
    if (left === 3) wordFx("nearMiss", counterRef.current, "swapword.low", { noHaptic: true });
    if (left === 0) wordFx("drop", null, "swapword.out");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  // Solved: a gold wave runs once round the figure-eight (display only).
  useWordFinish(result.solved, () => {
    wordCue("swapword.finish");
    effectCue("swapword.scale");
    const steps: FinishStep[] = (lattice === SW_NORMAL_LATTICE ? FIGURE_EIGHT : lattice.cells.map((cell) => [cell])).flatMap((cells, i) =>
      cells.map((cell) => ({
        el: boardRef.current?.querySelector(`[data-sw-tile="${lattice.cells.indexOf(cell)}"]`),
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
  const looks: TileLook[] = Array.from({ length: swGeometry(lattice).tiles }, (_, t) => marks?.[t] ?? "pending");
  // Each colour's count, once every tile has its mark (between a swap and its reply the last counts stay).
  const counts =
    marks && marks.length === swGeometry(lattice).tiles && marks.every((m) => m !== null)
      ? ([0, 1, 2] as const).map((k) => marks.filter((m) => m === k).length)
      : lastCounts.current;
  lastCounts.current = counts;

  const doSwap = (a: number, b: number) => {
    if (done || a === b) return;
    const next: SwSwap[] = [...swaps, [a, b]];
    setSwaps(next);
    setMarks((m) => (m ? m.map((v, t) => (t === a || t === b ? null : v)) : m));
    setSelected(null);
    fx.onMove();
    sync(encodeSwapword(next));
    // Stage 2: the two tiles pass each other with a wooden clack (each slides in from the other's place).
    const tileEl = (t: number) => boardRef.current?.querySelector(`[data-sw-tile="${t}"]`);
    const ra = tileEl(a)?.getBoundingClientRect();
    const rb = tileEl(b)?.getBoundingClientRect();
    effectCue("swapword.swap");
    requestAnimationFrame(() => {
      flyFrom(tileEl(a), rb);
      flyFrom(tileEl(b), ra);
    });
  };

  const tileAt = (x: number, y: number): number | null => {
    const box = boardRef.current?.getBoundingClientRect();
    if (!box) return null;
    const col = Math.floor(((x - box.left) / box.width) * lattice.cols);
    const row = Math.floor(((y - box.top) / box.height) * lattice.rows);
    if (col < 0 || col >= lattice.cols || row < 0 || row >= lattice.rows) return null;
    const tile = lattice.cells.indexOf(row * lattice.cols + col);
    return tile < 0 ? null : tile;
  };
  const movable = (tile: number | null): tile is number => tile !== null && marks?.[tile] !== 2;

  const onPointerDown = (event: React.PointerEvent) => {
    if (done) return;
    const tile = tileAt(event.clientX, event.clientY);
    if (!movable(tile)) {
      // Stage 2: a locked gold tile gives a small wiggle, never an error.
      if (tile !== null) wordFx("wrong", boardRef.current?.querySelector(`[data-sw-tile="${tile}"]`), "swapword.locked", { noHaptic: true });
      return;
    }
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
  // The Word overhaul: the figure-eight uses more of the screen (up to 460 px; was 400).
  const boardSide = "min(100cqw, 100cqh, 460px)";
  const ghostLook = drag ? looks[drag.tile] ?? 0 : 0;

  return (
    <div ref={root} data-stage-column="2" data-word-polish="swapword" data-sw-out={left === 0 && !result.solved ? "" : undefined} className="flex min-h-0 flex-1 flex-col items-center gap-2 py-1" style={NO_SCROLL_STYLE}>
      <div className="flex h-10 shrink-0 items-center gap-2" aria-live="polite">
        <span
          ref={counterRef}
          className={`flex items-center gap-2 rounded-full border-2 px-4 py-1 font-display text-lg font-bold ${left <= 3 ? "border-destructive text-destructive" : "border-primary text-primary"}`}
          aria-label={`${left} swaps left`}
        >
          <ArrowLeftRight className="h-4 w-4" />
          {left}
          <span className="font-mono text-[10px] font-normal uppercase tracking-widest text-muted-foreground">swaps left</span>
        </span>
        {/* Par swaps (swapwordRev 4): swaps used against the board's fewest; gold while still within par. */}
        {parOn ? (
          <span
            data-par-swaps={withinPar ? "within" : "over"}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-sm font-bold tabular-nums ${withinPar ? "border-primary/70 text-primary" : "border-border text-muted-foreground"}`}
            aria-label={`${swaps.length} swaps used, par ${data?.minSwaps}`}
          >
            <span className="inline-block w-[2ch] text-right">{swaps.length}</span>
            <span className="font-mono text-[10px] font-normal uppercase tracking-widest text-muted-foreground">used · par</span>
            <span className={withinPar ? "" : "line-through"}>{data?.minSwaps}</span>
          </span>
        ) : null}
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
          lattice={lattice}
        />
      </div>
      {/* Batch W: the key doubles as the live summary, each colour's count from the marks the board shows. */}
      <div data-live-summary="swapword" className="flex h-8 w-full shrink-0 items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1"><span className="bw-lift h-3 w-3 rounded-sm" style={{ background: SW_GOLD }} /><b className="inline-block w-[2ch] text-right text-[13px] tabular-nums text-foreground">{counts ? counts[2] : "\u00a0"}</b>in place</span>
        <span className="flex items-center gap-1"><span className="bw-lift h-3 w-3 rounded-sm" style={{ background: SW_TEAL }} /><b className="inline-block w-[2ch] text-right text-[13px] tabular-nums text-foreground">{counts ? counts[1] : "\u00a0"}</b>elsewhere</span>
        <span className="flex items-center gap-1"><span className="bw-lift h-3 w-3 rounded-sm" style={{ background: "var(--puzzle-given)" }} /><b className="inline-block w-[2ch] text-right text-[13px] tabular-nums text-foreground">{counts ? counts[0] : "\u00a0"}</b>neither</span>
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

/**
 * The Word overhaul's reveal (swapwordRev 7+): the solved figure-eight and your final board, one at a time and large
 * (the shared Solution / Yours switch), your board in the clue colours (gold in place, teal in its word, grey neither),
 * and the numbers the score is made of: tiles in place, swaps used and the fewest that solve it.
 */
function RevealOverhaul({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "swapword") return null;
  const solution = puzzle.solution ?? "";
  const lattice = swLatticeOf(puzzle);
  const run = replaySwapword(puzzle.start, decodeSwapwordFor(puzzle, myAnswer ?? ""), puzzle.maxSwaps, solution);
  const marks = swapwordMarks(run.board, solution, lattice);
  const inPlace = marks.filter((m) => m === 2).length;
  const side = "min(84vw, 340px)";
  return (
    <div data-word-reveal="swapword" data-wr-version="overhaul" className="wr">
      <RevealNumbers
        countAfterMs={200}
        items={[
          { id: "in-place", label: "Tiles in place", value: `${inPlace}/${swGeometry(lattice).tiles}`, tone: run.solved ? "gold" : undefined },
          { id: "swaps", label: run.swaps === 1 ? "Swap used" : "Swaps used", value: run.swaps },
          { id: "fewest", label: "Fewest possible", value: puzzle.minSwaps },
        ]}
      />
      <BoardPair
        solution={<Board letters={solution} looks={marks.map(() => 2)} side={side} lattice={lattice} />}
        yours={<Board letters={run.board} looks={marks} side={side} lattice={lattice} />}
      />
      <RevealKey items={[{ tone: "gold", label: "In place" }, { tone: "teal", label: "In its word" }, { tone: "grey", label: "Neither" }]} />
    </div>
  );
}

function Reveal(props: PuzzleRevealProps) {
  if (overhaulReveal(props.puzzle)) return <RevealOverhaul {...props} />;
  return <RevealOlder {...props} />;
}

function RevealOlder({ puzzle, myAnswer, myMsRemaining, timeLimitMs }: PuzzleRevealProps) {
  if (puzzle.type !== "swapword") return null;
  const solution = puzzle.solution ?? "";
  const run = replaySwapword(puzzle.start, decodeSwapwordFor(puzzle, myAnswer ?? ""), puzzle.maxSwaps, solution);
  const marks = swapwordMarks(run.board, solution, swLatticeOf(puzzle));
  const looks: TileLook[] = marks.map((m) => (m === 2 ? 2 : "missed"));
  const inPlace = marks.filter((m) => m === 2).length;
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  return (
    <div data-word-reveal="swapword" className="flex w-full flex-col items-center gap-2">
      <Board letters={solution} looks={looks} side={252} lattice={swLatticeOf(puzzle)} />
      <p className="font-mono text-base text-primary">
        {run.solved
          ? `${run.swaps} ${run.swaps === 1 ? "swap" : "swaps"} (fewest ${puzzle.minSwaps})`
          : `${solutionProgress(puzzle, myAnswer ?? "")?.text ?? `${inPlace} of ${swGeometry(swLatticeOf(puzzle)).tiles} in place`} · ${run.swaps} ${run.swaps === 1 ? "swap" : "swaps"}`}
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
    return replaySwapword(puzzle.start, decodeSwapwordFor(puzzle, answer), puzzle.maxSwaps, puzzle.solution).solved;
  },
  revealHeading: "The six words",
  IntroExample,
  Stage,
  Reveal,
};
