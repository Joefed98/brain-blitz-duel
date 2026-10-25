import { gameDisplayName } from "@/lib/duel/gameNames";
import { solutionProgress } from "@/lib/duel/progressFigures";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useGridPointer } from "@/components/puzzles/GridDrag";
import { useStageState } from "@/lib/duel/stageState";
import {
  decodeBulbs,
  encodeBulbs,
  lightUpStatus,
  lightUpValid,
  LIGHTUP_SIZE,
  orth,
  type LightUpBoard,
} from "@/lib/duel/lightUp";
import { LIGHTUP_TIME_MS, type LightUpPuzzleData } from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";
import { buzz } from "@/lib/motion";

import { soundCue, useSolveFx } from "./logicFx";
import { LiveSummary, SummaryItem, useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** 0 empty, 1 bulb, 2 dot (a note: no bulb here). */
type Mark = 0 | 1 | 2;

/** Beam cells per bulb, plus the stretches between two bulbs that see each other. */
function beams(board: LightUpBoard, bulbs: readonly number[]) {
  const { size } = board;
  const wallSet = new Set(board.walls);
  const bulbSet = new Set(bulbs);
  const h = new Set<number>();
  const v = new Set<number>();
  const redH = new Set<number>();
  const redV = new Set<number>();
  for (const bulb of bulbs) {
    h.add(bulb);
    v.add(bulb);
    const r = Math.floor(bulb / size);
    const c = bulb % size;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const run: number[] = [bulb];
      let rr = r + dr;
      let cc = c + dc;
      while (rr >= 0 && cc >= 0 && rr < size && cc < size && !wallSet.has(rr * size + cc)) {
        const cell = rr * size + cc;
        run.push(cell);
        (dr === 0 ? h : v).add(cell);
        if (bulbSet.has(cell)) {
          for (const x of run) (dr === 0 ? redH : redV).add(x);
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }
  return { h, v, redH, redV };
}

function Board({
  board,
  marks,
  wrong,
  small = false,
  pointer,
  spread,
}: {
  board: LightUpBoard;
  marks: readonly Mark[];
  /** Bulbs to draw red in the reveal. */
  wrong?: ReadonlySet<number>;
  small?: boolean;
  pointer?: ReturnType<typeof useGridPointer>;
  /** The lamp just placed, keyed per tap: its light spreads out along the beams. */
  spread?: { cell: number; key: number } | null;
}) {
  const { size } = board;
  const bulbs = marks.flatMap((m, cell) => (m === 1 ? [cell] : []));
  const bulbSet = new Set(bulbs);
  const status = lightUpStatus(board, bulbs);
  const beam = beams(board, bulbs);
  const wallIndex = new Map(board.walls.map((wall, i) => [wall, i]));
  const beamW = small ? 2 : 4;
  return (
    <div
      ref={pointer?.ref}
      {...(pointer ? pointer.handlers : {})}
      className={`logic-lamps grid w-full select-none ${small ? "logic-lamps-small" : ""}`}
      style={{ ...(pointer?.handlers.style ?? {}), gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gap: small ? 1 : 2 }}
    >
      {Array.from({ length: size * size }, (_, cell) => {
        const wi = wallIndex.get(cell);
        if (wi !== undefined) {
          const n = board.wallNumbers[wi] ?? -1;
          const touching = orth(cell, size).filter((x) => bulbSet.has(x)).length;
          const over = n >= 0 && touching > n;
          const done = n >= 0 && touching === n;
          return (
            <div
              key={cell}
              className={`lightup-wall logic-wall relative flex aspect-square items-center justify-center rounded-sm ${over ? "bg-destructive" : ""}`}
            >
              {n >= 0 && (
                <span className={`font-mono font-bold ${over ? "text-destructive-foreground" : "text-foreground"} ${small ? "text-xs" : "text-lg"}`}>{n}</span>
              )}
              {done && !small && (
                <span className="absolute right-0.5 top-0 text-xs font-bold leading-none text-primary">✓</span>
              )}
            </div>
          );
        }
        const mark = marks[cell] ?? 0;
        const bad = status.clashing.has(cell) || wrong?.has(cell);
        const lit = status.lit.has(cell);
        const r = Math.floor(cell / size);
        const c = cell % size;
        const from = spread ? { r: Math.floor(spread.cell / size), c: spread.cell % size } : null;
        const reach = from && lit && (from.r === r || from.c === c) ? Math.abs(from.r - r) + Math.abs(from.c - c) : -1;
        return (
          <div
            key={cell}
            style={{ "--logic-diag": r + c } as CSSProperties}
            className={`lightup-cell logic-lamp-cell relative flex aspect-square items-center justify-center overflow-hidden rounded-sm border ${
              lit ? "lightup-cell-lit border-transparent" : "border-dotted border-muted-foreground/50 bg-card"
            }`}
          >
            {reach >= 0 && (
              <span key={spread?.key} aria-hidden="true" className="logic-light-in" style={{ animationDelay: `${reach * 40}ms` }} />
            )}
            {beam.h.has(cell) && (
              <span
                className={`absolute inset-x-0 top-1/2 -translate-y-1/2 ${beam.redH.has(cell) ? "bg-destructive" : "lightup-beam"}`}
                style={{ height: beamW }}
              />
            )}
            {beam.v.has(cell) && (
              <span
                className={`absolute inset-y-0 left-1/2 -translate-x-1/2 ${beam.redV.has(cell) ? "bg-destructive" : "lightup-beam"}`}
                style={{ width: beamW }}
              />
            )}
            {mark === 1 ? (
              <span
                className={`logic-lamp relative block h-1/2 w-1/2 rounded-full ${bad ? "animate-pulse bg-destructive" : "bg-primary"}`}
                style={{ boxShadow: bad ? undefined : "0 0 10px var(--primary)" }}
              />
            ) : mark === 2 ? (
              <span className="relative h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Worked 4×4 example: before (walls, one numbered 1) and after (two bulbs, all lit, the 1 ticked). */
const EXAMPLE: LightUpBoard = { size: 4, walls: [0, 1, 2, 12, 14], wallNumbers: [-1, 1, -1, -1, -1] };

export function LightUpExample() {
  const before: Mark[] = new Array(16).fill(0);
  const after: Mark[] = new Array(16).fill(0);
  after[5] = 1;
  after[11] = 1;
  return (
    <div className="flex w-full flex-col items-center gap-1">
      <div className="flex items-end justify-center gap-3">
        <div className="flex flex-col items-center gap-1" style={{ width: 112 }}>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Before</span>
          <Board board={EXAMPLE} marks={before} small />
        </div>
        <span className="pb-10 text-muted-foreground">→</span>
        <div className="flex flex-col items-center gap-1" style={{ width: 112 }}>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">After</span>
          <Board board={EXAMPLE} marks={after} small />
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">Two bulbs light every square; the 1 has one bulb beside it.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: LightUpPuzzleData | null = puzzle.type === "lightup" ? puzzle : null;
  const size = data?.size ?? LIGHTUP_SIZE;
  const [marks, setMarks] = useStageState<Mark[]>(stateKey ?? "lightup", "lightUpMarks", () =>
    new Array(size * size).fill(0),
  );
  const [spread, setSpread] = useState<{ cell: number; key: number } | null>(null);
  const submitted = useRef(false);
  const pressed = useRef(false);
  const bulbs = marks.flatMap((m, cell) => (m === 1 ? [cell] : []));
  const encoded = encodeBulbs(bulbs);
  const solving = useSolveFx("lightup", Boolean(data && lightUpValid(data, bulbs)));

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current || !lightUpValid(data, bulbs)) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encoded, locked]);

  const walls = new Set(data?.walls ?? []);
  const pointer = useGridPointer({
    cols: size,
    rows: size,
    onCell:
      !locked && data
        ? (cell) => {
            // One press = one tap on the cell first touched.
            if (pressed.current || submitted.current) return;
            if (walls.has(cell)) return puzzleReject();
            pressed.current = true;
            buzz(8);
            const next = ((marks[cell] ?? 0) + 1) % 3;
            soundCue(next === 1 ? "lightup.lamp" : next === 2 ? "lightup.dot" : "lightup.clear");
            setSpread((current) => (next === 1 ? { cell, key: (current?.key ?? 0) + 1 } : null));
            setMarks((current) => current.map((m, i) => (i === cell ? (((m + 1) % 3) as Mark) : m)));
          }
        : undefined,
    onRelease: () => {
      pressed.current = false;
    },
  });

  const liveStatus = data ? lightUpStatus(data, bulbs) : null;
  const inFrame = useFrameProgress(liveStatus?.lit.size ?? 0, liveStatus?.whites ?? 0, "lit");
  if (!data || !liveStatus) return null;
  const status = liveStatus;

  return (
    <div data-logic-stage="lightup" data-logic-solved={solving ? "" : undefined} data-stage-column="2" className="relative flex min-h-0 flex-1 flex-col gap-2">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic" className="px-3">
        {inFrame ? null : (
          <p className="logic-status font-mono text-xs uppercase tracking-widest text-muted-foreground">
            lit <span className="text-primary">{status.lit.size}</span> / {status.whites}
          </p>
        )}
        <div className="logic-square logic-lamp-frame">
          <Board board={data} marks={marks} pointer={pointer} spread={spread} />
        </div>
        <LiveSummary
          inArena
          className="logic-status"
          items={[
            <SummaryItem key="lamps" label="Lamps" value={bulbs.length} />,
            <SummaryItem key="dots" label="Dots" value={marks.filter((mark) => mark === 2).length} />,
          ]}
        />
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "lightup") return null;
  const cells = puzzle.size * puzzle.size;
  const solution = new Set(puzzle.solution ?? []);
  const mine = decodeBulbs(myAnswer ?? "", puzzle);
  const mineSet = new Set(mine);
  const solvedMarks = Array.from({ length: cells }, (_, c) => (solution.has(c) ? 1 : 0)) as Mark[];
  const myMarks = Array.from({ length: cells }, (_, c) => (mineSet.has(c) ? 1 : 0)) as Mark[];
  const wrong = new Set(mine.filter((c) => !solution.has(c)));
  const status = lightUpStatus(puzzle, mine);
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-pair">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
            <Board board={puzzle} marks={solvedMarks} small />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
            <Board board={puzzle} marks={myMarks} wrong={wrong} small />
          </div>
        </div>
      </div>
      <p className="logic-reveal-text text-center font-mono text-primary">
        {myCorrect ? `Solved · ${(elapsed / 1000).toFixed(1)}s` : (solutionProgress(puzzle, myAnswer ?? "")?.text ?? `${status.lit.size} / ${status.whites} lit`)}
      </p>
    </div>
  );
}

export const lightUpPuzzle: PuzzleDefinition = {
  key: "lightup",
  name: gameDisplayName("lightup"),
  category: "logic",
  timeLimitMs: LIGHTUP_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "lightup", size: LIGHTUP_SIZE, walls: [], wallNumbers: [] }) satisfies LightUpPuzzleData,
  check: (answer, puzzle) => puzzle.type === "lightup" && lightUpValid(puzzle, decodeBulbs(answer, puzzle)),
  revealHeading: "The solution",
  IntroExample: LightUpExample,
  Stage,
  Reveal,
};
