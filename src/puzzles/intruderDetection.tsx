import { useEffect, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { hapticTick, useGridPointer } from "@/components/puzzles/GridDrag";
import { decodeIntruderTaps, encodeIntruderTaps } from "@/lib/duel/intruder";
import { useStageState } from "@/lib/duel/stageState";
import {
  INTRUDER_CHANGE_COUNTS,
  INTRUDER_BOARDS,
  INTRUDER_BOARD_MS,
  INTRUDER_CARD_MS,
  INTRUDER_HOLD_MS,
  INTRUDER_HIDE_MS,
  INTRUDER_PLAY_MS,
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
        {cell.shape === "star" && (
          <polygon
            points="12,2 14.9,8.9 22.4,9.5 16.7,14.4 18.5,21.7 12,17.8 5.5,21.7 7.3,14.4 1.6,9.5 9.1,8.9"
            fill={fill}
          />
        )}
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
  picked = [],
}: {
  size: number;
  cells: IntruderCell[] | null;
  /** Circled in gold — the reveal. */
  marked?: number | number[] | null;
  wrong?: number | null;
  onCell?: ((cell: number) => void) | undefined;
  compact?: boolean;
  /** Player picks — lit with a yellow border. */
  picked?: number[];
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
             className={`relative flex items-center justify-center rounded-md border-2 bg-card ${picked.includes(index) ? "border-primary" : "border-transparent"} ${wrong === index ? "animate-shake" : ""}`}
          >
            {cell ? (
              <CellGlyph
                cell={cell}
                size={compact ? Math.max(13, 38 / size) : Math.round(280 / size) * 0.7}
              />
            ) : null}
             {(Array.isArray(marked) ? marked.includes(index) : marked === index) && <span className="pointer-events-none absolute inset-[4%] rounded-full border-2 border-primary" aria-label="Changed cell" />}
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

/** Which cells hold a changed symbol in the second view. */
function changedCells(board: IntruderBoard): number[] {
  const changed: number[] = [];
  for (let index = 0; index < board.after.length; index++) {
    const before = board.perm ? board.cells[board.perm[index]!]! : board.cells[index]!;
    const after = board.after[index]!;
    if (before.shape !== after.shape || before.colour !== after.colour || before.rot !== after.rot) {
      changed.push(index);
    }
  }
  return changed;
}

type Phase = "card" | "show" | "hide" | "play" | "hold";

/** Fixed per-board timeline, read straight from the round clock. */
function timeline(elapsed: number): { index: number; phase: Phase; phaseStart: number } {
  const t = Math.max(0, elapsed);
  const index = Math.min(INTRUDER_BOARDS - 1, Math.floor(t / INTRUDER_BOARD_MS));
  const base = index * INTRUDER_BOARD_MS;
  const local = t - base;
  const marks: [Phase, number][] = [
    ["card", INTRUDER_CARD_MS],
    ["show", INTRUDER_SHOW_MS],
    ["hide", INTRUDER_HIDE_MS],
    ["play", INTRUDER_PLAY_MS],
    ["hold", INTRUDER_HOLD_MS],
  ];
  let start = 0;
  for (const [phase, ms] of marks) {
    if (local < start + ms) return { index, phase, phaseStart: base + start };
    start += ms;
  }
  return { index, phase: "hold", phaseStart: base + start - INTRUDER_HOLD_MS };
}

/** A draining bar, positioned from the shared round clock. */
function DrainBar({ ms, left, className }: { ms: number; left: number; className: string }) {
  const share = Math.max(0, Math.min(1, left / ms));
  return (
    <div className="flex h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-border">
      <span className={`block h-full ${className}`} style={{ width: `${share * 100}%` }} />
    </div>
  );
}

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
  const [taps, setTaps] = useStageState<number[][]>(stateKey, "intruderTaps", () =>
    Array.from({ length: INTRUDER_BOARDS }, () => [] as number[]),
  );
  const [wrong, setWrong] = useStageState<number | null>(stateKey, "intruderWrong", () => null);
  // A ref mirror so two quick picks never read a stale list.
  const tapsRef = useRef(taps);
  tapsRef.current = taps;
  const submitted = useRef(false);

  const elapsed = now - phaseStartedAt;
  const { index, phase, phaseStart } = timeline(elapsed);
  const board = data?.boards[index];
  const answers = board ? changedCells(board) : [];

  useEffect(() => {
    onDraftAnswer?.(encodeIntruderTaps(taps));
  }, [taps, onDraftAnswer]);

  // The last pick window closing locks the answer in.
  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (elapsed < INTRUDER_TIME_MS - INTRUDER_HOLD_MS && elapsed < INTRUDER_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encodeIntruderTaps(tapsRef.current));
  }, [elapsed, locked, data, onSubmit]);

  if (!data || !board) return null;

  const needed = INTRUDER_CHANGE_COUNTS[index]!;
  const mine = taps[index] ?? [];

  const tap = (cell: number) => {
    if (locked || submitted.current || phase !== "play") return;
    const current = tapsRef.current;
    const own = current[index] ?? [];
    if (own.length >= needed || own.includes(cell)) return;
    const next = current.map((list, i) => (i === index ? [...list, cell] : list));
    tapsRef.current = next;
    setTaps(next);
    if (answers.includes(cell)) {
      hapticTick();
      playCorrect();
      return;
    }
    buzz(20);
    playWrong();
    setWrong(cell);
    setTimeout(() => setWrong(null), 300);
  };

  if (phase === "card") {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-background">
        <p className="whitespace-nowrap font-display text-6xl font-bold text-primary">Round {index + 1}</p>
      </div>
    );
  }

  const left = phaseStart + (phase === "show" ? INTRUDER_SHOW_MS : INTRUDER_PLAY_MS) - Math.max(0, elapsed);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex w-full shrink-0 gap-1.5" aria-label={`Grid ${index + 1} of 5`}>
        {Array.from({ length: INTRUDER_BOARDS }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>

      {phase === "show" ? (
        <DrainBar ms={INTRUDER_SHOW_MS} left={left} className="bg-primary" />
      ) : phase === "play" ? (
        <DrainBar ms={INTRUDER_PLAY_MS} left={left} className="bg-warn" />
      ) : (
        <div className="h-1.5 w-full shrink-0 rounded-full bg-border" />
      )}

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Grid
          size={board.size}
          cells={phase === "show" ? board.cells : phase === "hide" ? null : board.after}
          picked={phase === "play" || phase === "hold" ? mine : []}
          wrong={wrong}
          onCell={phase === "play" ? tap : undefined}
        />
      </div>

      <p className="shrink-0 text-center text-[11px] text-muted-foreground">
        {phase === "show"
          ? "Memorise the grid"
          : phase === "hide"
            ? "…"
            : phase === "play"
              ? `${needed} change${needed === 1 ? "" : "s"} — tap ${needed === 1 ? "it" : "each"} (${mine.length}/${needed})`
              : "Picks locked"}
      </p>
    </div>
  );
}


