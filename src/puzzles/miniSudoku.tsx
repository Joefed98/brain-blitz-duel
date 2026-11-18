import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { decodeSudoku, encodeSudoku, sudokuBox, sudokuClashes, sudokuCompleteGroups, sudokuSolved } from "@/lib/duel/logic";
import {
  SUDOKU_BOX_COLS,
  SUDOKU_BOX_ROWS,
  SUDOKU_CELLS,
  SUDOKU_COLS,
  SUDOKU_TIME_MS,
  type SudokuPuzzleData,
} from "@/lib/duel/types";
import { directionOf, useGameKeys } from "@/lib/desktop";

import { soundCue, useSolveFx } from "./logicFx";
import { RevealFacts } from "./logicReveal";
import { lightCells } from "./logicMotion";
import { gameFx } from "@/lib/fx/kit";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const DIGITS = [1, 2, 3, 4, 5, 6];

type CellTone = "given" | "entry" | "wrong" | "missed";

function boxEdges(cell: number): string {
  const row = Math.floor(cell / SUDOKU_COLS);
  const col = cell % SUDOKU_COLS;
  const classes = ["border-border/60"];
  classes.push(row % SUDOKU_BOX_ROWS === 0 ? "sudoku-box-top" : "border-t");
  classes.push(col % SUDOKU_BOX_COLS === 0 ? "sudoku-box-left" : "border-l");
  if (row === SUDOKU_COLS - 1) classes.push("sudoku-box-bottom");
  if (col === SUDOKU_COLS - 1) classes.push("sudoku-box-right");
  return classes.join(" ");
}

