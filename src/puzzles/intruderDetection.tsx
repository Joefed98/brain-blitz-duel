import { useEffect, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { hapticTick, useGridPointer } from "@/components/puzzles/GridDrag";
import { decodeIntruderTaps, encodeIntruderTaps } from "@/lib/duel/intruder";
import { useStageState } from "@/lib/duel/stageState";
import {
  INTRUDER_ATTEMPTS,
  INTRUDER_BOARDS,
  INTRUDER_HIDE_MS,
  INTRUDER_SHOW_MS,
  INTRUDER_TIME_MS,
  type IntruderBoard,
  type IntruderCell,
  type IntruderPuzzleData,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function CellGlyph({ cell, size }: { cell: IntruderCell; size: number }) {
  const fill = GLYPH_COLOURS[cell.colour];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g transform={`rotate(${cell.rot} 12 12)`}>
        {cell.shape === "circle" && <circle cx="12" cy="12" r="9.5" fill={fill} />}
        {cell.shape === "square" && (
          <rect x="2.5" y="2.5" width="19" height="19" rx="2" fill={fill} />
        )}
        {cell.shape === "triangle" && <polygon points="12,2.5 22,21 2,21" fill={fill} />}
      </g>
    </svg>
  );
}

/** One grid. `cells` is null while the grid is hidden. */
function Grid({
  size,
  cells,
  marked,
  wrong,
  onCell,
  compact = false,
}: {
  size: number;
  cells: IntruderCell[] | null;
  /** Circled in gold — the reveal. */
  marked?: number | null;
  wrong?: number | null;
  onCell?: ((cell: number) => void) | undefined;
  compact?: boolean;
}) {
  // Taps go through the shared pointer-to-cell mapping, so a finger always
  // lands on the square underneath it.
  const { ref, handlers } = useGridPointer({ cols: size, rows: size, onCell });
  const { style, ...pointer } = handlers;
  return (
    <div
      ref={ref}
      {...(onCell ? pointer : {})}
      className={`grid aspect-square max-h-full w-full ${compact ? "gap-px" : "gap-[3px]"}`}
      style={{
        ...style,
        ...(compact
          ? { gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }
          : {
              minWidth: size * 56 + (size - 1) * 3,
              minHeight: size * 56 + (size - 1) * 3,
              gridTemplateColumns: `repeat(${size}, minmax(56px, 1fr))`,
            }),
      }}
    >
      {Array.from({ length: size * size }, (_, index) => {
        const cell = cells?.[index];
        return (
          <div
            key={index}
            className={`flex items-center justify-center rounded-md border-2 bg-card ${
              marked === index
                ? "border-primary"
                : wrong === index
                  ? "animate-shake border-warn"
                  : "border-transparent"
            }`}
          >
            {cell ? (
              <CellGlyph
                cell={cell}
                size={compact ? Math.max(13, 38 / size) : Math.round(280 / size) * 0.7}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const EXAMPLE_BEFORE: IntruderCell[] = [
  { shape: "circle", colour: "RED", rot: 0 },
  { shape: "square", colour: "BLUE", rot: 0 },
  { shape: "triangle", colour: "GREEN", rot: 0 },
  { shape: "triangle", colour: "YELLOW", rot: 0 },
  { shape: "circle", colour: "RED", rot: 0 },
  { shape: "square", colour: "YELLOW", rot: 0 },
  { shape: "circle", colour: "BLUE", rot: 0 },
  { shape: "triangle", colour: "GREEN", rot: 0 },
  { shape: "circle", colour: "BLUE", rot: 0 },
];

const EXAMPLE_AFTER = EXAMPLE_BEFORE.map((cell, index) =>
  index === 5 ? { ...cell, shape: "triangle" as const } : cell,
);

/** Fixed intro example — never randomised. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3">
        <div style={{ width: 92 }}>
          <Grid size={3} cells={EXAMPLE_BEFORE} compact />
        </div>
        <span className="font-mono text-xs text-muted-foreground">→</span>
        <div style={{ width: 92 }}>
          <Grid size={3} cells={EXAMPLE_AFTER} marked={5} compact />
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        One cell is different the second time — tap it.
      </p>
    </div>
  );
}

/** Which cell differs between the two grids — the player can see both. */
function changedCell(board: IntruderBoard): number {
  for (let index = 0; index < board.cells.length; index++) {
    const before = board.cells[index]!;
    const after = board.after[index]!;
    if (
      before.shape !== after.shape ||
      before.colour !== after.colour ||
      before.rot !== after.rot
    ) {
      return index;
    }
  }
  return -1;
}

type Phase = "show" | "hide" | "play";

function Stage({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "intruder",
}: PuzzleStageProps) {
  const data: IntruderPuzzleData | null = puzzle.type === "intruder" ? puzzle : null;
  const [index, setIndex] = useStageState<number>(stateKey, "intruderIndex", () => 0);
  const [phase, setPhase] = useStageState<Phase>(stateKey, "intruderPhase", () => "show");
  const [taps, setTaps] = useStageState<number[][]>(stateKey, "intruderTaps", () =>
    Array.from({ length: INTRUDER_BOARDS }, () => [] as number[]),
  );
  const [wrong, setWrong] = useStageState<number | null>(stateKey, "intruderWrong", () => null);
  const submitted = useRef(false);

  const board = data?.boards[index];
  const answer = board ? changedCell(board) : -1;

  useEffect(() => {
    onDraftAnswer?.(encodeIntruderTaps(taps));
  }, [taps, onDraftAnswer]);

  // Memorise, then a blank grid, then the changed grid to tap.
  useEffect(() => {
    if (phase === "play") return;
    const wait = phase === "show" ? INTRUDER_SHOW_MS : INTRUDER_HIDE_MS;
    const timer = setTimeout(() => setPhase(phase === "show" ? "hide" : "play"), wait);
    return () => clearTimeout(timer);
  }, [phase, index, setPhase]);

  // Whatever has been tapped goes up as the clock runs out.
  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + INTRUDER_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encodeIntruderTaps(taps));
  }, [now, phaseStartedAt, locked, data, taps, onSubmit]);

  if (!data || !board) return null;

  const advance = (next: number[][]) => {
    if (index >= INTRUDER_BOARDS - 1) {
      submitted.current = true;
      onSubmit(encodeIntruderTaps(next));
      return;
    }
    setIndex(index + 1);
    setPhase("show");
  };

  const tap = (cell: number) => {
    if (locked || submitted.current || phase !== "play") return;
    const mine = taps[index] ?? [];
    if (mine.length >= INTRUDER_ATTEMPTS) return;
    const next = taps.map((board_, i) => (i === index ? [...board_, cell] : board_));
    setTaps(next);
    if (cell === answer) {
      hapticTick();
      playCorrect();
      advance(next);
      return;
    }
    buzz(20);
    playWrong();
    setWrong(cell);
    setTimeout(() => setWrong(null), 300);
    if (mine.length + 1 >= INTRUDER_ATTEMPTS) advance(next);
  };

  const showing = phase === "show";
  const drain = showing ? 1 : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex w-full shrink-0 gap-1.5" aria-label={`Grid ${index + 1} of 3`}>
        {Array.from({ length: INTRUDER_BOARDS }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>

      <div className="h-1 w-full shrink-0 overflow-hidden rounded-full bg-border">
        <span
          className="block h-full bg-primary"
          style={{
            width: `${drain * 100}%`,
            transition: showing ? `width ${INTRUDER_SHOW_MS}ms linear` : "none",
          }}
        />
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Grid
          size={board.size}
          cells={showing ? board.cells : phase === "hide" ? null : board.after}
          wrong={wrong}
          onCell={phase === "play" ? tap : undefined}
        />
      </div>

      <p className="shrink-0 text-center text-[11px] text-muted-foreground">
        {showing ? "Memorise the grid" : phase === "hide" ? "…" : "Tap the cell that changed"}
      </p>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "intruder") return null;
  const taps = decodeIntruderTaps(myAnswer ?? "");
  const answers = puzzle.boards.map((board) => changedCell(board));
  const correct = answers.filter((cell, index) => (taps[index] ?? []).includes(cell)).length;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((INTRUDER_TIME_MS - myMsRemaining) / 100) / 10;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <div className="grid w-full max-w-[360px] shrink-0 grid-cols-3 items-start gap-1.5">
        {puzzle.boards.map((board, index) => {
          const ok = (taps[index] ?? []).includes(answers[index]!);
          return (
            <div key={index} className="flex min-w-0 flex-col items-center gap-1">
              <Grid size={board.size} cells={board.after} marked={answers[index]!} compact />
              <span
                className={`font-display text-lg font-bold ${ok ? "text-primary" : "text-warn"}`}
              >
                {ok ? "✓" : "✗"}
              </span>
            </div>
          );
        })}
      </div>
      <p
        className={`shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
      >
        {correct} / {INTRUDER_BOARDS}
        {elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}
      </p>
    </div>
  );
}

/** All three grids, the changed cells and the change kinds come from the server. */
export const intruderDetectionPuzzle: PuzzleDefinition = {
  key: "intruder",
  name: "Intruder Detection",
  category: "attention",
  timeLimitMs: INTRUDER_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "intruder", boards: [] }) satisfies IntruderPuzzleData,
  check: () => false,
  revealHeading: "The three grids",
  IntroExample,
  Stage,
  Reveal,
};
