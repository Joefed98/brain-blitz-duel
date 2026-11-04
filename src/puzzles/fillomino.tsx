import { gameDisplayName } from "@/lib/duel/gameNames";
import { solutionProgress } from "@/lib/duel/progressFigures";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { useGridPointer } from "@/components/puzzles/GridDrag";
import { useStageState } from "@/lib/duel/stageState";
import {
  FILLOMINO_MAX_N,
  decodeFillomino,
  encodeFillomino,
  fillominoComplete,
  fillominoGroups,
  fillominoNeighbours,
  fillominoOversized,
  fillominoSolvedGrid,
} from "@/lib/duel/fillomino";
import { FILLOMINO_SIZE, FILLOMINO_TIME_MS, type FillominoPuzzleData } from "@/lib/duel/types";
import { directionOf, useGameKeys } from "@/lib/desktop";
import { playCorrect } from "@/lib/sound";

import { soundCue, useSolveFx } from "./logicFx";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { HudPills } from "@/components/puzzles/HudPills";
import "@/polish-layout/polish-nov3-logic.css";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const PAD = Array.from({ length: FILLOMINO_MAX_N }, (_, i) => i + 1);

type Tone = "given" | "entry" | "wrong";

/** The calm shades a finished region can take (display only; never "correct", just "the right size"). */
export const FILLOMINO_SHADES = 5;

/**
 * Finished regions' shades (display only): `shade[cell]` is 0…FILLOMINO_SHADES−1 for a cell in a group of exactly its
 * number, −1 elsewhere. Touching finished regions always get different shades. Deterministic: the regions are taken in
 * order of their smallest cell, each given the lowest shade its already-shaded neighbours leave free, with backtracking
 * when one is boxed in (the region map is planar, so 4 shades always exist; 5 leaves room). Pure; integers only.
 */
export function fillominoShades(size: number, values: readonly number[], shades = FILLOMINO_SHADES): number[] {
  const out = new Array<number>(size * size).fill(-1);
  const { group, cells } = fillominoGroups(size, values);
  // Finished groups only, in order of their smallest cell (groups are found scanning cells in order, so already so).
  const done = cells.flatMap((members, id) => (members.length === values[members[0]!] ? [id] : []));
  if (!done.length) return out;
  const index = new Map<number, number>(done.map((id, i) => [id, i]));
  const adj: number[][] = done.map(() => []);
  done.forEach((id, i) => {
    const seen = new Set<number>();
    for (const c of cells[id]!) {
      for (const nb of fillominoNeighbours(size, c)) {
        const j = index.get(group[nb]!);
        if (j === undefined || j === i || seen.has(j)) continue;
        seen.add(j);
        adj[i]!.push(j);
      }
    }
  });
  const colour = new Array<number>(done.length).fill(-1);
  const place = (i: number): boolean => {
    if (i === done.length) return true;
    for (let k = 0; k < shades; k++) {
      if (adj[i]!.some((j) => colour[j] === k)) continue;
      colour[i] = k;
      if (place(i + 1)) return true;
    }
    colour[i] = -1;
    return false;
  };
  if (!place(0)) {
    // Unreachable on a grid (planar); kept total: fall back to the plain greedy pass, shades cycling.
    for (let i = 0; i < done.length; i++) {
      let k = 0;
      while (k < shades && adj[i]!.some((j) => colour[j] === k)) k++;
      colour[i] = k % shades;
    }
  }
  done.forEach((id, i) => {
    for (const c of cells[id]!) out[c] = colour[i]!;
  });
  return out;
}

