import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { useStageState } from "@/lib/duel/stageState";
import { decodeKakuro, encodeKakuro, kakuroNextEmpty, kakuroRunBroken, kakuroRuns, kakuroRunState, kakuroSolvedGrid, type KakuroRun } from "@/lib/duel/kakuro";
import { numberArt } from "@/components/puzzles/number/overhaul";
import { RevealFacts, RevealView, type RevealSide } from "@/components/puzzles/number/RevealParts";
import "@/polish-layout/number-kakuro.css";
import { KAKURO_SIZE, KAKURO_TIME_MS, type KakuroPuzzleData } from "@/lib/duel/types";
import { directionOf, useGameKeys } from "@/lib/desktop";
import { playCorrect } from "@/lib/sound";

import { soundCue, useSolveFx } from "./logicFx";
import { gameFx, releaseGameFx } from "@/lib/fx/kit";
import { kakuroRunRate, kakuroSolveOrder } from "./kakuroFx";
import { LiveSummary, SummaryItem, useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
// The Number overhaul's shared look (darker background, navy and champagne controls), loaded with the game.
import "@/polish-layout/number-overhaul.css";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

type Board = Pick<KakuroPuzzleData, "size" | "white" | "clues">;
type Tone = "entry" | "wrong" | "missing" | "missed" | "given";

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
  // The Number overhaul (display, every stamp): a run reads broken the moment it breaks a rule, including blanks that
  // can no longer reach its clue (kakuroRunBroken); a full right run is done.
  const states = runs.map((run) => (kakuroRunBroken(run, values) ? "bad" : kakuroRunState(run, values)));
  const lit = new Set<number>(selected !== null && selected !== undefined ? (byCell.get(selected) ?? []) : []);
  // A clue's state: its across run (top-right) and down run (bottom-left).
  const runOf = new Map<string, number>();
  runs.forEach((run, i) => runOf.set(`${run.clue}:${run.across ? "a" : "d"}`, i));
  // The solve sweep (stage 2): the runs light across, then down (kakuroFx.ts).
  const order = useMemo(() => kakuroSolveOrder(runs), [runs]);
  const sumClass = (i: number | undefined) =>
    i === undefined ? "" : states[i] === "done" ? "kakuro-sum-done" : states[i] === "bad" ? "kakuro-sum-bad" : lit.has(i) ? "kakuro-sum-lit" : "";

  return (
    <div
      className={`kakuro-board grid w-full shrink-0 select-none ${small ? "kakuro-small" : ""}`}
      data-number-kakuro=""
      style={{
        "--kakuro-cell-art": `url(${numberArt("kakuro", "cell")})`,
        "--kakuro-clue-art": `url(${numberArt("kakuro", "clue")})`,
        "--kakuro-block-art": `url(${numberArt("kakuro", "block")})`,
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        aspectRatio: "1",
        gap: small ? 1 : 2,
        containerType: "inline-size",
        "--kakuro-n": size,
        "--kakuro-step": `${order.step}ms`,
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
                  {clue.right > 0 ? <span className={`kakuro-sum kakuro-sum-right ${sumClass(runOf.get(`${cell}:a`))}`} data-kakuro-run={runOf.get(`${cell}:a`)}>{clue.right}</span> : null}
                  {clue.down > 0 ? <span className={`kakuro-sum kakuro-sum-down ${sumClass(runOf.get(`${cell}:d`))}`} data-kakuro-run={runOf.get(`${cell}:d`)}>{clue.down}</span> : null}
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
            className={`kakuro-cell press relative flex min-h-0 min-w-0 items-center justify-center ${isSelected ? "kakuro-selected" : inLit ? "kakuro-lit" : ""} ${done && !tones ? "kakuro-done" : ""} ${bad && !tones ? "kakuro-bad" : ""} kakuro-tone-${tone}`}
            style={{ ...place, "--kakuro-a": order.turns.get(cell)?.a ?? 0, "--kakuro-d": order.turns.get(cell)?.d ?? 0 } as CSSProperties}
            // 7 Nov 2026 (accessibility audit #16): the clue cells are hidden, so each white cell names its run sums
            // (and whether a run is complete or broken), the digit or its notes.
            aria-label={`Row ${row}, column ${col}, ${value ? value : marks.length ? `notes ${marks.join(" ")}` : "empty"}${mine
              .map((i) => `, ${runs[i]!.across ? "across" : "down"} ${runs[i]!.sum}${states[i] === "done" ? " done" : states[i] === "bad" ? " broken" : ""}`)
              .join("")}`}
            data-kakuro-cell={cell}
          >
            {value ? (
              <span key={value} className="kakuro-digit" data-kakuro-placed={placed === cell ? "" : undefined}>
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
  const boardBox = useRef<HTMLDivElement | null>(null);
  const encoded = encodeKakuro(values);
  const solved = data !== null && kakuroSolvedGrid(board, values);
  const solving = useSolveFx("kakuro", solved);
  const filled = board.white.filter((c) => values[c]).length;
  const inFrame = useFrameProgress(filled, board.white.length, "filled");
  const doneSet = runs.map((run) => kakuroRunState(run, values) === "done");
  const doneRuns = doneSet.filter(Boolean).length;
  const prevDone = useRef(doneSet);
  const brokenSet = runs.map((run) => kakuroRunBroken(run, values));
  const prevBroken = useRef(brokenSet);
  const clueEl = (run: number) => boardBox.current?.querySelector<HTMLElement>(`[data-kakuro-run="${run}"]`) ?? null;

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  // A run completed right (not the last move, which plays the solve): its clue turns gold with the kit's match (the
  // clue swells and sparks, then is released back to its gold self) and a two-note pitched by the run's length
  // (kakuroRunRate, through the cue's rate). Two runs completed by one digit: the combo in place of the run chime.
  const doneKey = doneSet.map((d) => (d ? 1 : 0)).join("");
  useEffect(() => {
    const was = prevDone.current;
    prevDone.current = doneSet;
    const fresh = doneSet.map((d, i) => (d && !was[i] ? i : -1)).filter((i) => i >= 0);
    if (!fresh.length || solved) return;
    for (const i of fresh) {
      const el = clueEl(i);
      const anim = gameFx("match", el, { silent: true });
      if (anim) anim.finished.then(() => releaseGameFx(el), () => releaseGameFx(el));
      else releaseGameFx(el);
    }
    if (fresh.length >= 2) {
      soundCue("kakuro.combo");
      gameFx("combo", boardBox.current?.querySelector("[data-kakuro-placed]"), { count: fresh.length, silent: true });
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("duelz-sound", { detail: { cue: "kakuro.run", rate: kakuroRunRate(runs[fresh[0]!]!.cells.length) } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey, solved]);

  // A run newly broken (a repeat, past its clue, or out of reach): its clue pulses red once (the kit's wrong) with a
  // low tick, once.
  const brokenKey = brokenSet.map((b) => (b ? 1 : 0)).join("");
  useEffect(() => {
    const was = prevBroken.current;
    prevBroken.current = brokenSet;
    const fresh = brokenSet.map((b, i) => (b && !was[i] ? i : -1)).filter((i) => i >= 0);
    if (!fresh.length) return;
    soundCue("kakuro.broken");
    for (const i of fresh) gameFx("wrong", clueEl(i), { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokenKey]);

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
      soundCue("kakuro.pencil");
      setPencil((current) =>
        current.map((marks, cell) =>
          cell === selected ? (marks.includes(digit) ? marks.filter((d) => d !== digit) : [...marks, digit].sort((a, b) => a - b)) : marks,
        ),
      );
      return;
    }
    const next = values.map((v, cell) => (cell === selected ? (v === digit ? 0 : digit) : v));
    if (values[selected] !== digit) {
      setPlaced(selected);
      soundCue("kakuro.place");
      // The digit drops into its square (the kit's drop; the game's own cue above).
      const cell = selected;
      requestAnimationFrame(() => gameFx("drop", boardBox.current?.querySelector(`[data-kakuro-cell="${cell}"] .kakuro-digit`), { silent: true }));
      // The Number overhaul: on to the next empty square of the run (across first, then down).
      const following = kakuroNextEmpty(board, next, selected);
      if (following !== null) setSelected(following);
    }
    setValues(next);
  };

  const clearCell = () => {
    if (!active || submitted.current || selected === null) return;
    if (values[selected] || pencil[selected]?.length) soundCue("kakuro.clear");
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
        <div ref={boardBox} className="logic-square kakuro-frame">
          <KakuroBoard
            board={board}
            values={values}
            pencil={pencil}
            selected={selected}
            placed={placed}
            onSelect={active ? (cell) => {
              if (cell !== selected) soundCue("kakuro.select");
              setSelected(cell);
            } : undefined}
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

/**
 * The reveal's two boards (the Number overhaul, 15 Nov 2026; display only): "Yours" draws the player's digits, a wrong
 * one in red with a red outline and an empty square marked missed (the solution's digit faint in a dashed square);
 * "Solution" draws the solved grid. Without the solution (a room's public half before its reveal), a digit is wrong
 * when its run breaks a rule. Pure: the reveal and kakuro's checks share it.
 */
export function kakuroRevealBoard(
  puzzle: Pick<KakuroPuzzleData, "size" | "white" | "clues" | "solution">,
  mine: readonly number[],
  side: RevealSide,
): { values: number[]; tones: Tone[]; right: number; wrong: number; missed: number } {
  const n = puzzle.size * puzzle.size;
  const white = new Set(puzzle.white);
  const solution = puzzle.solution && puzzle.solution.length === n ? puzzle.solution : null;
  const values = new Array<number>(n).fill(0);
  const tones = new Array<Tone>(n).fill("entry");
  let right = 0, wrong = 0, missed = 0;
  // Without the solution: a digit in a broken run is shown wrong (the rule the stage shows during play).
  const brokenCells = new Set<number>();
  if (!solution) for (const run of kakuroRuns(puzzle)) if (kakuroRunBroken(run, mine)) run.cells.forEach((c) => brokenCells.add(c));
  for (let cell = 0; cell < n; cell++) {
    if (!white.has(cell)) continue;
    const entry = mine[cell] ?? 0;
    const want = solution?.[cell] ?? 0;
    const isWrong = entry !== 0 && (solution ? entry !== want : brokenCells.has(cell));
    if (!entry) missed++;
    else if (isWrong) wrong++;
    else right++;
    if (side === "solution" && solution) {
      values[cell] = want;
      tones[cell] = "entry";
    } else if (!entry) {
      values[cell] = want;
      tones[cell] = "missed";
    } else {
      values[cell] = entry;
      tones[cell] = isWrong ? "wrong" : "entry";
    }
  }
  return { values, tones, right, wrong, missed };
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, myExtra }: PuzzleRevealProps) {
  const [side, setSide] = useState<RevealSide>("yours");
  if (puzzle.type !== "kakuro") return null;
  const mine = decodeKakuro(myAnswer ?? "", puzzle);
  const hasSolution = !!puzzle.solution && puzzle.solution.length === puzzle.size * puzzle.size;
  const shown = kakuroRevealBoard(puzzle, mine, hasSolution ? side : "yours");
  const counts = kakuroRevealBoard(puzzle, mine, "yours");
  const runs = kakuroRuns(puzzle);
  const runsDone = runs.filter((run) => kakuroRunState(run, mine) === "done").length;
  // The graded mistakes (the clean bonus's count, kakuroRev 2 rule-breaking digits only); a round with no stored
  // count shows the wrong digits left on the board.
  const stored = typeof myExtra?.["mistakes"] === "number" ? (myExtra["mistakes"] as number) : null;
  const elapsed = myCorrect && myMsRemaining !== undefined ? Math.max(0, timeLimitMs - myMsRemaining) / 1000 : null;
  return (
    <div className="logic-reveal" data-kakuro-reveal>
      {hasSolution ? <RevealView value={side} onChange={setSide} /> : null}
      <div className="logic-reveal-board" data-kakuro-reveal-side={hasSolution ? side : "yours"}>
        <div className="logic-square-bare kakuro-frame" style={{ maxWidth: 360, width: "100%" }}>
          <KakuroBoard board={puzzle} values={shown.values} tones={shown.tones} />
        </div>
      </div>
      {side === "yours" || !hasSolution ? (
        <div className="kakuro-legend" aria-hidden="true">
          {counts.wrong ? <span className="kakuro-legend-item"><i className="kakuro-key-wrong" />Wrong</span> : null}
          {counts.missed ? <span className="kakuro-legend-item"><i className="kakuro-key-missed" />Missed</span> : null}
        </div>
      ) : null}
      <RevealFacts
        facts={[
          { label: "Squares right", value: `${counts.right} / ${puzzle.white.length}`, tone: counts.right === puzzle.white.length ? "good" : undefined },
          { label: "Runs complete", value: `${runsDone} / ${runs.length}` },
          { label: "Mistakes", value: stored ?? counts.wrong, tone: (stored ?? counts.wrong) > 0 ? "miss" : undefined },
          elapsed !== null && { label: "Time", value: `${elapsed.toFixed(1)} s` },
        ]}
      />
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
