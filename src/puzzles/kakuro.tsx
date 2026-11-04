import { gameDisplayName } from "@/lib/duel/gameNames";
import { solutionProgress } from "@/lib/duel/progressFigures";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";

import { useStageState } from "@/lib/duel/stageState";
import { decodeKakuro, encodeKakuro, kakuroRuns, kakuroRunState, kakuroSolvedGrid, type KakuroRun } from "@/lib/duel/kakuro";
import { KAKURO_SIZE, KAKURO_TIME_MS, type KakuroPuzzleData } from "@/lib/duel/types";
import { directionOf, useGameKeys } from "@/lib/desktop";
import { playCorrect } from "@/lib/sound";

import { soundCue, useSolveFx } from "./logicFx";
import { LiveSummary, SummaryItem, useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

type Board = Pick<KakuroPuzzleData, "size" | "white" | "clues">;
type Tone = "entry" | "wrong" | "missing" | "given";

/** Per white cell: the runs through it (across first). */
function runsByCell(runs: readonly KakuroRun[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  runs.forEach((run, i) => {
    for (const c of run.cells) out.set(c, [...(out.get(c) ?? []), i]);
  });
  return out;
}

/**
 * The board: a size × size grid of black clue cells (split diagonally, the down sum bottom-left, the across sum
 * top-right) and white cells. Display only: every state shown here is computed by the stage from the rules.
 */
export function KakuroBoard({
  board,
  values,
  pencil,
  selected,
  onSelect,
  tones,
  small = false,
  placed,
}: {
  board: Board;
  values: readonly number[];
  pencil?: readonly number[][] | undefined;
  selected?: number | null | undefined;
  onSelect?: ((cell: number) => void) | undefined;
  tones?: readonly Tone[] | undefined;
  small?: boolean;
  /** The cell that just took a digit (it pops in). */
  placed?: number | null | undefined;
}) {
  const { size } = board;
  const runs = useMemo(() => kakuroRuns(board), [board]);
  const byCell = useMemo(() => runsByCell(runs), [runs]);
  const white = useMemo(() => new Set(board.white), [board.white]);
  const clueAt = useMemo(() => new Map(board.clues.map((c) => [c.cell, c])), [board.clues]);
  const states = runs.map((run) => kakuroRunState(run, values));
  const lit = new Set<number>(selected !== null && selected !== undefined ? (byCell.get(selected) ?? []) : []);
  // A clue's state: its across run (top-right) and down run (bottom-left).
  const runOf = new Map<string, number>();
  runs.forEach((run, i) => runOf.set(`${run.clue}:${run.across ? "a" : "d"}`, i));
  const sumClass = (i: number | undefined) =>
    i === undefined ? "" : states[i] === "done" ? "kakuro-sum-done" : states[i] === "bad" ? "kakuro-sum-bad" : lit.has(i) ? "kakuro-sum-lit" : "";

  return (
    <div
      className={`kakuro-board logic-glass grid w-full shrink-0 select-none ${small ? "kakuro-small" : ""}`}
      style={{
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        aspectRatio: "1",
        gap: small ? 1 : 2,
        containerType: "inline-size",
        "--kakuro-n": size,
      } as CSSProperties}
    >
      {Array.from({ length: size * size }, (_, cell) => {
        const row = Math.floor(cell / size);
        const col = cell % size;
        const place = { gridRow: row + 1, gridColumn: col + 1 };
        if (!white.has(cell)) {
          const clue = clueAt.get(cell);
          return (
            <div key={cell} className={`kakuro-black ${clue ? "kakuro-clue" : ""}`} style={place} aria-hidden="true">
              {clue ? (
                <>
                  <span className="kakuro-diag" />
                  {clue.right > 0 ? <span className={`kakuro-sum kakuro-sum-right ${sumClass(runOf.get(`${cell}:a`))}`}>{clue.right}</span> : null}
                  {clue.down > 0 ? <span className={`kakuro-sum kakuro-sum-down ${sumClass(runOf.get(`${cell}:d`))}`}>{clue.down}</span> : null}
                </>
              ) : null}
            </div>
          );
        }
        const mine = byCell.get(cell) ?? [];
        const done = mine.some((i) => states[i] === "done");
        const bad = mine.some((i) => states[i] === "bad");
        const value = values[cell] ?? 0;
        const tone = tones?.[cell] ?? "entry";
        const marks = pencil?.[cell] ?? [];
        const isSelected = cell === selected;
        const inLit = mine.some((i) => lit.has(i));
        return (
          <button
            key={cell}
            type="button"
            disabled={!onSelect}
            onClick={onSelect ? () => onSelect(cell) : undefined}
            className={`kakuro-cell logic-glass-cell press relative flex min-h-0 min-w-0 items-center justify-center ${isSelected ? "kakuro-selected" : inLit ? "kakuro-lit" : ""} ${done && !tones ? "kakuro-done" : ""} ${bad && !tones ? "kakuro-bad" : ""} kakuro-tone-${tone}`}
            style={{ ...place, "--kakuro-i": row + col } as CSSProperties}
            aria-label={`Row ${row}, column ${col}${value ? `, ${value}` : ""}`}
            data-kakuro-cell={cell}
          >
            {value ? (
              <span key={value} className={`kakuro-digit ${placed === cell ? "kakuro-pop" : ""}`}>
                {value}
              </span>
            ) : marks.length ? (
              <span className="kakuro-marks" aria-hidden="true">
                {DIGITS.map((d) => (
                  <span key={d}>{marks.includes(d) ? d : ""}</span>
                ))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Fixed intro example — never randomised: a real 6 × 6 board, some squares filled. */
const EXAMPLE: Board = {
  size: KAKURO_SIZE,
  white: [7, 8, 9, 13, 14, 15, 16, 17, 19, 20, 22, 23, 25, 26, 27, 28, 31, 32, 33],
  clues: [
    { cell: 1, down: 22, right: 0 },
    { cell: 2, down: 31, right: 0 },
    { cell: 3, down: 15, right: 0 },
    { cell: 6, down: 0, right: 9 },
    { cell: 10, down: 9, right: 0 },
    { cell: 11, down: 11, right: 0 },
    { cell: 12, down: 0, right: 26 },
    { cell: 18, down: 0, right: 17 },
    { cell: 21, down: 15, right: 15 },
    { cell: 24, down: 0, right: 23 },
    { cell: 30, down: 0, right: 13 },
  ],
};
const EXAMPLE_VALUES = [0, 0, 0, 0, 0, 0, 0, 1, 2, 6, 0, 0, 0, 6, 8, 9, 0, 0, 0, 8, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function IntroExample() {
  return (
    <div style={{ width: 164 }}>
      <KakuroBoard board={EXAMPLE} values={EXAMPLE_VALUES} small />
    </div>
  );
}

/** The next white cell from `from` in a direction, skipping black cells; `from` itself when there is none. */
function stepWhite(board: Board, white: ReadonlySet<number>, from: number, dir: "up" | "down" | "left" | "right"): number {
  const { size } = board;
  let r = Math.floor(from / size);
  let c = from % size;
  for (;;) {
    if (dir === "up") r--;
    else if (dir === "down") r++;
    else if (dir === "left") c--;
    else c++;
    if (r < 0 || c < 0 || r >= size || c >= size) return from;
    if (white.has(r * size + c)) return r * size + c;
  }
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: KakuroPuzzleData | null = puzzle.type === "kakuro" ? puzzle : null;
  const size = data?.size ?? KAKURO_SIZE;
  const board: Board = useMemo(() => ({ size, white: data?.white ?? [], clues: data?.clues ?? [] }), [size, data?.white, data?.clues]);
  const white = useMemo(() => new Set(board.white), [board.white]);
  const runs = useMemo(() => kakuroRuns(board), [board]);
  const key = stateKey ?? "kakuro";
  const [values, setValues] = useStageState<number[]>(key, "kakuroValues", () => new Array<number>(size * size).fill(0));
  const [pencil, setPencil] = useStageState<number[][]>(key, "kakuroPencil", () => Array.from({ length: size * size }, () => [] as number[]));
  const [selected, setSelected] = useStageState<number | null>(key, "kakuroSelected", () => null);
  const [pencilMode, setPencilMode] = useStageState<boolean>(key, "kakuroPencilMode", () => false);
  const [placed, setPlaced] = useStageState<number | null>(key, "kakuroPlaced", () => null);
  const submitted = useRef(false);
  const encoded = encodeKakuro(values);
  const solved = data !== null && kakuroSolvedGrid(board, values);
  const solving = useSolveFx("kakuro", solved);
  const filled = board.white.filter((c) => values[c]).length;
  const inFrame = useFrameProgress(filled, board.white.length, "filled");
  const doneRuns = runs.filter((run) => kakuroRunState(run, values) === "done").length;
  const prevDone = useRef(doneRuns);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  // A run completed right (not the last move, which plays the solve): a quiet chime.
  useEffect(() => {
    if (doneRuns > prevDone.current && !solved) soundCue("kakuro.run");
    prevDone.current = doneRuns;
  }, [doneRuns, solved]);

  useEffect(() => {
    if (!data || locked || submitted.current || !solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encoded, locked]);

  const active = !locked && data !== null;

  const tapDigit = (digit: number) => {
    if (!active || submitted.current || selected === null || !white.has(selected)) return;
    if (pencilMode) {
      setPencil((current) =>
        current.map((marks, cell) =>
          cell === selected ? (marks.includes(digit) ? marks.filter((d) => d !== digit) : [...marks, digit].sort((a, b) => a - b)) : marks,
        ),
      );
      return;
    }
    if (values[selected] !== digit) {
      setPlaced(selected);
      soundCue("kakuro.place");
    }
    setValues((current) => current.map((v, cell) => (cell === selected ? (v === digit ? 0 : digit) : v)));
  };

  const clearCell = () => {
    if (!active || submitted.current || selected === null) return;
    setValues((current) => current.map((v, cell) => (cell === selected ? 0 : v)));
    setPencil((current) => current.map((marks, cell) => (cell === selected ? [] : marks)));
  };

  // Desktop keys: arrows (WASD) move between white squares, 1–9 enter, Backspace or Delete clear, P pencil.
  useGameKeys((kind, keyName, event) => {
    if (!data) return false;
    const dir = directionOf(keyName);
    const digit = /^[1-9]$/.test(keyName) ? Number(keyName) : null;
    const used = dir !== null || digit !== null || keyName === "Backspace" || keyName === "Delete" || keyName === "p";
    if (!used || kind !== "down" || locked) return used;
    if (dir) setSelected(selected === null ? (board.white[0] ?? null) : stepWhite(board, white, selected, dir));
    else if (digit !== null) {
      if (!event.repeat) tapDigit(digit);
    } else if (keyName === "p") {
      if (!event.repeat) setPencilMode((current) => !current);
    } else clearCell();
    return true;
  });

  if (!data) return null;
  const keyClass = `kakuro-key press tap-target rounded-lg font-display font-bold text-foreground disabled:opacity-40 ${inFrame ? "gf-glass" : "border border-border bg-card"}`;

  return (
    <div data-logic-stage="kakuro" data-logic-solved={solving ? "" : undefined} data-stage-column="3" className="relative flex min-h-0 flex-1 flex-col gap-3">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic">
        {inFrame ? null : (
          <p className="logic-status font-mono text-xs uppercase tracking-widest text-muted-foreground">
            filled <span className="text-primary">{filled}</span> / {board.white.length}
          </p>
        )}
        <div className="logic-square logic-glass-frame kakuro-frame">
          <KakuroBoard
            board={board}
            values={values}
            pencil={pencil}
            selected={selected}
            placed={placed}
            onSelect={active ? (cell) => setSelected(cell) : undefined}
          />
        </div>
        <LiveSummary inArena className="logic-status" items={[<SummaryItem key="runs" label="Runs" value={`${doneRuns} / ${runs.length}`} />]} />
      </div>
      <div data-game-controls="numbers" className="kakuro-pad grid shrink-0 grid-cols-6 gap-1.5">
        {DIGITS.slice(0, 5).map((d) => (
          <button key={d} type="button" onClick={() => tapDigit(d)} disabled={locked} className={keyClass}>
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPencilMode((current) => !current)}
          disabled={locked}
          aria-pressed={pencilMode}
          className={`kakuro-tool kakuro-pencil press tap-target overflow-hidden whitespace-nowrap rounded-lg border font-mono text-[11px] uppercase tracking-normal ${
            pencilMode ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground"
          }`}
        >
          Pencil
        </button>
        {DIGITS.slice(5).map((d) => (
          <button key={d} type="button" onClick={() => tapDigit(d)} disabled={locked} className={keyClass}>
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={clearCell}
          disabled={locked}
          className="kakuro-tool col-span-2 press tap-target rounded-lg border border-border bg-card font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "kakuro") return null;
  const solution = puzzle.solution ?? [];
  const mine = decodeKakuro(myAnswer ?? "", puzzle);
  // The solution's digits, with each wrong digit of the player's shown in its place (red) and blanks dimmed.
  const tones: Tone[] = new Array<Tone>(puzzle.size * puzzle.size).fill("entry");
  const values = solution.map((v, cell) => {
    const entry = mine[cell] ?? 0;
    if (!puzzle.white.includes(cell)) return 0;
    if (entry && entry !== v) {
      tones[cell] = "wrong";
      return entry;
    }
    tones[cell] = entry ? "entry" : "missing";
    return v;
  });
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-square-bare logic-glass-frame kakuro-frame" style={{ maxWidth: 320 }}>
          <KakuroBoard board={puzzle} values={values} tones={tones} />
        </div>
      </div>
      {/* Solved: the verdict row above says it (4 Nov 2026: no repeated "Solved · 1.6s"). */}
      {myCorrect ? null : (
        <p className="logic-reveal-text text-center font-mono text-primary">
          {solutionProgress(puzzle, myAnswer ?? "")?.text ?? `${mine.filter(Boolean).length} / ${puzzle.white.length} filled`}
        </p>
      )}
    </div>
  );
}

/** The one grid the clues allow stays server-side until the reveal. */
export const kakuroPuzzle: PuzzleDefinition = {
  key: "kakuro",
  name: gameDisplayName("kakuro"),
  category: "number",
  timeLimitMs: KAKURO_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "kakuro", kakuroRev: 1, size: KAKURO_SIZE, white: [], clues: [] }) satisfies KakuroPuzzleData,
  check: (answer, puzzle) => puzzle.type === "kakuro" && kakuroSolvedGrid(puzzle, decodeKakuro(answer, puzzle)),
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