/**
 * The board: one square per cell, a thick line wherever two filled neighbours hold different numbers (region edges),
 * finished regions (size = number) tinted in calm shades (touching ones never alike; "the right size", never
 * "correct"), groups past their number in red. Display only: the cells are the
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
  const shade = checks ? fillominoShades(size, values) : null;
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
            data-shade={shade && shade[cell]! >= 0 ? shade[cell] : undefined}
            className={`fillomino-cell flex min-h-0 min-w-0 items-center justify-center ${shade && shade[cell]! >= 0 ? "fillomino-done" : ""} ${over.has(cell) || tone === "wrong" ? "fillomino-over" : ""} ${cell === selected ? "fillomino-selected" : ""}`}
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

/** The pad's tool: a number to paint (1–9) or the eraser (0). */
const ERASER = 0;

function EraserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.2 3.8 21 8.6a1.6 1.6 0 0 1 0 2.3L12.4 19.5H7.6L3 14.9a1.6 1.6 0 0 1 0-2.3L13.9 3.8a1.6 1.6 0 0 1 2.3 0Z" />
      <path d="m9.2 7.6 7.2 7.2" />
      <path d="M12.4 19.5H21" />
    </svg>
  );
}

/**
 * Number first (3 Nov 2026, display and input only; the answer is encodeFillomino(values) as before): pick a number on
 * the pad (1 at the start; it stays picked) or the eraser, then tap or drag across squares. The first square of a
 * stroke decides it: on an entry already holding the picked number the stroke clears that number from the squares it
 * crosses, otherwise it paints them (givens never change); the eraser clears. Undo takes back a whole stroke, Reset
 * clears every entry (one undoable step). Keys: 1–9 pick a number, 0 / E / Backspace / Delete the eraser, the arrows
 * move a cursor and Enter / Space use the tool on it.
 */
