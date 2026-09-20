import { useEffect, useMemo, useRef } from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
import {
  cluesFor,
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
  cell = 48,
  goldCells,
  wrongCells,
}: {
  rows: number[][];
  cols: number[][];
  marks: NonoMarks;
  size?: number;
  onCell?: (index: number) => void;
  cell?: number;
  goldCells?: Set<number>;
  wrongCells?: Set<number>;
}) {
  const cellsOf = (line: "row" | "col", index: number) =>
    Array.from({ length: size }, (_, other) =>
      line === "row" ? marks[index * size + other] === 1 : marks[other * size + index] === 1,
    );

  return (
    <div
      className="grid gap-[3px]"
      style={{
        gridTemplateColumns: `auto repeat(${size}, ${cell}px)`,
        gridTemplateRows: `auto repeat(${size}, ${cell}px)`,
      }}
    >
      <span />
      {cols.map((clue, col) => (
        <span
          key={`c${col}`}
          className={`flex items-end justify-center whitespace-pre pb-0.5 font-mono text-[11px] leading-tight ${
            lineSatisfied(clue, cellsOf("col", col)) ? "text-muted-foreground/40" : "text-foreground"
          }`}
        >
          {clueText(clue).split(" ").join("\n")}
        </span>
      ))}
      {rows.map((clue, row) => (
        <>
          <span
            key={`r${row}`}
            className={`flex items-center justify-end pr-1 font-mono text-[13px] ${
              lineSatisfied(clue, cellsOf("row", row))
                ? "text-muted-foreground/40"
                : "text-foreground"
            }`}
          >
            {clueText(clue)}
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
                className={`flex items-center justify-center rounded-[4px] border text-[13px] font-bold ${
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
        </>
      ))}
    </div>
  );
}

const EXAMPLE_PATTERN = [false, true, false, true, true, true, false, true, false];
const EXAMPLE = cluesFor([
  ...EXAMPLE_PATTERN.slice(0, 3),
  false,
  false,
  ...EXAMPLE_PATTERN.slice(3, 6),
  false,
  false,
  ...EXAMPLE_PATTERN.slice(6, 9),
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
]);

/** Fixed intro example — a 3×3 cross, clues and all. */
function IntroExample() {
  const rows = [[1], [3], [1]];
  const cols = [[1], [3], [1]];
  const marks = EXAMPLE_PATTERN.map((cell) => (cell ? 1 : 0)) as NonoMarks;
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Board rows={rows} cols={cols} marks={marks} size={3} cell={28} />
      <p className="text-center text-xs text-muted-foreground">
        The numbers are the run lengths — this one is a cross.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: NonoPuzzleData | null = puzzle.type === "nonogram" ? puzzle : null;
  const stateKey = arguments.length ? undefined : undefined;
  void stateKey;
  const [marks, setMarks] = useStageState<NonoMarks>(
    (puzzle as { type: string }).type,
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
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
      <Board rows={data.rows} cols={data.cols} marks={marks} onCell={tap} />
      <p className="shrink-0 text-center text-[11px] text-muted-foreground">
        Tap to fill, again to mark empty, again to clear.
      </p>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "nonogram") return null;
  const pattern = puzzle.pattern ?? [];
  const filled = decodeNonoCells(myAnswer ?? "");
  const mine = new Set(filled);
  const correct = filled.filter((cell) => pattern[cell]).length;
  const total = pattern.filter(Boolean).length;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((NONO_TIME_MS - myMsRemaining) / 100) / 10;

  const solutionMarks = pattern.map((cell) => (cell ? 1 : 0)) as NonoMarks;
  const myMarks = Array.from({ length: NONO_SIZE * NONO_SIZE }, (_, index) =>
    mine.has(index) ? 1 : 0,
  ) as NonoMarks;
  const wrongCells = new Set(filled.filter((cell) => !pattern[cell]));

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <div className="flex shrink-0 items-start justify-center gap-4">
        <Board rows={puzzle.rows} cols={puzzle.cols} marks={solutionMarks} cell={26} />
        <Board
          rows={puzzle.rows}
          cols={puzzle.cols}
          marks={myMarks}
          cell={26}
          wrongCells={wrongCells}
        />
      </div>
      <p
        className={`shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
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

void EXAMPLE;
