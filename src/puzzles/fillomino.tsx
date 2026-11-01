import { gameDisplayName } from "@/lib/duel/gameNames";
import { solutionProgress } from "@/lib/duel/progressFigures";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { useGridPointer } from "@/components/puzzles/GridDrag";
import { useStageState } from "@/lib/duel/stageState";
import {
  FILLOMINO_MAX_N,
  decodeFillomino,
  encodeFillomino,
  fillominoComplete,
  fillominoOversized,
  fillominoSolvedGrid,
} from "@/lib/duel/fillomino";
import { FILLOMINO_SIZE, FILLOMINO_TIME_MS, type FillominoPuzzleData } from "@/lib/duel/types";
import { directionOf, useGameKeys } from "@/lib/desktop";
import { playCorrect } from "@/lib/sound";

import { soundCue, useSolveFx } from "./logicFx";
import { LiveSummary, SummaryItem, useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const PAD = Array.from({ length: FILLOMINO_MAX_N }, (_, i) => i + 1);

type Tone = "given" | "entry" | "wrong";

/**
 * The board: one square per cell, a thick line wherever two filled neighbours hold different numbers (region edges),
 * finished regions (size = number) as gold glass, groups past their number in red. Display only: the cells are the
 * pointer's grid (useGridPointer maps the finger to a cell from the board's own box).
 */
export function FillominoBoard({
  size,
  values,
  tones,
  selected,
  small = false,
  pointer,
  checks = true,
}: {
  size: number;
  values: readonly number[];
  tones: readonly Tone[];
  selected?: number | null;
  small?: boolean;
  pointer?: ReturnType<typeof useGridPointer>;
  /** Tint finished regions and flag oversized groups (the live board; the reveal colours by the solution). */
  checks?: boolean;
}) {
  const complete = checks ? fillominoComplete(size, values) : new Set<number>();
  const over = checks ? fillominoOversized(size, values) : new Set<number>();
  const edge = (a: number, b: number | null) => b === null || (values[a]! > 0 && values[b]! > 0 && values[a] !== values[b]);
  return (
    <div
      ref={pointer?.ref}
      {...(pointer ? pointer.handlers : {})}
      data-fillomino-board=""
      className="fillomino-board logic-glass grid h-full w-full select-none overflow-hidden"
      style={{
        ...(pointer?.handlers.style ?? {}),
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        aspectRatio: "1",
        containerType: "inline-size",
      }}
    >
      {values.map((v, cell) => {
        const r = Math.floor(cell / size);
        const c = cell % size;
        const right = c < size - 1 ? cell + 1 : null;
        const down = r < size - 1 ? cell + size : null;
        const thickR = right !== null && edge(cell, right);
        const thickB = down !== null && edge(cell, down);
        const tone = tones[cell] ?? "entry";
        return (
          <div
            key={cell}
            data-cell={cell}
            data-edge-r={thickR ? "" : undefined}
            data-edge-b={thickB ? "" : undefined}
            className={`fillomino-cell flex min-h-0 min-w-0 items-center justify-center ${complete.has(cell) ? "fillomino-done" : ""} ${over.has(cell) || tone === "wrong" ? "fillomino-over" : ""} ${cell === selected ? "fillomino-selected" : ""}`}
            style={{
              borderRightWidth: right === null ? 0 : thickR ? 3 : 1,
              borderBottomWidth: down === null ? 0 : thickB ? 3 : 1,
              "--fm-i": (r + c) % 12,
            } as CSSProperties}
          >
            {v ? (
              <span
                className={`fillomino-num font-display font-bold leading-none ${tone === "given" ? "fillomino-given" : "fillomino-entry"}`}
                style={{ fontSize: small ? `max(9px, calc(100cqw / ${size} * 0.5))` : `calc(100cqw / ${size} * 0.52)` }}
              >
                {v}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Fixed intro example — never randomised: a solved corner and a region being painted. */
const EXAMPLE_GIVENS = [
  3, 0, 1, 0, 0, 0, 4,
  0, 2, 0, 5, 0, 0, 0,
  1, 0, 0, 0, 4, 0, 5,
  0, 6, 0, 3, 0, 0, 0,
  0, 0, 0, 0, 2, 1, 0,
  5, 0, 0, 4, 0, 0, 3,
  0, 0, 0, 0, 0, 1, 0,
];
const EXAMPLE_ENTRIES = [
  0, 3, 0, 4, 4, 4, 0,
  3, 0, 2, 0, 5, 5, 0,
  0, 4, 4, 4, 0, 5, 0,
  0, 0, 6, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
];

function IntroExample() {
  const values = EXAMPLE_GIVENS.map((g, c) => g || EXAMPLE_ENTRIES[c]!);
  const tones = EXAMPLE_GIVENS.map((g) => (g ? "given" : "entry")) as Tone[];
  return (
    <div style={{ width: 168 }}>
      <div className="logic-glass-frame">
        <FillominoBoard size={FILLOMINO_SIZE} values={values} tones={tones} small />
      </div>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: FillominoPuzzleData | null = puzzle.type === "fillomino" ? puzzle : null;
  const size = data?.size ?? FILLOMINO_SIZE;
  const givens = useMemo(() => data?.givens ?? new Array<number>(size * size).fill(0), [data, size]);
  const [entries, setEntries] = useStageState<number[]>(stateKey ?? "fillomino", "fillominoValues", () => new Array<number>(size * size).fill(0));
  const [selected, setSelected] = useState<number | null>(null);
  const submitted = useRef(false);
  const drag = useRef<{ from: number; value: number; last: number; moved: boolean } | null>(null);

  const values = useMemo(() => givens.map((g, c) => (g ? g : (entries[c] ?? 0))), [givens, entries]);
  const encoded = encodeFillomino(values);
  const solved = Boolean(data) && fillominoSolvedGrid(size, values);
  const solving = useSolveFx("fillomino", solved);
  const blanks = givens.filter((g) => !g).length;
  const filled = givens.reduce((n, g, c) => n + (!g && values[c] ? 1 : 0), 0);
  const inFrame = useFrameProgress(filled, blanks, "filled");
  const doneCount = fillominoComplete(size, values).size;

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current || !solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encoded, locked]);

  const active = !locked && data !== null;

  /** Sets cells to a number (0 clears), never a given; one cue for the change. */
  const write = (cells: number[], value: number) => {
    if (!active || submitted.current) return;
    const next = [...entries];
    let changed = false;
    for (const c of cells) {
      if (givens[c] || next[c] === value) continue;
      next[c] = value;
      changed = true;
    }
    if (!changed) return;
    if (value) {
      const before = fillominoComplete(size, values).size;
      const after = fillominoComplete(size, givens.map((g, c) => (g ? g : (next[c] ?? 0)))).size;
      soundCue(after > before ? "fillomino.region" : "fillomino.place");
    }
    setEntries(next);
  };

  const pointer = useGridPointer({
    cols: size,
    rows: size,
    onCell: active
      ? (cell) => {
          const d = drag.current;
          if (!d) {
            drag.current = { from: cell, value: values[cell] ?? 0, last: cell, moved: false };
            setSelected(cell);
            return;
          }
          if (cell === d.last) return;
          d.last = cell;
          d.moved = true;
          // Dragging from a number paints it over the squares crossed (givens stay as they are).
          if (d.value) write([cell], d.value);
        }
      : undefined,
    onRelease: () => {
      const d = drag.current;
      drag.current = null;
      if (d?.moved && d.value) setSelected(d.last);
    },
  });

  const enter = (digit: number) => {
    if (selected === null) return;
    write([selected], givens[selected] ? 0 : entries[selected] === digit ? 0 : digit);
  };
  const clear = () => {
    if (selected !== null) write([selected], 0);
  };

  // Desktop keys: arrows (WASD) move the selected square, 1–9 enter that number, Backspace or Delete clear it.
  useGameKeys((kind, key, event) => {
    if (!data) return false;
    const dir = directionOf(key);
    const digit = /^[1-9]$/.test(key) ? Number(key) : null;
    const used = dir !== null || digit !== null || key === "Backspace" || key === "Delete";
    if (!used || kind !== "down" || locked) return used;
    if (dir) {
      const from = selected ?? 0;
      let row = Math.floor(from / size);
      let col = from % size;
      if (selected !== null) {
        if (dir === "up") row = Math.max(0, row - 1);
        else if (dir === "down") row = Math.min(size - 1, row + 1);
        else if (dir === "left") col = Math.max(0, col - 1);
        else col = Math.min(size - 1, col + 1);
      }
      setSelected(row * size + col);
    } else if (digit !== null) {
      if (!event.repeat) enter(digit);
    } else clear();
    return true;
  });

  if (!data) return null;
  const tones = givens.map((g) => (g ? "given" : "entry")) as Tone[];

  return (
    <div data-logic-stage="fillomino" data-logic-solved={solving ? "" : undefined} data-stage-column="3" className="relative flex min-h-0 flex-1 flex-col gap-3">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic" className="px-3">
        {inFrame ? null : (
          <p className="logic-status font-mono text-xs uppercase tracking-widest text-muted-foreground">
            filled <span className="text-primary">{filled}</span> / {blanks}
          </p>
        )}
        <div className="logic-square logic-glass-frame fillomino-frame">
          <FillominoBoard size={size} values={values} tones={tones} selected={locked ? null : selected} pointer={pointer} />
        </div>
        <LiveSummary
          inArena
          className="logic-status"
          items={[<SummaryItem key="done" label="Squares in finished regions" value={`${doneCount} / ${size * size}`} />]}
        />
      </div>
      <div data-game-controls="numbers" className="fillomino-pad flex shrink-0 flex-col gap-1.5">
        <div className="grid grid-cols-5 gap-1.5">
          {PAD.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => enter(digit)}
              disabled={locked}
              className={`fillomino-key press tap-target rounded-lg py-2 font-display text-lg font-bold text-foreground disabled:opacity-40 ${inFrame ? "gf-glass" : "border border-border bg-card"}`}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={clear}
            disabled={locked}
            className={`fillomino-key press tap-target rounded-lg py-2 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40 ${inFrame ? "gf-glass" : "border border-border bg-card"}`}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "fillomino") return null;
  const solution = puzzle.solution ?? puzzle.givens;
  const mine = decodeFillomino(myAnswer ?? "", puzzle);
  const solTones = puzzle.givens.map((g) => (g ? "given" : "entry")) as Tone[];
  const myTones = mine.map((v, c) => (puzzle.givens[c] ? "given" : v && v !== solution[c] ? "wrong" : "entry")) as Tone[];
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-pair">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
            <div className="logic-glass-frame w-full">
              <FillominoBoard size={puzzle.size} values={solution} tones={solTones} small />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
            <div className="logic-glass-frame w-full">
              <FillominoBoard size={puzzle.size} values={mine} tones={myTones} small checks={false} />
            </div>
          </div>
        </div>
      </div>
      <p className="logic-reveal-text text-center font-mono text-primary">
        {myCorrect ? `Solved · ${(elapsed / 1000).toFixed(1)}s` : (solutionProgress(puzzle, myAnswer ?? "")?.text ?? "Not solved")}
      </p>
    </div>
  );
}

/** The unique solution stays server-side until the reveal. */
export const fillominoPuzzle: PuzzleDefinition = {
  key: "fillomino",
  name: gameDisplayName("fillomino"),
  category: "logic",
  timeLimitMs: FILLOMINO_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "fillomino", fillominoRev: 1, size: FILLOMINO_SIZE, givens: new Array<number>(FILLOMINO_SIZE * FILLOMINO_SIZE).fill(0) }) satisfies FillominoPuzzleData,
  check: (answer, puzzle) => puzzle.type === "fillomino" && fillominoSolvedGrid(puzzle.size, decodeFillomino(answer, puzzle)),
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