function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "intruder") return null;
  const taps = decodeIntruderTaps(myAnswer ?? "");
  const answers = puzzle.boards.map((board) => changedCells(board));
  const correct = answers.filter((cells, index) => cells.every((cell) => (taps[index] ?? []).includes(cell))).length;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
       <div className="flex w-full max-w-[480px] shrink-0 flex-col items-center gap-3">
        {puzzle.boards.map((board, index) => {
           const boardTaps = taps[index] ?? [];
           const ok = answers[index]!.every((cell) => boardTaps.includes(cell));
          return (
             <div key={index} className="flex min-w-0 flex-col items-center gap-0.5">
               <span className="font-mono text-base text-muted-foreground">Board {index + 1} · original</span>
               <div className="w-full max-w-[160px]"><Grid size={board.size} cells={board.cells} compact /></div>
               <span aria-hidden="true" className="text-lg leading-none text-primary">↓</span>
               <div className="w-full max-w-[160px]"><Grid size={board.size} cells={board.after} marked={answers[index] ?? []} wrong={boardTaps.find((tap) => !answers[index]!.includes(tap)) ?? null} compact /></div>
               <span className={`font-mono text-base ${ok ? "text-primary" : "text-warn"}`}>
                 {boardTaps.length === 0 ? "No taps" : ok ? "Your taps ✓" : "Your taps ✗"}
               </span>
            </div>
          );
        })}
      </div>
      <p
        className={`whitespace-normal break-words text-center font-mono text-base font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
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
  revealHeading: "The five grids",
  IntroExample,
  Stage,
  Reveal,
};
