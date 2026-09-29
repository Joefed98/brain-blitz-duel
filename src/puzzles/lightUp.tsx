import { useEffect, useRef } from "react";

import { useGridPointer } from "@/components/puzzles/GridDrag";
import { useStageState } from "@/lib/duel/stageState";
import {
  decodeBulbs,
  encodeBulbs,
  lightUpStatus,
  lightUpValid,
  type LightUpBoard,
} from "@/lib/duel/lightUp";
import { LIGHTUP_TIME_MS, type LightUpPuzzleData } from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";
import { buzz } from "@/lib/motion";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** 0 empty, 1 bulb, 2 dot (a note: no bulb here). */
type Mark = 0 | 1 | 2;

function Board({
  board,
  marks,
  wrong,
  small = false,
  pointer,
}: {
  board: LightUpBoard;
  marks: readonly Mark[];
  /** Bulbs to draw red in the reveal. */
  wrong?: ReadonlySet<number>;
  small?: boolean;
  pointer?: ReturnType<typeof useGridPointer>;
}) {
  const { size } = board;
  const bulbs = marks.flatMap((m, cell) => (m === 1 ? [cell] : []));
  const status = lightUpStatus(board, bulbs);
  const wallIndex = new Map(board.walls.map((wall, i) => [wall, i]));
  return (
    <div
      ref={pointer?.ref}
      {...(pointer ? pointer.handlers : {})}
      className="grid w-full select-none"
      style={{ ...(pointer?.handlers.style ?? {}), gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gap: small ? 1 : 2 }}
    >
      {Array.from({ length: size * size }, (_, cell) => {
        const wi = wallIndex.get(cell);
        if (wi !== undefined) {
          const n = board.wallNumbers[wi] ?? -1;
          return (
            <div key={cell} className="flex aspect-square items-center justify-center rounded-sm bg-background">
              {n >= 0 && (
                <span className={`font-mono font-bold text-foreground ${small ? "text-xs" : "text-lg"}`}>{n}</span>
              )}
            </div>
          );
        }
        const mark = marks[cell] ?? 0;
        const bad = status.clashing.has(cell) || wrong?.has(cell);
        return (
          <div
            key={cell}
            className={`flex aspect-square items-center justify-center rounded-sm border border-border ${
              status.lit.has(cell) ? "bg-primary/20" : "bg-card"
            }`}
          >
            {mark === 1 ? (
              <span
                className={`block h-1/2 w-1/2 rounded-full ${bad ? "animate-pulse bg-destructive" : "bg-primary"}`}
                style={{ boxShadow: bad ? undefined : "0 0 10px var(--primary)" }}
              />
            ) : mark === 2 ? (
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function IntroExample() {
  const board: LightUpBoard = { size: 4, walls: [5, 14], wallNumbers: [1, -1] };
  const marks: Mark[] = new Array(16).fill(0);
  marks[4] = 1;
  marks[11] = 1;
  return (
    <div style={{ width: 150 }}>
      <Board board={board} marks={marks} />
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: LightUpPuzzleData | null = puzzle.type === "lightup" ? puzzle : null;
  const size = data?.size ?? 7;
  const [marks, setMarks] = useStageState<Mark[]>(stateKey ?? "lightup", "lightUpMarks", () =>
    new Array(size * size).fill(0),
  );
  const submitted = useRef(false);
  const pressed = useRef(false);
  const bulbs = marks.flatMap((m, cell) => (m === 1 ? [cell] : []));
  const encoded = encodeBulbs(bulbs);

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
            if (pressed.current || submitted.current || walls.has(cell)) return;
            pressed.current = true;
            buzz(8);
            setMarks((current) => current.map((m, i) => (i === cell ? (((m + 1) % 3) as Mark) : m)));
          }
        : undefined,
    onRelease: () => {
      pressed.current = false;
    },
  });

  if (!data) return null;
  const status = lightUpStatus(data, bulbs);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        lit <span className="text-primary">{status.lit.size}</span> / {status.whites}
      </p>
      <div className="w-full" style={{ maxWidth: 380, minWidth: 320 }}>
        <Board board={data} marks={marks} pointer={pointer} />
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "lightup") return null;
  const cells = puzzle.size * puzzle.size;
  const solution = new Set(puzzle.solution ?? []);
  const mine = decodeBulbs(myAnswer ?? "", puzzle);
  const mineSet = new Set(mine);
  const solvedMarks = Array.from({ length: cells }, (_, c) => (solution.has(c) ? 1 : 0)) as Mark[];
  const myMarks = Array.from({ length: cells }, (_, c) => (mineSet.has(c) ? 1 : 0)) as Mark[];
  const wrong = new Set(mine.filter((c) => !solution.has(c)));
  const status = lightUpStatus(puzzle, mine);
  const elapsed = Math.max(0, LIGHTUP_TIME_MS - (myMsRemaining ?? 0));
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full justify-center gap-3">
        <div className="flex flex-1 flex-col items-center gap-1" style={{ maxWidth: 170 }}>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
          <Board board={puzzle} marks={solvedMarks} small />
        </div>
        <div className="flex flex-1 flex-col items-center gap-1" style={{ maxWidth: 170 }}>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
          <Board board={puzzle} marks={myMarks} wrong={wrong} small />
        </div>
      </div>
      <p className="font-mono text-base text-primary">
        {myCorrect ? `Solved · ${(elapsed / 1000).toFixed(1)}s` : `${status.lit.size} / ${status.whites} lit`}
      </p>
    </div>
  );
}

export const lightUpPuzzle: PuzzleDefinition = {
  key: "lightup",
  name: "Light Up",
  category: "logic",
  timeLimitMs: LIGHTUP_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "lightup", size: 7, walls: [], wallNumbers: [] }) satisfies LightUpPuzzleData,
  check: (answer, puzzle) => puzzle.type === "lightup" && lightUpValid(puzzle, decodeBulbs(answer, puzzle)),
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
