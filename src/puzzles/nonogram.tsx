import { gameDisplayName } from "@/lib/duel/gameNames";
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import {
  decodeNonoCells,
  encodeNonoCells,
  lineSatisfied,
  nonoSizeOf,
  type NonoMarks,
} from "@/lib/duel/nonogram";
import { useStageState } from "@/lib/duel/stageState";
import { NONO_SIZE, NONO_TIME_MS, type NonoPuzzleData } from "@/lib/duel/types";
import { playLock } from "@/lib/sound";

import { soundCue, useSolveFx } from "./logicFx";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function clueText(clue: number[]): string {
  return clue.length ? clue.join(" ") : "0";
}

/** One playable board: clues outside, the grid centred. */
export function Board({
  rows,
  cols,
  marks,
  size = NONO_SIZE,
  onCell,
  cell = 40,
  fluid = false,
  goldCells,
  wrongCells,
  reveal = false,
  tapped,
}: {
  rows: number[][];
  cols: number[][];
  marks: NonoMarks;
  size?: number;
  onCell?: (index: number) => void;
  cell?: number;
  fluid?: boolean;
  goldCells?: Set<number>;
  wrongCells?: Set<number>;
  /** Reveal: fluid cells, 12px clues, finished lines not dimmed. */
  reveal?: boolean;
  /** The cell that was just tapped, keyed per tap (its tile pops). */
  tapped?: { index: number; key: number } | null;
}) {
  const cellsOf = (line: "row" | "col", index: number) =>
    Array.from({ length: size }, (_, other) =>
      line === "row" ? marks[index * size + other] === 1 : marks[other * size + index] === 1,
    );

  return (
    <div
      className={`logic-nono grid gap-0 ${fluid ? "logic-nonogram-board" : ""} ${reveal ? "logic-nono-reveal w-full" : ""}`}
      style={{
        gridTemplateColumns: fluid ? `1.15fr repeat(${size}, minmax(0, 1fr))` : reveal ? `auto repeat(${size}, minmax(0, 1fr))` : `auto repeat(${size}, ${cell}px)`,
        gridTemplateRows: fluid ? `auto repeat(${size}, minmax(0, 1fr))` : reveal ? `auto repeat(${size}, auto)` : `auto repeat(${size}, ${cell}px)`,
        ...(reveal ? { fontSize: 12 } : {}),
      }}
    >
      <span />
      {cols.map((clue, col) => {
        const guide = size >= 10 && (col + 1) % 5 === 0 && col + 1 !== size;
        return (
          <span
            key={`c${col}`}
            className={`nono-clue-col flex items-end justify-center gap-0.5 whitespace-pre pb-1.5 font-mono font-bold leading-[1.15] ${reveal ? "" : "text-[15px]"} ${guide ? "nono-guide-col" : ""} ${
              !reveal && lineSatisfied(clue, cellsOf("col", col))
                ? "text-muted-foreground/40"
                : "text-foreground"
            }`}
          >
            {clueText(clue).split(" ").join("\n")}
          </span>
        );
      })}
      {rows.map((clue, row) => {
        const rowGuide = size >= 10 && (row + 1) % 5 === 0 && row + 1 !== size;
        return (
        <Fragment key={`r${row}`}>
          <span
            className={`nono-clue-row flex items-center justify-end gap-1 pr-1.5 font-mono font-bold leading-none ${reveal ? "" : "max-w-10 text-[15px]"} ${
              !reveal && lineSatisfied(clue, cellsOf("row", row))
                ? "text-muted-foreground/40"
                : "text-foreground"
            }`}
          >
            {clue.map((run, index) => (
              <span key={`${row}-${index}`}>{run}</span>
            ))}
          </span>
          {Array.from({ length: size }, (_, col) => {
            const index = row * size + col;
            const mark = marks[index] ?? 0;
            const gold = goldCells?.has(index);
            const wrong = wrongCells?.has(index);
            const colGuide = size >= 10 && (col + 1) % 5 === 0 && col + 1 !== size;
            const popped = tapped?.index === index;
            return (
              <button
                key={popped ? `${index}-${tapped?.key}` : index}
                type="button"
                aria-label={`Row ${row + 1} column ${col + 1}`}
                onPointerDown={onCell ? () => onCell(index) : undefined}
                style={{ "--logic-diag": row + col, "--logic-hue": (row * 47 + col * 83) % 360 } as CSSProperties}
                className={`logic-nono-cell flex items-center justify-center border text-[13px] font-bold ${reveal ? "aspect-square" : ""} ${popped ? (mark === 1 ? "logic-nono-pop" : "logic-nono-tick") : ""} ${
                  rowGuide ? "nono-guide-row" : ""
                } ${colGuide ? "nono-guide-col" : ""} ${
                  wrong
                    ? "border-warn bg-warn/30 text-warn"
                    : gold || mark === 1
                      ? "border-primary bg-primary"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                {mark === 2 && !gold && !wrong ? "×" : ""}
              </button>
            );
          })}
        </Fragment>
        );
      })}
    </div>
  );
}

const EXAMPLE_PATTERN = [
  false,
  true,
  true,
  false,
  true,
  false,
  false,
  true,
  true,
  false,
  false,
  true,
  false,
  true,
  true,
  false,
];

/** Fixed intro example — a 4×4 diamond, clues and all. */
function IntroExample() {
  const rows = [[2], [1, 1], [1, 1], [2]];
  const cols = [[2], [1, 1], [1, 1], [2]];
  const marks = EXAMPLE_PATTERN.map((cell) => (cell ? 1 : 0)) as NonoMarks;
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Board rows={rows} cols={cols} marks={marks} size={4} cell={24} />
      <p className="text-center text-xs text-muted-foreground">
        The numbers are the run lengths - this one is a diamond.
      </p>
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
  stateKey = "nonogram",
}: PuzzleStageProps) {
  const data: NonoPuzzleData | null = puzzle.type === "nonogram" ? puzzle : null;
  // 7 × 7 before the depth revision, 8 × 8 on it (the clue count).
  const SIZE = nonoSizeOf(data);
  const [marks, setMarks] = useStageState<NonoMarks>(
    stateKey,
    "nonoMarks",
    () => Array.from({ length: SIZE * SIZE }, () => 0) as NonoMarks,
  );
  const [tapped, setTapped] = useState<{ index: number; key: number } | null>(null);
  const submitted = useRef(false);

  useEffect(() => {
    onDraftAnswer?.(encodeNonoCells(marks));
  }, [marks, onDraftAnswer]);

  const complete = useMemo(() => {
    if (!data) return false;
    const filledRow = (row: number) =>
      Array.from({ length: SIZE }, (_, col) => marks[row * SIZE + col] === 1);
    const filledCol = (col: number) =>
      Array.from({ length: SIZE }, (_, row) => marks[row * SIZE + col] === 1);
    return (
      data.rows.every((clue, row) => lineSatisfied(clue, filledRow(row))) &&
      data.cols.every((clue, col) => lineSatisfied(clue, filledCol(col)))
    );
  }, [data, marks, SIZE]);
  const solving = useSolveFx("nonogram", complete);
  const linesDone = useMemo(() => {
    if (!data) return 0;
    const line = (cells: number[]) => cells.map((cell) => marks[cell] === 1);
    const span = Array.from({ length: SIZE }, (_, i) => i);
    return (
      data.rows.filter((clue, row) => lineSatisfied(clue, line(span.map((col) => row * SIZE + col)))).length +
      data.cols.filter((clue, col) => lineSatisfied(clue, line(span.map((row) => row * SIZE + col)))).length
    );
  }, [data, marks, SIZE]);
  useFrameProgress(linesDone, SIZE * 2, "lines");

  // Every line matching its clues means the picture is the stored one.
  useEffect(() => {
    if (!data || locked || submitted.current || !complete) return;
    submitted.current = true;
    playLock();
    onSubmit(encodeNonoCells(marks));
  }, [complete, data, locked, marks, onSubmit]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + NONO_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encodeNonoCells(marks));
  }, [now, phaseStartedAt, locked, data, marks, onSubmit]);

  if (!data) return null;

  const tap = (index: number) => {
    if (locked || submitted.current) return;
    const next = ((marks[index] ?? 0) + 1) % 3;
    soundCue(next === 1 ? "nonogram.fill" : next === 2 ? "nonogram.mark" : "nonogram.clear");
    setTapped((current) => ({ index, key: (current?.key ?? 0) + 1 }));
    setMarks(
      marks.map((mark, at) =>
        at === index ? (((mark + 1) % 3) as NonoMarks[number]) : mark,
      ) as NonoMarks,
    );
  };

  return (
    <div data-logic-stage="nonogram" data-logic-solved={solving ? "" : undefined} data-stage-column="3" className="relative flex min-h-0 flex-1 flex-col gap-3">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic" className="px-3">
        <div className="logic-nono-fit logic-nono-frame">
          <Board rows={data.rows} cols={data.cols} marks={marks} size={SIZE} onCell={tap} fluid tapped={tapped} />
        </div>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "nonogram") return null;
  const pattern = puzzle.pattern ?? [];
  const size = nonoSizeOf(puzzle);
  const filled = decodeNonoCells(myAnswer ?? "", size);
  const mine = new Set(filled);
  const correct = filled.filter((cell) => pattern[cell]).length;
  const total = pattern.filter(Boolean).length;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  const solutionMarks = pattern.map((cell) => (cell ? 1 : 0)) as NonoMarks;
  const myMarks = Array.from({ length: size * size }, (_, index) =>
    mine.has(index) ? 1 : 0,
  ) as NonoMarks;
  const wrongCells = new Set(filled.filter((cell) => !pattern[cell]));

  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-nono-pair">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
            <Board rows={puzzle.rows} cols={puzzle.cols} marks={solutionMarks} size={size} reveal />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
            <Board
              rows={puzzle.rows}
              cols={puzzle.cols}
              marks={myMarks}
              size={size}
              wrongCells={wrongCells}
              reveal
            />
          </div>
        </div>
      </div>
      <p
        className={`logic-reveal-text whitespace-normal break-words text-center font-mono font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
      >
        {myCorrect
          ? `Solved${elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}`
          : `${correct} / ${total} cells`}
      </p>
    </div>
  );
}

/** The clues are public; the picture they describe stays in the secrets row. */
export const nonogramPuzzle: PuzzleDefinition = {
  key: "nonogram",
  name: gameDisplayName("nonogram"),
  category: "logic",
  timeLimitMs: NONO_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "nonogram", rows: [], cols: [] }) satisfies NonoPuzzleData,
  check: () => false,
  revealHeading: "The picture",
  IntroExample,
  Stage,
  Reveal,
};