function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: FillominoPuzzleData | null = puzzle.type === "fillomino" ? puzzle : null;
  const size = data?.size ?? FILLOMINO_SIZE;
  const givens = useMemo(() => data?.givens ?? new Array<number>(size * size).fill(0), [data, size]);
  const [entries, setEntries] = useStageState<number[]>(stateKey ?? "fillomino", "fillominoValues", () => new Array<number>(size * size).fill(0));
  const [tool, setTool] = useState<number>(1);
  const [history, setHistory] = useState<number[][]>([]);
  /** The desktop keyboard's cursor (null until an arrow key; a phone never shows it). */
  const [cursor, setCursor] = useState<number | null>(null);
  const submitted = useRef(false);
  /** The entries as last written (several squares can be crossed between renders). */
  const live = useRef(entries);
  live.current = entries;
  const stroke = useRef<{ before: number[]; mode: "paint" | "clear"; value: number; last: number } | null>(null);

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
  const full = (list: readonly number[]) => givens.map((g, c) => (g ? g : (list[c] ?? 0)));

  /** One square under the stroke's rule; one cue for a change. */
  const apply = (cell: number, mode: "paint" | "clear", value: number) => {
    if (!active || submitted.current || givens[cell]) return;
    const cur = live.current;
    const now = cur[cell] ?? 0;
    const next = mode === "paint" ? value : value === ERASER || now === value ? 0 : now;
    if (next === now) return;
    const list = [...cur];
    list[cell] = next;
    if (next) {
      const before = fillominoComplete(size, full(cur)).size;
      const after = fillominoComplete(size, full(list)).size;
      soundCue(after > before ? "fillomino.region" : "fillomino.place");
    }
    live.current = list;
    setEntries(list);
  };

  const begin = (cell: number) => {
    const now = givens[cell] ? 0 : (live.current[cell] ?? 0);
    const mode: "paint" | "clear" = tool === ERASER || now === tool ? "clear" : "paint";
    stroke.current = { before: [...live.current], mode, value: tool, last: cell };
    apply(cell, mode, tool);
  };
  const end = () => {
    const s = stroke.current;
    stroke.current = null;
    if (s && s.before.some((v, c) => v !== (live.current[c] ?? 0))) setHistory((h) => [...h, s.before]);
  };

  const pointer = useGridPointer({
    cols: size,
    rows: size,
    onCell: active
      ? (cell) => {
          const s = stroke.current;
          if (!s) return begin(cell);
          if (cell === s.last) return;
          s.last = cell;
          apply(cell, s.mode, s.value);
        }
      : undefined,
    onRelease: end,
  });

  const canUndo = active && history.length > 0;
  const anyEntry = entries.some((v, c) => v && !givens[c]);
  const undo = () => {
    if (!canUndo || submitted.current) return;
    const prev = history[history.length - 1]!;
    setHistory((h) => h.slice(0, -1));
    live.current = prev;
    setEntries(prev);
  };
  const reset = () => {
    if (!active || submitted.current || !anyEntry) return;
    setHistory((h) => [...h, [...live.current]]);
    const cleared = new Array<number>(size * size).fill(0);
    live.current = cleared;
    setEntries(cleared);
  };

  // Desktop keys: 1–9 pick a number, 0 / E / Backspace / Delete the eraser; the arrows (WASD) move a cursor and
  // Enter / Space use the tool on it (one stroke, so one undo step).
  useGameKeys((kind, key, event) => {
    if (!data) return false;
    const dir = directionOf(key);
    const digit = /^[1-9]$/.test(key) ? Number(key) : null;
    const eraser = key === "0" || key === "e" || key === "E" || key === "Backspace" || key === "Delete";
    const use = key === "Enter" || key === " ";
    const used = dir !== null || digit !== null || eraser || use;
    if (!used || kind !== "down" || locked) return used;
    if (dir) {
      const from = cursor ?? 0;
      let row = Math.floor(from / size);
      let col = from % size;
      if (cursor !== null) {
        if (dir === "up") row = Math.max(0, row - 1);
        else if (dir === "down") row = Math.min(size - 1, row + 1);
        else if (dir === "left") col = Math.max(0, col - 1);
        else col = Math.min(size - 1, col + 1);
      }
      setCursor(row * size + col);
    } else if (digit !== null) setTool(digit);
    else if (eraser) setTool(ERASER);
    else if (cursor !== null && !event.repeat) {
      begin(cursor);
      end();
    }
    return true;
  });

  if (!data) return null;
  const tones = givens.map((g) => (g ? "given" : "entry")) as Tone[];
  const keyLook = (on: boolean) =>
    `fillomino-key press tap-target min-w-0 rounded-lg border px-0 py-0 font-display text-lg font-bold disabled:opacity-40 ${
      on ? "fillomino-key-on border-transparent bg-primary/15 text-primary" : `text-foreground ${inFrame ? "gf-glass border-border" : "border-border bg-card"}`
    }`;

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
          <FillominoBoard size={size} values={values} tones={tones} selected={locked ? null : cursor} pointer={pointer} />
        </div>
        {inFrame ? (
          <HudPills testId="fillomino" className="logic-hud-pills" items={[{ id: "done", label: "In finished regions", value: `${doneCount} / ${size * size}` }]} />
        ) : null}
      </div>
      <div data-game-controls="numbers" className="fillomino-pad grid shrink-0 grid-cols-5 gap-1.5">
        {PAD.map((digit) => (
          <button
            key={digit}
            type="button"
            data-fillomino-tool={digit}
            aria-pressed={tool === digit}
            onClick={() => setTool(digit)}
            disabled={locked}
            className={keyLook(tool === digit)}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          data-fillomino-tool="eraser"
          aria-label="Eraser"
          aria-pressed={tool === ERASER}
          onClick={() => setTool(ERASER)}
          disabled={locked}
          className={`${keyLook(tool === ERASER)} flex items-center justify-center`}
        >
          <EraserIcon />
        </button>
      </div>
      <div data-game-controls="actions" className="fillomino-actions flex shrink-0 gap-3">
        <Button
          variant="outline"
          type="button"
          disabled={!canUndo}
          onClick={undo}
          className="gf-glass h-11 flex-1 rounded-lg border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-foreground disabled:opacity-40"
        >
          Undo
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={!active || !anyEntry}
          onClick={reset}
          className="gf-glass h-11 flex-1 rounded-lg border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </Button>
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
