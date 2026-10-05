import { Fragment, useEffect, useMemo, useRef } from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
import {
  decodeNonoCells,
  encodeNonoCells,
  lineSatisfied,
  type NonoMarks,
} from "@/lib/duel/nonogram";
import { useStageState } from "@/lib/duel/stageState";
import { NONO_SIZE, NONO_TIME_MS, type NonoPuzzleData } from "@/lib/duel/types";
import { playLock } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function clueText(clue: number[]): string {
  return clue.length ? clue.join(" ") : "0";
}

/** One playable board: clues outside, the grid centred. */
function Board({
  rows,
  cols,
  marks,
  size = NONO_SIZE,
  onCell,
  cell = 40,
  fluid = false,
  goldCells,
  wrongCells,
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
}) {
  const cellsOf = (line: "row" | "col", index: number) =>
    Array.from({ length: size }, (_, other) =>
      line === "row" ? marks[index * size + other] === 1 : marks[other * size + index] === 1,
    );

  return (
    <div
      className={`grid gap-0 ${fluid ? "logic-nonogram-board" : ""}`}
      style={{
        gridTemplateColumns: fluid ? `1.15fr repeat(${size}, minmax(0, 1fr))` : `auto repeat(${size}, ${cell}px)`,
        gridTemplateRows: fluid ? `auto repeat(${size}, minmax(0, 1fr))` : `auto repeat(${size}, ${cell}px)`,
      }}
    >
      <span />
      {cols.map((clue, col) => (
        <span
          key={`c${col}`}
          className={`flex items-end justify-center whitespace-pre pb-1 font-mono text-[12px] leading-none ${
            lineSatisfied(clue, cellsOf("col", col))
              ? "text-muted-foreground/40"
              : "text-foreground"
          }`}
        >
          {clueText(clue).split(" ").join("\n")}
        </span>
      ))}
      {rows.map((clue, row) => (
        <Fragment key={`r${row}`}>
          <span
            className={`flex max-w-9 items-center justify-end gap-0.5 pr-1 font-mono text-[12px] leading-none ${
              lineSatisfied(clue, cellsOf("row", row))
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
            return (
              <button
                key={index}
                type="button"
                aria-label={`Row ${row + 1} column ${col + 1}`}
                onPointerDown={onCell ? () => onCell(index) : undefined}
                className={`flex items-center justify-center border text-[13px] font-bold ${
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
      ))}
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
  const [marks, setMarks] = useStageState<NonoMarks>(
    stateKey,
    "nonoMarks",
    () => Array.from({ length: NONO_SIZE * NONO_SIZE }, () => 0) as NonoMarks,
  );
  const submitted = useRef(false);

  useEffect(() => {
    onDraftAnswer?.(encodeNonoCells(marks));
  }, [marks, onDraftAnswer]);

  const complete = useMemo(() => {
    if (!data) return false;
    const filledRow = (row: number) =>
      Array.from({ length: NONO_SIZE }, (_, col) => marks[row * NONO_SIZE + col] === 1);
    const filledCol = (col: number) =>
      Array.from({ length: NONO_SIZE }, (_, row) => marks[row * NONO_SIZE + col] === 1);
    return (
      data.rows.every((clue, row) => lineSatisfied(clue, filledRow(row))) &&
      data.cols.every((clue, col) => lineSatisfied(clue, filledCol(col)))
    );
  }, [data, marks]);

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
    hapticTick();
    setMarks(
      marks.map((mark, at) =>
        at === index ? (((mark + 1) % 3) as NonoMarks[number]) : mark,
      ) as NonoMarks,
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-3">
      <Board rows={data.rows} cols={data.cols} marks={marks} onCell={tap} fluid />
      <p className="shrink-0 text-center text-[11px] text-muted-foreground">
        Tap to fill, again to mark empty, again to clear.
      </p>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "nonogram") return null;
  const pattern = puzzle.pattern ?? [];
  const filled = decodeNonoCells(myAnswer ?? "");
  const mine = new Set(filled);
  const correct = filled.filter((cell) => pattern[cell]).length;
  const total = pattern.filter(Boolean).length;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  const solutionMarks = pattern.map((cell) => (cell ? 1 : 0)) as NonoMarks;
  const myMarks = Array.from({ length: NONO_SIZE * NONO_SIZE }, (_, index) =>
    mine.has(index) ? 1 : 0,
  ) as NonoMarks;
  const wrongCells = new Set(filled.filter((cell) => !pattern[cell]));

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="flex shrink-0 items-start justify-center gap-2">
        <Board rows={puzzle.rows} cols={puzzle.cols} marks={solutionMarks} cell={14} />
        <Board
          rows={puzzle.rows}
          cols={puzzle.cols}
          marks={myMarks}
          cell={14}
          wrongCells={wrongCells}
        />
      </div>
      <p
        className={`whitespace-normal break-words text-center font-mono text-base font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
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
  name: "Nonogram",
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
