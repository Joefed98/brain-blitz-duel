import { useEffect, useRef, useState } from "react";

import { useGridPointer } from "@/components/puzzles/GridDrag";
import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import {
  btDecode,
  btEncode,
  btExitCell,
  btIsBlockerTile,
  btRampDir,
  btReplay,
  btRun,
  BT_COLS,
  BT_ROWS,
  type BtBoard,
  type BtEvent,
} from "@/lib/duel/ballTrack";
import { useStageState } from "@/lib/duel/stageState";
import { BALLTRACK_TIME_MS, type BallTrackPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect } from "@/lib/sound";
import { Button } from "@/components/ui/button";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const STEP_MS = 85;

function Board({
  board,
  removed,
  ball,
  trail,
  highlight,
  pointer,
  small = false,
}: {
  board: BtBoard;
  removed: ReadonlySet<number>;
  ball: number;
  trail?: ReadonlySet<number>;
  /** Reveal: blockers in the minimal solution. */
  highlight?: ReadonlySet<number>;
  pointer?: ReturnType<typeof useGridPointer>;
  small?: boolean;
}) {
  const exitCell = btExitCell(board);
  return (
    <div
      ref={pointer?.ref}
      {...(pointer ? pointer.handlers : {})}
      data-play-area
      className="grid h-full w-full select-none"
      style={{
        ...(pointer?.handlers.style ?? {}),
        gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${board.rows}, minmax(0, 1fr))`,
        gap: small ? 1 : 2,
      }}
    >
      {Array.from({ length: board.cols * board.rows }, (_, cell) => {
        const t = board.tiles[cell] ?? "#";
        const blocker = btIsBlockerTile(t) && !removed.has(cell);
        const gone = btIsBlockerTile(t) && removed.has(cell);
        const dir = btRampDir(t);
        const isExit = cell === exitCell;
        const isStart = cell === board.start;
        let cls = "bg-card";
        if (t === "#") cls = "bg-muted";
        else if (t === "<" || t === ">") cls = "bg-muted";
        else if (blocker) cls = `border-2 border-primary bg-primary/15 ${highlight?.has(cell) ? "ring-2 ring-destructive" : ""}`;
        else if (gone) cls = "border border-dashed border-primary/30 bg-card";
        if (isExit) cls = "border-2 border-dashed border-primary bg-primary/25";
        return (
          <div key={cell} className={`relative flex items-center justify-center overflow-hidden rounded-sm ${cls}`}>
            {trail?.has(cell) && <span className="absolute inset-[30%] rounded-full bg-primary/30" />}
            {dir !== 0 && (t === "<" || t === ">" || blocker) && (
              <span className={`font-bold leading-none ${blocker ? "text-primary" : "text-foreground/70"} ${small ? "text-[9px]" : "text-sm"}`}>
                {dir < 0 ? "◀" : "▶"}
              </span>
            )}
            {isExit && cell !== ball && (
              <span className={`font-mono font-bold uppercase text-primary ${small ? "text-[6px]" : "text-[9px]"}`}>exit</span>
            )}
            {isStart && cell !== ball && <span className="absolute inset-x-1 top-0.5 h-0.5 rounded bg-muted-foreground/60" />}
            {cell === ball && (
              <span className="absolute inset-[14%] rounded-full bg-foreground shadow-[0_0_8px_var(--primary)]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Fixed 5×5 example: two blockers removed, then the ball runs to the exit. Animated once. */
const EXAMPLE: BtBoard = {
  cols: 5,
  rows: 5,
  tiles: "......b....>.....b..#...#",
  start: 1,
  exit: 2,
};

function IntroExample() {
  const [removed, setRemoved] = useState<number[]>([]);
  const [ball, setBall] = useState(EXAMPLE.start);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setRemoved([6]), 900));
    timers.push(setTimeout(() => setRemoved([6, 17]), 1700));
    const path = btRun(EXAMPLE, new Set([6, 17]), EXAMPLE.start).path;
    path.forEach((cell, i) => timers.push(setTimeout(() => setBall(cell), 2500 + i * 260)));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: 150, height: 150 }}>
        <Board board={EXAMPLE} removed={new Set(removed)} ball={ball} small />
      </div>
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">
        Tap the two gold blockers, then GO: the ball drops, the arrow rolls it right, and it falls into the exit.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: BallTrackPuzzleData | null = puzzle.type === "balltrack" ? puzzle : null;
  const [events, setEvents] = useStageState<BtEvent[]>(stateKey ?? "balltrack", "ballTrackEvents", () => []);
  const [anim, setAnim] = useState<{ path: number[]; i: number } | null>(null);
  const submitted = useRef(false);
  const pressed = useRef(false);
  const encoded = btEncode(events);
  const replay = data ? btReplay(data, events) : null;

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  // Step the ball along the last GO's path.
  useEffect(() => {
    if (!anim) return;
    if (anim.i >= anim.path.length - 1) {
      const t = setTimeout(() => setAnim(null), STEP_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setAnim({ ...anim, i: anim.i + 1 }), STEP_MS);
    return () => clearTimeout(t);
  }, [anim]);

  useEffect(() => {
    if (!replay?.exited || anim || submitted.current || locked) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay?.exited, anim, locked]);

  const busy = locked || !!anim || !!replay?.exited;
  const removedSet = new Set(replay?.removed ?? []);
  const pointer = useGridPointer({
    cols: BT_COLS,
    rows: BT_ROWS,
    onCell:
      data && !busy
        ? (cell) => {
            if (pressed.current) return;
            pressed.current = true;
            if (!btIsBlockerTile(data.tiles[cell]) || removedSet.has(cell)) return;
            buzz(8);
            setEvents((current) => [...current, { k: "r", cell }]);
          }
        : undefined,
    onRelease: () => {
      pressed.current = false;
    },
  });

  if (!data || !replay) return null;
  const go = () => {
    if (busy) return;
    const next: BtEvent[] = [...events, { k: "g" }];
    const run = btReplay(data, next);
    setEvents(next);
    setAnim({ path: run.runs[run.runs.length - 1] ?? [replay.ball], i: 0 });
  };
  const ball = anim ? anim.path[anim.i]! : replay.ball;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 py-1">
      <p className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        removed <span className="text-primary">{replay.removed.length}</span> · row{" "}
        <span className="text-primary">{replay.maxRow}</span> / {data.rows - 1}
      </p>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center" style={{ containerType: "size" }}>
        <div style={{ width: `min(100cqw, calc(100cqh * ${data.cols} / ${data.rows}))`, aspectRatio: `${data.cols} / ${data.rows}` }}>
          <Board board={data} removed={removedSet} ball={ball} pointer={pointer} />
        </div>
      </div>
      <Button type="button" onClick={go} disabled={busy} className="h-[52px] w-full max-w-[343px] shrink-0 font-display text-lg font-bold">
        GO
      </Button>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  const [dev, setDev] = useState(false);
  useEffect(() => setDev(devDiagnosticsOn()), []);
  if (puzzle.type !== "balltrack") return null;
  const mine = btReplay(puzzle, btDecode(myAnswer ?? ""));
  const solution = new Set(puzzle.solution ?? []);
  const solved = btRun(puzzle, solution, puzzle.start).path;
  const elapsed = Math.max(0, BALLTRACK_TIME_MS - (myMsRemaining ?? 0));
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex w-full justify-center gap-3">
        <div className="flex flex-1 flex-col items-center gap-1" style={{ maxWidth: 150 }}>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
          <div style={{ width: "100%", aspectRatio: `${puzzle.cols} / ${puzzle.rows}` }}>
            <Board board={puzzle} removed={solution} ball={solved[solved.length - 1]!} trail={new Set(solved)} small />
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1" style={{ maxWidth: 150 }}>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
          <div style={{ width: "100%", aspectRatio: `${puzzle.cols} / ${puzzle.rows}` }}>
            <Board board={puzzle} removed={new Set(mine.removed)} ball={mine.ball} trail={new Set(mine.runs.flat())} small />
          </div>
        </div>
      </div>
      <p className="font-mono text-base text-primary">
        {myCorrect
          ? `Exit · ${(elapsed / 1000).toFixed(1)}s · ${mine.removed.length} removed (fewest ${puzzle.minRemovals ?? "?"})`
          : `Reached row ${mine.maxRow} / ${puzzle.rows - 1} · fewest removals ${puzzle.minRemovals ?? "?"}`}
      </p>
      {dev && (
        <p className="font-mono text-[10px] text-muted-foreground">
          dev · stored minimum {puzzle.minRemovals ?? "—"} · solution [{(puzzle.solution ?? []).join(", ")}]
        </p>
      )}
    </div>
  );
}

export const ballTrackPuzzle: PuzzleDefinition = {
  key: "balltrack",
  name: "Ball Track",
  category: "pattern",
  timeLimitMs: BALLTRACK_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "balltrack", cols: BT_COLS, rows: BT_ROWS, tiles: ".".repeat(BT_COLS * BT_ROWS), start: 3, exit: 3 }) satisfies BallTrackPuzzleData,
  check: (answer, puzzle) => puzzle.type === "balltrack" && btReplay(puzzle, btDecode(answer)).exited,
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
