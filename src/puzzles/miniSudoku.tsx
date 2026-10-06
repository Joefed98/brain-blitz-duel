import { useEffect, useMemo, useRef, useState } from "react";

import { decodeSudoku, encodeSudoku, sudokuBox, sudokuSolved } from "@/lib/duel/logic";
import {
  SUDOKU_BOX_COLS,
  SUDOKU_BOX_ROWS,
  SUDOKU_CELLS,
  SUDOKU_COLS,
  SUDOKU_TIME_MS,
  type SudokuPuzzleData,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const DIGITS = [1, 2, 3, 4, 5, 6];

type CellTone = "given" | "entry" | "wrong";

function boxEdges(cell: number): string {
  const row = Math.floor(cell / SUDOKU_COLS);
  const col = cell % SUDOKU_COLS;
  const classes = ["border-border/60"];
  classes.push(row % SUDOKU_BOX_ROWS === 0 ? "border-t-2 border-t-border" : "border-t");
  classes.push(col % SUDOKU_BOX_COLS === 0 ? "border-l-2 border-l-border" : "border-l");
  if (row === SUDOKU_COLS - 1) classes.push("border-b-2 border-b-border");
  if (col === SUDOKU_COLS - 1) classes.push("border-r-2 border-r-border");
  return classes.join(" ");
}

/** The 6x6 grid, with thicker lines around every 2x3 box. */
function SudokuGrid({
  values,
  tones,
  pencil,
  selected,
  onSelect,
  cols = SUDOKU_COLS,
}: {
  values: number[];
  tones: CellTone[];
  pencil?: number[][] | undefined;
  selected?: number | null | undefined;
  onSelect?: ((cell: number) => void) | undefined;
  cols?: number | undefined;
}) {
  const selectedRow =
    selected === null || selected === undefined ? -1 : Math.floor(selected / cols);
  const selectedCol = selected === null || selected === undefined ? -1 : selected % cols;
  const selectedBox = selected === null || selected === undefined ? -1 : sudokuBox(selected);

  return (
    <div
      className="sudoku-grid mx-auto grid aspect-square h-full max-h-full w-full max-w-full"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${Math.ceil(values.length / cols)}, minmax(0, 1fr))`,
        containerType: "inline-size",
      }}
    >
      {values.map((value, cell) => {
        const row = Math.floor(cell / cols);
        const col = cell % cols;
        const highlight =
          selected !== null &&
          selected !== undefined &&
          (row === selectedRow || col === selectedCol || sudokuBox(cell) === selectedBox);
        const tone = tones[cell] ?? "entry";
        const marks = pencil?.[cell] ?? [];
        return (
          <button
            key={cell}
            type="button"
            disabled={!onSelect}
            onClick={onSelect ? () => onSelect(cell) : undefined}
            className={`relative flex items-center justify-center font-display font-bold ${boxEdges(cell)} ${
              cell === selected
                ? "bg-primary/20 outline outline-2 -outline-offset-2 outline-primary"
                : highlight
                  ? "bg-muted/40"
                  : "bg-card"
            } ${tone === "given" ? "text-foreground" : tone === "wrong" ? "text-destructive" : "text-primary"}`}
            style={{ fontSize: "max(15px, calc(100cqw / 6 * 0.52))" }}
            aria-label={`Cell ${cell + 1}`}
          >
            {value ? (
              value
            ) : marks.length ? (
              <span
                className="grid w-full grid-cols-3 gap-0 px-[6%] font-mono text-muted-foreground"
                style={{ fontSize: "max(7px, calc(100cqw / 6 * 0.22))" }}
              >
                {DIGITS.map((digit) => (
                  <span key={digit} className="text-center">
                    {marks.includes(digit) ? digit : ""}
                  </span>
                ))}
              </span>
            ) : (
              ""
            )}
          </button>
        );
      })}
      <svg className="sudoku-box-outline" viewBox="0 0 6 6" aria-hidden="true">
        <path d="M 0 0 H 6 V 6 H 0 Z M 3 0 V 6 M 0 2 H 6 M 0 4 H 6" />
      </svg>
    </div>
  );
}

/** Fixed intro example — never randomised. */
const EXAMPLE_VALUES = [
  1, 2, 3, 0, 5, 0, 4, 5, 6, 1, 0, 3, 0, 0, 0, 0, 6, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0,
  0, 0, 0,
];

function IntroExample() {
  const tones = EXAMPLE_VALUES.map((_, cell) =>
    cell < 12 && cell % SUDOKU_COLS < 3 ? "entry" : "given",
  ) as CellTone[];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Fill the grid so every row, column and box has 1 to 6 once.
      </p>
      <div style={{ width: 150 }}>
        <SudokuGrid values={EXAMPLE_VALUES} tones={tones} />
      </div>
      <p className="text-xs text-muted-foreground">
        Tap a cell, then a number. Pencil marks are for your notes. You have 90 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const givens = puzzle.type === "sudoku" ? puzzle.givens : [];
  const [entries, setEntries] = useState<number[]>(() => new Array(SUDOKU_CELLS).fill(0));
  const [pencil, setPencil] = useState<number[][]>(() =>
    Array.from({ length: SUDOKU_CELLS }, () => [] as number[]),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [pencilMode, setPencilMode] = useState(false);
  const submitted = useRef(false);

  const grid = useMemo(
    () => givens.map((given, cell) => (given ? given : (entries[cell] ?? 0))),
    [givens, entries],
  );

  useEffect(() => {
    onDraftAnswer?.(encodeSudoku(grid));
  }, [grid, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current) return;
    if (!sudokuSolved(grid, givens)) return;
    submitted.current = true;
    onSubmit(encodeSudoku(grid));
  }, [grid, givens, locked, onSubmit]);

  if (puzzle.type !== "sudoku") return null;

  const tones = givens.map((given) => (given ? "given" : "entry")) as CellTone[];

  const tapDigit = (digit: number) => {
    if (locked || submitted.current || selected === null) return;
    if (givens[selected]) return;
    buzz(8);
    if (pencilMode) {
      setPencil((current) =>
        current.map((marks, cell) =>
          cell === selected
            ? marks.includes(digit)
              ? marks.filter((value) => value !== digit)
              : [...marks, digit].sort()
            : marks,
        ),
      );
      return;
    }
    setEntries((current) =>
      current.map((value, cell) => (cell === selected ? (value === digit ? 0 : digit) : value)),
    );
  };

  const clearCell = () => {
    if (locked || selected === null || givens[selected]) return;
    setEntries((current) => current.map((value, cell) => (cell === selected ? 0 : value)));
    setPencil((current) => current.map((marks, cell) => (cell === selected ? [] : marks)));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <SudokuGrid
          values={grid}
          tones={tones}
          pencil={pencil}
          selected={selected}
          onSelect={locked ? undefined : (cell) => setSelected(cell)}
        />
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <div className="grid grid-cols-6 gap-1.5">
          {DIGITS.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => tapDigit(digit)}
              disabled={locked}
              className="press tap-target rounded-lg border border-border bg-card py-2 font-display text-lg font-bold text-foreground disabled:opacity-40"
            >
              {digit}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setPencilMode((current) => !current)}
            disabled={locked}
            className={`press tap-target rounded-lg border py-2 font-mono text-xs uppercase tracking-widest ${
              pencilMode
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            Pencil
          </button>
          <button
            type="button"
            onClick={clearCell}
            disabled={locked}
            className="press tap-target rounded-lg border border-border bg-card py-2 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "sudoku") return null;
  const solution = puzzle.solution ?? puzzle.givens;
  const mine = decodeSudoku(myAnswer ?? "");
  const blanks = puzzle.givens.filter((given) => !given).length;
  let correct = 0;

  const tones = solution.map((value, cell) => {
    if (puzzle.givens[cell]) return "given" as CellTone;
    const entry = mine[cell] ?? 0;
    if (entry && entry === value) {
      correct += 1;
      return "entry" as CellTone;
    }
    return entry ? ("wrong" as CellTone) : ("given" as CellTone);
  });

  const values = solution.map((value, cell) =>
    tones[cell] === "wrong" ? (mine[cell] ?? value) : value,
  );
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div style={{ width: 190 }}>
        <SudokuGrid values={values} tones={tones} />
      </div>
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        {myCorrect
          ? `✓ Solved${elapsed === null ? "" : ` · ${elapsed}s`}`
          : `✗ ${correct} / ${blanks} correct`}
      </p>
    </div>
  );
}

/** The one grid the givens allow stays server-side until the reveal. */
export const miniSudokuPuzzle: PuzzleDefinition = {
  key: "sudoku",
  name: "Mini Sudoku",
  category: "logic",
  timeLimitMs: SUDOKU_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "sudoku", givens: new Array(SUDOKU_CELLS).fill(0) }) satisfies SudokuPuzzleData,
  check: (answer, puzzle) =>
    puzzle.type === "sudoku" && sudokuSolved(decodeSudoku(answer), puzzle.givens),
  revealHeading: "The finished grid",
  IntroExample,
  Stage,
  Reveal,
};
