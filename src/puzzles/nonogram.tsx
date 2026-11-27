import { gameDisplayName } from "@/lib/duel/gameNames";
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import {
  decodeNonoCells,
  encodeNonoCells,
  lineSatisfied,
  nonoCellsOf,
  nonoDimsOf,
  nonoSizeOf,
  type NonoMarks,
} from "@/lib/duel/nonogram";
import { useStageState } from "@/lib/duel/stageState";
import { NONO_SIZE, NONO_TIME_MS, type NonoPuzzleData } from "@/lib/duel/types";
import { playLock } from "@/lib/sound";

import { soundCue, useSolveFx } from "./logicFx";
import { RevealFacts } from "./logicReveal";
import { lightCells } from "./logicMotion";
import { gameFx } from "@/lib/fx/kit";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import "@/polish-layout/polish-nov3-logic.css";
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
  onPaint,
  cell = 40,
  fluid = false,
  goldCells,
  wrongCells,
  missedCells,
  reveal = false,
  tapped,
}: {
  rows: number[][];
  cols: number[][];
  marks: NonoMarks;
  size?: number;
  onCell?: (index: number) => void;
  /** Drag to paint (Logic overhaul 1): a drag that moves onto another cell paints it as the first cell was. */
  onPaint?: (index: number) => void;
  cell?: number;
  fluid?: boolean;
  goldCells?: Set<number>;
  wrongCells?: Set<number>;
  /** The reveal's "Yours" board: squares of the picture you left empty (outlined). */
  missedCells?: Set<number>;
  /** Reveal: fluid cells, 12px clues, finished lines not dimmed. */
  reveal?: boolean;
  /** The cell that was just tapped, keyed per tap (its tile pops). */
  tapped?: { index: number; key: number } | null;
}) {
  // A level's board is grown downwards (the Logic overhaul's levels): W columns by H rows, from the clue lists.
  const W = cols.length || size;
  const H = rows.length || size;
  const cellsOf = (line: "row" | "col", index: number) =>
    line === "row"
      ? Array.from({ length: W }, (_, other) => marks[index * W + other] === 1)
      : Array.from({ length: H }, (_, other) => marks[other * W + index] === 1);

  // Drag to paint: while a pointer that went down on a cell is held, the cells it crosses are painted.
  const painting = useRef(false);
  useEffect(() => {
    const up = () => { painting.current = false; };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, []);
  const onMove = onPaint
    ? (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!painting.current) return;
        const el = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
        const at = el?.closest<HTMLElement>("[data-nono-index]")?.dataset["nonoIndex"];
        if (at !== undefined) onPaint(Number(at));
      }
    : undefined;

  return (
    <div
      onPointerMove={onMove}
      data-nono-paint={onPaint ? "" : undefined}
      data-nono-tall={W !== H ? "" : undefined}
      className={`logic-nono grid gap-0 ${fluid ? "logic-nonogram-board" : ""} ${reveal ? "logic-nono-reveal w-full" : ""}`}
      style={{
        gridTemplateColumns: fluid ? `1.15fr repeat(${W}, minmax(0, 1fr))` : reveal ? `auto repeat(${W}, minmax(0, 1fr))` : `auto repeat(${W}, ${cell}px)`,
        gridTemplateRows: fluid ? `auto repeat(${H}, minmax(0, 1fr))` : reveal ? `auto repeat(${H}, auto)` : `auto repeat(${H}, ${cell}px)`,
        ...(W !== H ? ({ "--nono-w": W, "--nono-h": H } as CSSProperties) : {}),
        // The polish plan's G5 (A2, 21 Nov 2026): one board at a time on the reveal stage (the shared switch), so its clues
        // grow with the stage's width (12 px was sized for two boards side by side).
        ...(reveal ? { fontSize: "clamp(12px, 4cqw, 16px)" } : {}),
      }}
    >
      <span />
      {cols.map((clue, col) => {
        const guide = H >= 10 && (col + 1) % 5 === 0 && col + 1 !== W;
        return (
          <span
            key={`c${col}`}
            data-clue={`c${col}`}
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
        const rowGuide = H >= 10 && (row + 1) % 5 === 0 && row + 1 !== H;
        return (
        <Fragment key={`r${row}`}>
          <span
            data-runs={clue.length}
            data-clue={`r${row}`}
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
          {Array.from({ length: W }, (_, col) => {
            const index = row * W + col;
            const mark = marks[index] ?? 0;
            const gold = goldCells?.has(index);
            const wrong = wrongCells?.has(index);
            const missed = missedCells?.has(index);
            const colGuide = H >= 10 && (col + 1) % 5 === 0 && col + 1 !== W;
            const popped = tapped?.index === index;
            return (
              <button
                key={popped ? `${index}-${tapped?.key}` : index}
                type="button"
                // 7 Nov 2026 (accessibility audit #16): the cell's state in its name (it was only its place).
                aria-label={`Row ${row + 1} column ${col + 1}, ${gold ? "filled" : mark === 1 ? "filled" : mark === 2 ? "crossed" : "empty"}${wrong ? ", wrong" : ""}${missed ? ", missed" : ""}`}
                data-nono-index={index}
                data-missed={missed ? "" : undefined}
                onPointerDown={onCell ? (event) => {
                  // Touch pointers capture to the cell they started on; release it so the drag reaches the others.
                  (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
                  painting.current = Boolean(onPaint);
                  onCell(index);
                } : undefined}
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
        The numbers are the run lengths: this one is a diamond. Tap or drag to fill.
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
  // 7 × 7 before the depth revision, 8 × 8 on it (the clue count); a level's board W × H (nonoDimsOf).
  const SIZE = nonoSizeOf(data);
  const { w: W, h: H } = nonoDimsOf(data);
  const [marks, setMarks] = useStageState<NonoMarks>(
    stateKey,
    "nonoMarks",
    () => Array.from({ length: W * H }, () => 0) as NonoMarks,
  );
  const [tapped, setTapped] = useState<{ index: number; key: number } | null>(null);
  const submitted = useRef(false);
  const paintValue = useRef<NonoMarks[number]>(1);
  const paintRun = useRef(0);
  const painted = useRef(new Set<number>());

  useEffect(() => {
    onDraftAnswer?.(encodeNonoCells(marks));
  }, [marks, onDraftAnswer]);

  const complete = useMemo(() => {
    if (!data) return false;
    const filledRow = (row: number) =>
      Array.from({ length: W }, (_, col) => marks[row * W + col] === 1);
    const filledCol = (col: number) =>
      Array.from({ length: H }, (_, row) => marks[row * W + col] === 1);
    return (
      data.rows.every((clue, row) => lineSatisfied(clue, filledRow(row))) &&
      data.cols.every((clue, col) => lineSatisfied(clue, filledCol(col)))
    );
  }, [data, marks, W, H]);
  const solving = useSolveFx("nonogram", complete);
  const linesDone = useMemo(() => {
    if (!data) return 0;
    const line = (cells: number[]) => cells.map((cell) => marks[cell] === 1);
    const across = Array.from({ length: W }, (_, i) => i);
    const down = Array.from({ length: H }, (_, i) => i);
    return (
      data.rows.filter((clue, row) => lineSatisfied(clue, line(across.map((col) => row * W + col)))).length +
      data.cols.filter((clue, col) => lineSatisfied(clue, line(down.map((row) => row * W + col)))).length
    );
  }, [data, marks, W, H]);
  useFrameProgress(linesDone, W + H, "lines");

  // A line that now matches its numbers: its clue lights with a chime; two or more at once are a combo
  // (Logic overhaul 1; the clue turning gold only when the line is truly right needs the solution: the levels stage).
  const boardRef = useRef<HTMLDivElement>(null);
  const doneLines = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!data) return;
    const line = (cells: number[]) => cells.map((cell) => marks[cell] === 1);
    const across = Array.from({ length: W }, (_, i) => i);
    const down = Array.from({ length: H }, (_, i) => i);
    const now = new Set<string>([
      ...data.rows.flatMap((clue, row) => (lineSatisfied(clue, line(across.map((col) => row * W + col))) ? [`r${row}`] : [])),
      ...data.cols.flatMap((clue, col) => (lineSatisfied(clue, line(down.map((row) => row * W + col))) ? [`c${col}`] : [])),
    ]);
    const before = doneLines.current;
    doneLines.current = now;
    // The first pass only learns what already matches (an empty line of a "0" clue, a restored board).
    if (!before || complete) return;
    const fresh = [...now].filter((key) => !before.has(key));
    if (!fresh.length) return;
    // Easy (`lockLines`): a line that now matches its numbers crosses its empty squares (still changeable: only the
    // server knows the picture, so a matching line is never locked as right).
    if (data.lockLines) {
      const cross = new Set<number>();
      for (const key of fresh) {
        const n = Number(key.slice(1));
        const cells = key[0] === "r" ? across.map((col) => n * W + col) : down.map((row) => row * W + n);
        for (const c of cells) if ((marks[c] ?? 0) === 0) cross.add(c);
      }
      if (cross.size) {
        setMarks((current) => current.map((m, at) => (cross.has(at) ? 2 : m)) as NonoMarks);
        soundCue("nonogram.autoCross");
      }
    }
    lightCells(fresh.map((key) => boardRef.current?.querySelector<HTMLElement>(`[data-clue="${key}"]`)), 0);
    // Two lines or more at once play the combo in the line sound's place (one sound a moment).
    if (fresh.length > 1) soundCue("nonogram.combo");
    else soundCue("nonogram.line");
    if (fresh.length > 1) gameFx("combo", boardRef.current?.querySelector(`[data-clue="${fresh[0]}"]`), { count: fresh.length, silent: true });
  }, [data, marks, W, H, complete]);

  // Every line matching its clues means the picture is the stored one.
  useEffect(() => {
    if (!data || locked || submitted.current || !complete) return;
    submitted.current = true;
    playLock();
    onSubmit(encodeNonoCells(marks));
  }, [complete, data, locked, marks, onSubmit]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + (data.timeLimitMs ?? NONO_TIME_MS) - 400) return;
    submitted.current = true;
    onSubmit(encodeNonoCells(marks));
  }, [now, phaseStartedAt, locked, data, marks, onSubmit]);

  if (!data) return null;

  const tap = (index: number) => {
    if (locked || submitted.current) return;
    const next = (((marks[index] ?? 0) + 1) % 3) as NonoMarks[number];
    // The first square decides what a drag paints: fill, × or clear.
    paintValue.current = next;
    paintRun.current = 0;
    painted.current = new Set([index]);
    soundCue(next === 1 ? "nonogram.fill" : next === 2 ? "nonogram.mark" : "nonogram.clear");
    setTapped((current) => ({ index, key: (current?.key ?? 0) + 1 }));
    setMarks(marks.map((mark, at) => (at === index ? next : mark)) as NonoMarks);
  };

  const paint = (index: number) => {
    if (locked || submitted.current) return;
    const value = paintValue.current;
    if ((marks[index] ?? 0) === value || painted.current.has(index)) return;
    painted.current.add(index);
    paintRun.current += 1;
    // A rising tick per square painted (the cue carries the run's length for the pitch).
    // A rising tick per square painted (the run's length raises the pitch).
    soundCue(value === 1 ? "nonogram.paint" : value === 2 ? "nonogram.mark" : "nonogram.clear", Math.min(1.6, 1 + paintRun.current * 0.05));
    setTapped((current) => ({ index, key: (current?.key ?? 0) + 1 }));
    setMarks((current) => current.map((mark, at) => (at === index ? value : mark)) as NonoMarks);
  };

  return (
    <div data-logic-stage="nonogram" data-logic-solved={solving ? "" : undefined} data-stage-column="3" className="relative flex min-h-0 flex-1 flex-col gap-3">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic" className="px-3">
        <div
          ref={boardRef}
          className="logic-nono-fit logic-nono-frame"
          data-nono-tall={W !== H ? "" : undefined}
          style={W !== H ? ({ "--nono-w": W, "--nono-h": H } as CSSProperties) : undefined}
        >
          <Board rows={data.rows} cols={data.cols} marks={marks} size={SIZE} onCell={tap} onPaint={paint} fluid tapped={tapped} />
        </div>
      </div>
    </div>
  );
}

/**
 * The reveal (Logic overhaul 1, 15 Nov 2026): one big board at a time through the shared Solution / Yours switch. Yours
 * shows your filled squares, the wrong ones red and the picture's squares you left empty outlined. Under it, the numbers
 * behind the score: squares right, wrong and missed.
 */
function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "nonogram") return null;
  const pattern = puzzle.pattern ?? [];
  const size = nonoSizeOf(puzzle);
  const filled = decodeNonoCells(myAnswer ?? "", size, nonoCellsOf(puzzle));
  const mine = new Set(filled);
  const correct = filled.filter((cell) => pattern[cell]).length;
  const total = pattern.filter(Boolean).length;

  const solutionMarks = pattern.map((cell) => (cell ? 1 : 0)) as NonoMarks;
  const myMarks = Array.from({ length: nonoCellsOf(puzzle) }, (_, index) =>
    mine.has(index) ? 1 : 0,
  ) as NonoMarks;
  const wrongCells = new Set(filled.filter((cell) => !pattern[cell]));
  const missedCells = new Set(pattern.flatMap((cell, index) => (cell && !mine.has(index) ? [index] : [])));

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
              missedCells={missedCells}
              reveal
            />
          </div>
        </div>
      </div>
      <RevealFacts
        items={[
          { label: `Right of ${total}`, value: correct, tone: correct === total && !wrongCells.size ? "good" : undefined },
          { label: "Wrong", value: wrongCells.size, tone: wrongCells.size ? "bad" : undefined },
          { label: "Missed", value: missedCells.size },
        ]}
      />
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