/** The 6x6 grid, with thicker lines around every 2x3 box. */
export function SudokuGrid({
  values,
  tones,
  pencil,
  selected,
  onSelect,
  cols = SUDOKU_COLS,
  placed,
  clashes,
}: {
  values: number[];
  tones: CellTone[];
  pencil?: number[][] | undefined;
  selected?: number | null | undefined;
  onSelect?: ((cell: number) => void) | undefined;
  cols?: number | undefined;
  /** The cell that just took a digit (it pops in). */
  placed?: number | null | undefined;
  /** Cells whose digit repeats in a row, column or box (live clashes, display only). */
  clashes?: ReadonlySet<number> | undefined;
}) {
  const selectedRow =
    selected === null || selected === undefined ? -1 : Math.floor(selected / cols);
  const selectedCol = selected === null || selected === undefined ? -1 : selected % cols;
  const selectedBox = selected === null || selected === undefined ? -1 : sudokuBox(selected);

  return (
    <div
      className="sudoku-grid logic-sudoku mx-auto grid aspect-square h-full max-h-full w-full max-w-full"
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
        const clash = clashes?.has(cell) ?? false;
        return (
          <button
            key={cell}
            type="button"
            disabled={!onSelect}
            onClick={onSelect ? () => onSelect(cell) : undefined}
            data-clash={clash ? "" : undefined}
            data-tone={tone}
            className={`logic-sudoku-cell relative flex items-center justify-center font-display font-bold ${boxEdges(cell)} ${
              cell === selected
                ? "bg-primary/20 outline outline-2 -outline-offset-2 outline-primary"
                : highlight
                  ? "bg-muted/40"
                  : "bg-card"
            } ${tone === "given" ? "text-foreground" : tone === "wrong" ? "text-destructive" : "text-primary"}`}
            data-cell={cell}
            style={{
              fontSize: "max(15px, calc(100cqw / 6 * 0.52))",
              "--logic-row": row,
              "--logic-box": sudokuBox(cell),
              // The solve's gold runs out from the last cell placed (Logic overhaul 1).
              "--logic-dist": placed === null || placed === undefined ? row + col : Math.max(Math.abs(row - Math.floor(placed / cols)), Math.abs(col - (placed % cols))),
            } as CSSProperties}
            // 7 Nov 2026 (accessibility audit #16): the label said only "Cell N" and replaced the digit.
            aria-label={`Row ${row + 1} column ${col + 1}, ${value ? value : marks.length ? `notes ${marks.join(" ")}` : "empty"}${tone === "given" ? ", given" : tone === "wrong" ? ", wrong" : tone === "missed" ? ", missed" : ""}${clash ? ", clashes" : ""}`}
          >
            {value ? (
              <span key={value} className={`logic-sudoku-digit ${tone === "given" ? "logic-sudoku-given" : ""} ${placed === cell ? "logic-sudoku-pop" : ""}`}>
                {value}
              </span>
            ) : marks.length ? (
              <span
                className="grid w-full grid-cols-3 gap-0 px-[6%] font-mono text-muted-foreground"
                style={{ fontSize: "max(8px, calc(100cqw / 6 * 0.26))" }}
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

/** How long Check shows Expert's clashes. */
export const CHECK_SHOW_MS = 2_000;

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const givens = puzzle.type === "sudoku" ? puzzle.givens : [];
  const [entries, setEntries] = useState<number[]>(() => new Array(SUDOKU_CELLS).fill(0));
  const [pencil, setPencil] = useState<number[][]>(() =>
    Array.from({ length: SUDOKU_CELLS }, () => [] as number[]),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [pencilMode, setPencilMode] = useState(false);
  const [placed, setPlaced] = useState<number | null>(null);
  const submitted = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const grid = useMemo(
    () => givens.map((given, cell) => (given ? given : (entries[cell] ?? 0))),
    [givens, entries],
  );

  useEffect(() => {
    onDraftAnswer?.(encodeSudoku(grid));
  }, [grid, onDraftAnswer]);

  const solving = useSolveFx("sudoku", puzzle.type === "sudoku" && sudokuSolved(grid, givens));
  // The player's own cells only ("1 / 22 filled"), never the givens (Logic review, 15 Nov 2026).
  const filled = sudokuEntryCount(givens, grid);
  const inFrame = useFrameProgress(filled.done, filled.total, "filled");
  // Logic overhaul 1: clashes are shown while playing (the clean bonus still counts every wrong digit typed). Expert
  // (`clashes: "check"`, the levels) shows them only for a moment after Check is pressed.
  const onCheck = puzzle.type === "sudoku" && puzzle.clashes === "check";
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const liveClashes = useMemo(() => sudokuClashes(grid), [grid]);
  const clashes = useMemo(() => (onCheck && checkedAt === null ? new Set<number>() : liveClashes), [onCheck, checkedAt, liveClashes]);
  useEffect(() => {
    if (checkedAt === null) return;
    const t = setTimeout(() => setCheckedAt(null), CHECK_SHOW_MS);
    return () => clearTimeout(t);
  }, [checkedAt]);
  // Easy (`hideUsed`): a digit already placed six times leaves the keypad.
  const hideUsed = puzzle.type === "sudoku" && puzzle.hideUsed === true;
  const usedUp = useMemo(() => new Set(DIGITS.filter((d) => grid.filter((v) => v === d).length >= SUDOKU_COLS)), [grid]);
  const clashCount = clashes.size;
  const lastClashes = useRef(0);
  useEffect(() => {
    if (clashCount > lastClashes.current) soundCue("sudoku.clash");
    lastClashes.current = clashCount;
  }, [clashCount]);

  useEffect(() => {
    if (locked || submitted.current) return;
    if (!sudokuSolved(grid, givens)) return;
    submitted.current = true;
    onSubmit(encodeSudoku(grid));
  }, [grid, givens, locked, onSubmit]);

  // Desktop keys: arrows (WASD) move the selected cell, 1–6 enter that digit, Backspace or Delete = Clear,
  // P = Pencil.
  useGameKeys((kind, key, event) => {
    if (puzzle.type !== "sudoku") return false;
    const dir = directionOf(key);
    const digit = /^[1-6]$/.test(key) ? Number(key) : null;
    const used = dir !== null || digit !== null || key === "Backspace" || key === "Delete" || key === "p";
    if (!used || kind !== "down" || locked) return used;
    if (dir) {
      const rows = SUDOKU_CELLS / SUDOKU_COLS;
      const from = selected ?? 0;
      let row = Math.floor(from / SUDOKU_COLS);
      let col = from % SUDOKU_COLS;
      if (selected !== null) {
        if (dir === "up") row = Math.max(0, row - 1);
        else if (dir === "down") row = Math.min(rows - 1, row + 1);
        else if (dir === "left") col = Math.max(0, col - 1);
        else col = Math.min(SUDOKU_COLS - 1, col + 1);
      }
      setSelected(row * SUDOKU_COLS + col);
    } else if (digit !== null) {
      if (!event.repeat) tapDigit(digit);
    } else if (key === "p") {
      if (!event.repeat) setPencilMode((current) => !current);
    } else clearCell();
    return true;
  });

  if (puzzle.type !== "sudoku") return null;

  const tones = givens.map((given) => (given ? "given" : "entry")) as CellTone[];

  const tapDigit = (digit: number) => {
    if (locked || submitted.current || selected === null) return;
    if (givens[selected]) return;
    if (pencilMode) {
      soundCue("sudoku.pencil");
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
    if (entries[selected] !== digit) {
      setPlaced(selected);
      soundCue("sudoku.place");
      // A row, column or box this digit completes lights along it with a rising note; several at once are a combo.
      const nextGrid = grid.map((value, cell) => (cell === selected ? digit : value));
      const before = sudokuCompleteGroups(grid);
      const fresh = [...sudokuCompleteGroups(nextGrid)].filter(([key]) => !before.has(key));
      if (fresh.length && !sudokuSolved(nextGrid, givens)) {
        const root = gridRef.current;
        const at = selected;
        for (const [, cells] of fresh) {
          const ordered = [...cells].sort((a, b) => Math.abs(a - at) - Math.abs(b - at));
          lightCells(ordered.map((c) => root?.querySelector<HTMLElement>(`[data-cell="${c}"]`)));
        }
        if (fresh.length > 1) gameFx("combo", root?.querySelector(`[data-cell="${at}"]`), { count: fresh.length, silent: true });
        // Several lines at once play the combo in the single line's place (one sound a moment).
        if (fresh.length > 1) soundCue("sudoku.combo");
        else soundCue("sudoku.line");
      }
      if (!onCheck && sudokuClashes(nextGrid).has(selected)) {
        gameFx("wrong", gridRef.current?.querySelector(`[data-cell="${selected}"] .logic-sudoku-digit`), { silent: true });
      }
    } else soundCue("sudoku.clear"); // the same digit tapped again takes it off
    setEntries((current) =>
      current.map((value, cell) => (cell === selected ? (value === digit ? 0 : digit) : value)),
    );
  };

  const clearCell = () => {
    if (locked || selected === null || givens[selected]) return;
    if (entries[selected] || pencil[selected]?.length) soundCue("sudoku.clear");
    setEntries((current) => current.map((value, cell) => (cell === selected ? 0 : value)));
    setPencil((current) => current.map((marks, cell) => (cell === selected ? [] : marks)));
  };

  return (
    <div data-logic-stage="sudoku" data-logic-solved={solving ? "" : undefined} data-stage-column="3" className="relative flex min-h-0 flex-1 flex-col gap-3">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic">
        <div ref={gridRef} className="logic-square-bare logic-sudoku-frame">
          <SudokuGrid
            values={grid}
            tones={tones}
            pencil={pencil}
            selected={selected}
            placed={placed}
            clashes={clashes}
            onSelect={locked ? undefined : (cell) => setSelected(cell)}
          />
        </div>
      </div>
      <div data-game-controls="numbers" className="flex shrink-0 flex-col gap-2">
        <div className="grid grid-cols-6 gap-1.5">
          {DIGITS.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => tapDigit(digit)}
              disabled={locked || (hideUsed && usedUp.has(digit))}
              data-used-up={hideUsed && usedUp.has(digit) ? "" : undefined}
              aria-hidden={hideUsed && usedUp.has(digit) ? true : undefined}
              className={`logic-sudoku-key press tap-target rounded-lg py-2 font-display text-lg font-bold text-foreground disabled:opacity-40 ${inFrame ? "gf-glass" : "border border-border bg-card"}`}
            >
              {digit}
            </button>
          ))}
        </div>
        <div className={`grid gap-1.5 ${onCheck ? "grid-cols-3" : "grid-cols-2"}`}>
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
          {onCheck ? (
            <button
              type="button"
              data-sudoku-check=""
              onClick={() => {
                if (locked) return;
                setCheckedAt(Date.now());
                // The clash sound plays as the clashes appear (the clash count's effect above); a clean grid ticks.
                if (liveClashes.size) gameFx("wrong", gridRef.current, { silent: true });
                else soundCue("sudoku.check");
              }}
              disabled={locked}
              className="press tap-target rounded-lg border border-border bg-card py-2 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
            >
              Check
            </button>
          ) : null}
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

/** The player's cells filled out of the blanks (the givens never count). */
export function sudokuEntryCount(givens: readonly number[], grid: readonly number[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  givens.forEach((given, cell) => {
    if (given) return;
    total += 1;
    if (grid[cell]) done += 1;
  });
  return { done, total };
}

/**
 * The reveal's cells: givens as given, the player's right digits as entries, wrong digits as wrong, and a blank the
 * player left empty drawn empty (it used to show the solution's digit in the givens' colour, so it looked given).
 */
export function sudokuRevealCells(givens: readonly number[], solution: readonly number[], mine: readonly number[]): { values: number[]; tones: CellTone[]; correct: number } {
  let correct = 0;
  const tones: CellTone[] = [];
  const values: number[] = [];
  solution.forEach((value, cell) => {
    if (givens[cell]) {
      tones.push("given");
      values.push(value);
      return;
    }
    const entry = mine[cell] ?? 0;
    if (entry && entry === value) correct += 1;
    tones.push(entry && entry !== value ? "wrong" : "entry");
    values.push(entry);
  });
  return { values, tones, correct };
}

/**
 * The reveal (Logic overhaul 1, 15 Nov 2026): one big board at a time through the shared Solution / Yours switch.
 * Solution: the finished grid, the cells you missed or got wrong ringed. Yours: your grid, wrong digits in red, empty
 * cells empty. Under it, the numbers behind the score: right, wrong and empty among your cells.
 */
function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "sudoku") return null;
  const solution = puzzle.solution ?? puzzle.givens;
  const mine = decodeSudoku(myAnswer ?? "");
  const blanks = puzzle.givens.filter((given) => !given).length;
  const yours = sudokuRevealCells(puzzle.givens, solution, mine);
  const wrong = yours.tones.filter((tone) => tone === "wrong").length;
  const empty = puzzle.givens.filter((given, cell) => !given && !(mine[cell] ?? 0)).length;
  // The solution with every cell you didn't get right ringed ("missed").
  const solutionTones = solution.map((value, cell) =>
    puzzle.givens[cell] ? "given" : (mine[cell] ?? 0) === value ? "entry" : "missed",
  ) as CellTone[];

  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-reveal-pair">
          <div className="logic-reveal-col">
            <span className="logic-reveal-label">Solution</span>
            <div className="logic-square-bare logic-sudoku-frame">
              <SudokuGrid values={solution} tones={solutionTones} />
            </div>
          </div>
          <div className="logic-reveal-col">
            <span className="logic-reveal-label">Yours</span>
            <div className="logic-square-bare logic-sudoku-frame">
              <SudokuGrid values={yours.values} tones={yours.tones} />
            </div>
          </div>
        </div>
      </div>
      <RevealFacts
        items={[
          { label: `Right of ${blanks}`, value: yours.correct, tone: "good" },
          { label: "Wrong", value: wrong, tone: wrong ? "bad" : undefined },
          { label: "Empty", value: empty },
        ]}
      />
    </div>
  );
}

/** The one grid the givens allow stays server-side until the reveal. */
export const miniSudokuPuzzle: PuzzleDefinition = {
  key: "sudoku",
  name: gameDisplayName("sudoku"),
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
